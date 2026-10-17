import { GameSaveState } from '../types/game';
import { INITIAL_PRODUCTS, SKILL_TREE_NODES } from '../data/catalog';
import { INITIAL_MASTERS, INITIAL_PARTIES, INITIAL_RIVALS, REGIONS_DATA } from '../data/world';

export const SAVE_STORAGE_KEY = 'trap_and_tonic_save_v2';
export const SAVE_BACKUP_KEY = 'trap_and_tonic_save_v2_backup';
export const LEGACY_SAVE_KEY = 'trap_and_tonic_save_v1';

export interface SaveValidationResult {
  valid: boolean;
  state?: Partial<GameSaveState>;
  error?: string;
}

export interface SaveLoadResult {
  state: GameSaveState;
  source: 'PRIMARY' | 'BACKUP' | 'LEGACY' | 'FRESH';
  recovered: boolean;
  notice?: string;
}

export function createInitialSaveState(): GameSaveState {
  return {
    version: '2.0.0-sim002',
    day: 1,
    seed: 20260001,
    phase: 'MORNING',
    gold: 1850,
    debt: 0,
    insolvencyEvents: 0,
    unlockedRegions: ['cellar'],
    activeRegion: 'cellar',
    expertUnlocked: false,
    rulesVersion: 'v2.0-sim002',
    basiliskChainStage: 1,
    blackspireResolution: 'NONE',
    rivals: INITIAL_RIVALS,
    reagentInventory: {
      reg_base_01: 6,
      reg_base_02: 6,
      reg_act_01: 4,
      reg_act_02: 4,
      reg_car_01: 5,
      reg_stb_01: 5,
      reg_cat_01: 5
    },
    partInventory: {
      part_trg_01: 4,
      part_trg_02: 3,
      part_con_01: 4,
      part_con_02: 4,
      part_del_01: 4,
      part_del_02: 3,
      part_pay_01: 4,
      part_pay_02: 3,
      part_pow_01: 4,
      part_rst_01: 4
    },
    products: INITIAL_PRODUCTS.slice(0, 8),
    masters: INITIAL_MASTERS,
    parties: INITIAL_PARTIES,
    contractsToday: [],
    contractHistory: [],
    expeditionReports: [],
    intelFeed: [
      {
        id: 'intel_initial_01',
        day: 1,
        timestamp: '06:00 AM',
        region: 'cellar',
        headline: 'Alderman Vance Secures Disgraced Vault; Irregulars Seek Antidotes',
        summary:
          'Town Watch audit confirms Vance installed 45kg Pressure Plates and Cave-Basilisks. The Cobblestone Irregulars equipped with heavy morningstars require Basilisk Antidotes.',
        verifiedFact: true,
        masterId: 'mst_vance',
        partyId: 'pty_irregulars'
      }
    ],
    financialLedger: [],
    skills: SKILL_TREE_NODES,
    skillPoints: 3,
    catalystLedger: [],
    customBrewsCount: 0,
    customTrapsCount: 0,
    tradeTerms: {
      priceMultiplier: 1.0,
      warrantyBacked: false,
      exclusiveDeal: false,
      secretProvenance: false
    },
    scheduledMatchups: {
      cellar: { masterId: 'mst_vance', partyId: 'pty_irregulars' },
      warrens: { masterId: 'mst_duchess', partyId: 'pty_iron_anvil' },
      blackspire: { masterId: 'mst_malakor', partyId: 'pty_ash_hound' },
      vault: { masterId: 'mst_cassia', partyId: 'pty_sovereign' }
    }
  };
}

export function validateSavePayload(raw: string | null | undefined): SaveValidationResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Empty or missing save data' };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Parsed save payload is not an object' };
    }
    if (typeof parsed.day !== 'number' || parsed.day < 1 || !Number.isFinite(parsed.day)) {
      return { valid: false, error: 'Invalid or missing day number' };
    }
    if (typeof parsed.gold !== 'number' || !Number.isFinite(parsed.gold)) {
      return { valid: false, error: 'Invalid or missing gold amount' };
    }
    if (!Array.isArray(parsed.products)) {
      return { valid: false, error: 'Missing products inventory array' };
    }
    return { valid: true, state: parsed as Partial<GameSaveState> };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'JSON parse error' };
  }
}

export function normalizeLoadedSave(parsed: Partial<GameSaveState>): GameSaveState {
  const base = createInitialSaveState();
  return {
    ...base,
    ...parsed,
    day: typeof parsed.day === 'number' ? parsed.day : base.day,
    gold: typeof parsed.gold === 'number' ? parsed.gold : base.gold,
    debt: typeof parsed.debt === 'number' ? parsed.debt : 0,
    insolvencyEvents: typeof parsed.insolvencyEvents === 'number' ? parsed.insolvencyEvents : 0,
    rulesVersion: 'v2.0-sim002',
    customBrewsCount: typeof parsed.customBrewsCount === 'number' ? parsed.customBrewsCount : 0,
    customTrapsCount: typeof parsed.customTrapsCount === 'number' ? parsed.customTrapsCount : 0,
    tradeTerms: {
      ...base.tradeTerms,
      ...(parsed.tradeTerms || {})
    },
    scheduledMatchups: {
      ...base.scheduledMatchups,
      ...(parsed.scheduledMatchups || {})
    },
    products: Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : base.products,
    masters: Array.isArray(parsed.masters) && parsed.masters.length > 0 ? parsed.masters : base.masters,
    parties: Array.isArray(parsed.parties) && parsed.parties.length > 0 ? parsed.parties : base.parties,
    skills: Array.isArray(parsed.skills) && parsed.skills.length > 0 ? parsed.skills : base.skills,
    catalystLedger: Array.isArray(parsed.catalystLedger) ? parsed.catalystLedger : [],
    contractHistory: Array.isArray(parsed.contractHistory) ? parsed.contractHistory : [],
    contractsToday: Array.isArray(parsed.contractsToday) ? parsed.contractsToday : [],
    expeditionReports: Array.isArray(parsed.expeditionReports) ? parsed.expeditionReports : [],
    financialLedger: Array.isArray(parsed.financialLedger) ? parsed.financialLedger : [],
    intelFeed: Array.isArray(parsed.intelFeed) ? parsed.intelFeed : base.intelFeed
  };
}

/**
 * Non-destructive save loader with corruption detection and backup recovery (Fixes Codex A02).
 * If primary save is malformed/corrupted:
 * 1. Checks backup save. If valid, restores backup without destroying it.
 * 2. Checks legacy save. If valid, restores legacy save.
 * 3. Never overwrites a healthy backup with corrupted text.
 */
export function loadGameWithRecovery(storage: Storage = localStorage): SaveLoadResult {
  const primaryRaw = storage.getItem(SAVE_STORAGE_KEY);
  const primaryCheck = validateSavePayload(primaryRaw);

  if (primaryCheck.valid && primaryCheck.state) {
    return {
      state: normalizeLoadedSave(primaryCheck.state),
      source: 'PRIMARY',
      recovered: false
    };
  }

  // Primary is missing or corrupted! Try backup save
  const backupRaw = storage.getItem(SAVE_BACKUP_KEY);
  const backupCheck = validateSavePayload(backupRaw);

  if (backupCheck.valid && backupCheck.state) {
    const recoveredState = normalizeLoadedSave(backupCheck.state);
    // Heal primary slot with the recovered valid backup so subsequent loads succeed cleanly
    try {
      storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(recoveredState));
      // NOTE: Do NOT overwrite SAVE_BACKUP_KEY! Keep the valid backup intact.
    } catch {
      // Ignore storage errors in sandboxed test runners
    }

    return {
      state: recoveredState,
      source: 'BACKUP',
      recovered: true,
      notice: `Primary save was corrupted or unreadable. Successfully restored from Day ${recoveredState.day} backup (${recoveredState.gold}g).`
    };
  }

  // Backup was missing/invalid too, try legacy v1 save
  const legacyRaw = storage.getItem(LEGACY_SAVE_KEY);
  const legacyCheck = validateSavePayload(legacyRaw);

  if (legacyCheck.valid && legacyCheck.state) {
    const legacyState = normalizeLoadedSave(legacyCheck.state);
    try {
      storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(legacyState));
    } catch {
      // Ignore
    }

    return {
      state: legacyState,
      source: 'LEGACY',
      recovered: true,
      notice: `Restored and migrated from Legacy save (Day ${legacyState.day}, ${legacyState.gold}g).`
    };
  }

  // Total fallback: fresh state (NEVER write corrupted text into backup!)
  return {
    state: createInitialSaveState(),
    source: 'FRESH',
    recovered: false
  };
}

/**
 * Atomic save persist with validation (Fixes Codex A02).
 * Only rotates primary into backup IF current primary is verified valid JSON.
 */
export function persistAtomicSaveSafe(
  stateToSave: GameSaveState,
  storage: Storage = localStorage
): boolean {
  try {
    const serialized = JSON.stringify(stateToSave);
    const prev = storage.getItem(SAVE_STORAGE_KEY);
    // Only rotate previous primary to backup if prev is actually valid JSON!
    if (prev) {
      const prevCheck = validateSavePayload(prev);
      if (prevCheck.valid) {
        storage.setItem(SAVE_BACKUP_KEY, prev);
      }
    }
    storage.setItem(SAVE_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}
