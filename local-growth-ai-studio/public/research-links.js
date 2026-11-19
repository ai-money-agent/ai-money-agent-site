const SOURCE_ORIGINS = Object.freeze({
  google: 'https://www.google.com',
  trends: 'https://trends.google.com',
  amazon: 'https://www.amazon.com',
  etsy: 'https://www.etsy.com',
  alibaba: 'https://www.alibaba.com'
});

export function createMarketResearchLinks({ productName='', audience='', country='', businessType='' }={}) {
  const terms=[productName,audience,country].map(value=>String(value||'').trim()).filter(Boolean).join(' ');
  if(!terms)return [];
  const query=encodeURIComponent(terms);
  const links=[
    {label:'Google Search',url:`${SOURCE_ORIGINS.google}/search?q=${query}`},
    {label:'Google Trends',url:`${SOURCE_ORIGINS.trends}/trends/explore?q=${query}`},
    {label:'Amazon listings',url:`${SOURCE_ORIGINS.amazon}/s?k=${query}`},
    {label:'Etsy listings',url:`${SOURCE_ORIGINS.etsy}/search?q=${query}`}
  ];
  if(['physical','dropshipping','print_on_demand'].includes(businessType)){
    links.push({label:'Alibaba suppliers',url:`${SOURCE_ORIGINS.alibaba}/trade/search?SearchText=${query}`});
    if(businessType==='print_on_demand')links.push({label:'Printful catalog search',url:`${SOURCE_ORIGINS.google}/search?q=${encodeURIComponent(`site:printful.com ${terms}`)}`});
  }
  return links.map(link=>({...link,query:terms,sourceType:link.label.includes('supplier')||link.label.includes('catalog')?'supplier':'market'}));
}
