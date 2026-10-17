import { GameSaveState } from '../types/game';
import { INITIAL_PRODUCTS, SKILL_TREE_NODES } from '../data/catalog';
import { INITIAL_MASTERS, INITIAL_PARTIES, INITIAL_RIVALS, REGIONS_DATA } from '../data/world';

export const SAVE_STORAGE_KEY = 'trap_and_tonic_save_v2';
export const SAVE_BACKUP_KEY = 'trap_and_tonic_save_v2_backup';
export const LEGACY_BACKUP_KEY = 'trap_and_tonic_save_v1_backup';
export const LEGACY_SAVE_KEY = 'trap_and_tonic_save_v1';
export const QUARANTINE_KEY = 'trap_and_tonic_quarantined_corrupt_save';

export interface SaveValidationResult {
  valid: boolean;
  state?: Partial<GameSaveState>;
  error?: string;
}

export interface SaveLoadResult {
  state: GameSaveState;
  source: 'PRIMARY' | 'BACKUP' | 'LEGACY_BACKUP' | 'LEGACY' | 'FRESH';
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
        detail:
          'Town Watch audit confirms Vance installed 45kg Pressure Plates and Cave-Basilisks. The Cobblestone Irregulars equipped with heavy morningstars require Basilisk Antidotes.',
        isVerifiedFact: true,
        source: 'Town Watch Regional Audit',
        reliabilityPct: 100,
        affectedTag: 'cellar_encounter'
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
    return { valid: true, state: parsed as Partial<GameSaveState> };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'JSON parse error' };
  }
}

/**
 * Normalizes loaded saves with deep defensive entity filtering.
 * Prevents application blank screens caused by null items or malformed arrays (Gate 2).
 */
export function normalizeLoadedSave(parsed: Partial<GameSaveState>): GameSaveState {
  const base = createInitialSaveState();

  // Defensively filter products array
  const cleanProducts = Array.isArray(parsed.products)
    ? parsed.products.filter(
        (p): p is any =>
          p != null &&
          typeof p === 'object' &&
          typeof p.id === 'string' &&
          typeof p.name === 'string'
      )
    : [];

  // Defensively filter masters array
  const cleanMasters = Array.isArray(parsed.masters)
    ? parsed.masters
        .filter(
          (m): m is any =>
            m != null &&
            typeof m === 'object' &&
            typeof m.id === 'string' &&
            typeof m.name === 'string'
        )
        .map((m) => ({
          ...m,
          budget: typeof m.budget === 'number' && Number.isFinite(m.budget) ? m.budget : 800,
          trust: typeof m.trust === 'number' && Number.isFinite(m.trust) ? m.trust : 60,
          installedHazards: Array.isArray(m.installedHazards)
            ? m.installedHazards.filter((h: any) => typeof h === 'string')
            : [],
          memoryLog: Array.isArray(m.memoryLog)
            ? m.memoryLog.filter((l: any) => typeof l === 'string')
            : []
        }))
    : [];

  // Defensively filter parties array
  const cleanParties = Array.isArray(parsed.parties)
    ? parsed.parties
        .filter(
          (p): p is any =>
            p != null &&
            typeof p === 'object' &&
            typeof p.id === 'string' &&
            typeof p.name === 'string'
        )
        .map((p) => ({
          ...p,
          budget: typeof p.budget === 'number' && Number.isFinite(p.budget) ? p.budget : 800,
          trust: typeof p.trust === 'number' && Number.isFinite(p.trust) ? p.trust : 60,
          equippedProducts: Array.isArray(p.equippedProducts)
            ? p.equippedProducts.filter((e: any) => typeof e === 'string')
            : [],
          memoryLog: Array.isArray(p.memoryLog)
            ? p.memoryLog.filter((l: any) => typeof l === 'string')
            : []
        }))
    : [];

  // Defensively filter skills array
  const cleanSkills = Array.isArray(parsed.skills)
    ? parsed.skills.filter(
        (s): s is any =>
          s != null &&
          typeof s === 'object' &&
          typeof s.id === 'string'
      )
    : [];

  // Defensively validate scheduledMatchups
  const sched: any = parsed.scheduledMatchups || {};
  const cleanSched = {
    cellar: sched.cellar && typeof sched.cellar.masterId === 'string' ? sched.cellar : base.scheduledMatchups.cellar,
    warrens: sched.warrens && typeof sched.warrens.masterId === 'string' ? sched.warrens : base.scheduledMatchups.warrens,
    blackspire: sched.blackspire && typeof sched.blackspire.masterId === 'string' ? sched.blackspire : base.scheduledMatchups.blackspire,
    vault: sched.vault && typeof sched.vault.masterId === 'string' ? sched.vault : base.scheduledMatchups.vault
  };

  return {
    ...base,
    ...parsed,
    day: typeof parsed.day === 'number' && Number.isFinite(parsed.day) ? parsed.day : base.day,
    gold: typeof parsed.gold === 'number' && Number.isFinite(parsed.gold) ? parsed.gold : base.gold,
    debt: typeof parsed.debt === 'number' && Number.isFinite(parsed.debt) ? parsed.debt : 0,
    insolvencyEvents: typeof parsed.insolvencyEvents === 'number' ? parsed.insolvencyEvents : 0,
    rulesVersion: 'v2.0-sim002',
    customBrewsCount: typeof parsed.customBrewsCount === 'number' ? parsed.customBrewsCount : 0,
    customTrapsCount: typeof parsed.customTrapsCount === 'number' ? parsed.customTrapsCount : 0,
    tradeTerms: {
      priceMultiplier:
        typeof parsed.tradeTerms?.priceMultiplier === 'number'
          ? parsed.tradeTerms.priceMultiplier
          : 1.0,
      warrantyBacked:
        typeof parsed.tradeTerms?.warrantyBacked === 'boolean'
          ? parsed.tradeTerms.warrantyBacked
          : false,
      exclusiveDeal:
        typeof parsed.tradeTerms?.exclusiveDeal === 'boolean'
          ? parsed.tradeTerms.exclusiveDeal
          : false,
      secretProvenance:
        typeof parsed.tradeTerms?.secretProvenance === 'boolean'
          ? parsed.tradeTerms.secretProvenance
          : false
    },
    scheduledMatchups: cleanSched,
    products: cleanProducts.length > 0 ? cleanProducts : base.products,
    masters: cleanMasters.length > 0 ? cleanMasters : base.masters,
    parties: cleanParties.length > 0 ? cleanParties : base.parties,
    skills: cleanSkills.length > 0 ? cleanSkills : base.skills,
    catalystLedger: Array.isArray(parsed.catalystLedger) ? parsed.catalystLedger.filter(Boolean) : [],
    contractHistory: Array.isArray(parsed.contractHistory) ? parsed.contractHistory.filter(Boolean) : [],
    contractsToday: Array.isArray(parsed.contractsToday) ? parsed.contractsToday.filter(Boolean) : [],
    expeditionReports: Array.isArray(parsed.expeditionReports) ? parsed.expeditionReports.filter(Boolean) : [],
    financialLedger: Array.isArray(parsed.financialLedger) ? parsed.financialLedger.filter(Boolean) : [],
    intelFeed: Array.isArray(parsed.intelFeed) ? parsed.intelFeed.filter(Boolean) : base.intelFeed
  };
}

/**
 * Non-destructive save loader with corruption detection, quarantine, and historical backup recovery (Gate 2).
 * If primary save is malformed/corrupted:
 * 1. Quarantines corrupted payload into QUARANTINE_KEY so evidence is preserved.
 * 2. Checks SAVE_BACKUP_KEY (v2 backup). If valid, restores backup without destroying it.
 * 3. Checks LEGACY_BACKUP_KEY (v1 backup). If valid, restores without destroying it.
 * 4. Checks LEGACY_SAVE_KEY (v1 primary). If valid, restores and migrates.
 * 5. Never overwrites a healthy backup with corrupted text.
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

  // Primary is missing or corrupted! Quarantine corrupted raw text if non-empty
  if (primaryRaw && primaryRaw.trim().length > 0) {
    try {
      storage.setItem(QUARANTINE_KEY, primaryRaw);
    } catch {
      // Ignore
    }
  }

  // 1. Try v2 backup
  const backupRaw = storage.getItem(SAVE_BACKUP_KEY);
  const backupCheck = validateSavePayload(backupRaw);

  if (backupCheck.valid && backupCheck.state) {
    const recoveredState = normalizeLoadedSave(backupCheck.state);
    try {
      // Heal primary slot with the recovered valid backup so subsequent loads succeed cleanly
      storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(recoveredState));
      // CRITICAL: Do NOT overwrite SAVE_BACKUP_KEY! Keep the valid backup intact.
    } catch {
      // Ignore
    }

    return {
      state: recoveredState,
      source: 'BACKUP',
      recovered: true,
      notice: `Primary save was unreadable. Restored from Day ${recoveredState.day} backup (${recoveredState.gold}g).`
    };
  }

  // 2. Try v1 backup
  const legacyBackupRaw = storage.getItem(LEGACY_BACKUP_KEY);
  const legacyBackupCheck = validateSavePayload(legacyBackupRaw);

  if (legacyBackupCheck.valid && legacyBackupCheck.state) {
    const recoveredState = normalizeLoadedSave(legacyBackupCheck.state);
    try {
      storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(recoveredState));
    } catch {
      // Ignore
    }

    return {
      state: recoveredState,
      source: 'LEGACY_BACKUP',
      recovered: true,
      notice: `Primary save unreadable. Restored and migrated from v1 backup (Day ${recoveredState.day}, ${recoveredState.gold}g).`
    };
  }

  // 3. Try v1 primary save
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
 * Atomic save persist with validation (Gate 2).
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
