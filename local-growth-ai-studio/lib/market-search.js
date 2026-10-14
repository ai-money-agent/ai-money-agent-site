import { isIP } from 'node:net';

const API_URL = 'https://api.tavily.com/search';

function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    const address = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1,-1) : hostname;
    const ipv4 = isIP(address) === 4 ? address.split('.').map(Number) : null;
    const privateV4 = ipv4 && (ipv4[0] === 0 || ipv4[0] === 10 || ipv4[0] === 127 || ipv4[0] >= 224
      || (ipv4[0] === 100 && ipv4[1] >= 64 && ipv4[1] <= 127)
      || (ipv4[0] === 169 && ipv4[1] === 254)
      || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31)
      || (ipv4[0] === 192 && ipv4[1] === 168)
      || (ipv4[0] === 192 && ipv4[1] === 0 && ipv4[2] === 0)
      || (ipv4[0] === 198 && [18,19].includes(ipv4[1])));
    const privateV6 = isIP(address) === 6 && (address === '::' || address === '::1' || /^f[cd]/i.test(address) || /^fe[89ab]/i.test(address)
      || /^::ffff:(?:0:)?(?:127\.|10\.|192\.168\.|169\.254\.)/i.test(address));
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || privateV4 || privateV6) return null;
    return url.href;
  } catch { return null; }
}

export function normalizeTavilyResults(body, limit = 8) {
  const raw = Array.isArray(body?.results) ? body.results : [];
  return raw.slice(0,limit).flatMap(item => {
    const url = safeSourceUrl(item?.url);
    const title = typeof item?.title === 'string' ? item.title.trim().slice(0,240) : '';
    const content = typeof item?.content === 'string' ? item.content.trim().slice(0,1200) : '';
    if (!url || !title || !content) return [];
    return [{title,url,excerpt:content,score:Number.isFinite(item.score) ? Math.max(0,Math.min(1,item.score)) : null,publishedAt:typeof item.published_date==='string' ? item.published_date.slice(0,40) : null}];
  });
}

export async function searchMarketSources({query, apiKey, enabled = false, fetchImpl = fetch}) {
  const normalizedQuery = String(query || '').trim().replace(/\s+/g,' ').slice(0,360);
  if (normalizedQuery.length < 3) throw Object.assign(new Error('Enter a product or market query.'),{status:422});
  if (!enabled || !apiKey) return {available:false,status:'disabled',provider:'Tavily',query:normalizedQuery,sources:[],message:'Live search is not configured. No web search was performed.'};
  const response = await fetchImpl(API_URL,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({api_key:apiKey,query:normalizedQuery,topic:'general',search_depth:'basic',max_results:8,include_answer:false,include_raw_content:false})
  });
  if (!response.ok) throw Object.assign(new Error(`Market search provider returned ${response.status}.`),{status:502});
  let body;
  try { body=await response.json(); } catch { throw Object.assign(new Error('Market search provider returned invalid data.'),{status:502}); }
  return {available:true,status:'live_search_results',provider:'Tavily',query:normalizedQuery,sourceCount:normalizeTavilyResults(body).length,retrievedAt:new Date().toISOString(),sources:normalizeTavilyResults(body)};
}
