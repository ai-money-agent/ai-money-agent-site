# Architecture

Browser → same-origin Node HTTP server → input validation/access control → SQLite reservation → generator adapter → schema validation → completed ledger entry → browser.

## Security

The API key stays in the server environment. Live provider execution requires an explicit enable flag, model, long private access code and HTTPS origin. An access code establishes an eight-hour HttpOnly/SameSite session signed by the server. The beta has one private account; browser-supplied account identifiers cannot mint or select balances. Demo uses a separate shared account and makes no provider calls.

POST endpoints require JSON and reject cross-origin browser requests. The server uses a strict static-file allowlist, restrictive CSP and safe text rendering. IP rate limits use the socket address, not arbitrary forwarding headers; requests behind a reverse proxy currently share a rate bucket. Add trusted proxy integration and shared limits before horizontally scaling.

Image input is bounded at 5 MB and checked for MIME, canonical base64 and file signatures. This is not a full image decoder. Browser preview decodes the image; the provider may reject malformed image data, returning the Studio credit. The overall request limit is 8 MB.

## Credits and retry behavior

SQLite tables: `accounts(id,balance,used)` and `jobs(account,id,fingerprint,status,cost,output,created_at,updated_at)`. `BEGIN IMMEDIATE` ensures atomic reservation and a nonnegative balance. Client request IDs are bound to a normalized-brief hash. A repeated completed request returns its stored result; a pending request cannot start a second provider job. Changed content under the same ID is rejected. Failed jobs refund once.

The initial private-beta balance, creative generation cost and stale-reservation timeout are server configuration (`INITIAL_CREDITS`, `GENERATION_CREDIT_COST`, `PENDING_JOB_TIMEOUT_MINUTES`). The browser reads the current generation cost from the API rather than trusting a hard-coded price.

SQLite must live on persistent local storage. Do not run independent replicas with separate databases. Pending jobs are never automatically retried against the provider; if they remain pending beyond the configured safety timeout, the ledger marks them failed and refunds the reservation exactly once. Successful creative outputs remain stored for idempotent recovery even if the provider is later paused; images and raw briefs are not persisted. Add retention and deletion controls before broad customer launch.

## Generation

`lib/generator.js` isolates provider-specific behavior. The Responses request includes image input only when uploaded, requests a strict JSON schema, disables response storage, caps output, and times out. Runtime validation rejects missing or malformed fields. The demo provides sample templates and makes no image-understanding claim.

## Future video integration

`lib/video.js` defines the provider-independent input contract. `POST /api/video/prepare` currently validates script, duration and aspect ratio, then returns `501 provider_not_connected` without reserving credits. Supported preparation targets are vertical (9:16), square (1:1) and landscape (16:9) with controlled short-form durations.

A future provider adapter should reserve an agreed cost, persist the remote job ID, authenticate callback signatures, settle the ledger once, and return an expiring asset URL. No provider, API key, paid plan or video credit price is assumed by the current code.
