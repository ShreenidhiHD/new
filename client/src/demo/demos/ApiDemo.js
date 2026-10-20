import React, { useEffect, useMemo, useState } from 'react';
import { DataGridPro, esES, useGridApiRef } from '../../opengrid';
import { createUsers } from '../data';

const columns = [
    { field: 'id', headerName: 'ID', type: 'number', width: 80 },
    { field: 'name', headerName: 'Name', width: 180, editable: true },
    { field: 'email', headerName: 'Email', width: 240 },
    { field: 'age', headerName: 'Age', type: 'number', width: 90, editable: true },
    {
        field: 'role',
        headerName: 'Role',
        type: 'singleSelect',
        valueOptions: ['Admin', 'Editor', 'Viewer'],
        width: 120,
        editable: true,
    },
    { field: 'joined', headerName: 'Joined', type: 'date', width: 130 },
    { field: 'active', headerName: 'Active', type: 'boolean', width: 90 },
];

const STORAGE_KEY = 'opengrid-demo-state';

function readSaved() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

export default function ApiDemo({ theme }) {
    const apiRef = useGridApiRef();
    const rows = useMemo(() => createUsers(2000, 17), []);
    const [events, setEvents] = useState([]);
    const [saved, setSaved] = useState(readSaved);
    const [language, setLanguage] = useState('en');
    const [nextId, setNextId] = useState(2001);

    useEffect(() => {
        const api = apiRef.current;
        const log = (name) => (params) => {
            const detail =
                name === 'rowClick' || name === 'cellDoubleClick'
                    ? `row ${params.id}${params.field ? ` · ${params.field}` : ''}`
                    : name === 'columnHeaderClick'
                      ? params.field
                      : name === 'rowSelectionChange'
                        ? `${params.length} selected`
                        : name === 'sortModelChange'
                          ? params.map((s) => `${s.field} ${s.sort}`).join(', ') || 'none'
                          : name === 'columnOrderChange'
                            ? `${params.field} → ${params.targetIndex}`
                            : '';
            setEvents((prev) => [{ name, detail, at: new Date().toLocaleTimeString() }, ...prev].slice(0, 12));
        };
        const names = [
            'rowClick',
            'cellDoubleClick',
            'columnHeaderClick',
            'rowSelectionChange',
            'sortModelChange',
            'columnOrderChange',
            'cellEditStart',
            'cellEditStop',
        ];
        const unsubscribe = names.map((name) => api.subscribeEvent(name, log(name)));
        return () => unsubscribe.forEach((fn) => fn());
    }, [apiRef]);

    const run = (fn) => () => fn(apiRef.current);

    const actions = [
        {
            label: 'Select & scroll to a random row',
            fn: (api) => {
                const ids = api.getVisibleRowIds();
                const id = ids[Math.floor(Math.random() * ids.length)];
                api.selectRow(id, true, true);
                api.setCellFocus(id, 'name');
            },
        },
        { label: 'Sort by age ↓', fn: (api) => api.sortColumn('age', 'desc') },
        {
            label: 'Filter: active admins',
            fn: (api) =>
                api.setFilterModel({
                    items: [
                        { id: 1, field: 'role', operator: 'is', value: 'Admin' },
                        { id: 2, field: 'active', operator: 'is', value: 'true' },
                    ],
                    logicOperator: 'and',
                }),
        },
        { label: 'Clear filters', fn: (api) => api.setFilterModel({ items: [], quickFilterValues: [] }) },
        { label: 'Pin "Name" left', fn: (api) => api.pinColumn('name', 'left') },
        {
            label: 'Toggle "Email"',
            fn: (api) => api.setColumnVisibility('email', !api.getVisibleColumns().some((c) => c.field === 'email')),
        },
        { label: 'Autosize columns', fn: (api) => api.autosizeColumns() },
        {
            label: 'Add 3 rows (updateRows)',
            fn: (api) => {
                api.updateRows(
                    [0, 1, 2].map((i) => ({
                        id: nextId + i,
                        name: `New person ${nextId + i}`,
                        email: `new${nextId + i}@example.com`,
                        age: 30,
                        role: 'Viewer',
                        joined: new Date(),
                        active: true,
                    })),
                );
                setNextId(nextId + 3);
                api.scroll({ top: 1e9 });
            },
        },
        { label: 'Open filter panel', fn: (api) => api.showFilterPanel('name') },
        { label: 'Export CSV', fn: (api) => api.exportDataAsCsv({ fileName: 'users' }) },
        { label: 'Print', fn: (api) => api.exportDataAsPrint({ fileName: 'Users' }) },
        {
            label: 'Save state',
            fn: (api) => {
                const state = api.exportState();
                setSaved(state);
                try {
                    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                } catch (error) {
                    // Storage can be unavailable (private mode); the in-memory copy still works.
                }
            },
        },
        { label: 'Restore state', fn: (api) => saved && api.restoreState(saved), disabled: !saved },
    ];

    return (
        <div className="demo-section">
            <div className="demo-controls demo-actions">
                {actions.map((action) => (
                    <button
                        key={action.label}
                        type="button"
                        className="demo-button"
                        onClick={run(action.fn)}
                        disabled={action.disabled}
                    >
                        {action.label}
                    </button>
                ))}
                <label className="demo-select">
                    Locale
                    <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                    </select>
                </label>
            </div>
            <div className="demo-split">
                <div className="demo-grid" style={{ height: 560 }}>
                    <DataGridPro
                        apiRef={apiRef}
                        rows={rows}
                        columns={columns}
                        theme={theme}
                        checkboxSelection
                        showToolbar
                        pagination
                        pageSizeOptions={[25, 100, 500]}
                        initialState={{ pagination: { paginationModel: { page: 0, pageSize: 100 } } }}
                        localeText={language === 'es' ? esES : undefined}
                        aria-label="Users (API demo)"
                    />
                </div>
                <aside className="demo-log" aria-label="Events">
                    <div className="demo-log-title">Events (apiRef.subscribeEvent)</div>
                    {events.length === 0 && <div className="demo-muted">Click rows, headers, select…</div>}
                    {events.map((event, index) => (
                        <div key={index} className="demo-log-entry">
                            <code>{event.name}</code> <span className="demo-muted">{event.detail}</span>
                        </div>
                    ))}
                    {saved && (
                        <>
                            <div className="demo-log-title" style={{ marginTop: 16 }}>
                                Saved state (exportState)
                            </div>
                            <pre className="demo-json">
                                {JSON.stringify({ ...saved, columns: { ...saved.columns, dimensions: '…' } }, null, 2)}
                            </pre>
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}
