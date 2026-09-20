export const outputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    hook: { type: 'string' },
    reelScript: { type: 'string' },
    shotList: { type: 'array', items: { type: 'string' } },
    onScreenText: { type: 'array', items: { type: 'string' } },
    caption: { type: 'string' },
    cta: { type: 'string' },
    adIdeas: { type: 'array', items: { type: 'string' } }
  },
  required: ['hook', 'reelScript', 'shotList', 'onScreenText', 'caption', 'cta', 'adIdeas']
};

function languageInstruction(language) {
  if (language === 'ar') return 'Write in natural modern Arabic suitable for social media. Avoid Gulf-only dialect unless product context requires it.';
  if (language === 'bilingual') return 'Write each text element in Arabic first, then concise English. Keep both natural, not literal translations.';
  return 'Write in clear persuasive English suitable for social media.';
}

function buildPrompt(input) {
  return `You are the creative engine for Local Growth AI Studio. Create conversion-focused social media material for a real product without inventing guarantees, fake scarcity, fake testimonials, or unsupported earnings claims.\n\nMode: ${input.mode}. ${input.mode === 'ad' ? 'Lead with a direct-response ad caption and a benefit-led offer angle.' : 'Lead with a timed 20-35 second Reel script, matching each shot to the narration.'}\nProduct: ${input.productName}\nDescription: ${input.description}\nTarget audience: ${input.audience}\n${languageInstruction(input.language)}\n\nReturn a strong hook, a short vertical Reel script, 5-7 practical shot-list items, 4-6 short on-screen text lines, a caption, one CTA, and 4 distinct ad angles. Keep the Reel around 20-35 seconds. If an image is provided, use visible product details only when clear.`;
}

function extractResponseText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

async function generateWithOpenAI(input, config) {
  const content = [{ type: 'input_text', text: buildPrompt(input) }];
  if (input.imageDataUrl) content.push({ type: 'input_image', image_url: input.imageDataUrl });

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      store: false,
      max_output_tokens: 3000,
      input: [{ role: 'user', content }],
      text: {
        format: {
          type: 'json_schema',
          name: 'local_growth_creative',
          strict: true,
          schema: outputSchema
        }
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error('AI provider could not complete the request. Please try again later.');
  }

  const raw = extractResponseText(data);
  if (!raw) throw new Error('AI returned an empty response.');
  try {
    return validateOutput(JSON.parse(raw));
  } catch {
    throw new Error('AI response could not be parsed as structured content.');
  }
}

function mockGenerate(input) {
  const ar = input.language !== 'en';
  const bilingual = input.language === 'bilingual';
  const p = input.productName;
  const audience = input.audience;

  const arabic = {
    hook: `ليش ${audience} عم يوقفوا عند ${p}؟ لأن أول ثانيتين لازم يوضحوا القيمة فورًا.`,
    reelScript: `${input.mode === 'reel' ? '[0–3 ثوانٍ] لقطة المنتج. [3–15 ثانية] عرض الفائدة. [15–25 ثانية] توضيح الاستخدام. [25–30 ثانية] دعوة للتواصل. ' : 'فكرة إعلان: منتج واضح، فائدة واضحة، وخطوة تالية. '}ابدأ بلقطة قريبة للمنتج. اطرح المشكلة بسرعة، ثم أظهر كيف ${p} يساعد بطريقة واضحة وعملية. اعرض أهم فائدة من الوصف، ثم اختم بدعوة مباشرة للتواصل أو الطلب.`,
    shotList: [
      `لقطة Hero واضحة لـ ${p}`,
      'لقطة تفصيلية لأهم ميزة',
      'لقطة استخدام واقعية أو قبل/أثناء الاستخدام',
      'لقطة توضح الفائدة الأساسية بنص كبير',
      'لقطة أخيرة للمنتج مع CTA'
    ],
    onScreenText: ['شدّ الانتباه من أول ثانية', `هذا هو ${p}`, 'فائدة واضحة. بدون تعقيد.', 'شوف التفاصيل', 'اطلب الآن'],
    caption: `${p} مصمم ليعطي ${audience} طريقة أوضح للوصول للفائدة الأساسية بدون حشو. شاهد الريل وخذ القرار بناءً على ما يناسبك.`,
    cta: 'أرسل كلمة «تفاصيل» الآن لمعرفة السعر وطريقة الطلب.',
    adIdeas: ['مشكلة → حل', 'عرض المنتج عن قرب', '3 فوائد سريعة', 'سيناريو استخدام واقعي']
  };

  const english = {
    hook: `Why would ${audience} stop scrolling for ${p}? Make the value clear in the first two seconds.`,
    reelScript: `${input.mode === 'reel' ? '[0–3s] Product hook. [3–15s] Main benefit. [15–25s] Use case. [25–30s] CTA. ' : 'Ad concept: one product, one benefit, one next step. '}Open with a tight product shot. Name the problem quickly, then show how ${p} helps in a simple, concrete way. Highlight the strongest benefit from the description and finish with a direct next step.`,
    shotList: [
      `Clean hero shot of ${p}`,
      'Close-up of the main feature',
      'Realistic use-case shot',
      'Benefit overlay with product in frame',
      'Final product shot with CTA'
    ],
    onScreenText: ['Stop the scroll', `Meet ${p}`, 'Clear benefit. No clutter.', 'See the details', 'Order now'],
    caption: `${p} gives ${audience} a clearer way to get the core benefit described above. Watch the Reel, check the details, and decide if it fits your needs.`,
    cta: 'Send “DETAILS” now for price and ordering information.',
    adIdeas: ['Problem → solution', 'Product close-up', '3 quick benefits', 'Real-world use case']
  };

  if (!bilingual) return ar ? arabic : english;
  const mergeText = (a, e) => `${a}\n\n${e}`;
  return {
    hook: mergeText(arabic.hook, english.hook),
    reelScript: mergeText(arabic.reelScript, english.reelScript),
    shotList: arabic.shotList.map((v, i) => `${v} — ${english.shotList[i]}`),
    onScreenText: arabic.onScreenText.map((v, i) => `${v} — ${english.onScreenText[i]}`),
    caption: mergeText(arabic.caption, english.caption),
    cta: mergeText(arabic.cta, english.cta),
    adIdeas: arabic.adIdeas.map((v, i) => `${v} — ${english.adIdeas[i]}`)
  };
}

export function validateOutput(result) {
  if (!result || typeof result !== 'object') throw new Error('Invalid AI output.');
  for (const key of ['hook', 'reelScript', 'caption', 'cta']) {
    if (typeof result[key] !== 'string' || !result[key].trim() || result[key].length > 12000) throw new Error('Incomplete AI output.');
  }
  for (const key of ['shotList', 'onScreenText', 'adIdeas']) {
    if (!Array.isArray(result[key]) || !result[key].length || result[key].length > 20 || result[key].some(v => typeof v !== 'string' || !v.trim() || v.length > 4000)) throw new Error('Incomplete AI output.');
  }
  return result;
}

export async function generate(input, config) {
  if (config.liveEnabled) return { result: await generateWithOpenAI(input, config), engine: 'openai' };
  if (!config.allowDemo) throw new Error('Live AI is not enabled yet.');
  return { result: validateOutput(mockGenerate(input)), engine: 'demo' };
}
