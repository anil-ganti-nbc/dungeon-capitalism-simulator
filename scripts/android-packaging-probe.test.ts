import test from 'node:test';
import assert from 'node:assert/strict';
import { captureNativeCheckpoint, restoreNativeCheckpoint } from '../src/native/checkpoints';
import { createInitialSaveState, SAVE_STORAGE_KEY, SAVE_BACKUP_KEY, QUARANTINE_KEY, validateSavePayload } from '../src/engine/saveManager';
import { TUTORIAL_KEY } from '../src/ui/tutorial';
import { localhostTestURL } from './test-url';
class MemoryStorage implements Storage {
 data=new Map<string,string>();fail=false;
 get length(){return this.data.size;}
 key(i:number){return [...this.data.keys()][i]??null;}
 getItem(k:string){return this.data.get(k)??null;}
 setItem(k:string,v:string){if(this.fail)throw Error('simulated full storage');this.data.set(k,String(v));}
 removeItem(k:string){this.data.delete(k);}
 clear(){this.data.clear();}
}
const raw=(seed:number)=>JSON.stringify(createInitialSaveState(seed));
const source=()=>{const s=new MemoryStorage();s.setItem(SAVE_STORAGE_KEY,raw(73));s.setItem(SAVE_BACKUP_KEY,raw(71));s.setItem(TUTORIAL_KEY,'tutorial-preimage');return s;};
test('APK N01 native recovery restores validated full primary, backup and independent guide bytes',()=>{
 const a=source(),payload=captureNativeCheckpoint(a)!;assert(payload);const b=new MemoryStorage();assert.match(restoreNativeCheckpoint(b,payload)!,/Recovered/);
 for(const k of [SAVE_STORAGE_KEY,SAVE_BACKUP_KEY,TUTORIAL_KEY])assert.equal(b.getItem(k),a.getItem(k));
 assert(validateSavePayload(b.getItem(SAVE_STORAGE_KEY)).valid);
});
test('APK N02 healthy existing local campaign wins over a different native snapshot',()=>{
 const b=new MemoryStorage();b.setItem(SAVE_STORAGE_KEY,raw(99));const before=[...b.data];restoreNativeCheckpoint(b,captureNativeCheckpoint(source()));assert.deepEqual([...b.data],before);
});
test('APK N03 incompatible or invalid native snapshots cannot overwrite rejected local bytes',()=>{
 for(const payload of [JSON.stringify({version:2,primary:raw(73),backup:null,tutorial:null}),JSON.stringify({version:1,primary:'broken',backup:null,tutorial:null})]){
  const b=new MemoryStorage();b.setItem(SAVE_STORAGE_KEY,'local-preimage');assert.throws(()=>restoreNativeCheckpoint(b,payload));assert.deepEqual([...b.data],[[SAVE_STORAGE_KEY,'local-preimage']]);
 }
});
test('APK N04 recovery archives corrupt local bytes before replacing primary',()=>{
 const b=new MemoryStorage();b.setItem(SAVE_STORAGE_KEY,'local-preimage');restoreNativeCheckpoint(b,captureNativeCheckpoint(source()));assert(b.getItem(QUARANTINE_KEY)?.includes('local-preimage'));assert.equal(b.getItem(SAVE_STORAGE_KEY),raw(73));
});
test('APK N05 failed quarantine write preserves local primary and stops recovery',()=>{
 const b=new MemoryStorage();b.setItem(SAVE_STORAGE_KEY,'local-preimage');b.fail=true;assert.throws(()=>restoreNativeCheckpoint(b,captureNativeCheckpoint(source())));assert.deepEqual([...b.data],[[SAVE_STORAGE_KEY,'local-preimage']]);
});
test('APK N06 invalid primary cannot manufacture a native mirror or rotate the healthy backup',()=>{
 const b=source();b.setItem(SAVE_STORAGE_KEY,'invalid');const before=[...b.data];assert.equal(captureNativeCheckpoint(b),null);assert.deepEqual([...b.data],before);
});
test('APK N07 portable browser URL accepts loopback targets, rejects public/credential/reserved targets',()=>{
 for(const u of ['http://127.0.0.1:4178','http://localhost:4523','http://[::1]:4179'])assert.equal(localhostTestURL(u),new URL(u).href);
 for(const u of ['http://example.com:4178','http://localhost:8765','http://user:pass@localhost:4178','file:///game'])assert.throws(()=>localhostTestURL(u));
});
