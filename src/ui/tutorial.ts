import type { GameSaveState } from '../types/game';
export const TUTORIAL_KEY='trap_and_tonic_tutorial_v1';
export type Guide = {version:1;seed:number;status:'active'|'skipped'|'complete';step:0|1|2|3|4;baseline:{crafts:number;contracts:number;reports:number};reportId:string|null};
const counts=(s:GameSaveState)=>({crafts:s.customBrewsCount+s.customTrapsCount,contracts:s.contractHistory.length,reports:s.expeditionReports.length});
export function startGuide(s:GameSaveState,active=true):Guide {return {version:1,seed:s.seed,status:active?'active':'skipped',step:0,baseline:counts(s),reportId:null};}
export function loadGuide(raw:string|null,s:GameSaveState,genuineFresh:boolean):Guide {
  const fallback=()=>startGuide(s,genuineFresh&&s.day===1&&Object.values(counts(s)).every(n=>n===0));
  if(!raw)return fallback();
  try {
    const g=JSON.parse(raw),now=counts(s),b=g.baseline;
    if(g.version!==1||g.seed!==s.seed||!['active','skipped','complete'].includes(g.status)||!Number.isInteger(g.step)||g.step<0||g.step>4
      ||(g.step===4)!==(g.status==='complete')||!b||!['crafts','contracts','reports'].every(k=>Number.isSafeInteger(b[k])&&b[k]>=0&&b[k]<=now[k as keyof typeof now])
      ||(g.step>=3?typeof g.reportId!=='string'||!s.expeditionReports.some(r=>r.id===g.reportId):g.reportId!==null))return startGuide(s,false);
    return {version:1,seed:g.seed,status:g.status,step:g.step,baseline:{...b},reportId:g.reportId};
  }catch{return startGuide(s,false);}
}
/** Observe committed counters, never clicks/quotes/cancels. Each new stage starts at current counters. */
export function reconcileGuide(g:Guide,s:GameSaveState):Guide {
  if(g.seed!==s.seed||Object.entries(counts(s)).some(([k,n])=>n<g.baseline[k as keyof typeof g.baseline]))return startGuide(s,false);
  if(g.status!=='active')return g;
  const now=counts(s),passed=g.step===0?now.crafts>g.baseline.crafts:g.step===1?now.contracts>g.baseline.contracts:g.step===2?now.reports>g.baseline.reports:false;
  if(!passed)return g;
  return {...g,step:(g.step+1) as Guide['step'],baseline:now,reportId:g.step===2?s.expeditionReports[0].id:null};
}
export function skipGuide(g:Guide):Guide{return g.step===4?g:{...g,status:'skipped'};}
export function resumeGuide(g:Guide,s:GameSaveState):Guide{return g.seed!==s.seed?startGuide(s,true):g.step===4?g:{...g,status:'active',baseline:counts(s)};}
export function inspectGuideReport(g:Guide,s:GameSaveState,id:string):Guide {
  return g.status==='active'&&g.step===3&&g.reportId===id&&s.expeditionReports.some(r=>r.id===id)?{...g,step:4,status:'complete'}:g;
}
