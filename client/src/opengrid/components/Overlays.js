import React from 'react';
import { useGridContext } from './GridContext';

export function NoRowsOverlay() {
    const { localeText } = useGridContext();
    return <div className="og-overlay">{localeText.noRowsLabel}</div>;
}

export function NoResultsOverlay() {
    const { localeText } = useGridContext();
    return <div className="og-overlay">{localeText.noResultsOverlayLabel}</div>;
}

export function LoadingOverlay({ variant = 'circular-progress' }) {
    const { rowHeight, layout } = useGridContext();
    if (variant === 'linear-progress') {
        return (
            <div className="og-linear-progress" role="progressbar" aria-label="Loading">
                <div className="og-linear-progress-bar" />
            </div>
        );
    }
    if (variant === 'skeleton') {
        return (
            <div className="og-skeleton-overlay" aria-label="Loading">
                {Array.from({ length: 30 }, (_, i) => (
                    <div key={i} className="og-skeleton-overlay-row" style={{ height: rowHeight }}>
                        {layout.all.slice(0, 12).map((entry, j) => (
                            <div
                                key={entry.field}
                                className="og-skeleton-overlay-cell"
                                style={{ width: entry.width, minWidth: entry.width }}
                            >
                                <span className="og-skeleton" style={{ width: `${45 + ((i * 7 + j * 13) % 45)}%` }} />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className="og-overlay og-overlay--loading" role="progressbar" aria-label="Loading">
            <span className="og-spinner" />
        </div>
    );
}

export function GridOverlays({ top }) {
    const grid = useGridContext();
    const { props, loading, pageIds, store, isLazy } = grid;
    const slots = props.slots || {};
    const slotProps = props.slotProps || {};
    let kind = null;
    let overlay = null;
    if (loading) {
        const options = slotProps.loadingOverlay || {};
        const variant = pageIds.length === 0 ? options.noRowsVariant || options.variant : options.variant;
        kind = `loading-${variant || 'circular-progress'}`;
        const Loading = slots.loadingOverlay || LoadingOverlay;
        overlay = <Loading variant={variant} {...options} />;
    } else if (!isLazy && store.ids.length === 0) {
        kind = 'no-rows';
        const NoRows = slots.noRowsOverlay || NoRowsOverlay;
        overlay = <NoRows {...(slotProps.noRowsOverlay || {})} />;
    } else if (pageIds.length === 0) {
        kind = 'no-results';
        const NoResults = slots.noResultsOverlay || NoResultsOverlay;
        overlay = <NoResults {...(slotProps.noResultsOverlay || {})} />;
    }
    if (!overlay) return null;
    return (
        <div className={`og-overlay-wrapper og-overlay-wrapper--${kind}`} style={{ top }}>
            {overlay}
        </div>
    );
}
