# Local Growth AI Studio V2 — business partner workspace

V2 extends the existing creative beta instead of replacing its backend. Open `/v2` to use the new mobile-first business workspace.

## V2 strategy and OpenAI

- Create a persistent business project from country, budget, skills, time, business model, market scope and payout methods.
- Rank executable product/service/ecommerce ideas with an execution-fit score, then analyze an idea, plan the product, set pricing, create a brand, write ads and reels, and respond as a project-aware business partner.
- Save projects, products, research, creative outputs, partner messages and Recipes/Tasks in SQLite.

With `ENABLE_LIVE_AI=1`, `OPENAI_PROVIDER_ENABLED=1`, `AI_PROVIDER=openai`, an OpenAI API key and model configured, these V2 strategy steps call the OpenAI Responses API with structured output. Provider errors are returned without silently substituting template text. Without that configuration, the same journey uses local deterministic templates and labels their engine as `local`.

The Product Research score is intentionally **not presented as live market-demand data** in either mode. Current competitor names, live prices, trend volume and web demand require a separate live research source/API.

## Safety gates

V2 does not launch ads, publish posts, buy anything or make payments. Text generation may make billable OpenAI API calls only after the existing live provider gates are deliberately enabled. Image and video generation are not connected.

## Storage

V2 uses `WORKSPACE_DB` when configured, otherwise `data/workspace.sqlite`. On Docker hosting this resolves inside the persistent `/app/data` volume. The existing credit ledger remains separate.

---

# Local Growth AI Studio — working beta

Independent mobile-first product-to-ad application. Customers do not need a ChatGPT account.

## Run locally

Requires Node.js 24 or later. No npm dependencies or paid services are needed for demo mode.

```sh
cd local-growth-ai-studio
npm start
```

Open http://localhost:8787. Demo mode uses clearly labeled sample templates; it does **not** analyze the uploaded image or generate AI content. The image preview, product form, language/audience controls, bilingual outputs, Ad/Reel flows, copy/export actions, validation, recovery and persistent ledger all work locally. The UI now has an explicit **Demo / Live AI** selector; Demo always costs 0 Studio credits and never calls a provider.

```sh
npm test
```

The test suite covers the credit ledger, provider adapter contract, future video request contract, UI structure/mobile breakpoints, authentication, CSRF/origin checks, image validation, retry/idempotency behavior, persistent credits and protected server files. GitHub Actions runs these tests on `main`, the Studio branch, and relevant pull requests.

## Live generation and provider gates

Provider credentials remain server-only. The Studio supports both Anthropic/Claude and OpenAI adapters; the current provider choice is controlled by server environment configuration and is never exposed as a secret to the browser.

Live execution still requires the existing safety gates:

- `ENABLE_LIVE_AI=1`.
- The selected provider gate (`ANTHROPIC_PROVIDER_ENABLED=1` or `OPENAI_PROVIDER_ENABLED=1`).
- The selected provider API key and model in server environment variables.
- A private `STUDIO_ACCESS_CODE` at least 24 characters long.
- An HTTPS `APP_ORIGIN` matching the public application URL.

The browser can explicitly select **Demo** even when Live AI is configured. Demo never calls Claude or OpenAI, which allows full UI and workflow testing while provider billing is unavailable. Selecting **Live AI** is the only path that can send a provider request.

Do not put API keys in frontend files, GitHub, localStorage, sessionStorage or generated output. Provider errors are logged server-side with bounded messages; the browser receives a generic failure and refund message.

## Credits

Credits are owned by the server, not the browser. The private beta defaults to 100 Live AI credits and one credit per Live AI creative generation. Demo generation is always 0 credits. Both can be changed without touching frontend code:

- `INITIAL_CREDITS`
- `GENERATION_CREDIT_COST`
- `PENDING_JOB_TIMEOUT_MINUTES` — stale pending reservations are failed and refunded after this safety window.

The UI reads the selected mode's cost from the backend. Demo and Live AI use separate ledger accounts. Reservations happen before provider work, duplicate request IDs cannot double-charge, completed requests replay safely, and failed Live AI generations return the reserved Studio credit exactly once.

## Hosting

GitHub Pages hosts static files and cannot run this Node backend. Uploading this folder to GitHub is source storage, not a live application deployment. The existing Local Growth sales pages remain separate.

Deploy the included Dockerfile to a Node/container host with HTTPS and a persistent volume at `/app/data`, or run Node 24 behind an HTTPS reverse proxy. Bind `HOST=0.0.0.0` when needed by the host. Configure environment values on that server; `APP_ORIGIN` controls same-origin requests and secure session cookies. Do not use an ephemeral filesystem for credits.

Before choosing a paid host or enabling paid AI, obtain the owner's approval. No hosting service, domain change, paid provider or API spend is enabled by this repository.

## Beta scope

- Private access-code login with HttpOnly, SameSite cookies; production cookies require HTTPS.
- One private beta account and one separate shared demo account; supplied `userId` values are ignored.
- SQLite durable credit reservations and deduplicated request IDs survive restarts.
- Failed operations return the Studio credit. Provider-side charges on a timeout may still occur; requests are not automatically retried against the provider.
- Pending jobs after an abrupt crash are not retried against the provider. Once they are older than `PENDING_JOB_TIMEOUT_MINUTES` (15 minutes by default), the reservation is marked failed and its Studio credit is refunded exactly once. This avoids permanent credit loss while still leaving a buffer beyond the provider request timeout.
- Outputs are retained locally for retry recovery. Uploaded images are not stored; only a request fingerprint is retained.
- This is **not yet a multi-customer credit-selling service**. Add individual accounts, provisioning, quotas, purchase fulfillment, retention policy and operational monitoring before selling customer credit balances.
- Video generation remains unavailable and never charges credits. The backend now validates a future video job shape (script, duration, aspect ratio), but no provider or video credit price has been selected.

## Mobile recovery and export

The text brief is restored from this browser's local storage on page load. Product images are intentionally not saved there. The current tab remembers only the last generation's random ID, output language and Demo/Live mode in session storage. After a reload or connection loss, **Recover last result** reads the existing server job without running the provider or reserving another credit. Fresh pending jobs remain pending; stale reservations are automatically failed and refunded after the configured timeout. Failed jobs show that the Studio credit was returned. Recovery requires the same authenticated beta account and the original database. Closing the tab or clearing browser storage can remove the recovery pointer.

**Download .txt** exports all seven creative sections as UTF-8 text (including Arabic). **Copy all** remains available. Starting another generation is a new credit-bearing action.


## Digital Product Factory

The Product Builder creates downloadable starter files from its product type, language, age/audience, topic, page count, learning level, and supplied quiz questions. This factory uses local templates and never calls an AI provider:

- Multi-page PDF workbooks, coloring/activity PDFs, and educational worksheets with answer keys.
- XLSX budget planners and 12-month organizers with formulas.
- Offline quiz games as self-contained HTML from the user's questions.

PDF books and worksheets include a matching touch-friendly HTML copy with printable layout, canvas drawing, editable answer fields, and local browser saving. Arabic PDFs embed the bundled DejaVu Sans font and shape common Arabic joining forms for right-to-left layout; their companions use browser Arabic text shaping. XLSX budget products keep spreadsheet formulas and provide a live, phone-sized HTML preview that saves inputs locally, so a phone does not need a terminal or spreadsheet app just to inspect the budget. Quiz games run offline and use only complete questions the user supplied, up to the selected count.

Files are stored under the persistent `data/generated-products` directory by default (override with `PRODUCT_FILES_DIR`). SQLite saves each file and companion's project, type, filename, and download identifier, so the project can restore downloads after restart. Generated templates are labeled as local work and should be checked and customized before sale. The simulated AI connectivity check is separate from file creation; no result from the factory is presented as AI output.

## Mobile-first product requirement

The full workspace is intended to run in a mobile browser, with no customer-side computer, terminal, or app installation. On screens up to 760px the bottom navigation exposes the primary sections and a touch-friendly **More** menu exposes Reels, Brand Profile, and Saved Projects. The product factory uses a single-column form, large touch targets, safe-area spacing, and same-origin HTML previews for drawing, writing, budget calculations, and downloads. See [MOBILE_FIRST.md](MOBILE_FIRST.md) for server requirements, the private phone-preview runbook, and current customer-account limitations.

Mobile access still requires the Node backend on an HTTPS host. It handles authentication, project persistence, file generation, and protected downloads; GitHub Pages alone cannot provide these features. The current access-code beta has one shared workspace identity and is not ready for multiple independent customers until per-user accounts and project isolation are added.

