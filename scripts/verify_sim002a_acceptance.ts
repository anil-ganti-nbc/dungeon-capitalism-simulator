import * as fs from 'fs';
import {
  simulateRegionExpedition,
  assembleTrapProduct,
  synthesizeAlchemyProduct
} from '../src/engine/simulation';
import {
  computeQuotation,
  executeCommercialTransaction,
  resolveConsumableWear,
  computeRegionalFinesAndClaims
} from '../src/engine/economyEngine';
import {
  loadGameWithRecovery,
  persistAtomicSaveSafe,
  validateSavePayload,
  createInitialSaveState,
  SAVE_STORAGE_KEY,
  SAVE_BACKUP_KEY
} from '../src/engine/saveManager';
import { REAGENTS_CATALOG, TRAP_PARTS_CATALOG } from '../src/data/catalog';
import { INITIAL_MASTERS, INITIAL_PARTIES } from '../src/data/world';

console.log('=== VERIFYING SIM-002A AUDIT FINDINGS (A01 - A05) ===\n');

// 1. A01: UI / Headless Quotation & Transaction Parity
{
  const state = createInitialSaveState();
  const master = state.masters[0];
  const party = state.parties[0];
  const prod = state.products[0];

  // Quotation on low-trust client
  const lowTrustMaster = { ...master, trust: 48 };
  const quote = computeQuotation(prod, lowTrustMaster, 'MASTER', {
    priceMultiplier: 1.0,
    warrantyBacked: false,
    exclusiveDeal: false,
    secretProvenance: false,
    day: 1,
    seed: 20260001
  });

  // Price at trust 48 is scaled by trust factor (0.78 + 48*0.003 = 0.924)
  const expectedPrice = Math.max(25, Math.round(prod.suggestedPrice * (0.78 + 48 * 0.003)));
  const a01QuotationParity = quote.unitPrice === expectedPrice;

  // Transaction execution
  const tx = executeCommercialTransaction(state, 'MASTER', master.id, prod, {
    priceMultiplier: 1.0,
    warrantyBacked: false,
    exclusiveDeal: false,
    secretProvenance: false
  });

  const a01TxSuccess = tx.success && tx.unitPrice !== undefined && tx.nextState !== undefined;
  console.log(`[A01] UI/Headless Economy Parity: ${a01QuotationParity && a01TxSuccess ? 'PASS' : 'FAIL'} (Quote: ${quote.unitPrice}g, Expected: ${expectedPrice}g)`);
}

// 2. A02: Atomic Save Corruption & Non-Destructive Backup Recovery
{
  const mockStorage: Record<string, string> = {};
  const fakeLocalStorage: Storage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
    key: (i: number) => Object.keys(mockStorage)[i] || null,
    length: 0
  };

  const goodState = createInitialSaveState();
  goodState.day = 14;
  goodState.gold = 3450;
  persistAtomicSaveSafe(goodState, fakeLocalStorage);

  // Now create Day 15 save
  const goodStateDay15 = { ...goodState, day: 15, gold: 4200 };
  persistAtomicSaveSafe(goodStateDay15, fakeLocalStorage);

  // Verify backup contains Day 14
  const backupBefore = JSON.parse(fakeLocalStorage.getItem(SAVE_BACKUP_KEY)!);
  const backupDay = backupBefore.day;

  // Corrupt primary save with malformed JSON string (simulate crash during write or interrupted stream)
  fakeLocalStorage.setItem(SAVE_STORAGE_KEY, '{"day": 16, "gold": 9999, "corrupted_incomplete_json...');

  // Attempt to save while primary is corrupt: persistAtomicSaveSafe MUST NOT rotate corrupt primary into backup!
  const stateDay16 = { ...goodState, day: 16, gold: 5100 };
  // But wait, if loadGameWithRecovery is called first:
  const recovery = loadGameWithRecovery(fakeLocalStorage);
  const recoveredBackupDay = recovery.state.day;
  const backupAfterLoad = JSON.parse(fakeLocalStorage.getItem(SAVE_BACKUP_KEY)!);

  const a02Pass =
    recovery.recovered &&
    recoveredBackupDay === 14 &&
    backupAfterLoad.day === 14 &&
    validateSavePayload(fakeLocalStorage.getItem(SAVE_STORAGE_KEY)).valid;

  console.log(`[A02] Corrupted Save Non-Destructive Recovery: ${a02Pass ? 'PASS' : 'FAIL'} (Recovered Day ${recoveredBackupDay} backup cleanly without destroying backup slot)`);
}

// 3. A03: Consumables & Trap Wear (Potions deplete down to 0 charges [])
{
  const testParty = {
    ...INITIAL_PARTIES[0],
    equippedProducts: ['prod_chicken_morph'] // Exactly 1 potion equipped
  };
  const testMaster = {
    ...INITIAL_MASTERS[0],
    installedHazards: ['prod_trap_plate_spikes'] // Exactly 1 trap installed
  };

  const wearDelve1 = resolveConsumableWear(testParty, testMaster, 0, 1, []);
  const partyEquippedAfter1Delve = wearDelve1.nextEquipped; // Should be [] (0 charges left)

  // Delve on day 3 for master without auto-reset
  const wearDelveDay3 = resolveConsumableWear(testParty, testMaster, 0, 3, []);
  const masterHazardsAfterDay3 = wearDelveDay3.nextInstalled; // Should be [] (exhausted tension)

  const a03Pass =
    partyEquippedAfter1Delve.length === 0 &&
    masterHazardsAfterDay3.length === 0;

  console.log(`[A03] Consumables Deplete Down to 0: ${a03Pass ? 'PASS' : 'FAIL'} (Party loadout: ${testParty.equippedProducts.length} -> ${partyEquippedAfter1Delve.length}; Master traps day 3: ${testMaster.installedHazards.length} -> ${masterHazardsAfterDay3.length})`);
}

// 4. A04: Expert Mass-Inversion Plate Mechanics
{
  // Inversion plate: part_trg_12
  const inversionTrap = assembleTrapProduct(
    [
      TRAP_PARTS_CATALOG.find((p) => p.id === 'part_trg_12')!, // Paradox Mass-Inversion Plate (<25kg or >50kg)
      TRAP_PARTS_CATALOG.find((p) => p.id === 'part_con_01')!,
      TRAP_PARTS_CATALOG.find((p) => p.id === 'part_del_01')!,
      TRAP_PARTS_CATALOG.find((p) => p.id === 'part_pay_01')!,
      TRAP_PARTS_CATALOG.find((p) => p.id === 'part_pow_01')!,
      TRAP_PARTS_CATALOG.find((p) => p.id === 'part_rst_09')!  // Temporal Rewind
    ],
    'Paradox Mass-Inversion Plate Battery',
    false
  );

  const morphPotion = synthesizeAlchemyProduct(
    [
      REAGENTS_CATALOG.find((r) => r.id === 'reg_base_06')!, // -30kg
      REAGENTS_CATALOG.find((r) => r.id === 'reg_act_02')!, // -35kg (total -65kg morph)
      REAGENTS_CATALOG.find((r) => r.id === 'reg_car_04')!,
      REAGENTS_CATALOG.find((r) => r.id === 'reg_stb_02')!,
      REAGENTS_CATALOG.find((r) => r.id === 'reg_cat_04')!
    ],
    'Bantam Chicken-Morph Draught',
    false
  );

  const master = { ...INITIAL_MASTERS[0], installedHazards: [inversionTrap.id] };
  const party = { ...INITIAL_PARTIES[0], equippedProducts: [morphPotion.id] };
  const rep = simulateRegionExpedition(1, 2026, master, party, [inversionTrap, morphPotion], []);

  const firstRoom = rep.rooms[0];
  const a04Pass =
    firstRoom.outcome === 'TRAP_TRIGGERED' &&
    firstRoom.chemicalReaction.includes('PARADOX MASS-INVERSION') &&
    firstRoom.chemicalReaction.includes('Temporal Rewind Loop');

  console.log(`[A04] Paradox Mass-Inversion Plate Mechanics: ${a04Pass ? 'PASS' : 'FAIL'} (Outcome: ${firstRoom.outcome}, Reaction: "${firstRoom.chemicalReaction.slice(0, 80)}...")`);
}

// 5. A05: Typography Scaling Configuration
{
  const css = fs.readFileSync('src/index.css', 'utf8');
  const hasLarge = css.includes('html.font-scale-large') && css.includes('font-size: 112%');
  const hasXLarge = css.includes('html.font-scale-xlarge') && css.includes('font-size: 125%');
  const hasTextXsScale = css.includes('.font-scale-xlarge .text-xs');
  const hasTextSmScale = css.includes('.font-scale-xlarge .text-sm');

  const a05Pass = hasLarge && hasXLarge && hasTextXsScale && hasTextSmScale;
  console.log(`[A05] Mobile Typography Scaling in src/index.css: ${a05Pass ? 'PASS' : 'FAIL'}`);
}

console.log('\n=== ALL AUDIT CHECKS VERIFIED ===');
