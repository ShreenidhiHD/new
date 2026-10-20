import {
    getGridBooleanOperators,
    getGridDateOperators,
    getGridNumericOperators,
    getGridSingleSelectOperators,
    getGridStringOperators,
    getOptionValue,
} from './filterOperators';
import { isNil, toDate } from './utils';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
// Cached formatters: `toLocale*String` builds a new formatter per call, which is
// ~20x slower and dominates filtering/exporting large datasets.
const numberFormat = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat();
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
});

const compareNil = (a, b) => {
    const aNil = isNil(a) || a === '';
    const bNil = isNil(b) || b === '';
    if (aNil && bNil) return 0;
    if (aNil) return -1;
    if (bNil) return 1;
    return null;
};

export function gridStringOrNumberComparator(a, b) {
    const nil = compareNil(a, b);
    if (nil !== null) return nil;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return collator.compare(String(a), String(b));
}

export function gridNumberComparator(a, b) {
    const nil = compareNil(a, b);
    if (nil !== null) return nil;
    return Number(a) - Number(b);
}

export function gridDateComparator(a, b) {
    const da = toDate(a);
    const db = toDate(b);
    const nil = compareNil(da, db);
    if (nil !== null) return nil;
    return da.getTime() - db.getTime();
}

export function gridBooleanComparator(a, b) {
    return Number(Boolean(a)) - Number(Boolean(b));
}

function singleSelectLabel(value, column) {
    if (isNil(value)) return '';
    const label = column.optionLabelMap && column.optionLabelMap.get(String(value));
    return label === undefined ? String(value) : label;
}

export const GRID_COLUMN_TYPES = {
    string: {
        align: 'left',
        headerAlign: 'left',
        sortComparator: gridStringOrNumberComparator,
        filterOperators: getGridStringOperators(),
        getApplyQuickFilterFn: (query) => (value) => !isNil(value) && String(value).toLowerCase().includes(query),
    },
    number: {
        align: 'right',
        headerAlign: 'right',
        sortComparator: gridNumberComparator,
        filterOperators: getGridNumericOperators(),
        valueParser: (value) => {
            if (value === '' || isNil(value)) return null;
            const number = Number(value);
            return Number.isNaN(number) ? null : number;
        },
        valueFormatter: (value) =>
            typeof value === 'number' && !Number.isNaN(value) ? numberFormat.format(value) : value,
        getApplyQuickFilterFn: (query) => (value) => !isNil(value) && String(value).toLowerCase().includes(query),
    },
    date: {
        align: 'left',
        headerAlign: 'left',
        sortComparator: gridDateComparator,
        filterOperators: getGridDateOperators(false),
        valueFormatter: (value) => {
            const date = toDate(value);
            return date ? dateFormat.format(date) : '';
        },
        valueParser: (value) => toDate(value),
    },
    dateTime: {
        align: 'left',
        headerAlign: 'left',
        sortComparator: gridDateComparator,
        filterOperators: getGridDateOperators(true),
        valueFormatter: (value) => {
            const date = toDate(value);
            return date ? dateTimeFormat.format(date) : '';
        },
        valueParser: (value) => toDate(value),
    },
    boolean: {
        align: 'center',
        headerAlign: 'center',
        sortComparator: gridBooleanComparator,
        filterOperators: getGridBooleanOperators(),
        valueParser: (value) => value === true || value === 'true',
        getApplyQuickFilterFn: null,
    },
    singleSelect: {
        align: 'left',
        headerAlign: 'left',
        filterOperators: getGridSingleSelectOperators(),
        sortComparator: null, // resolved per column (sorts by label)
        valueFormatter: (value, row, column) => singleSelectLabel(value, column),
    },
    actions: {
        align: 'right',
        headerAlign: 'right',
        width: 100,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        disableExport: true,
        disableReorder: false,
        editable: false,
        getApplyQuickFilterFn: null,
    },
};

const COLUMN_DEFAULTS = {
    width: 100,
    minWidth: 50,
    maxWidth: Infinity,
    sortable: true,
    filterable: true,
    hideable: true,
    resizable: true,
    pinnable: true,
    editable: false,
    disableReorder: false,
    disableColumnMenu: false,
    disableExport: false,
};

/** Merges a user column definition with its type defaults (MUI X semantics). */
export function normalizeColumn(colDef) {
    const type = colDef.type && GRID_COLUMN_TYPES[colDef.type] ? colDef.type : 'string';
    const typeDef = GRID_COLUMN_TYPES[type];
    const column = { ...COLUMN_DEFAULTS, ...typeDef, ...colDef, type };
    if (column.headerName === undefined) column.headerName = colDef.field;
    if (colDef.type && !GRID_COLUMN_TYPES[colDef.type]) column.type = colDef.type;

    if (type === 'singleSelect') {
        const options = Array.isArray(colDef.valueOptions) ? colDef.valueOptions : [];
        column.optionLabelMap = new Map(
            options.map((option) => {
                const value = getOptionValue(option, column);
                const label = colDef.getOptionLabel
                    ? colDef.getOptionLabel(option)
                    : option !== null && typeof option === 'object'
                      ? option.label
                      : String(option);
                return [String(value), label];
            }),
        );
        if (!column.sortComparator) {
            column.sortComparator = (a, b) =>
                gridStringOrNumberComparator(singleSelectLabel(a, column), singleSelectLabel(b, column));
        }
    }
    return column;
}

export function getCellValue(row, column, apiRef) {
    if (!row) return undefined;
    const raw = row[column.field];
    return column.valueGetter ? column.valueGetter(raw, row, column, apiRef) : raw;
}

export function getFormattedValue(value, row, column, apiRef) {
    return column.valueFormatter ? column.valueFormatter(value, row, column, apiRef) : value;
}

/** Display string for a cell: what export, clipboard and quick filter see. */
export function getCellText(row, column, apiRef) {
    const value = getCellValue(row, column, apiRef);
    if (column.type === 'boolean' && !column.valueFormatter) return value ? 'true' : 'false';
    const formatted = getFormattedValue(value, row, column, apiRef);
    if (isNil(formatted)) return '';
    if (formatted instanceof Date) return dateTimeFormat.format(formatted);
    if (typeof formatted === 'object') return JSON.stringify(formatted);
    return String(formatted);
}
