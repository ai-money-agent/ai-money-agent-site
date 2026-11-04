import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBusinessLaunchPlan } from '../lib/business-planner.js';

const physical = {
  businessType:'dropshipping',productName:'Bottle carrier',audience:'hikers',country:'Lebanon',
  problem:'carrying water comfortably',outcome:'keep a bottle easy to reach',
  marketNotes:'Three listings checked by owner',marketSource:'manual marketplace review',marketSourceUrl:'https://example.com/research',
  supplierName:'Supplier entered by user',supplierSourceUrl:'https://example.com/quote',
  currency:'USD',sellingPrice:40,unitCost:12,shippingCost:4,packagingCost:1,otherCost:2,
  platformFeePercent:5,marketingCostPerSale:3
};

test('launch planner calculates profit and break-even marketing from entered quotes only',()=>{
  const plan=buildBusinessLaunchPlan(physical);
  assert.equal(plan.engine,'local_template');
  assert.equal(plan.economics.platformFee,2);
  assert.equal(plan.economics.totalCosts,24);
  assert.equal(plan.economics.estimatedProfit,16);
  assert.equal(plan.economics.marginPercent,40);
  assert.equal(plan.economics.breakEvenAdCost,19);
  assert.equal(plan.supplier.name,'Supplier entered by user');
  assert.equal(plan.supplier.status,'user_provided_unverified');
  assert.equal(plan.marketEvidence.status,'user_provided_unverified');
  assert.match(plan.marketEvidence.note,/no live web/i);
  assert.match(plan.simulationLabel,/not live research/i);
  assert.equal(plan.adDraft.status,'Local template draft — review and test');
});

test('physical models require a user-supplied supplier and never return fabricated vendor data',()=>{
  assert.throws(()=>buildBusinessLaunchPlan({...physical,supplierName:''}),/does not invent or look up suppliers/i);
  assert.throws(()=>buildBusinessLaunchPlan({...physical,unitCost:0}),/positive unit cost from a current supplier quote/i);
  const plan=buildBusinessLaunchPlan({...physical,businessType:'print_on_demand',supplierName:'My print shop'});
  assert.equal(plan.supplier.name,'My print shop');
  assert.equal(plan.supplier.quoteUrl,'https://example.com/quote');
  assert.equal(plan.marketEvidence.status,'user_provided_unverified');
});

test('digital plan labels missing evidence and accepts zero production cost without a vendor',()=>{
  const plan=buildBusinessLaunchPlan({
    businessType:'digital',productName:'Arabic activity workbook',audience:'families',country:'Lebanon',
    currency:'USD',sellingPrice:9,unitCost:0
  });
  assert.equal(plan.supplier.status,'not_required');
  assert.equal(plan.marketEvidence.status,'not_provided');
  assert.equal(plan.economics.estimatedProfit,9);
  assert.equal(plan.digitalFactoryNextStep.startsWith('Use the Digital Product Factory'),true);
});

test('calculator rejects invalid costs, fee rates, currencies and unsafe evidence URLs',()=>{
  assert.throws(()=>buildBusinessLaunchPlan({...physical,unitCost:-1}),/between 0 and 1000000000/i);
  assert.throws(()=>buildBusinessLaunchPlan({...physical,platformFeePercent:75}),/between 0 and 50/i);
  assert.throws(()=>buildBusinessLaunchPlan({...physical,currency:'XYZ'}),/Choose USD/i);
  assert.throws(()=>buildBusinessLaunchPlan({...physical,supplierSourceUrl:'javascript:alert(1)'}),/http or https URL/i);
});

test('Arabic plan remains explicit about user-entered evidence and local templates',()=>{
  const plan=buildBusinessLaunchPlan({...physical,language:'ar'});
  assert.match(plan.simulationLabel,/ليس بحثًا حيًا/);
  assert.match(plan.marketEvidence.label,/غير متحقق منها/);
  assert.match(plan.supplier.note,/مدخلاتك/);
  assert.match(plan.adDraft.status,/قالب محلي/);
});
