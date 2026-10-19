import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REAGENTS_CATALOG, TRAP_PARTS_CATALOG, INITIAL_PRODUCTS, SKILL_TREE_NODES, getBlueprintCatalogCount } from '../src/data/catalog';
import { REGIONS_DATA, INITIAL_MASTERS, INITIAL_PARTIES, INITIAL_RIVALS, INITIAL_INTEL_FEED } from '../src/data/world';
import { createInitialSaveState } from '../src/engine/initialState';
import { assembleTrapProduct, synthesizeAlchemyProduct, simulateRegionExpedition } from '../src/engine/simulation';

// Diagnostic inventory: registration, construction and controlled engine execution are deliberately separate.
const output = process.env.EVIDENCE_DIR ?? 'artifacts/content-reconciliation';
assert(!fs.existsSync(path.join(output, 'inventory.json')), 'Do not overwrite a frozen inventory');
fs.mkdirSync(output, { recursive: true });
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const catalogs = { regions: REGIONS_DATA, masters: INITIAL_MASTERS, parties: INITIAL_PARTIES,
  rivals: INITIAL_RIVALS, reagents: REAGENTS_CATALOG, modules: TRAP_PARTS_CATALOG,
  authoredProducts: INITIAL_PRODUCTS, skills: SKILL_TREE_NODES, initialIntelEntries: INITIAL_INTEL_FEED };
const counts = Object.fromEntries(Object.entries(catalogs).map(([name, rows]) => {
  const ids = rows.map(row => row.id);
  assert.equal(new Set(ids).size, ids.length, `Duplicate ${name} IDs`);
  return [name, { rows: rows.length, uniqueIds: new Set(ids).size }];
}));
const grouped: Record<string, unknown> = {};
for (const [name, rows, key] of [
  ['masters', INITIAL_MASTERS, 'region'], ['parties', INITIAL_PARTIES, 'region'],
  ['reagents', REAGENTS_CATALOG, 'role'], ['modules', TRAP_PARTS_CATALOG, 'role'],
  ['skills', SKILL_TREE_NODES, 'branch']
] as const) {
  const groups: Record<string, number> = {};
  for (const row of rows) { const group = String((row as unknown as Record<string, unknown>)[key]); groups[group] = (groups[group] ?? 0) + 1; }
  grouped[name] = groups;
}
const tupleTrap = ['part_trg_01', 'part_con_01', 'part_del_01', 'part_pay_01', 'part_pow_01', 'part_rst_01'].map(id => TRAP_PARTS_CATALOG.find(part => part.id === id)!);
const tupleAlchemy = ['reg_base_02', 'reg_act_01', 'reg_car_02', 'reg_stb_01', 'reg_cat_01'].map(id => REAGENTS_CATALOG.find(reagent => reagent.id === id)!);
const mechanicalKeys = ['potency', 'stability', 'reliability', 'massEffectKg', 'sulphurVulnerable', 'emitsSulphurFog', 'causesPetrification',
  'curesPetrification', 'filtersSulphur', 'triggerMassThresholdKg', 'detectionDC', 'damageType', 'counterClasses'] as const;
const constructionCases: unknown[] = [];
const signatures: Record<string, Set<string>> = { trap: new Set(), alchemy: new Set() };
for (const kind of ['trap', 'alchemy'] as const) {
  const source = kind === 'trap' ? TRAP_PARTS_CATALOG : REAGENTS_CATALOG;
  const defaults = kind === 'trap' ? tupleTrap : tupleAlchemy;
  for (const component of source) {
    const index = defaults.findIndex(row => row.role === component.role);
    assert(index >= 0, 'Every catalogue role must be a supported construction slot');
    const selected = [...defaults]; selected[index] = component as never;
    const product = kind === 'trap'
      ? assembleTrapProduct(selected as Parameters<typeof assembleTrapProduct>[0], 'Diagnostic tuple', false, false)
      : synthesizeAlchemyProduct(selected as Parameters<typeof synthesizeAlchemyProduct>[0], 'Diagnostic tuple', false);
    const projection = Object.fromEntries(mechanicalKeys.map(key => [key, product[key]]));
    signatures[kind].add(JSON.stringify(projection));
    constructionCases.push({ kind, substitutedId: component.id, tuple: product.recipeComponents, productId: product.id, projection,
      // Cost and composition are retained separately; projected equality is NOT a proof of economic equivalence.
      productionCost: product.productionCost, suggestedPrice: product.suggestedPrice });
  }
}
const state = createInitialSaveState();
const initial = structuredClone(state);
const encounters = [];
for (const region of REGIONS_DATA) {
  for (const master of state.masters.filter(row => row.region === region.id)) {
    for (const party of state.parties.filter(row => row.region === region.id)) {
      const report = simulateRegionExpedition(1, state.seed, master, party, state.products, []);
      assert.equal(report.region, region.id);
      encounters.push({ region: region.id, masterId: master.id, partyId: party.id,
        roomNames: report.rooms.map(room => room.roomName), outcomes: report.rooms.map(room => room.outcome) });
    }
  }
}
assert.deepEqual(state, initial, 'Diagnostic engine execution must not mutate source clients');
const fields = ['observedTraps','knownHeroCounters','maintenanceCost','heatAffinity','duration','contamination','perishability',
  'priceUndercutPct','aggressiveness','catalystCommissionStage','marketShare','desiredTrait','desiredCounter'];
const accesses: Record<string, { file: string; line: number; expression: string }[]> = Object.fromEntries(fields.map(field => [field, []]));
for (const dir of ['engine', 'components']) {
  for (const entry of fs.readdirSync(`src/${dir}`)) {
    if (!/\.tsx?$/.test(entry)) continue;
    const filename = `src/${dir}/${entry}`;
    const text = fs.readFileSync(filename, 'utf8');
    for (const [index, line] of text.split('\n').entries()) {
      for (const field of fields) {
        const pattern = new RegExp(`\\b[\\w.]+\\.${field}\\b`, 'g');
        for (const match of line.matchAll(pattern)) {
          accesses[field].push({ file: filename, line: index + 1, expression: match[0] });
        }
      }
    }
  }
}
const result = {
  sourceHead, workingTree: execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8' }),
  evidenceClass: 'Source registration + controlled engine diagnostics; not full-content or human-play acceptance',
  counts, grouped, reportedAuthoredBlueprintCount: getBlueprintCatalogCount(),
  catalogs, constructionCases,
  constructionSummary: Object.fromEntries(Object.entries(signatures).map(([kind, values]) => [kind, { distinctProjectedMechanicalOutputs: values.size }])),
  constructionLimit: 'One-slot substitutions about one baseline with no skill variants. Neither an exhaustive combination count nor a proof of each part being consequential in all contexts.',
  encounters, encounterCount: encounters.length,
  distinctRoomNames: [...new Set(encounters.flatMap(encounter => encounter.roomNames))],
  propertyAccesses: accesses,
  sourceAccessLimit: 'Lexical dot-property references in engine/components only (not AST/data-flow analysis; includes any matching comments/strings and omits bracket access/App). Empty results are leads corroborated by manual source tracing, not a universal whole-program absence proof.',
};
fs.writeFileSync(path.join(output, 'inventory.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ sourceHead, counts, grouped, authoredBlueprints: result.reportedAuthoredBlueprintCount,
  constructionSummary: result.constructionSummary, encounterCount: result.encounterCount, roomNames: result.distinctRoomNames }, null, 2));
