import { GRID_SPECIAL_FIELDS } from '../constants';
import { downloadFile } from './utils';

function escapeCsv(value, delimiter) {
    const text = String(value ?? '');
    // Neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell).
    const safe = /^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text)) ? `'${text}` : text;
    if (safe.includes(delimiter) || safe.includes('"') || /[\r\n]/.test(safe)) {
        return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
}

export function getExportColumns(columns, { fields, allColumns } = {}) {
    if (fields && fields.length) {
        const byField = new Map(columns.map((column) => [column.field, column]));
        return fields.map((field) => byField.get(field)).filter(Boolean);
    }
    return columns.filter(
        (column) =>
            !GRID_SPECIAL_FIELDS.has(column.field) &&
            column.disableExport !== true &&
            (allColumns || column.__visible !== false),
    );
}

/**
 * `items` are opaque row handles; `getText(item, column)` returns the display
 * text of a cell, so tree-data grouping cells export correctly too.
 */
export function buildCsv({ columns, items, getText, delimiter = ',', includeHeaders = true }) {
    const lines = [];
    if (includeHeaders) {
        lines.push(columns.map((column) => escapeCsv(column.headerName ?? column.field, delimiter)).join(delimiter));
    }
    items.forEach((item) => {
        lines.push(columns.map((column) => escapeCsv(getText(item, column), delimiter)).join(delimiter));
    });
    return lines.join('\r\n');
}

export function exportCsv(csv, { fileName = 'data', utf8WithBom = false } = {}) {
    const content = utf8WithBom ? `﻿${csv}` : csv;
    downloadFile(content, `${fileName}.csv`, 'text/csv;charset=utf-8');
}

export function buildTsv({ columns, items, getText, includeHeaders = false }) {
    const clean = (text) => String(text).replace(/[\t\r\n]+/g, ' ');
    const lines = [];
    if (includeHeaders) lines.push(columns.map((c) => clean(c.headerName ?? c.field)).join('\t'));
    items.forEach((item) => lines.push(columns.map((column) => clean(getText(item, column))).join('\t')));
    return lines.join('\r\n');
}

const escapeHtml = (text) =>
    String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/** Prints the data as a clean HTML table from a hidden iframe. */
export function printRows({ columns, items, getText, title, hideToolbar, pageStyle = '' }) {
    const head = columns
        .map(
            (column) =>
                `<th style="text-align:${column.headerAlign || 'left'}">${escapeHtml(column.headerName ?? column.field)}</th>`,
        )
        .join('');
    const body = items
        .map(
            (item) =>
                `<tr>${columns
                    .map(
                        (column) =>
                            `<td style="text-align:${column.align || 'left'}">${escapeHtml(getText(item, column))}</td>`,
                    )
                    .join('')}</tr>`,
        )
        .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title || document.title)}</title>
<style>
body{font-family:Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#000;margin:16px}
h1{font-size:16px;font-weight:500;margin:0 0 12px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ccc;padding:4px 8px}
th{background:#f5f5f5;font-weight:600}
tr{break-inside:avoid}
${pageStyle}
</style></head><body>${hideToolbar ? '' : `<h1>${escapeHtml(title || '')}</h1>`}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    const cleanup = () => setTimeout(() => iframe.remove(), 500);
    iframe.contentWindow.addEventListener('afterprint', cleanup);
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Some browsers never fire `afterprint` for iframes.
        setTimeout(cleanup, 60000);
    }, 50);
}
