import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { captureNativeCheckpoint, restoreNativeCheckpoint, hasHealthyLocalCheckpoint, NATIVE_CHECKPOINT_KEY } from './checkpoints';

export const NATIVE_REJECTED_CHECKPOINT_KEY=NATIVE_CHECKPOINT_KEY+'_rejected_v1';
const MAX_REJECTED_CODE_UNITS=1_000_000;
/** One immutable rejected preimage. If full/unverifiable, keep the active original and pause mirrors. */
async function retainUnreadableMirror(raw:string):Promise<boolean> {
 if(raw.length>MAX_REJECTED_CODE_UNITS)return false;
 try {
  const retained=(await Preferences.get({key:NATIVE_REJECTED_CHECKPOINT_KEY})).value;
  if(retained===raw)return true;
  if(retained!==null)return false;
  await Preferences.set({key:NATIVE_REJECTED_CHECKPOINT_KEY,value:raw});
  return (await Preferences.get({key:NATIVE_REJECTED_CHECKPOINT_KEY})).value===raw;
 }catch{return false;}
}

let ready=false;
let pending:Promise<void>=Promise.resolve();
export function mirrorNativeCheckpoint():Promise<void> {
 if(!ready||!Capacitor.isNativePlatform())return Promise.resolve();
 const value=captureNativeCheckpoint(localStorage);if(value===null)return Promise.resolve();
 // Serialize writes so an older asynchronous plugin completion cannot overwrite newer progress.
 pending=pending.catch(()=>{}).then(async()=>{
  await Preferences.set({key:NATIVE_CHECKPOINT_KEY,value});
  if((await Preferences.get({key:NATIVE_CHECKPOINT_KEY})).value!==value)throw Error('Native checkpoint read-back mismatch.');
 });
 return pending;
}
export function queueNativeCheckpoint():void {
 void mirrorNativeCheckpoint().catch(()=>window.dispatchEvent(new Event('trap-and-tonic-native-save-warning')));
}
export async function finishNativeExit():Promise<void> {await mirrorNativeCheckpoint();await NativeApp.exitApp();}
export async function prepareNativeApp():Promise<string|undefined> {
 if(!Capacitor.isNativePlatform())return;
 ready=false;
 await Preferences.configure({group:'TrapAndTonic'});
 const {value}=await Preferences.get({key:NATIVE_CHECKPOINT_KEY});
 let notice:string|undefined,mirrorSafe=true;
 if(value!==null){
  if(typeof value!=='string')throw Error('Native backup transport value is not text; data preserved.');
  let version:unknown,unreadable=false;
  try{version=JSON.parse(value)?.version;}catch{
   if(!hasHealthyLocalCheckpoint(localStorage))throw Error('Native backup envelope unreadable; data preserved.');
   unreadable=true;
   mirrorSafe=await retainUnreadableMirror(value);
   notice=mirrorSafe?'Using validated local progress; unreadable native mirror retained for inspection.':'Using validated local progress; native mirroring paused to preserve unreadable data.';
  }
  // Readable incompatible versions are never bypassed, even with a healthy local save.
  if(!unreadable&&version!==1)throw Error('Native backup version is unsupported; data preserved.');
 }
 if(!notice)notice=restoreNativeCheckpoint(localStorage,value);
 ready=mirrorSafe;
 await NativeApp.addListener('backButton',()=>window.dispatchEvent(new Event('trap-and-tonic-native-back')));
 await NativeApp.addListener('pause',()=>window.dispatchEvent(new Event('trap-and-tonic-native-pause')));
 await NativeApp.addListener('resume',()=>window.dispatchEvent(new Event('trap-and-tonic-native-resume')));
 await NativeApp.addListener('appStateChange',s=>{if(!s.isActive)window.dispatchEvent(new Event('trap-and-tonic-native-pause'));});
 return notice;
}
