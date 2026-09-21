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

export function videoCapability() {
  return {
    status: 'provider_not_connected',
    providerConnected: false,
    supportedAspectRatios: VIDEO_ASPECT_RATIOS,
    supportedDurations: VIDEO_DURATIONS,
    creditCost: null
  };
}
