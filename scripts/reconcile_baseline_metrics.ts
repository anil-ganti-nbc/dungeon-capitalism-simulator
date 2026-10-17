import * as fs from 'fs';
import * as path from 'path';

function parseCsv(filepath: string) {
  const content = fs.readFileSync(filepath, 'utf8').trim();
  const lines = content.split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = parts[idx] !== undefined ? parts[idx].trim() : '';
    });
    rows.push(obj);
  }
  return rows;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const sim001Path = path.resolve(process.cwd(), 'sim_001_archive/campaign_results.csv');
const sim002Path = path.resolve(process.cwd(), 'sim_002_archive/campaign_results.csv');
const sim001Rows = parseCsv(sim001Path);
const sim002Rows = fs.existsSync(sim002Path) ? parseCsv(sim002Path) : [];

const strategies = [
  'BALANCED_MERCHANT',
  'DUNGEON_LOYALIST',
  'HERO_BENEFACTOR',
  'ALCHEMICAL_INDUSTRIALIST',
  'PREDATORY_CAPITALIST'
];

console.log('--- RECONCILED FROZEN SIM-001 MEDIANS ---');
const sim001Stats: Record<string, any> = {};

for (const st of strategies) {
  const stRows = sim001Rows.filter((r) => r.strategy === st);
  const rev = stRows.map((r) => Number(r.grossRevenue));
  const profit = stRows.map((r) => Number(r.netProfit));
  const netWorth = stRows.map((r) => Number(r.terminalNetWorth));
  const claims = stRows.map((r) => Number(r.totalClaimsAndFines));
  const interest = stRows.map((r) => Number(r.totalInterestPaid));
  const bailouts = stRows.map((r) => Number(r.bailoutFloorTriggeredDays));
  const survival = stRows.map((r) => Number(r.partySurvivalRatePct));
  const bankruptCount = stRows.filter((r) => r.strictBankruptcyOccurred === 'true').length;
  const normalCount = stRows.filter((r) => r.dayReachedNormal && r.dayReachedNormal !== '').length;
  const hardCount = stRows.filter((r) => r.dayReachedHard && r.dayReachedHard !== '').length;
  const expertStrictCount = stRows.filter((r) => r.catalystObtainedStrict === 'true').length;
  const expertUiCount = stRows.filter((r) => r.catalystObtainedUiRule === 'true').length;

  sim001Stats[st] = {
    count: stRows.length,
    grossRevenueP50: median(rev),
    netProfitP50: median(profit),
    terminalNetWorthP50: median(netWorth),
    claimsP50: median(claims),
    interestP50: median(interest),
    bailoutDaysP50: median(bailouts),
    survivalP50: median(survival),
    bankruptcyPct: (bankruptCount / stRows.length) * 100,
    normalUnlockPct: (normalCount / stRows.length) * 100,
    hardUnlockPct: (hardCount / stRows.length) * 100,
    expertStrictPct: (expertStrictCount / stRows.length) * 100,
    expertUiPct: (expertUiCount / stRows.length) * 100
  };

  console.log(`${st}:
    GrossRev P50: ${median(rev)}g
    NetProfit P50: ${median(profit)}g
    NetWorth P50: ${median(netWorth)}g
    Claims P50: ${median(claims)}g
    BailoutDays P50: ${median(bailouts)}d
    Bankruptcy Rate: ${(bankruptCount / stRows.length) * 100}%
    Hard Unlock: ${(hardCount / stRows.length) * 100}%
    Expert Strict: ${(expertStrictCount / stRows.length) * 100}%
    Expert UI: ${(expertUiCount / stRows.length) * 100}%
    Survival P50: ${median(survival)}%
  `);
}

fs.writeFileSync(
  path.resolve(process.cwd(), 'sim_001_archive/reconciled_baseline_stats.json'),
  JSON.stringify(sim001Stats, null, 2)
);
console.log('Wrote /sim_001_archive/reconciled_baseline_stats.json');
