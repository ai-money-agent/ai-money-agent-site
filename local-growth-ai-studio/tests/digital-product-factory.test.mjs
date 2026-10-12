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
  const coloring=createDigitalProduct({...base,type:'coloring'}).buffer.toString('binary');
  assert.match(coloring,/0 0 0 RG/);
  assert.match(coloring,/270 350 m 270 410 l/,'coloring PDF includes its first outlined illustration');
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
  assert.throws(()=>createDigitalProduct({type:'ebook',title:'دليل',topic:'كانفا'}),/English\/Latin text only/i);
  const arabicWorkbook=createDigitalProduct({type:'budget',title:'ميزانية شهرية',topic:'تنظيم المصروفات'});
  assert.equal(arabicWorkbook.contentType,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

