// Copy the relay server (../src, ../agents.json) into ./server so the
// extension ships its own copy and works offline with nothing else installed.
const fs = require('node:fs');
const path = require('node:path');

const ext = path.join(__dirname, '..');
const root = path.join(ext, '..');
const out = path.join(ext, 'server');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(root, 'src'), out, { recursive: true });
fs.copyFileSync(path.join(root, 'agents.json'), path.join(out, 'agents.json'));
fs.copyFileSync(path.join(root, 'examples', 'AGENT_INSTRUCTIONS.md'), path.join(out, 'AGENT_INSTRUCTIONS.md'));
// The server is ESM; the extension is CommonJS.
fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify({ type: 'module' }, null, 2) + '\n');
// agents.js looks for agents.json one level up from its own folder by default;
// the extension always passes AGENT_RELAY_AGENTS explicitly, so that's fine.
console.log(`bundled server -> ${path.relative(process.cwd(), out) || out}`);
