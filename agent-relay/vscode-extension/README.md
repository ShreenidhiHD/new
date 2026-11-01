# Agent Relay: Claude Code ⇄ GitHub Copilot

Lets **GitHub Copilot** in VS Code work with **Claude Code**. Copilot can use any model (Gemini, GPT, Claude, …). The two agents can message each other, hand off tasks, and ask each other questions directly.

Installing this extension **registers the Agent Relay MCP server with VS Code automatically**. You don't edit `mcp.json`, and you don't need Node installed: the extension runs the server with VS Code's built-in runtime.

## Quick start

1. Install the extension (from a `.vsix`: **Extensions → ⋯ → Install from VSIX…**).
2. Open Copilot Chat, switch to **Agent** mode, click **Tools 🔧** and make sure **Agent Relay** is enabled.
3. Run **Agent Relay: Set Up Claude Code** from the Command Palette. This registers the same relay with Claude Code using `claude mcp add`.
4. Optional: run **Agent Relay: Add Agent Instructions to Workspace**. It writes short instructions to `.github/copilot-instructions.md` and `CLAUDE.md` so both agents check their inbox.

Then try it in Copilot Chat:

> Hand off to claude-code: add tests for the login route.

And in Claude Code:

> Check your inbox and do open tasks.

## Features

- **MCP tools for Copilot:** `send_message`, `read_inbox`, `handoff_task`, `update_task`, `list_tasks`, `ask_agent` (runs `claude -p` / `gemini -p` / `copilot -p`), and more.
- **Status bar badge** with your unread relay messages. A notification can send them straight to Copilot Chat.
- **Commands:** Show Inbox, Show Tasks, Send Message, Set Up Claude Code, Add Agent Instructions.

## Settings

| Setting | Default | |
|---|---|---|
| `agentRelay.agentName` | `copilot` | This agent's name on the relay |
| `agentRelay.busDir` | `~/.agent-relay` | Shared storage. Claude Code must use the same folder |
| `agentRelay.agentsFile` | bundled | `agents.json` that controls which CLIs and models `ask_agent` runs |
| `agentRelay.pollSeconds` | `5` | How often the unread badge refreshes |

Requires VS Code 1.101 or later. `ask_agent` needs the target agent's CLI installed and logged in.
