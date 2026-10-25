import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const safeAscii = (value) => String(value ?? '').normalize('NFKD').replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim();
const clamp = (n, min, max) => Math.max(min, Math.min(max, Math.round(Number(n) || min)));
const slug = (value) => safeAscii(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,60) || 'digital-product';
const ellipsePath = (x,y,rx,ry) => { const k=.55228475; return `${x+rx} ${y} m ${x+rx} ${y+ry*k} ${x+rx*k} ${y+ry} ${x} ${y+ry} c ${x-rx*k} ${y+ry} ${x-rx} ${y+ry*k} ${x-rx} ${y} c ${x-rx} ${y-ry*k} ${x-rx*k} ${y-ry} ${x} ${y-ry} c ${x+rx*k} ${y-ry} ${x+rx} ${y-ry*k} ${x+rx} ${y} c h S`; };

const arabicForms = new Map([
  [0x0621,[0xfe80]],[0x0622,[0xfe81,0xfe82]],[0x0623,[0xfe83,0xfe84]],[0x0624,[0xfe85,0xfe86]],[0x0625,[0xfe87,0xfe88]],[0x0626,[0xfe89,0xfe8a,0xfe8b,0xfe8c]],
  [0x0627,[0xfe8d,0xfe8e]],[0x0628,[0xfe8f,0xfe90,0xfe91,0xfe92]],[0x0629,[0xfe93,0xfe94]],[0x062a,[0xfe95,0xfe96,0xfe97,0xfe98]],[0x062b,[0xfe99,0xfe9a,0xfe9b,0xfe9c]],
  [0x062c,[0xfe9d,0xfe9e,0xfe9f,0xfea0]],[0x062d,[0xfea1,0xfea2,0xfea3,0xfea4]],[0x062e,[0xfea5,0xfea6,0xfea7,0xfea8]],[0x062f,[0xfea9,0xfeaa]],
  [0x0630,[0xfeab,0xfeac]],[0x0631,[0xfead,0xfeae]],[0x0632,[0xfeaf,0xfeb0]],[0x0633,[0xfeb1,0xfeb2,0xfeb3,0xfeb4]],[0x0634,[0xfeb5,0xfeb6,0xfeb7,0xfeb8]],
  [0x0635,[0xfeb9,0xfeba,0xfebb,0xfebc]],[0x0636,[0xfebd,0xfebe,0xfebf,0xfec0]],[0x0637,[0xfec1,0xfec2,0xfec3,0xfec4]],[0x0638,[0xfec5,0xfec6,0xfec7,0xfec8]],
  [0x0639,[0xfec9,0xfeca,0xfecb,0xfecc]],[0x063a,[0xfecd,0xfece,0xfecf,0xfed0]],[0x0641,[0xfed1,0xfed2,0xfed3,0xfed4]],[0x0642,[0xfed5,0xfed6,0xfed7,0xfed8]],
  [0x0643,[0xfed9,0xfeda,0xfedb,0xfedc]],[0x0644,[0xfedd,0xfede,0xfedf,0xfee0]],[0x0645,[0xfee1,0xfee2,0xfee3,0xfee4]],[0x0646,[0xfee5,0xfee6,0xfee7,0xfee8]],
  [0x0647,[0xfee9,0xfeea,0xfeeb,0xfeec]],[0x0648,[0xfeed,0xfeee]],[0x0649,[0xfeef,0xfef0]],[0x064a,[0xfef1,0xfef2,0xfef3,0xfef4]]
]);
const presentationToBase = new Map([...arabicForms].flatMap(([base,forms])=>forms.map(form=>[form,base])));
function visualRtlCodepoints(value) {
  const chars=Array.from(String(value??''));
  const chunks=[];
  for(const char of chars){const cp=char.codePointAt(0),arabic=/[\u0600-\u08ff\ufe70-\ufeff]/u.test(char);if(!chunks.length||chunks.at(-1).arabic!==arabic)chunks.push({arabic,text:''});chunks.at(-1).text+=char;}
  const logical=chunks.reverse().flatMap(chunk=>{
    const points=Array.from(chunk.text).map(c=>c.codePointAt(0));
    if(!chunk.arabic)return points;
    const clusters=[];for(const cp of points){if(cp>=0x064b&&cp<=0x065f&&clusters.length)clusters.at(-1).marks.push(cp);else clusters.push({cp,marks:[]});}
    const shaped=clusters.map((cluster,index)=>{
      const forms=arabicForms.get(cluster.cp);if(!forms)return [cluster.cp,...cluster.marks];
      const prev=clusters[index-1]&&arabicForms.get(clusters[index-1].cp),next=clusters[index+1]&&arabicForms.get(clusters[index+1].cp);
      const joinsPrev=Boolean(prev?.[2]&&forms[1]);const joinsNext=Boolean(forms[2]&&next?.[1]);
      const form=joinsPrev&&joinsNext?forms[3]:joinsPrev?forms[1]:joinsNext?forms[2]:forms[0];
      return [form||forms[0],...cluster.marks];
    });
    return shaped.reverse().flat();
  });
  return logical;
}

function readTrueTypeMetrics(font) {
  const tables=new Map(),tableCount=font.readUInt16BE(4);
  for(let i=0;i<tableCount;i++){const at=12+i*16;tables.set(font.toString('ascii',at,at+4),{offset:font.readUInt32BE(at+8),length:font.readUInt32BE(at+12)});}
  const cmap=tables.get('cmap'),hhea=tables.get('hhea'),hmtx=tables.get('hmtx'),head=tables.get('head');
  if(!cmap||!hhea||!hmtx||!head)throw new Error('The bundled Arabic font is incomplete.');
  const units=font.readUInt16BE(head.offset+18),metricCount=font.readUInt16BE(hhea.offset+34),encodingCount=font.readUInt16BE(cmap.offset+2);
  let cmapTable=null;
  for(let i=0;i<encodingCount;i++){const rec=cmap.offset+4+i*8,sub=cmap.offset+font.readUInt32BE(rec+4);if(font.readUInt16BE(sub)===12){cmapTable=sub;break;}}
  if(cmapTable===null)throw new Error('The bundled Arabic font has no Unicode cmap.');
  const groupCount=font.readUInt32BE(cmapTable+12),groups=[];
  for(let i=0;i<groupCount;i++){const at=cmapTable+16+i*12;groups.push([font.readUInt32BE(at),font.readUInt32BE(at+4),font.readUInt32BE(at+8)]);}
  const glyphFor=code=>{let lo=0,hi=groups.length-1;while(lo<=hi){const mid=(lo+hi)>>1,[start,end,glyph]=groups[mid];if(code<start)hi=mid-1;else if(code>end)lo=mid+1;else return glyph+code-start;}return 0;};
  const widthFor=glyph=>{const index=Math.min(glyph,metricCount-1);return Math.round(font.readUInt16BE(hmtx.offset+index*4)*1000/units);};
  return {glyphFor,widthFor};
}

function unicodePdfFont(objects,pages) {
  const add=body=>{objects.push(body);return objects.length;};
  const bundled=readFileSync(new URL('../public/fonts/DejaVuSans.zlib.b64',import.meta.url),'ascii').trim();
  const font=inflateSync(Buffer.from(bundled,'base64'));const metrics=readTrueTypeMetrics(font);
  const fontStream=deflateSync(font);const fontFileId=add(`<< /Length ${fontStream.length} /Length1 ${font.length} /Filter /FlateDecode >>\nstream\n${fontStream.toString('latin1')}\nendstream`);
  const descriptorId=add(`<< /Type /FontDescriptor /FontName /DejaVuSans /Flags 32 /FontBBox [-1021 -463 1793 1232] /ItalicAngle 0 /Ascent 928 /Descent -236 /CapHeight 729 /StemV 80 /FontFile2 ${fontFileId} 0 R >>`);
  const cidMap=Buffer.alloc(131072);for(let cid=0;cid<=0xffff;cid++)cidMap.writeUInt16BE(metrics.glyphFor(cid),cid*2);
  const cidMapZip=deflateSync(cidMap);const cidMapId=add(`<< /Length ${cidMapZip.length} /Filter /FlateDecode >>\nstream\n${cidMapZip.toString('latin1')}\nendstream`);
  const used=new Set();for(const page of pages)for(const line of page)if(!line.startsWith('@art:'))for(const cp of visualRtlCodepoints(line))used.add(cp);
  const widths=[...used].sort((a,b)=>a-b).map(cid=>`${cid} [${metrics.widthFor(metrics.glyphFor(cid))}]`).join(' ');
  const cidFontId=add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /DejaVuSans /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptorId} 0 R /DW 600 /W [${widths}] /CIDToGIDMap ${cidMapId} 0 R >>`);
  const toUnicode=[...used].sort((a,b)=>a-b).map(cid=>[cid,presentationToBase.get(cid)||cid]);
  const cmapLines=['/CIDInit /ProcSet findresource begin','12 dict begin','begincmap','/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def','/CMapName /DejaVuSans-UCS def','/CMapType 2 def','1 begincodespacerange','<0000> <FFFF>','endcodespacerange'];
  for(let i=0;i<toUnicode.length;i+=100){const batch=toUnicode.slice(i,i+100);cmapLines.push(`${batch.length} beginbfchar`,...batch.map(([cid,unicode])=>`<${cid.toString(16).padStart(4,'0')}> <${unicode.toString(16).padStart(4,'0')}>`),'endbfchar');}
  cmapLines.push('endcmap','CMapName currentdict /CMap defineresource pop','end','end');
  const cmapBytes=Buffer.from(cmapLines.join('\n'));const toUnicodeId=add(`<< /Length ${cmapBytes.length} >>\nstream\n${cmapBytes.toString('latin1')}\nendstream`);
  const fontId=add(`<< /Type /Font /Subtype /Type0 /BaseFont /DejaVuSans /Encoding /Identity-H /DescendantFonts [${cidFontId} 0 R] /ToUnicode ${toUnicodeId} 0 R >>`);
  return {fontId,metrics};
}

function wrap(value, width = 78) {
  const words = String(value ?? '').normalize('NFC').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > width) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

function pdfDocument(title, pages, {rtl=false}={}) {
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const catalogId = add('');
  const pagesId = add('');
  const fontInfo=rtl?unicodePdfFont(objects,pages):null;
  const fontId = fontInfo?.fontId || add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const pageIds = [];
  for (const page of pages) {
    const commands = ['q', '0.12 0.19 0.29 RG', '1.5 w', '42 42 528 708 re S', 'Q'];
    const art = page.find((line) => line.startsWith('@art:'));
    if (art) {
      const which = Number(art.slice(5));
      const paths = [
        `${ellipsePath(300,350,68,70)} ${ellipsePath(252,408,23,22)} ${ellipsePath(348,408,23,22)} ${ellipsePath(278,360,4,5)} ${ellipsePath(322,360,4,5)} ${ellipsePath(300,337,11,8)} 288 325 m 294 314 306 314 312 325 c S`,
        `${ellipsePath(300,345,65,60)} 252 390 m 262 445 l 300 400 l h S 300 400 m 338 445 l 348 390 l h S ${ellipsePath(281,355,4,5)} ${ellipsePath(319,355,4,5)} 290 330 m 300 322 310 322 310 330 c S 268 340 m 236 350 l S 270 330 m 238 330 l S 332 340 m 364 350 l S 330 330 m 362 330 l S`,
        `${ellipsePath(300,350,58,36)} 242 350 m 205 380 l 205 320 l h S 300 386 m 287 410 l 313 410 l h S 300 314 m 287 290 l 313 290 l h S ${ellipsePath(323,358,4,5)} 278 350 m 238 350 l S`,
        `265 310 m 265 390 l 335 390 l 335 310 l h S 300 390 m 300 420 l S 290 420 m 310 420 l S ${ellipsePath(283,360,5,6)} ${ellipsePath(317,360,5,6)} 283 335 m 317 335 l S`,
        `300 410 m 365 340 l 300 270 l 235 340 l h S 300 410 m 300 270 l S 235 340 m 365 340 l S 300 270 m 300 240 l 280 225 l 320 225 l h S`,
        `${ellipsePath(260,377,38,23)} ${ellipsePath(340,377,38,23)} ${ellipsePath(263,323,34,21)} ${ellipsePath(337,323,34,21)} 300 305 m 300 405 l S 300 400 m 278 430 278 440 270 445 c S 300 400 m 322 430 322 440 330 445 c S`
      ];
      commands.push('0 0 0 RG', '2 w', '1 J', paths[(which - 1) % paths.length], '0 0 0 rg');
    }
    let y = 710;
    for (const [index, line] of page.entries()) {
      if (line.startsWith('@art:')) continue;
      const size = index === 0 ? 22 : 11;
      if(rtl){
        const cps=visualRtlCodepoints(line).slice(0,105);
        const text=`<${cps.map(cp=>cp.toString(16).padStart(4,'0')).join('')}>`;
        const width=cps.reduce((sum,cp)=>sum+fontInfo.metrics.widthFor(fontInfo.metrics.glyphFor(cp)),0)*size/1000;
        commands.push(`BT /F1 ${size} Tf ${Math.max(52,552-width)} ${y} Td ${text} Tj ET`);
      }else{
        const text = safeAscii(line).replace(/[\\()]/g, '\\$&').slice(0, 105);
        commands.push(`BT /F1 ${size} Tf 60 ${y} Td (${text}) Tj ET`);
      }
      y -= index === 0 ? 34 : 19;
      if (y < 70) break;
    }
    const stream = commands.join('\n');
    const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`;
  const chunks=[Buffer.from('%PDF-1.4\n%Factory\n','binary')];let byteLength=chunks[0].length;const offsets=[0];
  objects.forEach((body,index)=>{offsets.push(byteLength);const head=Buffer.from(`${index+1} 0 obj\n`,'binary'),tail=Buffer.from('\nendobj\n','binary');chunks.push(head,Buffer.isBuffer(body)?body:Buffer.from(body,'binary'),tail);byteLength+=head.length+(Buffer.isBuffer(body)?body.length:Buffer.byteLength(body,'binary'))+tail.length;});
  const xref=byteLength;let trailer=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(const offset of offsets.slice(1))trailer+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  trailer+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R /Info << /Title (${safeAscii(title).replace(/[\\()]/g,'\\$&')}) >> >>\nstartxref\n${xref}\n%%EOF\n`;
  chunks.push(Buffer.from(trailer,'binary'));return Buffer.concat(chunks);
}

const page = (heading, body) => [heading, ...body.flatMap((line) => wrap(line))];
function ebookPages(input) {
  if (input.language === 'ar') {
    const count = clamp(input.pages??6,1,24);
    const sections = [
      ['ابدأ هنا',['اكتب نتيجة محددة تريد الوصول إليها.','هدفي: __________________________________________','لماذا يهمني هذا؟ _________________________________','ما الذي أعرفه مسبقاً؟ ____________________________']],
      ['خطوتك الأولى',['صف وضعك الحالي بجملة واحدة.','اختر خطوة صغيرة يمكنك إنجازها اليوم.','كيف ستعرف أنها نجحت؟ ____________________________']],
      ['طبّق الفكرة',['قسّم الموضوع إلى أجزاء بسيطة.','الفكرة الأولى وملاحظاتي: _________________________','مثال عملي: ______________________________________','ما الذي أحتاج إلى مراجعته؟ _______________________']],
      ['راجع خطتك',['أكثر فكرة مفيدة: ________________________________','شيء سأغيّره: ___________________________________','خطوتي التالية والموعد: ___________________________','هذا قالب محلي؛ تحقّق من المعلومات المتخصصة قبل بيعه.']],
      ['حوّل الفكرة إلى منشور',['اختر رسالة واحدة تريد إيصالها.','عنوان المنشور: __________________________________','النص الأساسي: ___________________________________','الدعوة إلى التواصل: ______________________________']],
      ['راجع قبل النشر',['هل النص واضح وخالٍ من الأخطاء؟ __________________','هل تملك حق استخدام الصور؟ _______________________','هل العرض مناسب للجمهور؟ _________________________','ما الذي سأختبره أولاً؟ ___________________________']]
    ];
    return Array.from({length:count},(_,i)=>{
      if(i<sections.length){const [h,lines]=sections[i];return [`${input.title} — ${h}`,...wrap(`الموضوع: ${input.topic}`),...lines];}
      return [`${input.title} — تمرين إضافي ${i+1}`,...wrap(`الموضوع: ${input.topic}`),'فكرة جديدة أريد تجربتها: _________________________','مثال أو نموذج: __________________________________','خطوتي التالية: ___________________________________','كيف سأراجع النتيجة؟ _____________________________'];
    });
  }
  const title = input.title;
  const topic = input.topic;
  const outcome = input.outcome || `Use the ideas in ${topic} to make steady progress.`;
  const pages = [
    page(title, [`A practical workbook for ${input.audience || 'independent learners'}.`, `Topic: ${topic}`, `Outcome: ${outcome}`, 'Created locally from your supplied details. No AI connection was used.']),
    page('Start here', ['Write one specific result you want from this guide.', 'My goal: ______________________________________________________', 'Why this matters to me: ________________________________________', 'What I already know: ___________________________________________', 'Set aside 15 minutes for each section.']),
    page('Plan your first step', [`Focus: ${topic}`, '1. Describe the current situation in one sentence.', '2. Choose one small action you can finish today.', '3. Decide what evidence will show it worked.', 'My action: _____________________________________________________', 'How I will measure it: _________________________________________']),
    page('Work through the method', ['Break the topic into three manageable parts:', 'Part 1: Learn the basics. Notes: _________________________________', 'Part 2: Try one real example. Notes: ______________________________', 'Part 3: Review and improve. Notes: _______________________________', 'Circle the part that needs the most attention.']),
    page('Make it practical', ['Use this checklist before you finish:', '[ ] I can explain the main idea in my own words.', '[ ] I tried one example.', '[ ] I wrote down a question to investigate.', '[ ] I chose a next step and a date.', 'Next step: _________________________   Date: __________________']),
    page('Review and reuse', [`The most useful idea was: ________________________________________`, 'One thing I will change: _________________________________________', 'One thing I still need: __________________________________________', `My next 7-day plan for ${topic}:`, 'Day 1: __________  Day 3: __________  Day 7: __________', 'This starter guide is a template. Add verified subject-specific facts before selling.'])
  ];
  const count=clamp(input.pages??6,1,24);
  return Array.from({length:count},(_,i)=>{
    if(i<pages.length)return pages[i];
    return page(`Extra practice ${i+1}`,[`Topic: ${topic}`,'One new idea I want to try: __________________________','Example or draft: __________________________________','My next step: _____________________________________','How I will review the result: _______________________']);
  });
}

function coloringPages(input) {
  const pages = [];
  const count = clamp(input.pages??6, 1, 24);
  for (let i = 1; i <= count; i++) {
    const heading = input.language === 'ar' ? `${input.title} — الصفحة ${i}` : `${input.title} — Page ${i}`;
    const details = input.language === 'ar'
      ? [`نشاط تلوين ورسم لـ ${input.audience || 'الأطفال'}.`, `الموضوع: ${input.topic}`, 'لوّن الرسمة ثم اكتب ما تراه.', 'ارسم خطاً من نقطة البداية إلى النهاية.', 'الاسم: __________________________  التاريخ: ______________', '@art:' + i]
      : [`Coloring and activity sheet for ${input.audience || 'young learners'}.`, `Theme: ${input.topic}`, 'Color the outline drawing, then describe what you see.', 'Activity: draw a line from the start to the finish.', 'Name: ______________________________  Date: ________________', '@art:' + ((i - 1) % 6 + 1)];
    pages.push(page(heading, details));
  }
  return pages;
}

function worksheetPages(input) {
  const start = clamp(input.level || 2, 1, 12);
  const rows = [];
  const answers = [];
  const perPage = clamp(input.questionsPerPage || 10, 3, 20);
  const pageCount=clamp(input.pages??6,1,24);
  const count = pageCount * perPage;
  for (let i = 1; i <= count; i++) {
    const a = start * 3 + i;
    const b = start + i;
    const subtract = i % 2 === 0;
    rows.push(`${i}. ${a} ${subtract ? '-' : '+'} ${b} = ______`);
    answers.push(`${i}. ${a} ${subtract ? '-' : '+'} ${b} = ${subtract ? a-b : a+b}`);
  }
  const sheets=Array.from({length:pageCount},(_,index)=>page(`${input.title} — ${input.language==='ar'?'ورقة':'Worksheet'} ${index+1}`,[(input.language==='ar'?`الموضوع: ${input.topic}. أجب عن الأسئلة.`:`Topic: ${input.topic}. Complete the practice set.`),`${input.language==='ar'?'الفئة':'For'}: ${input.audience || (input.language==='ar'?'المتعلمون':'learners')}`,input.language==='ar'?'أظهر خطوات الحل بجانب كل إجابة.':'Show your working beside each answer.',...rows.slice(index*perPage,(index+1)*perPage)]));
  const keys=Array.from({length:pageCount},(_,index)=>page(`${input.language==='ar'?'الإجابات':'Answer key'} ${index+1}`,[(input.language==='ar'?'تحقّق من إجاباتك بعد إنهاء ورقة العمل.':'Check answers after finishing the practice pages.'),...answers.slice(index*perPage,(index+1)*perPage)]));
  return [...sheets,...keys];
}

function interactiveHtml(input, pages, type) {
  const ar = input.language === 'ar';
  const direction = ar ? 'rtl' : 'ltr';
  const lang = ar ? 'ar' : 'en';
  const strings = ar
    ? { print:'طباعة / حفظ PDF', save:'تُحفظ إجاباتك ورسوماتك على هذا الجهاز.', show:'إظهار الحلول', hide:'إخفاء الحلول', answer:'إجابتك أو ملاحظاتك', draw:'ارسم هنا', clear:'مسح الرسم', page:'صفحة', budget:'معاينة الميزانية الشهرية', income:'الدخل الشهري', total:'إجمالي المصروفات', net:'صافي الادخار', expenses:['السكن','الطعام','النقل','الفواتير','الصحة','ادخار','أخرى'] }
    : { print:'Print / Save PDF', save:'Your answers and drawings are saved on this device.', show:'Show answers', hide:'Hide answers', answer:'Your answer or notes', draw:'Draw here', clear:'Clear drawing', page:'Page', budget:'Monthly budget preview', income:'Monthly income', total:'Total expenses', net:'Net savings', expenses:['Housing','Food','Transport','Utilities','Health','Savings','Other'] };
  const safeData = JSON.stringify({title:input.title,pages:pages.map((lines,index)=>({index:index+1,lines:lines.filter(line=>!line.startsWith('@art:'))}))}).replace(/</g,'\\u003c');
  const worksheetCount=type==='worksheet'?clamp(input.pages??6,1,24):pages.length;
  const visiblePages=type==='worksheet'?pages.slice(0,worksheetCount):pages;
  const keyPages=type==='worksheet'?pages.slice(worksheetCount):[];
  const lineArt=(n)=>{
    const drawings=[
      '<circle cx="250" cy="158" r="96"/><circle cx="178" cy="78" r="31"/><circle cx="322" cy="78" r="31"/><circle cx="218" cy="142" r="6"/><circle cx="282" cy="142" r="6"/><ellipse cx="250" cy="175" rx="17" ry="11"/><path d="M228 193 Q250 219 272 193"/>',
      '<path d="M155 138 L163 51 L221 94 Q250 83 279 94 L337 51 L345 138 Q351 235 250 245 Q149 235 155 138Z"/><circle cx="216" cy="146" r="6"/><circle cx="284" cy="146" r="6"/><path d="M232 180 Q250 195 268 180 M138 165 L195 169 M137 188 L194 186 M362 165 L305 169 M363 188 L306 186"/>',
      '<ellipse cx="250" cy="157" rx="119" ry="69"/><path d="M132 157 L66 92 L66 222Z M218 102 L250 49 L282 102 M218 212 L250 265 L282 212Z"/><circle cx="300" cy="142" r="8"/><path d="M315 178 Q333 190 347 178"/>',
      '<rect x="155" y="88" width="190" height="165" rx="24"/><path d="M250 88 V43 M231 43 H269 M197 140 V169 M303 140 V169 M208 207 H292"/><circle cx="205" cy="143" r="8"/><circle cx="295" cy="143" r="8"/>',
      '<path d="M250 35 L390 150 L250 265 L110 150Z M250 35 V265 M110 150 H390 M250 265 V290 L210 310 L290 330 L250 350"/><path d="M250 275 L225 291 L250 307 L275 291Z M250 315 L225 331 L250 347 L275 331Z"/>',
      '<ellipse cx="174" cy="119" rx="88" ry="55"/><ellipse cx="326" cy="119" rx="88" ry="55"/><ellipse cx="185" cy="210" rx="78" ry="47"/><ellipse cx="315" cy="210" rx="78" ry="47"/><path d="M250 103 V236 M250 112 Q210 65 203 49 M250 112 Q290 65 297 49"/><circle cx="201" cy="48" r="6"/><circle cx="299" cy="48" r="6"/>'
    ];
    return `<svg class="activity-art" viewBox="0 0 500 300" role="img" aria-label="${esc(ar?'رسمة خطية للتلوين':'Line drawing for coloring')}" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${drawings[(Number(n)-1)%drawings.length]}</svg>`;
  };
  const cards = visiblePages.map((lines,index)=>{
    const art = lines.find(line=>line.startsWith('@art:'));
    const text=lines.filter(line=>!line.startsWith('@art:'));
    const promptLines=text.slice(1).filter(line=>!/^\d+\. /.test(line));
    return `<article class="page" data-page="${index+1}"><small>${esc(strings.page)} ${index+1} / ${visiblePages.length}</small><h2>${esc(text[0]||input.title)}</h2>${promptLines.map(line=>`<p>${esc(line)}</p>`).join('')}${type==='worksheet'?text.filter(line=>/^\d+\. /.test(line)).map(line=>`<label class="work"><span>${esc(line)}</span><input aria-label="${esc(strings.answer)}" data-answer="${index+1}-${line.split('.')[0]}" /></label>`).join(''):''}${art?`${lineArt(art.slice(5))}<div class="drawbox"><canvas aria-label="${esc(strings.draw)}" data-canvas="${index+1}"></canvas><button type="button" data-clear="${index+1}">${esc(strings.clear)}</button></div>`:''}<label class="notes">${esc(strings.answer)}<textarea data-note="${index+1}" rows="3"></textarea></label></article>`;
  }).join('');
  const budget = type==='budget'||type==='organizer' ? `<section class="page budget"><h2>${esc(strings.budget)}</h2><label>${esc(strings.income)} <input id="income" type="number" inputmode="decimal" value="0"></label><div id="expenseFields">${strings.expenses.map((name,i)=>`<label>${esc(name)} <input type="number" inputmode="decimal" value="0" data-expense="${i}"></label>`).join('')}</div><p>${esc(strings.total)}: <strong id="total">0</strong></p><p>${esc(strings.net)}: <strong id="net">0</strong></p></section>` : '';
  const key=`local-growth-factory:${encodeURIComponent(String(input.title||''))}:${type}`;
  return `<!doctype html><html lang="${lang}" dir="${direction}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(input.title)}</title><style>*{box-sizing:border-box}.activity-art{display:block;width:min(100%,440px);height:auto;margin:14px auto;stroke:#101820}body{margin:0;background:#edf2f8;color:#17263b;font:16px system-ui,"Noto Naskh Arabic","Noto Sans Arabic",sans-serif;line-height:1.65}.toolbar{position:sticky;top:0;background:#173e6c;color:white;padding:12px;display:flex;gap:8px;justify-content:center;z-index:2}.toolbar button,button{font:inherit;border:1px solid #ccd8e5;border-radius:10px;background:white;padding:9px 13px;min-height:44px}.wrap{max-width:820px;margin:auto;padding:16px}.page{background:white;border:1px solid #d5deea;border-radius:14px;padding:24px;margin:0 0 18px;box-shadow:0 6px 20px #142a4310;break-after:page}.page h2{margin-top:2px}.page p{margin:8px 0}.work,.notes,.budget label{display:grid;gap:6px;margin:12px 0}.work input,.notes textarea,.budget input{font:inherit;border:1px solid #c8d2e0;border-radius:8px;padding:10px;min-height:44px;width:100%}.drawbox{margin:12px 0}.drawbox canvas{display:block;width:100%;height:240px;border:2px solid #343c48;border-radius:8px;touch-action:none;background:white}.drawbox button{margin-top:8px}.budget{background:#fefefe}small{color:#66758a}#answers[hidden]{display:none}@media(max-width:600px){.wrap{padding:10px}.page{padding:18px 14px;border-radius:10px}.toolbar{flex-wrap:wrap}.drawbox canvas{height:190px}}@media print{body{background:white}.toolbar,.drawbox button{display:none}.wrap{max-width:none;padding:0}.page{border:0;box-shadow:none;border-radius:0;margin:0;padding:12mm;min-height:260mm}.drawbox canvas{height:170px}.work input,.notes textarea{border:0;border-bottom:1px solid #777;border-radius:0;padding:4px;min-height:26px}textarea{resize:none}main.hasAnswers #answers[hidden]{display:block!important}}</style><header class="toolbar"><button onclick="window.print()">${esc(strings.print)}</button><button id="toggleAnswers">${esc(strings.show)}</button></header><main class="wrap ${type==='worksheet'?'hasAnswers':''}"><article class="page"><small>${ar?'قالب محلي تفاعلي • لا يستخدم اتصال ذكاء اصطناعي':'LOCAL INTERACTIVE TEMPLATE • NO AI CONNECTION'}</small><h1>${esc(input.title)}</h1><p>${esc(input.topic)} · ${esc(input.audience||'')}</p><p>${esc(strings.save)}</p></article>${cards}${budget}<section id="answers" class="page" hidden><h2>${ar?'الإجابات':'Answer key'}</h2>${keyPages.flatMap(lines=>lines.filter(line=>/^\d+\. /.test(line))).map(line=>`<p>${esc(line)}</p>`).join('')}</section></main><script>const DATA=${safeData};const KEY=${JSON.stringify(key)};const get=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};const saved=get();document.querySelectorAll('[data-note],[data-answer]').forEach(e=>{e.value=saved[e.dataset.note||e.dataset.answer]||'';e.addEventListener('input',()=>{saved[e.dataset.note||e.dataset.answer]=e.value;localStorage.setItem(KEY,JSON.stringify(saved))})});function resizeCanvas(c){const r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=r.width*d;c.height=r.height*d;const x=c.getContext('2d');x.scale(d,d);x.lineWidth=3;x.lineCap='round';x.strokeStyle='#1b2939';const img=saved['canvas:'+c.dataset.canvas];if(img){const im=new Image();im.onload=()=>x.drawImage(im,0,0,r.width,r.height);im.src=img.src}}document.querySelectorAll('canvas').forEach(c=>{resizeCanvas(c);let drawing=false,ctx=c.getContext('2d'),point=e=>{const r=c.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]};c.onpointerdown=e=>{drawing=true;c.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(...point(e))};c.onpointermove=e=>{if(!drawing)return;ctx.lineTo(...point(e));ctx.stroke()};c.onpointerup=()=>{drawing=false;saved['canvas:'+c.dataset.canvas]={src:c.toDataURL()};localStorage.setItem(KEY,JSON.stringify(saved))};window.addEventListener('resize',()=>resizeCanvas(c))});document.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{const c=document.querySelector('[data-canvas="'+b.dataset.clear+'"]');c.getContext('2d').clearRect(0,0,c.width,c.height);delete saved['canvas:'+b.dataset.clear];localStorage.setItem(KEY,JSON.stringify(saved))});const toggle=document.getElementById('toggleAnswers'),answers=document.getElementById('answers');toggle.onclick=()=>{answers.hidden=!answers.hidden;toggle.textContent=answers.hidden?${JSON.stringify(strings.show)}:${JSON.stringify(strings.hide)}};function calc(){const income=Number(document.getElementById('income')?.value||0),total=[...document.querySelectorAll('[data-expense]')].reduce((s,e)=>s+Number(e.value||0),0);document.getElementById('total').textContent=total.toFixed(2);document.getElementById('net').textContent=(income-total).toFixed(2);saved.income=income;document.querySelectorAll('[data-expense]').forEach(e=>saved['expense:'+e.dataset.expense]=e.value);localStorage.setItem(KEY,JSON.stringify(saved))}document.querySelectorAll('#income,[data-expense]').forEach(e=>{e.value=saved[e.id]??saved['expense:'+e.dataset.expense]??e.value;e.addEventListener('input',calc)});if(document.getElementById('income'))calc();</script></html>`;
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4); local.writeUInt16LE(0x800,6); local.writeUInt16LE(0,8);
    local.writeUInt32LE(crc,14); local.writeUInt32LE(data.length,18); local.writeUInt32LE(data.length,22); local.writeUInt16LE(nameBytes.length,26); nameBytes.copy(local,30);
    locals.push(local,data);
    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt16LE(0x800,8); central.writeUInt16LE(0,10);
    central.writeUInt32LE(crc,16); central.writeUInt32LE(data.length,20); central.writeUInt32LE(data.length,24); central.writeUInt16LE(nameBytes.length,28); central.writeUInt32LE(offset,42); nameBytes.copy(central,46);
    centrals.push(central); offset += local.length + data.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(centrals.length,8); end.writeUInt16LE(centrals.length,10); end.writeUInt32LE(centralBytes.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,centralBytes,end]);
}

const col = (n) => { let out=''; while(n){const r=(n-1)%26;out=String.fromCharCode(65+r)+out;n=Math.floor((n-1)/26);}return out; };
function sheet(rows,{rtl=false}={}) {
  const body = rows.map((row, r) => `<row r="${r+1}">${row.map((value,c)=>{
    const ref=`${col(c+1)}${r+1}`;
    if (typeof value === 'string' && value.startsWith('=')) return `<c r="${ref}"><f>${esc(value.slice(1))}</f><v>0</v></c>`;
    if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const cols=Math.max(1,...rows.map(r=>r.length));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${col(cols)}${rows.length}"/>${rtl?'<sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>':''}<sheetData>${body}</sheetData></worksheet>`;
}
function workbook(input) {
  const ar=input.language==='ar';
  const months=ar?['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const budget=[[ar?'مخطط الميزانية الشهرية':'Monthly Budget Planner',input.title],[ar?'الفئة':'Category',ar?'المخطط':'Planned',ar?'الفعلي':'Actual',ar?'الفرق':'Variance'],[ar?'الدخل':'Income',0,0,'=C3-B3'],[ar?'السكن':'Housing',0,0,'=B4-C4'],[ar?'الطعام':'Food',0,0,'=B5-C5'],[ar?'النقل':'Transport',0,0,'=B6-C6'],[ar?'الفواتير':'Utilities',0,0,'=B7-C7'],[ar?'الصحة':'Health',0,0,'=B8-C8'],[ar?'الادخار':'Savings',0,0,'=B9-C9'],[ar?'أخرى':'Other',0,0,'=B10-C10'],[ar?'إجمالي المصروفات':'Total Expenses','=SUM(B4:B10)','=SUM(C4:C10)','=B11-C11'],[ar?'صافي الادخار':'Net Savings','=B3-B11','=C3-C11','=C12-B12'],[ar?'إرشادات':'Instructions',ar?'أدخل الدخل والمصروفات. يقارن الفرق المخطط بالفعلي، وصافي الادخار هو الدخل ناقص المصروفات.':'Enter income and expense amounts. Variance compares planned with actual; net savings is income minus expenses.']];
  const transactions=[[ar?'التاريخ':'Date',ar?'الفئة':'Category',ar?'الوصف':'Description',ar?'الدخل':'Income',ar?'المصروف':'Expense',ar?'الرصيد':'Balance'],['','','',0,0,'=D2-E2']];
  for(let i=3;i<=32;i++) transactions.push(['','','',0,0,`=F${i-1}+D${i}-E${i}`]);
  const planner=[[ar?'مخطط ١٢ شهراً':'12-Month Organizer',ar?'الهدف':'Goal',ar?'ملاحظات':'Notes'],...months.map(m=>[m,'','']),[ar?'مراجعة ربع سنوية':'Quarterly review',ar?'ما الذي نجح؟':'What worked?',ar?'ما الذي نغيّره؟':'What to change?']];
  const files={
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${ar?'الميزانية':'Budget'}" sheetId="1" r:id="rId1"/><sheet name="${ar?'المعاملات':'Transactions'}" sheetId="2" r:id="rId2"/><sheet name="${ar?'خطة سنوية':'12-Month Plan'}" sheetId="3" r:id="rId3"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':sheet(budget,{rtl:ar}), 'xl/worksheets/sheet2.xml':sheet(transactions,{rtl:ar}), 'xl/worksheets/sheet3.xml':sheet(planner,{rtl:ar})
  };
  return zip(files);
}

function quizHtml(input) {
  const count=clamp(input.questionCount||30,3,30);
  const questions=(input.questions||[]).slice(0,count).map((q)=>({q:String(q.question||''),a:String(q.answer||''),wrong:(q.wrong||[]).map(String).slice(0,3)}));
  if (questions.length < 3 || questions.some(q=>!q.q||!q.a||q.wrong.length<2)) throw new Error('Add at least 3 questions. Each needs one answer and two incorrect choices.');
  const json=JSON.stringify(questions).replace(/</g,'\\u003c');
  const ar=input.language==='ar';const lang=ar?'ar':'en';const dir=ar?'rtl':'ltr';
  const next=ar?'التالي':'Next',finished=ar?'انتهت اللعبة!':'Finished!',scoreLabel=ar?'نتيجتك: ':'Your score: ',questionWord=ar?'السؤال':'Question';
  const key=`local-growth-quiz:${encodeURIComponent(String(input.title||''))}`;
  const script=`const qs=${json},KEY=${JSON.stringify(key)},answersKey=KEY+':answers';let state={};try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}let i=Number(state.index||0),score=Number(state.score||0),answers=state.answers||{};const status=document.getElementById('status'),question=document.getElementById('question'),choices=document.getElementById('choices'),next=document.getElementById('next');function persist(){state={index:i,score,answers};localStorage.setItem(KEY,JSON.stringify(state))}function show(){if(i>=qs.length){question.textContent=${JSON.stringify(finished)};choices.textContent=${JSON.stringify(scoreLabel)}+score+' / '+qs.length;status.textContent=${JSON.stringify(scoreLabel)}+score+' / '+qs.length;next.hidden=true;return}status.textContent=${JSON.stringify(questionWord+' ')}+(i+1)+' / '+qs.length;question.textContent=qs[i].q;choices.replaceChildren();const selected=answers[i];next.hidden=!selected;[qs[i].a,...qs[i].wrong].sort(()=>Math.random()-.5).forEach(x=>{const b=document.createElement('button');b.textContent=x;if(selected){b.disabled=true;if(x===selected)b.style.borderColor=x===qs[i].a?'#17834c':'#c43b45'}b.onclick=()=>{if(answers[i])return;answers[i]=x;if(x===qs[i].a)score++;b.style.borderColor=x===qs[i].a?'#17834c':'#c43b45';[...choices.children].forEach(c=>c.disabled=true);persist();next.hidden=false};choices.append(b)})}next.onclick=()=>{i++;persist();show()};show();`;
  return `<!doctype html><html lang="${lang}" dir="${dir}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(input.title)}</title><style>body{font:16px system-ui,"Noto Naskh Arabic","Noto Sans Arabic",sans-serif;margin:0;background:#f4f7fb;color:#182438;line-height:1.6}.wrap{max-width:680px;margin:auto;padding:24px}.card{background:white;border-radius:18px;padding:24px;box-shadow:0 8px 30px #12244415}button{width:100%;padding:14px;margin:7px 0;border:1px solid #ccd6e2;border-radius:10px;background:#fff;font:inherit;text-align:start;min-height:48px}button:hover{background:#e7f2ff}#next{background:#153b67;color:white;text-align:center}small{color:#52627a}</style><main class="wrap"><div class="card"><small>OFFLINE QUIZ • ${esc(input.topic)}</small><h1>${esc(input.title)}</h1><p id="status"></p><h2 id="question"></h2><div id="choices"></div><button id="next" hidden>${next}</button></div></main><script>${script}</script></html>`;
}

export function createDigitalProduct(input = {}) {
  const kind=String(input.type||'ebook');
  if (!['ebook','coloring','worksheet','budget','organizer','quiz'].includes(kind)) throw new Error('Choose a supported digital product type.');
  const rawTitle=String(input.title||'').trim(), rawTopic=String(input.topic||'').trim();
  const language=String(input.language||'en')==='ar'?'ar':'en';
  if (['budget','organizer','quiz'].includes(kind)) {
    const title=rawTitle.replace(/\s+/g,' ').slice(0,100), topic=rawTopic.replace(/\s+/g,' ').slice(0,120);
    if(title.length<2||topic.length<2)throw new Error('Enter a title and topic using at least 2 characters.');
    const normalized={...input,language,title,topic,audience:String(input.audience||'').trim(),outcome:String(input.outcome||'').trim()};
    const id=randomUUID();
    if(kind==='budget'||kind==='organizer')return{id,filename:`${slug(title)}.xlsx`,contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook(normalized),preview:{filename:`${slug(title)}-mobile-preview.html`,contentType:'text/html; charset=utf-8',buffer:Buffer.from(interactiveHtml(normalized,[],kind))},label:'Local workbook template and mobile preview; no AI connection used.'};
    return{id,filename:`${slug(title)}.html`,contentType:'text/html; charset=utf-8',buffer:Buffer.from(quizHtml(normalized)),preview:{filename:`${slug(title)}-play.html`,contentType:'text/html; charset=utf-8',buffer:Buffer.from(quizHtml(normalized))},label:'Offline quiz built from your supplied questions; no AI connection used.'};
  }
  const title=language==='ar'?String(input.title).trim().slice(0,100):safeAscii(input.title).slice(0,100);
  const topic=language==='ar'?String(input.topic).trim().slice(0,120):safeAscii(input.topic).slice(0,120);
  if (title.length<2 || topic.length<2) throw new Error('Enter a title and topic using at least 2 characters.');
  const normalized={...input,language,title,topic,audience:language==='ar'?String(input.audience||'المتعلمون').trim():safeAscii(input.audience||'independent learners'),outcome:language==='ar'?String(input.outcome||'').trim():safeAscii(input.outcome||'')};
  const id=randomUUID();
  const pages=kind==='ebook'?ebookPages(normalized):kind==='coloring'?coloringPages(normalized):worksheetPages(normalized);
  const rtl=language==='ar';
  const base={id,filename:`${rtl?`arabic-${kind}`:slug(title)}.pdf`,contentType:'application/pdf',buffer:pdfDocument(rtl?'Arabic RTL product':title,pages,{rtl}),pages:pages.length,preview:{filename:`${rtl?`arabic-${kind}`:slug(title)}-${rtl?'rtl-interactive':'interactive'}.html`,contentType:'text/html; charset=utf-8',buffer:Buffer.from(interactiveHtml(normalized,pages,kind))},label:rtl?'Arabic RTL PDF with embedded Unicode font and contextual glyph shaping, plus interactive mobile HTML; no AI connection used.':'Print-ready PDF plus interactive mobile HTML companion; no AI connection used.'};
  if(kind==='worksheet')base.answerCount=clamp(input.pages??6,1,24)*clamp(input.questionsPerPage||10,3,20);
  return base;
}

