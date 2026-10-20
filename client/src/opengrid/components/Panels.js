import React, { useRef, useState } from 'react';
import { GRID_SPECIAL_FIELDS, GRID_TREE_DATA_GROUPING_FIELD } from '../constants';
import { nextId } from '../core/utils';
import { FilterValueInput, getOperatorLabel } from './FilterInputs';
import { useGridContext } from './GridContext';
import { Icon } from './icons';
import { Menu, MenuDivider, MenuItem, Popper } from './Popper';

const isUserColumn = (column) =>
    !GRID_SPECIAL_FIELDS.has(column.field) || column.field === GRID_TREE_DATA_GROUPING_FIELD;

// ------------------------------------------------------------------ column menu
export function GridColumnMenu() {
    const grid = useGridContext();
    const { columnMenu, localeText, props, sortModel } = grid;
    if (!columnMenu) return null;
    const column = grid.columnsByField.get(columnMenu.field);
    if (!column) return null;
    const { field } = column;
    const close = () => grid.hideColumnMenu();
    const run = (fn) => () => {
        fn();
        close();
    };

    if (props.slots && props.slots.columnMenu) {
        const Custom = props.slots.columnMenu;
        return (
            <Popper
                open
                anchorEl={columnMenu.anchorEl}
                onClose={close}
                placement="bottom-end"
                themeClass={grid.themeClass}
            >
                <Custom colDef={column} hideMenu={close} open />
            </Popper>
        );
    }

    const sortItem = sortModel.find((item) => item.field === field);
    const sortable = column.sortable !== false && !props.disableColumnSorting;
    const filterable = column.filterable !== false && !props.disableColumnFilter;
    const pinnable = column.pinnable !== false && !props.disableColumnPinning;
    const pinned = grid.isColumnPinned(field);
    const visibleHideable = grid.visibleColumns.filter((c) => c.hideable !== false && isUserColumn(c));
    const hideable = column.hideable !== false && visibleHideable.length > 1;
    const groups = [];

    if (sortable) {
        const sortItems = [];
        if (sortItem) {
            sortItems.push(
                <MenuItem
                    key="unsort"
                    icon={null}
                    onClick={run(() => grid.sortColumn(field, null, sortModel.length > 1))}
                >
                    {localeText.columnMenuUnsort}
                </MenuItem>,
            );
        }
        if (!sortItem || sortItem.sort !== 'asc') {
            sortItems.push(
                <MenuItem
                    key="asc"
                    icon={<Icon name="arrowUp" size={18} />}
                    onClick={run(() => grid.sortColumn(field, 'asc', sortModel.length > 1 && Boolean(sortItem)))}
                >
                    {localeText.columnMenuSortAsc}
                </MenuItem>,
            );
        }
        if (!sortItem || sortItem.sort !== 'desc') {
            sortItems.push(
                <MenuItem
                    key="desc"
                    icon={<Icon name="arrowDown" size={18} />}
                    onClick={run(() => grid.sortColumn(field, 'desc', sortModel.length > 1 && Boolean(sortItem)))}
                >
                    {localeText.columnMenuSortDesc}
                </MenuItem>,
            );
        }
        groups.push(sortItems);
    }
    if (filterable) {
        groups.push([
            <MenuItem
                key="filter"
                icon={<Icon name="filter" size={18} />}
                onClick={() => grid.showPreferences('filters', { anchorEl: columnMenu.anchorEl, field })}
            >
                {localeText.columnMenuFilter}
            </MenuItem>,
        ]);
    }
    if (pinnable) {
        const pinItems = [];
        if (pinned !== 'left') {
            pinItems.push(
                <MenuItem
                    key="pin-left"
                    icon={<Icon name="pin" size={18} style={{ transform: 'rotate(30deg)' }} />}
                    onClick={run(() => grid.pinColumn(field, 'left'))}
                >
                    {localeText.pinToLeft}
                </MenuItem>,
            );
        }
        if (pinned !== 'right') {
            pinItems.push(
                <MenuItem
                    key="pin-right"
                    icon={<Icon name="pin" size={18} style={{ transform: 'rotate(-30deg)' }} />}
                    onClick={run(() => grid.pinColumn(field, 'right'))}
                >
                    {localeText.pinToRight}
                </MenuItem>,
            );
        }
        if (pinned) {
            pinItems.push(
                <MenuItem key="unpin" icon={null} onClick={run(() => grid.unpinColumn(field))}>
                    {localeText.unpin}
                </MenuItem>,
            );
        }
        groups.push(pinItems);
    }
    const columnItems = [];
    if (hideable) {
        columnItems.push(
            <MenuItem
                key="hide"
                icon={<Icon name="visibilityOff" size={18} />}
                onClick={run(() => grid.setColumnVisibility(field, false))}
            >
                {localeText.columnMenuHideColumn}
            </MenuItem>,
        );
    }
    if (!props.disableColumnSelector) {
        columnItems.push(
            <MenuItem
                key="manage"
                icon={<Icon name="viewWeek" size={18} />}
                onClick={() => grid.showPreferences('columns', { anchorEl: columnMenu.anchorEl })}
            >
                {localeText.columnMenuManageColumns}
            </MenuItem>,
        );
    }
    if (column.resizable !== false && !props.disableColumnResize) {
        columnItems.push(
            <MenuItem
                key="autosize"
                icon={<Icon name="widthWide" size={18} />}
                onClick={run(() => grid.autosizeColumns({ columns: [field] }))}
            >
                {localeText.columnMenuAutosize}
            </MenuItem>,
        );
    }
    if (columnItems.length) groups.push(columnItems);

    const content = [];
    groups
        .filter((group) => group.length)
        .forEach((group, index) => {
            if (index > 0) content.push(<MenuDivider key={`divider-${index}`} />);
            content.push(...group);
        });

    return (
        <Popper open anchorEl={columnMenu.anchorEl} onClose={close} placement="bottom-end" themeClass={grid.themeClass}>
            <Menu className="og-column-menu" aria-label={`${column.headerName} ${localeText.columnMenuLabel}`}>
                {content}
            </Menu>
        </Popper>
    );
}

// ----------------------------------------------------------------- columns panel
function ColumnsPanel() {
    const grid = useGridContext();
    const { localeText, columnVisibilityModel } = grid;
    const [search, setSearch] = useState('');
    const initialModelRef = useRef(columnVisibilityModel);
    const columns = grid.orderedColumns.filter(isUserColumn);
    const query = search.trim().toLowerCase();
    const shown = query
        ? columns.filter((column) =>
              String(column.headerName || column.field)
                  .toLowerCase()
                  .includes(query),
          )
        : columns;
    const hideable = columns.filter((column) => column.hideable !== false);
    const visibleCount = hideable.filter((column) => columnVisibilityModel[column.field] !== false).length;
    const allVisible = visibleCount === hideable.length;
    const initialModel = initialModelRef.current;
    const isInitial = columns.every(
        (column) => (columnVisibilityModel[column.field] !== false) === (initialModel[column.field] !== false),
    );

    const toggleAll = () => {
        const next = { ...columnVisibilityModel };
        hideable.forEach((column) => {
            next[column.field] = !allVisible;
        });
        grid.setColumnVisibilityModel(next, { reason: 'toggleAll' });
    };

    return (
        <div className="og-panel og-columns-panel" role="dialog" aria-label={localeText.columnMenuManageColumns}>
            <div className="og-panel-header">
                <div className="og-panel-search">
                    <Icon name="search" size={18} />
                    <input
                        type="search"
                        value={search}
                        placeholder={localeText.columnsManagementSearchTitle}
                        aria-label={localeText.columnsManagementSearchTitle}
                        onChange={(event) => setSearch(event.target.value)}
                        autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                    />
                </div>
            </div>
            <div className="og-panel-content og-columns-list">
                {shown.length === 0 && <div className="og-panel-empty">{localeText.columnsManagementNoColumns}</div>}
                {shown.map((column) => {
                    const visible = columnVisibilityModel[column.field] !== false;
                    return (
                        <label key={column.field} className="og-switch-row">
                            <input
                                type="checkbox"
                                className="og-checkbox"
                                checked={visible}
                                disabled={column.hideable === false}
                                onChange={() => grid.setColumnVisibility(column.field, !visible)}
                            />
                            <span>{column.headerName || column.field}</span>
                        </label>
                    );
                })}
            </div>
            <div className="og-panel-footer">
                <label className="og-switch-row">
                    <input
                        type="checkbox"
                        className="og-checkbox"
                        checked={allVisible}
                        ref={(element) => {
                            if (element) element.indeterminate = !allVisible && visibleCount > 0;
                        }}
                        onChange={toggleAll}
                    />
                    <span>{localeText.columnsManagementShowHideAllText}</span>
                </label>
                <button
                    type="button"
                    className="og-button og-button--text"
                    disabled={isInitial}
                    onClick={() => grid.setColumnVisibilityModel(initialModel, { reason: 'reset' })}
                >
                    {localeText.columnsManagementReset}
                </button>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------ filter panel
function FilterRow({ item, index, filterableColumns, onlyItem }) {
    const grid = useGridContext();
    const { localeText, filterModel } = grid;
    const column = grid.columnsByField.get(item.field);
    const operators = (column && column.filterOperators) || [];
    const operator = operators.find((op) => op.value === item.operator) || operators[0];

    const update = (next) => grid.upsertFilterItem(next);

    const changeField = (field) => {
        const nextColumn = grid.columnsByField.get(field);
        const nextOperators = (nextColumn && nextColumn.filterOperators) || [];
        const keep = nextOperators.find((op) => op.value === item.operator);
        const nextOperator = keep || nextOperators[0];
        const sameInput = keep && operator && keep.inputType === operator.inputType && nextColumn.type === column.type;
        update({
            ...item,
            field,
            operator: nextOperator ? nextOperator.value : item.operator,
            value: sameInput ? item.value : undefined,
        });
    };

    const changeOperator = (value) => {
        const next = operators.find((op) => op.value === value);
        const sameInput = next && operator && next.inputType === operator.inputType;
        update({ ...item, operator: value, value: sameInput ? item.value : undefined });
    };

    return (
        <div className="og-filter-row">
            <button
                type="button"
                className="og-icon-button og-filter-row-delete"
                aria-label={localeText.filterPanelDeleteIconLabel}
                title={localeText.filterPanelDeleteIconLabel}
                onClick={() => {
                    grid.deleteFilterItem(item);
                    if (onlyItem) grid.hidePreferences();
                }}
            >
                <Icon name="close" size={18} />
            </button>
            <label className="og-field og-filter-logic">
                <span className="og-field-label">{index === 0 ? '' : localeText.filterPanelLogicOperator}</span>
                {index > 0 && (
                    <select
                        value={filterModel.logicOperator || 'and'}
                        disabled={index > 1}
                        onChange={(event) => grid.setFilterLogicOperator(event.target.value)}
                    >
                        <option value="and">{localeText.filterPanelOperatorAnd}</option>
                        <option value="or">{localeText.filterPanelOperatorOr}</option>
                    </select>
                )}
            </label>
            <label className="og-field og-filter-column">
                <span className="og-field-label">{localeText.filterPanelColumns}</span>
                <select value={item.field} onChange={(event) => changeField(event.target.value)}>
                    {filterableColumns.map((c) => (
                        <option key={c.field} value={c.field}>
                            {c.headerName || c.field}
                        </option>
                    ))}
                </select>
            </label>
            <label className="og-field og-filter-operator">
                <span className="og-field-label">{localeText.filterPanelOperator}</span>
                <select value={operator ? operator.value : ''} onChange={(event) => changeOperator(event.target.value)}>
                    {operators.map((op) => (
                        <option key={op.value} value={op.value}>
                            {getOperatorLabel(op, localeText)}
                        </option>
                    ))}
                </select>
            </label>
            <div className="og-field og-filter-value">
                <span className="og-field-label">
                    {operator && operator.requiresFilterValue !== false ? localeText.filterPanelInputLabel : ''}
                </span>
                <FilterValueInput
                    key={`${item.id}-${item.field}-${item.operator}`}
                    item={item}
                    column={column}
                    operator={operator}
                    applyValue={update}
                    apiRef={grid.apiRef}
                    localeText={localeText}
                    autoFocus={index === filterModel.items.length - 1}
                />
            </div>
        </div>
    );
}

function FilterPanel() {
    const grid = useGridContext();
    const { localeText, filterModel, props } = grid;
    const filterableColumns = grid.orderedColumns.filter(
        (column) => column.filterable !== false && isUserColumn(column),
    );
    const items = filterModel.items.filter((item) => grid.columnsByField.has(item.field));

    const addFilter = () => {
        const used = new Set(items.map((item) => item.field));
        const column = filterableColumns.find((c) => !used.has(c.field)) || filterableColumns[0];
        if (!column) return;
        grid.upsertFilterItem({
            id: nextId('filter'),
            field: column.field,
            operator: grid.getDefaultOperator(column.field),
        });
    };

    return (
        <div className="og-panel og-filter-panel" role="dialog" aria-label={localeText.toolbarFilters}>
            <div className="og-panel-content og-filter-rows">
                {items.map((item, index) => (
                    <FilterRow
                        key={item.id ?? index}
                        item={item}
                        index={index}
                        filterableColumns={filterableColumns}
                        onlyItem={items.length === 1}
                    />
                ))}
            </div>
            <div className="og-panel-footer">
                {!props.disableMultipleColumnsFiltering ? (
                    <button type="button" className="og-button og-button--text" onClick={addFilter}>
                        <Icon name="add" size={18} /> {localeText.filterPanelAddFilter}
                    </button>
                ) : (
                    <span />
                )}
                {items.length > 0 && (
                    <button
                        type="button"
                        className="og-button og-button--text"
                        onClick={() => {
                            grid.setFilterModel({ ...filterModel, items: [] }, 'removeAllFilterItems');
                            grid.hidePreferences();
                        }}
                    >
                        <Icon name="delete" size={18} /> {localeText.filterPanelRemoveAll}
                    </button>
                )}
            </div>
        </div>
    );
}

export function GridPanels() {
    const grid = useGridContext();
    const { panel } = grid;
    if (!panel) return null;
    const anchorEl =
        (panel.anchorEl && panel.anchorEl.isConnected && panel.anchorEl) ||
        (grid.rootRef.current && grid.rootRef.current.querySelector('.og-column-headers'));
    return (
        <Popper
            open
            anchorEl={anchorEl}
            onClose={() => grid.hidePreferences()}
            placement="bottom-start"
            themeClass={grid.themeClass}
        >
            {panel.type === 'filters' ? <FilterPanel /> : <ColumnsPanel />}
        </Popper>
    );
}
