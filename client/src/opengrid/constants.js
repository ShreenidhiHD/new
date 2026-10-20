// Field names of the columns OpenGrid injects itself. They match the names used
// by MUI X so existing `pinnedColumns`/`columnVisibilityModel` configs keep working.
export const GRID_CHECKBOX_SELECTION_FIELD = '__check__';
export const GRID_DETAIL_PANEL_TOGGLE_FIELD = '__detail_panel_toggle__';
export const GRID_REORDER_FIELD = '__reorder__';
export const GRID_TREE_DATA_GROUPING_FIELD = '__tree_data_group__';

export const GRID_SPECIAL_FIELDS = new Set([
    GRID_CHECKBOX_SELECTION_FIELD,
    GRID_DETAIL_PANEL_TOGGLE_FIELD,
    GRID_REORDER_FIELD,
    GRID_TREE_DATA_GROUPING_FIELD,
]);

export const DENSITY_FACTORS = { compact: 0.7, standard: 1, comfortable: 1.3 };

export const SKELETON_ID_PREFIX = '__og_skeleton__';

export const DEFAULT_FILTER_MODEL = Object.freeze({
    items: [],
    logicOperator: 'and',
    quickFilterValues: [],
    quickFilterLogicOperator: 'and',
});

export const DEFAULT_PINNED_COLUMNS = Object.freeze({ left: [], right: [] });
export const DEFAULT_PINNED_ROWS = Object.freeze({ top: [], bottom: [] });
