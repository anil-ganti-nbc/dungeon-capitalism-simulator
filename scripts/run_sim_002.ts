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

async function main() {
  const rootDir = process.cwd();
  const t0 = Date.now();
  console.log(
    `[SIM-002] Starting 5,000-campaign execution on repaired v2.0-sim002 engine (${SEEDS_COUNT} seeds x ${STRATEGIES.length} strategies x ${HORIZON_DAYS} days = ${
      SEEDS_COUNT * STRATEGIES.length * HORIZON_DAYS
    } simulated trading days)...`
  );

  const allMetrics: CampaignMetrics[] = [];
  const boundedEvents: EconomyEventLogEntry[] = [];

  for (let sIdx = 0; sIdx < SEEDS_COUNT; sIdx++) {
    const seed = START_SEED + sIdx;
    const recordEventsForSeed = sIdx < 40;
    for (const strat of STRATEGIES) {
      const { metrics, events } = runSingleCampaign(
        seed,
        strat,
        HORIZON_DAYS,
        recordEventsForSeed
      );
      allMetrics.push(metrics);
      if (recordEventsForSeed) {
        boundedEvents.push(...events);
      }
    }
    if ((sIdx + 1) % 250 === 0) {
      console.log(`[SIM-002] Completed ${(sIdx + 1) * STRATEGIES.length} / 5000 campaigns...`);
    }
  }

  const elapsedMs = Date.now() - t0;
  console.log(`[SIM-002] Completed 5,000 campaigns (600,000 trading days) in ${elapsedMs}ms.`);

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

  const adversarialSuite = runAdversarialTestSuite();
  const notableCampaigns = allMetrics.slice(0, 12);

  // Create SIM-002 archive directories (preserving SIM-001 untouched!)
  const archiveDir = path.join(rootDir, 'sim_002_archive');
  const publicDir = path.join(rootDir, 'public', 'sim_002');
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  // Write CSV
  const csvHeader = [
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
  ].join(',');

  const csvRows = allMetrics.map((m) =>
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

  const csvContent = `${csvHeader}\n${csvRows.join('\n')}\n`;
  fs.writeFileSync(path.join(archiveDir, 'campaign_results.csv'), csvContent);
  fs.writeFileSync(path.join(publicDir, 'campaign_results.csv'), csvContent);

  // Write JSONL
  const jsonlContent = boundedEvents.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(path.join(archiveDir, 'economy_events.jsonl'), jsonlContent);
  fs.writeFileSync(path.join(publicDir, 'economy_events.jsonl'), jsonlContent);

  const sourceFiles = [
    'src/types/game.ts',
    'src/utils/prng.ts',
    'src/data/catalog.ts',
    'src/data/world.ts',
    'src/engine/simulation.ts',
    'src/App.tsx'
  ];
  const fileHashes: Record<string, string> = {};
  for (const rel of sourceFiles) {
    fileHashes[rel] = sha256File(path.join(rootDir, rel));
  }

  const comparisonObj = {
    meta: {
      campaignBatchId: 'SIM-002-FOUNDATION-REPAIR',
      timestampUtc: new Date().toISOString(),
      nodeVersion: process.version,
      rulesVersion: 'v2.0-sim002',
      totalCampaigns: allMetrics.length,
      seedsPerStrategy: SEEDS_COUNT,
      horizonDays: HORIZON_DAYS,
      totalSimulatedDays: allMetrics.length * HORIZON_DAYS,
      executionTimeMs: elapsedMs,
      sourceFileSha256: fileHashes
    },
    strategies: strategySummaries,
    pairedComparisons: {
      balancedBeatPredatoryCount,
      balancedBeatPredatoryPct: Math.round((balancedBeatPredatoryCount / SEEDS_COUNT) * 1000) / 10,
      industrialistTopWealthCount,
      predatoryHighestClaimsCount,
      predatoryHighestClaimsPct: Math.round((predatoryHighestClaimsCount / SEEDS_COUNT) * 1000) / 10
    },
    adversarialSuite,
    notableCampaigns
  };

  const compJson = JSON.stringify(comparisonObj, null, 2);
  fs.writeFileSync(path.join(archiveDir, 'strategy_comparison.json'), compJson);
  fs.writeFileSync(path.join(publicDir, 'strategy_comparison.json'), compJson);

  // Write src/data/sim002Data.ts for in-app Audit Workspace
  const tsModule = `// Auto-generated by scripts/run_sim_002.ts from 5,000-campaign SIM-002 execution
export const SIM_002_DATA = ${compJson} as const;
`;
  fs.writeFileSync(path.join(rootDir, 'src', 'data', 'sim002Data.ts'), tsModule);

  // Print summary table to console
  for (const strat of STRATEGIES) {
    const s = strategySummaries[strat];
    console.log(
      `[SIM-002] ${strat}: Rev P50=${s.grossRevenue.p50}g | NetProfit P50=${s.netProfit.p50}g | NetWorth P50=${s.terminalNetWorth.p50}g | Insolvent=${s.strictBankruptcyRatePct}% | Normal=D${s.dayReachedNormal.p50} (${s.normalUnlockRatePct}%) | Hard=D${s.dayReachedHard.p50} (${s.hardUnlockRatePct}%) | Expert=${s.expertCatalystStrictRatePct}% (UI=${s.expertCatalystUiRuleRatePct}%) | Survival=${s.partySurvivalRatePct.p50}%`
    );
  }
  for (const adv of adversarialSuite) {
    console.log(`[SIM-002 REGRESSION] ${adv.testId} (${adv.name}): ${adv.status}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
