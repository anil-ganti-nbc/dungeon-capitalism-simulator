import type { GameSaveState } from '../types/game';
import { REAGENTS_CATALOG } from '../data/catalog';
import { synthesizeAlchemyProduct } from '../engine/simulation';
export function starterBrew(s:GameSaveState) {
  const ids=['reg_base_02','reg_act_01','reg_car_02','reg_stb_01','reg_cat_01'];
  const reagents=ids.map(id=>REAGENTS_CATALOG.find(r=>r.id===id)!);
  const cost=reagents.reduce((n,r)=>n+((s.reagentInventory[r.id]??0)>0?0:r.baseCost),0);
  const unlocked=reagents.every(r=>s.unlockedRegions.includes(r.regionOrigin));
  return {ids,reagents,cost,available:unlocked&&s.gold>=cost,unlocked,
    product:synthesizeAlchemyProduct(reagents as [typeof reagents[number],typeof reagents[number],typeof reagents[number],typeof reagents[number],typeof reagents[number]],'Standard Basilisk Antidote (Unstabilised)',s.skills.some(k=>k.effectKey==='chelate_boost'&&k.unlocked)),
    units:s.skills.some(k=>k.effectKey==='bonus_brew_yield'&&k.unlocked)?3:2};
}
