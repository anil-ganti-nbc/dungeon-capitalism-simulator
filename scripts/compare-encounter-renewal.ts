import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { runSingleCampaign, StrategyId, TradeEvent } from '../src/engine/campaignRunner';
import { createInitialSaveState } from '../src/engine/initialState';
import { validateSavePayload } from '../src/engine/saveManager';
import { computeInstallationReplacementQuote, executeInstallationReplacement, resolveConsumableWear } from '../src/engine/economyEngine';
import { recordCompletedEncounter, requestsFor, replacementForRequest } from '../src/engine/encounterRenewal';
import { simulateRegionExpedition } from '../src/engine/simulation';
const out=process.env.EVIDENCE_DIR??'';
const baseline=process.env.BASELINE_ROOT;
assert(out && path.isAbsolute(out),'Explicit fresh absolute EVIDENCE_DIR required');
assert(baseline && path.isAbsolute(baseline),'BASELINE_ROOT must be extracted actual031398a source, not a reconstructed result');
assert(!fs.existsSync(path.join(out,'run.json')),'Preserve prior comparisons');fs.mkdirSync(out,{recursive:true});
const count=Number(process.env.COMPARISON_SEEDS??20),days=Number(process.env.COMPARISON_DAYS??120);
assert(Number.isSafeInteger(count)&&count>0&&count<=20&&Number.isSafeInteger(days)&&days>0&&days<=120);
const original=await import(pathToFileURL(path.join(baseline,'src/engine/campaignRunner.ts')).href);
const strategies:StrategyId[]=['BALANCED_MERCHANT','DUNGEON_LOYALIST','HERO_BENEFACTOR','ALCHEMICAL_INDUSTRIALIST','PREDATORY_CAPITALIST'];
function gameplay(s:any) { const c=structuredClone(s);delete c.encounterRenewal;delete c.version;for(const r of c.expeditionReports)delete r.encounterObservations;return c; }
function collect(runner:typeof runSingleCampaign,seed:number,strategy:StrategyId,mode:'NONE'|'OBSERVED_MASS_BYPASS') {
  const attempts:any[]=[],raids:any[]=[],nightly:any[]=[];
  const run=runner(seed,strategy,days,false,(e:TradeEvent)=>{
    const tx=e.result,p=e.before.products.find(p=>p.id===e.productId)!;
    if(tx.success){const a=tx.nextState!,buyerBefore=(e.buyerType==='MASTER'?e.before.masters:e.before.parties).find(b=>b.id===e.buyerId)!;
      const buyerAfter=(e.buyerType==='MASTER'?a.masters:a.parties).find(b=>b.id===e.buyerId)!;
      assert.equal(a.gold-e.before.gold,tx.unitPrice);assert.equal(buyerBefore.budget-buyerAfter.budget,tx.unitPrice);
      assert.equal(a.products.find(q=>q.id===p.id)!.stock,p.stock-1);assert.equal(a.contractHistory.length,e.before.contractHistory.length+1);
      assert.equal(tx.contract!.unitCost,p.productionCost);
    }
    attempts.push({day:e.before.day,buyerType:e.buyerType,buyerId:e.buyerId,productId:e.productId,renewalRequest:e.replacementRequest??null,
      success:tx.success,reason:tx.reason??null,contract:tx.contract??null,price:tx.unitPrice??null});
  },{renewalPolicy:mode,onCompletedReport:(r,s)=>{const check=validateSavePayload(JSON.stringify(s));if(!check.valid)fs.writeFileSync(path.join(out,`failure-${strategy}-${seed}-${mode}-d${s.day}.json`),JSON.stringify({strategy,seed,mode,day:s.day,error:check.error,report:r,state:s},null,2),{flag:'wx'});assert(check.valid,check.error);raids.push(r);},onAfterRaid:s=>nightly.push({day:s.day,gold:s.gold,debt:s.debt,financial:s.financialLedger[0],
    masters:s.masters.map(m=>({id:m.id,budget:m.budget,trust:m.trust,slots:m.installedHazards,reserves:m.installedResetCharges})),
    requests:s.encounterRenewal??null,resources:{reagents:s.reagentInventory,parts:s.partInventory,products:s.products.map(p=>({id:p.id,stock:p.stock,cost:p.productionCost}))}})});
  const linked=run.finalState.contractHistory.filter(c=>c.installationReplacement?.renewal);
  const useful=new Set(linked.map(c=>c.installationReplacement!.renewal!.requestId));
  const reasons:Record<string,number>={};for(const a of attempts.filter(a=>!a.success)){const key=a.reason??'UNKNOWN';reasons[key]=(reasons[key]??0)+1;}
  return {...run,attempts,nightly,raids,analysis:{lastSaleDay:run.finalState.contractHistory.at(-1)?.day??null,usefulPaidRequests:useful.size,
    renewalAttempts:attempts.filter(a=>a.renewalRequest).length,refusalReasons:reasons,
    actualLaterUses:linked.map(c=>({contractId:c.id,reports:raids.filter(r=>r.day>=c.day&&r.masterId===c.buyerId).map(r=>({id:r.id,rooms:r.rooms.filter((rm:any)=>rm.hazardId===c.productId)}))})),
    narrativeCasualtiesAreNotPersistentSurvival:true}};
}
const results:any[]=[];
fs.writeFileSync(path.join(out,'run.json'),JSON.stringify({baseline,baselineHead:'031398ae64f5449ad4344116ccaeda7402a328f0',seedFormula:'731900+n*7919',count,days,strategies,
  sourcePinNote:'Caller must verify extracted baseline archive hash and closed membership; file digests below bind executed entrypoints',
  entrypoints:[path.join(baseline,'src/engine/campaignRunner.ts'),new URL('../src/engine/campaignRunner.ts',import.meta.url)].map(p=>({path:String(p),sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}))},null,2),{flag:'wx'});
for(const strategy of strategies)for(let n=0;n<count;n++){
  const seed=731900+n*7919,A=collect(original.runSingleCampaign,seed,strategy,'NONE'),B0=collect(runSingleCampaign,seed,strategy,'NONE'),B1=collect(runSingleCampaign,seed,strategy,'OBSERVED_MASS_BYPASS');
  assert.deepEqual(B0.metrics,A.metrics,'metadata-compatible candidate must preserve untreated economics');assert.deepEqual(B0.actionLog,A.actionLog);assert.deepEqual(gameplay(B0.finalState),gameplay(A.finalState));
  for(const [arm,value]of Object.entries({A,B0,B1}))fs.writeFileSync(path.join(out,`${strategy}-${seed}-${arm}.json`),JSON.stringify(value),{flag:'wx'});
  results.push({strategy,seed,baseline:A.metrics,treatment:B1.metrics,deltaProfit:B1.metrics.netProfit-A.metrics.netProfit,deltaCash:B1.metrics.endingCash-A.metrics.endingCash,
    baselineAnalysis:A.analysis,treatmentAnalysis:B1.analysis});
}
const mechanism=[];
for(const quiet of [false,true])for(const treatment of [false,true]){
  let s=createInitialSaveState(88191);s.parties[0].equippedProducts=[];s.parties[0].members[0].massKg=quiet?86:21;
  s.skills.find(k=>k.effectKey==='auto_reset_cam')!.unlocked=true; // same declared isolation fixture, no cash/stock gifts
  const start=structuredClone(s),trace=[];
  for(let d=1;d<=30;d++){
    if(treatment){const r=requestsFor(s,s.masters[0].id).find(r=>r.status==='OPEN');if(r){
      const i=replacementForRequest(s,r.id,'prod_trap_hairtrigger_acid')!,terms={priceMultiplier:1,warrantyBacked:false,exclusiveDeal:false,secretProvenance:false};
      const q=computeInstallationReplacementQuote(s,i,terms);if(q.success)s=executeInstallationReplacement(s,i,terms,q.unitPrice!).nextState!;
    }}
    const before=structuredClone(s),report=simulateRegionExpedition(s.day,s.seed,s.masters[0],s.parties[0],s.products,s.contractsToday);
    const wear=resolveConsumableWear(s.parties[0],s.masters[0],report.warrantyClaimsTriggered,s.day,['auto_reset_cam']);
    const after={...s,day:s.day+1,masters:s.masters.map((m,i)=>i?m:{...m,installedHazards:wear.nextInstalled,installedResetCharges:wear.nextResetCharges})};
    s=recordCompletedEncounter(before,after,report);
    assert.deepEqual(recordCompletedEncounter(before,s,report),s,'duplicate commit adds no opportunity');
    const revenue=s.contractHistory.reduce((a,c)=>a+c.totalRevenue,0);
    assert.equal(s.gold-start.gold,revenue);assert.equal(start.masters[0].budget-s.masters[0].budget,revenue);
    for(const p of s.products)assert.equal(p.stock+s.contractHistory.filter(c=>c.productId===p.id).length,start.products.find(q=>q.id===p.id)!.stock);
    trace.push({day:d,report,contracts:s.contractHistory.length,cash:s.gold,buyerBudget:s.masters[0].budget,requests:s.encounterRenewal});
  }
  mechanism.push({quiet,treatment,days:30,fixture:'initial stock/budget; natural21kg or quiet86kg; same global cam; no overhead/progression/settlement income/stock replenishment; actual raids and duplicate-ingestion twin',start,final:s,trace});
}
fs.writeFileSync(path.join(out,'mechanism-30.json'),JSON.stringify(mechanism),{flag:'wx'});
const summaries=strategies.map(strategy=>{
 const rows=results.filter(r=>r.strategy===strategy),delta=rows.map(r=>r.deltaProfit).sort((a,b)=>a-b);
 return{strategy,samples:rows.length,profitDeltaSorted:delta,insolventBaseline:rows.filter(r=>r.baseline.strictBankruptcyOccurred).length,
 insolventTreatment:rows.filter(r=>r.treatment.strictBankruptcyOccurred).length,usefulPaid:rows.map(r=>r.treatmentAnalysis.usefulPaidRequests)};
});
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({results,summaries,limitations:['Bot sample not human enjoyment/Android/full-game acceptance','Original no-reset/reset12vs3 study remains separately preserved in unmodified diagnose-renewal.ts','Metadata-only fields excluded explicitly only for untreated full-state comparison']},null,2),{flag:'wx'});
console.log(JSON.stringify({samples:results.length,days,summaries,mechanism:mechanism.map(m=>({quiet:m.quiet,treatment:m.treatment,paid:m.final.contractHistory.length}))},null,2));
