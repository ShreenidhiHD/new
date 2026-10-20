import { DEFAULT_FILTER_MODEL } from '../constants';
import { getCellText, getCellValue, normalizeColumn } from './columns';
import { createFilterPredicate, createSorter } from './rows';

// Helpers to run OpenGrid's own filtering/sorting outside the component, e.g.
// in a mock server or a Node endpoint that backs `dataSource`.

function prepare(rows, columns, getRowId) {
    const normalized = columns.map(normalizeColumn);
    const columnsByField = new Map(normalized.map((column) => [column.field, column]));
    const byId = new Map(rows.map((row) => [getRowId(row), row]));
    return {
        normalized,
        columnsByField,
        byId,
        getRow: (id) => byId.get(id),
        getValue: (id, column) => getCellValue(byId.get(id), column, null),
        getText: (id, column) => getCellText(byId.get(id), column, null),
    };
}

export function gridFilterRows(rows, columns, filterModel, { getRowId = (row) => row.id } = {}) {
    const ctx = prepare(rows, columns, getRowId);
    const predicate = createFilterPredicate({
        filterModel: { ...DEFAULT_FILTER_MODEL, ...filterModel },
        columnsByField: ctx.columnsByField,
        quickFilterColumns: ctx.normalized,
        getValue: ctx.getValue,
        getText: ctx.getText,
        getRow: ctx.getRow,
        apiRef: null,
    });
    return predicate ? rows.filter((row) => predicate(getRowId(row))) : rows;
}

export function gridSortRows(rows, columns, sortModel, { getRowId = (row) => row.id } = {}) {
    const ctx = prepare(rows, columns, getRowId);
    const sorter = createSorter({
        sortModel,
        columnsByField: ctx.columnsByField,
        getValue: ctx.getValue,
        getRow: ctx.getRow,
        apiRef: null,
    });
    if (!sorter) return rows;
    return sorter(rows.map(getRowId)).map(ctx.getRow);
}
