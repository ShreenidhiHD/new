import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getCenterColumnRange } from '../core/layout';
import { useLatest } from '../hooks/useModel';
import { ColumnHeaders } from './ColumnHeaders';
import { useGridContext } from './GridContext';
import { GridOverlays } from './Overlays';
import Row from './Row';

const AUTO_SCROLL_ZONE = 40;
const FALLBACK_ROWS = 50;

/** Which rows/columns must be rendered for a given scroll position. */
function computeRenderContext(grid, scrollTop, scrollLeft) {
    const { rowSizes, layout, viewport, props, bodyViewportHeight } = grid;
    const count = rowSizes.count;
    let firstRow = 0;
    let lastRow = count - 1;
    if (count === 0) {
        lastRow = -1;
    } else if (!props.disableVirtualization && !props.autoHeight) {
        if (viewport.height === 0) {
            lastRow = Math.min(count - 1, FALLBACK_ROWS - 1);
        } else {
            firstRow = rowSizes.indexAt(Math.max(0, scrollTop - props.rowBufferPx));
            lastRow = rowSizes.indexAt(scrollTop + bodyViewportHeight + props.rowBufferPx);
        }
    }
    let firstCol = 0;
    let lastCol = layout.center.length - 1;
    if (!props.disableVirtualization && viewport.width > 0 && layout.center.length > 0) {
        const range = getCenterColumnRange(layout, scrollLeft, viewport.width, props.columnBufferPx);
        firstCol = range.first;
        lastCol = range.last;
    }
    return { firstRow, lastRow, firstCol, lastCol };
}

const sameContext = (a, b) =>
    a.firstRow === b.firstRow && a.lastRow === b.lastRow && a.firstCol === b.firstCol && a.lastCol === b.lastCol;

export function GridBody() {
    const grid = useGridContext();
    const gridRef = useLatest(grid);
    const scrollerRef = useRef(null);
    const scrollRef = useRef({ top: 0, left: 0 });
    const [, setScrollTick] = useState(0);
    const scrollEndFiredForRef = useRef(-1);

    const {
        props,
        layout,
        rowSizes,
        pageIds,
        pinned,
        handlers,
        localeText,
        apiRef,
        viewport,
        headersTotalHeight,
        pinnedTopHeight,
        pinnedBottomHeight,
        rowHeight,
        focus,
        editState,
        selectedSet,
        detailSet,
        dragState,
        tree,
        treeFilter,
        isExpanded,
        store,
        paginationModel,
        paginationEnabled,
        themeClass,
    } = grid;

    // Reading the ref during render is intentional: it is the source of truth
    // for the scroll position, and state only triggers re-renders.
    const context = computeRenderContext(grid, scrollRef.current.top, scrollRef.current.left);
    const contextRef = useLatest(context);

    // ------------------------------------------------------------ viewport
    const measure = useCallback(() => {
        const element = scrollerRef.current;
        if (!element) return;
        const next = { width: element.clientWidth, height: element.clientHeight };
        gridRef.current.setViewport((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    }, [gridRef]);

    useLayoutEffect(() => {
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(() => measure());
        observer.observe(scrollerRef.current);
        return () => observer.disconnect();
    }, [measure]);

    // Content size changes can toggle scrollbars, which changes clientWidth.
    useLayoutEffect(() => {
        measure();
    }, [measure, rowSizes.total, layout.totalWidth]);

    // ------------------------------------------------------------- scrolling
    const checkScrollEnd = useCallback(() => {
        const element = scrollerRef.current;
        const g = gridRef.current;
        if (!element || !g.props.onRowsScrollEnd) return;
        const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
        if (distance <= g.props.scrollEndThreshold && scrollEndFiredForRef.current !== g.rowSizes.total) {
            scrollEndFiredForRef.current = g.rowSizes.total;
            g.handleRowsScrollEnd();
        }
    }, [gridRef]);

    const onScroll = useCallback(() => {
        const element = scrollerRef.current;
        if (!element) return;
        scrollRef.current = { top: element.scrollTop, left: element.scrollLeft };
        const next = computeRenderContext(gridRef.current, element.scrollTop, element.scrollLeft);
        if (!sameContext(next, contextRef.current)) setScrollTick((tick) => tick + 1);
        checkScrollEnd();
        gridRef.current.api.publishEvent('scrollPositionChange', { top: element.scrollTop, left: element.scrollLeft });
    }, [gridRef, contextRef, checkScrollEnd]);

    useEffect(() => {
        checkScrollEnd();
    }, [checkScrollEnd, rowSizes.total, viewport.height]);

    // Reset to the top when the page changes.
    useEffect(() => {
        const element = scrollerRef.current;
        if (!element || !paginationEnabled) return;
        element.scrollTop = 0;
        scrollRef.current = { ...scrollRef.current, top: 0 };
        setScrollTick((tick) => tick + 1);
    }, [paginationModel.page, paginationModel.pageSize, paginationEnabled]);

    // Lazy loading: report which rows are on screen (debounced). Re-reported when
    // the row store changes so a reset (new sort/filter) refetches what is visible.
    const { firstRow, lastRow } = context;
    useEffect(() => {
        if (lastRow < firstRow) return undefined;
        const timer = setTimeout(
            () => gridRef.current.handleRenderedRowsChange(firstRow, lastRow),
            grid.isLazy ? 120 : 0,
        );
        return () => clearTimeout(timer);
    }, [firstRow, lastRow, grid.isLazy, gridRef, store]);

    useEffect(() => {
        gridRef.current.scrollerApiRef.current = {
            scrollToIndexes: ({ rowIndex, colIndex }) => {
                const element = scrollerRef.current;
                const g = gridRef.current;
                if (!element) return false;
                let { top, left } = scrollRef.current;
                if (rowIndex !== undefined && rowIndex >= 0 && rowIndex < g.rowSizes.count) {
                    const rowTop = g.rowSizes.offset(rowIndex);
                    const rowBottom = rowTop + g.handlers.getRowBaseHeight(g.pageIds[rowIndex]).height;
                    const visible = g.bodyViewportHeight;
                    if (rowTop < top) top = rowTop;
                    else if (rowBottom > top + visible) top = rowBottom - visible;
                }
                if (colIndex !== undefined && colIndex >= 0) {
                    const entry = g.layout.all[colIndex];
                    if (entry && entry.section === 'center') {
                        const visible = g.viewport.width - g.layout.leftWidth - g.layout.rightWidth;
                        if (entry.offset < left) left = entry.offset;
                        else if (entry.offset + entry.width > left + visible)
                            left = entry.offset + entry.width - visible;
                    }
                }
                if (top !== scrollRef.current.top || left !== scrollRef.current.left) {
                    element.scrollTop = top;
                    element.scrollLeft = left;
                    scrollRef.current = { top: element.scrollTop, left: element.scrollLeft };
                    setScrollTick((tick) => tick + 1);
                    return true;
                }
                return false;
            },
            scroll: ({ top, left }) => {
                const element = scrollerRef.current;
                if (!element) return;
                if (top !== undefined) element.scrollTop = top;
                if (left !== undefined) element.scrollLeft = left;
                scrollRef.current = { top: element.scrollTop, left: element.scrollLeft };
                setScrollTick((tick) => tick + 1);
            },
            getScrollPosition: () => ({ ...scrollRef.current }),
            getRenderContext: () => ({ ...contextRef.current }),
        };
    }, [gridRef, contextRef]);

    // ------------------------------------------------------- row reordering
    useEffect(() => {
        handlers.startRowDrag = (id, event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            const g = gridRef.current;
            const oldIndex = g.store.ids.indexOf(id);
            if (oldIndex === -1) return;
            let lastClientY = event.clientY;
            let frame = 0;
            g.handlers.setDragState({ type: 'row', id });
            document.body.classList.add('og-cursor-grabbing');

            const reorderAt = (clientY) => {
                const element = scrollerRef.current;
                const current = gridRef.current;
                if (!element) return;
                const rect = element.getBoundingClientRect();
                const y = clientY - rect.top - current.headersTotalHeight - current.pinnedTopHeight + element.scrollTop;
                const sizes = current.rowSizes;
                const ids = current.pageIds;
                const from = ids.indexOf(id);
                if (from === -1 || sizes.count === 0) return;
                const to = sizes.indexAt(Math.max(0, y));
                if (to === from) return;
                const shouldMove =
                    to > from
                        ? y >= sizes.offset(to) + sizes.height(to) - sizes.height(from)
                        : y <= sizes.offset(to) + sizes.height(from);
                if (shouldMove) current.handlers.moveRowTo(id, ids[to]);
            };
            const autoScroll = () => {
                frame = 0;
                const element = scrollerRef.current;
                const current = gridRef.current;
                if (!element) return;
                const rect = element.getBoundingClientRect();
                const top = rect.top + current.headersTotalHeight + current.pinnedTopHeight;
                const bottom = rect.top + element.clientHeight - current.pinnedBottomHeight;
                let delta = 0;
                if (lastClientY < top + AUTO_SCROLL_ZONE)
                    delta = -Math.ceil((top + AUTO_SCROLL_ZONE - lastClientY) / 3);
                else if (lastClientY > bottom - AUTO_SCROLL_ZONE)
                    delta = Math.ceil((lastClientY - (bottom - AUTO_SCROLL_ZONE)) / 3);
                if (delta !== 0) {
                    element.scrollTop += delta;
                    reorderAt(lastClientY);
                    frame = requestAnimationFrame(autoScroll);
                }
            };
            const onMove = (moveEvent) => {
                lastClientY = moveEvent.clientY;
                moveEvent.preventDefault();
                reorderAt(moveEvent.clientY);
                if (!frame) frame = requestAnimationFrame(autoScroll);
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                cancelAnimationFrame(frame);
                document.body.classList.remove('og-cursor-grabbing');
                gridRef.current.handlers.setDragState(null);
                gridRef.current.handlers.finishRowReorder(id, oldIndex);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        };
    }, [handlers, gridRef]);

    // --------------------------------------------------------------- render
    const { firstCol, lastCol } = context;
    const hasColSpan = layout.all.some((entry) => entry.column.colSpan);
    // Roving tabindex: only the focused cell is tabbable (headers handle the initial stop).
    const focusedCell = focus && focus.area === 'cell' ? focus : null;
    const pageOffset = paginationEnabled ? paginationModel.page * paginationModel.pageSize : 0;
    const headerRowCount = grid.groupRows.length + 1 + (props.headerFilters ? 1 : 0);
    // Like MUI X: dragging rows only makes sense in the raw order, not while sorted or editing.
    const reorderDisabled = grid.sortModel.length > 0 || Object.keys(editState).length > 0;

    const renderRow = (id, indexInPage, extra = {}) => {
        const isSkeleton = grid.isSkeletonId(id);
        const row = isSkeleton ? null : grid.getRow(id);
        const node = tree ? tree.nodes.get(id) : null;
        const base = isSkeleton ? { height: rowHeight, auto: false } : handlers.getRowBaseHeight(id);
        const detailOpen = Boolean(grid.hasDetailPanel && detailSet.has(id) && !extra.pinnedPosition);
        const detail = detailOpen ? handlers.getDetailHeight(id) : null;
        const rowEdits = editState[id];
        return (
            <Row
                key={id}
                id={id}
                row={row}
                ariaRowIndex={headerRowCount + (extra.ariaOffset ?? pinned.top.length + pageOffset) + indexInPage + 1}
                indexInPage={indexInPage}
                layout={layout}
                firstCol={firstCol}
                lastCol={lastCol}
                height={base.height}
                autoHeight={base.auto}
                isSelected={selectedSet.has(id)}
                isSelectable={!isSkeleton && (!props.isRowSelectable || grid.api.isRowSelectable(id))}
                focusField={focusedCell && focusedCell.id === id ? focusedCell.field : null}
                tabIndexField={focusedCell && focusedCell.id === id ? focusedCell.field : null}
                rowEdits={rowEdits}
                isRowEditMode={props.editMode === 'row' && Boolean(rowEdits)}
                node={node}
                expanded={node ? isExpanded(node) : false}
                descendantCount={
                    node ? (treeFilter ? (treeFilter.filteredDescendantCount.get(id) ?? 0) : node.descendantCount) : 0
                }
                detailOpen={detailOpen}
                detailHeight={detail ? detail.height : 0}
                detailAuto={detail ? detail.auto : false}
                viewportWidth={viewport.width}
                isSkeleton={isSkeleton}
                isDragging={Boolean(dragState && dragState.type === 'row' && dragState.id === id)}
                pinnedPosition={extra.pinnedPosition || null}
                isFirstVisible={indexInPage === 0}
                isLastVisible={extra.isLast ?? indexInPage === pageIds.length - 1}
                handlers={handlers}
                getDetailPanelContent={props.getDetailPanelContent}
                getCellClassName={props.getCellClassName}
                getRowClassName={props.getRowClassName}
                localeText={localeText}
                apiRef={apiRef}
                themeClass={themeClass}
                hasColSpan={hasColSpan}
                reorderDisabled={reorderDisabled}
            />
        );
    };

    const rows = [];
    for (let i = context.firstRow; i <= context.lastRow; i += 1) rows.push(renderRow(pageIds[i], i));

    const emptyBodyHeight = pageIds.length === 0 ? Math.max(rowHeight * 2, 100) : 0;
    const bodyHeight = Math.max(rowSizes.total, props.autoHeight ? emptyBodyHeight : 0);
    const renderZoneTop = context.lastRow >= context.firstRow ? rowSizes.offset(context.firstRow) : 0;

    return (
        <div className="og-main">
            <div ref={scrollerRef} className="og-scroller" onScroll={onScroll} role="presentation">
                <ColumnHeaders firstCol={firstCol} lastCol={lastCol} scrollerRef={scrollerRef} />
                {pinned.top.length > 0 && (
                    <div
                        className="og-pinned-rows og-pinned-rows--top"
                        role="rowgroup"
                        style={{ top: headersTotalHeight, width: layout.contentWidth, height: pinnedTopHeight }}
                    >
                        {pinned.top.map((entry, index) =>
                            renderRow(entry.id, index, {
                                pinnedPosition: 'top',
                                ariaOffset: 0,
                                isLast: index === pinned.top.length - 1,
                            }),
                        )}
                    </div>
                )}
                <div
                    className="og-virtual-body"
                    role="rowgroup"
                    style={{ height: bodyHeight, width: layout.contentWidth }}
                >
                    <div className="og-render-zone" style={{ transform: `translate3d(0, ${renderZoneTop}px, 0)` }}>
                        {rows}
                    </div>
                </div>
                {pinned.bottom.length > 0 && (
                    <div
                        className="og-pinned-rows og-pinned-rows--bottom"
                        role="rowgroup"
                        style={{ width: layout.contentWidth, height: pinnedBottomHeight }}
                    >
                        {pinned.bottom.map((entry, index) =>
                            renderRow(entry.id, index, {
                                pinnedPosition: 'bottom',
                                ariaOffset: pinned.top.length + pageOffset + pageIds.length,
                                isLast: index === pinned.bottom.length - 1,
                            }),
                        )}
                    </div>
                )}
            </div>
            <GridOverlays top={headersTotalHeight + pinnedTopHeight} />
        </div>
    );
}
