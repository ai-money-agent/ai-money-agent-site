# Mobile-first operation and private preview

Mobile use is a product requirement. Customers should use the complete workspace from Chrome on Android or Safari/Chrome on iPhone without a computer, Termux, USB, or app installation.

## What runs in the browser and what needs the server

| Capability | Runs in the browser | Needs the Node server |
| --- | --- | --- |
| Responsive V2 navigation, forms, and product previews | Yes | Static page delivery and login session |
| Touch drawing, editable answers, and local preview autosave | Yes, in the same-origin HTML preview | The preview file must first be generated and served |
| Project creation, project recovery, and saved product lists | No | Yes, SQLite in `WORKSPACE_DB` |
| PDF/XLSX/HTML generation and authenticated download | No | Yes, generation routes and `PRODUCT_FILES_DIR` |
| Budget preview recalculation and editable fields | Yes, in HTML | Server creates and protects the companion HTML and XLSX |
| Arabic PDF font embedding and RTL PDF layout | No | Yes, server-side PDF generator and bundled DejaVu font |
| Local template factory | No API required | Server required; it does not call an AI provider |
| OpenAI/Anthropic strategy enhancement | No | Optional provider setup; disabled for private preview |

The database and generated files must live on persistent storage. An ephemeral container filesystem can lose projects and downloads after a restart. Host the app from `local-growth-ai-studio/Dockerfile` or run Node 24 behind an HTTPS reverse proxy. GitHub Pages can only serve static files and cannot replace the API server, SQLite, or protected file storage.

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
STUDIO_ACCESS_CODE=<temporary random value of at least 24 characters>
APP_ORIGIN=https://<private-staging-hostname>
WORKSPACE_DB=/app/data/workspace.sqlite
PRODUCT_FILES_DIR=/app/data/generated-products
```

Configure persistent storage for `/app/data`, HTTPS, and the host's owner-only access gate. The `APP_ORIGIN` must match the staging HTTPS origin so the session cookie gets the `Secure` attribute. Keep the staging URL private and do not enable Live AI. The factory and local V2 templates work without provider credentials.

### Phone acceptance run

Open the owner-only staging URL directly in Chrome on Android and Safari on iPhone. Sign in, create a test project, then verify:

1. Every section is reachable, including Reels, Brand Profile, and Saved Projects from the mobile **More** menu.
2. Create an Arabic coloring/activity book. Open its in-app preview, draw with a finger or stylus, type into the answer field, reload the project, and confirm the drawing and answer remain saved.
3. Download the print PDF and interactive HTML copy. Confirm the Arabic PDF renders right-to-left and the companion preview responds to touch.
4. Create a budget XLSX, open its HTML preview in the app, change income and expense cells, and confirm totals/net savings update and persist after reload; download the XLSX from the same interface.
5. Close/reopen the browser, sign in again, and confirm the project, asset list, preview, and downloads are restored.

Record actual device, OS, browser version, viewport, and results. CSS assertions and server smoke tests are not substitutes for this physical-device run.

## Customer-data isolation limit

The current beta uses a single `STUDIO_ACCESS_CODE` and one `beta-owner` workspace account. Different customers using that same access code would share the same project namespace. Owner-only staging is suitable for the owner's phone test, but this build must not be opened to multiple customers until individual account provisioning, session-to-account binding, per-account project/file isolation, account recovery, and abuse/rate limits are implemented and tested.

Do not publish or invite customers to the current beta as a multi-tenant service. No paid API, payment flow, or public deployment is required for the private template-factory preview.
