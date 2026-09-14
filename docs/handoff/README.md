# Nutrition handoff entrypoint

Use this file as the canonical entrypoint for local continuation.

## Authoritative state rule

Do **not** hardcode a supposed current task-branch HEAD from a handoff document, because documentation commits themselves move the branch.

Instead:

1. read the current PR head from https://github.com/EOMZON/nutrition-ledger-mvp/pull/1 ;
2. fetch `origin/codex/nutrition-daily-v1-20260914`;
3. verify the local checkout matches that remote head before changing files;
4. verify the branch contains the minimum implementation anchors below.

Minimum required ancestors:

- `0ad6786ff3a97e10259c4b36595e2460bc911b4f` — layered domain/application/infrastructure/presentation refactor
- `f98e630a4f790a8a41beca44e9c417f9f2b22a8d` — deterministic Today visual test

If the detailed handoff document refers to `f98e630` as an “expected/current SHA”, interpret it as the **minimum code/test anchor**, not as an immutable current HEAD.

## Detailed local checklist + full prompt

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/handoff/2026-09-14-local-verification-and-ui-migration.md

## Required governance

https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md

PR #1 must remain task branch -> `test` until verification is complete. `main` is not the development branch.
