import { getDailyMarketContext } from '../engine/marketContext';
import React, { useState, useEffect } from 'react';
import {
  CraftedProduct,
  DungeonMaster,
  AdventuringParty,
  SaleContract,
  RegionId,
  FinancialRecord,
  RivalHouse
} from '../types/game';
import { REGIONS_DATA } from '../data/world';
import { computeQuotation } from '../engine/economyEngine';

interface TradeFloorProps {
  day: number;
  seed: number;
  activeRegion: RegionId;
  products: CraftedProduct[];
  masters: DungeonMaster[];
  parties: AdventuringParty[];
  scheduledMasterId: string;
  scheduledPartyId: string;
  nextMasterName: string;
  nextPartyName: string;
  contractsToday: SaleContract[];
  bilateralSkillUnlocked: boolean;
  secretShippingUnlocked: boolean;
  unlockedSkills?: string[];
  tradeTerms?: {
    priceMultiplier: number;
    warrantyBacked: boolean;
    exclusiveDeal: boolean;
    secretProvenance: boolean;
  };
  onUpdateTradeTerms?: (terms: {
    priceMultiplier: number;
    warrantyBacked: boolean;
    exclusiveDeal: boolean;
    secretProvenance: boolean;
  }) => void;
  onSelectScheduledMatchup: (masterId: string, partyId: string) => void;
  onExecuteSale: (
    buyerType: 'MASTER' | 'HERO',
    buyerId: string,
    product: CraftedProduct,
    priceMultiplier: number,
    warrantyBacked: boolean,
    exclusiveDeal: boolean,
    secretProvenance: boolean
  ) => void;
  onLaunchExpedition: () => void;
}

export const TradeFloorPanel: React.FC<TradeFloorProps> = ({
  day,
  seed,
  activeRegion,
  products,
  masters,
  parties,
  scheduledMasterId,
  scheduledPartyId,
  nextMasterName,
  nextPartyName,
  contractsToday,
  bilateralSkillUnlocked,
  secretShippingUnlocked,
  unlockedSkills = [],
  tradeTerms,
  onUpdateTradeTerms,
  onSelectScheduledMatchup,
  onExecuteSale,
  onLaunchExpedition
}) => {
  const regionMasters = masters.filter((m) => m.region === activeRegion);
  const regionParties = parties.filter((p) => p.region === activeRegion);

  // F08 Fix: Initialize from persisted tradeTerms in gameState so switching workspaces preserves settings!
  const [pricePct, setPricePct] = useState<number>(() =>
    tradeTerms?.priceMultiplier ? Math.round(tradeTerms.priceMultiplier * 100) : 100
  );
  const [warranty, setWarranty] = useState<boolean>(() =>
    tradeTerms?.warrantyBacked !== undefined ? tradeTerms.warrantyBacked : false
  );
  const [exclusive, setExclusive] = useState<boolean>(() =>
    tradeTerms?.exclusiveDeal !== undefined ? tradeTerms.exclusiveDeal : false
  );
  const [secretMark, setSecretMark] = useState<boolean>(() =>
    tradeTerms?.secretProvenance !== undefined
      ? tradeTerms.secretProvenance
      : secretShippingUnlocked
  );

  const updateTerms = (newPrice: number, newWar: boolean, newEx: boolean, newSec: boolean) => {
    setPricePct(newPrice);
    setWarranty(newWar);
    setExclusive(newEx);
    setSecretMark(newSec);
    if (onUpdateTradeTerms) {
      onUpdateTradeTerms({
        priceMultiplier: newPrice / 100,
        warrantyBacked: newWar,
        exclusiveDeal: newEx,
        secretProvenance: newSec
      });
    }
  };

  const activeMaster =
    regionMasters.find((m) => m.id === scheduledMasterId) || regionMasters[0] || masters[0];
  const activeParty =
    regionParties.find((p) => p.id === scheduledPartyId) || regionParties[0] || parties[0];

  const masterProducts = products.filter(
    (p) => (p.targetAudience === 'MASTER' || p.targetAudience === 'BOTH') && p.stock > 0
  );
  const heroProducts = products.filter(
    (p) => (p.targetAudience === 'HERO' || p.targetAudience === 'BOTH') && p.stock > 0
  );

  const effectiveMultiplier =
    (pricePct / 100) *
    (warranty ? 1.12 : 1) *
    (exclusive ? 1.25 : 1) *
    (bilateralSkillUnlocked ? 1.1 : 1);

  return (
    <div className="space-y-5">
      {/* F01 Fix: Explicit Scheduled Expedition Matchup & Rotation Schedule Banner */}
      <div className="bg-[#131822] border border-amber-500/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-semibold">
              SCHEDULED EXPEDITION (DAY {day})
            </span>
            <span className="text-slate-100 font-semibold">
              {activeParty.name} (Raiders) vs {activeMaster.name} (Lair Owner)
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Next Scheduled Rotation (Day {day + 1}):{' '}
            <span className="text-slate-300">
              {nextPartyName} vs {nextMasterName}
            </span>{' '}
            · Selecting a client below locks them as today’s active expedition participant.
          </p>
        </div>

        <button
          onClick={onLaunchExpedition}
          className="min-h-[42px] px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-mono font-semibold text-xs rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          Resolve Scheduled Raid ({activeParty.name} vs {activeMaster.name}) →
        </button>
      </div>

      {/* Negotiation Terms Bar */}
      <div className="bg-[#131822] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-slate-100">
            Bilateral Contract Terms · Day {day} · Market ×{getDailyMarketContext(seed, day, activeRegion).factor.toFixed(3)}
          </h2>
          <p className="text-xs text-slate-400">
            Supply {activeMaster.name} on the left and {activeParty.name} on the right before resolving their encounter.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1 bg-[#0B0E14] border border-slate-800 rounded-lg p-1">
            {[
              { label: '85% Fair', val: 85 },
              { label: '100% List', val: 100 },
              { label: '125% Premium', val: 125 }
            ].map((tier) => (
              <button
                key={tier.val}
                onClick={() => updateTerms(tier.val, warranty, exclusive, secretMark)}
                className={`min-h-[36px] px-2.5 py-1 rounded cursor-pointer whitespace-nowrap shrink-0 ${
                  pricePct === tier.val ? 'bg-amber-600 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={warranty}
              onChange={(e) => updateTerms(pricePct, e.target.checked, exclusive, secretMark)}
              className="accent-amber-500"
            />
            <span>Warranty (+12% Price, Refund on Failure)</span>
          </label>

          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={exclusive}
              onChange={(e) => updateTerms(pricePct, warranty, e.target.checked, secretMark)}
              className="accent-amber-500"
            />
            <span>Exclusivity (+22% Price)</span>
          </label>

          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={secretMark}
              onChange={(e) => updateTerms(pricePct, warranty, exclusive, e.target.checked)}
              className="accent-emerald-500"
            />
            <span>Null-Wax Secret Provenance (-35g Fee)</span>
          </label>
        </div>
      </div>

      {/* Split Bilateral Desk: Dungeon Master vs Adventuring Party */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 6 Cols: Dungeon Master Procurement */}
        <div className="lg:col-span-6 bg-[#131822] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-rose-400 block">
                  SCHEDULED DUNGEON MASTER · DEFENDER
                </span>
                <h3 className="font-display text-lg font-bold text-slate-100">{activeMaster.name}</h3>
                <p className="text-xs text-slate-400">{activeMaster.title}</p>
              </div>
              <select
                aria-label="Scheduled Dungeon Master"
                value={activeMaster.id}
                onChange={(e) => onSelectScheduledMatchup(e.target.value, activeParty.id)}
                className="bg-[#0B0E14] border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 font-mono"
              >
                {regionMasters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.budget}g)
                  </option>
                ))}
              </select>
            </div>

            {/* Master Metrics */}
            <div className="grid grid-cols-4 gap-2 mb-4 text-xs font-mono tabular-nums">
              <div className="p-2 bg-[#0B0E14] border border-slate-800 rounded">
                <span className="text-slate-400 block">Treasury</span>
                <span className="text-amber-400 font-semibold">{activeMaster.budget}g</span>
              </div>
              <div className="p-2 bg-[#0B0E14] border border-slate-800 rounded">
                <span className="text-slate-400 block">Deterrence</span>
                <span className="text-rose-400 font-semibold">{activeMaster.deterrenceScore}/100</span>
              </div>
              <div className="p-2 bg-[#0B0E14] border border-slate-800 rounded">
                <span className="text-slate-400 block">Visitor Raid %</span>
                <span className="text-sky-400 font-semibold">{activeMaster.visitorTraffic}%</span>
              </div>
              <div className="p-2 bg-[#0B0E14] border border-slate-800 rounded">
                <span className="text-slate-400 block">Trust</span>
                <span className="text-emerald-400 font-semibold">{activeMaster.trust}/100</span>
              </div>
            </div>

            <div className="p-3 bg-[#0B0E14] border border-slate-800 rounded-lg mb-4 text-xs space-y-1">
              <div className="font-mono text-amber-300">Wanted Hazard Profile: {activeMaster.desiredTrait}</div>
              <div className="font-mono text-slate-400">
                Installed Hazards ({activeMaster.installedHazards.length}/3):{' '}
                {activeMaster.installedHazards
                  .map((hid) => products.find((p) => p.id === hid)?.name || hid)
                  .join(' · ') || 'Default Spike Plate'}
              </div>
              <p className="text-slate-300">{activeMaster.memoryLog[activeMaster.memoryLog.length - 1]}</p>
            </div>

            <div className="text-xs font-mono text-slate-400 mb-2">
              Available Traps &amp; Monster Hazards in Stock ({masterProducts.length}):
            </div>
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {masterProducts.length === 0 ? (
                <div className="p-4 bg-[#0B0E14] border border-slate-800 rounded text-xs text-slate-400">
                  No traps in stock. Assemble traps in the Trap Workshop first.
                </div>
              ) : (
                masterProducts.map((prod) => {
                  const quote = computeQuotation(prod, activeMaster, 'MASTER', {
                    priceMultiplier: pricePct / 100,
                    warrantyBacked: warranty,
                    exclusiveDeal: exclusive,
                    secretProvenance: secretMark,
                    day,
                    seed,
                    unlockedSkills
                  });
                  const askPrice = quote.unitPrice;
                  const canAfford = quote.canAfford;
                  const acceptable = quote.acceptable;
                  const sigLabel = prod.formulaSignature || prod.id.slice(-6).toUpperCase();
                  return (
                    <div
                      key={prod.id}
                      className="p-3 bg-[#0B0E14] border border-slate-800 rounded-lg flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 truncate">
                          {prod.name}{' '}
                          <span className="text-[11px] font-mono text-amber-400">[#{sigLabel}]</span>
                        </div>
                        <div className="text-xs font-mono text-slate-400 tabular-nums">
                          Stock: {prod.stock} · Lethality {prod.potency} · DC {prod.detectionDC} · Trigger{' '}
                          {prod.triggerMassThresholdKg}kg
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {prod.reactionNotes[0]}
                        </div>
                        {!acceptable && quote.refusalReason && (
                          <div className="text-[11px] font-mono text-rose-400 mt-1">
                            ⚠ {quote.refusalReason}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          onExecuteSale(
                            'MASTER',
                            activeMaster.id,
                            prod,
                            pricePct / 100,
                            warranty,
                            exclusive,
                            secretMark
                          )
                        }
                        disabled={!acceptable}
                        title={quote.refusalReason || `Expected Trust: ${quote.expectedTrustDelta >= 0 ? '+' : ''}${quote.expectedTrustDelta}`}
                        className="min-h-[40px] px-3.5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-mono font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
                      >
                        {quote.boycotting ? 'Boycott' : !canAfford ? 'No Budget' : `Sell (${askPrice}g)`}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Adventuring Party Outfitting */}
        <div className="lg:col-span-6 bg-[#131822] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-emerald-400 block">
                  SCHEDULED ADVENTURING PARTY · CHALLENGER
                </span>
                <h3 className="font-display text-lg font-bold text-slate-100">{activeParty.name}</h3>
                <p className="text-xs text-slate-400">
                  {activeParty.ethics} Ethics · &ldquo;{activeParty.motto}&rdquo;
                </p>
              </div>
              <select
                aria-label="Scheduled Adventuring Party"
                value={activeParty.id}
                onChange={(e) => onSelectScheduledMatchup(activeMaster.id, e.target.value)}
                className="bg-[#0B0E14] border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 font-mono"
              >
                {regionParties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.budget}g)
                  </option>
                ))}
              </select>
            </div>

            {/* Party Metrics */}
            <div className="grid grid-cols-4 gap-2 mb-4 text-xs font-mono tabular-nums">
              <div className="p-2 bg-[#0B0E14] border border-slate-800 rounded">
                <span className="text-slate-400 block">Party Gold</span>
                <span className="text-amber-400 font-semibold">{activeParty.budget}g</span>
              </div>
              <div className="p-2 bg-[#0B0E14] border border-slate-800 rounded">
                <span className="text-slate-400 block">Vanguard Mass</span>
                <span className="text-sky-400 font-semibold">{activeParty.members[0]?.massKg || 85}kg</span>
              </div>
              <div className="p-2 bg-[#0B0E14] border border-slate-800 rounded">
                <span className="text-slate-400 block">Caution</span>
                <span className="text-slate-200 font-semibold">{activeParty.caution}/100</span>
              </div>
              <div className="p-2 bg-[#0B0E14] border border-slate-800 rounded">
                <span className="text-slate-400 block">Trust</span>
                <span className="text-emerald-400 font-semibold">{activeParty.trust}/100</span>
              </div>
            </div>

            <div className="p-3 bg-[#0B0E14] border border-slate-800 rounded-lg mb-4 text-xs space-y-1">
              <div className="font-mono text-emerald-300">Wanted Countermeasure: {activeParty.desiredCounter}</div>
              <div className="font-mono text-slate-400">
                Equipped Loadout ({activeParty.equippedProducts.length}/3):{' '}
                {activeParty.equippedProducts
                  .map((pid) => products.find((p) => p.id === pid)?.name || pid)
                  .join(' · ') || 'Standard Guild Issue'}
              </div>
              <p className="text-slate-300">{activeParty.memoryLog[activeParty.memoryLog.length - 1]}</p>
            </div>

            <div className="text-xs font-mono text-slate-400 mb-2">
              Available Tonics, Antidotes &amp; Counter-Gear in Stock ({heroProducts.length}):
            </div>
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {heroProducts.length === 0 ? (
                <div className="p-4 bg-[#0B0E14] border border-slate-800 rounded text-xs text-slate-400">
                  No hero tonics in stock. Brew antidotes or morph draughts in the Alchemy Lab first.
                </div>
              ) : (
                heroProducts.map((prod) => {
                  const quote = computeQuotation(prod, activeParty, 'HERO', {
                    priceMultiplier: pricePct / 100,
                    warrantyBacked: warranty,
                    exclusiveDeal: exclusive,
                    secretProvenance: secretMark,
                    day,
                    seed,
                    unlockedSkills
                  });
                  const askPrice = quote.unitPrice;
                  const canAfford = quote.canAfford;
                  const acceptable = quote.acceptable;
                  const sigLabel = prod.formulaSignature || prod.id.slice(-6).toUpperCase();
                  return (
                    <div
                      key={prod.id}
                      className="p-3 bg-[#0B0E14] border border-slate-800 rounded-lg flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 truncate">
                          {prod.name}{' '}
                          <span className="text-[11px] font-mono text-emerald-400">[#{sigLabel}]</span>
                        </div>
                        <div className="text-xs font-mono text-slate-400 tabular-nums">
                          Stock: {prod.stock} · Potency {prod.potency} · Stab {prod.stability}
                          {prod.massEffectKg !== 0 ? ` · ${prod.massEffectKg}kg Mass` : ''}
                          {prod.sulphurVulnerable ? ' · VULNERABLE TO SULPHUR' : ' · SULPHUR SAFE'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {prod.reactionNotes[0]}
                        </div>
                        {!acceptable && quote.refusalReason && (
                          <div className="text-[11px] font-mono text-rose-400 mt-1">
                            ⚠ {quote.refusalReason}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          onExecuteSale(
                            'HERO',
                            activeParty.id,
                            prod,
                            pricePct / 100,
                            warranty,
                            exclusive,
                            secretMark
                          )
                        }
                        disabled={!acceptable}
                        title={quote.refusalReason || `Expected Trust: ${quote.expectedTrustDelta >= 0 ? '+' : ''}${quote.expectedTrustDelta}`}
                        className="min-h-[40px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-mono font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
                      >
                        {quote.boycotting ? 'Boycott' : !canAfford ? 'No Budget' : `Sell (${askPrice}g)`}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Summary of Today's Bilateral Contracts + Launch Expedition CTA */}
      <div className="bg-[#131822] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs font-mono text-slate-300">
          <span>
            Contracts Signed Today: <strong className="text-amber-400">{contractsToday.length}</strong>
          </span>
          <span className="mx-2">·</span>
          <span>
            Today’s Recognised Revenue:{' '}
            <strong className="text-emerald-400">
              {contractsToday.reduce((acc, c) => acc + c.totalRevenue, 0).toLocaleString()}g
            </strong>
          </span>
        </div>

        <button
          onClick={onLaunchExpedition}
          className="min-h-[44px] px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          Resolve Dungeon Expedition ({activeParty.name} vs {activeMaster.name})
        </button>
      </div>
    </div>
  );
};

interface FinancialsPanelProps {
  gold: number;
  debt: number;
  unlockedRegions: RegionId[];
  expertUnlocked: boolean;
  ledger: FinancialRecord[];
  rivals: RivalHouse[];
  cheapCreditUnlocked: boolean;
  onUnlockRegionCharter: (regionId: RegionId, cost: number, useBridgeLoan: boolean) => void;
  onPayDownDebt: (amount: number) => void;
}

export const FinancialsPanel: React.FC<FinancialsPanelProps> = ({
  gold,
  debt,
  unlockedRegions,
  expertUnlocked,
  ledger,
  rivals,
  cheapCreditUnlocked,
  onUnlockRegionCharter,
  onPayDownDebt
}) => {
  return (
    <div className="space-y-6">
      {/* Region Trading Charters & Bridge Financing (Prevents Softlocks) */}
      <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-100">
              01. Regional Trading Charters &amp; Bridge Financing
            </h2>
            <p className="text-xs text-slate-400">
              Earlier dungeons remain active in the connected world economy after later charters unlock. Bridge loans charge {cheapCreditUnlocked ? '0.3%' : '0.5%'}/day and auto-amortize out of net profits.
            </p>
          </div>
          {debt > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-rose-400 tabular-nums">
                Active Bridge Debt: {debt.toLocaleString()}g
              </span>
              <button
                onClick={() => onPayDownDebt(Math.min(gold, debt))}
                disabled={gold <= 0}
                className="min-h-[38px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-mono font-semibold rounded cursor-pointer whitespace-nowrap shrink-0"
              >
                Repay Debt ({Math.min(gold, debt).toLocaleString()}g)
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {REGIONS_DATA.map((reg) => {
            const isUnlocked = unlockedRegions.includes(reg.id);
            const canBuyCash = !reg.requiresCatalyst && gold >= reg.charterCostGold;
            const minDownPayment = Math.round(reg.charterCostGold * (cheapCreditUnlocked ? 0.2 : 0.3));
            const canBridgeLoan = !reg.requiresCatalyst && gold >= minDownPayment && !isUnlocked;

            return (
              <div
                key={reg.id}
                className={`p-4 rounded-xl border flex flex-col justify-between ${
                  isUnlocked ? 'bg-[#0B0E14] border-emerald-800/70' : 'bg-[#0B0E14] border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                    <span>
                      REALM {reg.roman} · {reg.difficulty.toUpperCase()}
                    </span>
                    <span className={isUnlocked ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                      {isUnlocked ? 'CHARTER ACTIVE' : reg.requiresCatalyst ? 'CATALYST GATE' : `${reg.charterCostGold.toLocaleString()}g`}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-100 mb-1.5">{reg.name}</h3>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">{reg.tagline}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  {isUnlocked ? (
                    <div className="text-xs font-mono text-emerald-400">
                      Connected to Daily Market Loop
                    </div>
                  ) : reg.requiresCatalyst ? (
                    <div className="text-xs font-mono text-amber-300">
                      {expertUnlocked
                        ? 'Catalyst Verified! Click to Activate.'
                        : 'Requires Hard Mode (Blackspire) + Attributable Paradox Catalyst.'}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => onUnlockRegionCharter(reg.id, reg.charterCostGold, false)}
                        disabled={!canBuyCash}
                        className="min-h-[38px] w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-mono font-semibold text-xs rounded cursor-pointer whitespace-nowrap"
                      >
                        Buy Charter Cash ({reg.charterCostGold.toLocaleString()}g)
                      </button>
                      <button
                        onClick={() => onUnlockRegionCharter(reg.id, reg.charterCostGold, true)}
                        disabled={!canBridgeLoan}
                        className="min-h-[38px] w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-mono text-xs rounded cursor-pointer whitespace-nowrap"
                      >
                        Bridge Loan ({minDownPayment.toLocaleString()}g Down)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Double-Entry Accounting Ledger Table */}
      <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <h2 className="font-display text-lg font-bold text-slate-100">
            02. Merchant Profit &amp; Balance Sheet Ledger
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Profit = Recognised Sales − COGS − Overhead − Warranty Claims − Fines − Interest
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">Day</th>
                <th className="py-2.5 px-3">Revenue</th>
                <th className="py-2.5 px-3">COGS</th>
                <th className="py-2.5 px-3">Gross Margin</th>
                <th className="py-2.5 px-3">Overhead</th>
                <th className="py-2.5 px-3">Claims / Fines / Int</th>
                <th className="py-2.5 px-3">Net Profit</th>
                <th className="py-2.5 px-3">Ending Cash</th>
                <th className="py-2.5 px-3">Debt</th>
                <th className="py-2.5 px-3">Net Worth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {ledger.map((row) => (
                <tr key={row.day} className="hover:bg-slate-900/50">
                  <td className="py-2.5 px-3 text-slate-200 font-semibold">Day {row.day}</td>
                  <td className="py-2.5 px-3 text-emerald-400">+{row.grossRevenue.toLocaleString()}g</td>
                  <td className="py-2.5 px-3 text-slate-300">-{row.cogs.toLocaleString()}g</td>
                  <td className="py-2.5 px-3 text-sky-400">{row.grossMargin.toLocaleString()}g</td>
                  <td className="py-2.5 px-3 text-slate-400">-{row.overheadAndStorage.toLocaleString()}g</td>
                  <td className="py-2.5 px-3 text-rose-400">
                    -{(row.warrantyAndClaims + row.finesAndBribes + row.financingInterest).toLocaleString()}g
                  </td>
                  <td className={`py-2.5 px-3 font-semibold ${row.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {row.netProfit >= 0 ? `+${row.netProfit.toLocaleString()}g` : `${row.netProfit.toLocaleString()}g`}
                  </td>
                  <td className="py-2.5 px-3 text-amber-300">{row.endingCash.toLocaleString()}g</td>
                  <td className="py-2.5 px-3 text-rose-300">{row.debt.toLocaleString()}g</td>
                  <td className="py-2.5 px-3 text-slate-100 font-semibold">{row.netWorth.toLocaleString()}g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rival Merchant Houses Activity */}
      <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
        <h3 className="font-display text-base font-bold text-slate-100 mb-3">
          03. Competing Rival Merchant Houses (4 Active Competitors)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rivals.map((riv) => (
            <div key={riv.id} className="p-3.5 bg-[#0B0E14] border border-slate-800 rounded-lg text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-100 text-sm">{riv.name}</span>
                <span className="font-mono text-amber-400 tabular-nums">
                  Market Share: {riv.marketShare}% · Undercut: {riv.priceUndercutPct}%
                </span>
              </div>
              <div className="text-slate-400 mb-1.5">Specialty: {riv.specialty}</div>
              <div className="font-mono text-slate-300 bg-slate-900/90 p-2 rounded border border-slate-800">
                Latest Move: {riv.lastAction}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
