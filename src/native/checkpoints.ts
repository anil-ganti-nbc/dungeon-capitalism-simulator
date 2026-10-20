import { validateSavePayload, SAVE_STORAGE_KEY, SAVE_BACKUP_KEY, HISTORICAL_V2_BACKUP_KEY, LEGACY_SAVE_KEY, LEGACY_BACKUP_KEY, quarantinePayload } from '../engine/saveManager';
import { TUTORIAL_KEY } from '../ui/tutorial';
export const NATIVE_CHECKPOINT_KEY='trap_and_tonic_native_checkpoint_v1';
interface Snapshot {version:1;primary:string;backup:string|null;tutorial:string|null;}
const gameKeys=[SAVE_STORAGE_KEY,SAVE_BACKUP_KEY,HISTORICAL_V2_BACKUP_KEY,LEGACY_BACKUP_KEY,LEGACY_SAVE_KEY];
const healthy=(raw:string|null):raw is string=>raw!==null&&validateSavePayload(raw).valid;
export function hasHealthyLocalCheckpoint(storage:Storage):boolean {
 return gameKeys.some(k=>healthy(storage.getItem(k)));
}
export function captureNativeCheckpoint(storage:Storage):string|null {
 const primary=storage.getItem(SAVE_STORAGE_KEY);if(!healthy(primary))return null;
 const backup=storage.getItem(SAVE_BACKUP_KEY);
 return JSON.stringify({version:1,primary,backup:healthy(backup)?backup:null,tutorial:storage.getItem(TUTORIAL_KEY)} satisfies Snapshot);
}
/** Local healthy progress wins; native is recovery, never a destructive schema migration. */
export function restoreNativeCheckpoint(storage:Storage,raw:string|null):string|undefined {
 if(hasHealthyLocalCheckpoint(storage))return;
 if(raw===null)return;
 const s=JSON.parse(raw) as Snapshot;
 if(s.version!==1||typeof s.primary!=='string'||(s.backup!==null&&typeof s.backup!=='string')||(s.tutorial!==null&&typeof s.tutorial!=='string'))throw Error('Unsupported native checkpoint envelope; data preserved.');
 const selected=healthy(s.primary)?s.primary:healthy(s.backup)?s.backup:null;
 if(!selected)throw Error('Native checkpoint validation failed; data preserved.');
 // Archive local rejected preimages BEFORE any checkpoint overwrite. Never rotate corrupt progress.
 const preimage=Object.fromEntries([...gameKeys,TUTORIAL_KEY].map(k=>[k,storage.getItem(k)]));
 quarantinePayload(storage as Storage,JSON.stringify({source:'before-native-recovery',preimage}));
 storage.setItem(SAVE_STORAGE_KEY,selected);
 if(storage.getItem(SAVE_STORAGE_KEY)!==selected)throw Error('Native recovery local write did not verify.');
 // PRIMARY is already a complete healthy checkpoint if a later optional backup write fails.
 if(healthy(s.backup))storage.setItem(SAVE_BACKUP_KEY,s.backup!);
 if(s.tutorial!==null)storage.setItem(TUTORIAL_KEY,s.tutorial); // Existing UI loader validates defaults/seed/counters.
 return 'Recovered a validated native backup. Previous local checkpoint bytes were archived.';
}
