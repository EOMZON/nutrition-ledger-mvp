# Test → Main adoption record — nutrition-ledger-mvp

Date: 2026-09-14  
Status: adopted for current nutrition work  
Owner/integration line: current task branch → `test` → authorized release PR → `main`

## Source governance

This repository follows:

https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md

Source version: `2026-09-10.v1.1` at commit `9a8e385ccc98f068b0990133f9a2e80681ffa9ec`.

## Repository state captured for this batch

- repository: `EOMZON/nutrition-ledger-mvp`
- formal baseline branch: `main`
- original `main` SHA for this batch: `298cd1f1e46a62d1cd83efca79be73edbadd6c32`
- long-lived candidate branch: `test`
- `test` created from the above `main` SHA on 2026-09-14
- task branch: `codex/nutrition-daily-v1-20260914`
- architecture refactor commit: `0ad6786ff3a97e10259c4b36595e2460bc911b4f`
- integration PR: https://github.com/EOMZON/nutrition-ledger-mvp/pull/1
- PR target: `test`
- PR status at adoption: Draft / not merged

The PR previously targeted `main`; it was retargeted to `test` to conform to the repository governance contract.

## Deployment / Actions observation

At the time of this adoption check:

- no `.github/workflows` directory was present;
- no new push-triggered Actions were added by this task;
- no Vercel deployment configuration was found in repository code during the targeted search;
- no claim is made about external platform settings that were not readable from this environment.

Therefore this task does **not** claim platform deployment governance is fully configured. It only records repository-side branch governance.

## Current change scope

The task branch contains:

1. Daily Nutrition v1 canonical repository/product decision;
2. barcode / AI estimate capture adapters;
3. ledger integrity audit;
4. unit tests;
5. layered architecture migration:
   - `src/domain`
   - `src/application`
   - `src/infrastructure`
   - `src/presentation`
6. compatibility shims in `lib/`;
7. Today presentation read-model;
8. reusable research / plan / architecture / handoff documents.

No personal nutrition ledger data is included in Git.

## Validation evidence

### Completed in isolated environment

Architecture unit tests were executed with Node 22 using the exact new pure modules/test logic for commit `0ad6786`.

Result:

```text
6 tests
6 pass
0 fail
0 skipped
```

Covered behavior:

- barcode normalization;
- Open Food Facts payload mapping;
- Open Food Facts HTTP adapter with injected fake fetch;
- AI meal estimate provenance;
- duplicate observation filtering;
- Today UI read-model grouping / approximate-data state.

### Not yet accepted as full runtime verification

The following remain required before PR #1 may enter `test`:

```bash
npm install
npm run test:unit
npm run test:e2e
npm run audit:data
npm run capture:ai -- --file examples/ai-estimate.example.json --dry-run
npm run capture:barcode -- --barcode 3017620422003 --dry-run
```

Notes:

- `npm run test:e2e` is required because `server.mjs` + `index.html` remain the legacy runtime shell.
- `npm run audit:data` should be run against the user's real local dataset; do not upload that dataset to GitHub.
- the barcode dry-run requires real network access to Open Food Facts.
- a successful fixture/fake-fetch test is not reported as successful live-provider verification.

## Integration gate

Do not merge task branch → `test` until:

- unit tests pass in the real checkout;
- existing Playwright E2E passes;
- the current branch has been compared to the latest `test` after any concurrent writer changes;
- no personal data is staged;
- runtime screenshot evidence is captured for the affected Today/Capture surfaces.

After task branch → `test` integration:

1. update local `test` checkout;
2. run the same relevant verification against the integrated SHA;
3. fix any integration-only regression on a task/fix branch;
4. only after acceptance and explicit release authorization, open `test` → `main` release PR;
5. do not add a second manual production deployment path after main merge.

## Main protection rule for this batch

`main` is not a development branch.

This task does not authorize:

- direct feature writes to main;
- force-push/reset of main;
- deleting old history to reduce branch count;
- adding high-frequency Actions;
- treating a Draft PR as released;
- claiming deployment success without provider read-back.

## Rollback / recovery

Before main release, recovery is simple:

- leave `main` at the recorded stable SHA;
- close/revert the candidate/task PR if the change is rejected;
- do not rewrite shared history.

After a future authorized main merge, prefer an auditable revert commit/PR if rollback is needed.

No recovery tag was created in this batch because the governance contract treats tags as a separate governed action; the user requested versioned commits, which are already preserved in task-branch history.

## Current status vocabulary

As of this record:

- candidate code committed: **yes**
- task branch pushed: **yes**
- Draft PR to `test`: **yes**
- architecture unit slice verified: **yes**
- existing full Playwright E2E verified after latest change: **no / pending local checkout**
- task merged to `test`: **no**
- `test` release accepted: **no**
- merged to `main`: **no**
- production deployed/verified: **not claimed**
