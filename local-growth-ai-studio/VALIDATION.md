# Verification record

Verified in Node 24 without provider credentials or paid requests:

- HTTP authentication and cookie issuance; cross-origin rejection.
- Input/JSON validation and rejection of mismatched image bytes.
- Duplicate request recovery, concurrent reservation protection and insufficient credit handling.
- Credits and completed results survive server restart.
- Client-supplied account IDs cannot select a fresh balance.
- Provider adapter payload tested with an in-process fake fetch; validates image input, strict output schema, timeout signal, non-storage flag and error redaction.
- Server source and environment paths are not exposed through static routes.
- Video endpoint remains disabled without charging credits.

Live OpenAI generation and external hosting require separate configuration and have not been verified.

Browser visual verification was attempted but Chromium was unavailable and its download timed out. Mobile CSS and upload-preview sizing were inspected and corrected in source; visual mobile behavior is not yet certified. The local Playwright check must be rerun once a browser runtime is available.
