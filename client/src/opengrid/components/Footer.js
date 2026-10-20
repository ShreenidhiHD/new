import React from 'react';
import { useGridContext } from './GridContext';
import { Icon } from './icons';

export function GridPagination({ showFirstButton = false, showLastButton = false }) {
    const grid = useGridContext();
    const { localeText, paginationModel, paginationRowCount, pageCount, props } = grid;
    const { page, pageSize } = paginationModel;
    const count = paginationRowCount;
    const from = count === 0 ? 0 : page * pageSize + 1;
    const to = count === -1 ? (page + 1) * pageSize : Math.min(count, (page + 1) * pageSize);
    const lastPage = Number.isFinite(pageCount) ? pageCount - 1 : Infinity;
    const setPage = (next) => grid.setPaginationModel({ page: next, pageSize }, { reason: 'pagination' });
    const options = props.pageSizeOptions.map((option) =>
        typeof option === 'number' ? { value: option, label: String(option) } : option,
    );
    const hasNext = count === -1 ? grid.pageIds.length >= pageSize : page < lastPage;
    return (
        <div className="og-pagination">
            {!props.autoPageSize && options.length > 1 && (
                <label className="og-pagination-size">
                    <span>{localeText.paginationRowsPerPage}</span>
                    <select
                        value={pageSize}
                        onChange={(event) =>
                            grid.setPaginationModel(
                                { page: 0, pageSize: Number(event.target.value) },
                                { reason: 'pageSize' },
                            )
                        }
                    >
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            <span className="og-pagination-displayed">{localeText.paginationDisplayedRows({ from, to, count })}</span>
            <div className="og-pagination-actions">
                {showFirstButton && (
                    <button
                        type="button"
                        className="og-icon-button"
                        aria-label={localeText.paginationFirstPage}
                        disabled={page === 0}
                        onClick={() => setPage(0)}
                    >
                        <Icon name="firstPage" />
                    </button>
                )}
                <button
                    type="button"
                    className="og-icon-button"
                    aria-label={localeText.paginationPreviousPage}
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                >
                    <Icon name="chevronLeft" />
                </button>
                <button
                    type="button"
                    className="og-icon-button"
                    aria-label={localeText.paginationNextPage}
                    disabled={!hasNext}
                    onClick={() => setPage(page + 1)}
                >
                    <Icon name="chevronRight" />
                </button>
                {showLastButton && Number.isFinite(lastPage) && (
                    <button
                        type="button"
                        className="og-icon-button"
                        aria-label={localeText.paginationLastPage}
                        disabled={page >= lastPage}
                        onClick={() => setPage(lastPage)}
                    >
                        <Icon name="lastPage" />
                    </button>
                )}
            </div>
        </div>
    );
}

export function GridFooter() {
    const grid = useGridContext();
    const { props, localeText, selectedSet, paginationEnabled, topLevelCount, isLazy } = grid;
    const slotProps = props.slotProps || {};
    const showSelected = !props.hideFooterSelectedRowCount && selectedSet.size > 0;
    const showPagination = paginationEnabled && !props.hideFooterPagination;
    const showRowCount = !showPagination && !props.hideFooterRowCount;
    let rowCountText = null;
    if (showRowCount) {
        if (isLazy) {
            rowCountText = grid.lazyRowCountKnown ? grid.pageIds.length.toLocaleString() : null;
        } else if (topLevelCount.filtered !== topLevelCount.total) {
            rowCountText = localeText.footerTotalVisibleRows(topLevelCount.filtered, topLevelCount.total);
        } else {
            rowCountText = topLevelCount.total.toLocaleString();
        }
    }
    return (
        <div className="og-footer">
            <div className="og-footer-selected">
                {showSelected ? localeText.footerRowSelected(selectedSet.size) : null}
            </div>
            {rowCountText !== null && (
                <div className="og-footer-row-count">
                    {localeText.footerTotalRows} {rowCountText}
                </div>
            )}
            {showPagination && <GridPagination {...(slotProps.pagination || {})} />}
        </div>
    );
}
