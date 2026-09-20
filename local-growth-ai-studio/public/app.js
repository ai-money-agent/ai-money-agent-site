const $ = (id) => document.getElementById(id);
const state = { imageDataUrl: '', lastResult: null, busy: false, imageVersion: 0, request: null, resultLanguage: 'en' };

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

function setBusy(isBusy) {
  state.busy = isBusy;
  els.form.setAttribute('aria-busy', String(isBusy));
  els.form.querySelectorAll('input, textarea, select, button').forEach(el => el.disabled = isBusy);
  els.copyAll.disabled = isBusy || !state.lastResult;
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
}

function readImage(file) {
  if (!file || state.busy) return;
  const version = ++state.imageVersion;
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
  const reader = new FileReader();
  reader.onload = () => {
    if (version !== state.imageVersion) return;
    state.imageDataUrl = String(reader.result || '');
    els.preview.src = state.imageDataUrl;
    els.previewWrap.classList.remove('hidden');
    els.uploadEmpty.classList.add('hidden');
    setMessage('');
  };
  reader.onerror = () => setMessage('Could not read that image.');
  reader.readAsDataURL(file);
}

els.image.addEventListener('change', () => readImage(els.image.files?.[0]));
els.removeImage.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  ++state.imageVersion;
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

els.description.addEventListener('input', () => { els.descriptionCount.textContent = String(els.description.value.length); });

async function refreshStatus() {
  try {
    const healthRes = await fetch('/api/health', { signal: AbortSignal.timeout(10000) });
    if (!healthRes.ok) throw new Error('Server unavailable');
    const health = await healthRes.json();
    $('accessPanel').classList.toggle('hidden', !health.requiresLogin);
    els.engine.textContent = health.engine === 'openai' ? 'Live AI' : health.engine === 'demo' ? 'Demo · sample output' : 'AI not connected';
    $('modeNotice').textContent = health.engine === 'demo' ? 'Demo mode: sample templates only. Your image is previewed, but not analyzed by AI. Demo credits are shared.' : health.engine === 'openai' ? 'Live AI is enabled. Review the generated claims before publishing.' : 'Live generation is not connected yet.';
    if (health.requiresLogin) { els.credits.textContent = 'Sign in'; return; }
    const creditsRes = await fetch('/api/credits', { signal: AbortSignal.timeout(10000) });
    if (!creditsRes.ok) throw new Error('Credits unavailable');
    const creditData = await creditsRes.json();
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
    const response = await fetch('/api/session', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({accessCode:$('accessCode').value}), signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('Access code not accepted.');
    $('accessCode').value = '';
    $('accessMessage').textContent = '';
    await refreshStatus();
  } catch(error) { $('accessMessage').textContent = error.message; }
});

function validateForm() {
  if (!els.productName.value.trim()) return 'Add the product name.';
  if (!els.description.value.trim()) return 'Add the product description.';
  if (!els.audience.value.trim()) return 'Add the target audience.';
  return '';
}

async function runGeneration(mode) {
  if (state.busy) return;
  const validation = validateForm();
  if (validation) return setMessage(validation);

  setMessage('');
  setBusy(true);
  try {
    const payload = {
      mode, productName: els.productName.value.trim(), description: els.description.value.trim(),
      language: els.language.value, audience: els.audience.value.trim(), imageDataUrl: state.imageDataUrl || null
    };
    const body = JSON.stringify(payload);
    if (!state.request || state.request.body !== body) state.request = { body, id: crypto.randomUUID() };
    const response = await fetch('/api/generate', {
      method: 'POST', signal: AbortSignal.timeout(55000),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': state.request.id }, body
    });
    const data = await response.json();
    if (data.retryWithNewId) state.request = null;
    if (!response.ok || !data.ok) throw new Error(data.error || 'Generation failed.');
    state.request = null;
    state.resultLanguage = payload.language;
    render(data.result);
    els.credits.textContent = `${data.credits.balance} credits`;
    setMessage(data.engine === 'demo' ? 'Sample template generated — not live AI. Review and adapt it before use.' : 'Creative pack generated.', 'success');
  } catch (error) {
    setMessage(error.name === 'TimeoutError' || error instanceof TypeError ? 'Connection interrupted. Retry the same brief to recover the result without a duplicate credit charge.' : error.message || 'Something went wrong.');
  } finally {
    setBusy(false);
  }
}

els.form.addEventListener('submit', event => { event.preventDefault(); runGeneration('ad'); });
document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => runGeneration(button.dataset.mode));
});

els.copyAll.addEventListener('click', async () => {
  if (!state.lastResult) return;
  const r = state.lastResult;
  const text = [
    `HOOK\n${r.hook}`,
    `REEL SCRIPT\n${r.reelScript}`,
    `SHOT LIST\n${(r.shotList || []).map((v, i) => `${i + 1}. ${v}`).join('\n')}`,
    `ON-SCREEN TEXT\n${(r.onScreenText || []).map((v) => `• ${v}`).join('\n')}`,
    `CAPTION\n${r.caption}`,
    `CTA\n${r.cta}`,
    `AD IDEAS\n${(r.adIdeas || []).map((v) => `• ${v}`).join('\n')}`
  ].join('\n\n');
  try {
    await navigator.clipboard.writeText(text);
    els.copyAll.textContent = 'Copied';
    setTimeout(() => { els.copyAll.textContent = 'Copy all'; }, 1400);
  } catch {
    setMessage('Copy failed. Select the text manually.');
  }
});

refreshStatus();
