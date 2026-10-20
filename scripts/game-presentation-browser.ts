import { localhostTestURL } from './test-url';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium,Locator} from 'playwright';
import {createInitialSaveState,validateSavePayload} from '../src/engine/saveManager';
import {starterBrew} from '../src/ui/presentation';import {TUTORIAL_KEY} from '../src/ui/tutorial';
import {executeCommercialTransaction} from '../src/engine/economyEngine';import {simulateRegionExpedition} from '../src/engine/simulation';
const out=process.env.EVIDENCE_DIR!;assert(out&&path.isAbsolute(out));fs.mkdirSync(out,{recursive:true});const url=localhostTestURL();
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});const results:any[]=[];
async function tap(loc:Locator){await loc.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await loc.tap();}
try {
 for(const [width,xlarge] of [[375,false],[375,true],[412,false],[412,true]] as const) {
  const context=await browser.newContext({viewport:{width,height:1000},hasTouch:true,isMobile:true,serviceWorkers:'block',reducedMotion:'reduce'}),p=await context.newPage();const row:any={width,xlarge,status:'FAIL',errors:[]};results.push(row);p.on('pageerror',e=>row.errors.push(e.message));
  const state=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!));const guide=()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)!),TUTORIAL_KEY);
  async function waitStep(step:number){await p.waitForFunction(({key,step})=>JSON.parse(localStorage.getItem(key)!).step===step,{key:TUTORIAL_KEY,step});}
  async function scale(){await tap(p.getByRole('button',{name:'Options & A11y (Esc)',exact:true}));if(xlarge)await tap(p.getByRole('button',{name:'XLARGE',exact:true}));await p.getByLabel('Reduced Animation & Zero Camera Shake',{exact:true}).check();await tap(p.getByRole('button',{name:'Resume Campaign',exact:true}));assert.equal(await p.locator('html').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)),xlarge?20:16);}
  try {
   // No rich fixture or preloaded campaign: genuine factory state and new-campaign title action.
   await p.goto(url);await tap(p.getByRole('button',{name:/^Open Merchant Ledger/}));await scale();
   const initial=await state();assert.deepEqual(initial,createInitialSaveState());assert.equal((await guide()).step,0);assert.equal((await guide()).status,'active');row.initial=initial;
   // Progressive disclosures contain lazy art; require all rendered opening images, not unopened portraits.
   await p.waitForFunction(()=>[...document.querySelectorAll('img')].filter(i=>i.getClientRects().length>0).every(i=>i.complete&&i.naturalWidth>0));
   row.initialArt=await p.locator('img').evaluateAll(es=>es.map(e=>({src:e.getAttribute('src'),alt:(e as HTMLImageElement).alt,naturalWidth:(e as HTMLImageElement).naturalWidth})));
   assert(row.initialArt.some((a:any)=>a.src?.endsWith('/scene-shop.svg')));assert(row.initialArt.some((a:any)=>a.src?.endsWith('/portrait-dm_cellar_1.svg')));
   const panel=p.getByRole('region',{name:'First shift guide',exact:true});await p.screenshot({path:path.join(out,`${width}-${xlarge?'XLARGE':'Normal'}-hub.png`)});
   await tap(panel.getByRole('button',{name:'Skip guide',exact:true}));assert.equal((await guide()).status,'skipped');assert.deepEqual(await state(),initial);
   await tap(panel.getByRole('button',{name:'Resume guide',exact:true}));await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)!).status==='active',TUTORIAL_KEY);
   await tap(panel.getByRole('button',{name:'Go to Workshop',exact:true}));const b=starterBrew(initial);assert(b.available);await tap(p.getByRole('button',{name:`Brew starter batch — ${b.cost}g`,exact:true}));await waitStep(1);
   const made=await state();assert.equal(made.gold,initial.gold-b.cost);assert.equal(made.customBrewsCount,1);assert(validateSavePayload(JSON.stringify(made)).valid);row.craftCost=b.cost;
   await p.reload();await tap(p.getByRole('button',{name:/^(Continue Ledger|Open Merchant Ledger)/}));await scale();assert.equal((await guide()).step,1);assert.deepEqual(await state(),made);
   await tap(panel.getByRole('button',{name:'Go to Trade',exact:true}));const counter=p.getByRole('region',{name:'Trade counter',exact:true});
   await tap(counter.getByRole('button',{name:'Review sale',exact:true}));await tap(p.getByRole('button',{name:'Cancel sale',exact:true}));assert.equal((await guide()).step,1);assert.deepEqual(await state(),made);
   const selected=await counter.getByLabel('Counter product',{exact:true}).inputValue(),product=made.products.find((q:any)=>q.id===selected)!;
   const tx=executeCommercialTransaction(made,'HERO',made.parties[0].id,product,made.tradeTerms);assert(tx.success,tx.reason);assert(tx.nextState);
   await tap(counter.getByRole('button',{name:'Review sale',exact:true}));const confirm=p.getByRole('button',{name:`Confirm sale — ${tx.unitPrice}g`,exact:true});await confirm.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await p.screenshot({path:path.join(out,`${width}-${xlarge?'XLARGE':'Normal'}-sale-review.png`)});await tap(confirm);await waitStep(2);
   const sold=await state();assert.deepEqual(sold,tx.nextState);row.salePrice=tx.unitPrice;
   await tap(panel.getByRole('button',{name:'Go to Expedition',exact:true}));const expected=simulateRegionExpedition(sold.day,sold.seed,sold.masters[0],sold.parties[0],sold.products,sold.contractsToday);
   await tap(p.getByRole('button',{name:/^Run Scheduled Expedition/}));await waitStep(3);const completed=await state();assert.deepEqual(completed.expeditionReports[0],expected);assert(validateSavePayload(JSON.stringify(completed)).valid);
   assert.equal((await guide()).status,'active');await tap(panel.getByRole('button',{name:'Go to History',exact:true}));assert.equal((await guide()).step,3);
   const summary=p.getByText('Inspect completed report — Day 1',{exact:true});await tap(summary);await waitStep(4);assert.equal((await guide()).status,'complete');assert.deepEqual(await state(),completed);
   await summary.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await p.screenshot({path:path.join(out,`${width}-${xlarge?'XLARGE':'Normal'}-report.png`)});
   await tap(panel.getByText('Guide controls',{exact:true}));await tap(panel.getByRole('button',{name:'Reset tutorial only',exact:true}));await waitStep(0);assert.deepEqual(await state(),completed,'tutorial reset never resets campaign');
   await tap(panel.getByRole('button',{name:'Skip guide',exact:true}));await p.reload();await tap(p.getByRole('button',{name:/^(Continue Ledger|Open Merchant Ledger)/}));assert.equal((await guide()).status,'skipped');assert.deepEqual(await state(),completed);
   const nav=p.getByRole('navigation',{name:'Main game navigation'});row.navGeometry=await nav.locator('button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,width:r.width,height:r.height,left:r.left,right:r.right};}));assert(row.navGeometry.every((g:any)=>g.width>=44&&g.height>=44&&g.left>=0&&g.right<=width+1));
   row.states={made,sold,completed};assert.deepEqual(row.errors,[]);row.status='PASS';
  }catch(e){row.failure=String(e);await p.screenshot({path:path.join(out,`${width}-${xlarge?'XLARGE':'Normal'}-failure.png`)}).catch(()=>{});}
  finally {await context.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
 }
 assert(results.every(r=>r.status==='PASS'),JSON.stringify(results.map(({width,xlarge,status,failure})=>({width,xlarge,status,failure}))));console.log(JSON.stringify(results.map(({width,xlarge,status,craftCost,salePrice,errors})=>({width,xlarge,status,craftCost,salePrice,errors})),null,2));
}finally{await browser.close();}
