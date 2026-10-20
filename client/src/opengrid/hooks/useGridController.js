import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    DEFAULT_FILTER_MODEL,
    DEFAULT_PINNED_COLUMNS,
    DEFAULT_PINNED_ROWS,
    DENSITY_FACTORS,
    GRID_CHECKBOX_SELECTION_FIELD,
    GRID_DETAIL_PANEL_TOGGLE_FIELD,
    GRID_REORDER_FIELD,
    GRID_SPECIAL_FIELDS,
    GRID_TREE_DATA_GROUPING_FIELD,
    SKELETON_ID_PREFIX,
} from '../constants';
import { getCellText, getCellValue, getFormattedValue, normalizeColumn } from '../core/columns';
import { buildCsv, buildTsv, exportCsv, getExportColumns, printRows } from '../core/export';
import { computeColumnGroupRows, computeColumnsLayout, computeSectionSpans } from '../core/layout';
import {
    buildRowStore,
    buildTree,
    createFilterPredicate,
    createSorter,
    filterTree,
    flattenTree,
    getDescendantIds,
} from '../core/rows';
import { createRowSizes } from '../core/rowSizes';
import { clamp, copyToClipboard, cssEscape, nextId } from '../core/utils';
import { enUS } from '../localeText';
import {
    createCheckboxColumn,
    createDetailPanelToggleColumn,
    createReorderColumn,
    createTreeDataGroupingColumn,
} from '../components/specialColumns';
import { useDataSource } from './useDataSource';
import { useLatest, useModel } from './useModel';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const DEFAULT_PAGINATION_MODEL = { page: 0, pageSize: 100 };

const DEFAULT_PROPS = {
    rows: EMPTY_ARRAY,
    columns: EMPTY_ARRAY,
    rowHeight: 52,
    columnHeaderHeight: 56,
    pageSizeOptions: [25, 50, 100],
    paginationMode: 'client',
    sortingMode: 'client',
    filterMode: 'client',
    sortingOrder: ['asc', 'desc', null],
    editMode: 'cell',
    rowBufferPx: 150,
    columnBufferPx: 150,
    scrollEndThreshold: 80,
    defaultGroupingExpansionDepth: 0,
    getDetailPanelHeight: () => 500,
    estimatedDetailPanelHeight: 200,
    lazyLoadingRequestChunkSize: 100,
    theme: 'light',
};

function applyDefaults(inProps) {
    const props = { ...inProps };
    Object.keys(DEFAULT_PROPS).forEach((key) => {
        if (props[key] === undefined) props[key] = DEFAULT_PROPS[key];
    });
    return props;
}

const defaultGetRowId = (row) => row.id;
const isSkeletonId = (id) => typeof id === 'string' && id.startsWith(SKELETON_ID_PREFIX);

function setEditField(state, id, field, value) {
    return { ...state, [id]: { ...(state[id] || EMPTY_OBJECT), [field]: value } };
}

function removeEditFields(state, id, field) {
    if (!state[id]) return state;
    const next = { ...state };
    if (field === undefined) {
        delete next[id];
        return next;
    }
    const row = { ...next[id] };
    delete row[field];
    if (Object.keys(row).length === 0) delete next[id];
    else next[id] = row;
    return next;
}

function arrayMove(list, from, to) {
    const next = list.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
}

const isInteractiveTarget = (target) =>
    target instanceof Element &&
    Boolean(target.closest('button, a, input, select, textarea, [role="button"], [data-og-interactive]'));

/**
 * The brain of the grid: owns every piece of state, derives the row/column
 * pipelines and exposes the imperative API (`apiRef`).
 */
export function useGridController(inProps) {
    const props = applyDefaults(inProps);
    const internalApiRef = useRef(null);
    const apiRef = props.apiRef || internalApiRef;
    const rootRef = useRef(null);
    const scrollerApiRef = useRef(null);
    const [instanceId] = useState(() => nextId('og'));
    const localeText = useMemo(() => ({ ...enUS, ...(props.localeText || EMPTY_OBJECT) }), [props.localeText]);
    const initialState = useRef(props.initialState || EMPTY_OBJECT).current;
    const getRowIdRef = useLatest(props.getRowId || defaultGetRowId);
    const getTreeDataPathRef = useLatest(props.getTreeDataPath);
    const propsRef = useLatest(props);

    // ---------------------------------------------------------------- models
    const [sortModel, setSortModel, sortModelRef] = useModel(
        props.sortModel,
        initialState.sorting?.sortModel ?? EMPTY_ARRAY,
        props.onSortModelChange,
    );
    const [rawFilterModel, setFilterModel, filterModelRef] = useModel(
        props.filterModel,
        { ...DEFAULT_FILTER_MODEL, ...(initialState.filter?.filterModel || EMPTY_OBJECT) },
        props.onFilterModelChange,
    );
    const filterModel = useMemo(() => ({ ...DEFAULT_FILTER_MODEL, ...rawFilterModel }), [rawFilterModel]);
    const [paginationModelRaw, setPaginationModel, paginationModelRef] = useModel(
        props.paginationModel,
        { ...DEFAULT_PAGINATION_MODEL, ...(initialState.pagination?.paginationModel || EMPTY_OBJECT) },
        props.onPaginationModelChange,
    );
    const [rowSelectionModel, setRowSelectionModel, rowSelectionModelRef] = useModel(
        props.rowSelectionModel,
        EMPTY_ARRAY,
        props.onRowSelectionModelChange,
    );
    const [columnVisibilityModel, setColumnVisibilityModel] = useModel(
        props.columnVisibilityModel,
        initialState.columns?.columnVisibilityModel ?? EMPTY_OBJECT,
        props.onColumnVisibilityModelChange,
    );
    const [rawPinnedColumns, setPinnedColumns] = useModel(
        props.pinnedColumns,
        initialState.pinnedColumns ?? DEFAULT_PINNED_COLUMNS,
        props.onPinnedColumnsChange,
    );
    const pinnedColumns = useMemo(
        () => ({ left: rawPinnedColumns.left || EMPTY_ARRAY, right: rawPinnedColumns.right || EMPTY_ARRAY }),
        [rawPinnedColumns],
    );
    const [density, setDensity] = useModel(props.density, initialState.density ?? 'standard', props.onDensityChange);
    const [detailPanelExpandedRowIds, setDetailPanelExpandedRowIds, detailIdsRef] = useModel(
        props.detailPanelExpandedRowIds,
        initialState.detailPanel?.expandedRowIds ?? EMPTY_ARRAY,
        props.onDetailPanelExpandedRowIdsChange,
    );
    const [rowModesModel, setRowModesModel] = useModel(props.rowModesModel, EMPTY_OBJECT, props.onRowModesModelChange);
    const [cellModesModel, setCellModesModel] = useModel(
        props.cellModesModel,
        EMPTY_OBJECT,
        props.onCellModesModelChange,
    );

    // -------------------------------------------------------- internal state
    const [columnOrder, setColumnOrder] = useState(() => initialState.columns?.orderedFields ?? null);
    const [columnWidths, setColumnWidths] = useState(() => {
        const dims = initialState.columns?.dimensions || EMPTY_OBJECT;
        const widths = {};
        Object.keys(dims).forEach((field) => {
            if (dims[field] && typeof dims[field].width === 'number') widths[field] = dims[field].width;
        });
        return widths;
    });
    const [expansion, setExpansion] = useState(EMPTY_OBJECT);
    const [rowOverrides, setRowOverrides] = useState(null);
    const [focus, setFocusState] = useState(null);
    const focusRef = useLatest(focus);
    const pendingDomFocusRef = useRef(false);
    const [editState, setEditStateRaw] = useState(EMPTY_OBJECT);
    const editStateRef = useRef(editState);
    const [panel, setPanel] = useState(null);
    const [columnMenu, setColumnMenu] = useState(null);
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const [measureVersion, setMeasureVersion] = useState(0);
    const measuredRef = useRef({ rows: new Map(), details: new Map() });
    const [dragState, setDragState] = useState(null);
    const selectionAnchorRef = useRef(null);
    const listenersRef = useRef(new Map());

    const updateEditState = useCallback((updater) => {
        editStateRef.current = updater(editStateRef.current);
        setEditStateRaw(editStateRef.current);
    }, []);

    const publish = useCallback(
        (name, params, event) => {
            const handlers = listenersRef.current.get(name);
            if (handlers) handlers.forEach((handler) => handler(params, event, { api: apiRef.current }));
        },
        [apiRef],
    );

    // ------------------------------------------------------------ data source
    const ds = useDataSource({
        dataSource: props.dataSource,
        lazyLoading: Boolean(props.lazyLoading),
        pagination: Boolean(props.pagination),
        paginationModel: paginationModelRaw,
        sortModel,
        filterModel,
        chunkSize: props.lazyLoadingRequestChunkSize,
        disableCache: props.dataSourceCache === null,
        onError: props.onDataSourceError,
    });
    const isServerData = ds.enabled;
    const lazy = ds.enabled ? ds.lazy : null;
    const isLazy = Boolean(lazy);
    const sortingMode = isServerData ? 'server' : props.sortingMode;
    const filterMode = isServerData ? 'server' : props.filterMode;
    const paginationMode = isServerData ? 'server' : props.paginationMode;

    // ----------------------------------------------------------------- rows
    const rowsInput = isServerData ? (isLazy ? null : ds.rows) : props.rows;
    const lazyRows = lazy ? lazy.rows : null;
    const lazyRowCount = lazy ? lazy.rowCount : 0;
    const lazyVersion = lazy ? lazy.version : -1;
    const baseStore = useMemo(() => {
        if (lazyRows) {
            const byId = new Map();
            const ids = new Array(lazyRowCount);
            for (let i = 0; i < lazyRowCount; i += 1) {
                const row = lazyRows[i];
                if (row) {
                    const id = getRowIdRef.current(row);
                    byId.set(id, row);
                    ids[i] = id;
                } else {
                    ids[i] = `${SKELETON_ID_PREFIX}${i}`;
                }
            }
            return { byId, ids, version: lazyVersion };
        }
        return buildRowStore(rowsInput || EMPTY_ARRAY, getRowIdRef.current);
    }, [rowsInput, lazyRows, lazyRowCount, lazyVersion, getRowIdRef]);
    const baseStoreRef = useLatest(baseStore);
    const store = rowOverrides && rowOverrides.base === baseStore ? rowOverrides : baseStore;
    const storeRef = useLatest(store);

    const pinnedRowsProp = props.pinnedRows || DEFAULT_PINNED_ROWS;
    const pinned = useMemo(() => {
        const toEntries = (rows) => (rows || EMPTY_ARRAY).map((row) => ({ id: getRowIdRef.current(row), row }));
        const top = toEntries(pinnedRowsProp.top);
        const bottom = toEntries(pinnedRowsProp.bottom);
        return { top, bottom, byId: new Map([...top, ...bottom].map((entry) => [entry.id, entry.row])) };
    }, [pinnedRowsProp, getRowIdRef]);

    // -------------------------------------------------------------- columns
    const treeData = Boolean(props.treeData && props.getTreeDataPath);
    const hasDetailPanel = Boolean(props.getDetailPanelContent);
    const rowReordering = Boolean(props.rowReordering) && !treeData;
    const userColumns = useMemo(() => props.columns.map(normalizeColumn), [props.columns]);
    const allColumns = useMemo(() => {
        const special = [];
        if (rowReordering) special.push(normalizeColumn(createReorderColumn(localeText)));
        if (props.checkboxSelection) special.push(normalizeColumn(createCheckboxColumn(localeText)));
        if (hasDetailPanel) special.push(normalizeColumn(createDetailPanelToggleColumn(localeText)));
        if (treeData) {
            special.push(normalizeColumn(createTreeDataGroupingColumn(localeText, props.groupingColDef)));
        }
        return [...special, ...userColumns];
    }, [
        userColumns,
        rowReordering,
        props.checkboxSelection,
        hasDetailPanel,
        treeData,
        props.groupingColDef,
        localeText,
    ]);
    const columnsByField = useMemo(() => new Map(allColumns.map((column) => [column.field, column])), [allColumns]);

    const orderedColumns = useMemo(() => {
        if (!columnOrder) return allColumns;
        const natural = allColumns.map((column) => column.field);
        const known = new Set(natural);
        const result = columnOrder.filter((field) => known.has(field));
        const placed = new Set(result);
        natural.forEach((field, index) => {
            if (placed.has(field)) return;
            const previous = natural[index - 1];
            const at = previous === undefined ? -1 : result.indexOf(previous);
            result.splice(at + 1, 0, field);
            placed.add(field);
        });
        return result.map((field) => columnsByField.get(field));
    }, [allColumns, columnOrder, columnsByField]);
    const orderedColumnsRef = useLatest(orderedColumns);

    const visibleColumns = useMemo(
        () => orderedColumns.filter((column) => columnVisibilityModel[column.field] !== false),
        [orderedColumns, columnVisibilityModel],
    );

    const layout = useMemo(
        () => computeColumnsLayout(visibleColumns, pinnedColumns, viewport.width, columnWidths),
        [visibleColumns, pinnedColumns, viewport.width, columnWidths],
    );
    const layoutRef = useLatest(layout);
    const groupRows = useMemo(
        () => computeColumnGroupRows(props.columnGroupingModel, layout),
        [props.columnGroupingModel, layout],
    );

    // ----------------------------------------------------------- dimensions
    const densityFactor = DENSITY_FACTORS[density] ?? 1;
    const rowHeight = Math.floor(props.rowHeight * densityFactor);
    const headerHeight = Math.floor(props.columnHeaderHeight * densityFactor);
    const groupHeaderHeight = Math.floor((props.columnGroupHeaderHeight ?? props.columnHeaderHeight) * densityFactor);
    const headerFilterHeight = Math.floor((props.headerFilterHeight ?? props.columnHeaderHeight) * densityFactor);
    const headersTotalHeight =
        groupRows.length * groupHeaderHeight + headerHeight + (props.headerFilters ? headerFilterHeight : 0);

    // ------------------------------------------------------- row accessors
    const tree = useMemo(
        () => (treeData && !isLazy ? buildTree(store.ids, store.byId, getTreeDataPathRef.current) : null),
        [treeData, isLazy, store, getTreeDataPathRef],
    );
    const autoRowsCache = useMemo(() => (tree ? new Map() : null), [tree]);

    const getRow = useCallback(
        (id) => {
            const row = store.byId.get(id);
            if (row !== undefined) return row;
            const pinnedRow = pinned.byId.get(id);
            if (pinnedRow !== undefined) return pinnedRow;
            if (tree) {
                const node = tree.nodes.get(id);
                if (node && node.isAutoGenerated) {
                    let auto = autoRowsCache.get(id);
                    if (!auto) {
                        auto = {};
                        autoRowsCache.set(id, auto);
                    }
                    return auto;
                }
            }
            return undefined;
        },
        [store, pinned, tree, autoRowsCache],
    );

    const getValue = useCallback(
        (id, column) => {
            if (column.field === GRID_TREE_DATA_GROUPING_FIELD) {
                const node = tree && tree.nodes.get(id);
                return node ? node.groupingKey : undefined;
            }
            return getCellValue(getRow(id), column, apiRef);
        },
        [getRow, tree, apiRef],
    );

    // Display text per (row object, column object). Rows and columns are
    // immutable from the grid's point of view, so a new object = a cache miss.
    const textCacheRef = useRef(new WeakMap());
    const getText = useCallback(
        (id, column) => {
            if (column.field === GRID_TREE_DATA_GROUPING_FIELD) {
                const value = getValue(id, column);
                const formatted = column.valueFormatter
                    ? column.valueFormatter(value, getRow(id), column, apiRef)
                    : value;
                return formatted === undefined || formatted === null ? '' : String(formatted);
            }
            const row = getRow(id);
            if (!row || typeof row !== 'object') return getCellText(row, column, apiRef);
            let perRow = textCacheRef.current.get(row);
            if (!perRow) {
                perRow = new WeakMap();
                textCacheRef.current.set(row, perRow);
            }
            let text = perRow.get(column);
            if (text === undefined) {
                text = getCellText(row, column, apiRef);
                perRow.set(column, text);
            }
            return text;
        },
        [getValue, getRow, apiRef],
    );

    // ------------------------------------------------ filtering & sorting
    const quickFilterColumns = useMemo(
        () =>
            visibleColumns.filter(
                (column) => !GRID_SPECIAL_FIELDS.has(column.field) || column.field === GRID_TREE_DATA_GROUPING_FIELD,
            ),
        [visibleColumns],
    );
    const filterPredicate = useMemo(() => {
        if (filterMode === 'server' || isLazy) return null;
        return createFilterPredicate({
            filterModel,
            columnsByField,
            quickFilterColumns,
            getValue,
            getText,
            getRow,
            apiRef,
        });
    }, [filterMode, isLazy, filterModel, columnsByField, quickFilterColumns, getValue, getText, getRow, apiRef]);

    const sorter = useMemo(() => {
        if (sortingMode === 'server' || isLazy) return null;
        return createSorter({ sortModel, columnsByField, getValue, getRow, apiRef });
    }, [sortingMode, isLazy, sortModel, columnsByField, getValue, getRow, apiRef]);

    const filteredFlatIds = useMemo(
        () => (tree ? null : filterPredicate ? store.ids.filter(filterPredicate) : store.ids),
        [tree, filterPredicate, store],
    );
    const sortedFlatIds = useMemo(
        () => (tree ? null : sorter ? sorter(filteredFlatIds) : filteredFlatIds),
        [tree, sorter, filteredFlatIds],
    );

    const treeFilter = useMemo(
        () => (tree && filterPredicate ? filterTree(tree, filterPredicate) : null),
        [tree, filterPredicate],
    );
    const isGroupExpandedByDefaultRef = useLatest(props.isGroupExpandedByDefault);
    const defaultExpansionDepth = props.defaultGroupingExpansionDepth;
    const isExpanded = useCallback(
        (node) => {
            const explicit = expansion[node.id];
            if (explicit !== undefined) return explicit;
            if (isGroupExpandedByDefaultRef.current) return Boolean(isGroupExpandedByDefaultRef.current(node));
            return defaultExpansionDepth === -1 || node.depth < defaultExpansionDepth;
        },
        [expansion, defaultExpansionDepth, isGroupExpandedByDefaultRef],
    );
    const sortedChildrenCache = useMemo(() => new Map(), [tree, treeFilter, sorter]); // eslint-disable-line react-hooks/exhaustive-deps
    const flattenedTreeIds = useMemo(
        () =>
            tree
                ? flattenTree(tree, {
                      kept: treeFilter ? treeFilter.kept : null,
                      sorter,
                      isExpanded,
                      cache: sortedChildrenCache,
                  })
                : null,
        [tree, treeFilter, sorter, isExpanded, sortedChildrenCache],
    );
    const visibleRowIds = tree ? flattenedTreeIds : sortedFlatIds;

    const getAllFilteredSortedIds = useCallback(() => {
        if (!tree) return visibleRowIds;
        return flattenTree(tree, {
            kept: treeFilter ? treeFilter.kept : null,
            sorter,
            isExpanded: () => true,
            cache: sortedChildrenCache,
        });
    }, [tree, treeFilter, sorter, sortedChildrenCache, visibleRowIds]);

    const topLevelCount = useMemo(() => {
        if (!tree) return { filtered: visibleRowIds.length, total: store.ids.length };
        const roots = tree.root.children;
        return {
            filtered: treeFilter ? roots.filter((id) => treeFilter.kept.has(id)).length : roots.length,
            total: roots.length,
        };
    }, [tree, treeFilter, visibleRowIds, store]);

    // ------------------------------------------------------------ pagination
    const paginationEnabled = Boolean(props.pagination) && !isLazy;
    const pinnedTopHeight = pinned.top.length * rowHeight;
    const pinnedBottomHeight = pinned.bottom.length * rowHeight;
    const bodyViewportHeight = Math.max(0, viewport.height - headersTotalHeight - pinnedTopHeight - pinnedBottomHeight);
    const autoPageSize = props.autoPageSize && paginationEnabled;
    const pageSize = autoPageSize
        ? Math.max(1, Math.floor(bodyViewportHeight / rowHeight) || 1)
        : Math.max(1, paginationModelRaw.pageSize);
    const paginationRowCount =
        paginationMode === 'server'
            ? isServerData
                ? ds.rowCount
                : (props.rowCount ?? visibleRowIds.length)
            : visibleRowIds.length;
    const pageCount = paginationRowCount === -1 ? Infinity : Math.max(1, Math.ceil(paginationRowCount / pageSize));
    const page = paginationEnabled ? clamp(paginationModelRaw.page, 0, pageCount - 1) : 0;
    const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);
    const pageIds = useMemo(() => {
        if (!paginationEnabled || paginationMode === 'server') return visibleRowIds;
        return visibleRowIds.slice(page * pageSize, (page + 1) * pageSize);
    }, [paginationEnabled, paginationMode, visibleRowIds, page, pageSize]);
    const pageIdsRef = useLatest(pageIds);

    useEffect(() => {
        if (!paginationEnabled) return;
        if (paginationModelRaw.page !== page || paginationModelRaw.pageSize !== pageSize) {
            setPaginationModel({ page, pageSize }, { reason: 'autoAdjust' });
        }
    }, [paginationEnabled, paginationModelRaw, page, pageSize, setPaginationModel]);

    // ------------------------------------------------- selection & details
    const selectedSet = useMemo(() => new Set(rowSelectionModel), [rowSelectionModel]);
    const detailSet = useMemo(() => new Set(detailPanelExpandedRowIds), [detailPanelExpandedRowIds]);

    useEffect(() => {
        if (props.keepNonExistentRowsSelected || isServerData || paginationMode === 'server') return;
        const current = rowSelectionModelRef.current;
        if (current.length === 0) return;
        const next = current.filter((id) => store.byId.has(id) || (tree && tree.nodes.has(id)));
        if (next.length !== current.length) setRowSelectionModel(next, { reason: 'rowsChange' });
    }, [
        store,
        tree,
        props.keepNonExistentRowsSelected,
        isServerData,
        paginationMode,
        rowSelectionModelRef,
        setRowSelectionModel,
    ]);

    // ------------------------------------------------------------ row sizes
    const getRowHeightProp = props.getRowHeight;
    const getDetailPanelHeightProp = props.getDetailPanelHeight;
    const estimatedDetailHeight = props.estimatedDetailPanelHeight;
    const getEstimatedRowHeight = props.getEstimatedRowHeight;

    const getRowBaseHeight = useCallback(
        (id) => {
            if (!getRowHeightProp || isSkeletonId(id)) return { height: rowHeight, auto: false };
            const result = getRowHeightProp({ id, model: getRow(id), densityFactor });
            if (result === 'auto') {
                const measured = measuredRef.current.rows.get(id);
                const estimate = getEstimatedRowHeight ? getEstimatedRowHeight({ id, model: getRow(id) }) : null;
                return { height: measured ?? estimate ?? rowHeight, auto: true };
            }
            return { height: typeof result === 'number' ? result : rowHeight, auto: false };
        },
        // measureVersion invalidates measured heights.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [getRowHeightProp, rowHeight, getRow, densityFactor, getEstimatedRowHeight, measureVersion],
    );

    const getDetailHeight = useCallback(
        (id) => {
            const result = getDetailPanelHeightProp({ id, row: getRow(id), api: apiRef.current });
            if (result === 'auto') {
                return { height: measuredRef.current.details.get(id) ?? estimatedDetailHeight, auto: true };
            }
            return { height: result, auto: false };
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [getDetailPanelHeightProp, getRow, estimatedDetailHeight, apiRef, measureVersion],
    );

    const rowSizes = useMemo(() => {
        const count = pageIds.length;
        const hasDetails = hasDetailPanel && detailSet.size > 0;
        if (!getRowHeightProp && !hasDetails) return createRowSizes(count, rowHeight);
        return createRowSizes(count, rowHeight, (index) => {
            const id = pageIds[index];
            let height = getRowBaseHeight(id).height;
            if (hasDetails && detailSet.has(id)) height += getDetailHeight(id).height;
            return height;
        });
    }, [pageIds, rowHeight, getRowHeightProp, hasDetailPanel, detailSet, getRowBaseHeight, getDetailHeight]);

    // Elements whose height is content-driven ('auto' rows / detail panels).
    const observerRef = useRef(null);
    const observedRef = useRef(new Map());
    const measureCallbacksRef = useRef(new Map());
    const measureFrameRef = useRef(0);
    const getMeasureRef = useCallback((kind, id) => {
        const key = `${kind}\u0000${id}`;
        let callback = measureCallbacksRef.current.get(key);
        if (callback) return callback;
        let element = null;
        callback = (node) => {
            if (typeof ResizeObserver === 'undefined') return;
            if (!observerRef.current) {
                observerRef.current = new ResizeObserver((entries) => {
                    let changed = false;
                    entries.forEach((entry) => {
                        const info = observedRef.current.get(entry.target);
                        if (!info) return;
                        const height = Math.ceil(entry.target.offsetHeight);
                        const map = measuredRef.current[info.kind];
                        if (height > 0 && map.get(info.id) !== height) {
                            map.set(info.id, height);
                            changed = true;
                        }
                    });
                    if (changed && !measureFrameRef.current) {
                        measureFrameRef.current = requestAnimationFrame(() => {
                            measureFrameRef.current = 0;
                            setMeasureVersion((v) => v + 1);
                        });
                    }
                });
            }
            if (element) {
                observerRef.current.unobserve(element);
                observedRef.current.delete(element);
            }
            element = node;
            if (node) {
                observedRef.current.set(node, { kind, id });
                observerRef.current.observe(node);
            }
        };
        measureCallbacksRef.current.set(key, callback);
        return callback;
    }, []);

    useEffect(
        () => () => {
            if (observerRef.current) observerRef.current.disconnect();
            cancelAnimationFrame(measureFrameRef.current);
        },
        [],
    );

    // ------------------------------------------------------------- params
    const isCellEditable = useCallback(
        (id, field) => {
            const column = columnsByField.get(field);
            if (!column || !column.editable || GRID_SPECIAL_FIELDS.has(field)) return false;
            if (isSkeletonId(id) || pinned.byId.has(id)) return false;
            if (tree) {
                const node = tree.nodes.get(id);
                if (!node || node.isAutoGenerated) return false;
            }
            if (propsRef.current.isCellEditable) {
                // eslint-disable-next-line no-use-before-define
                return Boolean(propsRef.current.isCellEditable(getCellParams(id, field)));
            }
            return true;
        },
        // getCellParams is hoisted through the function declaration below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [columnsByField, pinned, tree, propsRef],
    );

    const getRowNode = useCallback(
        (id) => {
            if (tree) {
                const node = tree.nodes.get(id);
                if (node) return node;
            }
            return {
                id,
                depth: 0,
                type: isSkeletonId(id) ? 'skeletonRow' : pinned.byId.has(id) ? 'pinnedRow' : 'leaf',
            };
        },
        [tree, pinned],
    );

    function getCellParams(id, field) {
        const column = columnsByField.get(field);
        const row = getRow(id);
        const value = column ? getValue(id, column) : undefined;
        const edit = editStateRef.current[id] && editStateRef.current[id][field];
        const currentFocus = focusRef.current;
        const hasFocus = Boolean(
            currentFocus && currentFocus.area === 'cell' && currentFocus.id === id && currentFocus.field === field,
        );
        return {
            id,
            field,
            row,
            rowNode: getRowNode(id),
            colDef: column,
            value,
            formattedValue: column ? getFormattedValue(value, row, column, apiRef) : undefined,
            cellMode: edit ? 'edit' : 'view',
            hasFocus,
            tabIndex: hasFocus ? 0 : -1,
            isEditable: column ? isCellEditable(id, field) : false,
            api: apiRef.current,
        };
    }

    const getRowParams = (id) => ({ id, row: getRow(id), columns: allColumns, api: apiRef.current });
    const getColumnHeaderParams = (field) => ({ field, colDef: columnsByField.get(field), api: apiRef.current });

    // ---------------------------------------------------------- row updates
    const updateRows = useCallback(
        (updates) => {
            setRowOverrides((previous) => {
                const base = baseStoreRef.current;
                const current = previous && previous.base === base ? previous : base;
                const byId = new Map(current.byId);
                let ids = current.ids;
                let copied = false;
                const removed = new Set();
                updates.forEach((update) => {
                    const id = getRowIdRef.current(update);
                    if (update._action === 'delete') {
                        if (byId.delete(id)) removed.add(id);
                        return;
                    }
                    const { _action, ...clean } = update;
                    const existing = byId.get(id);
                    if (existing) {
                        byId.set(id, { ...existing, ...clean });
                    } else {
                        byId.set(id, clean);
                        if (!copied) {
                            ids = ids.slice();
                            copied = true;
                        }
                        ids.push(id);
                    }
                });
                if (removed.size > 0) ids = ids.filter((id) => !removed.has(id));
                return { base, byId, ids };
            });
        },
        [baseStoreRef, getRowIdRef],
    );

    const setRows = useCallback(
        (rows) => {
            const next = buildRowStore(rows, getRowIdRef.current);
            setRowOverrides({ base: baseStoreRef.current, ...next });
        },
        [baseStoreRef, getRowIdRef],
    );

    // ---------------------------------------------------------------- focus
    const setFocus = useCallback((next, { moveDomFocus = true } = {}) => {
        setFocusState(next);
        if (moveDomFocus) pendingDomFocusRef.current = true;
    }, []);

    const navigationRowIds = useMemo(
        () => [...pinned.top.map((entry) => entry.id), ...pageIds, ...pinned.bottom.map((entry) => entry.id)],
        [pinned, pageIds],
    );
    const navigationRowIdsRef = useLatest(navigationRowIds);

    const scrollToCell = useCallback(
        (id, field) => {
            const scroller = scrollerApiRef.current;
            if (!scroller) return;
            const rowIndex = id === undefined ? undefined : pageIdsRef.current.indexOf(id);
            const colIndex =
                field === undefined ? undefined : layoutRef.current.all.findIndex((entry) => entry.field === field);
            scroller.scrollToIndexes({
                rowIndex: rowIndex === -1 ? undefined : rowIndex,
                colIndex: colIndex === -1 ? undefined : colIndex,
            });
        },
        [pageIdsRef, layoutRef],
    );

    const focusCell = useCallback(
        (id, field) => {
            setFocus({ area: 'cell', id, field });
            scrollToCell(id, field);
        },
        [setFocus, scrollToCell],
    );

    useEffect(() => {
        if (!pendingDomFocusRef.current || !rootRef.current) return;
        const current = focusRef.current;
        if (!current) return;
        let element = null;
        if (current.area === 'cell') {
            element = rootRef.current.querySelector(
                `.og-row[data-id="${cssEscape(current.id)}"] > .og-cell[data-field="${cssEscape(current.field)}"]`,
            );
            const editing = editStateRef.current[current.id] && editStateRef.current[current.id][current.field];
            if (element && editing) {
                const input = element.querySelector('input, select, textarea');
                if (input) element = input;
            }
        } else if (current.area === 'header') {
            element = rootRef.current.querySelector(`.og-column-header[data-field="${cssEscape(current.field)}"]`);
        } else if (current.area === 'headerFilter') {
            element = rootRef.current.querySelector(
                `.og-header-filter[data-field="${cssEscape(current.field)}"] input, .og-header-filter[data-field="${cssEscape(
                    current.field,
                )}"] select`,
            );
        }
        if (element) {
            pendingDomFocusRef.current = false;
            if (document.activeElement !== element) element.focus({ preventScroll: true });
        }
    });

    // -------------------------------------------------------------- sorting
    const sortColumn = useCallback(
        (field, direction, allowMultiple = false) => {
            const column = columnsByField.get(field);
            if (!column || column.sortable === false || propsRef.current.disableColumnSorting) return;
            const model = sortModelRef.current;
            const existing = model.find((item) => item.field === field);
            const order = column.sortingOrder || propsRef.current.sortingOrder;
            const nextSort =
                direction !== undefined
                    ? direction
                    : order[(order.indexOf(existing ? existing.sort : null) + 1) % order.length];
            let next;
            if (allowMultiple && !propsRef.current.disableMultipleColumnsSorting) {
                if (existing) {
                    next = nextSort
                        ? model.map((item) => (item.field === field ? { field, sort: nextSort } : item))
                        : model.filter((item) => item.field !== field);
                } else {
                    next = nextSort ? [...model, { field, sort: nextSort }] : model;
                }
            } else {
                next = nextSort ? [{ field, sort: nextSort }] : [];
            }
            setSortModel(next, { reason: 'sortColumn' });
            publish('sortModelChange', next);
        },
        [columnsByField, propsRef, sortModelRef, setSortModel, publish],
    );

    // ------------------------------------------------------------ filtering
    const getDefaultOperator = useCallback(
        (field) => {
            const column = columnsByField.get(field);
            return column && column.filterOperators && column.filterOperators[0]
                ? column.filterOperators[0].value
                : 'contains';
        },
        [columnsByField],
    );

    const updateFilterModel = useCallback(
        (updater, reason) => {
            setFilterModel(
                (previous) => {
                    const next = updater({ ...DEFAULT_FILTER_MODEL, ...previous });
                    return next;
                },
                { reason },
            );
        },
        [setFilterModel],
    );

    const upsertFilterItem = useCallback(
        (item) => {
            updateFilterModel((model) => {
                const withId = item.id === undefined ? { ...item, id: nextId('filter') } : item;
                const index = model.items.findIndex((existing) => existing.id === withId.id);
                const items =
                    index === -1 ? [...model.items, withId] : model.items.map((x, i) => (i === index ? withId : x));
                return { ...model, items };
            }, 'upsertFilterItem');
        },
        [updateFilterModel],
    );

    const deleteFilterItem = useCallback(
        (item) => {
            updateFilterModel(
                (model) => ({ ...model, items: model.items.filter((existing) => existing.id !== item.id) }),
                'deleteFilterItem',
            );
        },
        [updateFilterModel],
    );

    const setQuickFilterValues = useCallback(
        (values) => updateFilterModel((model) => ({ ...model, quickFilterValues: values }), 'quickFilter'),
        [updateFilterModel],
    );

    const setFilterLogicOperator = useCallback(
        (logicOperator) => updateFilterModel((model) => ({ ...model, logicOperator }), 'changeLogicOperator'),
        [updateFilterModel],
    );

    // --------------------------------------------------------------- panels
    const showPreferences = useCallback(
        (type, { anchorEl, field } = {}) => {
            setColumnMenu(null);
            if (type === 'filters') {
                const model = { ...DEFAULT_FILTER_MODEL, ...filterModelRef.current };
                const targetField =
                    field ||
                    (model.items.length === 0
                        ? (
                              visibleColumns.find(
                                  (column) => column.filterable !== false && !GRID_SPECIAL_FIELDS.has(column.field),
                              ) || {}
                          ).field
                        : undefined);
                if (targetField && !model.items.some((item) => item.field === targetField)) {
                    const newItem = {
                        id: nextId('filter'),
                        field: targetField,
                        operator: getDefaultOperator(targetField),
                    };
                    const single = propsRef.current.disableMultipleColumnsFiltering;
                    // Replace empty items when adding from a column, like MUI X.
                    const items = single
                        ? [newItem]
                        : [...model.items.filter((item) => item.value !== undefined && item.value !== ''), newItem];
                    setFilterModel({ ...model, items }, { reason: 'showFilterPanel' });
                }
            }
            setPanel({ type, anchorEl: anchorEl || null, field });
            if (propsRef.current.onPreferencePanelOpen)
                propsRef.current.onPreferencePanelOpen({ openedPanelValue: type });
        },
        [filterModelRef, visibleColumns, getDefaultOperator, propsRef, setFilterModel],
    );

    const hidePreferences = useCallback(() => {
        setPanel((current) => {
            if (current && propsRef.current.onPreferencePanelClose) {
                propsRef.current.onPreferencePanelClose({ openedPanelValue: current.type });
            }
            return null;
        });
        // Drop filter items left without a value when the panel closes.
        setFilterModel(
            (model) => {
                const items = (model.items || []).filter((item) => {
                    const column = columnsByField.get(item.field);
                    const operator = column && (column.filterOperators || []).find((op) => op.value === item.operator);
                    if (operator && operator.requiresFilterValue === false) return true;
                    return (
                        item.value !== undefined &&
                        item.value !== '' &&
                        !(Array.isArray(item.value) && !item.value.length)
                    );
                });
                return items.length === (model.items || []).length ? model : { ...model, items };
            },
            { reason: 'hidePanel' },
        );
    }, [propsRef, setFilterModel, columnsByField]);

    const showColumnMenu = useCallback(
        (field, anchorEl) => {
            setPanel(null);
            setColumnMenu({ field, anchorEl });
            if (propsRef.current.onMenuOpen) propsRef.current.onMenuOpen({ target: anchorEl, field });
        },
        [propsRef],
    );

    const hideColumnMenu = useCallback(() => {
        setColumnMenu((current) => {
            if (current && propsRef.current.onMenuClose) propsRef.current.onMenuClose({ field: current.field });
            return null;
        });
    }, [propsRef]);

    // -------------------------------------------------------------- columns
    const setColumnVisibility = useCallback(
        (field, visible) => {
            setColumnVisibilityModel((model) => ({ ...model, [field]: visible }), { reason: 'toggle' });
        },
        [setColumnVisibilityModel],
    );

    const setColumnWidth = useCallback(
        (field, width) => {
            const column = columnsByField.get(field);
            if (!column) return;
            const next = clamp(Math.round(width), column.minWidth ?? 50, column.maxWidth ?? Infinity);
            setColumnWidths((widths) => (widths[field] === next ? widths : { ...widths, [field]: next }));
        },
        [columnsByField],
    );

    const setColumnIndex = useCallback(
        (field, targetIndex) => {
            const fields = orderedColumnsRef.current.map((column) => column.field);
            const from = fields.indexOf(field);
            if (from === -1 || from === targetIndex) return;
            const to = clamp(targetIndex, 0, fields.length - 1);
            setColumnOrder(arrayMove(fields, from, to));
            if (propsRef.current.onColumnOrderChange) {
                propsRef.current.onColumnOrderChange({
                    column: columnsByField.get(field),
                    targetIndex: to,
                    oldIndex: from,
                });
            }
            publish('columnOrderChange', { field, targetIndex: to, oldIndex: from });
        },
        [orderedColumnsRef, columnsByField, propsRef, publish],
    );

    const pinColumn = useCallback(
        (field, side) => {
            setPinnedColumns(
                (model) => {
                    const left = (model.left || []).filter((f) => f !== field);
                    const right = (model.right || []).filter((f) => f !== field);
                    if (side === 'left') left.push(field);
                    else right.unshift(field);
                    return { left, right };
                },
                { reason: 'pin' },
            );
        },
        [setPinnedColumns],
    );

    const unpinColumn = useCallback(
        (field) => {
            setPinnedColumns(
                (model) => ({
                    left: (model.left || []).filter((f) => f !== field),
                    right: (model.right || []).filter((f) => f !== field),
                }),
                { reason: 'unpin' },
            );
        },
        [setPinnedColumns],
    );

    const isColumnPinned = useCallback(
        (field) => {
            if (pinnedColumns.left.includes(field)) return 'left';
            if (pinnedColumns.right.includes(field)) return 'right';
            return false;
        },
        [pinnedColumns],
    );

    const autosizeColumns = useCallback(
        (options = {}) => {
            const root = rootRef.current;
            if (!root) return;
            const { includeHeaders = true, includeOutliers = true, outliersFactor = 1.5 } = options;
            const fields =
                options.columns ||
                layoutRef.current.all.map((entry) => entry.field).filter((f) => !GRID_SPECIAL_FIELDS.has(f));
            const measure = (element) => {
                const range = document.createRange();
                range.selectNodeContents(element);
                const width = range.getBoundingClientRect().width;
                const style = window.getComputedStyle(element);
                return width + parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0);
            };
            const updates = {};
            fields.forEach((field) => {
                const column = columnsByField.get(field);
                if (!column || column.resizable === false) return;
                const selector = `.og-cell[data-field="${cssEscape(field)}"]`;
                const widths = Array.from(root.querySelectorAll(selector)).map(measure);
                if (!includeOutliers && widths.length > 2) {
                    const sorted = widths.slice().sort((a, b) => a - b);
                    const q1 = sorted[Math.floor(sorted.length * 0.25)];
                    const q3 = sorted[Math.floor(sorted.length * 0.75)];
                    const limit = q3 + (q3 - q1) * outliersFactor;
                    for (let i = widths.length - 1; i >= 0; i -= 1) if (widths[i] > limit) widths.splice(i, 1);
                }
                if (includeHeaders) {
                    const title = root.querySelector(
                        `.og-column-header[data-field="${cssEscape(field)}"] .og-column-header-title`,
                    );
                    // Leave room for the sort and menu icons.
                    if (title) widths.push(measure(title) + 64);
                }
                if (widths.length === 0) return;
                updates[field] = clamp(
                    Math.ceil(Math.max(...widths)) + 2,
                    column.minWidth ?? 50,
                    column.maxWidth ?? Infinity,
                );
            });
            if (options.expand) {
                const total = layoutRef.current.all.reduce(
                    (acc, entry) => acc + (updates[entry.field] ?? entry.width),
                    0,
                );
                const extra = viewport.width - total;
                const keys = Object.keys(updates);
                if (extra > 0 && keys.length)
                    keys.forEach((field) => {
                        updates[field] += Math.floor(extra / keys.length);
                    });
            }
            setColumnWidths((widths) => ({ ...widths, ...updates }));
            return Promise.resolve();
        },
        [columnsByField, layoutRef, viewport.width],
    );

    // ------------------------------------------------------------ selection
    const isRowSelectable = useCallback(
        (id) => {
            if (isSkeletonId(id)) return false;
            if (!propsRef.current.isRowSelectable) return true;
            return Boolean(propsRef.current.isRowSelectable(getRowParams(id)));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [propsRef, getRow],
    );

    const withPropagation = useCallback(
        (selection, ids, isSelected) => {
            const propagation = propsRef.current.rowSelectionPropagation;
            if (!tree || !propagation) return selection;
            ids.forEach((id) => {
                if (propagation.descendants) {
                    getDescendantIds(tree, id).forEach((childId) => {
                        if (!isRowSelectable(childId)) return;
                        if (isSelected) selection.add(childId);
                        else selection.delete(childId);
                    });
                }
                if (propagation.parents) {
                    let node = tree.nodes.get(id);
                    while (node && node.parent && tree.nodes.get(node.parent) && node.parent !== tree.root.id) {
                        const parent = tree.nodes.get(node.parent);
                        const allSelected = parent.children.every((childId) => selection.has(childId));
                        if (allSelected) selection.add(parent.id);
                        else selection.delete(parent.id);
                        node = parent;
                    }
                }
            });
            return selection;
        },
        [tree, propsRef, isRowSelectable],
    );

    const selectRows = useCallback(
        (ids, isSelected = true, resetSelection = false) => {
            const selectable = ids.filter(isRowSelectable);
            const multiple = !propsRef.current.disableMultipleRowSelection;
            let selection;
            if (!multiple) {
                const last = selectable[selectable.length - 1];
                selection = new Set(
                    isSelected && last !== undefined
                        ? [last]
                        : resetSelection
                          ? []
                          : rowSelectionModelRef.current.filter((id) => id !== last),
                );
            } else {
                selection = resetSelection ? new Set() : new Set(rowSelectionModelRef.current);
                selectable.forEach((id) => {
                    if (isSelected) selection.add(id);
                    else selection.delete(id);
                });
                selection = withPropagation(selection, selectable, isSelected);
            }
            const next = Array.from(selection);
            setRowSelectionModel(next, { reason: 'selectRows' });
            publish('rowSelectionChange', next);
        },
        [isRowSelectable, propsRef, rowSelectionModelRef, setRowSelectionModel, withPropagation, publish],
    );

    const selectRow = useCallback(
        (id, isSelected = true, resetSelection = false) => {
            selectRows([id], isSelected, resetSelection);
            selectionAnchorRef.current = id;
        },
        [selectRows],
    );

    const selectRowRange = useCallback(
        (startId, endId, isSelected = true, resetSelection = false) => {
            const ids = navigationRowIdsRef.current;
            const a = ids.indexOf(startId);
            const b = ids.indexOf(endId);
            if (a === -1 || b === -1) {
                selectRow(endId, isSelected, resetSelection);
                return;
            }
            selectRows(ids.slice(Math.min(a, b), Math.max(a, b) + 1), isSelected, resetSelection);
        },
        [navigationRowIdsRef, selectRow, selectRows],
    );

    const getSelectAllIds = useCallback(() => {
        if (propsRef.current.checkboxSelectionVisibleOnly && paginationEnabled) return pageIdsRef.current;
        return getAllFilteredSortedIds();
    }, [propsRef, paginationEnabled, pageIdsRef, getAllFilteredSortedIds]);

    const getSelectAllState = () => {
        const ids = getSelectAllIds().filter(isRowSelectable);
        if (ids.length === 0 || selectedSet.size === 0) return 'none';
        let count = 0;
        ids.forEach((id) => {
            if (selectedSet.has(id)) count += 1;
        });
        if (count === 0) return 'none';
        return count === ids.length ? 'all' : 'some';
    };

    const toggleSelectAll = () => {
        const state = getSelectAllState();
        const ids = getSelectAllIds();
        selectRows(ids, state !== 'all', false);
    };

    const handleRowSelectionClick = (id, event) => {
        if (propsRef.current.disableRowSelectionOnClick || !isRowSelectable(id)) return;
        const multiple = !propsRef.current.disableMultipleRowSelection;
        const hasCtrl = event.ctrlKey || event.metaKey;
        if (
            event.shiftKey &&
            multiple &&
            selectionAnchorRef.current !== null &&
            selectionAnchorRef.current !== undefined
        ) {
            selectRowRange(selectionAnchorRef.current, id, true, !hasCtrl && !propsRef.current.checkboxSelection);
            return;
        }
        const isSelected = selectedSet.has(id);
        if (hasCtrl || propsRef.current.checkboxSelection) {
            selectRow(id, !isSelected, !multiple);
        } else {
            selectRow(id, true, true);
        }
    };

    const handleCheckboxChange = (id, event) => {
        const multiple = !propsRef.current.disableMultipleRowSelection;
        if (event && event.shiftKey && multiple && selectionAnchorRef.current != null) {
            selectRowRange(selectionAnchorRef.current, id, !selectedSet.has(id), false);
            return;
        }
        selectRow(id, !selectedSet.has(id), !multiple);
    };

    // -------------------------------------------------- tree & detail panels
    const setRowChildrenExpansion = useCallback((id, isExpandedValue) => {
        setExpansion((current) => ({ ...current, [id]: isExpandedValue }));
    }, []);

    const toggleRowExpansion = useCallback(
        (id) => {
            if (!tree) return;
            const node = tree.nodes.get(id);
            if (!node || node.children.length === 0) return;
            setRowChildrenExpansion(id, !isExpanded(node));
        },
        [tree, isExpanded, setRowChildrenExpansion],
    );

    const toggleDetailPanel = useCallback(
        (id) => {
            setDetailPanelExpandedRowIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
        },
        [setDetailPanelExpandedRowIds],
    );

    // --------------------------------------------------------- row ordering
    const setRowIndex = useCallback(
        (id, targetIndex) => {
            setRowOverrides((previous) => {
                const base = baseStoreRef.current;
                const current = previous && previous.base === base ? previous : base;
                const from = current.ids.indexOf(id);
                if (from === -1) return previous;
                const to = clamp(targetIndex, 0, current.ids.length - 1);
                if (from === to) return previous;
                return { base, byId: current.byId, ids: arrayMove(current.ids, from, to) };
            });
        },
        [baseStoreRef],
    );

    /** Live reorder used while dragging: moves `id` to the position of `targetId`. */
    const moveRowTo = useCallback(
        (id, targetId) => {
            const ids = storeRef.current.ids;
            const to = ids.indexOf(targetId);
            if (to !== -1) setRowIndex(id, to);
        },
        [storeRef, setRowIndex],
    );

    const finishRowReorder = useCallback(
        (id, oldIndex) => {
            const targetIndex = storeRef.current.ids.indexOf(id);
            if (targetIndex !== oldIndex && propsRef.current.onRowOrderChange) {
                propsRef.current.onRowOrderChange({ row: getRow(id), oldIndex, targetIndex });
            }
            publish('rowOrderChange', { id, oldIndex, targetIndex });
        },
        [storeRef, propsRef, getRow, publish],
    );

    // -------------------------------------------------------------- editing
    const commitRowUpdate = useCallback(
        (id, newRow, oldRow, onSuccess, onFailure) => {
            const processRowUpdate = propsRef.current.processRowUpdate;
            if (!processRowUpdate) {
                updateRows([newRow]);
                onSuccess();
                return;
            }
            Promise.resolve()
                .then(() => processRowUpdate(newRow, oldRow, { rowId: id }))
                .then(
                    (finalRow) => {
                        updateRows([finalRow]);
                        onSuccess();
                    },
                    (error) => {
                        if (propsRef.current.onProcessRowUpdateError) propsRef.current.onProcessRowUpdateError(error);
                        else console.error('OpenGrid: processRowUpdate failed', error); // eslint-disable-line no-console
                        onFailure();
                    },
                );
        },
        [propsRef, updateRows],
    );

    const buildUpdatedRow = useCallback(
        (id, edits) => {
            const oldRow = getRow(id);
            let newRow = { ...oldRow };
            let changed = false;
            Object.keys(edits).forEach((field) => {
                const column = columnsByField.get(field);
                if (!column) return;
                const { value } = edits[field];
                if (!Object.is(getValue(id, column), value)) changed = true;
                newRow = column.valueSetter
                    ? column.valueSetter(value, newRow, column, apiRef)
                    : { ...newRow, [field]: value };
            });
            return { oldRow, newRow, changed };
        },
        [getRow, columnsByField, getValue, apiRef],
    );

    const prevCellModesRef = useRef(EMPTY_OBJECT);
    useEffect(() => {
        const previous = prevCellModesRef.current;
        prevCellModesRef.current = cellModesModel;
        const ids = new Set([...Object.keys(previous), ...Object.keys(cellModesModel)]);
        ids.forEach((idKey) => {
            const prevFields = previous[idKey] || EMPTY_OBJECT;
            const nextFields = cellModesModel[idKey] || EMPTY_OBJECT;
            const fields = new Set([...Object.keys(prevFields), ...Object.keys(nextFields)]);
            fields.forEach((field) => {
                const prevMode = prevFields[field] ? prevFields[field].mode : 'view';
                const nextEntry = nextFields[field];
                const nextMode = nextEntry ? nextEntry.mode : 'view';
                if (prevMode === nextMode) return;
                // Model keys are strings; recover the real id (numbers stay numbers).
                const id = navigationRowIdsRef.current.find((rowId) => String(rowId) === idKey) ?? idKey;
                if (nextMode === 'edit') {
                    if (editStateRef.current[id] && editStateRef.current[id][field]) return;
                    const column = columnsByField.get(field);
                    if (!column) return;
                    let value = getValue(id, column);
                    if (nextEntry.deleteValue) value = '';
                    if (nextEntry.initialValue !== undefined) value = nextEntry.initialValue;
                    updateEditState((state) => setEditField(state, id, field, { value, error: false }));
                    setFocus({ area: 'cell', id, field });
                    return;
                }
                const edit = editStateRef.current[id] && editStateRef.current[id][field];
                if (!edit) return;
                const focusAfter = nextEntry && nextEntry.cellToFocusAfter;
                if (nextEntry && nextEntry.ignoreModifications) {
                    updateEditState((state) => removeEditFields(state, id, field));
                    setFocus({ area: 'cell', id, field });
                    return;
                }
                const revert = () => {
                    setCellModesModel((model) => ({
                        ...model,
                        [id]: { ...(model[id] || EMPTY_OBJECT), [field]: { mode: 'edit' } },
                    }));
                    setFocus({ area: 'cell', id, field });
                };
                if (edit.error || edit.isProcessingProps) {
                    revert();
                    return;
                }
                const { oldRow, newRow, changed } = buildUpdatedRow(id, { [field]: edit });
                const finish = () => {
                    updateEditState((state) => removeEditFields(state, id, field));
                    if (focusAfter) moveFocusAfterEditRef.current(id, field, focusAfter);
                    else setFocus({ area: 'cell', id, field });
                };
                if (!changed) {
                    finish();
                    return;
                }
                commitRowUpdate(id, newRow, oldRow, finish, revert);
            });
        });
    }, [cellModesModel]); // eslint-disable-line react-hooks/exhaustive-deps

    const prevRowModesRef = useRef(EMPTY_OBJECT);
    useEffect(() => {
        const previous = prevRowModesRef.current;
        prevRowModesRef.current = rowModesModel;
        const ids = new Set([...Object.keys(previous), ...Object.keys(rowModesModel)]);
        ids.forEach((idKey) => {
            const prevMode = previous[idKey] ? previous[idKey].mode : 'view';
            const nextEntry = rowModesModel[idKey];
            const nextMode = nextEntry ? nextEntry.mode : 'view';
            if (prevMode === nextMode) return;
            const id = navigationRowIdsRef.current.find((rowId) => String(rowId) === idKey) ?? idKey;
            if (nextMode === 'edit') {
                if (editStateRef.current[id]) return;
                const edits = {};
                visibleColumns.forEach((column) => {
                    if (!isCellEditable(id, column.field)) return;
                    let value = getValue(id, column);
                    if (nextEntry.fieldToFocus === column.field) {
                        if (nextEntry.deleteValue) value = '';
                        if (nextEntry.initialValue !== undefined) value = nextEntry.initialValue;
                    }
                    edits[column.field] = { value, error: false };
                });
                const firstField = nextEntry.fieldToFocus || Object.keys(edits)[0];
                updateEditState((state) => ({ ...state, [id]: edits }));
                if (firstField) setFocus({ area: 'cell', id, field: firstField });
                return;
            }
            const edits = editStateRef.current[id];
            if (!edits) return;
            const focusField = nextEntry && nextEntry.field;
            const focusAfter = nextEntry && nextEntry.cellToFocusAfter;
            const refocus = () => {
                const current = focusRef.current;
                if (focusField) setFocus({ area: 'cell', id, field: focusField });
                else if (current && current.area === 'cell' && current.id === id) setFocus(current);
            };
            if (nextEntry && nextEntry.ignoreModifications) {
                updateEditState((state) => removeEditFields(state, id));
                refocus();
                return;
            }
            const revert = () => {
                setRowModesModel((model) => ({ ...model, [id]: { mode: 'edit' } }));
                refocus();
            };
            const hasError = Object.keys(edits).some((field) => edits[field].error || edits[field].isProcessingProps);
            if (hasError) {
                revert();
                return;
            }
            const { oldRow, newRow, changed } = buildUpdatedRow(id, edits);
            const finish = () => {
                updateEditState((state) => removeEditFields(state, id));
                if (focusField && focusAfter) moveFocusAfterEditRef.current(id, focusField, focusAfter);
                else refocus();
            };
            if (!changed) {
                finish();
                return;
            }
            commitRowUpdate(id, newRow, oldRow, finish, revert);
        });
    }, [rowModesModel]); // eslint-disable-line react-hooks/exhaustive-deps

    const startCellEditMode = useCallback(
        ({ id, field, deleteValue, initialValue }) =>
            setCellModesModel((model) => ({
                ...model,
                [id]: { ...(model[id] || EMPTY_OBJECT), [field]: { mode: 'edit', deleteValue, initialValue } },
            })),
        [setCellModesModel],
    );

    const stopCellEditMode = useCallback(
        ({ id, field, ignoreModifications, cellToFocusAfter }) =>
            setCellModesModel((model) => ({
                ...model,
                [id]: {
                    ...(model[id] || EMPTY_OBJECT),
                    [field]: { mode: 'view', ignoreModifications, cellToFocusAfter },
                },
            })),
        [setCellModesModel],
    );

    const startRowEditMode = useCallback(
        ({ id, fieldToFocus, deleteValue, initialValue }) =>
            setRowModesModel((model) => ({
                ...model,
                [id]: { mode: 'edit', fieldToFocus, deleteValue, initialValue },
            })),
        [setRowModesModel],
    );

    const stopRowEditMode = useCallback(
        ({ id, ignoreModifications, field, cellToFocusAfter }) =>
            setRowModesModel((model) => ({
                ...model,
                [id]: { mode: 'view', ignoreModifications, field, cellToFocusAfter },
            })),
        [setRowModesModel],
    );

    const setEditCellValue = useCallback(
        async ({ id, field, value }) => {
            const column = columnsByField.get(field);
            if (!column || !editStateRef.current[id] || !editStateRef.current[id][field]) return false;
            const row = getRow(id);
            const parsed = column.valueParser ? column.valueParser(value, row, column, apiRef) : value;
            const preProcess = column.preProcessEditCellProps;
            updateEditState((state) =>
                setEditField(state, id, field, {
                    ...state[id][field],
                    value: parsed,
                    isProcessingProps: Boolean(preProcess),
                }),
            );
            if (!preProcess) return true;
            const rowEdits = editStateRef.current[id];
            const otherFieldsProps = {};
            Object.keys(rowEdits).forEach((key) => {
                if (key !== field) otherFieldsProps[key] = rowEdits[key];
            });
            const result = await preProcess({
                id,
                row,
                props: { ...rowEdits[field], value: parsed },
                hasChanged: true,
                otherFieldsProps: propsRef.current.editMode === 'row' ? otherFieldsProps : undefined,
            });
            const current = editStateRef.current[id] && editStateRef.current[id][field];
            if (!current || !Object.is(current.value, parsed)) return false; // superseded
            updateEditState((state) =>
                setEditField(state, id, field, { ...current, ...result, value: parsed, isProcessingProps: false }),
            );
            return !result || !result.error;
        },
        [columnsByField, getRow, apiRef, updateEditState, propsRef],
    );

    const getCellMode = (id, field) => (editState[id] && editState[id][field] ? 'edit' : 'view');
    const getRowMode = (id) => (props.editMode === 'row' && editState[id] ? 'edit' : 'view');

    const startEditingFromEvent = (id, field, reason, extra = {}, event) => {
        if (!isCellEditable(id, field)) return false;
        const params = getCellParams(id, field);
        if (propsRef.current.editMode === 'row') {
            if (editStateRef.current[id]) return false;
            if (propsRef.current.onRowEditStart)
                propsRef.current.onRowEditStart({ ...getRowParams(id), field, reason }, event);
            publish('rowEditStart', { id, field, reason }, event);
            startRowEditMode({ id, fieldToFocus: field, ...extra });
        } else {
            if (editStateRef.current[id] && editStateRef.current[id][field]) return false;
            if (propsRef.current.onCellEditStart) propsRef.current.onCellEditStart({ ...params, reason }, event);
            publish('cellEditStart', { id, field, reason }, event);
            startCellEditMode({ id, field, ...extra });
        }
        return true;
    };

    const stopEditingFromEvent = (id, field, reason, { ignoreModifications = false, cellToFocusAfter } = {}, event) => {
        if (propsRef.current.editMode === 'row') {
            if (!editStateRef.current[id]) return;
            if (propsRef.current.onRowEditStop)
                propsRef.current.onRowEditStop({ ...getRowParams(id), field, reason }, event);
            publish('rowEditStop', { id, field, reason }, event);
            stopRowEditMode({ id, ignoreModifications, field, cellToFocusAfter });
        } else {
            if (!editStateRef.current[id] || !editStateRef.current[id][field]) return;
            if (propsRef.current.onCellEditStop)
                propsRef.current.onCellEditStop({ ...getCellParams(id, field), reason }, event);
            publish('cellEditStop', { id, field, reason }, event);
            stopCellEditMode({ id, field, ignoreModifications, cellToFocusAfter });
        }
    };

    const stopAllEditing = (reason, event) => {
        const state = editStateRef.current;
        Object.keys(state).forEach((idKey) => {
            const id = navigationRowIdsRef.current.find((rowId) => String(rowId) === idKey) ?? idKey;
            Object.keys(state[idKey] || EMPTY_OBJECT).forEach((field) =>
                stopEditingFromEvent(id, field, reason, {}, event),
            );
        });
    };

    // Clicking outside the grid commits whatever is being edited.
    const hasEdits = Object.keys(editState).length > 0;
    const stopAllEditingRef = useLatest(stopAllEditing);
    useEffect(() => {
        if (!hasEdits) return undefined;
        const onPointerDown = (event) => {
            const root = rootRef.current;
            if (!root || root.contains(event.target)) return;
            if (event.target instanceof Element && event.target.closest('.og-popper')) return;
            stopAllEditingRef.current(propsRef.current.editMode === 'row' ? 'rowFocusOut' : 'cellFocusOut', event);
        };
        document.addEventListener('mousedown', onPointerDown, true);
        return () => document.removeEventListener('mousedown', onPointerDown, true);
    }, [hasEdits, stopAllEditingRef, propsRef]);

    // ------------------------------------------------------ cell handlers
    /** Where column `colIndex` of a row starts and how wide it is, honouring colSpan. */
    const getSpanInfo = (id, colIndex) => {
        const currentLayout = layoutRef.current;
        if (!currentLayout.all.some((entry) => entry.column.colSpan)) return { start: colIndex, span: 1 };
        const entry = currentLayout.all[colIndex];
        if (!entry) return { start: colIndex, span: 1 };
        const section = currentLayout[entry.section];
        const offset = entry.index - entry.sectionIndex;
        const { startOf, spanOf } = computeSectionSpans(section, getRow(id), apiRef);
        const start = startOf[entry.sectionIndex];
        return { start: offset + start, span: spanOf[start] };
    };

    const moveFocus = (rowIndex, colIndex, direction = 0) => {
        const rows = navigationRowIdsRef.current;
        const entries = layoutRef.current.all;
        if (rows.length === 0 || entries.length === 0) return;
        const r = clamp(rowIndex, 0, rows.length - 1);
        let c = clamp(colIndex, 0, entries.length - 1);
        // Land on the cell covering the target column; when moving left onto a
        // spanned cell that would be the cell we are leaving, keep going.
        c = getSpanInfo(rows[r], c).start;
        if (direction < 0 && focusRef.current && focusRef.current.id === rows[r]) {
            const currentIndex = entries.findIndex((e) => e.field === focusRef.current.field);
            if (c === currentIndex && c > 0) c = getSpanInfo(rows[r], c - 1).start;
        }
        focusCell(rows[r], entries[c].field);
    };

    /** Moves focus relative to a cell after an edit commits (MUI's cellToFocusAfter). */
    const moveFocusAfterEdit = (id, field, where) => {
        if (!where || where === 'none') return;
        const rows = navigationRowIdsRef.current;
        const rowIndex = rows.indexOf(id);
        const colIndex = layoutRef.current.all.findIndex((entry) => entry.field === field);
        if (rowIndex === -1 || colIndex === -1) return;
        if (where === 'below') moveFocus(rowIndex + 1, colIndex);
        else if (where === 'right')
            moveFocus(rowIndex, getSpanInfo(id, colIndex).start + getSpanInfo(id, colIndex).span);
        else if (where === 'left') moveFocus(rowIndex, colIndex - 1, -1);
    };
    const moveFocusAfterEditRef = useLatest(moveFocusAfterEdit);

    const handleCellMouseDown = (id, field, event) => {
        if (event.button !== 0) return;
        const state = editStateRef.current;
        if (propsRef.current.editMode === 'row') {
            Object.keys(state).forEach((idKey) => {
                if (idKey !== String(id)) {
                    const editId = navigationRowIdsRef.current.find((rowId) => String(rowId) === idKey) ?? idKey;
                    stopEditingFromEvent(editId, undefined, 'rowFocusOut', {}, event);
                }
            });
        } else {
            Object.keys(state).forEach((idKey) => {
                Object.keys(state[idKey]).forEach((editField) => {
                    if (idKey === String(id) && editField === field) return;
                    const editId = navigationRowIdsRef.current.find((rowId) => String(rowId) === idKey) ?? idKey;
                    stopEditingFromEvent(editId, editField, 'cellFocusOut', {}, event);
                });
            });
        }
    };

    const handleCellClick = (id, field, event) => {
        if (isSkeletonId(id)) return;
        const params = getCellParams(id, field);
        setFocus({ area: 'cell', id, field }, { moveDomFocus: false });
        if (propsRef.current.onCellClick) propsRef.current.onCellClick(params, event);
        publish('cellClick', params, event);
        if (propsRef.current.onRowClick) propsRef.current.onRowClick(getRowParams(id), event);
        publish('rowClick', getRowParams(id), event);
        const editing =
            editStateRef.current[id] && (propsRef.current.editMode === 'row' || editStateRef.current[id][field]);
        if (editing || isInteractiveTarget(event.target) || field === GRID_REORDER_FIELD) return;
        handleRowSelectionClick(id, event);
    };

    const handleCellDoubleClick = (id, field, event) => {
        const params = getCellParams(id, field);
        if (propsRef.current.onCellDoubleClick) propsRef.current.onCellDoubleClick(params, event);
        publish('cellDoubleClick', params, event);
        if (propsRef.current.onRowDoubleClick) propsRef.current.onRowDoubleClick(getRowParams(id), event);
        if (isInteractiveTarget(event.target) && !(editStateRef.current[id] && editStateRef.current[id][field])) return;
        startEditingFromEvent(id, field, 'cellDoubleClick', {}, event);
    };

    const handleCellKeyDown = (event, current) => {
        const { id, field } = current;
        const rows = navigationRowIdsRef.current;
        const entries = layoutRef.current.all;
        const rowIndex = rows.indexOf(id);
        const colIndex = entries.findIndex((entry) => entry.field === field);
        if (rowIndex === -1 || colIndex === -1) return;
        const params = getCellParams(id, field);
        if (propsRef.current.onCellKeyDown) {
            propsRef.current.onCellKeyDown(params, event);
            if (event.defaultMuiPrevented || event.defaultOGPrevented) return;
        }
        const isRowEditing = propsRef.current.editMode === 'row' && Boolean(editStateRef.current[id]);
        const isCellEditing = Boolean(editStateRef.current[id] && editStateRef.current[id][field]);
        const ctrl = event.ctrlKey || event.metaKey;

        if (isRowEditing || isCellEditing) {
            const edits = editStateRef.current[id];
            const blocked = Object.keys(edits).some(
                (key) => (isRowEditing || key === field) && (edits[key].error || edits[key].isProcessingProps),
            );
            if (blocked && (event.key === 'Enter' || event.key === 'Tab')) {
                // Invalid value: stay in the editor, like MUI X.
                if (event.key === 'Tab' && isRowEditing) {
                    // Moving between fields of the row is still allowed.
                } else {
                    event.preventDefault();
                    return;
                }
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                stopEditingFromEvent(id, field, 'escapeKeyDown', { ignoreModifications: true }, event);
                setFocus({ area: 'cell', id, field });
            } else if (event.key === 'Enter' && !event.shiftKey && !event.target.closest('textarea')) {
                event.preventDefault();
                // Focus moves to the cell below once the commit succeeds (MUI X behaviour).
                stopEditingFromEvent(id, field, 'enterKeyDown', { cellToFocusAfter: 'below' }, event);
            } else if (event.key === 'Tab') {
                event.preventDefault();
                const step = event.shiftKey ? -1 : 1;
                if (isRowEditing) {
                    const editable = entries.filter((entry) => editStateRef.current[id][entry.field]);
                    const at = editable.findIndex((entry) => entry.field === field);
                    const next = editable[at + step];
                    if (next) {
                        setFocus({ area: 'cell', id, field: next.field });
                        scrollToCell(id, next.field);
                    } else if (!blocked) {
                        stopEditingFromEvent(
                            id,
                            field,
                            event.shiftKey ? 'shiftTabKeyDown' : 'tabKeyDown',
                            {
                                cellToFocusAfter: event.shiftKey ? 'left' : 'right',
                            },
                            event,
                        );
                    }
                } else {
                    stopEditingFromEvent(
                        id,
                        field,
                        event.shiftKey ? 'shiftTabKeyDown' : 'tabKeyDown',
                        {
                            cellToFocusAfter: event.shiftKey ? 'left' : 'right',
                        },
                        event,
                    );
                }
            }
            return;
        }

        const pageRows = Math.max(1, Math.floor(bodyViewportHeight / rowHeight) - 1);
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                moveFocus(rowIndex + 1, colIndex);
                break;
            case 'ArrowUp':
                event.preventDefault();
                if (rowIndex === 0) {
                    if (propsRef.current.headerFilters) setFocus({ area: 'headerFilter', field });
                    else setFocus({ area: 'header', field });
                } else moveFocus(rowIndex - 1, colIndex);
                break;
            case 'ArrowRight': {
                event.preventDefault();
                const { start, span } = getSpanInfo(id, colIndex);
                if (start + span < entries.length) moveFocus(rowIndex, start + span);
                break;
            }
            case 'ArrowLeft':
                event.preventDefault();
                moveFocus(rowIndex, colIndex - 1, -1);
                break;
            case 'Home':
                event.preventDefault();
                moveFocus(ctrl ? 0 : rowIndex, 0);
                break;
            case 'End':
                event.preventDefault();
                moveFocus(ctrl ? rows.length - 1 : rowIndex, entries.length - 1);
                break;
            case 'PageDown':
                event.preventDefault();
                moveFocus(rowIndex + pageRows, colIndex);
                break;
            case 'PageUp':
                event.preventDefault();
                moveFocus(rowIndex - pageRows, colIndex);
                break;
            case 'Enter':
            case 'F2':
                if (field === GRID_TREE_DATA_GROUPING_FIELD && event.key === 'Enter') {
                    event.preventDefault();
                    toggleRowExpansion(id);
                } else if (field === GRID_DETAIL_PANEL_TOGGLE_FIELD && event.key === 'Enter') {
                    event.preventDefault();
                    toggleDetailPanel(id);
                } else if (
                    startEditingFromEvent(id, field, event.key === 'F2' ? 'f2KeyDown' : 'enterKeyDown', {}, event)
                ) {
                    event.preventDefault();
                }
                break;
            case ' ':
                if (isInteractiveTarget(event.target) && event.target !== event.currentTarget) break;
                event.preventDefault();
                if (field === GRID_TREE_DATA_GROUPING_FIELD && !event.shiftKey) toggleRowExpansion(id);
                else if (field === GRID_DETAIL_PANEL_TOGGLE_FIELD && !event.shiftKey) toggleDetailPanel(id);
                else if (
                    field === GRID_CHECKBOX_SELECTION_FIELD ||
                    event.shiftKey ||
                    propsRef.current.checkboxSelection
                ) {
                    if (isRowSelectable(id))
                        selectRow(id, !selectedSet.has(id), propsRef.current.disableMultipleRowSelection);
                }
                break;
            case 'Delete':
            case 'Backspace':
                if (startEditingFromEvent(id, field, 'deleteKeyDown', { deleteValue: true }, event))
                    event.preventDefault();
                break;
            default:
                if (ctrl && event.key.toLowerCase() === 'a') {
                    if (!propsRef.current.disableMultipleRowSelection) {
                        event.preventDefault();
                        selectRows(getSelectAllIds(), true, false);
                    }
                } else if (ctrl && event.key.toLowerCase() === 'c') {
                    // eslint-disable-next-line no-use-before-define
                    copySelectionToClipboard();
                } else if (event.key.length === 1 && !ctrl && !event.altKey) {
                    const column = columnsByField.get(field);
                    const typed = column && ['string', 'number'].includes(column.type);
                    if (
                        startEditingFromEvent(
                            id,
                            field,
                            'printableKeyDown',
                            typed ? { initialValue: event.key } : {},
                            event,
                        )
                    ) {
                        event.preventDefault();
                    }
                }
        }
    };

    const handleHeaderKeyDown = (event, current) => {
        const entries = layoutRef.current.all;
        const colIndex = entries.findIndex((entry) => entry.field === current.field);
        if (colIndex === -1) return;
        const moveHeader = (index) => {
            const entry = entries[clamp(index, 0, entries.length - 1)];
            setFocus({ area: current.area, field: entry.field });
            scrollToCell(undefined, entry.field);
        };
        switch (event.key) {
            case 'ArrowRight':
                event.preventDefault();
                moveHeader(colIndex + 1);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                moveHeader(colIndex - 1);
                break;
            case 'Home':
                event.preventDefault();
                moveHeader(0);
                break;
            case 'End':
                event.preventDefault();
                moveHeader(entries.length - 1);
                break;
            case 'ArrowDown':
                if (event.altKey && current.area === 'header') {
                    event.preventDefault();
                    showColumnMenu(current.field, event.target);
                    break;
                }
                event.preventDefault();
                if (current.area === 'header' && propsRef.current.headerFilters) {
                    setFocus({ area: 'headerFilter', field: current.field });
                } else if (navigationRowIdsRef.current.length > 0) {
                    moveFocus(0, colIndex);
                }
                break;
            case 'ArrowUp':
                if (current.area === 'headerFilter') {
                    event.preventDefault();
                    setFocus({ area: 'header', field: current.field });
                }
                break;
            case 'Enter':
                if (current.area !== 'header') break;
                event.preventDefault();
                if (ctrlKey(event)) showColumnMenu(current.field, event.target);
                else if (current.field === GRID_CHECKBOX_SELECTION_FIELD) toggleSelectAll();
                else sortColumn(current.field, undefined, event.shiftKey);
                break;
            case ' ':
                if (current.area === 'header' && current.field === GRID_CHECKBOX_SELECTION_FIELD) {
                    event.preventDefault();
                    toggleSelectAll();
                }
                break;
            default:
        }
    };

    const handleKeyDown = (event) => {
        if (event.defaultPrevented) return;
        const current = focusRef.current;
        if (!current) return;
        const target = event.target;
        const inEditor = target instanceof Element && target.closest('.og-cell--editing');
        const inInput =
            target instanceof Element && target.matches('input, textarea, select, [contenteditable="true"]');
        if (inInput && !inEditor) {
            // Header filter inputs keep native key handling except for leaving them.
            if (current.area === 'headerFilter' && event.key === 'Escape') {
                event.preventDefault();
                setFocus({ area: 'header', field: current.field });
            }
            return;
        }
        if (current.area === 'cell') handleCellKeyDown(event, current);
        else handleHeaderKeyDown(event, current);
    };

    // -------------------------------------------------------------- headers
    const handleColumnHeaderClick = (field, event) => {
        const params = getColumnHeaderParams(field);
        if (propsRef.current.onColumnHeaderClick) propsRef.current.onColumnHeaderClick(params, event);
        publish('columnHeaderClick', params, event);
        setFocus({ area: 'header', field }, { moveDomFocus: false });
        if (field === GRID_CHECKBOX_SELECTION_FIELD) return;
        sortColumn(field, undefined, event.shiftKey || event.ctrlKey || event.metaKey);
    };

    // -------------------------------------------------- scroll callbacks
    const handleRowsScrollEnd = () => {
        if (propsRef.current.onRowsScrollEnd) {
            propsRef.current.onRowsScrollEnd({
                visibleColumns,
                viewportPageSize: Math.floor(bodyViewportHeight / rowHeight),
                visibleRowsCount: pageIds.length,
            });
        }
        publish('rowsScrollEnd', { visibleRowsCount: pageIds.length });
    };

    const requestRangeRef = useLatest(ds.enabled ? ds.requestRange : null);
    const handleRenderedRowsChange = useCallback(
        (first, last) => {
            if (requestRangeRef.current) requestRangeRef.current(first, last);
            if (propsRef.current.onRenderedRowsChange) propsRef.current.onRenderedRowsChange({ first, last });
        },
        [requestRangeRef, propsRef],
    );

    // ---------------------------------------------------- export & clipboard
    const getExportIds = (options = {}) => {
        let ids;
        if (options.getRowsToExport) ids = options.getRowsToExport({ apiRef });
        else if (selectedSet.size > 0) ids = getAllFilteredSortedIds().filter((id) => selectedSet.has(id));
        else ids = getAllFilteredSortedIds();
        return ids.filter((id) => !isSkeletonId(id));
    };

    const getExportCols = (options = {}) => {
        const visibleSet = new Set(visibleColumns.map((column) => column.field));
        const source = options.allColumns ? orderedColumns : visibleColumns;
        const columns = getExportColumns(
            source.map((column) => (visibleSet.has(column.field) ? column : { ...column, __visible: false })),
            options,
        );
        if (tree && !options.fields && visibleSet.has(GRID_TREE_DATA_GROUPING_FIELD)) {
            columns.unshift(columnsByField.get(GRID_TREE_DATA_GROUPING_FIELD));
        }
        return columns;
    };

    const getDataAsCsv = (options = {}) =>
        buildCsv({
            columns: getExportCols(options),
            items: getExportIds(options),
            getText,
            delimiter: options.delimiter,
            includeHeaders: options.includeHeaders !== false,
        });

    const exportDataAsCsv = (options = {}) => {
        exportCsv(getDataAsCsv(options), { fileName: options.fileName || 'data', utf8WithBom: options.utf8WithBom });
    };

    const exportDataAsPrint = (options = {}) => {
        printRows({
            columns: getExportCols(options),
            items: getExportIds(options),
            getText,
            title: options.fileName || document.title,
            hideToolbar: options.hideToolbar,
            pageStyle: options.pageStyle,
        });
    };

    function copySelectionToClipboard() {
        let text = '';
        if (selectedSet.size > 0) {
            const items = getAllFilteredSortedIds().filter((id) => selectedSet.has(id));
            text = buildTsv({ columns: getExportCols({}), items, getText });
        } else if (focusRef.current && focusRef.current.area === 'cell') {
            const column = columnsByField.get(focusRef.current.field);
            if (column) text = getText(focusRef.current.id, column);
        }
        if (text) {
            copyToClipboard(text);
            publish('clipboardCopy', text);
            if (propsRef.current.onClipboardCopy) propsRef.current.onClipboardCopy(text);
        }
    }

    // ------------------------------------------------------- state persistence
    const exportState = () => ({
        columns: {
            columnVisibilityModel,
            orderedFields: orderedColumns.map((column) => column.field),
            dimensions: Object.fromEntries(layout.all.map((entry) => [entry.field, { width: entry.width }])),
        },
        sorting: { sortModel },
        filter: { filterModel },
        pagination: { paginationModel },
        pinnedColumns,
        density,
        detailPanel: { expandedRowIds: detailPanelExpandedRowIds },
    });

    const restoreState = (state = {}) => {
        if (state.columns) {
            if (state.columns.columnVisibilityModel)
                setColumnVisibilityModel(state.columns.columnVisibilityModel, { reason: 'restoreState' });
            if (state.columns.orderedFields) setColumnOrder(state.columns.orderedFields);
            if (state.columns.dimensions) {
                const widths = {};
                Object.keys(state.columns.dimensions).forEach((field) => {
                    const width = state.columns.dimensions[field] && state.columns.dimensions[field].width;
                    if (typeof width === 'number') widths[field] = width;
                });
                setColumnWidths(widths);
            }
        }
        if (state.sorting && state.sorting.sortModel) setSortModel(state.sorting.sortModel, { reason: 'restoreState' });
        if (state.filter && state.filter.filterModel) {
            setFilterModel({ ...DEFAULT_FILTER_MODEL, ...state.filter.filterModel }, { reason: 'restoreState' });
        }
        if (state.pagination && state.pagination.paginationModel) {
            setPaginationModel(
                { ...paginationModelRef.current, ...state.pagination.paginationModel },
                { reason: 'restoreState' },
            );
        }
        if (state.pinnedColumns) setPinnedColumns(state.pinnedColumns, { reason: 'restoreState' });
        if (state.density) setDensity(state.density);
        if (state.detailPanel && state.detailPanel.expandedRowIds)
            setDetailPanelExpandedRowIds(state.detailPanel.expandedRowIds);
    };

    // --------------------------------------------------------- autosize on mount
    const autosizedRef = useRef(false);
    useEffect(() => {
        if (!props.autosizeOnMount || autosizedRef.current || viewport.width === 0) return undefined;
        autosizedRef.current = true;
        const frame = requestAnimationFrame(() => autosizeColumns(props.autosizeOptions));
        return () => cancelAnimationFrame(frame);
    }, [props.autosizeOnMount, props.autosizeOptions, viewport.width, autosizeColumns]);

    // ----------------------------------------------------------------- API
    const [api] = useState(() => ({}));
    Object.assign(api, {
        instanceId,
        rootElementRef: rootRef,
        // rows
        getRow,
        getRowId: (row) => getRowIdRef.current(row),
        getRowModels: () => new Map(store.ids.filter((id) => !isSkeletonId(id)).map((id) => [id, store.byId.get(id)])),
        getAllRowIds: () => store.ids.slice(),
        getRowsCount: () => store.ids.length,
        getSortedRowIds: () => getAllFilteredSortedIds().slice(),
        getVisibleRowIds: () => pageIds.slice(),
        getRowNode,
        getRowIndexRelativeToVisibleRows: (id) => pageIds.indexOf(id),
        updateRows,
        setRows,
        setRowIndex,
        getRowParams,
        // cells
        getCellValue: (id, field) => {
            const column = columnsByField.get(field);
            return column ? getValue(id, column) : undefined;
        },
        getCellParams,
        getColumnHeaderParams,
        // columns
        getAllColumns: () => orderedColumns.slice(),
        getVisibleColumns: () => visibleColumns.slice(),
        getColumn: (field) => columnsByField.get(field),
        getColumnIndex: (field) => visibleColumns.findIndex((column) => column.field === field),
        setColumnVisibility,
        setColumnVisibilityModel: (model) => setColumnVisibilityModel(model, { reason: 'api' }),
        setColumnWidth,
        setColumnIndex,
        pinColumn,
        unpinColumn,
        isColumnPinned,
        setPinnedColumns: (model) => setPinnedColumns(model, { reason: 'api' }),
        getPinnedColumns: () => pinnedColumns,
        autosizeColumns,
        // sorting
        getSortModel: () => sortModelRef.current,
        setSortModel: (model) => setSortModel(model, { reason: 'api' }),
        sortColumn,
        // filtering
        getFilterModel: () => ({ ...DEFAULT_FILTER_MODEL, ...filterModelRef.current }),
        setFilterModel: (model) => setFilterModel({ ...DEFAULT_FILTER_MODEL, ...model }, { reason: 'api' }),
        upsertFilterItem,
        upsertFilterItems: (items) => items.forEach(upsertFilterItem),
        deleteFilterItem,
        setFilterLogicOperator,
        setQuickFilterValues,
        showFilterPanel: (field) => showPreferences('filters', { field }),
        hideFilterPanel: hidePreferences,
        showColumnsPanel: () => showPreferences('columns'),
        showPreferences: (type) => showPreferences(type),
        hidePreferences,
        showColumnMenu: (field) => {
            const header =
                rootRef.current && rootRef.current.querySelector(`.og-column-header[data-field="${cssEscape(field)}"]`);
            showColumnMenu(field, header);
        },
        hideColumnMenu,
        // pagination
        setPage: (value) => setPaginationModel((model) => ({ ...model, page: value }), { reason: 'api' }),
        setPageSize: (value) => setPaginationModel({ page: 0, pageSize: value }, { reason: 'api' }),
        setPaginationModel: (model) => setPaginationModel(model, { reason: 'api' }),
        getPaginationModel: () => paginationModel,
        // selection
        selectRow,
        selectRows,
        selectRowRange: ({ startId, endId }, isSelected, reset) => selectRowRange(startId, endId, isSelected, reset),
        setRowSelectionModel: (model) => setRowSelectionModel(model, { reason: 'api' }),
        getSelectedRows: () => new Map(rowSelectionModelRef.current.map((id) => [id, getRow(id)])),
        isRowSelected: (id) => selectedSet.has(id),
        isRowSelectable,
        // editing
        isCellEditable: (params) => isCellEditable(params.id, params.field),
        getCellMode,
        getRowMode,
        startCellEditMode,
        stopCellEditMode,
        startRowEditMode,
        stopRowEditMode,
        setEditCellValue,
        getRowWithUpdatedValues: (id) => {
            const edits = editStateRef.current[id];
            return edits ? buildUpdatedRow(id, edits).newRow : getRow(id);
        },
        getEditCellProps: (id, field) => (editStateRef.current[id] && editStateRef.current[id][field]) || null,
        // tree data & master detail
        setRowChildrenExpansion,
        toggleRowExpansion,
        toggleDetailPanel,
        getExpandedDetailPanels: () => detailIdsRef.current.slice(),
        setExpandedDetailPanels: (ids) => setDetailPanelExpandedRowIds(Array.from(ids)),
        // density
        setDensity,
        getDensity: () => density,
        // focus & scroll
        setCellFocus: (id, field) => focusCell(id, field),
        setColumnHeaderFocus: (field) => setFocus({ area: 'header', field }),
        getCellFocus: () => focusRef.current,
        scrollToIndexes: (indexes) => scrollerApiRef.current && scrollerApiRef.current.scrollToIndexes(indexes),
        scroll: (position) => scrollerApiRef.current && scrollerApiRef.current.scroll(position),
        getScrollPosition: () =>
            scrollerApiRef.current ? scrollerApiRef.current.getScrollPosition() : { top: 0, left: 0 },
        // export
        getDataAsCsv,
        exportDataAsCsv,
        exportDataAsPrint,
        copySelectionToClipboard,
        // state
        exportState,
        restoreState,
        // data source
        dataSource: {
            fetchRows: () => ds.enabled && ds.refetch(),
            cache: { clear: () => ds.enabled && ds.clearCache() },
        },
        // events
        subscribeEvent: (name, handler) => {
            const map = listenersRef.current;
            if (!map.has(name)) map.set(name, new Set());
            map.get(name).add(handler);
            return () => map.get(name).delete(handler);
        },
        publishEvent: publish,
    });
    apiRef.current = api;

    // Stable handlers object for memoised rows: identity never changes, the
    // functions are refreshed every render so they always see fresh state.
    const [handlers] = useState(() => ({}));
    Object.assign(handlers, {
        onCellMouseDown: handleCellMouseDown,
        onCellClick: handleCellClick,
        onCellDoubleClick: handleCellDoubleClick,
        onCellFocus: (id, field) => {
            const current = focusRef.current;
            if (!current || current.area !== 'cell' || current.id !== id || current.field !== field) {
                setFocus({ area: 'cell', id, field }, { moveDomFocus: false });
            }
        },
        onCheckboxChange: handleCheckboxChange,
        getCellParams,
        getRowParams,
        getValue,
        getText,
        isCellEditable,
        setEditCellValue,
        toggleRowExpansion,
        toggleDetailPanel,
        getMeasureRef,
        moveRowTo,
        finishRowReorder,
        setDragState,
        getRowBaseHeight,
        getDetailHeight,
    });

    return {
        props,
        instanceId,
        themeClass: `og-theme-${props.theme}`,
        localeText,
        apiRef,
        api,
        rootRef,
        scrollerApiRef,
        handlers,
        // columns
        allColumns,
        orderedColumns,
        visibleColumns,
        columnsByField,
        layout,
        groupRows,
        pinnedColumns,
        columnVisibilityModel,
        // rows
        store,
        tree,
        treeFilter,
        isExpanded,
        visibleRowIds,
        pageIds,
        pinned,
        rowSizes,
        getRow,
        getValue,
        getText,
        isSkeletonId,
        topLevelCount,
        isLazy,
        lazyRowCountKnown: lazy ? lazy.isRowCountKnown : true,
        // dimensions
        density,
        densityFactor,
        rowHeight,
        headerHeight,
        groupHeaderHeight,
        headerFilterHeight,
        headersTotalHeight,
        pinnedTopHeight,
        pinnedBottomHeight,
        bodyViewportHeight,
        viewport,
        setViewport,
        measureVersion,
        // state
        sortModel,
        filterModel,
        paginationModel,
        paginationEnabled,
        paginationRowCount,
        pageCount,
        selectedSet,
        detailSet,
        hasDetailPanel,
        focus,
        editState,
        panel,
        columnMenu,
        dragState,
        loading: Boolean(props.loading) || Boolean(ds.loading),
        treeData,
        rowReordering,
        // actions used by components
        sortColumn,
        upsertFilterItem,
        deleteFilterItem,
        setFilterModel: (model, reason) => setFilterModel({ ...DEFAULT_FILTER_MODEL, ...model }, { reason }),
        setFilterLogicOperator,
        setQuickFilterValues,
        getDefaultOperator,
        showPreferences,
        hidePreferences,
        showColumnMenu,
        hideColumnMenu,
        setColumnVisibility,
        setColumnVisibilityModel,
        setColumnWidth,
        setColumnIndex,
        pinColumn,
        unpinColumn,
        isColumnPinned,
        autosizeColumns,
        setPaginationModel,
        setDensity,
        toggleSelectAll,
        getSelectAllState,
        setFocus,
        handleKeyDown,
        handleColumnHeaderClick,
        handleRowsScrollEnd,
        handleRenderedRowsChange,
        exportDataAsCsv,
        exportDataAsPrint,
        getCellMode,
        getRowMode,
    };
}

const ctrlKey = (event) => event.ctrlKey || event.metaKey;
