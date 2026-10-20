import { normalizeColumn } from '../core/columns';
import { buildCsv } from '../core/export';
import { getGridDateOperators, getGridNumericOperators, getGridStringOperators } from '../core/filterOperators';
import {
    computeColumnGroupRows,
    computeColumnsLayout,
    computeSectionSpans,
    getCenterColumnRange,
} from '../core/layout';
import { buildTree, filterTree, flattenTree, TREE_ROOT_ID } from '../core/rows';
import { createRowSizes } from '../core/rowSizes';
import { gridFilterRows, gridSortRows } from '../core/serverUtils';

const op = (operators, value) => operators.find((o) => o.value === value);

describe('filter operators', () => {
    const column = normalizeColumn({ field: 'name' });

    it('string operators are case-insensitive and ignore empty values', () => {
        const contains = op(getGridStringOperators(), 'contains');
        expect(contains.getApplyFilterFn({ value: '' }, column)).toBeNull();
        const fn = contains.getApplyFilterFn({ value: 'ALI' }, column);
        expect(fn('Alice')).toBe(true);
        expect(fn('Bob')).toBe(false);
        expect(fn(null)).toBe(false);
        const anyOf = op(getGridStringOperators(), 'isAnyOf').getApplyFilterFn({ value: ['bob', 'Eve'] }, column);
        expect(anyOf('BOB')).toBe(true);
        expect(anyOf('alice')).toBe(false);
    });

    it('numeric operators parse their value', () => {
        const gt = op(getGridNumericOperators(), '>').getApplyFilterFn({ value: '10' }, column);
        expect(gt(11)).toBe(true);
        expect(gt(10)).toBe(false);
        expect(gt(null)).toBe(false);
        expect(op(getGridNumericOperators(), '=').getApplyFilterFn({ value: 'abc' }, column)).toBeNull();
    });

    it('date operators compare by day', () => {
        const after = op(getGridDateOperators(false), 'after').getApplyFilterFn({ value: '2024-03-10' }, column);
        expect(after(new Date(2024, 2, 10, 23, 59))).toBe(false);
        expect(after(new Date(2024, 2, 11))).toBe(true);
        const is = op(getGridDateOperators(false), 'is').getApplyFilterFn({ value: '2024-03-10' }, column);
        expect(is(new Date(2024, 2, 10, 15))).toBe(true);
    });
});

describe('gridFilterRows / gridSortRows', () => {
    const columns = [
        { field: 'name' },
        { field: 'age', type: 'number' },
        {
            field: 'role',
            type: 'singleSelect',
            valueOptions: [
                { value: 'a', label: 'Admin' },
                { value: 'v', label: 'Viewer' },
            ],
        },
        { field: 'price', type: 'number', valueFormatter: (value) => `$${value.toFixed(2)}` },
    ];
    const rows = [
        { id: 1, name: 'Alice', age: 31, role: 'a', price: 5 },
        { id: 2, name: 'Bob', age: 25, role: 'v', price: 12.5 },
        { id: 3, name: 'Carol', age: 31, role: 'v', price: 7 },
        { id: 4, name: 'dave', age: null, role: 'a', price: 1 },
    ];

    it('combines items with and/or', () => {
        const and = gridFilterRows(rows, columns, {
            items: [
                { field: 'age', operator: '=', value: 31 },
                { field: 'role', operator: 'is', value: 'v' },
            ],
        });
        expect(and.map((r) => r.id)).toEqual([3]);
        const or = gridFilterRows(rows, columns, {
            items: [
                { field: 'age', operator: '=', value: 31 },
                { field: 'role', operator: 'is', value: 'v' },
            ],
            logicOperator: 'or',
        });
        expect(or.map((r) => r.id)).toEqual([1, 2, 3]);
    });

    it('quick filter matches raw and formatted values, every word must match', () => {
        expect(gridFilterRows(rows, columns, { items: [], quickFilterValues: ['admin'] }).map((r) => r.id)).toEqual([
            1, 4,
        ]);
        expect(gridFilterRows(rows, columns, { items: [], quickFilterValues: ['$12.50'] }).map((r) => r.id)).toEqual([
            2,
        ]);
        expect(
            gridFilterRows(rows, columns, { items: [], quickFilterValues: ['a', 'viewer'] }).map((r) => r.id),
        ).toEqual([3]);
    });

    it('multi-sorts with nulls first and stable ties', () => {
        const sorted = gridSortRows(rows, columns, [
            { field: 'age', sort: 'desc' },
            { field: 'name', sort: 'asc' },
        ]);
        expect(sorted.map((r) => r.id)).toEqual([1, 3, 2, 4]);
        expect(gridSortRows(rows, columns, [{ field: 'age', sort: 'asc' }]).map((r) => r.id)).toEqual([4, 2, 1, 3]);
        expect(gridSortRows(rows, columns, [{ field: 'role', sort: 'asc' }]).map((r) => r.role)).toEqual([
            'a',
            'a',
            'v',
            'v',
        ]);
    });
});

describe('tree data', () => {
    const rows = [
        { id: 'b', path: ['A', 'B'] },
        { id: 'c', path: ['A', 'B', 'C'] },
        { id: 'a', path: ['A'] },
        { id: 'x', path: ['X', 'Y'] },
    ];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const tree = buildTree(
        rows.map((r) => r.id),
        byId,
        (row) => row.path,
    );

    it('builds parents, replacing auto-generated ones when the real row shows up', () => {
        expect(tree.root.children).toEqual(['a', 'auto-generated-row-X']);
        expect(tree.nodes.get('a').children).toEqual(['b']);
        expect(tree.nodes.get('b').parent).toBe('a');
        expect(tree.nodes.get('auto-generated-row-X').isAutoGenerated).toBe(true);
        expect(tree.nodes.get('a').descendantCount).toBe(2);
    });

    it('flattens honouring expansion and keeps ancestors of filter matches', () => {
        expect(flattenTree(tree, { isExpanded: () => true })).toEqual(['a', 'b', 'c', 'auto-generated-row-X', 'x']);
        expect(flattenTree(tree, { isExpanded: (node) => node.id === 'a' })).toEqual([
            'a',
            'b',
            'auto-generated-row-X',
        ]);
        const { kept, filteredDescendantCount } = filterTree(tree, (id) => id === 'c');
        expect(
            Array.from(kept)
                .filter((id) => id !== TREE_ROOT_ID)
                .sort(),
        ).toEqual(['a', 'b', 'c']);
        expect(filteredDescendantCount.get('a')).toBe(2);
        expect(kept.has(TREE_ROOT_ID)).toBe(true);
    });
});

describe('column layout', () => {
    const cols = [
        normalizeColumn({ field: 'a', width: 100 }),
        normalizeColumn({ field: 'b', flex: 1, minWidth: 50 }),
        normalizeColumn({ field: 'c', flex: 3, maxWidth: 200 }),
        normalizeColumn({ field: 'd', width: 80 }),
    ];

    it('distributes flex space respecting max width, and computes pinned offsets', () => {
        const layout = computeColumnsLayout(cols, { left: ['d'], right: ['a'] }, 1000, {});
        expect(layout.left.map((e) => e.field)).toEqual(['d']);
        expect(layout.right.map((e) => e.field)).toEqual(['a']);
        const widths = Object.fromEntries(layout.all.map((e) => [e.field, e.width]));
        expect(widths.c).toBe(200); // capped, the rest goes to b
        expect(widths.b).toBe(1000 - 100 - 80 - 200);
        expect(layout.totalWidth).toBe(1000);
        expect(layout.right[0].stickyRight).toBe(0);
    });

    it('user widths override flex, and the visible range is found by binary search', () => {
        const layout = computeColumnsLayout(cols, { left: [], right: [] }, 300, { b: 400 });
        expect(layout.byField.get('b').width).toBe(400);
        // a: 0-100, b: 100-500, c: 500-550 (flex squeezed to its min width), d: 550-630
        const range = getCenterColumnRange(layout, 450, 60, 0);
        expect(layout.center[range.first].field).toBe('b');
        expect(layout.center[range.last].field).toBe('c');
    });

    it('merges adjacent columns of the same group', () => {
        const layout = computeColumnsLayout(cols, { left: [], right: [] }, 1000, {});
        const rows = computeColumnGroupRows(
            [
                {
                    groupId: 'G',
                    children: [{ field: 'a' }, { groupId: 'H', children: [{ field: 'b' }, { field: 'c' }] }],
                },
            ],
            layout,
        );
        expect(rows).toHaveLength(2);
        expect(rows[0].center.map((cell) => cell.group && cell.group.groupId)).toEqual(['G', null]);
        expect(rows[0].center[0].fields).toEqual(['a', 'b', 'c']);
        expect(rows[1].center.map((cell) => cell.group && cell.group.groupId)).toEqual([null, 'H', null]);
    });

    it('resolves column spans', () => {
        const layout = computeColumnsLayout(cols, { left: [], right: [] }, 1000, {});
        const spanned = layout.center.map((entry) =>
            entry.field === 'b' ? { ...entry, column: { ...entry.column, colSpan: 2 } } : entry,
        );
        const { startOf, spanOf } = computeSectionSpans(spanned, { id: 1 }, null);
        expect(startOf).toEqual([0, 1, 1, 3]);
        expect(spanOf[1]).toBe(2);
    });
});

describe('row sizes', () => {
    it('uniform and variable heights agree', () => {
        const uniform = createRowSizes(10, 20);
        const variable = createRowSizes(10, 20, () => 20);
        [0, 19, 20, 199, 500].forEach((y) => expect(variable.indexAt(y)).toBe(uniform.indexAt(y)));
        const mixed = createRowSizes(3, 10, (i) => [10, 100, 10][i]);
        expect(mixed.total).toBe(120);
        expect(mixed.indexAt(50)).toBe(1);
        expect(mixed.offset(2)).toBe(110);
    });
});

describe('csv export', () => {
    it('escapes delimiters, quotes, newlines and formula injection', () => {
        const columns = [
            { field: 'a', headerName: 'A' },
            { field: 'b', headerName: 'B, b' },
        ];
        const csv = buildCsv({
            columns,
            items: [
                { a: 'x,y', b: 'say "hi"' },
                { a: '=SUM(A1)', b: 'line\nbreak' },
                { a: -5, b: '' },
            ],
            getText: (row, column) => String(row[column.field]),
        });
        expect(csv).toBe(['A,"B, b"', '"x,y","say ""hi"""', `'=SUM(A1),"line\nbreak"`, '-5,'].join('\r\n'));
    });
});
