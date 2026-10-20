// Deterministic fake data for the playground (seeded PRNG, no dependencies).

export function createRandom(seed = 42) {
    let state = seed >>> 0;
    const next = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        next,
        int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
        float: (min, max, digits = 2) => Number((next() * (max - min) + min).toFixed(digits)),
        pick: (list) => list[Math.floor(next() * list.length)],
        bool: (p = 0.5) => next() < p,
    };
}

const FIRST_NAMES = [
    'Ava',
    'Liam',
    'Mia',
    'Noah',
    'Zoe',
    'Ethan',
    'Aria',
    'Lucas',
    'Isla',
    'Mateo',
    'Nora',
    'Kai',
    'Leah',
    'Omar',
    'Ines',
    'Ravi',
    'Sofia',
    'Yuki',
    'Amara',
    'Jonas',
    'Priya',
    'Diego',
    'Hana',
    'Felix',
];
const LAST_NAMES = [
    'Garcia',
    'Chen',
    'Okafor',
    'Novak',
    'Rossi',
    'Kim',
    'Silva',
    'Patel',
    'Müller',
    'Haddad',
    'Dubois',
    'Nakamura',
    'Larsen',
    'Moreau',
    'Ivanova',
    'Kowalski',
    'Mensah',
    'Costa',
    'Ahmed',
    'Berg',
];
export const COMMODITIES = [
    'Cocoa',
    'Coffee C',
    'Corn',
    'Cotton No.2',
    'Crude Oil',
    'Gold',
    'Natural Gas',
    'Oats',
    'Robusta Coffee',
    'Rough Rice',
    'Silver',
    'Soybeans',
    'Sugar No.11',
    'Wheat',
    'Copper',
    'Lumber',
];
export const DESKS = ['D-1592', 'D-2731', 'D-3446', 'D-4812', 'D-5591', 'D-6614'];
export const STATUSES = [
    { value: 'Open', label: 'Open' },
    { value: 'PartiallyFilled', label: 'Partially filled' },
    { value: 'Filled', label: 'Filled' },
    { value: 'Rejected', label: 'Rejected' },
];
export const COUNTRIES = [
    { value: 'US', label: '🇺🇸 United States' },
    { value: 'GB', label: '🇬🇧 United Kingdom' },
    { value: 'DE', label: '🇩🇪 Germany' },
    { value: 'FR', label: '🇫🇷 France' },
    { value: 'JP', label: '🇯🇵 Japan' },
    { value: 'BR', label: '🇧🇷 Brazil' },
    { value: 'IN', label: '🇮🇳 India' },
    { value: 'NG', label: '🇳🇬 Nigeria' },
    { value: 'AU', label: '🇦🇺 Australia' },
    { value: 'CA', label: '🇨🇦 Canada' },
];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'BRL', 'INR', 'AUD', 'CAD'];
const INCOTERMS = ['FOB', 'CIF', 'EXW', 'DAP', 'DDP', 'FCA'];
const CONTRACT_TYPES = ['Future', 'Option', 'Spot', 'Swap'];
const RATE_TYPES = ['Fixed', 'Floating'];
const COMPANIES = [
    'Acme Corp',
    'Globex',
    'Initech',
    'Umbrella',
    'Stark Ind.',
    'Wayne Ent.',
    'Hooli',
    'Soylent',
    'Vandelay',
    'Tyrell',
    'Cyberdyne',
    'Wonka',
];

const fullName = (random) => `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
const email = (name, i) => `${name.toLowerCase().replace(/[^a-z]+/g, '.')}${i % 97}@example.com`;
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

/** Commodity trades, modelled after the MUI X "commodity" demo dataset. */
export function createCommodityRows(count, seed = 7) {
    const random = createRandom(seed);
    const base = new Date(2024, 0, 1);
    const rows = new Array(count);
    for (let i = 0; i < count; i += 1) {
        const quantity = random.int(1000, 100000);
        const filledRatio = random.bool(0.3) ? 1 : random.float(0, 1, 3);
        const unitPrice = random.float(1, 1500);
        const feeRate = random.float(0.001, 0.05, 4);
        const trader = fullName(random);
        const tradeDate = addDays(base, random.int(0, 700));
        const filledQuantity = Math.round(quantity * filledRatio);
        rows[i] = {
            id: i + 1,
            desk: random.pick(DESKS),
            commodity: random.pick(COMMODITIES),
            traderName: trader,
            traderEmail: email(trader, i),
            quantity,
            filledQuantity,
            isFilled: filledQuantity === quantity,
            status: filledQuantity === quantity ? 'Filled' : random.pick(['Open', 'PartiallyFilled', 'Rejected']),
            unitPrice,
            unitPriceCurrency: random.pick(CURRENCIES),
            feeRate,
            incoTerm: random.pick(INCOTERMS),
            pnl: random.float(-250000, 400000),
            tradeDate,
            maturityDate: addDays(tradeDate, random.int(30, 900)),
            counterPartyName: random.pick(COMPANIES),
            counterPartyCountry: random.pick(COUNTRIES).value,
            contractType: random.pick(CONTRACT_TYPES),
            rateType: random.pick(RATE_TYPES),
            brokerName: fullName(random),
        };
    }
    return rows;
}

/** Employees with a reporting line, for tree data. */
export function createOrgChart(seed = 3) {
    const random = createRandom(seed);
    const rows = [];
    let id = 1;
    const titles = ['VP', 'Director', 'Manager', 'Lead', 'Engineer'];
    const departments = ['Engineering', 'Design', 'Sales', 'Finance', 'Operations'];
    const add = (path, depth, department) => {
        const name = path[path.length - 1];
        rows.push({
            id: id++,
            hierarchy: path,
            jobTitle: depth === 0 ? 'CEO' : titles[Math.min(depth - 1, titles.length - 1)],
            department,
            email: email(name, id),
            salary: Math.round((220000 - depth * 32000 + random.int(-12000, 12000)) / 100) * 100,
            startDate: new Date(2012 + random.int(0, 12), random.int(0, 11), random.int(1, 28)),
            remote: random.bool(0.4),
        });
        if (depth >= 4) return;
        const children = depth === 0 ? 5 : random.int(depth === 3 ? 0 : 1, depth === 1 ? 3 : 4);
        for (let c = 0; c < children; c += 1) {
            const dept = depth === 0 ? departments[c % departments.length] : department;
            add([...path, `${fullName(random)}`], depth + 1, dept);
        }
    };
    add(['Sarah Lindqvist'], 0, 'Executive');
    return rows;
}

/** A file system tree, using auto-generated parents (folders are not rows). */
export function createFileTree() {
    const files = [
        ['src', 'index.js', 1.2],
        ['src', 'App.js', 4.8],
        ['src', 'components', 'Header.js', 2.1],
        ['src', 'components', 'Footer.js', 1.4],
        ['src', 'components', 'grid', 'DataGrid.js', 12.7],
        ['src', 'components', 'grid', 'Row.js', 8.2],
        ['src', 'components', 'grid', 'styles.css', 15.3],
        ['src', 'utils', 'format.js', 0.9],
        ['src', 'utils', 'fetch.js', 1.6],
        ['public', 'index.html', 1.7],
        ['public', 'favicon.ico', 3.8],
        ['docs', 'README.md', 6.2],
        ['docs', 'CHANGELOG.md', 9.9],
        ['package.json', 1.1],
        ['LICENSE', 1.0],
    ];
    const random = createRandom(11);
    return files.map((entry, i) => ({
        id: i + 1,
        path: entry.slice(0, -1),
        size: entry[entry.length - 1],
        modified: new Date(2025, random.int(0, 11), random.int(1, 28), random.int(8, 19), random.int(0, 59)),
    }));
}

/** Orders with line items, for master detail. */
export function createOrders(count = 200, seed = 5) {
    const random = createRandom(seed);
    const products = [
        'Laptop',
        'Monitor',
        'Keyboard',
        'Mouse',
        'Headset',
        'Webcam',
        'Dock',
        'Chair',
        'Desk lamp',
        'Cable kit',
    ];
    return Array.from({ length: count }, (_, i) => {
        const customer = fullName(random);
        const items = Array.from({ length: random.int(1, 6) }, (__, j) => ({
            id: j + 1,
            product: random.pick(products),
            quantity: random.int(1, 5),
            unitPrice: random.float(9, 1800),
        }));
        return {
            id: 1000 + i,
            customer,
            email: email(customer, i),
            date: new Date(2025, random.int(0, 11), random.int(1, 28)),
            country: random.pick(COUNTRIES).value,
            status: random.pick(['Pending', 'Shipped', 'Delivered', 'Returned']),
            items,
            total: Number(items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0).toFixed(2)),
        };
    });
}

export function createUsers(count = 25, seed = 9) {
    const random = createRandom(seed);
    const roles = ['Admin', 'Editor', 'Viewer'];
    return Array.from({ length: count }, (_, i) => {
        const name = fullName(random);
        return {
            id: i + 1,
            name,
            email: email(name, i),
            age: random.int(19, 68),
            role: random.pick(roles),
            joined: new Date(2018 + random.int(0, 7), random.int(0, 11), random.int(1, 28)),
            active: random.bool(0.75),
        };
    });
}
