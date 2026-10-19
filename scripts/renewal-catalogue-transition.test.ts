import test from 'node:test';
import assert from 'node:assert/strict';
import { runSingleCampaign } from '../src/engine/campaignRunner';
import { createInitialSaveState, validateSavePayload } from '../src/engine/saveManager';
import { synthesizeAlchemyProduct, assembleTrapProduct, mergeCraftedProductIntoInventory, simulateRegionExpedition } from '../src/engine/simulation';
import { resolvePostRaidClients } from '../src/engine/economyEngine';
import { REAGENTS_CATALOG, TRAP_PARTS_CATALOG } from '../src/data/catalog';
import * as renewal from '../src/engine/encounterRenewal';
import { GameSaveState } from '../src/types/game';
const fogIds=['part_trg_07','part_con_04','part_del_04','part_pay_05','part_pow_04','part_rst_03'];
const craftedFog=(cam=false)=>assembleTrapProduct(fogIds.map(id=>TRAP_PARTS_CATALOG.find(p=>p.id===id)!) as any,'Pneumatic Sulphur-Fog Machine',false,cam);
function learnedFog() {
  const before=createInitialSaveState(739819);before.masters[0].installedHazards=['prod_trap_sulphur_fog','prod_trap_sulphur_fog'];before.masters[0].installedResetCharges=[0,0];
  before.parties[0].equippedProducts=[];before.parties[0].members[0].massKg=21;
  const report=simulateRegionExpedition(before.day,before.seed,before.masters[0],before.parties[0],before.products,[]);
  return renewal.recordCompletedEncounter(before,{...before,...resolvePostRaidClients(before,report),day:before.day+1,expeditionReports:[report]},report);
}
function merge(s:GameSaveState,p=craftedFog()) :GameSaveState {
  const fn=Reflect.get(renewal,'mergeCraftedInventoryState');assert.equal(typeof fn,'function','actual crafting needs a shared state-aware occurrence transition');
  return Reflect.apply(fn,undefined,[s,p,2]);
}
function valid(s:GameSaveState) { const v=validateSavePayload(JSON.stringify(s));assert(v.valid,v.error);assert.deepEqual(v.state,s); }

test('B3 RC01 parent failure Balanced739819 NONE day11 stays valid through real crafting and settlement',()=>{
  let days=0;
  runSingleCampaign(739819,'BALANCED_MERCHANT',11,false,undefined,{renewalPolicy:'NONE',onCompletedReport:(_r,s)=>{valid(s);days++;}});
  assert.equal(days,11);
});
test('B3 RC02 legitimate authored-SKU merge updates every live occurrence, preserves evidence and retained anti-churn, grants no request',()=>{
  const s=learnedFog(),before=structuredClone(s),id=s.masters[0].id,old=s.encounterRenewal!.masters[id];valid(s);
  assert.equal(old.requests.length,2);const next=merge(s),rec=next.encounterRenewal!.masters[id];valid(next);
  assert.deepEqual(s,before);assert.deepEqual(next.products,mergeCraftedProductIntoInventory(s.products,craftedFog(),2));
  assert.deepEqual(next.masters,s.masters);assert.deepEqual(next.parties,s.parties);assert.equal(next.gold,s.gold);assert.equal(next.debt,s.debt);
  assert.deepEqual(next.partInventory,s.partInventory);assert.deepEqual(next.contractHistory,s.contractHistory);
  assert.deepEqual(rec.occurrences.map(o=>o.id),old.occurrences.map(o=>o.id));assert.equal(rec.lowestMass,old.lowestMass);assert.equal(rec.epoch,old.epoch);
  assert.equal(rec.settledDay,old.settledDay);assert.equal(rec.settledIdentity,old.settledIdentity);assert.deepEqual(rec.history,old.history);
  assert.deepEqual(rec.requests.map(r=>r.evidence),old.requests.map(r=>r.evidence));assert(rec.requests.every(r=>r.status==='STALE'));
  assert.deepEqual(next.expeditionReports,s.expeditionReports,'crafting is not a new encounter');
});
test('B3 RC03 contradictory saved mechanics still reject, and crafting refuses to launder already corrupt occurrence metadata',()=>{
  const good=merge(learnedFog()),bad=structuredClone(good),id=bad.masters[0].id;
  bad.encounterRenewal!.masters[id].occurrences[0].mechanics.potency++;
  assert.equal(validateSavePayload(JSON.stringify(bad)).valid,false);
  const before=structuredClone(bad);assert.throws(()=>merge(bad),/occurrence|catalogue/i);assert.deepEqual(bad,before);valid(good);
});
test('B3 RC05 historical morph facts survive a legitimate later same-SKU rebrew; intrinsic contradictions and unknown references still reject',()=>{
  const before=createInitialSaveState(731900);before.parties[0].equippedProducts=['prod_chicken_morph'];before.parties[0].members[0].massKg=86;
  const report=simulateRegionExpedition(before.day,before.seed,before.masters[0],before.parties[0],before.products,[]);
  const s=renewal.recordCompletedEncounter(before,{...before,...resolvePostRaidClients(before,report),day:before.day+1,expeditionReports:[report]},report);valid(s);
  const oldFacts=structuredClone(s.encounterRenewal),oldMorph=s.products.find(p=>p.id==='prod_chicken_morph')!;
  const crafted=synthesizeAlchemyProduct(oldMorph.recipeComponents.map(id=>REAGENTS_CATALOG.find(r=>r.id===id)!) as any,oldMorph.name,false);
  const next=merge(s,crafted);assert.notEqual(next.products.find(p=>p.id===oldMorph.id)!.massEffectKg,oldMorph.massEffectKg);valid(next);
  assert.deepEqual(next.encounterRenewal,oldFacts,'future stock is not permission to rewrite earlier observations');assert.deepEqual(next.expeditionReports,s.expeditionReports);
  const bad=structuredClone(next),req=bad.encounterRenewal!.masters[bad.masters[0].id].requests[0];
  assert.equal(req.evidence.observation.counter.kind,'MORPH');if(req.evidence.observation.counter.kind==='MORPH')req.evidence.observation.counter.massEffectKg=-25;
  assert.equal(validateSavePayload(JSON.stringify(bad)).valid,false,'historical base/effect/effective mass must remain internally consistent');
  const unknown=structuredClone(next),counter=unknown.encounterRenewal!.masters[unknown.masters[0].id].requests[0].evidence.observation.counter;
  if(counter.kind==='MORPH')counter.productId='not_a_real_counter';assert.equal(validateSavePayload(JSON.stringify(unknown)).valid,false);
});

test('B3 RC04 stock-only and distinct cam-formula merges do not rewrite existing installed stats or learning',()=>{
  const s=merge(learnedFog()),stockOnly=merge(s);valid(stockOnly);assert.deepEqual(stockOnly.encounterRenewal,s.encounterRenewal);
  const enhanced=merge(s,craftedFog(true));valid(enhanced);assert.deepEqual(enhanced.encounterRenewal,s.encounterRenewal);
  assert.deepEqual(enhanced.products.find(p=>p.id==='prod_trap_sulphur_fog'),s.products.find(p=>p.id==='prod_trap_sulphur_fog'));
  assert.equal(craftedFog(true).detectionDC,craftedFog(false).detectionDC+12);
});
