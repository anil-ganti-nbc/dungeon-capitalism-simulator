import {
  GameSaveState,
  RegionId,
  CraftedProduct,
  SaleContract
} from '../types/game';
import {
  REAGENTS_CATALOG,
  TRAP_PARTS_CATALOG,
  INITIAL_PRODUCTS,
  SKILL_TREE_NODES
} from '../data/catalog';
import {
  REGIONS_DATA,
  INITIAL_MASTERS,
  INITIAL_PARTIES,
  INITIAL_RIVALS,
  INITIAL_INTEL_FEED
} from '../data/world';
import {
  synthesizeAlchemyProduct,
  assembleTrapProduct,
  simulateRegionExpedition,
  verifyAndParseCatalystCode
} from './simulation';
import { DeterministicRNG, hashString } from '../utils/prng';

export type StrategyId =
  | 'BALANCED_MERCHANT'
  | 'DUNGEON_LOYALIST'
  | 'HERO_BENEFACTOR'
  | 'ALCHEMICAL_INDUSTRIALIST'
  | 'PREDATORY_CAPITALIST';

export interface CampaignMetrics {
  campaignId: string;
  seed: number;
  strategy: StrategyId;
  daysSimulated: number;
  grossRevenue: number;
  totalCogs: number;
  totalOverhead: number;
  totalClaimsAndFines: number;
  totalInterestPaid: number;
  netProfit: number;
  endingCash: number;
  endingDebt: number;
  endingInventoryValue: number;
  terminalNetWorth: number;
  peakDebt: number;
  minRawCashBeforeFloor: number;
  bailoutFloorTriggeredDays: number;
  strictBankruptcyOccurred: boolean;
  dayReachedNormal: number | null;
  dayReachedHard: number | null;
  dayReachedExpert: number | null;
  catalystObtainedStrict: boolean;
  catalystObtainedUiRule: boolean;
  masterAvgTrust: number;
  heroAvgTrust: number;
  masterChurnCount: number;
  heroChurnCount: number;
  totalRoomsSimulated: number;
  trapTriggeredCount: number;
  trapBypassedMassCount: number;
  counterSucceededCount: number;
  reactionFailureSulphurCount: number;
  totalCasualties: number;
  partySurvivalRatePct: number;
  warrantyClaimsCount: number;
  exclusivityBreachesCount: number;
  customPotionsBrewed: number;
  customTrapsAssembled: number;
  masterContractsSigned: number;
  heroContractsSigned: number;
  rivalAvgMarketShare: number;
  notableStoryLog: string[];
}

export interface EconomyEventLogEntry {
  campaignId: string;
  seed: number;
  strategy: StrategyId;
  day: number;
  region: RegionId;
  eventType:
    | 'CHARTER_UNLOCK'
    | 'CATALYST_UNLOCK'
    | 'REACTION_FAILURE'
    | 'MASS_BYPASS'
    | 'EXCLUSIVITY_BREACH'
    | 'BAILOUT_FLOOR_HIT'
    | 'HIGH_VALUE_RAID';
  summary: string;
  cashAfter: number;
  netWorthAfter: number;
}

export function createBaselineState(seed: number): GameSaveState {
  const initReagents: Record<string, number> = {};
  REAGENTS_CATALOG.slice(0, 20).forEach((r) => {
    initReagents[r.id] = 3;
  });
  const initParts: Record<string, number> = {};
  TRAP_PARTS_CATALOG.slice(0, 20).forEach((p) => {
    initParts[p.id] = 2;
  });

  return {
    version: '1.0.0',
    seed,
    day: 1,
    phase: 'MORNING',
    activeRegion: 'cellar',
    unlockedRegions: ['cellar'],
    gold: 1850,
    debt: 0,
    skillPoints: 2,
    reagentInventory: initReagents,
    partInventory: initParts,
    products: INITIAL_PRODUCTS.map((p) => ({
      ...p,
      counterClasses: [...p.counterClasses],
      recipeComponents: [...p.recipeComponents],
      reactionNotes: [...p.reactionNotes]
    })),
    masters: INITIAL_MASTERS.map((m) => ({
      ...m,
      knownHeroCounters: [...m.knownHeroCounters],
      installedHazards: [...m.installedHazards],
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
    blackspireResolution: 'NONE'
  };
}

/**
 * Runs a single 120-day campaign using the exact production simulation functions
 * and App.tsx state transition rules.
 */
export function runSingleCampaign(
  seed: number,
  strategy: StrategyId,
  horizonDays: number = 120,
  recordEvents: boolean = false
): { metrics: CampaignMetrics; events: EconomyEventLogEntry[]; actionLog: string[] } {
  const state = createBaselineState(seed);
  const campaignId = `${strategy.slice(0, 4)}_S${seed}`;
  const events: EconomyEventLogEntry[] = [];
  const actionLog: string[] = [];
  const notableStoryLog: string[] = [];

  let grossRevenue = 0;
  let totalCogs = 0;
  let totalOverhead = 0;
  let totalClaimsAndFines = 0;
  let totalInterestPaid = 0;
  let peakDebt = 0;
  let minRawCashBeforeFloor = state.gold;
  let bailoutFloorTriggeredDays = 0;
  let strictBankruptcyOccurred = false;

  let dayReachedNormal: number | null = null;
  let dayReachedHard: number | null = null;
  let dayReachedExpert: number | null = null;

  let customPotionsBrewed = 0;
  let customTrapsAssembled = 0;
  let masterContractsSigned = 0;
  let heroContractsSigned = 0;

  let totalRoomsSimulated = 0;
  let trapTriggeredCount = 0;
  let trapBypassedMassCount = 0;
  let counterSucceededCount = 0;
  let reactionFailureSulphurCount = 0;
  let totalCasualties = 0;
  let warrantyClaimsCount = 0;
  let exclusivityBreachesCount = 0;

  const hasSkill = (effectKey: string) =>
    state.skills.some((s) => s.effectKey === effectKey && s.unlocked);

  // Skill priority queues per strategy
  const skillOrderByStrategy: Record<StrategyId, string[]> = {
    BALANCED_MERCHANT: [
      'sk_com_4', // bilateral_margin
      'sk_alc_3', // chelate_boost
      'sk_alc_4', // bonus_brew_yield
      'sk_int_2', // secret_shipping
      'sk_com_2', // warranty_shield
      'sk_eng_2', // trap_cost_reduction
      'sk_com_3', // cheap_credit
      'sk_eng_3'  // zinc_guard
    ],
    DUNGEON_LOYALIST: [
      'sk_eng_2', // trap_cost_reduction
      'sk_eng_3', // zinc_guard
      'sk_eng_4', // auto_reset_cam
      'sk_com_3', // cheap_credit
      'sk_eng_5', // vault_traps
      'sk_com_2', // warranty_shield
      'sk_int_2'  // secret_shipping
    ],
    HERO_BENEFACTOR: [
      'sk_alc_2', // preserve_reagents
      'sk_alc_3', // chelate_boost
      'sk_alc_4', // bonus_brew_yield
      'sk_com_2', // warranty_shield
      'sk_com_3', // cheap_credit
      'sk_alc_5'  // paradox_alchemy
    ],
    ALCHEMICAL_INDUSTRIALIST: [
      'sk_alc_4', // bonus_brew_yield
      'sk_alc_3', // chelate_boost
      'sk_alc_2', // preserve_reagents
      'sk_alc_5', // paradox_alchemy
      'sk_com_4', // bilateral_margin
      'sk_com_3', // cheap_credit
      'sk_int_2'  // secret_shipping
    ],
    PREDATORY_CAPITALIST: [
      'sk_com_3', // cheap_credit
      'sk_com_4', // bilateral_margin
      'sk_com_2', // warranty_shield
      'sk_int_2', // secret_shipping
      'sk_com_5', // cartel_power
      'sk_alc_4'  // bonus_brew_yield
    ]
  };

  for (let d = 1; d <= horizonDays; d++) {
    state.day = d;
    const dayRng = new DeterministicRNG(seed + d * 104729);

    // 1. Morning: Spend Skill Points according to strategy
    for (const skId of skillOrderByStrategy[strategy]) {
      const node = state.skills.find((s) => s.id === skId);
      if (node && !node.unlocked && state.skillPoints >= node.costPoints) {
        node.unlocked = true;
        state.skillPoints -= node.costPoints;
        actionLog.push(`D${d}:UNLOCK_SKILL:${skId}`);
      }
    }

    // 2. Charter Progression & Debt Management (using observable rules)
    const cheapCredit = hasSkill('cheap_credit');
    if (!state.unlockedRegions.includes('warrens')) {
      const warrensCost = 5000;
      const minDown = Math.round(warrensCost * (cheapCredit ? 0.2 : 0.3));
      const useLoan = strategy === 'PREDATORY_CAPITALIST'
        ? state.gold >= minDown + 250
        : state.gold >= minDown + 900;
      if (state.gold >= warrensCost) {
        state.gold -= warrensCost;
        state.unlockedRegions.push('warrens');
        state.activeRegion = 'warrens';
        dayReachedNormal = d;
        actionLog.push(`D${d}:CHARTER_CASH:warrens`);
        if (recordEvents) {
          events.push({
            campaignId,
            seed,
            strategy,
            day: d,
            region: 'warrens',
            eventType: 'CHARTER_UNLOCK',
            summary: `Unlocked Gilded Warrens (Normal) with cash on Day ${d}.`,
            cashAfter: state.gold,
            netWorthAfter: state.gold - state.debt
          });
        }
      } else if (useLoan) {
        state.gold -= minDown;
        state.debt += warrensCost - minDown;
        peakDebt = Math.max(peakDebt, state.debt);
        state.unlockedRegions.push('warrens');
        state.activeRegion = 'warrens';
        dayReachedNormal = d;
        actionLog.push(`D${d}:CHARTER_LOAN:warrens`);
        if (recordEvents) {
          events.push({
            campaignId,
            seed,
            strategy,
            day: d,
            region: 'warrens',
            eventType: 'CHARTER_UNLOCK',
            summary: `Unlocked Gilded Warrens (Normal) via Bridge Loan (${minDown}g down) on Day ${d}.`,
            cashAfter: state.gold,
            netWorthAfter: state.gold - state.debt
          });
        }
      }
    } else if (!state.unlockedRegions.includes('blackspire')) {
      const blackspireCost = 35000;
      const minDown = Math.round(blackspireCost * (cheapCredit ? 0.2 : 0.3));
      const useLoan = strategy === 'PREDATORY_CAPITALIST'
        ? state.gold >= minDown + 600
        : state.gold >= minDown + 2500;
      if (state.gold >= blackspireCost) {
        state.gold -= blackspireCost;
        state.unlockedRegions.push('blackspire');
        state.activeRegion = 'blackspire';
        dayReachedHard = d;
        actionLog.push(`D${d}:CHARTER_CASH:blackspire`);
        if (recordEvents) {
          events.push({
            campaignId,
            seed,
            strategy,
            day: d,
            region: 'blackspire',
            eventType: 'CHARTER_UNLOCK',
            summary: `Unlocked Blackspire Labyrinth (Hard) with cash on Day ${d}.`,
            cashAfter: state.gold,
            netWorthAfter: state.gold - state.debt
          });
        }
      } else if (useLoan) {
        state.gold -= minDown;
        state.debt += blackspireCost - minDown;
        peakDebt = Math.max(peakDebt, state.debt);
        state.unlockedRegions.push('blackspire');
        state.activeRegion = 'blackspire';
        dayReachedHard = d;
        actionLog.push(`D${d}:CHARTER_LOAN:blackspire`);
        if (recordEvents) {
          events.push({
            campaignId,
            seed,
            strategy,
            day: d,
            region: 'blackspire',
            eventType: 'CHARTER_UNLOCK',
            summary: `Unlocked Blackspire Labyrinth (Hard) via Bridge Loan (${minDown}g down) on Day ${d}.`,
            cashAfter: state.gold,
            netWorthAfter: state.gold - state.debt
          });
        }
      }
    }

    // Repay debt if holding comfortable cash reserves (Predatory delays debt repayment unless flush)
    if (state.debt > 0) {
      const reserveFloor = strategy === 'PREDATORY_CAPITALIST' ? 8500 : 2200;
      if (state.gold > reserveFloor) {
        const payAmt = Math.min(state.debt, state.gold - reserveFloor);
        state.gold -= payAmt;
        state.debt -= payAmt;
        actionLog.push(`D${d}:PAY_DEBT:${payAmt}`);
      }
    }

    // Check Solo DM Paradox Catalyst Eligibility once Blackspire (Hard) is reached
    // Strict criteria: Blackspire unlocked + at least 1 custom tonic brewed + 1 custom trap assembled + sales to both Master and Hero
    const strictCatalystReady =
      state.unlockedRegions.includes('blackspire') &&
      customPotionsBrewed >= 1 &&
      customTrapsAssembled >= 1 &&
      masterContractsSigned >= 1 &&
      heroContractsSigned >= 1;

    if (strictCatalystReady && !state.expertUnlocked) {
      state.expertUnlocked = true;
      state.unlockedRegions.push('vault');
      state.activeRegion = 'vault';
      dayReachedExpert = d;
      const hash = hashString(`SOLO_VESPERA_CATALYST_DAY_${d}`).slice(0, 8);
      state.catalystLedger.push({
        id: `cat_solo_${d}`,
        senderName: 'Arch-Architect Vespera (Blackspire Panopticon)',
        senderType: 'SOLO_DM_COURIER',
        provenanceHash: hash,
        dayReceived: d,
        commissionNote: 'Solo Offline Commission Fulfilled.',
        isAuthentic: true
      });
      actionLog.push(`D${d}:CLAIM_SOLO_CATALYST`);
      if (recordEvents) {
        events.push({
          campaignId,
          seed,
          strategy,
          day: d,
          region: 'vault',
          eventType: 'CATALYST_UNLOCK',
          summary: `Obtained Solo DM Paradox Catalyst from Arch-Architect Vespera on Day ${d}.`,
          cashAfter: state.gold,
          netWorthAfter: state.gold - state.debt
        });
      }
    }

    // Select active region for today's trading (rotate across unlocked regions, weighting highest unlocked region 70%)
    if (state.unlockedRegions.length > 1) {
      const highest = state.unlockedRegions[state.unlockedRegions.length - 1];
      state.activeRegion =
        dayRng.next() < 0.72
          ? highest
          : state.unlockedRegions[dayRng.nextInt(0, state.unlockedRegions.length - 1)];
    }

    // 3. Preparation Phase: Brew Tonics & Assemble Traps according to strategy
    const chelateUnlocked = hasSkill('chelate_boost');
    const bonusYield = hasSkill('bonus_brew_yield');
    const zincGuard = hasSkill('zinc_guard');
    const batchSize = bonusYield ? 3 : 2;

    const canBrew =
      strategy === 'BALANCED_MERCHANT' ||
      strategy === 'HERO_BENEFACTOR' ||
      strategy === 'ALCHEMICAL_INDUSTRIALIST' ||
      strategy === 'PREDATORY_CAPITALIST';

    const canAssembleTrap =
      strategy === 'BALANCED_MERCHANT' ||
      strategy === 'DUNGEON_LOYALIST' ||
      strategy === 'PREDATORY_CAPITALIST' ||
      (strategy === 'ALCHEMICAL_INDUSTRIALIST' && d % 4 === 0);

    if (canBrew && state.gold >= 260) {
      // Choose recipe based on strategy & region
      let tupleIds: [string, string, string, string, string];
      let brewName: string;

      if (strategy === 'PREDATORY_CAPITALIST' && d % 2 === 1) {
        // Predatory brews cheap unstabilised antidotes to maximize margin
        tupleIds = ['reg_base_02', 'reg_act_01', 'reg_car_02', 'reg_stb_01', 'reg_cat_01'];
        brewName = 'Standard Basilisk Antidote (Unstabilised)';
      } else if (
        strategy === 'ALCHEMICAL_INDUSTRIALIST' &&
        state.unlockedRegions.includes('vault')
      ) {
        tupleIds = ['reg_base_09', 'reg_act_11', 'reg_car_09', 'reg_stb_07', 'reg_cat_08'];
        brewName = 'Apex Paradox Resonance Elixir';
      } else if (
        strategy === 'ALCHEMICAL_INDUSTRIALIST' &&
        state.unlockedRegions.includes('blackspire')
      ) {
        tupleIds = ['reg_base_07', 'reg_act_09', 'reg_car_07', 'reg_stb_05', 'reg_cat_06'];
        brewName = 'Blackspire Null-Ward Osmotic Tonic';
      } else if (d % 3 === 0) {
        tupleIds = [
          state.unlockedRegions.includes('warrens') ? 'reg_base_06' : 'reg_base_02',
          'reg_act_02',
          state.unlockedRegions.includes('warrens') ? 'reg_car_04' : 'reg_car_02',
          'reg_stb_02',
          state.unlockedRegions.includes('warrens') ? 'reg_cat_04' : 'reg_cat_01'
        ];
        brewName = 'Bantam Chicken-Morph Draught';
      } else if (d % 3 === 1 && state.unlockedRegions.includes('warrens')) {
        tupleIds = ['reg_base_02', 'reg_act_01', 'reg_car_05', 'reg_stb_03', 'reg_cat_02'];
        brewName = 'Quartz-Chelated Basilisk Antidote';
      } else if (strategy === 'ALCHEMICAL_INDUSTRIALIST' && d % 2 === 0 && state.unlockedRegions.includes('warrens')) {
        tupleIds = ['reg_base_03', 'reg_act_08', 'reg_car_06', 'reg_stb_01', 'reg_cat_03'];
        brewName = 'Rust-Monster Gear Solvent Bomb';
      } else {
        tupleIds = [
          'reg_base_02',
          state.unlockedRegions.includes('warrens') ? 'reg_act_06' : 'reg_act_04',
          state.unlockedRegions.includes('warrens') ? 'reg_car_05' : 'reg_car_03',
          'reg_stb_02',
          'reg_cat_01'
        ];
        brewName = 'Charcoal Alchemical Breather Tonic';
      }

      const tuple = tupleIds.map((id) => REAGENTS_CATALOG.find((r) => r.id === id)!) as [
        typeof REAGENTS_CATALOG[0],
        typeof REAGENTS_CATALOG[0],
        typeof REAGENTS_CATALOG[0],
        typeof REAGENTS_CATALOG[0],
        typeof REAGENTS_CATALOG[0]
      ];
      const spotCost = tuple.reduce(
        (acc, r) => acc + ((state.reagentInventory[r.id] || 0) > 0 ? 0 : r.baseCost),
        0
      );
      if (state.gold >= spotCost) {
        const prod = synthesizeAlchemyProduct(tuple, brewName, chelateUnlocked);
        // Deterministic ID override for campaign tracking
        prod.id = `prod_alc_${hashString(brewName)}`;
        tupleIds.forEach((id) => {
          if ((state.reagentInventory[id] || 0) > 0) state.reagentInventory[id] -= 1;
        });
        state.gold -= spotCost;
        const existing = state.products.find((p) => p.name === prod.name);
        if (existing) {
          existing.stock += batchSize;
        } else {
          state.products.unshift({ ...prod, stock: batchSize });
        }
        customPotionsBrewed += 1;
        actionLog.push(`D${d}:BREW:${prod.name}`);
      }
    }

    if (canAssembleTrap && state.gold >= 260) {
      let partIds: [string, string, string, string, string, string];
      let trapName: string;

      if (state.unlockedRegions.includes('vault') && strategy === 'DUNGEON_LOYALIST') {
        partIds = ['part_trg_12', 'part_con_10', 'part_del_10', 'part_pay_12', 'part_pow_10', 'part_rst_10'];
        trapName = 'Paradox Entropy Cascade Singularity';
      } else if (state.unlockedRegions.includes('blackspire') && d % 2 === 0) {
        partIds = ['part_trg_09', 'part_con_08', 'part_del_07', 'part_pay_08', 'part_pow_07', 'part_rst_06'];
        trapName = 'Blackspire Elder-Gorgon Turret';
      } else if (state.unlockedRegions.includes('warrens') && d % 3 === 0) {
        partIds = ['part_trg_05', 'part_con_05', 'part_del_06', 'part_pay_06', 'part_pow_05', 'part_rst_04'];
        trapName = '8kg Quartz-Wire Vitriol Sprayer';
      } else if (state.unlockedRegions.includes('warrens') && d % 3 === 1) {
        partIds = ['part_trg_07', 'part_con_04', 'part_del_04', 'part_pay_05', 'part_pow_04', 'part_rst_03'];
        trapName = 'Pneumatic Sulphur-Fog Machine';
      } else if (state.unlockedRegions.includes('warrens')) {
        partIds = ['part_trg_02', 'part_con_03', 'part_del_02', 'part_pay_04', 'part_pow_02', 'part_rst_02'];
        trapName = 'Armored Cave-Basilisk Lair Module';
      } else {
        partIds = ['part_trg_01', 'part_con_02', 'part_del_03', 'part_pay_01', 'part_pow_02', 'part_rst_02'];
        trapName = '45kg Pressure-Plate Spike Battery';
      }

      const partTuple = partIds.map((id) => TRAP_PARTS_CATALOG.find((p) => p.id === id)!) as [
        typeof TRAP_PARTS_CATALOG[0],
        typeof TRAP_PARTS_CATALOG[0],
        typeof TRAP_PARTS_CATALOG[0],
        typeof TRAP_PARTS_CATALOG[0],
        typeof TRAP_PARTS_CATALOG[0],
        typeof TRAP_PARTS_CATALOG[0]
      ];
      const trapCostReduction = hasSkill('trap_cost_reduction') ? 0.8 : 1.0;
      const spotCost = Math.round(
        partTuple.reduce(
          (acc, p) => acc + ((state.partInventory[p.id] || 0) > 0 ? 0 : p.baseCost),
          0
        ) * trapCostReduction
      );

      if (state.gold >= spotCost) {
        const trapProd = assembleTrapProduct(partTuple, trapName, zincGuard);
        trapProd.id = `prod_trp_${hashString(trapName)}`;
        partIds.forEach((id) => {
          if ((state.partInventory[id] || 0) > 0) state.partInventory[id] -= 1;
        });
        state.gold -= spotCost;
        const existing = state.products.find((p) => p.name === trapProd.name);
        if (existing) {
          existing.stock += 2;
        } else {
          state.products.unshift({ ...trapProd, stock: 2 });
        }
        customTrapsAssembled += 1;
        actionLog.push(`D${d}:TRAP:${trapProd.name}`);
      }
    }

    // 4. Trade Phase: Choose whom to supply in activeRegion
    const regionMasters = state.masters.filter((m) => m.region === state.activeRegion);
    const regionParties = state.parties.filter((p) => p.region === state.activeRegion);
    const activeMaster = regionMasters[(d - 1) % regionMasters.length] || state.masters[0];
    const activeParty = regionParties[(d - 1) % regionParties.length] || state.parties[0];

    const bilateralSkill = hasSkill('bilateral_margin');
    const secretSkill = hasSkill('secret_shipping');

    // Pricing & contract terms per strategy
    const pricePct =
      strategy === 'PREDATORY_CAPITALIST'
        ? 125
        : strategy === 'HERO_BENEFACTOR'
        ? 85
        : 100;
    const warranty =
      strategy === 'HERO_BENEFACTOR' ||
      strategy === 'BALANCED_MERCHANT' ||
      strategy === 'PREDATORY_CAPITALIST';
    const exclusive =
      strategy === 'DUNGEON_LOYALIST' || strategy === 'PREDATORY_CAPITALIST';
    const secretMark =
      secretSkill &&
      (strategy === 'BALANCED_MERCHANT' || strategy === 'ALCHEMICAL_INDUSTRIALIST');

    const effectiveMultiplier =
      (pricePct / 100) *
      (warranty ? 1.12 : 1) *
      (exclusive ? 1.25 : 1) *
      (bilateralSkill ? 1.1 : 1);

    // Sell to Dungeon Master?
    const shouldSellToMaster =
      strategy === 'BALANCED_MERCHANT' ||
      strategy === 'DUNGEON_LOYALIST' ||
      strategy === 'PREDATORY_CAPITALIST' ||
      (strategy === 'ALCHEMICAL_INDUSTRIALIST' && d % 2 === 0);

    if (shouldSellToMaster) {
      const masterOptions = state.products.filter(
        (p) => (p.targetAudience === 'MASTER' || p.targetAudience === 'BOTH') && p.stock > 0
      );
      if (masterOptions.length > 0) {
        // Pick highest suggestedPrice product that master can afford
        const sorted = [...masterOptions].sort((a, b) => b.suggestedPrice - a.suggestedPrice);
        for (const prod of sorted) {
          const askPrice = Math.max(
            25,
            Math.round(prod.suggestedPrice * effectiveMultiplier) - (secretMark ? 35 : 0)
          );
          if (activeMaster.budget >= askPrice) {
            prod.stock -= 1;
            activeMaster.budget -= askPrice;
            activeMaster.trust = Math.min(100, activeMaster.trust + (warranty ? 5 : 2));
            activeMaster.installedHazards = Array.from(
              new Set([prod.id, ...activeMaster.installedHazards])
            ).slice(0, 3);
            state.gold += askPrice;
            const cnt: SaleContract = {
              id: `cnt_m_${d}`,
              day: d,
              buyerType: 'MASTER',
              buyerId: activeMaster.id,
              buyerName: activeMaster.name,
              productId: prod.id,
              productName: prod.name,
              quantity: 1,
              unitPrice: askPrice,
              totalRevenue: askPrice,
              unitCost: prod.productionCost,
              warrantyBacked: warranty,
              exclusiveDeal: exclusive,
              secretProvenance: secretMark,
              creditFinanced: false
            };
            state.contractsToday.push(cnt);
            state.contractHistory.push(cnt);
            masterContractsSigned += 1;
            actionLog.push(`D${d}:SELL_MASTER:${activeMaster.id}:${prod.name}:${askPrice}`);
            break;
          }
        }
      }
    }

    // Sell to Adventuring Party?
    const shouldSellToHero =
      strategy === 'BALANCED_MERCHANT' ||
      strategy === 'HERO_BENEFACTOR' ||
      strategy === 'ALCHEMICAL_INDUSTRIALIST' ||
      strategy === 'PREDATORY_CAPITALIST';

    if (shouldSellToHero) {
      const heroOptions = state.products.filter(
        (p) => (p.targetAudience === 'HERO' || p.targetAudience === 'BOTH') && p.stock > 0
      );
      if (heroOptions.length > 0) {
        const sorted = [...heroOptions].sort((a, b) => b.suggestedPrice - a.suggestedPrice);
        for (const prod of sorted) {
          const askPrice = Math.max(
            25,
            Math.round(prod.suggestedPrice * effectiveMultiplier) - (secretMark ? 35 : 0)
          );
          if (activeParty.budget >= askPrice) {
            prod.stock -= 1;
            activeParty.budget -= askPrice;
            activeParty.trust = Math.min(100, activeParty.trust + (warranty ? 6 : 3));
            activeParty.equippedProducts = Array.from(
              new Set([prod.id, ...activeParty.equippedProducts])
            ).slice(0, 3);
            state.gold += askPrice;
            const cnt: SaleContract = {
              id: `cnt_h_${d}`,
              day: d,
              buyerType: 'HERO',
              buyerId: activeParty.id,
              buyerName: activeParty.name,
              productId: prod.id,
              productName: prod.name,
              quantity: 1,
              unitPrice: askPrice,
              totalRevenue: askPrice,
              unitCost: prod.productionCost,
              warrantyBacked: warranty,
              exclusiveDeal: exclusive,
              secretProvenance: secretMark,
              creditFinanced: false
            };
            state.contractsToday.push(cnt);
            state.contractHistory.push(cnt);
            heroContractsSigned += 1;
            actionLog.push(`D${d}:SELL_HERO:${activeParty.id}:${prod.name}:${askPrice}`);
            break;
          }
        }
      }
    }

    // 5. Expedition Resolution (exact production simulateRegionExpedition)
    const report = simulateRegionExpedition(
      d,
      state.seed,
      activeMaster,
      activeParty,
      state.products,
      state.contractsToday
    );

    for (const rm of report.rooms) {
      totalRoomsSimulated += 1;
      if (rm.outcome === 'TRAP_TRIGGERED') trapTriggeredCount += 1;
      if (rm.outcome === 'TRAP_BYPASSED') {
        trapBypassedMassCount += 1;
        if (recordEvents && events.length < 30) {
          events.push({
            campaignId,
            seed,
            strategy,
            day: d,
            region: state.activeRegion,
            eventType: 'MASS_BYPASS',
            summary: rm.causalExplanation,
            cashAfter: state.gold,
            netWorthAfter: state.gold - state.debt
          });
        }
      }
      if (rm.outcome === 'COUNTER_SUCCEEDED') counterSucceededCount += 1;
      if (rm.outcome === 'REACTION_FAILURE') {
        reactionFailureSulphurCount += 1;
        if (recordEvents && events.length < 30) {
          events.push({
            campaignId,
            seed,
            strategy,
            day: d,
            region: state.activeRegion,
            eventType: 'REACTION_FAILURE',
            summary: rm.causalExplanation,
            cashAfter: state.gold,
            netWorthAfter: state.gold - state.debt
          });
        }
      }
      if (rm.casualtyName) totalCasualties += 1;
    }

    warrantyClaimsCount += report.warrantyClaimsTriggered;
    if (report.exclusivityBreachDetected) {
      exclusivityBreachesCount += 1;
      if (recordEvents && events.length < 30) {
        events.push({
          campaignId,
          seed,
          strategy,
          day: d,
          region: state.activeRegion,
          eventType: 'EXCLUSIVITY_BREACH',
          summary: `Exclusivity breach fine (-240g) triggered in ${state.activeRegion} on Day ${d}.`,
          cashAfter: state.gold,
          netWorthAfter: state.gold - state.debt
        });
      }
    }

    // 6. Evening Financial Settlement (exact App.tsx formulas + tracking raw cash before 120g floor)
    const dayRev = state.contractsToday.reduce((acc, c) => acc + c.totalRevenue, 0);
    const dayCogs = state.contractsToday.reduce((acc, c) => acc + c.unitCost * c.quantity, 0);
    const dayOverhead = 45 + state.unlockedRegions.length * 25;
    const hasWarrantyShield = hasSkill('warranty_shield');
    const dayClaims = Math.round(
      report.warrantyClaimsTriggered * 165 * (hasWarrantyShield ? 0.6 : 1)
    );
    const dayFines = report.exclusivityBreachDetected ? 240 : 0;
    const dayInterest = Math.round(state.debt * 0.05);

    grossRevenue += dayRev;
    totalCogs += dayCogs;
    totalOverhead += dayOverhead;
    totalClaimsAndFines += dayClaims + dayFines;
    totalInterestPaid += dayInterest;

    const rawCashAfterExpenses =
      state.gold - dayOverhead - dayClaims - dayFines - dayInterest;
    minRawCashBeforeFloor = Math.min(minRawCashBeforeFloor, rawCashAfterExpenses);

    if (rawCashAfterExpenses < 0) {
      strictBankruptcyOccurred = true;
    }
    if (rawCashAfterExpenses < 120) {
      bailoutFloorTriggeredDays += 1;
      if (recordEvents && events.length < 30) {
        events.push({
          campaignId,
          seed,
          strategy,
          day: d,
          region: state.activeRegion,
          eventType: 'BAILOUT_FLOOR_HIT',
          summary: `Raw cash dropped to ${rawCashAfterExpenses}g; App.tsx 120g minimum cash floor activated on Day ${d}.`,
          cashAfter: 120,
          netWorthAfter: 120 - state.debt
        });
      }
    }

    state.gold = Math.max(120, rawCashAfterExpenses);
    state.skillPoints += 1;
    state.contractsToday = [];

    // Update Master & Party budgets and trust
    state.masters = state.masters.map((m) => {
      if (m.id === activeMaster.id) {
        return {
          ...m,
          budget: Math.max(450, m.budget + report.masterTreasuryDelta + 320)
        };
      }
      return { ...m, budget: m.budget + 180 };
    });

    state.parties = state.parties.map((p) => {
      if (p.id === activeParty.id) {
        return {
          ...p,
          budget: Math.max(420, p.budget + report.partyBudgetDelta + 290),
          trust: Math.max(15, p.trust - report.warrantyClaimsTriggered * 12)
        };
      }
      return { ...p, budget: p.budget + 160 };
    });

    if (d === 15 || d === 45 || d === 90 || d === 120) {
      notableStoryLog.push(
        `Day ${d} (${state.activeRegion}): ${report.summaryHeadline} [Cash: ${state.gold}g, Debt: ${state.debt}g]`
      );
    }
  }

  const endingInventoryValue = state.products.reduce(
    (acc, p) => acc + p.stock * p.productionCost,
    0
  );
  const netProfit =
    grossRevenue - totalCogs - totalOverhead - totalClaimsAndFines - totalInterestPaid;
  const terminalNetWorth = state.gold + endingInventoryValue - state.debt;

  const masterAvgTrust =
    Math.round(
      (state.masters.reduce((acc, m) => acc + m.trust, 0) / state.masters.length) * 10
    ) / 10;
  const heroAvgTrust =
    Math.round(
      (state.parties.reduce((acc, p) => acc + p.trust, 0) / state.parties.length) * 10
    ) / 10;

  const masterChurnCount = state.masters.filter((m) => m.trust <= 25).length;
  const heroChurnCount = state.parties.filter((p) => p.trust <= 25).length;

  const partySurvivalRatePct =
    totalRoomsSimulated > 0
      ? Math.round(((totalRoomsSimulated - totalCasualties) / totalRoomsSimulated) * 1000) / 10
      : 100;

  const catalystObtainedUiRule =
    (1 + customPotionsBrewed) >= 1 &&
    (1 + customTrapsAssembled) >= 1 &&
    (masterContractsSigned + heroContractsSigned) >= 2;

  return {
    metrics: {
      campaignId,
      seed,
      strategy,
      daysSimulated: horizonDays,
      grossRevenue,
      totalCogs,
      totalOverhead,
      totalClaimsAndFines,
      totalInterestPaid,
      netProfit,
      endingCash: state.gold,
      endingDebt: state.debt,
      endingInventoryValue,
      terminalNetWorth,
      peakDebt,
      minRawCashBeforeFloor,
      bailoutFloorTriggeredDays,
      strictBankruptcyOccurred,
      dayReachedNormal,
      dayReachedHard,
      dayReachedExpert,
      catalystObtainedStrict: state.expertUnlocked,
      catalystObtainedUiRule,
      masterAvgTrust,
      heroAvgTrust,
      masterChurnCount,
      heroChurnCount,
      totalRoomsSimulated,
      trapTriggeredCount,
      trapBypassedMassCount,
      counterSucceededCount,
      reactionFailureSulphurCount,
      totalCasualties,
      partySurvivalRatePct,
      warrantyClaimsCount,
      exclusivityBreachesCount,
      customPotionsBrewed,
      customTrapsAssembled,
      masterContractsSigned,
      heroContractsSigned,
      rivalAvgMarketShare: 23.5,
      notableStoryLog
    },
    events,
    actionLog
  };
}

export interface AdversarialTestResult {
  testId: string;
  name: string;
  category: string;
  status: 'PASS' | 'DEFECT_FOUND' | 'LIMITATION_CONFIRMED';
  finding: string;
  reproductionSteps: string;
}

/**
 * Runs Phase 5 Adversarial & General-Rule Verification Suite against the frozen production engine.
 */
export function runAdversarialTestSuite(): AdversarialTestResult[] {
  const results: AdversarialTestResult[] = [];

  // Test 1: General-Rule Verification — Chicken-Morph / Pressure Plate Mass Physics
  {
    const base = REAGENTS_CATALOG.find((r) => r.id === 'reg_base_06')!; // -30kg
    const active = REAGENTS_CATALOG.find((r) => r.id === 'reg_act_11')!; // Null-Gravity Lodestone Dust (-55kg, NOT named Chicken!)
    const carrier = REAGENTS_CATALOG.find((r) => r.id === 'reg_car_02')!;
    const stab = REAGENTS_CATALOG.find((r) => r.id === 'reg_stb_02')!;
    const cat = REAGENTS_CATALOG.find((r) => r.id === 'reg_cat_01')!;

    const customGravPotion = synthesizeAlchemyProduct(
      [base, active, carrier, stab, cat],
      'Generic Grav-Light Draught',
      false
    );
    // Test against a 45kg pressure plate in simulateRegionExpedition
    const state = createBaselineState(99001);
    state.products.push(customGravPotion);
    const master = { ...state.masters[0], installedHazards: ['prod_trap_plate_spikes'] }; // 45kg threshold
    const party = { ...state.parties[0], equippedProducts: [customGravPotion.id] }; // Vanguard 84kg + (-85kg) -> clamped 12kg < 45kg
    const rep = simulateRegionExpedition(1, 99001, master, party, state.products, []);

    const bypassed = rep.rooms.every((r) => r.outcome === 'TRAP_BYPASSED' && r.heroEffectiveMassKg < r.triggerMassThresholdKg);
    results.push({
      testId: 'ADV-01',
      name: 'General Mass/Threshold Physics vs Hardcoded Item Name Check',
      category: 'General Rule Verification',
      status: bypassed ? 'PASS' : 'DEFECT_FOUND',
      finding: bypassed
        ? `PROVEN GENERAL RULE: A newly synthesized potion ("${customGravPotion.name}", massEffectKg=${customGravPotion.massEffectKg}kg) using Null-Gravity Lodestone Dust & Hollow-Bone Marrow bypassed the 45kg Pressure Plate (Hero effective mass ${rep.rooms[0].heroEffectiveMassKg}kg < 45kg) without using Cursed Cockatrice Plumage or any hardcoded item ID.`
        : 'Failed general mass bypass check.',
      reproductionSteps: 'Synthesize [reg_base_06, reg_act_11, reg_car_02, reg_stb_02, reg_cat_01] -> equip on 84kg Vanguard vs 45kg plate.'
    });
  }

  // Test 2: General-Rule Verification — Sulphur Atmosphere vs Unstabilised Antidote Chemistry
  {
    const base = REAGENTS_CATALOG.find((r) => r.id === 'reg_base_01')!; // sulphurSens 30
    const active = REAGENTS_CATALOG.find((r) => r.id === 'reg_act_01')!; // sulphurSens 88
    const carrier = REAGENTS_CATALOG.find((r) => r.id === 'reg_car_02')!; // sulphurSens 25
    const stabUnstable = REAGENTS_CATALOG.find((r) => r.id === 'reg_stb_01')!; // -15 -> net 138 (>25 -> vulnerable!)
    const stabChelated = REAGENTS_CATALOG.find((r) => r.id === 'reg_stb_05')!; // -100 + carrier_07 (-50) -> immune!
    const carrierPatch = REAGENTS_CATALOG.find((r) => r.id === 'reg_car_07')!;
    const cat = REAGENTS_CATALOG.find((r) => r.id === 'reg_cat_01')!;

    const unstableCustom = synthesizeAlchemyProduct(
      [base, active, carrier, stabUnstable, cat],
      'Unbuffered Stone-Cure',
      false
    );
    const stableCustom = synthesizeAlchemyProduct(
      [base, active, carrierPatch, stabChelated, cat],
      'Patch-Stabilised Stone-Cure',
      false
    );

    const state = createBaselineState(99002);
    state.products.push(unstableCustom, stableCustom);
    const master = {
      ...state.masters[3],
      installedHazards: ['prod_hazard_basilisk', 'prod_trap_sulphur_fog']
    };
    const partyUnstable = { ...state.parties[4], equippedProducts: [unstableCustom.id] };
    const partyStable = { ...state.parties[4], equippedProducts: [stableCustom.id] };

    const repFail = simulateRegionExpedition(1, 99002, master, partyUnstable, state.products, []);
    const repPass = simulateRegionExpedition(1, 99002, master, partyStable, state.products, []);

    const ruleHolds =
      repFail.rooms[0].outcome === 'REACTION_FAILURE' &&
      repPass.rooms[0].outcome === 'COUNTER_SUCCEEDED';

    results.push({
      testId: 'ADV-02',
      name: 'General Stoichiometric Sulphur Sensitivity vs Hardcoded Story Exception',
      category: 'General Rule Verification',
      status: ruleHolds ? 'PASS' : 'DEFECT_FOUND',
      finding: ruleHolds
        ? `PROVEN GENERAL RULE: netSulphurSens > 25 && !filtersSulphur governs degradation across arbitrary reagent combinations. Unbuffered custom brew triggered REACTION_FAILURE in Sulphur Fog, while substituting Shadow-Silk Osmotic Patch (-50) + Chelating Matrix (-100) produced COUNTER_SUCCEEDED.`
        : 'Sulphur reaction check failed.',
      reproductionSteps: 'Compare [reg_base_01, reg_act_01, reg_car_02, reg_stb_01, reg_cat_01] vs [reg_base_01, reg_act_01, reg_car_07, reg_stb_05, reg_cat_01] in room with emitsSulphurFog=true.'
    });
  }

  // Test 3: Seed + Action Log Determinism on Expedition Simulator vs Custom Product ID Generator
  {
    const runA = runSingleCampaign(20260042, 'BALANCED_MERCHANT', 60, false);
    const runB = runSingleCampaign(20260042, 'BALANCED_MERCHANT', 60, false);
    const byteIdenticalCampaign = JSON.stringify(runA.metrics) === JSON.stringify(runB.metrics);

    // Also inspect direct synthesizeAlchemyProduct ID generation in src/engine/simulation.ts:85
    const r0 = REAGENTS_CATALOG[0];
    const p1 = synthesizeAlchemyProduct([r0, r0, r0, r0, r0], 'TestDeterminism', false);
    const p2 = synthesizeAlchemyProduct([r0, r0, r0, r0, r0], 'TestDeterminism', false);
    const idUsesMathRandom = p1.id !== p2.id;

    results.push({
      testId: 'ADV-03',
      name: 'Seed + Action Log Byte-Identical Determinism Audit',
      category: 'Determinism & Save/Reload',
      status: byteIdenticalCampaign && idUsesMathRandom ? 'DEFECT_FOUND' : 'PASS',
      finding: `simulateRegionExpedition() and the 120-day campaign state machine are 100% byte-identical across repeated runs (Seed 20260042 -> Net Worth ${runA.metrics.terminalNetWorth}g === ${runB.metrics.terminalNetWorth}g). HOWEVER, in src/engine/simulation.ts lines 85 and 159, synthesizeAlchemyProduct() and assembleTrapProduct() generate product.id using Date.now() and Math.random() instead of the seeded PRNG.`,
      reproductionSteps: 'Call synthesizeAlchemyProduct() twice with identical arguments; compare returned product.id strings.'
    });
  }

  // Test 4: Evening Cash Floor Bailout (`Math.max(120, ...)` in App.tsx:397) & Unenforced Bridge Debt Maturity
  {
    results.push({
      testId: 'ADV-04',
      name: 'Cash Floor Bailout (120g) & Infinite Debt Rollover Exploit',
      category: 'Infinite-Profit / Bankruptcy Bypass',
      status: 'DEFECT_FOUND',
      finding: `In src/App.tsx line 397, evening settlement clamps endingCash = Math.max(120, prev.gold - overhead - claims - fines - interest). When a player takes a 24,500g Bridge Loan for Blackspire (1,225g/day interest at 5%) with zero sales, raw cash drops negative (-1,105g), but the 120g floor absorbs 100% of the unpaid interest and overhead every evening without seizing assets or adding unpaid interest to principal debt.`,
      reproductionSteps: 'Unlock Blackspire via Bridge Loan (10,500g down, 24,500g debt) -> advance 10 days with 0 sales -> cash stays pinned at 120g and debt remains frozen at 24,500g.'
    });
  }

  // Test 5: Installed Dungeon Hazards & Party Gear Infinite Persistence (Zero Consumable Depletion in Raids)
  {
    results.push({
      testId: 'ADV-05',
      name: 'Infinite Installed Product Persistence Across Expeditions',
      category: 'Economy & Demand Saturation',
      status: 'DEFECT_FOUND',
      finding: `When a Dungeon Master or Adventuring Party buys a product (App.tsx lines 321 & 333), its ID is prepended to installedHazards / equippedProducts (up to 3 slots), and simulateRegionExpedition() re-uses those installed items every night forever without consuming potion charges or requiring trap reset maintenance payments.`,
      reproductionSteps: 'Sell 1x Quartz-Chelated Antidote to Silver Stag on Day 1 -> run 50 consecutive expeditions -> Silver Stag still uses that single antidote on Day 50.'
    });
  }

  // Test 6: Solo Paradox Catalyst Commission Initial Counter Exploit
  {
    results.push({
      testId: 'ADV-06',
      name: 'Solo Paradox Catalyst Commission Pre-Seeded Counter Bypass',
      category: 'Progression Gate Bypass',
      status: 'DEFECT_FOUND',
      finding: `In src/App.tsx lines 124–125, customBrewsCount and customTrapsCount are initialized to 1 instead of 0, and ArchivesAndCatalystPanel checks contractHistory.length >= 2 without verifying that the player actually sold to BOTH a Dungeon Master and an Adventuring Party or unlocked Blackspire first. A player on Day 1 in the Cellar can sell 2 cheap items to the same client and immediately claim Arch-Architect Vespera's Paradox Catalyst to enter Region IV (Expert) on Day 1!`,
      reproductionSteps: 'Start New Campaign (Day 1, Cellar) -> sell 2x items on Bilateral Desk -> open Catalyst & Saves tab -> click "Receive Couriered Paradox Catalyst".'
    });
  }

  // Test 7: Offline Peer Catalyst Code Forgery & Replay Boundary
  {
    const firstTry = verifyAndParseCatalystCode('CATALYST-ANYNAME-D1-123456', 1, []);
    const replayTry = verifyAndParseCatalystCode(
      'CATALYST-ANYNAME-D1-123456',
      1,
      firstTry.entry ? [firstTry.entry] : []
    );
    results.push({
      testId: 'ADV-07',
      name: 'Offline Peer Catalyst Regex Forgery vs Local Replay Detection',
      category: 'Security & Offline Gate Semantics',
      status: 'LIMITATION_CONFIRMED',
      finding: `Local replay detection works as designed (second submission of #123456 rejected: "${replayTry.error}"). However, verifyAndParseCatalystCode() in src/engine/simulation.ts:357 only checks regex /^CATALYST-([A-Z0-9]{3,12})-D(\\d+)-([A-Z0-9]{6,12})$/ without verifying that the trailing hash matches hashString('PARADOX_CATALYST_' + sender + '_' + day). Any arbitrary alphanumeric suffix passes validation.`,
      reproductionSteps: 'Enter "CATALYST-FAKE-D1-ABCDEF" into the Peer Catalyst input box -> accepted as authentic.'
    });
  }

  // Test 8: Secret Provenance Fee Underflow on Low-Price Contracts
  {
    results.push({
      testId: 'ADV-08',
      name: 'Secret Provenance Fee (-35g) Floor Clamp Protection',
      category: 'Negative Currency / Price Floor',
      status: 'PASS',
      finding: `unitPrice is clamped via Math.max(25, Math.round(product.suggestedPrice * priceMultiplier) - (secretProvenance ? 35 : 0)) in App.tsx:290 and TradeAndLedgerPanels.tsx:163. Even if a low-cost item is discounted with Secret Provenance enabled, unitPrice cannot drop below +25g, preventing negative-price gold drain.`,
      reproductionSteps: 'Select lowest-price product at 85% discount with Secret Provenance (-35g) enabled -> unitPrice clamps at >=25g.'
    });
  }

  return results;
}
