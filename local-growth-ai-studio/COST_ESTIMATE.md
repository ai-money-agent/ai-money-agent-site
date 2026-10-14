# Cost estimate (14 October 2026)

This is a planning estimate, not a purchase or a deployment. Current code remains on PR 4. No hosting account, domain, key, paid plan, or payment method was created. The figures are USD, before taxes, and should be rechecked at checkout because provider pricing and quotas can change.

## Current test cost

| Test activity | Cost now | Notes |
| --- | ---: | --- |
| Unit, API, security-isolation, persistence, factory, formula and UI static tests | $0 | Runs locally; real provider calls are disabled. |
| Android/iPhone acceptance on devices already owned | $0 | Manual device use only; no device was available in this environment. |
| Real OpenAI integration test | $0 until enabled | Code already supports server-side OpenAI; a valid key and billable API usage are required. Never put a key in the browser. |
| Real market search test | $0 on Tavily Researcher | 1,000 free API credits per month; no card required. The integration is coded but disabled until the owner provisions a key and enables it. |
| Temporary private hosted phone preview | $7.25 for a full month | Proposed Render Starter service ($7) plus a 1 GB persistent disk ($0.25). No preview is running now. |

For a future real-provider smoke test, a **$5 usage allowance** is a useful planning amount, not a required subscription. With the example request sizes below it covers about 277 Sol calls or 5,555 Luna calls. The code and tests do not consume this allowance.

## Provider rates and billing cadence

| Component | Free option | Paid rate / billing | Use in this app |
| --- | --- | --- | --- |
| OpenAI GPT-6.1 Sol | No API free quota assumed | $2 / 1M input tokens, $10 / 1M output tokens (short context); usage-metered | Better default for strategy and product quality; current default is already `gpt-6.1-sol`. |
| OpenAI GPT-6 Luna | No API free quota assumed | $0.10 / 1M input, $0.50 / 1M output (short context); usage-metered | Lower-cost high-volume alternative; current provider adapter can switch the server model through `OPENAI_MODEL`. |
| OpenAI web search tool | No free quota assumed | $10 / 1,000 search calls plus model tokens; usage-metered | Not currently connected. Prefer Tavily for a low-cost separate search path. |
| OpenAI image generation | No fixed per-image price | GPT Image 2.5 low square example: $0.00588 image-output tokens, plus prompt/input tokens; usage-metered and varies by size/quality | Not connected to the factory. Existing book illustrations are generated locally as vector artwork, so the factory's incremental image API cost is $0. |
| Tavily Search API | 1,000 credits/month; no card required | $30/month for 4,000; $100/month for 15,000; $220/month for 38,000; $500/month for 100,000; or $0.008/credit pay-as-you-go | Implemented as optional server-side search. Basic search is configured and source leads are saved to the project. |
| SerpAPI | 250 searches/month; 50/hour | Starter $25/month, month-to-month; enterprise custom | Alternative Google SERP source; not implemented. |
| Brave Search API | $5 monthly credit (about 1,000 queries at $5/1,000) | $5 / 1,000 requests; usage-metered | Official FAQ says even its free plan requires a card for identity verification; excluded from a no-card trial. Not implemented. |
| DataForSEO | Small sandbox/trial allowance is advertised | $50 minimum prepaid top-up; credits do not expire | Not implemented; not suitable for the current no-payment constraint. |
| Digital products | $0 | No per-file charge in current app | PDF, interactive HTML, XLSX and quiz generation run on the app server. Hosting/storage still apply. |

OpenAI model prices above are for short-context text tokens. Long-context, regional processing, priority/fast modes, image inputs, and prompt caching have different rates. The $5 call counts use 4,000 input + 1,000 output tokens per call, without caching or web search.

## Hosting, database, files, and protection

| Option | Free / entry price | Persistence and billing | Fit |
| --- | --- | --- | --- |
| Render (recommended first private staging) | Free web service and TLS; free instance sleeps after 15 minutes and has no persistent disk. Paid Starter is $7/month, 0.5 CPU and 512 MB RAM. | Persistent disk is $0.25/GB/month. A 1 GB disk gives a planning total of $7.25/month ($87/year if used for 12 months). Render-managed TLS and HTTPS redirect are included; extra outbound bandwidth is $0.15/GB after included allowance. | Best fit without a database migration: current Node server + SQLite + generated files can share `/app/data` on a single paid persistent disk. One instance only; offsite backup still needs a separate plan. |
| Railway Hobby | $5/month minimum, includes $5 of compute usage. | Volume storage $0.15/GB/month; CPU $20/vCPU-month and RAM $10/GB-month, metered by minute. Overage is billed; not a hard $5 cap. A full-time 0.5 vCPU + 0.5 GB estimate is roughly $15 compute + $0.15 per 1 GB volume/month. | Simple persistent volumes and deploy previews, but less predictable for an always-on server. |
| Supabase | Free: $0, 500 MB database, 1 GB object storage, 5 GB egress; free DB pauses after a week inactive and has no automatic backups. | Pro: $25/month ($300/year), includes 8 GB DB disk, 100 GB object storage, 250 GB egress, daily backups retained 7 days; overages apply. | Could supply managed PostgreSQL/Auth/storage later, but today's app uses SQLite and would need a migration. It does not replace the Node app host. |
| Cloudflare R2 | 10 GB-month storage, 1M Class A and 10M Class B operations/month; egress free. | Standard storage $0.015/GB-month, Class A $4.50/million, Class B $0.36/million after free quotas. | Optional low-cost offsite product/backup object storage. Not wired into this project; adding it requires S3-compatible upload and retention code. |
| Cloudflare Access | Zero Trust Free is available for up to 50 users. | $0 for the free allowance; other plans are per-user/contract. | Optional extra login gate for a private preview. Usually needs a domain on Cloudflare; if the owner does not already have one, registrar/domain cost is additional and varies. No domain was purchased or checked. |
| App account/session controls | $0 | Included in this repository | Pre-provisioned access codes, hashed server-side session tokens, HttpOnly/SameSite cookie, account/project scoping. Professional security audit and managed monitoring are not included. |

Render's free TLS and the app's existing session login can support a low-cost owner-only staged instance, but a public `onrender.com` hostname remains reachable at the login page. For a stricter host-level gate, add Cloudflare Access and a controlled domain. Generated files and SQLite currently have no automated offsite backup; R2 can fit the free allowance, but the backup integration is not done.

## Unified monthly scenarios

Assumptions: 100 complete user journeys/month; 7 AI calls per journey (idea, market strategy, offer, brand, ad, reel, and assistant), each 4k input + 1k output tokens; one Tavily basic query per journey; 20 generated low-quality square images if image generation is later enabled. Current app uses local deterministic templates unless live AI is explicitly enabled; actual file creation does not call AI.

| Scenario | Host + persistent disk | AI tokens | Market search | Images | Monthly estimate | Annualized |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Simulation + live Tavily search | $7.25 | $0 | $0 (100 credits within free quota) | $0 (local vector art) | **$7.25** | **$87.00** |
| Sol + live Tavily + 20 low images | $7.25 | $12.60 | $0 | ~$0.12 + prompt/input tokens | **about $19.97** | **about $239.64** |
| Luna + live Tavily + 20 low images | $7.25 | $0.63 | $0 | ~$0.12 + prompt/input tokens | **about $8.00** | **about $96.00** |
| Sol + one OpenAI web search per journey | $7.25 | $12.60 | $1.00 | ~$0.12 + prompt/input tokens | **about $20.97** | **about $251.64** |
| Supabase Pro + Render host/disk + Sol + Tavily | $32.25 | $12.60 | $0 | not included | **about $44.85** | **about $538.20** |

These estimates exclude taxes, domain purchase, unusually large PDFs, extra egress, prompt/image input tokens, high-quality image generations, backups beyond R2's free allowance, support, and unexpected traffic. In the existing app, the lowest-cost recommendation is **Render Starter + 1 GB disk, SQLite, Tavily free tier, local vector illustrations, and Sol only after an approved API allowance**. If the quality is acceptable for routine stages, switching to Luna lowers the assumed 100-journey AI portion from $12.60 to $0.63/month.

## What remains unpurchased / unavailable

- No hosting or database service has been created; no public or private preview URL exists.
- No OpenAI key or credit has been created. Real OpenAI calls remain untested and disabled.
- Tavily code and mock tests are complete, but its live endpoint has not been exercised because no key is provisioned.
- No card, paid plan, custom domain, R2 bucket, or paid market-search plan was added.
- Android/iPhone device acceptance remains manual; static and API tests do not count as real-device coverage.

## Official price and capability references

- [OpenAI models](https://developers.openai.com/api/docs/models) · [OpenAI API pricing](https://developers.openai.com/api/docs/pricing) · [web search pricing](https://developers.openai.com/api/docs/guides/tools-web-search) · [image generation costs](https://developers.openai.com/api/docs/guides/image-generation)
- [Tavily pricing](https://www.tavily.com/pricing) · [Tavily plan details](https://help.tavily.com/articles/8816424538-pricing)
- [SerpAPI pricing](https://serpapi.com/pricing) · [Brave Search API pricing and card requirement](https://brave.com/search/api/)
- [Render pricing](https://render.com/pricing) · [persistent disks and free-tier limits](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses) · [Render managed TLS](https://render.com/docs/custom-domains)
- [Railway pricing](https://docs.railway.com/pricing) · [Railway plan and included usage](https://docs.railway.com/pricing/plans)
- [Supabase pricing](https://supabase.com/pricing) · [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) · [Cloudflare Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/)
