#!/usr/bin/env node
// Minimal, dependency-free MCP server over stdio (newline-delimited JSON-RPC 2.0).
// Run one instance per client (Claude Code, VS Code Copilot, ...) with a
// different AGENT_NAME; they all share the same bus directory.
import readline from 'node:readline';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Bus } from './bus.js';
import { loadAgents, askAgent } from './agents.js';

const AGENT = process.env.AGENT_NAME || 'unknown-agent';
const PROTOCOL_VERSION = '2025-06-18';
const bus = new Bus();

const str = (description) => ({ type: 'string', description });

export const TOOLS = [
  {
    name: 'whoami',
    description: 'Return this agent\'s name on the bus, the bus directory, and the agents you can talk to.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'send_message',
    description:
      'Send a message to another coding agent (e.g. "claude-code", "copilot"). Use "*" to broadcast. Pass thread_id to reply in an existing thread.',
    inputSchema: {
      type: 'object',
      properties: { to: str('Recipient agent name or "*"'), body: str('Message text'), subject: str('Optional subject'), thread_id: str('Optional thread to reply in') },
      required: ['to', 'body'],
    },
  },
  {
    name: 'read_inbox',
    description: 'Read messages sent to you. By default returns only unread messages and marks them read.',
    inputSchema: {
      type: 'object',
      properties: { unread_only: { type: 'boolean', default: true }, mark_read: { type: 'boolean', default: true } },
    },
  },
  {
    name: 'list_threads',
    description: 'List conversation threads you participate in.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_thread',
    description: 'Get every message in a thread, oldest first.',
    inputSchema: { type: 'object', properties: { thread_id: str('Thread id') }, required: ['thread_id'] },
  },
  {
    name: 'handoff_task',
    description:
      'Hand off a unit of work to another agent asynchronously. The recipient sees it in read_inbox/list_tasks, claims it, and reports the result back with update_task.',
    inputSchema: {
      type: 'object',
      properties: {
        to: str('Agent that should do the work'),
        title: str('Short task title'),
        details: str('Full instructions: files, acceptance criteria, constraints'),
      },
      required: ['to', 'title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks you created or that were assigned to you.',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['open', 'claimed', 'done', 'failed', 'cancelled'] } },
    },
  },
  {
    name: 'update_task',
    description: 'Claim a task, or mark it done/failed/cancelled with a result. The other side is notified.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: str('Task id'),
        status: { type: 'string', enum: ['claimed', 'done', 'failed', 'cancelled', 'open'] },
        result: str('Outcome / summary of changes (for done or failed)'),
        note: str('Optional progress note'),
      },
      required: ['task_id'],
    },
  },
  {
    name: 'ask_agent',
    description:
      'Synchronously ask another agent by running its CLI headlessly (e.g. "gemini", "claude-code", "copilot") and return its answer. Use for second opinions, reviews, or using a model you do not have.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: str('Agent key from agents.json'),
        prompt: str('Self-contained prompt; the other agent has none of your context'),
        cwd: str('Working directory to run in (defaults to server cwd)'),
        timeout_sec: { type: 'number', default: 600 },
      },
      required: ['agent', 'prompt'],
    },
  },
];

const text = (v) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }] });

export async function callTool(name, a = {}) {
  switch (name) {
    case 'whoami': {
      let agents = {};
      try {
        agents = loadAgents();
      } catch {}
      return text({ agent: AGENT, busDir: bus.dir, askable: Object.keys(agents).filter((k) => k !== AGENT) });
    }
    case 'send_message':
      return text(bus.send({ from: AGENT, to: a.to, body: a.body, subject: a.subject, threadId: a.thread_id }));
    case 'read_inbox': {
      const msgs = bus.inbox(AGENT, { unreadOnly: a.unread_only !== false, markRead: a.mark_read !== false });
      return text(msgs.length ? msgs : 'Inbox empty.');
    }
    case 'list_threads':
      return text(bus.threads(AGENT));
    case 'get_thread':
      return text(bus.thread(a.thread_id));
    case 'handoff_task':
      return text(bus.createTask({ from: AGENT, to: a.to, title: a.title, details: a.details }));
    case 'list_tasks':
      return text(bus.listTasks({ agent: AGENT, status: a.status }));
    case 'update_task':
      return text(bus.updateTask({ id: a.task_id, by: AGENT, status: a.status, result: a.result, note: a.note }));
    case 'ask_agent': {
      const answer = await askAgent({
        agents: loadAgents(),
        agent: a.agent,
        prompt: a.prompt,
        cwd: a.cwd,
        timeoutSec: a.timeout_sec,
        self: AGENT,
      });
      // Keep an audit trail on the bus.
      const q = bus.send({ from: AGENT, to: a.agent, subject: '[ask]', body: a.prompt });
      bus.send({ from: a.agent, to: AGENT, subject: '[answer]', body: answer || '(empty)', threadId: q.threadId });
      return text(answer || '(empty response)');
    }
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  }
}

function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}
function replyError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

async function handle(msg) {
  const { id, method, params = {} } = msg;
  const isRequest = id !== undefined && id !== null;
  try {
    switch (method) {
      case 'initialize':
        return reply(id, {
          protocolVersion: params.protocolVersion || PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'agent-relay', version: '0.1.0' },
          instructions:
            `You are "${AGENT}" on a shared agent bus. Call read_inbox at the start of a task and after finishing one; ` +
            'use handoff_task / ask_agent to involve other agents, and update_task to report results.',
        });
      case 'ping':
        return reply(id, {});
      case 'tools/list':
        return reply(id, { tools: TOOLS });
      case 'tools/call':
        try {
          return reply(id, await callTool(params.name, params.arguments || {}));
        } catch (e) {
          if (e.code === -32602) return replyError(id, -32602, e.message);
          return reply(id, { ...text(`Error: ${e.message}`), isError: true });
        }
      default:
        if (method?.startsWith('notifications/')) return; // no response to notifications
        if (isRequest) return replyError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    if (isRequest) replyError(id, -32603, e.message);
  }
}

export function startServer() {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return replyError(null, -32700, 'Parse error');
    }
    handle(msg);
  });
  process.stderr.write(`[agent-relay] agent=${AGENT} bus=${bus.dir}\n`);
}

const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) startServer();
