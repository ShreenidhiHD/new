import React from 'react';
import { COUNTRIES, STATUSES } from './data';

const currencyFormats = new Map();
export const currency = (value, code = 'USD') => {
    if (typeof value !== 'number') return value;
    let format = currencyFormats.get(code);
    if (!format) {
        format = new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 2 });
        currencyFormats.set(code, format);
    }
    return format.format(value);
};

export const percent = (value, digits = 1) =>
    typeof value === 'number' ? `${(value * 100).toFixed(digits)} %` : value;

const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));
const COUNTRY_LABEL = Object.fromEntries(COUNTRIES.map((c) => [c.value, c.label]));

export function StatusChip({ value }) {
    if (!value) return null;
    return (
        <span className={`demo-chip demo-chip--${String(value).toLowerCase()}`}>{STATUS_LABEL[value] || value}</span>
    );
}

export function ProgressBar({ value }) {
    const ratio = Math.max(0, Math.min(1, Number(value) || 0));
    const tone = ratio < 0.3 ? 'low' : ratio < 0.7 ? 'mid' : 'high';
    return (
        <div className="demo-progress" title={percent(ratio)}>
            <div className={`demo-progress-bar demo-progress-bar--${tone}`} style={{ width: `${ratio * 100}%` }} />
            <span className="demo-progress-label">{percent(ratio, 0)}</span>
        </div>
    );
}

export function Pnl({ value, formattedValue }) {
    if (typeof value !== 'number') return null;
    return <span className={value >= 0 ? 'demo-positive' : 'demo-negative'}>{formattedValue}</span>;
}

export function Country({ value }) {
    return <span>{COUNTRY_LABEL[value] || value}</span>;
}

export function Avatar({ name }) {
    const initials = String(name || '?')
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('');
    let hash = 0;
    for (let i = 0; i < String(name).length; i += 1) hash = (hash * 31 + String(name).charCodeAt(i)) % 360;
    return (
        <span className="demo-avatar" style={{ background: `hsl(${hash} 55% 46%)` }}>
            {initials}
        </span>
    );
}
