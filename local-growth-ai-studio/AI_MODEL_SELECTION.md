# AI provider and model selection

**Review date: 2026-10-14.** Model availability and pricing change; recheck the official catalog before enabling a live provider.

## Choice for V2

OpenAI is the primary provider. The default configurable model is `gpt-6.1-sol`, using standard processing. This is a documented OpenAI API model and the provider's guidance positions it as a balance of intelligence and cost for complex work. It is the best starting point for V2's multi-step research, product, pricing and ad workflow, subject to a product-specific evaluation before real customer use.

The current app remains in local mode: `ENABLE_LIVE_AI=0` and provider switches are off. The model setting is only a prepared default; it does not call the API or create a key. In local mode, the app uses labeled deterministic templates, not an AI model. Provider adapter tests use mocked HTTP responses and make no network calls.

## Official OpenAI model comparison

Prices below are USD per million text tokens, standard processing, before any applicable taxes or extra tool charges. Latency is workload- and network-dependent; the API docs do not give a stable end-to-end latency guarantee for these models.

| API model | Official positioning / quality | Input / output | Speed options | V2 decision |
| --- | --- | ---: | --- | --- |
| `gpt-6-astra` | OpenAI flagship for the most demanding reasoning and coding | $10 / $50 | Standard; faster service tiers are priced higher | Higher expected quality ceiling, but five times Sol's standard token price; not the default |
| `gpt-6.1-sol` | Near-Astra performance for complex work at lower cost; current OpenAI default recommendation for V2 | $2 / $10; cached input $0.10 | Standard default; Fast costs 2x, Ultrafast costs 6x standard. OpenAI reports up to 8x faster token generation for Ultrafast in the launch material | Selected default as the quality/cost balance; no application latency benchmark has been run |
| `gpt-6-luna` | Efficient for focused, high-volume, repeatable tasks; less suited as the only model for difficult multi-step research | $0.10 / $0.50; cached input $0.01 | Standard; exact real-time latency not measured here | Candidate for a future low-cost routine-task tier, not the default |

OpenAI's public evaluations are not a substitute for evaluating this product's Arabic output, evidence discipline, and completed business journeys. The repository has not run a live model bake-off, measured latency, or token costs. Live comparison requires separately approved API credentials and spend; none were used here.

## Provider adapter contract

- `AI_PROVIDER=openai` selects the primary OpenAI Responses API adapter. `OPENAI_MODEL` overrides `gpt-6.1-sol`.
- `AI_PROVIDER=anthropic` selects the optional Anthropic Messages adapter using the same strict output-shape validation. It is off by default.
- `ENABLE_LIVE_AI=1` plus the matching provider-enabled switch and server-side credential are required before either adapter can make a request.
- The browser never receives API credentials. The product-file factory is deterministic and remains separate from AI-provider calls.
- Invalid, incomplete, or shape-mismatched model output is rejected; there is no automatic cross-provider fallback that could hide a provider switch or unexpected cost.

## Sources

- [OpenAI GPT-6.1 Sol API model guide and pricing](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
- [OpenAI GPT model catalog](https://developers.openai.com/api/docs/models)
- [OpenAI GPT-6.1 Sol launch, evaluations, pricing, and availability](https://openai.com/index/introducing-gpt-6-1-sol/)
- [OpenAI Ultrafast mode documentation](https://developers.openai.com/api/docs/guides/ultrafast-mode)
