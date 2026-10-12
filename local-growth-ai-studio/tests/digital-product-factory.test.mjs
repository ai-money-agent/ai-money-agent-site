import test from 'node:test';
import assert from 'node:assert/strict';
import { createDigitalProduct } from '../lib/digital-product-factory.js';

const base={title:'Practical Starter',topic:'healthy routines',audience:'busy adults'};
const questions=[1,2,3].map((n)=>({question:`Question ${n}?`,answer:`Answer ${n}`,wrong:['Wrong A','Wrong B']}));

function zipTextEntry(file,name){
  let offset=0;
  while(offset<file.length-22){
    if(file.readUInt32LE(offset)!==0x04034b50)break;
    const method=file.readUInt16LE(offset+8),size=file.readUInt32LE(offset+18),nameLength=file.readUInt16LE(offset+26),extraLength=file.readUInt16LE(offset+28);
    const entryName=file.subarray(offset+30,offset+30+nameLength).toString();
    const start=offset+30+nameLength+extraLength;
    if(entryName===name){assert.equal(method,0,'expected stored ZIP entry');return file.subarray(start,start+size).toString();}
    offset=start+size;
  }
  throw new Error(`Missing ZIP entry: ${name}`);
}

test('creates real multi-page PDF products offline for ebook, coloring and worksheets',()=>{
  for (const type of ['ebook','coloring','worksheet']) {
    const product=createDigitalProduct({...base,type});
    assert.equal(product.contentType,'application/pdf');
    assert.equal(product.buffer.subarray(0,8).toString(),'%PDF-1.4');
    assert.ok((product.buffer.toString('binary').match(/\/Type \/Page\b/g)||[]).length >= (type==='worksheet'?3:6));
    assert.match(product.label,/no AI connection used/i);
  }
  const worksheet=createDigitalProduct({...base,type:'worksheet'}).buffer.toString('binary');
  assert.match(worksheet,/Answer key/);
  for(const [i,a] of [10,4,14,4,18,4,22,4,26,4].entries()){
    const n=i+1;
    assert.match(worksheet,new RegExp(`${n}\\. [^\\n]* = ${a}`),`answer ${n} should be correct`);
  }
  for(let n=1;n<=60;n++){
    const a=6+n,b=2+n,expected=n%2===0?a-b:a+b;
    assert.ok(worksheet.includes(`${n}. ${a} ${n%2===0?'-':'+'} ${b} = ${expected}`),`worksheet answer ${n} is arithmetically correct`);
  }
  const coloring=createDigitalProduct({...base,type:'coloring'}).buffer.toString('binary');
  assert.match(coloring,/0 0 0 RG/);
  assert.match(coloring,/ellipsePath|c h S/,'coloring PDF includes a closed outlined vector illustration');
});

test('creates a valid XLSX package with usable planning sheets and formulas',()=>{
  const file=createDigitalProduct({...base,type:'budget'}).buffer;
  assert.equal(file.readUInt32LE(0),0x04034b50);
  assert.equal(file.readUInt32LE(file.length-22),0x06054b50);
  assert.ok(file.toString('latin1').includes('xl/workbook.xml'));
  assert.ok(file.toString('latin1').includes('12-Month Plan'));
  const budget=zipTextEntry(file,'xl/worksheets/sheet1.xml');
  assert.match(budget,/<f>SUM\(B4:B10\)<\/f>/,'planned expenses total excludes income');
  assert.match(budget,/<f>SUM\(C4:C10\)<\/f>/,'actual expenses total excludes income');
  assert.match(budget,/<f>B3-B11<\/f>/,'planned net savings subtracts expenses from income');
  assert.match(budget,/<f>C3-C11<\/f>/,'actual net savings subtracts expenses from income');
  assert.match(budget,/Net Savings/);
  const transactions=zipTextEntry(file,'xl/worksheets/sheet2.xml');
  assert.match(transactions,/<f>F2\+D3-E3<\/f>/,'transaction balance rolls forward');
  const mobile=createDigitalProduct({...base,type:'budget'}).preview.buffer.toString();
  assert.match(mobile,/Monthly budget preview/);
  assert.match(mobile,/data-expense/);
  assert.match(mobile,/income-total/,'mobile preview calculates net savings without opening a spreadsheet app');
  assert.match(mobile,/localStorage/,'mobile preview saves entered values locally');
  const previewScript=mobile.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(previewScript,'budget preview contains its calculation script');
  assert.doesNotThrow(()=>new Function(previewScript),'budget preview script parses');
});

test('creates a self-contained playable quiz only from supplied questions',()=>{
  const game=createDigitalProduct({...base,type:'quiz',questions}).buffer.toString();
  assert.match(game,/Question 1\?/);
  assert.match(game,/Your score/);
  assert.throws(()=>createDigitalProduct({...base,type:'quiz',questions:[]}),/at least 3 questions/i);
});

test('validates product type and required fields',()=>{
  assert.throws(()=>createDigitalProduct({...base,type:'unknown'}),/supported/i);
  assert.throws(()=>createDigitalProduct({...base,title:'x'}),/title and topic/i);
  const arabic=createDigitalProduct({type:'ebook',language:'ar',title:'دليل التخطيط',topic:'تنظيم الوقت',audience:'للبالغين',pages:4});
  assert.equal(arabic.contentType,'application/pdf');
  assert.equal(arabic.pages,4);
  assert.match(arabic.buffer.toString('latin1'),/\/Subtype \/Type0/,'Arabic PDF uses a Unicode Type0 font');
  assert.match(arabic.buffer.toString('latin1'),/\/FontFile2/,'Arabic PDF embeds its Unicode font');
  assert.match(arabic.buffer.toString('latin1'),/\/ToUnicode/,'Arabic PDF includes text extraction mapping');
  assert.equal(arabic.preview.contentType,'text/html; charset=utf-8');
  assert.match(arabic.preview.buffer.toString(),/<html lang="ar" dir="rtl">/);
  assert.match(arabic.preview.buffer.toString(),/تنظيم الوقت/);
  assert.match(arabic.preview.buffer.toString(),/window\.print\(\)/);
  assert.match(arabic.preview.buffer.toString(),/localStorage/);
  const arabicWorkbook=createDigitalProduct({type:'budget',language:'ar',title:'ميزانية شهرية',topic:'تنظيم المصروفات'});
  assert.equal(arabicWorkbook.contentType,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const arabicSheet=zipTextEntry(arabicWorkbook.buffer,'xl/worksheets/sheet1.xml');
  assert.match(arabicSheet,/rightToLeft="1"/);
  assert.match(arabicSheet,/صافي الادخار/);
  assert.match(arabicSheet,/<f>B3-B11<\/f>/,'Arabic workbook retains the correct net savings formula');
});

test('PDF products provide real interactive companions with drawing, saved answers and print layout',()=>{
  const coloring=createDigitalProduct({...base,type:'coloring',pages:3});
  assert.equal(coloring.pages,3);
  assert.equal(coloring.preview.contentType,'text/html; charset=utf-8');
  const html=coloring.preview.buffer.toString();
  assert.match(html,/<canvas/);
  assert.match(html,/class="activity-art"/,'interactive coloring sheets include printable outline illustrations');
  assert.match(html,/onpointerdown/);
  assert.match(html,/localStorage/);
  assert.doesNotThrow(()=>new Function(html.match(/<script>([\s\S]*?)<\/script>/)?.[1]),'drawing and saved answer script parses');
  assert.match(html,/@media print/);
  const worksheet=createDigitalProduct({...base,type:'worksheet',pages:2});
  assert.equal(worksheet.pages,4,'requested practice pages each have a matching answer key page');
  const worksheetHtml=worksheet.preview.buffer.toString();
  assert.match(worksheetHtml,/data-answer/);
  const hiddenKey=worksheetHtml.indexOf('<section id="answers"');
  assert.ok(hiddenKey>0);
  assert.doesNotMatch(worksheetHtml.slice(0,hiddenKey),/3\. 9 \+ 5 = 14/,'answer key stays out of the learner pages until revealed');
  assert.match(worksheetHtml.slice(hiddenKey),/3\. 9 \+ 5 = 14/);
});

test('quiz respects the requested question count and preserves Arabic RTL interface',()=>{
  const questions=Array.from({length:5},(_,i)=>({question:`سؤال ${i+1}`,answer:'صحيح',wrong:['خطأ ١','خطأ ٢']}));
  const quiz=createDigitalProduct({...base,type:'quiz',language:'ar',questionCount:3,questions});
  const html=quiz.buffer.toString();
  assert.match(html,/<html lang="ar" dir="rtl">/);
  assert.equal((html.match(/سؤال \d/g)||[]).length,3);
  assert.match(html,/localStorage/);
  assert.doesNotThrow(()=>new Function(html.match(/<script>([\s\S]*?)<\/script>/)?.[1]),'quiz script parses');
});

