# Local Growth AI Studio — working beta

Independent mobile-first product-to-ad application. Customers do not need a ChatGPT account.

## Run locally

Requires Node.js 24 or later. No npm dependencies or paid services are needed for demo mode.

```sh
cd local-growth-ai-studio
npm start
```

Open http://localhost:8787. Demo mode uses clearly labeled sample templates; it does **not** analyze the uploaded image or generate AI content. The image preview, product form, language/audience controls, bilingual outputs, Ad/Reel flows, copy action, validation, configurable credits and persistent ledger all work locally.

```sh
npm test
```

The test suite covers the credit ledger, provider adapter contract, future video request contract, UI structure/mobile breakpoints, authentication, CSRF/origin checks, image validation, retry/idempotency behavior, persistent credits and protected server files. GitHub Actions also runs these tests on the Studio branch and relevant pull requests.

## Live generation is deliberately disabled

Adding a key alone does not activate billable requests. Live generation requires all of:

- Owner approval of API use and a spending budget.
- An OpenAI project key delivered through secure setup to the server environment.
- An explicitly selected `OPENAI_MODEL` that supports images and structured outputs.
- `ENABLE_LIVE_AI=1`.
- `OPENAI_PROVIDER_ENABLED=1` as a second, explicit billing/provider gate. Keep this at `0` while OpenAI billing is postponed.
- A private `STUDIO_ACCESS_CODE` at least 24 characters long.
- An HTTPS `APP_ORIGIN` matching the application's public URL.

With `OPENAI_PROVIDER_ENABLED=0`, the Studio stays in template mode even if `ENABLE_LIVE_AI=1`; no OpenAI request is sent. Never paste a provider key into chat, browser code, or GitHub. `.env` and local data are excluded from Git. `.env.example` contains configuration names only. Use a secure server environment for provisioning secrets.

The adapter uses the OpenAI Responses structured-output format, limits output tokens, imposes a timeout, validates all seven creative fields, and does not expose provider errors or credentials. No live provider call is required for development verification.

## Credits

Credits are owned by the server, not the browser. The private beta defaults to 100 credits and one credit per creative generation. Both can be changed without touching frontend code:

- `INITIAL_CREDITS`
- `GENERATION_CREDIT_COST`

The UI reads the generation cost from the backend. Reservations happen before provider work, duplicate request IDs cannot double-charge, completed requests replay safely, and failed generations return the reserved Studio credit.

## Hosting

GitHub Pages hosts static files and cannot run this Node backend. Uploading this folder to GitHub is source storage, not a live application deployment. The existing Local Growth sales pages remain separate.

Deploy the included Dockerfile to a Node/container host with HTTPS and a persistent volume at `/app/data`, or run Node 24 behind an HTTPS reverse proxy. Bind `HOST=0.0.0.0` when needed by the host. Configure environment values on that server; `APP_ORIGIN` controls same-origin requests and secure session cookies. Do not use an ephemeral filesystem for credits.

Before choosing a paid host or enabling paid AI, obtain the owner's approval. No hosting service, domain change, paid provider or API spend is enabled by this repository.

## Beta scope

- Private access-code login with HttpOnly, SameSite cookies; production cookies require HTTPS.
- One private beta account and one separate shared demo account; supplied `userId` values are ignored.
- SQLite durable credit reservations and deduplicated request IDs survive restarts.
- Failed operations return the Studio credit. Provider-side charges on a timeout may still occur; requests are not automatically retried against the provider.
- Pending jobs after an abrupt crash stay reserved. The owner must reconcile them against provider records; automatic retry/refund could otherwise duplicate cost.
- Outputs are retained locally for retry recovery. Uploaded images are not stored; only a request fingerprint is retained.
- This is **not yet a multi-customer credit-selling service**. Add individual accounts, provisioning, quotas, purchase fulfillment, retention policy and operational monitoring before selling customer credit balances.
- Video generation remains unavailable and never charges credits. The backend now validates a future video job shape (script, duration, aspect ratio), but no provider or video credit price has been selected.

## Mobile recovery and export

The text brief is restored from this browser's local storage on page load. Product images are intentionally not saved there. The current tab remembers only the last generation's random ID and output language in session storage. After a reload or connection loss, **Recover last result** reads the existing server job without running the provider or reserving another credit. Pending jobs remain pending; failed jobs show that the Studio credit was returned. Recovery requires the same authenticated beta account and the original database. Closing the tab or clearing browser storage can remove the recovery pointer.

**Download .txt** exports all seven creative sections as UTF-8 text (including Arabic). **Copy all** remains available. Starting another generation is a new credit-bearing action.
