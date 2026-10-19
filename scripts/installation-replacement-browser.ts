/** Explicit diagnostic full-loadout setup; real rendered paid replacement and persistence. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, Locator } from 'playwright';
import { createInitialSaveState, SAVE_STORAGE_KEY, validateSavePayload } from '../src/engine/saveManager';
import { assembleTrapProduct, simulateRegionExpedition } from '../src/engine/simulation';
import { TRAP_PARTS_CATALOG } from '../src/data/catalog';
import { executeInstallationReplacement, computeInstallationReplacementQuote } from '../src/engine/economyEngine';
const out = process.env.EVIDENCE_DIR ?? 'artifacts/paid-replacement';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || undefined });
const url = process.env.TEST_URL ?? 'http://127.0.0.1:4178';
const errors: string[] = [];
const results: unknown[] = [];
const width = Number(process.env.REPLACEMENT_WIDTH ?? 1440);
assert([1440, 375, 412].includes(width));
const mobile = width !== 1440;
const activate = (button: Locator) => mobile ? button.tap() : button.click();
try {
  const state = createInitialSaveState(88191);
  const temporal = assembleTrapProduct(['part_trg_01','part_con_01','part_del_01','part_pay_01','part_pow_01','part_rst_09'].map(id => TRAP_PARTS_CATALOG.find(p => p.id === id)!) as Parameters<typeof assembleTrapProduct>[0], 'Retired temporal diagnostic', false);
  state.products.push(temporal);
  state.masters[0].budget = 9999;
  state.masters[0].installedHazards = ['prod_trap_plate_spikes', temporal.id, 'prod_trap_sulphur_fog'];
  state.masters[0].installedResetCharges = [0, 1, 0];
  assert.equal(validateSavePayload(JSON.stringify(state)).valid, true);
  const cold = process.env.REPLACEMENT_COLD === '1';
  const profile = cold ? fs.mkdtempSync(path.join(out, 'cold-profile-')) : '';
  assert(!cold || mobile, 'cold proof uses a portrait production profile');
  const options = { headless: true, executablePath: process.env.BROWSER_PATH || undefined, viewport: { width, height: width === 375 ? 812 : width === 412 ? 915 : 1000 }, isMobile: mobile, hasTouch: mobile };
  let c = cold ? await chromium.launchPersistentContext(profile, options) : await browser.newContext({ ...options, serviceWorkers: 'block' });
  try {
    await c.addInitScript(data => { if (!sessionStorage.getItem('replacement-setup')) {
      localStorage.setItem('trap_and_tonic_save_v2', JSON.stringify(data)); sessionStorage.setItem('replacement-setup', '1');
    } }, state);
    const p = await c.newPage(); p.on('pageerror', error => errors.push(error.message));
    await p.goto(url);
    await activate(p.getByRole('button', { name: /^(Open Merchant Ledger|Continue Ledger)/ }));
    if (process.env.REPLACEMENT_XLARGE === '1') {
      await activate(p.getByRole('button', { name: 'Options & A11y (Esc)', exact: true }));
      await activate(p.getByRole('button', { name: 'XLARGE', exact: true }));
      await activate(p.getByRole('button', { name: 'Resume Campaign', exact: true }));
    }
    assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!)), state, 'diagnostic setup loaded without a recovery/reset');
    assert.equal(await p.getByRole('region', { name: 'Paid installation replacement', exact: true }).count(), 1,
      'the missing renewal action must be available in the real trade desk');
    const panel = p.getByRole('region', { name: 'Paid installation replacement', exact: true });
    assert.equal(await panel.getByRole('button', { name: 'Review replacement', exact: true }).isEnabled(), false);
    await panel.getByLabel('Installation slot to replace', { exact: true }).selectOption('1');
    await panel.getByLabel('New installation from stock', { exact: true }).selectOption(temporal.id);
    assert.equal(await panel.getByRole('button', { name: 'Review replacement', exact: true }).isEnabled(), false);
    await panel.getByLabel('New installation from stock', { exact: true }).selectOption('prod_trap_hairtrigger_acid');
    const before = await p.evaluate(() => JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!));
    const intent = { masterId: state.masters[0].id, productId: 'prod_trap_hairtrigger_acid', slotIndex: 1,
      expectedProductId: temporal.id, expectedResetCharge: 1, expectedDay: before.day, expectedContractCount: before.contractHistory.length };
    const terms = before.tradeTerms!;
    const quote = computeInstallationReplacementQuote(before, intent, terms);
    assert.equal(quote.success, true, quote.reason);
    const expected = executeInstallationReplacement(before, intent, terms, quote.unitPrice!).nextState!;
    await activate(panel.getByRole('button', { name: 'Review replacement', exact: true }));
    const confirmation = panel.getByRole('region', { name: 'Confirm installation replacement', exact: true });
    assert.match(await confirmation.innerText(), /no refund/i);
    assert.match(await confirmation.innerText(), /1 reset charge/);
    assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!)), before, 'review is not a purchase');
    await activate(confirmation.getByRole('button', { name: 'Cancel replacement', exact: true }));
    assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!)), before, 'cancel has no resource effect');
    await activate(panel.getByRole('button', { name: 'Review replacement', exact: true }));
    await confirmation.scrollIntoViewIfNeeded();
    const geometry = await panel.evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, controls: Array.from(el.querySelectorAll('button,select')).map(e => { const r = e.getBoundingClientRect(); return { x: r.x, right: r.right, height: r.height }; }) }));
    assert.equal(geometry.scrollWidth, geometry.width);
    assert(geometry.controls.every(r => r.x >= 0 && r.right <= width + 1 && r.height >= 44));
    await p.screenshot({ path: path.join(out, 'confirmation.png') });
    await activate(confirmation.getByRole('button', { name: `Confirm paid replacement (${quote.unitPrice}g)`, exact: true }));
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!).contractHistory.length === 1);
    const actual = await p.evaluate(() => JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!));
    assert.deepEqual(actual, expected, 'rendered purchase and pure engine command have complete state parity');
    const receipts = p.getByRole('region', { name: 'Replacement receipts', exact: true });
    assert.equal(await receipts.count(), 1, 'retirement must have an inspectable receipt');
    assert((await receipts.innerText()).includes(temporal.id));
    await p.reload(); await activate(p.getByRole('button', { name: /^Continue Ledger/ }));
    assert((await receipts.innerText()).includes(temporal.id));
    assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!)), actual);
    await p.screenshot({ path: path.join(out, 'paid-reloaded.png'), fullPage: true });
    let actualReport: unknown;
    if (cold) {
      await p.evaluate(() => navigator.serviceWorker.ready);
      await p.waitForFunction(() => !!navigator.serviceWorker.controller);
      await c.setOffline(true);
      const blocked = await p.evaluate(async () => { try { await fetch('/uncached-replacement-probe?' + Date.now()); return false; } catch { return true; } });
      assert(blocked);
      await c.close();
      c = await chromium.launchPersistentContext(profile, { ...options, offline: true });
      const reopened = await c.newPage(); reopened.on('pageerror', error => errors.push(error.message));
      await reopened.goto(url); await activate(reopened.getByRole('button', { name: /^Continue Ledger/ }));
      const coldState = await reopened.evaluate(() => JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!));
      assert.deepEqual(coldState, actual, 'paid replacement and retirement receipt survive a network-restricted new browser process');
      const coldBlocked = await reopened.evaluate(async () => { try { await fetch('/uncached-replacement-cold-probe?' + Date.now()); return false; } catch { return true; } });
      assert(coldBlocked);
      assert((await reopened.getByRole('region', { name: 'Replacement receipts', exact: true }).innerText()).includes(temporal.id));
      await reopened.screenshot({ path: path.join(out, 'paid-offline-cold-reopen.png') });
      fs.writeFileSync(path.join(out, 'cold-proof.json'), JSON.stringify({ blockedBeforeClose: blocked, blockedAfterColdOpen: coldBlocked, before: actual, after: coldState, physicalAndroid: 'NOT TESTED', osKill: 'NOT TESTED' }, null, 2));
    }
    if (!mobile) {
      const expectedReport = simulateRegionExpedition(actual.day, actual.seed, actual.masters[0], actual.parties[0], actual.products, actual.contractsToday);
      await p.getByRole('button', { name: /^Run Scheduled Expedition/ }).click();
      await p.waitForFunction(() => JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!).day === 2);
      const afterRaid = await p.evaluate(() => JSON.parse(localStorage.getItem('trap_and_tonic_save_v2')!)); actualReport = afterRaid.expeditionReports[0];
      assert.deepEqual(actualReport, expectedReport); assert.equal(afterRaid.expeditionReports[0].rooms[1].hazardId, intent.productId);
    }
    results.push({ name: 'rendered replacement/full engine parity/reload', width, xlarge: process.env.REPLACEMENT_XLARGE === '1', inputMode: mobile ? 'emulated touch buttons; selectOption automation, not native picker' : 'mouse', before, intent, terms, quote, expected, actual, geometry, actualReport });
  } finally { await c.close(); }
  assert.deepEqual(errors, []);
} finally { fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ results, errors }, null, 2)); await browser.close(); }
