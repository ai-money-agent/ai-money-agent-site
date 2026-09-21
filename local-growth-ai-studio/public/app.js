const $ = (id) => document.getElementById(id);
const state = { imageDataUrl: '', lastResult: null, busy: false, imageVersion: 0, request: null, resultLanguage: 'en', generationCost: 1, imageLoading: false };
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
  ideas: $('ideasOutput')
};

function setMessage(text = '', type = 'error') {
  els.formMessage.textContent = text;
  els.formMessage.className = text ? `message ${type}` : 'message hidden';
}
function setGenerationCost(value) {
  const cost = Number.isInteger(value) && value > 0 ? value : 1;
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

async function refreshStatus() {
  try {
    const healthRes = await fetch('/api/health', { signal: AbortSignal.timeout(10000) });
    if (!healthRes.ok) throw new Error('Server unavailable');
    const health = await healthRes.json();
    setGenerationCost(health.generationCost);
    $('accessPanel').classList.toggle('hidden', !health.requiresLogin);
    els.engine.textContent = ['openai','anthropic'].includes(health.engine)
      ? (health.engine === 'anthropic' ? 'Live AI · Claude' : 'Live AI · OpenAI')
      : health.providerPaused
        ? 'AI provider paused'
        : health.engine === 'demo'
          ? 'Template mode'
          : 'AI not connected';
    $('modeNotice').textContent = health.providerPaused
      ? health.engine === 'demo'
        ? 'Template mode: sample output only. Your image is previewed, but not analyzed by AI.'
        : 'Generation is currently paused. Your saved results can still be recovered.'
      : health.engine === 'demo'
        ? 'Template mode: sample output only. Your image is previewed, but not analyzed by AI.'
        : ['openai','anthropic'].includes(health.engine)
          ? `Live AI is enabled with ${health.engine === 'anthropic' ? 'Claude' : 'OpenAI'}. Review the generated claims before publishing.`
          : 'Live generation is not connected yet.';
    if (health.requiresLogin) {
      els.credits.textContent = 'Sign in';
      return;
    }
    const creditsRes = await fetch('/api/credits', { signal: AbortSignal.timeout(10000) });
    if (!creditsRes.ok) throw new Error('Credits unavailable');
    const creditData = await creditsRes.json();
    setGenerationCost(creditData.generationCost);
    els.credits.textContent = `${creditData.balance} credits`;
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

function validateForm() {
  if (!els.productName.value.trim()) return 'Add the product name.';
  if (!els.description.value.trim()) return 'Add the product description.';
  if (!els.audience.value.trim()) return 'Add the target audience.';
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
      imageDataUrl: state.imageDataUrl || null
    };
    const body = JSON.stringify(payload);
    if (!state.request || state.request.body !== body) state.request = { body, id: crypto.randomUUID() };
    rememberRequest(state.request.id, payload.language);
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
    render(data.result);
    els.credits.textContent = `${data.credits.balance} credits`;
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


function rememberRequest(id, language) {
  try { sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ id, language })); } catch {}
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
    const response = await fetch(`/api/generations/${saved.id}`, { signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (response.status === 404) forgetRequest();
    if (response.status === 401) await refreshStatus();
    if (!response.ok) throw new Error(data.error || 'Could not recover the result.');
    els.credits.textContent = `${data.credits.balance} credits`;
    if (data.status === 'completed') {
      state.resultLanguage = saved.language;
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
restoreDraft();
try {
  if (sessionStorage.getItem(RECOVERY_KEY)) $('recoverResult').classList.remove('hidden');
} catch {}
refreshStatus();
