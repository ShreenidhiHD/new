import { useCallback, useRef, useState } from 'react';

/**
 * Controlled/uncontrolled state in the MUI X style: when `controlled` is
 * defined the parent owns the value and is notified through `onChange`;
 * otherwise the grid keeps it internally (seeded from `defaultValue`).
 * The returned ref always holds the latest value, including updates that
 * have not rendered yet, so imperative API calls can chain safely.
 */
export function useModel(controlled, defaultValue, onChange) {
    const [internal, setInternal] = useState(defaultValue);
    const isControlled = controlled !== undefined;
    const value = isControlled ? controlled : internal;

    const valueRef = useRef(value);
    valueRef.current = value;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const setValue = useCallback((next, details) => {
        const resolved = typeof next === 'function' ? next(valueRef.current) : next;
        if (Object.is(resolved, valueRef.current)) return;
        valueRef.current = resolved;
        setInternal(resolved);
        if (onChangeRef.current) onChangeRef.current(resolved, details || {});
    }, []);

    return [value, setValue, valueRef];
}

/** Like `useRef` but always pointing at the latest render's value. */
export function useLatest(value) {
    const ref = useRef(value);
    ref.current = value;
    return ref;
}
