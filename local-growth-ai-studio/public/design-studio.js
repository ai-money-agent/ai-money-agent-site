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
let imageGenerationAvailable=false;
let savedDesigns=[];
let layoutOffsets={};
let dragState=null;
let selectedObjectName='';
let customElements=[];
let historySnapshots=[];
let historyIndex=-1;
let historyTimer=0;
let restoringHistory=false;
let nextCustomId=1;
function value(id){return $(id)?.value?.trim()||''}
function esc(s){return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]))}
function isRtlText(text){return Array.from(String(text||'')).some(ch=>{const n=ch.codePointAt(0);return n>=0x590&&n<=0x8ff})}
function transformValue(name,offset=layoutOffsets[name]||{}){
 const x=Number(offset.x)||0,y=Number(offset.y)||0,rotate=Number(offset.rotate)||0,scale=Math.max(.25,Math.min(4,Number(offset.scale)||1));
 return 'translate('+x+' '+y+') rotate('+rotate+') scale('+scale+')';
}
function currentSnapshot(){
 const ids=['designType','designCoverStyle','designTitle','designSubtitle','designBrand','designCta','designColor','designAccent','designWidth','designHeight','designUnit'];
 return {fields:Object.fromEntries(ids.map(id=>[id,$(id)?.value||''])),photoData,customElements:JSON.parse(JSON.stringify(customElements)),layoutOffsets:JSON.parse(JSON.stringify(layoutOffsets))};
}
function refreshHistoryButtons(){const u=$('undoDesign'),r=$('redoDesign');if(u)u.disabled=historyIndex<=0;if(r)r.disabled=historyIndex<0||historyIndex>=historySnapshots.length-1}
function recordHistory(){
 if(restoringHistory)return;
 const snap=currentSnapshot();if(historyIndex>=0&&JSON.stringify(historySnapshots[historyIndex])===JSON.stringify(snap))return;
 historySnapshots=historySnapshots.slice(0,historyIndex+1);historySnapshots.push(snap);
 if(historySnapshots.length>80)historySnapshots.shift();historyIndex=historySnapshots.length-1;refreshHistoryButtons();
}
function scheduleHistory(){if(restoringHistory)return;clearTimeout(historyTimer);historyTimer=setTimeout(recordHistory,350)}
function resetHistory(){clearTimeout(historyTimer);historySnapshots=[currentSnapshot()];historyIndex=0;refreshHistoryButtons()}
function restoreHistory(index){
 if(index<0||index>=historySnapshots.length)return;
 restoringHistory=true;const s=historySnapshots[index];$('designType').value=s.fields.designType||'social';selectPreset();
 Object.entries(s.fields).forEach(([id,v])=>{if($(id))$(id).value=v??''});
 photoData=s.photoData||'';customElements=s.customElements||[];layoutOffsets=s.layoutOffsets||{};
 if($('designPhoto'))$('designPhoto').value='';
 renderCustomElements();render();historyIndex=index;restoringHistory=false;refreshHistoryButtons();
}
function undoDesign(){if(historyIndex>0)restoreHistory(historyIndex-1)}
function redoDesign(){if(historyIndex<historySnapshots.length-1)restoreHistory(historyIndex+1)}

function stateFromForm(){
  const type=value('designType'),p=presets[type]||presets.social;
  const w=Math.max(50,Math.min(5000,Number(value('designWidth'))||p.w));
  const h=Math.max(50,Math.min(7000,Number(value('designHeight'))||p.h));
  return {type,w,h,unit:value('designUnit')||p.unit,title:value('designTitle'),subtitle:value('designSubtitle'),brand:value('designBrand'),cta:value('designCta'),color:value('designColor')||'#102846',accent:value('designAccent')||'#59ddb0',coverStyle:value('designCoverStyle')||'growth',photo:photoData};
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
 return customElements.filter(el=>!el.hidden).map(el=>{
  const x=(el.x||0)*d.w,y=(el.y||0)*d.h;
  let node='';
  if(el.type==='image'){
   const width=el.width*d.w,height=el.height*d.h;
   node='<image data-custom-image-id="'+esc(el.id)+'" href="'+esc(el.src||'')+'" x="'+(x-width/2)+'" y="'+(y-height/2)+'" width="'+width+'" height="'+height+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+esc(el.alt||'Uploaded image')+'"/>';
  }else if(el.type==='text'){
   const rtl=isRtlText(el.text),anchor=el.align==='center'?'middle':el.align==='right'?'end':el.align==='left'?'start':rtl?'end':'start';
   node='<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" direction="'+(rtl?'rtl':'ltr')+'" fill="'+esc(el.color)+'" font-family="'+esc(el.fontFamily||'Arial,sans-serif')+'" font-size="'+el.fontSize+'" font-weight="'+(el.fontWeight||'700')+'">'+esc(el.text||'Your text')+'</text>';
  }else if(el.type==='rectangle'){
   node='<rect x="'+x+'" y="'+y+'" width="'+(el.width*d.w)+'" height="'+(el.height*d.h)+'" rx="'+(Math.min(d.w,d.h)*.025)+'" fill="'+esc(el.color)+'"/>';
  }else if(el.type==='circle'){
   node='<circle cx="'+x+'" cy="'+y+'" r="'+(el.radius*Math.min(d.w,d.h))+'" fill="'+esc(el.color)+'"/>';
  }else if(el.type==='icon'){
   const size=(el.size||.12)*Math.min(d.w,d.h),color=esc(el.color);
   if(el.icon==='star'){const pts=[];for(let i=0;i<10;i++){const ang=-Math.PI/2+i*Math.PI/5,r=size*(i%2?.43:1);pts.push((x+Math.cos(ang)*r)+','+(y+Math.sin(ang)*r))}node='<polygon points="'+pts.join(' ')+'" fill="'+color+'"/>'}
   else if(el.icon==='arrow')node='<path d="M '+(x-size*.48)+' '+(y+size*.30)+' L '+(x+size*.25)+' '+(y-size*.36)+' M '+(x-size*.02)+' '+(y-size*.36)+' L '+(x+size*.25)+' '+(y-size*.36)+' L '+(x+size*.25)+' '+(y-size*.08)+'" fill="none" stroke="'+color+'" stroke-width="'+(size*.12)+'" stroke-linecap="round" stroke-linejoin="round"/>';
   else if(el.icon==='heart')node='<path d="M '+x+' '+(y+size*.48)+' C '+(x-size*.72)+' '+(y-size*.03)+' '+(x-size*.48)+' '+(y-size*.62)+' '+x+' '+(y-size*.25)+' C '+(x+size*.48)+' '+(y-size*.62)+' '+(x+size*.72)+' '+(y-size*.03)+' '+x+' '+(y+size*.48)+' Z" fill="'+color+'"/>';
   else if(el.icon==='book')node='<path d="M '+(x-size*.5)+' '+(y-size*.38)+' Q '+(x-size*.18)+' '+(y-size*.5)+' '+x+' '+(y-size*.28)+' Q '+(x+size*.18)+' '+(y-size*.5)+' '+(x+size*.5)+' '+(y-size*.38)+' L '+(x+size*.5)+' '+(y+size*.4)+' Q '+(x+size*.18)+' '+(y+size*.25)+' '+x+' '+(y+size*.43)+' Q '+(x-size*.18)+' '+(y+size*.25)+' '+(x-size*.5)+' '+(y+size*.4)+' Z M '+x+' '+(y-size*.28)+' L '+x+' '+(y+size*.43)+'" fill="none" stroke="'+color+'" stroke-width="'+(size*.09)+'" stroke-linejoin="round"/>';
   else if(el.icon==='bulb')node='<path d="M '+x+' '+(y-size*.52)+' A '+(size*.32)+' '+(size*.32)+' 0 0 0 '+(x-size*.22)+' '+(y+size*.08)+' Q '+(x-size*.2)+' '+(y+size*.23)+' '+(x-size*.1)+' '+(y+size*.29)+' L '+(x-size*.1)+' '+(y+size*.42)+' L '+(x+size*.1)+' '+(y+size*.42)+' L '+(x+size*.1)+' '+(y+size*.29)+' Q '+(x+size*.2)+' '+(y+size*.23)+' '+(x+size*.22)+' '+(y+size*.08)+' A '+(size*.32)+' '+(size*.32)+' 0 0 0 '+x+' '+(y-size*.52)+' Z M '+(x-size*.1)+' '+(y+size*.5)+' L '+(x+size*.1)+' '+(y+size*.5)+'" fill="none" stroke="'+color+'" stroke-width="'+(size*.08)+'" stroke-linecap="round"/>';
   else if(el.icon==='leaf')node='<path d="M '+(x-size*.48)+' '+(y+size*.42)+' Q '+(x-size*.4)+' '+(y-size*.5)+' '+(x+size*.48)+' '+(y-size*.42)+' Q '+(x+size*.4)+' '+(y+size*.5)+' '+(x-size*.48)+' '+(y+size*.42)+' Z M '+(x-size*.34)+' '+(y+size*.29)+' Q '+x+' '+y+' '+(x+size*.31)+' '+(y-size*.28)+'" fill="'+color+'"/>';
   else if(el.icon==='check')node='<path d="M '+(x-size*.42)+' '+y+' L '+(x-size*.12)+' '+(y+size*.3)+' L '+(x+size*.45)+' '+(y-size*.36)+'" fill="none" stroke="'+color+'" stroke-width="'+(size*.14)+'" stroke-linecap="round" stroke-linejoin="round"/>';
   else if(el.icon==='target')node='<circle cx="'+x+'" cy="'+y+'" r="'+(size*.46)+'" fill="none" stroke="'+color+'" stroke-width="'+(size*.09)+'"/><circle cx="'+x+'" cy="'+y+'" r="'+(size*.22)+'" fill="none" stroke="'+color+'" stroke-width="'+(size*.09)+'"/><circle cx="'+x+'" cy="'+y+'" r="'+(size*.06)+'" fill="'+color+'"/>';
   else node='<path d="M '+x+' '+(y-size*.55)+' L '+(x+size*.12)+' '+(y-size*.12)+' L '+(x+size*.55)+' '+y+' L '+(x+size*.12)+' '+(y+size*.12)+' L '+x+' '+(y+size*.55)+' L '+(x-size*.12)+' '+(y+size*.12)+' L '+(x-size*.55)+' '+y+' L '+(x-size*.12)+' '+(y-size*.12)+' Z" fill="'+color+'"/>';
  }
  const key='custom-'+el.id;
  return el.hidden?'':'<g data-design-object="'+key+'" transform="'+transformValue(key)+'">'+node+'</g>';
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
function ebookCoverSvg(d){
 const w=d.w,h=d.h,short=Math.min(w,h),pad=w*.09;
 const titleSize=short*.09,subtitleSize=short*.033;
 const titleLines=wrapMeasured(d.title||'Digital Product Guide',w-pad*2,titleSize,3,true);
 const subtitleLines=wrapMeasured(d.subtitle||'A practical guide to your next launch.',w-pad*2,subtitleSize,4,false);
 const brand=esc(d.brand||'LOCAL GROWTH'),rtl=isRtlText(d.title)||isRtlText(d.subtitle),textX=rtl?w-pad:pad,textAnchor=rtl?'end':'start',direction=rtl?'rtl':'ltr';
 const coverStyle=d.coverStyle||'growth',editorial=coverStyle==='editorial',minimal=coverStyle==='minimal';
 const fontFamily=editorial?'Georgia,serif':'Arial,sans-serif';
 const accentColor=editorial?'#e3b66b':minimal?'#95c9e9':d.accent;
 const bgStart=editorial?'#272a3f':'#102947',bgEnd=minimal?'#050b13':'#071321';
 const panelFill=minimal?'#0b1725':'#0d1f34',panelStroke=minimal?'#213044':editorial?'#665845':'#38516a';
 const titleY=h*.255;
 const subtitleY=titleY+titleLines.length*titleSize*1.13+short*.055;
 const artY=Math.max(h*.49,subtitleY+subtitleLines.length*subtitleSize*1.36+short*.06);
 const artH=Math.max(short*.2,Math.min(h*.33,h*.80-artY));
 const artX=w*.085,artW=w*.83;
 const title=titleLines.map((line,i)=>'<text x="'+textX+'" y="'+(titleY+i*titleSize*1.13)+'" fill="'+(i===titleLines.length-1?'url(#titleAccent)':'#f8fbff')+'" text-anchor="'+textAnchor+'" direction="'+direction+'" font-family="'+fontFamily+'" font-size="'+titleSize+'" font-weight="700" letter-spacing="-2">'+esc(line)+'</text>').join('');
 const subtitle=subtitleLines.map((line,i)=>'<text x="'+textX+'" y="'+(subtitleY+i*subtitleSize*1.36)+'" fill="#c5d4e4" text-anchor="'+textAnchor+'" direction="'+direction+'" font-family="'+fontFamily+'" font-size="'+subtitleSize+'">'+esc(line)+'</text>').join('');
 const bars=[.24,.39,.57,.76],barW=artW*.105,barGap=artW*.045,baseY=artY+artH*.77;
 const barShapes=bars.map((height,i)=>'<rect x="'+(artX+artW*.12+i*(barW+barGap))+'" y="'+(baseY-artH*height*.52)+'" width="'+barW+'" height="'+(artH*height*.52)+'" rx="'+(short*.014)+'" fill="'+(i===bars.length-1?'url(#artAccent)':'#3bc9a7')+'" opacity="'+(.42+i*.14)+'"/>').join('');
 const labels=(rtl?['فكرة','بناء','إطلاق']:['IDEA','BUILD','LAUNCH']).map((label,i)=>'<text x="'+(artX+artW*(.18+i*.25))+'" y="'+(artY+artH*.91)+'" text-anchor="middle" fill="#d9e7f4" font-family="'+fontFamily+'" font-size="'+(short*.018)+'" font-weight="700" letter-spacing="2">'+label+'</text>').join('');
 const footerY=h*.925;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+d.unit+'" height="'+h+d.unit+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(d.title||'Book cover')+'"><defs><linearGradient id="coverBg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+bgStart+'"/><stop offset=".58" stop-color="'+esc(d.color)+'"/><stop offset="1" stop-color="'+bgEnd+'"/></linearGradient><linearGradient id="titleAccent" x1="0" y1="0" x2="1" y2="0"><stop stop-color="'+accentColor+'"/><stop offset="1" stop-color="#a4f0d8"/></linearGradient><linearGradient id="artAccent" x1="0" y1="1" x2="1" y2="0"><stop stop-color="'+accentColor+'"/><stop offset="1" stop-color="#b4f5df"/></linearGradient></defs><rect width="'+w+'" height="'+h+'" fill="url(#coverBg)"/><path d="M '+(w*.76)+' 0 L '+w+' 0 L '+w+' '+(h*.31)+' Z" fill="#ffffff" opacity=".025"/><path d="M 0 '+(h*.78)+' L 0 '+h+' L '+(w*.20)+' '+h+' Z" fill="'+accentColor+'" opacity=".055"/><circle cx="'+(w*.91)+'" cy="'+(h*.08)+'" r="'+(short*.18)+'" fill="none" stroke="'+accentColor+'" stroke-width="'+(short*.003)+'" opacity=".28"/><rect x="'+pad+'" y="'+(h*.076)+'" width="'+(short*.085)+'" height="'+(short*.013)+'" rx="'+(short*.006)+'" fill="'+accentColor+'"/><text x="'+(pad+short*.11)+'" y="'+(h*.086)+'" fill="#f8fbff" font-family="'+fontFamily+'" font-size="'+(short*.033)+'" font-weight="700" letter-spacing="3">'+brand+'</text><text x="'+pad+'" y="'+(h*.17)+'" fill="'+accentColor+'" font-family="'+fontFamily+'" font-size="'+(short*.022)+'" font-weight="700" letter-spacing="5">'+(rtl?'الدليل العملي':'THE PRACTICAL PLAYBOOK')+'</text>'+title+subtitle+'<rect x="'+(artX+short*.012)+'" y="'+(artY+short*.015)+'" width="'+artW+'" height="'+artH+'" rx="'+(short*.032)+'" fill="#000000" opacity=".18"/><rect x="'+artX+'" y="'+artY+'" width="'+artW+'" height="'+artH+'" rx="'+(short*.032)+'" fill="'+panelFill+'" stroke="'+panelStroke+'" stroke-width="'+(short*.0025)+'"/><circle cx="'+(artX+artW*.82)+'" cy="'+(artY+artH*.30)+'" r="'+(artH*.38)+'" fill="'+accentColor+'" opacity=".08"/><text x="'+(artX+artW*.09)+'" y="'+(artY+artH*.16)+'" fill="#c4d6e7" font-family="'+fontFamily+'" font-size="'+(short*.017)+'" font-weight="700" letter-spacing="3">'+(rtl?'خطوات بسيطة نحو السوق':'A SIMPLE PATH TO MARKET')+'</text><path d="M '+(artX+artW*.09)+' '+baseY+' L '+(artX+artW*.78)+' '+baseY+'" stroke="#52677a" stroke-width="'+(short*.003)+'"/>'+barShapes+'<path d="M '+(artX+artW*.12)+' '+(baseY-artH*.12)+' C '+(artX+artW*.30)+' '+(baseY-artH*.30)+' '+(artX+artW*.46)+' '+(baseY-artH*.34)+' '+(artX+artW*.68)+' '+(baseY-artH*.65)+'" fill="none" stroke="url(#artAccent)" stroke-width="'+(short*.012)+'" stroke-linecap="round"/><path d="M '+(artX+artW*.655)+' '+(baseY-artH*.65)+' L '+(artX+artW*.70)+' '+(baseY-artH*.68)+' L '+(artX+artW*.69)+' '+(baseY-artH*.62)+'" fill="none" stroke="'+accentColor+'" stroke-width="'+(short*.012)+'" stroke-linecap="round" stroke-linejoin="round"/>'+labels+'<text x="'+pad+'" y="'+footerY+'" fill="#d1dce7" opacity=".72" font-family="'+fontFamily+'" font-size="'+(short*.019)+'" letter-spacing="3">'+brand+'  ·  DIGITAL PRODUCT SERIES</text></svg>';
}
function svgFor(d){
 const w=d.w,h=d.h,short=Math.min(w,h),pad=short*.075;
 const offset=(name)=>' data-design-object="'+name+'" transform="'+transformValue(name)+'"';
 const group=(name,content)=>'<g'+offset(name)+'>'+content+'</g>';
 const font=short*.052,titleSize=short*.082;
 if(d.type==='logo'){
  const name=esc(d.brand||d.title||'YOUR BRAND'),tag=esc(d.subtitle||'');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+d.w+d.unit+'" height="'+d.h+d.unit+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+name+' logo"><rect width="'+w+'" height="'+h+'" rx="'+(short*.12)+'" fill="'+esc(d.color)+'"/>'+group('symbol','<circle cx="'+(w*.24)+'" cy="'+(h*.5)+'" r="'+(h*.25)+'" fill="'+esc(d.accent)+'"/><path d="M '+(w*.13)+' '+(h*.52)+' L '+(w*.22)+' '+(h*.62)+' L '+(w*.36)+' '+(h*.37)+'" fill="none" stroke="'+esc(d.color)+'" stroke-width="'+(h*.035)+'" stroke-linecap="round" stroke-linejoin="round"/>')+group('brand','<text x="'+(w*.43)+'" y="'+(h*.48)+'" dominant-baseline="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="'+(h*.12)+'" font-weight="700">'+name+'</text>')+group('subtitle','<text x="'+(w*.43)+'" y="'+(h*.69)+'" fill="'+esc(d.accent)+'" font-family="Arial,sans-serif" font-size="'+(h*.055)+'" letter-spacing="2">'+tag+'</text>')+customElementsSvg(d)+'</svg>';
 }
 if(d.type==='cover')return ebookCoverSvg(d);
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
 const rtl=isRtlText(d.title)||isRtlText(d.subtitle),textX=rtl?(isWide?w*.95:w-pad):titleX,textAnchor=rtl?'end':'start',direction=rtl?'rtl':'ltr';
 const title=titleLines.map((line,i)=>'<text x="'+textX+'" y="'+(titleY+i*titleSizeFit*1.12)+'" text-anchor="'+textAnchor+'" direction="'+direction+'" fill="#ffffff" font-family="Arial,sans-serif" font-size="'+titleSizeFit+'" font-weight="700">'+esc(line)+'</text>').join('');
 const subtitle=subLines.map((line,i)=>'<text x="'+textX+'" y="'+(subStart+i*subtitleSize*1.3)+'" text-anchor="'+textAnchor+'" direction="'+direction+'" fill="#ecf5ff" opacity=".92" font-family="Arial,sans-serif" font-size="'+subtitleSize+'">'+esc(line)+'</text>').join('');
 const photo=d.photo?'<image href="'+d.photo+'" x="'+imageBox.x+'" y="'+imageBox.y+'" width="'+imageBox.w+'" height="'+imageBox.h+'" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>':generatedArtworkSvg(d,imageBox,short);
 const ctaText=esc(d.cta||'LEARN MORE'),brandText=esc(d.brand||'YOUR BRAND');
 return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+d.w+d.unit+'" height="'+d.h+d.unit+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(d.title)+'"><defs><linearGradient id="fade" x2="1" y2="1"><stop stop-color="'+esc(d.color)+'"/><stop offset="1" stop-color="#091321"/></linearGradient><clipPath id="photoClip"><rect x="'+imageBox.x+'" y="'+imageBox.y+'" width="'+imageBox.w+'" height="'+imageBox.h+'" rx="'+(short*.035)+'"/></clipPath></defs><rect width="'+w+'" height="'+h+'" fill="url(#fade)"/>'+shape+group('brand','<rect x="'+pad+'" y="'+(brandY-short*.01)+'" width="'+(short*.07)+'" height="'+(short*.012)+'" rx="'+(short*.006)+'" fill="'+esc(d.accent)+'"/><text x="'+(pad+short*.09)+'" y="'+brandY+'" fill="#ffffff" font-family="Arial,sans-serif" font-size="'+(font*.72)+'" font-weight="700" letter-spacing="3">'+brandText+'</text>')+group('label','<text x="'+pad+'" y="'+(brandY+font*1.8)+'" fill="'+esc(d.accent)+'" font-family="Arial,sans-serif" font-size="'+(font*.53)+'" font-weight="700" letter-spacing="4">'+esc(label)+'</text>')+group('title',title)+group('subtitle',subtitle)+group('image',photo)+customElementsSvg(d)+'<rect x="'+pad+'" y="'+(footerY-short*.055)+'" width="'+(w-pad*2)+'" height="'+(short*.10)+'" rx="'+(short*.05)+'" fill="'+esc(d.accent)+'"/>'+group('cta','<text x="'+(w/2)+'" y="'+footerY+'" text-anchor="middle" dominant-baseline="middle" fill="#071321" font-family="Arial,sans-serif" font-size="'+(font*.92)+'" font-weight="700" letter-spacing="2">'+ctaText+'</text>')+'<text x="'+pad+'" y="'+(h-pad*.55)+'" fill="#ffffff" opacity=".55" font-family="Arial,sans-serif" font-size="'+(font*.35)+'">'+esc(d.type==='label'||d.type==='insert'?'PRINT ARTWORK · VERIFY FINAL SIZE WITH SUPPLIER':'EDITABLE VECTOR DESIGN · '+d.w+' × '+d.h+' '+d.unit)+'</text></svg>';
}
let previousObjectUrl='';
function renderSelectedTools(){
 const panel=$('selectedObjectTools');if(!panel)return;
 const label=$('selectedObjectLabel'),custom=selectedObjectName.startsWith('custom-');
 panel.classList.toggle('hidden',!selectedObjectName);
 if(label)label.textContent=selectedObjectName?(custom?'Custom element: '+(customElements.find(el=>'custom-'+el.id===selectedObjectName)?.type||'graphic'):selectedObjectName.charAt(0).toUpperCase()+selectedObjectName.slice(1)):'Tap an object in the preview to select it.';
 $('selectedDuplicate').classList.toggle('hidden',!custom);$('selectedRemove').classList.toggle('hidden',!custom);
}
function selectDesignObject(name,target){
 selectedObjectName=name;
 $('designCanvas').querySelectorAll('[data-design-object].is-selected').forEach(node=>node.classList.remove('is-selected'));
 target?.classList.add('is-selected');renderSelectedTools();
}
function adjustSelected(transform,delta){
 if(!selectedObjectName)return;
 const o={x:0,y:0,scale:1,rotate:0,...layoutOffsets[selectedObjectName]};
 if(transform==='scale')o.scale=Math.max(.35,Math.min(2.8,o.scale+delta));
 else o.rotate=Math.max(-180,Math.min(180,o.rotate+delta));
 layoutOffsets[selectedObjectName]=o;render();
}
function drawSelectionFrame(svg,name,node){
 svg.querySelectorAll('[data-design-ui="selection"]').forEach(item=>item.remove());
 if(!node||!node.isConnected)return;
 const box=node.getBBox(),matrix=node.getCTM();if(!matrix)return;
 const toSvg=(x,y)=>{const p=svg.createSVGPoint();p.x=x;p.y=y;return p.matrixTransform(matrix)};
 const corners=[toSvg(box.x,box.y),toSvg(box.x+box.width,box.y),toSvg(box.x+box.width,box.y+box.height),toSvg(box.x,box.y+box.height)];
 const ns='http://www.w3.org/2000/svg',frame=document.createElementNS(ns,'polygon');
 frame.setAttribute('points',corners.map(p=>p.x+','+p.y).join(' '));frame.setAttribute('class','design-selection-frame');frame.setAttribute('data-design-ui','selection');frame.setAttribute('pointer-events','none');svg.append(frame);
 const handle=document.createElementNS(ns,'circle'),corner=corners[2];
 handle.setAttribute('cx',corner.x);handle.setAttribute('cy',corner.y);handle.setAttribute('r','10');handle.setAttribute('class','design-resize-handle');handle.setAttribute('data-resize-handle',name);handle.setAttribute('data-design-ui','selection');handle.setAttribute('aria-label','Resize selected element');svg.append(handle);
}
function attachCanvasEditing(svg){
 const names={brand:'designBrand',label:null,title:'designTitle',subtitle:'designSubtitle',image:null,cta:'designCta',symbol:null};
 const point=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())};
 const findNode=name=>Array.from(svg.querySelectorAll('[data-design-object]')).find(node=>node.getAttribute('data-design-object')===name);
 if(selectedObjectName){const selected=findNode(selectedObjectName);selected?.classList.add('is-selected');if(selected)drawSelectionFrame(svg,selectedObjectName,selected)}
 svg.addEventListener('pointerdown',e=>{
  const handle=e.target.closest('[data-resize-handle]');
  if(handle){
   e.preventDefault();const name=handle.getAttribute('data-resize-handle'),target=findNode(name);if(!target)return;
   const p=point(e),box=target.getBBox(),matrix=target.getCTM();if(!matrix)return;
   const centerLocal=svg.createSVGPoint();centerLocal.x=box.x+box.width/2;centerLocal.y=box.y+box.height/2;
   const center=centerLocal.matrixTransform(matrix),base={x:0,y:0,scale:1,rotate:0,...layoutOffsets[name]};
   selectDesignObject(name,target);dragState={mode:'resize',name,target,start:p,center,startDistance:Math.max(1,Math.hypot(p.x-center.x,p.y-center.y)),base,pointerId:e.pointerId};
   try{svg.setPointerCapture(e.pointerId)}catch{}return;
  }
  const target=e.target.closest('[data-design-object]');if(!target)return;
  e.preventDefault();const p=point(e),name=target.getAttribute('data-design-object'),base={x:0,y:0,scale:1,rotate:0,...layoutOffsets[name]};
  selectDesignObject(name,target);dragState={mode:'move',name,target,start:p,base,pointerId:e.pointerId};target.classList.add('is-dragging');
  try{svg.setPointerCapture(e.pointerId)}catch{}
 });
 svg.addEventListener('pointermove',e=>{
  if(!dragState||dragState.pointerId!==e.pointerId)return;
  const p=point(e),state=dragState;
  if(state.mode==='resize'){
   const ratio=Math.hypot(p.x-state.center.x,p.y-state.center.y)/state.startDistance;
   const scale=Math.max(.35,Math.min(3.2,state.base.scale*ratio));
   state.target.setAttribute('transform',transformValue(state.name,{...state.base,scale}));drawSelectionFrame(svg,state.name,state.target);
  }else{
   const dx=p.x-state.start.x,dy=p.y-state.start.y;
   state.target.setAttribute('transform',transformValue(state.name,{...state.base,x:state.base.x+dx,y:state.base.y+dy}));drawSelectionFrame(svg,state.name,state.target);
  }
 });
 const finish=e=>{
  if(!dragState||dragState.pointerId!==e.pointerId)return;
  const state=dragState,p=point(e),name=state.name;
  if(state.mode==='resize'){
   const ratio=Math.hypot(p.x-state.center.x,p.y-state.center.y)/state.startDistance;
   layoutOffsets[name]={...state.base,scale:Math.max(.35,Math.min(3.2,state.base.scale*ratio))};
  }else{
   const dx=p.x-state.start.x,dy=p.y-state.start.y;
   layoutOffsets[name]={...state.base,x:state.base.x+dx,y:state.base.y+dy};
  }
  dragState=null;render();
 };
 svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
 svg.addEventListener('dblclick',e=>{
  const target=e.target.closest('[data-design-object]'),name=target&&target.getAttribute('data-design-object');
  const id=name&&name.startsWith('custom-')?'customText-'+name.slice(7):(name&&names[name]);
  if(id&&$(id)){const field=$(id);field.scrollIntoView({behavior:'smooth',block:'center'});field.focus()}
 });
}
function render(){const d=stateFromForm(),svg=svgFor(d);$('designCanvas').innerHTML=svg;const canvasSvg=$('designCanvas').querySelector('svg');if(canvasSvg)attachCanvasEditing(canvasSvg);renderSelectedTools();$('designDimensions').textContent=d.w+' × '+d.h+' '+d.unit;$('designDimensionsPreview').textContent=d.w+' × '+d.h+' '+d.unit;if(previousObjectUrl)URL.revokeObjectURL(previousObjectUrl);$('designDownload').href=previousObjectUrl=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));scheduleHistory();}
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
  const name=document.createElement('strong');name.textContent=el.type==='image'?'Image':el.type==='text'?'Text':el.type==='rectangle'?'Rectangle':el.type==='circle'?'Circle':(el.icon||'Icon').replace(/^./,c=>c.toUpperCase());
  const actions=document.createElement('div');actions.className='design-layer-actions';
  const index=customElements.findIndex(item=>item.id===el.id);
  const move=(delta)=>{const next=index+delta;if(next<0||next>=customElements.length)return;const [item]=customElements.splice(index,1);customElements.splice(next,0,item);renderCustomElements();render()};
  const forward=document.createElement('button');forward.type='button';forward.className='ghost';forward.textContent='Forward';forward.disabled=index===customElements.length-1;forward.setAttribute('aria-label','Move layer forward');forward.addEventListener('click',()=>move(1));
  const backward=document.createElement('button');backward.type='button';backward.className='ghost';backward.textContent='Back';backward.disabled=index===0;backward.setAttribute('aria-label','Move layer backward');backward.addEventListener('click',()=>move(-1));
  const duplicate=document.createElement('button');duplicate.type='button';duplicate.className='ghost';duplicate.textContent='Duplicate';duplicate.addEventListener('click',()=>duplicateCustomElement(el.id));
  const visibility=document.createElement('button');visibility.type='button';visibility.className='ghost';visibility.textContent=el.hidden?'Show':'Hide';visibility.setAttribute('aria-label',el.hidden?'Show layer':'Hide layer');visibility.addEventListener('click',()=>{el.hidden=!el.hidden;if(selectedObjectName==='custom-'+el.id&&el.hidden)selectedObjectName='';renderCustomElements();render()});
  const remove=document.createElement('button');remove.type='button';remove.className='ghost';remove.textContent='Remove';
  remove.addEventListener('click',()=>{customElements=customElements.filter(item=>item.id!==el.id);delete layoutOffsets['custom-'+el.id];renderCustomElements();render()});
  actions.append(forward,backward,duplicate,visibility,remove);head.append(name,actions);row.append(head);
  if(el.type==='image'){
   const preview=document.createElement('img');preview.className='design-layer-thumbnail';preview.src=el.src||'';preview.alt=el.alt||'Uploaded image';row.append(preview);
   const altInput=document.createElement('input');altInput.type='text';altInput.id='customText-'+el.id;altInput.maxLength=80;altInput.value=el.alt||'';altInput.placeholder='Describe this image';altInput.setAttribute('aria-label','Image description');
   altInput.addEventListener('input',()=>{el.alt=altInput.value;preview.alt=el.alt||'Uploaded image';render()});row.append(altInput);
   const hint=document.createElement('p');hint.className='muted';hint.textContent='Drag the image on the preview. Select it to resize, rotate, duplicate or reorder it.';row.append(hint);
  }else if(el.type==='text'){
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
   weightSelect.addEventListener('change',()=>{el.fontWeight=weightSelect.value;render()});weight.append(weightSelect);controls.append(weight);
   const align=document.createElement('label');align.className='design-layer-field';align.append(document.createTextNode('Alignment'));
   const alignSelect=document.createElement('select');alignSelect.setAttribute('aria-label','Text alignment');
   [['Automatic','auto'],['Left','left'],['Center','center'],['Right','right']].forEach(([label,val])=>{const option=document.createElement('option');option.value=val;option.textContent=label;option.selected=(el.align||'auto')===val;alignSelect.append(option)});
   alignSelect.addEventListener('change',()=>{el.align=alignSelect.value;render()});align.append(alignSelect);controls.append(align);row.append(controls);
  }else if(el.type==='rectangle'){
   const controls=document.createElement('div');controls.className='design-layer-controls';
   addRangeControl(controls,'Width',.1,.9,.01,el.width,v=>{el.width=v});
   addRangeControl(controls,'Height',.06,.7,.01,el.height,v=>{el.height=v});row.append(controls);
  }else if(el.type==='circle'){
   const controls=document.createElement('div');controls.className='design-layer-controls';
   addRangeControl(controls,'Radius',.04,.45,.01,el.radius,v=>{el.radius=v});row.append(controls);
  }else if(el.type==='icon'){
   const controls=document.createElement('div');controls.className='design-layer-controls';
   addRangeControl(controls,'Size',.05,.38,.01,el.size||.12,v=>{el.size=v});row.append(controls);
  }
  if(el.type!=='image'){const color=document.createElement('input');color.type='color';color.value=el.color;color.setAttribute('aria-label','Element color');color.addEventListener('input',()=>{el.color=color.value;render()});row.append(color)}root.append(row);
 });
}
function duplicateCustomElement(id){
 const original=customElements.find(item=>item.id===id);if(!original)return;
 const clone={...original,id:String(nextCustomId++)};
 if(Number.isFinite(clone.x))clone.x=Math.min(.9,clone.x+.035);
 if(Number.isFinite(clone.y))clone.y=Math.min(.9,clone.y+.035);
 customElements.push(clone);
 const oldOffset=layoutOffsets['custom-'+id];if(oldOffset)layoutOffsets['custom-'+clone.id]={...oldOffset};
 renderCustomElements();render();
}
function addCustomElement(type,icon=null){
 const id=String(nextCustomId++),short=Math.min(Number(value('designWidth'))||1080,Number(value('designHeight'))||1080);
 const element={id,type,color:['rectangle','icon'].includes(type)?value('designAccent')||'#59ddb0':'#ffffff'};
 if(type==='text')Object.assign(element,{text:'Your text',x:.1,y:.5,fontSize:Math.max(value('designUnit')==='mm'?3:32,Math.round(short*.075)),fontFamily:'Arial,sans-serif',fontWeight:'700'});
 if(type==='rectangle')Object.assign(element,{x:.15,y:.4,width:.7,height:.14});
 if(type==='circle')Object.assign(element,{x:.5,y:.5,radius:.12});
 if(type==='icon')Object.assign(element,{x:.5,y:.5,size:.12,icon:icon||'sparkle'});
 customElements.push(element);selectedObjectName='custom-'+id;renderCustomElements();render();
}
function selectPreset(){
 const p=presets[value('designType')];if(!p)return;
 layoutOffsets={};
 $('designWidth').value=p.w;$('designHeight').value=p.h;$('designUnit').value=p.unit;
 if(['label','insert','businesscard','pricetag'].includes(value('designType')))$('designPrintNote').classList.remove('hidden');else $('designPrintNote').classList.add('hidden');
 const ctaLabel=$('designCta')?.closest('label');if(ctaLabel)ctaLabel.classList.toggle('hidden',value('designType')==='cover');
 const photoLabel=$('designPhoto')?.closest('label'),photoStatus=$('designPhotoStatus');if(photoLabel)photoLabel.classList.toggle('hidden',value('designType')==='cover');if(photoStatus)photoStatus.classList.toggle('hidden',value('designType')==='cover'); const coverStyleLabel=$('designCoverStyleLabel');if(coverStyleLabel)coverStyleLabel.classList.toggle('hidden',value('designType')!=='cover');
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
async function readDesignElementImage(file){
 if(!file)return;
 const status=$('designElementImageStatus');
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>5*1024*1024){status.textContent='Choose a JPG, PNG or WebP image up to 5 MB.';return}
 try{
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=data});
  const scale=Math.min(1,1200/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const d=stateFromForm(),fit=Math.min(d.w*.72/canvas.width,d.h*.56/canvas.height),id=String(nextCustomId++);
  const element={id,type:'image',src:canvas.toDataURL('image/jpeg',.78),alt:(file.name.replace(/\.[^.]+$/,'').slice(0,80)||'Uploaded image'),x:.5,y:.49,width:canvas.width*fit/d.w,height:canvas.height*fit/d.h,aspectRatio:canvas.width/canvas.height};
  customElements.push(element);selectedObjectName='custom-'+id;renderCustomElements();render();status.textContent='Image added as a movable layer. Drag it on the preview to position it.';
 }catch{status.textContent='The selected image could not be opened. Try a JPG, PNG or WebP file.'}
}
async function loadSavedDesign(item){
 const projectId=value('projectSelect'),state=item.designState;
 if(!state||state.version!==1||!state.form){$('designStatus').textContent='This older saved design can be downloaded as SVG, but its editing details were not stored.';return}
 const preset=$('designType'),known=[...preset.options].some(option=>option.value===state.form.type);
 preset.value=known?state.form.type:'social';selectPreset();
 for(const [key,id] of Object.entries({w:'designWidth',h:'designHeight',unit:'designUnit',title:'designTitle',subtitle:'designSubtitle',brand:'designBrand',cta:'designCta',color:'designColor',accent:'designAccent',coverStyle:'designCoverStyle'})){
  if(state.form[key]!=null)$(id).value=String(state.form[key]);
 }
 customElements=Array.isArray(state.customElements)?state.customElements.slice(0,30):[];
 layoutOffsets=state.layoutOffsets&&typeof state.layoutOffsets==='object'?state.layoutOffsets:{};
 nextCustomId=customElements.reduce((max,el)=>Math.max(max,Number(el.id)||0),0)+1;
 const response=await fetch('/api/v2/designs/download?projectId='+encodeURIComponent(projectId)+'&id='+encodeURIComponent(item.id));
 if(response.ok){
  const svg=await response.text(),match=svg.match(/<image\b(?![^>]*\bdata-custom-image-id=)[^>]*\bhref="(data:image\/(?:jpeg|png|webp);base64,[^"]+)"/i);
  photoData=match?match[1]:'';
  const imageSources={};for(const found of svg.matchAll(/<image\b(?=[^>]*\bdata-custom-image-id="([^"]+)")(?=[^>]*\bhref="(data:image\/(?:jpeg|png|webp);base64,[^"]+)")[^>]*>/gi))imageSources[found[1]]=found[2];
  customElements.forEach(el=>{if(el.type==='image')el.src=imageSources[el.id]||''});
 }else photoData='';
 const photoInput=$('designPhoto');if(photoInput)photoInput.value='';
 $('designPhotoStatus').textContent=photoData?'Saved product photo restored.':'No product photo in this design.';
 renderCustomElements();render();
 $('designStatus').textContent='Saved design opened for editing. Saving will add an updated copy to this project.';resetHistory();
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
$('designType').addEventListener('change',selectPreset);$('designCoverStyle')?.addEventListener('change',render);
['designTitle','designSubtitle','designBrand','designCta','designColor','designAccent','designWidth','designHeight','designUnit','designCoverStyle'].forEach(id=>$(id)?.addEventListener('input',render));
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
  const response=await fetch('/api/v2/designs/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,title:d.title||presets[d.type].label,kind:presets[d.type].label,svg,designState:{version:1,form:{type:d.type,w:d.w,h:d.h,unit:d.unit,title:d.title,subtitle:d.subtitle,brand:d.brand,cta:d.cta,color:d.color,accent:d.accent,coverStyle:d.coverStyle},customElements:customElements.map(el=>{if(el.type!=='image')return el;const {src,...saved}=el;return saved}),layoutOffsets}})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save design.');
  $('designStatus').textContent='Design saved to this project. Download the SVG or open it in a compatible design editor.';
  await refreshSaved();
 }catch(error){$('designStatus').textContent='Save failed: '+error.message}
 finally{button.disabled=false}
});
$('projectSelect').addEventListener('change',refreshSaved);
$('resetDesignLayout')?.addEventListener('click',()=>{layoutOffsets={};render()});
$('addTextElement')?.addEventListener('click',()=>addCustomElement('text'));
$('addImageElement')?.addEventListener('click',()=>$('designElementImage')?.click());
async function refreshImageGenerationStatus(){
 const button=$('generateAiDesignImage'),status=$('aiDesignImageStatus');
 if(!button||!status)return;
 button.disabled=true;
 try{
  const response=await fetch('/api/v2/designs/image-status');
  const data=await response.json();
  imageGenerationAvailable=response.ok&&data.available===true;
 }catch{imageGenerationAvailable=false}
 button.disabled=!imageGenerationAvailable;
 status.textContent=imageGenerationAvailable
  ? 'Creates one photo using OpenAI. Each generation is a paid API request; confirm before it runs.'
  : 'AI photo generation is not enabled on the server yet. The connected OpenAI text feature does not automatically include image generation.';
}
async function generateAiDesignImage(){
 const button=$('generateAiDesignImage'),status=$('aiDesignImageStatus'),description=value('aiDesignImagePrompt');
 if(!imageGenerationAvailable){status.textContent='AI photo generation is not enabled on the server yet.';return}
 if(description.length<10){status.textContent='Describe the photo you want in at least 10 characters.';return}
 const d=stateFromForm();
 const prompt=[
  'Create one polished, photorealistic marketing photograph for a '+(presets[d.type]?.label||'digital product')+'.',
  'Main subject and scene: '+description+'.',
  d.title?'Design title/context: '+d.title+'.':'',
  d.subtitle?'Product details: '+d.subtitle+'.':'',
  d.brand?'Brand context: '+d.brand+'.':'',
  'Do not render any text, letters, logos, watermarks, or labels. Leave clear visual space for text to be added in the design editor. Use realistic lighting, materials, proportions, and a professional commercial photography style.'
 ].filter(Boolean).join(' ');
 if(!window.confirm('This sends one image request to OpenAI and may incur an API charge. Generate one photo now?'))return;
 button.disabled=true;status.textContent='Generating one photo with OpenAI…';
 try{
  const response=await fetch('/api/v2/designs/generate-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Could not generate the photo.');
  const base64=data.imageDataUrl.split(',')[1],binary=atob(base64),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const file=new File([bytes],'ai-generated-photo.png',{type:'image/png'});
  await readDesignElementImage(file);
  status.textContent='Photo generated and added as a movable image layer. Drag it on the preview to position it.';
 }catch(error){status.textContent=error.message||'Could not generate the photo.'}
 finally{button.disabled=!imageGenerationAvailable}
}
$('generateAiDesignImage')?.addEventListener('click',generateAiDesignImage);
refreshImageGenerationStatus();
$('designElementImage')?.addEventListener('change',event=>{const file=event.target.files?.[0];readDesignElementImage(file);event.target.value=''});
$('addRectangleElement')?.addEventListener('click',()=>addCustomElement('rectangle'));
$('addCircleElement')?.addEventListener('click',()=>addCustomElement('circle'));
$('addStarElement')?.addEventListener('click',()=>addCustomElement('icon','star'));
$('addArrowElement')?.addEventListener('click',()=>addCustomElement('icon','arrow'));
$('addSparkleElement')?.addEventListener('click',()=>addCustomElement('icon','sparkle'));
$('addHeartElement')?.addEventListener('click',()=>addCustomElement('icon','heart'));
$('addBookElement')?.addEventListener('click',()=>addCustomElement('icon','book'));
$('addBulbElement')?.addEventListener('click',()=>addCustomElement('icon','bulb'));
$('addLeafElement')?.addEventListener('click',()=>addCustomElement('icon','leaf'));
$('addCheckElement')?.addEventListener('click',()=>addCustomElement('icon','check'));
$('addTargetElement')?.addEventListener('click',()=>addCustomElement('icon','target'));
document.querySelectorAll('[data-palette]').forEach(button=>button.addEventListener('click',()=>{const [bg,accent]=button.dataset.palette.split('|');$('designColor').value=bg;$('designAccent').value=accent;render()}));
$('undoDesign')?.addEventListener('click',undoDesign);$('redoDesign')?.addEventListener('click',redoDesign);
$('selectedSizeDown')?.addEventListener('click',()=>adjustSelected('scale',-.1));$('selectedSizeUp')?.addEventListener('click',()=>adjustSelected('scale',.1));
$('selectedRotateLeft')?.addEventListener('click',()=>adjustSelected('rotate',-15));$('selectedRotateRight')?.addEventListener('click',()=>adjustSelected('rotate',15));
$('selectedDuplicate')?.addEventListener('click',()=>{const id=selectedObjectName.slice(7);if(selectedObjectName.startsWith('custom-'))duplicateCustomElement(id)});
$('selectedRemove')?.addEventListener('click',()=>{if(!selectedObjectName.startsWith('custom-'))return;const id=selectedObjectName.slice(7);customElements=customElements.filter(el=>el.id!==id);delete layoutOffsets[selectedObjectName];selectedObjectName='';renderCustomElements();render()});

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
renderCustomElements();selectPreset();resetHistory();setTimeout(refreshSaved,1200);
