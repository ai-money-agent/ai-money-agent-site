const BUSINESS_TYPES = new Set(['digital','physical','service','dropshipping','print_on_demand']);
const SUPPLIER_TYPES = new Set(['physical','dropshipping','print_on_demand']);
const CURRENCIES = new Set(['USD','EUR','LBP']);
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;

function cleanText(value, label, max, required = false) {
  if (typeof value !== 'string') throw new Error(label + ' must be text.');
  const out = value.trim();
  if (out.length > max || (required && out.length < 2)) throw new Error(label + ' must be ' + (required ? '2' : '0') + '-' + max + ' characters.');
  return out;
}

function amount(value, label, {min = 0, max = 1000000000} = {}) {
  if (value === '' || value === null || value === undefined) throw new Error(label + ' is required.');
  const result = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(result) || result < min || result > max) throw new Error(label + ' must be between ' + min + ' and ' + max + '.');
  return result;
}

function safeUrl(value, label) {
  const url = cleanText(value, label, 500);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!['https:','http:'].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch { throw new Error(label + ' must be an http or https URL.'); }
}

export function buildBusinessLaunchPlan(input = {}) {
  if (!BUSINESS_TYPES.has(input.businessType)) throw new Error('Choose a supported business type.');
  const businessType = input.businessType;
  const productName = cleanText(input.productName,'Product or service name',120,true);
  const audience = cleanText(input.audience,'Target audience',240,true);
  const country = cleanText(input.country,'Target country',80,true);
  const problem = cleanText(input.problem || '', 'Customer problem',500);
  const outcome = cleanText(input.outcome || '', 'Customer outcome',500);
  const marketNotes = cleanText(input.marketNotes || '', 'Market notes',1800);
  const marketSource = cleanText(input.marketSource || '', 'Market source name',160);
  const marketSourceUrl = safeUrl(input.marketSourceUrl || '', 'Market source URL');
  const supplierName = cleanText(input.supplierName || '', 'Supplier name',160);
  const supplierSourceUrl = safeUrl(input.supplierSourceUrl || '', 'Supplier quote URL');
  const currency = input.currency;
  if (!CURRENCIES.has(currency)) throw new Error('Choose USD, EUR or LBP.');
  const sellingPrice = amount(input.sellingPrice,'Selling price',{min:0.01});
  const unitCost = amount(input.unitCost,'Unit or delivery cost');
  const shippingCost = amount(input.shippingCost ?? 0,'Shipping / fulfillment cost');
  const packagingCost = amount(input.packagingCost ?? 0,'Packaging cost');
  const otherCost = amount(input.otherCost ?? 0,'Other cost');
  const platformFeePercent = amount(input.platformFeePercent ?? 0,'Platform fee percentage',{max:50});
  const marketingCostPerSale = amount(input.marketingCostPerSale ?? 0,'Marketing cost per sale');
  if (SUPPLIER_TYPES.has(businessType) && supplierName.length < 2) {
    throw new Error('Enter a supplier you found yourself; this app does not invent or look up suppliers.');
  }
  if (SUPPLIER_TYPES.has(businessType) && unitCost <= 0) {
    throw new Error('Enter a positive unit cost from a current supplier quote before calculating physical-product profit.');
  }

  const platformFee = round(sellingPrice * platformFeePercent / 100);
  const totalCosts = round(unitCost + shippingCost + packagingCost + otherCost + platformFee + marketingCostPerSale);
  const estimatedProfit = round(sellingPrice - totalCosts);
  const marginPercent = round(estimatedProfit / sellingPrice * 100);
  const adBreakEven = round(sellingPrice - unitCost - shippingCost - packagingCost - otherCost - platformFee);
  const language = input.language === 'ar' ? 'ar' : 'en';
  const marketStatus = marketNotes || marketSource || marketSourceUrl ? 'user_provided_unverified' : 'not_provided';
  const supplierStatus = SUPPLIER_TYPES.has(businessType) ? 'user_provided_unverified' : 'not_required';

  const marketEvidence = language === 'ar'
    ? {status:marketStatus,label:marketStatus === 'user_provided_unverified' ? 'معلومات أدخلها المستخدم — غير متحقق منها' : 'لم تُدخل بيانات سوق',source:marketSource || null,sourceUrl:marketSourceUrl || null,notes:marketNotes || null,note:'لم يُجرِ التطبيق بحثًا مباشرًا على الويب أو السوق.'}
    : {status:marketStatus,label:marketStatus === 'user_provided_unverified' ? 'User-provided information — not verified' : 'No market evidence supplied',source:marketSource || null,sourceUrl:marketSourceUrl || null,notes:marketNotes || null,note:'This app performed no live web or market search.'};
  const supplier = language === 'ar'
    ? {status:supplierStatus,name:supplierName || null,quoteUrl:supplierSourceUrl || null,note:SUPPLIER_TYPES.has(businessType) ? 'اسم المورد والتكاليف مدخلاتك؛ تحقق من السعر والتوفر وتاريخ العرض مباشرة مع المورد.' : 'لا ينطبق إدخال مورد على هذا النوع.'}
    : {status:supplierStatus,name:supplierName || null,quoteUrl:supplierSourceUrl || null,note:SUPPLIER_TYPES.has(businessType) ? 'Supplier and costs are your entries; confirm price, availability and quote date directly with the supplier.' : 'Supplier details are not required for this type.'};

  const validationSteps = language === 'ar'
    ? ['تحدث مع خمسة عملاء محتملين من الجمهور المحدد وسجّل إجاباتهم.','اجمع روابط مؤرخة لثلاثة عروض منافسة وتحقق من الأسعار بنفسك.','اختبر عرضًا بسيطًا قبل شراء مخزون أو إنفاق على إعلان.']
    : ['Interview five potential customers in the stated audience and record their answers.','Collect dated links to three competing offers and verify prices yourself.','Test a simple offer before buying inventory or spending on ads.'];
  const supplierSteps = SUPPLIER_TYPES.has(businessType)
    ? (language === 'ar'
      ? ['اطلب عرض سعر حديثًا وتحقق من الحد الأدنى للطلب والشحن والمرتجعات.','اطلب عينة أو اختبر عينة قبل وعد العميل بالجودة أو موعد التسليم.','لا تعتمد تكلفة الوحدة هنا إلا بعد مطابقتها مع عرض المورد الحالي.']
      : ['Request a current quote and confirm minimum order, shipping and return terms.','Order or inspect a sample before promising product quality or delivery dates.','Use the unit cost here only after matching it to a current supplier quote.'])
    : [];
  const releaseSteps = language === 'ar'
    ? ['راجع وصف المنتج وسياسة التسليم والإرجاع قبل النشر.','جهّز صفحة عرض واضحة وصورًا تملك حق استخدامها.','انشر أو أطلق الإعلان يدويًا بعد مراجعة التكلفة والميزانية.']
    : ['Review the product description, delivery and return policy before publishing.','Prepare a clear listing and images you have rights to use.','Publish or launch ads manually after reviewing cost and budget.'];

  const title = language === 'ar' ? 'خطة أولية: ' + productName : 'Starter launch plan: ' + productName;
  const problemLead = problem ? (language === 'ar' ? 'هل تواجه ' + problem + '؟ ' : 'Struggling with ' + problem + '? ') : '';
  const outcomeText = outcome || (language === 'ar' ? 'الوصول إلى نتيجة واضحة' : 'reach a clear outcome');
  const adCopy = language === 'ar'
    ? problemLead + productName + ' يساعد ' + audience + ' على ' + outcomeText + '. راجع التفاصيل والتكلفة قبل الشراء.'
    : problemLead + productName + ' helps ' + audience + ' ' + outcomeText + '. Review the details and total cost before buying.';

  return {
    title,
    simulationLabel:language === 'ar' ? 'قالب تخطيط محلي — ليس بحثًا حيًا ولا مخرجات ذكاء اصطناعي' : 'Local planning template — not live research or AI output',
    engine:'local_template',
    inputs:{businessType,productName,audience,country,problem,outcome,marketNotes,marketSource,marketSourceUrl,supplierName,supplierSourceUrl,currency,sellingPrice,unitCost,shippingCost,packagingCost,otherCost,platformFeePercent,marketingCostPerSale,language},
    marketEvidence,
    supplier,
    economics:{currency,sellingPrice,unitCost,shippingCost,packagingCost,otherCost,platformFeePercent,platformFee,marketingCostPerSale,totalCosts,estimatedProfit,marginPercent,breakEvenAdCost:adBreakEven,formula:language === 'ar' ? 'الربح التقديري = سعر البيع − تكلفة الوحدة − الشحن/التنفيذ − التغليف − التكاليف الأخرى − رسوم المنصة − تكلفة التسويق لكل عملية بيع' : 'Estimated profit = selling price − unit cost − shipping/fulfillment − packaging − other costs − platform fee − marketing cost per sale'},
    offer:{name:productName,audience,problem,outcome,description:adCopy},
    adDraft:{status:language === 'ar' ? 'مسودة قالب محلي — راجعها واختبرها' : 'Local template draft — review and test',copy:adCopy},
    researchChecklist:validationSteps,
    supplierChecklist:supplierSteps,
    launchChecklist:releaseSteps,
    digitalFactoryNextStep:businessType === 'digital'
      ? (language === 'ar' ? 'استخدم مصنع المنتجات الرقمية لإنتاج الملف الفعلي. إنشاء الملف لا يستدعي مزود ذكاء اصطناعي.' : 'Use the Digital Product Factory to create the real downloadable file. File generation does not call an AI provider.')
      : null
  };
}
