/** D01: actual scheduled-raid UI versus real runner snapshots, including next-day quotations. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright';
import { runSingleCampaign } from '../src/engine/campaignRunner';
import { computeQuotation } from '../src/engine/economyEngine';
import { GameSaveState } from '../src/types/game';

const out=process.env.EVIDENCE_DIR??'artifacts/sim002b/raid';fs.mkdirSync(out,{recursive:true});
const url=process.env.TEST_URL??'http://127.0.0.1:4178';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
const records:any[]=[];const errors:string[]=[];
function projection(s:GameSaveState){return {gold:s.gold,debt:s.debt,masters:s.masters,parties:s.parties,
  products:s.products,contractsToday:s.contractsToday,contractHistory:s.contractHistory,
  scheduledMatchups:s.scheduledMatchups,financialLedger:s.financialLedger};}
const reviewer=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/d01-d04/reviewer-breach.json.gz',import.meta.url))).toString());
try {
  const cases:{seed:number;strategy:'PREDATORY_CAPITALIST'|'BALANCED_MERCHANT'}[]=[];
  for(let seed=711;cases.length<6;seed++){const r=runSingleCampaign(seed,'PREDATORY_CAPITALIST',1);if(r.finalState.financialLedger[0].finesAndBribes>0)cases.push({seed,strategy:'PREDATORY_CAPITALIST'});}
  cases.push({seed:1907,strategy:'BALANCED_MERCHANT'});
  for(const {seed,strategy} of cases){
    let before:GameSaveState|undefined,runner:GameSaveState|undefined;
    runSingleCampaign(seed,strategy,1,false,e=>{if(e.result.success)before=e.result.nextState;},
      {onAfterRaid:s=>{runner=s;}});
    assert(before&&runner);if(seed===711)assert.deepEqual(projection(before),projection(reviewer.before),'reviewer commercial fixture must reproduce exactly');
    const c=await browser.newContext({viewport:{width:1440,height:1000}});
    await c.addInitScript(s=>{if(!sessionStorage.getItem('__fixture')){localStorage.setItem('trap_and_tonic_save_v2',JSON.stringify(s));sessionStorage.setItem('__fixture','1');}},before);
    const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    try {
      await p.goto(url);await p.getByRole('button',{name:/^(Open Merchant Ledger|Continue Ledger)/}).click();
      await p.getByRole('button',{name:/^Run Scheduled Expedition/}).click();
      await p.waitForFunction(d=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!).day===d+1,before.day);
      const actual:GameSaveState=await p.evaluate(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!));
      const report=actual.expeditionReports[0];assert.equal(report.exclusivityBreachDetected,strategy==='PREDATORY_CAPITALIST');
      const quotes:any[]=[];
      await p.getByRole('button',{name:'Bilateral Desk',exact:true}).click();
      await p.getByRole('combobox',{name:'Scheduled Dungeon Master'}).selectOption(report.masterId);
      await p.getByRole('combobox',{name:'Scheduled Adventuring Party'}).selectOption(report.partyId);
      for(const kind of ['MASTER','HERO'] as const){
        const buyerId=kind==='MASTER'?report.masterId:report.partyId;
        const buyer=(kind==='MASTER'?runner.masters:runner.parties).find(b=>b.id===buyerId)!;
        const product=runner.products.find(q=>q.id===before!.contractsToday.find(c=>c.buyerType===kind)!.productId)!;
        const q=computeQuotation(product,buyer,kind,{...before.tradeTerms!,seed:before.seed,day:report.day+1,
          rulesVersion:before.rulesVersion,unlockedSkills:before.skills.filter(s=>s.unlocked).map(s=>s.effectKey)});
        const title=product.name+' [#'+(product.formulaSignature||product.id.slice(-6)).toUpperCase()+']';
        const card=p.getByText(title,{exact:true}).locator('../..');
        quotes.push({buyerId,expected:q,uiCard:await card.innerText(),uiEnabled:await card.getByRole('button').isEnabled()});
      }
      const row:any={seed,before,runner,actual,report,quotes};records.push(row);
      await p.screenshot({path:path.join(out,`D01-${seed}.png`)});
      try {
        assert.deepEqual(projection(actual),projection(runner));
        for(const q of quotes){assert.equal(q.uiEnabled,q.expected.acceptable);assert(q.uiCard.includes(q.expected.acceptable?`Sell (${q.expected.unitPrice}g)`:q.expected.refusalReason));}
        row.matched=true;
      }catch(e){row.matched=false;row.diff=String(e);}
      console.log(`D01 seed ${seed}: ${row.matched?'MATCH':'MISMATCH'}`);
    }finally {await c.close();}
  }
  fs.writeFileSync(path.join(out,'raid-ui-runner.json.gz'),zlib.gzipSync(JSON.stringify(records)));
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({cases:records.length,matched:records.filter(r=>r.matched).length,errors},null,2));
  assert.deepEqual(errors,[]);assert.equal(records.length,7);assert(records.every(r=>r.matched),'post-raid UI/runner state or next-day quote diverged');
}finally {await browser.close();}
