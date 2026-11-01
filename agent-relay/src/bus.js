// File-backed message bus shared by every agent process.
// One file per message/task, so concurrent writers (Claude Code's MCP server
// and Copilot's MCP server run as separate processes) never clobber each other.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export function defaultBusDir() {
  return process.env.AGENT_RELAY_DIR || path.join(os.homedir(), '.agent-relay');
}

function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function newId(prefix) {
  // Time-sortable id: ms timestamp + random suffix.
  return `${prefix}_${Date.now().toString(36).padStart(9, '0')}_${crypto.randomBytes(3).toString('hex')}`;
}

// Loop guards. Agents talking to agents can ping-pong forever ("thanks!" /
// "you're welcome!" / "anything else?"), re-hand the same task back and forth,
// or retry a failing call in a tight loop. These limits stop that in the bus
// itself, so it holds even when an agent ignores its instructions.
// The sender "human" is never limited.
export const LIMITS = {
  maxThreadMessages: Number(process.env.AGENT_RELAY_MAX_THREAD || 30),
  maxSendsPerMinute: Number(process.env.AGENT_RELAY_RATE_PER_MIN || 20),
  duplicateWindowSec: Number(process.env.AGENT_RELAY_DUP_WINDOW_SEC || 120),
  maxTaskUpdates: Number(process.env.AGENT_RELAY_MAX_TASK_UPDATES || 25),
};

export class LoopGuardError extends Error {
  constructor(message) {
    super(`LOOP GUARD: ${message} Stop and ask the human how to proceed; do not retry.`);
    this.name = 'LoopGuardError';
  }
}

const FINAL = new Set(['done', 'failed', 'cancelled']);
const TASK_STATUSES = ['open', 'claimed', 'done', 'failed', 'cancelled'];

export class Bus {
  constructor(dir = defaultBusDir()) {
    this.dir = dir;
    this.msgDir = path.join(dir, 'messages');
    this.taskDir = path.join(dir, 'tasks');
    this.readDir = path.join(dir, 'read');
    for (const d of [this.msgDir, this.taskDir, this.readDir]) fs.mkdirSync(d, { recursive: true });
  }

  // ---------- messages ----------
  /** Throws LoopGuardError if this send looks like a runaway loop. */
  checkSend({ from, to, body, threadId }) {
    if (from === 'human') return;
    const now = Date.now();
    const msgs = this.allMessages();
    if (threadId) {
      const n = msgs.filter((m) => m.threadId === threadId).length;
      if (n >= LIMITS.maxThreadMessages) {
        throw new LoopGuardError(`thread ${threadId} already has ${n} messages (limit ${LIMITS.maxThreadMessages}).`);
      }
    }
    const recent = msgs.filter((m) => m.from === from && now - Date.parse(m.createdAt) < 60_000);
    if (recent.length >= LIMITS.maxSendsPerMinute) {
      throw new LoopGuardError(`"${from}" sent ${recent.length} messages in the last minute (limit ${LIMITS.maxSendsPerMinute}).`);
    }
    const norm = (x) => String(x).trim().toLowerCase().replace(/\s+/g, ' ');
    const dup = msgs.find(
      (m) => m.from === from && m.to === to && norm(m.body) === norm(body) && now - Date.parse(m.createdAt) < LIMITS.duplicateWindowSec * 1000,
    );
    if (dup) {
      throw new LoopGuardError(`identical message to "${to}" was already sent (${dup.id}).`);
    }
  }

  send({ from, to, body, subject = '', threadId, taskId, enforce = true }) {
    if (!from) throw new Error('from is required');
    if (!to) throw new Error('to is required');
    if (!body) throw new Error('body is required');
    if (enforce) this.checkSend({ from, to, body, threadId });
    const id = newId('msg');
    const msg = {
      id,
      threadId: threadId || id,
      from,
      to,
      subject,
      body,
      taskId: taskId || null,
      createdAt: new Date().toISOString(),
    };
    writeAtomic(path.join(this.msgDir, `${id}.json`), msg);
    return msg;
  }

  allMessages() {
    return fs
      .readdirSync(this.msgDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => readJson(path.join(this.msgDir, f), null))
      .filter(Boolean);
  }

  _readSet(agent) {
    return new Set(readJson(path.join(this.readDir, `${agent}.json`), []));
  }

  _markRead(agent, ids) {
    if (!ids.length) return;
    const set = this._readSet(agent);
    ids.forEach((id) => set.add(id));
    writeAtomic(path.join(this.readDir, `${agent}.json`), [...set]);
  }

  inbox(agent, { unreadOnly = true, markRead = true } = {}) {
    const read = this._readSet(agent);
    const msgs = this.allMessages().filter(
      (m) => (m.to === agent || m.to === '*') && m.from !== agent && (!unreadOnly || !read.has(m.id)),
    );
    if (markRead) this._markRead(agent, msgs.map((m) => m.id));
    return msgs;
  }

  thread(threadId) {
    return this.allMessages().filter((m) => m.threadId === threadId);
  }

  threads(agent) {
    const map = new Map();
    for (const m of this.allMessages()) {
      if (agent && m.to !== agent && m.from !== agent && m.to !== '*') continue;
      const t = map.get(m.threadId) || {
        threadId: m.threadId,
        subject: m.subject,
        participants: new Set(),
        count: 0,
        lastAt: null,
      };
      t.participants.add(m.from);
      t.participants.add(m.to);
      t.count++;
      t.lastAt = m.createdAt;
      map.set(m.threadId, t);
    }
    return [...map.values()].map((t) => ({ ...t, participants: [...t.participants] }));
  }

  // ---------- tasks (handoffs) ----------
  createTask({ from, to, title, details = '', context = {} }) {
    if (!title) throw new Error('title is required');
    if (from !== 'human') {
      const norm = (x) => String(x).trim().toLowerCase();
      for (const t of this.listTasks()) {
        if (FINAL.has(t.status) || norm(t.title) !== norm(title)) continue;
        if (t.from === to && t.to === from) {
          throw new LoopGuardError(`"${to}" handed you this same task (${t.id}); handing it back creates a loop. Do it, or mark it failed with a reason.`);
        }
        if (t.from === from && t.to === to) {
          throw new LoopGuardError(`you already handed this task to "${to}" (${t.id}, ${t.status}). Wait for it or update it.`);
        }
      }
    }
    const id = newId('task');
    const now = new Date().toISOString();
    const task = {
      id,
      from,
      to,
      title,
      details,
      context,
      status: 'open',
      claimedBy: null,
      result: null,
      createdAt: now,
      updatedAt: now,
      history: [{ at: now, by: from, status: 'open' }],
    };
    writeAtomic(path.join(this.taskDir, `${id}.json`), task);
    this.send({ from, to, subject: `[task] ${title}`, body: details || title, threadId: id, taskId: id });
    return task;
  }

  getTask(id) {
    const t = readJson(path.join(this.taskDir, `${id}.json`), null);
    if (!t) throw new Error(`task not found: ${id}`);
    return t;
  }

  listTasks({ agent, status } = {}) {
    return fs
      .readdirSync(this.taskDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => readJson(path.join(this.taskDir, f), null))
      .filter(Boolean)
      .filter((t) => !agent || t.to === agent || t.from === agent || t.to === '*')
      .filter((t) => !status || t.status === status);
  }

  updateTask({ id, by, status, result, note }) {
    if (status && !TASK_STATUSES.includes(status)) {
      throw new Error(`status must be one of ${TASK_STATUSES.join(', ')}`);
    }
    const t = this.getTask(id);
    if (by !== 'human' && t.history.length >= LIMITS.maxTaskUpdates) {
      throw new LoopGuardError(`task ${id} has been updated ${t.history.length} times (limit ${LIMITS.maxTaskUpdates}).`);
    }
    if (by !== 'human' && FINAL.has(t.status) && status && status !== 'open') {
      throw new LoopGuardError(`task ${id} is already ${t.status}.`);
    }
    if (status === 'claimed') {
      if (t.status === 'claimed' && t.claimedBy && t.claimedBy !== by) {
        throw new Error(`task already claimed by ${t.claimedBy}`);
      }
      t.claimedBy = by;
    }
    const now = new Date().toISOString();
    if (status) t.status = status;
    if (result !== undefined) t.result = result;
    t.updatedAt = now;
    t.history.push({ at: now, by, status: t.status, note: note || undefined });
    writeAtomic(path.join(this.taskDir, `${id}.json`), t);
    // Notify the task creator so they see progress in their inbox.
    const other = by === t.from ? t.to : t.from;
    const lines = [`Task "${t.title}" is now ${t.status}.`];
    if (note) lines.push(`Note: ${note}`);
    if (result !== undefined) lines.push(`Result:\n${result}`);
    // Status notifications are bounded by maxTaskUpdates, so skip send guards.
    this.send({ from: by, to: other, subject: `[task ${t.status}] ${t.title}`, body: lines.join('\n'), threadId: id, taskId: id, enforce: false });
    return t;
  }
}
