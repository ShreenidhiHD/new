import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Bus } from '../src/bus.js';
import { buildArgs, askAgent } from '../src/agents.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bus-'));

test('messages flow between agents and are marked read', () => {
  const bus = new Bus(tmp());
  const m = bus.send({ from: 'claude-code', to: 'copilot', body: 'hi' });
  assert.equal(bus.inbox('claude-code').length, 0, 'sender does not see own message');
  const inbox = bus.inbox('copilot');
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].body, 'hi');
  assert.equal(bus.inbox('copilot').length, 0, 'second read is empty');
  bus.send({ from: 'copilot', to: 'claude-code', body: 'hello back', threadId: m.threadId });
  assert.equal(bus.thread(m.threadId).length, 2);
  assert.equal(bus.threads('copilot')[0].count, 2);
});

test('broadcast reaches everyone but the sender', () => {
  const bus = new Bus(tmp());
  bus.send({ from: 'human', to: '*', body: 'standup' });
  assert.equal(bus.inbox('copilot').length, 1);
  assert.equal(bus.inbox('claude-code').length, 1);
  assert.equal(bus.inbox('human').length, 0);
});

test('task handoff lifecycle notifies both sides', () => {
  const bus = new Bus(tmp());
  const t = bus.createTask({ from: 'claude-code', to: 'copilot', title: 'Write tests', details: 'for utils.js' });
  assert.equal(bus.inbox('copilot')[0].taskId, t.id);
  bus.updateTask({ id: t.id, by: 'copilot', status: 'claimed' });
  assert.throws(() => bus.updateTask({ id: t.id, by: 'gemini', status: 'claimed' }), /already claimed/);
  bus.updateTask({ id: t.id, by: 'copilot', status: 'done', result: 'added 5 tests' });
  const done = bus.getTask(t.id);
  assert.equal(done.status, 'done');
  assert.equal(done.result, 'added 5 tests');
  const notes = bus.inbox('claude-code');
  assert.equal(notes.length, 2);
  assert.match(notes[1].body, /added 5 tests/);
  assert.throws(() => bus.updateTask({ id: t.id, by: 'copilot', status: 'bogus' }), /status must be/);
});

test('buildArgs substitutes prompt without a shell', () => {
  assert.deepEqual(buildArgs(['-p', '{prompt}'], 'a; rm -rf /'), ['-p', 'a; rm -rf /']);
});

test('askAgent runs CLI, guards self-calls and depth', async () => {
  const agents = { echo: { command: process.execPath, args: ['-e', 'console.log("got:" + process.argv[1])', '{prompt}'] } };
  assert.equal(await askAgent({ agents, agent: 'echo', prompt: 'x' }), 'got:x');
  await assert.rejects(askAgent({ agents, agent: 'echo', prompt: 'x', self: 'echo' }), /yourself/);
  await assert.rejects(askAgent({ agents, agent: 'nope', prompt: 'x' }), /unknown agent/);
  process.env.AGENT_BUS_DEPTH = '5';
  await assert.rejects(askAgent({ agents, agent: 'echo', prompt: 'x' }), /nesting limit/);
  delete process.env.AGENT_BUS_DEPTH;
});
