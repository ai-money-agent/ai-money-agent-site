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
