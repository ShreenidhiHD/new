<!-- Paste into CLAUDE.md (Claude Code) and .github/copilot-instructions.md (Copilot). -->
## Working with other coding agents (agent-relay MCP)

- At the start of every task, call `read_inbox` and `list_tasks` (status `open`).
- If a task is assigned to you: `update_task` → `claimed`, do the work, verify it,
  then `update_task` → `done` (or `failed`) with a short `result`: files changed and how you verified.
- To delegate work, use `handoff_task` with self-contained instructions and a
  "Done when" check. The other agent has none of your context.
- To get an answer from a model you don't have (Gemini from Claude Code, Claude
  from Copilot), use `ask_agent`, and verify its claims before acting.
- Never send pure acknowledgements ("ok", "thanks"). Never hand a task back to its sender.
  Retry a failing step at most twice. On any `LOOP GUARD` error, stop and ask the human.
- Never edit files that another agent has claimed in an open task.
- Skills with details: `agent-relay-collaboration`, `agent-relay-loop-safety`,
  `agent-relay-troubleshooting`, `engineering-principles`, `systematic-debugging`,
  `cross-agent-review` (install with `agent-relay install-skills`).
