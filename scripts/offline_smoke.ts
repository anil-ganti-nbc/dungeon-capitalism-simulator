import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const out=process.env.EVIDENCE_DIR ?? 'artifacts/sim002b';fs.mkdirSync(out,{recursive:true});
const url=process.env.OFFLINE_TEST_URL ?? 'http://127.0.0.1:4179';
const profile=fs.mkdtempSync(path.join(out,'cold-profile-'));
const options={headless:true,executablePath:process.env.BROWSER_PATH||undefined,viewport:{width:412,height:915},isMobile:true,hasTouch:true};
let c=await chromium.launchPersistentContext(profile,options);let p=await c.newPage();
const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));
try {
  await p.goto(url);await p.getByRole('button',{name:/^Open Merchant Ledger/}).tap();
  await p.getByRole('button',{name:/^Run Scheduled Expedition/}).tap();
  await p.waitForFunction(()=>JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!).day===2);
  await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const before=await p.evaluate(()=>localStorage.getItem('trap_and_tonic_save_v2'));
  await c.setOffline(true);
  const blocked=await p.evaluate(async()=>{try{await fetch('/definitely-not-cached-offline-probe?'+Date.now());return false;}catch{return true;}});assert(blocked);
  await c.close();
  // New browser process, same durable profile; network restricted before first navigation.
  c=await chromium.launchPersistentContext(profile,{...options,offline:true});p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url);await p.getByRole('button',{name:/^Continue Ledger/}).tap();
  const after=await p.evaluate(()=>localStorage.getItem('trap_and_tonic_save_v2'));
  assert.equal(after,before);const stillBlocked=await p.evaluate(async()=>{try{await fetch('/uncached-cold-probe?'+Date.now());return false;}catch{return true;}});assert(stillBlocked);
  await p.screenshot({path:path.join(out,'offline-cold-reopen.png')});assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'offline-proof.json'),JSON.stringify({url,profile,networkBlockedBeforeClose:blocked,networkBlockedAfterColdOpen:stillBlocked,before:JSON.parse(before!),after:JSON.parse(after!),errors,physicalAndroid:'NOT TESTED',apk:'NOT TESTED',osKill:'NOT TESTED'},null,2));
  console.log('Network-restricted production browser cold reopen: exact save preserved');
} finally {await c.close();}
