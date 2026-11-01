// Loads extension.js against a fake `vscode` module, checks the MCP server it
// registers actually starts and serves tools, and that commands hit the bus.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const busDir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-ext-'));
const registered = { providers: {}, commands: {} };
const ui = { quickPicks: [], inputs: [], infos: [] };

class EventEmitter { constructor() { this.event = () => ({ dispose() {} }); } fire() {} dispose() {} }
class McpStdioServerDefinition {
  constructor(label, command, args, env, version) { Object.assign(this, { label, command, args, env, version }); }
}
const config = { agentName: 'copilot', busDir, agentsFile: '', pollSeconds: 60 };
const fakeVscode = {
  EventEmitter,
  McpStdioServerDefinition,
  StatusBarAlignment: { Right: 2 },
  QuickPickItemKind: { Separator: -1 },
  lm: { registerMcpServerDefinitionProvider: (id, p) => ((registered.providers[id] = p), { dispose() {} }) },
  commands: {
    registerCommand: (id, fn) => ((registered.commands[id] = fn), { dispose() {} }),
    executeCommand: async () => {},
  },
  workspace: {
    getConfiguration: () => ({ get: (k) => config[k] }),
    onDidChangeConfiguration: () => ({ dispose() {} }),
    openTextDocument: async (o) => o,
    workspaceFolders: undefined,
  },
  window: {
    createStatusBarItem: () => ({ show() {}, dispose() {}, text: '' }),
    showQuickPick: async (items) => ui.quickPicks.shift()?.(items),
    showInputBox: async () => ui.inputs.shift(),
    showInformationMessage: async (msg) => { ui.infos.push(msg); },
    showWarningMessage: async () => {},
    showTextDocument: async () => {},
    createTerminal: () => ({ show() {}, sendText() {} }),
  },
  env: { clipboard: { writeText: async () => {} } },
};
const origLoad = Module._load;
Module._load = function (req, ...rest) { return req === 'vscode' ? fakeVscode : origLoad.call(this, req, ...rest); };

const ext = require('../extension.js');
const extPath = path.join(__dirname, '..');
const state = new Map([['agentRelay.welcomed', true]]);
const context = {
  extensionPath: extPath,
  extension: { packageJSON: require('../package.json') },
  subscriptions: [],
  globalState: { get: (k) => state.get(k), update: async (k, v) => state.set(k, v) },
};

test('activate registers MCP provider and commands', () => {
  ext.activate(context);
  assert.ok(registered.providers.agentRelay);
  for (const c of ['showInbox', 'showTasks', 'sendMessage', 'setupClaudeCode', 'copyInstructions']) {
    assert.ok(registered.commands[`agentRelay.${c}`], c);
  }
});

test('registered MCP server definition starts and lists relay tools', async () => {
  const [def] = await registered.providers.agentRelay.provideMcpServerDefinitions();
  assert.equal(def.label, 'Agent Relay');
  assert.equal(def.env.AGENT_NAME, 'copilot');
  assert.equal(def.env.AGENT_RELAY_DIR, busDir);
  assert.ok(fs.existsSync(def.args[0]), 'bundled server/bin.js exists');
  // def.command is VS Code's binary in real life; plain node here.
  const p = spawn(process.execPath, def.args, { env: { ...process.env, ...def.env }, stdio: ['pipe', 'pipe', 'ignore'] });
  const out = await new Promise((resolve) => {
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; if (buf.includes('\n')) resolve(JSON.parse(buf.split('\n')[0])); });
    p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n');
  });
  p.kill();
  const names = out.result.tools.map((t) => t.name);
  assert.ok(names.includes('handoff_task') && names.includes('ask_agent'));
});

test('sendMessage command writes to the shared bus; Claude Code sees it', async () => {
  ui.quickPicks.push((items) => { assert.ok(items.includes('claude-code')); return 'claude-code'; });
  ui.inputs.push('please review PR 1');
  await registered.commands['agentRelay.sendMessage']();
  const { Bus } = await import(path.join(extPath, 'server', 'bus.js'));
  const msgs = new Bus(busDir).inbox('claude-code');
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].from, 'copilot');
  assert.equal(msgs[0].body, 'please review PR 1');
});

test('setupClaudeCode installs a stable server copy outside the extension folder', async () => {
  await registered.commands['agentRelay.setupClaudeCode']();
  assert.ok(fs.existsSync(path.join(busDir, 'server', 'bin.js')));
  assert.ok(fs.existsSync(path.join(busDir, 'server', 'agents.json')));
});

test.after(() => context.subscriptions.forEach((s) => s.dispose?.()));
