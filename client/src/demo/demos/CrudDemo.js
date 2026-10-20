import React, { useState } from 'react';
import { DataGridPro, GridActionsCellItem, GridToolbarContainer, GridToolbarQuickFilter, Icon } from '../../opengrid';
import { createUsers } from '../data';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function EditToolbar({ onAdd }) {
    return (
        <GridToolbarContainer>
            <button type="button" className="og-button og-button--text" onClick={onAdd}>
                <Icon name="add" size={18} /> Add record
            </button>
            <div className="og-toolbar-spacer" />
            <GridToolbarQuickFilter />
        </GridToolbarContainer>
    );
}

export default function CrudDemo({ theme }) {
    const [rows, setRows] = useState(() => createUsers(40));
    const [rowModesModel, setRowModesModel] = useState({});
    const [toast, setToast] = useState(null);

    const notify = (message, tone = 'success') => {
        setToast({ message, tone, key: Date.now() });
        setTimeout(() => setToast((current) => (current && current.message === message ? null : current)), 3500);
    };

    const setMode = (id, entry) => setRowModesModel((model) => ({ ...model, [id]: entry }));

    const handleAdd = () => {
        const id = Math.max(0, ...rows.map((row) => row.id)) + 1;
        setRows((prev) => [
            { id, name: '', email: '', age: null, role: 'Viewer', joined: new Date(), active: true, isNew: true },
            ...prev,
        ]);
        setMode(id, { mode: 'edit', fieldToFocus: 'name' });
    };

    const handleCancel = (id) => {
        setMode(id, { mode: 'view', ignoreModifications: true });
        const row = rows.find((r) => r.id === id);
        if (row && row.isNew) setRows((prev) => prev.filter((r) => r.id !== id));
    };

    const processRowUpdate = async (newRow) => {
        await delay(350); // pretend to talk to a server
        if (/error/i.test(newRow.name)) throw new Error(`The server rejected "${newRow.name}"`);
        const saved = { ...newRow, isNew: false };
        setRows((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
        notify(`Saved ${saved.name}`);
        return saved;
    };

    const columns = [
        {
            field: 'name',
            headerName: 'Name',
            width: 180,
            editable: true,
            preProcessEditCellProps: ({ props }) => ({
                ...props,
                error: String(props.value || '').trim() ? false : 'Name is required',
            }),
        },
        {
            field: 'email',
            headerName: 'Email',
            width: 240,
            editable: true,
            preProcessEditCellProps: ({ props }) => ({
                ...props,
                error: /^\S+@\S+\.\S+$/.test(props.value || '') ? false : 'Enter a valid email',
            }),
        },
        {
            field: 'age',
            headerName: 'Age',
            type: 'number',
            width: 90,
            editable: true,
            preProcessEditCellProps: ({ props }) => ({
                ...props,
                error: props.value === null || props.value < 18 || props.value > 99 ? 'Age must be 18–99' : false,
            }),
        },
        {
            field: 'role',
            headerName: 'Role',
            type: 'singleSelect',
            valueOptions: ['Admin', 'Editor', 'Viewer'],
            width: 120,
            editable: true,
        },
        { field: 'joined', headerName: 'Joined', type: 'date', width: 140, editable: true },
        { field: 'active', headerName: 'Active', type: 'boolean', width: 90, editable: true },
        {
            field: 'actions',
            type: 'actions',
            headerName: 'Actions',
            width: 110,
            getActions: ({ id }) => {
                const editing = rowModesModel[id] && rowModesModel[id].mode === 'edit';
                if (editing) {
                    return [
                        <GridActionsCellItem
                            key="save"
                            icon={<Icon name="save" size={20} />}
                            label="Save"
                            onClick={() => setMode(id, { mode: 'view' })}
                        />,
                        <GridActionsCellItem
                            key="cancel"
                            icon={<Icon name="close" size={20} />}
                            label="Cancel"
                            onClick={() => handleCancel(id)}
                        />,
                    ];
                }
                return [
                    <GridActionsCellItem
                        key="edit"
                        icon={<Icon name="edit" size={20} />}
                        label="Edit"
                        onClick={() => setMode(id, { mode: 'edit' })}
                    />,
                    <GridActionsCellItem
                        key="delete"
                        icon={<Icon name="delete" size={20} />}
                        label="Delete"
                        onClick={() => {
                            setRows((prev) => prev.filter((row) => row.id !== id));
                            notify('Row deleted', 'info');
                        }}
                    />,
                ];
            },
        },
    ];

    return (
        <div className="demo-section">
            <div className="demo-controls">
                <span className="demo-muted">
                    Row editing with validation. Double-click or press Enter to edit · Tab moves between fields · Enter
                    saves · Esc cancels. A name containing “error” makes the fake server fail.
                </span>
            </div>
            <div className="demo-grid" style={{ height: 560 }}>
                <DataGridPro
                    rows={rows}
                    columns={columns}
                    theme={theme}
                    editMode="row"
                    rowModesModel={rowModesModel}
                    onRowModesModelChange={setRowModesModel}
                    processRowUpdate={processRowUpdate}
                    onProcessRowUpdateError={(error) => notify(error.message, 'error')}
                    slots={{ toolbar: EditToolbar }}
                    slotProps={{ toolbar: { onAdd: handleAdd } }}
                    initialState={{ pinnedColumns: { right: ['actions'] } }}
                    aria-label="Users"
                />
            </div>
            {toast && (
                <div key={toast.key} className={`demo-toast demo-toast--${toast.tone}`} role="status">
                    {toast.message}
                </div>
            )}
        </div>
    );
}
