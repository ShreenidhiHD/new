import { createContext, useContext } from 'react';

export const GridContext = createContext(null);

export function useGridContext() {
    const grid = useContext(GridContext);
    if (!grid) throw new Error('OpenGrid: this component must be rendered inside <DataGrid />.');
    return grid;
}
