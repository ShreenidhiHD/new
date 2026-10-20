import React, { useMemo } from 'react';
import { DataGridPro } from '../../opengrid';

const SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
const field = (index) => `slot${index}`;
const fill = (value, from, to) =>
    Object.fromEntries(Array.from({ length: to - from }, (_, i) => [field(from + i), value]));

const timetable = {
    Monday: ['Maths', 'Maths', 'Physics', 'English', 'Lunch', 'Chemistry', 'Chemistry', 'Sport', 'Sport'],
    Tuesday: ['History', 'Geography', 'Maths', 'Maths', 'Lunch', 'Art', 'Art', 'Art', 'Music'],
    Wednesday: [
        'Physics',
        'Physics',
        'English',
        'Biology',
        'Lunch',
        'Maths',
        'Computer Science',
        'Computer Science',
        'Computer Science',
    ],
    Thursday: ['English', 'English', 'Chemistry', 'Spanish', 'Lunch', 'History', 'Biology', 'Biology', 'Free study'],
    Friday: [
        'Maths',
        'Spanish',
        'Spanish',
        'Physics',
        'Lunch',
        'Project work',
        'Project work',
        'Project work',
        'Project work',
    ],
};

const COLORS = {
    Maths: '#e3f2fd',
    Physics: '#ede7f6',
    English: '#fce4ec',
    Lunch: '#fff8e1',
    Chemistry: '#e8f5e9',
    Sport: '#e0f7fa',
    'Project work': '#f3e5f5',
    'Computer Science': '#e8eaf6',
    Art: '#fff3e0',
};

/** Span a lesson over every following slot holding the same subject. */
const spanSameSubject = (value, row, column) => {
    if (!value) return 1;
    const index = SLOTS.findIndex((_, i) => field(i) === column.field);
    let span = 1;
    while (index + span < SLOTS.length && row[field(index + span)] === value) span += 1;
    return span;
};

export default function SpanningDemo({ theme }) {
    const rows = useMemo(
        () =>
            Object.entries(timetable).map(([day, lessons]) => ({
                id: day,
                day,
                ...Object.fromEntries(lessons.map((lesson, i) => [field(i), lesson])),
            })),
        [],
    );

    const columns = useMemo(
        () => [
            { field: 'day', headerName: 'Day', width: 120, sortable: false },
            ...SLOTS.map((slot, i) => ({
                field: field(i),
                headerName: slot,
                width: 130,
                sortable: false,
                colSpan: spanSameSubject,
                cellClassName: 'demo-lesson',
                renderCell: (params) =>
                    params.value ? (
                        <span
                            className="demo-lesson-chip"
                            style={{ background: theme === 'dark' ? undefined : COLORS[params.value] }}
                        >
                            {params.value}
                        </span>
                    ) : null,
            })),
        ],
        [theme],
    );

    const pinnedRows = useMemo(
        () => ({
            top: [{ id: 'assembly', day: 'Every day', ...fill('Morning assembly — whole school', 0, 2) }],
            bottom: [{ id: 'clubs', day: 'Weekend', ...fill('Clubs & societies (optional)', 0, 9) }],
        }),
        [],
    );

    return (
        <div className="demo-section">
            <div className="demo-controls">
                <span className="demo-muted">
                    <code>colSpan</code> merges consecutive lessons · the first and last rows are pinned · the day
                    column is pinned left. Try arrow keys — spanned cells are one stop.
                </span>
            </div>
            <div className="demo-grid" style={{ height: 482 }}>
                <DataGridPro
                    rows={rows}
                    columns={columns}
                    theme={theme}
                    pinnedRows={pinnedRows}
                    showCellVerticalBorder
                    showColumnVerticalBorder
                    disableColumnReorder
                    hideFooter
                    initialState={{ pinnedColumns: { left: ['day'] } }}
                    columnGroupingModel={[
                        {
                            groupId: 'Morning',
                            headerAlign: 'center',
                            children: [0, 1, 2, 3].map((i) => ({ field: field(i) })),
                        },
                        { groupId: 'Break', headerAlign: 'center', children: [{ field: field(4) }] },
                        {
                            groupId: 'Afternoon',
                            headerAlign: 'center',
                            children: [5, 6, 7, 8].map((i) => ({ field: field(i) })),
                        },
                    ]}
                    aria-label="School timetable"
                />
            </div>
        </div>
    );
}
