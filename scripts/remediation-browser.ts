/** Bounded D02–D04 browser regressions. Fixture use is explicit diagnostic setup. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, Page } from 'playwright';
import { GameSaveState } from '../src/types/game';
import { normalizeLoadedSave, SAVE_STORAGE_KEY, SAVE_BACKUP_KEY, QUARANTINE_KEY } from '../src/engine/saveManager';

const out=process.env.EVIDENCE_DIR??'artifacts/d01-d04/browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
const url=process.env.TEST_URL??'http://127.0.0.1:4178';const results:any[]=[];const errors:string[]=[];
const read=(p:Page):Promise<GameSaveState>=>p.evaluate(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!));
const write=(name:string,data:any)=>fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2));
async function boot(keys:Record<string,string>={}){
  // Diagnostic save/UI checks are isolated from dev-worker reloads; production PWA is tested separately.
  const c=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await c.addInitScript(data=>{if(!sessionStorage.getItem('__setup')){for(const[k,v]of Object.entries(data))localStorage.setItem(k,v);sessionStorage.setItem('__setup','1');}},keys);
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.getByRole('button',{name:/^(Open Merchant Ledger|Continue Ledger)/}).click();await p.waitForTimeout(50);return{c,p};
}
async function check(name:string,fn:()=>Promise<void>){try{await fn();results.push({name,pass:true});console.log(name+' PASS');}catch(e){results.push({name,pass:false,error:String(e)});console.log(name+' FAIL '+String(e).split('\n')[0]);}}
const original=fs.readFileSync(new URL('./fixtures/historical-v2-day5.json',import.meta.url),'utf8').replace(/^\uFEFF/,'');
const good=normalizeLoadedSave(JSON.parse(original));
try{
  for(const fault of ['200-doses','unknown-reagent'] as const)await check('D02-recovery-'+fault,async()=>{
    const bad=structuredClone(good);bad.gold=999;
    if(fault==='200-doses')bad.parties[0].equippedProducts=Array(200).fill(bad.products[0].id);else bad.reagentInventory.reg_impossible=1;
    const raw=JSON.stringify(bad);const{c,p}=await boot({[SAVE_STORAGE_KEY]:raw,[SAVE_BACKUP_KEY]:original});
    try{
      const actual=await read(p),storage=await p.evaluate(()=>({...localStorage})),alerts=await p.getByRole('alert').allTextContents();
      write('D02-recovery-'+fault,{badRaw:raw,expected:good,actual,storage,alerts});await p.screenshot({path:path.join(out,'D02-recovery-'+fault+'.png')});
      assert.deepEqual(actual,good);assert(alerts.some(a=>a.includes('Day 5')&&a.includes(SAVE_BACKUP_KEY)));assert.equal(storage[SAVE_BACKUP_KEY],original);
      assert(Object.entries(storage).some(([k,v])=>k.startsWith(QUARANTINE_KEY)&&v===raw));
      await p.getByRole('button',{name:'Clients',exact:true}).click();await p.reload();await p.getByRole('button',{name:/^Continue Ledger/}).click();assert.deepEqual(await read(p),good);
    }finally{await c.close();}
  });
  await check('D02-import-overflow',async()=>{
    const{c,p}=await boot({[SAVE_STORAGE_KEY]:JSON.stringify(good)});
    try{
      const bad=structuredClone(good);bad.masters[0].installedHazards=Array(4).fill(bad.products[5].id);bad.masters[0].installedResetCharges=[0,0,0,0];
      const raw=JSON.stringify(bad);await p.getByRole('button',{name:'Catalyst & Audit',exact:true}).click();await p.getByRole('button',{name:'Paradox Catalyst Gate & Save Ledger',exact:true}).click();
      await p.locator('textarea').fill(raw);await p.getByRole('button',{name:/Import Save JSON/}).click();
      const actual=await read(p),storage=await p.evaluate(()=>({...localStorage})),alerts=await p.getByRole('alert').allTextContents();write('D02-import',{badRaw:raw,expected:good,actual,storage,alerts});
      await p.screenshot({path:path.join(out,'D02-import-refused.png')});assert.deepEqual(actual,good);assert(alerts.some(a=>a.includes('Import refused')));assert(Object.entries(storage).some(([k,v])=>k.startsWith(QUARANTINE_KEY)&&v===raw));
    }finally{await c.close();}
  });
  await check('D03-earned-cam-preview-product-raid-reload',async()=>{
    const {c,p}=await boot();
    try{
      for(let day=1;day<=2;day++){await p.getByRole('button',{name:/^Run Scheduled Expedition/}).click();await p.waitForFunction(d=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!).day===d+1,day);}
      await p.getByRole('button',{name:'Trap Workshop',exact:true}).click();
      const previewDC=async()=>Number((await p.getByText('Detection DC',{exact:true}).locator('..').innerText()).match(/DC (\d+)/)![1]);
      const beforePreview=await previewDC(),start=await read(p);
      await p.getByRole('button',{name:/Assemble 2 Units/}).click();await p.waitForTimeout(30);
      const oldStock=await read(p),ordinary=oldStock.products.find(q=>!start.products.some(o=>o.id===q.id));assert(ordinary);
      await p.getByRole('button',{name:'Skills',exact:true}).click();
      const card=p.getByText('Secondary Fail-Deadly Cam',{exact:true}).locator('../..');const skillText=await card.innerText();
      await card.getByRole('button',{name:'Unlock (2 SP)',exact:true}).click();await p.waitForTimeout(30);const unlocked=await read(p);
      await p.getByRole('button',{name:'Trap Workshop',exact:true}).click();const afterPreview=await previewDC();
      await p.screenshot({path:path.join(out,'D03-cam-preview.png')});await p.getByRole('button',{name:/Assemble 2 Units/}).click();await p.waitForTimeout(30);
      const crafted=await read(p),enhanced=crafted.products.find(q=>q.stock!==unlocked.products.find(o=>o.id===q.id)?.stock);assert(enhanced);
      await p.getByRole('button',{name:'Bilateral Desk',exact:true}).click();await p.getByRole('combobox',{name:'Scheduled Dungeon Master'}).selectOption('dm_cellar_1');await p.getByRole('combobox',{name:'Scheduled Adventuring Party'}).selectOption('pty_cellar_1');
      await p.getByText(enhanced.name+' [#'+enhanced.formulaSignature+']',{exact:true}).locator('../..').getByRole('button').click();
      const paid=await read(p);await p.getByRole('button',{name:/^Run Scheduled Expedition/}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!).day===4);
      const afterRaid=await read(p);await p.reload();await p.getByRole('button',{name:/^Continue Ledger/}).click();const reloaded=await read(p);
      write('D03-cam',{start,beforePreview,oldStock,ordinary,skillText,unlocked,afterPreview,crafted,enhanced,paid,afterRaid,reloaded});await p.screenshot({path:path.join(out,'D03-cam-after-reload.png')});
      assert.equal(beforePreview,21);assert.equal(afterPreview,33);assert.equal(enhanced.detectionDC,33);assert(enhanced.appliedSkills?.includes('auto_reset_cam'));assert.notEqual(enhanced.id,ordinary.id);
      assert.equal(unlocked.skillPoints,oldStock.skillPoints-2);assert.deepEqual(unlocked.products,oldStock.products);assert.deepEqual(unlocked.masters,oldStock.masters);assert.deepEqual(unlocked.parties,oldStock.parties);
      assert.equal(crafted.products.find(q=>q.id===ordinary.id)!.stock,ordinary.stock);assert.deepEqual(reloaded,afterRaid);
      const enhancedRooms=afterRaid.expeditionReports[0].rooms.filter(r=>r.hazardId===enhanced.id);assert(enhancedRooms.length>0);assert(enhancedRooms.every(r=>r.causalExplanation.includes('DC 33')));
      assert.deepEqual(afterRaid.masters.find(m=>m.id==='dm_cellar_1')!.installedHazards,paid.masters.find(m=>m.id==='dm_cellar_1')!.installedHazards,'existing cam wear immunity must remain unchanged');
    }finally{await c.close();}
  });
  assert.deepEqual(errors,[]);
}finally{write('summary',{results,errors});await browser.close();}
assert(results.length>0);assert(results.every(r=>r.pass),'D02–D04 browser regressions failed');
