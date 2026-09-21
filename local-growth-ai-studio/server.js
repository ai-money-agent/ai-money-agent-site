import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { Ledger } from './lib/ledger.js';
import { generate } from './lib/generator.js';
import { prepareVideoRequest, videoCapability } from './lib/video.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const intEnv = (name, fallback, min, max) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  return value;
};
const provider = (process.env.AI_PROVIDER || 'openai').trim().toLowerCase();
if (!['openai', 'anthropic'].includes(provider)) throw new Error('AI_PROVIDER must be openai or anthropic.');
const liveRequested = process.env.ENABLE_LIVE_AI === '1';
const providerEnabled = provider === 'anthropic'
  ? process.env.ANTHROPIC_PROVIDER_ENABLED === '1'
  : process.env.OPENAI_PROVIDER_ENABLED === '1';
const config = {
  provider,
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || '',
  allowDemo: process.env.ALLOW_MOCK_GENERATION !== '0',
  liveRequested,
  providerEnabled,
  liveEnabled: liveRequested && providerEnabled,
  initialCredits: intEnv('INITIAL_CREDITS', 100, 0, 1000000),
  generationCost: intEnv('GENERATION_CREDIT_COST', 1, 1, 1000),
  demoGenerationCost: 0
};
const ACCESS_CODE = process.env.STUDIO_ACCESS_CODE || '';
const ORIGIN = process.env.APP_ORIGIN || '';
const PORT = Number(process.env.PORT || 8787);
if (config.liveEnabled) {
  const missing = [];
  if (config.provider === 'anthropic') {
    if (!config.anthropicApiKey) missing.push('ANTHROPIC_API_KEY');
    if (!config.anthropicModel) missing.push('ANTHROPIC_MODEL');
  } else {
    if (!config.openaiApiKey) missing.push('OPENAI_API_KEY');
    if (!config.openaiModel) missing.push('OPENAI_MODEL');
  }
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
const runtimeMode = () => config.liveEnabled ? 'live' : 'demo';
function generationMode(value, fallback = runtimeMode()) {
  if (value == null || value === '') return fallback;
  if (!['demo','live'].includes(value)) throw failure('Choose Demo or Live AI.',422);
  return value;
}
function ensureModeAvailable(mode) {
  if (mode === 'demo' && !config.allowDemo) throw failure('Demo mode is disabled.',503);
  if (mode === 'live' && !config.liveEnabled) throw failure('Live AI is not enabled yet.',503);
}
const accountFor = mode => mode === 'demo' ? accounts.demo : accounts.live;
const costFor = mode => mode === 'demo' ? config.demoGenerationCost : config.generationCost;
function logEvent(level,event,details={}) {
  const payload = { time:new Date().toISOString(), event, ...details };
  console[level](JSON.stringify(payload));
}

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
  if (ORIGIN.startsWith('https://')) res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
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
function text(value, length, label, min = 1) {
  if (typeof value !== 'string') throw failure(`${label} is required.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > length) throw failure(`${label} must be ${min}-${length} characters.`);
  return trimmed;
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
    productName: text(body.productName,120,'Product name',2),
    description: text(body.description,1800,'Description',10),
    audience: text(body.audience,240,'Audience',3),
    imageDataUrl
  };
}
function rateLimit(req, path) {
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
  if (req.method === 'GET' && url.pathname === '/api/health/ready') {
    const storageReady = ledger.ping();
    return json(res,storageReady ? 200 : 503,{ok:storageReady,status:storageReady ? 'ready' : 'not_ready',version:'0.5.0'});
  }
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res,200,{
      ok:true,
      version:'0.5.0',
      engine:config.liveEnabled ? config.provider : config.allowDemo ? 'demo' : 'disabled',
      aiConnected:config.liveEnabled,
      providerPaused:config.liveRequested && !config.liveEnabled,
      video:videoCapability(),
      generationCost:config.generationCost,
      demoGenerationCost:config.demoGenerationCost,
      demoAvailable:config.allowDemo,
      liveAvailable:config.liveEnabled,
      provider:config.provider,
      uptimeSeconds:Math.floor(process.uptime()),
      storageReady:ledger.ping(),
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

  if (req.method === 'GET' && url.pathname.startsWith('/api/generations/')) {
    const mode = generationMode(url.searchParams.get('mode'));
    ensureModeAvailable(mode);
    const accountId = accountFor(mode);
    const id = url.pathname.slice('/api/generations/'.length);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(id)) throw failure('Invalid request ID.',400);
    const job = ledger.job(accountId,id);
    if (!job) throw failure('Generation not found.',404);
    return json(res,200,{
      ok:true,status:job.status,
      ...(job.status === 'completed' ? JSON.parse(job.output) : {}),
      credits:ledger.account(accountId),
      generationMode:mode
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/credits') {
    const mode = generationMode(url.searchParams.get('mode'));
    ensureModeAvailable(mode);
    const accountId = accountFor(mode);
    return json(res,200,{ok:true,...ledger.account(accountId),generationCost:costFor(mode),generationMode:mode,videoCostEstimate:null});
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
    const body = await readBody(req);
    const mode = generationMode(body.generationMode);
    ensureModeAvailable(mode);
    const input = validateInput(body);
    const accountId = accountFor(mode);
    const generationCost = costFor(mode);
    const id = req.headers['idempotency-key'];
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(id)) throw failure('A valid request ID is required.',400);
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const reserved = ledger.reserve(accountId,id,fingerprint,generationCost);
    if (reserved.conflict) throw failure('Request ID belongs to a different brief.',409);
    if (reserved.status === 'completed') return json(res,200,{ok:true,...JSON.parse(reserved.output),credits:ledger.account(accountId),replayed:true,generationMode:mode});
    if (reserved.status === 'insufficient') throw failure('Not enough credits.',402);
    if (reserved.status === 'pending') throw failure('This request is still pending. Retry the same brief later; if it remains pending, contact the owner.',409);
    if (reserved.status === 'failed') return json(res,502,{ok:false,error:'The previous attempt failed. Change the brief or start a new attempt.',retryWithNewId:true});
    try {
      const output = await generate(input,{...config,liveEnabled:mode === 'live'});
      ledger.complete(accountId,id,output);
      return json(res,200,{ok:true,...output,credits:ledger.account(accountId),generationMode:mode});
    } catch (error) {
      logEvent('error','generation_failed',{ requestId:String(res.getHeader('X-Request-Id') || ''), generationId:id, mode, provider:mode === 'live' ? config.provider : 'demo', message:String(error?.message || 'unknown error').slice(0,700) });
      ledger.fail(accountId,id);
      return json(res,502,{ok:false,error:generationCost > 0 ? 'Generation did not complete. Your Studio credit was returned.' : 'Generation did not complete. No Studio credits were charged.',retryWithNewId:true});
    }
  }
  throw failure('API route not found.',404);
}

const assets = { '/':'index.html', '/index.html':'index.html', '/styles.css':'styles.css', '/app.js':'app.js' };
const mime = { html:'text/html', css:'text/css', js:'text/javascript' };
const server = http.createServer(async (req,res) => {
  headers(res);
  const requestId = randomUUID();
  res.setHeader('X-Request-Id',requestId);
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
    const status = error.status || 500;
    if (status >= 500) logEvent('error','request_failed',{ requestId, method:req.method, path:String(req.url || '').split('?')[0], status, message:String(error?.message || 'unknown error').slice(0,700) });
    if (!res.headersSent && !res.destroyed) json(res,status,{ok:false,error:error.status ? error.message : 'Server error. Please try again.'});
  }
});
server.requestTimeout = 60000;
server.listen(PORT,process.env.HOST || '127.0.0.1',() => logEvent('log','server_ready',{ port:PORT, mode:config.liveEnabled ? 'live' : config.allowDemo ? 'demo' : 'disabled', provider:config.provider }));
process.on('unhandledRejection',(reason) => logEvent('error','unhandled_rejection',{ message:String(reason?.message || reason || 'unknown').slice(0,700) }));
process.on('SIGTERM',() => server.close(() => {ledger.close(); process.exit(0);}));
