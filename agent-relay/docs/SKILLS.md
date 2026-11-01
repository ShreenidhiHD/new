# Skills

Skills are short playbooks (`SKILL.md` files) that an agent loads **only when
they're relevant**, so they don't use up context the rest of the time. Claude Code and
GitHub Copilot in VS Code both support the same Agent Skills format:

| Agent | Project location | Personal location |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | `~/.claude/skills/<name>/SKILL.md` |
| GitHub Copilot (VS Code) | `.github/skills/<name>/SKILL.md` | see VS Code docs |

Each skill has frontmatter with a `name` and a `description`. The agent reads the
description to decide when to load the rest of the file.

## Included skills

| Skill | What it teaches | Loaded when |
|---|---|---|
| [`agent-relay-collaboration`](../skills/agent-relay-collaboration/SKILL.md) | Which relay tool to use, the task lifecycle, how to write a handoff and an `ask_agent` prompt, when to escalate | Start and end of tasks, any relay message or task |
| [`agent-relay-loop-safety`](../skills/agent-relay-loop-safety/SKILL.md) | The 7 kinds of agent loops, a pre-send checklist, the relay's hard limits, what to do on `LOOP GUARD` | Before replying, retrying, or re-handing work |
| [`agent-relay-troubleshooting`](../skills/agent-relay-troubleshooting/SKILL.md) | Step-by-step diagnosis: identity and storage folder, missing tools, unseen messages, `ask_agent` errors, stuck tasks | Anything about the relay misbehaves |
| [`engineering-principles`](../skills/engineering-principles/SKILL.md) | Think before coding, simplicity first, surgical changes, goal-driven verification (inspired by Andrej Karpathy's notes on LLM coding pitfalls) | Every code change |
| [`systematic-debugging`](../skills/systematic-debugging/SKILL.md) | Reproduce → isolate → hypothesize → fix the root cause → verify, with hard attempt limits | Bugs, failing tests, errors |
| [`cross-agent-review`](../skills/cross-agent-review/SKILL.md) | Asking another model for a review, verifying its findings, capping review rounds | Reviews and second opinions between agents |

## Install

```bash
# into a project, for both Claude Code and Copilot (commit the result)
npx -y github:ShreenidhiHD/agent-relay install-skills /path/to/project

# only one agent
agent-relay install-skills . --claude
agent-relay install-skills . --copilot

# personal Claude Code skills (all projects)
agent-relay install-skills --user
```

In VS Code, use the Command Palette: **Agent Relay: Install Skills to Workspace**.

## Writing your own

```markdown
---
name: my-skill            # lowercase-hyphen, must match the folder name
description: What it does AND when to use it. The agent uses this to decide when to load it.
---

# Instructions…
```

Keep each skill focused and actionable. Use checklists, limits and templates, not essays.
`npm test` checks that every skill in `skills/` has valid frontmatter.
