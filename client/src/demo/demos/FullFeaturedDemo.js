import React, { useCallback, useMemo, useState } from 'react';
import {
    DataGridPro,
    GRID_CHECKBOX_SELECTION_FIELD,
    GRID_DETAIL_PANEL_TOGGLE_FIELD,
    GridActionsCellItem,
    Icon,
} from '../../opengrid';
import { toolbarSlotProps } from '../env';
import { COMMODITIES, COUNTRIES, STATUSES, createCommodityRows } from '../data';
import { Avatar, Country, Pnl, ProgressBar, StatusChip, currency, percent } from '../renderers';

const ROW_COUNTS = [1000, 10000, 100000];

const columnGroupingModel = [
    {
        groupId: 'Trade',
        description: 'What was traded',
        children: [
            { field: 'desk' },
            { field: 'commodity' },
            { field: 'quantity' },
            { field: 'filledQuantity' },
            { field: 'isFilled' },
            { field: 'status' },
        ],
    },
    { groupId: 'Trader', children: [{ field: 'traderName' }, { field: 'traderEmail' }] },
    {
        groupId: 'Pricing',
        headerAlign: 'center',
        children: [
            { groupId: 'Unit', children: [{ field: 'unitPrice' }, { field: 'unitPriceCurrency' }] },
            { field: 'subTotal' },
            { groupId: 'Fees', children: [{ field: 'feeRate' }, { field: 'feeAmount' }] },
            { field: 'pnl' },
        ],
    },
    {
        groupId: 'Counterparty',
        children: [
            { field: 'counterPartyName' },
            { field: 'counterPartyCountry' },
            { field: 'contractType' },
            { field: 'rateType' },
            { field: 'brokerName' },
        ],
    },
];

function DetailPanel({ row }) {
    const fees = row.feeRate * row.quantity * row.unitPrice;
    return (
        <div className="demo-detail">
            <div className="demo-detail-header">
                <Avatar name={row.traderName} />
                <div>
                    <div className="demo-detail-title">
                        Trade #{row.id} · {row.commodity}
                    </div>
                    <div className="demo-muted">
                        {row.traderName} · {row.traderEmail}
                    </div>
                </div>
            </div>
            <dl className="demo-detail-grid">
                <dt>Counterparty</dt>
                <dd>
                    {row.counterPartyName} (<Country value={row.counterPartyCountry} />)
                </dd>
                <dt>Contract</dt>
                <dd>
                    {row.contractType} · {row.rateType} · {row.incoTerm}
                </dd>
                <dt>Quantity</dt>
                <dd>
                    {row.filledQuantity.toLocaleString()} / {row.quantity.toLocaleString()} filled
                </dd>
                <dt>Fees</dt>
                <dd>
                    {currency(fees, row.unitPriceCurrency)} ({percent(row.feeRate, 2)})
                </dd>
                <dt>Dates</dt>
                <dd>
                    traded {row.tradeDate.toLocaleDateString()} · matures {row.maturityDate.toLocaleDateString()}
                </dd>
            </dl>
        </div>
    );
}

const Toggle = ({ label, checked, onChange }) => (
    <label className="demo-toggle">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
    </label>
);

export default function FullFeaturedDemo({ theme }) {
    const [rowCount, setRowCount] = useState(10000);
    const [options, setOptions] = useState({
        checkboxSelection: true,
        pagination: false,
        headerFilters: false,
        columnGroups: true,
        rowReordering: false,
        masterDetail: true,
        pinnedRows: true,
        editable: true,
        cellBorders: false,
    });
    const set = (key) => (value) => setOptions((prev) => ({ ...prev, [key]: value }));
    const [rows, setRows] = useState(() => createCommodityRows(10000));
    const [lastEvent, setLastEvent] = useState(
        'Try: shift-click headers to multi-sort, drag headers, double-click a cell to edit.',
    );

    const changeRowCount = (count) => {
        setRowCount(count);
        setRows(createCommodityRows(count));
    };

    const deleteRow = useCallback((id) => setRows((prev) => prev.filter((row) => row.id !== id)), []);
    const duplicateRow = useCallback(
        (row) =>
            setRows((prev) => {
                const id = Math.max(...prev.map((r) => r.id)) + 1;
                const index = prev.findIndex((r) => r.id === row.id);
                const next = prev.slice();
                next.splice(index + 1, 0, { ...row, id });
                return next;
            }),
        [],
    );

    const columns = useMemo(
        () => [
            { field: 'id', headerName: 'ID', type: 'number', width: 80, editable: false },
            { field: 'desk', headerName: 'Desk', width: 100 },
            {
                field: 'commodity',
                headerName: 'Commodity',
                width: 150,
                type: 'singleSelect',
                valueOptions: COMMODITIES,
                editable: options.editable,
            },
            {
                field: 'quantity',
                headerName: 'Quantity',
                type: 'number',
                width: 120,
                editable: options.editable,
                preProcessEditCellProps: ({ props }) => ({
                    ...props,
                    error: props.value === null || props.value < 0 ? 'Quantity must be positive' : false,
                }),
            },
            {
                field: 'filledQuantity',
                headerName: 'Filled Quantity',
                type: 'number',
                width: 150,
                valueGetter: (value, row) => (row.quantity ? value / row.quantity : 0),
                valueFormatter: (value) => percent(value),
                renderCell: (params) => <ProgressBar value={params.value} />,
            },
            { field: 'isFilled', headerName: 'Is Filled', type: 'boolean', width: 90 },
            {
                field: 'status',
                headerName: 'Status',
                type: 'singleSelect',
                valueOptions: STATUSES,
                width: 150,
                editable: options.editable,
                renderCell: (params) => <StatusChip value={params.value} />,
            },
            {
                field: 'traderName',
                headerName: 'Trader Name',
                width: 180,
                editable: options.editable,
                renderCell: (params) =>
                    params.value && (
                        <span className="demo-person">
                            <Avatar name={params.value} />
                            <span className="demo-ellipsis">{params.value}</span>
                        </span>
                    ),
            },
            { field: 'traderEmail', headerName: 'Trader Email', width: 230 },
            {
                field: 'unitPrice',
                headerName: 'Unit Price',
                type: 'number',
                width: 120,
                editable: options.editable,
                valueFormatter: (value) => (typeof value === 'number' ? value.toFixed(2) : value),
            },
            { field: 'unitPriceCurrency', headerName: 'Currency', width: 100 },
            {
                field: 'subTotal',
                headerName: 'Sub Total',
                type: 'number',
                width: 150,
                valueGetter: (value, row) => (row.quantity !== undefined ? row.quantity * row.unitPrice : value),
                valueFormatter: (value, row) => currency(value, row.unitPriceCurrency || 'USD'),
            },
            {
                field: 'feeRate',
                headerName: 'Fee Rate',
                type: 'number',
                width: 100,
                valueFormatter: (value) => percent(value, 2),
            },
            {
                field: 'feeAmount',
                headerName: 'Fee Amount',
                type: 'number',
                width: 130,
                valueGetter: (value, row) =>
                    row.feeRate !== undefined ? row.feeRate * row.quantity * row.unitPrice : value,
                valueFormatter: (value, row) => currency(value, row.unitPriceCurrency || 'USD'),
            },
            {
                field: 'pnl',
                headerName: 'PnL',
                type: 'number',
                width: 140,
                valueFormatter: (value) => currency(value),
                renderCell: (params) => <Pnl value={params.value} formattedValue={params.formattedValue} />,
            },
            { field: 'incoTerm', headerName: 'Inco Term', width: 100 },
            { field: 'tradeDate', headerName: 'Trade Date', type: 'date', width: 130, editable: options.editable },
            { field: 'maturityDate', headerName: 'Maturity Date', type: 'date', width: 130 },
            { field: 'counterPartyName', headerName: 'Counterparty', width: 140 },
            {
                field: 'counterPartyCountry',
                headerName: 'Country',
                type: 'singleSelect',
                valueOptions: COUNTRIES,
                width: 180,
            },
            {
                field: 'contractType',
                headerName: 'Contract',
                type: 'singleSelect',
                valueOptions: ['Future', 'Option', 'Spot', 'Swap'],
                width: 110,
            },
            {
                field: 'rateType',
                headerName: 'Rate Type',
                type: 'singleSelect',
                valueOptions: ['Fixed', 'Floating'],
                width: 110,
            },
            { field: 'brokerName', headerName: 'Broker', width: 160 },
            {
                field: 'actions',
                type: 'actions',
                headerName: 'Actions',
                width: 90,
                getActions: (params) =>
                    params.rowNode.type === 'pinnedRow'
                        ? []
                        : [
                              <GridActionsCellItem
                                  key="delete"
                                  icon={<Icon name="delete" size={20} />}
                                  label="Delete"
                                  onClick={() => deleteRow(params.id)}
                              />,
                              <GridActionsCellItem
                                  key="duplicate"
                                  showInMenu
                                  icon={<Icon name="add" size={20} />}
                                  label="Duplicate"
                                  onClick={() => duplicateRow(params.row)}
                              />,
                              <GridActionsCellItem
                                  key="copy"
                                  showInMenu
                                  icon={<Icon name="download" size={20} />}
                                  label="Copy email"
                                  onClick={() =>
                                      navigator.clipboard && navigator.clipboard.writeText(params.row.traderEmail)
                                  }
                              />,
                          ],
            },
        ],
        [options.editable, deleteRow, duplicateRow],
    );

    const pinnedRows = useMemo(() => {
        if (!options.pinnedRows) return undefined;
        const totals = rows.reduce(
            (acc, row) => {
                acc.quantity += row.quantity;
                acc.filledQuantity += row.filledQuantity;
                acc.pnl += row.pnl;
                return acc;
            },
            { quantity: 0, filledQuantity: 0, pnl: 0 },
        );
        return {
            bottom: [{ id: 'total', desk: 'TOTAL', commodity: `${rows.length.toLocaleString()} trades`, ...totals }],
        };
    }, [options.pinnedRows, rows]);

    const initialState = useMemo(
        () => ({
            pinnedColumns: {
                left: [GRID_DETAIL_PANEL_TOGGLE_FIELD, GRID_CHECKBOX_SELECTION_FIELD, 'desk', 'commodity'],
                right: ['actions'],
            },
            columns: { columnVisibilityModel: { id: false, incoTerm: false, brokerName: false } },
            pagination: { paginationModel: { page: 0, pageSize: 50 } },
        }),
        [],
    );

    return (
        <div className="demo-section">
            <div className="demo-controls">
                <label className="demo-select">
                    Rows
                    <select value={rowCount} onChange={(event) => changeRowCount(Number(event.target.value))}>
                        {ROW_COUNTS.map((count) => (
                            <option key={count} value={count}>
                                {count.toLocaleString()}
                            </option>
                        ))}
                    </select>
                </label>
                <Toggle
                    label="Checkbox selection"
                    checked={options.checkboxSelection}
                    onChange={set('checkboxSelection')}
                />
                <Toggle label="Header filters" checked={options.headerFilters} onChange={set('headerFilters')} />
                <Toggle label="Column groups" checked={options.columnGroups} onChange={set('columnGroups')} />
                <Toggle label="Master detail" checked={options.masterDetail} onChange={set('masterDetail')} />
                <Toggle label="Row reordering" checked={options.rowReordering} onChange={set('rowReordering')} />
                <Toggle label="Pinned total row" checked={options.pinnedRows} onChange={set('pinnedRows')} />
                <Toggle label="Pagination" checked={options.pagination} onChange={set('pagination')} />
                <Toggle label="Editable" checked={options.editable} onChange={set('editable')} />
                <Toggle label="Cell borders" checked={options.cellBorders} onChange={set('cellBorders')} />
            </div>
            <div className="demo-grid" style={{ height: 620 }}>
                <DataGridPro
                    rows={rows}
                    columns={columns}
                    theme={theme}
                    showToolbar
                    slotProps={{ toolbar: toolbarSlotProps }}
                    checkboxSelection={options.checkboxSelection}
                    headerFilters={options.headerFilters}
                    columnGroupingModel={options.columnGroups ? columnGroupingModel : undefined}
                    getDetailPanelContent={options.masterDetail ? ({ row }) => <DetailPanel row={row} /> : undefined}
                    getDetailPanelHeight={() => 'auto'}
                    rowReordering={options.rowReordering}
                    pinnedRows={pinnedRows}
                    pagination={options.pagination}
                    pageSizeOptions={[25, 50, 100, 500]}
                    showCellVerticalBorder={options.cellBorders}
                    showColumnVerticalBorder={options.cellBorders}
                    initialState={initialState}
                    processRowUpdate={(newRow) => {
                        setRows((prev) => prev.map((row) => (row.id === newRow.id ? newRow : row)));
                        setLastEvent(`Saved row #${newRow.id}`);
                        return newRow;
                    }}
                    onRowOrderChange={({ row, oldIndex, targetIndex }) =>
                        setLastEvent(`Moved trade #${row.id} from ${oldIndex + 1} to ${targetIndex + 1}`)
                    }
                    onColumnOrderChange={({ column, targetIndex }) =>
                        setLastEvent(`Moved "${column.headerName}" to position ${targetIndex + 1}`)
                    }
                    onSortModelChange={(model) =>
                        setLastEvent(`Sort: ${model.map((m) => `${m.field} ${m.sort}`).join(', ') || 'none'}`)
                    }
                    onClipboardCopy={(text) =>
                        setLastEvent(`Copied ${text.split('\n').length} line(s) to the clipboard`)
                    }
                    aria-label="Commodity trades"
                />
            </div>
            <div className="demo-status">{lastEvent}</div>
        </div>
    );
}
