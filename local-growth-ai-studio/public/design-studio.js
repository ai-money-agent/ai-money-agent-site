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
   node='<text x="'+(el.x*d.w)+'" y="'+(el.y*d.h)+'" fill="'+esc(el.color)+'" font-family="'+esc(el.fontFamily||'Arial,sans-serif')+'" font-size="'+el.fontSize+'" font-weight="'+(el.fontWeight||'700')+'">'+esc(el.text||'Your text')+'</text>';
  }else if(el.type==='rectangle'){
   node='<rect x="'+(el.x*d.w)+'" y="'+(el.y*d.h)+'" width="'+(el.width*d.w)+'" height="'+(el.height*d.h)+'" rx="'+(Math.min(d.w,d.h)*.025)+'" fill="'+esc(el.color)+'"/>';
  }else{
   node='<circle cx="'+(el.x*d.w)+'" cy="'+(el.y*d.h)+'" r="'+(el.radius*Math.min(d.w,d.h))+'" fill="'+esc(el.color)+'"/>';
  }
  const key='custom-'+el.id,off=layoutOffsets[key]||{x:0,y:0};
  return '<g data-design-object="'+key+'" transform="translate('+off.x+' '+off.y+')">'+node+'</g>';
 }).join('');
}
function generatedArtworkSvg(d,box,short){
 const x=box.x,y=box.y,w=box.w,h=box.h;
 const cardW=w*.48,cardH=h*.86,cardX=x+w*.30,cardY=y+h*.07;
 const titleLines=wrapMeasured(d.title||'Digital Product Guide',cardW*.76,Math.max(short*.019,14),3,true);
 const title=titleLines.map((line,i)=>'<text x="'+(cardX+cardW*.13)+'" y="'+(cardY+cardH*.43+i*short*.027)+'" fill="#ffffff" font-family="Arial,sans-serif" font-size="'+Math.max(short*.019,14)+'" font-weight="700">'+esc(line)+'</text>').join('');
 const brand=esc(d.brand||'LOCAL GROWTH');
 const subtitle=esc((d.subtitle||'A practical step-by-step guide').split(/[.!?]/)[0].slice(0,48));
 return '<g clip-path="url(#photoClip)"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="#0c1b30"/><circle cx="'+(x+w*.12)+'" cy="'+(y+h*.18)+'" r="'+(h*.38)+'" fill="'+esc(d.accent)+'" opacity=".28"/><circle cx="'+(x+w*.92)+'" cy="'+(y+h*.84)+'" r="'+(h*.42)+'" fill="'+esc(d.color)+'" opacity=".75"/><rect x="'+(cardX+short*.018)+'" y="'+(cardY+short*.018)+'" width="'+cardW+'" height="'+cardH+'" rx="'+(short*.018)+'" fill="#000000" opacity=".36"/><rect x="'+cardX+'" y="'+cardY+'" width="'+cardW+'" height="'+cardH+'" rx="'+(short*.018)+'" fill="'+esc(d.color)+'" stroke="'+esc(d.accent)+'" stroke-width="'+(short*.004)+'"/><rect x="'+cardX+'" y="'+cardY+'" width="'+(cardW*.09)+'" height="'+cardH+'" rx="'+(short*.012)+'" fill="'+esc(d.accent)+'"/><rect x="'+(cardX+cardW*.13)+'" y="'+(cardY+cardH*.14)+'" width="'+(cardW*.24)+'" height="'+(short*.009)+'" rx="'+(short*.004)+'" fill="'+esc(d.accent)+'"/><text x="'+(cardX+cardW*.13)+'" y="'+(cardY+cardH*.32)+'" fill="'+esc(d.accent)+'" font-family="Arial,sans-serif" font-size="'+Math.max(short*.015,11)+'" font-weight="700" letter-spacing="2">DIGITAL GUIDE</text>'+title+'<text x="'+(cardX+cardW*.13)+'" y="'+(cardY+cardH*.76)+'" fill="#d5e4f4" font-family="Arial,sans-serif" font-size="'+Math.max(short*.012,9)+'">'+subtitle+'</text><text x="'+(cardX+cardW*.13)+'" y="'+(cardY+cardH*.90)+'" fill="#ffffff" font-family="Arial,sans-serif" font-size="'+Math.max(short*.013,10)+'" font-weight="700" letter-spacing="1">'+brand+'</text><path d="M '+(x+w*.78)+' '+(y+h*.25)+' l '+(short*.012)+' '+(short*.025)+' l '+(short*.012)+' '+(-short*.025)+' l '+(short*.012)+' '+(short*.025)+' l '+(short*.012)+' '+(-short*.025)+'" fill="none" stroke="'+esc(d.accent)+'" stroke-width="'+(short*.006)+'" stroke-linecap="round"/></g>';
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
 const photo=d.photo?'<image href="'+d.photo+'" x="'+imageBox.x+'" y="'+imageBox.y+'" width="'+imageBox.w+'" height="'+imageBox.h+'" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>':generatedArtworkSvg(d,imageBox,short);
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
function addRangeControl(parent,title,min,max,step,current,onChange){
 const field=document.createElement('label');field.className='design-layer-field';
 const caption=document.createElement('span');caption.textContent=title;
 const output=document.createElement('output');output.textContent=String(current);
 const input=document.createElement('input');input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(current);
 input.addEventListener('input',()=>{const n=Number(input.value);output.textContent=String(n);onChange(n);render()});
 field.append(caption,output,input);parent.append(field);
}
function renderCustomElements(){
 const root=$('customElementList');if(!root)return;root.replaceChildren();
 if(!customElements.length){const hint=document.createElement('p');hint.className='muted';hint.textContent='No added elements yet.';root.append(hint);return}
 customElements.forEach(el=>{
  const row=document.createElement('div');row.className='design-layer';
  const head=document.createElement('div');head.className='design-layer-head';
  const name=document.createElement('strong');name.textContent=el.type==='text'?'Text':el.type==='rectangle'?'Rectangle':'Circle';
  const actions=document.createElement('div');actions.className='design-layer-actions';
  const index=customElements.findIndex(item=>item.id===el.id);
  const move=(delta)=>{const next=index+delta;if(next<0||next>=customElements.length)return;const [item]=customElements.splice(index,1);customElements.splice(next,0,item);renderCustomElements();render()};
  const forward=document.createElement('button');forward.type='button';forward.className='ghost';forward.textContent='Forward';forward.disabled=index===customElements.length-1;forward.setAttribute('aria-label','Move layer forward');forward.addEventListener('click',()=>move(1));
  const backward=document.createElement('button');backward.type='button';backward.className='ghost';backward.textContent='Back';backward.disabled=index===0;backward.setAttribute('aria-label','Move layer backward');backward.addEventListener('click',()=>move(-1));
  const duplicate=document.createElement('button');duplicate.type='button';duplicate.className='ghost';duplicate.textContent='Duplicate';duplicate.addEventListener('click',()=>duplicateCustomElement(el.id));
  const remove=document.createElement('button');remove.type='button';remove.className='ghost';remove.textContent='Remove';
  remove.addEventListener('click',()=>{customElements=customElements.filter(item=>item.id!==el.id);delete layoutOffsets['custom-'+el.id];renderCustomElements();render()});
  actions.append(forward,backward,duplicate,remove);head.append(name,actions);row.append(head);
  if(el.type==='text'){
   const textInput=document.createElement('textarea');textInput.id='customText-'+el.id;textInput.rows=2;textInput.maxLength=100;textInput.value=el.text;textInput.setAttribute('aria-label','Added text');
   textInput.addEventListener('input',()=>{el.text=textInput.value;render()});row.append(textInput);
   const controls=document.createElement('div');controls.className='design-layer-controls';
   const short=Math.min(Number(value('designWidth'))||1080,Number(value('designHeight'))||1080),unit=value('designUnit')||'px';
   addRangeControl(controls,'Font size',unit==='mm'?1:16,Math.max(unit==='mm'?8:48,short*.24),unit==='mm'?.5:1,el.fontSize||Math.max(unit==='mm'?3:32,Math.round(short*.075)),v=>{el.fontSize=v});
   const family=document.createElement('label');family.className='design-layer-field';family.append(document.createTextNode('Font'));
   const fontSelect=document.createElement('select');fontSelect.setAttribute('aria-label','Text font');
   [['Arial','Arial,sans-serif'],['Georgia','Georgia,serif'],['Verdana','Verdana,sans-serif'],['Trebuchet MS','Trebuchet MS,sans-serif']].forEach(([label,font])=>{const option=document.createElement('option');option.value=font;option.textContent=label;option.selected=(el.fontFamily||'Arial,sans-serif')===font;fontSelect.append(option)});
   fontSelect.addEventListener('change',()=>{el.fontFamily=fontSelect.value;render()});family.append(fontSelect);controls.append(family);
   const weight=document.createElement('label');weight.className='design-layer-field';weight.append(document.createTextNode('Style'));
   const weightSelect=document.createElement('select');weightSelect.setAttribute('aria-label','Text weight');
   [['Bold','700'],['Regular','400']].forEach(([label,val])=>{const option=document.createElement('option');option.value=val;option.textContent=label;option.selected=(el.fontWeight||'700')===val;weightSelect.append(option)});
   weightSelect.addEventListener('change',()=>{el.fontWeight=weightSelect.value;render()});weight.append(weightSelect);controls.append(weight);row.append(controls);
  }else if(el.type==='rectangle'){
   const controls=document.createElement('div');controls.className='design-layer-controls';
   addRangeControl(controls,'Width',.1,.9,.01,el.width,v=>{el.width=v});
   addRangeControl(controls,'Height',.06,.7,.01,el.height,v=>{el.height=v});row.append(controls);
  }else if(el.type==='circle'){
   const controls=document.createElement('div');controls.className='design-layer-controls';
   addRangeControl(controls,'Radius',.04,.45,.01,el.radius,v=>{el.radius=v});row.append(controls);
  }
  const color=document.createElement('input');color.type='color';color.value=el.color;color.setAttribute('aria-label','Element color');color.addEventListener('input',()=>{el.color=color.value;render()});row.append(color);root.append(row);
 });
}
function duplicateCustomElement(id){
 const original=customElements.find(item=>item.id===id);if(!original)return;
 const clone={...original,id:String(nextCustomId++)};
 if(Number.isFinite(clone.x))clone.x=Math.min(.9,clone.x+.035);
 if(Number.isFinite(clone.y))clone.y=Math.min(.9,clone.y+.035);
 customElements.push(clone);
 const oldOffset=layoutOffsets['custom-'+id];if(oldOffset)layoutOffsets['custom-'+clone.id]={x:oldOffset.x,y:oldOffset.y};
 renderCustomElements();render();
}
function addCustomElement(type){
 const id=String(nextCustomId++),short=Math.min(Number(value('designWidth'))||1080,Number(value('designHeight'))||1080);
 const element={id,type,color:type==='rectangle'?value('designAccent')||'#59ddb0':'#ffffff'};
 if(type==='text')Object.assign(element,{text:'Your text',x:.1,y:.5,fontSize:Math.max(value('designUnit')==='mm'?3:32,Math.round(short*.075)),fontFamily:'Arial,sans-serif',fontWeight:'700'});
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
async function loadSavedDesign(item){
 const projectId=value('projectSelect'),state=item.designState;
 if(!state||state.version!==1||!state.form){$('designStatus').textContent='This older saved design can be downloaded as SVG, but its editing details were not stored.';return}
 const preset=$('designType'),known=[...preset.options].some(option=>option.value===state.form.type);
 preset.value=known?state.form.type:'social';selectPreset();
 for(const [key,id] of Object.entries({w:'designWidth',h:'designHeight',unit:'designUnit',title:'designTitle',subtitle:'designSubtitle',brand:'designBrand',cta:'designCta',color:'designColor',accent:'designAccent'})){
  if(state.form[key]!=null)$(id).value=String(state.form[key]);
 }
 customElements=Array.isArray(state.customElements)?state.customElements.slice(0,30):[];
 layoutOffsets=state.layoutOffsets&&typeof state.layoutOffsets==='object'?state.layoutOffsets:{};
 nextCustomId=customElements.reduce((max,el)=>Math.max(max,Number(el.id)||0),0)+1;
 const response=await fetch('/api/v2/designs/download?projectId='+encodeURIComponent(projectId)+'&id='+encodeURIComponent(item.id));
 if(response.ok){
  const svg=await response.text(),match=svg.match(/<image[^>]*href="(data:image\/(?:jpeg|png|webp);base64,[^"]+)"/i);
  photoData=match?match[1]:'';
 }else photoData='';
 const photoInput=$('designPhoto');if(photoInput)photoInput.value='';
 $('designPhotoStatus').textContent=photoData?'Saved product photo restored.':'No product photo in this design.';
 renderCustomElements();render();
 $('designStatus').textContent='Saved design opened for editing. Saving will add an updated copy to this project.';
}
async function refreshSaved(){
 if(!value('projectSelect'))return;
 try{
  const data=await fetch('/api/v2/designs/list?projectId='+encodeURIComponent(value('projectSelect'))).then(r=>r.json());
  savedDesigns=data.designs||[];const root=$('savedDesignList');root.replaceChildren();
  if(!savedDesigns.length){root.innerHTML='<p class="muted">No designs saved to this project yet.</p>';return}
  for(const item of savedDesigns){
   const row=document.createElement('div');row.className='design-saved-row';
   const info=document.createElement('div');info.innerHTML='<strong></strong><small></small>';
   info.querySelector('strong').textContent=item.title;info.querySelector('small').textContent=item.kind+' · '+new Date(item.createdAt).toLocaleDateString();
   const actions=document.createElement('div');actions.className='design-saved-actions';
   if(item.designState){const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='Open to edit';edit.addEventListener('click',()=>loadSavedDesign(item).catch(()=>{$('designStatus').textContent='Could not open this saved design.'}));actions.append(edit)}
   const link=document.createElement('a');link.className='secondary';link.textContent='Download SVG';link.href='/api/v2/designs/download?projectId='+encodeURIComponent(value('projectSelect'))+'&id='+encodeURIComponent(item.id);link.setAttribute('download',slug(item.title)+'.svg');actions.append(link);
   row.append(info,actions);root.append(row)
  }
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
$('designPrintPdf')?.addEventListener('click',()=>{
 const d=stateFromForm(),svg=svgFor(d),pageWidthMm=d.unit==='mm'?d.w:d.w*25.4/300,pageHeightMm=d.unit==='mm'?d.h:d.h*25.4/300;
 const width=pageWidthMm.toFixed(2).replace(/\.?0+$/,''),height=pageHeightMm.toFixed(2).replace(/\.?0+$/,'');
 const popup=window.open('','_blank');
 if(!popup){$('designStatus').textContent='Allow pop-ups for this site to print or save as PDF.';return}
 const pageTitle=esc(d.title||'Design');
 popup.document.open();
 popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+pageTitle+'</title><style>@page{size:'+width+'mm '+height+'mm;margin:0}html,body{width:'+width+'mm;height:'+height+'mm;margin:0;padding:0}body{overflow:hidden}svg{display:block;width:'+width+'mm;height:'+height+'mm}</style></head><body>'+svg+'</body></html>');
 popup.document.close();
 $('designStatus').textContent='Print window opened. Choose “Save as PDF” in the browser print menu.';
 setTimeout(()=>{try{popup.focus();popup.print()}catch{$('designStatus').textContent='Use the print command in the opened window and choose Save as PDF.'}},500);
});
$('saveDesign').addEventListener('click',async()=>{
 const projectId=value('projectSelect');if(!projectId){$('designStatus').textContent='Create or select a project first.';return}
 const button=$('saveDesign');button.disabled=true;$('designStatus').textContent='Saving design to this project…';
 try{
  const d=stateFromForm(),svg=svgFor(d);
  const response=await fetch('/api/v2/designs/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,title:d.title||presets[d.type].label,kind:presets[d.type].label,svg,designState:{version:1,form:{type:d.type,w:d.w,h:d.h,unit:d.unit,title:d.title,subtitle:d.subtitle,brand:d.brand,cta:d.cta,color:d.color,accent:d.accent},customElements,layoutOffsets}})});
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
