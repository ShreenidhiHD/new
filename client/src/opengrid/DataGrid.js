import React, { forwardRef, useRef } from 'react';
import { classNames } from './core/utils';
import { GridBody } from './components/GridBody';
import { GridContext } from './components/GridContext';
import { GridFooter } from './components/Footer';
import { GridColumnMenu, GridPanels } from './components/Panels';
import { GridToolbar } from './components/Toolbar';
import { useGridController } from './hooks/useGridController';
import './styles.css';

/**
 * OpenGrid — a zero-dependency React data grid with the MUI X Data Grid Pro
 * feature set (virtualization, pinning, tree data, master detail, row
 * reordering, header filters, multi sort/filter, editing, export…).
 */
export const DataGrid = forwardRef(function DataGrid(inProps, ref) {
    const grid = useGridController(inProps);
    const { props, density, dragState, treeData, layout, store, groupRows } = grid;
    const slots = props.slots || {};
    const slotProps = props.slotProps || {};
    const Toolbar = slots.toolbar || (props.showToolbar ? GridToolbar : null);
    const Footer = slots.footer || GridFooter;

    const setRootRef = (element) => {
        grid.rootRef.current = element;
        if (typeof ref === 'function') ref(element);
        else if (ref) ref.current = element;
    };

    return (
        <GridContext.Provider value={grid}>
            <div
                ref={setRootRef}
                className={classNames(
                    'og-root',
                    grid.themeClass,
                    `og-density-${density}`,
                    props.autoHeight && 'og-root--auto-height',
                    props.showCellVerticalBorder && 'og-root--cell-borders',
                    props.showColumnVerticalBorder && 'og-root--column-borders',
                    dragState && `og-root--dragging-${dragState.type}`,
                    props.className,
                )}
                style={props.style}
                role={treeData ? 'treegrid' : 'grid'}
                aria-label={props['aria-label']}
                aria-labelledby={props['aria-labelledby']}
                aria-rowcount={
                    groupRows.length +
                    1 +
                    (props.headerFilters ? 1 : 0) +
                    store.ids.length +
                    grid.pinned.top.length +
                    grid.pinned.bottom.length
                }
                aria-colcount={layout.all.length}
                aria-multiselectable={!props.disableMultipleRowSelection}
                onKeyDown={grid.handleKeyDown}
            >
                {Toolbar && <Toolbar {...(slotProps.toolbar || {})} />}
                <GridBody />
                {!props.hideFooter && <Footer {...(slotProps.footer || {})} />}
                <GridColumnMenu />
                <GridPanels />
            </div>
        </GridContext.Provider>
    );
});

/** Alias kept for drop-in compatibility with `@mui/x-data-grid-pro`. */
export const DataGridPro = DataGrid;

/** Creates the ref to pass as `apiRef` to access the imperative API. */
export function useGridApiRef() {
    return useRef(null);
}
