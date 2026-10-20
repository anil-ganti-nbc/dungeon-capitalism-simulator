import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPlayerExpeditionForecast as scout } from '../src/engine/expeditionScouting';
import { createInitialSaveState, validateSavePayload } from '../src/engine/saveManager';
import { predictExpeditionForecast, simulateRegionExpedition } from '../src/engine/simulation';
import { resolvePostRaidClients } from '../src/engine/economyEngine';
import { recordCompletedEncounter } from '../src/engine/encounterRenewal';
import { DeterministicRNG } from '../src/utils/prng';
function fixture(){const s=createInitialSaveState(962371);s.parties[0].equippedProducts=[];s.parties[0].members[0].massKg=38;s.masters[0].installedHazards=['prod_trap_plate_spikes','prod_trap_plate_spikes'];s.masters[0].installedResetCharges=[0,0];return s;}
test('C004 FU01 player scouting contains current facts and explicit uncertainty, never an exact simulated report',()=>{
  const s=fixture(),p=scout(s.masters[0],s.parties[0],s.products);
  assert.equal(p.basis,'CURRENT_LEDGER');assert.equal(p.partyName,s.parties[0].name);assert.equal(p.masterName,s.masters[0].name);
  assert.equal(p.members[0].massKg,38);assert.equal(p.installations.length,2);assert.deepEqual(p.installations.map(x=>x.slot),[1,2]);
  assert.equal(p.installations[0].productId,'prod_trap_plate_spikes');assert(p.installations[0].triggerRule.includes('45kg'));
  for(const key of ['seed','predictedRooms','rooms','summaryHeadline','expectedLoot','totalLooted','outcome','damageDealt'])assert(!(key in p),key);
  assert(p.uncertainties.length>0);assert(p.considerations.length>0);
});
test('C004 FU02 preview calls no RNG and changes no state, learned knowledge or subsequent real raid',()=>{
  const s=fixture(),before=structuredClone(s),expected=simulateRegionExpedition(s.day,s.seed,s.masters[0],s.parties[0],s.products,[]);
  const random=Math.random,next=DeterministicRNG.prototype.next,nextInt=DeterministicRNG.prototype.nextInt;
  try {Math.random=()=>{throw Error('preview sampled random');};DeterministicRNG.prototype.next=()=>{throw Error('preview sampled seeded RNG');};DeterministicRNG.prototype.nextInt=()=>{throw Error('preview sampled seeded RNG');};scout(s.masters[0],s.parties[0],s.products);}
  finally {Math.random=random;DeterministicRNG.prototype.next=next;DeterministicRNG.prototype.nextInt=nextInt;}
  assert.deepEqual(s,before);assert.deepEqual(s.encounterRenewal!.masters,{});
  assert.deepEqual(simulateRegionExpedition(s.day,s.seed,s.masters[0],s.parties[0],s.products,[]),expected);
});
test('C004 FU03 different hidden actual seed outcomes do not alter player guidance for identical known facts',()=>{
  const s=createInitialSaveState(1);s.parties[0].equippedProducts=[];s.masters[0].installedHazards=['prod_trap_hairtrigger_acid'];s.masters[0].installedResetCharges=[0];
  const preview=scout(s.masters[0],s.parties[0],s.products),actual=new Set<string>();
  for(let seed=1;seed<=12;seed++) {
    const report=simulateRegionExpedition(1,seed,s.masters[0],s.parties[0],s.products,[]);actual.add(JSON.stringify(report.rooms.map(r=>r.outcome)));
    assert.deepEqual(scout(s.masters[0],s.parties[0],s.products),preview);
  }
  assert(actual.size>1,'actual seed contrast must really differ');
});
test('C004 FU04 current equipment and empty installations remain inspectable without invented environmental rooms',()=>{
  const s=createInitialSaveState(),party=s.parties[1];assert(party.equippedProducts.length>0);
  const p=scout(s.masters[0],party,s.products);for(const id of party.equippedProducts)assert(p.equipment.some(e=>e.productId===id));
  assert(p.considerations.some(t=>/inversion|lighter/i.test(t)));
  s.masters[0].installedHazards=[];s.masters[0].installedResetCharges=[];
  const empty=scout(s.masters[0],party,s.products);assert.deepEqual(empty.installations,[]);assert(empty.uncertainties.some(t=>/environment/i.test(t)));
  const old=s.parties[1].members[0].massKg;p.members[0].massKg=1;assert.equal(s.parties[1].members[0].massKg,old,'no live references returned');
});
test('C004 FU05 only actual expedition and settlement create report and encounter renewal after preview',()=>{
  const s=fixture();scout(s.masters[0],s.parties[0],s.products);assert.equal(s.expeditionReports.length,0);assert.deepEqual(s.encounterRenewal!.masters,{});
  const report=simulateRegionExpedition(s.day,s.seed,s.masters[0],s.parties[0],s.products,[]);
  const settled=recordCompletedEncounter(s,{...s,...resolvePostRaidClients(s,report),day:s.day+1,expeditionReports:[report]},report);
  assert(report.encounterObservations);assert(settled.encounterRenewal!.masters[s.masters[0].id].requests.length>0);assert(validateSavePayload(JSON.stringify(settled)).valid);
});
test('C004 FU06 old saves retain unknown history and diagnostic oracle semantics remain available outside player preview',()=>{
  for(const name of ['legacy-v1.json','historical-v2-day5.json']) {
    const raw=fs.readFileSync(new URL(`./fixtures/${name}`,import.meta.url),'utf8').replace(/^\uFEFF/,'');const loaded=validateSavePayload(raw);assert(loaded.valid,loaded.error);
    const s=loaded.state!,before=structuredClone(s);scout(s.masters[0],s.parties[0],s.products);assert.deepEqual(s,before);assert.deepEqual(s.encounterRenewal!.masters,{});
  }
  const s=fixture(),real=simulateRegionExpedition(s.day,s.seed,s.masters[0],s.parties[0],s.products,[]),diagnostic=predictExpeditionForecast(s.day,s.seed,s.masters[0],s.parties[0],s.products,[]);
  assert.deepEqual(diagnostic.predictedRooms,real.rooms);assert.equal(diagnostic.expectedLoot,real.totalLooted);
  const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');assert(!app.includes('predictExpeditionForecast'),'player App must not call diagnostic oracle');
  assert(!/return simulateRegionExpedition\(/.test(app),'unresolved replay must not simulate future reports');
});
