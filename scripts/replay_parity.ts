/** Builder verification using real stock-card clicks; historical fixtures are labelled diagnostics. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { normalizeLoadedSave } from '../src/engine/saveManager';
import { computeQuotation, executeCommercialTransaction } from '../src/engine/economyEngine';

const out=process.env.EVIDENCE_DIR ?? 'artifacts/sim002b'; fs.mkdirSync(out,{recursive:true});
const base=process.env.TEST_URL ?? 'http://127.0.0.1:4178';
const browser=await chromium.launch({headless:true, executablePath:process.env.BROWSER_PATH || undefined});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage(); const errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{const pending=sessionStorage.getItem('__fixture');if(pending){localStorage.clear();localStorage.setItem('trap_and_tonic_save_v2',pending);sessionStorage.removeItem('__fixture');}});
await page.goto(base);
const suites=process.argv.includes('--quick') ? ['historical-f368-60'] : ['historical-f368-60','historical-c45-60','captured-ui-60'];
const summaries:any[]=[];
try {
  for(const suite of suites) {
    const cases=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(`./fixtures/${suite}.json.gz`,import.meta.url))).toString());
    const records:any[]=[];
    for(const [i,t] of cases.entries()) {
      let state=normalizeLoadedSave(t.before);
      if(t.commands.length) state.tradeTerms=t.commands[0].terms;
      await page.evaluate(s=>sessionStorage.setItem('__fixture',JSON.stringify(s)),state);
      await page.reload();await page.getByRole('button',{name:/^(Open Merchant Ledger|Continue Ledger)/}).click();
      await page.waitForTimeout(30);
      const steps:any[]=[];
      for(const action of t.commands) {
        const before=structuredClone(state), p=state.products.find(p=>p.id===action.productId)!;
        const buyer=(action.buyerType==='MASTER'?state.masters:state.parties).find(b=>b.id===action.buyerId)!;
        // Historical traces target the scheduled customers. Selecting also exercises the real UI control.
        const select=page.getByRole('combobox',{name:action.buyerType==='MASTER'?'Scheduled Dungeon Master':'Scheduled Adventuring Party'});
        if(await select.inputValue()!==buyer.id) {await select.selectOption(buyer.id);state.scheduledMatchups[state.activeRegion][action.buyerType==='MASTER'?'masterId':'partyId']=buyer.id;}
        const quote=computeQuotation(p,buyer,action.buyerType,{...action.terms,day:state.day,seed:state.seed,rulesVersion:state.rulesVersion,unlockedSkills:state.skills.filter(s=>s.unlocked).map(s=>s.effectKey)});
        const tx=executeCommercialTransaction(state,action.buyerType,buyer.id,p,action.terms);
        const title=p.name+' [#'+(p.formulaSignature||p.id.slice(-6)).toUpperCase()+']';
        const card=page.getByText(title,{exact:true}).locator('../..');
        const button=card.getByRole('button').first();const quoteCard=await card.innerText();
        const enabled=await button.isEnabled();
        assert.equal(enabled,tx.success,`${suite}/${i}: UI acceptance differs: ${tx.reason}`);
        if(enabled) {
          if(process.argv.includes('--negative')) fs.writeFileSync(path.join(out,'negative-quote.json'),JSON.stringify({actualExpected:quote.unitPrice,mutatedExpected:quote.unitPrice+1,button:await button.innerText()}));
          assert.match(await button.innerText(),new RegExp(`\\(${quote.unitPrice+(process.argv.includes('--negative')?1:0)}g\\)`));
          await button.click(); state=tx.nextState!;
        } else { assert(!quote.acceptable);assert(quote.refusalReason); }
        await page.waitForTimeout(20);
        const actual=await page.evaluate(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!));
        let diff:string|null=null;try{assert.deepEqual(actual,state);}catch(e){diff=String(e);}
        steps.push({action,before,quote,quoteCard,enabled,expected:tx,actual,diff});
        if(diff) { fs.writeFileSync(path.join(out,'parity-failure.json'),JSON.stringify(steps));assert.fail(`${suite}/${i}: ${diff}`); }
      }
      records.push({index:i,strategy:t.strategy,day:t.day,steps,matched:true});
      if(i===0) await page.screenshot({path:path.join(out,`${suite}-desktop.png`)});
      if((i+1)%12===0) console.log(`${suite}: ${i+1}/60 matched`);
    }
    assert.equal(records.length,60);assert(records.some(r=>r.steps.length>0));
    fs.writeFileSync(path.join(out,`${suite}-replay.json.gz`),zlib.gzipSync(JSON.stringify(records)));
    summaries.push({suite,traces:60,matched:records.length,actions:records.reduce((n,r)=>n+r.steps.length,0)});
  }
  assert.deepEqual(errors,[]);
  // Mutation changes the actual compared quote, not a precomputed PASS flag.
  const negative=process.argv.includes('--negative');
  const last=summaries.at(-1); assert(last.actions>0);
  // The per-action comparison above is the acceptance assertion; a negative run mutates its real expected quote.
  assert(!negative, 'Use --negative to mutate a real quote in the action loop');
  fs.writeFileSync(path.join(out,'parity-summary.json'),JSON.stringify({status:'SELF-TESTED / INDEPENDENT ACCEPTANCE PENDING',summaries,errors},null,2));
} finally {await browser.close();}
