import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarketResearchLinks } from '../public/research-links.js';

test('market research shortcuts use real allowlisted source pages and safely encode local queries',()=>{
  const links=createMarketResearchLinks({productName:'دفتر أطفال & ألعاب',audience:'ages 7–9',country:'لبنان',businessType:'physical'});
  assert.equal(links.length,5);
  assert.deepEqual(links.map(link=>link.label),['Google Search','Google Trends','Amazon listings','Etsy listings','Alibaba suppliers']);
  for(const link of links){
    const url=new URL(link.url);
    assert.equal(url.protocol,'https:');
    assert.ok(['www.google.com','trends.google.com','www.amazon.com','www.etsy.com','www.alibaba.com'].includes(url.hostname));
    assert.match(decodeURIComponent(url.href),/دفتر أطفال & ألعاب ages 7–9 لبنان/);
  }
  assert.equal(links.at(-1).sourceType,'supplier');
});

test('supplier catalogs are only suggested for physical sourcing models',()=>{
  for(const businessType of ['digital','service']){
    const links=createMarketResearchLinks({productName:'Language lessons',country:'Jordan',businessType});
    assert.equal(links.length,4);
    assert.ok(links.every(link=>link.sourceType==='market'));
  }
  const pod=createMarketResearchLinks({productName:'T-shirt',country:'US',businessType:'print_on_demand'});
  assert.equal(pod.length,6);
  assert.ok(pod.some(link=>link.label==='Printful catalog search'));
});

test('empty queries produce no external links',()=>{
  assert.deepEqual(createMarketResearchLinks({productName:' ',country:''}),[]);
});
