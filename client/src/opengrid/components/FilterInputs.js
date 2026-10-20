import React, { useEffect, useRef, useState } from 'react';
import { getOptionValue, getValueOptions } from '../core/filterOperators';
import { toDateInputValue } from '../core/utils';
import { Icon } from './icons';

const optionLabel = (option, column) => {
    if (column.getOptionLabel) return column.getOptionLabel(option);
    return option !== null && typeof option === 'object' ? option.label : String(option);
};

/** Text/number input that applies its value after a short pause. */
function DebouncedInput({ item, applyValue, type, debounceMs = 300, className, placeholder, autoFocus, label }) {
    const [text, setText] = useState(item.value ?? '');
    const timer = useRef(null);
    const lastApplied = useRef(item.value);

    useEffect(() => {
        if (item.value !== lastApplied.current) {
            lastApplied.current = item.value;
            setText(item.value ?? '');
        }
    }, [item.value]);
    useEffect(() => () => clearTimeout(timer.current), []);

    const onChange = (event) => {
        const next = event.target.value;
        setText(next);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            lastApplied.current = next;
            applyValue({ ...item, value: next });
        }, debounceMs);
    };
    return (
        <input
            className={className}
            type={type}
            value={text}
            onChange={onChange}
            placeholder={placeholder}
            aria-label={label}
            autoFocus={autoFocus} // eslint-disable-line jsx-a11y/no-autofocus
        />
    );
}

function TagsInput({ item, applyValue, className, placeholder, label, type }) {
    const values = Array.isArray(item.value) ? item.value : [];
    const [text, setText] = useState('');
    const commit = () => {
        const parts = text
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
        if (parts.length) applyValue({ ...item, value: [...values, ...parts] });
        setText('');
    };
    return (
        <div className={`og-tags-input ${className || ''}`}>
            {values.map((value, index) => (
                <span className="og-chip" key={`${value}-${index}`}>
                    {String(value)}
                    <button
                        type="button"
                        className="og-chip-delete"
                        aria-label={`Remove ${value}`}
                        onClick={() => applyValue({ ...item, value: values.filter((_, i) => i !== index) })}
                    >
                        <Icon name="close" size={14} />
                    </button>
                </span>
            ))}
            <input
                type={type === 'number' ? 'number' : 'text'}
                value={text}
                aria-label={label}
                placeholder={values.length ? '' : placeholder}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault();
                        commit();
                    } else if (event.key === 'Backspace' && !text && values.length) {
                        applyValue({ ...item, value: values.slice(0, -1) });
                    }
                }}
                onBlur={commit}
            />
        </div>
    );
}

function MultiSelectInput({ item, applyValue, column, className, label }) {
    const values = Array.isArray(item.value) ? item.value.map(String) : [];
    const options = getValueOptions(column);
    const remaining = options.filter((option) => !values.includes(String(getOptionValue(option, column))));
    const labelFor = (value) => {
        const option = options.find((o) => String(getOptionValue(o, column)) === value);
        return option === undefined ? value : optionLabel(option, column);
    };
    return (
        <div className={`og-tags-input ${className || ''}`}>
            {values.map((value) => (
                <span className="og-chip" key={value}>
                    {labelFor(value)}
                    <button
                        type="button"
                        className="og-chip-delete"
                        aria-label={`Remove ${labelFor(value)}`}
                        onClick={() => applyValue({ ...item, value: values.filter((v) => v !== value) })}
                    >
                        <Icon name="close" size={14} />
                    </button>
                </span>
            ))}
            {remaining.length > 0 && (
                <select
                    aria-label={label}
                    value=""
                    onChange={(event) => applyValue({ ...item, value: [...values, event.target.value] })}
                >
                    <option value="">{values.length ? '+' : '…'}</option>
                    {remaining.map((option) => {
                        const value = String(getOptionValue(option, column));
                        return (
                            <option key={value} value={value}>
                                {optionLabel(option, column)}
                            </option>
                        );
                    })}
                </select>
            )}
        </div>
    );
}

/** The value input matching a filter operator (built-in or custom `InputComponent`). */
export function FilterValueInput({
    item,
    column,
    operator,
    applyValue,
    apiRef,
    localeText,
    className,
    autoFocus,
    placeholder,
}) {
    if (!operator || !column || operator.requiresFilterValue === false) return null;
    const label = localeText.filterPanelInputLabel;
    const ph = placeholder ?? localeText.filterPanelInputPlaceholder;
    if (operator.InputComponent) {
        const Input = operator.InputComponent;
        return (
            <Input
                item={item}
                applyValue={applyValue}
                apiRef={apiRef}
                column={column}
                {...operator.InputComponentProps}
            />
        );
    }
    const inputClass = `og-input ${className || ''}`;
    switch (operator.inputType) {
        case 'number':
            return (
                <DebouncedInput
                    key={item.id}
                    item={item}
                    applyValue={applyValue}
                    type="number"
                    className={inputClass}
                    placeholder={ph}
                    autoFocus={autoFocus}
                    label={label}
                />
            );
        case 'date':
        case 'dateTime':
            return (
                <input
                    className={inputClass}
                    type={operator.inputType === 'date' ? 'date' : 'datetime-local'}
                    value={toDateInputValue(item.value, operator.inputType === 'dateTime')}
                    aria-label={label}
                    onChange={(event) => applyValue({ ...item, value: event.target.value })}
                    autoFocus={autoFocus} // eslint-disable-line jsx-a11y/no-autofocus
                />
            );
        case 'boolean':
            return (
                <select
                    className={inputClass}
                    value={item.value === undefined || item.value === null ? '' : String(item.value)}
                    aria-label={label}
                    onChange={(event) => applyValue({ ...item, value: event.target.value })}
                >
                    <option value="">{localeText.filterValueAny}</option>
                    <option value="true">{localeText.filterValueTrue}</option>
                    <option value="false">{localeText.filterValueFalse}</option>
                </select>
            );
        case 'singleSelect':
            return (
                <select
                    className={inputClass}
                    value={item.value === undefined || item.value === null ? '' : String(item.value)}
                    aria-label={label}
                    onChange={(event) => applyValue({ ...item, value: event.target.value })}
                >
                    <option value="" />
                    {getValueOptions(column).map((option) => {
                        const value = String(getOptionValue(option, column));
                        return (
                            <option key={value} value={value}>
                                {optionLabel(option, column)}
                            </option>
                        );
                    })}
                </select>
            );
        case 'multipleText':
            return (
                <TagsInput
                    item={item}
                    applyValue={applyValue}
                    className={className}
                    placeholder={ph}
                    label={label}
                    type={column.type}
                />
            );
        case 'multipleSelect':
            return (
                <MultiSelectInput
                    item={item}
                    applyValue={applyValue}
                    column={column}
                    className={className}
                    label={label}
                />
            );
        case 'text':
        default:
            return (
                <DebouncedInput
                    key={item.id}
                    item={item}
                    applyValue={applyValue}
                    type="text"
                    className={inputClass}
                    placeholder={ph}
                    autoFocus={autoFocus}
                    label={label}
                />
            );
    }
}

export function getOperatorLabel(operator, localeText) {
    if (operator.label) return operator.label;
    const value = operator.value;
    const key = `filterOperator${/^[a-z]/i.test(value) ? value[0].toUpperCase() + value.slice(1) : value}`;
    return localeText[key] || value;
}
