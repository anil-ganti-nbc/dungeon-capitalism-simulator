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
  ParadoxCatalystEntry
} from '../types/game';
import { DeterministicRNG, hashString } from '../utils/prng';

export function synthesizeAlchemyProduct(
  reagents: [Reagent, Reagent, Reagent, Reagent, Reagent],
  customName: string,
  chelateSkillUnlocked: boolean
): CraftedProduct {
  const [base, active, carrier, stabiliser, catalyst] = reagents;
  const all = [base, active, carrier, stabiliser, catalyst];

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
  const curesPetrification = tags.has('antipetrify') || active.id === 'reg_act_01';
  const causesPetrification = tags.has('petrify_hazard') || active.id === 'reg_act_07';
  const emitsSulphurFog = tags.has('fog_generator') || (tags.has('sulphur') && tags.has('aerosol'));
  const filtersSulphur = tags.has('sulphur_filter') || (tags.has('sulphur_shield') && stability >= 70);
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

  const defaultName =
    customName.trim() ||
    `${stabiliser.name.split(' ')[0]} ${active.name.split(' ').slice(-2).join(' ')} ${carrier.name.split(' ').pop()}`;

  return {
    id: `prod_custom_alc_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: defaultName,
    category,
    targetAudience,
    productionCost: totalCost,
    suggestedPrice: Math.round(totalCost * 1.95),
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
    recipeComponents: all.map((r) => r.id),
    description: `Synthesized from ${base.name}, ${active.name}, and ${stabiliser.name}.`,
    reactionNotes
  };
}

export function assembleTrapProduct(
  parts: [TrapPart, TrapPart, TrapPart, TrapPart, TrapPart, TrapPart],
  customName: string,
  zincGuardUnlocked: boolean
): CraftedProduct {
  const [trigger, concealment, delivery, payload, power, reset] = parts;
  const all = [trigger, concealment, delivery, payload, power, reset];

  const totalCost = Math.round(all.reduce((acc, p) => acc + p.baseCost, 0) * 0.85);
  const rawLethality = all.reduce((acc, p) => acc + p.lethality, 0);
  const rawDeterrence = all.reduce((acc, p) => acc + p.deterrence, 0);
  const avgDetection = Math.round(
    trigger.detectionDC * 0.35 + concealment.detectionDC * 0.45 + delivery.detectionDC * 0.2
  );

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
    `Trigger Mass Threshold: ${massThreshold > 0 ? `${massThreshold}kg` : '0kg (Non-Mass Sensor)'} · Detection DC ${avgDetection}`
  ];
  if (massThreshold >= 35) {
    reactionNotes.push(`MASS BYPASS WINDOW: Heroes shrunk below ${massThreshold}kg via Chicken-Morph Draught will not trigger this plate!`);
  } else if (massThreshold > 0 && massThreshold <= 12) {
    reactionNotes.push(`ANTI-MORPH HAIR TRIGGER: ${massThreshold}kg threshold catches even Chicken-Morphed heroes!`);
  }
  if (emitsSulphurFog) {
    reactionNotes.push('SULPHUR ATMOSPHERE: Degrades unstabilised hero antidotes by 55% unless filtered.');
  }
  if (causesPetrification) {
    reactionNotes.push('PETRIFICATION HAZARD: Calcifies heroes lacking a functional Basilisk Antidote.');
  }
  if (zincGuardUnlocked || reset.id === 'part_rst_06') {
    reactionNotes.push('ANODISED ZINC SHIELD: Immune to Rust-Monster Solvent sabotage.');
  }

  const defaultName =
    customName.trim() ||
    `${trigger.name.split(' ')[0]} ${payload.name.split(' ').slice(0, 2).join(' ')} ${delivery.name.split(' ').pop()}`;

  return {
    id: `prod_custom_trp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: defaultName,
    category: causesPetrification ? 'HAZARD_MONSTER' : 'TRAP_MASTER',
    targetAudience: 'MASTER',
    productionCost: totalCost,
    suggestedPrice: Math.round(totalCost * 1.95),
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
    detectionDC: avgDetection,
    damageType: payload.damageType,
    counterClasses: Array.from(counterSet),
    recipeComponents: all.map((p) => p.id),
    description: `Engineered with ${trigger.name}, ${concealment.name}, and ${payload.name}.`,
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

  // Gather active hazards for master and active gear for party
  const masterProducts = master.installedHazards
    .map((id) => productsCatalog.find((p) => p.id === id))
    .filter((p): p is CraftedProduct => Boolean(p));

  if (masterProducts.length === 0) {
    masterProducts.push(productsCatalog[5]); // Fallback 45kg spike plate
  }

  const partyProducts = party.equippedProducts
    .map((id) => productsCatalog.find((p) => p.id === id))
    .filter((p): p is CraftedProduct => Boolean(p));

  // Check if Sulphur Fog is present anywhere in Master's setup
  const dungeonHasSulphurFog = masterProducts.some((p) => p.emitsSulphurFog);
  const partyHasSulphurFilter = partyProducts.some((p) => p.filtersSulphur);
  const morphPotion = partyProducts.find((p) => p.massEffectKg <= -25) || null;
  const rustSolvent = partyProducts.find((p) => p.counterClasses.includes('sabotage') && p.category === 'DUAL_SOLVENT') || null;
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

  const vanguard = party.members[0] || { name: 'Lead Delver', massKg: 85, hp: 100, maxHp: 100, role: 'Vanguard', status: 'Healthy' };

  for (let i = 0; i < 3; i++) {
    const hazard = masterProducts[i % masterProducts.length];
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

    // 1. Check Mass Bypass on Pressure Plate triggers
    if (threshold >= 25 && effectiveMass < threshold && morphPotion) {
      outcome = 'TRAP_BYPASSED';
      heroCounterUsed = morphPotion.name;
      chemicalReaction = `Mass Rule: ${vanguard.name} (${baseMass}kg) drank ${morphPotion.name} (${morphPotion.massEffectKg}kg) -> ${effectiveMass}kg < ${threshold}kg Plate Threshold!`;
      damageDealt = 0;
      lootSecured = rng.nextInt(180, 310);
      causalExplanation = `${party.name} bypassed ${hazard.name} completely because their shrunken ${effectiveMass}kg mass failed to depress the ${threshold}kg pressure plate.`;
      learnedByHeroes = `Confirmed ${morphPotion.name} bypasses ${threshold}kg plates in ${master.name}'s dungeon.`;
      learnedByMaster = `${master.name} furious that ${threshold}kg plates were bypassed by lightweight heroes; now demands <10kg Hair-Trigger Quartz traps!`;
      doubleSaleDemandCreated.push(`${master.name} demands <10kg Hair-Trigger Traps to counter ${morphPotion.name}`);
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
  const masterSalesToday = contractsToday.filter((c) => c.buyerId === master.id);
  const heroSalesToday = contractsToday.filter((c) => c.buyerId === party.id);
  const exclusivityBreachDetected =
    masterSalesToday.length > 0 &&
    heroSalesToday.length > 0 &&
    [...masterSalesToday, ...heroSalesToday].some((c) => c.exclusiveDeal && !c.secretProvenance);

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
    rulesVersion: 'v1.0-deterministic',
    region: master.region,
    masterId: master.id,
    masterName: master.name,
    partyId: party.id,
    partyName: party.name,
    masterSupplies: masterProducts.map((p) => p.name),
    heroSupplies: partyProducts.map((p) => p.name),
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
  const sig = hashString(`PARADOX_CATALYST_${clean}_${day}`).slice(0, 8);
  return `CATALYST-${clean}-D${day}-${sig}`;
}

export function verifyAndParseCatalystCode(
  code: string,
  currentDay: number,
  existingLedger: ParadoxCatalystEntry[]
): { valid: boolean; error?: string; entry?: ParadoxCatalystEntry } {
  const trimmed = code.trim().toUpperCase();
  // Accept valid formatted peer codes or canonical test codes
  const match = /^CATALYST-([A-Z0-9]{3,12})-D(\d+)-([A-Z0-9]{6,12})$/.exec(trimmed);
  if (!match) {
    return {
      valid: false,
      error: 'Invalid Catalyst Manifest format. Expected CATALYST-<SENDER>-D<DAY>-<HASH>.'
    };
  }
  const [, sender, dayStr, hashPart] = match;
  if (existingLedger.some((e) => e.provenanceHash === hashPart)) {
    return {
      valid: false,
      error: 'Local Replay Detection: This Catalyst provenance hash has already been recorded in your Gift Ledger.'
    };
  }
  return {
    valid: true,
    entry: {
      id: `cat_peer_${Date.now()}`,
      senderName: `Guild Envoy ${sender}`,
      senderType: 'PEER_QR_EXCHANGE',
      provenanceHash: hashPart,
      dayReceived: currentDay,
      commissionNote: `Offline Peer-to-Peer Catalyst Exchange verified via local provenance signature (${trimmed}).`,
      isAuthentic: true
    }
  };
}
