import { GameSaveState, RegionId, ScheduledMatchup } from '../types/game';
import { REAGENTS_CATALOG, TRAP_PARTS_CATALOG, INITIAL_PRODUCTS, SKILL_TREE_NODES } from '../data/catalog';
import { INITIAL_MASTERS, INITIAL_PARTIES, INITIAL_RIVALS, INITIAL_INTEL_FEED } from '../data/world';
import { SIM_RULES_VERSION, computeCanonicalFormulaSignature } from './simulation';

function buildInitialScheduledMatchups(): Record<RegionId, ScheduledMatchup> {
  const result = {} as Record<RegionId, ScheduledMatchup>;
  (['cellar', 'warrens', 'blackspire', 'vault'] as const).forEach((reg) => {
    const m = INITIAL_MASTERS.find((x) => x.region === reg) || INITIAL_MASTERS[0];
    const p = INITIAL_PARTIES.find((x) => x.region === reg) || INITIAL_PARTIES[0];
    result[reg] = { masterId: m.id, partyId: p.id };
  });
  return result;
}

export function createInitialSaveState(seed: number = 20260001): GameSaveState {
  const initReagents: Record<string, number> = {};
  REAGENTS_CATALOG.slice(0, 20).forEach((r) => {
    initReagents[r.id] = 3;
  });
  const initParts: Record<string, number> = {};
  TRAP_PARTS_CATALOG.slice(0, 20).forEach((p) => {
    initParts[p.id] = 2;
  });

  return {
    version: '2.1.0-sim002b',
    seed,
    day: 1,
    phase: 'MORNING',
    activeRegion: 'cellar',
    unlockedRegions: ['cellar'],
    gold: 1850,
    debt: 0,
    skillPoints: 2,
    customBrewsCount: 0,
    customTrapsCount: 0,
    scheduledMatchups: buildInitialScheduledMatchups(),
    reagentInventory: initReagents,
    partInventory: initParts,
    products: INITIAL_PRODUCTS.map((p) => {
      const kind = p.category === 'TRAP_MASTER' || p.category === 'HAZARD_MONSTER' ? 'trp' : 'alc';
      return {
        ...p,
        formulaSignature: computeCanonicalFormulaSignature(kind, p.recipeComponents, [], SIM_RULES_VERSION),
        rulesVersion: SIM_RULES_VERSION,
        appliedSkills: [],
        counterClasses: [...p.counterClasses],
        recipeComponents: [...p.recipeComponents],
        reactionNotes: [...p.reactionNotes]
      };
    }),
    masters: INITIAL_MASTERS.map((m) => ({
      ...m,
      knownHeroCounters: [...m.knownHeroCounters],
      installedHazards: [...m.installedHazards],
      installedResetCharges: m.installedHazards.map(() => 0),
      memoryLog: [...m.memoryLog]
    })),
    parties: INITIAL_PARTIES.map((p) => ({
      ...p,
      members: p.members.map((mem) => ({ ...mem })),
      observedTraps: [...p.observedTraps],
      equippedProducts: [...p.equippedProducts],
      memoryLog: [...p.memoryLog]
    })),
    rivals: INITIAL_RIVALS.map((r) => ({ ...r })),
    contractsToday: [],
    contractHistory: [],
    intelFeed: INITIAL_INTEL_FEED.map((i) => ({ ...i })),
    expeditionReports: [],
    financialLedger: [],
    catalystLedger: [],
    expertUnlocked: false,
    skills: SKILL_TREE_NODES.map((s) => ({ ...s })),
    basiliskChainStage: 1,
    blackspireResolution: 'NONE',
    rulesVersion: SIM_RULES_VERSION,
    tradeTerms: { priceMultiplier: 1, warrantyBacked: false, exclusiveDeal: false, secretProvenance: false },
    insolvencyEvents: 0
  };
}

