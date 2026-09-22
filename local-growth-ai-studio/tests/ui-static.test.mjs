import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, js, dockerfile, packageText] = await Promise.all([
  readFile(new URL('public/index.html',root),'utf8'),
  readFile(new URL('public/styles.css',root),'utf8'),
  readFile(new URL('public/app.js',root),'utf8'),
  readFile(new URL('Dockerfile',root),'utf8'),
  readFile(new URL('package.json',root),'utf8')
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
  assert.equal(pkg.version,'0.6.0');
});
