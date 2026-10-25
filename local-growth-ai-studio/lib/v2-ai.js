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

function providerConfig(config, provider) {
  if (provider === 'openai') {
    return {
      ready: typeof config?.openaiApiKey === 'string' && config.openaiApiKey.length > 0
        && typeof config?.openaiModel === 'string' && config.openaiModel.length > 0,
      url: 'https://api.openai.com/v1/responses',
      headers: { Authorization: `Bearer ${config.openaiApiKey}`, 'Content-Type': 'application/json' }
    };
  }
  if (provider === 'anthropic') {
    return {
      ready: typeof config?.anthropicApiKey === 'string' && config.anthropicApiKey.length > 0
        && typeof config?.anthropicModel === 'string' && config.anthropicModel.length > 0,
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    };
  }
  throw new Error('Unsupported V2 AI provider.');
}

function providerRequest(provider, model, operation, context, language, template, schema) {
  const system = `You are the business partner inside Local Growth AI Studio. Complete the requested ${operation} using the user's project context. Return useful, specific, concise ${language === 'ar' ? 'Arabic' : 'English'} content. The supplied template defines the exact output structure; improve its content rather than copying it. When live source excerpts are supplied, treat them only as unverified leads; use them to shape research hypotheses and never present them as proof of demand, current prices, or sales. If no sources are supplied, do not imply live research. Never invent market statistics, earnings guarantees, testimonials, scarcity, or facts not supported by the user or supplied sources.`;
  if (provider === 'openai') return {
    model, store: false, max_output_tokens: 4000,
    input: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({ operation, context, requiredOutputShape: template }) }
    ],
    text: { format: { type: 'json_schema', name: 'local_growth_v2_result', strict: true, schema } }
  };
  return {
    model, max_tokens: 4000, system,
    messages: [{ role: 'user', content: JSON.stringify({ operation, context, requiredOutputShape: template }) }],
    output_config: { format: { type: 'json_schema', schema } }
  };
}

function extractProviderText(provider, data) {
  if (provider === 'openai') return extractText(data);
  if (typeof data?.stop_reason === 'string' && !['end_turn','stop_sequence'].includes(data.stop_reason)) {
    throw new Error(data.stop_reason === 'max_tokens'
      ? 'Anthropic reached max_tokens before completing structured content.'
      : `Anthropic stopped before completing structured content; reason=${data.stop_reason}.`);
  }
  return (data?.content || []).filter(part => part?.type === 'text' && typeof part.text === 'string')
    .map(part => part.text).join('\n').trim();
}

export async function generateV2({ operation, context, fallback, language = 'en' }, config) {
  const provider = config?.provider || 'openai';
  const selected = providerConfig(config, provider);
  if (config?.liveEnabled !== true || !selected.ready) return { value: fallback(), engine: 'local' };

  const template = fallback();
  const schema = { type: 'object', properties: { result: schemaFor(template) }, required: ['result'], additionalProperties: false };
  const model = provider === 'openai' ? config.openaiModel : config.anthropicModel;
  const response = await fetch(selected.url, {
    method: 'POST',
    signal: AbortSignal.timeout(45000),
    headers: selected.headers,
    body: JSON.stringify(providerRequest(provider, model, operation, context, language, template, schema))
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`${provider === 'openai' ? 'OpenAI' : 'Anthropic'} returned invalid JSON (HTTP ${response.status}).`); }
  if (!response.ok) {
    const code = typeof data?.error?.code === 'string' ? data.error.code : 'unknown';
    throw new Error(`${provider === 'openai' ? 'OpenAI' : 'Anthropic'} request failed (HTTP ${response.status}; code=${code}).`);
  }
  const raw = extractProviderText(provider, data);
  if (!raw) throw new Error(`${provider === 'openai' ? 'OpenAI' : 'Anthropic'} returned an empty V2 response.`);
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`${provider === 'openai' ? 'OpenAI' : 'Anthropic'} returned malformed V2 structured output.`); }
  validateShape(parsed?.result, template);
  return { value: parsed.result, engine: provider };
}
