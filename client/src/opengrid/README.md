# OpenGrid

An open-source (MIT) React data grid that reproduces the **MUI X Data Grid Pro** feature set — virtualization,
column pinning, tree data, master detail, row reordering, header filters, multi-sort, multi-filter, lazy loading — with
**zero runtime dependencies** besides React.

The API deliberately mirrors MUI X (`rows`, `columns`, `initialState`, `apiRef`, `slots`, controlled models…), so most
MUI X Pro code ports by changing the import:

```jsx
import { DataGridPro } from './opengrid'; // instead of '@mui/x-data-grid-pro'

<div style={{ height: 600 }}>
    <DataGridPro
        rows={rows}
        columns={columns}
        checkboxSelection
        showToolbar
        headerFilters
        initialState={{ pinnedColumns: { left: ['name'], right: ['actions'] } }}
    />
</div>;
```

Like MUI X, the grid fills its parent: give the parent a height (or use `autoHeight`).

Run the playground (seven demos, light/dark) with `yarn run client` from the repository root, then open
<http://localhost:3000>.

## Feature matrix

| Feature | MUI X tier | OpenGrid |
| --- | --- | --- |
| Row & column virtualization | Community | ✅ (rows & columns, configurable buffers, `disableVirtualization`) |
| Column types: string, number, date, dateTime, boolean, singleSelect, actions | Community | ✅ |
| `valueGetter` / `valueFormatter` / `valueParser` / `valueSetter` / `renderCell` / `renderHeader` / `renderEditCell` | Community | ✅ (MUI X v7 signatures) |
| Fixed, `flex`, min/max widths | Community | ✅ |
| Column resizing (+ double-click to autosize) | Community | ✅ |
| Autosizing (`apiRef.autosizeColumns`, `autosizeOnMount`) | Community | ✅ (measures rendered rows) |
| Column visibility + "Manage columns" panel | Community | ✅ |
| Column menu (sort, filter, pin, hide, manage, autosize) | Community | ✅ (+ `slots.columnMenu`) |
| Column groups (nested) | Community | ✅ |
| Column spanning (`colSpan`) | Community | ✅ (keyboard-aware) |
| Sorting, custom comparators, `sortingOrder` | Community | ✅ |
| Filter panel, operators per type, custom operators | Community | ✅ |
| Quick filter (toolbar search) | Community | ✅ |
| Pagination (client & server), `autoPageSize` | Community | ✅ |
| Checkbox & click selection, shift/ctrl ranges | Community / Pro | ✅ |
| Cell editing & row editing, validation, `processRowUpdate` | Community | ✅ (async validation & persistence) |
| CSV export, print export | Community | ✅ |
| Clipboard copy (Ctrl/⌘+C) | Community | ✅ (selected rows as TSV, or the focused cell) |
| Toolbar (columns, filters, density, export, quick filter) | Community | ✅ |
| Density (compact / standard / comfortable) | Community | ✅ |
| Keyboard navigation & ARIA grid pattern | Community | ✅ |
| Save & restore state (`exportState` / `restoreState` / `initialState`) | Community | ✅ |
| `apiRef` & events (`subscribeEvent`) | Community | ✅ |
| Localization (`localeText`) | Community | ✅ (`enUS`, `esES` included) |
| Dark mode / theming | Community | ✅ (CSS variables, `theme="light|dark|auto"`) |
| **Multi-column sorting** | **Pro** | ✅ |
| **Multi-column filtering (AND/OR)** | **Pro** | ✅ |
| **Header filters** | **Pro** | ✅ (with operator menu) |
| **Column pinning (left/right)** | **Pro** | ✅ |
| **Column reordering (drag & drop)** | **Pro** | ✅ (live reorder, auto-scroll) |
| **Row pinning (top/bottom)** | **Pro** | ✅ |
| **Row reordering (drag & drop)** | **Pro** | ✅ (`onRowOrderChange`) |
| **Master detail panels** | **Pro** | ✅ (fixed or `'auto'` height) |
| **Tree data** | **Pro** | ✅ (auto-generated parents, selection propagation) |
| **Lazy loading / server-side data source** | **Pro** | ✅ (`dataSource`, skeleton rows, unknown row counts, cache) |
| **Infinite loading** (`onRowsScrollEnd`) | **Pro** | ✅ |
| **Unlimited page size** | **Pro** | ✅ |
| Dynamic row height (`getRowHeight: () => 'auto'`) | Community | ✅ (measured with `ResizeObserver`) |
| Aggregation, row grouping, pivoting, Excel export, clipboard paste, cell range selection, charts | Premium | ❌ not included (Pro parity is the goal) |

## Columns

```js
const columns = [
    { field: 'name', headerName: 'Name', width: 180, editable: true },
    { field: 'age', type: 'number', minWidth: 80, flex: 1 },
    {
        field: 'status',
        type: 'singleSelect',
        valueOptions: [{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }],
    },
    {
        field: 'total',
        type: 'number',
        valueGetter: (value, row) => row.quantity * row.price,
        valueFormatter: (value) => `$${value.toFixed(2)}`,
    },
    {
        field: 'actions',
        type: 'actions',
        getActions: ({ id }) => [
            <GridActionsCellItem icon={<Icon name="delete" />} label="Delete" onClick={() => remove(id)} />,
            <GridActionsCellItem showInMenu label="Duplicate" onClick={() => duplicate(id)} />,
        ],
    },
];
```

Supported column properties: `field`, `headerName`, `description`, `type`, `width`, `minWidth`, `maxWidth`, `flex`,
`align`, `headerAlign`, `sortable`, `filterable`, `hideable`, `resizable`, `pinnable`, `editable`, `disableReorder`,
`disableColumnMenu`, `disableExport`, `valueGetter`, `valueFormatter`, `valueParser`, `valueSetter`, `renderCell`,
`renderHeader`, `renderEditCell`, `cellClassName`, `headerClassName`, `sortComparator`, `sortingOrder`,
`filterOperators`, `getApplyQuickFilterFn`, `valueOptions`, `getOptionLabel`, `getOptionValue`, `getActions`,
`colSpan`, `preProcessEditCellProps`, `headerFilterOperator`.

Custom filter operators follow the MUI X contract:

```js
const startsWithVowel = {
    value: 'startsWithVowel',
    label: 'starts with a vowel',
    requiresFilterValue: false,
    getApplyFilterFn: () => (value) => /^[aeiou]/i.test(value ?? ''),
};
const columns = [{ field: 'name', filterOperators: [...getGridStringOperators(), startsWithVowel] }];
```

`InputComponent` receives `{ item, applyValue, apiRef, column }` for operators that need a custom input.

## Props

Every model can be **controlled** (`model` + `onModelChange`) or left to the grid (optionally seeded through
`initialState`).

| Area | Props |
| --- | --- |
| Data | `rows`, `columns`, `getRowId`, `rowCount`, `loading`, `pinnedRows` |
| Layout | `rowHeight`, `getRowHeight`, `getEstimatedRowHeight`, `columnHeaderHeight`, `columnGroupHeaderHeight`, `density`, `autoHeight`, `rowBufferPx`, `columnBufferPx`, `disableVirtualization`, `showCellVerticalBorder`, `showColumnVerticalBorder`, `theme`, `className`, `style` |
| Columns | `columnVisibilityModel`, `pinnedColumns`, `columnGroupingModel`, `disableColumnResize`, `disableColumnReorder`, `disableColumnPinning`, `disableColumnMenu`, `disableColumnSelector`, `autosizeOnMount`, `autosizeOptions`, `onColumnWidthChange`, `onColumnResize`, `onColumnOrderChange` |
| Sorting | `sortModel`, `sortingMode`, `sortingOrder`, `disableColumnSorting`, `disableMultipleColumnsSorting` |
| Filtering | `filterModel`, `filterMode`, `headerFilters`, `headerFilterHeight`, `disableColumnFilter`, `disableMultipleColumnsFiltering` |
| Pagination | `pagination`, `paginationModel`, `paginationMode`, `pageSizeOptions`, `autoPageSize` |
| Selection | `checkboxSelection`, `rowSelectionModel`, `isRowSelectable`, `disableRowSelectionOnClick`, `disableMultipleRowSelection`, `checkboxSelectionVisibleOnly`, `keepNonExistentRowsSelected`, `rowSelectionPropagation` |
| Editing | `editMode` (`'cell'`/`'row'`), `cellModesModel`, `rowModesModel`, `isCellEditable`, `processRowUpdate`, `onProcessRowUpdateError`, `onCellEditStart`, `onCellEditStop`, `onRowEditStart`, `onRowEditStop` |
| Tree data | `treeData`, `getTreeDataPath`, `groupingColDef`, `defaultGroupingExpansionDepth`, `isGroupExpandedByDefault` |
| Master detail | `getDetailPanelContent`, `getDetailPanelHeight`, `detailPanelExpandedRowIds` |
| Row reordering | `rowReordering`, `onRowOrderChange` |
| Server data | `dataSource`, `lazyLoading`, `lazyLoadingRequestChunkSize`, `dataSourceCache` (`null` disables), `onDataSourceError`, `onRowsScrollEnd`, `scrollEndThreshold` |
| Slots | `showToolbar`, `slots.toolbar`, `slots.footer`, `slots.columnMenu`, `slots.noRowsOverlay`, `slots.noResultsOverlay`, `slots.loadingOverlay`, `slotProps.*` (e.g. `slotProps.loadingOverlay.variant = 'skeleton' \| 'linear-progress'`, `slotProps.pagination.showFirstButton`) |
| Footer | `hideFooter`, `hideFooterPagination`, `hideFooterRowCount`, `hideFooterSelectedRowCount` |
| Events | `onRowClick`, `onRowDoubleClick`, `onCellClick`, `onCellDoubleClick`, `onCellKeyDown`, `onColumnHeaderClick`, `onMenuOpen`, `onMenuClose`, `onPreferencePanelOpen`, `onPreferencePanelClose`, `onClipboardCopy`, `onRenderedRowsChange` |
| Misc | `apiRef`, `initialState`, `localeText`, `getRowClassName`, `getCellClassName`, `aria-label` |

### Server-side data

```js
const dataSource = {
    // params: { start, end, sortModel, filterModel, paginationModel }
    getRows: async (params) => {
        const response = await fetch(`/api/trades?${toQueryString(params)}`);
        return response.json(); // { rows, rowCount }; omit rowCount (or -1) when unknown
    },
};

<DataGridPro columns={columns} dataSource={dataSource} lazyLoading />;
```

With `lazyLoading` the grid requests chunks as you scroll and shows skeleton rows meanwhile; without it, it requests
one page at a time (`pagination`) or everything at once. Sorting and filtering are forwarded to the server. The same
filtering/sorting logic the grid uses client side is exported (`gridFilterRows`, `gridSortRows`) so a mock or Node
backend can reuse it.

## API (`apiRef`)

```js
const apiRef = useGridApiRef();
<DataGridPro apiRef={apiRef} ... />;

apiRef.current.sortColumn('age', 'desc');
apiRef.current.setFilterModel({ items: [{ field: 'role', operator: 'is', value: 'admin' }] });
const state = apiRef.current.exportState();
apiRef.current.restoreState(state);
const unsubscribe = apiRef.current.subscribeEvent('rowClick', (params) => console.log(params.id));
```

Available methods:

- **Rows** — `getRow`, `getRowId`, `getRowModels`, `getAllRowIds`, `getRowsCount`, `getSortedRowIds`, `getVisibleRowIds`,
  `getRowNode`, `getRowIndexRelativeToVisibleRows`, `getRowParams`, `updateRows` (merge, add, `_action: 'delete'`),
  `setRows`, `setRowIndex`
- **Cells** — `getCellValue`, `getCellParams`, `getColumnHeaderParams`
- **Columns** — `getAllColumns`, `getVisibleColumns`, `getColumn`, `getColumnIndex`, `setColumnVisibility`,
  `setColumnVisibilityModel`, `setColumnWidth`, `setColumnIndex`, `pinColumn`, `unpinColumn`, `isColumnPinned`,
  `setPinnedColumns`, `getPinnedColumns`, `autosizeColumns`
- **Sorting / filtering** — `getSortModel`, `setSortModel`, `sortColumn`, `getFilterModel`, `setFilterModel`,
  `upsertFilterItem`, `upsertFilterItems`, `deleteFilterItem`, `setFilterLogicOperator`, `setQuickFilterValues`
- **Panels & menus** — `showFilterPanel`, `hideFilterPanel`, `showColumnsPanel`, `showPreferences`, `hidePreferences`,
  `showColumnMenu`, `hideColumnMenu`
- **Pagination** — `setPage`, `setPageSize`, `setPaginationModel`, `getPaginationModel`
- **Selection** — `selectRow`, `selectRows`, `selectRowRange`, `setRowSelectionModel`, `getSelectedRows`,
  `isRowSelected`, `isRowSelectable`
- **Editing** — `isCellEditable`, `getCellMode`, `getRowMode`, `startCellEditMode`, `stopCellEditMode`,
  `startRowEditMode`, `stopRowEditMode`, `setEditCellValue`, `getRowWithUpdatedValues`, `getEditCellProps`
- **Tree data / detail panels** — `setRowChildrenExpansion`, `toggleRowExpansion`, `toggleDetailPanel`,
  `getExpandedDetailPanels`, `setExpandedDetailPanels`
- **Focus & scroll** — `setCellFocus`, `setColumnHeaderFocus`, `getCellFocus`, `scrollToIndexes`, `scroll`,
  `getScrollPosition`
- **Export** — `getDataAsCsv`, `exportDataAsCsv`, `exportDataAsPrint`, `copySelectionToClipboard`
- **State & misc** — `exportState`, `restoreState`, `setDensity`, `getDensity`, `dataSource.fetchRows`,
  `dataSource.cache.clear`, `subscribeEvent`, `publishEvent`

Events: `rowClick`, `cellClick`, `cellDoubleClick`, `columnHeaderClick`, `sortModelChange`, `rowSelectionChange`,
`columnOrderChange`, `rowOrderChange`, `cellEditStart`, `cellEditStop`, `rowEditStart`, `rowEditStop`,
`rowsScrollEnd`, `scrollPositionChange`, `clipboardCopy`.

## Keyboard

| Keys | Action |
| --- | --- |
| Arrow keys | Move between cells (and up into the headers) |
| Home / End, Ctrl+Home / Ctrl+End | First/last cell of the row, of the grid |
| Page Up / Page Down | Move by one screen |
| Enter, F2, or start typing | Start editing; Enter commits and moves down, Tab moves right, Esc cancels |
| Delete / Backspace | Clear the cell and start editing |
| Space | Toggle row selection (checkbox column or Shift+Space), expand tree groups / detail panels |
| Ctrl/⌘+A, Ctrl/⌘+C | Select all, copy |
| Enter on a header (Shift for multi-sort) | Sort; Alt+↓ or Ctrl+Enter opens the column menu |

## Theming

All colours are CSS variables on `.og-theme-light` / `.og-theme-dark` (and `.og-theme-auto`, which follows the OS):

```css
.my-grid.og-root,
.og-popper {
    --og-primary: #7c3aed;
    --og-selected: rgba(124, 58, 237, 0.08);
    --og-border: #e5e7eb;
}
```

Pass `className="my-grid"` to the grid. Menus and panels render in a portal with the `og-popper` class, so include it in
overrides that should apply to them too.

## Differences from MUI X worth knowing

- `rowSelectionModel` is an array of ids (MUI X v7 style).
- Edit and filter inputs are native `<input>` / `<select>` elements, not MUI components; there is no `sx` prop or MUI
  theme integration — styling is plain CSS.
- Autosizing measures the rows currently rendered (as MUI X does), so it reflects what is on screen.
- Row reordering is disabled while a sort is applied (as in MUI X) and is not available with tree data.
- Display text used by quick filter and export is cached per row object; give rows a new object when they change (the
  grid does this itself for edits and `updateRows`).

## Architecture

```
opengrid/
├── DataGrid.js               root component (DataGrid / DataGridPro)
├── hooks/
│   ├── useGridController.js  all state, the row pipeline, editing, keyboard and the apiRef
│   ├── useDataSource.js      server-side data & lazy loading
│   └── useModel.js           controlled/uncontrolled models
├── core/                     framework-free logic (unit tested)
│   ├── columns.js            column types, comparators, formatting
│   ├── filterOperators.js    operators per type
│   ├── rows.js               tree building, filtering, sorting, flattening
│   ├── layout.js             widths, pinning, column groups, spans
│   ├── rowSizes.js           row geometry for virtualization
│   ├── export.js             CSV / TSV / print
│   └── serverUtils.js        gridFilterRows / gridSortRows for backends
└── components/               rendering: GridBody (virtual scroller), ColumnHeaders, Row, panels, toolbar…
```

The pipeline is `rows → (tree) → filter → sort → flatten (expansion) → paginate → virtualize`. Every stage is
memoised, so toggling a tree group does not re-sort and scrolling never touches the data. Rendering uses one native
scroll container with `position: sticky` for headers, pinned columns and pinned rows, and only renders the rows and
columns in view.

## Tests

```bash
cd client
CI=true yarn test --watchAll=false
```

Unit tests cover the core (operators, sorting, tree, layout, spans, CSV) and component tests cover sorting, selection,
editing, keyboard navigation, the API, tree data, master detail, pinned rows, quick filter and controlled pagination.

## License

MIT. Icons are path data from Google's Material Icons (Apache License 2.0).
