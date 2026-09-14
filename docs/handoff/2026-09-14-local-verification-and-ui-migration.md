# Local verification + Today UI migration handoff

Date: 2026-09-14  
Repository: https://github.com/EOMZON/nutrition-ledger-mvp  
PR: https://github.com/EOMZON/nutrition-ledger-mvp/pull/1  
Task branch: `codex/nutrition-daily-v1-20260914`  
Current remote task SHA at handoff: `f98e630a4f790a8a41beca44e9c417f9f2b22a8d`

## Read these canonical links first

Git governance (must follow):

https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md

Product/repository decision:

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/analysis/2026-09-14-nutrition-canonical-decision.md

Daily Nutrition v1 priorities / 7-day gate:

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/plan/2026-09-14-daily-nutrition-v1.md

Nutrition data sources / standards:

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/research/2026-09-14-nutrition-data-sources-and-standards.md

Layered architecture contract:

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/architecture/2026-09-14-layered-architecture.md

Repository governance adoption record:

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/governance/2026-09-14-test-main-adoption.md

## What remote AI already completed

- created long-lived `test` from the batch's original `main` baseline;
- retargeted Draft PR #1 from `main` to `test`;
- kept `main` untouched;
- refactored the new nutrition capture path into `domain / application / infrastructure / presentation` layers;
- kept `lib/*` compatibility shims;
- added independently injectable Open Food Facts adapter;
- added Today UI read-model;
- added `npm run view:today`;
- added deterministic visual test `npm run test:visual`;
- ran the pure architecture test slice in an isolated Node 22 environment: **6 pass / 0 fail**;
- did not claim Playwright/browser/live-provider verification.

Key commits:

- `0ad6786ff3a97e10259c4b36595e2460bc911b4f` — layered architecture refactor
- `f98e630a4f790a8a41beca44e9c417f9f2b22a8d` — deterministic Today screenshot test

## Local checklist

### A. Preflight — do not modify anything yet

Run from the actual local repository:

```bash
git rev-parse --show-toplevel
git rev-parse --git-common-dir
git status --short --branch
git branch --show-current
git remote -v
git worktree list
git log --oneline --decorate -12
```

Rules:

- do not `git add -A`;
- do not stash/reset/clean automatically;
- do not force-push;
- do not rewrite shared history;
- preserve any existing dirty work;
- if another writer is actively changing the same files, stop and report before creating a worktree/branch;
- `main` is not a development branch.

### B. Sync the task branch safely

```bash
git fetch origin --prune
git switch codex/nutrition-daily-v1-20260914
git status --short --branch
git rev-parse HEAD
git rev-parse origin/codex/nutrition-daily-v1-20260914
git log --oneline --decorate -8
```

Expected remote SHA at this handoff:

```text
f98e630a4f790a8a41beca44e9c417f9f2b22a8d
```

If local has unique commits or dirty files, reconcile them; do not reset them away.

Check candidate drift:

```bash
git fetch origin
git log --oneline --left-right --cherry-pick origin/test...HEAD
git diff --stat origin/test...HEAD
```

Do not merge to `test` yet.

### C. Install and verify the actual checkout

Use the repository's existing lockfile:

```bash
npm ci
npm run test:unit
npm run test:e2e
npm run test:visual
```

Expected visual artifact:

```text
test-results/today-daily-v1.png
```

Open that PNG and visually check:

- full page renders;
- Today contains the synthetic `演示燕麦杯` record;
- navigation remains usable;
- no modal/backdrop is accidentally left open;
- no obvious overflow/blank region/regression appears at 1440×1000.

Do not commit `test-results/`; it is already ignored.

### D. Verify non-browser logic against the real repository

```bash
npm run capture:ai -- --file examples/ai-estimate.example.json --dry-run
npm run capture:barcode -- --barcode 3017620422003 --dry-run
```

The barcode command needs real network access to Open Food Facts.

Do not treat a fake-fetch/unit test as live-provider verification.

### E. Read-only audit of local personal data

Only after confirming the repository's `data/` is the intended local nutrition dataset:

```bash
npm run audit:data
```

This is read-only, but inspect the command/result before taking any corrective action.

Never add real personal nutrition data to Git.

### F. Next implementation slice — wire data/UI separation into the real Today page

Only continue if A-E are green or any failure is first fixed on the task branch.

Goal: migrate **Today only**, not the whole application.

Requirements:

1. Preserve the current ledger/API contract and append-only history behavior.
2. Preserve existing E2E selectors/flows unless a test is deliberately migrated in the same commit.
3. Use the canonical read-model semantics from:
   - `src/presentation/today-view-model.mjs`
   - `src/domain/meals.mjs`
   - `src/domain/provenance.mjs`
4. Do not let DOM components parse ledger provenance themselves.
5. Do not duplicate nutrient/source priority constants in UI code.
6. Keep the current visual language for this architecture slice; do not redesign the product while changing boundaries.
7. Prefer browser-native ES modules and the existing stack for the first migration. Do **not** introduce React/Vite only to say the code is componentized.
8. If serving browser modules requires a server change, add a path-restricted static module handler only for approved source/UI directories. Prevent path traversal.
9. Split the Today surface into at least these responsibilities:
   - data fetch/client adapter;
   - Today page controller;
   - Today summary renderer;
   - meal section renderer;
   - intake row renderer;
   - provenance badge renderer.
10. Keep API payload → read-model → render as a one-way data flow.
11. Surface `AI 粗估` visibly whenever `provenance.approximate === true`.
12. Do not yet add recipes, inventory, recommendations, weight coaching, sync, or unrelated dashboards.

After implementation run again:

```bash
npm run test:unit
npm run test:e2e
npm run test:visual
npm run audit:data
```

Capture at minimum:

```text
test-results/today-daily-v1.png
```

If the Today UI intentionally changed, compare before/after screenshots and record the reason.

### G. Commit discipline

Stage exact paths only.

Suggested commit sequence:

```text
refactor: wire Today page to presentation read model

test: cover modular Today rendering and provenance state

docs: record Today UI migration verification
```

Do not create meaningless one-line commits just to increase history count.

Before push:

```bash
git status --short
git diff --check
git diff --cached --stat
git diff --cached
```

Push only the task branch.

### H. Integration to `test`

Do not integrate until all required checks are green.

Before integration, fetch latest `test` and re-evaluate the exact combined state. If `test` moved, do not reuse stale test evidence.

Preferred flow:

- update Draft PR #1 with actual commands/results/screenshots;
- mark ready only when verified;
- merge PR #1 into `test` after acceptance;
- re-run relevant verification on the integrated `test` SHA;
- keep `main` untouched until an explicitly authorized `test -> main` release batch.

Do not add a manual production deployment after a future main merge.

### I. Separate archive-sync item

The user reported local `codex-memory-private` commit `659753d` containing 2026-09-14 nutrition evidence, but it was not visible on GitHub remote during remote audit.

If that local repository is available, separately inspect it:

```bash
cd /Users/zon/Desktop/CreationOS/codex-memory-private
git status --short --branch
git show --stat --oneline 659753d
git branch --contains 659753d
git remote -v
```

Only if the commit and intended branch are valid and no unrelated dirty/diverged work would be harmed, push the existing commit/branch normally. Do not recreate the evidence manually and do not force-push.

After it is remotely addressable, update the nutrition canonical decision document with permanent GitHub links in a normal task-branch commit.

## Full prompt for a local coding agent

```text
Take over EOMZON/nutrition-ledger-mvp from the current remote task branch. Do not start from memory and do not redesign the whole product.

Read these first, in order:
1. Git governance:
https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md
2. Canonical nutrition decision:
https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/analysis/2026-09-14-nutrition-canonical-decision.md
3. Daily Nutrition v1 plan:
https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/plan/2026-09-14-daily-nutrition-v1.md
4. Data sources/standards:
https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/research/2026-09-14-nutrition-data-sources-and-standards.md
5. Layered architecture:
https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/architecture/2026-09-14-layered-architecture.md
6. Governance adoption record:
https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/governance/2026-09-14-test-main-adoption.md
7. Current PR:
https://github.com/EOMZON/nutrition-ledger-mvp/pull/1

Current expected remote task SHA at handoff: f98e630a4f790a8a41beca44e9c417f9f2b22a8d.
PR #1 must target test, not main. main remains the formal stable baseline.

First do a non-destructive Git preflight: root/common-dir, current branch/HEAD, remotes, status, worktrees, recent log and possible active writers. Protect all dirty/untracked work. Never default to add -A, stash, reset, clean, rebase shared history or force-push.

Then sync the task branch safely and compare it with origin/test. Do not merge it yet.

Run the actual checkout verification using existing commands only:
npm ci
npm run test:unit
npm run test:e2e
npm run test:visual
npm run capture:ai -- --file examples/ai-estimate.example.json --dry-run
npm run capture:barcode -- --barcode 3017620422003 --dry-run

The visual test must produce test-results/today-daily-v1.png. Inspect it and retain the path in your report, but do not commit test-results.

If and only if the existing branch is green, continue the next architecture slice: migrate the real Today page to a one-way API payload -> TodayViewModel -> UI component flow. Reuse src/presentation/today-view-model.mjs and the canonical domain rules. Do not duplicate provenance/nutrient/meal semantics in UI. Split the Today UI into data adapter/controller/summary/meal section/intake row/provenance badge responsibilities. Keep the existing visual language and user flow; this task is architecture + usability, not a redesign. Do not introduce React/Vite unless you can demonstrate that the current incremental ES-module migration cannot meet the requirement. Preserve append-only ledger behavior and backwards compatibility.

Make AI-estimated entries visibly marked as AI 粗估. Keep package/OCR/manual/database sources distinguishable. Do not add unrelated recipe/inventory/recommendation/health-coaching/sync features.

After any implementation, run unit, E2E, visual and data-audit checks again. Because the current repository still uses legacy server.mjs/index.html as runtime, unit tests alone never authorize integration.

Commit exact paths in coherent commits. Push only the task branch. Update PR #1 with commands, exit results, screenshot path, untested items and rollback notes. Do not merge to test until the final combined candidate is green. Do not merge or push directly to main. A future test->main release requires explicit release authorization and must not trigger a second manual production deploy path.

Separately, if /Users/zon/Desktop/CreationOS/codex-memory-private exists, inspect commit 659753d and safely push the existing branch only if that can be done without overwriting dirty/diverged work. Never force-push or recreate that evidence from memory. Once remote, add permanent links back into the nutrition canonical document.

Return: exact HEAD SHA, changed files, tests with pass/fail counts, screenshot path(s), remaining blockers, PR URL, whether task is merged to test (normally no unless explicitly authorized), and a concise next-step recommendation.
```
