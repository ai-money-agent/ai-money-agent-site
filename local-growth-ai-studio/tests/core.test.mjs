import test from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../lib/ledger.js';
import { generate, validateOutput } from '../lib/generator.js';
import { prepareVideoRequest, videoCapability } from '../lib/video.js';

test('reservations prevent overspending and failure releases exactly once',()=>{
  const db=new Ledger(':memory:',1);
  assert.equal(db.reserve('a','one','brief',1).status,'reserved');
  assert.equal(db.reserve('a','two','brief',1).status,'insufficient');
  assert.equal(db.reserve('a','one','brief',1).status,'pending');
  db.fail('a','one'); db.fail('a','one');
  assert.equal(db.account('a').balance,1);
  assert.equal(db.reserve('a','two','brief',1).status,'reserved');
  db.complete('a','two',{result:'saved'});
  assert.equal(db.account('a').balance,0);
  assert.equal(db.account('a').used,1);
  db.close();
});

test('provider adapter sends image and structured schema; refuses malformed output',async()=>{
  const original=globalThis.fetch;
  const good={hook:'Hook',reelScript:'Script',shotList:['Shot'],onScreenText:['Text'],caption:'Caption',cta:'CTA',adIdeas:['Idea']};
  try {
    globalThis.fetch=async(url,options)=>{
      assert.equal(url,'https://api.openai.com/v1/responses');
      const body=JSON.parse(options.body);
      assert.equal(body.store,false);
      assert.equal(body.text.format.strict,true);
      assert.equal(body.input[0].content[1].type,'input_image');
      assert.ok(options.signal);
      return {ok:true,json:async()=>({output_text:JSON.stringify(good)})};
    };
    const result=await generate(
      {mode:'ad',productName:'Product',description:'Description',audience:'Adults',language:'en',imageDataUrl:'test-image'},
      {liveEnabled:true,provider:'openai',openaiApiKey:'test-only',openaiModel:'test-model'}
    );
    assert.deepEqual(result.result,good);
    assert.throws(()=>validateOutput({...good,shotList:'invalid'}));
    globalThis.fetch=async()=>({ok:false,status:500,json:async()=>({error:{message:'private provider detail'}})});
    await assert.rejects(
      ()=>generate({}, {liveEnabled:true,provider:'openai',openaiApiKey:'test-only',openaiModel:'test-model'}),
      error=>!error.message.includes('private provider detail')
    );
  } finally {
    globalThis.fetch=original;
  }
});

test('future video contract validates supported job shapes without choosing a provider',()=>{
  assert.deepEqual(prepareVideoRequest({script:'A short product script',aspectRatio:'9:16',durationSeconds:20}),{
    script:'A short product script',
    aspectRatio:'9:16',
    durationSeconds:20
  });
  assert.throws(()=>prepareVideoRequest({script:'x',aspectRatio:'4:3',durationSeconds:20}),/aspect ratio/);
  assert.throws(()=>prepareVideoRequest({script:'x',aspectRatio:'9:16',durationSeconds:12}),/duration/);
  assert.equal(videoCapability().providerConnected,false);
  assert.equal(videoCapability().creditCost,null);
});


test('job recovery is account-scoped and read-only for every status',()=>{
  const db = new Ledger(':memory:',3);
  try {
    db.reserve('owner','request','fingerprint',1);
    assert.equal(db.job('owner','request').status,'pending');
    assert.equal(db.job('other','request'),undefined);
    db.complete('owner','request',{result:'saved'});
    assert.deepEqual(JSON.parse(db.job('owner','request').output),{result:'saved'});
    assert.equal(db.account('owner').balance,2);
    db.reserve('owner','failed','another',1);
    db.fail('owner','failed');
    assert.equal(db.job('owner','failed').status,'failed');
    assert.equal(db.account('owner').balance,2);
  } finally { db.close(); }
});


test('demo generation never calls a paid provider',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{ throw new Error('provider must not be called in demo mode'); };
  try {
    const output=await generate(
      {mode:'reel',productName:'Demo Product',description:'A useful product for testing.',audience:'small businesses',language:'en',imageDataUrl:null},
      {liveEnabled:false,allowDemo:true}
    );
    assert.equal(output.engine,'demo');
    assert.match(output.result.hook,/Demo Product/);
  } finally { globalThis.fetch=original; }
});

test('Anthropic adapter sends schema and image server-side without exposing credentials',async()=>{
  const original=globalThis.fetch;
  const good={hook:'Hook',reelScript:'Script',shotList:['Shot'],onScreenText:['Text'],caption:'Caption',cta:'CTA',adIdeas:['Idea']};
  try {
    globalThis.fetch=async(url,options)=>{
      assert.equal(url,'https://api.anthropic.com/v1/messages');
      assert.equal(options.headers['x-api-key'],'server-secret-test');
      assert.equal(options.headers['anthropic-version'],'2023-06-01');
      const body=JSON.parse(options.body);
      assert.equal(body.model,'claude-test');
      assert.equal(body.output_config.format.type,'json_schema');
      assert.equal(body.messages[0].content[0].type,'image');
      assert.equal(body.messages[0].content.at(-1).type,'text');
      return {ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify(good)}]})};
    };
    const tinyPng='data:image/png;base64,iVBORw0KGgo=';
    const output=await generate(
      {mode:'ad',productName:'Product',description:'Description long enough',audience:'Adults',language:'en',imageDataUrl:tinyPng},
      {liveEnabled:true,provider:'anthropic',anthropicApiKey:'server-secret-test',anthropicModel:'claude-test'}
    );
    assert.equal(output.engine,'anthropic');
    assert.deepEqual(output.result,good);
  } finally { globalThis.fetch=original; }
});
