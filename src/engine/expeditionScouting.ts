import type { DungeonMaster, AdventuringParty, CraftedProduct } from '../types/game';
import { installationMechanics } from './encounterFacts';

/** Player preparation reads current ledger facts only. No seed, rolls, simulator or learning writes. */
export function buildPlayerExpeditionForecast(master: DungeonMaster, party: AdventuringParty, products: CraftedProduct[]) {
  const equipment = party.equippedProducts.map(productId => ({ productId,
    name: products.find(p => p.id === productId)?.name ?? `Unresolved equipment: ${productId}` }));
  const gear = party.equippedProducts.map(id => products.find(p => p.id === id)).filter((p): p is CraftedProduct => !!p);
  const installations = master.installedHazards.map((productId, index) => {
    const p = products.find(p => p.id === productId), m = p && installationMechanics(p);
    return { slot: index + 1, productId, name: p?.name ?? `Unresolved installation: ${productId}`,
      triggerRule: !m ? 'Trigger information unavailable.' : m.inversion ? 'Inversion sensor: mass below 25kg.'
        : m.threshold > 0 ? `Pressure trigger: mass at least ${m.threshold}kg.` : 'Sensor/trip trigger; no positive mass threshold.',
      detectionDC: m?.detectionDC ?? null, potency: m?.potency ?? null,
      paidResetCharges: master.installedResetCharges?.[index] ?? 0 };
  });
  const hazards = master.installedHazards.map(id => products.find(p => p.id === id)).filter((p): p is CraftedProduct => !!p);
  const considerations = ['Heuristic guidance, not a success probability: compare the current trigger rules with the party loadout before choosing whom to supply.'];
  if (gear.some(p => p.massEffectKg <= -25)) considerations.push('Equipped morph changes mass compatibility. Lighter is not universally safer: inversion sensors respond below 25kg. This is a rule interaction, not a promised room outcome.');
  if (hazards.some(p => p.emitsSulphurFog) && gear.some(p => p.sulphurVulnerable && p.curesPetrification)) {
    considerations.push('If petrifying hazards are reached, sulphur fog can degrade a vulnerable antidote. Inspect filtration or a sulphur-stable formula; neither is a promise of victory.');
  }
  if (hazards.some(p => p.causesPetrification) && !gear.some(p => p.curesPetrification)) considerations.push('No anti-petrification remedy is recorded in this loadout. Inspect protection before committing; other hazards and rolls still matter.');
  considerations.push('Stronger defences can reduce hero returns; supplying counters may weaken a master’s deterrence. Prices, finite stock and buyer budgets remain real costs, not forecast income.');
  const uncertainties = [
    'This is a current-ledger snapshot, not newly learned scouting intelligence. Changing sales or the selected matchup changes these facts.',
    'Upcoming room-by-room outcomes, detection rolls, damage, casualties, loot and discovery rolls are not sampled or shown here. Only a completed expedition supplies its actual report.',
    'No calibrated win chance, profit range or guaranteed adaptation is available. The guidance is qualitative and conditional, not a numerical estimate.'
  ];
  if (!installations.length) uncertainties.push('No installed stock is recorded. Inherent environmental hazards may still apply; this panel does not invent their room layout.');
  return { basis: 'CURRENT_LEDGER' as const, masterName: master.name, partyName: party.name,
    members: party.members.map(({ name, role, massKg, hp, maxHp, status }) => ({ name, role, massKg, hp, maxHp, status })),
    equipment, installations, considerations, uncertainties };
}
