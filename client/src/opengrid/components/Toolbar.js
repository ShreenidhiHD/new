import React, { useEffect, useRef, useState } from 'react';
import { isEmptyFilterValue } from '../core/utils';
import { useGridContext } from './GridContext';
import { Icon } from './icons';
import { Menu, MenuItem, Popper } from './Popper';

export function GridToolbarContainer({ children, className, ...other }) {
    return (
        <div role="toolbar" className={`og-toolbar ${className || ''}`} {...other}>
            {children}
        </div>
    );
}

export function ToolbarButton({ icon, children, badge, ...other }) {
    return (
        <button type="button" className="og-button og-button--text" {...other}>
            <span className="og-button-icon">
                {icon}
                {badge ? <span className="og-badge">{badge}</span> : null}
            </span>
            {children}
        </button>
    );
}

export function GridToolbarColumnsButton() {
    const grid = useGridContext();
    if (grid.props.disableColumnSelector) return null;
    const open = grid.panel && grid.panel.type === 'columns';
    return (
        <ToolbarButton
            icon={<Icon name="columns" size={18} />}
            aria-haspopup="dialog"
            aria-expanded={Boolean(open)}
            onClick={(event) =>
                open ? grid.hidePreferences() : grid.showPreferences('columns', { anchorEl: event.currentTarget })
            }
        >
            {grid.localeText.toolbarColumns}
        </ToolbarButton>
    );
}

export function GridToolbarFilterButton() {
    const grid = useGridContext();
    if (grid.props.disableColumnFilter) return null;
    const active = grid.filterModel.items.filter((item) => {
        const column = grid.columnsByField.get(item.field);
        const operator = column && (column.filterOperators || []).find((op) => op.value === item.operator);
        return operator && (operator.requiresFilterValue === false || !isEmptyFilterValue(item.value));
    }).length;
    const open = grid.panel && grid.panel.type === 'filters';
    return (
        <ToolbarButton
            icon={<Icon name="filter" size={18} />}
            badge={active || null}
            title={active ? grid.localeText.toolbarFiltersTooltip(active) : undefined}
            aria-haspopup="dialog"
            aria-expanded={Boolean(open)}
            onClick={(event) =>
                open ? grid.hidePreferences() : grid.showPreferences('filters', { anchorEl: event.currentTarget })
            }
        >
            {grid.localeText.toolbarFilters}
        </ToolbarButton>
    );
}

const DENSITY_ICONS = { compact: 'densityCompact', standard: 'densityStandard', comfortable: 'densityComfortable' };

export function GridToolbarDensitySelector() {
    const grid = useGridContext();
    const [anchor, setAnchor] = useState(null);
    if (grid.props.disableDensitySelector) return null;
    const { localeText } = grid;
    const options = [
        { value: 'compact', label: localeText.toolbarDensityCompact },
        { value: 'standard', label: localeText.toolbarDensityStandard },
        { value: 'comfortable', label: localeText.toolbarDensityComfortable },
    ];
    return (
        <>
            <ToolbarButton
                icon={<Icon name={DENSITY_ICONS[grid.density] || 'densityStandard'} size={18} />}
                aria-haspopup="menu"
                aria-expanded={Boolean(anchor)}
                onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
            >
                {localeText.toolbarDensity}
            </ToolbarButton>
            <Popper
                open={Boolean(anchor)}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                themeClass={grid.themeClass}
            >
                <Menu>
                    {options.map((option) => (
                        <MenuItem
                            key={option.value}
                            selected={grid.density === option.value}
                            icon={<Icon name={DENSITY_ICONS[option.value]} size={18} />}
                            onClick={() => {
                                grid.setDensity(option.value);
                                setAnchor(null);
                            }}
                        >
                            {option.label}
                        </MenuItem>
                    ))}
                </Menu>
            </Popper>
        </>
    );
}

export function GridToolbarExport({ csvOptions = {}, printOptions = {} }) {
    const grid = useGridContext();
    const [anchor, setAnchor] = useState(null);
    if (csvOptions.disableToolbarButton && printOptions.disableToolbarButton) return null;
    const { localeText } = grid;
    return (
        <>
            <ToolbarButton
                icon={<Icon name="download" size={18} />}
                aria-haspopup="menu"
                aria-expanded={Boolean(anchor)}
                onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
            >
                {localeText.toolbarExport}
            </ToolbarButton>
            <Popper
                open={Boolean(anchor)}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                themeClass={grid.themeClass}
            >
                <Menu>
                    {!csvOptions.disableToolbarButton && (
                        <MenuItem
                            icon={<Icon name="download" size={18} />}
                            onClick={() => {
                                grid.exportDataAsCsv(csvOptions);
                                setAnchor(null);
                            }}
                        >
                            {localeText.toolbarExportCSV}
                        </MenuItem>
                    )}
                    {!printOptions.disableToolbarButton && (
                        <MenuItem
                            icon={<Icon name="print" size={18} />}
                            onClick={() => {
                                grid.exportDataAsPrint(printOptions);
                                setAnchor(null);
                            }}
                        >
                            {localeText.toolbarExportPrint}
                        </MenuItem>
                    )}
                </Menu>
            </Popper>
        </>
    );
}

const defaultQuickFilterParser = (text) => text.split(' ').filter((word) => word !== '');
const defaultQuickFilterFormatter = (values) => values.join(' ');

export function GridToolbarQuickFilter({
    debounceMs = 500,
    quickFilterParser = defaultQuickFilterParser,
    quickFilterFormatter = defaultQuickFilterFormatter,
    placeholder,
    className,
}) {
    const grid = useGridContext();
    const values = grid.filterModel.quickFilterValues || [];
    const [text, setText] = useState(() => quickFilterFormatter(values));
    const timer = useRef(null);
    const appliedRef = useRef(values);

    const valuesKey = JSON.stringify(values);
    useEffect(() => {
        // Keep in sync when the model is changed from outside (e.g. restoreState).
        if (valuesKey !== JSON.stringify(appliedRef.current)) {
            const next = JSON.parse(valuesKey);
            appliedRef.current = next;
            setText(quickFilterFormatter(next));
        }
    }, [valuesKey, quickFilterFormatter]);
    useEffect(() => () => clearTimeout(timer.current), []);

    const apply = (next) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            const parsed = quickFilterParser(next);
            appliedRef.current = parsed;
            grid.setQuickFilterValues(parsed);
        }, debounceMs);
    };

    return (
        <div className={`og-quick-filter ${className || ''}`}>
            <Icon name="search" size={20} className="og-quick-filter-icon" />
            <input
                type="search"
                value={text}
                placeholder={placeholder ?? grid.localeText.toolbarQuickFilterPlaceholder}
                aria-label={grid.localeText.toolbarQuickFilterLabel}
                onChange={(event) => {
                    setText(event.target.value);
                    apply(event.target.value);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape' && text) {
                        event.stopPropagation();
                        setText('');
                        apply('');
                    }
                }}
            />
            {text && (
                <button
                    type="button"
                    className="og-icon-button og-quick-filter-clear"
                    aria-label={grid.localeText.toolbarQuickFilterClear}
                    onClick={() => {
                        setText('');
                        clearTimeout(timer.current);
                        appliedRef.current = [];
                        grid.setQuickFilterValues([]);
                    }}
                >
                    <Icon name="close" size={16} />
                </button>
            )}
        </div>
    );
}

/** The default toolbar: columns, filters, density, export and quick filter. */
export function GridToolbar({ showQuickFilter = true, quickFilterProps, csvOptions, printOptions, children }) {
    return (
        <GridToolbarContainer>
            <GridToolbarColumnsButton />
            <GridToolbarFilterButton />
            <GridToolbarDensitySelector />
            <GridToolbarExport csvOptions={csvOptions} printOptions={printOptions} />
            {children}
            <div className="og-toolbar-spacer" />
            {showQuickFilter && <GridToolbarQuickFilter {...quickFilterProps} />}
        </GridToolbarContainer>
    );
}
