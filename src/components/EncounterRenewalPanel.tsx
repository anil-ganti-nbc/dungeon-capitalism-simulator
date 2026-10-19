import React, { useEffect, useState } from 'react';
import { DungeonMaster, EncounterRenewalRequest, GameSaveState } from '../types/game';
import { CommercialTerms, computeInstallationReplacementQuote } from '../engine/economyEngine';
import { requestsFor, replacementForRequest } from '../engine/encounterRenewal';
import { PaidReplacementOffer } from './InstallationReplacementPanel';

const action = 'block w-full min-h-[48px] px-3 py-3 rounded border border-slate-400 bg-slate-900 text-white focus-visible:outline-2 focus-visible:outline-amber-300';
interface Props { state: GameSaveState; master: DungeonMaster; terms: CommercialTerms;
  onConfirm: (offer: PaidReplacementOffer) => void; onDecline: (id: string) => void; }
export function EncounterRenewalPanel({ state, master, terms, onConfirm, onDecline }: Props) {
  const requests = requestsFor(state, master.id);
  const receipts = state.contractHistory.filter(c => c.buyerId === master.id && c.installationReplacement?.renewal).slice(-12).reverse();
  return <section aria-label="Encounter-backed requests" className="mt-4 space-y-4 min-w-0 text-slate-100" style={{ fontSize: '1rem', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
    <h4 className="font-bold">Upgrade request — {master.name}</h4>
    {!requests.length && <p>No verified encounter evidence available for this installation. Manual tactical replacement below is experimental, not an observed customer request.</p>}
    {requests.map(r => <RequestCard key={r.id} {...{ state, master, terms, onConfirm, onDecline }} request={r} />)}
    <p>Non-purchase choice: use the client selector to serve another customer. No bilateral sale is required.</p>
    {!!receipts.length && <section aria-label="Encounter replacement history" className="space-y-4 border border-slate-500 p-3 rounded">
      <h4 className="font-bold">Replacement paid — recent history</h4>
      <p>Last twelve evidence-linked receipts for this customer. Full contract history and provenance remain in the ledger export (Archives / save export); this is not a full graphical archive.</p>
      {receipts.map(c => {
        const r = c.installationReplacement!, source = r.renewal!;
        return <article key={c.id} aria-label={`Paid receipt ${c.id}`} className="border-t border-slate-500 pt-3 space-y-2">
          <p><strong>{c.buyerName}</strong> · purchase day {c.day} · slot {r.slotIndex + 1}</p>
          <p>Retired: {r.retiredProductName} [{r.retiredProductId}]</p>
          <p>Installed: {c.productName} [{c.productId}]</p>
          <p>Paid: {c.totalRevenue}g · lost reserve: {r.retiredResetCharge} · new paid reserve: {state.products.find(p => p.id === c.productId)?.recipeComponents.includes('part_rst_09') ? 1 : 0}.</p>
          <p>No refund, salvage or stock return. Future expedition result is not guaranteed.</p>
          <p>Receipt: {c.id}</p><p>Request: {source.requestId}</p>
          <p>Observed source: report {source.evidence.reportId} · encounter day {source.evidence.day} · occurrence {source.occurrenceId}</p>
          {state.expeditionReports.filter(r => r.day >= c.day && r.masterId === master.id).slice(0,1).map(r => <p key={r.id}>Separate later completed raid: {r.id} — {r.summaryHeadline}</p>)}
        </article>;
      })}
    </section>}
  </section>;
}
function RequestCard({ state, master, terms, request: r, onConfirm, onDecline }: Props & { request: EncounterRenewalRequest }) {
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState<PaidReplacementOffer | null>(null);
  const [deferred, setDeferred] = useState(false);
  useEffect(() => setPending(null), [state.day, state.contractHistory.length, master.id, terms.priceMultiplier, terms.warrantyBacked, terms.exclusiveDeal, terms.secretProvenance]);
  const e = r.evidence, o = e.observation;
  const options = state.products.filter(p => p.targetAudience !== 'HERO').map(p => {
    const intent = replacementForRequest(state, r.id, p.id)!;
    return { product: p, intent, quote: computeInstallationReplacementQuote(state, intent, terms) };
  });
  const chosen = options.find(p => p.product.id === selected), accepted = options.filter(p => p.quote.success);
  const old = state.products.find(p => p.id === o.hazardId);
  const currentIndex = state.encounterRenewal?.masters[master.id]?.occurrences.findIndex(c => c.id === r.occurrenceId) ?? -1;
  const open = r.status === 'OPEN';
  return <article aria-label={`Encounter request ${r.id}`} className="space-y-3 border border-slate-500 p-3 rounded min-w-0">
    <p><strong>Status: {r.status}</strong>{deferred && open ? ' — Deferred for this visit; same request remains open.' : ''}</p>
    <p>{e.region} · encounter day {e.day} · {e.partyName}</p>
    <p><strong>Observed in completed report:</strong> {old?.name ?? o.hazardId}, source slot {(o.sourceSlotIndex ?? -1) + 1}, was bypassed: observed mass {o.effectiveMassKg}kg was below its {o.mechanics.threshold}kg trigger.</p>
    <p>Observed counter: {o.counter.kind === 'MORPH' ? `morph product ${o.counter.productId}` : 'natural light mass (no morph recorded)'}.</p>
    <p>Report {e.reportId} · room {o.roomIndex} · occurrence {r.occurrenceId}</p>
    <details><summary className="min-h-[48px] py-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300">Source details — exact identifiers</summary>
      <p>Master {e.masterId} · party {e.partyId} · seed {e.seed} · rules {e.rulesVersion} · request {r.id} · hazard {o.hazardId}</p>
    </details>
    <p><strong>Customer request:</strong> {master.name} wants a different trigger response to this observed mass bypass. A sale is optional.</p>
    <p>Current target: {currentIndex >= 0 ? `slot ${currentIndex + 1}` : 'retired occurrence; unavailable'}. Historical source slot and current target are not interchangeable.</p>
    {open ? <>
      <p>{accepted.length} currently payable stocked response(s). An 8kg hair trigger and zero-threshold sensor are distinct costly engineering remedies when available; Warrens components must be unlocked and bought/crafted normally. Under-25kg inversion is specialized, not a heavy-intruder solution.</p>
      <label className="block">Response build
        <select aria-label={`Response build ${r.id}`} className={action} value={selected} onChange={ev => { setSelected(ev.target.value); setPending(null); }}>
          <option value="">Choose a build to inspect…</option>
          {options.map(p => <option key={p.product.id} value={p.product.id}>{p.product.name}{p.quote.success ? ` — ${p.quote.unitPrice}g` : ' — unavailable'}</option>)}
        </select>
      </label>
      {chosen && <div className="space-y-2">
        <p><strong>Selected:</strong> {chosen.product.name} [{chosen.product.id}]</p>
        <p><strong>Addresses:</strong> {chosen.quote.success ? `The existing trigger predicate admits the observed ${o.effectiveMassKg}kg mass (${chosen.product.recipeComponents.includes('part_trg_12') ? 'strictly under 25kg' : chosen.product.triggerMassThresholdKg > 0 ? `at least ${chosen.product.triggerMassThresholdKg}kg` : 'no minimum mass'}).` : `Unavailable: ${chosen.quote.reason}`}</p>
        <p><strong>Trade-off:</strong> pay for a new unit and permanently retire the old installation. {chosen.product.recipeComponents.includes('part_trg_12') ? 'Intruders of 25kg or more bypass this inversion sensor.' : 'Scouts and other applicable counters can still prevent damage.'}</p>
        <p><strong>Possible benefit, not guaranteed:</strong> remove this observed mass bypass only; other encounter conditions can still defeat the build.</p>
        {chosen.quote.success && <>
          <p>Buyer pays {chosen.quote.unitPrice}g · budget {master.budget}g → {master.budget - chosen.quote.unitPrice!}g</p>
          <p>Shop stock {chosen.product.stock} → {chosen.product.stock - 1} (one unit).</p>
          <p>Merchant unit cost {chosen.product.productionCost}g · gross margin {chosen.quote.unitPrice! - chosen.product.productionCost}g before overhead/claims.</p>
          <p>Retire {chosen.intent.expectedResetCharge} unused temporal reset charge(s) permanently. No refund, salvage or stock return. New installation brings {chosen.product.recipeComponents.includes('part_rst_09') ? 1 : 0} paid reset charge(s); reserves do not transfer.</p>
        </>}
      </div>}
      {!pending ? <button type="button" className={action} disabled={!chosen?.quote.success} onClick={() => chosen?.quote.success && setPending({ request: structuredClone(chosen.intent), terms: { ...terms }, unitPrice: chosen.quote.unitPrice! })}>Review encounter replacement</button>
        : <section aria-label="Review encounter replacement" className="space-y-3 border border-amber-300 p-3 rounded">
          <p><strong>{master.name} · current slot {pending.request.slotIndex + 1}</strong></p>
          <p>Retire: {old?.name} [{pending.request.expectedProductId}]</p>
          <p>Install: {chosen?.product.name} [{pending.request.productId}]</p>
          <p>Buyer pays: {pending.unitPrice}g · current budget {master.budget}g{master.budget >= pending.unitPrice ? ` → ${master.budget - pending.unitPrice}g if accepted` : ' — insufficient; no payment authorized'}.</p>
          <p>Shop stock: {chosen?.product.stock ?? 0}{chosen && chosen.product.stock > 0 ? ` → ${chosen.product.stock - 1} if accepted` : ' — unavailable'} (one paid unit).</p>
          <p>Reserve lost: {pending.request.expectedResetCharge}. New reserve: {chosen?.product.recipeComponents.includes('part_rst_09') ? 1 : 0}. No refund, salvage or stock return.</p>
          <p>Terms: price ×{pending.terms.priceMultiplier ?? 1}; warranty {String(pending.terms.warrantyBacked)}; exclusive {String(pending.terms.exclusiveDeal)}; secret {String(pending.terms.secretProvenance)}.</p>
          <p>Request {r.id} · report {e.reportId}. Possible benefit only; future raid result not yet known. State or price changes require revalidation.</p>
          <button type="button" className={action} onClick={() => { onConfirm(pending); setPending(null); }}>Confirm encounter replacement ({pending.unitPrice}g)</button>
          <button type="button" className={action} onClick={() => setPending(null)}>Cancel review — no purchase</button>
        </section>}
      <button type="button" className={action} onClick={() => { setDeferred(true); setPending(null); }}>Defer request</button>
      <button type="button" className={action} onClick={() => { onDecline(r.id); setPending(null); }}>Decline this request</button>
    </> : <p>Unavailable: {r.status}. No new purchase is authorized by this evidence. {r.contractId ? `Resolved by actual receipt ${r.contractId}.` : 'This is not a paid resolution.'}</p>}
  </article>;
}
