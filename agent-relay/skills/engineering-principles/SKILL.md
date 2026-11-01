---
name: engineering-principles
description: Core engineering discipline for any coding task. Think before coding, keep it simple, make surgical changes, and drive toward verifiable goals. Use for every code change, especially tasks handed to you by another agent, where you have less context and mistakes compound.
---

# Engineering principles

These principles are inspired by Andrej Karpathy's observations on where LLM coding
agents go wrong: silent assumptions, over-engineering, edits beyond the
request, and claiming success without checking. They matter even more when
agents hand work to each other, because each handoff loses context.

## 1. Think before coding

- **State your assumptions.** If the task is ambiguous, say what you assume. If
  the ambiguity changes the outcome, ask (the human, or the task creator via
  `send_message`) instead of guessing.
- **Read before you write.** Find the existing code, conventions, and tests for
  the area. Match them.
- **Name the tradeoff.** If there are two reasonable approaches, pick one and
  say why in one sentence. Don't silently choose.
- **Push back when warranted.** If the request is wrong or there's a much simpler
  way, say so before implementing.

## 2. Simplicity first

- Write the **minimum code that solves the actual problem**. No speculative
  features, config options, abstractions, or "future-proofing" nobody asked for.
- Prefer boring, obvious code over clever code.
- If your solution is 200 lines and could be 50, rewrite it.
- Don't add dependencies for things the standard library does.
- Test: *would a senior engineer reviewing this say it's overcomplicated?*

## 3. Surgical changes

- Touch **only** what the task requires. Every changed line should trace back to
  the request.
- Don't reformat, rename, or "improve" unrelated code, comments, or files.
- Clean up only the mess **you** made (unused imports/vars from your change). If
  you notice other problems, *mention* them, don't fix them unasked.
- Never edit files that another agent has claimed in an open relay task.

## 4. Goal-driven execution

- Turn the task into **verifiable success criteria** before starting:
  "add validation" → "tests for invalid input exist and pass".
  "fix the bug" → "a test reproduces it, then passes after the fix".
- For multi-step work, write a short plan where each step has a check:
  ```
  1. Reproduce: failing test in test/login.test.js → verify: it fails
  2. Fix: compare with timingSafeEqual in src/auth.js → verify: test passes
  3. Regressions → verify: full `npm test` green
  ```
- Loop on the check until it passes, **within limits** (see
  `agent-relay-loop-safety`: max 2 retries of the same approach).
- **Never claim done without running the check.** Report exactly what you ran and
  its result. If you couldn't verify, say so.

## Reporting results (to the human or in `update_task`)

- What changed (files), why, how verified (commands + outcome).
- Anything you assumed, skipped, or noticed but didn't fix.
- No inflated language. "Tests pass (12/12)" beats "Everything works perfectly!".
