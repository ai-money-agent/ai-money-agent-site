import http from 'node:http';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual, randomUUID, randomBytes } from 'node:crypto';
import { Ledger } from './lib/ledger.js';
import { WorkspaceStore } from './lib/workspace.js';
import { findProductIdeas, analyzeIdea, buildProductBlueprint, buildBrandProfile, createAdPack, createReelPack, partnerReply, recipes } from './lib/business-engine.js';
import { generate } from './lib/generator.js';
import { generateV2 } from './lib/v2-ai.js';
import { prepareVideoRequest, videoCapability } from './lib/video.js';
import { createDigitalProduct } from './lib/digital-product-factory.js';
import { buildBusinessLaunchPlan } from './lib/business-planner.js';
import { searchMarketSources } from './lib/market-search.js';

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
  openaiModel: process.env.OPENAI_MODEL || 'gpt-6.1-sol',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || '',
  allowDemo: process.env.ALLOW_MOCK_GENERATION !== '0',
  liveRequested,
  providerEnabled,
  liveEnabled: liveRequested && providerEnabled,
  initialCredits: intEnv('INITIAL_CREDITS', 100, 0, 1000000),
  generationCost: intEnv('GENERATION_CREDIT_COST', 1, 1, 1000),
  pendingJobTimeoutMinutes: intEnv('PENDING_JOB_TIMEOUT_MINUTES', 15, 2, 1440),
  demoGenerationCost: 0
};
const marketSearchConfig = {
  enabled: process.env.ENABLE_MARKET_SEARCH === '1',
  provider: 'tavily',
  apiKey: process.env.TAVILY_API_KEY || ''
};
const ORIGIN = process.env.APP_ORIGIN || '';
const PORT = Number(process.env.PORT || 8787);
function loadLoginAccounts() {
  let configured = {};
  if (process.env.STUDIO_ACCOUNTS_JSON) {
    try { configured = JSON.parse(process.env.STUDIO_ACCOUNTS_JSON); }
    catch { throw new Error('STUDIO_ACCOUNTS_JSON must be valid JSON.'); }
    if (!configured || Array.isArray(configured) || typeof configured !== 'object') {
      throw new Error('STUDIO_ACCOUNTS_JSON must be an object mapping account IDs to access codes.');
    }
  } else if (process.env.STUDIO_ACCESS_CODE) {
    configured = { 'beta-owner': process.env.STUDIO_ACCESS_CODE };
  }
  const entries = Object.entries(configured);
  const seenCodes = new Set();
  for (const [account, code] of entries) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(account)) throw new Error('Studio account IDs must use 1-64 letters, numbers, hyphens or underscores.');
    if (typeof code !== 'string' || code.length < 24) throw new Error('Each Studio access code must be at least 24 characters.');
    if (seenCodes.has(code)) throw new Error('Each Studio account must have a unique access code.');
    seenCodes.add(code);
  }
  return new Map(entries);
}
const loginAccounts = loadLoginAccounts();
if (config.liveEnabled) {
  const missing = [];
  if (config.provider === 'anthropic') {
    if (!config.anthropicApiKey) missing.push('ANTHROPIC_API_KEY');
    if (!config.anthropicModel) missing.push('ANTHROPIC_MODEL');
  } else {
    if (!config.openaiApiKey) missing.push('OPENAI_API_KEY');
    if (!config.openaiModel) missing.push('OPENAI_MODEL');
  }
  if (loginAccounts.size === 0) missing.push('STUDIO_ACCOUNTS_JSON or STUDIO_ACCESS_CODE');
  if (!ORIGIN.startsWith('https://')) missing.push('APP_ORIGIN(https://...)');
  if (missing.length) throw new Error(`Live AI config invalid: ${missing.join(', ')}`);
}
const ledger = new Ledger(process.env.CREDIT_DB || join(ROOT, 'data', 'credits.sqlite'), config.initialCredits);
const workspace = new WorkspaceStore(process.env.WORKSPACE_DB || join(ROOT, 'data', 'workspace.sqlite'));
const productFilesRoot = process.env.PRODUCT_FILES_DIR || join(ROOT,'data','generated-products');
const ledgerAccounts = { demo: 'demo-shared', live: 'beta-owner' };
const rates = new Map();
const equal = (a, b) => {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
};
const sessionHash = token => createHash('sha256').update(token).digest('hex');
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
const accountFor = (mode, owner = 'beta-owner') => mode === 'demo' ? (owner === 'beta-owner' ? ledgerAccounts.demo : `${owner}:demo`) : owner;
const costFor = mode => mode === 'demo' ? config.demoGenerationCost : config.generationCost;
function logEvent(level,event,details={}) {
  const payload = { time:new Date().toISOString(), event, ...details };
  console[level](JSON.stringify(payload));
}
function refundStaleReservations() {
  const recovered = ledger.refundStalePending(config.pendingJobTimeoutMinutes * 60000);
  if (recovered.jobs) logEvent('warn','stale_reservations_refunded',{ jobs:recovered.jobs, credits:recovered.credits });
  return recovered;
}
refundStaleReservations();

function sessionToken(req) {
  const token = /(?:^|;\s*)studio_session=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.headers.cookie || '')?.[1] || '';
  return token || null;
}
function authenticated(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const tokenHash = sessionHash(token);
  const account = workspace.sessionAccount(tokenHash);
  if (account && !loginAccounts.has(account)) {
    workspace.deleteSession(tokenHash);
    return null;
  }
  return account;
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
  const key = `${req.socket.remoteAddress}:${path}`;
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
  if (['POST','PUT','PATCH','DELETE'].includes(req.method)) {
    const expected = ORIGIN || `http://${req.headers.host}`;
    if ((req.headers.origin && req.headers.origin !== expected) || req.headers['sec-fetch-site'] === 'cross-site') throw failure('Cross-site request blocked.',403);
  }
  if (req.method === 'GET' && url.pathname === '/api/health/ready') {
    const storageReady = ledger.ping();
    return json(res,storageReady ? 200 : 503,{ok:storageReady,status:storageReady ? 'ready' : 'not_ready',version:'0.7.0'});
  }
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res,200,{
      ok:true,
      version:'0.7.0',
      engine:config.liveEnabled ? config.provider : config.allowDemo ? 'demo' : 'disabled',
      aiConnected:config.liveEnabled,
      providerPaused:config.liveRequested && !config.liveEnabled,
      video:videoCapability(),
      generationCost:config.generationCost,
      demoGenerationCost:config.demoGenerationCost,
      demoAvailable:config.allowDemo,
      liveAvailable:config.liveEnabled,
      provider:config.provider,
      v2AiProvider:config.provider,
      v2AiModel:config.provider === 'anthropic' ? config.anthropicModel : config.openaiModel,
      v2AiReady:config.liveEnabled,
      v2AiMode:config.liveEnabled ? config.provider : 'local',
      marketSearchProvider:marketSearchConfig.provider,
      marketSearchAvailable:marketSearchConfig.enabled && Boolean(marketSearchConfig.apiKey),
      pendingJobTimeoutMinutes:config.pendingJobTimeoutMinutes,
      uptimeSeconds:Math.floor(process.uptime()),
      storageReady:ledger.ping(),
      workspaceReady:workspace.ping(),
      requiresLogin:!authenticated(req)
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/session') {
    const body = await readBody(req);
    if (typeof body.accessCode !== 'string' || loginAccounts.size === 0) throw failure('Invalid access code.',401);
    let account = null;
    for (const [accountId, accessCode] of loginAccounts) {
      if (equal(body.accessCode,accessCode)) account = accountId;
    }
    if (!account) throw failure('Invalid access code.',401);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now()+8*3600000;
    workspace.createSession(sessionHash(token),account,expiresAt);
    res.setHeader('Set-Cookie',`studio_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${ORIGIN.startsWith('https://') ? '; Secure' : ''}`);
    return json(res,200,{ok:true});
  }
  if (req.method === 'DELETE' && url.pathname === '/api/session') {
    const token = sessionToken(req);
    if (token) workspace.deleteSession(sessionHash(token));
    res.setHeader('Set-Cookie',`studio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${ORIGIN.startsWith('https://') ? '; Secure' : ''}`);
    return json(res,200,{ok:true});
  }
  const authenticatedAccount = authenticated(req);
  if (!authenticatedAccount) throw failure('Enter your Studio access code first.',401);

  const v2Account = authenticatedAccount;
  const v2Language = (value, sample = '') => {
    if (value === 'ar' || value === 'en') return value;
    return /[\u0600-\u06ff]/.test(String(sample || '')) ? 'ar' : 'en';
  };
  const projectOrFail = (id) => {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw failure('Choose a valid project.',400);
    const project = workspace.project(v2Account,id);
    if (!project) throw failure('Project not found.',404);
    return project;
  };
  const productOrFail = (id) => {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw failure('Choose a valid product.',400);
    const product = workspace.product(v2Account,id);
    if (!product) throw failure('Product not found.',404);
    return product;
  };

  if (req.method === 'GET' && url.pathname === '/api/v2/recipes') {
    return json(res,200,{ok:true,recipes:recipes(v2Language(url.searchParams.get('language')))});
  }
  if (req.method === 'GET' && url.pathname === '/api/v2/research/market') {
    const project = projectOrFail(url.searchParams.get('projectId'));
    const saved = workspace.listOutputs(v2Account,project.id,1000).find(item => item.type === 'market-search-evidence');
    return json(res,200,{ok:true,search:marketSearchConfig.enabled && marketSearchConfig.apiKey ? saved?.payload || null : null,available:marketSearchConfig.enabled && Boolean(marketSearchConfig.apiKey)});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/research/market') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    const productName = text(body.productName || '',120,'Product or market name',2);
    const marketScope = ['local','global','both','unsure'].includes(body.marketScope) ? body.marketScope : project.profile.marketScope || 'unsure';
    const globalScope = marketScope === 'global';
    const country = globalScope ? '' : text(body.country || project.profile.country || '',80,'Target country',2);
    const audience = typeof body.audience === 'string' ? body.audience.trim().slice(0,180) : '';
    const type = ['digital','physical','service','dropshipping','print_on_demand'].includes(body.businessType) ? body.businessType : 'digital';
    const focus = ['physical','dropshipping','print_on_demand'].includes(type) ? 'market listings and suppliers' : 'market demand, customer problems, and competitors';
    const reach = marketScope === 'global' ? 'worldwide international global market' : marketScope === 'both' ? 'local and worldwide international market' : country;
    const query = [productName,audience,reach,focus,'current competitors offers customer demand'].filter(Boolean).join(' ');
    let result;
    try { result = await searchMarketSources({query,apiKey:marketSearchConfig.apiKey,enabled:marketSearchConfig.enabled}); }
    catch (error) { throw failure(error.message || 'Market search failed.',error.status || 502); }
    if (result.available) workspace.saveOutput(v2Account,project.id,'market-search-evidence',`Market sources: ${productName}`,result);
    return json(res,200,{ok:true,search:result});
  }
  if (req.method === 'GET' && url.pathname === '/api/v2/projects') {
    return json(res,200,{ok:true,projects:workspace.listProjects(v2Account)});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/projects') {
    const body = await readBody(req);
    const profile = {
      country:text(body.country || '',80,'Country',2),
      budget:text(body.budget || '0',80,'Budget',1),
      skills:text(body.skills || 'Beginner',300,'Skills',2),
      timeAvailable:text(body.timeAvailable || '5 hours/week',80,'Available time',2),
      businessType:['digital','physical','service','ecommerce','dropshipping','print_on_demand','unsure'].includes(body.businessType) ? body.businessType : 'unsure',
      marketScope:['local','global','both','unsure'].includes(body.marketScope) ? body.marketScope : 'unsure',
      payoutMethods:text(body.payoutMethods || 'Not set yet',300,'Payout methods',2)
    };
    const project = workspace.createProject(v2Account,{name:body.name || 'New business project',...profile});
    return json(res,201,{ok:true,project});
  }
  if (req.method === 'PATCH' && url.pathname.startsWith('/api/v2/projects/')) {
    const id = url.pathname.slice('/api/v2/projects/'.length);
    projectOrFail(id);
    const body = await readBody(req);
    const project = workspace.updateProject(v2Account,id,{
      name:body.name,
      status:body.status,
      profile:body.profile && typeof body.profile === 'object' ? body.profile : undefined
    });
    return json(res,200,{ok:true,project});
  }
  if (req.method === 'GET' && url.pathname === '/api/v2/dashboard') {
    const projectId = url.searchParams.get('projectId');
    if (projectId) projectOrFail(projectId);
    return json(res,200,{ok:true,...workspace.dashboard(v2Account,projectId || null)});
  }
  if (req.method === 'GET' && url.pathname === '/api/v2/launch/plan') {
    const project = projectOrFail(url.searchParams.get('projectId'));
    const saved = workspace.listOutputs(v2Account,project.id,1000).find(item => item.type === 'business-launch-plan');
    return json(res,200,{ok:true,plan:saved?.payload || null,outputId:saved?.id || null,createdAt:saved?.createdAt || null});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/launch/plan') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    let plan;
    try { plan = buildBusinessLaunchPlan({...body,country:body.country || project.profile.country}); }
    catch (error) { throw failure(error.message || 'Could not calculate this launch plan.',422); }
    const saved = workspace.saveOutput(v2Account,project.id,'business-launch-plan',plan.title,plan);
    return json(res,201,{ok:true,plan:saved.payload,outputId:saved.id,createdAt:saved.createdAt});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/research/ideas') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    const language = v2Language(body.language,project.profile.skills);
    const generated = await generateV2({operation:'product ideas',context:{profile:project.profile},language,fallback:()=>findProductIdeas(project.profile,language)},config);
    return json(res,200,{ok:true,ideas:generated.value,dataStatus:language === 'ar' ? 'تقييم قابلية تنفيذ داخلي، بدون بيانات ويب حيّة.' : 'Execution-fit analysis; no live web-market data.',aiEngine:generated.engine});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/research/analyze') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    if (!body.idea || typeof body.idea !== 'object') throw failure('Choose an idea to analyze.',422);
    const language = v2Language(body.language,body.idea.name);
    const generated = await generateV2({operation:'idea analysis and market validation plan',context:{profile:project.profile,idea:body.idea},language,fallback:()=>({ ...analyzeIdea(project.profile,body.idea,language), idea:body.idea })},config);
    const analysis = generated.value;
    const saved = workspace.saveResearch(v2Account,project.id,analysis.ideaName,analysis);
    return json(res,200,{ok:true,analysis,researchId:saved.id,aiEngine:generated.engine});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/products/build') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    const latestResearch = workspace.latestResearch(v2Account,project.id)?.payload || null;
    const language = v2Language(body.language,body.idea?.name || body.answers?.name);
    const selectedIdea = body.idea && typeof body.idea === 'object' && body.idea.name ? body.idea : latestResearch?.idea || {};
    if (body.productId) {
      const existing = productOrFail(body.productId);
      if (existing.projectId !== project.id) throw failure('Product does not belong to this project.',409);
    }
    const build = () => buildProductBlueprint({
      profile:project.profile,
      research:latestResearch,
      idea:selectedIdea,
      answers:body.answers && typeof body.answers === 'object' ? body.answers : {},
      language
    });
    const generated = await generateV2({operation:'smallest sellable product blueprint and pricing',context:{profile:project.profile,research:latestResearch,idea:selectedIdea,answers:body.answers || {}},language,fallback:build},config);
    const blueprint = generated.value;
    if (body.productId) blueprint.id = body.productId;
    const product = workspace.saveProduct(v2Account,project.id,blueprint);
    return json(res,201,{ok:true,product,aiEngine:generated.engine});
  }
  if (req.method === 'GET' && url.pathname === '/api/v2/factory/assets') {
    const projectId = url.searchParams.get('projectId');
    const project = projectOrFail(projectId);
    const assets = workspace.listOutputs(v2Account,project.id,1000)
      .filter(item => item.type === 'digital-product')
      .map(item => ({ id:item.id, title:item.title, createdAt:item.createdAt, ...item.payload }));
    return json(res,200,{ok:true,assets});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/factory/generate') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    if (body.productId) {
      const linkedProduct = productOrFail(body.productId);
      if (linkedProduct.projectId !== project.id) throw failure('Product does not belong to this project.',409);
    }
    let artifact;
    try {
      artifact = createDigitalProduct({
        type:body.type, title:body.title, topic:body.topic, audience:body.audience,
        outcome:body.outcome, level:body.level, questions:body.questions, language:body.language,
        pages:body.pages, questionsPerPage:body.questionsPerPage
      });
    } catch (error) {
      throw failure(error.message || 'Could not create this digital product.',422);
    }
    const extension = artifact.filename.split('.').pop();
    const filePath = join(productFilesRoot,artifact.id + '.' + extension);
    await mkdir(productFilesRoot,{recursive:true,mode:0o700});
    await writeFile(filePath,artifact.buffer,{flag:'wx',mode:0o600});
    let previewFileId=artifact.id, previewExtension=extension;
    if(artifact.preview?.buffer && artifact.preview.buffer !== artifact.buffer){
      previewFileId=randomUUID();previewExtension=artifact.preview.filename.split('.').pop();
      await writeFile(join(productFilesRoot,previewFileId+'.'+previewExtension),artifact.preview.buffer,{flag:'wx',mode:0o600});
    }
    let saved;
    try {
      saved = workspace.saveOutput(v2Account,project.id,'digital-product',artifact.filename,{
        fileId:artifact.id, filename:artifact.filename, extension, contentType:artifact.contentType,
        pages:artifact.pages || null, type:body.type, label:artifact.label,
        previewFileId, previewFilename:artifact.preview?.filename || artifact.filename,
        previewContentType:artifact.preview?.contentType || artifact.contentType,
        previewExtension
      });
    } catch (error) {
      await unlink(filePath).catch(()=>{});
      if(previewFileId!==artifact.id)await unlink(join(productFilesRoot,previewFileId+'.'+previewExtension)).catch(()=>{});
      throw error;
    }
    return json(res,201,{ok:true,asset:{id:saved.id,fileId:artifact.id,filename:artifact.filename,contentType:artifact.contentType,pages:artifact.pages||null,label:artifact.label,previewFileId,previewFilename:artifact.preview?.filename||artifact.filename,previewContentType:artifact.preview?.contentType||artifact.contentType,createdAt:saved.createdAt}});
  }
  if (req.method === 'GET' && url.pathname === '/api/v2/factory/download') {
    const project = projectOrFail(url.searchParams.get('projectId'));
    const fileId = url.searchParams.get('fileId') || '';
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw failure('Choose a valid saved file.',400);
    const saved = workspace.listOutputs(v2Account,project.id,1000)
      .find(item => item.type === 'digital-product' && (item.payload?.fileId === fileId || item.payload?.previewFileId === fileId));
    if (!saved) throw failure('Saved file not found for this project.',404);
    const isPreview=saved.payload.previewFileId===fileId;
    const extension = isPreview?saved.payload.previewExtension:saved.payload.extension;
    if (!['pdf','xlsx','html'].includes(extension)) throw failure('Unsupported saved file.',404);
    let file;
    try { file = await readFile(join(productFilesRoot,fileId + '.' + extension)); }
    catch { throw failure('The saved file is missing. Generate it again from the Product Builder.',404); }
    const filename = String(isPreview?saved.payload.previewFilename:(saved.payload.filename || saved.title)).replace(/[^a-zA-Z0-9._-]/g,'_');
    const contentType=isPreview?saved.payload.previewContentType:saved.payload.contentType;
    const inline=url.searchParams.get('inline')==='1';
    const previewHeaders=isPreview&&inline&&contentType.startsWith('text/html;')?{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",'X-Frame-Options':'SAMEORIGIN'}:{};
    res.writeHead(200,{'Content-Type':contentType,'Content-Disposition':`${inline?'inline':'attachment'}; filename="${filename}"`,'Content-Length':file.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...previewHeaders});
    return res.end(file);
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/products/save') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    if (!body.product || typeof body.product !== 'object') throw failure('Product details are required.',422);
    const product = workspace.saveProduct(v2Account,project.id,body.product);
    return json(res,200,{ok:true,product});
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/v2/products')) {
    const projectId = url.searchParams.get('projectId');
    const project = projectOrFail(projectId);
    return json(res,200,{ok:true,products:workspace.listProducts(v2Account,project.id)});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/brand/generate') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    const product = productOrFail(body.productId);
    if (product.projectId !== project.id) throw failure('Product does not belong to this project.',409);
    const language = v2Language(body.language,product.name);
    const generated = await generateV2({operation:'brand profile and buyer persona',context:{product,project},language,fallback:()=>buildBrandProfile(product,project,language)},config);
    const brand = workspace.saveBrand(v2Account,project.id,generated.value);
    return json(res,200,{ok:true,brand,aiEngine:generated.engine});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/brand/save') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    if (!body.brand || typeof body.brand !== 'object') throw failure('Brand profile is required.',422);
    return json(res,200,{ok:true,brand:workspace.saveBrand(v2Account,project.id,body.brand)});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/ads/generate') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    const product = productOrFail(body.productId);
    if (product.projectId !== project.id) throw failure('Product does not belong to this project.',409);
    const language = v2Language(body.language,product.name);
    const generated = await generateV2({operation:'four distinct test advertisements',context:{product},language,fallback:()=>createAdPack(product,language)},config);
    const pack = generated.value;
    const saved = workspace.saveOutput(v2Account,project.id,'ad-pack',`${product.name} — 4 ad angles`,pack);
    return json(res,200,{ok:true,pack,savedId:saved.id,aiEngine:generated.engine});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/reels/generate') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    const product = productOrFail(body.productId);
    if (product.projectId !== project.id) throw failure('Product does not belong to this project.',409);
    const language = v2Language(body.language,product.name);
    const generated = await generateV2({operation:'short vertical reel script and shot list',context:{product},language,fallback:()=>createReelPack(product,language)},config);
    const pack = generated.value;
    const saved = workspace.saveOutput(v2Account,project.id,'reel',`${product.name} — Reel`,pack);
    return json(res,200,{ok:true,pack,savedId:saved.id,aiEngine:generated.engine});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/partner') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    const message = text(body.message,4000,'Message',1);
    workspace.addMessage(v2Account,project.id,'user',message);
    const products = workspace.listProducts(v2Account,project.id);
    const language = v2Language(body.language,message);
    const context = {project,product:products[0] || null,research:workspace.latestResearch(v2Account,project.id)?.payload || null,brand:workspace.brand(v2Account,project.id)};
    const generated = await generateV2({operation:'business partner reply and next step',context:{...context,message},language,fallback:()=>partnerReply(message,context,language)},config);
    const result = generated.value;
    workspace.addMessage(v2Account,project.id,'assistant',result.reply);
    return json(res,200,{ok:true,...result,aiEngine:generated.engine,messages:workspace.messages(v2Account,project.id)});
  }
  if (req.method === 'GET' && url.pathname === '/api/v2/partner/messages') {
    const project = projectOrFail(url.searchParams.get('projectId'));
    return json(res,200,{ok:true,messages:workspace.messages(v2Account,project.id)});
  }
  if (req.method === 'POST' && url.pathname === '/api/v2/tasks') {
    const body = await readBody(req);
    const project = projectOrFail(body.projectId);
    const recipe = text(body.recipe,120,'Recipe',2);
    return json(res,201,{ok:true,task:workspace.createTask(v2Account,project.id,recipe,body.payload && typeof body.payload === 'object' ? body.payload : {})});
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/generations/')) {
    const mode = generationMode(url.searchParams.get('mode'));
    refundStaleReservations();
    const accountId = accountFor(mode,authenticatedAccount);
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
    const accountId = accountFor(mode,authenticatedAccount);
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
    const accountId = accountFor(mode,authenticatedAccount);
    const generationCost = costFor(mode);
    const id = req.headers['idempotency-key'];
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(id)) throw failure('A valid request ID is required.',400);
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    refundStaleReservations();
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

const assets = { '/':'index.html', '/index.html':'index.html', '/styles.css':'styles.css', '/app.js':'app.js', '/v2':'v2.html', '/v2/':'v2.html', '/v2.html':'v2.html', '/v2.css':'v2.css', '/v2.js':'v2.js', '/research-links.js':'research-links.js' };
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
process.on('SIGTERM',() => server.close(() => { ledger.close(); workspace.close(); process.exit(0); }));

