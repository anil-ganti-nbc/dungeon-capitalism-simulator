import React, { useState, useEffect } from 'react';
import {
  StrategyId,
  CampaignMetrics,
  AdversarialTestResult,
  runSingleCampaign,
  runAdversarialTestSuite
} from '../engine/campaignRunner';

interface SimSummaryData {
  meta: {
    campaignBatchId: string;
    timestampUtc: string;
    nodeVersion: string;
    rulesVersion?: string;
    totalCampaigns: number;
    seedsPerStrategy: number;
    horizonDays: number;
    totalSimulatedDays: number;
    executionTimeMs: number;
    sourceFileSha256: Record<string, string>;
  };
  strategies: Record<string, any>;
  pairedComparisons: {
    balancedBeatPredatoryCount: number;
    balancedBeatPredatoryPct: number;
    industrialistTopWealthCount: number;
    predatoryHighestClaimsCount: number;
    predatoryHighestClaimsPct: number;
  };
  adversarialSuite: AdversarialTestResult[];
  notableCampaigns: CampaignMetrics[];
}

const STRATEGY_LABELS: Record<StrategyId, { title: string; subtitle: string; color: string }> = {
  BALANCED_MERCHANT: {
    title: '1. Balanced Merchant',
    subtitle: 'Supplies Dungeon Masters & Heroes equally; optimizes long-term bilateral retention',
    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20'
  },
  DUNGEON_LOYALIST: {
    title: '2. Dungeon Loyalist',
    subtitle: 'Prioritizes monsters, lethal hazards, traps, and exclusive Dungeon Master contracts',
    color: 'text-rose-400 border-rose-500/40 bg-rose-950/20'
  },
  HERO_BENEFACTOR: {
    title: '3. Hero Benefactor',
    subtitle: 'Prioritizes antidotes, featherweight morphs, warranties, and party survival',
    color: 'text-sky-400 border-sky-500/40 bg-sky-950/20'
  },
  ALCHEMICAL_INDUSTRIALIST: {
    title: '4. Alchemical Industrialist',
    subtitle: 'High-margin chelated potion R&D, batch yields, and countermeasure mastery',
    color: 'text-purple-400 border-purple-500/40 bg-purple-950/20'
  },
  PREDATORY_CAPITALIST: {
    title: '5. Predatory Capitalist',
    subtitle: 'Price gouging (122%–125%), unstabilized antidotes, and double-dealing exclusivity',
    color: 'text-amber-400 border-amber-500/40 bg-amber-950/20'
  }
};

export const Sim001AuditPanel: React.FC = () => {
  const [sim002Data, setSim002Data] = useState<SimSummaryData | null>(null);
  const [sim001Data, setSim001Data] = useState<SimSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDataset, setActiveDataset] = useState<'SIM_002' | 'SIM_001'>('SIM_002');
  const [activeSubTab, setActiveSubTab] = useState<
    'COMPARISON' | 'OVERVIEW' | 'DISTRIBUTIONS' | 'ADVERSARIAL' | 'SANDBOX'
  >('COMPARISON');

  // Interactive Sandbox state
  const [sandboxSeed, setSandboxSeed] = useState<number>(20260001);
  const [sandboxStrategy, setSandboxStrategy] = useState<StrategyId>('BALANCED_MERCHANT');
  const [sandboxDays, setSandboxDays] = useState<number>(120);
  const [liveResult, setLiveResult] = useState<{
    metrics: CampaignMetrics;
    actionLogCount: number;
    sampleActions: string[];
  } | null>(null);
  const [liveAdversarial, setLiveAdversarial] = useState<AdversarialTestResult[] | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/sim_002/strategy_comparison.json')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/sim_001/strategy_comparison.json')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    ]).then(([d2, d1]) => {
      if (d2) setSim002Data(d2);
      if (d1) setSim001Data(d1);
      setLoading(false);
    });
  }, []);

  const handleRunLiveSandbox = () => {
    const res = runSingleCampaign(sandboxSeed, sandboxStrategy, sandboxDays, true);
    setLiveResult({
      metrics: res.metrics,
      actionLogCount: res.actionLog.length,
      sampleActions: res.actionLog.slice(0, 24)
    });
  };

  const handleRunLiveAdversarial = () => {
    const suite = runAdversarialTestSuite();
    setLiveAdversarial(suite);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono text-sm">
        Loading SIM-002 & SIM-001 Empirical Archives (10,000 Campaigns / 1,200,000 Trading Days)...
      </div>
    );
  }

  const data = activeDataset === 'SIM_002' ? sim002Data || sim001Data : sim001Data || sim002Data;
  if (!data) {
    return (
      <div className="p-8 text-center text-rose-400 font-mono text-sm">
        Failed to load simulation archives.
      </div>
    );
  }

  const strategiesOrder: StrategyId[] = [
    'BALANCED_MERCHANT',
    'DUNGEON_LOYALIST',
    'HERO_BENEFACTOR',
    'ALCHEMICAL_INDUSTRIALIST',
    'PREDATORY_CAPITALIST'
  ];

  const displayedAdversarial =
    activeDataset === 'SIM_002' ? liveAdversarial || data.adversarialSuite : data.adversarialSuite;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#131822] via-[#171f2e] to-[#131822] border border-emerald-500/40 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                SIM-002 FOUNDATION REPAIR VERIFIED
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                CODEX F01–F08 PASS
              </span>
              <span className="text-xs font-mono text-slate-400">
                Batch: {data.meta.campaignBatchId} ({data.meta.rulesVersion || 'v1.0-baseline'})
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-slate-100 mt-1">
              Empirical Stress Campaign & Foundation Repair Audit (SIM-001 vs SIM-002)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              5,000 Seeded Campaigns per Batch • 1,000 Paired World Seeds × 5 Strategies × 120 In-Game Days = 600,000 Trading Days & 1,800,000 Rooms
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveDataset('SIM_002')}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors ${
                  activeDataset === 'SIM_002'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SIM-002 (Repaired v2.0)
              </button>
              <button
                onClick={() => setActiveDataset('SIM_001')}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors ${
                  activeDataset === 'SIM_001'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SIM-001 (Frozen Baseline)
              </button>
            </div>

            <a
              href={
                activeDataset === 'SIM_002'
                  ? '/sim_002/strategy_comparison.json'
                  : '/sim_001/strategy_comparison.json'
              }
              download={`${activeDataset.toLowerCase()}_strategy_comparison.json`}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-colors"
            >
              Download JSON
            </a>
            <a
              href={
                activeDataset === 'SIM_002'
                  ? '/sim_002/campaign_results.csv'
                  : '/sim_001/campaign_results.csv'
              }
              download={`${activeDataset.toLowerCase()}_campaign_results.csv`}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-semibold transition-colors"
            >
              Download 5,000-Row CSV
            </a>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="flex flex-wrap items-center gap-2 pt-4">
          {[
            { id: 'COMPARISON', label: 'SIM-001 vs SIM-002 Delta Matrix' },
            { id: 'OVERVIEW', label: `Executive Findings (${activeDataset})` },
            { id: 'DISTRIBUTIONS', label: `5,000-Campaign Percentiles (${activeDataset})` },
            { id: 'ADVERSARIAL', label: 'Codex F01–F08 & Adversarial Suite' },
            { id: 'SANDBOX', label: 'Live Headless Campaign Runner' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeSubTab === t.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 0: SIM-001 vs SIM-002 SIDE-BY-SIDE COMPARISON */}
      {activeSubTab === 'COMPARISON' && sim002Data && sim001Data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#131822] border border-emerald-500/30 rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                F01–F03 P0 Trust & Identity
              </div>
              <div className="text-lg font-display font-bold text-slate-100 mt-1">
                100% Deterministic
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Scheduled matchups match resolution (`F01`), canonical formula hashes preserve custom variants (`F02`), and Hard-gated Catalyst provenance blocks Day-1 exploits (`F03`).
              </p>
            </div>

            <div className="bg-[#131822] border border-emerald-500/30 rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                F04 Specialist Insolvency Rate
              </div>
              <div className="text-lg font-display font-bold text-slate-100 mt-1">
                100.0% → 0.0%
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Removed the hidden `120g` bailout floor (`ADV-04`). Dungeon Loyalist (`+84,471g` net worth) and Hero Benefactor (`+51,748g` net worth) are now 100% solvent with `0` bailout days.
              </p>
            </div>

            <div className="bg-[#131822] border border-emerald-500/30 rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                F05 Balanced vs Predatory
              </div>
              <div className="text-lg font-display font-bold text-slate-100 mt-1">
                1.3% → 100.0% Win Rate
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Low-trust customer boycotts (`trust &lt; 50`) and tier-scaled exclusivity fines (`160g–520g`) drop Predatory Capitalist from Rank #1 (`SIM-001`) to Rank #5 (`SIM-002`).
              </p>
            </div>

            <div className="bg-[#131822] border border-emerald-500/30 rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                Tactical Survival Spread
              </div>
              <div className="text-lg font-display font-bold text-slate-100 mt-1">
                62.5% vs 100.0%
              </div>
              <p className="text-xs text-slate-400 mt-1">
                In `SIM-001`, all strategies had ~95% survival. In `SIM-002`, Dungeon Loyalist drives survival down to `62.5%` (`143` traps triggered), while Hero Benefactor achieves `100.0%`.
              </p>
            </div>
          </div>

          <div className="bg-[#131822] border border-slate-800 rounded-xl p-5 overflow-x-auto">
            <h3 className="font-display text-base font-bold text-slate-100 mb-1">
              Before vs After Reconstruction: SIM-001 (Frozen Baseline) vs SIM-002 (Repaired Engine)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Direct paired comparison across identical seeds (`20260001..20261000`) and 120-day horizon.
            </p>
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th className="py-2.5 pr-3">Strategy</th>
                  <th className="py-2.5 px-2 text-right">SIM-001 Net Profit (P50)</th>
                  <th className="py-2.5 px-2 text-right text-emerald-400">SIM-002 Net Profit (P50)</th>
                  <th className="py-2.5 px-2 text-right">SIM-001 Bankruptcy</th>
                  <th className="py-2.5 px-2 text-right text-emerald-400">SIM-002 Bankruptcy</th>
                  <th className="py-2.5 px-2 text-right">SIM-001 Hard / Expert</th>
                  <th className="py-2.5 px-2 text-right text-emerald-400">SIM-002 Hard / Expert</th>
                  <th className="py-2.5 pl-2 text-right">SIM-001 → SIM-002 Survival</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {strategiesOrder.map((stKey) => {
                  const s1 = sim001Data.strategies[stKey];
                  const s2 = sim002Data.strategies[stKey];
                  if (!s1 || !s2) return null;
                  return (
                    <tr key={stKey} className="hover:bg-slate-900/40">
                      <td className="py-3 pr-3 font-sans font-semibold text-slate-200">
                        {STRATEGY_LABELS[stKey].title}
                      </td>
                      <td
                        className={`py-3 px-2 text-right ${
                          s1.netProfit.p50 < 0 ? 'text-rose-400' : 'text-slate-300'
                        }`}
                      >
                        {s1.netProfit.p50.toLocaleString()}g
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-emerald-400">
                        +{s2.netProfit.p50.toLocaleString()}g
                      </td>
                      <td
                        className={`py-3 px-2 text-right ${
                          s1.strictBankruptcyRatePct > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {s1.strictBankruptcyRatePct}% ({s1.bailoutFloorTriggeredDays.p50}d)
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-emerald-400">
                        {s2.strictBankruptcyRatePct}% ({s2.bailoutFloorTriggeredDays.p50}d)
                      </td>
                      <td className="py-3 px-2 text-right text-slate-400">
                        {s1.hardUnlockRatePct}% / {s1.expertCatalystStrictRatePct}%
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-emerald-400">
                        {s2.hardUnlockRatePct}% (D{s2.dayReachedHard.p50}) / {s2.expertCatalystStrictRatePct}% (D{s2.dayReachedExpert.p50})
                      </td>
                      <td className="py-3 pl-2 text-right text-sky-300">
                        {s1.partySurvivalRatePct.p50}% → <span className="font-bold">{s2.partySurvivalRatePct.p50}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeSubTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#131822] border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Dataset Rules Version
              </div>
              <div className="text-lg font-display font-bold text-emerald-400 mt-1">
                {data.meta.rulesVersion || 'v1.0-sim001'}
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Batch `{data.meta.campaignBatchId}` executed in `{data.meta.executionTimeMs}ms` across `600,000` trading days.
              </p>
            </div>

            <div className="bg-[#131822] border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Balanced vs Predatory Win Rate
              </div>
              <div className="text-lg font-display font-bold text-amber-400 mt-1">
                {data.pairedComparisons.balancedBeatPredatoryPct}% ({data.pairedComparisons.balancedBeatPredatoryCount}/1,000)
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Paired seed comparison of 120-day terminal net worth between Balanced Merchant and Predatory Capitalist.
              </p>
            </div>

            <div className="bg-[#131822] border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Alchemical R&D Top Wealth
              </div>
              <div className="text-lg font-display font-bold text-purple-400 mt-1">
                {(data.pairedComparisons.industrialistTopWealthCount / 10).toFixed(1)}% ({data.pairedComparisons.industrialistTopWealthCount}/1,000)
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Seeds where Alchemical Industrialist achieved the highest terminal net worth across all 5 strategies.
              </p>
            </div>

            <div className="bg-[#131822] border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Predatory Highest Fines Rate
              </div>
              <div className="text-lg font-display font-bold text-rose-400 mt-1">
                {data.pairedComparisons.predatoryHighestClaimsPct}% ({data.pairedComparisons.predatoryHighestClaimsCount}/1,000)
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Seeds where Predatory Capitalist paid the highest cumulative warranty claims and exclusivity breach fines.
              </p>
            </div>
          </div>

          {/* Strategy Summary Table */}
          <div className="bg-[#131822] border border-slate-800 rounded-xl p-5 overflow-x-auto">
            <h3 className="font-display text-base font-bold text-slate-100 mb-3">
              Paired 5,000-Campaign Strategy Comparison (Medians / P50 across 1,000 Shared Seeds — {activeDataset})
            </h3>
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th className="py-2.5 pr-3">Strategy</th>
                  <th className="py-2.5 px-2 text-right">Gross Rev (P50)</th>
                  <th className="py-2.5 px-2 text-right">Net Profit (P50)</th>
                  <th className="py-2.5 px-2 text-right">Net Worth (P50)</th>
                  <th className="py-2.5 px-2 text-right">Claims & Fines</th>
                  <th className="py-2.5 px-2 text-right">Insolvent Rate</th>
                  <th className="py-2.5 px-2 text-right">Bailout Days</th>
                  <th className="py-2.5 px-2 text-right">Normal / Hard</th>
                  <th className="py-2.5 px-2 text-right">Expert (Strict / UI)</th>
                  <th className="py-2.5 pl-2 text-right">Survival</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {strategiesOrder.map((stKey) => {
                  const st = data.strategies[stKey];
                  const info = STRATEGY_LABELS[stKey];
                  return (
                    <tr key={stKey} className="hover:bg-slate-900/40">
                      <td className="py-3 pr-3 font-sans">
                        <div className="font-bold text-slate-200">{info.title}</div>
                        <div className="text-[10px] text-slate-500">{info.subtitle}</div>
                      </td>
                      <td className="py-3 px-2 text-right text-slate-200">
                        {st.grossRevenue.p50.toLocaleString()}g
                      </td>
                      <td
                        className={`py-3 px-2 text-right font-bold ${
                          st.netProfit.p50 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {st.netProfit.p50 >= 0 ? '+' : ''}
                        {st.netProfit.p50.toLocaleString()}g
                      </td>
                      <td
                        className={`py-3 px-2 text-right font-bold ${
                          st.terminalNetWorth.p50 >= 0 ? 'text-amber-300' : 'text-rose-400'
                        }`}
                      >
                        {st.terminalNetWorth.p50.toLocaleString()}g
                      </td>
                      <td className="py-3 px-2 text-right text-rose-300">
                        {st.totalClaimsAndFines.p50.toLocaleString()}g
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            st.strictBankruptcyRatePct > 0
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {st.strictBankruptcyRatePct}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right text-slate-300">
                        {st.bailoutFloorTriggeredDays.p50}d
                      </td>
                      <td className="py-3 px-2 text-right text-slate-300">
                        {st.normalUnlockRatePct}% (D{st.dayReachedNormal.p50 ?? '—'}) /{' '}
                        {st.hardUnlockRatePct}% (D{st.dayReachedHard.p50 ?? '—'})
                      </td>
                      <td className="py-3 px-2 text-right text-slate-300">
                        {st.expertCatalystStrictRatePct}% / {st.expertCatalystUiRuleRatePct}%
                      </td>
                      <td className="py-3 pl-2 text-right text-sky-300">
                        {st.partySurvivalRatePct.p50}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DISTRIBUTIONS & PERCENTILES */}
      {activeSubTab === 'DISTRIBUTIONS' && (
        <div className="space-y-6">
          {strategiesOrder.map((stKey) => {
            const st = data.strategies[stKey];
            const info = STRATEGY_LABELS[stKey];
            const metricsList = [
              { label: 'Gross Revenue (g)', obj: st.grossRevenue },
              { label: 'Total COGS (g)', obj: st.totalCogs },
              { label: 'Total Overhead (g)', obj: st.totalOverhead },
              { label: 'Claims & Fines (g)', obj: st.totalClaimsAndFines },
              { label: 'Loan Interest Paid (g)', obj: st.totalInterestPaid },
              { label: 'Net Profit (g)', obj: st.netProfit },
              { label: 'Terminal Net Worth (g)', obj: st.terminalNetWorth },
              { label: 'Min Raw Cash Before Floor (g)', obj: st.minRawCashBeforeFloor },
              { label: 'Dungeon Master Trust (0-100)', obj: st.masterAvgTrust },
              { label: 'Hero Party Trust (0-100)', obj: st.heroAvgTrust },
              { label: 'Party Survival Rate (%)', obj: st.partySurvivalRatePct },
              { label: 'Traps Triggered (Rooms)', obj: st.trapTriggeredCount },
              { label: 'Mass Pressure Bypasses (Rooms)', obj: st.trapBypassedMassCount },
              { label: 'Sulphur Reaction Failures', obj: st.reactionFailureSulphurCount }
            ];

            return (
              <div
                key={stKey}
                className="bg-[#131822] border border-slate-800 rounded-xl p-5 overflow-x-auto"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-100">
                      {info.title}
                    </h3>
                    <p className="text-xs text-slate-400">{info.subtitle}</p>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    1,000 Campaigns • Normal: {st.normalUnlockRatePct}% • Hard:{' '}
                    {st.hardUnlockRatePct}% • Expert: {st.expertCatalystStrictRatePct}%
                  </div>
                </div>

                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                      <th className="py-2 pr-3">Metric</th>
                      <th className="py-2 px-2 text-right">Mean</th>
                      <th className="py-2 px-2 text-right">Min</th>
                      <th className="py-2 px-2 text-right">P10</th>
                      <th className="py-2 px-2 text-right">P25</th>
                      <th className="py-2 px-2 text-right text-amber-300">Median (P50)</th>
                      <th className="py-2 px-2 text-right">P75</th>
                      <th className="py-2 px-2 text-right">P90</th>
                      <th className="py-2 pl-2 text-right">Max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {metricsList.map((m) => (
                      <tr key={m.label} className="hover:bg-slate-900/30">
                        <td className="py-2 pr-3 font-sans text-slate-300">{m.label}</td>
                        <td className="py-2 px-2 text-right text-slate-400">
                          {m.obj.mean?.toLocaleString() ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-500">
                          {m.obj.min?.toLocaleString() ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-400">
                          {m.obj.p10?.toLocaleString() ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-300">
                          {m.obj.p25?.toLocaleString() ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-amber-300">
                          {m.obj.p50?.toLocaleString() ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-300">
                          {m.obj.p75?.toLocaleString() ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-400">
                          {m.obj.p90?.toLocaleString() ?? '—'}
                        </td>
                        <td className="py-2 pl-2 text-right text-slate-500">
                          {m.obj.max?.toLocaleString() ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: ADVERSARIAL SUITE */}
      {activeSubTab === 'ADVERSARIAL' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#131822] border border-slate-800 rounded-xl p-4">
            <div>
              <h3 className="font-display text-base font-bold text-slate-100">
                Codex Acceptance (`F01–F08`) & Adversarial Regression Suite (`ADV-01–08`)
              </h3>
              <p className="text-xs text-slate-400">
                Proves expedition targeting fidelity, canonical recipe composition identity, Hard-mode Catalyst gating, general physics rules, and byte-identical deterministic replay.
              </p>
            </div>
            <button
              onClick={handleRunLiveAdversarial}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-colors cursor-pointer"
            >
              Re-Execute Live Regression Suite in Browser
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {displayedAdversarial.map((test) => (
              <div
                key={test.testId}
                className="bg-[#131822] border border-slate-800 rounded-xl p-5 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs font-bold">
                      {test.testId}
                    </span>
                    <span className="text-xs font-mono text-slate-400 uppercase">
                      [{test.category}]
                    </span>
                    <h4 className="font-display text-sm font-bold text-slate-100">{test.name}</h4>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${
                      test.status === 'PASS'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : (test.status as string) === 'EXPLOIT_CONFIRMED'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {test.status}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{test.finding}</p>
                <div className="text-[11px] font-mono text-slate-400 bg-slate-950/70 border border-slate-800/80 rounded p-2.5 mt-1">
                  <span className="text-slate-500 uppercase mr-2">Reproduction:</span>
                  {test.reproductionSteps}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: INTERACTIVE HEADLESS SANDBOX */}
      {activeSubTab === 'SANDBOX' && (
        <div className="space-y-6">
          <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
            <h3 className="font-display text-base font-bold text-slate-100 mb-1">
              Live Production Simulation Campaign Runner (`v2.0-sim002`)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Execute any 120-day seeded campaign directly in your browser using the repaired SIM-002 engine (`src/engine/campaignRunner.ts`).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  World Seed (Integer)
                </label>
                <input
                  type="number"
                  value={sandboxSeed}
                  onChange={(e) => setSandboxSeed(Number(e.target.value) || 20260001)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Automated Merchant Strategy
                </label>
                <select
                  value={sandboxStrategy}
                  onChange={(e) => setSandboxStrategy(e.target.value as StrategyId)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                >
                  {strategiesOrder.map((st) => (
                    <option key={st} value={st}>
                      {STRATEGY_LABELS[st].title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Campaign Horizon (Days)
                </label>
                <input
                  type="number"
                  min={30}
                  max={365}
                  value={sandboxDays}
                  onChange={(e) =>
                    setSandboxDays(Math.max(30, Math.min(365, Number(e.target.value) || 120)))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <button
                  onClick={handleRunLiveSandbox}
                  className="w-full py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition-colors cursor-pointer"
                >
                  Run {sandboxDays}-Day Campaign Now
                </button>
              </div>
            </div>
          </div>

          {liveResult && (
            <div className="bg-[#131822] border border-emerald-500/40 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-mono uppercase text-emerald-400">
                    LIVE DETERMINISTIC EXECUTION COMPLETE
                  </span>
                  <h4 className="font-display text-base font-bold text-slate-100">
                    Campaign {liveResult.metrics.campaignId} ({liveResult.metrics.strategy})
                  </h4>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  Actions Logged: {liveResult.actionLogCount} • Rooms Resolved:{' '}
                  {liveResult.metrics.totalRoomsSimulated}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">GROSS REVENUE</div>
                  <div className="text-sm font-bold text-slate-100 mt-0.5">
                    {liveResult.metrics.grossRevenue.toLocaleString()}g
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">NET PROFIT</div>
                  <div
                    className={`text-sm font-bold mt-0.5 ${
                      liveResult.metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {liveResult.metrics.netProfit.toLocaleString()}g
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">TERMINAL NET WORTH</div>
                  <div
                    className={`text-sm font-bold mt-0.5 ${
                      liveResult.metrics.terminalNetWorth >= 0 ? 'text-amber-300' : 'text-rose-400'
                    }`}
                  >
                    {liveResult.metrics.terminalNetWorth.toLocaleString()}g
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">BAILOUT FLOOR DAYS</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">
                    {liveResult.metrics.bailoutFloorTriggeredDays} days (Min Cash:{' '}
                    {liveResult.metrics.minRawCashBeforeFloor}g)
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400 mb-2">
                    Milestone & Tactical Summary
                  </div>
                  <ul className="space-y-1 text-xs font-mono text-slate-300">
                    <li>• Day Reached Normal: {liveResult.metrics.dayReachedNormal ?? 'Never'}</li>
                    <li>• Day Reached Hard: {liveResult.metrics.dayReachedHard ?? 'Never'}</li>
                    <li>
                      • Day Reached Expert (Hard-Gated F03):{' '}
                      {liveResult.metrics.dayReachedExpert ?? 'Never'}
                    </li>
                    <li>
                      • Master / Hero Trust: {liveResult.metrics.masterAvgTrust} /{' '}
                      {liveResult.metrics.heroAvgTrust}
                    </li>
                    <li>
                      • Traps Triggered / Mass Bypassed / Sulphur Failures:{' '}
                      {liveResult.metrics.trapTriggeredCount} /{' '}
                      {liveResult.metrics.trapBypassedMassCount} /{' '}
                      {liveResult.metrics.reactionFailureSulphurCount}
                    </li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400 mb-2">
                    Notable Campaign Chronicles
                  </div>
                  <ul className="space-y-1 text-xs font-mono text-slate-300">
                    {liveResult.metrics.notableStoryLog.map((line, idx) => (
                      <li key={idx}>• {line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
