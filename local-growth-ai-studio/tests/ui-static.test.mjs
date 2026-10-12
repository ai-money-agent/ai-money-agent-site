import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, js, dockerfile, packageText, v2Html, v2Css, v2Js] = await Promise.all([
  readFile(new URL('public/index.html',root),'utf8'),
  readFile(new URL('public/styles.css',root),'utf8'),
  readFile(new URL('public/app.js',root),'utf8'),
  readFile(new URL('Dockerfile',root),'utf8'),
  readFile(new URL('package.json',root),'utf8'),
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
  assert.match(v2Js,/OpenAI business partner · Live/);
  assert.match(v2Js,/Local templates · OpenAI needs API setup/);
  assert.match(v2Js,/\/api\/v2\/dashboard/);
  assert.doesNotMatch(v2Html+v2Js,/OPENAI_API_KEY|sk-[A-Za-z0-9_-]{12,}/);
  assert.match(v2Html,/DIGITAL PRODUCT FACTORY/);
  assert.match(v2Html,/Quiz questions, one per line/);
  assert.match(v2Js,/\/api\/v2\/factory\/generate/);
  assert.match(v2Js,/\/api\/v2\/factory\/download/);
  assert.match(v2Css,/factory-form/);
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
});
