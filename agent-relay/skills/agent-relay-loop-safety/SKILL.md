---
name: agent-relay-loop-safety
description: Prevent and break infinite loops between AI agents (message ping-pong, task bouncing, ask_agent recursion, retry storms). Use whenever you are about to reply to another agent, re-send, retry, hand work back, or when a tool returns a LOOP GUARD error.
---

# Loop safety for multi-agent work

Two agents that each politely "respond to every message" will talk forever.
Loops waste tokens and money, flood inboxes, and can make the same edit over
and over. The relay enforces hard limits, **but you should never need them**.

## The loops to recognise

| Loop | What it looks like | Prevention |
|---|---|---|
| **Ping-pong** | "Thanks!" → "You're welcome!" → "Anything else?" → … | Never send acknowledgements. Only message when you add new information or need a decision. |
| **Task bounce** | A hands task to B, B hands it back to A | Do it or mark it `failed` with a reason. Never re-handoff the same task. |
| **Ask recursion** | A `ask_agent` B, which `ask_agent` A, which … | Don't call `ask_agent` while answering an `ask_agent` request (your prompt will start with `[Request from agent …]`). Answer directly. |
| **Retry storm** | Same failing command/tool call repeated | Max **2 retries** of the same step, then change approach or stop. |
| **Fix/revert flip-flop** | Agent A changes X, agent B reverts X, repeat | After one disagreement, stop and ask the human. Don't edit files in another agent's claimed task. |
| **Review cycle** | "Review this" → "fixed" → "review again" → … endlessly | Cap at **2 review rounds**. After that, report remaining issues to the human. |
| **Polling loop** | Calling `read_inbox` over and over waiting for a reply | Don't wait in a loop. Finish your turn and tell the human what you're waiting for. |

## Before every outgoing message, ask yourself

1. Does this message contain **new** information, a result, or a question
   that blocks me? If not, don't send it.
2. Am I replying to a reply to a reply? Three hops in a thread without
   progress means **stop**.
3. Have I already sent this (or nearly this)? The relay rejects duplicates.

## Hard limits the relay enforces

These limits apply to every agent except `human`. All can be changed with
environment variables.

| Limit | Default | Env var |
|---|---|---|
| Messages per thread | 30 | `AGENT_RELAY_MAX_THREAD` |
| Messages per agent per minute | 20 | `AGENT_RELAY_RATE_PER_MIN` |
| Identical message to same agent | refused for 120 s | `AGENT_RELAY_DUP_WINDOW_SEC` |
| Updates per task | 25 | `AGENT_RELAY_MAX_TASK_UPDATES` |
| `ask_agent` nesting depth | 2 | `AGENT_RELAY_MAX_DEPTH` |
| Hand a task back to its sender | refused | n/a |
| Re-handoff of an open duplicate task | refused | n/a |
| Change status of a finished task (except reopen) | refused | n/a |

## When you get `LOOP GUARD: …`

1. **Do not retry**, and don't rephrase the same message to slip past the check.
2. Summarise for the human: what you were trying to do, the guard message,
   and the thread/task id.
3. Stop and wait for the human's decision.

## When a loop already happened (human/operator)

```bash
agent-relay threads                 # find the runaway thread (high count)
agent-relay thread <thread_id>      # read it
agent-relay tasks claimed           # see stuck tasks
agent-relay send human claude-code "Stop work on <thread>. <decision>."
```

Old messages can be removed by deleting files under `~/.agent-relay/messages/`.
Each message is one JSON file, so deleting one is safe.
