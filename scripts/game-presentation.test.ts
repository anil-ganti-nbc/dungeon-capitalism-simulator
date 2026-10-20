import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createInitialSaveState,validateSavePayload} from '../src/engine/saveManager';
import {executeCommercialTransaction,resolvePostRaidClients} from '../src/engine/economyEngine';
import {simulateRegionExpedition} from '../src/engine/simulation';
import {mergeCraftedInventoryState,recordCompletedEncounter} from '../src/engine/encounterRenewal';
import {startGuide,loadGuide,reconcileGuide,skipGuide,resumeGuide,inspectGuideReport} from '../src/ui/tutorial';
import {starterBrew} from '../src/ui/presentation';
import {ENTITY_ART_SLOTS,APPROVED_GAME_ART} from '../src/ui/gameArtwork';
const terms={priceMultiplier:1,warrantyBacked:false,exclusiveDeal:false,secretProvenance:false};
function craft(s:ReturnType<typeof createInitialSaveState>){const b=starterBrew(s);assert(b.available);const inventory={...s.reagentInventory};for(const id of b.ids)if((inventory[id]??0)>0)inventory[id]--;return {...mergeCraftedInventoryState(s,b.product,b.units),gold:s.gold-b.cost,reagentInventory:inventory,customBrewsCount:s.customBrewsCount+1};}
test('GP01 only genuine fresh campaigns auto-start; existing and malformed guide saves do not force onboarding',()=>{
 const s=createInitialSaveState();assert.equal(loadGuide(null,s,true).status,'active');assert.equal(loadGuide(null,s,false).status,'skipped');
 for(const raw of ['bad','null','{"version":99}',JSON.stringify({...startGuide(s),step:4,status:'complete',reportId:'invented'})])assert.equal(loadGuide(raw,s,false).status,'skipped');
});
test('GP02 real fresh resources support starter craft and shared sale without gifts, and tutorial observes committed results',()=>{
 let s=createInitialSaveState(),g=startGuide(s);const before=structuredClone(s),b=starterBrew(s);assert(b.available);assert(b.cost>0);s=craft(s);assert.equal(s.gold,before.gold-b.cost);assert.equal(s.products.find(p=>p.id===b.product.id)?.stock??s.products.find(p=>p.name===b.product.name)!.stock,(before.products.find(p=>p.id===b.product.id)?.stock??before.products.find(p=>p.name===b.product.name)?.stock??0)+b.units);
 g=reconcileGuide(g,s);assert.equal(g.step,1);const p=s.products.find(p=>p.name===b.product.name)!;const tx=executeCommercialTransaction(s,'HERO',s.parties[0].id,p,terms);assert(tx.success,tx.reason);const sold=tx.nextState!;assert.equal(sold.gold,s.gold+tx.unitPrice!);assert.equal(sold.parties[0].budget,s.parties[0].budget-tx.unitPrice!);g=reconcileGuide(g,sold);assert.equal(g.step,2);assert(validateSavePayload(JSON.stringify(sold)).valid);
});
test('GP03 failed and cancelled actions do not advance; skip/resume does not credit actions performed while skipped',()=>{
 const s=createInitialSaveState(),g=startGuide(s);assert.deepEqual(reconcileGuide(g,s),g);const unavailable=structuredClone(s);unavailable.products[0].stock=0;const failed=executeCommercialTransaction(unavailable,'HERO',unavailable.parties[0].id,unavailable.products[0],terms);assert.equal(failed.success,false);assert.deepEqual(reconcileGuide(g,s),g);
 const skipped=skipGuide(g),made=craft(s);assert.deepEqual(reconcileGuide(skipped,made),skipped);const resumed=resumeGuide(skipped,made);assert.equal(resumed.step,0);assert.deepEqual(reconcileGuide(resumed,made),resumed);
});
test('GP04 actual expedition then explicit inspection of the matching completed report finishes, not preview or navigation',()=>{
 let s=craft(createInitialSaveState()),g=reconcileGuide(startGuide(createInitialSaveState()),s);const tx=executeCommercialTransaction(s,'HERO',s.parties[0].id,s.products[0],terms);assert(tx.success);s=tx.nextState!;g=reconcileGuide(g,s);
 assert.equal(g.step,2);const r=simulateRegionExpedition(s.day,s.seed,s.masters[0],s.parties[0],s.products,s.contractsToday);s=recordCompletedEncounter(s,{...s,...resolvePostRaidClients(s,r),day:s.day+1,expeditionReports:[r]},r);g=reconcileGuide(g,s);assert.equal(g.step,3);assert.deepEqual(inspectGuideReport(g,s,'not-completed'),g);g=inspectGuideReport(g,s,r.id);assert.equal(g.status,'complete');assert.equal(g.step,4);
});
test('GP05 reload preserves validated progress; tutorial reset changes only guide and imported older campaign pauses safely',()=>{
 const s=createInitialSaveState(),made=craft(s),g=reconcileGuide(startGuide(s),made);assert.deepEqual(loadGuide(JSON.stringify(g),made,false),g);const before=structuredClone(made);const reset=startGuide(made);assert.equal(reset.step,0);assert.deepEqual(made,before);assert.equal(loadGuide(JSON.stringify(g),s,false).status,'skipped');
 for(const f of ['legacy-v1.json','historical-v2-day5.json']){const raw=fs.readFileSync(new URL('./fixtures/'+f,import.meta.url),'utf8').replace(/^\uFEFF/,'');const v=validateSavePayload(raw);assert(v.valid);assert.equal(loadGuide(null,v.state!,false).status,'skipped');}
});
test('GP06 shortages disable starter action honestly; no mutation, subsidy or guessed artwork paths',()=>{
 const s=createInitialSaveState();s.gold=0;const before=structuredClone(s);assert.equal(starterBrew(s).available,false);assert.deepEqual(s,before);assert(ENTITY_ART_SLOTS[s.masters[0].id]);assert(ENTITY_ART_SLOTS[s.activeRegion]);for(const a of Object.values(APPROVED_GAME_ART)){assert(a.src.startsWith('/'));assert(a.author&&a.licence&&a.sha256);}
});
test('GP07 real App opening uses persisted guide and successful-action observer rather than tutorial click counters',()=>{
 const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');assert(app.includes('loadGuide('));assert(app.includes('reconcileGuide('));assert(app.includes('inspectGuideReport('));assert(app.includes("'HOME'"));
});
