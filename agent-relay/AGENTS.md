# AGENTS.md

Guidance for AI coding agents (Claude Code, GitHub Copilot, Codex, Gemini, …)
working **on this repository**.

## What this repo is

`agent-relay` is an MCP server that lets coding agents message each other, hand off
tasks, and run each other's CLIs. Read [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) first.

## Layout

- `src/`: the MCP server (`server.js`), file-backed bus and loop guards (`bus.js`),
  `ask_agent` runner (`agents.js`), human CLI (`cli.js`), skills installer (`skills.js`),
  entry point (`bin.js`)
- `skills/`: agent skills shipped to users (`SKILL.md` per folder)
- `vscode-extension/`: VS Code extension that bundles `src/` and `skills/`
- `docs/`, `examples/`, `test/`

## Rules

- **No runtime dependencies.** Node ≥ 18 standard library only. The extension must
  run on VS Code's built-in runtime.
- **Keep loop guards intact.** Any new way for agents to send or trigger each other
  must go through `Bus.checkSend` or have its own bound. Add a test in
  `test/loop-guard.test.js`.
- Never pass prompts through a shell. `ask_agent` uses `spawn` with an args array.
- Changing a tool's name or schema is a breaking change for users' agent instructions.
  Update `skills/`, `docs/`, and `examples/AGENT_INSTRUCTIONS.md` with it.

## Check before you finish

```bash
npm test                      # server, bus, loop guards, skills, end-to-end MCP
npm run test:extension        # VS Code extension against a mocked vscode API
npm run demo                  # optional: visual round trip
```

Follow [`skills/engineering-principles`](skills/engineering-principles/SKILL.md):
make small, surgical changes and verify them before claiming they're done.
