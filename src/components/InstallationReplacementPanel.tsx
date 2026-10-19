import React, { useState } from 'react';
import { DungeonMaster, GameSaveState } from '../types/game';
import { CommercialTerms, InstallationReplacementRequest, computeInstallationReplacementQuote } from '../engine/economyEngine';

export interface PaidReplacementOffer {
  request: InstallationReplacementRequest;
  terms: CommercialTerms;
  unitPrice: number;
}
interface Props {
  state: GameSaveState;
  master: DungeonMaster;
  terms: CommercialTerms;
  onConfirm: (offer: PaidReplacementOffer) => void;
}

/** Two-step, explicit retirement; does not reinterpret a refused ordinary sale as an upgrade. */
export function InstallationReplacementPanel({ state, master, terms, onConfirm }: Props) {
  const [slot, setSlot] = useState('');
  const [productId, setProductId] = useState('');
  const [pending, setPending] = useState<PaidReplacementOffer | null>(null);
  const slotIndex = Number(slot);
  const retired = slot !== '' ? state.products.find(p => p.id === master.installedHazards[slotIndex]) : undefined;
  const product = state.products.find(p => p.id === productId);
  const request: InstallationReplacementRequest = { masterId: master.id, productId, slotIndex,
    expectedProductId: retired?.id ?? '', expectedResetCharge: master.installedResetCharges?.[slotIndex] ?? 0,
    expectedDay: state.day, expectedContractCount: state.contractHistory.length };
  const quote = retired && product ? computeInstallationReplacementQuote(state, request, terms) : undefined;
  const inputClass = 'block w-full min-w-0 min-h-[44px] bg-[#0B0E14] border border-slate-700 rounded px-2 py-2 text-xs text-slate-200';
  return <section aria-label="Paid installation replacement" className="mt-4 p-3 border border-slate-700 rounded-lg space-y-3 text-xs min-w-0">
    <h4 className="font-semibold text-slate-100">Paid installation replacement</h4>
    <p className="text-slate-300">Choose an occupied slot and a different build. Retire the old installation and its unused reset reserve permanently; no refund, salvage or stock return. This is a paid tactical change, not a guarantee of better results.</p>
    {master.installedHazards.length === 0 ? <p>No installation to replace. Use an ordinary sale first.</p> : <>
      <label className="block text-slate-300">Installation slot to replace
        <select aria-label="Installation slot to replace" className={inputClass} value={slot}
          onChange={e => { setSlot(e.target.value); setPending(null); }}>
          <option value="">Choose occupied slot…</option>
          {master.installedHazards.map((id, i) => <option key={i} value={i}>Slot {i + 1}: {state.products.find(p => p.id === id)?.name ?? id}</option>)}
        </select>
      </label>
      {retired && <p className="break-words text-slate-300">Retiring slot {slotIndex + 1}: {retired.name} [{retired.id}] · DC {retired.detectionDC} · Potency {retired.potency} · {request.expectedResetCharge} reset charge(s).</p>}
      <label className="block text-slate-300">New installation from stock
        <select aria-label="New installation from stock" className={inputClass} value={productId}
          onChange={e => { setProductId(e.target.value); setPending(null); }}>
          <option value="">Choose new build…</option>
          {state.products.filter(p => p.targetAudience !== 'HERO' && p.stock > 0).map(p => <option key={p.id} value={p.id}>{p.name} [{p.id}]</option>)}
        </select>
      </label>
      {product && <p className="break-words text-slate-300">New build: {product.name} [{product.id}] · DC {product.detectionDC} · Potency {product.potency} · {product.recipeComponents.includes('part_rst_09') ? 1 : 0} paid reset charge(s). {product.description}</p>}
      {quote && <p aria-live="polite" className="text-slate-200">{quote.success ? `Buyer's payable price: ${quote.unitPrice}g. Normal budget, trust and contract rules apply.` : quote.reason}</p>}
      {!pending ? <button type="button" disabled={!quote?.success}
        onClick={() => quote?.success && setPending({ request: { ...request }, terms: { ...terms }, unitPrice: quote.unitPrice! })}
        className="min-h-[44px] w-full px-3 py-2 rounded bg-amber-700 disabled:bg-slate-800 disabled:text-slate-500 text-white">Review replacement</button>
        : <section aria-label="Confirm installation replacement" className="space-y-2 border border-amber-600 rounded p-3 break-words text-slate-100">
          <p>Replace slot {pending.request.slotIndex + 1} for {master.name}: {state.products.find(p => p.id === pending.request.expectedProductId)?.name} [{pending.request.expectedProductId}] → {state.products.find(p => p.id === pending.request.productId)?.name} [{pending.request.productId}].</p>
          <p>Buyer pays {pending.unitPrice}g. Retire {pending.request.expectedResetCharge} reset charge(s), no refund or salvage. Reserve and stock are not transferred.</p>
          <p>Quoted terms: price ×{pending.terms.priceMultiplier ?? 1}; warranty {pending.terms.warrantyBacked ? 'on' : 'off'}; exclusivity {pending.terms.exclusiveDeal ? 'on' : 'off'}; secret provenance {pending.terms.secretProvenance ? 'on' : 'off'}. New installation: {product?.recipeComponents.includes('part_rst_09') ? 1 : 0} paid reset charge(s).</p>
          <button type="button" className="min-h-[44px] w-full rounded px-3 py-2 bg-amber-700 text-white" onClick={() => { onConfirm(pending); setPending(null); }}>Confirm paid replacement ({pending.unitPrice}g)</button>
          <button type="button" className="min-h-[44px] w-full rounded px-3 py-2 border border-slate-600" onClick={() => setPending(null)}>Cancel replacement</button>
        </section>}
    </>}
  </section>;
}
