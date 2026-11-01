// End-to-end: two MCP server processes (claude-code and copilot) sharing one bus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const server = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'server.js');

function client(agent, busDir, agentsFile) {
  const p = spawn(process.execPath, [server], {
    env: { ...process.env, AGENT_NAME: agent, AGENT_BUS_DIR: busDir, AGENT_BUS_AGENTS: agentsFile },
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  let buf = '';
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
  let n = 0;
  const rpc = (method, params) =>
    new Promise((res) => {
      const id = ++n;
      waiting.set(id, res);
      p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  const call = async (name, args) => {
    const r = await rpc('tools/call', { name, arguments: args });
    return { text: r.result.content[0].text, isError: r.result.isError };
  };
  return { rpc, call, close: () => p.kill() };
}

test('claude-code and copilot talk through MCP', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-e2e-'));
  const agentsFile = path.join(dir, 'agents.json');
  fs.writeFileSync(agentsFile, JSON.stringify({
    agents: { gemini: { command: process.execPath, args: ['-e', 'console.log("gemini says: " + process.argv[1].split("\\n").pop())', '{prompt}'] } },
  }));
  const claude = client('claude-code', dir, agentsFile);
  const copilot = client('copilot', dir, agentsFile);
  try {
    const init = await claude.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    assert.equal(init.result.serverInfo.name, 'coding-agent-communication');
    const tools = (await claude.rpc('tools/list', {})).result.tools.map((t) => t.name);
    assert.ok(tools.includes('ask_agent') && tools.includes('handoff_task'));

    const task = JSON.parse((await claude.call('handoff_task', { to: 'copilot', title: 'Refactor auth', details: 'split auth.js' })).text);
    const inbox = JSON.parse((await copilot.call('read_inbox', {})).text);
    assert.equal(inbox[0].taskId, task.id);
    await copilot.call('update_task', { task_id: task.id, status: 'done', result: 'split into 3 files' });
    const back = JSON.parse((await claude.call('read_inbox', {})).text);
    assert.match(back[0].body, /split into 3 files/);

    const ans = await claude.call('ask_agent', { agent: 'gemini', prompt: 'review this' });
    assert.equal(ans.text, 'gemini says: review this');

    const bad = await claude.call('ask_agent', { agent: 'missing', prompt: 'x' });
    assert.ok(bad.isError);
  } finally {
    claude.close();
    copilot.close();
  }
});
