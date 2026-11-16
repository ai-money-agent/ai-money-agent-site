const $ = (id) => document.getElementById(id);
const presets = {
  social:{label:'Social post · square',w:1080,h:1080,unit:'px',tag:'SOCIAL POST'},
  story:{label:'Story / Reel cover',w:1080,h:1920,unit:'px',tag:'STORY'},
  marketplace:{label:'Product listing image',w:1200,h:1200,unit:'px',tag:'PRODUCT'},
  flyer:{label:'Flyer · A4 portrait',w:2480,h:3508,unit:'px',tag:'FLYER'},
  cover:{label:'Book / ebook cover',w:1600,h:2560,unit:'px',tag:'COVER'},
  label:{label:'Product label · print file',w:80,h:120,unit:'mm',tag:'PRODUCT LABEL'},
  insert:{label:'Package insert · A5',w:148,h:210,unit:'mm',tag:'THANK YOU'},
  slide:{label:'Presentation slide · 16:9',w:1920,h:1080,unit:'px',tag:'PRESENTATION'}
};
let photoData='';
let savedDesigns=[];
function value(id){return $(id)?.value?.trim()||''}
function esc(s){return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]))}
function stateFromForm(){
  const type=value('designType'),p=presets[type]||presets.social;
  const w=Math.max(50,Math.min(5000,Number(value('designWidth'))||p.w));
  const h=Math.max(50,Math.min(7000,Number(value('designHeight'))||p.h));
  return {type,w,h,unit:value('designUnit')||p.unit,title:value('designTitle'),subtitle:value('designSubtitle'),brand:value('designBrand'),cta:value('designCta'),color:value('designColor')||'#102846',accent:value('designAccent')||'#59ddb0',photo:photoData};
}
function wrap(text,max){const words=String(text).split(/\s+/);const out=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(next.length>max&&line){out.push(line);line=word}else line=next}if(line)out.push(line);return out.slice(0,4)}
function svgFor(d){
 const w=d.w,h=d.h,short=Math.min(w,h),pad=short*.075;
 const font=short*.052,titleSize=short*.082;
 const titleLines=wrap(d.title||'Your product title',Math.max(14,Math.floor(w/(font*.65))));
 const subLines=wrap(d.subtitle||'A clear promise for the right customer.',Math.max(22,Math.floor(w/(font*.82))));
 const label=presets[d.type]?.tag||'DESIGN';
 const isStory=h>w*1.3,isWide=w>h*1.3;
 const imageBox=isStory?{x:pad,y:h*.39,w:w-pad*2,h:h*.32}:isWide?{x:w*.52,y:h*.19,w:w*.41,h:h*.62}:{x:w*.17,y:h*.48,w:w*.66,h:h*.31};
 const titleY=isStory?h*.19:h*.25, brandY=pad*1.5;
 const titleAnchor='start',titleX=pad;
 const bg=d.color,accent=d.accent;
 const shape=isStory
  ? '<circle cx="0" cy="'+(h*.85)+'" r="'+(short*.42)+'" fill="'+esc(accent)+'" opacity=".16"/>'
  : '<circle cx="'+(w*.92)+'" cy="'+(h*.08)+'" r="'+(short*.24)+'" fill="'+esc(accent)+'" opacity=".18"/>';
 const photo=d.photo?'<image href="'+d.photo+'" x="'+imageBox.x+'" y="'+imageBox.y+'" width="'+imageBox.w+'" height="'+imageBox.h+'" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>':'<rect x="'+imageBox.x+'" y="'+imageBox.y+'" width="'+imageBox.w+'" height="'+imageBox.h+'" rx="'+(short*.035)+'" fill="'+esc(accent)+'" opacity=".20"/><text x="'+(imageBox.x+imageBox.w/2)+'" y="'+(imageBox.y+imageBox.h/2)+'" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="'+(font*.75)+'">ADD PRODUCT PHOTO</text>';
 let title=titleLines.map((line,i)=>'<text x="'+titleX+'" y="'+(titleY+i*titleSize*1.08)+'" fill="#ffffff" font-family="Arial,sans-serif" font-size="'+titleSize+'" font-weight="700">'+esc(line)+'</text>').join('');
 let subStart=titleY+titleLines.length*titleSize*1.15+font*.35;
 let subtitle=subLines.map((line,i)=>'<text x="'+titleX+'" y="'+(subStart+i*font*1.35)+'" fill="#ecf5ff" opacity=".92" font-family="Arial,sans-serif" font-size="'+font+'">'+esc(line)+'</text>').join('');
 const footerY=isStory?h*.86:h*.91,ctaText=esc(d.cta||'LEARN MORE');
 const brandText=esc(d.brand||'YOUR BRAND');
 return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+d.w+d.unit+'" height="'+d.h+d.unit+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(d.title)+'"><defs><linearGradient id="fade" x2="1" y2="1"><stop stop-color="'+esc(bg)+'"/><stop offset="1" stop-color="#091321"/></linearGradient><clipPath id="photoClip"><rect x="'+imageBox.x+'" y="'+imageBox.y+'" width="'+imageBox.w+'" height="'+imageBox.h+'" rx="'+(short*.035)+'"/></clipPath></defs><rect width="'+w+'" height="'+h+'" fill="url(#fade)"/>'+shape+'<rect x="'+pad+'" y="'+(brandY-short*.01)+'" width="'+(short*.07)+'" height="'+(short*.012)+'" rx="'+(short*.006)+'" fill="'+esc(accent)+'"/><text x="'+(pad+short*.09)+'" y="'+brandY+'" fill="#ffffff" font-family="Arial,sans-serif" font-size="'+(font*.72)+'" font-weight="700" letter-spacing="3">'+brandText+'</text><text x="'+pad+'" y="'+(brandY+font*1.8)+'" fill="'+esc(accent)+'" font-family="Arial,sans-serif" font-size="'+(font*.53)+'" font-weight="700" letter-spacing="4">'+esc(label)+'</text>'+title+subtitle+photo+'<rect x="'+pad+'" y="'+(footerY-short*.055)+'" width="'+(w-pad*2)+'" height="'+(short*.10)+'" rx="'+(short*.05)+'" fill="'+esc(accent)+'"/><text x="'+(w/2)+'" y="'+footerY+'" text-anchor="middle" dominant-baseline="middle" fill="#071321" font-family="Arial,sans-serif" font-size="'+(font*.92)+'" font-weight="700" letter-spacing="2">'+ctaText+'</text><text x="'+pad+'" y="'+(h-pad*.55)+'" fill="#ffffff" opacity=".55" font-family="Arial,sans-serif" font-size="'+(font*.35)+'">'+esc(d.type==='label'||d.type==='insert'?'PRINT ARTWORK · VERIFY FINAL SIZE WITH SUPPLIER':'EDITABLE VECTOR DESIGN · '+d.w+' × '+d.h+' '+d.unit)+'</text></svg>';
}
let previousObjectUrl='';
function render(){const d=stateFromForm(),svg=svgFor(d);$('designCanvas').innerHTML=svg;$('designDimensions').textContent=d.w+' × '+d.h+' '+d.unit;$('designDimensionsPreview').textContent=d.w+' × '+d.h+' '+d.unit;if(previousObjectUrl)URL.revokeObjectURL(previousObjectUrl);$('designDownload').href=previousObjectUrl=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));}
function selectPreset(){
 const p=presets[value('designType')];if(!p)return;
 $('designWidth').value=p.w;$('designHeight').value=p.h;$('designUnit').value=p.unit;
 if(value('designType')==='label'||value('designType')==='insert')$('designPrintNote').classList.remove('hidden');else $('designPrintNote').classList.add('hidden');
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
selectPreset();setTimeout(refreshSaved,1200);
