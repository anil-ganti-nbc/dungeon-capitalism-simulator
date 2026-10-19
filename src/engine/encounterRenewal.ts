import { CraftedProduct, EncounterObservation, EncounterRenewalRequest, EncounterRenewalState,
  ExpeditionReport, GameSaveState, RenewalMasterState, SaleContract } from '../types/game';
import { validateReportObservations, validateRenewal } from './renewalValidation';
import { mergeCraftedProductIntoInventory } from './simulation';
import { installationMechanics, sameMechanics, triggersAt } from './encounterFacts';
import type { InstallationReplacementRequest } from './economyEngine';

/** Preserve the established live-SKU crafting semantics; update metadata only at this actual transition.
 * Never infer this transition during loading: a contradictory saved snapshot must still reject. */
export function mergeCraftedInventoryState(before: GameSaveState, crafted: CraftedProduct, batchSize: number): GameSaveState {
  if (before.encounterRenewal) validateRenewal(before);
  const products = mergeCraftedProductIntoInventory(before.products, crafted, batchSize);
  const root = before.encounterRenewal;
  if (!root) return { ...before, products };
  let masters = root.masters;
  for (const [id, rec] of Object.entries(root.masters)) {
    const changed = rec.occurrences.filter(o => !sameMechanics(o.mechanics, installationMechanics(products.find(p => p.id === o.productId)!)));
    if (!changed.length) continue;
    const ids = new Set(changed.map(o => o.id));
    masters = { ...masters, [id]: { ...rec,
      occurrences: rec.occurrences.map(o => ids.has(o.id) ? { ...o, mechanics: installationMechanics(products.find(p => p.id === o.productId)!) } : o),
      // Only the live binding changes. Original observations and retained anti-churn marks do not.
      requests: rec.requests.map(r => r.status === 'OPEN' && ids.has(r.occurrenceId) ? { ...r, status: 'STALE' as const } : r)
    } };
  }
  return { ...before, products, encounterRenewal: masters === root.masters ? root : { ...root, masters } };
}

export const RENEWAL_TTL = 12;
export const RENEWAL_SAVE_VERSION = '2.2.0-encounter-renewal';
export function emptyRenewal(): EncounterRenewalState { return { schema: 'encounter-renewal-v1', masters: {} }; }
function recordFor(s: GameSaveState, id: string): RenewalMasterState {
  const existing = s.encounterRenewal?.masters[id];
  if (existing) return structuredClone(existing);
  const master = s.masters.find(m => m.id === id)!;
  return { occurrences: master.installedHazards.map((productId, i) => ({
    id: `occ:${s.seed}:${id}:bootstrap:${s.day}:${s.contractHistory.length}:${i}`,
    productId, mechanics: installationMechanics(s.products.find(p => p.id === productId)!) })),
    lowestMass: null, epoch: 0, settledDay: Math.max(0, s.day - 1), settledIdentity: null, requests: [], history: [] };
}
function put(s: GameSaveState, id: string, record: RenewalMasterState): GameSaveState {
  return { ...s, encounterRenewal: { schema: 'encounter-renewal-v1', masters: { ...s.encounterRenewal?.masters, [id]: record } } };
}
export function requestStatus(s: GameSaveState, r: EncounterRenewalRequest): EncounterRenewalRequest['status'] {
  if (r.status !== 'OPEN') return r.status;
  if (s.day - r.evidence.day >= RENEWAL_TTL) return 'EXPIRED';
  const rec = s.encounterRenewal?.masters[r.evidence.masterId];
  const i = rec?.occurrences.findIndex(o => o.id === r.occurrenceId) ?? -1;
  const m = s.masters.find(m => m.id === r.evidence.masterId);
  const p = m && s.products.find(p => p.id === m.installedHazards[i]);
  if (i < 0 || !p || p.id !== r.evidence.observation.hazardId || !sameMechanics(installationMechanics(p), r.evidence.observation.mechanics)) return 'STALE';
  return 'OPEN';
}
export function requestsFor(s: GameSaveState, masterId: string): EncounterRenewalRequest[] {
  return (s.encounterRenewal?.masters[masterId]?.requests ?? []).map(r => ({ ...r, status: requestStatus(s, r) }));
}
export function replacementForRequest(s: GameSaveState, requestId: string, productId: string): InstallationReplacementRequest | undefined {
  for (const [id, rec] of Object.entries(s.encounterRenewal?.masters ?? {})) {
    const r = rec.requests.find(r => r.id === requestId);
    if (!r) continue;
    const slotIndex = rec.occurrences.findIndex(o => o.id === r.occurrenceId), master = s.masters.find(m => m.id === id)!;
    return { masterId: id, productId, slotIndex, expectedProductId: master.installedHazards[slotIndex] ?? '',
      expectedResetCharge: master.installedResetCharges?.[slotIndex] ?? 0, expectedDay: s.day,
      expectedContractCount: s.contractHistory.length,
      evidence: { requestId, occurrenceId: r.occurrenceId, epoch: r.epoch, candidateMechanics: installationMechanics(s.products.find(p => p.id === productId)!) } };
  }
}
export function renewalEligibility(s: GameSaveState, intent: InstallationReplacementRequest): string | undefined {
  if (!intent.evidence) return;
  const rec = s.encounterRenewal?.masters[intent.masterId], r = rec?.requests.find(r => r.id === intent.evidence!.requestId);
  if (!r || requestStatus(s, r) !== 'OPEN' || r.epoch !== intent.evidence.epoch
    || r.occurrenceId !== intent.evidence.occurrenceId || rec?.occurrences[intent.slotIndex]?.id !== r.occurrenceId) {
    return 'Encounter request is stale, expired, declined or already paid; review the current occurrence.';
  }
  const p = s.products.find(p => p.id === intent.productId);
  if (p && (!intent.evidence.candidateMechanics || !sameMechanics(installationMechanics(p), intent.evidence.candidateMechanics))) return 'Selected response mechanics changed; review this build again.';
  if (p && !addresses(r, p)) return 'This build does not address the observed mass bypass; a different name or higher DC is not a remedy.';
}
export function addresses(r: EncounterRenewalRequest, product: CraftedProduct): boolean {
  return triggersAt(installationMechanics(product), r.evidence.observation.effectiveMassKg);
}
export function declineRenewal(s: GameSaveState, requestId: string): GameSaveState {
  for (const [id, rec] of Object.entries(s.encounterRenewal?.masters ?? {})) {
    const r = rec.requests.find(r => r.id === requestId);
    if (r && requestStatus(s, r) === 'OPEN') return put(s, id, { ...rec,
      requests: rec.requests.map(r => r.id === requestId ? { ...r, status: 'DECLINED' } : r) });
  }
  return s;
}
/** Called after the same successful commercial transaction; never preview or failed payment. */
export function recordInstallationSale(before: GameSaveState, after: GameSaveState, contract: SaleContract, slot?: number): GameSaveState {
  if (contract.buyerType !== 'MASTER') return after;
  const rec = recordFor(before, contract.buyerId);
  const p = after.products.find(p => p.id === contract.productId)!;
  const occurrence = { id: `occ:${before.seed}:${contract.id}`, productId: p.id, mechanics: installationMechanics(p) };
  if (slot === undefined) rec.occurrences.unshift(occurrence);
  else {
    const oldId = rec.occurrences[slot]?.id;
    const relevant = rec.requests.find(r => r.occurrenceId === oldId && requestStatus(before, r) === 'OPEN' && addresses(r, p));
    rec.requests = rec.requests.map(r => r.occurrenceId !== oldId || r.status !== 'OPEN' ? r
      : relevant?.id === r.id ? { ...r, status: 'SATISFIED_BY_PAID_REPLACEMENT', contractId: contract.id } : { ...r, status: 'STALE' });
    if (relevant && contract.installationReplacement) contract = { ...contract, installationReplacement: {
      ...contract.installationReplacement, renewal: { requestId: relevant.id, occurrenceId: oldId!, evidence: structuredClone(relevant.evidence) } } };
    rec.occurrences[slot] = occurrence;
  }
  return put({ ...after, contractsToday: after.contractsToday.map(c => c.id === contract.id ? contract : c),
    contractHistory: after.contractHistory.map(c => c.id === contract.id ? contract : c) }, contract.buyerId, rec);
}
function validProducedFacts(before: GameSaveState, report: ExpeditionReport): boolean {
  const env = report.encounterObservations;
  const master = before.masters.find(m => m.id === report.masterId), party = before.parties.find(p => p.id === report.partyId);
  if (!master || !party || !env || env.schema !== 'encounter-observations-v1' || env.rooms.length !== 3 || report.rooms.length !== 3
    || report.seed !== before.seed || report.day !== before.day || report.rulesVersion !== 'v2.0-sim002'
    || report.region !== before.activeRegion || master.region !== report.region || party.region !== report.region
    || before.scheduledMatchups[report.region].masterId !== master.id || before.scheduledMatchups[report.region].partyId !== party.id
    || report.id !== `exp_day${report.day}_${master.id}_${party.id}`) return false;
  const morph = party.equippedProducts.map(id => before.products.find(p => p.id === id)).find(p => p && p.massEffectKg <= -25);
  const base = party.members[0]?.massKg ?? 85;
  return env.rooms.every((o, i) => {
    const expectedSlot = master.installedHazards.length ? i % master.installedHazards.length : null;
    const hazard = expectedSlot === null ? undefined : before.products.find(p => p.id === master.installedHazards[expectedSlot]);
    const room = report.rooms[i];
    return o.sourceSlotIndex === expectedSlot && o.roomIndex === i + 1 && o.hazardId === room.hazardId
      && o.outcome === room.outcome && o.effectiveMassKg === room.heroEffectiveMassKg
      && o.baseMassKg === base && o.effectiveMassKg === Math.max(12, base + (morph?.massEffectKg ?? 0))
      && (morph ? o.counter.kind === 'MORPH' && o.counter.productId === morph.id && o.counter.massEffectKg === morph.massEffectKg : o.counter.kind === 'NATURAL_MASS')
      && (!hazard || (hazard.id === o.hazardId && sameMechanics(installationMechanics(hazard), o.mechanics)))
      && o.triggersByMass === triggersAt(o.mechanics, o.effectiveMassKg)
      && (o.triggersByMass || o.outcome === 'TRAP_BYPASSED');
  });
}
/** Commit metadata only at actual raid settlement. Caller supplies pre-wear state and real client successor. */
export function recordCompletedEncounter(before: GameSaveState, after: GameSaveState, report: ExpeditionReport): GameSaveState {
  try { validateReportObservations(report); } catch { return after; }
  if (!validProducedFacts(before, report)) return after; // old/ambiguous facts remain unknown
  const rec = recordFor(before, report.masterId);
  if (report.day <= rec.settledDay) return after;
  const oldMaster = before.masters.find(m => m.id === report.masterId)!, newMaster = after.masters.find(m => m.id === report.masterId)!;
  const removed = oldMaster.installedHazards.length - newMaster.installedHazards.length;
  if (removed < 0 || removed > 1 || !newMaster.installedHazards.every((id, i) => id === oldMaster.installedHazards[i + removed])) return after;
  const sourceOccurrences = [...rec.occurrences];
  rec.occurrences = rec.occurrences.slice(removed);
  rec.settledDay = report.day;
  rec.settledIdentity = JSON.stringify([report.seed, report.rulesVersion, report.id, report.region, report.masterId, report.partyId, report.encounterObservations]);
  const current = put(after, report.masterId, rec);
  rec.requests = rec.requests.map(r => ({ ...r, status: requestStatus(current, r) }));
  const useful = report.encounterObservations!.rooms.filter(o => o.sourceSlotIndex !== null && !o.mechanics.inversion
    && o.mechanics.threshold > 0 && !o.triggersByMass && o.outcome === 'TRAP_BYPASSED'
    && rec.occurrences.some(c => c.id === sourceOccurrences[o.sourceSlotIndex!]?.id));
  const min = useful.length ? Math.min(...useful.map(o => o.effectiveMassKg)) : null;
  if (min !== null && (rec.lowestMass === null || min < rec.lowestMass)) {
    rec.lowestMass = min; rec.epoch++;
    rec.history = [...rec.history, ...rec.requests.map(r => r.status === 'OPEN' ? { ...r, status: 'STALE' as const } : r)].slice(-12);
    const byOccurrence = new Map<string, EncounterObservation>();
    for (const o of useful) if (o.effectiveMassKg === min) byOccurrence.set(sourceOccurrences[o.sourceSlotIndex!].id, o);
    rec.requests = [...byOccurrence].map(([occurrenceId, observation]) => ({
      id: `req:${report.seed}:${report.masterId}:${rec.epoch}:${observation.sourceSlotIndex}`,
      occurrenceId, epoch: rec.epoch, status: 'OPEN', evidence: {
        reportId: report.id, day: report.day, seed: report.seed, rulesVersion: report.rulesVersion,
        region: report.region, masterId: report.masterId, partyId: report.partyId, partyName: report.partyName, observation: structuredClone(observation) } }));
  }
  return put(after, report.masterId, rec);
}
