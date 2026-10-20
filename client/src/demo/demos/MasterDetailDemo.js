import React, { useCallback, useMemo, useState } from 'react';
import { DataGridPro, GRID_DETAIL_PANEL_TOGGLE_FIELD } from '../../opengrid';
import { COUNTRIES, createOrders } from '../data';
import { Avatar, currency } from '../renderers';

const itemColumns = [
    { field: 'product', headerName: 'Product', flex: 1, minWidth: 140 },
    { field: 'quantity', headerName: 'Qty', type: 'number', width: 80 },
    {
        field: 'unitPrice',
        headerName: 'Unit price',
        type: 'number',
        width: 120,
        valueFormatter: (value) => currency(value),
    },
    {
        field: 'total',
        headerName: 'Total',
        type: 'number',
        width: 130,
        valueGetter: (value, row) => row.quantity * row.unitPrice,
        valueFormatter: (value) => currency(value),
    },
];

function OrderDetail({ row, theme }) {
    return (
        <div className="demo-detail">
            <div className="demo-detail-header">
                <Avatar name={row.customer} />
                <div>
                    <div className="demo-detail-title">Order #{row.id}</div>
                    <div className="demo-muted">
                        {row.customer} · {row.email}
                    </div>
                </div>
                <div className="demo-detail-total">{currency(row.total)}</div>
            </div>
            <DataGridPro
                rows={row.items}
                columns={itemColumns}
                density="compact"
                autoHeight
                hideFooter
                theme={theme}
                disableColumnMenu
                aria-label={`Items of order ${row.id}`}
            />
        </div>
    );
}

const columns = [
    { field: 'id', headerName: 'Order', width: 100 },
    { field: 'customer', headerName: 'Customer', flex: 1, minWidth: 160 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 220 },
    { field: 'date', headerName: 'Date', type: 'date', width: 130 },
    { field: 'country', headerName: 'Country', type: 'singleSelect', valueOptions: COUNTRIES, width: 190 },
    {
        field: 'status',
        headerName: 'Status',
        type: 'singleSelect',
        valueOptions: ['Pending', 'Shipped', 'Delivered', 'Returned'],
        width: 120,
    },
    { field: 'total', headerName: 'Total', type: 'number', width: 130, valueFormatter: (value) => currency(value) },
];

export default function MasterDetailDemo({ theme }) {
    const rows = useMemo(() => createOrders(), []);
    const [expanded, setExpanded] = useState([rows[0].id]);
    const getDetailPanelContent = useCallback(({ row }) => <OrderDetail row={row} theme={theme} />, [theme]);
    return (
        <div className="demo-section">
            <div className="demo-controls">
                <button
                    type="button"
                    className="demo-button"
                    onClick={() => setExpanded(rows.slice(0, 20).map((row) => row.id))}
                >
                    Expand first 20
                </button>
                <button type="button" className="demo-button" onClick={() => setExpanded([])}>
                    Collapse all
                </button>
                <span className="demo-muted">
                    Panels size themselves to their content · each one holds a nested grid
                </span>
            </div>
            <div className="demo-grid" style={{ height: 600 }}>
                <DataGridPro
                    rows={rows}
                    columns={columns}
                    theme={theme}
                    getDetailPanelContent={getDetailPanelContent}
                    getDetailPanelHeight={() => 'auto'}
                    detailPanelExpandedRowIds={expanded}
                    onDetailPanelExpandedRowIdsChange={setExpanded}
                    initialState={{ pinnedColumns: { left: [GRID_DETAIL_PANEL_TOGGLE_FIELD] } }}
                    aria-label="Orders"
                />
            </div>
        </div>
    );
}
