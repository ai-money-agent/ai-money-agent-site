export const VIDEO_ASPECT_RATIOS = Object.freeze(['9:16', '1:1', '16:9']);
export const VIDEO_DURATIONS = Object.freeze([10, 15, 20, 30]);

function requiredText(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw Object.assign(new Error(`${label} is required and must be under ${max} characters.`), { status: 422 });
  }
  return value.trim();
}

export function prepareVideoRequest(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    throw Object.assign(new Error('Video request must be a JSON object.'), { status: 400 });
  }
  const script = requiredText(body.script, 12000, 'Script');
  const aspectRatio = body.aspectRatio || '9:16';
  if (!VIDEO_ASPECT_RATIOS.includes(aspectRatio)) {
    throw Object.assign(new Error('Choose a supported video aspect ratio.'), { status: 422 });
  }
  const durationSeconds = Number(body.durationSeconds ?? 20);
  if (!Number.isInteger(durationSeconds) || !VIDEO_DURATIONS.includes(durationSeconds)) {
    throw Object.assign(new Error('Choose a supported video duration.'), { status: 422 });
  }
  return { script, aspectRatio, durationSeconds };
}

export function videoCapability(config = {}) {
  const providerConnected = config.enabled === true && typeof config.apiKey === 'string' && config.apiKey.length > 0;
  return {
    status: providerConnected ? 'ready' : 'provider_not_connected',
    providerConnected,
    provider: 'HeyGen Video 1',
    supportedAspectRatios: VIDEO_ASPECT_RATIOS,
    supportedDurations: VIDEO_DURATIONS,
    creditCost: null
  };
}

export function validateHeyGenVideoRequest(body) {
  const prompt = requiredText(body?.prompt, 16000, 'Video prompt');
  const durationSeconds = Number(body.durationSeconds ?? 10);
  if (durationSeconds !== 10) throw Object.assign(new Error('V2 video generation is capped at 10 seconds.'), { status: 422 });
  const aspectRatio = body.aspectRatio || '9:16';
  if (!['9:16','16:9','1:1'].includes(aspectRatio)) throw Object.assign(new Error('Choose 9:16, 16:9 or 1:1 video.'), { status: 422 });
  return { prompt, durationSeconds, aspectRatio, resolution: '480p' };
}

async function heyGenJson(url, init, fetchImpl) {
  const response = await fetchImpl(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(45000) });
  let body;
  try { body = await response.json(); } catch { throw Object.assign(new Error('HeyGen returned invalid JSON.'), { status: 502 }); }
  if (!response.ok) {
    const code = typeof body?.error?.code === 'string' ? body.error.code : 'provider_error';
    const message = typeof body?.error?.message === 'string' ? body.error.message : `HeyGen request failed (HTTP ${response.status}).`;
    throw Object.assign(new Error(message.slice(0,500)), { status: response.status === 401 ? 502 : response.status, providerCode: code });
  }
  return body?.data || {};
}

export async function createHeyGenVideo({ prompt, durationSeconds = 10, aspectRatio = '9:16', apiKey, idempotencyKey, fetchImpl = fetch }) {
  if (typeof apiKey !== 'string' || !apiKey) throw Object.assign(new Error('HeyGen API is not configured.'), { status: 503 });
  const spec = validateHeyGenVideoRequest({ prompt, durationSeconds, aspectRatio });
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_\\-:.]{1,255}$/.test(idempotencyKey)) throw Object.assign(new Error('A valid idempotency key is required.'), { status: 400 });
  const data = await heyGenJson('https://api.heygen.com/v3/models/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ mode: 'text_to_video', model: 'heygen-video-1', prompt: spec.prompt, prompt_enhancement: 'turbo', resolution: spec.resolution, duration: spec.durationSeconds, aspect_ratio: spec.aspectRatio })
  },fetchImpl);
  if (typeof data.video_id !== 'string' || !data.video_id) throw Object.assign(new Error('HeyGen did not return a video ID.'), { status: 502 });
  return { videoId:data.video_id, status:typeof data.status==='string'?data.status:'pending', durationSeconds:spec.durationSeconds, aspectRatio:spec.aspectRatio, resolution:spec.resolution };
}

export async function getHeyGenVideo({ videoId, apiKey, fetchImpl = fetch }) {
  if (typeof apiKey !== 'string' || !apiKey) throw Object.assign(new Error('HeyGen API is not configured.'), { status: 503 });
  if (typeof videoId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(videoId)) throw Object.assign(new Error('Invalid HeyGen video ID.'), { status: 400 });
  const data = await heyGenJson(`https://api.heygen.com/v3/models/videos/${encodeURIComponent(videoId)}`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey }
  },fetchImpl);
  return {
    videoId:data.video_id||videoId,
    status:typeof data.status==='string'?data.status:'pending',
    videoUrl:typeof data.video_url==='string'&&data.video_url.startsWith('https://')?data.video_url:null,
    durationSeconds:Number.isFinite(data.duration)?data.duration:null,
    failureCode:typeof data.failure_code==='string'?data.failure_code:null,
    failureMessage:typeof data.failure_message==='string'?data.failure_message.slice(0,500):null
  };
}
