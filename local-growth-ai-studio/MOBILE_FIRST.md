# Mobile-first operation and private preview

Mobile use is a product requirement. Customers should use the complete workspace from Chrome on Android or Safari/Chrome on iPhone without a computer, Termux, USB, or app installation.

## What runs in the browser and what needs the server

| Capability | Runs in the browser | Needs the Node server |
| --- | --- | --- |
| Responsive V2 navigation, forms, and product previews | Yes | Static page delivery and login session |
| Touch drawing, editable answers, and local preview autosave | Yes, in the same-origin HTML preview | The preview file must first be generated and served |
| Project creation, project recovery, and saved product lists | No | Yes, SQLite in `WORKSPACE_DB` |
| Business model, cost plan, user-entered market notes, optional live web evidence, and launch checklist | Responsive form and preview | Authenticated API; project-scoped SQLite output; optional server-side Tavily key |
| PDF/XLSX/HTML generation and authenticated download | No | Yes, generation routes and `PRODUCT_FILES_DIR` |
| Budget preview recalculation and editable fields | Yes, in HTML | Server creates and protects the companion HTML and XLSX |
| Arabic PDF font embedding and RTL PDF layout | No | Yes, server-side PDF generator and bundled DejaVu font |
| Local template factory | No API required | Server required; it does not call an AI provider |
| OpenAI/Anthropic strategy enhancement | No | Optional provider setup; disabled for private preview |

The database and generated files must live on persistent storage. An ephemeral container filesystem can lose projects and downloads after a restart. Host the app from `local-growth-ai-studio/Dockerfile` or run Node 24 behind an HTTPS reverse proxy. GitHub Pages can only serve static files and cannot replace the API server, SQLite, or protected file storage.

Optional live market search uses Tavily's server API. `ENABLE_MARKET_SEARCH` defaults to `0`; no search is performed unless both the flag and `TAVILY_API_KEY` are set on the server. The browser never receives the key. Keep it disabled in local/phone tests unless the owner separately provisions the no-card free tier. Snippets are source leads and do not establish price, supplier reliability, inventory, or demand.

## Private phone preview before public launch

The repository does not currently create a hosted preview, and no preview URL is checked in. A real phone preview needs a separately hosted HTTPS staging instance because the backend creates and stores the products. Keep staging owner-only using the hosting provider's access controls, or a private access gate; use a separate staging database and file volume. Do not point staging at production data.

For a no-API-cost staging instance, set server environment values in the host's secret/environment settings:

```text
HOST=0.0.0.0
PORT=8787
ENABLE_LIVE_AI=0
OPENAI_PROVIDER_ENABLED=0
ANTHROPIC_PROVIDER_ENABLED=0
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
STUDIO_ACCOUNTS_JSON={"owner":"<temporary unique random value of at least 24 characters>"}
APP_ORIGIN=https://<private-staging-hostname>
WORKSPACE_DB=/app/data/workspace.sqlite
PRODUCT_FILES_DIR=/app/data/generated-products
```

Configure persistent storage for `/app/data`, HTTPS, and the host's owner-only access gate. The `APP_ORIGIN` must match the staging HTTPS origin so the session cookie gets the `Secure` attribute. Keep the staging URL private and do not enable Live AI. The factory and local V2 templates work without provider credentials.

### Phone acceptance run

Open the owner-only staging URL directly in Chrome on Android and Safari on iPhone. Sign in, create a test project, then verify:

0. Choose digital, physical, service, dropshipping, or print-on-demand. On the Launch Planner, enter a supplier name and current unit quote for a physical model; confirm the app labels it user-provided/unverified and calculates the expected profit from your numbers. Confirm it does not display a fabricated vendor or market price.

1. Every section is reachable, including Reels, Brand Profile, and Saved Projects from the mobile **More** menu.
2. Create an Arabic coloring/activity book. Open its in-app preview, draw with a finger or stylus, type into the answer field, reload the project, and confirm the drawing and answer remain saved.
3. Download the print PDF and interactive HTML copy. Confirm the Arabic PDF renders right-to-left and the companion preview responds to touch.
4. Create a budget XLSX, open its HTML preview in the app, change income and expense cells, and confirm totals/net savings update and persist after reload; download the XLSX from the same interface.
5. Close/reopen the browser, sign in again, and confirm the project, asset list, preview, and downloads are restored.

Record actual device, OS, browser version, viewport, and results. CSS assertions and server smoke tests are not substitutes for this physical-device run.

### Device result sheet

Use one row per browser/device combination and record **Pass / Fail / Not run**. Test at normal text size and with the on-screen keyboard open. Repeat touch items after rotating the device if orientation changes are part of the intended use.

| Device and browser | Login + project recovery | Arabic PDF + RTL | Finger drawing + saved writing | XLSX preview recalculation | PDF/HTML/XLSX downloads | Notes / browser version |
| --- | --- | --- | --- | --- | --- | --- |
| Samsung Android 13 · Chrome | Not run | Not run | Not run | Not run | Not run | Owner device test required |
| iPhone · Safari | Not run | Not run | Not run | Not run | Not run | Record exact iOS version |
| iPhone · Chrome | Not run | Not run | Not run | Not run | Not run | Test separately from Safari |

For failures, record the project/test asset ID (never the user's access code), a screenshot, and the browser console or download behavior. Do not capture session cookies or API credentials in screenshots.

## Account and project isolation

The server supports pre-provisioned accounts through `STUDIO_ACCOUNTS_JSON`, a server-only JSON mapping from account IDs to distinct, randomly generated access codes. The legacy `STUDIO_ACCESS_CODE` remains as a one-account compatibility option and maps to `beta-owner`. There is no self-service sign-up, password reset or payment flow.

Each login creates an opaque random session token. Only its SHA-256 hash, account ID and expiration are stored in SQLite. The browser receives the token in an HttpOnly, SameSite=Strict cookie; HTTPS adds Secure. Sessions expire after eight hours and can be revoked with **Sign out**. All V2 projects, research, products, messages, tasks, outputs and factory file lookups use the authenticated account ID. File downloads also require a project and matching saved output record, so knowing another user's project/file ID is insufficient. The legacy credit ledger now scopes Demo balances and idempotency records per account; the original beta-owner ledger key is retained for migration compatibility.

To provision accounts, create different high-entropy 24+ character codes off-repository and place the JSON in the host secret manager. Never commit actual codes or share one code between customers. The owner must distribute each code using a secure channel. Staging should use its own account codes, SQLite files and product volume, with host-level owner-only access in addition to the app login.

## Deployment status and exact preview requirement

No staging server, hostname, TLS certificate, access policy, or persistent host volume is provisioned by this repository, and no phone-preview URL is available. The checked-in `.env.staging.example` and Docker configuration prepare the app but do not create a hosted instance. To make an actual HTTPS phone preview available, the owner must choose or approve a container host and private hostname, provide a persistent volume mounted at `/app/data`, configure HTTPS and owner-only access at the host, and add the environment values from the example to the host's secret store. This work has not been performed.

Keep Live AI disabled for phone acceptance. The local factory remains deterministic template generation and costs no provider API spend. Do not expose the staging URL to customers until account provisioning, retention, monitoring and support/recovery policies are ready.
