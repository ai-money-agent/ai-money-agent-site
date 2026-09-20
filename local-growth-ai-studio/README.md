# Local Growth AI Studio — working beta

Independent mobile-first product-to-ad application. Customers do not need a ChatGPT account.

## Run locally

Requires Node.js 24 or later. No npm dependencies or paid services are needed for demo mode.

```sh
cd local-growth-ai-studio
npm start
```

Open http://localhost:8787. Demo mode uses clearly labeled sample templates; it does **not** analyze the uploaded image or generate AI content. The image preview, product form, bilingual outputs, Ad/Reel flows, copy action, validation, and persistent demo credit ledger all work locally.

```sh
npm test
```

## Live generation is deliberately disabled

Adding a key alone does not activate billable requests. Live generation requires all of:

- Owner approval of API use and a spending budget.
- An OpenAI project key delivered through secure setup to the server environment.
- An explicitly selected `OPENAI_MODEL` that supports images and structured outputs.
- `ENABLE_LIVE_AI=1`.
- A private `STUDIO_ACCESS_CODE` at least 24 characters long.
- An HTTPS `APP_ORIGIN` matching the application's public URL.

Never paste a provider key into chat, browser code, or GitHub. `.env` and local data are excluded from Git. `.env.example` contains configuration names only. Use the secure OpenAI setup flow for provisioning a key.

The adapter uses the [OpenAI Responses structured-output format](https://developers.openai.com/api/docs/guides/structured-outputs), limits output tokens, imposes a timeout, validates all seven fields, and does not expose provider errors or credentials. No live provider call was made during development verification.

## Hosting

GitHub Pages hosts static files and cannot run this Node backend. Uploading this folder to GitHub is source storage, not a live application deployment. The existing Local Growth sales pages remain separate.

Deploy the included Dockerfile to a Node/container host with HTTPS and a persistent volume at `/app/data`, or run Node 24 behind an HTTPS reverse proxy. Bind `HOST=0.0.0.0` when needed by the host. Configure environment values on that server; `APP_ORIGIN` controls same-origin requests and secure session cookies. Do not use an ephemeral filesystem for credits.

Before choosing a paid host or enabling paid AI, obtain the owner's approval. No hosting service, domain change, or paid provider has been purchased or enabled by this code.

## Beta scope

- Private access-code login with HttpOnly, SameSite cookies; production cookies require HTTPS.
- One private beta account and one separate shared demo account; supplied `userId` values are ignored.
- SQLite durable credit reservations and deduplicated request IDs survive restarts.
- Failed operations return the Studio credit. Provider-side charges on a timeout may still occur; requests are not automatically retried against the provider.
- Pending jobs after an abrupt crash stay reserved. The owner must reconcile them against provider records; automatic retry/refund could otherwise duplicate cost.
- Outputs are retained locally for retry recovery. Uploaded images are not stored; only a request fingerprint is retained.
- This is **not yet a multi-customer credit-selling service**. Add individual accounts, provisioning, quotas, purchase fulfillment, retention policy and operational monitoring before selling customer credit balances.
- Video generation remains unavailable and never charges credits. The provider selection and real video price remain undecided.
