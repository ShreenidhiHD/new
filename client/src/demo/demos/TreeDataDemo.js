import React, { useMemo, useState } from 'react';
import { DataGridPro } from '../../opengrid';
import { toolbarSlotProps } from '../env';
import { createFileTree, createOrgChart } from '../data';
import { currency } from '../renderers';

const orgColumns = [
    { field: 'jobTitle', headerName: 'Job title', width: 130 },
    {
        field: 'department',
        headerName: 'Department',
        width: 140,
        type: 'singleSelect',
        valueOptions: ['Executive', 'Engineering', 'Design', 'Sales', 'Finance', 'Operations'],
    },
    { field: 'email', headerName: 'Email', width: 260 },
    { field: 'salary', headerName: 'Salary', type: 'number', width: 130, valueFormatter: (value) => currency(value) },
    { field: 'startDate', headerName: 'Start date', type: 'date', width: 130 },
    { field: 'remote', headerName: 'Remote', type: 'boolean', width: 90 },
];

const fileColumns = [
    {
        field: 'size',
        headerName: 'Size (KB)',
        type: 'number',
        width: 120,
        valueFormatter: (value) => (value === undefined ? '' : `${value.toFixed(1)} KB`),
    },
    { field: 'modified', headerName: 'Modified', type: 'dateTime', width: 200 },
];

export default function TreeDataDemo({ theme }) {
    const [dataset, setDataset] = useState('org');
    const orgRows = useMemo(() => createOrgChart(), []);
    const fileRows = useMemo(() => createFileTree(), []);
    const isOrg = dataset === 'org';

    return (
        <div className="demo-section">
            <div className="demo-controls">
                <div className="demo-segmented" role="radiogroup" aria-label="Dataset">
                    <button type="button" className={isOrg ? 'active' : ''} onClick={() => setDataset('org')}>
                        Org chart ({orgRows.length} people)
                    </button>
                    <button type="button" className={!isOrg ? 'active' : ''} onClick={() => setDataset('files')}>
                        File explorer (auto-generated folders)
                    </button>
                </div>
                <span className="demo-muted">
                    Filtering keeps ancestors of matches · sorting applies per level · selecting a parent selects its
                    descendants
                </span>
            </div>
            <div className="demo-grid" style={{ height: 600 }}>
                <DataGridPro
                    key={dataset}
                    treeData
                    rows={isOrg ? orgRows : fileRows}
                    columns={isOrg ? orgColumns : fileColumns}
                    getTreeDataPath={(row) => (isOrg ? row.hierarchy : row.path)}
                    groupingColDef={{ headerName: isOrg ? 'Hierarchy' : 'Name', width: isOrg ? 300 : 340 }}
                    defaultGroupingExpansionDepth={isOrg ? 1 : -1}
                    checkboxSelection
                    rowSelectionPropagation={{ descendants: true, parents: true }}
                    disableRowSelectionOnClick
                    showToolbar
                    slotProps={{ toolbar: toolbarSlotProps }}
                    theme={theme}
                    aria-label="Tree data"
                />
            </div>
        </div>
    );
}
