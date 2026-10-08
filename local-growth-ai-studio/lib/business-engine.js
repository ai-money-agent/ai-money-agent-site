const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));
const lower = (value) => String(value || '').toLowerCase();
const containsArabic = (value) => /[\u0600-\u06ff]/.test(String(value || ''));
const isArabic = (language, sample = '') => language === 'ar' || (language !== 'en' && containsArabic(sample));

function budgetScore(value) {
  const text = lower(value);
  const number = Number((text.match(/[0-9]+(?:\.[0-9]+)?/) || [0])[0]);
  if (/zero|none|free|بدون|صفر/.test(text)) return 85;
  if (!number) return 70;
  if (number <= 50) return 78;
  if (number <= 250) return 72;
  return 65;
}
function timeScore(value) {
  const text = lower(value);
  const number = Number((text.match(/[0-9]+/) || [0])[0]);
  if (!number) return 70;
  return clamp(55 + Math.min(number, 20) * 2);
}
function baseFit(profile, type) {
  const chosen = lower(profile.businessType);
  if (!chosen || chosen === 'unsure') return 76;
  if (chosen.includes(type)) return 90;
  if (type === 'digital' && /product|منتج رقمي/.test(chosen)) return 90;
  if (type === 'service' && /service|خدمة/.test(chosen)) return 90;
  if (type === 'ecommerce' && /commerce|تجارة|متجر/.test(chosen)) return 90;
  return 62;
}
function ideaScore(profile, type, speed = 70, margin = 80) {
  return clamp(baseFit(profile,type) * .35 + budgetScore(profile.budget) * .2 + timeScore(profile.timeAvailable) * .15 + speed * .15 + margin * .15);
}
function skillLabel(profile) {
  const raw = String(profile.skills || '').trim();
  return raw ? raw.split(/[,،]/)[0].trim().slice(0,60) : 'a practical niche';
}
function marketLabel(profile) {
  const scope = lower(profile.marketScope);
  const country = String(profile.country || '').trim();
  if (/local|محلي/.test(scope)) return country || 'your local market';
  if (/global|عالمي/.test(scope)) return 'a global niche';
  return country ? `${country} first, then a broader market` : 'a focused niche';
}

export function findProductIdeas(profile = {}, language = 'en') {
  const ar = isArabic(language, profile.skills);
  const skill = skillLabel(profile);
  const market = marketLabel(profile);
  const ideas = [
    {
      type:'service',
      name: ar ? `خدمة تنفيذ سريعة مبنية على مهارتك: ${skill}` : `Done-for-you service around ${skill}`,
      promise: ar ? 'حل مشكلة محددة للعميل مقابل سعر واضح وتسليم سريع.' : 'Solve one specific customer problem for a clear fixed price and short delivery window.',
      targetCustomer: ar ? `أفراد أو شركات صغيرة في ${market}` : `Individuals or small businesses in ${market}`,
      setupCost: ar ? 'منخفض جدًا' : 'Very low',
      speed:88,
      margin:92,
      competition:'medium',
      demandSignal: ar ? 'الخدمات أسهل للاختبار لأنها لا تحتاج مخزونًا أو بناء منتج كامل قبل أول بيع.' : 'Services can be validated before building inventory or a large product.',
      differentiation: ar ? 'تخصص ضيق + نتيجة محددة + مدة تسليم قصيرة.' : 'Narrow niche + concrete outcome + short delivery time.'
    },
    {
      type:'digital',
      name: ar ? `حزمة رقمية عملية لقطاع مرتبط بـ ${skill}` : `Practical digital toolkit for a niche related to ${skill}`,
      promise: ar ? 'قوالب وملفات جاهزة تختصر على العميل وقتًا أو جهدًا متكررًا.' : 'Templates and ready-to-use assets that save the buyer recurring time or effort.',
      targetCustomer: ar ? `مستخدمون لديهم مشكلة متكررة في ${market}` : `People with a repeatable problem in ${market}`,
      setupCost: ar ? 'منخفض' : 'Low',
      speed:78,
      margin:95,
      competition:'medium-high',
      demandSignal: ar ? 'مناسب عندما يمكن تحويل المعرفة أو العمل المتكرر إلى ملف قابل لإعادة البيع.' : 'Strong when repeatable know-how can be packaged once and sold repeatedly.',
      differentiation: ar ? 'نتيجة واضحة، أمثلة جاهزة، وتجربة استخدام بسيطة على الهاتف.' : 'Clear outcome, ready examples, and a mobile-friendly experience.'
    },
    {
      type:'digital',
      name: ar ? 'دليل قرار قصير + Checklist + أدوات جاهزة' : 'Decision guide + checklist + ready tools',
      promise: ar ? 'يساعد العميل على اتخاذ قرار أو تنفيذ مهمة من البداية للنهاية بدون تعقيد.' : 'Help the buyer make one decision or complete one task from start to finish.',
      targetCustomer: ar ? `مبتدئون في ${market}` : `Beginners in ${market}`,
      setupCost: ar ? 'منخفض جدًا' : 'Very low',
      speed:84,
      margin:94,
      competition:'medium',
      demandSignal: ar ? 'قابل للاختبار بسرعة كمنتج مجاني لجمع الجمهور أو كمنتج منخفض السعر.' : 'Easy to validate as a lead magnet or low-ticket product.',
      differentiation: ar ? 'قصر المنتج ووضوح الخطوات بدل كتاب طويل عام.' : 'Short, specific and action-oriented instead of broad information.'
    },
    {
      type:'ecommerce',
      name: ar ? 'اختبار منتج واحد يحل مشكلة يومية واضحة' : 'Single-product problem-solving ecommerce test',
      promise: ar ? 'اختبار منتج واحد قبل بناء متجر كبير أو شراء مخزون كبير.' : 'Validate one useful product before building a large catalog or buying deep inventory.',
      targetCustomer: ar ? `مستهلكون في ${market}` : `Consumers in ${market}`,
      setupCost: ar ? 'متوسط' : 'Medium',
      speed:62,
      margin:68,
      competition:'high',
      demandSignal: ar ? 'يحتاج تحقق أقوى من السعر والشحن والهامش قبل التنفيذ.' : 'Requires stronger validation of price, shipping and margin before execution.',
      differentiation: ar ? 'منتج واضح + زاوية استخدام محلية + عرض بسيط.' : 'One clear product + localized use case + simple offer.'
    }
  ];
  return ideas.map((idea,index) => ({
    id:`idea-${index+1}`,
    ...idea,
    score:ideaScore(profile,idea.type,idea.speed,idea.margin),
    market,
    note: ar ? 'هذا التقييم أولي مبني على قابلية التنفيذ، وليس بيانات سوق حيّة.' : 'This is an execution-fit score, not live market-demand data.'
  })).sort((a,b)=>b.score-a.score);
}

export function analyzeIdea(profile = {}, idea = {}, language = 'en') {
  const ar = isArabic(language, idea.name || profile.skills);
  const score = Number(idea.score) || ideaScore(profile,idea.type || 'digital',75,80);
  const competitionScore = idea.competition === 'high' ? 78 : idea.competition === 'medium-high' ? 68 : 55;
  const demandScore = clamp(score * .75 + (idea.type === 'service' ? 12 : 7));
  const fitScore = clamp(score);
  const economicsScore = clamp((idea.margin || 80) * .7 + budgetScore(profile.budget) * .3);
  const overall = clamp(demandScore*.28 + (100-competitionScore)*.18 + fitScore*.32 + economicsScore*.22);
  const verdict = overall >= 80 ? 'strong' : overall >= 68 ? 'promising' : overall >= 55 ? 'test-first' : 'weak';
  return {
    ideaName: idea.name || (ar ? 'فكرة المنتج' : 'Product idea'),
    scores:{ overall, demand:demandScore, competition:competitionScore, founderFit:fitScore, economics:economicsScore },
    verdict,
    verdictText: ar
      ? verdict === 'strong' ? 'فكرة قوية للتجربة السريعة.' : verdict === 'promising' ? 'واعدة، لكن يجب اختبار الطلب قبل التوسع.' : verdict === 'test-first' ? 'اختبرها بعرض بسيط قبل أن تبني المنتج كاملًا.' : 'لا أنصح باستثمار وقت أو مال كبير قبل إعادة صياغتها.'
      : verdict === 'strong' ? 'Strong candidate for a fast validation test.' : verdict === 'promising' ? 'Promising, but validate demand before scaling.' : verdict === 'test-first' ? 'Test the offer before building the full product.' : 'Avoid major time or spend until the idea is reframed.',
    targetCustomer: idea.targetCustomer || (ar ? 'عميل لديه مشكلة واضحة ومتكررة.' : 'A customer with a clear recurring problem.'),
    customerProblems: ar
      ? ['يضيع وقتًا في حل المشكلة يدويًا.','لا يعرف أي خيار يختار.','الحلول الحالية عامة أو معقدة.','يريد نتيجة أسرع بسعر مفهوم.']
      : ['Loses time solving the problem manually.','Does not know which option to choose.','Existing solutions feel generic or complex.','Wants a faster result at a clear price.'],
    competitorTypes: ar
      ? ['مزودون مستقلون يقدمون الخدمة نفسها.','قوالب أو أدوات رخيصة على منصات رقمية.','حلول مجانية مبعثرة على السوشيال ميديا.']
      : ['Freelancers offering a similar outcome.','Low-cost templates or tools on digital marketplaces.','Free fragmented advice on social media.'],
    priceGuidance: idea.type === 'service'
      ? { low:25, target:75, premium:150, currency:'USD' }
      : idea.type === 'ecommerce'
        ? { low:15, target:29, premium:49, currency:'USD' }
        : { low:5, target:15, premium:29, currency:'USD' },
    sellingAngles: ar
      ? ['مشكلة → حل مباشر','توفير وقت','خطوات جاهزة بدل البدء من الصفر','عرض واضح للمبتدئ']
      : ['Problem → direct solution','Save time','Ready-to-use instead of starting from zero','Beginner-friendly clarity'],
    differentiationOpportunities: ar
      ? ['تخصص في جمهور واحد بدل الجميع.','اجعل النتيجة قابلة للقياس.','أضف مثالًا جاهزًا أو Template.','قلّل عدد الخطوات المطلوبة من العميل.']
      : ['Serve one audience instead of everyone.','Make the outcome measurable.','Include a ready example or template.','Reduce the steps the customer must perform.'],
    validationPlan: ar
      ? ['اكتب عرضًا من سطر واحد.','أنشئ صفحة/منشور بسيط بدون إنفاق كبير.','اعرضه على 10–20 شخصًا من الجمهور الحقيقي.','سجّل الاعتراضات والأسئلة.','لا تبنِ النسخة الكبيرة قبل وجود إشارة طلب واضحة.']
      : ['Write a one-line offer.','Create a simple page/post without major spend.','Show it to 10–20 real target customers.','Record objections and questions.','Do not build the large version before seeing a demand signal.'],
    dataStatus: ar ? 'تحليل داخلي بدون بحث ويب حي.' : 'Internal planning analysis; no live web-market data.'
  };
}

export function buildProductBlueprint({ profile = {}, research = null, idea = {}, answers = {}, language = 'en' } = {}) {
  const ar = isArabic(language, answers.name || idea.name || profile.skills);
  const sourceName = String(answers.name || idea.name || research?.ideaName || (ar ? 'منتج عملي' : 'Practical Product')).trim();
  const type = idea.type || answers.type || 'digital';
  const audience = answers.audience || research?.targetCustomer || idea.targetCustomer || (ar ? 'جمهور محدد لديه مشكلة واضحة' : 'A focused audience with a clear problem');
  const coreOutcome = answers.outcome || idea.promise || (ar ? 'الوصول إلى نتيجة محددة بخطوات أبسط وأسرع.' : 'Reach one specific outcome with fewer, clearer steps.');
  const price = Number(answers.price) || Number(research?.priceGuidance?.target) || (type === 'service' ? 75 : type === 'ecommerce' ? 29 : 15);
  const delivery = answers.delivery || (type === 'service' ? (ar ? 'تسليم خلال 2–4 أيام عبر رابط/ملف/جلسة حسب الخدمة.' : '2–4 day delivery via link, file or session depending on the service.') : (ar ? 'تحميل أو وصول رقمي فوري بعد الطلب.' : 'Instant digital delivery after purchase.'));
  return {
    name:sourceName.slice(0,160),
    type,
    audience,
    description: ar ? `${sourceName} يساعد ${audience} على ${coreOutcome}` : `${sourceName} helps ${audience} to ${coreOutcome}`,
    problem: answers.problem || (ar ? 'العميل يواجه مشكلة متكررة ويحتاج طريقًا أوضح للتنفيذ.' : 'The customer faces a recurring problem and needs a clearer execution path.'),
    outcome:coreOutcome,
    usp: answers.usp || (ar ? 'نتيجة واحدة واضحة، خطوات قليلة، ومادة قابلة للاستخدام مباشرة.' : 'One clear result, fewer steps and ready-to-use execution assets.'),
    price,
    currency:answers.currency || 'USD',
    offer: answers.offer || (ar ? `${sourceName} + مثال جاهز + Checklist تنفيذ بسعر ${price} USD.` : `${sourceName} + ready example + execution checklist for ${price} USD.`),
    bonus: answers.bonus || (ar ? 'Bonus: نموذج/Template جاهز للتطبيق.' : 'Bonus: ready-to-use template.'),
    refundPolicy: answers.refundPolicy || (type === 'service'
      ? (ar ? 'تُحدد حسب مرحلة بدء التنفيذ ونطاق العمل.' : 'Defined by scope and whether delivery work has started.')
      : (ar ? 'سياسة واضحة للمنتجات الرقمية؛ راجع قوانين المنصة والبلد قبل النشر.' : 'Clear digital-product policy; verify platform and local legal requirements before publishing.')),
    delivery,
    firstVersion: ar
      ? ['المحتوى الأساسي فقط','مثال واحد جاهز','صفحة بيع قصيرة','طريقة تسليم واضحة']
      : ['Core content only','One ready example','Short sales page','Clear delivery method'],
    launchChecklist: ar
      ? ['تأكيد المنتج والسعر','تجهيز طريقة الدفع/الاستلام','إنشاء 4 زوايا إعلان','إنشاء Reel واحد','إطلاق اختبار صغير بعد موافقة المستخدم']
      : ['Confirm product and price','Prepare payment/delivery route','Create 4 ad angles','Create one Reel','Run a small test only after user approval']
  };
}

export function buildBrandProfile(product = {}, project = {}, language = 'en') {
  const ar = isArabic(language, product.name || project.name);
  const base = String(product.name || project.name || 'Local Growth Brand').trim();
  const short = base.split(/\s+/).slice(0,3).join(' ');
  return {
    name: short,
    tagline: ar ? 'أبسط طريق من المشكلة إلى النتيجة.' : 'A simpler path from problem to result.',
    colors:['#111827','#F8FAFC','#22C55E'],
    voice: ar ? ['واضح','عملي','غير متكلف','صادق بدون مبالغة'] : ['Clear','Practical','Direct','Credible without hype'],
    tone: ar ? 'شريك عملي يشرح ببساطة ويقترح الخطوة التالية.' : 'A practical partner that explains simply and always gives the next step.',
    description: ar ? `${short} علامة تركّز على حلول عملية ومباشرة لجمهور محدد، مع وضوح في العرض والسعر وطريقة التنفيذ.` : `${short} focuses on practical, direct solutions for a defined audience with clear offers, pricing and execution.`,
    buyerPersona:{
      who:product.audience || (ar ? 'مبتدئ أو صاحب عمل يريد نتيجة واضحة.' : 'A beginner or operator who wants a clear result.'),
      pain:product.problem || (ar ? 'التشتت وكثرة الخيارات.' : 'Too many options and unclear next steps.'),
      desire:product.outcome || (ar ? 'حل واضح يمكن تطبيقه بسرعة.' : 'A clear solution that can be executed quickly.'),
      objections: ar ? ['هل يستحق السعر؟','هل يناسب وضعي؟','هل أستطيع تطبيقه بسهولة؟'] : ['Is it worth the price?','Will it fit my situation?','Can I use it easily?']
    }
  };
}

function adText(product, angle, ar) {
  const name = product.name || (ar ? 'المنتج' : 'the product');
  const problem = product.problem || (ar ? 'المشكلة التي تتعب عميلك' : 'the problem your customer keeps facing');
  const outcome = product.outcome || product.usp || (ar ? 'نتيجة أوضح بخطوات أقل' : 'a clearer outcome with fewer steps');
  const price = product.price ? `${product.price} ${product.currency || 'USD'}` : (ar ? 'سعر واضح' : 'a clear price');
  if (angle === 'problem') return ar
    ? { primary:`إذا ${problem}، لا تحتاج حلًا أعقد. ${name} صُمم ليعطيك ${outcome}. العرض: ${price}.`, headline:`حل أوضح مع ${name}` }
    : { primary:`If ${problem}, you do not need a more complicated solution. ${name} is built to deliver ${outcome}. Offer: ${price}.`, headline:`A clearer solution with ${name}` };
  if (angle === 'curiosity') return ar
    ? { primary:`معظم الناس يبدأون من المكان الخطأ. ${name} يختصر الخطوات ويبدأ من النتيجة التي تهمك فعلًا: ${outcome}.`, headline:'ما الخطوة التي يمكنك حذفها؟' }
    : { primary:`Most people start in the wrong place. ${name} removes unnecessary steps and focuses on the outcome that matters: ${outcome}.`, headline:'Which step can you remove?' };
  if (angle === 'proof') return ar
    ? { primary:`بدل وعود كبيرة، ركّز على ما تحصل عليه فعلًا: ${outcome}. ${name} مبني ليكون واضحًا وقابلًا للتطبيق.`, headline:'النتيجة قبل الكلام' }
    : { primary:`Skip oversized promises. Focus on what you actually get: ${outcome}. ${name} is designed to be clear and usable.`, headline:'Outcome before hype' };
  return ar
    ? { primary:`${name}: ${outcome}. ${product.offer || `متاح الآن مقابل ${price}`}`, headline:`${name} — العرض المباشر` }
    : { primary:`${name}: ${outcome}. ${product.offer || `Available now for ${price}`}`, headline:`${name} — direct offer` };
}

export function createAdPack(product = {}, language = 'en') {
  const ar = isArabic(language, product.name || product.audience);
  const defs = [
    ['problem',ar ? 'مشكلة → حل' : 'Problem → Solution',ar ? 'يلتقط ألمًا واضحًا ثم ينتقل مباشرة للحل.' : 'Captures a clear pain point and moves straight to the solution.'],
    ['curiosity',ar ? 'فضول' : 'Curiosity',ar ? 'يفتح فجوة معلومات بدون ادعاءات مبالغ فيها.' : 'Creates an information gap without hype.'],
    ['proof',ar ? 'إثبات/نتيجة' : 'Proof / Outcome',ar ? 'يركز على النتيجة القابلة للفهم بدل الوعود.' : 'Focuses on a concrete understandable outcome.'],
    ['direct',ar ? 'عرض مباشر' : 'Direct Offer',ar ? 'مناسب لجمهور يعرف المشكلة ومستعد لاتخاذ خطوة.' : 'Best for an audience that already understands the problem.']
  ];
  return {
    variants:defs.map(([key,label,why]) => {
      const copy = adText(product,key,ar);
      return {
        key,label,why,
        primaryText:copy.primary,
        headline:copy.headline,
        description:product.usp || (ar ? 'عرض واضح، خطوة تالية واضحة.' : 'Clear offer. Clear next step.'),
        cta: ar ? 'اعرف التفاصيل' : 'Learn More',
        visualConcept: ar ? `صورة بسيطة لـ ${product.name || 'المنتج'} مع عنوان واحد كبير وفائدة واحدة.` : `Simple image of ${product.name || 'the product'} with one bold headline and one benefit.`,
        videoConcept: ar ? 'Hook أول ثانيتين → المشكلة → النتيجة → المنتج → CTA.' : '2-second hook → problem → outcome → product → CTA.'
      };
    })
  };
}

export function createReelPack(product = {}, language = 'en') {
  const ar = isArabic(language, product.name || product.audience);
  const name = product.name || (ar ? 'المنتج' : 'Product');
  const outcome = product.outcome || product.usp || (ar ? 'نتيجة أوضح' : 'a clearer outcome');
  return {
    hook: ar ? `إذا كنت تحاول الوصول إلى ${outcome}، شاهد هذه الـ20 ثانية.` : `If you are trying to get ${outcome}, watch these 20 seconds.`,
    voiceover: ar
      ? `إذا كانت الخطوات الحالية معقدة، ${name} يجمع لك الطريق في عرض واحد واضح. ابدأ بالمشكلة، استخدم الأداة أو الخطوات الجاهزة، ثم انتقل مباشرة إلى ${outcome}. إذا كان هذا يناسبك، راجع التفاصيل وخذ الخطوة التالية.`
      : `If the current process feels complicated, ${name} puts the path into one clear offer. Start with the problem, use the ready steps or asset, then move toward ${outcome}. If that fits your situation, check the details and take the next step.`,
    scenes:[
      { seconds:'0–3', shot:ar ? 'لقطة قوية للمنتج أو النتيجة.' : 'Strong product or outcome shot.', text:ar ? 'مش عم توصل للنتيجة؟' : 'Still not getting the result?' },
      { seconds:'3–8', shot:ar ? 'إظهار المشكلة أو الخطوة المزعجة.' : 'Show the pain point or frustrating step.', text:ar ? 'المشكلة ليست بكثرة الجهد' : 'More effort is not the answer' },
      { seconds:'8–15', shot:ar ? `عرض ${name} أثناء الاستخدام.` : `Show ${name} in use.`, text:outcome },
      { seconds:'15–21', shot:ar ? 'عرض أهم عنصر/فائدة.' : 'Show the strongest feature/benefit.', text:product.usp || outcome },
      { seconds:'21–27', shot:ar ? 'لقطة نهائية + CTA.' : 'Final product shot + CTA.', text:ar ? 'شوف التفاصيل' : 'See the details' }
    ],
    shotList: ar ? ['Hero shot','المشكلة','الاستخدام','الفائدة','CTA'] : ['Hero shot','Problem','Use case','Benefit','CTA'],
    onScreenText: ar ? ['المشكلة واضحة','خطوات أقل','نتيجة أوضح',name,'شوف التفاصيل'] : ['Clear problem','Fewer steps','Clearer outcome',name,'See details'],
    caption: ar ? `${name} مصمم ليجعل الطريق إلى ${outcome} أبسط وأوضح. راجع العرض وشوف إذا يناسبك.` : `${name} is designed to make the path to ${outcome} simpler and clearer. Check the offer and see if it fits.`,
    cta: ar ? 'أرسل «تفاصيل» أو افتح صفحة العرض.' : 'Send “DETAILS” or open the offer page.'
  };
}

export function recipes(language = 'en') {
  const ar = language === 'ar';
  const names = ar
    ? ['إطلاق منتج جديد','إنشاء محتوى 7 أيام','إنشاء حملة Meta Ads','تحسين عرض ضعيف','تحليل حملة','العثور على منتج للبيع','إنشاء Reel قابل للاختبار','إنشاء نص Landing Page']
    : ['Launch a New Product','Create 7 Days of Content','Create Meta Ad Campaign','Improve a Weak Offer','Analyze Campaign','Find a Product to Sell','Create Viral Reel','Create Landing Page Copy'];
  const ids = ['launch-product','7-day-content','meta-campaign','improve-offer','analyze-campaign','find-product','viral-reel','landing-page'];
  return ids.map((id,i)=>({id,name:names[i]}));
}

export function partnerReply(message, context = {}, language = 'en') {
  const ar = isArabic(language,message);
  const text = lower(message);
  const project = context.project || null;
  const product = context.product || null;
  const noSales = /no sales|ليس لدي مبيعات|ما عندي مبيعات|ما في مبيعات|بدون مبيعات/.test(text);
  const start = /don't know what to sell|لا أعرف ماذا أبيع|شو بيع|ماذا ابيع|أريد أن أربح|اريد ان اربح/.test(text);
  if (!project || start) {
    return {
      type:'onboarding',
      reply: ar
        ? 'سنبدأ من الصفر. أعطني البلد، الميزانية، مهاراتك، الوقت المتاح، هل تفضّل منتجًا رقميًا أو خدمة أو تجارة إلكترونية، السوق المحلي/العالمي، وطرق استلام الأموال المتاحة. بعدها سأرتّب لك أفكارًا قابلة للتنفيذ بدل قائمة عشوائية.'
        : 'We will start from zero. Give me your country, budget, skills, available time, preferred model (digital product, service or ecommerce), local/global market and available payout methods. Then I will rank executable ideas instead of giving you a random list.',
      nextAction:'profile'
    };
  }
  if (noSales) {
    const name = product?.name || project.name;
    return {
      type:'diagnostic',
      reply: ar
        ? `لن أغيّر كل شيء دفعة واحدة. بالنسبة إلى ${name}: افحص بالترتيب العرض والسعر، وضوح الصفحة، الـHook، الـCreative، الجمهور، ثم أرقام الحملة. إذا لم توجد نقرات فالمشكلة غالبًا Creative/Hook. إذا توجد نقرات ولا توجد Leads فالعرض/الصفحة أقرب للسبب. إذا توجد Leads ولا شراء فالسعر والثقة وطريقة الدفع/التسليم تحتاج مراجعة. الاختبار التالي يجب أن يغيّر متغيرًا واحدًا فقط.`
        : `Do not change everything at once. For ${name}, inspect offer and price, page clarity, hook, creative, audience, then campaign numbers. No clicks usually points to creative/hook. Clicks without leads points more toward the offer/page. Leads without purchases points toward price, trust, payment or delivery. Change one variable in the next test.`,
      nextAction:'analytics'
    };
  }
  if (/ad|اعلان|إعلان/.test(text)) {
    return { type:'route', reply: ar ? 'سنستخدم المنتج المحفوظ ونبني 4 زوايا إعلان مختلفة بدل نسخة واحدة. افتح Ad Studio وابدأ بـ Problem/Solution ثم Curiosity ثم Outcome ثم Direct Offer.' : 'Use the saved product and create four different ad angles instead of one. Start in Ad Studio with Problem/Solution, Curiosity, Outcome and Direct Offer.', nextAction:'ads' };
  }
  if (/brand|براند|هوية/.test(text)) {
    return { type:'route', reply: ar ? 'ابنِ Brand Profile مرة واحدة واحفظ الاسم والألوان ونبرة الصوت وBuyer Persona، ثم استخدمها تلقائيًا في المحتوى والإعلانات.' : 'Build the Brand Profile once, save name, colors, voice and buyer persona, then reuse it across content and ads.', nextAction:'brand' };
  }
  return {
    type:'plan',
    reply: ar
      ? 'أفضل خطوة الآن هي الانتقال من التفكير إلى اختبار قابل للقياس: ثبّت فكرة واحدة، ابنِ عرضًا بسيطًا، أنشئ 4 زوايا إعلان وReel واحد، ثم راقب إشارة الطلب قبل زيادة الإنفاق أو بناء نسخة أكبر.'
      : 'The best next step is to move from thinking to a measurable test: lock one idea, build a simple offer, create four ad angles and one Reel, then watch for demand before increasing spend or building a larger version.',
    nextAction:'dashboard'
  };
}
