export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const isNil = (value) => value === null || value === undefined;

export const isEmptyFilterValue = (value) =>
    isNil(value) || value === '' || (Array.isArray(value) && value.length === 0);

export function toDate(value) {
    if (isNil(value) || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    // `yyyy-mm-dd` strings coming from <input type="date"> are local dates.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

const pad = (n) => String(n).padStart(2, '0');

export function toDateInputValue(value, withTime) {
    const date = toDate(value);
    if (!date) return '';
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return withTime ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

export function escapeRegExp(value) {
    return value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export function debounce(fn, wait) {
    let timer;
    const debounced = (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
    debounced.clear = () => clearTimeout(timer);
    return debounced;
}

export function cssEscape(value) {
    if (typeof window !== 'undefined' && window.CSS && window.CSS.escape) {
        return window.CSS.escape(String(value));
    }
    return String(value).replace(/["\\]/g, '\\$&');
}

export function downloadFile(content, fileName, mimeType) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (error) {
        // Fall through to the legacy path (e.g. insecure context).
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
        ok = document.execCommand('copy');
    } catch (error) {
        ok = false;
    }
    textarea.remove();
    return ok;
}

let idCounter = 0;
export const nextId = (prefix = 'og') => `${prefix}-${(idCounter += 1)}`;

/** Shallow equality for plain arrays. */
export function arraysEqual(a, b) {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false;
    return true;
}

export const classNames = (...names) => names.filter(Boolean).join(' ');
