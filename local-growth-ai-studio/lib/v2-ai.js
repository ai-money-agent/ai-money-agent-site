function schemaFor(value) {
  if (value === null) return { anyOf: [{ type: 'string' }, { type: 'null' }] };
  if (Array.isArray(value)) return { type: 'array', items: schemaFor(value[0] ?? '') };
  if (typeof value === 'object') {
    const properties = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, schemaFor(child)]));
    return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
  }
  if (typeof value === 'number') return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
  if (typeof value === 'boolean') return { type: 'boolean' };
  return { type: 'string' };
}

function validateShape(value, template, path = 'result') {
  if (template === null) {
    if (value !== null && typeof value !== 'string') throw new Error(`OpenAI returned invalid ${path}.`);
    return;
  }
  if (Array.isArray(template)) {
    if (!Array.isArray(value) || value.length > 100) throw new Error(`OpenAI returned invalid ${path}.`);
    if (template.length) for (const [index, item] of value.entries()) validateShape(item, template[0], `${path}[${index}]`);
    return;
  }
  if (template && typeof template === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`OpenAI returned invalid ${path}.`);
    for (const key of Object.keys(template)) validateShape(value[key], template[key], `${path}.${key}`);
    return;
  }
  if (typeof template === 'number' ? typeof value !== 'number' || !Number.isFinite(value) : typeof value !== typeof template) {
    throw new Error(`OpenAI returned invalid ${path}.`);
  }
  if (typeof value === 'string' && value.length > 20000) throw new Error(`OpenAI returned oversized ${path}.`);
}

function extractText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data?.output || []).flatMap(item => item?.content || [])
    .filter(part => typeof part?.text === 'string').map(part => part.text).join('\n').trim();
}

export async function generateV2({ operation, context, fallback, language = 'en' }, config) {
  const openAiReady = config?.liveEnabled === true && config?.provider === 'openai'
    && typeof config.openaiApiKey === 'string' && config.openaiApiKey.length > 0
    && typeof config.openaiModel === 'string' && config.openaiModel.length > 0;
  if (!openAiReady) return { value: fallback(), engine: 'local' };

  const template = fallback();
  const schema = { type: 'object', properties: { result: schemaFor(template) }, required: ['result'], additionalProperties: false };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: AbortSignal.timeout(45000),
    headers: { Authorization: `Bearer ${config.openaiApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.openaiModel,
      store: false,
      max_output_tokens: 4000,
      input: [
        { role: 'system', content: `You are the OpenAI business partner inside Local Growth AI Studio. Complete the requested ${operation} using the user's project context. Return useful, specific, concise ${language === 'ar' ? 'Arabic' : 'English'} content. The supplied template defines the exact output structure; improve its content rather than copying it. Never claim you searched the live web or know current demand, competitor prices, or trends. Never invent market statistics, earnings guarantees, testimonials, scarcity, or facts not supplied by the user.` },
        { role: 'user', content: JSON.stringify({ operation, context, requiredOutputShape: template }) }
      ],
      text: { format: { type: 'json_schema', name: 'local_growth_v2_result', strict: true, schema } }
    })
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`OpenAI returned invalid JSON (HTTP ${response.status}).`); }
  if (!response.ok) {
    const code = typeof data?.error?.code === 'string' ? data.error.code : 'unknown';
    throw new Error(`OpenAI request failed (HTTP ${response.status}; code=${code}).`);
  }
  const raw = extractText(data);
  if (!raw) throw new Error('OpenAI returned an empty V2 response.');
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('OpenAI returned malformed V2 structured output.'); }
  validateShape(parsed?.result, template);
  return { value: parsed.result, engine: 'openai' };
}
