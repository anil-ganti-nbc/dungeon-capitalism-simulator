import { GameSaveState } from '../types/game';
import { hashString } from '../utils/prng';
export function canClaimSoloCatalyst(s: GameSaveState): boolean {
  return !s.expertUnlocked && s.unlockedRegions.includes('blackspire') && s.customBrewsCount >= 2 && s.customTrapsCount >= 2
    && s.contractHistory.filter(c=>c.buyerType==='MASTER').length >= 2
    && s.contractHistory.filter(c=>c.buyerType==='HERO').length >= 2;
}
export function claimSoloCatalyst(s: GameSaveState): GameSaveState {
  if (!canClaimSoloCatalyst(s)) return s;
  const hash=hashString(`SOLO_VESPERA_CATALYST_DAY_${s.day}_${s.seed}`).slice(0,8).toUpperCase();
  return { ...s, expertUnlocked:true, activeRegion:'vault',
    unlockedRegions:s.unlockedRegions.includes('vault') ? s.unlockedRegions : [...s.unlockedRegions,'vault'],
    catalystLedger:[{id:`cat_solo_d${s.day}_${hash.toLowerCase()}`,senderName:'Arch-Architect Vespera (Blackspire Panopticon)',
      senderType:'SOLO_DM_COURIER',provenanceHash:hash,dayReceived:s.day,
      commissionNote:'Solo Offline Commission Fulfilled in Blackspire: Demonstrated custom offensive trap engineering, stabilised alchemy, and bilateral double-sales.',
      isAuthentic:true},...s.catalystLedger] };
}
