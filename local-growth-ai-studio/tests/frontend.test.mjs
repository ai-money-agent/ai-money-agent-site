import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the actual browser script against a minimal DOM; no external dependencies.
function boot({draft={}, recovery=null, job=null, engine='demo'}={}) {
  const nodes=new Map();
  const element=()=>({value:'',textContent:'',disabled:false,hidden:false,listeners:{},
    classList:{toggle(){},add(){},remove(){}},
    addEventListener(name,fn){this.listeners[name]=fn;},setAttribute(){},querySelectorAll(){return [];},replaceChildren(){}});
  const node=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  const stored=new Map(recovery ? [['local-growth-studio-recovery-v1',JSON.stringify(recovery)]]:[]);
  const calls=[];
  const context=vm.createContext({
    document:{getElementById:node,querySelectorAll:()=>[],createElement:element},
    localStorage:{getItem:()=>JSON.stringify(draft),setItem(){}},
    sessionStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},
    AbortSignal,crypto:globalThis.crypto,Blob,URL,setTimeout,
    fetch:async(url,options)=>{
      calls.push({url,options});
      const body=url==='/api/health' ? {engine,providerPaused:true,requiresLogin:false,generationCost:1}
        : url==='/api/credits' ? {balance:9,generationCost:1}
        : job;
      return {ok:true,status:200,json:async()=>body};
    }
  });
  vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);
  return {node,calls,context};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('initial load restores text draft without requiring a login event',async()=>{
  const app=boot({draft:{productName:'Blender',description:'Portable',audience:'Students',language:'ar'}});
  await settle();
  assert.equal(app.node('productName').value,'Blender');
  assert.equal(app.node('descriptionCount').textContent,'8');
  assert.equal(app.node('language').value,'ar');
});
test('reload recovery renders the saved pack via GET without generation',async()=>{
  const result={hook:'Recovered',reelScript:'Script',shotList:['Shot'],onScreenText:['Text'],caption:'Caption',cta:'CTA',adIdeas:['Idea']};
  const app=boot({recovery:{id:'saved-request-000001',language:'ar'},job:{status:'completed',result,credits:{balance:9}}});
  await settle();
  await app.node('recoverResult').listeners.click();
  assert.equal(app.node('hookOutput').textContent,'Recovered');
  assert.equal(app.node('creditsBadge').textContent,'9 credits');
  assert.equal(app.node('downloadResult').disabled,false);
  assert.ok(app.calls.some(x=>x.url==='/api/generations/saved-request-000001'));
  assert.ok(app.calls.every(x=>!x.options?.method || x.options.method==='GET'));
});
test('disabled provider notice does not promise active template generation',async()=>{
  const app=boot({engine:'disabled'});await settle();
  assert.match(app.node('modeNotice').textContent,/currently paused/);
});
test('generation waits until the image reader finishes',async()=>{
  const app=boot();await settle();
  vm.runInContext('state.imageLoading = true; runGeneration("ad")',app.context);
  assert.match(app.node('formMessage').textContent,/image preview/);
  assert.ok(app.calls.every(x=>x.url!=='/api/generate'));
});
