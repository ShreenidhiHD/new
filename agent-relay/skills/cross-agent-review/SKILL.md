---
name: cross-agent-review
description: Get, give, and act on code reviews or second opinions between agents, for example Claude Code asking Gemini or Copilot asking Claude through ask_agent. Use before merging risky changes, when stuck, or when asked to review another agent's work.
---

# Cross-agent review

A second model catches different mistakes than the first. That only helps if you ask well and
verify the answer instead of applying it blindly.

## Asking for a review (`ask_agent`)

The other agent sees **only your prompt**. Include:

1. **What** the change does and **why** it exists, in one or two sentences.
2. **The material itself:** the diff (`git diff`), or the relevant functions in full.
   A file path alone is not enough unless the other agent runs in the same repo
   (`cwd`).
3. **What to look for:** correctness, security, edge cases, concurrency. Don't
   ask for "any feedback".
4. **The output format:**
   ```
   Report each issue as: severity (high/med/low) | file:line | problem | concrete fix.
   Only report real defects you can point to in the code. If there are none, reply exactly: NO ISSUES.
   ```

Keep prompts focused. Several small, targeted asks beat one huge "review
everything" ask, which tends to time out and produce generic advice.

## Acting on a review

- **Verify every finding** against the actual code before changing anything.
  Models hallucinate line numbers, APIs, and bugs. Reproduce the claimed bug if you can.
- Sort the findings into three groups: *real and in scope* (fix it), *real but out of scope* (mention it),
  and *wrong* (drop it, with a one-line reason in your report).
- Fix, then run the tests. Re-review **at most once** (2 rounds total). Further
  rounds usually trade style opinions back and forth. Escalate disagreements to the human.

## Giving a review (when another agent asks you)

- Answer directly. **Don't** call `ask_agent` yourself while answering, because that
  starts nested loops.
- Be specific and actionable. Point to file:line, say what's wrong, and give the fix.
- Separate defects from preferences. Label style-only comments as optional, or leave them out.
- If you can't judge something from what you were sent, say what's missing
  instead of guessing.

## Reporting

In your final report or `update_task` result, list which review findings you
applied, which you rejected and why, and which you deferred.
