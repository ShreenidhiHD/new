import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { classNames } from '../core/utils';

const GAP = 4;
const MARGIN = 8;

/**
 * Floating layer rendered in a portal (so it is never clipped by the grid),
 * anchored to `anchorEl`, closed by click-away or Escape.
 */
export function Popper({
    open,
    anchorEl,
    anchorRect,
    onClose,
    placement = 'bottom-start',
    themeClass,
    className,
    children,
    role,
    ariaLabel,
    restoreFocus = true,
}) {
    const popperRef = useRef(null);
    const [position, setPosition] = useState(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const update = useCallback(() => {
        const element = popperRef.current;
        if (!element) return;
        const rect = anchorRect || (anchorEl && anchorEl.isConnected ? anchorEl.getBoundingClientRect() : null);
        if (!rect) return;
        const { width, height } = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let left = placement.endsWith('end') ? rect.right - width : rect.left;
        let top = rect.bottom + GAP;
        if (top + height > viewportHeight - MARGIN && rect.top - height - GAP > MARGIN) {
            top = rect.top - height - GAP;
        }
        left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, viewportWidth - width - MARGIN));
        top = Math.min(Math.max(MARGIN, top), Math.max(MARGIN, viewportHeight - height - MARGIN));
        setPosition((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
    }, [anchorEl, anchorRect, placement]);

    useLayoutEffect(() => {
        if (!open) {
            setPosition(null);
            return undefined;
        }
        update();
        const frame = requestAnimationFrame(update);
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        let observer;
        if (typeof ResizeObserver !== 'undefined' && popperRef.current) {
            observer = new ResizeObserver(update);
            observer.observe(popperRef.current);
        }
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
            if (observer) observer.disconnect();
        };
    }, [open, update]);

    useEffect(() => {
        if (!open) return undefined;
        const element = popperRef.current;
        const previouslyFocused = document.activeElement;
        const onPointerDown = (event) => {
            const target = event.target;
            if (element && element.contains(target)) return;
            if (anchorEl && anchorEl.contains && anchorEl.contains(target)) return;
            // Clicks inside another OpenGrid popper (e.g. a nested menu) are not click-away.
            if (target instanceof Element && target.closest('.og-popper')) return;
            onCloseRef.current(event, 'clickAway');
        };
        document.addEventListener('mousedown', onPointerDown, true);
        return () => {
            document.removeEventListener('mousedown', onPointerDown, true);
            // Return focus to where it was, unless the user moved it elsewhere.
            const active = document.activeElement;
            const focusWasInside = !active || active === document.body || (element && element.contains(active));
            if (
                restoreFocus &&
                focusWasInside &&
                previouslyFocused &&
                previouslyFocused.isConnected &&
                previouslyFocused.focus
            ) {
                previouslyFocused.focus({ preventScroll: true });
            }
        };
    }, [open, anchorEl, restoreFocus]);

    if (!open || typeof document === 'undefined') return null;
    return createPortal(
        <div
            ref={popperRef}
            className={classNames('og-popper', themeClass, className)}
            role={role}
            aria-label={ariaLabel}
            style={{
                position: 'fixed',
                top: position ? position.top : 0,
                left: position ? position.left : 0,
                visibility: position ? 'visible' : 'hidden',
            }}
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    event.stopPropagation();
                    onCloseRef.current(event, 'escapeKeyDown');
                }
            }}
        >
            {children}
        </div>,
        document.body,
    );
}

/** Keyboard-navigable menu (ArrowUp/ArrowDown/Home/End), autofocusing its first item. */
export function Menu({ children, autoFocus = true, className, ...other }) {
    const menuRef = useRef(null);
    useEffect(() => {
        if (!autoFocus || !menuRef.current) return;
        const first = menuRef.current.querySelector('[role="menuitem"]:not([disabled])');
        if (first) first.focus({ preventScroll: true });
    }, [autoFocus]);
    const onKeyDown = (event) => {
        const items = Array.from(menuRef.current.querySelectorAll('[role="menuitem"]:not([disabled])'));
        const index = items.indexOf(document.activeElement);
        let next = null;
        if (event.key === 'ArrowDown') next = items[(index + 1) % items.length];
        else if (event.key === 'ArrowUp') next = items[(index - 1 + items.length) % items.length];
        else if (event.key === 'Home') next = items[0];
        else if (event.key === 'End') next = items[items.length - 1];
        else if (event.key === 'Tab') event.preventDefault();
        if (next) {
            event.preventDefault();
            next.focus();
        }
    };
    return (
        <div ref={menuRef} role="menu" className={classNames('og-menu', className)} onKeyDown={onKeyDown} {...other}>
            {children}
        </div>
    );
}

export function MenuItem({ icon, children, onClick, disabled, selected, className, ...other }) {
    return (
        <button
            type="button"
            role="menuitem"
            className={classNames('og-menu-item', selected && 'og-menu-item--selected', className)}
            onClick={onClick}
            disabled={disabled}
            tabIndex={-1}
            {...other}
        >
            <span className="og-menu-item-icon">{icon}</span>
            <span className="og-menu-item-label">{children}</span>
        </button>
    );
}

export const MenuDivider = () => <div className="og-menu-divider" role="separator" />;
