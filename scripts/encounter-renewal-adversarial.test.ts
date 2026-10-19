import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInitialSaveState, validateSavePayload, persistAtomicSaveSafe, SAVE_STORAGE_KEY, SAVE_BACKUP_KEY, loadGameWithRecovery } from '../src/engine/saveManager';
import { simulateRegionExpedition, assembleTrapProduct, predictExpeditionForecast } from '../src/engine/simulation';
import { computeInstallationReplacementQuote as quote, executeInstallationReplacement as pay, resolvePostRaidClients, executeCommercialTransaction } from '../src/engine/economyEngine';
import { recordCompletedEncounter, requestsFor, replacementForRequest, declineRenewal, requestStatus } from '../src/engine/encounterRenewal';
import { runSingleCampaign } from '../src/engine/campaignRunner';
import { TRAP_PARTS_CATALOG } from '../src/data/catalog';
import { GameSaveState } from '../src/types/game';
const terms = { priceMultiplier:1, warrantyBacked:false, exclusiveDeal:false, secretProvenance:false };
function fixture(mass=21) {
  const s=createInitialSaveState(88191);s.parties[0].equippedProducts=[];s.parties[0].members[0].massKg=mass;
  s.masters[0].installedHazards=['prod_trap_plate_spikes','prod_trap_plate_spikes'];s.masters[0].installedResetCharges=[0,0];
  return s;
}
function raid(s:GameSaveState) {
  const report=simulateRegionExpedition(s.day,s.seed,s.masters[0],s.parties[0],s.products,[]);
  const after={...s,...resolvePostRaidClients(s,report),day:s.day+1,expeditionReports:[report,...s.expeditionReports]};
  return { report, state:recordCompletedEncounter(s,after,report) };
}
function intent(s:GameSaveState, productId='prod_trap_hairtrigger_acid', index=0) {
  return replacementForRequest(s,requestsFor(s,s.masters[0].id)[index].id,productId)!;
}
function checkValid(s:GameSaveState) { const v=validateSavePayload(JSON.stringify(s));assert(v.valid,v.error);assert.deepEqual(v.state,s); }

test('B3 M02 M10 forecasts and legacy untyped reports never commit requests',()=>{
  const s=fixture(),before=structuredClone(s);
  predictExpeditionForecast(s.day,s.seed,s.masters[0],s.parties[0],s.products,[]);assert.deepEqual(s,before);
  const report=raid(s).report;delete report.encounterObservations;
  assert.deepEqual(recordCompletedEncounter(s,s,report),s);
  for(const name of ['legacy-v1.json','historical-v2-day5.json']) {
    const raw=fs.readFileSync(new URL(`./fixtures/${name}`,import.meta.url),'utf8').replace(/^\uFEFF/,'');
    const old=JSON.parse(raw),restored=validateSavePayload(raw);assert(restored.valid,restored.error);
    assert.deepEqual(restored.state!.encounterRenewal!.masters,{});
    for(const k of ['day','gold','debt','contractHistory','financialLedger'] as const)assert.deepEqual(restored.state![k],old[k]);
  }
});
test('B3 M03 actual canonical morph differs from natural mass and fake prose',()=>{
  const s=fixture(86),morph=s.products.find(p=>p.massEffectKg<=-25)!;s.parties[0].equippedProducts=[morph.id];
  const {state,report}=raid(s);assert.equal(report.encounterObservations!.rooms[0].counter.kind,'MORPH');
  assert.equal(requestsFor(state,s.masters[0].id).length,2);
  const natural=fixture(86);natural.masters[0].desiredTrait='21kg bypass MORPH';
  assert.equal(requestsFor(raid(natural).state,natural.masters[0].id).length,0);
});
for(const mass of [19,21,25,54,86]) test(`B3 M04 inversion ${mass}kg produces no ordinary request`,()=>{
  const s=fixture(mass),p=assembleTrapProduct(['part_trg_12','part_con_01','part_del_01','part_pay_01','part_pow_01','part_rst_01'].map(id=>TRAP_PARTS_CATALOG.find(p=>p.id===id)!) as any,'inversion',false);
  s.products.push(p);s.masters[0].installedHazards=[p.id];s.masters[0].installedResetCharges=[0];
  const {state,report}=raid(s);assert.equal(report.rooms[0].outcome,mass<25?'TRAP_TRIGGERED':'TRAP_BYPASSED');
  assert.equal(requestsFor(state,s.masters[0].id).length,0);
});
test('B3 M04 inherent environmental hazard never creates a paid replacement',()=>{
  const s=fixture();s.masters[0].installedHazards=[];s.masters[0].installedResetCharges=[];
  const {state,report}=raid(s);assert.equal(report.encounterObservations!.rooms[0].sourceSlotIndex,null);
  assert.equal(requestsFor(state,s.masters[0].id).length,0);
});
test('B3 M09 duplicate, conflicting, unrelated and future reports cannot add an opportunity',()=>{
  const s=fixture(),{state,report}=raid(s);const before=structuredClone(state);
  assert.deepEqual(recordCompletedEncounter(state,state,report),before);
  for(const mutate of [(r:any)=>r.day++,(r:any)=>r.rulesVersion='unknown',(r:any)=>r.masterId=s.masters[1].id,
    (r:any)=>r.region='vault',(r:any)=>r.seed++,(r:any)=>r.encounterObservations.rooms[0].effectiveMassKg=1]) {
    const bad=structuredClone(report);mutate(bad);assert.deepEqual(recordCompletedEncounter(s,s,bad),s);
  }
  const replayBefore={...state,day:s.day};assert.deepEqual(recordCompletedEncounter(replayBefore,state,report),state);
});
test('B3 M07 shifted duplicate occurrence maps through wear without SKU guessing',()=>{
  const s=raid(fixture()).state,old=requestsFor(s,s.masters[0].id),stale=intent(s,'prod_trap_hairtrigger_acid',1);
  s.day=3;const after=raid(s).state;const now=requestsFor(after,s.masters[0].id);
  assert.equal(now[0].status,'STALE');assert.equal(now[1].occurrenceId,old[1].occurrenceId);assert.equal(now[1].status,'OPEN');
  assert.equal(replacementForRequest(after,old[1].id,'prod_trap_hairtrigger_acid')!.slotIndex,0);
  assert.equal(quote(after,stale,terms).success,false);checkValid(after);
});
test('B3 M11 lower actual later mass preserves useful signal, equal mass does not replenish declined evidence',()=>{
  let s=raid(fixture()).state;const id=requestsFor(s,s.masters[0].id)[0].id;
  s=declineRenewal(s,id);const epoch=s.encounterRenewal!.masters[s.masters[0].id].epoch;
  s=raid(s).state;assert.equal(s.encounterRenewal!.masters[s.masters[0].id].epoch,epoch);
  assert.equal(requestsFor(s,s.masters[0].id)[0].status,'DECLINED');
  s.parties[0].members[0].massKg=19;s.skills.find(k=>k.effectKey==='auto_reset_cam')!.unlocked=true;
  s=raid(s).state;assert.equal(s.encounterRenewal!.masters[s.masters[0].id].epoch,epoch+1);assert.equal(requestsFor(s,s.masters[0].id)[0].status,'OPEN');checkValid(s);
});
test('B3 M08 manual A-to-B-to-A does not recreate same evidence or occurrence',()=>{
  let s=raid(fixture()).state;const req=requestsFor(s,s.masters[0].id)[0],first=intent(s),q=quote(s,first,terms);assert(q.success);
  s=pay(s,first,terms,q.unitPrice!).nextState!;const newId=s.encounterRenewal!.masters[s.masters[0].id].occurrences[0].id;
  const back={masterId:s.masters[0].id,productId:'prod_trap_plate_spikes',slotIndex:0,expectedProductId:s.masters[0].installedHazards[0],expectedResetCharge:0,expectedDay:s.day,expectedContractCount:s.contractHistory.length};
  const qb=quote(s,back,terms);assert(qb.success,qb.reason);s=pay(s,back,terms,qb.unitPrice!).nextState!;
  assert.notEqual(s.encounterRenewal!.masters[s.masters[0].id].occurrences[0].id,newId);
  s=raid(s).state;assert.equal(s.encounterRenewal!.masters[s.masters[0].id].epoch,1);
  assert.equal(requestsFor(s,s.masters[0].id).find(r=>r.id===req.id)!.status,'SATISFIED_BY_PAID_REPLACEMENT');checkValid(s);
});
test('B3 M12 two distinct costly remedies pass observed predicate; higherDC-only refuses',()=>{
  const s=raid(fixture()).state;
  for(const trg of ['part_trg_05','part_trg_06']) {
    const p=assembleTrapProduct([trg,'part_con_01','part_del_01','part_pay_01','part_pow_01','part_rst_01'].map(id=>TRAP_PARTS_CATALOG.find(p=>p.id===id)!) as any,'remedy',false);
    s.products.push(p);const q=quote(s,intent(s,p.id),terms);assert(q.success,q.reason);assert(q.unitPrice!>0);
  }
  const old=s.products.find(p=>p.id==='prod_trap_plate_spikes')!;
  s.products.push({...old,id:'higher_dc_only',detectionDC:99});
  const r=quote(s,intent(s,'higher_dc_only'),terms);assert.equal(r.success,false);assert.match(r.reason!,/does not address/);
});
test('B3 M07 ordinary purchase prepends occurrence exactly like the existing installed loadout',()=>{
  const s=createInitialSaveState(88191),p=s.products.find(p=>p.id==='prod_trap_hairtrigger_acid')!;
  const tx=executeCommercialTransaction(s,'MASTER',s.masters[0].id,p,terms);assert(tx.success,tx.reason);
  assert.equal(tx.nextState!.encounterRenewal!.masters[s.masters[0].id].occurrences[0].productId,p.id);checkValid(tx.nextState!);
});
test('B3 M08 bounded history eviction retains compact anti-churn and genuine stronger evidence',()=>{
  let s=fixture(40);s.skills.find(k=>k.effectKey==='auto_reset_cam')!.unlocked=true;
  for(let n=0;n<16;n++){s.parties[0].members[0].massKg=40-n;s=raid(s).state;checkValid(s);}
  const rec=s.encounterRenewal!.masters[s.masters[0].id];assert.equal(rec.history.length,12);assert.equal(rec.epoch,16);assert.equal(rec.lowestMass,25);
  const same=raid(s).state;assert.equal(same.encounterRenewal!.masters[s.masters[0].id].epoch,16);assert.equal(same.encounterRenewal!.masters[s.masters[0].id].history.length,12);
});
test('B3 M14 boycott is a real isolated guard, not a wrong-price accident',()=>{
  const s=raid(fixture()).state;s.masters[0].trust=0;const i=intent(s),q=quote(s,i,terms);assert.equal(q.success,false);assert.match(q.reason!,/boycott/);
  const before=structuredClone(s);assert.equal(pay(s,i,terms,1).success,false);assert.deepEqual(s,before);
});
test('B3 M18 relevant manual experiment satisfies the actual existing request once',()=>{
  const s=raid(fixture()).state,i={...intent(s)};delete i.evidence;
  const q=quote(s,i,terms);assert(q.success);const tx=pay(s,i,terms,q.unitPrice!);assert(tx.success);
  assert(tx.contract!.installationReplacement!.renewal);assert.equal(requestsFor(tx.nextState!,s.masters[0].id)[0].status,'SATISFIED_BY_PAID_REPLACEMENT');checkValid(tx.nextState!);
});
const guards:[string,(s:GameSaveState,i:any)=>void,RegExp][]=[
  ['selected response mechanics',s=>{s.products.find(p=>p.id==='prod_trap_hairtrigger_acid')!.detectionDC++;},/mechanics changed/],
  ['budget',s=>{s.masters[0].budget=0;},/budget/],
  ['stock',s=>{s.products.find(p=>p.id==='prod_trap_hairtrigger_acid')!.stock=0;},/stock/],
  ['audience',s=>{s.products.find(p=>p.id==='prod_trap_hairtrigger_acid')!.targetAudience='HERO';},/hero parties/],
  ['region',s=>{s.activeRegion='warrens';s.unlockedRegions.push('warrens');},/regional/],
  ['locked region',s=>{s.unlockedRegions=[];},/locked/],
  ['day',(s,i)=>{i.expectedDay++;},/stale/],
  ['contracts',(s,i)=>{i.expectedContractCount++;},/stale/],
  ['reserve',(s,i)=>{i.expectedResetCharge=1;},/stale/],
  ['slot',(s,i)=>{i.slotIndex=1;},/Encounter request/],
  ['epoch',(s,i)=>{i.evidence.epoch++;},/Encounter request/]
];
for(const [name,alter,reason] of guards)test(`B3 M13 M14 rejects ${name} at actual guard, no lifecycle or financial mutation`,()=>{
  const s=raid(fixture()).state,i=intent(s),q=quote(s,i,terms);assert(q.success,q.reason);alter(s,i);
  const before=structuredClone(s),r=pay(s,i,terms,q.unitPrice!);assert.equal(r.success,false);assert.match(r.reason!,reason);assert.deepEqual(s,before);assert.equal(r.nextState,undefined);
});
test('B3 M15 changed displayed price refuses without consuming request',()=>{
  const s=raid(fixture()).state,i=intent(s),q=quote(s,i,terms);assert(q.success);
  const before=structuredClone(s);const r=pay(s,i,terms,q.unitPrice!+1);assert.equal(r.success,false);assert.match(r.reason!,/quote changed/);assert.deepEqual(s,before);
});
test('B3 M16 expiry is twelve elapsed days, decline nonpaid and preview immutable',()=>{
  const s=raid(fixture()).state,r=requestsFor(s,s.masters[0].id)[0];s.day=r.evidence.day+11;assert.equal(requestStatus(s,r),'OPEN');
  const before=structuredClone(s);quote(s,intent(s),terms);assert.deepEqual(s,before);
  s.day++;assert.equal(requestStatus(s,r),'EXPIRED');assert.equal(quote(s,intent(s),terms).success,false);
  const d=declineRenewal(before,r.id);assert.equal(requestsFor(d,s.masters[0].id)[0].status,'DECLINED');assert.equal(d.contractHistory.length,0);checkValid(d);
});
test('B3 M17 exact-budget last-stock payment retires selected slot only and records conserved COGS',()=>{
  const s=raid(fixture()).state,i=intent(s),q=quote(s,i,terms);assert(q.success);
  s.masters[0].budget=q.unitPrice!;s.products.find(p=>p.id===i.productId)!.stock=1;
  const before=structuredClone(s),tx=pay(s,i,terms,q.unitPrice!);assert(tx.success,tx.reason);const a=tx.nextState!;
  assert.equal(a.masters[0].budget,0);assert.equal(a.gold-s.gold,q.unitPrice);assert.equal(a.products.find(p=>p.id===i.productId)!.stock,0);
  assert.deepEqual(a.masters[0].installedHazards.slice(1),s.masters[0].installedHazards.slice(1));assert.deepEqual(a.parties,s.parties);
  assert.deepEqual(s,before);assert.equal(tx.contract!.unitCost,s.products.find(p=>p.id===i.productId)!.productionCost);checkValid(a);
  assert.equal(executeCommercialTransaction({...s,masters:s.masters.map((m,j)=>j?m:{...m,installedHazards:[...m.installedHazards,m.installedHazards[0]],installedResetCharges:[0,0,0]})},'MASTER',i.masterId,s.products.find(p=>p.id===i.productId)!,terms).success,false);
});
test('B3 M18 irrelevant manual sidegrade stays permitted but is not useful resolution',()=>{
  const s=raid(fixture()).state,old=s.products.find(p=>p.id==='prod_trap_plate_spikes')!;
  s.products.push({...old,id:'manual_experiment',potency:old.potency+1});const i={...intent(s,'manual_experiment')};delete i.evidence;
  const q=quote(s,i,terms);assert(q.success,q.reason);const tx=pay(s,i,terms,q.unitPrice!);assert(tx.success);
  assert.equal(tx.contract!.installationReplacement!.renewal,undefined);assert.equal(requestsFor(tx.nextState!,s.masters[0].id)[0].status,'STALE');
});
class Storage {
  data=new Map<string,string>(); fail=false;
  getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){if(this.fail)throw Error('quota');this.data.set(k,v);}
}
test('B3 M19 M20 valid paid reload and malformed metadata preserve healthy backup',()=>{
  const s=raid(fixture()).state,i=intent(s),q=quote(s,i,terms),paid=pay(s,i,terms,q.unitPrice!).nextState!;checkValid(paid);
  const damages=[(v:any)=>{delete v.encounterRenewal.masters[s.masters[0].id];},
    (v:any)=>{const o=v.contractHistory[0].installationReplacement.renewal.evidence.observation;o.baseMassKg=86;o.counter={kind:'MORPH',productId:'invented_morph',massEffectKg:-65};},
    (v:any)=>v.encounterRenewal.schema='unknown',(v:any)=>v.encounterRenewal.masters[s.masters[0].id].history=Array(13).fill({}),
    (v:any)=>v.encounterRenewal.masters[s.masters[0].id].occurrences[0].id=v.encounterRenewal.masters[s.masters[0].id].occurrences[1].id,
    (v:any)=>v.contractHistory[0].installationReplacement.renewal.evidence.observation.effectiveMassKg=99,
    (v:any)=>v.expeditionReports[0].encounterObservations.rooms[0].counter={kind:'MORPH',productId:'fake',massEffectKg:1}];
  for(const damage of damages){const bad=structuredClone(paid);damage(bad);assert.equal(validateSavePayload(JSON.stringify(bad)).valid,false);
    const store=new Storage(),raw=JSON.stringify(paid);store.data.set(SAVE_STORAGE_KEY,raw);store.data.set(SAVE_BACKUP_KEY,raw);
    assert.equal(persistAtomicSaveSafe(bad,store as any),false);assert.equal(store.getItem(SAVE_STORAGE_KEY),raw);assert.equal(store.getItem(SAVE_BACKUP_KEY),raw);
    store.data.set(SAVE_STORAGE_KEY,JSON.stringify(bad));assert.deepEqual(loadGameWithRecovery(store as any).state,paid);
  }
  const store=new Storage();store.data.set(SAVE_STORAGE_KEY,JSON.stringify(s));store.fail=true;
  assert.equal(persistAtomicSaveSafe(paid,store as any),false);assert.equal(store.getItem(SAVE_STORAGE_KEY),JSON.stringify(s));
});
test('B3 M21 NONE is default; explicit policy respects no-master strategy and real shared transactions',()=>{
  const a=runSingleCampaign(731900,'BALANCED_MERCHANT',6),b=runSingleCampaign(731900,'BALANCED_MERCHANT',6,false,undefined,{renewalPolicy:'NONE'});assert.deepEqual(a,b);
  const h=runSingleCampaign(731900,'HERO_BENEFACTOR',6,false,undefined,{renewalPolicy:'OBSERVED_MASS_BYPASS'});
  assert.equal(h.finalState.contractHistory.filter(c=>c.buyerType==='MASTER').length,0);
});
