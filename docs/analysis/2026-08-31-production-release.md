# Nutrition Ledger MVP · Production Release Evidence

Date: 2026-08-31  
Branch: `codex/production-release-20260830`  
Checkpoint before release work: `0c4f7bc5843139fc48e7aa7472dd4c5302ff9eca`

## Outcome

The application passed the local → preview → production release ladder. Production is intentionally empty, protected by Vercel SSO, and uses a dedicated Upstash Redis prefix. No local private nutrition records were uploaded or migrated.

## Persistence and privacy

- Marketplace resource: Upstash for Redis, free plan requested with `autoUpgrade=false` and `prodPack=false`.
- Vercel variables: Upstash REST variables are encrypted and scoped to Preview and Production.
- Preview prefix: `nutrition-ledger-preview-20260831-0125`.
- Production prefix: `nutrition-ledger-production`.
- Evidence images use the protected KV backend and `/blobs/*`; no public R2/Blob URL is required.
- Local `.env.local` is ignored by `.env*.local` and was not staged.
- Local `data/` was not uploaded or migrated.

## Release ladder

### Ring 0 · Code and build

- `npm run check` — pass.
- `npm run build:vercel` — pass before the online release.

### Ring 1 · Local browser

- Command: `E2E_PORT=18899 npm run test:e2e:local`.
- Result: 5 passed.
- Browser: system Google Chrome; no bundled Chromium download.

### Ring 2 · Preview

- Deployment: `dpl_AMhb3WHhg4j9Fav2o3v5BYmQScWy`.
- URL: `https://nutrition-ledger-rrle6ykd4-zons-projects.vercel.app`.
- Health: HTTP 200 through Vercel Automation Protection Bypass; `kvEnabled=true`, `blobBackend=kv`.
- Result: 5 passed in 50.6 seconds.
- Covered: shell/health, food creation, OCR label parsing including NRV, frozen Today snapshot, Evidence upload/reload/blob readback, edit/rollback/source switching, Today recalc/resize/void, append-only export audit.

Two pre-gate failures were retained as useful evidence and fixed before passing:

1. Node `APIRequestContext` stalled behind the local proxy; same-origin health/export/blob checks now run through the real browser context.
2. The remote KV path exposed asynchronous app readiness and save-completion races; the app now emits `data-app-ready`, and the test waits for the post-save `#foods` transition.

### Ring 3 · Production canary

- Deployment: `dpl_ATa1VxmJ1Sy8iHETVc6ycPcKoujc`.
- Protected URL: `https://nutrition-ledger-1ovaqt78p-zons-projects.vercel.app`.
- Direct unauthenticated health request: HTTP 302 to Vercel SSO.
- Authenticated health: HTTP 200; `kvEnabled=true`, `blobBackend=kv`.
- Command used `E2E_READ_ONLY=1`.
- Result: 1 passed, 4 write scenarios skipped by design.
- The automatically assigned public alias `nutrition-ledger-mvp.vercel.app` returned HTTP 200 without SSO and was removed. It now returns HTTP 404.

## Operational notes

- The Vercel project's obsolete monorepo Root Directory was cleared because this is now an independently deployed child repository.
- Preview and Production remain isolated by KV prefix.
- The app's current GET+SET snapshot persistence is suitable for this single-user MVP but is not a multi-writer strong-consistency design.
- Future production deployments may recreate the stable `.vercel.app` alias. Verify unauthenticated access after every production release and remove any alias that bypasses SSO.
