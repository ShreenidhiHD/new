# agent-relay

Claude Code can't use the models inside VS Code GitHub Copilot (for example Gemini), and Copilot can't call Claude Code. This project connects them.

It is a small **MCP server** with no dependencies. Every coding agent loads it. Each agent runs its own copy under a different `AGENT_NAME`, and all copies share one file-based bus (`~/.agent-relay` by default). That gives the agents three ways to work together:

| Capability | Tools | Use it when |
|---|---|---|
| **Messages** | `send_message`, `read_inbox`, `list_threads`, `get_thread` | Agents need to coordinate, ask questions or share findings |
| **Task handoff** (async) | `handoff_task`, `list_tasks`, `update_task` | One agent gives a unit of work to another and gets the result back |
| **Direct ask** (sync) | `ask_agent` | An agent wants an answer right now from a model it doesn't have (Claude Code → Gemini, Copilot → Claude) |

```
 ┌─────────────┐ MCP stdio ┌──────────────────┐        ┌──────────────────┐ MCP stdio ┌──────────────────────┐
 │ Claude Code │◄─────────►│ agent-relay      │        │ agent-relay      │◄─────────►│ VS Code Copilot      │
 │             │           │ AGENT_NAME=      │        │ AGENT_NAME=      │           │ (any model: Gemini,  │
 └─────────────┘           │   claude-code    │        │   copilot        │           │  GPT, Claude, ...)   │
                           └────────┬─────────┘        └────────┬─────────┘           └──────────────────────┘
                                    │   ~/.agent-relay (shared)  │
                                    └───►  messages/ tasks/  ◄───┘

 ask_agent ──► runs `gemini -p` / `claude -p` / `copilot -p` headlessly
```

## Requirements

- Node.js 18 or newer. There are no npm dependencies.
- For `ask_agent`, the CLI of the agent you want to call must be installed and logged in:
  - Claude Code: `claude`
  - Gemini CLI: `gemini` (`npm i -g @google/gemini-cli`)
  - GitHub Copilot CLI: `copilot` (`npm i -g @github/copilot`)

  You can still send messages and hand off tasks without any of these CLIs.

## Setup

```bash
git clone <this repo> ~/agent-relay
cd ~/agent-relay && npm test
```

### 1. Claude Code

```bash
claude mcp add agent-relay --scope user -e AGENT_NAME=claude-code -- node ~/agent-relay/src/server.js
```

Or copy `examples/.mcp.json` into your project root and fix the path.

### 2. VS Code GitHub Copilot (Agent mode)

Copy `examples/.vscode/mcp.json` to `.vscode/mcp.json` in your workspace and fix the path. Then open Copilot Chat, switch to **Agent** mode, pick any model (Gemini, GPT, …) and enable the `agent-relay` tools.

### 3. Tell the agents to use it

Paste `examples/AGENT_INSTRUCTIONS.md` into `CLAUDE.md` and into `.github/copilot-instructions.md`.

## Try the demo

```bash
npm run demo            # or: node examples/demo.js --json  (also prints raw tool results)
```

The demo starts two real agent-relay servers, `copilot` and `claude-code`, using a temporary store that it deletes afterwards. It runs a full round trip:

```
[VS Code Copilot · Gemini] handoff_task
  Task "Add login tests" → claude-code  (task_..., open)

[Claude Code] read_inbox
  [task] Add login tests  from copilot

[Claude Code] update_task
  status: claimed

[Claude Code] ask_agent
  Gemini: auth.js line 42 compares passwords with ==; use crypto.timingSafeEqual.

[Claude Code] update_task
  status: done

[VS Code Copilot · Gemini] read_inbox
  [task done] Add login tests  from claude-code
  Result: Added test/login.test.js (4 tests) and fixed timing-unsafe compare in auth.js.

✓ Round trip complete: Copilot → Claude Code → Gemini → Claude Code → Copilot
```

You don't need any agent CLIs installed: a stand-in script plays `gemini`, and the agents' work is made-up example text.

## Example flows

**Claude Code asks Gemini for a second opinion.** In Claude Code:
> Use ask_agent with agent "gemini" to review src/auth.js for security issues, then fix what it finds.

**Copilot (on Gemini) hands work to Claude Code.** In Copilot Agent mode:
> handoff_task to "claude-code": "Add integration tests for the /login route; acceptance: npm test passes".

Then in Claude Code:
> Check your inbox and do any open tasks.

Claude Code claims the task, does the work, and calls `update_task done` with a result. Copilot sees the result the next time it calls `read_inbox`.

**Copilot asks Claude directly.** `ask_agent` with agent `claude-code` runs `claude -p` and returns the answer inside Copilot.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `AGENT_NAME` | `unknown-agent` | This agent's address on the bus (`claude-code`, `copilot`, …) |
| `AGENT_RELAY_DIR` | `~/.agent-relay` | Shared storage. Set a per-project path to keep projects separate |
| `AGENT_RELAY_AGENTS` | `./agents.json` | Which agents `ask_agent` can run, and with which command |
| `AGENT_RELAY_MAX_DEPTH` | `2` | Loop guard. Stops chains like A asks B, which asks A, and so on |

`agents.json` maps an agent name to a command. `{prompt}` is replaced by the prompt and passed as a single argument. No shell is involved, so a prompt can't inject commands. Change the model flags there, for example `gemini -m <model>` or `copilot --model <model>`. Check the flags against the CLI versions you have installed.

## Human CLI

```bash
node src/cli.js watch human          # follow messages addressed to you
node src/cli.js send human '*' "Freeze main, release in 10 min"
node src/cli.js tasks open
node src/cli.js thread <thread_id>
node src/cli.js ask gemini "Explain this regex: ^(?=.*\d).{8,}$"
```

## Safety notes

- `ask_agent` runs another agent **with that agent's own permission settings**. If you configure a CLI with flags like `--yolo` or `--allow-all-tools`, it can edit files without asking.
- The bus is plain JSON on disk. Don't put secrets in messages.
- Copilot inside VS Code has no headless CLI entry point. Use the `copilot` CLI (same account, same models) for synchronous asks, and use messages and tasks to reach the Copilot chat inside VS Code.
