/** Bounded D02–D04 browser regressions. Fixture use is explicit diagnostic setup. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, Page } from 'playwright';
import { normalizeLoadedSave, SAVE_STORAGE_KEY, SAVE_BACKUP_KEY, QUARANTINE_KEY } from '../src/engine/saveManager';

const out=process.env.EVIDENCE_DIR??'artifacts/d01-d04/browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
const url=process.env.TEST_URL??'http://127.0.0.1:4178';const results:any[]=[];const errors:string[]=[];
const read=(p:Page)=>p.evaluate(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!));
const write=(name:string,data:any)=>fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2));
async function boot(keys:Record<string,string>={}){
  const c=await browser.newContext({viewport:{width:1440,height:1000}});
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
  assert.deepEqual(errors,[]);
}finally{write('summary',{results,errors});await browser.close();}
assert(results.length>0);assert(results.every(r=>r.pass),'D02–D04 browser regressions failed');
