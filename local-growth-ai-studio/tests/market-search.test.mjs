import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTavilyResults, searchMarketSources } from '../lib/market-search.js';

test('normalizes only bounded HTTPS sources and drops private or unsafe links',()=>{
  const sources=normalizeTavilyResults({results:[
    {title:'Safe',url:'https://example.com/path',content:'Useful excerpt',score:1.4,published_date:'2026-01-01'},
    {title:'HTTP',url:'http://example.com',content:'drop'},
    {title:'Private',url:'https://127.0.0.1/admin',content:'drop'},
    {title:'Private range',url:'https://172.20.1.2/',content:'drop'},
    {title:'IPv6 loopback',url:'https://[::1]/',content:'drop'},
    {title:'Credentials',url:'https://user:pass@example.com/',content:'drop'},
    {title:'Missing excerpt',url:'https://example.org'}
  ]});
  assert.deepEqual(sources,[{title:'Safe',url:'https://example.com/path',excerpt:'Useful excerpt',score:1,publishedAt:'2026-01-01'}]);
});

test('disabled search makes no network request and reports simulation accurately',async()=>{
  let called=false;
  const result=await searchMarketSources({query:'kids activity book Lebanon',enabled:false,apiKey:'must-not-be-used',fetchImpl:async()=>{called=true;throw Error('should not call');}});
  assert.equal(called,false);
  assert.equal(result.available,false);
  assert.equal(result.status,'disabled');
  assert.match(result.message,/No web search was performed/);
});

test('configured search sends credentials only in the server-side POST body and returns live evidence',async()=>{
  let request;
  const result=await searchMarketSources({query:'  Kids   activity book Lebanon  ',enabled:true,apiKey:'server-only-test-key',fetchImpl:async(url,init)=>{
    request={url:String(url),init};
    return {ok:true,json:async()=>({results:[{title:'Example listing',url:'https://shop.example/listing',content:'A sample page excerpt',score:.91}]})};
  }});
  assert.equal(request.url,'https://api.tavily.com/search');
  assert.equal(request.init.redirect,'error');
  assert.doesNotMatch(request.url,/server-only-test-key/);
  assert.equal(JSON.parse(request.init.body).api_key,'server-only-test-key');
  assert.equal(JSON.parse(request.init.body).query,'Kids activity book Lebanon');
  assert.equal(JSON.parse(request.init.body).include_answer,false);
  assert.equal(result.status,'live_search_results');
  assert.equal(result.sourceCount,1);
  assert.equal(result.sources[0].title,'Example listing');
  assert.ok(result.retrievedAt);
});

test('invalid query and upstream failures are classified without returning provider payloads',async()=>{
  await assert.rejects(searchMarketSources({query:'x',enabled:false}),{status:422});
  await assert.rejects(searchMarketSources({query:'tea shop',enabled:true,apiKey:'test',fetchImpl:async()=>({ok:false,status:429})}),{status:502,message:/returned 429/});
});
