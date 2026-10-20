import React, { useMemo, useRef, useState } from 'react';
import { DataGridPro, gridFilterRows, gridSortRows } from '../../opengrid';
import { toolbarSlotProps } from '../env';
import { COMMODITIES, STATUSES, createCommodityRows } from '../data';
import { StatusChip, currency } from '../renderers';

const TOTAL = 50000;

const columns = [
    { field: 'id', headerName: 'ID', type: 'number', width: 90 },
    { field: 'commodity', headerName: 'Commodity', type: 'singleSelect', valueOptions: COMMODITIES, width: 160 },
    { field: 'traderName', headerName: 'Trader', width: 170 },
    { field: 'quantity', headerName: 'Quantity', type: 'number', width: 120 },
    {
        field: 'status',
        headerName: 'Status',
        type: 'singleSelect',
        valueOptions: STATUSES,
        width: 150,
        renderCell: (p) => <StatusChip value={p.value} />,
    },
    { field: 'unitPrice', headerName: 'Unit Price', type: 'number', width: 120 },
    { field: 'pnl', headerName: 'PnL', type: 'number', width: 140, valueFormatter: (value) => currency(value) },
    { field: 'tradeDate', headerName: 'Trade Date', type: 'date', width: 130 },
    { field: 'counterPartyName', headerName: 'Counterparty', width: 150 },
];

/** A fake REST backend: filters/sorts with OpenGrid's own helpers, adds latency. */
function createMockServer(allRows, { latency = 450, knownRowCount = true, onRequest }) {
    const cache = new Map();
    return {
        getRows: (params) =>
            new Promise((resolve) => {
                const started = performance.now();
                setTimeout(
                    () => {
                        const key = JSON.stringify([params.sortModel, params.filterModel]);
                        let processed = cache.get(key);
                        if (!processed) {
                            processed = gridSortRows(
                                gridFilterRows(allRows, columns, params.filterModel),
                                columns,
                                params.sortModel,
                            );
                            cache.set(key, processed);
                        }
                        const end = params.end === undefined ? processed.length - 1 : params.end;
                        const rows = processed.slice(params.start, end + 1);
                        if (onRequest)
                            onRequest({
                                ...params,
                                returned: rows.length,
                                ms: Math.round(performance.now() - started),
                            });
                        resolve({ rows, rowCount: knownRowCount ? processed.length : undefined });
                    },
                    latency * (0.6 + Math.random() * 0.8),
                );
            }),
    };
}

const MODES = [
    { value: 'lazy', label: 'Lazy loading (known row count)' },
    { value: 'infinite', label: 'Lazy loading (unknown row count)' },
    { value: 'pagination', label: 'Server-side pagination' },
    { value: 'scrollEnd', label: 'Infinite scroll (onRowsScrollEnd)' },
];

export default function ServerSideDemo({ theme }) {
    const allRows = useMemo(() => createCommodityRows(TOTAL, 21), []);
    const [mode, setMode] = useState('lazy');
    const [log, setLog] = useState([]);
    const logRef = useRef(setLog);
    logRef.current = setLog;

    const dataSource = useMemo(() => {
        if (mode === 'scrollEnd') return null;
        return createMockServer(allRows, {
            knownRowCount: mode !== 'infinite',
            onRequest: (entry) => logRef.current((prev) => [entry, ...prev].slice(0, 8)),
        });
    }, [allRows, mode]);

    // onRowsScrollEnd mode: append a batch every time the user hits the bottom.
    const [scrollRows, setScrollRows] = useState(() => allRows.slice(0, 60));
    const [loadingMore, setLoadingMore] = useState(false);
    const loadMore = () => {
        if (loadingMore || scrollRows.length >= 1000) return;
        setLoadingMore(true);
        setTimeout(() => {
            setScrollRows((prev) => {
                const next = allRows.slice(prev.length, prev.length + 40);
                setLog((entries) =>
                    [
                        {
                            start: prev.length,
                            end: prev.length + next.length - 1,
                            returned: next.length,
                            ms: 600,
                            scrollEnd: true,
                        },
                        ...entries,
                    ].slice(0, 8),
                );
                return [...prev, ...next];
            });
            setLoadingMore(false);
        }, 600);
    };

    return (
        <div className="demo-section">
            <div className="demo-controls">
                <div className="demo-segmented" role="radiogroup" aria-label="Loading mode">
                    {MODES.map((m) => (
                        <button
                            key={m.value}
                            type="button"
                            className={mode === m.value ? 'active' : ''}
                            onClick={() => {
                                setLog([]);
                                setMode(m.value);
                            }}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="demo-split">
                <div className="demo-grid" style={{ height: 560 }}>
                    {mode === 'scrollEnd' ? (
                        <DataGridPro
                            key="scroll-end"
                            rows={scrollRows}
                            columns={columns}
                            theme={theme}
                            loading={loadingMore}
                            onRowsScrollEnd={loadMore}
                            slotProps={{ loadingOverlay: { variant: 'linear-progress' }, toolbar: toolbarSlotProps }}
                            showToolbar
                            aria-label="Infinite scroll"
                        />
                    ) : (
                        <DataGridPro
                            key={mode}
                            columns={columns}
                            dataSource={dataSource}
                            lazyLoading={mode !== 'pagination'}
                            lazyLoadingRequestChunkSize={100}
                            pagination={mode === 'pagination'}
                            pageSizeOptions={[25, 50, 100]}
                            initialState={{ pagination: { paginationModel: { page: 0, pageSize: 50 } } }}
                            theme={theme}
                            headerFilters
                            slotProps={{
                                loadingOverlay: { variant: 'linear-progress', noRowsVariant: 'skeleton' },
                                toolbar: toolbarSlotProps,
                            }}
                            showToolbar
                            aria-label="Server-side data"
                        />
                    )}
                </div>
                <aside className="demo-log" aria-label="Requests">
                    <div className="demo-log-title">Requests to the fake server</div>
                    {log.length === 0 && <div className="demo-muted">Scroll, sort or filter…</div>}
                    {log.map((entry, index) => (
                        <div key={index} className="demo-log-entry">
                            <code>
                                rows {entry.start}–{entry.end}
                            </code>
                            <span className="demo-muted">
                                {' '}
                                → {entry.returned} rows · {entry.ms} ms
                            </span>
                            {entry.sortModel && entry.sortModel.length > 0 && (
                                <div className="demo-muted">
                                    sort: {entry.sortModel.map((s) => `${s.field} ${s.sort}`).join(', ')}
                                </div>
                            )}
                            {entry.filterModel &&
                                (entry.filterModel.items.length > 0 ||
                                    entry.filterModel.quickFilterValues.length > 0) && (
                                    <div className="demo-muted">
                                        filter:{' '}
                                        {[
                                            ...entry.filterModel.items.map(
                                                (i) =>
                                                    `${i.field} ${i.operator} ${Array.isArray(i.value) ? i.value.join('|') : (i.value ?? '')}`,
                                            ),
                                            ...entry.filterModel.quickFilterValues.map((q) => `“${q}”`),
                                        ].join(', ')}
                                    </div>
                                )}
                        </div>
                    ))}
                </aside>
            </div>
        </div>
    );
}
