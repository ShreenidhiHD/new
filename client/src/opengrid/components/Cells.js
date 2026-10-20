import React, { useEffect, useRef, useState } from 'react';
import { getOptionValue, getValueOptions } from '../core/filterOperators';
import { toDateInputValue } from '../core/utils';
import { Icon } from './icons';
import { Menu, MenuItem, Popper } from './Popper';

export function BooleanCell({ value, localeText }) {
    if (value === null || value === undefined) return null;
    return value ? (
        <Icon name="check" className="og-boolean-icon og-boolean-icon--true" title={localeText.booleanCellTrueLabel} />
    ) : (
        <Icon
            name="close"
            className="og-boolean-icon og-boolean-icon--false"
            title={localeText.booleanCellFalseLabel}
        />
    );
}

/**
 * Button used inside `getActions` of an `actions` column. With `showInMenu`
 * it is rendered as an item of the overflow ("more") menu instead.
 */
export function GridActionsCellItem({
    label,
    icon,
    showInMenu,
    onClick,
    disabled,
    className,
    closeMenuOnClick,
    ...other
}) {
    return (
        <button
            type="button"
            className={`og-icon-button og-action-button ${className || ''}`}
            aria-label={label}
            title={label}
            onClick={onClick}
            disabled={disabled}
            data-og-interactive
            {...other}
        >
            {icon}
        </button>
    );
}

export function ActionsCell({ params, column, localeText, themeClass }) {
    const [menuAnchor, setMenuAnchor] = useState(null);
    const actions = (column.getActions ? column.getActions(params) : []).filter(Boolean);
    const inline = actions.filter((action) => !action.props.showInMenu);
    const inMenu = actions.filter((action) => action.props.showInMenu);
    return (
        <div className="og-actions-cell">
            {inline.map((action, index) => React.cloneElement(action, { key: action.key ?? index }))}
            {inMenu.length > 0 && (
                <button
                    type="button"
                    className="og-icon-button"
                    aria-label={localeText.actionsCellMore}
                    aria-haspopup="menu"
                    aria-expanded={Boolean(menuAnchor)}
                    onClick={(event) => {
                        event.stopPropagation();
                        setMenuAnchor(menuAnchor ? null : event.currentTarget);
                    }}
                    data-og-interactive
                >
                    <Icon name="moreVert" />
                </button>
            )}
            <Popper
                open={Boolean(menuAnchor)}
                anchorEl={menuAnchor}
                onClose={() => setMenuAnchor(null)}
                placement="bottom-end"
                themeClass={themeClass}
            >
                <Menu>
                    {inMenu.map((action, index) => {
                        const { label, icon, onClick, disabled, closeMenuOnClick = true } = action.props;
                        return (
                            <MenuItem
                                key={action.key ?? index}
                                icon={icon}
                                disabled={disabled}
                                onClick={(event) => {
                                    if (onClick) onClick(event);
                                    if (closeMenuOnClick) setMenuAnchor(null);
                                }}
                            >
                                {label}
                            </MenuItem>
                        );
                    })}
                </Menu>
            </Popper>
        </div>
    );
}

export function TreeDataGroupingCell({ id, node, expanded, descendantCount, label, column, handlers, localeText }) {
    const hasChildren = node && node.children && node.children.length > 0;
    return (
        <div className="og-tree-cell" style={{ marginLeft: (node ? node.depth : 0) * 16 }}>
            {hasChildren ? (
                <button
                    type="button"
                    className="og-icon-button og-tree-toggle"
                    tabIndex={-1}
                    aria-label={expanded ? localeText.treeDataCollapse : localeText.treeDataExpand}
                    onClick={(event) => {
                        event.stopPropagation();
                        handlers.toggleRowExpansion(id);
                    }}
                    data-og-interactive
                >
                    <Icon name={expanded ? 'keyboardArrowDown' : 'keyboardArrowRight'} />
                </button>
            ) : (
                <span className="og-tree-spacer" />
            )}
            <span className="og-tree-label">
                {label}
                {hasChildren && !column.hideDescendantCount ? ` (${descendantCount})` : ''}
            </span>
        </div>
    );
}

function useAutoFocus(hasFocus) {
    const ref = useRef(null);
    useEffect(() => {
        if (hasFocus && ref.current && document.activeElement !== ref.current) {
            ref.current.focus({ preventScroll: true });
            if (typeof ref.current.select === 'function' && ref.current.type !== 'date') {
                try {
                    const length = String(ref.current.value).length;
                    ref.current.setSelectionRange(length, length);
                } catch (error) {
                    // Some input types (number, date) do not support selection ranges.
                }
            }
        }
    }, [hasFocus]);
    return ref;
}

const toText = (value) => (value === null || value === undefined || Number.isNaN(value) ? '' : String(value));

function TextEditInput({ params, numeric }) {
    const { id, field, value, api, hasFocus } = params;
    const [text, setText] = useState(() => toText(value));
    const ref = useAutoFocus(hasFocus);
    const localChange = useRef(false);
    useEffect(() => {
        // Our own keystrokes echo back parsed (e.g. "1." -> 1): keep the text.
        // Any other change (e.g. a cross-field update) resyncs it.
        if (localChange.current) {
            localChange.current = false;
            return;
        }
        setText(toText(value));
    }, [value]);
    return (
        <input
            ref={ref}
            className="og-edit-input"
            type="text"
            inputMode={numeric ? 'decimal' : undefined}
            value={text}
            onChange={(event) => {
                localChange.current = true;
                setText(event.target.value);
                api.setEditCellValue({ id, field, value: event.target.value });
            }}
        />
    );
}

function DateEditInput({ params, withTime }) {
    const { id, field, value, api, hasFocus } = params;
    const ref = useAutoFocus(hasFocus);
    return (
        <input
            ref={ref}
            className="og-edit-input"
            type={withTime ? 'datetime-local' : 'date'}
            value={toDateInputValue(value, withTime)}
            onChange={(event) => api.setEditCellValue({ id, field, value: event.target.value })}
        />
    );
}

function BooleanEditInput({ params }) {
    const { id, field, value, api, hasFocus } = params;
    const ref = useAutoFocus(hasFocus);
    return (
        <input
            ref={ref}
            className="og-edit-checkbox"
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => api.setEditCellValue({ id, field, value: event.target.checked })}
        />
    );
}

function SingleSelectEditInput({ params }) {
    const { id, field, value, api, hasFocus, colDef, row } = params;
    const ref = useAutoFocus(hasFocus);
    const options = getValueOptions(colDef, row);
    const label = (option) =>
        colDef.getOptionLabel
            ? colDef.getOptionLabel(option)
            : option !== null && typeof option === 'object'
              ? option.label
              : String(option);
    return (
        <select
            ref={ref}
            className="og-edit-input"
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(event) => {
                const match = options.find((option) => String(getOptionValue(option, colDef)) === event.target.value);
                api.setEditCellValue({
                    id,
                    field,
                    value: match === undefined ? event.target.value : getOptionValue(match, colDef),
                });
            }}
        >
            {options.map((option) => {
                const optionValue = String(getOptionValue(option, colDef));
                return (
                    <option key={optionValue} value={optionValue}>
                        {label(option)}
                    </option>
                );
            })}
        </select>
    );
}

export function DefaultEditCell({ params }) {
    switch (params.colDef.type) {
        case 'number':
            return <TextEditInput params={params} numeric />;
        case 'date':
            return <DateEditInput params={params} />;
        case 'dateTime':
            return <DateEditInput params={params} withTime />;
        case 'boolean':
            return <BooleanEditInput params={params} />;
        case 'singleSelect':
            return <SingleSelectEditInput params={params} />;
        default:
            return <TextEditInput params={params} />;
    }
}
