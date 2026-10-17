/** New evidence only. Never writes SIM-001 or previous SIM-002 results. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { runSingleCampaign, StrategyId, CampaignMetrics } from '../src/engine/campaignRunner';
import { validateSavePayload } from '../src/engine/saveManager';
const out=process.env.CAMPAIGN_DIR ?? 'artifacts/sim002b/campaigns';
assert(!fs.existsSync(path.join(out,'campaign_results.csv')),'Existing evidence must not be overwritten');fs.mkdirSync(out,{recursive:true});
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git('diff','--name-only','c45f33e','--','sim_001_archive','public/sim_001'),'','Frozen SIM-001 changed');
const sourceCommit=git('rev-parse','HEAD'),sourceTree=git('rev-parse','HEAD^{tree}');
const strategies: StrategyId[]=['BALANCED_MERCHANT','DUNGEON_LOYALIST','HERO_BENEFACTOR','ALCHEMICAL_INDUSTRIALIST','PREDATORY_CAPITALIST'];
const metrics:CampaignMetrics[]=[];const sampleEvents:any[]=[];const sampleActions:any[]=[];
for(let offset=0;offset<1000;offset++){
  const seed=20260001+offset;
  for(const strategy of strategies){
    const result=runSingleCampaign(seed,strategy,120,offset<5,offset===0?event=>{if(event.before.day<=3)sampleActions.push({strategy,...event});}:undefined);
    const validation=validateSavePayload(JSON.stringify(result.finalState));assert(validation.valid,`${seed}/${strategy}: ${validation.error}`);
    assert.equal(result.finalState.financialLedger.length,120);
    assert.equal(result.metrics.grossRevenue,result.finalState.contractHistory.reduce((n,c)=>n+c.totalRevenue,0));
    assert.equal(result.metrics.endingCash,result.finalState.financialLedger[0].endingCash);
    metrics.push(result.metrics);sampleEvents.push(...result.events);
  }
  if((offset+1)%100===0)console.log(`${(offset+1)*5}/5000 campaigns complete`);
}
const columns=Object.keys(metrics[0]) as (keyof CampaignMetrics)[];const csv=(v:any)=>JSON.stringify(typeof v==='object'?JSON.stringify(v):String(v??''));
fs.writeFileSync(path.join(out,'campaign_results.csv'),columns.join(',')+'\n'+metrics.map(m=>columns.map(k=>csv(m[k])).join(',')).join('\n')+'\n');
fs.writeFileSync(path.join(out,'transaction-replays.json.gz'),zlib.gzipSync(JSON.stringify(sampleActions)));
fs.writeFileSync(path.join(out,'economy-events.json'),JSON.stringify(sampleEvents));
const median=(xs:number[])=>{xs.sort((a,b)=>a-b);return (xs[499]+xs[500])/2;};
const summary=strategies.map(strategy=>{const rows=metrics.filter(m=>m.strategy===strategy);return {strategy,campaigns:rows.length,medianRevenue:median(rows.map(m=>m.grossRevenue)),medianNetProfit:median(rows.map(m=>m.netProfit)),bankruptcies:rows.filter(m=>m.strictBankruptcyOccurred).length,expertUnlocked:rows.filter(m=>m.dayReachedExpert!==null).length};});
const manifest={status:'SELF-TESTED / INDEPENDENT ACCEPTANCE PENDING',sourceCommit,sourceTree,pairedSeeds:1000,campaigns:5000,horizonDays:120,node:process.version,summary,
  caveats:['Strategy policies select crafting, financing and progression timing; these campaigns do not certify whole-campaign UI equivalence.','Specialists cannot unlock Expert through casual peer codes; the bilateral solo commission still applies.','No balancing changes or independent enjoyment acceptance inferred.','Physical Android / APK / OS kill NOT TESTED.']};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(out,'SIM-002B_REPORT.md'),`# SIM-002B builder campaign results\n\nSELF-TESTED / INDEPENDENT ACCEPTANCE PENDING\n\nCommit: ${sourceCommit}\nTree: ${sourceTree}\n\n1,000 identical seeds across five strategies, 120 days each. All final states validated; revenue reconciled to actual contracts and ending cash to the daily ledger.\n\n| Strategy | Median revenue | Median profit | Insolvent campaigns | Expert reached |\n|---|---:|---:|---:|---:|\n${summary.map(s=>`| ${s.strategy} | ${s.medianRevenue} | ${s.medianNetProfit} | ${s.bankruptcies}/1000 | ${s.expertUnlocked}/1000 |`).join('\n')}\n\n${manifest.caveats.map(c=>'- '+c).join('\n')}\n`);
const sums=fs.readdirSync(out).filter(n=>fs.statSync(path.join(out,n)).isFile()).sort().map(n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(out,n))).digest('hex')+'  '+n).join('\n');
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),sums+'\n');console.log(JSON.stringify(manifest,null,2));
