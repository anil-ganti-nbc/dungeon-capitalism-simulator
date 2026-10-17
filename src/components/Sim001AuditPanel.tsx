import React, { useState } from 'react';
import { SIM_001_DATA } from '../data/sim001Data';
import { StrategyId, runSingleCampaign, CampaignMetrics } from '../engine/campaignRunner';

const STRATEGY_LABELS: Record<StrategyId, { name: string; color: string }> = {
  BALANCED_MERCHANT: { name: '1. Balanced Merchant', color: '#10B981' },
  DUNGEON_LOYALIST: { name: '2. Dungeon Loyalist', color: '#F43F5E' },
  HERO_BENEFACTOR: { name: '3. Hero Benefactor', color: '#38BDF8' },
  ALCHEMICAL_INDUSTRIALIST: { name: '4. Alchemical Industrialist', color: '#A855F7' },
  PREDATORY_CAPITALIST: { name: '5. Predatory Capitalist', color: '#F59E0B' }
};

export const Sim001AuditPanel: React.FC = () => {
  const [liveSeed, setLiveSeed] = useState<number>(20260001);
  const [liveStrategy, setLiveStrategy] = useState<StrategyId>('BALANCED_MERCHANT');
  const [liveResult, setLiveResult] = useState<CampaignMetrics | null>(() => {
    return runSingleCampaign(20260001, 'BALANCED_MERCHANT', 120, false).metrics;
  });

  const strategiesList: StrategyId[] = [
    'BALANCED_MERCHANT',
    'DUNGEON_LOYALIST',
    'HERO_BENEFACTOR',
    'ALCHEMICAL_INDUSTRIALIST',
    'PREDATORY_CAPITALIST'
  ];

  const handleRunLiveSeed = () => {
    const res = runSingleCampaign(liveSeed, liveStrategy, 120, false);
    setLiveResult(res.metrics);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Executive Header & Raw Archive Downloads */}
      <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 mb-4 border-b border-slate-800">
          <div>
            <div className="text-xs font-mono text-amber-400 mb-1">
              SIM-001 · INDEPENDENT ECONOMIC STRESS &amp; BALANCE CAMPAIGN
            </div>
            <h2 className="font-display text-xl font-bold text-slate-100">
              Empirical Audit of 5,000 Seeded Campaigns (600,000 Trading Days)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              1,000 paired seeds (20260001–20261000) × 5 strategies × 120 days · Executed in{' '}
              {SIM_001_DATA.meta.executionTimeMs}ms on Node {SIM_001_DATA.meta.nodeVersion}
            </p>
          </div>

          <div className="text-right font-mono">
            <span className="text-xs text-slate-400 block">OVERALL VERDICT</span>
            <span className="text-sm font-bold text-amber-400">
              HOLD (TACTICAL PHYSICS PASS · 6 MACRO DEFECTS FOUND)
            </span>
          </div>
        </div>

        {/* Raw Artefact Download Links */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <span className="text-slate-400">Download Raw Empirical Artefacts:</span>
          <div className="flex flex-wrap gap-2">
            <a
              href="/sim_001/SIM-001_REPORT.md"
              download="SIM-001_REPORT.md"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded transition-colors"
            >
              SIM-001_REPORT.md
            </a>
            <a
              href="/sim_001/campaign_results.csv"
              download="campaign_results.csv"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded transition-colors"
            >
              campaign_results.csv (5,000 rows)
            </a>
            <a
              href="/sim_001/economy_events.jsonl"
              download="economy_events.jsonl"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded transition-colors"
            >
              economy_events.jsonl
            </a>
            <a
              href="/sim_001/strategy_comparison.json"
              download="strategy_comparison.json"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded transition-colors"
            >
              strategy_comparison.json
            </a>
            <a
              href="/sim_001/SHA256SUMS.txt"
              download="SHA256SUMS.txt"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              SHA256SUMS.txt
            </a>
          </div>
        </div>
      </div>

      {/* Section 1: 5,000-Campaign Strategy Comparison Table */}
      <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
        <h3 className="font-display text-base font-bold text-slate-100 mb-3">
          01. Aggregate Strategy Performance (n = 1,000 Paired Seeds per Strategy · 120 Days)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">Strategy</th>
                <th className="py-2.5 px-3">Gross Rev (P50)</th>
                <th className="py-2.5 px-3">COGS (P50)</th>
                <th className="py-2.5 px-3">Claims+Fines (P50)</th>
                <th className="py-2.5 px-3">Loan Interest (P50)</th>
                <th className="py-2.5 px-3">Net Profit (P50)</th>
                <th className="py-2.5 px-3">Net Worth (P50)</th>
                <th className="py-2.5 px-3">Survival (P10/P50/P90)</th>
                <th className="py-2.5 px-3">Normal / Hard Day</th>
                <th className="py-2.5 px-3">Strict Insolvent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {strategiesList.map((stratId) => {
                const st = SIM_001_DATA.strategies[stratId];
                const meta = STRATEGY_LABELS[stratId];
                return (
                  <tr key={stratId} className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 font-semibold" style={{ color: meta.color }}>
                      {meta.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">
                      {st.grossRevenue.p50.toLocaleString()}g
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {st.totalCogs.p50.toLocaleString()}g
                    </td>
                    <td className="py-2.5 px-3 text-rose-400">
                      {st.totalClaimsAndFines.p50.toLocaleString()}g
                    </td>
                    <td className="py-2.5 px-3 text-amber-400">
                      {st.totalInterestPaid.p50.toLocaleString()}g
                    </td>
                    <td
                      className={`py-2.5 px-3 font-semibold ${
                        st.netProfit.p50 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {st.netProfit.p50 >= 0
                        ? `+${st.netProfit.p50.toLocaleString()}g`
                        : `${st.netProfit.p50.toLocaleString()}g`}
                    </td>
                    <td
                      className={`py-2.5 px-3 font-semibold ${
                        st.terminalNetWorth.p50 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {st.terminalNetWorth.p50 >= 0
                        ? `+${st.terminalNetWorth.p50.toLocaleString()}g`
                        : `${st.terminalNetWorth.p50.toLocaleString()}g`}
                    </td>
                    <td className="py-2.5 px-3 text-sky-300">
                      {st.partySurvivalRatePct.p10}% / <strong>{st.partySurvivalRatePct.p50}%</strong> /{' '}
                      {st.partySurvivalRatePct.p90}%
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      D{st.dayReachedNormal.p50} /{' '}
                      {st.hardUnlockRatePct > 0 ? `D${st.dayReachedHard.p50}` : 'Locked'}
                    </td>
                    <td
                      className={`py-2.5 px-3 font-semibold ${
                        st.strictBankruptcyRatePct === 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {st.strictBankruptcyRatePct}% ({st.bailoutFloorTriggeredDays.p50}d floor)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Visual Charts Grid (Wealth, Survival, Faction Trust, Claims/Fines) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart A: Party Survival Rate & Emergent Room Outcomes */}
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
          <h3 className="font-display text-sm font-bold text-slate-100 mb-1">
            Chart A · Adventuring Party Survival &amp; Room Mechanics (360 Rooms / Campaign)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Proves that alchemy/trap supply choices directly govern expedition survival, mass bypasses, and sulphur failures.
          </p>
          <div className="space-y-3 text-xs font-mono tabular-nums">
            {strategiesList.map((stratId) => {
              const st = SIM_001_DATA.strategies[stratId];
              const meta = STRATEGY_LABELS[stratId];
              return (
                <div key={stratId} className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: meta.color }}>{meta.name}</span>
                    <span className="text-slate-200">
                      Survival: <strong>{st.partySurvivalRatePct.p50}%</strong> · Mass Bypass:{' '}
                      {st.trapBypassedMassCount.p50} · Traps Hit: {st.trapTriggeredCount.p50} · Sulphur Fail:{' '}
                      {st.reactionFailureSulphurCount.p50}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-[#0B0E14] rounded overflow-hidden border border-slate-800">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${st.partySurvivalRatePct.p50}%`,
                        backgroundColor: meta.color
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart B: Faction Trust Divergence & Bailout Floor Days */}
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
          <h3 className="font-display text-sm font-bold text-slate-100 mb-1">
            Chart B · Faction Trust Divergence &amp; Bailout Floor Exposure
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Dungeon Loyalist favors Masters (70.5 vs 60.2); Hero Benefactor favors Heroes (78.1 vs 61.7); Balanced sustains both.
          </p>
          <div className="space-y-3 text-xs font-mono tabular-nums">
            {strategiesList.map((stratId) => {
              const st = SIM_001_DATA.strategies[stratId];
              const meta = STRATEGY_LABELS[stratId];
              return (
                <div
                  key={stratId}
                  className="p-2.5 bg-[#0B0E14] border border-slate-800 rounded flex items-center justify-between"
                >
                  <span className="font-semibold" style={{ color: meta.color }}>
                    {meta.name}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-rose-400">Master Trust: {st.masterAvgTrust.p50}</span>
                    <span className="text-emerald-400">Hero Trust: {st.heroAvgTrust.p50}</span>
                    <span className="text-amber-400">
                      120g Bailout Days: {st.bailoutFloorTriggeredDays.p50}/120
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 3: Phase 5 Adversarial Suite & General-Rule Proofs */}
      <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
        <h3 className="font-display text-base font-bold text-slate-100 mb-3">
          02. Phase 5 Adversarial Suite &amp; General-Rule Verification (ADV-01 to ADV-08)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SIM_001_DATA.adversarialSuite.map((adv) => (
            <div
              key={adv.testId}
              className="p-4 bg-[#0B0E14] border border-slate-800 rounded-lg text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-300 font-semibold">
                  {adv.testId} · {adv.category}
                </span>
                <span
                  className={
                    adv.status === 'PASS'
                      ? 'text-emerald-400 font-bold'
                      : adv.status === 'DEFECT_FOUND'
                      ? 'text-rose-400 font-bold'
                      : 'text-amber-400 font-bold'
                  }
                >
                  {adv.status}
                </span>
              </div>
              <div className="text-sm font-semibold text-slate-100">{adv.name}</div>
              <p className="text-slate-300 leading-relaxed">{adv.finding}</p>
              <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                Repro: {adv.reproductionSteps}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Interactive Headless Seed Runner + 12 Notable Campaign Stories */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-[#131822] border border-slate-800 rounded-xl p-5">
          <h3 className="font-display text-base font-bold text-slate-100 mb-2">
            03. Live Headless Campaign Verifier
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Run any seed and strategy through the 120-day headless engine right now to verify byte-identical determinism.
          </p>

          <div className="space-y-3 mb-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1">World Seed (Integer):</label>
              <input
                type="number"
                value={liveSeed}
                onChange={(e) => setLiveSeed(Number(e.target.value) || 20260001)}
                className="w-full bg-[#0B0E14] border border-slate-700 rounded px-3 py-2 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Automated Strategy:</label>
              <select
                value={liveStrategy}
                onChange={(e) => setLiveStrategy(e.target.value as StrategyId)}
                className="w-full bg-[#0B0E14] border border-slate-700 rounded px-3 py-2 text-slate-100"
              >
                {strategiesList.map((s) => (
                  <option key={s} value={s}>
                    {STRATEGY_LABELS[s].name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleRunLiveSeed}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded-lg cursor-pointer"
            >
              Execute 120-Day Campaign on Seed #{liveSeed}
            </button>
          </div>

          {liveResult && (
            <div className="p-3.5 bg-[#0B0E14] border border-slate-800 rounded-lg text-xs font-mono space-y-1.5 tabular-nums">
              <div className="text-amber-400 font-semibold">
                {liveResult.campaignId} · {liveResult.strategy}
              </div>
              <div>
                Gross Revenue: <span className="text-emerald-400">{liveResult.grossRevenue.toLocaleString()}g</span> ·
                COGS: {liveResult.totalCogs.toLocaleString()}g
              </div>
              <div>
                Claims &amp; Fines: <span className="text-rose-400">{liveResult.totalClaimsAndFines.toLocaleString()}g</span> ·
                Loan Interest: {liveResult.totalInterestPaid.toLocaleString()}g
              </div>
              <div>
                Net Profit: <strong>{liveResult.netProfit.toLocaleString()}g</strong> · Terminal Net Worth:{' '}
                <strong>{liveResult.terminalNetWorth.toLocaleString()}g</strong>
              </div>
              <div>
                Party Survival: <span className="text-sky-400">{liveResult.partySurvivalRatePct}%</span> · Mass Bypass:{' '}
                {liveResult.trapBypassedMassCount} · Sulphur Fail: {liveResult.reactionFailureSulphurCount}
              </div>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                {liveResult.notableStoryLog.map((line, idx) => (
                  <div key={idx}>• {line}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 12 Verifiable Individual Campaign Stories */}
        <div className="lg:col-span-7 bg-[#131822] border border-slate-800 rounded-xl p-5">
          <h3 className="font-display text-base font-bold text-slate-100 mb-3">
            04. Twelve Verifiable Campaign Stories (From 5,000-Run Corpus)
          </h3>
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {SIM_001_DATA.notableCampaigns.map((camp, idx) => (
              <div
                key={camp.campaignId}
                className="p-3.5 bg-[#0B0E14] border border-slate-800 rounded-lg text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="text-amber-400 font-semibold">
                    #{idx + 1} · {camp.campaignId} (Seed {camp.seed} · {camp.strategy})
                  </span>
                  <span className="text-slate-300 tabular-nums">
                    Net Worth: {camp.terminalNetWorth.toLocaleString()}g · Survival: {camp.partySurvivalRatePct}%
                  </span>
                </div>
                <div className="font-mono text-slate-400 tabular-nums">
                  Rev {camp.grossRevenue.toLocaleString()}g · Claims/Fines {camp.totalClaimsAndFines.toLocaleString()}g ·
                  Traps Hit {camp.trapTriggeredCount} · Mass Bypass {camp.trapBypassedMassCount} · Sulphur Fail{' '}
                  {camp.reactionFailureSulphurCount}
                </div>
                <div className="text-[11px] font-mono text-slate-300 space-y-0.5">
                  {camp.notableStoryLog.map((entry, i) => (
                    <div key={i}>→ {entry}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
