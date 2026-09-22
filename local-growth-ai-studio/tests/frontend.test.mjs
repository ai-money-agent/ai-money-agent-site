import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the actual browser script against a minimal DOM; no external dependencies.
function boot({draft={}, recovery=null, job=null, engine='demo', demoAvailable=true, liveAvailable=false}={}) {
  const nodes=new Map();
  const element=()=>({value:'',textContent:'',disabled:false,hidden:false,checked:false,listeners:{},focus(){this.focused=true;},
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
      const body=url==='/api/health' ? {engine,providerPaused:true,requiresLogin:false,generationCost:1,demoGenerationCost:0,demoAvailable,liveAvailable,provider:'anthropic'}
        : url.startsWith('/api/credits') ? {balance:9,generationCost:url.includes('mode=demo') ? 0 : 1}
        : url.startsWith('/api/generations/') ? job
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
  const app=boot({recovery:{id:'saved-request-000001',language:'ar',mode:'demo'},job:{status:'completed',result,credits:{balance:9},generationMode:'demo'}});
  await settle();
  await app.node('recoverResult').listeners.click();
  assert.equal(app.node('hookOutput').textContent,'Recovered');
  assert.equal(app.node('creditsBadge').textContent,'Demo · free');
  assert.equal(app.node('downloadResult').disabled,false);
  assert.ok(app.calls.some(x=>x.url==='/api/generations/saved-request-000001?mode=demo'));
  assert.ok(app.calls.every(x=>!x.options?.method || x.options.method==='GET'));
});
test('legacy recovery without a stored mode uses Live when Live is available',async()=>{
  const result={hook:'Legacy',reelScript:'Script',shotList:['Shot'],onScreenText:['Text'],caption:'Caption',cta:'CTA',adIdeas:['Idea']};
  const app=boot({recovery:{id:'legacy-request-0001',language:'en'},job:{status:'completed',result,credits:{balance:8}},liveAvailable:true});
  await settle();
  await app.node('recoverResult').listeners.click();
  assert.ok(app.calls.some(x=>x.url==='/api/generations/legacy-request-0001?mode=live'));
  assert.equal(app.node('hookOutput').textContent,'Legacy');
});

test('disabled provider notice does not promise active template generation',async()=>{
  const app=boot({engine:'disabled',demoAvailable:false,liveAvailable:false});await settle();
  assert.match(app.node('modeNotice').textContent,/not available/);
});
test('demo mode is selected by default and reports zero-cost credits',async()=>{
  const app=boot(); await settle();
  assert.equal(app.node('creditsBadge').textContent,'Demo · free');
  assert.match(app.node('generationModeHelp').textContent,/never calls Claude or OpenAI/);
});

test('generation waits until the image reader finishes',async()=>{
  const app=boot();await settle();
  vm.runInContext('state.imageLoading = true; runGeneration("ad")',app.context);
  assert.match(app.node('formMessage').textContent,/image preview/);
  assert.ok(app.calls.every(x=>x.url!=='/api/generate'));
});


test('busy-state cleanup does not re-enable an unavailable Live provider',async()=>{
  const app=boot({liveAvailable:false}); await settle();
  app.node('generationLive').disabled=false;
  vm.runInContext('setBusy(false)',app.context);
  assert.equal(app.node('generationLive').disabled,true);
});
