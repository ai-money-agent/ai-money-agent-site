import test from 'node:test';
import assert from 'node:assert/strict';
import { createDigitalProduct } from '../lib/digital-product-factory.js';

const base={title:'Practical Starter',topic:'healthy routines',audience:'busy adults'};
const questions=[1,2,3].map((n)=>({question:`Question ${n}?`,answer:`Answer ${n}`,wrong:['Wrong A','Wrong B']}));

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
  assert.match(worksheet,/1\. 7 \+ 3 = 10/);
  const coloring=createDigitalProduct({...base,type:'coloring'}).buffer.toString('binary');
  assert.match(coloring,/0 0 0 RG/);
});

test('creates a valid XLSX package with usable planning sheets and formulas',()=>{
  const file=createDigitalProduct({...base,type:'budget'}).buffer;
  assert.equal(file.readUInt32LE(0),0x04034b50);
  assert.equal(file.readUInt32LE(file.length-22),0x06054b50);
  assert.ok(file.toString('latin1').includes('xl/workbook.xml'));
  assert.ok(file.toString('latin1').includes('12-Month Plan'));
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
