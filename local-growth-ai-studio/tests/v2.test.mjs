import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { WorkspaceStore } from '../lib/workspace.js';
import { findProductIdeas, analyzeIdea, buildProductBlueprint, buildBrandProfile, createAdPack, createReelPack, partnerReply, recipes } from '../lib/business-engine.js';

function withStore(fn) {
  const dir = mkdtempSync(join(tmpdir(),'lg-v2-'));
  const store = new WorkspaceStore(join(dir,'workspace.sqlite'));
  try { return fn(store); }
  finally { store.close(); rmSync(dir,{recursive:true,force:true}); }
}

test('V2 workspace persists a project from research through creative outputs', () => withStore((store) => {
  const account='test-owner';
  const project=store.createProject(account,{
    name:'First income project',
    country:'Lebanon',
    budget:'$0-50',
    skills:'Canva, sales',
    timeAvailable:'2 hours/day',
    businessType:'digital',
    marketScope:'global',
    payoutMethods:'Payoneer, Wise'
  });
  assert.equal(project.name,'First income project');
  assert.equal(project.profile.country,'Lebanon');

  const ideas=findProductIdeas(project.profile,'en');
  assert.equal(ideas.length,4);
  assert.ok(ideas[0].score >= ideas[1].score);

  const analysis=analyzeIdea(project.profile,ideas[0],'en');
  assert.ok(analysis.scores.overall >= 0 && analysis.scores.overall <= 100);
  store.saveResearch(account,project.id,analysis.ideaName,analysis);

  const blueprint=buildProductBlueprint({profile:project.profile,research:analysis,idea:ideas[0],answers:{price:19},language:'en'});
  const product=store.saveProduct(account,project.id,blueprint);
  assert.equal(product.price,19);
  assert.ok(product.usp);

  const brand=store.saveBrand(account,project.id,buildBrandProfile(product,project,'en'));
  assert.equal(brand.projectId,project.id);
  assert.ok(Array.isArray(brand.colors));

  const ads=createAdPack(product,'en');
  assert.equal(ads.variants.length,4);
  store.saveOutput(account,project.id,'ad-pack',product.name+' ads',ads);

  const reel=createReelPack(product,'en');
  assert.equal(reel.scenes.length,5);
  store.saveOutput(account,project.id,'reel',product.name+' reel',reel);

  store.createTask(account,project.id,'launch-product');
  store.addMessage(account,project.id,'user','I have no sales.');
  const answer=partnerReply('I have no sales.',{project,product},'en');
  store.addMessage(account,project.id,'assistant',answer.reply);
  assert.equal(answer.type,'diagnostic');

  const dash=store.dashboard(account,project.id);
  assert.equal(dash.products.length,1);
  assert.equal(dash.outputs.length,2);
  assert.equal(dash.tasks.length,1);
  assert.ok(dash.brand);
  assert.equal(store.messages(account,project.id).length,2);
}));

test('Arabic strategy engine returns actionable structures without provider calls', () => {
  const profile={country:'لبنان',budget:'20 دولار',skills:'تصميم كانفا',timeAvailable:'ساعتان يوميًا',businessType:'service',marketScope:'local',payoutMethods:'Whish و OMT'};
  const ideas=findProductIdeas(profile,'ar');
  assert.equal(ideas.length,4);
  assert.match(ideas[0].note,/بيانات سوق حيّة/);

  const analysis=analyzeIdea(profile,ideas[0],'ar');
  assert.equal(analysis.sellingAngles.length,4);
  assert.ok(analysis.validationPlan.length >= 4);

  const product=buildProductBlueprint({profile,research:analysis,idea:ideas[0],answers:{name:'خدمة اختبار',price:25},language:'ar'});
  assert.equal(product.currency,'USD');
  assert.equal(product.price,25);

  const ads=createAdPack(product,'ar');
  assert.equal(ads.variants[0].key,'problem');
  assert.equal(ads.variants[3].key,'direct');

  const reel=createReelPack(product,'ar');
  assert.ok(reel.voiceover.includes('خدمة اختبار'));

  const onboarding=partnerReply('أريد أن أربح من الإنترنت ولا أعرف ماذا أبيع.',{},'ar');
  assert.equal(onboarding.type,'onboarding');
  assert.equal(onboarding.nextAction,'profile');

  assert.equal(recipes('en').length,8);
  assert.equal(recipes('ar').length,8);
});
