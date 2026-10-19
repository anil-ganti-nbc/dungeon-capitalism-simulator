import { EncounterObservation, EncounterRenewalRequest, ExpeditionReport, GameSaveState, InstallationMechanics, RenewalEvidence } from '../types/game';
import { sameMechanics, installationMechanics, triggersAt } from './encounterFacts';

function check(ok: unknown, where: string): asserts ok { if (!ok) throw Error(`Invalid save: encounter ${where}`); }
const obj = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = (v: any) => Number.isSafeInteger(v) && v >= 0;
const text = (v: any) => typeof v === 'string' && v.length > 0 && v.length <= 8192;
function mechanics(v: any): asserts v is InstallationMechanics {
  check(obj(v) && ['potency','detectionDC','threshold'].every(k => Number.isFinite(v[k]))
    && v.potency >= 0 && v.potency <= 100 && v.detectionDC >= 0 && v.detectionDC <= 112 && v.threshold >= 0
    && ['inversion','temporal','petrification','fog','sabotage'].every(k => typeof v[k] === 'boolean'), 'mechanics');
}
export function validateObservation(o: any): asserts o is EncounterObservation {
  check(obj(o), 'observation'); mechanics(o.mechanics);
  check((o.sourceSlotIndex === null || (count(o.sourceSlotIndex) && o.sourceSlotIndex < 3))
    && text(o.hazardId) && count(o.roomIndex) && o.roomIndex >= 1 && o.roomIndex <= 3
    && Number.isFinite(o.baseMassKg) && o.baseMassKg > 0 && Number.isFinite(o.effectiveMassKg) && o.effectiveMassKg >= 12
    && typeof o.triggersByMass === 'boolean' && o.triggersByMass === triggersAt(o.mechanics, o.effectiveMassKg)
    && ['TRAP_TRIGGERED','TRAP_BYPASSED','COUNTER_SUCCEEDED','REACTION_FAILURE','MONSTER_CLASH'].includes(o.outcome), 'observation values');
  check(obj(o.counter) && (o.counter.kind === 'NATURAL_MASS'
    ? o.effectiveMassKg === Math.max(12, o.baseMassKg)
    : o.counter.kind === 'MORPH' && text(o.counter.productId) && Number.isFinite(o.counter.massEffectKg) && o.counter.massEffectKg <= -25
      && o.effectiveMassKg === Math.max(12, o.baseMassKg + o.counter.massEffectKg)), 'counter');
  check(o.triggersByMass ? o.outcome !== 'TRAP_BYPASSED' : o.outcome === 'TRAP_BYPASSED', 'predicate outcome');
}
export function validateReportObservations(r: ExpeditionReport) {
  if (r.encounterObservations === undefined) return;
  check(obj(r.encounterObservations) && r.encounterObservations.schema === 'encounter-observations-v1'
    && Array.isArray(r.encounterObservations.rooms) && r.encounterObservations.rooms.length === r.rooms.length && r.rooms.length === 3, 'report envelope');
  r.encounterObservations.rooms.forEach((o,i) => {
    validateObservation(o); const room = r.rooms[i];
    check(o.roomIndex === room.roomIndex && o.hazardId === room.hazardId && o.outcome === room.outcome
      && o.effectiveMassKg === room.heroEffectiveMassKg && o.mechanics.threshold === room.triggerMassThresholdKg, 'report room alignment');
  });
}
function evidence(e: any, s: GameSaveState, masterId: string): asserts e is RenewalEvidence {
  check(obj(e) && text(e.reportId) && count(e.day) && e.day > 0 && e.day <= s.day && e.seed === s.seed
    && e.rulesVersion === 'v2.0-sim002' && e.masterId === masterId && text(e.partyName)
    && s.masters.some(m => m.id === masterId && m.region === e.region)
    && s.parties.some(p => p.id === e.partyId && p.region === e.region), 'evidence provenance');
  check(e.reportId === `exp_day${e.day}_${masterId}_${e.partyId}`, 'report identity');
  validateObservation(e.observation);
  check(s.products.some(p => p.id === e.observation.hazardId), 'evidence hazard reference');
  if (e.observation.counter.kind === 'MORPH') {
    const counter = e.observation.counter;
    // Historical observed effect is validated by its own base/effect/effective-mass tuple above.
    // Rebrewing the same authored SKU can change today's effect without rewriting a past encounter.
    check(s.products.some(p => p.id === counter.productId), 'evidence morph reference');
  }
  check(e.observation.sourceSlotIndex !== null && !e.observation.mechanics.inversion
    && e.observation.mechanics.threshold > e.observation.effectiveMassKg && e.observation.outcome === 'TRAP_BYPASSED', 'ordinary mass evidence');
}
// Compare the complete historical evidence tuple, independent of JSON key order or today's catalogue.
function sameEvidence(a: RenewalEvidence, b: RenewalEvidence): boolean {
  const x = a.observation, y = b.observation;
  return (['reportId','day','seed','rulesVersion','region','masterId','partyId','partyName'] as const).every(k => a[k] === b[k])
    && (['sourceSlotIndex','hazardId','effectiveMassKg','baseMassKg','triggersByMass','outcome','roomIndex'] as const).every(k => x[k] === y[k])
    && sameMechanics(x.mechanics, y.mechanics) && x.counter.kind === y.counter.kind
    && (x.counter.kind === 'NATURAL_MASS' || (y.counter.kind === 'MORPH'
      && x.counter.productId === y.counter.productId && x.counter.massEffectKg === y.counter.massEffectKg));
}
export function validateRenewal(s: GameSaveState) {
  const root = s.encounterRenewal;
  check(obj(root) && root!.schema === 'encounter-renewal-v1' && obj(root!.masters), 'root');
  const allOccurrenceIds = new Set<string>(), requestIds = new Set<string>();
  const retainedRequests = new Map<string, { masterId: string; request: EncounterRenewalRequest }>();
  for (const [id, rec] of Object.entries(root!.masters)) {
    const m = s.masters.find(m => m.id === id); check(m && obj(rec), 'master reference');
    check(Array.isArray(rec.occurrences) && rec.occurrences.length === m.installedHazards.length
      && count(rec.epoch) && count(rec.settledDay) && rec.settledDay <= s.day
      && (rec.settledIdentity === null || (text(rec.settledIdentity) && rec.settledIdentity.length <= 8192))
      && (rec.lowestMass === null ? rec.epoch === 0 : Number.isFinite(rec.lowestMass) && rec.lowestMass >= 12 && rec.epoch > 0)
      && Array.isArray(rec.requests) && rec.requests.length <= 3 && Array.isArray(rec.history) && rec.history.length <= 12, 'bounds');
    rec.occurrences.forEach((o,i) => {
      check(obj(o) && text(o.id) && !allOccurrenceIds.has(o.id) && o.productId === m.installedHazards[i], 'occurrence identity');
      allOccurrenceIds.add(o.id); mechanics(o.mechanics);
      check(sameMechanics(o.mechanics, installationMechanics(s.products.find(p => p.id === o.productId)!)), 'occurrence mechanics');
    });
    for (const r of [...rec.requests, ...rec.history]) {
      check(obj(r) && text(r.id) && text(r.occurrenceId) && !requestIds.has(r.id) && count(r.epoch) && r.epoch > 0 && r.epoch <= rec.epoch
        && ['OPEN','SATISFIED_BY_PAID_REPLACEMENT','DECLINED','EXPIRED','STALE'].includes(r.status), 'request');
      requestIds.add(r.id); evidence(r.evidence,s,id);
      retainedRequests.set(r.id, { masterId: id, request: r });
      check(rec.lowestMass !== null && r.evidence.observation.effectiveMassKg >= rec.lowestMass && r.evidence.day <= rec.settledDay, 'challenge');
      if (r.status === 'OPEN') check(rec.requests.includes(r) && rec.occurrences.some(o => o.id === r.occurrenceId), 'open occurrence');
      if (r.status === 'SATISFIED_BY_PAID_REPLACEMENT') check(s.contractHistory.some(c => c.id === r.contractId
        && c.installationReplacement?.renewal?.requestId === r.id), 'paid request receipt');
      else check(r.contractId === undefined, 'nonpaid contract');
    }
  }
  for (const c of [...s.contractHistory, ...s.contractsToday]) {
    const r = c.installationReplacement?.renewal;
    if (r === undefined) continue;
    check(obj(r) && text(r.requestId) && text(r.occurrenceId) && c.buyerType === 'MASTER', 'receipt binding');
    evidence(r.evidence,s,c.buyerId);
    // Terminal history is bounded: absence is legitimate, disagreement with a retained twin is not.
    const linked = retainedRequests.get(r.requestId);
    check(!linked || (linked.masterId === c.buyerId && linked.request.status === 'SATISFIED_BY_PAID_REPLACEMENT'
      && linked.request.contractId === c.id && linked.request.occurrenceId === r.occurrenceId
      && sameEvidence(linked.request.evidence, r.evidence)), 'paid request receipt provenance');
    const retained = root!.masters[c.buyerId];
    check(retained && retained.lowestMass !== null && retained.lowestMass <= r.evidence.observation.effectiveMassKg
      && retained.settledDay >= r.evidence.day && retained.epoch > 0, 'receipt retained anti-churn lineage');
    check(r.evidence.day <= c.day && r.evidence.observation.hazardId === c.installationReplacement!.retiredProductId, 'receipt evidence');
    const p = s.products.find(p => p.id === c.productId)!;
    check(triggersAt(installationMechanics(p),r.evidence.observation.effectiveMassKg), 'receipt remedy');
  }
}
