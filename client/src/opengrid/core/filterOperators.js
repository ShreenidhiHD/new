import { isEmptyFilterValue, isNil, toDate } from './utils';

// Every operator follows the MUI X contract:
//   getApplyFilterFn(filterItem, column) => null | ((value, row, column, apiRef) => boolean)
// `inputType` picks one of OpenGrid's built-in value inputs; custom operators can
// pass a React component as `InputComponent` instead.

const lower = (value) => (isNil(value) ? '' : String(value).toLowerCase());

function stringOperator(value, test) {
    return {
        value,
        inputType: 'text',
        getApplyFilterFn: (item) => {
            if (isEmptyFilterValue(item.value)) return null;
            const query = lower(item.value).trim();
            return (cellValue) => test(lower(cellValue), query);
        },
    };
}

const isEmptyOperator = {
    value: 'isEmpty',
    requiresFilterValue: false,
    getApplyFilterFn: () => (value) => isNil(value) || value === '',
};

const isNotEmptyOperator = {
    value: 'isNotEmpty',
    requiresFilterValue: false,
    getApplyFilterFn: () => (value) => !isNil(value) && value !== '',
};

export function getGridStringOperators() {
    return [
        stringOperator('contains', (v, q) => v.includes(q)),
        stringOperator('doesNotContain', (v, q) => !v.includes(q)),
        stringOperator('equals', (v, q) => v === q),
        stringOperator('doesNotEqual', (v, q) => v !== q),
        stringOperator('startsWith', (v, q) => v.startsWith(q)),
        stringOperator('endsWith', (v, q) => v.endsWith(q)),
        isEmptyOperator,
        isNotEmptyOperator,
        {
            value: 'isAnyOf',
            inputType: 'multipleText',
            getApplyFilterFn: (item) => {
                if (!Array.isArray(item.value) || item.value.length === 0) return null;
                const set = new Set(item.value.map((v) => lower(v).trim()));
                return (value) => set.has(lower(value));
            },
        },
    ];
}

const toNumber = (value) => {
    if (isEmptyFilterValue(value)) return null;
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(number) ? null : number;
};

function numberOperator(value, test) {
    return {
        value,
        inputType: 'number',
        getApplyFilterFn: (item) => {
            const target = toNumber(item.value);
            if (target === null) return null;
            return (cellValue) => {
                const number = toNumber(cellValue);
                return number !== null && test(number, target);
            };
        },
    };
}

export function getGridNumericOperators() {
    return [
        numberOperator('=', (a, b) => a === b),
        numberOperator('!=', (a, b) => a !== b),
        numberOperator('>', (a, b) => a > b),
        numberOperator('>=', (a, b) => a >= b),
        numberOperator('<', (a, b) => a < b),
        numberOperator('<=', (a, b) => a <= b),
        isEmptyOperator,
        isNotEmptyOperator,
        {
            value: 'isAnyOf',
            inputType: 'multipleText',
            getApplyFilterFn: (item) => {
                if (!Array.isArray(item.value) || item.value.length === 0) return null;
                const set = new Set(item.value.map(toNumber).filter((v) => v !== null));
                return (value) => set.has(toNumber(value));
            },
        },
    ];
}

function dateOperator(value, test, withTime) {
    return {
        value,
        inputType: withTime ? 'dateTime' : 'date',
        getApplyFilterFn: (item) => {
            const target = toDate(item.value);
            if (!target) return null;
            const key = (date) => {
                const copy = new Date(date.getTime());
                if (withTime) copy.setSeconds(0, 0);
                else copy.setHours(0, 0, 0, 0);
                return copy.getTime();
            };
            const targetKey = key(target);
            return (cellValue) => {
                const date = toDate(cellValue);
                return date !== null && test(key(date), targetKey);
            };
        },
    };
}

export function getGridDateOperators(withTime = false) {
    return [
        dateOperator('is', (a, b) => a === b, withTime),
        dateOperator('not', (a, b) => a !== b, withTime),
        dateOperator('after', (a, b) => a > b, withTime),
        dateOperator('onOrAfter', (a, b) => a >= b, withTime),
        dateOperator('before', (a, b) => a < b, withTime),
        dateOperator('onOrBefore', (a, b) => a <= b, withTime),
        isEmptyOperator,
        isNotEmptyOperator,
    ];
}

export function getGridBooleanOperators() {
    return [
        {
            value: 'is',
            inputType: 'boolean',
            getApplyFilterFn: (item) => {
                if (item.value === '' || isNil(item.value)) return null;
                const target = item.value === true || item.value === 'true';
                return (value) => Boolean(value) === target;
            },
        },
    ];
}

const optionValue = (option, column) => {
    if (column.getOptionValue) return column.getOptionValue(option);
    return option !== null && typeof option === 'object' ? option.value : option;
};

export function getValueOptions(column, row) {
    const { valueOptions } = column;
    if (typeof valueOptions === 'function') return valueOptions({ field: column.field, row });
    return valueOptions || [];
}

export function getGridSingleSelectOperators() {
    return [
        {
            value: 'is',
            inputType: 'singleSelect',
            getApplyFilterFn: (item) => {
                if (isEmptyFilterValue(item.value)) return null;
                return (value) => String(value) === String(item.value);
            },
        },
        {
            value: 'not',
            inputType: 'singleSelect',
            getApplyFilterFn: (item) => {
                if (isEmptyFilterValue(item.value)) return null;
                return (value) => String(value) !== String(item.value);
            },
        },
        {
            value: 'isAnyOf',
            inputType: 'multipleSelect',
            getApplyFilterFn: (item) => {
                if (!Array.isArray(item.value) || item.value.length === 0) return null;
                const set = new Set(item.value.map(String));
                return (value) => set.has(String(value));
            },
        },
    ];
}

export { optionValue as getOptionValue };
