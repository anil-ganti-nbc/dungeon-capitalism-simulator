import test from 'node:test';
import assert from 'node:assert/strict';
import * as economy from '../src/engine/economyEngine';
import { createInitialSaveState } from '../src/engine/initialState';
import { GameSaveState } from '../src/types/game';
import { assembleTrapProduct } from '../src/engine/simulation';
import { TRAP_PARTS_CATALOG } from '../src/data/catalog';
import { validateSavePayload } from '../src/engine/saveManager';

const terms = { priceMultiplier: 1, warrantyBacked: false, exclusiveDeal: false, secretProvenance: false };
function fixture(): GameSaveState {
  const state = createInitialSaveState(88191);
  state.masters[0].budget = 9999;
  state.masters[0].installedHazards = ['prod_trap_plate_spikes', 'prod_hazard_basilisk', 'prod_trap_sulphur_fog'];
  state.masters[0].installedResetCharges = [0, 0, 0];
  return state;
}
function request(state: GameSaveState, slotIndex = 1, productId = 'prod_trap_hairtrigger_acid') {
  return { masterId: state.masters[0].id, productId, slotIndex,
    expectedProductId: state.masters[0].installedHazards[slotIndex],
    expectedResetCharge: state.masters[0].installedResetCharges![slotIndex],
    expectedDay: state.day, expectedContractCount: state.contractHistory.length };
}
function execute(...args: unknown[]): economy.TransactionResult {
  const command = Reflect.get(economy, 'executeInstallationReplacement');
  assert.equal(typeof command, 'function', 'a full installation needs an explicit shared paid replacement command');
  return Reflect.apply(command, undefined, args);
}

test('paid replacement exchanges exactly the selected full slot with one conserved paid sale', () => {
  const state = fixture(), before = structuredClone(state), intent = request(state);
  const product = state.products.find(row => row.id === intent.productId)!;
  assert.equal(economy.executeCommercialTransaction(state, 'MASTER', intent.masterId, product, terms).success, false,
    'ordinary sale must not gain silent eviction');
  const price = economy.computeQuotation(product, { ...state.masters[0], installedHazards: [] }, 'MASTER',
    { ...terms, seed: state.seed, day: state.day }).unitPrice;
  const result = execute(state, intent, terms, price);
  assert.equal(result.success, true, result.reason);
  const after = result.nextState!;
  assert.deepEqual(state, before);
  assert.deepEqual(after.masters[0].installedHazards, ['prod_trap_plate_spikes', product.id, 'prod_trap_sulphur_fog']);
  assert.deepEqual(after.masters[0].installedResetCharges, [0, 0, 0]);
  assert.equal(after.gold, before.gold + price);
  assert.equal(after.masters[0].budget, before.masters[0].budget - price);
  assert.equal(after.products.find(row => row.id === product.id)!.stock, product.stock - 1);
  assert.deepEqual(after.products.filter(row => row.id !== product.id), before.products.filter(row => row.id !== product.id));
  assert.deepEqual(after.masters.slice(1), before.masters.slice(1));
  assert.deepEqual(after.parties, before.parties);
  assert.deepEqual(after.skills, before.skills);
  assert.deepEqual(after.contractHistory, [result.contract]);
  assert.deepEqual(after.contractsToday, [result.contract]);
  assert.equal(result.contract!.unitCost, product.productionCost);
  assert.equal(result.contract!.totalRevenue, price);
});

function temporalProduct() {
  return assembleTrapProduct(['part_trg_01', 'part_con_01', 'part_del_01', 'part_pay_01', 'part_pow_01', 'part_rst_09']
    .map(id => TRAP_PARTS_CATALOG.find(part => part.id === id)!) as Parameters<typeof assembleTrapProduct>[0], 'Paid temporal installation', false);
}
function priceFor(state: GameSaveState, productId: string) {
  return economy.computeQuotation(state.products.find(row => row.id === productId)!,
    { ...state.masters[0], installedHazards: [] }, 'MASTER', { ...terms, seed: state.seed, day: state.day,
      unlockedSkills: state.skills.filter(skill => skill.unlocked).map(skill => skill.effectKey) }).unitPrice;
}

test('replacement receipt preserves retired reserve and identity through save validation', () => {
  const state = fixture(), temporal = temporalProduct();
  state.products.push(temporal);
  state.masters[0].installedHazards[1] = temporal.id;
  state.masters[0].installedResetCharges![1] = 1;
  const before = structuredClone(state), intent = request(state);
  const result = execute(state, intent, terms, priceFor(state, intent.productId));
  assert.equal(result.success, true, result.reason);
  const replacement = Reflect.get(result.contract!, 'installationReplacement');
  assert.deepEqual(replacement, { slotIndex: 1, retiredProductId: temporal.id,
    retiredProductName: temporal.name, retiredResetCharge: 1 });
  assert.match(result.nextState!.masters[0].memoryLog.at(-1)!, /Replaced slot 2/);
  assert.match(result.nextState!.masters[0].memoryLog.at(-1)!, /no refund/i);
  assert.deepEqual(result.nextState!.products.find(row => row.id === temporal.id), before.products.find(row => row.id === temporal.id),
    'retiring an installation does not return it or its reserve to shop stock');
  const restored = validateSavePayload(JSON.stringify(result.nextState));
  assert.equal(restored.valid, true, restored.error);
  assert.deepEqual(restored.state, result.nextState);
  assert.deepEqual(state, before);
});

test('replacement receipt corruption is rejected while legacy ordinary receipts remain valid', () => {
  const state = fixture(), intent = request(state);
  const paid = execute(state, intent, terms, priceFor(state, intent.productId)).nextState!;
  const bad = structuredClone(paid);
  bad.contractHistory[0].installationReplacement!.retiredProductId = 'unknown_retired_product';
  bad.contractsToday = structuredClone(bad.contractHistory);
  assert.equal(validateSavePayload(JSON.stringify(bad)).valid, false, 'optional new receipt metadata is not an unchecked save channel');
  const ordinary = structuredClone(paid);
  delete ordinary.contractHistory[0].installationReplacement;
  delete ordinary.contractsToday[0].installationReplacement;
  assert.equal(validateSavePayload(JSON.stringify(ordinary)).valid, true, 'historical receipts without the optional field still load');
});

const invalidCases: Array<[string, (state: GameSaveState, intent: ReturnType<typeof request>) => void]> = [
  ['missing master', (_, intent) => { intent.masterId = 'missing'; }],
  ['negative slot', (_, intent) => { intent.slotIndex = -1; }],
  ['fractional slot', (_, intent) => { intent.slotIndex = .5; }],
  ['empty slot', (_, intent) => { intent.slotIndex = 3; }],
  ['stale installed identity', (_, intent) => { intent.expectedProductId = 'prod_trap_plate_spikes'; }],
  ['stale reset reserve', (_, intent) => { intent.expectedResetCharge = 1; }],
  ['stale day', (_, intent) => { intent.expectedDay += 1; }],
  ['stale contract sequence', (_, intent) => { intent.expectedContractCount += 1; }],
  ['unknown replacement', (_, intent) => { intent.productId = 'missing'; }],
  ['missing retired definition', state => { state.products = state.products.filter(row => row.id !== state.masters[0].installedHazards[1]); }],
  ['misaligned reserve array', state => { state.masters[0].installedResetCharges!.pop(); }],
  ['illegal sibling reserve', state => { state.masters[0].installedResetCharges![0] = 1; }],
  ['same installed SKU', (state, intent) => { intent.productId = state.masters[0].installedHazards[1]; }],
  ['renamed mechanically identical SKU', (state, intent) => {
    const old = state.products.find(row => row.id === intent.expectedProductId)!;
    const clone = { ...old, id: 'renamed_clone', name: 'A new name is not an upgrade', stock: 2 };
    state.products.push(clone); intent.productId = clone.id;
  }],
  ['out of stock', (state, intent) => { state.products.find(row => row.id === intent.productId)!.stock = 0; }],
  ['hero-only product', (state, intent) => { intent.productId = state.products.find(row => row.targetAudience === 'HERO')!.id; }],
  ['no buyer money', state => { state.masters[0].budget = 0; }],
  ['inaccessible region', state => { state.masters[0].region = 'blackspire'; }]
];
for (const [name, alter] of invalidCases) test(`replacement refuses ${name} without mutating any state`, () => {
  const state = fixture(), intent = request(state);
  alter(state, intent);
  const price = state.products.some(row => row.id === intent.productId) ? priceFor(state, intent.productId) : 0;
  const before = structuredClone(state);
  const result = execute(state, intent, terms, price);
  assert.equal(result.success, false, name);
  assert.ok(result.reason, 'failure explains the refusal');
  assert.equal(result.nextState, undefined);
  assert.equal(result.contract, undefined);
  assert.deepEqual(state, before);
});

for (const slotIndex of [0, 1, 2]) test(`temporal replacement preserves slot ${slotIndex + 1} and both neighbours`, () => {
  const state = fixture(), temporal = temporalProduct(); state.products.push(temporal);
  const before = structuredClone(state), intent = request(state, slotIndex, temporal.id);
  const quote = economy.computeInstallationReplacementQuote(state, intent, terms);
  assert.equal(quote.success, true, quote.reason);
  assert.deepEqual(state, before, 'quote is read-only');
  assert.equal(Reflect.has(quote, 'nextState'), false);
  const result = execute(state, intent, terms, quote.unitPrice), after = result.nextState!;
  assert.equal(result.success, true, result.reason);
  for (let index = 0; index < 3; index++) {
    assert.equal(after.masters[0].installedHazards[index], index === slotIndex ? temporal.id : before.masters[0].installedHazards[index]);
    assert.equal(after.masters[0].installedResetCharges![index], index === slotIndex ? 1 : 0);
  }
  assert.equal(validateSavePayload(JSON.stringify(after)).valid, true);
  const replayBefore = structuredClone(after);
  assert.equal(execute(after, intent, terms, quote.unitPrice).success, false, 'same paid command cannot execute twice');
  assert.deepEqual(after, replayBefore);
});

test('one installed slot can be replaced without adding capacity', () => {
  const state = fixture(); state.masters[0].installedHazards = state.masters[0].installedHazards.slice(0, 1); state.masters[0].installedResetCharges = [0];
  const intent = request(state, 0), quote = economy.computeInstallationReplacementQuote(state, intent, terms);
  const after = execute(state, intent, terms, quote.unitPrice).nextState!;
  assert.deepEqual(after.masters[0].installedHazards, [intent.productId]);
  assert.deepEqual(after.masters[0].installedResetCharges, [0]);
});

test('paid temporal reserve is consumed once then wears; global cam still protects it during warranty wear', () => {
  const state = fixture(), temporal = temporalProduct(); state.products.push(temporal);
  const intent = request(state, 0, temporal.id), quote = economy.computeInstallationReplacementQuote(state, intent, terms);
  const paid = execute(state, intent, terms, quote.unitPrice).nextState!;
  const master = paid.masters[0], before = structuredClone(paid);
  const once = economy.resolveConsumableWear(paid.parties[0], master, 1, 3, []);
  assert.deepEqual(once.nextInstalled, master.installedHazards); assert.deepEqual(once.nextResetCharges, [0, 0, 0]); assert.equal(once.rewindsSpent, 1);
  const twice = economy.resolveConsumableWear(paid.parties[0], { ...master, installedHazards: once.nextInstalled, installedResetCharges: once.nextResetCharges }, 1, 6, []);
  assert.deepEqual(twice.nextInstalled, master.installedHazards.slice(1)); assert.equal(twice.rewindsSpent, 0);
  const protectedWear = economy.resolveConsumableWear(paid.parties[0], master, 2, 3, ['auto_reset_cam']);
  assert.deepEqual(protectedWear.nextInstalled, master.installedHazards); assert.deepEqual(protectedWear.nextResetCharges, [1, 0, 0]); assert.equal(protectedWear.rewindsSpent, 0);
  assert.deepEqual(paid, before);
});

test('new cam-built paid installation retains exact +12 without improving or refunding old stock', () => {
  const state = fixture(), old = temporalProduct();
  const enhanced = assembleTrapProduct(old.recipeComponents.map(id => TRAP_PARTS_CATALOG.find(part => part.id === id)!) as Parameters<typeof assembleTrapProduct>[0], 'Paid cam build', false, true);
  state.products.push(old, enhanced); state.masters[0].installedHazards[0] = old.id; state.masters[0].installedResetCharges![0] = 1;
  state.skills.find(skill => skill.effectKey === 'auto_reset_cam')!.unlocked = true;
  const before = structuredClone(state), intent = request(state, 0, enhanced.id), quote = economy.computeInstallationReplacementQuote(state, intent, terms);
  const result = execute(state, intent, terms, quote.unitPrice);
  assert.equal(result.success, true, result.reason);
  assert.equal(enhanced.detectionDC, old.detectionDC + 12);
  const after = result.nextState!;
  assert.deepEqual(after.products.find(row => row.id === old.id), old);
  assert.deepEqual(after.products.find(row => row.id === enhanced.id), { ...enhanced, stock: enhanced.stock - 1 });
  assert.deepEqual(after.skills, before.skills); assert.equal(after.skillPoints, before.skillPoints);
});

for (const expectedPrice of [0, -1, 1.5, NaN, Infinity]) test(`replacement rejects invalid displayed price ${String(expectedPrice)}`, () => {
  const state = fixture(), before = structuredClone(state), intent = request(state);
  assert.equal(execute(state, intent, terms, expectedPrice).success, false);
  assert.deepEqual(state, before);
});

test('a changed current price refuses instead of silently charging a new quote', () => {
  const state = fixture(), intent = request(state), quoted = priceFor(state, intent.productId);
  state.products.find(row => row.id === intent.productId)!.suggestedPrice += 100;
  const before = structuredClone(state), result = execute(state, intent, terms, quoted);
  assert.equal(result.success, false); assert.match(result.reason!, /quote changed/i); assert.deepEqual(state, before);
});

test('replacement honours warranty/exclusivity/provenance and bills the existing daily accounting exactly once', () => {
  const state = fixture(), intent = request(state), special = { priceMultiplier: 1.25, warrantyBacked: true, exclusiveDeal: true, secretProvenance: true };
  const quote = economy.computeInstallationReplacementQuote(state, intent, special);
  const result = execute(state, intent, special, quote.unitPrice);
  assert.equal(result.success, true, result.reason);
  assert.equal(result.contract!.warrantyBacked, true); assert.equal(result.contract!.exclusiveDeal, true); assert.equal(result.contract!.secretProvenance, true);
  assert.equal(result.nextState!.gold - state.gold, quote.unitPrice);
  assert.equal(result.nextState!.contractHistory.length, 1);
  assert.equal(result.nextState!.contractHistory.reduce((sum, row) => sum + row.quantity * row.unitCost, 0), state.products.find(p => p.id === intent.productId)!.productionCost);
  assert.equal(result.nextState!.masters[0].trust, state.masters[0].trust - 3);
});

for (const [name, damage] of [
  ['null metadata', (c: any) => { c.installationReplacement = null; }],
  ['negative slot', (c: any) => { c.installationReplacement.slotIndex = -1; }],
  ['fourth slot', (c: any) => { c.installationReplacement.slotIndex = 3; }],
  ['fractional slot', (c: any) => { c.installationReplacement.slotIndex = .5; }],
  ['blank name', (c: any) => { c.installationReplacement.retiredProductName = ' '; }],
  ['negative reserve', (c: any) => { c.installationReplacement.retiredResetCharge = -1; }],
  ['overfull reserve', (c: any) => { c.installationReplacement.retiredResetCharge = 2; }],
  ['reserve on ordinary retired hazard', (c: any) => { c.installationReplacement.retiredResetCharge = 1; }],
  ['self replacement receipt', (c: any) => { c.installationReplacement.retiredProductId = c.productId; }]
] as const) test(`save refuses malformed replacement receipt: ${name}`, () => {
  const state = fixture(), intent = request(state), quote = economy.computeInstallationReplacementQuote(state, intent, terms);
  const paid = execute(state, intent, terms, quote.unitPrice).nextState!;
  damage(paid.contractHistory[0]); paid.contractsToday = structuredClone(paid.contractHistory);
  assert.equal(validateSavePayload(JSON.stringify(paid)).valid, false);
});

test('replacement preview and commit both reject a finite quote outside safe integer currency', () => {
  const state = fixture(), before = structuredClone(state), intent = request(state), overflowTerms = { ...terms, priceMultiplier: 1e295 };
  // Make affordability non-blocking: acceptance must reject the unsafe computed amount itself.
  state.masters[0].budget = Number.MAX_VALUE;
  const snapshot = structuredClone(state);
  assert.equal(economy.computeInstallationReplacementQuote(state, intent, overflowTerms).success, false);
  assert.equal(execute(state, intent, overflowTerms, Number.MAX_VALUE).success, false);
  assert.deepEqual(state, snapshot);
  assert.deepEqual(state.products, before.products);
});
