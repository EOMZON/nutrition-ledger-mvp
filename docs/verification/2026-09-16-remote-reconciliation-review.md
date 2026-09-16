# 2026-09-16 Remote Reconciliation Verification

## 固定对象

Repository:
https://github.com/EOMZON/nutrition-ledger-mvp

Reconciliation branch:
`codex/nutrition-reconcile-production-daily-v1-20260916`

Verified reconciliation SHA before this evidence-only doc update:
`6b43b113eed227fa621384f0befccd3b5135d2ff`

Verified production parent:
`8f7399f0b8c2f86ba2f1af9f18d0255774537e6a`

Draft PR:
https://github.com/EOMZON/nutrition-ledger-mvp/pull/2

## Baseline correctness

GitHub compare confirmed the reconciliation branch is a direct descendant of the verified production baseline.

The reconciliation change did **not** replace these verified production runtime files:

- `server.mjs`
- `index.html`
- `playwright.config.mjs`
- `tests/e2e.spec.js`
- `api/index.js`
- `vercel.json`

Therefore KV/Upstash persistence, Vercel runtime behavior, Evidence persistence, Today frozen snapshots, rollback/recalc/void behavior and prior production readiness fixes remain based on the verified production implementation.

## One-shot GitHub-hosted verification

Because the chat execution container still could not resolve `github.com`, a disposable verification branch and PR were created only to run GitHub-hosted checks:

- verification branch: `codex/nutrition-reconcile-ci-verify-20260916`
- verification PR: https://github.com/EOMZON/nutrition-ledger-mvp/pull/3
- workflow run: https://github.com/EOMZON/nutrition-ledger-mvp/actions/runs/35085298469
- workflow conclusion: **success**

The verification PR contains the exact reconciliation runtime plus one workflow file. It is not intended to be merged.

Runner:

- Ubuntu 24.04
- Node `v22.23.2`
- npm `10.9.8`
- Google Chrome `152.0.7977.82`

### Results

`npm ci`

- success
- 3 packages installed
- 0 vulnerabilities

`npm run check`

- success

`npm run test:unit`

```text
6 tests
6 pass
0 fail
0 skipped
```

`npm run test:e2e:local`

```text
6 passed
```

Covered:

1. production shell / health / navigation
2. create food + parse label + frozen intake snapshot
3. Evidence upload / list / reload / blob readback
4. edit / source switch / frozen history / recalc / resize / void
5. append-only export audit
6. deterministic Today visual evidence

`npm run test:visual`

```text
1 passed
```

`npm run capture:ai -- --file examples/ai-estimate.example.json --dry-run`

- success
- kept `method=ai_estimate`
- confidence preserved
- meal / nutrients normalized

`npm run capture:barcode -- --barcode 3017620422003 --dry-run`

- **real network call succeeded**
- Open Food Facts returned `Nutella`
- source=`openfoodfacts`
- method=`database`
- extended nutrients included saturated fat / sugars / fiber

Isolated audit:

```text
ok: true
issues: []
```

This proves the audit command works on an isolated empty ledger. It does **not** replace an audit of the user's private local nutrition dataset.

## Screenshot evidence

Artifact:

https://github.com/EOMZON/nutrition-ledger-mvp/actions/runs/35085298469/artifacts/10441728297

Artifact digest:

`sha256:f7ccab62fd12e7ba6a40f31d205d2e03f7b11b22aa1d417c97e8d8dd0824d82e`

File:

`test-results/today-daily-v1.png`

Properties:

- 1440 × 1000 PNG
- Today page renders
- synthetic intake is present
- totals / entries / Quick Add are visible
- no blocking modal, blank page or major layout overflow was observed

Limitation: the Ubuntu runner lacks the required Chinese glyph fonts, so Chinese text appears as tofu boxes in this artifact. Treat it as a **layout/interaction regression screenshot**, not the final Chinese typography baseline.

## Vercel build status

`npm run build:vercel` was not re-run in this one-shot GitHub runner because the repository does not contain the local Vercel project link/context used by the prior production release. The production runtime/build files were not changed by reconciliation, and the verified production evidence remains:

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/production-release-20260830/docs/analysis/2026-08-31-production-release.md

Do not interpret this as a new Production verification. No Preview or Production deployment was created in this batch.

## Data safety

- no personal nutrition data was uploaded
- screenshot used isolated test data
- audit used a temporary empty data directory
- no Production secrets were required
- no Preview / Production deployment was created

## Integration decision

The combined runtime gate is green for local/browser/data-source behavior.

It is reasonable to integrate PR #2 into long-lived `test`, then re-run the key checks against the fixed integrated `test` SHA.

`main` remains out of scope until a separate `test -> main` release authorization and release gate.

Remaining user-machine-only items:

1. audit the intended private local `data/` directory
2. sync `codex-memory-private` commit `659753d` if it exists locally
3. optionally capture a Chinese-font screenshot on the user's normal browser for design-baseline purposes

Tracking:

- https://github.com/EOMZON/creationos-os/issues/52
- https://github.com/EOMZON/creationos-os/issues/53
- https://github.com/EOMZON/creationos-os/issues/54
- https://github.com/EOMZON/creationos-os/issues/55
