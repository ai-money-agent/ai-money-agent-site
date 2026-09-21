import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Ledger } from './lib/ledger.js';
import { generate } from './lib/generator.js';
import { prepareVideoRequest, videoCapability } from './lib/video.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const intEnv = (name, fallback, min, max) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  return value;
};
const config = {
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || '',
  allowDemo: process.env.ALLOW_MOCK_GENERATION !== '0',
  liveEnabled: process.env.ENABLE_LIVE_AI === '1',
  initialCredits: intEnv('INITIAL_CREDITS', 100, 0, 1000000),
  generationCost: intEnv('GENERATION_CREDIT_COST', 1, 1, 1000)
};
const ACCESS_CODE = process.env.STUDIO_ACCESS_CODE || '';
const ORIGIN = process.env.APP_ORIGIN || '';
const PORT = Number(process.env.PORT || 8787);
if (config.liveEnabled) {
  const missing = [];
  if (!config.apiKey) missing.push('OPENAI_API_KEY');
  if (!config.model) missing.push('OPENAI_MODEL');
  if (ACCESS_CODE.length < 24) missing.push('STUDIO_ACCESS_CODE(24+ chars)');
  if (!ORIGIN.startsWith('https://')) missing.push('APP_ORIGIN(https://...)');
  if (missing.length) throw new Error(`Live AI config invalid: ${missing.join(', ')}`);
}
const ledger = new Ledger(process.env.CREDIT_DB || join(ROOT, 'data', 'credits.sqlite'), config.initialCredits);
const accounts = { demo: 'demo-shared', live: 'beta-owner' };
const rates = new Map();
const equal = (a, b) => {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
};
const sign = value => createHmac('sha256', ACCESS_CODE).update(value).digest('hex');

function authenticated(req) {
  if (!ACCESS_CODE) return true;
  const cookie = /(?:^|;\s*)studio_session=([^;]+)/.exec(req.headers.cookie || '')?.[1] || '';
  const [expires, signature] = cookie.split('.');
  return /^\d+$/.test(expires || '') && Number(expires) > Date.now() && equal(signature || '', sign(expires));
}
function headers(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
function failure(message, status = 422) { return Object.assign(new Error(message), { status }); }
async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw failure('Send application/json.', 415);
  let size = 0;
  const parts = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw failure('Request exceeds 8 MB.', 413);
    parts.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(parts).toString()); }
  catch { throw failure('Invalid JSON.', 400); }
  if (!body || Array.isArray(body) || typeof body !== 'object') throw failure('JSON object required.', 400);
  return body;
}
function text(value, length, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > length) throw failure(`${label} is required and must be under ${length} characters.`);
  return value.trim();
}
function validateInput(body) {
  if (!['ad', 'reel'].includes(body.mode)) throw failure('Choose Ad or Reel Script.');
  if (!['en','ar','bilingual'].includes(body.language)) throw failure('Choose a supported language.');
  let imageDataUrl = null;
  if (body.imageDataUrl) {
    if (typeof body.imageDataUrl !== 'string') throw failure('Invalid image.');
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.imageDataUrl);
    if (!match) throw failure('Use a PNG, JPEG or WebP image.');
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.toString('base64') !== match[2] || bytes.length > 5*1024*1024) throw failure('Invalid image or image exceeds 5 MB.');
    const valid = match[1] === 'png'
      ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : match[1] === 'jpeg'
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
    if (!valid) throw failure('Image contents do not match its file type.');
    imageDataUrl = body.imageDataUrl;
  }
  return {
    mode: body.mode,
    language: body.language,
    productName: text(body.productName,120,'Product name'),
    description: text(body.description,1800,'Description'),
    audience: text(body.audience,240,'Audience'),
    imageDataUrl
  };
}
function rateLimit(req, path) {
  // Never trust client-supplied forwarding headers. A proxy shares one bucket.
  const key = `${req.socket.remoteAddress}:${path === '/api/session' ? 'login' : 'api'}`;
  const now = Date.now();
  for (const [storedKey,bucket] of rates) if (bucket.until <= now) rates.delete(storedKey);
  const bucket = rates.get(key) || { count: 0, until: now + 60000 };
  rates.set(key,bucket);
  return ++bucket.count <= (path === '/api/session' ? 10 : 60);
}
async function api(req, res, url) {
  if (!rateLimit(req, url.pathname)) {
    res.setHeader('Retry-After','60');
    return json(res,429,{ok:false,error:'Too many requests. Wait one minute.'});
  }
  if (req.method === 'POST') {
    const expected = ORIGIN || `http://${req.headers.host}`;
    if ((req.headers.origin && req.headers.origin !== expected) || req.headers['sec-fetch-site'] === 'cross-site') throw failure('Cross-site request blocked.',403);
  }
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res,200,{
      ok:true,
      version:'0.3.0',
      engine:config.liveEnabled ? 'openai' : config.allowDemo ? 'demo' : 'disabled',
      aiConnected:config.liveEnabled,
      video:videoCapability(),
      generationCost:config.generationCost,
      requiresLogin:!authenticated(req)
    });
  }
  if (req.method === 'POST' && url.pathname === '/api/session') {
    const body = await readBody(req);
    if (!ACCESS_CODE || typeof body.accessCode !== 'string' || !equal(body.accessCode,ACCESS_CODE)) throw failure('Invalid access code.',401);
    const expires = String(Date.now()+8*3600000);
    res.setHeader('Set-Cookie',`studio_session=${expires}.${sign(expires)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${ORIGIN.startsWith('https://') ? '; Secure' : ''}`);
    return json(res,200,{ok:true});
  }
  if (!authenticated(req)) throw failure('Enter your Studio access code first.',401);

  const accountId = config.liveEnabled ? accounts.live : accounts.demo;
  if (req.method === 'GET' && url.pathname === '/api/credits') {
    return json(res,200,{ok:true,...ledger.account(accountId),generationCost:config.generationCost,videoCostEstimate:null});
  }
  if (req.method === 'POST' && url.pathname === '/api/video/prepare') {
    const spec = prepareVideoRequest(await readBody(req));
    return json(res,501,{
      ok:false,
      ...videoCapability(),
      spec,
      error:'Video generation is prepared but no provider is connected yet. No credits were charged.'
    });
  }
  if (req.method === 'POST' && url.pathname === '/api/generate') {
    const input = validateInput(await readBody(req));
    if (!config.liveEnabled && !config.allowDemo) throw failure('Live AI is not enabled yet.',503);
    const id = req.headers['idempotency-key'];
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(id)) throw failure('A valid request ID is required.',400);
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const reserved = ledger.reserve(accountId,id,fingerprint,config.generationCost);
    if (reserved.conflict) throw failure('Request ID belongs to a different brief.',409);
    if (reserved.status === 'completed') return json(res,200,{ok:true,...JSON.parse(reserved.output),credits:ledger.account(accountId),replayed:true});
    if (reserved.status === 'insufficient') throw failure('Not enough credits.',402);
    if (reserved.status === 'pending') throw failure('This request is still pending. Retry the same brief later; if it remains pending, contact the owner.',409);
    if (reserved.status === 'failed') return json(res,502,{ok:false,error:'The previous attempt failed. Change the brief or start a new attempt.',retryWithNewId:true});
    try {
      const output = await generate(input,config);
      ledger.complete(accountId,id,output);
      return json(res,200,{ok:true,...output,credits:ledger.account(accountId)});
    } catch {
      ledger.fail(accountId,id);
      return json(res,502,{ok:false,error:'Generation did not complete. Your Studio credit was returned.',retryWithNewId:true});
    }
  }
  throw failure('API route not found.',404);
}

const assets = { '/':'index.html', '/index.html':'index.html', '/styles.css':'styles.css', '/app.js':'app.js' };
const mime = { html:'text/html', css:'text/css', js:'text/javascript' };
const server = http.createServer(async (req,res) => {
  headers(res);
  try {
    const url = new URL(req.url,'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req,res,url);
    if (!['GET','HEAD'].includes(req.method)) throw failure('Method not allowed.',405);
    const asset = assets[url.pathname];
    if (!asset) throw failure('Not found.',404);
    const body = await readFile(join(ROOT,'public',asset));
    res.writeHead(200,{'Content-Type':`${mime[asset.split('.').pop()]}; charset=utf-8`});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (!res.headersSent && !res.destroyed) json(res,error.status || 500,{ok:false,error:error.status ? error.message : 'Server error. Please try again.'});
  }
});
server.requestTimeout = 60000;
server.listen(PORT,process.env.HOST || '127.0.0.1',() => console.log(`Local Growth Studio ready on port ${PORT}; ${config.liveEnabled ? 'live' : 'demo/disabled'}`));
process.on('SIGTERM',() => server.close(() => {ledger.close(); process.exit(0);}));
