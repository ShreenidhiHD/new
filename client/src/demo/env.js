// The playground can run embedded in a sandboxed frame (e.g. a hosted preview),
// where file downloads and printing are blocked. Demos use this to hide those
// buttons instead of showing controls that silently do nothing.
export const isEmbedded = (() => {
    try {
        return window.self !== window.top;
    } catch (error) {
        return true;
    }
})();

export const toolbarSlotProps = isEmbedded
    ? { csvOptions: { disableToolbarButton: true }, printOptions: { disableToolbarButton: true } }
    : {};
