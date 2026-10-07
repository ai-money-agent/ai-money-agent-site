const $ = (id) => document.getElementById(id);
const state = {
  health:null, projects:[], activeProjectId:'', dashboard:null, ideas:[], selectedIdea:null, analysis:null,
  products:[], currentProduct:null, currentView:'dashboard', recipes:[]
};

const notice = (text, type='info') => {
  const el = $('globalNotice');
  el.textContent = text;
  el.style.borderColor = type === 'error' ? 'rgba(255,123,138,.45)' : type === 'success' ? 'rgba(103,232,165,.35)' : '';
  el.style.color = type === 'error' ? '#ff9ca7' : type === 'success' ? '#88f0b8' : '';
};
async function api(path, options={}) {
  const init = { ...options, headers:{...(options.body ? {'Content-Type':'application/json'} : {}),...(options.headers||{})}, signal:AbortSignal.timeout(15000) };
  const res = await fetch(path,init);
  let data={};
  try { data=await res.json(); } catch {}
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}
const escapeText = (v) => String(v ?? '');
const activeProject = () => state.projects.find(p=>p.id===state.activeProjectId) || state.dashboard?.activeProject || null;

function showView(name) {
  state.currentView=name;
  document.querySelectorAll('[data-view-panel]').forEach(el=>el.classList.toggle('active',el.dataset.viewPanel===name));
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===name));
  window.scrollTo({top:0,behavior:'smooth'});
  if (name==='partner') loadPartner();
}
document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.go)));

function openProjectModal() { $('projectModal').classList.remove('hidden'); $('newCountry').focus(); }
function closeProjectModal() { $('projectModal').classList.add('hidden'); $('projectFormError').textContent=''; }
$('newProjectButton').addEventListener('click',openProjectModal);
$('emptyStart').addEventListener('click',openProjectModal);
$('closeProjectModal').addEventListener('click',closeProjectModal);
$('cancelProject').addEventListener('click',closeProjectModal);
$('projectModal').addEventListener('click',(e)=>{ if(e.target===$('projectModal')) closeProjectModal(); });

function fillProjectSelect() {
  const select=$('projectSelect');
  select.replaceChildren();
  if (!state.projects.length) {
    const option=document.createElement('option'); option.value=''; option.textContent='No project yet'; select.append(option); select.disabled=true; return;
  }
  select.disabled=false;
  state.projects.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; o.selected=p.id===state.activeProjectId; select.append(o); });
}
$('projectSelect').addEventListener('change',async e=>{ state.activeProjectId=e.target.value; state.selectedIdea=null; state.analysis=null; await loadWorkspace(); });

async function refreshProjects() {
  const data=await api('/api/v2/projects');
  state.projects=data.projects||[];
  if (!state.activeProjectId || !state.projects.some(p=>p.id===state.activeProjectId)) state.activeProjectId=state.projects[0]?.id||'';
  fillProjectSelect();
}

function profileChips(project) {
  const p=project?.profile||{};
  const values=[p.country,p.budget,p.skills,p.timeAvailable,p.businessType,p.marketScope,p.payoutMethods].filter(Boolean);
  const root=$('profileSummary'); root.replaceChildren();
  values.forEach(v=>{ const span=document.createElement('span'); span.className='profile-chip'; span.textContent=v; root.append(span); });
}

function renderProgress() {
  const d=state.dashboard||{};
  const steps=[
    ['Profile',Boolean(d.activeProject)],
    ['Research',Boolean(d.research)],
    ['Product',Boolean(d.products?.length)],
    ['Brand',Boolean(d.brand)],
    ['Ads / Reel',Boolean(d.outputs?.length)],
    ['Launch',d.activeProject?.status==='launched'||d.activeProject?.status==='optimizing'],
    ['Analytics',false],
    ['Optimize',d.activeProject?.status==='optimizing']
  ];
  const grid=$('progressGrid'); grid.replaceChildren();
  steps.forEach(([label,done],i)=>{ const el=document.createElement('div'); el.className=`progress-item ${done?'done':''}`; el.innerHTML=`<strong>${done?'✓ ':''}${label}</strong><span>Step ${i+1}</span>`; grid.append(el); });
}
function bestNextAction() {
  const d=state.dashboard||{};
  if (!d.activeProject) return ['Create a project profile first.','research'];
  if (!d.research) return ['Find and analyze one product idea before building anything.','research'];
  if (!d.products?.length) return ['Turn the selected idea into the smallest sellable product.','product'];
  if (!d.brand) return ['Create the Brand Profile so future content stays consistent.','brand'];
  const hasAds=(d.outputs||[]).some(x=>x.type==='ad-pack');
  const hasReel=(d.outputs||[]).some(x=>x.type==='reel');
  if (!hasAds) return ['Create four ad angles for the saved product.','ads'];
  if (!hasReel) return ['Create one Reel script to test alongside the ads.','reels'];
  return ['Your validation assets are ready. Review the offer, payment/delivery route and approval gate before any real launch.','partner'];
}
function renderDashboard() {
  const d=state.dashboard;
  const has=Boolean(d?.activeProject);
  $('emptyDashboard').classList.toggle('hidden',has);
  $('dashboardContent').classList.toggle('hidden',!has);
  if (!has) return;
  $('dashboardProjectName').textContent=d.activeProject.name;
  $('projectStatus').textContent=d.activeProject.status;
  $('metricProducts').textContent=String(d.products?.length||0);
  $('metricOutputs').textContent=String(d.outputs?.length||0);
  $('metricTasks').textContent=String(d.tasks?.length||0);
  renderProgress();
  const [text,target]=bestNextAction();
  $('nextActionText').textContent=text;
  $('nextActionButton').onclick=()=>showView(target);
}
function renderPartnerContext() {
  const root=$('partnerContext'); root.replaceChildren();
  const d=state.dashboard||{};
  if (!d.activeProject) { root.textContent='Create a project first.'; return; }
  const dl=document.createElement('dl');
  const entries=[
    ['Project',d.activeProject.name],
    ['Status',d.activeProject.status],
    ['Research',d.research?.ideaName||'Not selected'],
    ['Product',d.products?.[0]?.name||'Not built'],
    ['Brand',d.brand?.name||'Not created'],
    ['Saved packs',String(d.outputs?.length||0)]
  ];
  entries.forEach(([k,v])=>{ const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v;dl.append(dt,dd); });
  root.append(dl);
}
function syncProductSelectors() {
  state.products=state.dashboard?.products||[];
  ['adsProductSelect','reelProductSelect','brandProductSelect'].forEach(id=>{
    const s=$(id); const old=s.value; s.replaceChildren();
    if (!state.products.length){const o=document.createElement('option');o.value='';o.textContent='Create a product first';s.append(o);s.disabled=true;return;}
    s.disabled=false; state.products.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;o.selected=p.id===old;s.append(o);});
  });
}
function renderSaved() {
  const pRoot=$('savedProjects'); pRoot.replaceChildren();
  state.projects.forEach(p=>{const row=document.createElement('div');row.className='saved-row';row.innerHTML=`<strong></strong><span></span>`;row.querySelector('strong').textContent=p.name;row.querySelector('span').textContent=`${p.status} · ${new Date(p.updatedAt).toLocaleDateString()}`;row.addEventListener('click',async()=>{state.activeProjectId=p.id;fillProjectSelect();await loadWorkspace();showView('dashboard');});pRoot.append(row);});
  const oRoot=$('savedOutputs'); oRoot.replaceChildren();
  const outputs=state.dashboard?.outputs||[];
  if(!outputs.length){oRoot.textContent='No creative packs saved yet.';return;}
  outputs.forEach(o=>{const row=document.createElement('div');row.className='saved-row';row.innerHTML='<strong></strong><span></span>';row.querySelector('strong').textContent=o.title;row.querySelector('span').textContent=`${o.type} · ${new Date(o.createdAt).toLocaleDateString()}`;oRoot.append(row);});
}
function renderExistingProduct() {
  const p=state.dashboard?.products?.[0];
  if (!p) { $('productResult').innerHTML='<div class="placeholder"><strong>No product built yet.</strong><p>Choose an idea in Research, or fill the fields and build.</p></div>'; return; }
  renderProduct(p);
}
function renderProduct(p) {
  state.currentProduct=p;
  const root=$('productResult'); root.replaceChildren();
  const h=document.createElement('h2');h.textContent=p.name;root.append(h);
  const intro=document.createElement('p');intro.textContent=p.description||'';root.append(intro);
  const list=document.createElement('div');list.className='output-list';
  const items=[['Audience',p.audience],['Problem',p.problem],['Outcome',p.outcome],['USP',p.usp],['Price',p.price!=null?`${p.price} ${p.currency||'USD'}`:'—'],['Offer',p.offer],['Bonus',p.bonus],['Delivery',p.delivery],['Refund policy',p.refundPolicy]];
  items.forEach(([k,v])=>{if(!v)return;const d=document.createElement('div');const strong=document.createElement('strong');strong.textContent=k;const span=document.createElement('span');span.textContent=v;d.append(strong,span);list.append(d);});
  root.append(list);
}
function renderBrand(brand) {
  const root=$('brandResult'); root.replaceChildren();
  if(!brand){root.innerHTML='<div class="placeholder"><strong>No brand profile yet.</strong><p>Generate one after creating a product.</p></div>';return;}
  const h=document.createElement('h2');h.textContent=brand.name;root.append(h);
  const p=document.createElement('p');p.textContent=brand.tagline||'';root.append(p);
  const colors=document.createElement('div');colors.className='color-row';(brand.colors||[]).forEach(c=>{const s=document.createElement('span');s.className='swatch';s.style.background=c;s.title=c;colors.append(s);});root.append(colors);
  const list=document.createElement('div');list.className='output-list';
  [['Voice',(brand.voice||[]).join(' · ')],['Tone',brand.tone],['Description',brand.description],['Buyer',brand.buyerPersona?.who],['Pain',brand.buyerPersona?.pain],['Desire',brand.buyerPersona?.desire]].forEach(([k,v])=>{if(!v)return;const d=document.createElement('div');d.innerHTML='<strong></strong><span></span>';d.querySelector('strong').textContent=k;d.querySelector('span').textContent=v;list.append(d);});
  root.append(list);
}

async function loadRecipes() {
  const data=await api('/api/v2/recipes?language=en');
  state.recipes=data.recipes||[];
  const root=$('recipeGrid'); root.replaceChildren();
  state.recipes.forEach(r=>{
    const card=document.createElement('div');card.className='recipe';
    const strong=document.createElement('strong');strong.textContent=r.name;
    const button=document.createElement('button');button.className='ghost';button.type='button';button.textContent='Start';button.addEventListener('click',()=>runRecipe(r));
    card.append(strong,button);root.append(card);
  });
}
async function runRecipe(recipe) {
  if(!state.activeProjectId){openProjectModal();return;}
  try{
    await api('/api/v2/tasks',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,recipe:recipe.id})});
    const routes={'find-product':'research','launch-product':'product','meta-campaign':'ads','viral-reel':'reels','improve-offer':'product','analyze-campaign':'partner','7-day-content':'partner','landing-page':'partner'};
    notice(`${recipe.name} added to Tasks.`,'success');
    await loadWorkspace(false); showView(routes[recipe.id]||'dashboard');
  }catch(e){notice(e.message,'error');}
}

async function loadWorkspace(showLoading=true) {
  if(showLoading) notice('Loading workspace…');
  await refreshProjects();
  const query=state.activeProjectId?`?projectId=${encodeURIComponent(state.activeProjectId)}`:'';
  state.dashboard=await api('/api/v2/dashboard'+query);
  state.products=state.dashboard.products||[];
  profileChips(state.dashboard.activeProject);
  renderDashboard(); renderPartnerContext(); syncProductSelectors(); renderSaved(); renderExistingProduct(); renderBrand(state.dashboard.brand);
  if (state.dashboard.activeProject) notice('V2 workspace ready. Strategy flows run locally; no paid API call is required.','success');
  else notice('Create your first project to start from zero.');
}

$('projectForm').addEventListener('submit',async e=>{
  e.preventDefault(); $('projectFormError').textContent='';
  const body={
    name:$('newProjectName').value.trim()||'My online business project',
    country:$('newCountry').value.trim(),
    budget:$('newBudget').value.trim(),
    skills:$('newSkills').value.trim(),
    timeAvailable:$('newTime').value.trim(),
    businessType:$('newBusinessType').value,
    marketScope:$('newMarketScope').value,
    payoutMethods:$('newPayouts').value.trim()
  };
  try{
    const data=await api('/api/v2/projects',{method:'POST',body:JSON.stringify(body)});
    state.activeProjectId=data.project.id; closeProjectModal(); $('projectForm').reset();
    await loadWorkspace(); showView('research'); await findIdeas();
  }catch(err){$('projectFormError').textContent=err.message;}
});

async function findIdeas() {
  if(!state.activeProjectId){openProjectModal();return;}
  try{
    notice('Ranking ideas for execution fit…');
    const data=await api('/api/v2/research/ideas',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,language:'en'})});
    state.ideas=data.ideas||[]; state.selectedIdea=null; state.analysis=null; renderIdeas();
    notice(data.dataStatus||'Ideas ready.','success');
  }catch(e){notice(e.message,'error');}
}
$('findIdeasButton').addEventListener('click',findIdeas);

function renderIdeas() {
  const root=$('ideasGrid');root.replaceChildren();
  if(!state.ideas.length){const p=document.createElement('p');p.className='notice';p.textContent='Tap “Find ideas” to rank business ideas from your project profile.';root.append(p);return;}
  state.ideas.forEach(idea=>{
    const card=document.createElement('article');card.className='idea-card'+(state.selectedIdea?.id===idea.id?' selected':'');
    const score=document.createElement('div');score.className='idea-score';score.innerHTML='<span class="kicker">EXECUTION FIT</span><strong></strong>';score.querySelector('strong').textContent=String(idea.score);
    const h=document.createElement('h3');h.textContent=idea.name;
    const p=document.createElement('p');p.textContent=idea.promise;
    const meta=document.createElement('div');meta.className='idea-meta';[idea.type,idea.setupCost,`Competition: ${idea.competition}`].forEach(v=>{const s=document.createElement('span');s.textContent=v;meta.append(s);});
    const why=document.createElement('p');why.textContent=idea.differentiation;
    const actions=document.createElement('div');actions.className='idea-actions';
    const analyze=document.createElement('button');analyze.className='secondary';analyze.textContent='Analyze';analyze.onclick=()=>analyzeIdeaNow(idea);
    const build=document.createElement('button');build.className='ghost';build.textContent='Use this idea';build.onclick=async()=>{state.selectedIdea=idea;renderIdeas();await analyzeIdeaNow(idea);showView('product');};
    actions.append(analyze,build);card.append(score,h,p,meta,why,actions);root.append(card);
  });
}
async function analyzeIdeaNow(idea) {
  try{
    state.selectedIdea=idea;renderIdeas();notice('Analyzing idea…');
    const data=await api('/api/v2/research/analyze',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,idea,language:'en'})});
    state.analysis=data.analysis;renderAnalysis(data.analysis);await loadWorkspace(false);notice('Idea analysis saved to the project.','success');
  }catch(e){notice(e.message,'error');}
}
function renderAnalysis(a) {
  const root=$('analysisPanel');root.classList.remove('hidden');root.replaceChildren();
  const title=document.createElement('div');title.className='card-head';const h=document.createElement('h3');h.textContent=a.ideaName;const verdict=document.createElement('span');verdict.className='status-pill';verdict.textContent=a.verdict;title.append(h,verdict);root.append(title);
  const vt=document.createElement('p');vt.textContent=a.verdictText;root.append(vt);
  const scores=document.createElement('div');scores.className='score-row';Object.entries(a.scores||{}).forEach(([k,v])=>{const d=document.createElement('div');d.className='score-box';const s=document.createElement('strong');s.textContent=v;const l=document.createElement('span');l.textContent=k;scores.append(d);d.append(s,l);});root.append(scores);
  const cols=document.createElement('div');cols.className='analysis-columns';
  const mk=(title,arr)=>{const sec=document.createElement('section');const h4=document.createElement('h4');h4.textContent=title;const ul=document.createElement('ul');(arr||[]).forEach(v=>{const li=document.createElement('li');li.textContent=v;ul.append(li);});sec.append(h4,ul);return sec;};
  cols.append(mk('Customer problems',a.customerProblems),mk('Selling angles',a.sellingAngles),mk('Differentiation',a.differentiationOpportunities),mk('Validation plan',a.validationPlan));root.append(cols);
  const foot=document.createElement('small');foot.textContent=a.dataStatus||'';root.append(foot);
}

$('productForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!state.activeProjectId){openProjectModal();return;}
  const answers={
    name:$('productNameV2').value.trim(),
    audience:$('productAudience').value.trim(),
    problem:$('productProblem').value.trim(),
    outcome:$('productOutcome').value.trim(),
    price:$('productPrice').value ? Number($('productPrice').value) : undefined,
    currency:$('productCurrency').value
  };
  try{
    notice('Building the smallest sellable version…');
    const data=await api('/api/v2/products/build',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,idea:state.selectedIdea||{},answers,language:'en'})});
    renderProduct(data.product);await loadWorkspace(false);notice('Product blueprint saved.','success');
  }catch(err){notice(err.message,'error');}
});

$('generateAds').addEventListener('click',async()=>{
  const productId=$('adsProductSelect').value;if(!productId){notice('Create a product first.','error');return;}
  try{
    notice('Creating four ad angles…');
    const data=await api('/api/v2/ads/generate',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,productId,language:$('adsLanguage').value})});
    renderAds(data.pack);await loadWorkspace(false);notice('Four ad variants saved. Nothing was launched.','success');
  }catch(e){notice(e.message,'error');}
});
function renderAds(pack) {
  const root=$('adsGrid');root.replaceChildren();
  (pack?.variants||[]).forEach(v=>{
    const card=document.createElement('article');card.className='ad-card';
    const angle=document.createElement('span');angle.className='angle';angle.textContent=v.label;
    const h=document.createElement('h3');h.textContent=v.headline;
    const p=document.createElement('p');p.textContent=v.primaryText;
    const desc=document.createElement('small');desc.textContent=`${v.description} · CTA: ${v.cta}`;
    const why=document.createElement('small');why.textContent=`Why test it: ${v.why}`;
    const visual=document.createElement('small');visual.textContent=`Visual: ${v.visualConcept}`;
    card.append(angle,h,p,desc,why,visual);root.append(card);
  });
}

$('generateReel').addEventListener('click',async()=>{
  const productId=$('reelProductSelect').value;if(!productId){notice('Create a product first.','error');return;}
  try{
    notice('Building Reel pack…');
    const data=await api('/api/v2/reels/generate',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,productId,language:$('reelLanguage').value})});
    renderReel(data.pack);await loadWorkspace(false);notice('Reel saved. No video provider was called.','success');
  }catch(e){notice(e.message,'error');}
});
function renderReel(r) {
  const root=$('reelResult');root.replaceChildren();
  const h=document.createElement('h2');h.textContent=r.hook;root.append(h);
  const p=document.createElement('p');p.textContent=r.voiceover;root.append(p);
  const scenes=document.createElement('div');scenes.className='scene-list';(r.scenes||[]).forEach(s=>{const row=document.createElement('div');row.className='scene';const t=document.createElement('time');t.textContent=s.seconds;const div=document.createElement('div');const strong=document.createElement('strong');strong.textContent=s.shot;const small=document.createElement('small');small.textContent=s.text;div.append(strong,document.createElement('br'),small);row.append(t,div);scenes.append(row);});root.append(scenes);
  const list=document.createElement('div');list.className='output-list';[['Caption',r.caption],['CTA',r.cta],['On-screen text',(r.onScreenText||[]).join(' · ')]].forEach(([k,v])=>{const d=document.createElement('div');d.innerHTML='<strong></strong><span></span>';d.querySelector('strong').textContent=k;d.querySelector('span').textContent=v;list.append(d);});root.append(list);
}

$('generateBrand').addEventListener('click',async()=>{
  const productId=$('brandProductSelect').value;if(!productId){notice('Create a product first.','error');return;}
  try{
    notice('Building brand profile…');
    const data=await api('/api/v2/brand/generate',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,productId,language:$('brandLanguage').value})});
    renderBrand(data.brand);await loadWorkspace(false);notice('Brand Profile saved.','success');
  }catch(e){notice(e.message,'error');}
});

async function loadPartner() {
  const root=$('chatMessages');root.replaceChildren();
  if(!state.activeProjectId){const div=document.createElement('div');div.className='message-row assistant';div.textContent='Create a project first so I can keep your business context.';root.append(div);return;}
  try{
    const data=await api(`/api/v2/partner/messages?projectId=${encodeURIComponent(state.activeProjectId)}`);
    const msgs=data.messages||[];
    if(!msgs.length){const div=document.createElement('div');div.className='message-row assistant';div.textContent='Tell me where you are stuck. If you are starting from zero, say: “I want to make money online and I do not know what to sell.”';root.append(div);}
    else msgs.forEach(m=>appendMessage(m.role,m.content));
  }catch(e){notice(e.message,'error');}
}
function appendMessage(role,content) {
  const root=$('chatMessages');const div=document.createElement('div');div.className=`message-row ${role==='user'?'user':'assistant'}`;div.textContent=content;root.append(div);root.scrollTop=root.scrollHeight;
}
$('partnerForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!state.activeProjectId){openProjectModal();return;}
  const input=$('partnerInput');const message=input.value.trim();if(!message)return;input.value='';appendMessage('user',message);
  try{
    const data=await api('/api/v2/partner',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,message,language:'en'})});
    appendMessage('assistant',data.reply);
    if(data.nextAction&&['research','product','ads','reels','brand','dashboard'].includes(data.nextAction)){
      const chip=document.createElement('button');chip.className='ghost';chip.textContent=`Open ${data.nextAction}`;chip.onclick=()=>showView(data.nextAction);$('chatMessages').append(chip);
    }
  }catch(err){appendMessage('assistant',`Error: ${err.message}`);}
});
document.querySelectorAll('[data-prompt]').forEach(btn=>btn.addEventListener('click',()=>{ $('partnerInput').value=btn.dataset.prompt; $('partnerInput').focus(); }));

$('nextActionButton').addEventListener('click',()=>{});
async function boot() {
  try{
    const res=await fetch('/api/health',{signal:AbortSignal.timeout(10000)});if(!res.ok)throw new Error('Studio server unavailable');
    state.health=await res.json();
    $('v2Engine').textContent=state.health.liveAvailable ? `Strategy + ${state.health.provider}` : 'Strategy Engine · Free';
    if(state.health.requiresLogin){
      $('loginPanel').classList.remove('hidden'); $('studioApp').classList.add('hidden'); return;
    }
    $('loginPanel').classList.add('hidden');$('studioApp').classList.remove('hidden');
    await loadRecipes();await loadWorkspace();
  }catch(e){
    $('loginPanel').classList.remove('hidden');$('loginPanel').querySelector('p').textContent='The Studio backend is unavailable. '+e.message;
  }
}
$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();$('loginError').textContent='';
  try{
    await api('/api/session',{method:'POST',body:JSON.stringify({accessCode:$('loginCode').value})});
    $('loginCode').value='';$('loginPanel').classList.add('hidden');$('studioApp').classList.remove('hidden');await loadRecipes();await loadWorkspace();
  }catch(err){$('loginError').textContent=err.message;}
});
boot();
