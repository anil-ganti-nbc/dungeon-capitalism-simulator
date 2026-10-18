import { GameSaveState } from '../types/game';
import { INITIAL_PRODUCTS, REAGENTS_CATALOG, TRAP_PARTS_CATALOG } from '../data/catalog';
import { hashString } from '../utils/prng';
import { createInitialSaveState } from './initialState';
export { createInitialSaveState } from './initialState';

export const SAVE_STORAGE_KEY = 'trap_and_tonic_save_v2';
export const SAVE_BACKUP_KEY = 'trap_and_tonic_save_v2_backup';
export const HISTORICAL_V2_BACKUP_KEY = 'trap_and_tonic_backup_v2';
export const LEGACY_BACKUP_KEY = 'trap_and_tonic_save_v1_backup';
export const LEGACY_SAVE_KEY = 'trap_and_tonic_save_v1';
export const QUARANTINE_KEY = 'trap_and_tonic_quarantined_corrupt_save';
const SOURCES = [[SAVE_STORAGE_KEY, 'PRIMARY'], [SAVE_BACKUP_KEY, 'BACKUP'],
  [HISTORICAL_V2_BACKUP_KEY, 'HISTORICAL_V2_BACKUP'], [LEGACY_BACKUP_KEY, 'LEGACY_BACKUP'],
  [LEGACY_SAVE_KEY, 'LEGACY']] as const;
export interface SaveValidationResult { valid: boolean; state?: GameSaveState; error?: string; }
export interface SaveLoadResult {
  state: GameSaveState; source: typeof SOURCES[number][1] | 'FRESH';
  recovered: boolean; notice?: string; writeBlocked?: boolean;
}
const regions = ['cellar', 'warrens', 'blackspire', 'vault'];
const reagentIds = new Set(REAGENTS_CATALOG.map(r => r.id));
const partIds = new Set(TRAP_PARTS_CATALOG.map(p => p.id));
function ensure(ok: unknown, path: string): asserts ok { if (!ok) throw new Error(`Invalid save: ${path}`); }
function object(x: any) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
function finite(x: any) { return typeof x === 'number' && Number.isFinite(x); }
function count(x: any) { return Number.isSafeInteger(x) && x >= 0; }
function strings(x: any) { return Array.isArray(x) && x.every(v => typeof v === 'string'); }
function fields(x: any, template: any, path: string) {
  ensure(object(x), path);
  for (const [k, v] of Object.entries(template)) {
    if (Array.isArray(v)) ensure(Array.isArray(x[k]), `${path}.${k}`);
    else if (typeof v === 'number') ensure(finite(x[k]), `${path}.${k}`);
    else ensure(typeof x[k] === typeof v && x[k] !== null, `${path}.${k}`);
  }
}
function unique(xs: any[], path: string) {
  ensure(new Set(xs.map(x => x.id)).size === xs.length, `${path}: duplicate IDs`);
}

/** Only explicitly versioned additions are defaulted. Damaged progress/stat fields are never guessed. */
export function normalizeLoadedSave(input: Partial<GameSaveState>): GameSaveState {
  const s = structuredClone(input) as GameSaveState;
  ensure(object(s) && ['1.0.0', '2.0.0-sim002', '2.1.0-sim002b'].includes(s.version), 'unsupported persistence version');
  const legacy = s.version !== '2.1.0-sim002b';
  if (legacy) {
    s.customBrewsCount ??= 0; s.customTrapsCount ??= 0; s.insolvencyEvents ??= 0;
    s.rulesVersion ??= 'v2.0-sim002';
    s.tradeTerms ??= { priceMultiplier: 1, warrantyBacked: false, exclusiveDeal: false, secretProvenance: false };
    // Older UI omitted the ninth catalogue entry despite already installing it. Restore only its definition, no shop stock.
    if (Array.isArray(s.products) && Array.isArray(s.masters) && Array.isArray(s.parties)) {
      const refs = [...s.masters.flatMap(m => m?.installedHazards ?? []), ...s.parties.flatMap(p => p?.equippedProducts ?? [])];
      for (const id of new Set(refs)) if (!s.products.some(p => p?.id === id)) {
        const known = INITIAL_PRODUCTS.find(p => p.id === id);
        if (known) s.products.push({ ...structuredClone(known), stock: 0 });
      }
    }
    for (const m of s.masters ?? []) if (m && Array.isArray(m.installedHazards)) m.installedResetCharges ??= m.installedHazards.map(() => 0);
    const sched: any = s.scheduledMatchups ?? {};
    for (const r of regions) {
      const m = s.masters?.find(m => m?.id === sched[r]?.masterId && m.region === r) ?? s.masters?.find(m => m?.region === r);
      const p = s.parties?.find(p => p?.id === sched[r]?.partyId && p.region === r) ?? s.parties?.find(p => p?.region === r);
      sched[r] = { masterId: m?.id, partyId: p?.id };
    }
    s.scheduledMatchups = sched;
  }
  validateState(s);
  s.version = '2.1.0-sim002b';
  return s;
}

function validateState(s: GameSaveState) {
  const base = createInitialSaveState(s.seed);
  fields(s, base, 'state');
  ensure(count(s.seed) && count(s.day) && s.day > 0, 'seed/day');
  ensure(finite(s.gold) && finite(s.debt) && s.gold >= 0 && s.debt >= 0, 'cash/debt');
  for (const k of ['skillPoints','customBrewsCount','customTrapsCount','basiliskChainStage','insolvencyEvents'] as const) ensure(count(s[k]), k);
  ensure(s.rulesVersion === 'v2.0-sim002', 'rulesVersion');
  ensure(['MORNING','PREPARATION','TRADE','EXPEDITIONS','EVENING'].includes(s.phase), 'phase');
  ensure(strings(s.unlockedRegions) && s.unlockedRegions.length > 0 && s.unlockedRegions.every(r => regions.includes(r)) && s.unlockedRegions.includes(s.activeRegion), 'regions');
  ensure(['NONE','HONEST_BROKER','CARTEL_SYNDICATE','PARTISAN_ARMOURER','CALCULATED_CHAOS'].includes(s.blackspireResolution), 'resolution');
  for (const k of ['reagentInventory','partInventory'] as const) {
    const knownIds = k === 'reagentInventory' ? reagentIds : partIds;
    ensure(object(s[k]) && Object.entries(s[k]).every(([id,n]) => knownIds.has(id) && count(n)), `${k}: unknown identifier or invalid quantity`);
  }
  ensure(Array.isArray(s.products) && s.products.length > 0, 'products');
  for (const p of s.products) {
    // Formula metadata is optional in historical products; every gameplay stat is mandatory.
    const { formulaSignature, rulesVersion, appliedSkills, ...template } = base.products[0];
    fields(p, template, 'product');
    ensure(p.id.length > 0 && count(p.stock) && p.productionCost >= 0 && p.suggestedPrice >= 0, 'product counters');
    ensure(['HERO','MASTER','BOTH'].includes(p.targetAudience), 'product audience');
    ensure(['TONIC_HERO','COUNTER_GEAR','TRAP_MASTER','HAZARD_MONSTER','DUAL_SOLVENT'].includes(p.category), 'product category');
    for (const k of ['counterClasses','recipeComponents','reactionNotes'] as const) ensure(strings(p[k]), `product.${k}`);
    ensure(p.recipeComponents.every(id => reagentIds.has(id) || partIds.has(id)), 'product recipe references');
    ensure(p.counterClasses.every(c => ['detection','disruption','resistance','bypass_mass','sabotage','routing','filtration'].includes(c)), 'counter classes');
    for (const k of ['formulaSignature','rulesVersion'] as const) if (p[k] !== undefined) ensure(typeof p[k] === 'string', `product.${k}`);
    if (p.appliedSkills !== undefined) ensure(strings(p.appliedSkills), 'applied skills');
    for (const k of ['potency','stability','reliability','detectionDC'] as const) ensure(p[k] >= 0 && p[k] <= 100, `product.${k}`);
  }
  unique(s.products, 'products');
  const sku = new Set(s.products.map(p => p.id));
  for (const [list, template, kind] of [[s.masters, base.masters[0], 'master'], [s.parties, base.parties[0], 'party']] as const) {
    ensure(Array.isArray(list) && list.length > 0, kind);
    for (const c of list) {
      fields(c, template, kind);
      ensure(regions.includes(c.region) && c.budget >= 0 && c.trust >= 0 && c.trust <= 100, `${kind} budget/trust/region`);
      ensure(strings(c.memoryLog), `${kind} memory`);
      if ('members' in c) {
        ensure(c.members.length > 0, 'party members');
        for (const m of c.members) {
          fields(m, base.parties[0].members[0], 'member');
          ensure(m.massKg > 0 && m.maxHp > 0 && m.hp >= 0 && m.hp <= m.maxHp, 'member stats');
          ensure(['Vanguard','Alchemist','Scout','Arcanist'].includes(m.role) && ['Healthy','Petrified','Poisoned','Recovering'].includes(m.status), 'member enums');
        }
        ensure(strings(c.observedTraps) && strings(c.equippedProducts) && c.equippedProducts.every(id => sku.has(id)), 'party SKU references');
        ensure(c.equippedProducts.length <= 4, 'party loadout exceeds four charges');
      } else {
        ensure(strings(c.knownHeroCounters) && strings(c.installedHazards) && c.installedHazards.every(id => sku.has(id)), 'master SKU references');
        ensure(c.installedHazards.length <= 3, 'master loadout exceeds three installations');
        ensure(count(c.catalystCommissionStage), 'commission stage');
        ensure(Array.isArray(c.installedResetCharges) && c.installedResetCharges.length === c.installedHazards.length && c.installedResetCharges.every((n,i) => count(n) && n <= 1 && (n === 0 || s.products.find(p=>p.id===c.installedHazards[i])?.recipeComponents.includes('part_rst_09'))), 'temporal slot charges');
      }
    }
    unique(list as any[], kind);
  }
  ensure(object(s.scheduledMatchups), 'schedule');
  for (const r of regions) {
    const match = s.scheduledMatchups[r as keyof typeof s.scheduledMatchups];
    ensure(match && s.masters.some(m => m.id === match.masterId && m.region === r) && s.parties.some(p => p.id === match.partyId && p.region === r), `schedule.${r}`);
  }
  for (const skill of s.skills) {
    const known = base.skills.find(k => k.id === skill?.id);
    ensure(known, 'unknown skill'); fields(skill, known, 'skill');
    ensure(skill.effectKey === known.effectKey && skill.costPoints === known.costPoints, 'skill identity');
  }
  unique(s.skills,'skills'); ensure(s.skills.length === base.skills.length, 'missing skills');
  for (const r of s.rivals) fields(r, base.rivals[0], 'rival');
  for (const i of s.intelFeed) { fields(i, base.intelFeed[0], 'intel'); ensure(count(i.day) && regions.includes(i.region), 'intel day/region'); }
  const contract = { id:'',day:1,buyerType:'',buyerId:'',buyerName:'',productId:'',productName:'',quantity:1,unitPrice:0,totalRevenue:0,unitCost:0,warrantyBacked:false,exclusiveDeal:false,secretProvenance:false,creditFinanced:false };
  for (const xs of [s.contractsToday,s.contractHistory]) {
    for (const c of xs) {
      fields(c,contract,'contract'); ensure(count(c.day) && c.day > 0 && count(c.quantity) && c.quantity > 0 && c.unitPrice >= 0 && c.unitCost >= 0 && c.totalRevenue === c.quantity*c.unitPrice, 'contract values');
      ensure(sku.has(c.productId) && (c.buyerType === 'MASTER' ? s.masters : c.buyerType === 'HERO' ? s.parties : []).some(b => b.id === c.buyerId), 'contract references');
      if (c.marketContext) market(c.marketContext);
    } unique(xs,'contracts');
  }
  ensure(s.contractsToday.every(c => s.contractHistory.some(h => JSON.stringify(c) === JSON.stringify(h))), 'daily contract history');
  const financial = { day:1,grossRevenue:0,cogs:0,grossMargin:0,overheadAndStorage:0,warrantyAndClaims:0,finesAndBribes:0,financingInterest:0,netProfit:0,endingCash:0,inventoryValue:0,debt:0,netWorth:0 };
  for (const f of s.financialLedger) { fields(f,financial,'financial'); ensure(count(f.day) && f.endingCash >= 0 && f.debt >= 0, 'financial counters'); if (f.marketContext) market(f.marketContext); }
  for (const c of s.catalystLedger) { fields(c,{id:'',senderName:'',senderType:'',provenanceHash:'',dayReceived:1,commissionNote:'',isAuthentic:false},'catalyst'); ensure(['SOLO_DM_COURIER','PEER_QR_EXCHANGE'].includes(c.senderType) && count(c.dayReceived), 'catalyst type/day'); ensure(c.senderType !== 'PEER_QR_EXCHANGE' || !c.isAuthentic, 'community code authenticity'); }
  for (const r of s.expeditionReports) {
    fields(r,{id:'',day:1,seed:1,rulesVersion:'',region:'',masterId:'',masterName:'',partyId:'',partyName:'',masterSupplies:[],heroSupplies:[],rooms:[],totalLooted:0,masterTreasuryDelta:0,partyBudgetDelta:0,warrantyClaimsTriggered:0,exclusivityBreachDetected:false,doubleSaleDemandCreated:[],summaryHeadline:''},'report');
    ensure(s.masters.some(m=>m.id===r.masterId) && s.parties.some(p=>p.id===r.partyId) && r.rooms.length>0, 'report references');
    for (const k of ['masterSupplies','heroSupplies','doubleSaleDemandCreated'] as const) ensure(strings(r[k]), `report.${k}`);
    for (const room of r.rooms) {
      fields(room,{roomIndex:1,roomName:'',hazardName:'',hazardId:'',triggerType:'',triggerMassThresholdKg:0,heroEffectiveMassKg:1,outcome:'',damageDealt:0,lootSecured:0,causalExplanation:'',learnedByHeroes:'',learnedByMaster:''},'room');
      for (const k of ['heroCounterUsed','chemicalReaction','casualtyName'] as const) ensure(room[k] === null || typeof room[k] === 'string', `room.${k}`);
    }
  }
  fields(s.tradeTerms, base.tradeTerms, 'trade terms'); ensure(s.tradeTerms!.priceMultiplier > 0, 'trade price');
}
function market(m: any) {
  fields(m,{version:'',rulesVersion:'',seed:1,day:1,region:'',factor:1},'market');
  ensure(m.version === 'market-v1' && m.factor >= .85 && m.factor < 1.22 && regions.includes(m.region), 'market context');
}
export function validateSavePayload(raw: string | null | undefined): SaveValidationResult {
  try { ensure(typeof raw === 'string' && raw.length > 0, 'empty data');
    return { valid: true, state: normalizeLoadedSave(JSON.parse(raw)) };
  } catch (err) { return { valid: false, error: String(err) }; }
}
export function quarantinePayload(storage: Storage, raw: string) {
  const key = `${QUARANTINE_KEY}:${hashString(raw)}`;
  if (!storage.getItem(key)) storage.setItem(key, raw);
  if (!storage.getItem(QUARANTINE_KEY)) storage.setItem(QUARANTINE_KEY, raw);
}
export function loadGameWithRecovery(storage: Storage = localStorage): SaveLoadResult {
  const original = Object.fromEntries(SOURCES.map(([key]) => [key, storage.getItem(key)]));
  let rejected = false; let archiveFailed = false;
  for (const [key, source] of SOURCES) {
    const raw = original[key]; if (!raw) continue;
    const check = validateSavePayload(raw);
    if (!check.valid) { rejected = true; try { quarantinePayload(storage,raw); } catch { archiveFailed = true; } continue; }
    const migrated = JSON.stringify(check.state) !== raw;
    // Archive original storage before changing any checkpoint. On quota failure leave all slots untouched.
    if (migrated || source !== 'PRIMARY') {
      try { const snapshot = JSON.stringify(original); const id = `trap_and_tonic_pre_migration:${hashString(snapshot)}`;
        if (!storage.getItem(id)) storage.setItem(id,snapshot);
      } catch { archiveFailed = true; }
    }
    return { state: check.state!, source, recovered: source !== 'PRIMARY' || migrated,
      writeBlocked: archiveFailed,
      notice: source !== 'PRIMARY' || migrated || rejected || archiveFailed
        ? `Recovered ${key}: Day ${check.state!.day}, ${check.state!.gold}g. Original checkpoints preserved.${archiveFailed ? ' Storage full: autosave paused; export your ledger.' : ''}` : undefined };
  }
  return { state: createInitialSaveState(), source:'FRESH', recovered:false, writeBlocked:rejected,
    notice: rejected ? 'No trustworthy checkpoint found. Original saves quarantined; autosave paused. Import a valid ledger or explicitly start a new campaign.' : undefined };
}
export function persistAtomicSaveSafe(state: GameSaveState, storage: Storage = localStorage): boolean {
  try {
    const original = JSON.stringify(state);
    const outgoing = validateSavePayload(original);
    if (!outgoing.valid) { quarantinePayload(storage, original); return false; }
    const serialized = JSON.stringify(outgoing.state);
    const previous = storage.getItem(SAVE_STORAGE_KEY);
    if (previous === serialized) return true;
    if (previous && validateSavePayload(previous).valid) storage.setItem(SAVE_BACKUP_KEY,previous);
    storage.setItem(SAVE_STORAGE_KEY,serialized);
    return true;
  } catch { return false; }
}
