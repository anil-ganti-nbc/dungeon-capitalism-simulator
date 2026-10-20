import { localhostTestURL } from './test-url';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, Locator, Page } from 'playwright';
import { createInitialSaveState, validateSavePayload } from '../src/engine/saveManager';
import { resolvePostRaidClients, computeInstallationReplacementQuote, executeInstallationReplacement } from '../src/engine/economyEngine';
import { recordCompletedEncounter, replacementForRequest, requestsFor } from '../src/engine/encounterRenewal';
import { simulateRegionExpedition } from '../src/engine/simulation';
const out=process.env.EVIDENCE_DIR??'';assert(out&&path.isAbsolute(out),'Fresh absolute EVIDENCE_DIR required');
fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(path.join(out,'summary.json')),'preserve outputs');
const width=Number(process.env.B3_WIDTH??375),xlarge=process.env.B3_XLARGE==='1',cold=process.env.B3_COLD==='1';
assert([375,412,1440].includes(width));
const url=localhostTestURL();
const options={headless:true,executablePath:process.env.BROWSER_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',viewport:{width,height:width===412?915:1000},hasTouch:true,isMobile:width!==1440};
const profile=fs.mkdtempSync(path.join(out,'owned-profile-'));
const errors:string[]=[],screens:any[]=[],states:any={};
let context=await chromium.launchPersistentContext(profile,{...options,serviceWorkers:cold?'allow':'block'});
let p:Page;
async function expose(loc:Locator) {
  await loc.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  const g=await loc.evaluate(el=>{const r=el.getBoundingClientRect(),center=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,hit:!!center&&(el===center||el.contains(center)),viewportHeight:innerHeight};});
  assert(g.x>=0&&g.right<=width+1&&g.y>=0&&g.bottom<=g.viewportHeight,JSON.stringify(g));assert(g.hit,'sticky overlay intercepted target');return g;
}
async function tap(loc:Locator){await expose(loc);await loc.tap();}
async function scale(){
  if(xlarge){await p.getByRole('button',{name:'Options & A11y (Esc)',exact:true}).tap();await p.getByRole('button',{name:'XLARGE',exact:true}).tap();await p.getByRole('button',{name:'Resume Campaign',exact:true}).tap();}
  const size=await p.locator('html').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert.equal(size,xlarge?20:16);return size;
}
const read=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!));
async function desk(){
  await tap(p.getByRole('navigation',{name:'Main game navigation'}).getByRole('button',{name:'Trade',exact:true}));
  const summary=p.getByText('Full ledger, requests & negotiations',{exact:true});
  if(!await summary.evaluate(e=>(e.parentElement as HTMLDetailsElement).open)) await tap(summary);
}
async function arena(){await tap(p.getByRole('navigation',{name:'Main game navigation'}).getByRole('button',{name:'Expedition',exact:true}));}
async function selectOriginal(masterId:string,partyId:string){await desk();await p.getByLabel('Scheduled Dungeon Master',{exact:true}).selectOption(masterId);await p.getByLabel('Scheduled Adventuring Party',{exact:true}).selectOption(partyId);}
async function shot(name:string,target:Locator){await target.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));const size=await p.locator('html').evaluate(el=>getComputedStyle(el).fontSize);const rect=await target.boundingBox();await p.screenshot({path:path.join(out,name+'.png')});screens.push({name,htmlFontSize:size,target:rect});}
try{
  const initial=createInitialSaveState(88191);initial.parties[0].members[0].massKg=21;initial.parties[0].equippedProducts=[];
  initial.masters[0].installedHazards=['prod_trap_plate_spikes','prod_trap_plate_spikes'];initial.masters[0].installedResetCharges=[0,0];
  if(process.env.B3_LONG_COPY==='1'){initial.masters[0].name+=' the unusually meticulous municipal architect';initial.products.find(p=>p.id==='prod_trap_hairtrigger_acid')!.name+=' with a carefully calibrated replacement mechanism';}
  assert(validateSavePayload(JSON.stringify(initial)).valid);states.fixture=initial;
  await context.addInitScript(s=>{if(!localStorage.getItem('b3-fixture-installed')){localStorage.setItem('trap_and_tonic_save_v2',JSON.stringify(s));localStorage.setItem('b3-fixture-installed','yes');}},initial);
  p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);
  await tap(p.getByRole('button',{name:/^(Continue Ledger|Open Merchant Ledger)/}));await scale();await desk();
  assert((await p.getByRole('region',{name:'Encounter-backed requests',exact:true}).innerText()).includes('No verified encounter evidence'));
  const expectedFirst=simulateRegionExpedition(initial.day,initial.seed,initial.masters[0],initial.parties[0],initial.products,[]);
  await arena();await tap(p.getByRole('button',{name:/^Run Scheduled Expedition/}));await p.waitForFunction(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!).day===2);
  states.completed=await read();assert.deepEqual(states.completed.expeditionReports[0],expectedFirst);
  await selectOriginal(initial.masters[0].id,initial.parties[0].id);
  const pre=await read(),r=requestsFor(pre,initial.masters[0].id)[0];assert.equal(requestsFor(pre,initial.masters[0].id).length,2);
  const card=p.getByRole('article',{name:`Encounter request ${r.id}`,exact:true});
  await shot('observed',card.getByText('Observed in completed report:',{exact:false}));
  await tap(card.getByRole('button',{name:'Defer request',exact:true}));assert.deepEqual(await read(),pre);
  await card.getByLabel(`Response build ${r.id}`,{exact:true}).selectOption('prod_trap_hairtrigger_acid');
  const intent=replacementForRequest(pre,r.id,'prod_trap_hairtrigger_acid')!,q=computeInstallationReplacementQuote(pre,intent,pre.tradeTerms!);assert(q.success,q.reason);
  const expected=executeInstallationReplacement(pre,intent,pre.tradeTerms!,q.unitPrice!).nextState!;
  await tap(card.getByRole('button',{name:'Review encounter replacement',exact:true}));assert.deepEqual(await read(),pre);
  const review=card.getByRole('region',{name:'Review encounter replacement',exact:true});
  const cancel=review.getByRole('button',{name:'Cancel review — no purchase',exact:true});
  const cancelGeometry=await expose(cancel);await shot('cancel-reachable',cancel);await tap(cancel);assert.deepEqual(await read(),pre);
  await tap(card.getByRole('button',{name:'Review encounter replacement',exact:true}));
  const confirm=review.getByRole('button',{name:`Confirm encounter replacement (${q.unitPrice}g)`,exact:true});
  const confirmGeometry=await expose(confirm);await shot('confirm-reachable',confirm);
  const geometry=await card.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,font:getComputedStyle(el).fontSize,
    controls:[...el.querySelectorAll('button,select,summary')].map(e=>{const r=e.getBoundingClientRect();return{tag:e.tagName,width:r.width,height:r.height};})}));
  assert.equal(geometry.width,geometry.scrollWidth);assert(geometry.controls.every(r=>r.width>=44&&r.height>=44));
  assert.equal(parseFloat(geometry.font),xlarge?20:16);
  await tap(confirm);await p.waitForFunction(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!).contractHistory.length===1);
  states.paid=await read();if(process.env.B3_NEGATIVE==='1')expected.gold+=1;
  assert.deepEqual(states.paid,expected,'complete rendered/engine payment and lifecycle parity');
  const history=p.getByRole('region',{name:'Encounter replacement history',exact:true});
  await shot('paid-receipt',history.getByRole('article').first().getByText('Paid:',{exact:false}));
  const second=requestsFor(states.paid,initial.masters[0].id)[1];
  await tap(p.getByRole('article',{name:`Encounter request ${second.id}`,exact:true}).getByRole('button',{name:'Decline this request',exact:true}));
  states.declined=await read();assert.equal(requestsFor(states.declined,initial.masters[0].id)[1].status,'DECLINED');assert.equal(states.declined.contractHistory.length,1);
  await p.reload();await tap(p.getByRole('button',{name:/^(Continue Ledger|Open Merchant Ledger)/}));
  const scaleImmediatelyAfterReload=await p.locator('html').evaluate(el=>getComputedStyle(el).fontSize);
  await scale();await desk(); // Settings are NOT persisted; explicitly reapply actual XLARGE, then capture receipt.
  assert.deepEqual(await read(),states.declined);
  await shot('receipt-reloaded-actual-scale',history.getByRole('article').first().getByText('Paid:',{exact:false}));
  await shot('receipt-source-reloaded',history.getByRole('article').first().getByText('Observed source:',{exact:false}));
  const preRaid=await read(),expectedLater=simulateRegionExpedition(preRaid.day,preRaid.seed,preRaid.masters[0],preRaid.parties[0],preRaid.products,preRaid.contractsToday);
  await arena();await tap(p.getByRole('button',{name:/^Run Scheduled Expedition/}));await p.waitForFunction(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!).day===3);
  states.afterRaid=await read();assert.deepEqual(states.afterRaid.expeditionReports[0],expectedLater);
  const clients=resolvePostRaidClients(preRaid,expectedLater);assert.deepEqual(states.afterRaid.masters,clients.masters);assert.deepEqual(states.afterRaid.parties,clients.parties);
  assert.deepEqual(states.afterRaid.encounterRenewal,recordCompletedEncounter(preRaid,{...preRaid,...clients,day:preRaid.day+1},expectedLater).encounterRenewal);
  assert.equal(states.afterRaid.financialLedger[0].grossRevenue,preRaid.contractsToday.reduce((sum:number,c:any)=>sum+c.totalRevenue,0));
  assert.equal(states.afterRaid.financialLedger[0].cogs,preRaid.contractsToday.reduce((sum:number,c:any)=>sum+c.unitCost*c.quantity,0));
  assert.deepEqual(states.afterRaid.contractHistory,preRaid.contractHistory);assert.equal(states.afterRaid.contractsToday.length,0);
  assert.notEqual(expectedLater.rooms[0].outcome,'TRAP_BYPASSED');assert.equal(expectedLater.rooms[1].outcome,'TRAP_BYPASSED');
  await selectOriginal(initial.masters[0].id,initial.parties[0].id);states.historyAfterAdvance=await read();
  assert((await history.innerText()).includes(states.paid.contractHistory[0].id));
  await shot('history-after-day-advance',history.getByRole('article').first().getByText('Paid:',{exact:false}));
  let coldProof:any=null;
  if(cold){
    await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);
    const blockedBefore=await p.evaluate(async()=>{try{await fetch('/uncached-b3-before?'+Date.now());return false;}catch{return true;}});assert(blockedBefore);
    await context.close();context=await chromium.launchPersistentContext(profile,{...options,offline:true});
    p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await tap(p.getByRole('button',{name:/^(Continue Ledger|Open Merchant Ledger)/}));
    assert.deepEqual(await read(),states.historyAfterAdvance);await scale();await desk();
    const blockedAfter=await p.evaluate(async()=>{try{await fetch('/uncached-b3-after?'+Date.now());return false;}catch{return true;}});assert(blockedAfter);
    await shot('cold-receipt-actual-scale',p.getByRole('region',{name:'Encounter replacement history',exact:true}).getByRole('article').first().getByText('Paid:',{exact:false}));
    coldProof={blockedBefore,blockedAfter,newOwnedBrowserProcess:true,exactState:true};
  }
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({width,xlarge,cold,scaleImmediatelyAfterReload,scaleReappliedAfterReload:xlarge,
    accessibilitySettingPersistence:'NOT implemented; actual control explicitly reapplied after reload',geometry,cancelGeometry,confirmGeometry,screens,coldProof,errors,
    secondaryCriteria:{contrast:'not measured',grayscale:'not executed',keyboardFocus:'not executed',textZoom200:'not executed',longCopy:process.env.B3_LONG_COPY==='1'?'executed fixture':'not executed',reducedMotion:'not executed',nativeAndroid:'NOT TESTED'},
    input:'emulated touch buttons; selectOption is browser automation, not native picker'},null,2),{flag:'wx'});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({width,xlarge,cold,payment:q.unitPrice,request:r.id,geometry,screens,coldProof,errors},null,2));
}finally{fs.writeFileSync(path.join(out,'states.json'),JSON.stringify(states,null,2),{flag:'wx'});fs.writeFileSync(path.join(out,'errors.json'),JSON.stringify(errors),{flag:'wx'});await context.close();}
