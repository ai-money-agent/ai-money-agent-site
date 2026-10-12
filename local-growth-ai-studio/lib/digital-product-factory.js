import { randomUUID } from 'node:crypto';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const safeAscii = (value) => String(value ?? '').normalize('NFKD').replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim();
const clamp = (n, min, max) => Math.max(min, Math.min(max, Math.round(Number(n) || min)));
const slug = (value) => safeAscii(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,60) || 'digital-product';

function wrap(value, width = 78) {
  const words = safeAscii(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > width) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

function pdfDocument(title, pages) {
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const catalogId = add('');
  const pagesId = add('');
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const pageIds = [];
  for (const page of pages) {
    const commands = ['q', '0.12 0.19 0.29 RG', '1.5 w', '42 42 528 708 re S', 'Q'];
    const art = page.find((line) => line.startsWith('@art:'));
    if (art) {
      const which = Number(art.slice(5));
      const paths = [
        '270 350 m 270 410 l 300 380 l 330 410 l 330 350 c 330 300 270 300 270 350 c S 283 355 m 283 358 286 361 289 358 c 292 355 289 352 286 352 c 284 352 283 353 283 355 c S 311 355 m 311 358 314 361 317 358 c 320 355 317 352 314 352 c 312 352 311 353 311 355 c S 292 330 m 300 324 l 308 330 l 300 336 l h S 292 324 m 283 320 l 270 324 S 308 324 m 317 320 l 330 324 S',
        '265 350 m 265 400 c 265 420 285 430 300 410 c 315 430 335 420 335 400 l 335 350 c 335 300 265 300 265 350 c S 280 360 m 280 364 284 368 288 364 c 292 360 288 356 284 356 c 282 356 280 358 280 360 c S 312 360 m 312 364 316 368 320 364 c 324 360 320 356 316 356 c 314 356 312 358 312 360 c S 292 335 m 300 330 l 308 335 l 300 342 l h S 286 326 m 300 322 l 314 326 S',
        '270 340 m 300 375 l 355 340 l 300 305 l h S 300 375 m 300 305 l S 355 340 m 390 375 l 390 305 l h S 270 340 m 238 370 l 238 310 l h S 286 354 m 286 358 290 362 294 358 c 298 354 294 350 290 350 c 288 350 286 352 286 354 c S 310 354 m 310 358 314 362 318 358 c 322 354 318 350 314 350 c 312 350 310 352 310 354 c S',
        '270 300 m 270 390 l 330 390 l 330 300 l h S 258 390 m 300 430 l 342 390 l S 282 355 m 282 359 286 363 290 359 c 294 355 290 351 286 351 c 284 351 282 353 282 355 c S 310 355 m 310 359 314 363 318 359 c 322 355 318 351 314 351 c 312 351 310 353 310 355 c S 290 330 m 300 325 l 310 330 l S 283 300 m 275 285 l S 317 300 m 325 285 l S',
        '300 410 m 365 340 l 300 270 l 235 340 l h S 300 410 m 300 270 l S 235 340 m 365 340 l S 270 375 m 330 375 l S 270 305 m 330 305 l S 300 270 m 300 245 l 280 230 l 320 230 l h S',
        '300 340 m 300 400 l S 300 365 m 280 410 225 425 222 380 c 218 344 257 338 300 365 c S 300 365 m 343 338 382 344 378 380 c 375 425 320 410 300 365 c S 300 345 m 280 315 235 280 230 315 c 225 350 272 360 300 345 c S 300 345 m 328 360 375 350 370 315 c 365 280 320 315 300 345 c S 298 400 m 290 425 280 440 270 445 S 302 400 m 310 425 320 440 330 445 S'
      ];
      commands.push('0 0 0 RG', '2 w', '1 J', paths[(which - 1) % paths.length], '0 0 0 rg');
    }
    let y = 710;
    for (const [index, line] of page.entries()) {
      if (line.startsWith('@art:')) continue;
      const text = safeAscii(line).replace(/[\\()]/g, '\\$&').slice(0, 105);
      const size = index === 0 ? 22 : 11;
      commands.push(`BT /F1 ${size} Tf 60 ${y} Td (${text}) Tj ET`);
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
  let pdf = '%PDF-1.4\n%Factory\n';
  const offsets = [0];
  objects.forEach((body, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10,'0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info << /Title (${safeAscii(title).replace(/[\\()]/g,'\\$&')}) >> >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'binary');
}

const page = (heading, body) => [heading, ...body.flatMap((line) => wrap(line))];
function ebookPages(input) {
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
  return pages;
}

function coloringPages(input) {
  const pages = [];
  for (let i = 1; i <= 6; i++) {
    pages.push(page(`${input.title} — Page ${i}`, [`Coloring and activity sheet for ${input.audience || 'young learners'}.`, `Theme: ${input.topic}`, 'Color the outline drawing, then describe what you see.', 'Activity: draw a line from the start to the finish.', 'Name: ______________________________  Date: ________________', '@art:' + i]));
  }
  return pages;
}

function worksheetPages(input) {
  const start = clamp(input.level || 2, 1, 12);
  const rows = [];
  const answers = [];
  for (let i = 1; i <= 10; i++) {
    const a = start * 3 + i;
    const b = start + i;
    const subtract = i % 2 === 0;
    rows.push(`${i}. ${a} ${subtract ? '-' : '+'} ${b} = ______`);
    answers.push(`${i}. ${a} ${subtract ? '-' : '+'} ${b} = ${subtract ? a-b : a+b}`);
  }
  return [
    page(input.title, [`Topic: ${input.topic}. Complete the practice set.`, `For: ${input.audience || 'learners'}`, 'Show your working beside each answer.', ...rows, 'Challenge: write your own question and solve it.']),
    page('Practice: explain your thinking', [`Topic: ${input.topic}`, 'Choose two answers from page 1. Explain the steps you used.', 'Question 1: _____________________  My steps: ___________________', '_____________________________________________________________', 'Question 2: _____________________  My steps: ___________________', '_____________________________________________________________', 'Self-check: [ ] I checked each calculation. [ ] I corrected mistakes.']),
    page('Answer key', ['Check answers after finishing the practice pages.', ...answers, 'Discussion answers vary. Look for a clear explanation and correct steps.', 'Teacher note: review the level and examples before classroom use.'])
  ];
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
function sheet(rows) {
  const body = rows.map((row, r) => `<row r="${r+1}">${row.map((value,c)=>{
    const ref=`${col(c+1)}${r+1}`;
    if (typeof value === 'string' && value.startsWith('=')) return `<c r="${ref}"><f>${esc(value.slice(1))}</f><v>0</v></c>`;
    if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const cols=Math.max(1,...rows.map(r=>r.length));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${col(cols)}${rows.length}"/><sheetData>${body}</sheetData></worksheet>`;
}
function workbook(input) {
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const budget=[['Monthly Budget Planner',input.title],['Category','Planned','Actual','Variance'],['Income',0,0,'=C3-B3'],['Housing',0,0,'=B4-C4'],['Food',0,0,'=B5-C5'],['Transport',0,0,'=B6-C6'],['Utilities',0,0,'=B7-C7'],['Health',0,0,'=B8-C8'],['Savings',0,0,'=B9-C9'],['Other',0,0,'=B10-C10'],['Total Expenses','=SUM(B4:B10)','=SUM(C4:C10)','=B11-C11'],['Net Savings','=B3-B11','=C3-C11','=C12-B12'],['Instructions','Enter income and expense amounts. Variance compares planned with actual; net savings is income minus expenses.']];
  const transactions=[['Date','Category','Description','Income','Expense','Balance'],['','','',0,0,'=D2-E2']];
  for(let i=3;i<=32;i++) transactions.push(['','','',0,0,`=F${i-1}+D${i}-E${i}`]);
  const planner=[['12-Month Organizer','Goal','Notes'],...months.map(m=>[m,'','']),['Quarterly review','What worked?','What to change?']];
  const files={
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Budget" sheetId="1" r:id="rId1"/><sheet name="Transactions" sheetId="2" r:id="rId2"/><sheet name="12-Month Plan" sheetId="3" r:id="rId3"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':sheet(budget), 'xl/worksheets/sheet2.xml':sheet(transactions), 'xl/worksheets/sheet3.xml':sheet(planner)
  };
  return zip(files);
}

function quizHtml(input) {
  const questions=(input.questions||[]).slice(0,30).map((q)=>({q:String(q.question||''),a:String(q.answer||''),wrong:(q.wrong||[]).map(String).slice(0,3)}));
  if (questions.length < 3 || questions.some(q=>!q.q||!q.a||q.wrong.length<2)) throw new Error('Add at least 3 questions. Each needs one answer and two incorrect choices.');
  const json=JSON.stringify(questions).replace(/</g,'\\u003c');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.title)}</title><style>body{font:16px system-ui;margin:0;background:#f4f7fb;color:#182438}.wrap{max-width:680px;margin:auto;padding:24px}.card{background:white;border-radius:18px;padding:24px;box-shadow:0 8px 30px #12244415}button{width:100%;padding:14px;margin:7px 0;border:1px solid #ccd6e2;border-radius:10px;background:#fff;font:inherit;text-align:left}button:hover{background:#e7f2ff}#next{background:#153b67;color:white;text-align:center}small{color:#52627a}</style><main class="wrap"><div class="card"><small>OFFLINE QUIZ • ${esc(input.topic)}</small><h1>${esc(input.title)}</h1><p id="status"></p><h2 id="question"></h2><div id="choices"></div><button id="next" hidden>Next</button></div></main><script>const qs=${json};let i=0,score=0;const status=document.getElementById('status'),question=document.getElementById('question'),choices=document.getElementById('choices'),next=document.getElementById('next');function show(){if(i>=qs.length){question.textContent='Finished!';choices.textContent='Your score: '+score+' / '+qs.length;status.textContent='You can restart by refreshing this page.';next.hidden=true;return}status.textContent='Question '+(i+1)+' of '+qs.length;question.textContent=qs[i].q;choices.replaceChildren();next.hidden=true;[qs[i].a,...qs[i].wrong].sort(()=>Math.random()-.5).forEach(x=>{const b=document.createElement('button');b.textContent=x;b.onclick=()=>{if(x===qs[i].a){score++;b.style.borderColor='#17834c'}else b.style.borderColor='#c43b45';[...choices.children].forEach(c=>c.disabled=true);next.hidden=false};choices.append(b)})}next.onclick=()=>{i++;show()};show();</script></html>`;
}

export function createDigitalProduct(input = {}) {
  const kind=String(input.type||'ebook');
  if (!['ebook','coloring','worksheet','budget','organizer','quiz'].includes(kind)) throw new Error('Choose a supported digital product type.');
  const rawTitle=String(input.title||'').trim(), rawTopic=String(input.topic||'').trim();
  if (['ebook','coloring','worksheet'].includes(kind) && /[^\x20-\x7e]/.test([rawTitle,rawTopic,input.audience||'',input.outcome||''].join(' '))) {
    throw new Error('PDF templates currently support English/Latin text only. Use English characters for the title, topic, audience and outcome.');
  }
  if (['budget','organizer','quiz'].includes(kind)) {
    const title=rawTitle.replace(/\s+/g,' ').slice(0,100), topic=rawTopic.replace(/\s+/g,' ').slice(0,120);
    if(title.length<2||topic.length<2)throw new Error('Enter a title and topic using at least 2 characters.');
    const normalized={...input,title,topic,audience:String(input.audience||'').trim(),outcome:String(input.outcome||'').trim()};
    const id=randomUUID();
    if(kind==='budget'||kind==='organizer')return{id,filename:`${slug(title)}.xlsx`,contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook(normalized),label:'Local workbook template; no AI connection used.'};
    return{id,filename:`${slug(title)}.html`,contentType:'text/html; charset=utf-8',buffer:Buffer.from(quizHtml(normalized)),label:'Offline quiz built from your supplied questions; no AI connection used.'};
  }
  const title=safeAscii(input.title).slice(0,100);
  const topic=safeAscii(input.topic).slice(0,120);
  if (title.length<2 || topic.length<2) throw new Error('Enter a title and topic using at least 2 characters.');
  const normalized={...input,title,topic,audience:safeAscii(input.audience||'independent learners'),outcome:safeAscii(input.outcome||'')};
  const id=randomUUID();
  const pages=kind==='ebook'?ebookPages(normalized):kind==='coloring'?coloringPages(normalized):worksheetPages(normalized);
  return {id,filename:`${slug(title)}.pdf`,contentType:'application/pdf',buffer:pdfDocument(title,pages),pages:pages.length,label:'Print-ready starter pages built locally; no AI connection used.'};
}

