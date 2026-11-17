const $ = (id) => document.getElementById(id);
const presets = {
  social:{label:'Social post · square',w:1080,h:1080,unit:'px',tag:'SOCIAL POST'},
  story:{label:'Story / Reel cover',w:1080,h:1920,unit:'px',tag:'STORY'},
  marketplace:{label:'Product listing image',w:1200,h:1200,unit:'px',tag:'PRODUCT'},
  flyer:{label:'Flyer · A4 portrait',w:2480,h:3508,unit:'px',tag:'FLYER'},
  cover:{label:'Book / ebook cover',w:1600,h:2560,unit:'px',tag:'COVER'},
  label:{label:'Product label · print file',w:80,h:120,unit:'mm',tag:'PRODUCT LABEL'},
  insert:{label:'Package insert · A5',w:148,h:210,unit:'mm',tag:'THANK YOU'},
  slide:{label:'Presentation slide · 16:9',w:1920,h:1080,unit:'px',tag:'PRESENTATION'},
  banner:{label:'Web / store banner',w:1920,h:640,unit:'px',tag:'BANNER'},
  businesscard:{label:'Business card · print file',w:90,h:50,unit:'mm',tag:'BUSINESS CARD'},
  catalog:{label:'Catalog / brochure page · A4',w:2480,h:3508,unit:'px',tag:'CATALOG'},
  pricetag:{label:'Product price tag · print file',w:60,h:90,unit:'mm',tag:'PRICE TAG'},
  logo:{label:'Logo / wordmark',w:1200,h:600,unit:'px',tag:'BRAND'}
};
let photoData='';
let activeProjectContext=null;
let savedDesigns=[];
let layoutOffsets={};
let dragState=null;
let customElements=[];
let nextCustomId=1;
function value(id){return $(id)?.value?.trim()||''}
function esc(s){return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]))}
function stateFromForm(){
  const type=value('designType'),p=presets[type]||presets.social;
  const w=Math.max(50,Math.min(5000,Number(value('designWidth'))||p.w));
  const h=Math.max(50,Math.min(7000,Number(value('designHeight'))||p.h));
  return {type,w,h,unit:value('designUnit')||p.unit,title:value('designTitle'),subtitle:value('designSubtitle'),brand:value('designBrand'),cta:value('designCta'),color:value('designColor')||'#102846',accent:value('designAccent')||'#59ddb0',photo:photoData};
}
function wrapMeasured(text,maxWidth,fontSize,maxLines=3,bold=false){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 ctx.font=(bold?'700 ':'')+fontSize+'px Arial';
 const words=String(text).trim().split(/\s+/).filter(Boolean),lines=[];let line='',clipped=false;
 for(const word of words){
  const next=line?line+' '+word:word;
  if(ctx.measureText(next).width<=maxWidth||!line){line=next;continue}
  lines.push(line);line=word;
  if(lines.length>=maxLines){clipped=true;break}
 }
 if(line&&!clipped)lines.push(line);
 if(clipped||lines.length>maxLines){
  const lastIndex=maxLines-1;let last=lines[lastIndex]||'';
  while(last&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1).trimEnd();
  lines.length=maxLines;lines[lastIndex]=(last||'…')+'…';
 }
 return lines.length?lines:[''];
}
function customElementsSvg(d){
 return customElements.map(el=>{
  let node='';
  if(el.type==='text'){
   node='<text x="'+(el.x*d.w)+'" y="'+(el.y*d.h)+'" fill="'+esc(el.color)+'" font-family="Arial,sans-serif" font-size="'+el.fontSize+'" font-weight="700">'+esc(el.text||'Your text')+'</text>';
  }else if(el.type==='rectangle'){
   node='<rect x="'+(el.x*d.w)+'" y="'+(el.y*d.h)+'" width="'+(el.width*d.w)+'" height="'+(el.height*d.h)+'" rx="'+(Math.min(d.w,d.h)*.025)+'" fill="'+esc(el.color)+'"/>';
  }else{
   node='<circle cx="'+(el.x*d.w)+'" cy="'+(el.y*d.h)+'" r="'+(el.radius*Math.min(d.w,d.h))+'" fill="'+esc(el.color)+'"/>';
  }
  const key='custom-'+el.id,off=layoutOffsets[key]||{x:0,y:0};
  return '<g data-design-object="'+key+'" transform="translate('+off.x+' '+off.y+')">'+node+'</g>';
 }).join('');
}
function svgFor(d){
 const w=d.w,h=d.h,short=Math.min(w,h),pad=short*.075;
 const offset=(name)=>{const p=layoutOffsets[name]||{x:0,y:0};return ' data-design-object="'+name+'" transform="translate('+p.x+' '+p.y+')"';};
 const group=(name,content)=>'<g'+offset(name)+'>'+content+'</g>';
 const font=short*.052,titleSize=short*.082;
 if(d.type==='logo'){
  const name=esc(d.brand||d.title||'YOUR BRAND'),tag=esc(d.subtitle||'');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+d.w+d.unit+'" height="'+d.h+d.unit+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+name+' logo"><rect width="'+w+'" height="'+h+'" rx="'+(short*.12)+'" fill="'+esc(d.color)+'"/>'+group('symbol','<circle cx="'+(w*.24)+'" cy="'+(h*.5)+'" r="'+(h*.25)+'" fill="'+esc(d.accent)+'"/><path d="M '+(w*.13)+' '+(h*.52)+' L '+(w*.22)+' '+(h*.62)+' L '+(w*.36)+' '+(h*.37)+'" fill="none" stroke="'+esc(d.color)+'" stroke-width="'+(h*.035)+'" stroke-linecap="round" stroke-linejoin="round"/>')+group('brand','<text x="'+(w*.43)+'" y="'+(h*.48)+'" dominant-baseline="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="'+(h*.12)+'" font-weight="700">'+name+'</text>')+group('subtitle','<text x="'+(w*.43)+'" y="'+(h*.69)+'" fill="'+esc(d.accent)+'" font-family="Arial,sans-serif" font-size="'+(h*.055)+'" letter-spacing="2">'+tag+'</text>')+customElementsSvg(d)+'</svg>';
 }
 const label=presets[d.type]?.tag||'DESIGN';
 const isStory=h>w*1.3,isWide=w>h*1.3;
 const titleX=pad,titleY=isStory?h*.19:h*.28,brandY=pad*1.5,footerY=isStory?h*.86:h*.91;
 const titleWidth=isWide?w*.40:w-pad*2;
 const titleSizeFit=short*.072,subtitleSize=short*.043;
 const titleLines=wrapMeasured(d.title||'Your product title',titleWidth,titleSizeFit,2,true);
 const subLines=wrapMeasured(d.subtitle||'A clear promise for the right customer.',titleWidth,subtitleSize,3,false);
 const subStart=titleY+titleLines.length*titleSizeFit*1.12+short*.025;
 const contentBottom=subStart+(subLines.length-1)*subtitleSize*1.3+subtitleSize;
 const squareImageY=Math.max(h*.54,contentBottom+short*.04);
 const storyImageY=Math.max(h*.39,contentBottom+short*.035);
 const imageBox=isStory
   ?{x:pad,y:storyImageY,w:w-pad*2,h:Math.max(short*.10,Math.min(h*.32,h*.80-storyImageY))}
   :isWide
     ?{x:w*.55,y:h*.19,w:w*.38,h:h*.62}
     :{x:w*.17,y:squareImageY,w:w*.66,h:Math.max(short*.10,Math.min(short*.25,h*.81-squareImageY))};
 const shape=isStory?'<circle cx="0" cy="'+(h*.85)+'" r="'+(short*.42)+'" fill="'+esc(d.accent)+'" opacity=".16"/>':'<circle cx="'+(w*.92)+'" cy="'+(h*.08)+'" r="'+(short*.24)+'" fill="'+esc(d.accent)+'" opacity=".18"/>';
 const title=titleLines.map((line,i)=>'<text x="'+titleX+'" y="'+(titleY+i*titleSizeFit*1.12)+'" fill="#ffffff" font-family="Arial,sans-serif" font-size="'+titleSizeFit+'" font-weight="700">'+esc(line)+'</text>').join('');
 const subtitle=subLines.map((line,i)=>'<text x="'+titleX+'" y="'+(subStart+i*subtitleSize*1.3)+'" fill="#ecf5ff" opacity=".92" font-family="Arial,sans-serif" font-size="'+subtitleSize+'">'+esc(line)+'</text>').join('');
 const photo=d.photo?'<image href="'+d.photo+'" x="'+imageBox.x+'" y="'+imageBox.y+'" width="'+imageBox.w+'" height="'+imageBox.h+'" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>':'<rect x="'+imageBox.x+'" y="'+imageBox.y+'" width="'+imageBox.w+'" height="'+imageBox.h+'" rx="'+(short*.035)+'" fill="'+esc(d.accent)+'" opacity=".20"/><text x="'+(imageBox.x+imageBox.w/2)+'" y="'+(imageBox.y+imageBox.h/2)+'" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="'+(font*.75)+'">ADD PRODUCT PHOTO</text>';
 const ctaText=esc(d.cta||'LEARN MORE'),brandText=esc(d.brand||'YOUR BRAND');
 return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+d.w+d.unit+'" height="'+d.h+d.unit+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(d.title)+'"><defs><linearGradient id="fade" x2="1" y2="1"><stop stop-color="'+esc(d.color)+'"/><stop offset="1" stop-color="#091321"/></linearGradient><clipPath id="photoClip"><rect x="'+imageBox.x+'" y="'+imageBox.y+'" width="'+imageBox.w+'" height="'+imageBox.h+'" rx="'+(short*.035)+'"/></clipPath></defs><rect width="'+w+'" height="'+h+'" fill="url(#fade)"/>'+shape+group('brand','<rect x="'+pad+'" y="'+(brandY-short*.01)+'" width="'+(short*.07)+'" height="'+(short*.012)+'" rx="'+(short*.006)+'" fill="'+esc(d.accent)+'"/><text x="'+(pad+short*.09)+'" y="'+brandY+'" fill="#ffffff" font-family="Arial,sans-serif" font-size="'+(font*.72)+'" font-weight="700" letter-spacing="3">'+brandText+'</text>')+group('label','<text x="'+pad+'" y="'+(brandY+font*1.8)+'" fill="'+esc(d.accent)+'" font-family="Arial,sans-serif" font-size="'+(font*.53)+'" font-weight="700" letter-spacing="4">'+esc(label)+'</text>')+group('title',title)+group('subtitle',subtitle)+group('image',photo)+customElementsSvg(d)+'<rect x="'+pad+'" y="'+(footerY-short*.055)+'" width="'+(w-pad*2)+'" height="'+(short*.10)+'" rx="'+(short*.05)+'" fill="'+esc(d.accent)+'"/>'+group('cta','<text x="'+(w/2)+'" y="'+footerY+'" text-anchor="middle" dominant-baseline="middle" fill="#071321" font-family="Arial,sans-serif" font-size="'+(font*.92)+'" font-weight="700" letter-spacing="2">'+ctaText+'</text>')+'<text x="'+pad+'" y="'+(h-pad*.55)+'" fill="#ffffff" opacity=".55" font-family="Arial,sans-serif" font-size="'+(font*.35)+'">'+esc(d.type==='label'||d.type==='insert'?'PRINT ARTWORK · VERIFY FINAL SIZE WITH SUPPLIER':'EDITABLE VECTOR DESIGN · '+d.w+' × '+d.h+' '+d.unit)+'</text></svg>';
}
let previousObjectUrl='';
function attachCanvasEditing(svg){
 const names={brand:'designBrand',label:null,title:'designTitle',subtitle:'designSubtitle',image:null,cta:'designCta',symbol:null};
 const point=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())};
 svg.addEventListener('pointerdown',e=>{
  const target=e.target.closest('[data-design-object]');if(!target)return;
  e.preventDefault();const p=point(e),name=target.getAttribute('data-design-object'),base=layoutOffsets[name]||{x:0,y:0};
  dragState={name,target,start:p,base,pointerId:e.pointerId};target.classList.add('is-dragging');
  try{svg.setPointerCapture(e.pointerId)}catch{}
 });
 svg.addEventListener('pointermove',e=>{
  if(!dragState||dragState.pointerId!==e.pointerId)return;
  const p=point(e),dx=p.x-dragState.start.x,dy=p.y-dragState.start.y;
  dragState.target.setAttribute('transform','translate('+(dragState.base.x+dx)+' '+(dragState.base.y+dy)+')');
 });
 const finish=e=>{
  if(!dragState||dragState.pointerId!==e.pointerId)return;
  const p=point(e),dx=p.x-dragState.start.x,dy=p.y-dragState.start.y,name=dragState.name;
  layoutOffsets[name]={x:dragState.base.x+dx,y:dragState.base.y+dy};dragState=null;render();
 };
 svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
 svg.addEventListener('dblclick',e=>{
  const target=e.target.closest('[data-design-object]'),name=target&&target.getAttribute('data-design-object');
  const id=name&&name.startsWith('custom-')?'customText-'+name.slice(7):(name&&names[name]);
  if(id&&$(id)){const field=$(id);field.scrollIntoView({behavior:'smooth',block:'center'});field.focus()}
 });
}
function render(){const d=stateFromForm(),svg=svgFor(d);$('designCanvas').innerHTML=svg;const canvasSvg=$('designCanvas').querySelector('svg');if(canvasSvg)attachCanvasEditing(canvasSvg);$('designDimensions').textContent=d.w+' × '+d.h+' '+d.unit;$('designDimensionsPreview').textContent=d.w+' × '+d.h+' '+d.unit;if(previousObjectUrl)URL.revokeObjectURL(previousObjectUrl);$('designDownload').href=previousObjectUrl=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));}
function renderCustomElements(){
 const root=$('customElementList');if(!root)return;root.replaceChildren();
 if(!customElements.length){const hint=document.createElement('p');hint.className='muted';hint.textContent='No added elements yet.';root.append(hint);return}
 customElements.forEach(el=>{
  const row=document.createElement('div');row.className='design-layer';
  const head=document.createElement('div');head.className='design-layer-head';
  const name=document.createElement('strong');name.textContent=el.type==='text'?'Text':el.type==='rectangle'?'Rectangle':'Circle';
  const remove=document.createElement('button');remove.type='button';remove.className='ghost';remove.textContent='Remove';
  remove.addEventListener('click',()=>{customElements=customElements.filter(item=>item.id!==el.id);delete layoutOffsets['custom-'+el.id];renderCustomElements();render()});
  head.append(name,remove);row.append(head);
  if(el.type==='text'){
   const textInput=document.createElement('textarea');textInput.id='customText-'+el.id;textInput.rows=2;textInput.maxLength=100;textInput.value=el.text;textInput.setAttribute('aria-label','Added text');
   textInput.addEventListener('input',()=>{el.text=textInput.value;render()});row.append(textInput);
  }
  const color=document.createElement('input');color.type='color';color.value=el.color;color.setAttribute('aria-label','Element color');color.addEventListener('input',()=>{el.color=color.value;render()});row.append(color);root.append(row);
 });
}
function addCustomElement(type){
 const id=String(nextCustomId++),short=Math.min(Number(value('designWidth'))||1080,Number(value('designHeight'))||1080);
 const element={id,type,color:type==='rectangle'?value('designAccent')||'#59ddb0':'#ffffff'};
 if(type==='text')Object.assign(element,{text:'Your text',x:.1,y:.5,fontSize:Math.max(value('designUnit')==='mm'?3:32,Math.round(short*.075))});
 if(type==='rectangle')Object.assign(element,{x:.15,y:.4,width:.7,height:.14});
 if(type==='circle')Object.assign(element,{x:.5,y:.5,radius:.12});
 customElements.push(element);renderCustomElements();render();
}
function selectPreset(){
 const p=presets[value('designType')];if(!p)return;
 layoutOffsets={};
 $('designWidth').value=p.w;$('designHeight').value=p.h;$('designUnit').value=p.unit;
 if(['label','insert','businesscard','pricetag'].includes(value('designType')))$('designPrintNote').classList.remove('hidden');else $('designPrintNote').classList.add('hidden');
 render();
}
function slug(s){return (s||'design').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45)||'design'}
async function readPhoto(file){
 if(!file)return;
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>5*1024*1024){$('designPhotoStatus').textContent='Choose JPG, PNG or WebP up to 5 MB.';return}
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
 const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=data});
 const scale=Math.min(1,1400/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
 photoData=canvas.toDataURL('image/jpeg',.82);$('designPhotoStatus').textContent='Product photo ready. It will be embedded in the saved design.';render();
}
async function refreshSaved(){
 if(!value('projectSelect'))return;
 try{
  const data=await fetch('/api/v2/designs/list?projectId='+encodeURIComponent(value('projectSelect'))).then(r=>r.json());
  savedDesigns=data.designs||[];const root=$('savedDesignList');root.replaceChildren();
  if(!savedDesigns.length){root.innerHTML='<p class="muted">No designs saved to this project yet.</p>';return}
  for(const item of savedDesigns){const row=document.createElement('div');row.className='design-saved-row';const info=document.createElement('div');info.innerHTML='<strong></strong><small></small>';info.querySelector('strong').textContent=item.title;info.querySelector('small').textContent=item.kind+' · '+new Date(item.createdAt).toLocaleDateString();const link=document.createElement('a');link.className='secondary';link.textContent='Download SVG';link.href='/api/v2/designs/download?projectId='+encodeURIComponent(value('projectSelect'))+'&id='+encodeURIComponent(item.id);link.setAttribute('download',slug(item.title)+'.svg');row.append(info,link);root.append(row)}
 }catch{$('savedDesignList').textContent='Could not load saved designs.'}
}
$('designType').addEventListener('change',selectPreset);
['designTitle','designSubtitle','designBrand','designCta','designColor','designAccent','designWidth','designHeight','designUnit'].forEach(id=>$(id).addEventListener('input',render));
$('designPhoto').addEventListener('change',e=>readPhoto(e.target.files?.[0]).catch(()=>{$('designPhotoStatus').textContent='The image could not be opened.'}));
$('designDownload').addEventListener('click',e=>{const d=stateFromForm();e.currentTarget.download=slug(d.title)+'.svg'});
$('designDownloadPng')?.addEventListener('click',async()=>{
 const button=$('designDownloadPng');button.disabled=true;$('designStatus').textContent='Preparing PNG image…';
 let objectUrl='';
 try{
  const d=stateFromForm(),svg=svgFor(d),pxPerUnit=d.unit==='mm'?300/25.4:1;
  const requestedWidth=Math.max(1,Math.round(d.w*pxPerUnit)),requestedHeight=Math.max(1,Math.round(d.h*pxPerUnit));
  const pixelLimit=16000000,scale=Math.min(1,Math.sqrt(pixelLimit/(requestedWidth*requestedHeight)));
  const width=Math.max(1,Math.round(requestedWidth*scale)),height=Math.max(1,Math.round(requestedHeight*scale));
  const svgBlob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});objectUrl=URL.createObjectURL(svgBlob);
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('The design preview could not be rendered.'));image.src=objectUrl});
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw new Error('PNG export is not available in this browser.');
  context.drawImage(image,0,0,width,height);
  const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!png)throw new Error('The PNG image could not be created. Try SVG for this design size.');
  const downloadUrl=URL.createObjectURL(png),link=document.createElement('a');
  link.href=downloadUrl;link.download=slug(d.title)+'.png';document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(downloadUrl),1500);
  $('designStatus').textContent=scale<1
    ? 'PNG downloaded at '+width+' × '+height+' px to fit mobile memory limits. SVG keeps the full vector size.'
    : 'PNG downloaded at '+width+' × '+height+' px.';
 }catch(error){$('designStatus').textContent='PNG export failed: '+error.message}
 finally{if(objectUrl)URL.revokeObjectURL(objectUrl);button.disabled=false}
});
$('saveDesign').addEventListener('click',async()=>{
 const projectId=value('projectSelect');if(!projectId){$('designStatus').textContent='Create or select a project first.';return}
 const button=$('saveDesign');button.disabled=true;$('designStatus').textContent='Saving design to this project…';
 try{
  const d=stateFromForm(),svg=svgFor(d);
  const response=await fetch('/api/v2/designs/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,title:d.title||presets[d.type].label,kind:presets[d.type].label,svg})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save design.');
  $('designStatus').textContent='Design saved to this project. Download the SVG or open it in a compatible design editor.';
  await refreshSaved();
 }catch(error){$('designStatus').textContent='Save failed: '+error.message}
 finally{button.disabled=false}
});
$('projectSelect').addEventListener('change',refreshSaved);
$('resetDesignLayout')?.addEventListener('click',()=>{layoutOffsets={};render()});
$('addTextElement')?.addEventListener('click',()=>addCustomElement('text'));
$('addRectangleElement')?.addEventListener('click',()=>addCustomElement('rectangle'));
$('addCircleElement')?.addEventListener('click',()=>addCustomElement('circle'));
function applyProjectContext(){
 const detail=activeProjectContext||{},dashboard=detail.dashboard||{},project=detail.project||dashboard.activeProject||{};
 const product=dashboard.products?.[0]||{},research=dashboard.research||{},payload=research.payload||{},idea=payload.idea||{};
 const brand=dashboard.brand||{},profile=project.profile||{};
 const first=(...values)=>values.find(v=>typeof v==='string'&&v.trim())?.trim()||'';
 const title=first(product.name,research.ideaName,idea.name,project.name);
 const subtitle=first(product.description,product.outcome,product.offer,idea.description,idea.outcome,research.summary,product.audience,product.problem);
 const brandName=first(brand.name,profile.brandName,project.brandName);
 if(title)$('designTitle').value=title.slice(0,120);
 if(subtitle)$('designSubtitle').value=subtitle.slice(0,220);
 if(brandName)$('designBrand').value=brandName.slice(0,60);
 if(!$('designCta').value.trim())$('designCta').value=product.price!=null?'Shop now':'Learn more';
 const colors=(Array.isArray(brand.colors)?brand.colors:[]).filter(color=>/^#[0-9a-f]{6}$/i.test(color));
 if(colors[0])$('designColor').value=colors[0];
 if(colors[1])$('designAccent').value=colors[1];
 render();
 const available=[title,subtitle,brandName].filter(Boolean).length;
 $('designContextStatus').textContent=available
   ? 'Filled from the active project’s saved product, research and brand details. No AI provider was called.'
   : 'This project has no saved product or brand details yet. Add those in Product or Brand Profile, then try again.';
}
window.addEventListener('localgrowth:design-context',event=>{activeProjectContext=event.detail||null});
$('designFromProject')?.addEventListener('click',applyProjectContext);
renderCustomElements();selectPreset();setTimeout(refreshSaved,1200);
