import {
  Reagent,
  TrapPart,
  CraftedProduct,
  DungeonMaster,
  AdventuringParty,
  ExpeditionReport,
  ExpeditionRoomEvent,
  CounterClass,
  SaleContract,
  ParadoxCatalystEntry,
  RegionId,
  ScheduledMatchup
} from '../types/game';
import { DeterministicRNG, hashString } from '../utils/prng';

export const SIM_RULES_VERSION = 'v2.0-sim002';
export const AUTO_RESET_CAM_DC_BONUS = 12;

/** Shared workshop/live predicate; inversion sensors detect only featherweight intruders. */
export function isMassInversionPlate(hazard: CraftedProduct): boolean {
  return hazard.recipeComponents.includes('part_trg_12');
}
export function isTrapTriggeredByMass(hazard: CraftedProduct, massKg: number): boolean {
  return isMassInversionPlate(hazard) ? massKg < 25
    : hazard.triggerMassThresholdKg <= 0 || massKg >= hazard.triggerMassThresholdKg;
}

export function computeCanonicalFormulaSignature(
  kind: 'alc' | 'trp',
  componentIds: string[],
  appliedSkills: string[] = [],
  rulesVersion: string = SIM_RULES_VERSION
): string {
  const sortedSkills = [...appliedSkills].sort().join(',');
  const payload = `${kind}|${componentIds.join(',')}|${sortedSkills}|${rulesVersion}`;
  return hashString(payload).slice(0, 8).toUpperCase();
}

export function computeCanonicalProductId(
  kind: 'alc' | 'trp',
  componentIds: string[],
  appliedSkills: string[] = [],
  rulesVersion: string = SIM_RULES_VERSION
): string {
  const sig = computeCanonicalFormulaSignature(kind, componentIds, appliedSkills, rulesVersion);
  return `prod_${kind}_${sig.toLowerCase()}`;
}

/**
 * F02 Fix: Merges a newly crafted product into inventory strictly by canonical formulation identity
 * (complete component tuple + applicable skills + rulesVersion), NEVER by display name alone.
 * Distinct formulations retain distinct properties and IDs even when given identical names.
 */
export function mergeCraftedProductIntoInventory(
  existingProducts: CraftedProduct[],
  crafted: CraftedProduct,
  batchSize: number
): CraftedProduct[] {
  const craftedCompKey = crafted.recipeComponents.join(',');
  const craftedSkillsKey = [...(crafted.appliedSkills || [])].sort().join(',');
  const craftedRules = crafted.rulesVersion || SIM_RULES_VERSION;

  const existingIdx = existingProducts.findIndex((p) => {
    if (p.id === crafted.id) return true;
    const pCompKey = p.recipeComponents.join(',');
    const pSkillsKey = [...(p.appliedSkills || [])].sort().join(',');
    const pRules = p.rulesVersion || SIM_RULES_VERSION;
    return pCompKey === craftedCompKey && pSkillsKey === craftedSkillsKey && pRules === craftedRules && p.name === crafted.name;
  });

  if (existingIdx >= 0) {
    const next = [...existingProducts];
    next[existingIdx] = {
      ...crafted,
      id: next[existingIdx].id, // Preserve existing canonical/initial ID if exact same formula & name
      stock: next[existingIdx].stock + batchSize
    };
    return next;
  }

  return [{ ...crafted, stock: batchSize }, ...existingProducts];
}

/**
 * F01 Fix: Returns the explicitly scheduled Dungeon Master and Adventuring Party for a region,
 * plus the next rotation pairing so the player always knows who is participating before and after supplying.
 */
export function getRegionEncounterSchedule(
  region: RegionId,
  day: number,
  masters: DungeonMaster[],
  parties: AdventuringParty[],
  scheduledMatchups?: Record<RegionId, ScheduledMatchup>
): {
  currentMaster: DungeonMaster;
  currentParty: AdventuringParty;
  nextMaster: DungeonMaster;
  nextParty: AdventuringParty;
} {
  const regionMasters = masters.filter((m) => m.region === region);
  const regionParties = parties.filter((p) => p.region === region);

  const fallbackMaster = regionMasters[(day - 1) % Math.max(1, regionMasters.length)] || masters[0];
  const fallbackParty = regionParties[(day - 1) % Math.max(1, regionParties.length)] || parties[0];

  const scheduled = scheduledMatchups?.[region];
  const currentMaster =
    (scheduled && regionMasters.find((m) => m.id === scheduled.masterId)) || fallbackMaster;
  const currentParty =
    (scheduled && regionParties.find((p) => p.id === scheduled.partyId)) || fallbackParty;

  const currentMasterIdx = Math.max(0, regionMasters.findIndex((m) => m.id === currentMaster.id));
  const currentPartyIdx = Math.max(0, regionParties.findIndex((p) => p.id === currentParty.id));

  const nextMaster = regionMasters[(currentMasterIdx + 1) % Math.max(1, regionMasters.length)] || currentMaster;
  const nextParty = regionParties[(currentPartyIdx + 1) % Math.max(1, regionParties.length)] || currentParty;

  return { currentMaster, currentParty, nextMaster, nextParty };
}

export function synthesizeAlchemyProduct(
  reagents: [Reagent, Reagent, Reagent, Reagent, Reagent],
  customName: string,
  chelateSkillUnlocked: boolean
): CraftedProduct {
  const [base, active, carrier, stabiliser, catalyst] = reagents;
  const all = [base, active, carrier, stabiliser, catalyst];
  const componentIds = all.map((r) => r.id);
  const appliedSkills = chelateSkillUnlocked ? ['chelate_boost'] : [];

  const totalCost = Math.round(all.reduce((acc, r) => acc + r.baseCost, 0) * 0.85);
  const rawPotency = all.reduce((acc, r) => acc + r.traits.potency, 0);
  const rawStability = all.reduce((acc, r) => acc + r.traits.stability, 0) + (chelateSkillUnlocked ? 20 : 0);
  const rawVolatility = all.reduce((acc, r) => acc + r.traits.volatility, 0);
  const rawAcidity = all.reduce((acc, r) => acc + r.traits.acidity, 0);
  const rawToxicity = all.reduce((acc, r) => acc + r.traits.toxicity, 0);
  const rawAntiMagic = all.reduce((acc, r) => acc + r.traits.antiMagic, 0);
  const massEffectKg = all.reduce((acc, r) => acc + r.traits.massDeltaKg, 0);
  const netSulphurSens = all.reduce((acc, r) => acc + r.traits.sulphurSensitivity, 0) - (chelateSkillUnlocked ? 30 : 0);

  const potency = Math.max(15, Math.min(100, Math.round(rawPotency * 0.62)));
  const stability = Math.max(10, Math.min(100, Math.round(rawStability * 0.65 - rawVolatility * 0.15)));
  const reliability = Math.max(20, Math.min(99, Math.round((potency + stability) / 2)));

  const tags = new Set(all.flatMap((r) => r.tags));
  const curesPetrification =
    tags.has('antipetrify') || active.id === 'reg_act_01' || (rawPotency >= 150 && rawAntiMagic >= 60);
  const causesPetrification = tags.has('petrify_hazard') || active.id === 'reg_act_07';
  const emitsSulphurFog = tags.has('fog_generator') || (tags.has('sulphur') && tags.has('aerosol'));
  const filtersSulphur =
    tags.has('sulphur_filter') ||
    (tags.has('sulphur_shield') && stability >= 70) ||
    (stability >= 82 && netSulphurSens <= 0);
  const isTrapSolvent = tags.has('trap_solvent') || rawAcidity >= 75;

  const sulphurVulnerable = netSulphurSens > 25 && !filtersSulphur;

  const counterClasses: CounterClass[] = [];
  if (massEffectKg <= -25) counterClasses.push('bypass_mass');
  if (curesPetrification || tags.has('healing') || rawToxicity < 25) counterClasses.push('resistance');
  if (filtersSulphur) counterClasses.push('filtration');
  if (isTrapSolvent) counterClasses.push('sabotage');
  if (rawAntiMagic >= 50 || tags.has('anti_magic')) counterClasses.push('disruption');
  if (tags.has('stealth')) counterClasses.push('detection');

  const isOffensive = causesPetrification || emitsSulphurFog || (rawToxicity >= 55 && !isTrapSolvent);
  const category = isTrapSolvent
    ? 'DUAL_SOLVENT'
    : filtersSulphur
    ? 'COUNTER_GEAR'
    : isOffensive
    ? 'HAZARD_MONSTER'
    : 'TONIC_HERO';

  const targetAudience = isOffensive ? 'MASTER' : isTrapSolvent ? 'BOTH' : 'HERO';

  const reactionNotes: string[] = [];
  if (curesPetrification) {
    reactionNotes.push(`Reverses Basilisk/Gorgon petrification (Potency ${potency}).`);
    if (sulphurVulnerable) {
      reactionNotes.push('SULPHUR VULNERABILITY: Loses 55% potency in Sulphur Fog! Add Calcified Quartz or Chelating Stabiliser.');
    } else {
      reactionNotes.push('SULPHUR IMMUNE: Chelating matrix protects antidote inside Sulphur Fog.');
    }
  }
  if (massEffectKg <= -25) {
    reactionNotes.push(`Reduces drinker mass by ${Math.abs(massEffectKg)}kg — bypasses pressure plates above hero’s shrunken weight.`);
  }
  if (filtersSulphur) {
    reactionNotes.push('Scrubs ambient Sulphur Fog and protects companion potions from chemical degradation.');
  }
  if (isTrapSolvent) {
    reactionNotes.push(`Corrosive Acidity (${rawAcidity}) dissolves non-anodised mechanical trap springs.`);
  }
  if (emitsSulphurFog) {
    reactionNotes.push('Generates choking Sulphur Fog that blinds scouts and weakens unstabilised hero potions.');
  }
  if (reactionNotes.length === 0) {
    reactionNotes.push(`Balanced alchemical brew (Potency ${potency}, Stability ${stability}).`);
  }

  const formulaSignature = computeCanonicalFormulaSignature('alc', componentIds, appliedSkills, SIM_RULES_VERSION);
  const canonicalId = computeCanonicalProductId('alc', componentIds, appliedSkills, SIM_RULES_VERSION);

  const defaultName =
    customName.trim() ||
    `${stabiliser.name.split(' ')[0]} ${active.name.split(' ').slice(-2).join(' ')} ${carrier.name.split(' ').pop()}`;

  return {
    id: canonicalId,
    formulaSignature,
    rulesVersion: SIM_RULES_VERSION,
    name: defaultName,
    category,
    targetAudience,
    productionCost: totalCost,
    suggestedPrice: Math.round(totalCost * 2.05),
    stock: 2,
    potency,
    stability,
    reliability,
    massEffectKg,
    sulphurVulnerable,
    emitsSulphurFog,
    causesPetrification,
    curesPetrification,
    filtersSulphur,
    triggerMassThresholdKg: 0,
    detectionDC: 0,
    damageType: emitsSulphurFog ? 'sulphur_fog' : causesPetrification ? 'petrification' : isTrapSolvent ? 'acid' : 'none',
    counterClasses: counterClasses.length > 0 ? counterClasses : ['resistance'],
    recipeComponents: componentIds,
    appliedSkills,
    description: `Synthesized from ${base.name}, ${active.name}, ${carrier.name}, ${stabiliser.name}, and ${catalyst.name} [Formula #${formulaSignature}].`,
    reactionNotes
  };
}

export function assembleTrapProduct(
  parts: [TrapPart, TrapPart, TrapPart, TrapPart, TrapPart, TrapPart],
  customName: string,
  zincGuardUnlocked: boolean,
  autoResetCamUnlocked: boolean = false
): CraftedProduct {
  const [trigger, concealment, delivery, payload, power, reset] = parts;
  const all = [trigger, concealment, delivery, payload, power, reset];
  const componentIds = all.map((p) => p.id);
  const appliedSkills = [
    ...(zincGuardUnlocked ? ['zinc_guard'] : []),
    ...(autoResetCamUnlocked ? ['auto_reset_cam'] : [])
  ];

  const totalCost = Math.round(all.reduce((acc, p) => acc + p.baseCost, 0) * 0.85);
  const rawLethality = all.reduce((acc, p) => acc + p.lethality, 0);
  const rawDeterrence = all.reduce((acc, p) => acc + p.deterrence, 0);
  const avgDetection = Math.round(
    trigger.detectionDC * 0.35 + concealment.detectionDC * 0.45 + delivery.detectionDC * 0.2
  );
  const detectionDC = avgDetection + (autoResetCamUnlocked ? AUTO_RESET_CAM_DC_BONUS : 0);

  const potency = Math.max(20, Math.min(100, Math.round(rawLethality * 0.55)));
  const stability = Math.max(25, Math.min(100, Math.round(rawDeterrence * 0.52)));
  const reliability = Math.max(35, Math.min(99, Math.round((potency + stability + avgDetection) / 3)));

  const massThreshold = trigger.massThresholdKg ?? 0;
  const emitsSulphurFog =
    payload.damageType === 'sulphur_fog' ||
    delivery.damageType === 'sulphur_fog' ||
    concealment.damageType === 'sulphur_fog';
  const causesPetrification =
    payload.damageType === 'petrification' || delivery.damageType === 'petrification';

  const counterSet = new Set<CounterClass>(trigger.counterplayRoutes);
  payload.counterplayRoutes.forEach((c) => counterSet.add(c));
  if (zincGuardUnlocked || reset.id === 'part_rst_06') {
    counterSet.delete('sabotage');
  }

  const reactionNotes: string[] = [
    `Trigger Mass Threshold: ${massThreshold > 0 ? `${massThreshold}kg` : '0kg (Non-Mass Sensor)'} · Detection DC ${detectionDC}`
  ];
  if (autoResetCamUnlocked) reactionNotes.push(`Secondary Fail-Deadly Cam: +${AUTO_RESET_CAM_DC_BONUS} Detection DC (${avgDetection} → ${detectionDC}); applied at assembly, not retroactively.`);
  if (trigger.id === 'part_trg_12') {
    reactionNotes.push('MASS INVERSION: triggers below 25kg; heavier intruders bypass the sensor.');
  } else if (massThreshold >= 35) {
    reactionNotes.push(`MASS BYPASS WINDOW: Heroes shrunk below ${massThreshold}kg via Chicken-Morph Draught will not trigger this plate!`);
  } else if (massThreshold > 0 && massThreshold <= 12) {
    reactionNotes.push(`ANTI-MORPH HAIR TRIGGER: ${massThreshold}kg threshold catches even Chicken-Morphed heroes!`);
  }
  if (reset.id === 'part_rst_09') reactionNotes.push('FINITE TEMPORAL RESET: one charge per paid installation prevents one wear removal; no free replenishment.');
  if (emitsSulphurFog) {
    reactionNotes.push('SULPHUR ATMOSPHERE: Degrades unstabilised hero antidotes by 55% unless filtered.');
  }
  if (causesPetrification) {
    reactionNotes.push('PETRIFICATION HAZARD: Calcifies heroes lacking a functional Basilisk Antidote.');
  }
  if (zincGuardUnlocked || reset.id === 'part_rst_06') {
    reactionNotes.push('ANODISED ZINC SHIELD: Immune to Rust-Monster Solvent sabotage.');
  }

  const formulaSignature = computeCanonicalFormulaSignature('trp', componentIds, appliedSkills, SIM_RULES_VERSION);
  const canonicalId = computeCanonicalProductId('trp', componentIds, appliedSkills, SIM_RULES_VERSION);

  const defaultName =
    customName.trim() ||
    `${trigger.name.split(' ')[0]} ${payload.name.split(' ').slice(0, 2).join(' ')} ${delivery.name.split(' ').pop()}`;

  return {
    id: canonicalId,
    formulaSignature,
    rulesVersion: SIM_RULES_VERSION,
    name: defaultName,
    category: causesPetrification ? 'HAZARD_MONSTER' : 'TRAP_MASTER',
    targetAudience: 'MASTER',
    productionCost: totalCost,
    suggestedPrice: Math.round(totalCost * 2.05),
    stock: 2,
    potency,
    stability,
    reliability,
    massEffectKg: 0,
    sulphurVulnerable: false,
    emitsSulphurFog,
    causesPetrification,
    curesPetrification: false,
    filtersSulphur: false,
    triggerMassThresholdKg: massThreshold,
    detectionDC,
    damageType: payload.damageType,
    counterClasses: Array.from(counterSet),
    recipeComponents: componentIds,
    appliedSkills,
    description: `Engineered with ${trigger.name}, ${concealment.name}, ${delivery.name}, and ${payload.name} [Build #${formulaSignature}].`,
    reactionNotes
  };
}

export function simulateRegionExpedition(
  day: number,
  seed: number,
  master: DungeonMaster,
  party: AdventuringParty,
  productsCatalog: CraftedProduct[],
  contractsToday: SaleContract[]
): ExpeditionReport {
  const rng = new DeterministicRNG(seed + day * 7919);

  // Gather active hazards for master and active gear for party strictly by canonical ID
  const masterProducts = master.installedHazards
    .map((id) => productsCatalog.find((p) => p.id === id))
    .filter((p): p is CraftedProduct => Boolean(p));

  // If master has 0 installed player traps, dungeon operates with inherent environmental hazards (Gate 3)
  // We NEVER inject fake consumable player sales (e.g. prod_trap_plate_spikes) into player catalog or master!
  const effectiveMasterHazards: CraftedProduct[] =
    masterProducts.length > 0
      ? masterProducts
      : [
          {
            id: 'env_baseline_masonry',
            name: 'Ancient Subterranean Flagstone Chokepoint',
            category: 'TRAP_MASTER',
            targetAudience: 'MASTER',
            stock: 1,
            productionCost: 0,
            suggestedPrice: 0,
            stability: 100,
            potency: 22,
            reliability: 100,
            massEffectKg: 0,
            sulphurVulnerable: false,
            emitsSulphurFog: false,
            causesPetrification: false,
            curesPetrification: false,
            filtersSulphur: false,
            triggerMassThresholdKg: 65,
            detectionDC: 30,
            damageType: 'physical',
            recipeComponents: [],
            counterClasses: [],
            description:
              'Permanent inherent dungeon architectural masonry and natural collapsing stone slabs.',
            reactionNotes: ['Inherent dungeon architectural masonry']
          }
        ];

  const partyProducts = party.equippedProducts
    .map((id) => productsCatalog.find((p) => p.id === id))
    .filter((p): p is CraftedProduct => Boolean(p));

  // Check if Sulphur Fog is present anywhere in Master's setup
  const dungeonHasSulphurFog = effectiveMasterHazards.some((p) => p.emitsSulphurFog);
  const partyHasSulphurFilter = partyProducts.some((p) => p.filtersSulphur);
  const morphPotion = partyProducts.find((p) => p.massEffectKg <= -25) || null;
  const rustSolvent =
    partyProducts.find((p) => p.counterClasses.includes('sabotage') && p.category === 'DUAL_SOLVENT') || null;
  const basiliskAntidote = partyProducts.find((p) => p.curesPetrification) || null;

  const roomNames = [
    'Threshold Flagstone Gallery',
    'Smelting Ventilation Sump',
    'Inner Treasury Vault'
  ];

  const rooms: ExpeditionRoomEvent[] = [];
  let totalLooted = 0;
  let warrantyClaimsTriggered = 0;
  const doubleSaleDemandCreated: string[] = [];

  const vanguard = party.members[0] || {
    name: 'Lead Delver',
    massKg: 85,
    hp: 100,
    maxHp: 100,
    role: 'Vanguard',
    status: 'Healthy'
  };

  for (let i = 0; i < 3; i++) {
    const hazard = effectiveMasterHazards[i % effectiveMasterHazards.length];
    const baseMass = vanguard.massKg;
    const effectiveMass = Math.max(12, baseMass + (morphPotion ? morphPotion.massEffectKg : 0));
    const threshold = hazard.triggerMassThresholdKg;

    let outcome: ExpeditionRoomEvent['outcome'] = 'TRAP_TRIGGERED';
    let heroCounterUsed: string | null = null;
    let chemicalReaction: string | null = null;
    let damageDealt = 0;
    let lootSecured = 0;
    let casualtyName: string | null = null;
    let causalExplanation = '';
    let learnedByHeroes = '';
    let learnedByMaster = '';

    // 1. Check Mass Bypass / Mass-Inversion on Pressure Plate triggers
    const inversion = isMassInversionPlate(hazard);
    const triggersByMass = isTrapTriggeredByMass(hazard, effectiveMass);
    const hasTemporalRewind =
      hazard.recipeComponents.includes('part_rst_09');

    if (inversion && triggersByMass) {
      // Inversion Plate triggers on abnormally light (<25kg) featherweight morphs!
      outcome = 'TRAP_TRIGGERED';
      damageDealt = Math.round(hazard.potency * 0.65) + rng.nextInt(12, 28);
      lootSecured = rng.nextInt(30, 80);
      chemicalReaction = `PARADOX MASS-INVERSION: Inversion sensor detected abnormally light ${effectiveMass}kg intruder (<25kg)! Gravitational polarity inverted and plate detonated!`;
      if (hasTemporalRewind) {
        chemicalReaction += ` [Temporal Rewind Loop: Finite reset module: remaining paid charge is settled against expedition wear.]`;
      }
      causalExplanation = `${party.name} attempted a featherweight ${effectiveMass}kg morph bypass, but ${hazard.name} inverted gravitational polarity and detonated on the lightweight intruder!`;
      learnedByHeroes = `Discovered ${hazard.name} inverts mass physics: featherweight morphs trigger the trap! Demanding anti-arcane disruption.`;
      learnedByMaster = `${master.name}'s Paradox Mass-Inversion Plate successfully caught the featherweight intruders.`;
      doubleSaleDemandCreated.push(`${party.name} seeks anti-arcane countermeasures against Mass Inversion`);
    } else if (!triggersByMass) {
      outcome = 'TRAP_BYPASSED';
      heroCounterUsed = morphPotion?.name ?? 'Naturally light vanguard';
      chemicalReaction = `Mass Rule: ${vanguard.name} (${baseMass}kg) drank ${morphPotion?.name ?? 'natural light mass'} (${morphPotion?.massEffectKg ?? 0}kg) -> ${effectiveMass}kg < ${threshold}kg Plate Threshold!`;
      if (hasTemporalRewind) {
        chemicalReaction += ` [Temporal Rewind Loop: Finite reset module: bypass alone does not consume a reset charge.]`;
      }
      damageDealt = 0;
      lootSecured = rng.nextInt(180, 310);
      causalExplanation = `${party.name} bypassed ${hazard.name} completely because their shrunken ${effectiveMass}kg mass failed to depress the ${threshold}kg pressure plate.`;
      if (inversion) {
        chemicalReaction = `Mass Rule: ${effectiveMass}kg is outside the inversion sensor's under-25kg window.`;
        causalExplanation = `${party.name} bypassed ${hazard.name}: inversion sensors trigger only below 25kg.`;
      }
      learnedByHeroes = `Confirmed ${morphPotion?.name ?? 'natural light mass'} bypasses ${threshold}kg plates in ${master.name}'s dungeon.`;
      learnedByMaster = `${master.name} furious that ${threshold}kg plates were bypassed by lightweight heroes; now demands <10kg Hair-Trigger Quartz traps or Mass-Inversion Plates!`;
      doubleSaleDemandCreated.push(`${master.name} demands Mass-Inversion Plates to counter ${morphPotion?.name ?? 'natural light mass'}`);
    }
    // 2. Check Basilisk Petrification + Sulphur Fog Chemical Reaction (The Basilisk Supply Chain!)
    else if (hazard.causesPetrification) {
      if (basiliskAntidote) {
        if (dungeonHasSulphurFog && basiliskAntidote.sulphurVulnerable && !partyHasSulphurFilter) {
          outcome = 'REACTION_FAILURE';
          heroCounterUsed = basiliskAntidote.name;
          chemicalReaction = `ALCHEMICAL INTERFERENCE: Ambient Sulphur Fog reacted with unstabilised ${basiliskAntidote.name} (-55% potency)!`;
          damageDealt = rng.nextInt(42, 68);
          lootSecured = rng.nextInt(40, 90);
          casualtyName = `${vanguard.name} (Partial Petrification)`;
          causalExplanation = `Sulphur Fog obscured the Basilisk and chemically degraded ${party.name}'s unstabilised ${basiliskAntidote.name}. Two heroes retreated with stone-calcified limbs!`;
          learnedByHeroes = `Discovered ${basiliskAntidote.name} fails in Sulphur Fog! Demanding Quartz-Chelated Antidotes or Charcoal Breathers.`;
          learnedByMaster = `${master.name} saw Sulphur Fog + Basilisk repel the raid, but worries zero survivors means fewer future ticketed raids.`;
          doubleSaleDemandCreated.push(`${party.name} urgently demands Quartz-Chelated Antidotes & Charcoal Breathers`);
          warrantyClaimsTriggered += 1;
        } else {
          outcome = 'COUNTER_SUCCEEDED';
          heroCounterUsed = partyHasSulphurFilter
            ? `${basiliskAntidote.name} + Charcoal Breather`
            : basiliskAntidote.name;
          chemicalReaction = dungeonHasSulphurFog
            ? `Chelated/Filtered Antidote resisted Sulphur Fog and neutralised petrification gaze!`
            : `Active ${basiliskAntidote.name} reversed stone calcification on contact.`;
          damageDealt = rng.nextInt(8, 18);
          lootSecured = rng.nextInt(240, 390);
          causalExplanation = `${party.name} neutralised ${hazard.name} using stabilised anti-petrification chemistry and plundered the chamber.`;
          learnedByHeroes = `Verified ${basiliskAntidote.name} holds up under combat conditions.`;
          learnedByMaster = `${master.name}'s Basilisk was countered! Demands higher-lethality Acid or Arcane traps next turn.`;
          doubleSaleDemandCreated.push(`${master.name} seeks Acid/Arcane upgrades after Basilisk was countered`);
        }
      } else {
        outcome = 'TRAP_TRIGGERED';
        damageDealt = rng.nextInt(55, 85);
        lootSecured = rng.nextInt(20, 60);
        casualtyName = `${vanguard.name} (Petrified)`;
        causalExplanation = `${party.name} entered without a Basilisk Antidote and suffered severe petrification from ${hazard.name}.`;
        learnedByHeroes = `Refuses to re-enter without Basilisk Antidotes!`;
        learnedByMaster = `${master.name}'s Basilisk scored a decisive deterrent victory.`;
        doubleSaleDemandCreated.push(`${party.name} desperate to buy Basilisk Antidotes`);
      }
    }
    // 3. Check Rust-Monster Solvent Sabotage
    else if (rustSolvent && hazard.counterClasses.includes('sabotage')) {
      outcome = 'COUNTER_SUCCEEDED';
      heroCounterUsed = rustSolvent.name;
      chemicalReaction = `Corrosive Oxidation: ${rustSolvent.name} dissolved ${hazard.name}'s unplated iron springs!`;
      damageDealt = 5;
      lootSecured = rng.nextInt(210, 340);
      causalExplanation = `${party.name}'s scout shattered a ${rustSolvent.name} on the mechanism, seizing the gears before actuation.`;
      learnedByHeroes = `Rust solvent reliably disables unplated clockwork traps.`;
      learnedByMaster = `${master.name} demands Anodised Zinc Coating on future traps to stop acid sabotage.`;
      doubleSaleDemandCreated.push(`${master.name} demands Zinc-Anodised traps immune to Rust Solvent`);
    }
    // 4. Check Sulphur Fog vs Charcoal Breather
    else if (hazard.emitsSulphurFog) {
      if (partyHasSulphurFilter) {
        const breather = partyProducts.find((p) => p.filtersSulphur)!;
        outcome = 'COUNTER_SUCCEEDED';
        heroCounterUsed = breather.name;
        chemicalReaction = `Adsorption Filtration: Alkali Charcoal scrubbed 94% of sulphuric vapour.`;
        damageDealt = rng.nextInt(6, 14);
        lootSecured = rng.nextInt(190, 300);
        causalExplanation = `${party.name} breathed cleanly through ${hazard.name} using ${breather.name}.`;
        learnedByHeroes = `Charcoal filtration completely negates sulphur vents.`;
        learnedByMaster = `${master.name} notes heroes now carry breathers; wants kinetic Scythes or 8kg Acid Sprayers instead.`;
        doubleSaleDemandCreated.push(`${master.name} pivots from Sulphur Fog to Kinetic/Acid traps`);
      } else {
        outcome = 'TRAP_TRIGGERED';
        damageDealt = rng.nextInt(32, 54);
        lootSecured = rng.nextInt(75, 140);
        causalExplanation = `Dense yellow clouds from ${hazard.name} choked ${party.name} and blinded their scout.`;
        learnedByHeroes = `Needs Charcoal Alchemical Breathers before next delve.`;
        learnedByMaster = `${master.name} pleased with Sulphur Fog area denial.`;
        doubleSaleDemandCreated.push(`${party.name} demands Charcoal Alchemical Breathers`);
      }
    }
    // 5. Standard Trap Resolution
    else {
      const heroHasResistance = partyProducts.some((p) => p.counterClasses.includes('resistance') && p.potency >= 60);
      const scoutRoll = rng.nextInt(25, 75) + Math.round(party.caution * 0.25);
      if (scoutRoll >= hazard.detectionDC) {
        outcome = 'COUNTER_SUCCEEDED';
        heroCounterUsed = 'Scout Perception & Careful Routing';
        damageDealt = rng.nextInt(5, 15);
        lootSecured = rng.nextInt(170, 280);
        causalExplanation = `${party.name} spotted the ${hazard.name} (DC ${hazard.detectionDC} vs Roll ${scoutRoll}) and wedged the release latch.`;
        learnedByHeroes = `Mapped the trigger layout of ${hazard.name}.`;
        learnedByMaster = `${master.name} wants higher Concealment DC modules so scouts stop spotting traps.`;
        doubleSaleDemandCreated.push(`${master.name} demands higher Concealment DC upgrades`);
      } else if (heroHasResistance && hazard.potency <= 78) {
        const resistPotion = partyProducts.find((p) => p.counterClasses.includes('resistance'))!;
        outcome = 'COUNTER_SUCCEEDED';
        heroCounterUsed = resistPotion.name;
        chemicalReaction = `Protective Ward: ${resistPotion.name} (Potency ${resistPotion.potency}) absorbed the brunt of ${hazard.name}.`;
        damageDealt = rng.nextInt(10, 22);
        lootSecured = rng.nextInt(155, 255);
        causalExplanation = `${hazard.name} triggered, but ${party.name}'s ${resistPotion.name} mitigated the ${hazard.damageType} payload.`;
        learnedByHeroes = `${resistPotion.name} cushioned ${hazard.name}'s impact.`;
        learnedByMaster = `${master.name} wants higher-potency payloads to overwhelm hero tonics.`;
        doubleSaleDemandCreated.push(`${master.name} seeks higher-lethality payloads`);
      } else {
        outcome = 'TRAP_TRIGGERED';
        damageDealt = Math.round(hazard.potency * 0.55) + rng.nextInt(8, 22);
        lootSecured = rng.nextInt(60, 130);
        if (damageDealt >= 52) {
          casualtyName = `${party.members[party.members.length - 1]?.name || 'Scout'} (Injured Retreat)`;
        }
        causalExplanation = `${hazard.name} caught ${party.name} off-guard (DC ${hazard.detectionDC}), dealing ${damageDealt} ${hazard.damageType} damage.`;
        learnedByHeroes = `Recorded ${hazard.name} in guild hazard registry; seeking specific counter-gear.`;
        learnedByMaster = `${master.name} satisfied with ${hazard.name}'s performance.`;
        doubleSaleDemandCreated.push(`${party.name} seeks counter-tonics against ${hazard.damageType} hazards`);
      }
    }

    totalLooted += lootSecured;
    rooms.push({
      roomIndex: i + 1,
      roomName: roomNames[i],
      hazardName: hazard.name,
      hazardId: hazard.id,
      triggerType: threshold > 0 ? `${threshold}kg Pressure Trigger` : 'Sensor/Trip Trigger',
      triggerMassThresholdKg: threshold,
      heroEffectiveMassKg: effectiveMass,
      heroCounterUsed,
      chemicalReaction,
      outcome,
      damageDealt,
      lootSecured,
      casualtyName,
      causalExplanation,
      learnedByHeroes,
      learnedByMaster
    });
  }

  // Check if player breached an exclusivity contract today (sold to both Master and Hero in same region when one had Exclusive Deal)
  // Wax-Removed Maker Marks (secretProvenance) reduces double-dealing discovery chance by 50%
  const masterSalesToday = contractsToday.filter((c) => c.buyerId === master.id);
  const heroSalesToday = contractsToday.filter((c) => c.buyerId === party.id);
  const hasExclusiveDoubleSale =
    masterSalesToday.length > 0 &&
    heroSalesToday.length > 0 &&
    [...masterSalesToday, ...heroSalesToday].some((c) => c.exclusiveDeal);
  const allMaskedWithNullWax =
    hasExclusiveDoubleSale &&
    [...masterSalesToday, ...heroSalesToday]
      .filter((c) => c.exclusiveDeal)
      .every((c) => c.secretProvenance);
  const exclusivityBreachDetected =
    hasExclusiveDoubleSale && (!allMaskedWithNullWax || rng.next() < 0.5);

  const totalDamage = rooms.reduce((acc, r) => acc + r.damageDealt, 0);
  const masterTreasuryDelta = Math.round(totalDamage * 4.5 - totalLooted * 0.45 + 180);
  const partyBudgetDelta = Math.round(totalLooted - totalDamage * 2.2);

  const reactionFailureRoom = rooms.find((r) => r.outcome === 'REACTION_FAILURE');
  const bypassRoom = rooms.find((r) => r.outcome === 'TRAP_BYPASSED');

  const summaryHeadline = reactionFailureRoom
    ? `Sulphur Fog Degraded ${party.name}'s Antidotes in ${master.name}'s Lair!`
    : bypassRoom
    ? `${party.name} Used Featherweight Morph to Walk Over ${master.name}'s Pressure Plates!`
    : `${party.name} Raided ${master.name}: ${totalLooted}g Looted, ${totalDamage} Hazard Damage Dealt`;

  return {
    id: `exp_day${day}_${master.id}_${party.id}`,
    day,
    seed,
    rulesVersion: SIM_RULES_VERSION,
    region: master.region,
    masterId: master.id,
    masterName: master.name,
    partyId: party.id,
    partyName: party.name,
    masterSupplies: masterProducts.map((p) => p.name),
    heroSupplies: partyProducts.map((p) => p.name),
    masterSupplyIds: masterProducts.map((p) => p.id),
    heroSupplyIds: partyProducts.map((p) => p.id),
    rooms,
    totalLooted,
    masterTreasuryDelta,
    partyBudgetDelta,
    warrantyClaimsTriggered,
    exclusivityBreachDetected,
    doubleSaleDemandCreated: Array.from(new Set(doubleSaleDemandCreated)),
    summaryHeadline
  };
}

export function generatePeerCatalystCode(senderName: string, day: number): string {
  const clean = senderName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'MERCHANT';
  const sig = hashString(`PARADOX_CATALYST_${clean}_${day}`).slice(0, 8).toUpperCase();
  return `CATALYST-${clean}-D${day}-${sig}`;
}

/**
 * F03 Fix: Enforces Hard-mode access ('blackspire' unlocked), cryptographic provenance hash verification,
 * and local replay protection before allowing a Peer Catalyst code to unlock The Paradox Vault.
 */
export function verifyAndParseCatalystCode(
  code: string,
  currentDay: number,
  existingLedger: ParadoxCatalystEntry[],
  unlockedRegions: RegionId[] = ['cellar', 'warrens', 'blackspire']
): { valid: boolean; error?: string; entry?: ParadoxCatalystEntry } {
  if (!unlockedRegions.includes('blackspire')) {
    return {
      valid: false,
      error: 'Hard Mode Prerequisite Not Met: You must unlock Blackspire Labyrinth (Region III) before a Paradox Catalyst can attune to The Paradox Vault.'
    };
  }

  const trimmed = code.trim().toUpperCase();
  const match = /^CATALYST-([A-Z0-9]{3,12})-D(\d+)-([A-Z0-9]{6,12})$/.exec(trimmed);
  if (!match) {
    return {
      valid: false,
      error: 'Invalid Catalyst Manifest format. Expected CATALYST-<SENDER>-D<DAY>-<HASH>.'
    };
  }

  const [, sender, dayStr, hashPart] = match;
  const expectedSig = hashString(`PARADOX_CATALYST_${sender}_${dayStr}`).slice(0, 8).toUpperCase();

  if (hashPart !== expectedSig) {
    return {
      valid: false,
      error: `Format Checksum Mismatch: Hash #${hashPart} does not match the deterministic algorithm for sender ${sender} (Day ${dayStr}).`
    };
  }

  if (existingLedger.some((e) => e.provenanceHash.toUpperCase() === hashPart)) {
    return {
      valid: false,
      error: 'Local Replay Detection: This Catalyst provenance hash has already been recorded in your Gift Ledger.'
    };
  }

  return {
    valid: true,
    entry: {
      id: `cat_peer_d${currentDay}_${hashPart.toLowerCase()}`,
      senderName: `Community Envoy ${sender}`,
      senderType: 'PEER_QR_EXCHANGE',
      provenanceHash: hashPart,
      dayReceived: currentDay,
      commissionNote: `Community merchant exchange code verified via format checksum (${trimmed}). Unauthenticated casual transfer.`,
      isAuthentic: false
    }
  };
}

/**
 * Pre-expedition deterministic forecast (Gate 4).
 * Previews room encounters and outcomes matching actual simulateRegionExpedition resolution.
 */
export function predictExpeditionForecast(
  day: number,
  seed: number,
  master: DungeonMaster,
  party: AdventuringParty,
  productsCatalog: CraftedProduct[],
  contractsToday: SaleContract[] = []
): {
  predictedRooms: ExpeditionRoomEvent[];
  summaryHeadline: string;
  expectedLoot: number;
} {
  const sim = simulateRegionExpedition(day, seed, master, party, productsCatalog, contractsToday);
  return {
    predictedRooms: sim.rooms,
    summaryHeadline: sim.summaryHeadline,
    expectedLoot: sim.totalLooted
  };
}
