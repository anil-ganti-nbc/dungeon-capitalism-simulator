import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { resolvePostRaidClients, computeQuotation } from '../src/engine/economyEngine';
import { GameSaveState, ExpeditionReport } from '../src/types/game';
import { runSingleCampaign } from '../src/engine/campaignRunner';

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
