#!/usr/bin/env node
// Human-facing CLI to inspect and drive the bus.
//   agent-relay inbox <agent>
//   agent-relay send <from> <to> <message...>
//   agent-relay threads | thread <id> | tasks [status]
//   agent-relay ask <agent> <prompt...>
import { Bus } from './bus.js';
import { loadAgents, askAgent } from './agents.js';

const bus = new Bus();
const [cmd, ...rest] = process.argv.slice(2);
const print = (v) => console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2));

try {
  switch (cmd) {
    case 'inbox':
      print(bus.inbox(rest[0] || 'human', { unreadOnly: false, markRead: false }));
      break;
    case 'send':
      print(bus.send({ from: rest[0], to: rest[1], body: rest.slice(2).join(' ') }));
      break;
    case 'threads':
      print(bus.threads());
      break;
    case 'thread':
      print(bus.thread(rest[0]));
      break;
    case 'tasks':
      print(bus.listTasks({ status: rest[0] }));
      break;
    case 'ask':
      print(await askAgent({ agents: loadAgents(), agent: rest[0], prompt: rest.slice(1).join(' '), self: 'human' }));
      break;
    case 'watch': {
      const agent = rest[0] || 'human';
      console.error(`watching inbox of "${agent}" in ${bus.dir} (Ctrl+C to stop)`);
      setInterval(() => bus.inbox(agent).forEach((m) => print(`[${m.createdAt}] ${m.from} -> ${m.to}: ${m.subject}\n${m.body}\n`)), 2000);
      break;
    }
    default:
      print('usage: agent-relay <inbox [agent] | send <from> <to> <msg> | threads | thread <id> | tasks [status] | ask <agent> <prompt> | watch [agent]>');
      process.exitCode = cmd ? 1 : 0;
  }
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exitCode = 1;
}
