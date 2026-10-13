import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, js, dockerfile, packageText, envExample, v2Html, v2Css, v2Js] = await Promise.all([
  readFile(new URL('public/index.html',root),'utf8'),
  readFile(new URL('public/styles.css',root),'utf8'),
  readFile(new URL('public/app.js',root),'utf8'),
  readFile(new URL('Dockerfile',root),'utf8'),
  readFile(new URL('package.json',root),'utf8'),
  readFile(new URL('.env.example',root),'utf8'),
  readFile(new URL('public/v2.html',root),'utf8'),
  readFile(new URL('public/v2.css',root),'utf8'),
  readFile(new URL('public/v2.js',root),'utf8')
]);

test('UI contains the complete requested creative workflow',()=>{
  for (const id of [
    'productImage','productName','description','language','audience','generationDemo','generationLive','imageMeta','resultMeta',
    'hookOutput','scriptOutput','shotsOutput','screenTextOutput',
    'captionOutput','ctaOutput','ideasOutput'
  ]) assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/data-mode="ad"/);
  assert.match(html,/data-mode="reel"/);
  assert.match(html,/data-generation-cost/);
  assert.match(html,/No provider API calls/);
  assert.match(html,/aria-live="polite"/);
});

test('V2 remains usable on narrow Android screens and reports whether OpenAI is live',()=>{
  assert.match(v2Html,/name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/);
  assert.match(v2Css,/@media\s*\(max-width:\s*760px\)/);
  assert.match(v2Css,/@media\s*\(max-width:\s*430px\)/);
  assert.match(v2Css,/min-height:44px/);
  assert.match(v2Js,/Live AI/);
  assert.match(v2Js,/Local simulation · Not AI/);
  assert.match(v2Js,/simulated output, not live AI/);
  assert.match(v2Js,/\/api\/v2\/dashboard/);
  assert.doesNotMatch(v2Html+v2Js,/OPENAI_API_KEY|sk-[A-Za-z0-9_-]{12,}/);
  assert.match(v2Html,/DIGITAL PRODUCT FACTORY/);
  assert.match(v2Html,/Quiz questions, one per line/);
  for(const id of ['factoryLanguage','factoryPages','factoryAudience','factoryPreview','factoryDownloadLinks','factoryQuestionCount']) assert.match(v2Html,new RegExp(`id=["']${id}["']`));
  assert.match(v2Html,/embed a Unicode font and shape RTL text/);
  assert.match(v2Html,/phone-friendly interactive preview/);
  assert.match(v2Js,/\/api\/v2\/factory\/generate/);
  assert.match(v2Js,/\/api\/v2\/factory\/download/);
  assert.match(v2Js,/showFactoryPreview/);
  assert.match(v2Html,/id="signOutButton"/);
  assert.match(v2Js,/api\/session.*method:'DELETE'/);
  assert.match(v2Html,/data-view="business"/);
  assert.match(v2Html,/Physical goods[\s\S]*Dropshipping[\s\S]*Print on demand/);
  for(const id of ['businessPlanForm','launchBusinessType','launchMarketNotes','launchSupplierName','launchSellingPrice','launchUnitCost','businessPlanResult']) assert.match(v2Html,new RegExp(`id=["']${id}["']`));
  assert.match(v2Html,/No supplier catalog, live market search, invented prices/);
  assert.match(v2Html,/user-provided and unverified/);
  assert.match(v2Js,/api\('\/api\/v2\/launch\/plan'/);
  assert.match(v2Js,/renderLaunchPlan/);
  assert.match(v2Js,/local plan|local template/i);
  assert.match(v2Css,/business-plan-form/);
  assert.match(v2Css,/@media\(max-width:760px\)\{\.business-plan-form/);

  assert.match(v2Css,/sign-out/);
  assert.match(v2Css,/factory-preview iframe/);
  assert.match(v2Css,/factory-asset-actions/);
  assert.match(v2Css,/factory-form/);
  assert.match(v2Html,/id="mobileMoreMenu"[\s\S]*data-view="reels"[\s\S]*data-view="brand"[\s\S]*data-view="saved"/,
    'mobile users can reach every section hidden from the desktop sidebar');
  assert.match(v2Html,/id="mobileMoreToggle"[^>]*aria-expanded="false"[^>]*aria-controls="mobileMoreMenu"/);
  assert.match(v2Js,/mobileMoreToggle/);
  assert.match(v2Js,/event\.key==='Escape'/,'the mobile section menu can be dismissed accessibly');
  assert.match(v2Css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(v2Css,/mobile-more-menu button\{[^}]*min-height:48px/);
  assert.match(v2Css,/factory-asset-actions a,[^{]*\{[^}]*min-height:44px/,'mobile download links meet the touch target minimum');
  assert.match(v2Css,/bottom:calc\(76px \+ env\(safe-area-inset-bottom\)\)/,'the mobile menu clears phone safe areas');
});

test('frontend is mobile-first, self-contained and does not contain provider secrets',()=>{
  assert.match(html,/viewport-fit=cover/);
  assert.match(css,/@media \(max-width: 860px\)/);
  assert.match(css,/@media \(max-width: 540px\)/);
  assert.doesNotMatch(html,/<script[^>]+https?:\/\//i);
  assert.doesNotMatch(html,/<link[^>]+https?:\/\//i);
  assert.doesNotMatch(html+js,/OPENAI_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{12,}/);
  assert.match(js,/fetch\('\/api\/generate'/);
  assert.match(js,/textContent/);
  assert.match(js,/generationMode/);
  assert.match(css,/min-height: 44px/);
});


test('deployment config uses the readiness endpoint and matching app version',()=>{
  assert.match(dockerfile,/HEALTHCHECK[\s\S]*\/api\/health\/ready/);
  const pkg=JSON.parse(packageText);
  assert.equal(pkg.version,'0.7.0');
  assert.match(envExample,/AI_PROVIDER=openai/);
  assert.match(envExample,/OPENAI_MODEL=gpt-6\.1-sol/);
  assert.match(envExample,/ENABLE_LIVE_AI=0/);
  assert.match(envExample,/OPENAI_PROVIDER_ENABLED=0/);
  assert.match(envExample,/OPENAI_API_KEY=\s*(?:#.*)?$/m,'the example has no provider credential');
});

