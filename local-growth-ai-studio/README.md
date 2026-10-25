# Local Growth AI Studio V2 — business partner workspace

V2 extends the existing creative beta instead of replacing its backend. Open `/v2` to use the new mobile-first business workspace.

## V2 strategy and OpenAI

OpenAI is the primary optional provider (`gpt-6.1-sol` is the prepared default); an Anthropic adapter remains available as an explicit alternative. Both stay disabled in the sample configuration. In local mode the UI labels the deterministic output as a simulation, not AI. See [AI model selection and official pricing comparison](AI_MODEL_SELECTION.md).

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
cp .env.staging.example .env
# For local HTTP, replace APP_ORIGIN with http://localhost:8787 and use a private random access code.
npm start
```

Open http://localhost:8787. The server is locked unless a valid `STUDIO_ACCOUNTS_JSON` or legacy `STUDIO_ACCESS_CODE` is configured; never use a real customer code for local testing. Demo mode uses clearly labeled sample templates; it does **not** analyze the uploaded image or generate AI content. The image preview, product form, language/audience controls, bilingual outputs, Ad/Reel flows, copy/export actions, validation, recovery and persistent ledger all work locally. The UI now has an explicit **Demo / Live AI** selector; Demo always costs 0 Studio credits and never calls a provider.

```sh
npm test
```

The test suite covers the credit ledger, provider adapter contract, future video request contract, UI structure/mobile breakpoints, durable account sessions, cross-account project/product/file/credit isolation, logout revocation, CSRF/origin checks, image validation, retry/idempotency behavior, persistence and protected server files. GitHub Actions runs these tests on `main`, the Studio branch, and relevant pull requests.

## Live generation and provider gates

Provider credentials remain server-only. The Studio supports both Anthropic/Claude and OpenAI adapters; the current provider choice is controlled by server environment configuration and is never exposed as a secret to the browser.

Live execution still requires the existing safety gates:

- `ENABLE_LIVE_AI=1`.
- The selected provider gate (`ANTHROPIC_PROVIDER_ENABLED=1` or `OPENAI_PROVIDER_ENABLED=1`).
- The selected provider API key and model in server environment variables.
- A private `STUDIO_ACCOUNTS_JSON` account map with unique access codes of at least 24 characters, or the legacy one-account `STUDIO_ACCESS_CODE`.
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

- Pre-provisioned private access-code accounts use opaque random HttpOnly, SameSite=Strict sessions. Only token hashes are stored in SQLite; HTTPS cookies add Secure, sessions expire in eight hours, and sign-out revokes the server session.
- Account IDs are resolved server-side from unique access codes. V2 projects, research, products, messages, tasks, outputs, factory downloads, and credit/idempotency records are scoped to the authenticated account; client `userId` values are ignored.
- Account provisioning is manual through the server-only `STUDIO_ACCOUNTS_JSON` environment value. There is no public signup, password reset, or payment flow.
- SQLite durable credit reservations and deduplicated request IDs survive restarts.
- Failed operations return the Studio credit. Provider-side charges on a timeout may still occur; requests are not automatically retried against the provider.
- Pending jobs after an abrupt crash are not retried against the provider. Once they are older than `PENDING_JOB_TIMEOUT_MINUTES` (15 minutes by default), the reservation is marked failed and its Studio credit is refunded exactly once. This avoids permanent credit loss while still leaving a buffer beyond the provider request timeout.
- Outputs are retained locally for retry recovery. Uploaded images are not stored; only a request fingerprint is retained.
- This is **not yet a customer credit-selling service**. Before selling access, add quotas, purchase fulfillment, retention policy, customer support/recovery and operational monitoring.
- Optional live market search now runs during product discovery and idea analysis when `ENABLE_MARKET_SEARCH=1` and a server-side `TAVILY_API_KEY` are configured. Global projects search worldwide; results remain unverified source leads and are never presented as proof of demand or current pricing.
- Product listings are saved as drafts inside the project. No storefront publishing, checkout, payment processing, or ad launch is connected.
- Optional HeyGen Video 1 generation creates a 10-second 480p video draft from the selected offer. It stays disabled unless `ENABLE_VIDEO_GENERATION=1` and a server-side `HEYGEN_API_KEY` are configured. Generation uses separate pay-as-you-go API credits; the app asks for confirmation before making the billable request.

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

## Business Launch Planner

The Launch Planner supports digital products, physical goods, services, dropshipping, and print on demand. It carries the user's chosen idea into an offer draft, transparent unit economics, customer-validation tasks, supplier checks where required, an ad-copy draft, and a manual launch checklist. Digital products can continue to the existing downloadable-file factory.

The Launch Planner has one-tap links to Google Search, Google Trends, Amazon, Etsy, Alibaba and Printful-focused search pages. An optional server-side Tavily connector can retrieve up to eight live web source snippets and save them to the authenticated project. It is off by default (`ENABLE_MARKET_SEARCH=0`); when no key is configured, the interface explicitly reports that no search happened. Set `TAVILY_API_KEY` and enable the flag only after provisioning a Tavily account. Results are leads from indexed pages, not verified demand, current prices, vendor identity, stock, or supplier quotes; open the original source and verify it yourself. Physical models still require the user to enter a current supplier quote and positive unit cost before profit is calculated. No supplier names or prices are invented. Fees, shipping, unit, packaging, other, and per-sale marketing costs are shown; profit and margin are calculated from those inputs. Search results and launch plans are stored within the authenticated project's SQLite output history and restored for that same account.

This planner is a local template calculation, not an AI answer or market report. The draft copy and checklist are starting points and do not publish ads, create supplier orders, or spend money.

## Mobile-first product requirement

The full workspace is intended to run in a mobile browser, with no customer-side computer, terminal, or app installation. On screens up to 760px the bottom navigation exposes the primary sections and a touch-friendly **More** menu exposes Reels, Brand Profile, and Saved Projects. The product factory uses a single-column form, large touch targets, safe-area spacing, and same-origin HTML previews for drawing, writing, budget calculations, and downloads. See [MOBILE_FIRST.md](MOBILE_FIRST.md) for server requirements, the private phone-preview runbook, account isolation details and the current hosting blocker.

Mobile access still requires the Node backend on an HTTPS host. It handles authentication, project persistence, file generation, and protected downloads; GitHub Pages alone cannot provide these features. The backend supports manually provisioned account isolation, but there is no hosted staging instance or phone URL yet. The checked-in [.env.staging.example](.env.staging.example) and Docker volume settings prepare owner-only HTTPS staging; the owner still needs to approve/select a host, private hostname, persistent volume and host-level access gate. No public hosting, tunnel or deployment has been created.

