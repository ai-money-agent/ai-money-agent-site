import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

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
      WORKSPACE_DB:join(dir,'workspace.sqlite'),
      PRODUCT_FILES_DIR:join(dir,'generated-products'),
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
  const readyBefore = await (await get('/api/health/ready')).json();
  assert.equal(readyBefore.status,'ready');
  const healthBefore = await (await get('/api/health')).json();
  assert.equal(healthBefore.version,'0.7.0');
  assert.equal(healthBefore.generationCost,2);
  assert.equal(healthBefore.demoGenerationCost,0);
  assert.equal(healthBefore.demoAvailable,true);
  assert.equal(healthBefore.liveAvailable,false);
  assert.equal(healthBefore.storageReady,true);
  assert.equal(healthBefore.workspaceReady,true);
  assert.equal(healthBefore.v2AiProvider,'openai');
  assert.equal(healthBefore.v2AiReady,false);
  assert.equal(healthBefore.v2AiMode,'local');
  assert.equal(healthBefore.providerPaused,true);
  assert.equal(healthBefore.aiConnected,false);
  assert.equal(healthBefore.video.providerConnected,false);

  const session = await post('/api/session',{accessCode});
  assert.equal(session.status,200);
  assert.match(session.headers.get('set-cookie'),/HttpOnly/);
  cookie = session.headers.get('set-cookie').split(';')[0];

  // Completed Live results remain readable even when the provider is paused,
  // and stale Live reservations are refunded without any provider call.
  const liveDb = new DatabaseSync(join(dir,'test.sqlite'));
  const now = Date.now();
  const savedLiveResult = {result:{hook:'Saved live hook',reelScript:'Saved script',shotList:['Shot'],onScreenText:['Text'],caption:'Caption',cta:'CTA',adIdeas:['Idea']},engine:'anthropic'};
  liveDb.prepare('INSERT OR REPLACE INTO accounts(id,balance,used) VALUES(?,?,?)').run('beta-owner',5,0);
  liveDb.prepare("INSERT INTO jobs(account,id,fingerprint,status,cost,output,created_at,updated_at) VALUES(?,?,?,'completed',?,?,?,?)")
    .run('beta-owner','live-recovery-000001','saved-live',0,JSON.stringify(savedLiveResult),now,now);
  const staleAt = now - 20*60*1000;
  liveDb.prepare("INSERT INTO jobs(account,id,fingerprint,status,cost,output,created_at,updated_at) VALUES(?,?,?,'pending',?,NULL,?,?)")
    .run('beta-owner','live-stale-00000001','stale-live',2,staleAt,staleAt);
  liveDb.close();

  const pausedLiveRecovery = await (await get('/api/generations/live-recovery-000001?mode=live')).json();
  assert.equal(pausedLiveRecovery.status,'completed');
  assert.equal(pausedLiveRecovery.result.hook,'Saved live hook');
  assert.equal(pausedLiveRecovery.credits.balance,7);
  const staleLiveRecovery = await (await get('/api/generations/live-stale-00000001?mode=live')).json();
  assert.equal(staleLiveRecovery.status,'failed');
  assert.equal(staleLiveRecovery.credits.balance,7);

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

  const projectResponse=await post('/api/v2/projects',{
    name:'مشروع اختبار',country:'لبنان',budget:'20 دولار',skills:'تصميم كانفا',timeAvailable:'ساعتان يوميًا',
    businessType:'service',marketScope:'local',payoutMethods:'Whish و OMT'
  });
  assert.equal(projectResponse.status,201);
  const project=(await projectResponse.json()).project;
  const ideasResponse=await post('/api/v2/research/ideas',{projectId:project.id,language:'ar'});
  assert.equal(ideasResponse.status,200);
  const ideasBody=await ideasResponse.json();
  assert.equal(ideasBody.aiEngine,'local');
  const ideas=ideasBody.ideas;
  assert.equal(ideasResponse.headers.get('content-type')?.startsWith('application/json'),true);
  const chosen=ideas.find(idea=>idea.type==='service');
  const analysisResponse=await post('/api/v2/research/analyze',{projectId:project.id,idea:chosen,language:'ar'});
  assert.equal(analysisResponse.status,200);
  const analysisBody=await analysisResponse.json();
  assert.equal(analysisBody.aiEngine,'local');
  const analysis=analysisBody.analysis;
  assert.equal(analysis.idea.type,'service');
  const savedResearch=await (await get(`/api/v2/dashboard?projectId=${project.id}`)).json();
  assert.equal(savedResearch.research.payload.idea.name,chosen.name);

  const builtResponse=await post('/api/v2/products/build',{projectId:project.id,answers:{name:'خدمة كانفا',price:25},language:'ar'});
  assert.equal(builtResponse.status,201);
  const builtBody=await builtResponse.json();
  assert.equal(builtBody.aiEngine,'local');
  const built=builtBody.product;
  assert.equal(built.type,'service');
  const updatedResponse=await post('/api/v2/products/build',{projectId:project.id,productId:built.id,idea:chosen,answers:{name:'خدمة كانفا المطورة',price:30},language:'ar'});
  assert.equal(updatedResponse.status,201);
  const updated=(await updatedResponse.json()).product;
  assert.equal(updated.id,built.id);
  assert.equal(updated.name,'خدمة كانفا المطورة');
  assert.equal((await (await get(`/api/v2/products?projectId=${project.id}`)).json()).products.length,1);

  const ebookResponse=await post('/api/v2/factory/generate',{
    projectId:project.id,productId:updated.id,type:'ebook',title:'Sample guide',topic:'Canva basics',audience:'new sellers',outcome:'Create a simple product'
  });
  assert.equal(ebookResponse.status,201);
  const ebook=(await ebookResponse.json()).asset;
  assert.equal(ebook.contentType,'application/pdf');
  assert.equal(ebook.pages,6);
  assert.match(ebook.label,/no AI connection used/i);
  assert.ok(ebook.previewFileId);
  const worksheetResponse=await post('/api/v2/factory/generate',{
    projectId:project.id,productId:updated.id,type:'worksheet',title:'Math practice',topic:'addition and subtraction',audience:'grade 3',level:3,pages:2
  });
  assert.equal(worksheetResponse.status,201);
  const worksheet=(await worksheetResponse.json()).asset;
  assert.equal(worksheet.pages,4);
  assert.ok(worksheet.previewFileId);
  const worksheetPreview=await get(`/api/v2/factory/download?projectId=${project.id}&fileId=${worksheet.previewFileId}&inline=1`);
  const worksheetHtml=await worksheetPreview.text();
  assert.match(worksheetHtml,/data-answer/);
  assert.match(worksheetHtml,/Answer key/);
  assert.doesNotMatch(worksheetHtml.slice(0,worksheetHtml.indexOf('<section id="answers"')),/3\. 9 \+ 5 = 14/);
  assert.equal(ebookResponse.headers.get('content-type')?.startsWith('application/json'),true);
  const budgetResponse=await post('/api/v2/factory/generate',{
    projectId:project.id,productId:updated.id,type:'budget',title:'Budget planner',topic:'monthly budgeting'
  });
  assert.equal(budgetResponse.status,201);
  const budget=(await budgetResponse.json()).asset;
  assert.equal(budget.contentType,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const mobileBudgetPreview=await get(`/api/v2/factory/download?projectId=${project.id}&fileId=${budget.previewFileId}&inline=1`);
  assert.equal(mobileBudgetPreview.status,200);
  assert.match(mobileBudgetPreview.headers.get('content-security-policy'),/script-src 'unsafe-inline'/);
  assert.equal(mobileBudgetPreview.headers.get('x-frame-options'),'SAMEORIGIN');
  const mobileBudgetHtml=await mobileBudgetPreview.text();
  assert.match(mobileBudgetHtml,/Monthly budget preview/);
  assert.match(mobileBudgetHtml,/localStorage/);
  assert.match(mobileBudgetHtml,/income-total/);
  const arabicResponse=await post('/api/v2/factory/generate',{
    projectId:project.id,productId:updated.id,type:'coloring',language:'ar',title:'كتاب التلوين',topic:'الحيوانات',audience:'الأطفال من ٦ إلى ٨ سنوات',pages:2
  });
  assert.equal(arabicResponse.status,201);
  const arabic=(await arabicResponse.json()).asset;
  assert.equal(arabic.contentType,'application/pdf');
  assert.match(arabic.filename,/arabic-coloring\.pdf$/);
  const arabicPdf=await get(`/api/v2/factory/download?projectId=${project.id}&fileId=${arabic.fileId}`);
  const arabicBytes=Buffer.from(await arabicPdf.arrayBuffer()).toString('latin1');
  assert.match(arabicBytes,/\/Subtype \/Type0/);
  assert.match(arabicBytes,/\/FontFile2/);
  const arabicPrint=await get(`/api/v2/factory/download?projectId=${project.id}&fileId=${arabic.previewFileId}&inline=1`);
  const arabicHtml=await arabicPrint.text();
  assert.match(arabicHtml,/<html lang="ar" dir="rtl">/);
  assert.match(arabicHtml,/window\.print\(\)/);
  assert.match(arabicHtml,/class="activity-art"/);
  assert.match(arabicHtml,/data-canvas/);
  const quizResponse=await post('/api/v2/factory/generate',{
    projectId:project.id,productId:updated.id,type:'quiz',title:'Canva Quiz',topic:'Canva basics',
    questions:[
      {question:'Which tool adds text?',answer:'Text',wrong:['Crop','Resize']},
      {question:'What is a page?',answer:'A design canvas',wrong:['A file name','A payment']},
      {question:'How do you export?',answer:'Download',wrong:['Delete','Close']}
    ]
  });
  assert.equal(quizResponse.status,201);
  const quiz=(await quizResponse.json()).asset;
  assert.equal(quiz.contentType,'text/html; charset=utf-8');
  assert.equal((await (await get(`/api/v2/factory/assets?projectId=${project.id}`)).json()).assets.length,5);
  const ebookDownload=await get(`/api/v2/factory/download?projectId=${project.id}&fileId=${ebook.fileId}`);
  assert.equal(ebookDownload.status,200);
  assert.equal(ebookDownload.headers.get('content-type'),'application/pdf');
  assert.equal(Buffer.from(await ebookDownload.arrayBuffer()).subarray(0,8).toString(),'%PDF-1.4');
  const budgetDownload=await get(`/api/v2/factory/download?projectId=${project.id}&fileId=${budget.fileId}`);
  assert.equal(budgetDownload.status,200);
  assert.equal(Buffer.from(await budgetDownload.arrayBuffer()).readUInt32LE(0),0x04034b50);
  const interactiveDownload=await get(`/api/v2/factory/download?projectId=${project.id}&fileId=${ebook.previewFileId}`);
  assert.equal(interactiveDownload.status,200);
  assert.match(await interactiveDownload.text(),/data-canvas/);
  assert.equal((await post('/api/v2/factory/generate',{projectId:project.id,type:'quiz',title:'Bad quiz',topic:'x',questions:[]})).status,422);

  const brandResponse=await post('/api/v2/brand/generate',{projectId:project.id,productId:updated.id,language:'ar'});
  assert.equal(brandResponse.status,200);
  assert.equal((await brandResponse.json()).aiEngine,'local');

  const adResponse=await post('/api/v2/ads/generate',{projectId:project.id,productId:updated.id,language:'ar'});
  assert.equal(adResponse.status,200);
  assert.equal((await adResponse.clone().json()).aiEngine,'local');
  const reelResponse=await post('/api/v2/reels/generate',{projectId:project.id,productId:updated.id,language:'ar'});
  assert.equal(reelResponse.status,200);
  assert.equal((await reelResponse.json()).aiEngine,'local');
  const savedWorkspace=await (await get(`/api/v2/dashboard?projectId=${project.id}`)).json();
  assert.equal(savedWorkspace.outputs.length,7);
  assert.equal(savedWorkspace.outputs.find(output=>output.type==='ad-pack').type,'ad-pack');
  assert.match(savedWorkspace.outputs.find(output=>output.type==='ad-pack').payload.variants[0].primaryText,/خدمة كانفا المطورة/);
  const partnerResponse=await post('/api/v2/partner',{projectId:project.id,message:'أريد أن أربح من الإنترنت ولا أعرف ماذا أبيع.'});
  assert.equal(partnerResponse.status,200);
  const partnerBody=await partnerResponse.json();
  assert.equal(partnerBody.aiEngine,'local');
  assert.match(partnerBody.reply,/سنبدأ من الصفر/);

  assert.equal((await get('/.env')).status,404);
  assert.equal((await get('/server.js')).status,404);
  const home = await get('/');
  assert.match(home.headers.get('content-security-policy'),/default-src 'self'/);
  assert.match(await home.text(),/Local Growth AI Studio/);

  await stop();
  await start();
  assert.equal((await (await get('/api/credits')).json()).balance,7);
  const recoveredWorkspace=await (await get(`/api/v2/dashboard?projectId=${project.id}`)).json();
  assert.equal(recoveredWorkspace.products[0].name,'خدمة كانفا المطورة');
  assert.equal(recoveredWorkspace.outputs.length,7);
  assert.ok(recoveredWorkspace.outputs.some(output=>output.type==='ad-pack'));
  assert.ok(recoveredWorkspace.outputs.some(output=>output.type==='reel'));
  const recoveredAssets=(await (await get(`/api/v2/factory/assets?projectId=${project.id}`)).json()).assets;
  assert.equal(recoveredAssets.length,5);
  const recoveredEbook=recoveredAssets.find(asset=>asset.fileId===ebook.fileId);
  assert.ok(recoveredEbook);
  assert.equal(recoveredEbook.previewFileId,ebook.previewFileId);
  const recoveredDownload=await get(`/api/v2/factory/download?projectId=${project.id}&fileId=${ebook.fileId}`);
  assert.equal(recoveredDownload.status,200);
  assert.equal(Buffer.from(await recoveredDownload.arrayBuffer()).subarray(0,8).toString(),'%PDF-1.4');
  const recoveredPreview=await get(`/api/v2/factory/download?projectId=${project.id}&fileId=${ebook.previewFileId}&inline=1`);
  assert.match(await recoveredPreview.text(),/canvas/);

  assert.ok(recoveredWorkspace.brand);
  assert.equal(recoveredWorkspace.research.payload.idea.type,'service');
  assert.equal((await (await get(`/api/v2/partner/messages?projectId=${project.id}`)).json()).messages.length,2);
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
  console.log('PASS: auth, CSRF, Demo/Live isolation, stale-credit recovery, paused-provider result recovery, validation, persistence, protected files, video contract, offline digital factory downloads and UI.');
} finally {
  await stop();
  await rm(dir,{recursive:true,force:true});
}

