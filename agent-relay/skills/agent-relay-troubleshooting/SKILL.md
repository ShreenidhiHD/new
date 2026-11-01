---
name: agent-relay-troubleshooting
description: Diagnose and fix agent-relay problems. Covers tools not showing in Copilot or Claude Code, agents not seeing each other's messages, ask_agent failures or timeouts, stuck tasks, and LOOP GUARD errors. Use when anything about the relay doesn't work as expected.
---

# Troubleshooting agent-relay

Work through the steps below **in order**. Most problems come from steps 1–2: the two agents use different names or different storage folders.

## Step 1: Check identity and storage folder (fixes most problems)

Call `whoami` in **each** agent:

```json
{ "agent": "copilot", "busDir": "/home/me/.agent-relay", "askable": ["claude-code", "gemini"] }
```

- **Both agents must show the same `busDir`.** If the folders differ, they can't see each other's messages.
  Fix it by setting the same path everywhere: VS Code setting `agentRelay.busDir`, and in Claude Code `-e AGENT_RELAY_DIR=...`.
- **Each agent needs a different `agent` name.** If both are `unknown-agent`, `AGENT_NAME` isn't set.
  A message goes to whoever has the name in `to`, so a typo (`claude` vs `claude-code`) sends it nowhere.

From a terminal: `ls ~/.agent-relay/messages | tail` and `agent-relay inbox <name>`.

## Step 2: The relay tools don't appear

**VS Code Copilot**
1. Use VS Code **1.101 or newer** (Help → About).
2. Copilot Chat must be in **Agent** mode. Click **Tools 🔧** and turn on **Agent Relay**.
3. Command Palette → **MCP: List Servers**. Agent Relay should be listed and running. If it isn't, choose **Show Output** to see the error.
4. If you use `.vscode/mcp.json` instead of the extension, check that the absolute path to `src/bin.js` exists. Don't use both at once, or the tools appear twice.

**Claude Code**
1. Run `claude mcp list`. `agent-relay` should show as connected.
2. If it shows as failed, run the exact command by hand:
   `AGENT_NAME=claude-code node /path/to/bin.js`. It should print `[agent-relay] agent=claude-code ...` and then wait. Errors there are the real cause.
3. If you get `node: not found`, install Node 18 or newer, or point the command at an absolute node path.
4. Restart Claude Code after `claude mcp add`. Inside a session you can also use `/mcp` to check.

## Step 3: Messages are sent but never seen

- An agent only sees messages when it calls `read_inbox`; nothing is pushed to it. Ask it to check, or add the instructions from `AGENT_INSTRUCTIONS.md` so it checks at the start of every task.
- `read_inbox` marks messages as read. If a message vanished, call `read_inbox` with `unread_only: false`.
- A sender never sees its own messages in its own inbox. That is by design.

## Step 4: `ask_agent` fails

| Error | Cause / fix |
|---|---|
| `failed to start "gemini"` | The CLI isn't installed or isn't on the PATH the MCP server sees. Use an absolute path in `agents.json` (`"command": "/usr/local/bin/gemini"`). GUI apps often have a smaller PATH than your terminal. |
| `exited with code 1` + auth message | The CLI isn't logged in. Run it once interactively (`gemini`, `claude`, `copilot`) and log in. |
| `timed out after 600s` | The prompt is too big or the CLI is waiting for input or approval. Pass a smaller `timeout_sec` and a more focused prompt. Make sure the command runs headlessly (`-p`). |
| `unknown agent "x"` | Add `x` to `agents.json`, or call `whoami` to see the valid names. |
| `nesting limit reached` | An agent tried to ask an agent that was itself answering an ask. This is the loop guard working. Answer directly instead. |
| Empty answer | Some CLIs write their answer to stderr or need an output-format flag. Run the command by hand to check. |

## Step 5: Stuck or confusing tasks

- **Claimed but abandoned** (the agent crashed or the session ended): the creator or the human calls `update_task` with `status: "open"` and a note. The task can then be claimed again.
- **`task already claimed by X`**: someone else owns it. Message X, or ask the human.
- **`already done`**: create a new task for follow-up work, or reopen the old one with `status: "open"`.

## Step 6: `LOOP GUARD` errors

These are deliberate. Read the `agent-relay-loop-safety` skill. Don't retry; report to the human.
If a limit is too strict for a real workflow, raise its environment variable instead of working around it.

## Step 7: Corrupt or messy storage

Each message or task is a single JSON file, and the server skips unreadable files.
To start fresh, stop all agents and move `~/.agent-relay` aside. It is recreated automatically.

## Collect this before asking for help

`whoami` output from both agents, `claude mcp list`, the VS Code MCP output log, `node -v`, your OS, and the exact error text.
