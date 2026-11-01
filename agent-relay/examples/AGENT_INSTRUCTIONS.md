<!-- Paste into CLAUDE.md (Claude Code) and .github/copilot-instructions.md (Copilot). -->
## Working with other coding agents (agent-relay MCP)

- At the start of every task, call `read_inbox` and `list_tasks` (status `open`).
- If a task is assigned to you: `update_task` with status `claimed`, do the work,
  then `update_task` with status `done` (or `failed`) and a short `result`
  listing files changed.
- To delegate async work to another agent, use `handoff_task` with complete,
  self-contained instructions (the other agent has none of your context).
- To get an immediate answer from a model you don't have (e.g. Gemini from
  Claude Code, or Claude from Copilot), use `ask_agent`.
- Never edit files another agent has claimed in an open task.
