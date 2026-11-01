---
name: systematic-debugging
description: A disciplined method for fixing bugs, failing tests, crashes, and "something broke" reports. Reproduce, isolate, form a hypothesis, fix the root cause, and verify. Use when a test fails, an error appears, behavior is wrong, or another agent hands you a bug.
---

# Systematic debugging

Guessing and changing things until the error disappears creates new bugs and endless
fix/retry loops. Follow these steps.

## 1. Reproduce

- Get the **exact** error text, command, input, and environment. If the report
  is vague ("login is broken"), ask for specifics or find them in logs and tests.
- Reproduce it yourself with the smallest command possible. **A bug you can't reproduce is a
  bug you can't confirm you fixed.**
- When you can, capture it as a failing automated test first.

## 2. Isolate

- Read the full stack trace. The top frame inside *your* code is usually the place to start.
- Narrow the cause down: which commit (`git bisect`), which input, which function. Cut the
  problem in half each step instead of reading everything.
- Check the boring causes first: wrong env var, wrong path, stale build or cache,
  version mismatch, missing install, wrong working directory.

## 3. Hypothesize, then test the hypothesis

- State one hypothesis: "X happens because Y". Predict what you'd see if
  it's true, then check it with a print, a debugger, or a small test. Don't change code yet.
- If the prediction is wrong, the hypothesis is wrong. Form a new one. Don't
  stack speculative fixes.

## 4. Fix the root cause

- Fix *why* it happens, not just the symptom: no blanket `try/catch`, no `|| {}`
  to hide a null, no skipped test, no extended timeout to hide a race.
- Keep the fix surgical (see `engineering-principles`).

## 5. Verify

- The reproduction now passes, and the **full** relevant test suite still passes.
- Run the original failing command again.
- Remove temporary debug output.

## Limits: when to stop

- **2 failed fix attempts on the same hypothesis → step back.** Re-read the
  error, question your assumptions, or get a second opinion with `ask_agent`
  (paste the error, the code, and what you tried).
- **3 total failed attempts → stop and report** to the human or the task creator:
  what you observed, the hypotheses you ruled out, and your best current guess.
  Mark the relay task `failed` with that summary rather than looping.
- Never "fix" by deleting or skipping the failing test unless the human agrees
  the test is wrong.

## Bug report template (when handing a bug to another agent)

```
Symptom: <exact error / wrong output>
Repro: <command or steps; expected vs actual>
Environment: <branch, OS, versions if relevant>
Already ruled out: <hypotheses tested and results>
Suspect: <file:line or area, if any>
Done when: <the repro passes + test suite green>
```
