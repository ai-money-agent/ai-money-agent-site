const $ = (id) => document.getElementById(id);
const state = { imageDataUrl: '', lastResult: null, busy: false, imageVersion: 0, request: null, resultLanguage: 'en', generationCost: 0, imageLoading: false, generationMode: 'demo', health: null, lastEngine: '' };
const RECOVERY_KEY = 'local-growth-studio-recovery-v1';
const DRAFT_KEY = 'local-growth-studio-draft-v1';

const els = {
  form: $('studioForm'),
  image: $('productImage'),
  preview: $('uploadPreview'),
  previewWrap: $('uploadPreviewWrap'),
  uploadEmpty: $('uploadEmpty'),
  removeImage: $('removeImage'),
  dropzone: $('uploadDropzone'),
  productName: $('productName'),
  description: $('description'),
  descriptionCount: $('descriptionCount'),
  language: $('language'),
  audience: $('audience'),
  formMessage: $('formMessage'),
  empty: $('emptyState'),
  loading: $('loadingState'),
  results: $('results'),
  engine: $('engineBadge'),
  credits: $('creditsBadge'),
  copyAll: $('copyAll'),
  hook: $('hookOutput'),
  script: $('scriptOutput'),
  shots: $('shotsOutput'),
  screenText: $('screenTextOutput'),
  caption: $('captionOutput'),
  cta: $('ctaOutput'),
  ideas: $('ideasOutput'),
  generationDemo: $('generationDemo'),
  generationLive: $('generationLive'),
  generationModeHelp: $('generationModeHelp'),
  resultMeta: $('resultMeta'),
  imageMeta: $('imageMeta')
};

function setMessage(text = '', type = 'error') {
  els.formMessage.textContent = text;
  els.formMessage.className = text ? `message ${type}` : 'message hidden';
}
function setGenerationCost(value) {
  const cost = Number.isInteger(value) && value >= 0 ? value : 0;
  state.generationCost = cost;
  document.querySelectorAll('[data-generation-cost]').forEach((el) => {
    el.textContent = String(cost);
    const suffix = el.parentElement;
    if (suffix) suffix.lastChild.textContent = cost === 1 ? ' credit' : ' credits';
  });
}
function setBusy(isBusy) {
  state.busy = isBusy;
  els.form.setAttribute('aria-busy', String(isBusy));
  els.form.querySelectorAll('input, textarea, select, button').forEach(el => el.disabled = isBusy);
  els.generationDemo.disabled = isBusy || Boolean(state.health && !state.health.demoAvailable);
  els.generationLive.disabled = isBusy || Boolean(state.health && !state.health.liveAvailable);
  els.copyAll.disabled = isBusy || !state.lastResult;
  $('downloadResult').disabled = isBusy || !state.lastResult;
  $('recoverResult').disabled = isBusy;
  document.querySelectorAll('[data-mode]').forEach((button) => { button.disabled = isBusy; });
  els.empty.classList.toggle('hidden', isBusy || Boolean(state.lastResult));
  els.results.classList.toggle('hidden', isBusy || !state.lastResult);
  els.loading.classList.toggle('hidden', !isBusy);
}
function safeList(target, values = []) {
  target.replaceChildren(...values.map((value) => {
    const li = document.createElement('li');
    li.textContent = String(value);
    return li;
  }));
}
function applyDirection() {
  const dir = state.resultLanguage === 'ar' || state.resultLanguage === 'bilingual' ? 'rtl' : 'ltr';
  document.querySelectorAll('.result-card').forEach((card) => card.setAttribute('dir', dir));
}
function render(result) {
  state.lastResult = result;
  els.hook.textContent = result.hook || '—';
  els.script.textContent = result.reelScript || '—';
  safeList(els.shots, result.shotList);
  safeList(els.screenText, result.onScreenText);
  els.caption.textContent = result.caption || '—';
  els.cta.textContent = result.cta || '—';
  safeList(els.ideas, result.adIdeas);
  applyDirection();
  els.copyAll.disabled = false;
  $('downloadResult').disabled = false;
  els.resultMeta.textContent = `${state.generationMode === 'demo' ? 'Demo' : 'Live AI'} · ${state.lastEngine || 'generated'} · ${state.resultLanguage === 'ar' ? 'العربية' : state.resultLanguage === 'bilingual' ? 'العربية + English' : 'English'}`;
}
function readImage(file) {
  if (!file || state.busy) return;
  const version = ++state.imageVersion;
  state.imageLoading = false;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    setMessage('Use a PNG, JPG, or WebP image.');
    els.image.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setMessage('The product image must be 5 MB or smaller.');
    els.image.value = '';
    return;
  }
  state.imageLoading = true;
  const reader = new FileReader();
  reader.onload = () => {
    if (version !== state.imageVersion) return;
    state.imageLoading = false;
    state.imageDataUrl = String(reader.result || '');
    els.preview.src = state.imageDataUrl;
    els.imageMeta.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(file.size >= 1024 * 1024 ? 1 : 2)} MB`;
    els.previewWrap.classList.remove('hidden');
    els.uploadEmpty.classList.add('hidden');
    setMessage('');
  };
  reader.onerror = () => {
    if (version !== state.imageVersion) return;
    state.imageLoading = false;
    setMessage('Could not read that image.');
  };
  reader.readAsDataURL(file);
}

els.image.addEventListener('change', () => readImage(els.image.files?.[0]));
els.removeImage.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  ++state.imageVersion;
  state.imageLoading = false;
  state.imageDataUrl = '';
  els.image.value = '';
  els.preview.removeAttribute('src');
  els.imageMeta.textContent = '';
  els.previewWrap.classList.add('hidden');
  els.uploadEmpty.classList.remove('hidden');
});
['dragenter', 'dragover'].forEach((name) => els.dropzone.addEventListener(name, (event) => {
  event.preventDefault();
  els.dropzone.classList.add('dragover');
}));
['dragleave', 'drop'].forEach((name) => els.dropzone.addEventListener(name, (event) => {
  event.preventDefault();
  els.dropzone.classList.remove('dragover');
}));
els.dropzone.addEventListener('drop', (event) => readImage(event.dataTransfer?.files?.[0]));
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      productName: els.productName.value,
      description: els.description.value,
      language: els.language.value,
      audience: els.audience.value
    }));
  } catch {}
}
function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!draft || typeof draft !== 'object') return;
    if (typeof draft.productName === 'string') els.productName.value = draft.productName.slice(0, 120);
    if (typeof draft.description === 'string') els.description.value = draft.description.slice(0, 1800);
    if (['en','ar','bilingual'].includes(draft.language)) els.language.value = draft.language;
    if (typeof draft.audience === 'string') els.audience.value = draft.audience.slice(0, 240);
    els.descriptionCount.textContent = String(els.description.value.length);
  } catch {}
}
[els.productName, els.description, els.audience].forEach((el) => el.addEventListener('input', saveDraft));
els.language.addEventListener('change', saveDraft);
els.description.addEventListener('input', () => { els.descriptionCount.textContent = String(els.description.value.length); });

function selectedMode() { return els.generationLive.checked ? 'live' : 'demo'; }
function applyModeUi() {
  const health = state.health;
  if (!health) return;
  state.generationMode = selectedMode();
  const isDemo = state.generationMode === 'demo';
  setGenerationCost(isDemo ? (health.demoGenerationCost ?? 0) : health.generationCost);
  els.engine.textContent = isDemo
    ? 'Demo · no API'
    : health.liveAvailable
      ? `Live AI · ${health.provider === 'anthropic' ? 'Claude' : 'OpenAI'}`
      : 'Live AI unavailable';
  els.generationModeHelp.textContent = isDemo
    ? 'Demo mode never calls Claude or OpenAI and is safe for free testing.'
    : `Live AI uses ${health.provider === 'anthropic' ? 'Claude' : 'OpenAI'} and may consume provider/API credit.`;
  $('modeNotice').textContent = isDemo
    ? health.demoAvailable
      ? 'Demo mode is active: sample output only. Your image is previewed locally and is not sent to an AI provider.'
      : 'Demo mode is not available on the server right now.'
    : health.liveAvailable
      ? `Live AI is selected with ${health.provider === 'anthropic' ? 'Claude' : 'OpenAI'}. Provider/API credit may be used.`
      : 'Live AI is not available on the server right now.';
}
async function refreshCredits() {
  const mode = selectedMode();
  try {
    const response = await fetch(`/api/credits?mode=${mode}`, { signal:AbortSignal.timeout(10000) });
    if (response.status === 401) { els.credits.textContent = 'Sign in'; return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Credits unavailable');
    setGenerationCost(data.generationCost);
    els.credits.textContent = mode === 'demo' ? 'Demo · free' : `${data.balance} credits`;
  } catch { els.credits.textContent = '— credits'; }
}
async function refreshStatus() {
  try {
    const healthRes = await fetch('/api/health', { signal: AbortSignal.timeout(10000) });
    if (!healthRes.ok) throw new Error('Server unavailable');
    const health = await healthRes.json();
    state.health = health;
    els.generationDemo.disabled = !health.demoAvailable;
    els.generationLive.disabled = !health.liveAvailable;
    if (!health.demoAvailable && health.liveAvailable) els.generationLive.checked = true;
    else if (health.demoAvailable && !els.generationLive.checked) els.generationDemo.checked = true;
    $('accessPanel').classList.toggle('hidden', !health.requiresLogin);
    applyModeUi();
    if (health.requiresLogin) {
      els.credits.textContent = 'Sign in';
      return;
    }
    await refreshCredits();
  } catch {
    els.engine.textContent = 'Server unavailable';
    els.credits.textContent = '— credits';
    $('modeNotice').textContent = 'The Studio server is unavailable. Please try again later.';
  }
}
$('accessForm').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const response = await fetch('/api/session', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({accessCode:$('accessCode').value}),
      signal:AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Access code not accepted.');
    $('accessCode').value = '';
    $('accessMessage').textContent = '';
    await refreshStatus();
  } catch(error) {
    $('accessMessage').textContent = error.message;
  }
});

function invalidate(el, invalid) { el.setAttribute('aria-invalid', invalid ? 'true' : 'false'); }
function validateForm() {
  [els.productName, els.description, els.audience].forEach(el => invalidate(el,false));
  if (els.productName.value.trim().length < 2) { invalidate(els.productName,true); els.productName.focus?.(); return 'Add a product name with at least 2 characters.'; }
  if (els.description.value.trim().length < 10) { invalidate(els.description,true); els.description.focus?.(); return 'Add a clearer product description with at least 10 characters.'; }
  if (els.audience.value.trim().length < 3) { invalidate(els.audience,true); els.audience.focus?.(); return 'Add a target audience with at least 3 characters.'; }
  if (selectedMode() === 'live' && !state.health?.liveAvailable) return 'Live AI is not available. Choose Demo mode.';
  if (selectedMode() === 'demo' && !state.health?.demoAvailable) return 'Demo mode is not available.';
  return '';
}
async function runGeneration(mode) {
  if (state.busy) return;
  if (state.imageLoading) return setMessage('Please wait for the image preview to finish loading.');
  const validation = validateForm();
  if (validation) return setMessage(validation);

  setMessage('');
  setBusy(true);
  try {
    const payload = {
      mode,
      productName: els.productName.value.trim(),
      description: els.description.value.trim(),
      language: els.language.value,
      audience: els.audience.value.trim(),
      imageDataUrl: state.imageDataUrl || null,
      generationMode: selectedMode()
    };
    const body = JSON.stringify(payload);
    if (!state.request || state.request.body !== body) state.request = { body, id: crypto.randomUUID() };
    rememberRequest(state.request.id, payload.language, payload.generationMode);
    const response = await fetch('/api/generate', {
      method: 'POST',
      signal: AbortSignal.timeout(55000),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': state.request.id },
      body
    });
    const data = await response.json();
    if (data.retryWithNewId) { state.request = null; forgetRequest(); }
    if (!response.ok || !data.ok) {
      if ([400,401,402,403,413,415,422,429,503].includes(response.status)) forgetRequest();
      if (response.status === 401) await refreshStatus();
      if (response.status === 402) await refreshStatus();
      throw new Error(data.error || 'Generation failed.');
    }
    state.request = null;
    state.resultLanguage = payload.language;
    state.generationMode = payload.generationMode;
    state.lastEngine = data.engine || payload.generationMode;
    render(data.result);
    els.credits.textContent = payload.generationMode === 'demo' ? 'Demo · free' : `${data.credits.balance} credits`;
    setMessage(data.engine === 'demo' ? 'Sample template generated — not live AI. Review and adapt it before use.' : 'Creative pack generated.', 'success');
  } catch (error) {
    setMessage(error.name === 'TimeoutError' || error instanceof TypeError
      ? 'Connection interrupted. Retry the same brief to recover the result without a duplicate credit charge.'
      : error.message || 'Something went wrong.');
  } finally {
    setBusy(false);
  }
}

els.form.addEventListener('submit', event => { event.preventDefault(); runGeneration('ad'); });
document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => runGeneration(button.dataset.mode));
});
function resultText() {
  const r = state.lastResult;
  return [
    `HOOK\n${r.hook}`,
    `REEL SCRIPT\n${r.reelScript}`,
    `SHOT LIST\n${(r.shotList || []).map((v, i) => `${i + 1}. ${v}`).join('\n')}`,
    `ON-SCREEN TEXT\n${(r.onScreenText || []).map((v) => `• ${v}`).join('\n')}`,
    `CAPTION\n${r.caption}`,
    `CTA\n${r.cta}`,
    `AD IDEAS\n${(r.adIdeas || []).map((v) => `• ${v}`).join('\n')}`
  ].join('\n\n');
}
els.copyAll.addEventListener('click', async () => {
  if (!state.lastResult) return;
  try {
    await navigator.clipboard.writeText(resultText());
    els.copyAll.textContent = 'Copied';
    setTimeout(() => { els.copyAll.textContent = 'Copy all'; }, 1400);
  } catch {
    setMessage('Copy failed. Select the text manually.');
  }
});


function rememberRequest(id, language, mode) {
  try { sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ id, language, mode })); } catch {}
  $('recoverResult').classList.remove('hidden');
}
function forgetRequest() {
  try { sessionStorage.removeItem(RECOVERY_KEY); } catch {}
  $('recoverResult').classList.add('hidden');
}
async function recoverResult() {
  if (state.busy) return;
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) || 'null'); } catch {}
  if (!saved || !/^[A-Za-z0-9_-]{16,100}$/.test(saved.id)) return forgetRequest();
  setBusy(true);
  try {
    const mode = saved.mode === 'live' || saved.mode === 'demo' ? saved.mode : (state.health?.liveAvailable ? 'live' : 'demo');
    const response = await fetch(`/api/generations/${saved.id}?mode=${mode}`, { signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (response.status === 404) forgetRequest();
    if (response.status === 401) await refreshStatus();
    if (!response.ok) throw new Error(data.error || 'Could not recover the result.');
    els.credits.textContent = mode === 'demo' ? 'Demo · free' : `${data.credits.balance} credits`;
    if (data.status === 'completed') {
      state.resultLanguage = saved.language;
      state.generationMode = mode;
      state.lastEngine = mode === 'demo' ? 'demo' : (state.health?.provider || 'live');
      if (mode === 'live') els.generationLive.checked = true; else els.generationDemo.checked = true;
      applyModeUi();
      render(data.result);
      state.request = null;
      setMessage('Last creative pack recovered. No extra credits used.', 'success');
    } else if (data.status === 'failed') {
      forgetRequest();
      state.request = null;
      setMessage('The last generation failed and its Studio credit was returned. You can start a new attempt.');
    } else {
      setMessage('The last request is still pending. Recover it again shortly; if it remains pending, contact the Studio owner.');
    }
  } catch (error) {
    setMessage(error.name === 'TimeoutError' || error instanceof TypeError
      ? 'Connection interrupted. Use Recover last result again when connected.' : error.message);
  } finally { setBusy(false); }
}
$('recoverResult').addEventListener('click', recoverResult);
$('downloadResult').addEventListener('click', () => {
  if (!state.lastResult || state.busy) return;
  const blob = new Blob(['\uFEFF' + resultText()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'local-growth-creative-pack.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
els.generationDemo.addEventListener('change', async () => { applyModeUi(); await refreshCredits(); });
els.generationLive.addEventListener('change', async () => { applyModeUi(); await refreshCredits(); });
[els.productName, els.description, els.audience].forEach(el => el.addEventListener('input', () => invalidate(el,false)));
restoreDraft();
try {
  if (sessionStorage.getItem(RECOVERY_KEY)) $('recoverResult').classList.remove('hidden');
} catch {}
refreshStatus();
