import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { resolvePostRaidClients, computeQuotation, resolveConsumableWear } from '../src/engine/economyEngine';
import { GameSaveState, ExpeditionReport } from '../src/types/game';
import { runSingleCampaign } from '../src/engine/campaignRunner';
import { assembleTrapProduct, simulateRegionExpedition, isTrapTriggeredByMass } from '../src/engine/simulation';
import { TRAP_PARTS_CATALOG } from '../src/data/catalog';
import { createInitialSaveState, validateSavePayload, loadGameWithRecovery, persistAtomicSaveSafe,
  SAVE_STORAGE_KEY, SAVE_BACKUP_KEY, QUARANTINE_KEY } from '../src/engine/saveManager';

const reviewer=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/d01-d04/reviewer-breach.json.gz',import.meta.url))).toString()) as {before:GameSaveState;report:ExpeditionReport};
test('D01 reviewer breach: shared -8 once, budgets/loadouts/memory preserved and quotes agree',()=>{
  const before=structuredClone(reviewer.before), report=reviewer.report;
  const settled=resolvePostRaidClients(before,report);
  assert.equal(settled.masters.find(m=>m.id===report.masterId)!.trust,54);
  assert.equal(settled.parties.find(p=>p.id===report.partyId)!.trust,61);
  let actual:any;
  runSingleCampaign(711,'PREDATORY_CAPITALIST',1,false,undefined,{onAfterRaid:s=>{actual=s;}});
  assert.equal(actual.gold,2560);assert.equal(actual.debt,0);
  assert.deepEqual(actual.masters,settled.masters);assert.deepEqual(actual.parties,settled.parties);
  assert.deepEqual(before,reviewer.before,'settlement must not mutate its input');
  for(const type of ['MASTER','HERO'] as const){
    const clients=type==='MASTER'?'masters':'parties';const id=type==='MASTER'?report.masterId:report.partyId;
    const product=before.products.find(p=>p.id===before.contractsToday.find(c=>c.buyerType===type)!.productId)!;
    const options={...before.tradeTerms!,seed:before.seed,day:report.day+1,unlockedSkills:before.skills.filter(s=>s.unlocked).map(s=>s.effectKey)};
    assert.deepEqual(computeQuotation(product,actual[clients].find((c:any)=>c.id===id),type,options),computeQuotation(product,settled[clients].find(c=>c.id===id)!,type,options));
  }
});
const parts=(ids:string[])=>ids.map(id=>TRAP_PARTS_CATALOG.find(p=>p.id===id)!);
const defaultPartIds=['part_trg_01','part_con_01','part_del_01','part_pay_01','part_pow_01','part_rst_01'];
test('D03 new cam assembly gains exactly 12 DC, a distinct identity and no unrelated stat/price boost',()=>{
  const tuple=parts(defaultPartIds);
  const before=Reflect.apply(assembleTrapProduct,undefined,[tuple,'Same display name',false,false]);
  const after=Reflect.apply(assembleTrapProduct,undefined,[tuple,'Same display name',false,true]);
  assert.equal(before.detectionDC,21);assert.equal(after.detectionDC,33);
  assert.notEqual(after.id,before.id);assert(after.appliedSkills.includes('auto_reset_cam'));
  for(const key of ['productionCost','suggestedPrice','potency','stability','reliability','stock','recipeComponents','counterClasses'])assert.deepEqual(after[key],before[key]);
  assert.deepEqual(after,Reflect.apply(assembleTrapProduct,undefined,[tuple,'Same display name',false,true]));
});
test('D03 the persisted DC changes real detection rolls, not merely a description',()=>{
  const tuple=parts([...defaultPartIds.slice(0,1),'part_con_03',...defaultPartIds.slice(2)]);
  const base=Reflect.apply(assembleTrapProduct,undefined,[tuple,'DC base',false,false]);
  const cam=Reflect.apply(assembleTrapProduct,undefined,[tuple,'DC cam',false,true]);
  assert.equal(cam.detectionDC,base.detectionDC+12);
  const s=createInitialSaveState();s.parties[0].equippedProducts=[];let changed=false;
  for(let seed=1;seed<=200;seed++){
    const ordinary=simulateRegionExpedition(1,seed,{...s.masters[0],installedHazards:[base.id]},s.parties[0],[...s.products,base],[]).rooms[0];
    const improved=simulateRegionExpedition(1,seed,{...s.masters[0],installedHazards:[cam.id]},s.parties[0],[...s.products,cam],[]).rooms[0];
    if(ordinary.outcome==='COUNTER_SUCCEEDED'&&improved.outcome==='TRAP_TRIGGERED'){changed=true;assert(improved.causalExplanation.includes(`DC ${cam.detectionDC}`));break;}
  }
  assert(changed,'the additional detection difficulty must affect an actual raid');
});
test('D03 high-end new assemblies retain the exact +12 above 100 and survive save validation',()=>{
  const s=createInitialSaveState();
  const p=Reflect.apply(assembleTrapProduct,undefined,[parts(['part_trg_12','part_con_10','part_del_10','part_pay_01','part_pow_01','part_rst_01']),'High DC',false,true]);
  assert.equal(p.detectionDC,103);s.products.push(p);
  const restored=validateSavePayload(JSON.stringify(s));assert(restored.valid,restored.error);assert.equal(restored.state!.products.find(r=>r.id===p.id)!.detectionDC,103);
});
test('D03 preserves existing global wear immunity, including warranty wear and saved temporal charge',()=>{
  const s=createInitialSaveState();
  const trap=Reflect.apply(assembleTrapProduct,undefined,[parts([...defaultPartIds.slice(0,5),'part_rst_09']),'Existing temporal trap',false,false]);
  const master={...s.masters[0],installedHazards:[trap.id],installedResetCharges:[1]};
  const before=structuredClone(master),wear=resolveConsumableWear(s.parties[0],master,3,3,['auto_reset_cam']);
  assert.deepEqual(wear.nextInstalled,[trap.id]);assert.deepEqual(wear.nextResetCharges,[1]);assert.equal(wear.rewindsSpent,0);assert.deepEqual(master,before);
});
test('D04 inversion module text matches the existing under-25kg predicate, without a heavy trigger',()=>{
  const module=TRAP_PARTS_CATALOG.find(p=>p.id==='part_trg_12')!;
  assert.equal(module.description,'Triggers only on intruders under 25kg; intruders of 25kg or more bypass this sensor.');
});
for(const mass of [19,21,25,54,86])test(`D04 ${mass}kg: shared workshop assessor and actual raid keep the approved boundary`,()=>{
  const s=createInitialSaveState(),trap=Reflect.apply(assembleTrapProduct,undefined,[parts(['part_trg_12',...defaultPartIds.slice(1)]),'Inversion boundary',false,false]);
  s.parties[0].members[0].massKg=mass;s.parties[0].equippedProducts=[];
  assert.equal(isTrapTriggeredByMass(trap,mass),mass<25);
  const report=simulateRegionExpedition(1,s.seed,{...s.masters[0],installedHazards:[trap.id]},s.parties[0],[...s.products,trap],[]);
  assert.equal(report.rooms.length,3);assert(report.rooms.every(r=>r.heroEffectiveMassKg===mass&&r.outcome===(mass<25?'TRAP_TRIGGERED':'TRAP_BYPASSED')));
});
class RepairStorage {
  data=new Map<string,string>(); writes=0; failAt=-1;
  getItem(k:string){return this.data.get(k)??null;}
  setItem(k:string,v:string){if(++this.writes===this.failAt)throw Error('interrupted');this.data.set(k,v);}
}
const invalidResources:Record<string,(s:GameSaveState)=>void>={
  '200 doses':s=>{s.parties[0].equippedProducts=Array(200).fill(s.products[0].id);},
  'fifth dose':s=>{s.parties[0].equippedProducts=Array(5).fill(s.products[0].id);},
  'fourth installation':s=>{s.masters[0].installedHazards=Array(4).fill(s.products[5].id);s.masters[0].installedResetCharges=[0,0,0,0];},
  'unknown reagent':s=>{s.reagentInventory.reg_not_in_catalog=1;},
  'unknown part':s=>{s.partInventory.part_not_in_catalog=0;},
  'unknown recipe input':s=>{s.products[0].recipeComponents.push('invented_component');},
  'unknown equipped SKU':s=>{s.parties[0].equippedProducts=['unknown_SKU'];},
  'unaligned reset slots':s=>{s.masters[0].installedResetCharges=[];},
  'fractional reset reserve':s=>{s.masters[0].installedResetCharges=[0.5];},
  'excess reset reserve':s=>{s.masters[0].installedResetCharges=[2];},
  'reset on non-temporal item':s=>{s.masters[0].installedResetCharges=[1];}
};
for(const [label,damage] of Object.entries(invalidResources))test(`D02 rejects ${label} before rotating either checkpoint`,()=>{
  const good=createInitialSaveState(),bad=structuredClone(good);damage(bad);const raw=JSON.stringify(bad);
  assert.equal(validateSavePayload(raw).valid,false);
  const st=new RepairStorage();const checkpoint=JSON.stringify(good);st.setItem(SAVE_STORAGE_KEY,checkpoint);st.setItem(SAVE_BACKUP_KEY,checkpoint);
  assert.equal(persistAtomicSaveSafe(bad,st as any),false);assert.equal(st.getItem(SAVE_STORAGE_KEY),checkpoint);assert.equal(st.getItem(SAVE_BACKUP_KEY),checkpoint);
  st.data.set(SAVE_STORAGE_KEY,raw);
  const loaded=loadGameWithRecovery(st as any);assert.equal(loaded.source,'BACKUP');assert.deepEqual(loaded.state,good);
  assert([...st.data].some(([k,v])=>k.startsWith(QUARANTINE_KEY)&&v===raw),'original rejected text must remain recoverable');
  assert.equal(st.getItem(SAVE_BACKUP_KEY),checkpoint);
});
test('D02 bad outgoing data and interrupted writes preserve checkpoints and original in-memory input',()=>{
  for(const failure of [1,2,3]){
    const good=createInitialSaveState(),bad=structuredClone(good);bad.parties[0].equippedProducts=Array(200).fill(good.products[0].id);
    const st=new RepairStorage(),raw=JSON.stringify(good);st.data.set(SAVE_STORAGE_KEY,raw);st.data.set(SAVE_BACKUP_KEY,raw);st.failAt=failure;
    assert.equal(persistAtomicSaveSafe(bad,st as any),false);assert.equal(st.getItem(SAVE_STORAGE_KEY),raw);assert.equal(st.getItem(SAVE_BACKUP_KEY),raw);assert.equal(bad.parties[0].equippedProducts.length,200);
  }
});
test('D02 reviewer-played historical Day5 v1/v2 resources restore across every existing slot',()=>{
  const fixtures=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/d01-d04/reviewer-historical-day5.json.gz',import.meta.url))).toString());
  assert.equal(fixtures.length,2);
  for(const f of fixtures)for(const slot of ['trap_and_tonic_save_v2','trap_and_tonic_save_v2_backup','trap_and_tonic_backup_v2','trap_and_tonic_save_v1_backup','trap_and_tonic_save_v1']){
    const original=JSON.parse(f.raw),st=new RepairStorage();if(slot!==SAVE_STORAGE_KEY)st.data.set(SAVE_STORAGE_KEY,'{bad');st.data.set(slot,f.raw);
    const restored=loadGameWithRecovery(st as any).state;
    for(const key of ['day','gold','debt','products','masters','parties','reagentInventory','partInventory','contractHistory','financialLedger','catalystLedger','expertUnlocked'] as const){
      // Historical masters acquire only the explicitly versioned reset-slot field.
      if(key==='masters'){for(const m of original.masters)assert.deepEqual({...restored.masters.find(r=>r.id===m.id),installedResetCharges:undefined},{...m,installedResetCharges:undefined});}
      else assert.deepEqual(restored[key],original[key]);
    }
    assert.equal(st.getItem(slot),f.raw);
  }
});
test('D01 adversarial trust floors: breach precedes warranty loss, unrelated clients never penalised',()=>{
  for(const breach of [false,true]) for(const trust of [10,15,20,54,85,100]) for(const claims of [0,1,3]){
    const s=structuredClone(reviewer.before), report={...reviewer.report,exclusivityBreachDetected:breach,warrantyClaimsTriggered:claims};
    const m=s.masters.find(c=>c.id===report.masterId)!,p=s.parties.find(c=>c.id===report.partyId)!;m.trust=trust;p.trust=trust;
    const after=resolvePostRaidClients(s,report);const penalised=breach?Math.max(15,trust-8):trust;
    assert.equal(after.masters.find(c=>c.id===m.id)!.trust,penalised);
    assert.equal(after.parties.find(c=>c.id===p.id)!.trust,Math.max(15,penalised-claims*12));
    for(const other of after.masters.filter(c=>c.id!==m.id))assert.equal(other.trust,s.masters.find(c=>c.id===other.id)!.trust);
    for(const other of after.parties.filter(c=>c.id!==p.id))assert.equal(other.trust,s.parties.find(c=>c.id===other.id)!.trust);
  }
});
