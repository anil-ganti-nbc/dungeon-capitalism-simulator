import { AssetToken, ProductArtwork, PartyPortraits } from './Artwork';
import { ROOM_ART_BY_NAME } from '../ui/finalGameArt';
import React, { useEffect, useState } from 'react';
import type { GameSaveState, WorkspaceTab, CraftedProduct, DungeonMaster, AdventuringParty } from '../types/game';
import type { Guide } from '../ui/tutorial';
import { starterBrew } from '../ui/presentation';
import { APPROVED_GAME_ART, ENTITY_ART_SLOTS } from '../ui/gameArtwork';
import { computeQuotation } from '../engine/economyEngine';
const button='min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-100 whitespace-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400';
const primary='min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg border border-amber-300 bg-amber-500 text-slate-950 font-semibold whitespace-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400';
export function EntityArt({id,label,scene=false}:{id:string;label:string;scene?:boolean}) {
 const art=APPROVED_GAME_ART[id],[failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[id,art?.src]);
 return <div data-entity-art={id} className={`${scene?'h-40':ENTITY_ART_SLOTS[id]?.kind==='party'?'h-28':'h-24'} ${art&&!failed?'bg-[#f0e5c5]':'bg-gradient-to-br from-amber-950 via-slate-900 to-slate-800'} rounded-lg overflow-hidden border border-amber-800/60 flex items-center justify-center`}>
  {art&&!failed?<img src={art.src} alt={art.alt} onError={()=>setFailed(true)} className="w-full h-full object-contain"/>:<span className="text-center px-2 text-slate-300" aria-label={`${label}: artwork pending`}><span aria-hidden="true" className="block text-2xl font-serif text-amber-300">{label.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('')}</span><span className="text-xs">{ENTITY_ART_SLOTS[id]?.kind??'item'} · art pending</span></span>}
 </div>;
}
export function GameIcon({id}:{id:string}) {const art=APPROVED_GAME_ART[id];return art?<img src={art.src} alt="" aria-hidden="true" className="w-7 h-7 rounded bg-[#f0e5c5] p-0.5"/>:null;}
const stages=[{title:'Make a batch',text:'Brew a starter antidote. Ingredients and any spot-buy cost are real.',cta:'Go to Workshop',tab:'ALCHEMY_LAB'},
 {title:'Find a buyer',text:'Review a real offer, then confirm a sale. Cancelling spends nothing.',cta:'Go to Trade',tab:'DAY_DESK'},
 {title:'Send the expedition',text:'Check the known loadout, then run the scheduled raid. Outcomes are not guaranteed.',cta:'Go to Expedition',tab:'EXPEDITION_MAP'},
 {title:'Read what happened',text:'Open the completed report. See why your customers succeeded or failed.',cta:'Go to History',tab:'HISTORY'}] as const;
export function TutorialGuide({guide,navigate,skip,resume,reset,currentTab}:{guide:Guide;navigate:(t:WorkspaceTab)=>void;skip:()=>void;resume:()=>void;reset:()=>void;currentTab:WorkspaceTab}) {
 const step=stages[Math.min(guide.step,3)];
 return <section aria-label="First shift guide" className="rounded-xl border border-amber-700 bg-amber-950/25 p-4 space-y-2" style={{fontSize:'1rem'}}>
  <div className="flex items-center gap-3">{APPROVED_GAME_ART['guide-merchant']&&<img src={APPROVED_GAME_ART['guide-merchant'].src} alt="Your merchant guide" className="w-12 h-12 rounded-lg bg-[#f0e5c5] shrink-0"/>}<h2 className="font-semibold text-amber-200">{guide.status==='complete'?'First shift complete':guide.status==='skipped'?'Guide paused':`First shift · ${guide.step+1} of 4: ${step.title}`}</h2></div>
  {guide.status==='active'&&<><p className="text-slate-200">{step.text}</p>{currentTab!==step.tab&&<button className={primary} onClick={()=>navigate(step.tab)}>{step.cta}</button>}<button className={button+' ml-2'} onClick={skip}>Skip guide</button></>}
  {guide.status==='skipped'&&<><p className="text-slate-300">Play freely. Resume whenever you want.</p><button className={button} onClick={resume}>Resume guide</button></>}
  {guide.status==='complete'&&<p className="text-slate-200">A batch, a buyer, a real raid and its report. No tutorial bonus or hidden subsidy.</p>}
  <details><summary className="min-h-[48px] py-3 cursor-pointer text-slate-300">Guide controls</summary><button className={button} onClick={reset}>Reset tutorial only</button><p className="text-sm text-slate-400">Campaign, cash, stock and reports are not reset.</p></details>
 </section>;
}
export function OpeningHub({state,master,party,navigate,guide}:{state:GameSaveState;master:DungeonMaster;party:AdventuringParty;navigate:(t:WorkspaceTab)=>void;guide:Guide}) {
 return <section aria-label="Shop hub" className="space-y-4" style={{fontSize:'1rem'}}>
  <div className="rounded-xl border border-amber-800 bg-[#191b20] p-4 space-y-3"><EntityArt id="scene-shop" label="Your shop" scene/>
   <h1 className="text-2xl font-serif text-amber-200">Your shop. Their next move.</h1><p>Day {state.day} · {state.gold}g cash{state.debt?` · ${state.debt}g debt`:''}</p>
   {guide.status!=='active'&&<button className={primary} onClick={()=>navigate('DAY_DESK')}>Open the trade counter</button>}
  </div>
  <div className="grid grid-cols-2 gap-3">{[{id:master.id,name:master.name,role:'Lair owner',budget:master.budget},{id:party.id,name:party.name,role:'Raiders',budget:party.budget}].map(c=><article key={c.id} className="p-3 border border-slate-700 rounded-xl bg-slate-900 space-y-2 min-w-0"><EntityArt id={c.id} label={c.name}/><p className="text-amber-300 text-sm">{c.role}</p><h2 className="font-semibold break-words">{c.name}</h2><p className="text-sm text-slate-300">Budget {c.budget}g</p></article>)}</div>
  <PartyPortraits party={party}/><p className="text-slate-400 text-sm">Sell to either side. Your choices change what happens next.</p>
 </section>;
}
export function QuickWorkshop({state,onBrew,emphasise=true}:{state:GameSaveState;onBrew:(p:CraftedProduct,c:number,ids:string[],units:number)=>void;emphasise?:boolean}) {
 const b=starterBrew(state);
 return <section aria-label="Starter workbench" className="p-4 rounded-xl border border-emerald-800 bg-emerald-950/20 space-y-3" style={{fontSize:'1rem'}}>
  <h1 className="font-serif text-2xl text-emerald-200">Workshop</h1><div className="flex gap-3 items-center"><div className="w-20 shrink-0"><EntityArt id="prod_antidote_unstabilised" label="Starter antidote"/></div><div><h2 className="font-semibold">Starter antidote</h2><p className="text-slate-300">Brew {b.units} units. Spot ingredients: {b.cost}g.</p></div></div>
  <p className="text-sm text-amber-200">Vulnerable to sulphur fog. A starting recipe, not a guaranteed solution.</p>
  <button className={emphasise?primary:button} disabled={!b.available} onClick={()=>{if(b.available)onBrew(b.product,b.cost,b.ids,b.units);}}>Brew starter batch — {b.cost}g</button>
  {!b.available&&<p role="status">{b.unlocked?`Need ${b.cost}g; you have ${state.gold}g. Sell existing stock or choose another recipe. No free ingredients are granted.`:'Recipe ingredients are not available in this region. Use custom brewing or trade existing stock.'}</p>}
  <details><summary className="min-h-[48px] py-3 cursor-pointer">Ingredients &amp; costs</summary><ul>{b.reagents.map(r=><li key={r.id}>{r.name}: {state.reagentInventory[r.id]??0} owned · {r.baseCost}g if missing</li>)}</ul></details>
 </section>;
}
type Sell=(kind:'MASTER'|'HERO',id:string,p:CraftedProduct,m:number,w:boolean,e:boolean,s:boolean)=>void;
export function QuickTrade({state,master,party,onSell}:{state:GameSaveState;master:DungeonMaster;party:AdventuringParty;onSell:Sell}) {
 const [kind,setKind]=useState<'MASTER'|'HERO'>('HERO'),[selected,setSelected]=useState(''),[pending,setPending]=useState(false);
 const buyer=kind==='HERO'?party:master,products=state.products.filter(p=>p.stock>0&&(p.targetAudience===kind||p.targetAudience==='BOTH'));
 const product=products.find(p=>p.id===selected)??products[0],terms=state.tradeTerms??{priceMultiplier:1,warrantyBacked:false,exclusiveDeal:false,secretProvenance:false};
 const quote=product&&computeQuotation(product,buyer,kind,{...terms,day:state.day,seed:state.seed,unlockedSkills:state.skills.filter(s=>s.unlocked).map(s=>s.effectKey)});
 useEffect(()=>setPending(false),[state,kind,selected]);
 return <section aria-label="Trade counter" className="p-4 rounded-xl border border-sky-800 bg-sky-950/20 space-y-3" style={{fontSize:'1rem'}}>
  <h1 className="font-serif text-2xl text-sky-200">Trade</h1><div className="flex flex-wrap gap-2"><button className={button} aria-pressed={kind==='HERO'} onClick={()=>setKind('HERO')}>Raiders</button><button className={button} aria-pressed={kind==='MASTER'} onClick={()=>setKind('MASTER')}>Lair owner</button></div>
  <div className="flex gap-3 items-center"><div className="w-20 shrink-0"><EntityArt id={buyer.id} label={buyer.name}/></div><div><h2 className="font-semibold">{buyer.name}</h2><p className="text-slate-300">Budget {buyer.budget}g</p></div></div>
  <label className="block">Stock to offer<select aria-label="Counter product" value={product?.id??''} onChange={e=>setSelected(e.target.value)} className="block w-full min-h-[48px] bg-slate-900 border border-slate-600 rounded p-2 mt-2">{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.stock} in stock</option>)}</select></label>
  {product&&<><ProductArtwork product={product}/><p>{product.name}</p></>}
  <p className="text-slate-300">{quote?.acceptable?`Current offer: ${quote.unitPrice}g for one unit.`:quote?.refusalReason??'No suitable stock. Make a batch or visit the full ledger.'}</p>
  <button className={primary} disabled={!quote?.acceptable} onClick={()=>setPending(true)}>Review sale</button>
  {pending&&product&&quote?.acceptable&&<section aria-label="Confirm counter sale" className="border border-amber-500 rounded p-3 space-y-3"><p>Charge {buyer.name} {quote.unitPrice}g for one {product.name}?</p><p className="text-sm">Uses the current real contract terms. Warranties and exclusivity can have later consequences.</p><div className="flex flex-wrap gap-2"><button className={primary} onClick={()=>{setPending(false);onSell(kind,buyer.id,product,terms.priceMultiplier,terms.warrantyBacked,terms.exclusiveDeal,terms.secretProvenance);}}>Confirm sale — {quote.unitPrice}g</button><button className={button} onClick={()=>setPending(false)}>Cancel sale</button></div></section>}
 </section>;
}
export function CompactHistory({state,onInspect}:{state:GameSaveState;onInspect:(id:string)=>void}) {
 return <section aria-label="Expedition history" className="space-y-3" style={{fontSize:'1rem'}}><h1 className="text-2xl font-serif text-violet-200">History</h1>{!state.expeditionReports.length&&<p>No completed expedition yet. Reports appear only after a real raid.</p>}
  {state.expeditionReports.map(r=><article key={r.id} className="rounded-xl bg-slate-900 border border-violet-800 p-4 space-y-2"><EntityArt id={r.partyId} label={r.partyName}/><h2 className="font-semibold">Day {r.day} · {r.partyName} vs {r.masterName}</h2><p>Actual loot: {r.totalLooted}g · {r.region}</p><details onToggle={e=>{if(e.currentTarget.open)onInspect(r.id);}}><summary className="min-h-[48px] py-3 cursor-pointer">Inspect completed report — Day {r.day}</summary><p className="text-amber-200">{r.summaryHeadline}</p>{r.rooms.map(room=><div key={room.roomIndex} className="border-t border-slate-700 py-3"><AssetToken id={ROOM_ART_BY_NAME[room.roomName]??room.hazardId} label={room.roomName} size={240}/><AssetToken id={room.hazardId} label={room.hazardName}/><h3 className="font-semibold">Room {room.roomIndex} · {room.hazardName}</h3><p>{room.causalExplanation}</p></div>)}<p className="text-sm text-slate-400 break-all">Recorded report: {r.id}</p></details></article>)}
 </section>;
}
