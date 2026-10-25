import { createMarketResearchLinks } from './research-links.js';

const $ = (id) => document.getElementById(id);
const state = {
  health:null, projects:[], activeProjectId:'', dashboard:null, ideas:[], selectedIdea:null, analysis:null,
  products:[], currentProduct:null, factoryAssets:[], launchPlan:null, marketSearch:null, currentView:'dashboard', recipes:[], pendingPartnerMessage:''
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
const containsArabic = (value) => /[\u0600-\u06ff]/.test(String(value || ''));
function profileLanguage() {
  const profile=activeProject()?.profile||{};
  return containsArabic([profile.country,profile.skills,profile.payoutMethods].join(' '))?'ar':'en';
}

function showView(name) {
  state.currentView=name;
  document.querySelectorAll('[data-view-panel]').forEach(el=>el.classList.toggle('active',el.dataset.viewPanel===name));
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===name));
  const moreToggle=$('mobileMoreToggle'),moreMenu=$('mobileMoreMenu');
  moreToggle?.classList.toggle('active',['reels','brand','saved','business'].includes(name));
  if(moreMenu)moreMenu.classList.add('hidden');
  moreToggle?.setAttribute('aria-expanded','false');
  window.scrollTo({top:0,behavior:'smooth'});
  if (name==='partner') loadPartner();
}
document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.go)));
$('mobileMoreToggle').addEventListener('click',()=>{
  const menu=$('mobileMoreMenu'),open=menu.classList.toggle('hidden')===false;
  $('mobileMoreToggle').setAttribute('aria-expanded',String(open));
  if(open)menu.querySelector('button')?.focus();
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!$('mobileMoreMenu').classList.contains('hidden')){
    $('mobileMoreMenu').classList.add('hidden');$('mobileMoreToggle').setAttribute('aria-expanded','false');$('mobileMoreToggle').focus();
  }
});

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
    ['Downloadable file',(d.outputs||[]).some(x=>x.type==='digital-product')],
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
  if (!d.products?.length) return ['Turn the selected idea into a priced product offer.','product'];
  if (!(d.outputs||[]).some(x=>x.type==='digital-product')) return ['Build and save the actual downloadable file.','product'];
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
  state.projects.forEach(p=>{const row=document.createElement('button');row.type='button';row.className='saved-row';row.innerHTML='<strong></strong><span></span>';row.querySelector('strong').textContent=p.name;row.querySelector('span').textContent=`${p.status} · ${new Date(p.updatedAt).toLocaleDateString()}`;row.addEventListener('click',async()=>{state.activeProjectId=p.id;fillProjectSelect();await loadWorkspace();showView('dashboard');});pRoot.append(row);});
  const oRoot=$('savedOutputs'); oRoot.replaceChildren();
  const outputs=state.dashboard?.outputs||[];
  if(!outputs.length){oRoot.textContent='No creative packs saved yet.';return;}
  outputs.forEach(o=>{
    const row=document.createElement('button');row.className='saved-row';row.type='button';row.innerHTML='<strong></strong><span></span>';
    row.querySelector('strong').textContent=o.title;row.querySelector('span').textContent=`${o.type} · ${new Date(o.createdAt).toLocaleDateString()} · Open`;
    row.addEventListener('click',()=>{
      if(o.type==='ad-pack'){renderAds(o.payload);showView('ads');}
      else if(o.type==='reel'){renderReel(o.payload);showView('reels');}
      else showView('dashboard');
    });
    oRoot.append(row);
  });
}
function renderFactoryAssets() {
  const root=$('factoryAssets');
  if (!root) return;
  root.replaceChildren();
  if (!state.factoryAssets.length) {
    const empty=document.createElement('p'); empty.className='factory-hint'; empty.textContent='No downloadable files saved in this project yet.'; root.append(empty); return;
  }
  const heading=document.createElement('h3'); heading.textContent='Saved product files'; root.append(heading);
  state.factoryAssets.forEach(asset=>{
    const row=document.createElement('div'); row.className='factory-asset';
    const meta=document.createElement('div'); const title=document.createElement('strong'); title.textContent=asset.filename||asset.title;
    const detail=document.createElement('small'); detail.textContent=[asset.type,asset.pages?asset.pages+' pages':'',asset.label||'',new Date(asset.createdAt).toLocaleDateString()].filter(Boolean).join(' · ');
    meta.append(title,detail);
    const link=document.createElement('a'); link.className='secondary'; link.textContent='Download'; link.href='/api/v2/factory/download?projectId='+encodeURIComponent(state.activeProjectId)+'&fileId='+encodeURIComponent(asset.fileId); link.setAttribute('download',asset.filename||'product');
    const actions=document.createElement('div');actions.className='factory-asset-actions';actions.append(link);
    if(asset.previewFileId){const preview=document.createElement('button');preview.className='secondary';preview.type='button';preview.textContent='Preview / edit';preview.addEventListener('click',()=>showFactoryPreview(asset));actions.append(preview);const companion=document.createElement('a');companion.className='secondary';companion.textContent='Download interactive copy';companion.href='/api/v2/factory/download?projectId='+encodeURIComponent(state.activeProjectId)+'&fileId='+encodeURIComponent(asset.previewFileId);companion.setAttribute('download',asset.previewFilename||'interactive.html');actions.append(companion);}
    row.append(meta,actions); root.append(row);
  });
}
function showFactoryPreview(asset){
  const panel=$('factoryPreview')?.closest('.factory-preview');if(!panel||!asset?.previewFileId)return;
  panel.classList.remove('hidden');$('factoryPreviewTitle').textContent=asset.previewFilename||asset.filename||'Product preview';
  const links=$('factoryDownloadLinks');links.replaceChildren();
  for(const [id,name,label] of [[asset.fileId,asset.filename||'product','Download file'],[asset.previewFileId,asset.previewFilename||'interactive.html','Download interactive copy']]){if(!id)continue;const a=document.createElement('a');a.className='secondary';a.textContent=label;a.href='/api/v2/factory/download?projectId='+encodeURIComponent(state.activeProjectId)+'&fileId='+encodeURIComponent(id);a.setAttribute('download',name);links.append(a);}
  $('factoryPreview').src='/api/v2/factory/download?projectId='+encodeURIComponent(state.activeProjectId)+'&fileId='+encodeURIComponent(asset.previewFileId)+'&inline=1';
  panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderExistingProduct() {
  const p=state.dashboard?.products?.[0];
  if (!p) { state.currentProduct=null; $('productForm').reset(); $('productForm').querySelector('button[type="submit"]').textContent='Build product'; $('productResult').innerHTML='<div class="placeholder"><strong>No product built yet.</strong><p>Choose an idea in Research, or fill the fields and build.</p></div>'; return; }
  renderProduct(p);
}
function renderProduct(p) {
  state.currentProduct=p;
  $('productNameV2').value=p.name||'';
  $('productAudience').value=p.audience||'';
  $('productProblem').value=p.problem||'';
  $('productOutcome').value=p.outcome||'';
  $('productPrice').value=p.price??'';
  $('productCurrency').value=p.currency||'USD';
  $('productForm').querySelector('button[type="submit"]').textContent='Update product';
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
  const data=await api(`/api/v2/recipes?language=${profileLanguage()}`);
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
  restoreFactoryDraft();
  const query=state.activeProjectId?`?projectId=${encodeURIComponent(state.activeProjectId)}`:'';
  state.dashboard=await api('/api/v2/dashboard'+query);
  state.factoryAssets=state.activeProjectId?(await api('/api/v2/factory/assets'+query)).assets||[]:[];
  const savedPlan=state.activeProjectId?await api('/api/v2/launch/plan'+query):{plan:null};
  state.launchPlan=savedPlan.plan||null;
  const savedMarket=state.activeProjectId?await api('/api/v2/research/market'+query):{search:null,available:false};
  state.marketSearch=savedMarket.search||null;
  renderMarketEvidence(state.marketSearch,savedMarket.available);
  fillLaunchForm(state.launchPlan,state.dashboard.activeProject);
  renderLaunchPlan(state.launchPlan);
  state.products=state.dashboard.products||[];
  state.analysis=state.dashboard.research?.payload||null;
  state.selectedIdea=state.analysis?.idea||null;
  state.ideas=[];
  if(state.dashboard.activeProject&&state.analysis){
    try{
      const data=await api('/api/v2/research/ideas',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,language:profileLanguage()})});
      state.ideas=data.ideas||[];
      if(!state.selectedIdea) state.selectedIdea=state.ideas.find(idea=>idea.name===state.analysis.ideaName)||null;
    }catch{}
  }
  profileChips(state.dashboard.activeProject);
  renderIdeas();
  if(state.analysis)renderAnalysis(state.analysis);else $('analysisPanel').classList.add('hidden');
  renderDashboard(); renderPartnerContext(); syncProductSelectors(); renderSaved(); renderExistingProduct(); renderBrand(state.dashboard.brand); renderFactoryAssets();
  if (state.dashboard.activeProject) notice(state.health.v2AiReady
    ? `Workspace ready. ${state.health.v2AiProvider} live AI is enabled for business strategy.`
    : `Workspace ready. Local templates are active; this is simulated output, not live AI. ${state.health.v2AiProvider} is not being called.`,'success');
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
    await loadWorkspace();
    if(state.pendingPartnerMessage){
      const message=state.pendingPartnerMessage;state.pendingPartnerMessage='';showView('partner');await sendPartnerMessage(message);
    }else{showView('research');await findIdeas();}
  }catch(err){$('projectFormError').textContent=err.message;}
});

async function findIdeas() {
  if(!state.activeProjectId){openProjectModal();return;}
  try{
    notice('Ranking ideas for execution fit…');
    const data=await api('/api/v2/research/ideas',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,language:profileLanguage(),includeMarketEvidence:true})});
    state.ideas=data.ideas||[]; state.selectedIdea=null; state.analysis=null; renderIdeas();renderIdeaEvidence(data.marketEvidence,data.dataStatus);
    notice(data.dataStatus||'Ideas ready.','success');
  }catch(e){notice(e.message,'error');}
}
$('findIdeasButton').addEventListener('click',findIdeas);

function renderIdeaEvidence(evidence,dataStatus){
  const root=$('ideaEvidence');
  root.replaceChildren();
  root.classList.remove('hidden');
  const heading=document.createElement('h3');
  heading.textContent='Market research evidence';
  const status=document.createElement('p');
  status.textContent=dataStatus||'Market source status is unavailable.';
  root.append(heading,status);
  if(!evidence?.available){
    const message=document.createElement('p');message.className='notice';
    message.textContent=evidence?.message||'Live search is not configured. No web search was performed.';
    root.append(message);return;
  }
  const disclaimer=document.createElement('small');
  disclaimer.textContent='Search excerpts are source leads, not verified demand, prices or sales.';
  root.append(disclaimer);
  for(const item of evidence.sources||[]){
    const article=document.createElement('article');article.className='market-evidence-item';
    const link=document.createElement('a');link.textContent=item.title;link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';
    const excerpt=document.createElement('p');excerpt.textContent=item.excerpt;
    const meta=document.createElement('small');meta.textContent=[item.publishedAt,item.score===null?'':`Search relevance ${Math.round(item.score*100)}%`].filter(Boolean).join(' · ');
    article.append(link,excerpt,meta);root.append(article);
  }
}
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
    const plan=document.createElement('button');plan.className='secondary';plan.textContent='Plan costs & launch';
    plan.onclick=()=>{
      fillLaunchForm(null,state.dashboard?.activeProject);
      const mapped=idea.type==='ecommerce'?'physical':idea.type;
      if(['digital','physical','service','dropshipping','print_on_demand'].includes(mapped))$('launchBusinessType').value=mapped;
      $('launchProductName').value=idea.name||'';
      $('launchAudience').value=idea.targetCustomer||'';
      $('launchOutcome').value=idea.promise||'';
      syncLaunchBusinessType();showView('business');
    };
    actions.append(analyze,build,plan);card.append(score,h,p,meta,why,actions);root.append(card);
  });
}
async function analyzeIdeaNow(idea) {
  try{
    state.selectedIdea=idea;renderIdeas();notice('Analyzing idea…');
    const data=await api('/api/v2/research/analyze',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,idea,language:profileLanguage()})});
    state.analysis=data.analysis;renderAnalysis(data.analysis);await loadWorkspace(false);notice('Idea analysis saved to the project.','success');
  }catch(e){notice(e.message,'error');}
}
function fillLaunchForm(plan=null,project=null) {
  const values=plan?.inputs||{};
  const defaults={businessType:project?.profile?.businessType, country:project?.profile?.country};
  const map={businessType:'launchBusinessType',productName:'launchProductName',audience:'launchAudience',country:'launchCountry',problem:'launchProblem',outcome:'launchOutcome',marketNotes:'launchMarketNotes',marketSource:'launchMarketSource',marketSourceUrl:'launchMarketSourceUrl',supplierName:'launchSupplierName',supplierSourceUrl:'launchSupplierUrl',currency:'launchCurrency',sellingPrice:'launchSellingPrice',unitCost:'launchUnitCost',shippingCost:'launchShippingCost',packagingCost:'launchPackagingCost',otherCost:'launchOtherCost',platformFeePercent:'launchPlatformFee',marketingCostPerSale:'launchMarketingCost'};
  for(const [key,id] of Object.entries(map)){
    const el=$(id),value=values[key]??defaults[key];
    if(value!==undefined&&value!==null&&value!=='')el.value=String(value);
    else if(key==='businessType')el.value='';
    else if(['productName','audience','problem','outcome','marketNotes','marketSource','marketSourceUrl','supplierName','supplierSourceUrl','sellingPrice'].includes(key))el.value='';
    else if(key==='unitCost')el.value='';
    else if(['shippingCost','packagingCost','otherCost','platformFeePercent','marketingCostPerSale'].includes(key))el.value='0';
  }
  if(!plan&&project?.profile?.businessType==='ecommerce')$('launchBusinessType').value='physical';
  else if(!plan&&!['digital','physical','service','dropshipping','print_on_demand'].includes(project?.profile?.businessType))$('launchBusinessType').value='';
  syncLaunchBusinessType();
}
function syncLaunchBusinessType() {
  const type=$('launchBusinessType').value;
  const supplierRequired=['physical','dropshipping','print_on_demand'].includes(type);
  $('launchSupplierNameWrap').classList.toggle('hidden',!supplierRequired);
  $('launchSupplierUrlWrap').classList.toggle('hidden',!supplierRequired);
  const label=$('launchUnitCostLabel');
  label.childNodes[0].nodeValue=type==='service'?'Delivery / labor cost':type==='digital'?'Production cost':'Supplier / unit cost';
}
function prepareMarketSourceLinks() {
  const root=$('marketSourceLinks');
  if(!root)return;
  root.replaceChildren();
  const links=createMarketResearchLinks({productName:$('launchProductName').value,audience:$('launchAudience').value,country:$('launchCountry').value,businessType:$('launchBusinessType').value});
  if(!links.length){root.textContent='Enter an offer name and target country first.';return;}
  for(const item of links){
    const link=document.createElement('a');link.className='secondary';link.textContent=item.label;link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';root.append(link);
  }
}
$('openMarketSources').addEventListener('click',prepareMarketSourceLinks);
function renderMarketEvidence(search, available=Boolean(state.health?.marketSearchAvailable)) {
  const status=$('marketSearchStatus'),root=$('marketEvidenceResults');
  if(!status||!root)return;
  root.replaceChildren();
  if(!available){
    status.textContent='Live search is unavailable in this preview. No web request was made; the Studio is using local templates. A server-side Tavily key and ENABLE_MARKET_SEARCH=1 are required.';
    return;
  }
  if(!search){status.textContent='Live search is ready. Search results will be retrieved from Tavily and saved to this project.';return;}
  if(search.status!=='live_search_results'){
    status.textContent=search.message||'Live search was not performed.';return;
  }
  status.textContent=`Live search results from ${search.provider} · ${new Date(search.retrievedAt).toLocaleString()} · ${search.sources.length} sources. Snippets and vendor claims are unverified; open source pages before relying on them.`;
  for(const item of search.sources){
    const article=document.createElement('article');article.className='market-evidence-item';
    const title=document.createElement('a');title.textContent=item.title;title.href=item.url;title.target='_blank';title.rel='noopener noreferrer';
    const excerpt=document.createElement('p');excerpt.textContent=item.excerpt;
    const meta=document.createElement('small');meta.textContent=[item.publishedAt,item.score===null?'':`Search relevance ${Math.round(item.score*100)}%`].filter(Boolean).join(' · ');
    article.append(title,excerpt,meta);root.append(article);
  }
  if(!search.sources.length)root.textContent='The provider returned no usable HTTPS sources for this query.';
}
$('searchMarketSources').addEventListener('click',async()=>{
  const button=$('searchMarketSources');
  if(!state.activeProjectId){notice('Create or select a project before searching.','error');return;}
  const productName=$('launchProductName').value.trim(),country=$('launchCountry').value.trim();
  const marketScope=state.dashboard?.activeProject?.profile?.marketScope||'unsure';
  if(productName.length<2||(!['global'].includes(marketScope)&&country.length<2)){notice('Enter an offer name'+(marketScope==='global'?'':' and target country')+' before searching.','error');return;}
  button.disabled=true;button.textContent='Searching…';
  try{
    const data=await api('/api/v2/research/market',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,productName,country,marketScope,audience:$('launchAudience').value.trim(),businessType:$('launchBusinessType').value})});
    state.marketSearch=data.search;renderMarketEvidence(data.search,data.search.available);
    if(data.search.available)notice('Live source results saved to this project. Verify source pages and current offers.','success');
    else notice(data.search.message||'Live search is not configured; no web request was made.');
  }catch(error){notice(error.message,'error');}
  finally{button.disabled=false;button.textContent='Search live sources';}
});
function resultSection(root,title,body) {
  const section=document.createElement('section');section.className='plan-result-section';
  const h=document.createElement('h3');h.textContent=title;section.append(h);
  if(typeof body==='string'){const p=document.createElement('p');p.textContent=body;section.append(p);}
  else if(Array.isArray(body)){const ul=document.createElement('ul');body.forEach(item=>{const li=document.createElement('li');li.textContent=item;ul.append(li);});section.append(ul);}
  root.append(section);
}
function renderLaunchPlan(plan) {
  const root=$('businessPlanResult');root.replaceChildren();
  if(!plan){root.innerHTML='<div class="placeholder"><strong>No launch plan saved yet.</strong><p>Enter your own costs and evidence notes above.</p></div>';return;}
  const title=document.createElement('h2');title.textContent=plan.title;root.append(title);
  const badge=document.createElement('p');badge.className='planner-simulation';badge.textContent=plan.simulationLabel;root.append(badge);
  resultSection(root,plan.marketEvidence.label,plan.marketEvidence.note+(plan.marketEvidence.notes?' '+plan.marketEvidence.notes:''));
  if(plan.marketEvidence.source)resultSection(root,'User-entered market source',plan.marketEvidence.source+(plan.marketEvidence.sourceUrl?' · '+plan.marketEvidence.sourceUrl:''));
  resultSection(root,plan.supplier.status==='not_required'?'Supplier details':'Supplier evidence',plan.supplier.note+(plan.supplier.name?' '+plan.supplier.name:'')+(plan.supplier.quoteUrl?' · '+plan.supplier.quoteUrl:''));
  const e=plan.economics,table=document.createElement('div');table.className='plan-economics';
  const rows=[['Selling price',e.sellingPrice],['Unit / delivery cost',e.unitCost],['Shipping / fulfillment',e.shippingCost],['Packaging',e.packagingCost],['Other variable cost',e.otherCost],['Platform fee',e.platformFee],['Marketing cost per sale',e.marketingCostPerSale],['Total costs',e.totalCosts],['Estimated profit',e.estimatedProfit],['Estimated margin',e.marginPercent+'%'],['Break-even ad cost ceiling',e.breakEvenAdCost]];
  rows.forEach(([label,value])=>{const row=document.createElement('div');const a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=label==='Estimated margin'?String(value)+'%':String(value)+' '+e.currency;row.append(a,b);table.append(row);});
  root.append(table);resultSection(root,'Calculation',e.formula);
  resultSection(root,'Customer validation checklist',plan.researchChecklist);
  if(plan.supplierChecklist?.length)resultSection(root,'Supplier checks',plan.supplierChecklist);
  const ad=document.createElement('section');ad.className='plan-result-section';const h=document.createElement('h3');h.textContent=plan.adDraft.status;const p=document.createElement('p');p.textContent=plan.adDraft.copy;ad.append(h,p);root.append(ad);
  resultSection(root,'Launch checklist',plan.launchChecklist);
  if(plan.digitalFactoryNextStep)resultSection(root,'Digital product file',plan.digitalFactoryNextStep);
}
$('launchBusinessType').addEventListener('change',syncLaunchBusinessType);
$('businessPlanForm').addEventListener('submit',async event=>{
  event.preventDefault();$('businessPlanError').textContent='';
  if(!state.activeProjectId){openProjectModal();return;}
  const payload={
    projectId:state.activeProjectId,businessType:$('launchBusinessType').value,
    productName:$('launchProductName').value.trim(),audience:$('launchAudience').value.trim(),
    country:$('launchCountry').value.trim(),problem:$('launchProblem').value.trim(),outcome:$('launchOutcome').value.trim(),
    marketNotes:$('launchMarketNotes').value.trim(),marketSource:$('launchMarketSource').value.trim(),marketSourceUrl:$('launchMarketSourceUrl').value.trim(),
    supplierName:$('launchSupplierName').value.trim(),supplierSourceUrl:$('launchSupplierUrl').value.trim(),
    currency:$('launchCurrency').value,sellingPrice:Number($('launchSellingPrice').value),unitCost:Number($('launchUnitCost').value),
    shippingCost:Number($('launchShippingCost').value||0),packagingCost:Number($('launchPackagingCost').value||0),
    otherCost:Number($('launchOtherCost').value||0),platformFeePercent:Number($('launchPlatformFee').value||0),
    marketingCostPerSale:Number($('launchMarketingCost').value||0),language:profileLanguage()
  };
  try{
    notice('Calculating from the costs you entered; no market or supplier lookup is running.');
    const data=await api('/api/v2/launch/plan',{method:'POST',body:JSON.stringify(payload)});
    state.launchPlan=data.plan;renderLaunchPlan(data.plan);
    notice('Launch plan saved to this project. Verify every quote before using the estimate.','success');
  }catch(error){$('businessPlanError').textContent=error.message;}
});

function renderAnalysis(a) {
  const root=$('analysisPanel');root.classList.remove('hidden');root.replaceChildren();
  const title=document.createElement('div');title.className='card-head';const h=document.createElement('h3');h.textContent=a.ideaName;const verdict=document.createElement('span');verdict.className='status-pill';verdict.textContent=a.verdict;title.append(h,verdict);root.append(title);
  const vt=document.createElement('p');vt.textContent=a.verdictText;root.append(vt);
  const scores=document.createElement('div');scores.className='score-row';Object.entries(a.scores||{}).forEach(([k,v])=>{const d=document.createElement('div');d.className='score-box';const s=document.createElement('strong');s.textContent=v;const l=document.createElement('span');l.textContent=k;scores.append(d);d.append(s,l);});root.append(scores);
  const cols=document.createElement('div');cols.className='analysis-columns';
  const mk=(title,arr)=>{const sec=document.createElement('section');const h4=document.createElement('h4');h4.textContent=title;const ul=document.createElement('ul');(arr||[]).forEach(v=>{const li=document.createElement('li');li.textContent=v;ul.append(li);});sec.append(h4,ul);return sec;};
  cols.append(mk('Customer problems',a.customerProblems),mk('Selling angles',a.sellingAngles),mk('Differentiation',a.differentiationOpportunities),mk('Validation plan',a.validationPlan));root.append(cols);
  const foot=document.createElement('small');foot.textContent=a.dataStatus||'';root.append(foot);
  const next=document.createElement('button');next.className='secondary';next.type='button';next.textContent='Plan costs & launch';
  next.addEventListener('click',()=>{const idea=state.selectedIdea;if(idea){fillLaunchForm(null,state.dashboard?.activeProject);const mapped=idea.type==='ecommerce'?'physical':idea.type;if(['digital','physical','service','dropshipping','print_on_demand'].includes(mapped))$('launchBusinessType').value=mapped;$('launchProductName').value=idea.name||'';$('launchAudience').value=idea.targetCustomer||'';$('launchOutcome').value=idea.promise||'';syncLaunchBusinessType();}showView('business');});
  root.append(next);
}

const FACTORY_DRAFT_FIELDS=['factoryType','factoryLanguage','factoryTitle','factoryTopic','factoryAudience','factoryOutcome','factoryPages','factoryLevel','factoryQuestionCount','factoryQuestions'];
function factoryDraftKey(){
  return state.activeProjectId?'local-growth-v2:factory-draft:'+state.activeProjectId:'';
}
function saveFactoryDraft(){
  const key=factoryDraftKey();
  if(!key)return;
  try{
    const draft=Object.fromEntries(FACTORY_DRAFT_FIELDS.map(id=>[id,$(id)?.value??'']));
    localStorage.setItem(key,JSON.stringify(draft));
  }catch{}
}
function restoreFactoryDraft(){
  const key=factoryDraftKey();
  if(!key)return;
  try{
    const draft=JSON.parse(localStorage.getItem(key)||'null');
    if(!draft||typeof draft!=='object')return;
    for(const id of FACTORY_DRAFT_FIELDS){
      const field=$(id);
      if(field&&Object.hasOwn(draft,id))field.value=String(draft[id]);
    }
    syncFactoryControls();
  }catch{}
}
for(const id of FACTORY_DRAFT_FIELDS){
  $(id)?.addEventListener('input',saveFactoryDraft);
  $(id)?.addEventListener('change',saveFactoryDraft);
}

function syncFactoryLabels(){
  const arabic=$('factoryLanguage').value==='ar';
  const labels={
    factoryType:arabic?'صيغة المنتج':'Product format',
    factoryLanguage:arabic?'اللغة':'Language',
    factoryTitle:arabic?'عنوان الملف':'File title',
    factoryTopic:arabic?'الموضوع':'Topic',
    factoryAudience:arabic?'الجمهور المستهدف':'Age / audience',
    factoryOutcome:arabic?'النتيجة المطلوبة':'Desired outcome',
    factoryPagesWrap:arabic?'عدد الصفحات':'Pages',
    factoryLevelWrap:arabic?'مستوى أوراق العمل':'Worksheet level',
    factoryQuestionCountWrap:arabic?'عدد الأسئلة (حتى هذا العدد من الأسطر التي أدخلتها)':'Question count (up to this many supplied lines)',
    factoryQuestionsWrap:arabic?'أسئلة الاختبار، سؤال واحد في كل سطر':'Quiz questions, one per line'
  };
  for(const [id,value] of Object.entries(labels)){
    const control=$(id);
    const label=control?.tagName==='LABEL'?control:control?.closest('label');
    const node=label&&Array.from(label.childNodes).find(item=>item.nodeType===Node.TEXT_NODE&&item.textContent.trim());
    if(node)node.textContent=value;
  }
  const formats=arabic
    ? ['كتاب إلكتروني / دفتر عمل متعدد الصفحات','كتاب تلوين وأنشطة','أوراق تعليمية مع مفتاح الإجابات','مخطط ميزانية XLSX مع معاينة للهاتف','ميزانية ومنظّم لمدة 12 شهرًا XLSX','لعبة أسئلة دون اتصال (HTML)']
    : ['Multi-page ebook / workbook','Coloring and activity book','Educational worksheets + answer key','Budget planner XLSX + mobile preview','Budget and 12-month organizer XLSX','Offline questions game (HTML)'];
  Array.from($('factoryType').options).forEach((option,index)=>{if(formats[index])option.textContent=formats[index];});
  $('factoryTitle').placeholder=arabic?'مثال: دفتر عمل عملي للمبتدئين':'A practical starter workbook';
  $('factoryTopic').placeholder=arabic?'ما الذي يعلّمه المنتج أو ينظّمه؟':'What the product teaches or organizes';
  $('factoryAudience').placeholder=arabic?'أصحاب الصالونات المبتدئون، العائلات، أصحاب الأعمال…':'Ages 7–9, families, small businesses…';
  $('factoryOutcome').placeholder=arabic?'ماذا سيتمكن المشتري من إنجازه؟':'What should the buyer be able to do?';
  $('factoryQuestions').placeholder=arabic?'اكتب سؤالًا | الإجابة الصحيحة | إجابة خاطئة 1 | إجابة خاطئة 2':'Question | correct answer | wrong answer 1 | wrong answer 2';
}
function syncFactoryControls(){
  syncFactoryLabels();
  const quiz=$('factoryType').value==='quiz';
  $('factoryQuestionsWrap').classList.toggle('hidden',!quiz);
  $('factoryQuestionCountWrap').classList.toggle('hidden',!quiz);
  $('factoryLevelWrap').classList.toggle('hidden',!['worksheet'].includes($('factoryType').value));
  $('factoryPagesWrap').classList.toggle('hidden',quiz||['budget','organizer'].includes($('factoryType').value));
  if(quiz)$('factoryHint').textContent=$('factoryLanguage').value==='ar'
    ? 'تستخدم اللعبة أسطر الأسئلة المكتملة التي تدخلها فقط. لا تُنشأ أسئلة تلقائيًا ولا يُستدعى مزوّد ذكاء اصطناعي.'
    : 'The quiz uses only complete question rows you provide, up to the selected count. No questions are invented and no AI provider is called.';
  else $('factoryHint').textContent=$('factoryLanguage').value==='ar'
    ? 'ينشئ هذا القالب المحلي الملفات من المعلومات التي تدخلها؛ لا يستدعي خدمة ذكاء اصطناعي. تتضمن منتجات PDF دفتر HTML تفاعليًا للرسم وحفظ الإجابات والطباعة. ملفات XLSX تتضمن معاينة تفاعلية مناسبة للهاتف.'
    : 'This local template factory uses the fields you enter; it does not call an AI service. PDF products include a touch-friendly HTML workbook for drawing and saved answers. Arabic PDFs embed a Unicode font and shape RTL text; their interactive companion can also be printed. XLSX budgets include a phone-friendly interactive preview.';
}
$('factoryType').addEventListener('change',syncFactoryControls);
$('factoryLanguage').addEventListener('change',syncFactoryControls);
syncFactoryControls();
$('factoryForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!state.activeProjectId){openProjectModal();return;}
  const type=$('factoryType').value;
  const questions=type==='quiz'?$('factoryQuestions').value.split(/\r?\n/).map(line=>{
    const [question,answer,...wrong]=line.split('|').map(part=>part.trim());
    return {question,answer,wrong};
  }).filter(item=>item.question):[];
  const body={projectId:state.activeProjectId,productId:state.currentProduct?.id,type,language:$('factoryLanguage').value,title:$('factoryTitle').value.trim(),topic:$('factoryTopic').value.trim(),audience:$('factoryAudience').value.trim(),outcome:$('factoryOutcome').value.trim(),pages:Number($('factoryPages').value),questionCount:Number($('factoryQuestionCount').value),questionsPerPage:10,level:Number($('factoryLevel').value),questions};
  try{
    notice('Creating a real file locally. No AI or paid API call is used.');
    const data=await api('/api/v2/factory/generate',{method:'POST',body:JSON.stringify(body)});
    await loadWorkspace(false);
    showFactoryPreview(data.asset);
    notice('File created and saved to this project: '+data.asset.filename,'success');
  }catch(err){notice(err.message,'error');}
});
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
    const data=await api('/api/v2/products/build',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,productId:state.currentProduct?.id,idea:state.selectedIdea||{},answers,language:profileLanguage()})});
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
async function sendPartnerMessage(message) {
  appendMessage('user',message);
  try{
    const data=await api('/api/v2/partner',{method:'POST',body:JSON.stringify({projectId:state.activeProjectId,message,language:containsArabic(message)?'ar':'en'})});
    appendMessage('assistant',data.reply);
    if(data.nextAction&&['research','product','ads','reels','brand','dashboard'].includes(data.nextAction)){
      const chip=document.createElement('button');chip.className='ghost';chip.textContent=`Open ${data.nextAction}`;chip.onclick=()=>showView(data.nextAction);$('chatMessages').append(chip);
    }
  }catch(err){appendMessage('assistant',`Error: ${err.message}`);}
}
$('partnerForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const input=$('partnerInput');const message=input.value.trim();if(!message)return;input.value='';
  if(!state.activeProjectId){state.pendingPartnerMessage=message;openProjectModal();return;}
  await sendPartnerMessage(message);
});
document.querySelectorAll('[data-prompt]').forEach(btn=>btn.addEventListener('click',()=>{ $('partnerInput').value=btn.dataset.prompt; $('partnerInput').focus(); }));

$('nextActionButton').addEventListener('click',()=>{});
async function boot() {
  try{
    const res=await fetch('/api/health',{signal:AbortSignal.timeout(10000)});if(!res.ok)throw new Error('Studio server unavailable');
    state.health=await res.json();
    $('v2Engine').textContent=state.health.v2AiReady
      ? `${state.health.v2AiProvider} · Live AI`
      : `Local simulation · Not AI (${state.health.v2AiProvider} off)`;
    if(state.health.requiresLogin){
      $('signOutButton').classList.add('hidden');
      $('loginPanel').classList.remove('hidden'); $('studioApp').classList.add('hidden'); return;
    }
    $('signOutButton').classList.remove('hidden');
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
    $('loginCode').value='';$('signOutButton').classList.remove('hidden');$('loginPanel').classList.add('hidden');$('studioApp').classList.remove('hidden');await loadRecipes();await loadWorkspace();
  }catch(err){$('loginError').textContent=err.message;}
});
$('signOutButton').addEventListener('click',async()=>{
  try{
    await api('/api/session',{method:'DELETE'});
    $('signOutButton').classList.add('hidden');
    $('studioApp').classList.add('hidden');
    $('loginPanel').classList.remove('hidden');
    state.activeProjectId=null;
    notice('You are signed out.','success');
  }catch(err){notice(err.message,'error');}
});
boot();


