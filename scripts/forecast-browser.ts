import { localhostTestURL } from './test-url';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, Page, Locator } from 'playwright';
import { createInitialSaveState, validateSavePayload } from '../src/engine/saveManager';
import { simulateRegionExpedition } from '../src/engine/simulation';
const out=process.env.EVIDENCE_DIR!;assert(out&&path.isAbsolute(out));fs.mkdirSync(out,{recursive:true});
const before=process.env.MODE==='before',url=localhostTestURL();
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const results:any[]=[];
async function tap(loc:Locator){await loc.scrollIntoViewIfNeeded();await loc.tap();}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!));
try {
  for(const [width,xlarge] of (before?[[375,false]]:[[375,false],[375,true],[412,false],[412,true]]) as [number,boolean][]) {
    const name=`${width}-${xlarge?'XLARGE':'Normal'}`,errors:string[]=[],r:any={name,width,xlarge,status:'FAIL',errors};results.push(r);
    const context=await browser.newContext({viewport:{width,height:1000},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
    try {
      // Controlled valid fixture: current natural38kg vanguard and two paid plate installations.
      const initial=createInitialSaveState(962371);initial.parties[0].equippedProducts=[];initial.parties[0].members[0].massKg=38;
      initial.masters[0].installedHazards=['prod_trap_plate_spikes','prod_trap_plate_spikes'];initial.masters[0].installedResetCharges=[0,0];
      assert(validateSavePayload(JSON.stringify(initial)).valid);
      await context.addInitScript(s=>{if(!sessionStorage.getItem('c004-fixture')){localStorage.setItem('trap_and_tonic_save_v2',JSON.stringify(s));sessionStorage.setItem('c004-fixture','yes');}},initial);
      await p.goto(url);await tap(p.getByRole('button',{name:/^(Continue Ledger|Open Merchant Ledger)/}));
      if(xlarge){await tap(p.getByRole('button',{name:'Options & A11y (Esc)',exact:true}));await tap(p.getByRole('button',{name:'XLARGE',exact:true}));await tap(p.getByRole('button',{name:'Resume Campaign',exact:true}));}
      assert.equal(await p.locator('html').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)),xlarge?20:16);
      if(before) await tap(p.getByRole('button',{name:/^(Expedition Arena|Arena)$/}).first());
      else {
        await tap(p.getByRole('navigation',{name:'Main game navigation'}).getByRole('button',{name:'Expedition',exact:true}));
        await tap(p.getByText('Scout loadout & uncertainty',{exact:true}));
        const replaySummary=p.getByText('Completed replay & technical breakdown',{exact:true});
        if(!await replaySummary.evaluate(e=>(e.parentElement as HTMLDetailsElement).open)) await tap(replaySummary);
      }
      const saved=await read(p),expected=simulateRegionExpedition(saved.day,saved.seed,saved.masters[0],saved.parties[0],saved.products,saved.contractsToday);
      if(before){
        assert((await p.locator('main').innerText()).includes(expected.rooms[0].causalExplanation));
        assert((await p.locator('main').innerText()).includes(`LOOTED: +${expected.totalLooted}g`));
        const forecast=p.getByText('PRE-EXPEDITION INTELLIGENCE & CAUSAL FORECAST',{exact:true});await forecast.scrollIntoViewIfNeeded();
        await p.screenshot({path:path.join(out,name+'-oracle-before.png')});r.exactFutureLoot=expected.totalLooted;r.actualLeakedText=await p.locator('main').innerText();
        assert.deepEqual(await read(p),saved);r.status='BASELINE_ORACLE_REPRODUCED';continue;
      }
      const panel=p.getByRole('region',{name:'Pre-expedition scouting',exact:true});await panel.waitFor();
      const text=await panel.innerText();r.previewText=text;
      assert(text.includes('Current ledger facts'));assert(text.includes('Not a simulated result'));assert(text.includes('38kg'));
      assert(!text.includes(expected.rooms[0].causalExplanation));assert(!text.includes('TRAP_BYPASSED'));assert(!text.includes('CHAMBER 01'));
      assert.equal(await p.getByText(expected.rooms[0].causalExplanation,{exact:true}).count(),0);
      assert.equal(await p.getByRole('region',{name:'Completed expedition replay',exact:true}).count(),0);
      assert((await p.locator('main').innerText()).includes('No completed expedition yet'));
      assert.deepEqual(await read(p),saved,'preview never commits learning/state');
      await panel.getByRole('heading',{name:'Pre-expedition scouting',exact:true}).scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,name+'-known-facts.png')});
      const uncertainty=panel.getByText('What remains unknown',{exact:true});await uncertainty.scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,name+'-uncertainty.png')});
      const geometry=await panel.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,font:getComputedStyle(el).fontSize,elements:[...el.querySelectorAll('p,li,h2,h3')].map(e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,width:b.width};})}));
      assert.equal(geometry.client,geometry.scroll);assert.equal(parseFloat(geometry.font),xlarge?25:16);assert(geometry.elements.every(e=>e.left>=0&&e.right<=width+1));r.geometry=geometry;
      const button=p.getByRole('button',{name:/^Run Scheduled Expedition/});await tap(button);await p.waitForFunction(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!).day===2);
      const completed=await read(p);assert.deepEqual(completed.expeditionReports[0],expected);assert(validateSavePayload(JSON.stringify(completed)).valid);
      assert(completed.encounterRenewal.masters[initial.masters[0].id].requests.length>0,'only real completed raid produces requests');
      const replay=p.getByRole('region',{name:'Completed expedition replay',exact:true});await replay.waitFor();assert((await replay.innerText()).includes(`LOOTED: +${expected.totalLooted}g`));
      await replay.getByRole('heading',{name:/Last completed expedition/}).scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,name+'-completed-replay.png')});
      await p.reload();await tap(p.getByRole('button',{name:/^(Continue Ledger|Open Merchant Ledger)/}));
      assert.deepEqual(await read(p),completed,'completed report and renewal survive reload');
      r.scaleImmediatelyAfterReload=await p.locator('html').evaluate(e=>getComputedStyle(e).fontSize);
      r.states={saved,completed};assert.deepEqual(errors,[]);r.status='PASS';
    }catch(e){r.failure=String(e);await p.screenshot({path:path.join(out,name+'-failure.png')}).catch(()=>{});}
    finally{await context.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
  }
  assert(results.every(r=>before?r.status==='BASELINE_ORACLE_REPRODUCED':r.status==='PASS'),JSON.stringify(results.map(r=>({name:r.name,status:r.status,failure:r.failure}))));
  console.log(JSON.stringify(results.map(({name,status,exactFutureLoot,errors})=>({name,status,exactFutureLoot,errors})),null,2));
}finally {await browser.close();}
