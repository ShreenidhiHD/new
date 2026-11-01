import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Bus, LIMITS } from '../src/bus.js';

const fresh = () => new Bus(fs.mkdtempSync(path.join(os.tmpdir(), 'guard-')));

test('ping-pong in one thread is stopped at the thread limit', () => {
  const bus = fresh();
  const first = bus.send({ from: 'claude-code', to: 'copilot', body: 'msg 0' });
  let i = 1;
  assert.throws(() => {
    for (; i < 100; i++) {
      const [from, to] = i % 2 ? ['copilot', 'claude-code'] : ['claude-code', 'copilot'];
      bus.send({ from, to, body: `msg ${i}`, threadId: first.threadId });
    }
  }, /LOOP GUARD: thread .* \(limit/);
  assert.equal(i, LIMITS.maxThreadMessages);
});

test('identical repeated message is refused', () => {
  const bus = fresh();
  bus.send({ from: 'copilot', to: 'claude-code', body: 'Thanks!' });
  assert.throws(() => bus.send({ from: 'copilot', to: 'claude-code', body: '  thanks! ' }), /identical message/);
  bus.send({ from: 'copilot', to: 'gemini', body: 'Thanks!' }); // different recipient is fine
});

test('per-agent send rate is limited, human is exempt', () => {
  const bus = fresh();
  assert.throws(() => {
    for (let i = 0; i < 100; i++) bus.send({ from: 'copilot', to: 'claude-code', body: `n${i}` });
  }, /last minute/);
  for (let i = 0; i < 40; i++) bus.send({ from: 'human', to: 'copilot', body: 'same' });
});

test('handing a task back to its sender is refused', () => {
  const bus = fresh();
  bus.createTask({ from: 'copilot', to: 'claude-code', title: 'Fix login bug' });
  assert.throws(() => bus.createTask({ from: 'claude-code', to: 'copilot', title: 'fix login bug' }), /handed you this same task/);
  assert.throws(() => bus.createTask({ from: 'copilot', to: 'claude-code', title: 'Fix login bug' }), /already handed/);
});

test('finished tasks cannot be flipped, and update count is capped', () => {
  const bus = fresh();
  const t = bus.createTask({ from: 'copilot', to: 'claude-code', title: 'T' });
  bus.updateTask({ id: t.id, by: 'claude-code', status: 'done', result: 'ok' });
  assert.throws(() => bus.updateTask({ id: t.id, by: 'claude-code', status: 'done' }), /already done/);
  bus.updateTask({ id: t.id, by: 'copilot', status: 'open', note: 'reopen: tests fail' }); // reopen allowed
  assert.throws(() => {
    for (let i = 0; i < 100; i++) bus.updateTask({ id: t.id, by: 'claude-code', note: `progress ${i}` });
  }, /updated .* times/);
});
