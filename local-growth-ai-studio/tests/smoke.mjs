import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const dir = await mkdtemp(join(tmpdir(),'studio-test-'));
const base = 'http://127.0.0.1:8799';
const accessCode = 'test-only-access-code-123456789';
let child;

async function start() {
  child = spawn(process.execPath,['server.js'], {
    cwd:new URL('..',import.meta.url),
    env:{
      ...process.env,
      PORT:'8799',
      HOST:'127.0.0.1',
      CREDIT_DB:join(dir,'test.sqlite'),
      OPENAI_API_KEY:'',
      ENABLE_LIVE_AI:'1',
      OPENAI_PROVIDER_ENABLED:'0',
      APP_ORIGIN:'',
      STUDIO_ACCESS_CODE:accessCode,
      ALLOW_MOCK_GENERATION:'1',
      INITIAL_CREDITS:'7',
      GENERATION_CREDIT_COST:'2'
    },
    stdio:'ignore'
  });
  for(let i=0;i<50;i++){
    try{if((await fetch(base+'/api/health')).ok)return;}catch{}
    await sleep(100);
  }
  throw Error('Server did not start');
}
async function stop(){
  if (!child || child.exitCode !== null) return;
  await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});
}
let cookie = '';
const get = path => fetch(base+path,{headers:{cookie}});
const post = (path,body,id='test-request-000001',extra={}) => fetch(base+path,{
  method:'POST',
  headers:{'Content-Type':'application/json','Idempotency-Key':id,cookie,...extra},
  body:JSON.stringify(body)
});
const brief = {mode:'reel',productName:'Mini Blender',description:'USB-C rechargeable blender.',language:'bilingual',audience:'busy students'};

try {
  await start();
  assert.equal((await get('/api/credits')).status,401);
  assert.equal((await get('/api/generations/test-request-000001')).status,401);
  const healthBefore = await (await get('/api/health')).json();
  assert.equal(healthBefore.version,'0.5.0');
  assert.equal(healthBefore.generationCost,2);
  assert.equal(healthBefore.demoGenerationCost,0);
  assert.equal(healthBefore.demoAvailable,true);
  assert.equal(healthBefore.liveAvailable,false);
  assert.equal(healthBefore.providerPaused,true);
  assert.equal(healthBefore.aiConnected,false);
  assert.equal(healthBefore.video.providerConnected,false);

  const session = await post('/api/session',{accessCode});
  assert.equal(session.status,200);
  assert.match(session.headers.get('set-cookie'),/HttpOnly/);
  cookie = session.headers.get('set-cookie').split(';')[0];

  assert.equal((await (await get('/api/health')).json()).engine,'demo');
  const initialCredits = await (await get('/api/credits')).json();
  assert.equal(initialCredits.balance,7);
  assert.equal(initialCredits.generationCost,0);
  assert.equal(initialCredits.generationMode,'demo');

  assert.equal((await post('/api/generate',brief,undefined,{origin:'https://evil.example'})).status,403);
  assert.equal((await post('/api/generate',null)).status,400);
  assert.equal((await post('/api/generate',{mode:'ad'})).status,422);
  assert.equal((await post('/api/generate',{...brief,imageDataUrl:'data:image/png;base64,aGVsbG8='})).status,422);

  assert.equal((await post('/api/generate',{...brief,generationMode:'live'},'live-request-000001')).status,503);

  const responses = await Promise.all([post('/api/generate',{...brief,generationMode:'demo'}),post('/api/generate',{...brief,generationMode:'demo'})]);
  const outputs = await Promise.all(responses.map(r=>r.json()));
  assert.ok(outputs.every(o=>o.ok));
  assert.deepEqual(outputs[0].result,outputs[1].result);
  assert.equal((await (await get('/api/credits?userId=attacker')).json()).balance,7);
  assert.equal((await post('/api/generate',{...brief,productName:'Other product',generationMode:'demo'})).status,409);

  const badVideo = await post('/api/video/prepare',{script:'Test',aspectRatio:'4:3',durationSeconds:20},'video-request-00001');
  assert.equal(badVideo.status,422);
  const video = await post('/api/video/prepare',{script:'Test',aspectRatio:'9:16',durationSeconds:20},'video-request-00002');
  assert.equal(video.status,501);
  const videoBody = await video.json();
  assert.equal(videoBody.status,'provider_not_connected');
  assert.equal(videoBody.spec.aspectRatio,'9:16');
  assert.equal((await (await get('/api/credits')).json()).balance,7);

  assert.equal((await get('/.env')).status,404);
  assert.equal((await get('/server.js')).status,404);
  const home = await get('/');
  assert.match(home.headers.get('content-security-policy'),/default-src 'self'/);
  assert.match(await home.text(),/Local Growth AI Studio/);

  await stop();
  await start();
  assert.equal((await (await get('/api/credits')).json()).balance,7);
  const replay = await (await post('/api/generate',{...brief,generationMode:'demo'})).json();
  assert.equal(replay.replayed,true);
  assert.equal(replay.credits.balance,7);
  const recovered = await (await get('/api/generations/test-request-000001')).json();
  assert.equal(recovered.status,'completed');
  assert.deepEqual(recovered.result,replay.result);
  assert.equal(recovered.credits.balance,7);
  assert.equal((await get('/api/generations/missing-request-0001')).status,404);
  assert.equal((await get('/api/generations/invalid')).status,400);
  assert.equal((await (await get('/api/credits')).json()).balance,7);
  console.log('PASS: auth, CSRF, Demo/Live isolation, zero-cost Demo, validation, retry safety, persistence, protected files, video contract and UI.');
} finally {
  await stop();
  await rm(dir,{recursive:true,force:true});
}
