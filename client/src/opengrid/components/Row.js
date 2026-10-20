import React, { memo, useMemo } from 'react';
import {
    GRID_CHECKBOX_SELECTION_FIELD,
    GRID_DETAIL_PANEL_TOGGLE_FIELD,
    GRID_REORDER_FIELD,
    GRID_TREE_DATA_GROUPING_FIELD,
} from '../constants';
import { resolveColSpan } from '../core/layout';
import { classNames } from '../core/utils';
import { ActionsCell, BooleanCell, DefaultEditCell, TreeDataGroupingCell } from './Cells';
import { Icon } from './icons';

const SKELETON_WIDTHS = [62, 80, 45, 70, 55, 88, 40, 75];

/**
 * Cells to render for one section, honouring `colSpan`. For the scrollable
 * section only cells intersecting [first, last] are returned.
 */
function sectionCells(entries, first, last, row, apiRef, hasColSpan) {
    if (!hasColSpan) {
        const cells = [];
        for (let i = first; i <= last; i += 1) cells.push({ entry: entries[i], width: entries[i].width });
        return cells;
    }
    const cells = [];
    let i = 0;
    while (i < entries.length && i <= last) {
        const entry = entries[i];
        const span = Math.min(resolveColSpan(entry.column, row, apiRef), entries.length - i);
        let width = 0;
        for (let k = 0; k < span; k += 1) width += entries[i + k].width;
        if (i + span - 1 >= first) cells.push({ entry, width, span });
        i += span;
    }
    return cells;
}

function Row(props) {
    const {
        id,
        row,
        ariaRowIndex,
        indexInPage,
        layout,
        firstCol,
        lastCol,
        height,
        autoHeight,
        isSelected,
        isSelectable,
        focusField,
        tabIndexField,
        rowEdits,
        isRowEditMode,
        node,
        expanded,
        descendantCount,
        detailOpen,
        detailHeight,
        detailAuto,
        viewportWidth,
        isSkeleton,
        isDragging,
        pinnedPosition,
        isFirstVisible,
        isLastVisible,
        handlers,
        getDetailPanelContent,
        getCellClassName,
        getRowClassName,
        localeText,
        apiRef,
        themeClass,
        hasColSpan,
        reorderDisabled,
    } = props;

    const detailContent = useMemo(() => {
        if (!getDetailPanelContent || isSkeleton || pinnedPosition) return null;
        return getDetailPanelContent({ id, row, api: apiRef.current }) ?? null;
    }, [getDetailPanelContent, id, row, isSkeleton, pinnedPosition, apiRef]);

    const cellFromEvent = (event) => {
        const cell = event.target instanceof Element ? event.target.closest('.og-cell') : null;
        return cell && event.currentTarget.contains(cell) ? cell.getAttribute('data-field') : null;
    };

    const renderCell = ({ entry, width, span }, extraStyle, pinnedClass) => {
        const { column, field } = entry;
        const edit = rowEdits ? rowEdits[field] : undefined;
        const hasFocus = focusField === field;
        let content = null;

        if (isSkeleton) {
            if (!field.startsWith('__')) {
                content = (
                    <span
                        className="og-skeleton"
                        style={{ width: `${SKELETON_WIDTHS[(indexInPage + entry.index) % SKELETON_WIDTHS.length]}%` }}
                    />
                );
            }
        } else if (field === GRID_CHECKBOX_SELECTION_FIELD) {
            content = pinnedPosition ? null : (
                <input
                    type="checkbox"
                    className="og-checkbox"
                    checked={isSelected}
                    disabled={!isSelectable}
                    tabIndex={-1}
                    aria-label={
                        isSelected ? localeText.checkboxSelectionUnselectRow : localeText.checkboxSelectionSelectRow
                    }
                    onChange={() => {}}
                    onClick={(event) => {
                        event.stopPropagation();
                        handlers.onCheckboxChange(id, event);
                    }}
                />
            );
        } else if (field === GRID_DETAIL_PANEL_TOGGLE_FIELD) {
            content =
                detailContent !== null ? (
                    <button
                        type="button"
                        className={classNames(
                            'og-icon-button og-detail-toggle',
                            detailOpen && 'og-detail-toggle--open',
                        )}
                        tabIndex={-1}
                        aria-label={detailOpen ? localeText.collapseDetailPanel : localeText.expandDetailPanel}
                        aria-expanded={detailOpen}
                        onClick={(event) => {
                            event.stopPropagation();
                            handlers.toggleDetailPanel(id);
                        }}
                        data-og-interactive
                    >
                        <Icon name="expandMore" />
                    </button>
                ) : null;
        } else if (field === GRID_REORDER_FIELD) {
            content = pinnedPosition ? null : (
                <div
                    className={classNames('og-reorder-handle', reorderDisabled && 'og-reorder-handle--disabled')}
                    onPointerDown={(event) =>
                        !reorderDisabled && handlers.startRowDrag && handlers.startRowDrag(id, event)
                    }
                    aria-label={localeText.rowReorderingHeaderName}
                    aria-disabled={reorderDisabled || undefined}
                >
                    <Icon name="dragIndicator" />
                </div>
            );
        } else if (edit) {
            const params = {
                ...handlers.getCellParams(id, field),
                value: edit.value,
                error: edit.error,
                isProcessingProps: edit.isProcessingProps,
                hasFocus,
            };
            content = column.renderEditCell ? column.renderEditCell(params) : <DefaultEditCell params={params} />;
        } else if (field === GRID_TREE_DATA_GROUPING_FIELD && !column.renderCell) {
            content = (
                <TreeDataGroupingCell
                    id={id}
                    node={node}
                    expanded={expanded}
                    descendantCount={descendantCount}
                    label={handlers.getText(id, column)}
                    column={column}
                    handlers={handlers}
                    localeText={localeText}
                />
            );
        } else if (column.renderCell) {
            content = column.renderCell(handlers.getCellParams(id, field));
        } else if (column.type === 'boolean') {
            content = <BooleanCell value={handlers.getValue(id, column)} localeText={localeText} />;
        } else if (column.type === 'actions') {
            content = (
                <ActionsCell
                    params={handlers.getCellParams(id, field)}
                    column={column}
                    localeText={localeText}
                    themeClass={themeClass}
                />
            );
        } else {
            content = <div className="og-cell-content">{handlers.getText(id, column)}</div>;
        }

        let extraClass;
        if (!isSkeleton && (column.cellClassName || getCellClassName)) {
            const params = handlers.getCellParams(id, field);
            extraClass = classNames(
                typeof column.cellClassName === 'function' ? column.cellClassName(params) : column.cellClassName,
                getCellClassName && getCellClassName(params),
            );
        }
        const editable = !isSkeleton && column.editable && handlers.isCellEditable(id, field);

        return (
            <div
                key={field}
                role="gridcell"
                className={classNames(
                    'og-cell',
                    `og-cell--align-${column.align || 'left'}`,
                    pinnedClass,
                    editable && 'og-cell--editable',
                    edit && 'og-cell--editing',
                    edit && edit.error && 'og-cell--error',
                    span > 1 && 'og-cell--spanning',
                    extraClass,
                )}
                data-field={field}
                data-colindex={entry.index}
                aria-colindex={entry.index + 1}
                aria-colspan={span > 1 ? span : undefined}
                tabIndex={tabIndexField === field ? 0 : -1}
                title={edit && typeof edit.error === 'string' ? edit.error : undefined}
                style={{ width, minWidth: width, maxWidth: width, ...extraStyle }}
            >
                {content}
            </div>
        );
    };

    const cells = [];
    const leftCount = layout.left.length;
    sectionCells(layout.left, 0, leftCount - 1, row, apiRef, hasColSpan).forEach((cell, i, list) => {
        cells.push(
            renderCell(
                cell,
                { position: 'sticky', left: cell.entry.offset, zIndex: 1 },
                classNames('og-cell--pinned-left', i === list.length - 1 && 'og-cell--last-pinned-left'),
            ),
        );
    });

    const centerCells = layout.center.length
        ? sectionCells(layout.center, firstCol, lastCol, row, apiRef, hasColSpan)
        : [];
    const spacer = centerCells.length ? centerCells[0].entry.offset : 0;
    if (spacer > 0)
        cells.push(<div key="__spacer" className="og-cell-spacer" style={{ width: spacer, minWidth: spacer }} />);
    let renderedEnd = spacer;
    centerCells.forEach((cell) => {
        cells.push(renderCell(cell, undefined, undefined));
        renderedEnd = cell.entry.offset + cell.width;
    });
    const filler = Math.max(0, layout.centerWidth - renderedEnd) + layout.fillerWidth;
    if (filler > 0)
        cells.push(<div key="__filler" className="og-cell-filler" style={{ width: filler, minWidth: filler }} />);

    sectionCells(layout.right, 0, layout.right.length - 1, row, apiRef, hasColSpan).forEach((cell, i) => {
        cells.push(
            renderCell(
                cell,
                { position: 'sticky', right: cell.entry.stickyRight, zIndex: 1 },
                classNames('og-cell--pinned-right', i === 0 && 'og-cell--first-pinned-right'),
            ),
        );
    });

    const customClass =
        !isSkeleton && getRowClassName
            ? getRowClassName({
                  id,
                  row,
                  indexRelativeToCurrentPage: indexInPage,
                  isFirstVisible,
                  isLastVisible,
              })
            : undefined;

    const rowElement = (
        <div
            role="row"
            ref={autoHeight ? handlers.getMeasureRef('rows', id) : undefined}
            className={classNames(
                'og-row',
                indexInPage % 2 === 0 ? 'og-row--even' : 'og-row--odd',
                isSelected && 'og-row--selected',
                isRowEditMode && 'og-row--editing',
                isDragging && 'og-row--dragging',
                isSkeleton && 'og-row--skeleton',
                pinnedPosition && `og-row--pinned og-row--pinned-${pinnedPosition}`,
                isLastVisible && 'og-row--last',
                detailOpen && 'og-row--detail-open',
                autoHeight && 'og-row--auto-height',
                customClass,
            )}
            data-id={id}
            data-rowindex={indexInPage}
            aria-rowindex={ariaRowIndex}
            aria-selected={isSelected}
            aria-level={node && node.depth !== undefined ? node.depth + 1 : undefined}
            aria-expanded={node && node.children && node.children.length ? Boolean(expanded) : undefined}
            style={{
                height: autoHeight ? undefined : height,
                minHeight: height,
                width: layout.contentWidth,
            }}
            onMouseDown={(event) => {
                const field = cellFromEvent(event);
                if (field) handlers.onCellMouseDown(id, field, event);
            }}
            onClick={(event) => {
                const field = cellFromEvent(event);
                if (field) handlers.onCellClick(id, field, event);
            }}
            onDoubleClick={(event) => {
                const field = cellFromEvent(event);
                if (field) handlers.onCellDoubleClick(id, field, event);
            }}
            onFocus={(event) => {
                const field = cellFromEvent(event);
                if (field) handlers.onCellFocus(id, field);
            }}
        >
            {cells}
        </div>
    );

    if (!detailOpen || detailContent === null) return rowElement;
    return (
        <>
            {rowElement}
            <div
                className="og-detail-panel"
                ref={detailAuto ? handlers.getMeasureRef('details', id) : undefined}
                style={{ width: viewportWidth || layout.contentWidth, height: detailAuto ? undefined : detailHeight }}
            >
                {detailContent}
            </div>
        </>
    );
}

export default memo(Row);
