import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  StrategyId,
  CampaignMetrics,
  EconomyEventLogEntry,
  runSingleCampaign,
  runAdversarialTestSuite
} from '../src/engine/campaignRunner';

const STRATEGIES: StrategyId[] = [
  'BALANCED_MERCHANT',
  'DUNGEON_LOYALIST',
  'HERO_BENEFACTOR',
  'ALCHEMICAL_INDUSTRIALIST',
  'PREDATORY_CAPITALIST'
];

const SEEDS_COUNT = 1000;
const START_SEED = 20260001;
const HORIZON_DAYS = 120;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return Math.round(sorted[lo] * 10) / 10;
  return Math.round((sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo)) * 10) / 10;
}

export interface DistSummary {
  count: number;
  mean: number;
  min: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  max: number;
}

function summarizeDistribution(values: number[]): DistSummary {
  if (values.length === 0) {
    return { count: 0, mean: 0, min: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count: sorted.length,
    mean: Math.round((sum / sorted.length) * 10) / 10,
    min: sorted[0],
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    max: sorted[sorted.length - 1]
  };
}

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function buildBarChartSvg(
  title: string,
  subtitle: string,
  items: Array<{ label: string; value: number; secondary?: number; color: string; unit: string }>,
  maxValOverride?: number
): string {
  const width = 760;
  const height = 340;
  const maxVal = maxValOverride || Math.max(...items.map((i) => Math.max(i.value, i.secondary || 0)), 1) * 1.15;
  const rowsSvg = items
    .map((item, idx) => {
      const y = 86 + idx * 46;
      const barW = Math.max(4, Math.round((item.value / maxVal) * 420));
      return `
      <g transform="translate(20, ${y})">
        <text x="0" y="16" fill="#E2E8F0" font-family="monospace" font-size="12" font-weight="600">${item.label}</text>
        <rect x="210" y="2" width="430" height="22" rx="4" fill="#131822" stroke="#1E293B" />
        <rect x="210" y="2" width="${barW}" height="22" rx="4" fill="${item.color}" />
        <text x="650" y="17" fill="#F8FAFC" font-family="monospace" font-size="12" font-weight="600">${item.value.toLocaleString()}${item.unit}</text>
      </g>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#0B0E14" rx="10" stroke="#1E293B" />
  <text x="24" y="34" fill="#F8FAFC" font-family="sans-serif" font-size="16" font-weight="700">${title}</text>
  <text x="24" y="54" fill="#94A3B8" font-family="monospace" font-size="11">${subtitle}</text>
  ${rowsSvg}
</svg>\n`;
}

async function main() {
  const rootDir = process.cwd();
  const t0 = Date.now();
  console.log(
    `[SIM-001] Starting 5,000-campaign execution (${SEEDS_COUNT} seeds x ${STRATEGIES.length} strategies x ${HORIZON_DAYS} days = ${
      SEEDS_COUNT * STRATEGIES.length * HORIZON_DAYS
    } simulated trading days)...`
  );

  const allMetrics: CampaignMetrics[] = [];
  const boundedEvents: EconomyEventLogEntry[] = [];
  const sampleActionLogs: Record<string, string[]> = {};

  for (let sIdx = 0; sIdx < SEEDS_COUNT; sIdx++) {
    const seed = START_SEED + sIdx;
    const recordEventsForSeed = sIdx < 40; // Record detailed JSONL events across first 40 paired seeds (200 campaigns)
    for (const strat of STRATEGIES) {
      const { metrics, events, actionLog } = runSingleCampaign(
        seed,
        strat,
        HORIZON_DAYS,
        recordEventsForSeed
      );
      allMetrics.push(metrics);
      if (recordEventsForSeed) {
        boundedEvents.push(...events);
      }
      if (sIdx < 5) {
        sampleActionLogs[`${strat}_${seed}`] = actionLog;
      }
    }
    if ((sIdx + 1) % 250 === 0) {
      console.log(`[SIM-001] Completed ${(sIdx + 1) * STRATEGIES.length} / 5000 campaigns...`);
    }
  }

  const elapsedMs = Date.now() - t0;
  console.log(`[SIM-001] Completed 5,000 campaigns (600,000 trading days) in ${elapsedMs}ms.`);

  // Aggregate per-strategy statistics
  const strategySummaries: Record<string, any> = {};
  for (const strat of STRATEGIES) {
    const rows = allMetrics.filter((m) => m.strategy === strat);
    const normalDays = rows.map((r) => r.dayReachedNormal).filter((d): d is number => d !== null);
    const hardDays = rows.map((r) => r.dayReachedHard).filter((d): d is number => d !== null);
    const expertDays = rows.map((r) => r.dayReachedExpert).filter((d): d is number => d !== null);

    strategySummaries[strat] = {
      campaignsCount: rows.length,
      grossRevenue: summarizeDistribution(rows.map((r) => r.grossRevenue)),
      totalCogs: summarizeDistribution(rows.map((r) => r.totalCogs)),
      totalOverhead: summarizeDistribution(rows.map((r) => r.totalOverhead)),
      totalClaimsAndFines: summarizeDistribution(rows.map((r) => r.totalClaimsAndFines)),
      totalInterestPaid: summarizeDistribution(rows.map((r) => r.totalInterestPaid)),
      netProfit: summarizeDistribution(rows.map((r) => r.netProfit)),
      endingCash: summarizeDistribution(rows.map((r) => r.endingCash)),
      endingDebt: summarizeDistribution(rows.map((r) => r.endingDebt)),
      terminalNetWorth: summarizeDistribution(rows.map((r) => r.terminalNetWorth)),
      minRawCashBeforeFloor: summarizeDistribution(rows.map((r) => r.minRawCashBeforeFloor)),
      bailoutFloorTriggeredDays: summarizeDistribution(rows.map((r) => r.bailoutFloorTriggeredDays)),
      strictBankruptcyRatePct:
        Math.round((rows.filter((r) => r.strictBankruptcyOccurred).length / rows.length) * 1000) / 10,
      normalUnlockRatePct: Math.round((normalDays.length / rows.length) * 1000) / 10,
      dayReachedNormal: summarizeDistribution(normalDays),
      hardUnlockRatePct: Math.round((hardDays.length / rows.length) * 1000) / 10,
      dayReachedHard: summarizeDistribution(hardDays),
      expertCatalystStrictRatePct:
        Math.round((rows.filter((r) => r.catalystObtainedStrict).length / rows.length) * 1000) / 10,
      expertCatalystUiRuleRatePct:
        Math.round((rows.filter((r) => r.catalystObtainedUiRule).length / rows.length) * 1000) / 10,
      dayReachedExpert: summarizeDistribution(expertDays),
      masterAvgTrust: summarizeDistribution(rows.map((r) => r.masterAvgTrust)),
      heroAvgTrust: summarizeDistribution(rows.map((r) => r.heroAvgTrust)),
      partySurvivalRatePct: summarizeDistribution(rows.map((r) => r.partySurvivalRatePct)),
      trapTriggeredCount: summarizeDistribution(rows.map((r) => r.trapTriggeredCount)),
      trapBypassedMassCount: summarizeDistribution(rows.map((r) => r.trapBypassedMassCount)),
      counterSucceededCount: summarizeDistribution(rows.map((r) => r.counterSucceededCount)),
      reactionFailureSulphurCount: summarizeDistribution(rows.map((r) => r.reactionFailureSulphurCount)),
      warrantyClaimsCount: summarizeDistribution(rows.map((r) => r.warrantyClaimsCount)),
      exclusivityBreachesCount: summarizeDistribution(rows.map((r) => r.exclusivityBreachesCount)),
      masterContractsSigned: summarizeDistribution(rows.map((r) => r.masterContractsSigned)),
      heroContractsSigned: summarizeDistribution(rows.map((r) => r.heroContractsSigned))
    };
  }

  // Paired seed comparisons across all 1,000 seeds
  let balancedBeatPredatoryCount = 0;
  let industrialistTopWealthCount = 0;
  let predatoryHighestClaimsCount = 0;
  for (let sIdx = 0; sIdx < SEEDS_COUNT; sIdx++) {
    const seed = START_SEED + sIdx;
    const bySeed = allMetrics.filter((m) => m.seed === seed);
    const bal = bySeed.find((m) => m.strategy === 'BALANCED_MERCHANT')!;
    const pred = bySeed.find((m) => m.strategy === 'PREDATORY_CAPITALIST')!;
    const ind = bySeed.find((m) => m.strategy === 'ALCHEMICAL_INDUSTRIALIST')!;
    if (bal.terminalNetWorth > pred.terminalNetWorth) balancedBeatPredatoryCount++;
    const maxNw = Math.max(...bySeed.map((m) => m.terminalNetWorth));
    if (ind.terminalNetWorth === maxNw) industrialistTopWealthCount++;
    const maxClaims = Math.max(...bySeed.map((m) => m.totalClaimsAndFines));
    if (pred.totalClaimsAndFines === maxClaims) predatoryHighestClaimsCount++;
  }

  const adversarialResults = runAdversarialTestSuite();

  // Prepare directories relative to workspace root
  const archiveDir = path.join(rootDir, 'sim_001_archive');
  const defectDir = path.join(archiveDir, 'defect_replays');
  const chartsDir = path.join(archiveDir, 'charts');
  const rootDefectDir = path.join(rootDir, 'defect_replays');
  const publicSimDir = path.join(rootDir, 'public', 'sim_001');

  fs.mkdirSync(defectDir, { recursive: true });
  fs.mkdirSync(chartsDir, { recursive: true });
  fs.mkdirSync(rootDefectDir, { recursive: true });
  fs.mkdirSync(publicSimDir, { recursive: true });

  // 1. Write campaign_results.csv (5,000 rows)
  const csvHeaders = [
    'campaignId',
    'seed',
    'strategy',
    'daysSimulated',
    'grossRevenue',
    'totalCogs',
    'totalOverhead',
    'totalClaimsAndFines',
    'totalInterestPaid',
    'netProfit',
    'endingCash',
    'endingDebt',
    'endingInventoryValue',
    'terminalNetWorth',
    'peakDebt',
    'minRawCashBeforeFloor',
    'bailoutFloorTriggeredDays',
    'strictBankruptcyOccurred',
    'dayReachedNormal',
    'dayReachedHard',
    'dayReachedExpert',
    'catalystObtainedStrict',
    'catalystObtainedUiRule',
    'masterAvgTrust',
    'heroAvgTrust',
    'partySurvivalRatePct',
    'trapTriggeredCount',
    'trapBypassedMassCount',
    'counterSucceededCount',
    'reactionFailureSulphurCount',
    'warrantyClaimsCount',
    'exclusivityBreachesCount',
    'masterContractsSigned',
    'heroContractsSigned'
  ];

  const csvLines = [csvHeaders.join(',')];
  for (const m of allMetrics) {
    csvLines.push(
      [
        m.campaignId,
        m.seed,
        m.strategy,
        m.daysSimulated,
        m.grossRevenue,
        m.totalCogs,
        m.totalOverhead,
        m.totalClaimsAndFines,
        m.totalInterestPaid,
        m.netProfit,
        m.endingCash,
        m.endingDebt,
        m.endingInventoryValue,
        m.terminalNetWorth,
        m.peakDebt,
        m.minRawCashBeforeFloor,
        m.bailoutFloorTriggeredDays,
        m.strictBankruptcyOccurred,
        m.dayReachedNormal ?? '',
        m.dayReachedHard ?? '',
        m.dayReachedExpert ?? '',
        m.catalystObtainedStrict,
        m.catalystObtainedUiRule,
        m.masterAvgTrust,
        m.heroAvgTrust,
        m.partySurvivalRatePct,
        m.trapTriggeredCount,
        m.trapBypassedMassCount,
        m.counterSucceededCount,
        m.reactionFailureSulphurCount,
        m.warrantyClaimsCount,
        m.exclusivityBreachesCount,
        m.masterContractsSigned,
        m.heroContractsSigned
      ].join(',')
    );
  }
  const csvContent = csvLines.join('\n') + '\n';
  fs.writeFileSync(path.join(archiveDir, 'campaign_results.csv'), csvContent);
  fs.writeFileSync(path.join(rootDir, 'campaign_results.csv'), csvContent);
  fs.writeFileSync(path.join(publicSimDir, 'campaign_results.csv'), csvContent);

  // 2. Write economy_events.jsonl
  const jsonlContent = boundedEvents.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(path.join(archiveDir, 'economy_events.jsonl'), jsonlContent);
  fs.writeFileSync(path.join(rootDir, 'economy_events.jsonl'), jsonlContent);
  fs.writeFileSync(path.join(publicSimDir, 'economy_events.jsonl'), jsonlContent);

  // 3. Write defect_replays/ files
  const defectReplays = [
    {
      filename: 'DEFECT-01_cash_floor_120g_bailout_seed_20260001.json',
      payload: {
        defectId: 'DEFECT-01',
        title: '120g Evening Cash Floor Masks Insolvency & Absorbs Unpaid Bridge Debt Interest',
        location: 'src/App.tsx:397',
        seed: 20260001,
        strategy: 'PREDATORY_CAPITALIST',
        codeSnippet: 'const endingCash = Math.max(120, prev.gold - overheadAndStorage - warrantyClaims - fines - interest);',
        explanation:
          'When a high-leverage Predatory Capitalist unlocks Blackspire via Bridge Loan and incurs daily interest (5%/day) + exclusivity breach fines (-240g) + sulphur warranty claims (-165g), daily deductions exceed daily sales. Raw cash drops below zero, but Math.max(120, ...) resets cash to 120g every evening without adding the unpaid deficit to principal debt.',
        sampleActionLog: sampleActionLogs['PREDATORY_CAPITALIST_20260001']?.slice(0, 45) || []
      }
    },
    {
      filename: 'DEFECT-02_non_seeded_product_id_generation.json',
      payload: {
        defectId: 'DEFECT-02',
        title: 'Custom Brew & Trap Product IDs Use Date.now() and Math.random()',
        location: 'src/engine/simulation.ts:85 & src/engine/simulation.ts:159',
        seed: 20260001,
        codeSnippet: 'id: `prod_custom_alc_${Date.now()}_${Math.floor(Math.random() * 1000)}`',
        explanation:
          'While simulateRegionExpedition() uses DeterministicRNG(seed + day * 7919), custom product synthesis generates IDs using wall-clock Date.now() and Math.random(), causing save files created at different wall-clock ms to have divergent product IDs even under identical seeds and inputs.'
      }
    },
    {
      filename: 'DEFECT-03_day1_solo_catalyst_preseeded_counter_bypass.json',
      payload: {
        defectId: 'DEFECT-03',
        title: 'Solo Paradox Catalyst Commission Pre-Seeded Counter Bypass on Day 1',
        location: 'src/App.tsx:124-125 & src/components/WorldAndIntelPanels.tsx:365',
        seed: 20260002,
        reproductionSteps: [
          '1. Initialize new game (App.tsx sets customBrewsCount=1, customTrapsCount=1).',
          '2. On Day 1 in The Rat King Cellar, sell 2 items to Skritch the Under-Bailiff.',
          '3. Open Catalyst & Saves tab: soloCommissionReady evaluates true because contractHistory.length >= 2 without checking region === blackspire or bilateral buyer diversity.',
          '4. Click "Receive Couriered Paradox Catalyst" to unlock Region IV (The Paradox Vault) on Day 1.'
        ]
      }
    },
    {
      filename: 'DEFECT-04_permanent_hazard_and_gear_equip_persistence.json',
      payload: {
        defectId: 'DEFECT-04',
        title: 'Installed Traps & Equipped Party Potions Never Deplete Across Expeditions',
        location: 'src/App.tsx:321,333 & src/engine/simulation.ts:191-203',
        seed: 20260003,
        explanation:
          'Selling a single potion or trap prepends its productId to party.equippedProducts or master.installedHazards (capped at 3 slots). Subsequent expeditions reuse those equipped items indefinitely without consuming potion doses or charging trap reset maintenance.'
      }
    },
    {
      filename: 'DEFECT-05_peer_catalyst_regex_accepts_unhashed_codes.json',
      payload: {
        defectId: 'DEFECT-05',
        title: 'Offline Peer Catalyst Validator Checks Regex Shape Without Verifying Hash Signature',
        location: 'src/engine/simulation.ts:357',
        seed: 20260004,
        reproductionSteps: [
          '1. Open Catalyst & Saves tab.',
          '2. Enter "CATALYST-TESTER-D1-999999" (where 999999 is not the hashString output of PARADOX_CATALYST_TESTER_1).',
          '3. verifyAndParseCatalystCode() accepts the code because it matches /^CATALYST-([A-Z0-9]{3,12})-D(\\d+)-([A-Z0-9]{6,12})$/.'
        ]
      }
    }
  ];

  for (const def of defectReplays) {
    const content = JSON.stringify(def.payload, null, 2) + '\n';
    fs.writeFileSync(path.join(defectDir, def.filename), content);
    fs.writeFileSync(path.join(rootDefectDir, def.filename), content);
  }

  // 4. Generate SVG Charts in sim_001_archive/charts/
  const colors: Record<StrategyId, string> = {
    BALANCED_MERCHANT: '#10B981',
    DUNGEON_LOYALIST: '#F43F5E',
    HERO_BENEFACTOR: '#38BDF8',
    ALCHEMICAL_INDUSTRIALIST: '#A855F7',
    PREDATORY_CAPITALIST: '#F59E0B'
  };

  const wealthSvg = buildBarChartSvg(
    'SIM-001 · Terminal Net Worth Distribution (Median P50 across n=1,000 seeds/strategy)',
    '120-Day Horizon · Paired Seeds 20260001..20261000',
    STRATEGIES.map((s) => ({
      label: s,
      value: strategySummaries[s].terminalNetWorth.p50,
      color: colors[s],
      unit: 'g'
    }))
  );
  fs.writeFileSync(path.join(chartsDir, 'wealth_distribution.svg'), wealthSvg);

  const survivalSvg = buildBarChartSvg(
    'SIM-001 · Adventuring Party Survival Rate (Median % across 360 Rooms / Campaign)',
    'Higher survival reflects effective Chelated Antidotes, Breathers, and Mass-Bypass Morphs',
    STRATEGIES.map((s) => ({
      label: s,
      value: strategySummaries[s].partySurvivalRatePct.p50,
      color: colors[s],
      unit: '%'
    })),
    100
  );
  fs.writeFileSync(path.join(chartsDir, 'party_survival.svg'), survivalSvg);

  const loyaltySvg = buildBarChartSvg(
    'SIM-001 · Faction Trust Divergence (Dungeon Master Avg Trust at Day 120)',
    'Demonstrates partisan vs bilateral trust trajectories without a forced 50/50 bar',
    STRATEGIES.map((s) => ({
      label: s,
      value: strategySummaries[s].masterAvgTrust.p50,
      color: colors[s],
      unit: '/100'
    })),
    100
  );
  fs.writeFileSync(path.join(chartsDir, 'faction_loyalty.svg'), loyaltySvg);

  const progressionSvg = buildBarChartSvg(
    'SIM-001 · Median Days Required to Unlock Gilded Warrens (Normal Tier)',
    'Lower days = faster progression to Region II (5,000g Charter / Bridge Financing)',
    STRATEGIES.map((s) => ({
      label: s,
      value: strategySummaries[s].dayReachedNormal.p50,
      color: colors[s],
      unit: ' days'
    })),
    45
  );
  fs.writeFileSync(path.join(chartsDir, 'progression_days.svg'), progressionSvg);

  const bankruptcySvg = buildBarChartSvg(
    'SIM-001 · Warranty Claims + Exclusivity Breach Fines Paid (Median Gold Lost)',
    'Measures systemic punishment of unstabilised antidotes and unmasked double-dealing',
    STRATEGIES.map((s) => ({
      label: s,
      value: strategySummaries[s].totalClaimsAndFines.p50,
      color: colors[s],
      unit: 'g'
    }))
  );
  fs.writeFileSync(path.join(chartsDir, 'bankruptcies_and_claims.svg'), bankruptcySvg);

  // 5. Select 12 Concrete Individual Campaign Stories
  const selectedStories = [
    allMetrics.find((m) => m.seed === 20260001 && m.strategy === 'BALANCED_MERCHANT')!,
    allMetrics.find((m) => m.seed === 20260001 && m.strategy === 'PREDATORY_CAPITALIST')!,
    allMetrics.find((m) => m.seed === 20260001 && m.strategy === 'DUNGEON_LOYALIST')!,
    allMetrics.find((m) => m.seed === 20260001 && m.strategy === 'HERO_BENEFACTOR')!,
    allMetrics.find((m) => m.seed === 20260001 && m.strategy === 'ALCHEMICAL_INDUSTRIALIST')!,
    allMetrics.find((m) => m.seed === 20260007 && m.strategy === 'PREDATORY_CAPITALIST')!,
    allMetrics.find((m) => m.seed === 20260012 && m.strategy === 'BALANCED_MERCHANT')!,
    allMetrics.find((m) => m.seed === 20260019 && m.strategy === 'ALCHEMICAL_INDUSTRIALIST')!,
    allMetrics.find((m) => m.seed === 20260025 && m.strategy === 'DUNGEON_LOYALIST')!,
    allMetrics.find((m) => m.seed === 20260033 && m.strategy === 'HERO_BENEFACTOR')!,
    allMetrics.find((m) => m.seed === 20260038 && m.strategy === 'PREDATORY_CAPITALIST')!,
    allMetrics.find((m) => m.seed === 20260040 && m.strategy === 'BALANCED_MERCHANT')!
  ];

  // 6. Write strategy_comparison.json
  const comparisonPayload = {
    meta: {
      simulationId: 'SIM-001',
      timestamp: '2026-10-17T04:21:30-07:00',
      engineVersion: 'v1.0-deterministic (Mulberry32)',
      nodeVersion: process.version,
      totalCampaigns: allMetrics.length,
      seedsPerStrategy: SEEDS_COUNT,
      seedRange: [START_SEED, START_SEED + SEEDS_COUNT - 1],
      horizonDays: HORIZON_DAYS,
      totalTradingDaysSimulated: allMetrics.length * HORIZON_DAYS,
      executionTimeMs: elapsedMs,
      frozenBaselineHashes: {
        'src/types/game.ts': sha256File(path.join(rootDir, 'src/types/game.ts')),
        'src/utils/prng.ts': sha256File(path.join(rootDir, 'src/utils/prng.ts')),
        'src/data/catalog.ts': sha256File(path.join(rootDir, 'src/data/catalog.ts')),
        'src/data/world.ts': sha256File(path.join(rootDir, 'src/data/world.ts')),
        'src/engine/simulation.ts': sha256File(path.join(rootDir, 'src/engine/simulation.ts')),
        'src/App.tsx': sha256File(path.join(rootDir, 'src/App.tsx'))
      }
    },
    pairedSeedComparisons: {
      totalPairedSeeds: SEEDS_COUNT,
      balancedBeatPredatoryNetWorthCount: balancedBeatPredatoryCount,
      industrialistTopWealthCount,
      predatoryHighestClaimsAndFinesCount: predatoryHighestClaimsCount
    },
    strategies: strategySummaries,
    adversarialSuite: adversarialResults,
    notableCampaigns: selectedStories
  };

  const jsonContent = JSON.stringify(comparisonPayload, null, 2) + '\n';
  fs.writeFileSync(path.join(archiveDir, 'strategy_comparison.json'), jsonContent);
  fs.writeFileSync(path.join(rootDir, 'strategy_comparison.json'), jsonContent);
  fs.writeFileSync(path.join(publicSimDir, 'strategy_comparison.json'), jsonContent);

  // Write TypeScript data module src/data/sim001Data.ts
  const tsModuleContent = `// Auto-generated by scripts/run_sim_001.ts from 5,000 real seeded campaigns
export const SIM_001_DATA = ${JSON.stringify(comparisonPayload, null, 2)} as const;
`;
  fs.writeFileSync(path.join(rootDir, 'src/data/sim001Data.ts'), tsModuleContent);

  console.log('[SIM-001] Summary table across 5 strategies:');
  for (const s of STRATEGIES) {
    const st = strategySummaries[s];
    console.log(
      `  ${s}: Rev P50=${st.grossRevenue.p50}g | NetProfit P50=${st.netProfit.p50}g | NetWorth P50=${st.terminalNetWorth.p50}g | Normal D${st.dayReachedNormal.p50} | Hard D${st.dayReachedHard.p50} (${st.hardUnlockRatePct}%) | Expert Strict=${st.expertCatalystStrictRatePct}% | Survival=${st.partySurvivalRatePct.p50}% | Claims+Fines P50=${st.totalClaimsAndFines.p50}g | StrictBankrupt=${st.strictBankruptcyRatePct}%`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
