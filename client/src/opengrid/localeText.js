// Default (English) translations. Pass `localeText` to override any key.
export const enUS = {
    // Overlays
    noRowsLabel: 'No rows',
    noResultsOverlayLabel: 'No results found.',

    // Toolbar
    toolbarColumns: 'Columns',
    toolbarFilters: 'Filters',
    toolbarFiltersTooltip: (count) => (count === 1 ? '1 active filter' : `${count} active filters`),
    toolbarDensity: 'Density',
    toolbarDensityCompact: 'Compact',
    toolbarDensityStandard: 'Standard',
    toolbarDensityComfortable: 'Comfortable',
    toolbarExport: 'Export',
    toolbarExportCSV: 'Download as CSV',
    toolbarExportPrint: 'Print',
    toolbarQuickFilterPlaceholder: 'Search…',
    toolbarQuickFilterLabel: 'Search',
    toolbarQuickFilterClear: 'Clear search',

    // Columns panel
    columnsManagementSearchTitle: 'Search',
    columnsManagementNoColumns: 'No columns',
    columnsManagementShowHideAllText: 'Show/Hide All',
    columnsManagementReset: 'Reset',

    // Filter panel
    filterPanelAddFilter: 'Add filter',
    filterPanelRemoveAll: 'Remove all',
    filterPanelDeleteIconLabel: 'Delete',
    filterPanelLogicOperator: 'Logic operator',
    filterPanelOperator: 'Operator',
    filterPanelOperatorAnd: 'And',
    filterPanelOperatorOr: 'Or',
    filterPanelColumns: 'Columns',
    filterPanelInputLabel: 'Value',
    filterPanelInputPlaceholder: 'Filter value',

    // Filter operators
    filterOperatorContains: 'contains',
    filterOperatorDoesNotContain: 'does not contain',
    filterOperatorEquals: 'equals',
    filterOperatorDoesNotEqual: 'does not equal',
    filterOperatorStartsWith: 'starts with',
    filterOperatorEndsWith: 'ends with',
    filterOperatorIs: 'is',
    filterOperatorNot: 'is not',
    filterOperatorAfter: 'is after',
    filterOperatorOnOrAfter: 'is on or after',
    filterOperatorBefore: 'is before',
    filterOperatorOnOrBefore: 'is on or before',
    filterOperatorIsEmpty: 'is empty',
    filterOperatorIsNotEmpty: 'is not empty',
    filterOperatorIsAnyOf: 'is any of',
    'filterOperator=': '=',
    'filterOperator!=': '!=',
    'filterOperator>': '>',
    'filterOperator>=': '>=',
    'filterOperator<': '<',
    'filterOperator<=': '<=',

    // Header filters
    headerFilterOperatorContains: 'Contains',
    headerFilterPlaceholder: 'Filter',
    headerFilterClear: 'Clear filter',

    filterValueAny: 'any',
    filterValueTrue: 'true',
    filterValueFalse: 'false',

    // Column menu
    columnMenuLabel: 'Menu',
    columnMenuShowColumns: 'Manage columns',
    columnMenuManageColumns: 'Manage columns',
    columnMenuFilter: 'Filter',
    columnMenuHideColumn: 'Hide column',
    columnMenuUnsort: 'Unsort',
    columnMenuSortAsc: 'Sort by ASC',
    columnMenuSortDesc: 'Sort by DESC',
    columnMenuAutosize: 'Autosize column',
    pinToLeft: 'Pin to left',
    pinToRight: 'Pin to right',
    unpin: 'Unpin',

    columnHeaderFiltersTooltipActive: (count) => (count === 1 ? '1 active filter' : `${count} active filters`),
    columnHeaderFiltersLabel: 'Show filters',
    columnHeaderSortIconLabel: 'Sort',

    // Footer
    footerRowSelected: (count) => (count === 1 ? '1 row selected' : `${count.toLocaleString()} rows selected`),
    footerTotalRows: 'Total Rows:',
    footerTotalVisibleRows: (visibleCount, totalCount) =>
        `${visibleCount.toLocaleString()} of ${totalCount.toLocaleString()}`,

    // Pagination
    paginationRowsPerPage: 'Rows per page:',
    paginationDisplayedRows: ({ from, to, count }) =>
        `${from}–${to} of ${count === -1 ? `more than ${to}` : count.toLocaleString()}`,
    paginationFirstPage: 'Go to first page',
    paginationPreviousPage: 'Go to previous page',
    paginationNextPage: 'Go to next page',
    paginationLastPage: 'Go to last page',

    // Selection / misc
    checkboxSelectionHeaderName: 'Checkbox selection',
    checkboxSelectionSelectAllRows: 'Select all rows',
    checkboxSelectionUnselectAllRows: 'Unselect all rows',
    checkboxSelectionSelectRow: 'Select row',
    checkboxSelectionUnselectRow: 'Unselect row',
    booleanCellTrueLabel: 'yes',
    booleanCellFalseLabel: 'no',
    actionsCellMore: 'more',

    // Tree data / master detail / reorder
    treeDataGroupingHeaderName: 'Group',
    treeDataExpand: 'see children',
    treeDataCollapse: 'hide children',
    detailPanelToggle: 'Detail panel toggle',
    expandDetailPanel: 'Expand',
    collapseDetailPanel: 'Collapse',
    rowReorderingHeaderName: 'Row reordering',
};

export const esES = {
    ...enUS,
    noRowsLabel: 'Sin filas',
    noResultsOverlayLabel: 'Resultados no encontrados',
    toolbarColumns: 'Columnas',
    toolbarFilters: 'Filtros',
    toolbarDensity: 'Densidad',
    toolbarDensityCompact: 'Compacta',
    toolbarDensityStandard: 'Estándar',
    toolbarDensityComfortable: 'Cómoda',
    toolbarExport: 'Exportar',
    toolbarExportCSV: 'Descargar como CSV',
    toolbarExportPrint: 'Imprimir',
    toolbarQuickFilterPlaceholder: 'Buscar…',
    filterPanelAddFilter: 'Agregar filtro',
    filterPanelRemoveAll: 'Remover todos',
    filterPanelColumns: 'Columnas',
    filterPanelOperator: 'Operador',
    filterPanelInputLabel: 'Valor',
    columnMenuShowColumns: 'Mostrar columnas',
    columnMenuManageColumns: 'Administrar columnas',
    columnMenuFilter: 'Filtro',
    columnMenuHideColumn: 'Ocultar',
    columnMenuUnsort: 'Desordenar',
    columnMenuSortAsc: 'Ordenar ASC',
    columnMenuSortDesc: 'Ordenar DESC',
    pinToLeft: 'Anclar a la izquierda',
    pinToRight: 'Anclar a la derecha',
    unpin: 'Desanclar',
    footerTotalRows: 'Filas Totales:',
    footerRowSelected: (count) =>
        count === 1 ? '1 fila seleccionada' : `${count.toLocaleString()} filas seleccionadas`,
    paginationRowsPerPage: 'Filas por página:',
    paginationDisplayedRows: ({ from, to, count }) =>
        `${from}–${to} de ${count === -1 ? `más de ${to}` : count.toLocaleString()}`,
};
