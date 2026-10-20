import React from 'react';
import {
    GRID_CHECKBOX_SELECTION_FIELD,
    GRID_DETAIL_PANEL_TOGGLE_FIELD,
    GRID_REORDER_FIELD,
    GRID_SPECIAL_FIELDS,
} from '../constants';
import { isEmptyFilterValue } from '../core/utils';
import { classNames } from '../core/utils';
import { useLatest } from '../hooks/useModel';
import { useGridContext } from './GridContext';
import { HeaderFilterCell } from './HeaderFilterCell';
import { Icon } from './icons';

const DRAG_THRESHOLD = 4;
const AUTO_SCROLL_ZONE = 48;

/** Swallows the click the browser fires right after a drag ends. */
function suppressNextClick() {
    const swallow = (event) => {
        event.stopPropagation();
        event.preventDefault();
        window.removeEventListener('click', swallow, true);
    };
    window.addEventListener('click', swallow, true);
    setTimeout(() => window.removeEventListener('click', swallow, true), 300);
}

function stickyStyle(entryOrCell, section) {
    if (section === 'left') return { position: 'sticky', left: entryOrCell.offset, zIndex: 2 };
    if (section === 'right') return { position: 'sticky', right: entryOrCell.stickyRight, zIndex: 2 };
    return undefined;
}

function pinnedClass(section, isEdge) {
    if (section === 'left') return classNames('og-pinned-left', isEdge && 'og-last-pinned-left');
    if (section === 'right') return classNames('og-pinned-right', isEdge && 'og-first-pinned-right');
    return undefined;
}

/** Lays out one header row: [left pinned][spacer][visible center][filler][right pinned]. */
function renderSections(layout, firstCol, lastCol, renderEntry) {
    const nodes = [];
    layout.left.forEach((entry, i) => nodes.push(renderEntry(entry, 'left', i === layout.left.length - 1)));
    const spacer = layout.center[firstCol] ? layout.center[firstCol].offset : 0;
    if (spacer > 0)
        nodes.push(<div key="__spacer" className="og-cell-spacer" style={{ width: spacer, minWidth: spacer }} />);
    let end = spacer;
    for (let i = firstCol; i <= lastCol; i += 1) {
        const entry = layout.center[i];
        nodes.push(renderEntry(entry, 'center', false));
        end = entry.offset + entry.width;
    }
    const filler = Math.max(0, layout.centerWidth - end) + layout.fillerWidth;
    if (filler > 0)
        nodes.push(<div key="__filler" className="og-header-filler" style={{ width: filler, minWidth: filler }} />);
    layout.right.forEach((entry, i) => nodes.push(renderEntry(entry, 'right', i === 0)));
    return nodes;
}

function renderGroupSections(row, firstCol, lastCol, renderCell) {
    const nodes = [];
    row.left.forEach((cell, i) => nodes.push(renderCell(cell, 'left', i === row.left.length - 1)));
    const visible = row.center.filter((cell) => cell.lastIndex >= firstCol && cell.firstIndex <= lastCol);
    const spacer = visible.length ? visible[0].offset : 0;
    if (spacer > 0)
        nodes.push(<div key="__spacer" className="og-cell-spacer" style={{ width: spacer, minWidth: spacer }} />);
    let end = spacer;
    visible.forEach((cell) => {
        nodes.push(renderCell(cell, 'center', false));
        end = cell.offset + cell.width;
    });
    return { nodes, end, right: row.right.map((cell, i) => renderCell(cell, 'right', i === 0)) };
}

export function ColumnHeaders({ firstCol, lastCol, scrollerRef }) {
    const grid = useGridContext();
    const gridRef = useLatest(grid);
    const {
        layout,
        groupRows,
        headerHeight,
        groupHeaderHeight,
        headerFilterHeight,
        props,
        localeText,
        sortModel,
        filterModel,
        dragState,
        focus,
        columnMenu,
        headersTotalHeight,
    } = grid;

    const headerTabIndexField =
        focus && focus.area === 'header' ? focus.field : !focus && layout.all[0] ? layout.all[0].field : null;

    // ------------------------------------------------------------ resizing
    const startResize = (event, entry) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startWidth = entry.width;
        const sign = entry.section === 'right' ? -1 : 1;
        let frame = 0;
        let latestWidth = startWidth;
        grid.handlers.setDragState({ type: 'resize', field: entry.field });
        document.body.classList.add('og-cursor-col-resize');
        const onMove = (moveEvent) => {
            latestWidth = startWidth + sign * (moveEvent.clientX - startX);
            if (!frame) {
                frame = requestAnimationFrame(() => {
                    frame = 0;
                    gridRef.current.setColumnWidth(entry.field, latestWidth);
                    if (gridRef.current.props.onColumnResize) {
                        gridRef.current.props.onColumnResize({ colDef: entry.column, width: latestWidth });
                    }
                });
            }
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            cancelAnimationFrame(frame);
            document.body.classList.remove('og-cursor-col-resize');
            gridRef.current.setColumnWidth(entry.field, latestWidth);
            gridRef.current.handlers.setDragState(null);
            suppressNextClick();
            const finalEntry = gridRef.current.layout.byField.get(entry.field);
            if (gridRef.current.props.onColumnWidthChange) {
                gridRef.current.props.onColumnWidthChange({
                    colDef: entry.column,
                    width: finalEntry ? finalEntry.width : latestWidth,
                });
            }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    // ---------------------------------------------------------- reordering
    const startReorder = (event, entry) => {
        if (event.button !== 0 || props.disableColumnReorder || entry.column.disableReorder) return;
        if (event.target instanceof Element && event.target.closest('button, input, .og-column-separator')) return;
        const startX = event.clientX;
        const startY = event.clientY;
        let dragging = false;
        let autoScrollFrame = 0;
        let lastClientX = startX;

        const visualLeft = (current, layoutNow) => {
            const scroller = scrollerRef.current;
            const scrollLeft = scroller ? scroller.scrollLeft : 0;
            const viewportWidth = gridRef.current.viewport.width || layoutNow.contentWidth;
            if (current.section === 'left') return current.offset;
            if (current.section === 'right') return viewportWidth - layoutNow.rightWidth + current.offset;
            return layoutNow.leftWidth + current.offset - scrollLeft;
        };

        const reorderAt = (clientX) => {
            const scroller = scrollerRef.current;
            if (!scroller) return;
            const g = gridRef.current;
            const layoutNow = g.layout;
            const dragged = layoutNow.byField.get(entry.field);
            if (!dragged) return;
            const section = layoutNow[dragged.section];
            const x = clientX - scroller.getBoundingClientRect().left;
            const i = dragged.sectionIndex;
            let target = null;
            for (let j = 0; j < section.length; j += 1) {
                const candidate = section[j];
                const left = visualLeft(candidate, layoutNow);
                if (x >= left && x < left + candidate.width) {
                    target = candidate;
                    break;
                }
            }
            if (!target || target.field === dragged.field || target.column.disableReorder) return;
            const j = target.sectionIndex;
            const targetLeft = visualLeft(target, layoutNow);
            // Only swap once the pointer would still be over the dragged column after
            // the move, which avoids flickering between columns of different widths.
            const shouldMove = j > i ? x >= targetLeft + target.width - dragged.width : x <= targetLeft + dragged.width;
            if (!shouldMove) return;
            const fields = g.orderedColumns.map((column) => column.field);
            g.setColumnIndex(dragged.field, fields.indexOf(target.field));
        };

        const autoScroll = () => {
            autoScrollFrame = 0;
            const scroller = scrollerRef.current;
            const g = gridRef.current;
            if (!scroller || !dragging || entry.section !== 'center') return;
            const rect = scroller.getBoundingClientRect();
            const leftEdge = rect.left + g.layout.leftWidth;
            const rightEdge = rect.left + (g.viewport.width || rect.width) - g.layout.rightWidth;
            let delta = 0;
            if (lastClientX < leftEdge + AUTO_SCROLL_ZONE)
                delta = -Math.ceil((leftEdge + AUTO_SCROLL_ZONE - lastClientX) / 4);
            else if (lastClientX > rightEdge - AUTO_SCROLL_ZONE)
                delta = Math.ceil((lastClientX - (rightEdge - AUTO_SCROLL_ZONE)) / 4);
            if (delta !== 0) {
                scroller.scrollLeft += delta;
                reorderAt(lastClientX);
                autoScrollFrame = requestAnimationFrame(autoScroll);
            }
        };

        const onMove = (moveEvent) => {
            lastClientX = moveEvent.clientX;
            if (!dragging) {
                if (
                    Math.abs(moveEvent.clientX - startX) < DRAG_THRESHOLD &&
                    Math.abs(moveEvent.clientY - startY) < DRAG_THRESHOLD
                )
                    return;
                dragging = true;
                gridRef.current.handlers.setDragState({ type: 'column', field: entry.field });
                document.body.classList.add('og-cursor-grabbing');
            }
            moveEvent.preventDefault();
            reorderAt(moveEvent.clientX);
            if (!autoScrollFrame) autoScrollFrame = requestAnimationFrame(autoScroll);
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            cancelAnimationFrame(autoScrollFrame);
            if (dragging) {
                document.body.classList.remove('og-cursor-grabbing');
                gridRef.current.handlers.setDragState(null);
                suppressNextClick();
            }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    // ------------------------------------------------------------ renderers
    const activeFilterCount = (field) =>
        filterModel.items.filter((item) => {
            if (item.field !== field) return false;
            const column = grid.columnsByField.get(field);
            const operator = column && (column.filterOperators || []).find((op) => op.value === item.operator);
            return operator && (operator.requiresFilterValue === false || !isEmptyFilterValue(item.value));
        }).length;

    const renderHeaderCell = (entry, section, isEdge) => {
        const { column, field, width } = entry;
        const sortIndex = sortModel.findIndex((item) => item.field === field);
        const sortItem = sortIndex === -1 ? null : sortModel[sortIndex];
        const sortable = column.sortable !== false && !props.disableColumnSorting && !GRID_SPECIAL_FIELDS.has(field);
        const filterCount = props.disableColumnFilter ? 0 : activeFilterCount(field);
        const showMenu = !props.disableColumnMenu && !column.disableColumnMenu;
        const resizable = column.resizable !== false && !props.disableColumnResize;
        const isDragging = dragState && dragState.type === 'column' && dragState.field === field;
        const menuOpen = columnMenu && columnMenu.field === field;
        const align = column.headerAlign || column.align || 'left';
        const params = { field, colDef: column, api: grid.api };

        let title;
        if (field === GRID_CHECKBOX_SELECTION_FIELD) {
            const state = grid.getSelectAllState();
            const disabled = props.disableMultipleRowSelection;
            title = disabled ? null : (
                <input
                    type="checkbox"
                    className="og-checkbox"
                    tabIndex={-1}
                    checked={state === 'all'}
                    ref={(element) => {
                        if (element) element.indeterminate = state === 'some';
                    }}
                    aria-label={
                        state === 'all'
                            ? localeText.checkboxSelectionUnselectAllRows
                            : localeText.checkboxSelectionSelectAllRows
                    }
                    onChange={() => grid.toggleSelectAll()}
                    onClick={(event) => event.stopPropagation()}
                />
            );
        } else if (field === GRID_DETAIL_PANEL_TOGGLE_FIELD || field === GRID_REORDER_FIELD) {
            title = null;
        } else if (column.renderHeader) {
            title = column.renderHeader(params);
        } else {
            title = (
                <div className="og-column-header-title" title={column.description || column.headerName}>
                    {column.headerName}
                </div>
            );
        }

        return (
            <div
                key={field}
                role="columnheader"
                className={classNames(
                    'og-column-header',
                    `og-column-header--align-${align}`,
                    sortable && 'og-column-header--sortable',
                    sortItem && 'og-column-header--sorted',
                    filterCount > 0 && 'og-column-header--filtered',
                    isDragging && 'og-column-header--dragging',
                    menuOpen && 'og-column-header--menu-open',
                    !props.disableColumnReorder && !column.disableReorder && 'og-column-header--draggable',
                    pinnedClass(section, isEdge),
                    typeof column.headerClassName === 'function'
                        ? column.headerClassName(params)
                        : column.headerClassName,
                )}
                data-field={field}
                aria-colindex={entry.index + 1}
                aria-sort={sortItem ? (sortItem.sort === 'asc' ? 'ascending' : 'descending') : 'none'}
                aria-label={column.headerName}
                tabIndex={headerTabIndexField === field ? 0 : -1}
                style={{ width, minWidth: width, maxWidth: width, ...stickyStyle(entry, section) }}
                onPointerDown={(event) => startReorder(event, entry)}
                onFocus={(event) => {
                    if (event.target !== event.currentTarget) return;
                    const current = grid.focus;
                    if (!current || current.area !== 'header' || current.field !== field) {
                        grid.setFocus({ area: 'header', field }, { moveDomFocus: false });
                    }
                }}
                onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest('button, .og-column-separator')) return;
                    grid.handleColumnHeaderClick(field, event);
                }}
            >
                <div className="og-column-header-inner">
                    <div className="og-column-header-title-container">
                        {title}
                        {filterCount > 0 && (
                            <button
                                type="button"
                                className="og-icon-button og-column-header-filter-icon"
                                tabIndex={-1}
                                aria-label={localeText.columnHeaderFiltersLabel}
                                title={localeText.columnHeaderFiltersTooltipActive(filterCount)}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    grid.showPreferences('filters', {
                                        anchorEl: event.currentTarget.closest('.og-column-header'),
                                        field,
                                    });
                                }}
                            >
                                <Icon name="filterAlt" size={18} />
                            </button>
                        )}
                        {sortable && (
                            <span
                                className={classNames('og-sort-icon', sortItem && 'og-sort-icon--active')}
                                aria-hidden="true"
                            >
                                <Icon name={sortItem && sortItem.sort === 'desc' ? 'arrowDown' : 'arrowUp'} size={18} />
                                {sortItem && sortModel.length > 1 && (
                                    <span className="og-sort-index">{sortIndex + 1}</span>
                                )}
                            </span>
                        )}
                    </div>
                    {showMenu && (
                        <button
                            type="button"
                            className="og-icon-button og-column-header-menu-button"
                            tabIndex={-1}
                            aria-label={localeText.columnMenuLabel}
                            aria-haspopup="menu"
                            aria-expanded={Boolean(menuOpen)}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (menuOpen) grid.hideColumnMenu();
                                else grid.showColumnMenu(field, event.currentTarget.closest('.og-column-header'));
                            }}
                        >
                            <Icon name="moreVert" size={18} />
                        </button>
                    )}
                </div>
                {resizable ? (
                    <div
                        className={classNames(
                            'og-column-separator og-column-separator--resizable',
                            section === 'right' && 'og-column-separator--side-left',
                            dragState &&
                                dragState.type === 'resize' &&
                                dragState.field === field &&
                                'og-column-separator--resizing',
                        )}
                        onPointerDown={(event) => startResize(event, entry)}
                        onDoubleClick={(event) => {
                            event.stopPropagation();
                            grid.autosizeColumns({ columns: [field] });
                        }}
                        role="separator"
                        aria-orientation="vertical"
                    />
                ) : (
                    <div
                        className={classNames(
                            'og-column-separator',
                            section === 'right' && 'og-column-separator--side-left',
                        )}
                    />
                )}
            </div>
        );
    };

    const renderGroupCell = (cell, section, isEdge) => {
        const { group } = cell;
        const key = `${cell.key || 'filler'}-${cell.fields[0]}`;
        const style = { width: cell.width, minWidth: cell.width, maxWidth: cell.width, ...stickyStyle(cell, section) };
        if (!group) {
            return (
                <div
                    key={key}
                    className={classNames(
                        'og-column-group-header og-column-group-header--filler',
                        pinnedClass(section, isEdge),
                    )}
                    style={style}
                />
            );
        }
        const align = group.headerAlign || 'left';
        return (
            <div
                key={key}
                role="columnheader"
                aria-colspan={cell.fields.length}
                className={classNames(
                    'og-column-group-header',
                    `og-column-group-header--align-${align}`,
                    pinnedClass(section, isEdge),
                    group.headerClassName,
                )}
                title={group.description || group.headerName || group.groupId}
                style={style}
            >
                {group.renderHeaderGroup ? (
                    group.renderHeaderGroup({ groupId: group.groupId, headerName: group.headerName, depth: cell.depth })
                ) : (
                    <div className="og-column-header-title">{group.headerName ?? group.groupId}</div>
                )}
            </div>
        );
    };

    const rowStyle = (height) => ({ height, minHeight: height, width: layout.contentWidth });

    return (
        <div
            className="og-column-headers"
            role="rowgroup"
            style={{ height: headersTotalHeight, width: layout.contentWidth }}
        >
            {groupRows.map((row, level) => {
                const { nodes, end, right } = renderGroupSections(row, firstCol, lastCol, renderGroupCell);
                const filler = Math.max(0, layout.centerWidth - end) + layout.fillerWidth;
                return (
                    <div
                        key={`group-${level}`}
                        role="row"
                        aria-rowindex={level + 1}
                        className="og-header-row og-header-row--group"
                        style={rowStyle(groupHeaderHeight)}
                    >
                        {nodes}
                        {filler > 0 && <div className="og-header-filler" style={{ width: filler, minWidth: filler }} />}
                        {right}
                    </div>
                );
            })}
            <div
                role="row"
                aria-rowindex={groupRows.length + 1}
                className="og-header-row"
                style={rowStyle(headerHeight)}
            >
                {renderSections(layout, firstCol, lastCol, renderHeaderCell)}
            </div>
            {props.headerFilters && (
                <div
                    role="row"
                    aria-rowindex={groupRows.length + 2}
                    className="og-header-row og-header-row--filters"
                    style={rowStyle(headerFilterHeight)}
                >
                    {renderSections(layout, firstCol, lastCol, (entry, section, isEdge) => (
                        <HeaderFilterCell
                            key={entry.field}
                            entry={entry}
                            style={stickyStyle(entry, section)}
                            className={pinnedClass(section, isEdge)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
