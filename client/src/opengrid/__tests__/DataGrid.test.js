import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DataGrid, useGridApiRef } from '..';

const rows = [
    { id: 1, name: 'Alice', age: 31, active: true },
    { id: 2, name: 'Bob', age: 25, active: false },
    { id: 3, name: 'Carol', age: 42, active: true },
];
const columns = [
    { field: 'name', headerName: 'Name', editable: true },
    { field: 'age', headerName: 'Age', type: 'number', editable: true },
    { field: 'active', headerName: 'Active', type: 'boolean' },
];

const bodyRows = (container) => Array.from(container.querySelectorAll('.og-virtual-body .og-row'));
const columnValues = (container, field) =>
    bodyRows(container).map((row) => row.querySelector(`.og-cell[data-field="${field}"]`).textContent);
const header = (container, field) => container.querySelector(`.og-column-header[data-field="${field}"]`);
const cell = (container, rowIndex, field) =>
    container.querySelector(`.og-virtual-body .og-row[data-rowindex="${rowIndex}"] .og-cell[data-field="${field}"]`);

describe('<DataGrid />', () => {
    it('renders headers, rows and the row count', () => {
        const { container } = render(<DataGrid rows={rows} columns={columns} />);
        expect(screen.getByRole('grid')).toHaveAttribute('aria-colcount', '3');
        expect(within(header(container, 'name')).getByText('Name')).toBeInTheDocument();
        expect(columnValues(container, 'name')).toEqual(['Alice', 'Bob', 'Carol']);
        expect(screen.getByText(/Total Rows:/)).toHaveTextContent('Total Rows: 3');
    });

    it('sorts on header click and supports a controlled sortModel', () => {
        const onSortModelChange = jest.fn();
        const { container, rerender } = render(
            <DataGrid rows={rows} columns={columns} onSortModelChange={onSortModelChange} />,
        );
        fireEvent.click(header(container, 'age'));
        expect(columnValues(container, 'age')).toEqual(['25', '31', '42']);
        expect(header(container, 'age')).toHaveAttribute('aria-sort', 'ascending');
        fireEvent.click(header(container, 'age'));
        expect(columnValues(container, 'age')).toEqual(['42', '31', '25']);
        expect(onSortModelChange).toHaveBeenLastCalledWith([{ field: 'age', sort: 'desc' }], expect.anything());
        rerender(<DataGrid rows={rows} columns={columns} sortModel={[{ field: 'name', sort: 'desc' }]} />);
        expect(columnValues(container, 'name')).toEqual(['Carol', 'Bob', 'Alice']);
    });

    it('selects rows with checkboxes, shift ranges and select-all', () => {
        const onChange = jest.fn();
        const { container } = render(
            <DataGrid rows={rows} columns={columns} checkboxSelection onRowSelectionModelChange={onChange} />,
        );
        fireEvent.click(cell(container, 0, '__check__').querySelector('input'));
        expect(onChange).toHaveBeenLastCalledWith([1], expect.anything());
        fireEvent.click(cell(container, 2, '__check__').querySelector('input'), { shiftKey: true });
        expect(onChange).toHaveBeenLastCalledWith([1, 2, 3], expect.anything());
        expect(screen.getByText('3 rows selected')).toBeInTheDocument();
        fireEvent.click(header(container, '__check__').querySelector('input'));
        expect(onChange).toHaveBeenLastCalledWith([], expect.anything());
    });

    it('edits a cell and calls processRowUpdate', async () => {
        const processRowUpdate = jest.fn((row) => row);
        const { container } = render(<DataGrid rows={rows} columns={columns} processRowUpdate={processRowUpdate} />);
        fireEvent.doubleClick(cell(container, 1, 'name'));
        const input = await waitFor(() => {
            const element = cell(container, 1, 'name').querySelector('input');
            expect(element).not.toBeNull();
            return element;
        });
        fireEvent.change(input, { target: { value: 'Bobby' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() =>
            expect(processRowUpdate).toHaveBeenCalledWith({ ...rows[1], name: 'Bobby' }, rows[1], { rowId: 2 }),
        );
        await waitFor(() => expect(cell(container, 1, 'name')).toHaveTextContent('Bobby'));
    });

    it('moves focus with the keyboard', () => {
        const { container } = render(<DataGrid rows={rows} columns={columns} />);
        fireEvent.click(cell(container, 0, 'name'));
        fireEvent.keyDown(cell(container, 0, 'name'), { key: 'ArrowDown' });
        expect(document.activeElement).toBe(cell(container, 1, 'name'));
        fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' });
        expect(document.activeElement).toBe(cell(container, 1, 'age'));
        fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' });
        fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' });
        expect(document.activeElement).toBe(header(container, 'age'));
    });

    it('exposes an imperative API (filter, csv, state)', () => {
        let api;
        function Harness() {
            const apiRef = useGridApiRef();
            api = apiRef;
            return <DataGrid apiRef={apiRef} rows={rows} columns={columns} />;
        }
        const { container } = render(<Harness />);
        act(() => api.current.setFilterModel({ items: [{ field: 'active', operator: 'is', value: 'true' }] }));
        expect(columnValues(container, 'name')).toEqual(['Alice', 'Carol']);
        expect(api.current.getDataAsCsv()).toBe('Name,Age,Active\r\nAlice,31,true\r\nCarol,42,true');
        act(() => {
            api.current.sortColumn('age', 'desc');
            api.current.setColumnVisibility('active', false);
        });
        const state = api.current.exportState();
        expect(state.sorting.sortModel).toEqual([{ field: 'age', sort: 'desc' }]);
        expect(state.columns.columnVisibilityModel).toEqual({ active: false });
        act(() =>
            api.current.restoreState({
                sorting: { sortModel: [] },
                filter: { filterModel: { items: [] } },
                columns: { columnVisibilityModel: {} },
            }),
        );
        expect(columnValues(container, 'name')).toEqual(['Alice', 'Bob', 'Carol']);
        act(() =>
            api.current.updateRows([
                { id: 4, name: 'Dan', age: 18, active: false },
                { id: 1, _action: 'delete' },
            ]),
        );
        expect(columnValues(container, 'name')).toEqual(['Bob', 'Carol', 'Dan']);
    });

    it('renders tree data with expandable groups', () => {
        const treeRows = [
            { id: 1, path: ['Root'], size: 3 },
            { id: 2, path: ['Root', 'Child A'], size: 1 },
            { id: 3, path: ['Root', 'Child B'], size: 2 },
        ];
        const { container } = render(
            <DataGrid
                treeData
                rows={treeRows}
                columns={[{ field: 'size', type: 'number' }]}
                getTreeDataPath={(row) => row.path}
            />,
        );
        expect(screen.getByRole('treegrid')).toBeInTheDocument();
        expect(bodyRows(container)).toHaveLength(1);
        expect(screen.getByText('Root (2)')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'see children' }));
        expect(bodyRows(container).map((row) => row.getAttribute('aria-level'))).toEqual(['1', '2', '2']);
    });

    it('toggles master-detail panels and renders pinned rows', () => {
        const { container } = render(
            <DataGrid
                rows={rows}
                columns={columns}
                getDetailPanelContent={({ row }) => <div>Details of {row.name}</div>}
                getDetailPanelHeight={() => 100}
                pinnedRows={{ bottom: [{ id: 'total', name: 'Total', age: 98 }] }}
            />,
        );
        fireEvent.click(cell(container, 0, '__detail_panel_toggle__').querySelector('button'));
        expect(screen.getByText('Details of Alice')).toBeInTheDocument();
        expect(container.querySelector('.og-pinned-rows--bottom')).toHaveTextContent('Total');
    });

    it('filters from the toolbar quick filter', async () => {
        jest.useFakeTimers();
        const { container } = render(<DataGrid rows={rows} columns={columns} showToolbar />);
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'car' } });
        act(() => jest.advanceTimersByTime(600));
        expect(columnValues(container, 'name')).toEqual(['Carol']);
        jest.useRealTimers();
    });

    it('works fully controlled', () => {
        function Controlled() {
            const [model, setModel] = useState({ page: 0, pageSize: 2 });
            return (
                <DataGrid
                    rows={rows}
                    columns={columns}
                    pagination
                    pageSizeOptions={[2, 5]}
                    paginationModel={model}
                    onPaginationModelChange={setModel}
                />
            );
        }
        const { container } = render(<Controlled />);
        expect(columnValues(container, 'name')).toEqual(['Alice', 'Bob']);
        fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
        expect(columnValues(container, 'name')).toEqual(['Carol']);
        expect(screen.getByText('3–3 of 3')).toBeInTheDocument();
    });
});
