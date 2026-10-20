import {
    GRID_CHECKBOX_SELECTION_FIELD,
    GRID_DETAIL_PANEL_TOGGLE_FIELD,
    GRID_REORDER_FIELD,
    GRID_TREE_DATA_GROUPING_FIELD,
} from '../constants';

// Column definitions the grid injects for built-in features. Their cells are
// rendered by `Row` itself because they need row-level state (selection,
// expansion, drag) that plain cell params do not carry.

const BASE = {
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    disableReorder: true,
    disableExport: true,
    hideable: false,
    resizable: false,
    align: 'center',
    headerAlign: 'center',
};

export const createCheckboxColumn = (localeText) => ({
    ...BASE,
    field: GRID_CHECKBOX_SELECTION_FIELD,
    type: 'checkboxSelection',
    headerName: localeText.checkboxSelectionHeaderName,
    width: 50,
    minWidth: 50,
    maxWidth: 50,
});

export const createDetailPanelToggleColumn = (localeText) => ({
    ...BASE,
    field: GRID_DETAIL_PANEL_TOGGLE_FIELD,
    type: 'detailPanelToggle',
    headerName: localeText.detailPanelToggle,
    width: 40,
    minWidth: 40,
    maxWidth: 40,
});

export const createReorderColumn = (localeText) => ({
    ...BASE,
    field: GRID_REORDER_FIELD,
    type: 'rowReorder',
    headerName: localeText.rowReorderingHeaderName,
    width: 50,
    minWidth: 50,
    maxWidth: 50,
});

export const createTreeDataGroupingColumn = (localeText, groupingColDef = {}) => ({
    headerName: localeText.treeDataGroupingHeaderName,
    width: 220,
    sortable: true,
    filterable: true,
    disableReorder: true,
    disableExport: false,
    hideable: true,
    align: 'left',
    headerAlign: 'left',
    ...groupingColDef,
    field: GRID_TREE_DATA_GROUPING_FIELD,
    type: 'string',
});
