# Verification record

The repository test suite is designed to run in Node 24 without provider credentials or paid requests. It verifies:

- HTTP authentication and cookie issuance; cross-origin rejection.
- Input/JSON validation and rejection of mismatched image bytes.
- Duplicate request recovery, concurrent reservation protection and insufficient credit handling.
- Configurable initial balance and generation credit cost.
- Credits and completed results survive server restart.
- Client-supplied account IDs cannot select a fresh balance.
- Provider adapter payload using an in-process fake fetch; validates image input, strict output schema, timeout signal, non-storage flag and error redaction.
- Static UI presence for upload, product fields, language/audience controls, both generation actions and all seven output sections.
- Mobile breakpoints and absence of remote frontend dependencies or provider secrets.
- Server source and environment paths are not exposed through static routes.
- Future video job validation works while the provider remains disabled and no credits are charged.

GitHub Actions runs `npm test` for Studio branch changes and relevant pull requests.

Live OpenAI generation and external hosting require separate configuration and are intentionally not enabled by this code. Browser visual certification still depends on a real browser runtime; the source contains responsive breakpoints at 860px and 540px and uses 16px form controls to avoid mobile zoom behavior.

## Continuation verification — 2026-09-21

- `npm test`: 10 passing unit/static/frontend-execution tests plus HTTP integration smoke suite.
- Added checks: initial-load draft restoration, image-read generation guard, read-only result recovery, account isolation, unchanged credit balance, restart recovery and disabled-provider notice.
- The smoke server explicitly requests live mode with the provider gate OFF and no API key; template generation succeeds without a provider request.
- `node --check public/app.js` and `git diff --check`: passed.
- Visual browser test was attempted but could not run: no Chromium installed and its download timed out. No new visual/mobile screenshot verification is claimed.
- Read-only Render health returned disabled generation, paused provider and required login. No production generation or billable API request was made.


## Credit recovery hardening — 2026-09-23

- Studio version advanced to 0.6.0.
- Added timestamp migration for existing SQLite jobs without discarding prior balances or results.
- Pending reservations older than the configurable safety window are marked failed and refunded exactly once; they are never automatically retried against the AI provider.
- Completed Live results remain recoverable even when the provider is later paused or billing is unavailable.
- Added regression coverage for stale reservation refunds and paused-provider result recovery.
- Fixed the browser busy-state cleanup so an unavailable Live provider cannot be accidentally re-enabled after a generation.
- GitHub Actions now runs the Studio test suite on `main` as well as the Studio branch and pull requests.
- After correcting the version expectation, the 0.6.0 code and new frontend regression test passed GitHub Actions on `main`.
