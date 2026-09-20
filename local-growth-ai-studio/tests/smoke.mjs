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
  child = spawn(process.execPath,['server.js'], {cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'8799',HOST:'127.0.0.1',CREDIT_DB:join(dir,'test.sqlite'),OPENAI_API_KEY:'',ENABLE_LIVE_AI:'0',APP_ORIGIN:'',STUDIO_ACCESS_CODE:accessCode,ALLOW_MOCK_GENERATION:'1'},stdio:'ignore'});
  for(let i=0;i<50;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await sleep(100);}
  throw Error('Server did not start');
}
async function stop(){await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}
let cookie = '';
const get = path => fetch(base+path,{headers:{cookie}});
const post = (path,body,id='test-request-000001',extra={}) => fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':id,cookie,...extra},body:JSON.stringify(body)});
const brief = {mode:'reel',productName:'Mini Blender',description:'USB-C rechargeable blender.',language:'bilingual',audience:'busy students'};
try {
  await start();
  assert.equal((await get('/api/credits')).status,401);
  const session = await post('/api/session',{accessCode});
  assert.equal(session.status,200);
  assert.match(session.headers.get('set-cookie'),/HttpOnly/);
  cookie = session.headers.get('set-cookie').split(';')[0];
  assert.equal((await (await get('/api/health')).json()).engine,'demo');
  assert.equal((await (await get('/api/credits')).json()).balance,100);
  assert.equal((await post('/api/generate',brief,undefined,{origin:'https://evil.example'})).status,403);
  assert.equal((await post('/api/generate',null)).status,400);
  assert.equal((await post('/api/generate',{mode:'ad'})).status,422);
  assert.equal((await post('/api/generate',{...brief,imageDataUrl:'data:image/png;base64,aGVsbG8='})).status,422);
  const responses = await Promise.all([post('/api/generate',brief),post('/api/generate',brief)]);
  const outputs = await Promise.all(responses.map(r=>r.json()));
  assert.ok(outputs.every(o=>o.ok));
  assert.deepEqual(outputs[0].result,outputs[1].result);
  assert.equal((await (await get('/api/credits?userId=attacker')).json()).balance,99);
  assert.equal((await post('/api/generate',{...brief,productName:'Other product'})).status,409);
  assert.equal((await post('/api/video/prepare',{})).status,501);
  assert.equal((await get('/.env')).status,404);
  assert.equal((await get('/server.js')).status,404);
  const home = await get('/');
  assert.match(home.headers.get('content-security-policy'),/default-src 'self'/);
  assert.match(await home.text(),/Local Growth AI Studio/);
  await stop(); await start();
  assert.equal((await (await get('/api/credits')).json()).balance,99);
  const replay = await (await post('/api/generate',brief)).json();
  assert.equal(replay.replayed,true);
  assert.equal(replay.credits.balance,99);
  console.log('PASS: authentication, CSRF, validation, image rejection, concurrent retry, account spoofing, persistent balance/replay, protected files, video lock and UI.');
} finally {if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
