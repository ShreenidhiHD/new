import { useEffect, useState } from 'react';
import ApiDemo from '../demo/demos/ApiDemo';
import CrudDemo from '../demo/demos/CrudDemo';
import FullFeaturedDemo from '../demo/demos/FullFeaturedDemo';
import MasterDetailDemo from '../demo/demos/MasterDetailDemo';
import ServerSideDemo from '../demo/demos/ServerSideDemo';
import SpanningDemo from '../demo/demos/SpanningDemo';
import TreeDataDemo from '../demo/demos/TreeDataDemo';
import '../demo/demo.css';
import './styles/App.css';

const DEMOS = [
    {
        id: 'full',
        label: 'Full featured',
        component: FullFeaturedDemo,
        blurb: 'Virtualized rows & columns, pinned columns and rows, column groups, multi-sort (shift-click), multi-filter, header filters, master detail, cell editing, row reordering, export and clipboard.',
    },
    {
        id: 'tree',
        label: 'Tree data',
        component: TreeDataDemo,
        blurb: 'Hierarchies from getTreeDataPath with auto-generated parents, per-level sorting, filtering that keeps ancestors, and selection propagation.',
    },
    {
        id: 'detail',
        label: 'Master detail',
        component: MasterDetailDemo,
        blurb: 'Expandable detail panels with content-driven height — each one renders a nested grid.',
    },
    {
        id: 'editing',
        label: 'Editing (CRUD)',
        component: CrudDemo,
        blurb: 'Row editing with controlled rowModesModel, actions column, async processRowUpdate, validation and error handling.',
    },
    {
        id: 'server',
        label: 'Server-side data',
        component: ServerSideDemo,
        blurb: 'dataSource with lazy loading (skeleton rows while chunks arrive), unknown row counts, server pagination and onRowsScrollEnd infinite scroll.',
    },
    {
        id: 'spanning',
        label: 'Spanning & pinned rows',
        component: SpanningDemo,
        blurb: 'Column spanning via colSpan, pinned top/bottom rows, column groups and vertical borders.',
    },
    {
        id: 'api',
        label: 'API, events & state',
        component: ApiDemo,
        blurb: 'Drive the grid through apiRef, subscribe to events, save/restore state, and switch locale.',
    },
];

const readHash = () => {
    const id = window.location.hash.replace('#', '');
    return DEMOS.some((demo) => demo.id === id) ? id : 'full';
};

const initialTheme = () => {
    try {
        const stored = window.localStorage.getItem('opengrid-theme');
        if (stored === 'light' || stored === 'dark') return stored;
    } catch (error) {
        // Storage may be blocked; fall back to the OS preference.
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
    const [active, setActive] = useState(readHash);
    const [theme, setTheme] = useState(initialTheme);

    useEffect(() => {
        const onHash = () => setActive(readHash());
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        try {
            window.localStorage.setItem('opengrid-theme', theme);
        } catch (error) {
            // Not critical.
        }
    }, [theme]);

    const demo = DEMOS.find((d) => d.id === active);
    const Demo = demo.component;

    return (
        <div className="app">
            <header className="app-header">
                <div className="app-brand">
                    <span className="app-logo" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                    </span>
                    <div>
                        <h1>OpenGrid</h1>
                        <p>
                            An open-source React data grid with the MUI X Data Grid Pro feature set — zero dependencies,
                            MIT licensed.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    className="app-theme-toggle"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                >
                    {theme === 'dark' ? '☀︎ Light' : '☾ Dark'}
                </button>
            </header>
            <nav className="app-tabs" aria-label="Demos">
                {DEMOS.map((d) => (
                    <a
                        key={d.id}
                        href={`#${d.id}`}
                        className={d.id === active ? 'active' : ''}
                        aria-current={d.id === active ? 'page' : undefined}
                    >
                        {d.label}
                    </a>
                ))}
            </nav>
            <main className="app-main">
                <p className="app-blurb">{demo.blurb}</p>
                <Demo key={demo.id} theme={theme} />
            </main>
        </div>
    );
}

export default App;
