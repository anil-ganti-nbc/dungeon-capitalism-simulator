import React from 'react';
import type { buildPlayerExpeditionForecast } from '../engine/expeditionScouting';

type Scouting = ReturnType<typeof buildPlayerExpeditionForecast>;
export function ExpeditionScoutingPanel({ scouting }: { scouting: Scouting }) {
  return <section aria-label="Pre-expedition scouting" className="p-4 bg-[#131822] border border-slate-700 rounded-xl space-y-4 text-base leading-relaxed break-words min-w-0">
    <div>
      <h2 className="font-semibold text-amber-300">Pre-expedition scouting</h2>
      <p className="text-slate-100">Not a simulated result. Current ledger facts and conditional guidance only.</p>
      <p className="text-slate-300">Scheduled: {scouting.partyName} vs {scouting.masterName}</p>
    </div>
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-100">Current ledger facts</h3>
      <p className="text-slate-300">Party members now:</p>
      <ul className="list-disc pl-5 text-slate-200">{scouting.members.map((m,i) => <li key={i}>{m.name} — {m.role}, {m.massKg}kg, {m.hp}/{m.maxHp} HP, {m.status}.</li>)}</ul>
      <p className="text-slate-300">Equipped now: {scouting.equipment.length ? scouting.equipment.map(e => e.name).join('; ') : 'No purchased equipment recorded.'}</p>
      <p className="text-slate-300">Installed loadout slots, not predicted chambers:</p>
      {scouting.installations.length ? <ul className="space-y-3 text-slate-200">{scouting.installations.map(p => <li key={p.slot} className="p-3 bg-[#0B0E14] border border-slate-800 rounded-lg">
        <p className="font-semibold">Slot {p.slot}: {p.name}</p>
        <p>{p.triggerRule}</p>
        <p>Current concealment DC: {p.detectionDC ?? 'unknown'}; potency: {p.potency ?? 'unknown'}; paid reset charges: {p.paidResetCharges}.</p>
      </li>)}</ul> : <p className="text-slate-200">No purchased installations recorded. That does not mean a hazard-free dungeon.</p>}
    </div>
    <div className="space-y-2">
      <h3 className="font-semibold text-amber-300">Conditional risks &amp; trade-offs</h3>
      <ul className="list-disc pl-5 space-y-2 text-slate-200">{scouting.considerations.map(t => <li key={t}>{t}</li>)}</ul>
    </div>
    <div className="space-y-2 border-t border-slate-700 pt-3">
      <h3 className="font-semibold text-amber-300">What remains unknown</h3>
      <ul className="list-disc pl-5 space-y-2 text-slate-200">{scouting.uncertainties.map(t => <li key={t}>{t}</li>)}</ul>
    </div>
  </section>;
}
