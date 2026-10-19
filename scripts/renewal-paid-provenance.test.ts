import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInitialSaveState, validateSavePayload, persistAtomicSaveSafe, loadGameWithRecovery, SAVE_STORAGE_KEY, SAVE_BACKUP_KEY } from '../src/engine/saveManager';
import { simulateRegionExpedition, synthesizeAlchemyProduct } from '../src/engine/simulation';
import { resolvePostRaidClients, computeInstallationReplacementQuote as quote, executeInstallationReplacement as pay } from '../src/engine/economyEngine';
import { recordCompletedEncounter, replacementForRequest, mergeCraftedInventoryState } from '../src/engine/encounterRenewal';
import { REAGENTS_CATALOG } from '../src/data/catalog';
import { GameSaveState, EncounterRenewalRequest } from '../src/types/game';
const terms={priceMultiplier:1,warrantyBacked:false,exclusiveDeal:false,secretProvenance:false};
function valid(s:GameSaveState) { const v=validateSavePayload(JSON.stringify(s));assert(v.valid,v.error);assert.deepEqual(v.state,s); }
function fixture(morph=false) {
  const s=createInitialSaveState(962371);s.parties[0].equippedProducts=morph?['prod_chicken_morph']:[];s.parties[0].members[0].massKg=morph?103:38;
  s.masters[0].installedHazards=['prod_trap_plate_spikes','prod_trap_plate_spikes'];s.masters[0].installedResetCharges=[0,0];
  s.skills.find(k=>k.effectKey==='auto_reset_cam')!.unlocked=true;valid(s);return s;
}
function raid(s:GameSaveState) {
  const report=simulateRegionExpedition(s.day,s.seed,s.masters[0],s.parties[0],s.products,s.contractsToday);
  const next=recordCompletedEncounter(s,{...s,...resolvePostRaidClients(s,report),day:s.day+1,expeditionReports:[report,...s.expeditionReports]},report);valid(next);return next;
}
function paid(morph=false) {
  const learned=raid(fixture(morph)),r=learned.encounterRenewal!.masters[learned.masters[0].id].requests[0];
  const intent=replacementForRequest(learned,r.id,'prod_trap_hairtrigger_acid')!,q=quote(learned,intent,terms);assert(q.success,q.reason);
  const tx=pay(learned,intent,terms,q.unitPrice!);assert(tx.success,tx.reason);valid(tx.nextState!);return {learned,state:tx.nextState!,price:q.unitPrice!};
}
function request(s:GameSaveState):EncounterRenewalRequest { const m=s.encounterRenewal!.masters[s.masters[0].id];return [...m.requests,...m.history].find(r=>r.status==='SATISFIED_BY_PAID_REPLACEMENT')!; }
function reverseKeys(x:any):any { return Array.isArray(x)?x.map(reverseKeys):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).reverse().map(([k,v])=>[k,reverseKeys(v)])):x; }
// Each evidence mutation remains individually well-formed. Only its retained linked twin disagrees.
const evidenceChanges:[string,(e:any)=>void][]=[
  ['partyName',e=>{e.partyName+=' historical alias';}],
  ['roomIndex',e=>{e.observation.roomIndex=1;}],
  ['sourceSlotIndex',e=>{e.observation.sourceSlotIndex=1;}],
  ...['potency','detectionDC','threshold'].map(k=>[k,(e:any)=>{e.observation.mechanics[k]++;}] as [string,(e:any)=>void]),
  ...['temporal','petrification','fog','sabotage'].map(k=>[k,(e:any)=>{e.observation.mechanics[k]=!e.observation.mechanics[k];}] as [string,(e:any)=>void]),
  ['counterTuple',e=>{e.observation.baseMassKg=103;e.observation.counter={kind:'MORPH',productId:'prod_chicken_morph',massEffectKg:-65};}],
  ['reportDay',e=>{e.day=2;e.reportId='exp_day2_dm_cellar_1_pty_cellar_1';}],
  ['partyIdentity',e=>{e.partyId='pty_cellar_2';e.reportId='exp_day1_dm_cellar_1_pty_cellar_2';}],
  ['massTuple',e=>{e.observation.baseMassKg=39;e.observation.effectiveMassKg=39;}]
];
function contradictions(s:GameSaveState) {
  // A real later settlement makes day2 evidence individually admissible under the existing clock guards.
  const settled=raid(s),cases:[string,GameSaveState][]=[];
  for(const [name,change] of evidenceChanges)for(const side of ['request','history receipt','today receipt']) {
    const bad=structuredClone(settled),e=side==='request'?request(bad).evidence:(side==='history receipt'?bad.contractHistory:bad.contractsToday)[0].installationReplacement!.renewal!.evidence;
    change(e);cases.push([`${side} ${name}`,bad]);
  }
  return cases;
}
test('B3 PV01 real completed producer and shared paid transaction retain exact provenance, conserve resources and accept reordered JSON keys',()=>{
  const {learned,state,price}=paid();const r=request(state),c=state.contractHistory[0];
  assert.equal(c.installationReplacement!.renewal!.occurrenceId,r.occurrenceId);assert.deepEqual(c.installationReplacement!.renewal!.evidence,r.evidence);
  assert.equal(state.gold,learned.gold+price);assert.equal(state.masters[0].budget,learned.masters[0].budget-price);
  assert.equal(state.products.find(p=>p.id===c.productId)!.stock,learned.products.find(p=>p.id===c.productId)!.stock-1);
  assert.deepEqual(state.masters[0].installedHazards.slice(1),learned.masters[0].installedHazards.slice(1));assert.deepEqual(state.parties,learned.parties);
  assert.equal(c.unitCost,learned.products.find(p=>p.id===c.productId)!.productionCost);valid(reverseKeys(state));
});
test('B3 PV02 F01 contradictory retained paid occurrence rejects in active requests and terminal history',()=>{
  for(const history of [false,true]) {
    const bad=paid().state,rec=bad.encounterRenewal!.masters[bad.masters[0].id],r=request(bad);
    if(history){rec.requests=rec.requests.filter(x=>x!==r);rec.history.push(r);valid(bad);}
    r.occurrenceId=rec.occurrences[1].id;assert.equal(validateSavePayload(JSON.stringify(bad)).valid,false);
  }
});
test('B3 PV03 all retained evidence tuple contradictions reject on request and both receipt copies',()=>{
  for(const [name,bad] of contradictions(paid().state)) {
    const v=validateSavePayload(JSON.stringify(bad));assert.equal(v.valid,false,name);assert.match(v.error!,/paid request receipt provenance/,name);
  }
  for(const side of ['request','history receipt','today receipt'])for(const change of ['morph product','morph effect']) {
    const bad=paid(true).state,e=side==='request'?request(bad).evidence:(side==='history receipt'?bad.contractHistory:bad.contractsToday)[0].installationReplacement!.renewal!.evidence;
    assert.equal(e.observation.counter.kind,'MORPH');if(e.observation.counter.kind==='MORPH') {
      if(change==='morph product')e.observation.counter.productId='prod_antidote_unstabilised';
      else {e.observation.counter.massEffectKg=-64;e.observation.baseMassKg=102;}
    }
    assert.equal(validateSavePayload(JSON.stringify(bad)).valid,false,`${side} ${change}`);
  }
});
test('B3 PV04 receipt cannot rebind a retained nonpaid request, a different contract or the wrong occurrence',()=>{
  for(const side of ['contractHistory','contractsToday'] as const)for(const kind of ['nonpaid','contract','occurrence']) {
    const bad=paid().state,r=bad[side][0].installationReplacement!.renewal!,rec=bad.encounterRenewal!.masters[bad.masters[0].id];
    if(kind==='nonpaid'){const open=rec.requests.find(x=>x.status==='OPEN')!;r.requestId=open.id;r.occurrenceId=open.occurrenceId;r.evidence=structuredClone(open.evidence);}
    else if(kind==='contract')bad[side][0].id+='-different';else r.occurrenceId=rec.occurrences[1].id;
    assert.equal(validateSavePayload(JSON.stringify(bad)).valid,false,`${side} ${kind}`);
  }
});
class Store {
  data=new Map<string,string>();writes:string[]=[];
  getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.writes.push(k);this.data.set(k,v);}
}
test('B3 PV05 contradictory outgoing lineage refuses before checkpoint rotation, preserves distinct healthy primary and backup and recovers backup',()=>{
  const {learned,state}=paid(),cases=contradictions(state),occ=structuredClone(state);request(occ).occurrenceId=occ.encounterRenewal!.masters[occ.masters[0].id].occurrences[1].id;cases.push(['F01 occurrence',occ]);
  for(const [name,bad] of cases) {
    const store=new Store();assert(persistAtomicSaveSafe(learned,store as any));assert(persistAtomicSaveSafe(state,store as any));
    const primary=store.getItem(SAVE_STORAGE_KEY),backup=store.getItem(SAVE_BACKUP_KEY);assert.notEqual(primary,backup);store.writes=[];
    assert.equal(persistAtomicSaveSafe(bad,store as any),false,name);assert.equal(store.getItem(SAVE_STORAGE_KEY),primary);assert.equal(store.getItem(SAVE_BACKUP_KEY),backup);
    assert(!store.writes.includes(SAVE_STORAGE_KEY));assert(!store.writes.includes(SAVE_BACKUP_KEY));assert.deepEqual(loadGameWithRecovery(store as any).state,state);
    store.data.set(SAVE_STORAGE_KEY,JSON.stringify(bad));const restored=loadGameWithRecovery(store as any);assert.equal(restored.source,'BACKUP');assert.deepEqual(restored.state,learned);assert.equal(store.getItem(SAVE_BACKUP_KEY),backup);
  }
});
test('B3 PV06 genuine stronger completed encounters evict paid history but retain valid receipt and anti-churn without recreation',()=>{
  let s=paid().state;const paidId=request(s).id,receipt=structuredClone(s.contractHistory[0]);
  for(let mass=37;mass>=22;mass--){s.parties[0].members[0].massKg=mass;s=raid(s);}
  const rec=s.encounterRenewal!.masters[s.masters[0].id];assert.equal(rec.history.length,12);assert(![...rec.requests,...rec.history].some(r=>r.id===paidId));
  assert.deepEqual(s.contractHistory[0],receipt);assert.equal(rec.lowestMass,22);const epoch=rec.epoch;
  const same=raid(s);assert.equal(same.encounterRenewal!.masters[s.masters[0].id].epoch,epoch);valid(same);
  const store=new Store();assert(persistAtomicSaveSafe(same,store as any));assert.deepEqual(loadGameWithRecovery(store as any).state,same);
});
test('B3 PV07 legacy unknown history and legitimate later morph rebrew preserve historical paid tuple while corrupt clocks still reject',()=>{
  for(const name of ['legacy-v1.json','historical-v2-day5.json']) {
    const raw=fs.readFileSync(new URL(`./fixtures/${name}`,import.meta.url),'utf8').replace(/^\uFEFF/,'');const old=JSON.parse(raw),v=validateSavePayload(raw);assert(v.valid,v.error);
    assert.deepEqual(v.state!.encounterRenewal!.masters,{});assert.deepEqual(v.state!.contractHistory,old.contractHistory);assert.equal(v.state!.gold,old.gold);
  }
  const s=paid(true).state,old=structuredClone(s.encounterRenewal),receipts=structuredClone(s.contractHistory),p=s.products.find(p=>p.id==='prod_chicken_morph')!;
  const crafted=synthesizeAlchemyProduct(p.recipeComponents.map(id=>REAGENTS_CATALOG.find(r=>r.id===id)!) as any,p.name,false),next=mergeCraftedInventoryState(s,crafted,2);
  assert.notEqual(next.products.find(x=>x.id===p.id)!.massEffectKg,p.massEffectKg);valid(next);assert.deepEqual(next.encounterRenewal,old);assert.deepEqual(next.contractHistory,receipts);
  const bad=structuredClone(next);bad.encounterRenewal!.masters[bad.masters[0].id].occurrences[0].mechanics.potency++;assert.equal(validateSavePayload(JSON.stringify(bad)).valid,false);
  const arithmetic=structuredClone(next);request(arithmetic).evidence.observation.effectiveMassKg++;assert.equal(validateSavePayload(JSON.stringify(arithmetic)).valid,false);
});
