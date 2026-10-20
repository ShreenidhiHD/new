import React, { useState } from 'react';
import { GRID_SPECIAL_FIELDS, GRID_TREE_DATA_GROUPING_FIELD } from '../constants';
import { classNames, isEmptyFilterValue } from '../core/utils';
import { FilterValueInput, getOperatorLabel } from './FilterInputs';
import { useGridContext } from './GridContext';
import { Icon } from './icons';
import { Menu, MenuItem, Popper } from './Popper';

/** Inline filter for one column (MUI X Pro "header filters"). */
export function HeaderFilterCell({ entry, style, className }) {
    const grid = useGridContext();
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [pendingOperator, setPendingOperator] = useState(null);
    const { column, field, width } = entry;
    const { localeText, props } = grid;
    const baseStyle = { width, minWidth: width, maxWidth: width, ...style };
    const filterable =
        column.filterable !== false &&
        !props.disableColumnFilter &&
        (!GRID_SPECIAL_FIELDS.has(field) || field === GRID_TREE_DATA_GROUPING_FIELD);

    if (!filterable) {
        return (
            <div
                className={classNames('og-header-filter og-header-filter--empty', className)}
                data-field={field}
                style={baseStyle}
            />
        );
    }

    const operators = column.filterOperators || [];
    const existing = grid.filterModel.items.find((item) => item.field === field);
    const item = existing || {
        id: `header-filter-${field}`,
        field,
        operator: pendingOperator || column.headerFilterOperator || grid.getDefaultOperator(field),
    };
    const operator = operators.find((op) => op.value === item.operator) || operators[0];
    const requiresValue = operator && operator.requiresFilterValue !== false;
    const isActive = Boolean(existing) && (!requiresValue || !isEmptyFilterValue(existing.value));

    const applyItem = (next) => {
        const op = operators.find((candidate) => candidate.value === next.operator);
        const needsValue = op && op.requiresFilterValue !== false;
        if (needsValue && isEmptyFilterValue(next.value)) {
            if (existing) grid.deleteFilterItem(existing);
            return;
        }
        if (props.disableMultipleColumnsFiltering) {
            grid.setFilterModel(
                { ...grid.filterModel, items: [{ ...next, id: next.id ?? `header-filter-${field}` }] },
                'headerFilter',
            );
            return;
        }
        grid.upsertFilterItem({ ...next, id: next.id ?? `header-filter-${field}` });
    };

    const selectOperator = (op) => {
        setMenuAnchor(null);
        const sameInput = operator && op.inputType === operator.inputType;
        const next = { ...item, operator: op.value, value: sameInput ? item.value : undefined };
        if (op.requiresFilterValue === false) {
            grid.upsertFilterItem({ ...next, value: undefined });
        } else if (!isEmptyFilterValue(next.value)) {
            applyItem(next);
        } else if (existing) {
            // Keep the operator choice visible while the user types a value.
            grid.upsertFilterItem(next);
        } else {
            setPendingOperator(op.value);
        }
    };

    const operatorLabel = operator ? getOperatorLabel(operator, localeText) : '';

    return (
        <div
            className={classNames('og-header-filter', isActive && 'og-header-filter--active', className)}
            data-field={field}
            style={baseStyle}
            onFocus={() => {
                const current = grid.focus;
                if (!current || current.area !== 'headerFilter' || current.field !== field) {
                    grid.setFocus({ area: 'headerFilter', field }, { moveDomFocus: false });
                }
            }}
        >
            <div className="og-header-filter-control">
                <button
                    type="button"
                    className="og-icon-button og-header-filter-operator"
                    title={`${localeText.filterPanelOperator}: ${operatorLabel}`}
                    aria-label={`${localeText.filterPanelOperator}: ${operatorLabel}`}
                    aria-haspopup="menu"
                    onClick={(event) => setMenuAnchor(menuAnchor ? null : event.currentTarget)}
                >
                    <Icon name="filterAlt" size={16} />
                </button>
                {requiresValue ? (
                    <FilterValueInput
                        key={`${item.id}-${item.operator}`}
                        item={item}
                        column={column}
                        operator={operator}
                        applyValue={applyItem}
                        apiRef={grid.apiRef}
                        localeText={localeText}
                        className="og-header-filter-input"
                        placeholder={`${operatorLabel}…`}
                    />
                ) : (
                    <span className="og-header-filter-label">{operatorLabel}</span>
                )}
                {isActive && (
                    <button
                        type="button"
                        className="og-icon-button og-header-filter-clear"
                        aria-label={localeText.headerFilterClear}
                        title={localeText.headerFilterClear}
                        onClick={() => grid.deleteFilterItem(existing)}
                    >
                        <Icon name="close" size={16} />
                    </button>
                )}
            </div>
            <Popper
                open={Boolean(menuAnchor)}
                anchorEl={menuAnchor}
                onClose={() => setMenuAnchor(null)}
                themeClass={grid.themeClass}
            >
                <Menu aria-label={localeText.filterPanelOperator}>
                    {operators.map((op) => (
                        <MenuItem
                            key={op.value}
                            selected={operator && op.value === operator.value}
                            icon={operator && op.value === operator.value ? <Icon name="check" size={18} /> : null}
                            onClick={() => selectOperator(op)}
                        >
                            {getOperatorLabel(op, localeText)}
                        </MenuItem>
                    ))}
                </Menu>
            </Popper>
        </div>
    );
}
