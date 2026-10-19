import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSaveState } from '../src/engine/initialState';
import { simulateRegionExpedition } from '../src/engine/simulation';
import { validateSavePayload } from '../src/engine/saveManager';
import * as economy from '../src/engine/economyEngine';

test('B3 M19 new persistence requires validated lifecycle before rotating a save', () => {
  const s = createInitialSaveState();
  Reflect.set(s, 'version', '2.2.0-encounter-renewal');
  Reflect.set(s, 'encounterRenewal', { schema: 'encounter-renewal-v1', masters: {} });
  assert.equal(validateSavePayload(JSON.stringify(s)).valid, true, 'explicit new compatible schema must load');
  delete s.encounterRenewal;
  assert.equal(validateSavePayload(JSON.stringify(s)).valid, false, 'new saves may not erase lifecycle');
});

async function renewal() {
  const path = '../src/engine/encounterRenewal';
  const api = await import(path).catch(() => ({}));
  assert.equal(typeof api.recordCompletedEncounter, 'function', 'completed settlement needs shared persistent learning');
  return api;
}
const terms = { priceMultiplier: 1, warrantyBacked: false, exclusiveDeal: false, secretProvenance: false };
function bypassFixture() {
  const s = createInitialSaveState(88191);
  s.parties[0].equippedProducts = []; s.parties[0].members[0].massKg = 21;
  s.masters[0].installedHazards = ['prod_trap_plate_spikes', 'prod_trap_plate_spikes'];
  s.masters[0].installedResetCharges = [0, 0];
  return s;
}
async function completed() {
  const api = await renewal(), before = bypassFixture();
  const report = simulateRegionExpedition(before.day, before.seed, before.masters[0], before.parties[0], before.products, []);
  const after = { ...before, ...economy.resolvePostRaidClients(before, report), day: before.day + 1, expeditionReports: [report] };
  return { api, before, report, state: api.recordCompletedEncounter(before, after, report) };
}

test('B3 M05 M06 completed learning dedupes repeated rooms but distinguishes duplicate installed occurrences', async () => {
  const { state } = await completed();
  const requests = state.encounterRenewal.masters[state.masters[0].id].requests;
  assert.equal(requests.length, 2); assert.notEqual(requests[0].occurrenceId, requests[1].occurrenceId);
});
test('B3 M12 M17 same shared paid command consumes evidence once and conserves cash stock slots', async () => {
  const { api, state } = await completed();
  const req = state.encounterRenewal.masters[state.masters[0].id].requests[0];
  const intent = api.replacementForRequest(state, req.id, 'prod_trap_hairtrigger_acid');
  const before = structuredClone(state), quote = economy.computeInstallationReplacementQuote(state, intent, terms);
  assert(quote.success, quote.reason);
  const tx = economy.executeInstallationReplacement(state, intent, terms, quote.unitPrice!);
  assert(tx.success, tx.reason); assert.deepEqual(state, before);
  assert.equal(tx.nextState!.gold - state.gold, quote.unitPrice);
  assert.equal(tx.contract!.installationReplacement!.renewal!.requestId, req.id);
  assert.equal(tx.nextState!.encounterRenewal!.masters[state.masters[0].id].requests[0].status, 'SATISFIED_BY_PAID_REPLACEMENT');
  assert.equal(economy.executeInstallationReplacement(tx.nextState!, intent, terms, quote.unitPrice!).success, false);
});


test('B3 M01 actual ordinary bypass produces typed source-slot facts without prose inference', () => {
  const s = createInitialSaveState(88191);
  s.parties[0].members[0].massKg = 21;
  s.parties[0].equippedProducts = [];
  const report = simulateRegionExpedition(s.day, s.seed, s.masters[0], s.parties[0], s.products, []);
  const observations = Reflect.get(report, 'encounterObservations');
  assert.equal(observations?.schema, 'encounter-observations-v1', 'actual producer must emit typed facts');
  assert.equal(observations.rooms[0].sourceSlotIndex, 0);
  assert.equal(observations.rooms[0].effectiveMassKg, 21);
  assert.equal(observations.rooms[0].counter.kind, 'NATURAL_MASS');
});
