import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatest } from './useModel';

const EMPTY_ROWS = [];
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Server-side data (MUI X Pro "data source"). `dataSource.getRows(params)`
 * receives `{ start, end, sortModel, filterModel, paginationModel }` and resolves
 * to `{ rows, rowCount? }`. Two modes:
 *  - paged/full: one request per page (or one for everything without pagination);
 *  - lazy loading: rows are fetched in chunks while the user scrolls, with
 *    skeleton rows standing in for data that has not arrived yet. When the
 *    server does not know the total (`rowCount` omitted or -1) the grid keeps
 *    growing as the user reaches the end (infinite loading).
 */
export function useDataSource({
    dataSource,
    lazyLoading,
    pagination,
    paginationModel,
    sortModel,
    filterModel,
    chunkSize = 100,
    cacheTtlMs = DEFAULT_TTL,
    disableCache = false,
    onError,
}) {
    const enabled = Boolean(dataSource);
    const cacheRef = useRef(new Map());
    const [paged, setPaged] = useState({ rows: EMPTY_ROWS, rowCount: 0, loading: enabled });
    const [version, setVersion] = useState(0);
    const [lazyVersion, setLazyVersion] = useState(0);
    const lazyRef = useRef(null);
    const latest = useLatest({ dataSource, sortModel, filterModel, paginationModel, onError, chunkSize });

    const queryKey = JSON.stringify({ sortModel, filterModel });
    const page = paginationModel.page;
    const pageSize = paginationModel.pageSize;

    const fetchRows = useCallback(
        (params) => {
            const key = JSON.stringify(params);
            const cached = cacheRef.current.get(key);
            if (!disableCache && cached && Date.now() - cached.time < cacheTtlMs) {
                return Promise.resolve(cached.response);
            }
            return Promise.resolve(latest.current.dataSource.getRows(params)).then((response) => {
                if (!disableCache) cacheRef.current.set(key, { response, time: Date.now() });
                return response;
            });
        },
        [cacheTtlMs, disableCache, latest],
    );

    // Paged (or "everything at once") mode.
    useEffect(() => {
        if (!enabled || lazyLoading) return undefined;
        let active = true;
        const { sortModel: sort, filterModel: filter } = latest.current;
        const params = {
            sortModel: sort,
            filterModel: filter,
            paginationModel: pagination ? { page, pageSize } : undefined,
            start: pagination ? page * pageSize : 0,
            end: pagination ? (page + 1) * pageSize - 1 : undefined,
        };
        setPaged((prev) => ({ ...prev, loading: true }));
        fetchRows(params).then(
            (response) => {
                if (!active) return;
                setPaged({
                    rows: response.rows || EMPTY_ROWS,
                    rowCount: response.rowCount ?? (response.rows || []).length,
                    loading: false,
                });
            },
            (error) => {
                if (!active) return;
                setPaged((prev) => ({ ...prev, loading: false }));
                if (latest.current.onError) latest.current.onError(error, params);
            },
        );
        return () => {
            active = false;
        };
    }, [enabled, lazyLoading, queryKey, pagination, page, pageSize, version, fetchRows, latest]);

    const requestRange = useCallback(
        (first, last) => {
            const lazy = lazyRef.current;
            if (!lazy) return;
            const size = latest.current.chunkSize;
            const firstChunk = Math.max(0, Math.floor(first / size));
            const lastChunk = Math.max(firstChunk, Math.floor(last / size));
            for (let chunk = firstChunk; chunk <= lastChunk; chunk += 1) {
                const start = chunk * size;
                if (lazy.chunks.has(chunk)) continue;
                if (lazy.rowCount !== undefined && start >= lazy.rowCount) break;
                lazy.chunks.set(chunk, 'pending');
                const { sortModel: sort, filterModel: filter } = latest.current;
                const params = {
                    sortModel: sort,
                    filterModel: filter,
                    paginationModel: { page: chunk, pageSize: size },
                    start,
                    end: start + size - 1,
                };
                fetchRows(params).then(
                    (response) => {
                        if (lazyRef.current !== lazy) return; // query changed meanwhile
                        const rows = response.rows || [];
                        rows.forEach((row, i) => {
                            lazy.rows[start + i] = row;
                        });
                        if (typeof response.rowCount === 'number' && response.rowCount >= 0) {
                            lazy.rowCount = response.rowCount;
                        } else if (rows.length < size) {
                            lazy.rowCount = start + rows.length;
                        }
                        lazy.loadedEnd = Math.max(lazy.loadedEnd, start + rows.length);
                        lazy.chunks.set(chunk, 'done');
                        setLazyVersion((v) => v + 1);
                    },
                    (error) => {
                        if (lazyRef.current !== lazy) return;
                        lazy.chunks.delete(chunk);
                        if (latest.current.onError) latest.current.onError(error, params);
                    },
                );
            }
        },
        [fetchRows, latest],
    );

    // Lazy-loading mode: reset whenever sorting/filtering changes.
    useEffect(() => {
        if (!enabled || !lazyLoading) return;
        lazyRef.current = { rows: [], rowCount: undefined, chunks: new Map(), loadedEnd: 0 };
        setLazyVersion((v) => v + 1);
        requestRange(0, latest.current.chunkSize - 1);
    }, [enabled, lazyLoading, queryKey, version, requestRange, latest]);

    const refetch = useCallback(() => {
        cacheRef.current.clear();
        setVersion((v) => v + 1);
    }, []);

    if (!enabled) return { enabled: false };

    if (lazyLoading) {
        const lazy = lazyRef.current || { rows: [], rowCount: undefined, chunks: new Map(), loadedEnd: 0 };
        const rowCount = lazy.rowCount !== undefined ? lazy.rowCount : lazy.loadedEnd + latest.current.chunkSize;
        return {
            enabled: true,
            lazy: { rows: lazy.rows, rowCount, version: lazyVersion, isRowCountKnown: lazy.rowCount !== undefined },
            loading: false,
            requestRange,
            refetch,
            clearCache: () => cacheRef.current.clear(),
        };
    }
    return {
        enabled: true,
        rows: paged.rows,
        rowCount: paged.rowCount,
        loading: paged.loading,
        lazy: null,
        requestRange,
        refetch,
        clearCache: () => cacheRef.current.clear(),
    };
}
