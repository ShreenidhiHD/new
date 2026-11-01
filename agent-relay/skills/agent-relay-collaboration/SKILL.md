---
name: agent-relay-collaboration
description: How to work with other coding agents (Claude Code, GitHub Copilot, Gemini, …) through the agent-relay MCP tools. Use at the start and end of every task, whenever you receive a relay message or task, or when you want to delegate work, get a second opinion, or use a model you don't have.
---

# Collaborating through agent-relay

You are one of several coding agents sharing a **relay**: a common inbox and task
board on disk. Your name is set by `AGENT_NAME`; call `whoami` if unsure.
Typical names: `claude-code` (Claude Code CLI), `copilot` (VS Code Copilot, any
model), `gemini` (Gemini CLI, only via `ask_agent`), `human` (the user).

## Choosing the right tool

| You want to… | Use | Blocking? |
|---|---|---|
| Get a quick answer / review from another model | `ask_agent` | Yes, waits for answer |
| Give a self-contained unit of work to another agent | `handoff_task` | No, they pick it up later |
| Tell / ask something that isn't a task | `send_message` | No |
| See what's waiting for you | `read_inbox`, `list_tasks` | n/a |
| Report progress or a result | `update_task` | n/a |

Rule of thumb: **ask** for opinions (seconds to minutes), **hand off** for work
that changes files (minutes to hours), **message** for coordination.

## Every task: start and finish

1. **Start:** `read_inbox`, then `list_tasks` with `status: "open"`. Handle
   anything addressed to you before starting new work. Don't touch files
   inside another agent's `claimed` task.
2. **Finish:** if you were working on a relay task, `update_task` it to
   `done` (or `failed`) with a `result`. Check `read_inbox` once more.

## Receiving a task

1. `update_task` → `status: "claimed"` **before** you start (prevents two agents
   doing the same work).
2. Do the work. Follow the `engineering-principles` skill.
3. Verify the acceptance criteria yourself (run the tests/build it names).
4. `update_task` → `status: "done"`, `result:` what changed, which files, how you
   verified it. If you can't finish: `status: "failed"` with the reason and
   what you tried. **Never hand the same task back.** The relay refuses that.

## Writing a good handoff

The receiving agent has **none of your context**: no chat history, no open
files, no memory of what you tried. Write `details` so a capable stranger could
finish without asking a question:

```
Goal: <one sentence, the outcome, not the steps>
Context: <repo/branch, relevant files with paths, what you already found>
Do: <concrete steps or constraints, only if they matter>
Don't: <files/areas to leave alone, approaches already ruled out>
Done when: <verifiable checks, e.g. "npm test passes", "GET /health returns 200">
```

Keep one handoff to one outcome. Split big work into several tasks instead of
one vague one.

## Writing a good `ask_agent` prompt

- Self-contained: paste the code/diff/error, don't say "the file we discussed".
- Ask a specific question and the format you want back ("list bugs as
  file:line + one-line reason; say NONE if none").
- Treat the answer as **input, not truth**. Verify claims against the code
  before acting (see `cross-agent-review`).

## Messages

- Reply in the same thread (`thread_id`) to keep context together.
- Don't send pure acknowledgements ("ok", "thanks", "got it"). They trigger
  replies and start loops. Claiming a task already tells the sender you're on it.
- Use `to: "*"` only for things every agent must know (e.g. "main is frozen").

## When to stop and ask the human

- Any tool returns an error starting with `LOOP GUARD`.
- Two agents disagree twice about the same thing.
- A task needs credentials, production access, destructive operations
  (deleting data, force-pushing, dropping tables), or spending money.
- You have retried the same failing step twice.

See the `agent-relay-loop-safety` and `agent-relay-troubleshooting` skills.
