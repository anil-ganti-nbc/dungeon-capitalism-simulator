import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createInitialSaveState } from '../src/engine/initialState';
import { runSingleCampaign, StrategyId, CampaignMetrics } from '../src/engine/campaignRunner';
import { executeCommercialTransaction, resolveConsumableWear } from '../src/engine/economyEngine';

// Reproduction, not a rebalance: no production rules changed and no replacement purchase is simulated.
const output = process.env.EVIDENCE_DIR ?? 'artifacts/content-reconciliation';
assert(!fs.existsSync(path.join(output, 'renewal-diagnosis.json')), 'Preserve previous diagnostic evidence');
fs.mkdirSync(output, { recursive: true });
const strategies: StrategyId[] = ['BALANCED_MERCHANT', 'DUNGEON_LOYALIST', 'HERO_BENEFACTOR', 'ALCHEMICAL_INDUSTRIALIST', 'PREDATORY_CAPITALIST'];
const campaigns: { seed: number; strategy: StrategyId; metrics: CampaignMetrics; lastSaleDay: number | null;
  firstPermanentResetDay: number | null; refusalReasons: Record<string, number>; stockAvailableDuringFullRefusals: number;
  snapshots: unknown[]; structuredKnowledgeUnchanged: boolean; membersUnchanged: boolean; rivalsUnchanged: boolean }[] = [];
for (const strategy of strategies) {
  for (let index = 0; index < 20; index++) {
    const seed = 731900 + index * 7919;
    const refusalReasons: Record<string, number> = {};
    let lastSaleDay: number | null = null;
    let firstPermanentResetDay: number | null = null;
    let stockAvailableDuringFullRefusals = 0;
    const snapshots: unknown[] = [];
    const run = runSingleCampaign(seed, strategy, 120, false, event => {
      if (event.result.success) lastSaleDay = event.before.day;
      else {
        const reason = event.result.reason ?? 'unknown';
        const reasonClass = reason.includes('full') ? 'FULL' : reason.includes('budget') ? 'BUDGET' : reason.includes('boycott') ? 'BOYCOTT' : 'OTHER';
        refusalReasons[reasonClass] = (refusalReasons[reasonClass] ?? 0) + 1;
        if (reasonClass === 'FULL' && event.before.products.some(product => product.id === event.productId && product.stock > 0)) stockAvailableDuringFullRefusals++;
      }
    }, { onAfterRaid: state => {
      if (firstPermanentResetDay === null && state.skills.some(skill => skill.effectKey === 'auto_reset_cam' && skill.unlocked)) firstPermanentResetDay = state.day;
      if ([1, 6, 12, 30, 120].includes(state.day)) snapshots.push({ day: state.day, region: state.activeRegion, gold: state.gold, debt: state.debt,
        masters: state.masters.map(master => ({ id: master.id, slots: master.installedHazards.length, budget: master.budget, trust: master.trust })),
        sales: state.contractHistory.length });
    } });
    const initial = createInitialSaveState(seed);
    campaigns.push({ seed, strategy, metrics: run.metrics, lastSaleDay, firstPermanentResetDay, refusalReasons, stockAvailableDuringFullRefusals, snapshots,
      structuredKnowledgeUnchanged: run.finalState.masters.every(master => JSON.stringify(master.knownHeroCounters) === JSON.stringify(initial.masters.find(row => row.id === master.id)!.knownHeroCounters))
        && run.finalState.parties.every(party => JSON.stringify(party.observedTraps) === JSON.stringify(initial.parties.find(row => row.id === party.id)!.observedTraps)),
      membersUnchanged: JSON.stringify(run.finalState.parties.map(party => party.members)) === JSON.stringify(initial.parties.map(party => party.members)),
      rivalsUnchanged: JSON.stringify(run.finalState.rivals) === JSON.stringify(initial.rivals) });
  }
}
const controlled = [];
for (const permanentReset of [false, true]) {
  let state = createInitialSaveState(88191);
  state.masters[0].installedHazards = [];
  state.masters[0].installedResetCharges = [];
  state.masters[0].budget = 99999;
  const product = state.products.find(row => row.targetAudience === 'MASTER')!;
  product.stock = 100;
  const trace = [];
  const startingCash = state.gold;
  const terms = { priceMultiplier: 1, warrantyBacked: false, exclusiveDeal: false, secretProvenance: false };
  for (let day = 1; day <= 30; day++) {
    state.day = day;
    const before = structuredClone(state);
    const transaction = executeCommercialTransaction(state, 'MASTER', state.masters[0].id, product, terms);
    assert.deepEqual(state, before, 'shared transaction must not mutate caller state');
    if (transaction.success) state = transaction.nextState!;
    const wear = resolveConsumableWear(state.parties[0], state.masters[0], 0, day, permanentReset ? ['auto_reset_cam'] : []);
    state.masters[0].installedHazards = wear.nextInstalled;
    state.masters[0].installedResetCharges = wear.nextResetCharges;
    assert(state.masters[0].installedHazards.length <= 3);
    assert.equal(state.masters[0].installedHazards.length, state.masters[0].installedResetCharges.length);
    const revenue = state.contractHistory.reduce((sum, contract) => sum + contract.totalRevenue, 0);
    assert.equal(state.masters[0].budget + revenue, 99999, 'no buyer-liquidity grant');
    assert.equal(state.gold - startingCash, revenue, 'cash only from actual paid contracts');
    assert.equal(state.products.find(row => row.id === product.id)!.stock + state.contractHistory.length, 100, 'paid stock conservation');
    trace.push({ day, success: transaction.success, reason: transaction.reason ?? null, budget: state.masters[0].budget,
      slots: state.masters[0].installedHazards.length, remainingStock: state.products.find(row => row.id === product.id)!.stock, contracts: state.contractHistory.length });
  }
  controlled.push({ permanentReset, sales: state.contractHistory.length, trace });
}
assert.equal(campaigns.length, 100);
assert.equal(controlled[0].sales, 12);
assert.equal(controlled[1].sales, 3);
const median = (values: number[]) => { const sorted = [...values].sort((a,b) => a-b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2; };
const summaries = strategies.map(strategy => {
  const rows = campaigns.filter(campaign => campaign.strategy === strategy);
  return { strategy, campaigns: rows.length, insolvent: rows.filter(row => row.metrics.strictBankruptcyOccurred).length,
    medianRevenue: median(rows.map(row => row.metrics.grossRevenue)), medianOverhead: median(rows.map(row => row.metrics.totalOverhead)),
    medianNetProfit: median(rows.map(row => row.metrics.netProfit)), medianLastSaleDay: median(rows.map(row => row.lastSaleDay ?? 0)),
    fullRefusalsWithStock: rows.reduce((sum,row) => sum + row.stockAvailableDuringFullRefusals, 0) };
});
const result = { sourceHead: execFileSync('git', ['rev-parse','HEAD'], { encoding: 'utf8' }).trim(),
  evidenceClass: 'Hermes self-executed inherited-policy sample and isolated wear/capacity control; NOT independent review or rebalance-impact evidence',
  seedFormula: '731900 + n*7919, n=0..19', horizon: 120, summaries, campaigns, controlled,
  limitations: ['Policies are not human players.', 'Control has fixed 99999g starting budget and 100 stock; no raids, income renewal, overhead or progression.',
    'Only wear reset argument changes in the control; no counterfactual paid replacement/retrofit has been implemented or tested.',
    'No universal faction-viability theorem or physical-device evidence.'] };
fs.writeFileSync(path.join(output, 'renewal-diagnosis.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ summaries, renewalControl: controlled.map(({ permanentReset, sales }) => ({ permanentReset, sales })),
  structuredKnowledgeAlwaysUnchanged: campaigns.every(row => row.structuredKnowledgeUnchanged),
  membersAlwaysUnchanged: campaigns.every(row => row.membersUnchanged), rivalsAlwaysUnchanged: campaigns.every(row => row.rivalsUnchanged) }, null, 2));
