import { getDailyMarketContext } from './marketContext';
import {
  GameSaveState,
  CraftedProduct,
  DungeonMaster,
  AdventuringParty,
  SaleContract,
  RegionId,
  ExpeditionReport,
  CounterClass
} from '../types/game';
import { DeterministicRNG } from '../utils/prng';

export interface QuotationOptions {
  priceMultiplier?: number; // e.g. 1.04, 1.22
  warrantyBacked: boolean;
  exclusiveDeal: boolean;
  secretProvenance: boolean;
  day: number;
  seed: number;
  unlockedSkills?: string[];
  rulesVersion?: string;
}

export interface QuotationResult {
  unitPrice: number;
  baseMultiplier: number;
  trustFactor: number;
  qualityPremium: number;
  boycotting: boolean;
  canAfford: boolean;
  acceptable: boolean;
  refusalReason?: string;
  expectedTrustDelta: number;
}

export interface TransactionResult {
  success: boolean;
  reason?: string;
  contract?: SaleContract;
  unitPrice?: number;
  nextState?: GameSaveState;
}

/**
 * Deterministic customer boycott evaluation.
 * Triggered when client trust < 50; chance scales with severity of trust deficit.
 */
export function evaluateCustomerBoycott(
  buyer: DungeonMaster | AdventuringParty,
  day: number,
  seed: number
): boolean {
  if (buyer.trust >= 50) return false;
  // Deterministic seed incorporating buyer id
  let hashVal = 0;
  for (let i = 0; i < buyer.id.length; i++) {
    hashVal = (hashVal * 31 + buyer.id.charCodeAt(i)) >>> 0;
  }
  const rng = new DeterministicRNG(seed + day * 104729 + hashVal);
  const boycottChance = (54 - buyer.trust) * 0.016;
  return rng.next() < boycottChance;
}

/**
 * Authoritative shared commercial quotation calculation.
 * Used by BOTH player UI (TradeDesk) and headless campaign runner.
 */
export function computeQuotation(
  product: CraftedProduct,
  buyer: DungeonMaster | AdventuringParty,
  buyerType: 'MASTER' | 'HERO',
  options: QuotationOptions
): QuotationResult {
  const priceMultiplier = options.priceMultiplier ?? 1.0;
  const marketSentiment = getDailyMarketContext(options.seed, options.day, buyer.region, options.rulesVersion).factor;
  const skills = options.unlockedSkills ?? [];
  const hasSkill = (k: string) => skills.includes(k);

  // 1. Base Multiplier from price setting, contract options, and market sentiment
  const hasBilateral = hasSkill('bilateral_margin');
  const baseMultiplier =
    priceMultiplier *
    (options.warrantyBacked ? 1.12 : 1.0) *
    (options.exclusiveDeal ? 1.22 : 1.0) *
    (hasBilateral ? 1.1 : 1.0) *
    marketSentiment;

  // 2. Buyer Trust Factor:
  // For trust < 55: scales down (at trust 48: 0.78 + 48*0.003 = 0.924)
  // For trust >= 85: loyalty premium (1.08 for master, 1.09 for hero)
  let trustFactor = 1.0;
  if (buyer.trust < 55) {
    trustFactor = 0.78 + buyer.trust * 0.003;
  } else if (buyer.trust >= 85) {
    trustFactor = buyerType === 'HERO' ? 1.09 : 1.08;
  }

  // 3. Product Quality Premium (High-purity / High-stability R&D)
  let qualityPremium = 1.0;
  if (buyerType === 'HERO' && product.stability >= 75) {
    if (hasSkill('paradox_alchemy')) {
      qualityPremium = 1.24;
    } else if (hasSkill('chelate_boost')) {
      qualityPremium = 1.15;
    }
  }

  // 4. Secret provenance cost offset (-35g for removing maker's marks)
  const secretOffset = options.secretProvenance ? 35 : 0;

  // Final Unit Price: floor clamped to 25g
  const rawQuotedPrice = Math.round(
    product.suggestedPrice * baseMultiplier * trustFactor * qualityPremium
  );
  const unitPrice = Math.max(25, rawQuotedPrice - secretOffset);

  // 5. Customer Acceptance & Refusal Rules
  const boycotting = evaluateCustomerBoycott(buyer, options.day, options.seed);
  const canAfford = buyer.budget >= unitPrice;

  let acceptable = true;
  let refusalReason: string | undefined;

  const capacity = buyerType === 'MASTER' ? 3 : 4;
  const loadout = buyerType === 'MASTER' ? (buyer as DungeonMaster).installedHazards : (buyer as AdventuringParty).equippedProducts;
  if (loadout.length >= capacity) {
    acceptable = false;
    refusalReason = `Loadout full (${loadout.length}/${capacity}). Use existing supplies before purchasing another unit.`;
  } else if (boycotting) {
    acceptable = false;
    refusalReason = `Client boycott in effect due to low trust (${buyer.trust}/100).`;
  } else if (!canAfford) {
    acceptable = false;
    refusalReason = `Insufficient budget: Client has ${buyer.budget}g but item costs ${unitPrice}g.`;
  } else if (buyer.trust < 50 && priceMultiplier > 1.15) {
    // Low-trust clients refuse price-gouging markups
    acceptable = false;
    refusalReason = `Client refuses price gouging (${Math.round((priceMultiplier - 1) * 100)}% markup) while trust is below 50.`;
  }

  // 6. Expected Trust Delta on transaction
  let expectedTrustDelta = 0;
  if (priceMultiplier >= 1.2) {
    expectedTrustDelta -= 3;
  } else if (options.warrantyBacked) {
    expectedTrustDelta += buyerType === 'HERO' ? 6 : 5;
  } else {
    expectedTrustDelta += buyerType === 'HERO' ? 3 : 2;
  }

  return {
    unitPrice,
    baseMultiplier,
    trustFactor,
    qualityPremium,
    boycotting,
    canAfford,
    acceptable,
    refusalReason,
    expectedTrustDelta
  };
}

/**
 * Authoritative shared trade transaction execution.
 * Mutates state immutably and returns updated GameSaveState.
 */
export function executeCommercialTransaction(
  prevState: GameSaveState,
  buyerType: 'MASTER' | 'HERO',
  buyerId: string,
  product: CraftedProduct,
  terms: {
    priceMultiplier?: number;
    warrantyBacked: boolean;
    exclusiveDeal: boolean;
    secretProvenance: boolean;
    rulesVersion?: string;
  }
): TransactionResult {
  if (!terms || !Number.isFinite(terms.priceMultiplier ?? 1) || (terms.priceMultiplier ?? 1) <= 0
      || !(['warrantyBacked','exclusiveDeal','secretProvenance'] as const).every(k => typeof terms[k] === 'boolean')) {
    return { success:false, reason:'Invalid commercial terms.' };
  }
  // 1. Strict validation: check current authoritative product stock (Gate 3)
  if (!product || !product.id || !Array.isArray(prevState.products)) {
    return { success: false, reason: 'Invalid or missing product reference.' };
  }
  const currentProduct = prevState.products.find((p) => p && p.id === product.id);
  if (!currentProduct || !Number.isSafeInteger(currentProduct.stock) || currentProduct.stock <= 0) {
    return { success: false, reason: 'Product is out of stock or reference is stale.' };
  }

  // 2. Strict validation: target audience match
  if (buyerType === 'MASTER' && currentProduct.targetAudience === 'HERO') {
    return { success: false, reason: 'Product is formulated exclusively for hero parties.' };
  }
  if (buyerType === 'HERO' && currentProduct.targetAudience === 'MASTER') {
    return { success: false, reason: 'Trap hazard is engineered exclusively for dungeon masters.' };
  }

  // 3. Strict validation: buyer existence & regional accessibility
  const buyer =
    buyerType === 'MASTER'
      ? prevState.masters.find((m) => m.id === buyerId)
      : prevState.parties.find((p) => p.id === buyerId);

  if (!buyer) {
    return { success: false, reason: 'Buyer not found in region.' };
  }

  if (
    buyer.region !== prevState.activeRegion
  ) {
    return { success: false, reason: 'Trading is regional: select the buyer’s unlocked region before selling.' };
  }

  const loadout = buyerType === 'MASTER'
    ? (buyer as DungeonMaster).installedHazards : (buyer as AdventuringParty).equippedProducts;
  const capacity = buyerType === 'MASTER' ? 3 : 4;
  if (loadout.length >= capacity) return { success: false,
    reason: `Loadout full (${loadout.length}/${capacity}). Use existing supplies before purchasing another unit.` };
  if (!prevState.unlockedRegions.includes(prevState.activeRegion)) {
    return { success: false, reason: 'Active trading region is locked.' };
  }

  const skills = prevState.skills.filter((s) => s.unlocked).map((s) => s.effectKey);
  const quotation = computeQuotation(currentProduct, buyer, buyerType, {
    priceMultiplier: terms.priceMultiplier,
    warrantyBacked: terms.warrantyBacked,
    exclusiveDeal: terms.exclusiveDeal,
    secretProvenance: terms.secretProvenance,
    day: prevState.day,
    seed: prevState.seed,
    unlockedSkills: skills,
    rulesVersion: prevState.rulesVersion
  });

  if (!quotation.acceptable) {
    return { success: false, reason: quotation.refusalReason };
  }

  const unitPrice = quotation.unitPrice;
  const contractSeq = prevState.contractHistory.length + 1;
  const newContract: SaleContract = {
    marketContext: getDailyMarketContext(prevState.seed, prevState.day, prevState.activeRegion, prevState.rulesVersion),
    id: `cnt_d${prevState.day}_n${contractSeq}_${currentProduct.id}`,
    day: prevState.day,
    buyerType,
    buyerId,
    buyerName: buyer.name,
    productId: currentProduct.id,
    productName: currentProduct.name,
    quantity: 1,
    unitPrice,
    totalRevenue: unitPrice,
    unitCost: currentProduct.productionCost,
    warrantyBacked: terms.warrantyBacked,
    exclusiveDeal: terms.exclusiveDeal,
    secretProvenance: terms.secretProvenance,
    creditFinanced: false
  };

  // Decrement product stock
  const nextProducts = prevState.products.map((p) =>
    p.id === currentProduct.id ? { ...p, stock: Math.max(0, p.stock - 1) } : p
  );

  // Update Master: installed hazards (max 3), budget, trust, memory
  const nextMasters = prevState.masters.map((m) => {
    if (buyerType === 'MASTER' && m.id === buyerId) {
      return {
        ...m,
        budget: Math.max(0, m.budget - unitPrice),
        trust: Math.max(10, Math.min(100, m.trust + quotation.expectedTrustDelta)),
        installedHazards: [currentProduct.id, ...m.installedHazards],
        installedResetCharges: [currentProduct.recipeComponents.includes('part_rst_09') ? 1 : 0, ...(m.installedResetCharges ?? m.installedHazards.map(() => 0))],
        memoryLog: [
          ...m.memoryLog,
          `Day ${prevState.day}: Purchased ${currentProduct.name} [#${currentProduct.formulaSignature || currentProduct.id.slice(-6)}] for ${unitPrice}g.`
        ]
      };
    }
    return m;
  });

  // Update Party: potion charges are finite individual consumable doses (Gate 3)
  // Two purchased potions represent two distinct charges, NOT collapsed into 1 unique ID
  const nextParties = prevState.parties.map((p) => {
    if (buyerType === 'HERO' && p.id === buyerId) {
      return {
        ...p,
        budget: Math.max(0, p.budget - unitPrice),
        trust: Math.max(10, Math.min(100, p.trust + quotation.expectedTrustDelta)),
        equippedProducts: [currentProduct.id, ...p.equippedProducts],
        memoryLog: [
          ...p.memoryLog,
          `Day ${prevState.day}: Purchased ${currentProduct.name} [#${currentProduct.formulaSignature || currentProduct.id.slice(-6)}] for ${unitPrice}g.`
        ]
      };
    }
    return p;
  });

  const nextState: GameSaveState = {
    ...prevState,
    phase: 'TRADE',
    scheduledMatchups: { ...prevState.scheduledMatchups, [prevState.activeRegion]: {
      ...prevState.scheduledMatchups[prevState.activeRegion],
      ...(buyerType === 'MASTER' ? { masterId:buyerId } : { partyId:buyerId }) } },
    gold: prevState.gold + unitPrice,
    products: nextProducts,
    masters: nextMasters,
    parties: nextParties,
    contractsToday: [...prevState.contractsToday, newContract],
    contractHistory: [...prevState.contractHistory, newContract]
  };

  return {
    success: true,
    contract: newContract,
    unitPrice,
    nextState
  };
}

/**
 * Finite consumables and wear resolution (Fixes Codex A03).
 * Potions are single-use consumable charges: consuming a loadout item reduces the loadout,
 * including down to 0 charges ([]). Traps wear out without auto-reset / temporal rewind.
 */
export function resolveConsumableWear(
  party: AdventuringParty,
  master: DungeonMaster,
  warrantyClaimsTriggered: number,
  day: number,
  skills: string[]
): {
  nextEquipped: string[];
  nextInstalled: string[];
  nextResetCharges: number[];
  rewindsSpent: number;
} {
  const autoResetSkill = skills.includes('auto_reset_cam');

  // Party potion loadout: consumable charges deplete after each expedition
  // If party has potions equipped, at least 1 potion is consumed on the delve.
  // When down to 1 potion, it consumes down to []!
  let nextEquipped = [...party.equippedProducts];
  if (nextEquipped.length > 0) {
    // Consume the oldest equipped potion
    nextEquipped = nextEquipped.slice(1);
  }

  // Master trap wear: non-resetting traps exhaust their armed tension / durability
  // unless auto-reset skill or temporal rewind loop is armed
  let nextInstalled = [...master.installedHazards];
  let nextResetCharges = [...(master.installedResetCharges ?? master.installedHazards.map(() => 0))];
  let rewindsSpent = 0;
  if (!autoResetSkill) {
    // Every 3 delves (or if warranty claim / breakdown occurred), oldest trap exhausts tension
    if (day % 3 === 0 || warrantyClaimsTriggered > 0) {
      if (nextInstalled.length > 0) {
        if ((nextResetCharges[0] ?? 0) > 0) {
          nextResetCharges[0] -= 1;
          rewindsSpent = 1;
        } else {
          nextInstalled = nextInstalled.slice(1);
          nextResetCharges = nextResetCharges.slice(1);
        }
      }
    }
  }

  return {
    nextEquipped,
    nextInstalled,
    nextResetCharges,
    rewindsSpent
  };
}

/** One post-raid client transition for UI and campaigns. Apply breach once, then warranty loss. */
export function resolvePostRaidClients(
  state: Pick<GameSaveState, 'masters' | 'parties' | 'skills'>,
  report: ExpeditionReport
): Pick<GameSaveState, 'masters' | 'parties'> {
  const master = state.masters.find(m => m.id === report.masterId);
  const party = state.parties.find(p => p.id === report.partyId);
  const lastRoom = report.rooms.at(-1);
  if (!master || !party || !lastRoom) throw new Error('Cannot settle an expedition without its clients and rooms.');
  const skills = state.skills.filter(s => s.unlocked).map(s => s.effectKey);
  const wear = resolveConsumableWear(party, master, report.warrantyClaimsTriggered, report.day, skills);
  const breachTrust = (trust: number) => report.exclusivityBreachDetected ? Math.max(15, trust - 8) : trust;
  return {
    masters: state.masters.map(m => m.id === master.id ? {
      ...m,
      trust: breachTrust(m.trust),
      budget: Math.max(450, m.budget + report.masterTreasuryDelta + 320),
      installedHazards: wear.nextInstalled,
      installedResetCharges: wear.nextResetCharges,
      memoryLog: [...m.memoryLog, `Day ${report.day} After-Action: ${lastRoom.learnedByMaster}`],
      desiredTrait: report.doubleSaleDemandCreated[0] || m.desiredTrait
    } : { ...m, budget: m.budget + 180 }),
    parties: state.parties.map(p => p.id === party.id ? {
      ...p,
      trust: Math.max(15, breachTrust(p.trust) - report.warrantyClaimsTriggered * 12),
      budget: Math.max(420, p.budget + report.partyBudgetDelta + 290),
      equippedProducts: wear.nextEquipped,
      memoryLog: [...p.memoryLog, `Day ${report.day} After-Action: ${lastRoom.learnedByHeroes}`],
      desiredCounter: report.doubleSaleDemandCreated.find(d => d.includes(p.name)) || p.desiredCounter
    } : { ...p, budget: p.budget + 160 })
  };
}

/**
 * Regional Exclusivity Breach and Warranty Settlement.
 */
export function computeRegionalFinesAndClaims(
  regionId: RegionId,
  exclusivityBreachDetected: boolean,
  warrantyClaimsTriggered: number,
  skills: string[]
): {
  breachFine: number;
  warrantyPayout: number;
  totalClaimsAndFines: number;
} {
  const breachFineByRegion: Record<RegionId, number> = {
    cellar: 160,
    warrens: 240,
    blackspire: 380,
    vault: 520
  };

  const hasWarrantyShield = skills.includes('warranty_shield');
  const claimBase = 165 * (hasWarrantyShield ? 0.6 : 1.0);

  const breachFine = exclusivityBreachDetected ? breachFineByRegion[regionId] : 0;
  const warrantyPayout = Math.round(warrantyClaimsTriggered * claimBase);

  return {
    breachFine,
    warrantyPayout,
    totalClaimsAndFines: breachFine + warrantyPayout
  };
}
