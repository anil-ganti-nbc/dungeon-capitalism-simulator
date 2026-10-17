import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, BrowserContext, Page } from 'playwright';
import { createInitialSaveState, normalizeLoadedSave, SAVE_STORAGE_KEY, HISTORICAL_V2_BACKUP_KEY } from '../src/engine/saveManager';
import { assembleTrapProduct } from '../src/engine/simulation';
import { TRAP_PARTS_CATALOG } from '../src/data/catalog';

const out=process.env.EVIDENCE_DIR ?? 'artifacts/sim002b';fs.mkdirSync(out,{recursive:true});
const url=process.env.TEST_URL ?? 'http://127.0.0.1:4178';
const executablePath=process.env.BROWSER_PATH || undefined;
const browser=await chromium.launch({headless:true,executablePath});
const evidence:any[]=[];const errors:any[]=[];
async function boot(name:string,keys:Record<string,string>={},mobile?:{width:number;height:number}) {
  const c=await browser.newContext({viewport:mobile??{width:1440,height:1000},isMobile:!!mobile,hasTouch:!!mobile});
  await c.addInitScript(data=>{if(!sessionStorage.getItem('__boot')){for(const [k,v] of Object.entries(data))localStorage.setItem(k,v);sessionStorage.setItem('__boot','1');}},keys);
  const p=await c.newPage();p.on('pageerror',e=>errors.push({name,error:e.message}));p.on('console',m=>{if(m.type()==='error')evidence.push({name,console:m.text()});});
  await p.goto(url);await p.getByRole('button',{name:/^(Open Merchant Ledger|Continue Ledger)/}).click();
  await p.waitForTimeout(80);return {c,p};
}
const state=(p:Page)=>p.evaluate(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!));
async function shot(p:Page,name:string){await p.screenshot({path:path.join(out,name+'.png')});}
async function tab(p:Page,name:string,mobile=false){await p.getByRole('button',{name,exact:true}).click();}
async function raid(p:Page){const before=await state(p);await p.getByRole('button',{name:/^Run Scheduled Expedition/}).click();await p.waitForTimeout(60);const after=await state(p);assert.equal(after.day,before.day+1);return {before,after};}
try {
  // Historical recovery uses the original Day5 export, not a synthetic fresh save.
  const raw=fs.readFileSync(new URL('./fixtures/historical-v2-day5.json',import.meta.url),'utf8').replace(/^\uFEFF/,'');
  const r=await boot('historical-recovery',{[SAVE_STORAGE_KEY]:'{corrupt',[HISTORICAL_V2_BACKUP_KEY]:raw});
  const restored=await state(r.p);assert.equal(restored.day,JSON.parse(raw).day);assert.equal(restored.gold,JSON.parse(raw).gold);
  assert.match(await r.p.getByRole('alert').innerText(),/trap_and_tonic_backup_v2.*Day 5/);
  await tab(r.p,'Clients');await shot(r.p,'historical-recovery-clients');
  evidence.push({name:'historical-recovery',expected:normalizeLoadedSave(JSON.parse(raw)),actual:restored,storage:await r.p.evaluate(()=>({...localStorage}))});
  await tab(r.p,'Catalyst & Audit');await r.p.getByRole('button',{name:'Paradox Catalyst Gate & Save Ledger',exact:true}).click();
  const bad=structuredClone(restored);bad.parties[0].members[0]=null;
  await r.p.locator('textarea').fill(JSON.stringify(bad));
  await r.p.getByRole('button',{name:/Import Save JSON/}).click();
  assert.deepEqual(await state(r.p),restored);await tab(r.p,'Clients');await shot(r.p,'corrupt-import-refused');
  await r.p.reload();await r.p.getByRole('button',{name:/^Continue Ledger/}).click();await tab(r.p,'Clients');assert.deepEqual(await state(r.p),restored);await r.c.close();

  // No sales: actual UI day advancement, no loadout mutation beyond normal wear.
  const s=createInitialSaveState();for(const m of s.masters){m.installedHazards=[];m.installedResetCharges=[];}for(const p of s.parties)p.equippedProducts=[];
  const n=await boot('ten-no-purchase-raids',{[SAVE_STORAGE_KEY]:JSON.stringify(s)});const raids=[];
  for(let d=0;d<10;d++){const row=await raid(n.p);for(const m of row.after.masters)assert.deepEqual(m.installedHazards,[]);for(const p of row.after.parties)assert.deepEqual(p.equippedProducts,[]);raids.push(row);}
  evidence.push({name:'ten-no-purchase-raids',raids});await shot(n.p,'ten-no-purchase-raids');await n.c.close();

  // Fifth paid dose cannot silently evict an unused unit.
  const cap=createInitialSaveState();cap.parties[0].equippedProducts=[];cap.parties[0].budget=10000;cap.products[0].stock=6;
  const f=await boot('five-dose-capacity',{[SAVE_STORAGE_KEY]:JSON.stringify(cap)});const prod=cap.products[0];
  const card=f.p.getByText(prod.name+' [#'+prod.formulaSignature+']',{exact:true}).locator('../..');
  for(let i=0;i<4;i++){await card.getByRole('button').click();await f.p.waitForTimeout(30);}
  const four=await state(f.p);assert.equal(four.parties[0].equippedProducts.length,4);assert.equal(four.contractHistory.length,4);
  assert.equal(await card.getByRole('button').isEnabled(),false);assert.match(await card.innerText(),/Loadout full/);await f.p.reload();await f.p.getByRole('button',{name:/^Continue Ledger/}).click();assert.deepEqual(await state(f.p),four);
  evidence.push({name:'five-dose-capacity',before:cap,after:four});await shot(f.p,'fifth-dose-refused');await f.c.close();

  // One finite reset, then exhaustion, across real UI raids and a reload.
  const temp=createInitialSaveState();temp.day=3;temp.masters[0].installedHazards=[];temp.masters[0].installedResetCharges=[];temp.masters[0].budget=99999;temp.parties[0].equippedProducts=[];temp.parties[0].members[0].massKg=21;
  const trap=assembleTrapProduct(['part_trg_12','part_con_01','part_del_01','part_pay_01','part_pow_01','part_rst_09'].map(id=>TRAP_PARTS_CATALOG.find(p=>p.id===id)!) as any,'Temporal diagnostic',false);temp.products.push(trap);
  const tr=await boot('temporal-resource',{[SAVE_STORAGE_KEY]:JSON.stringify(temp)});
  await tr.p.getByText(trap.name+' [#'+trap.formulaSignature+']',{exact:true}).locator('../..').getByRole('button').click();
  const paid=await state(tr.p);assert.deepEqual(paid.masters[0].installedResetCharges,[1]);const resetRaids=[];
  for(let d=3;d<=6;d++){
    await tab(tr.p,'Bilateral Desk');await tr.p.getByRole('combobox',{name:'Scheduled Dungeon Master'}).selectOption(temp.masters[0].id);await tr.p.getByRole('combobox',{name:'Scheduled Adventuring Party'}).selectOption(temp.parties[0].id);
    resetRaids.push(await raid(tr.p));
    if(d===3){const a=await state(tr.p);assert.deepEqual(a.masters[0].installedResetCharges,[0]);assert.deepEqual(a.masters[0].installedHazards,[trap.id]);assert.equal(a.expeditionReports[0].rooms[0].outcome,'TRAP_TRIGGERED');await tr.p.reload();await tr.p.getByRole('button',{name:/^Continue Ledger/}).click();assert.deepEqual(await state(tr.p),a);}
  }
  assert.deepEqual((await state(tr.p)).masters[0].installedHazards,[]);evidence.push({name:'temporal-resource',paid,raids:resetRaids});await shot(tr.p,'temporal-charge-exhausted');await tr.c.close();

  // Android-sized emulation, genuine CDP touch events; no physical keyboard.
  for(const viewport of [{width:375,height:812},{width:412,height:915}]){
    const name=`touch-${viewport.width}`;const {c,p}=await boot(name,{},viewport);const cdp=await c.newCDPSession(p);
    for(const scale of ['normal','xlarge']){
      if(scale==='xlarge'){await p.getByRole('button',{name:'Options & A11y (Esc)',exact:true}).click();await p.getByRole('button',{name:'XLARGE',exact:true}).tap();await p.getByRole('button',{name:'Resume Campaign',exact:true}).tap();}
      const headerControls=await p.locator('header button').evaluateAll(xs=>xs.map(e=>({x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right})));
      assert(headerControls.every(e=>e.x>=0 && e.right<=viewport.width+1));
      await tab(p,'Trade',true);await shot(p,`${name}-${scale}-trade`);
      const trade=await p.locator('main').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,scrollLeft:el.scrollLeft}));assert.equal(trade.scrollWidth,trade.width);
      await tab(p,'Skills',true);await tab(p,'Alchemy',true);await shot(p,`${name}-${scale}-alchemy`);
      await tab(p,'Traps',true);await shot(p,`${name}-${scale}-traps`);
      await tab(p,'Arena',true);const canvas=p.locator('canvas');await canvas.scrollIntoViewIfNeeded();await p.waitForTimeout(50);
      const b=(await canvas.boundingBox())!,before={x:await canvas.getAttribute('data-camera-x'),y:await canvas.getAttribute('data-camera-y'),scroll:await p.locator('main').evaluate(el=>el.scrollLeft)};
      const x=b.x+b.width*.75,y=b.y+b.height*.55;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});
      for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*18,y:y-i*2,id:0}]});await p.waitForTimeout(25);await p.screenshot({path:path.join(out,`${name}-${scale}-frame-${i}.png`)});}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(50);
      const after={x:await canvas.getAttribute('data-camera-x'),y:await canvas.getAttribute('data-camera-y'),scroll:await p.locator('main').evaluate(el=>el.scrollLeft)};
      assert.notEqual(before.x,after.x);assert.equal(before.scroll,0);assert.equal(after.scroll,0);await shot(p,`${name}-${scale}-panned`);
      const geo=await p.locator('main').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,controls:[...el.querySelectorAll('button,select')].map(e=>({text:e.textContent?.trim(),x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,scroll:e.scrollWidth,width:e.clientWidth}))}));
      assert.equal(geo.scrollWidth,geo.width);assert(geo.controls.every(e=>e.x>=0 && e.right<=viewport.width+1));
      evidence.push({name,scale,before,after,trade,geometry:geo});
    }
    await c.close();
  }
  assert.deepEqual(errors,[]);console.log('Browser recovery, import, conservation, temporal reset, portrait touch: assertions passed');
} finally {fs.writeFileSync(path.join(out,'browser-foundation.json'),JSON.stringify({evidence,errors},null,2));await browser.close();}
