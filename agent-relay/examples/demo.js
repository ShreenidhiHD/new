#!/usr/bin/env node
// Demo: Copilot hands a task to Claude Code, Claude Code asks Gemini for a
// review, finishes the task, and Copilot reads the result.
//
// Two real agent-relay MCP servers run (AGENT_NAME=copilot and claude-code)
// against a throwaway bus. The "gemini" CLI is a stub so the demo runs without
// any agent CLIs installed; agent work and Gemini's answer are canned text.
//
//   node examples/demo.js           # readable summary
//   node examples/demo.js --json    # also print raw tool results
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = path.join(root, 'src', 'server.js');
const showJson = process.argv.includes('--json');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-relay-demo-'));
const agentsFile = path.join(dir, 'agents.json');
fs.writeFileSync(
  agentsFile,
  JSON.stringify({
    agents: {
      gemini: {
        command: process.execPath,
        args: ['-e', 'console.log("auth.js line 42 compares passwords with ==; use crypto.timingSafeEqual.")', '{prompt}'],
      },
    },
  }),
);

function startAgent(agent) {
  const p = spawn(process.execPath, [server], {
    env: { ...process.env, AGENT_NAME: agent, AGENT_RELAY_DIR: path.join(dir, 'bus'), AGENT_RELAY_AGENTS: agentsFile },
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  let buf = '';
  let n = 0;
  const waiting = new Map();
  p.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      waiting.get(msg.id)?.(msg);
    }
  });
  const call = (name, args = {}) =>
    new Promise((resolve, reject) => {
      const id = ++n;
      waiting.set(id, (m) => {
        const out = m.result?.content?.[0]?.text;
        if (m.error || m.result?.isError) reject(new Error(m.error?.message || out));
        else resolve(out);
      });
      p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) + '\n');
    });
  return { call, close: () => p.kill() };
}

const c = { dim: '\x1b[2m', bold: '\x1b[1m', blue: '\x1b[34m', orange: '\x1b[33m', green: '\x1b[32m', reset: '\x1b[0m' };
const color = process.stdout.isTTY ? c : Object.fromEntries(Object.keys(c).map((k) => [k, '']));
const who = { copilot: `${color.blue}[VS Code Copilot · Gemini]${color.reset}`, claude: `${color.orange}[Claude Code]${color.reset}` };

async function step(agent, label, tool, args, summarize) {
  const out = await agent.call(tool, args);
  console.log(`\n${who[label]} ${color.bold}${tool}${color.reset}`);
  console.log(`  ${summarize(out).split('\n').join('\n  ')}`);
  if (showJson) console.log(`${color.dim}${out}${color.reset}`);
  return out;
}

const copilot = startAgent('copilot');
const claude = startAgent('claude-code');
try {
  console.log(`${color.dim}bus: ${path.join(dir, 'bus')}${color.reset}`);

  const task = JSON.parse(
    await step(copilot, 'copilot', 'handoff_task', {
      to: 'claude-code',
      title: 'Add login tests',
      details: 'Add integration tests for POST /login. Done when npm test passes.',
    }, (o) => {
      const t = JSON.parse(o);
      return `Task "${t.title}" → ${t.to}  (${t.id}, ${t.status})`;
    }),
  );

  await step(claude, 'claude', 'read_inbox', {}, (o) =>
    JSON.parse(o).map((m) => `${m.subject}  from ${m.from}\n"${m.body}"`).join('\n'));

  await step(claude, 'claude', 'update_task', { task_id: task.id, status: 'claimed' }, (o) =>
    `status: ${JSON.parse(o).status}`);

  await step(claude, 'claude', 'ask_agent', { agent: 'gemini', prompt: 'Review src/auth.js for security bugs' }, (o) =>
    `Gemini: ${o}`);

  console.log(`\n${color.dim}  ...Claude Code writes tests, fixes auth.js, runs npm test...${color.reset}`);

  await step(claude, 'claude', 'update_task', {
    task_id: task.id,
    status: 'done',
    result: 'Added test/login.test.js (4 tests) and fixed timing-unsafe compare in auth.js. npm test: 4 passing.',
  }, (o) => `status: ${JSON.parse(o).status}`);

  await step(copilot, 'copilot', 'read_inbox', {}, (o) =>
    JSON.parse(o).map((m) => `${m.subject}  from ${m.from}\n${m.body.split('\n').slice(1).join('\n')}`.trim()).join('\n'));

  console.log(`\n${color.green}✓ Round trip complete: Copilot → Claude Code → Gemini → Claude Code → Copilot${color.reset}`);
} finally {
  copilot.close();
  claude.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
