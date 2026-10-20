import { getCellValue } from './columns';
import { clamp } from './utils';

/** Resolves a column's `colSpan` (number or function) for one row. */
export function resolveColSpan(column, row, apiRef) {
    if (!column.colSpan || !row) return 1;
    const span =
        typeof column.colSpan === 'function'
            ? column.colSpan(getCellValue(row, column, apiRef), row, column, apiRef)
            : column.colSpan;
    return Math.max(1, Math.floor(span || 1));
}

/**
 * For one section of one row, maps every column index to the index of the
 * cell that covers it (itself, or a spanning cell to its left).
 */
export function computeSectionSpans(entries, row, apiRef) {
    const startOf = new Array(entries.length);
    const spanOf = new Array(entries.length).fill(1);
    let i = 0;
    while (i < entries.length) {
        const span = Math.min(resolveColSpan(entries[i].column, row, apiRef), entries.length - i);
        spanOf[i] = span;
        for (let k = 0; k < span; k += 1) startOf[i + k] = i;
        i += span;
    }
    return { startOf, spanOf };
}

/**
 * Resolves the width of every visible column. Fixed widths (or widths the user
 * set by resizing) are honoured first; the remaining viewport space is shared
 * between `flex` columns, respecting their min/max widths.
 */
export function computeColumnWidths(columns, viewportWidth, widthOverrides) {
    const widths = new Array(columns.length);
    const flexIndexes = [];
    let fixedTotal = 0;

    columns.forEach((column, index) => {
        const min = column.minWidth ?? 50;
        const max = column.maxWidth ?? Infinity;
        const override = widthOverrides[column.field];
        if (override !== undefined) {
            widths[index] = clamp(override, min, max);
            fixedTotal += widths[index];
        } else if (column.flex) {
            flexIndexes.push(index);
        } else {
            widths[index] = clamp(column.width ?? 100, min, max);
            fixedTotal += widths[index];
        }
    });

    let remaining = Math.max(0, viewportWidth - fixedTotal);
    let unresolved = flexIndexes;
    while (unresolved.length > 0) {
        let totalFlex = 0;
        for (let k = 0; k < unresolved.length; k += 1) totalFlex += columns[unresolved[k]].flex;
        const stillFree = [];
        let constrained = false;
        for (let k = 0; k < unresolved.length; k += 1) {
            const index = unresolved[k];
            const column = columns[index];
            const share = (remaining * column.flex) / totalFlex;
            const min = column.minWidth ?? 50;
            const max = column.maxWidth ?? Infinity;
            if (share < min || share > max) {
                // Freeze columns hitting their bounds, then share what is left again.
                widths[index] = clamp(share, min, max);
                constrained = true;
            } else {
                stillFree.push(index);
            }
        }
        if (!constrained) {
            for (let k = 0; k < unresolved.length; k += 1) {
                const index = unresolved[k];
                widths[index] = Math.floor((remaining * columns[index].flex) / totalFlex);
            }
            break;
        }
        const free = new Set(stillFree);
        let used = 0;
        for (let index = 0; index < columns.length; index += 1) if (!free.has(index)) used += widths[index];
        remaining = Math.max(0, viewportWidth - used);
        unresolved = stillFree;
    }
    return widths;
}

/**
 * Splits the visible columns into the left-pinned / scrollable / right-pinned
 * sections and pre-computes every offset the renderer needs.
 */
export function computeColumnsLayout(visibleColumns, pinnedColumns, viewportWidth, widthOverrides) {
    const byField = new Map(visibleColumns.map((column) => [column.field, column]));
    const leftFields = (pinnedColumns.left || []).filter((field) => byField.has(field));
    const rightFields = (pinnedColumns.right || []).filter(
        (field) => byField.has(field) && !leftFields.includes(field),
    );
    const pinned = new Set([...leftFields, ...rightFields]);

    const left = leftFields.map((field) => byField.get(field));
    const right = rightFields.map((field) => byField.get(field));
    const center = visibleColumns.filter((column) => !pinned.has(column.field));
    const ordered = [...left, ...center, ...right];
    const widths = computeColumnWidths(ordered, viewportWidth, widthOverrides);

    const entries = ordered.map((column, index) => ({
        column,
        field: column.field,
        width: widths[index],
        index,
        section: index < left.length ? 'left' : index < left.length + center.length ? 'center' : 'right',
    }));

    const layout = {
        left: entries.slice(0, left.length),
        center: entries.slice(left.length, left.length + center.length),
        right: entries.slice(left.length + center.length),
        all: entries,
        byField: new Map(entries.map((entry) => [entry.field, entry])),
    };

    let offset = 0;
    layout.left.forEach((entry, i) => {
        entry.offset = offset;
        entry.sectionIndex = i;
        offset += entry.width;
    });
    layout.leftWidth = offset;

    offset = 0;
    layout.center.forEach((entry, i) => {
        entry.offset = offset;
        entry.sectionIndex = i;
        offset += entry.width;
    });
    layout.centerWidth = offset;

    offset = 0;
    layout.right.forEach((entry, i) => {
        entry.offset = offset;
        entry.sectionIndex = i;
        offset += entry.width;
    });
    layout.rightWidth = offset;
    let fromRight = 0;
    for (let i = layout.right.length - 1; i >= 0; i -= 1) {
        layout.right[i].stickyRight = fromRight;
        fromRight += layout.right[i].width;
    }

    layout.totalWidth = layout.leftWidth + layout.centerWidth + layout.rightWidth;
    layout.contentWidth = Math.max(layout.totalWidth, viewportWidth);
    layout.fillerWidth = layout.contentWidth - layout.totalWidth;
    return layout;
}

/** Index range of the scrollable columns intersecting the viewport (plus a buffer). */
export function getCenterColumnRange(layout, scrollLeft, viewportWidth, bufferPx) {
    const { center } = layout;
    if (center.length === 0) return { first: 0, last: -1 };
    const visibleWidth = Math.max(0, viewportWidth - layout.leftWidth - layout.rightWidth);
    const start = Math.max(0, scrollLeft - bufferPx);
    const end = scrollLeft + visibleWidth + bufferPx;
    let lo = 0;
    let hi = center.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (center[mid].offset + center[mid].width <= start) lo = mid + 1;
        else hi = mid;
    }
    const first = lo;
    let last = first;
    while (last + 1 < center.length && center[last + 1].offset < end) last += 1;
    return { first, last };
}

function collectGroupPaths(model) {
    const paths = new Map();
    const walk = (children, path) => {
        children.forEach((child) => {
            if (child.groupId !== undefined) {
                walk(child.children || [], [...path, child]);
            } else if (child.field !== undefined) {
                paths.set(child.field, path);
            }
        });
    };
    walk(model || [], []);
    return paths;
}

/**
 * Builds the rows of grouped column headers (column grouping). Each row lists,
 * per section, the header-group cells with their offsets and widths. Adjacent
 * columns sharing the same group path are merged into a single cell.
 */
export function computeColumnGroupRows(columnGroupingModel, layout) {
    if (!columnGroupingModel || columnGroupingModel.length === 0) return [];
    const paths = collectGroupPaths(columnGroupingModel);
    const depth = Math.max(0, ...layout.all.map((entry) => (paths.get(entry.field) || []).length));
    const rows = [];
    for (let level = 0; level < depth; level += 1) {
        const row = {};
        ['left', 'center', 'right'].forEach((section) => {
            const cells = [];
            layout[section].forEach((entry) => {
                const path = paths.get(entry.field) || [];
                const group = path[level] || null;
                const key = group
                    ? path
                          .slice(0, level + 1)
                          .map((g) => g.groupId)
                          .join('\u0000')
                    : null;
                const previous = cells[cells.length - 1];
                if (group && previous && previous.key === key) {
                    previous.width += entry.width;
                    previous.lastIndex = entry.sectionIndex;
                    previous.fields.push(entry.field);
                } else {
                    cells.push({
                        key,
                        group,
                        // Columns with no group at this depth render an empty filler.
                        isFiller: !group,
                        // The filler visually belongs to the column header below it
                        // when no deeper group exists for that column.
                        isLastLevelForColumn: !group && path.length <= level,
                        offset: entry.offset,
                        width: entry.width,
                        firstIndex: entry.sectionIndex,
                        lastIndex: entry.sectionIndex,
                        fields: [entry.field],
                        depth: level,
                    });
                }
            });
            let fromRight = 0;
            if (section === 'right') {
                for (let i = cells.length - 1; i >= 0; i -= 1) {
                    cells[i].stickyRight = fromRight;
                    fromRight += cells[i].width;
                }
            }
            row[section] = cells;
        });
        rows.push(row);
    }
    return rows;
}
