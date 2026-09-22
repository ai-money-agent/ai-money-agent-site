# Continuation checkpoint — 2026-09-21

## Source inspected

Repository: ai-money-agent/ai-money-agent-site. Continue on `codex/local-growth-studio`, starting at `8c0852a159c33cc6bf6d269ae3f32d5e48b6640f`. The default `main` branch contains the sales site; the Studio application is on its existing branch. Do not restart it or replace the sales pages.

## Already present before this continuation

- Mobile-first product form, PNG/JPEG/WebP preview, product name/description, audience and English/Arabic/bilingual selection.
- Ad and Reel paths returning Hook, Reel script, shot list, on-screen text, caption, CTA and ad ideas.
- Explicit sample-template mode; server-side provider adapter with structured-output validation.
- Two live-provider gates; a paused provider does not send billable requests.
- Private access-code sessions, origin protection, input checks, rate limiting, static-file allowlist and server-only credentials.
- SQLite credit reservations, replay protection, failure refunds and restart persistence.
- Future video request validation; no connected video generator.
- Docker configuration and automated tests.

## Added in this continuation

- Fixed text draft restoration on initial load (previously only called after login).
- Prevented generation while an image is still being read.
- Authenticated, account-scoped GET /api/generations/:id for read-only recovery.
- Per-tab recovery pointer with no image, API key or access code stored in it.
- Recover-last-result UI and UTF-8 text export for all creative sections.
- Regression coverage for recovery isolation, pending/completed/failed jobs, restart recovery, unchanged credit balance and paused-provider configuration.

## Remaining external work

Live provider operation still requires owner-approved API billing/configuration; this continuation makes no real provider requests. Video generation still needs a selected and authorized provider. A multi-customer commercial service needs individual accounts and provisioning beyond this private-beta scope. Durable credit storage must be verified in the hosting configuration before selling balances. Source verification does not establish that Render has deployed this revision.

## Read-only production check

Render /api/health responded with engine=disabled, aiConnected=false, providerPaused=true and requiresLogin=true. To enable existing sample templates without API billing, set ALLOW_MOCK_GENERATION=1 on the host while keeping OPENAI_PROVIDER_ENABLED=0. The UI notice now distinguishes paused-and-disabled from active template mode. No host setting was changed.


## 2026-09-23 continuation

Work continued on the current `main` state; the old `codex/local-growth-studio` branch was confirmed to be behind `main` and contained no newer Studio commits.

Completed without paid API calls:
- Added automatic, one-time refunds for stale `pending` credit reservations after `PENDING_JOB_TIMEOUT_MINUTES` (default 15 minutes).
- Added backward-compatible SQLite timestamp migration for existing job rows.
- Made stored Live results readable even when the provider is currently paused/disabled.
- Kept Demo/Live availability controls correct after loading/generation states.
- Enabled GitHub Actions for Studio changes pushed to `main`.
- Added and ran regression tests for stale credits, paused-provider recovery and UI provider-state handling.
- Updated README, architecture and environment documentation for Studio 0.6.0.

External blocker remains unchanged: real Claude generation requires provider billing/credit to be active. No provider key, billing setting or paid service was changed.
