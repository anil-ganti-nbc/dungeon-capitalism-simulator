import React, { useState } from 'react';
import {
  MarketFactOrRumour,
  DungeonMaster,
  AdventuringParty,
  SkillNode,
  ParadoxCatalystEntry,
  ExpeditionReport,
  RegionId
} from '../types/game';
import { generatePeerCatalystCode } from '../engine/simulation';
import { Sim001AuditPanel } from './Sim001AuditPanel';

interface IntelPanelProps {
  day: number;
  gold: number;
  intelFeed: MarketFactOrRumour[];
  basiliskChainStage: number;
  blackspireUnlocked: boolean;
  blackspireResolution: 'NONE' | 'HONEST_BROKER' | 'CARTEL_SYNDICATE' | 'PARTISAN_ARMOURER' | 'CALCULATED_CHAOS';
  onResolveBasiliskDecision: (choice: 'REFORMULATE' | 'REFUND_GUILD' | 'BRIBE_GRIMTHORN' | 'BLAME_RIVAL') => void;
  onChooseBlackspireEnding: (ending: 'HONEST_BROKER' | 'CARTEL_SYNDICATE' | 'PARTISAN_ARMOURER' | 'CALCULATED_CHAOS') => void;
}

export const IntelAndStoryPanel: React.FC<IntelPanelProps> = ({
  day,
  gold,
  intelFeed,
  basiliskChainStage,
  blackspireUnlocked,
  blackspireResolution,
  onResolveBasiliskDecision,
  onChooseBlackspireEnding
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'FACTS' | 'RUMOURS'>('ALL');

  const filteredIntel = intelFeed.filter((item) => {
    if (filterType === 'FACTS') return item.isVerifiedFact;
    if (filterType === 'RUMOURS') return !item.isVerifiedFact;
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 7 Cols: Timestamped Market Facts vs In-World Rumours */}
      <div className="lg:col-span-7 bg-[#131822] border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-100">
              01. Morning Intelligence &amp; Rumour Desk
            </h2>
            <p className="text-xs text-slate-400">
              Verified facts are audited from freight manifests; tavern rumours carry explicit confidence scores.
            </p>
          </div>
          <div className="flex gap-1 bg-[#0B0E14] p-1 rounded-lg border border-slate-800">
            {(['ALL', 'FACTS', 'RUMOURS'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-2.5 py-1 text-xs font-mono rounded cursor-pointer whitespace-nowrap shrink-0 ${
                  filterType === f ? 'bg-amber-600 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {filteredIntel.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-[#0B0E14] border border-slate-800 rounded-lg space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
                <span>
                  DAY {item.day} · {item.timestamp} · {item.region.toUpperCase()}
                </span>
                <span className={item.isVerifiedFact ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                  {item.isVerifiedFact
                    ? 'VERIFIED FACT (100%)'
                    : `UNCONFIRMED RUMOUR (${item.reliabilityPct}% CONFIDENCE)`}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-100">{item.headline}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{item.detail}</p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Source Provenance: {item.source}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right 5 Cols: Emergent Story Chains (Basilisk Supply Chain & Blackspire Resolution) */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <h3 className="font-display text-base font-bold text-slate-100">
              02. Emergent Case: The Basilisk Supply Chain
            </h3>
            <span className="text-xs font-mono text-amber-400">
              Stage {basiliskChainStage} / 3
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            Overseer Grimthorn pairs a Cave-Basilisk with a Sulphur-Fog Machine. Standard unstabilised Basilisk Antidotes sold to the Silver Stag Company lose 55% potency in sulphur vapour, triggering partial petrification and a Guild Investigation. How do you play the fallout?
          </p>

          <div className="space-y-2">
            <button
              onClick={() => onResolveBasiliskDecision('REFORMULATE')}
              className="w-full text-left p-3 bg-[#0B0E14] hover:bg-slate-900 border border-slate-800 rounded-lg text-xs transition-colors cursor-pointer"
            >
              <div className="font-semibold text-emerald-400 mb-0.5">
                A. Reformulate with Calcified Quartz Salt (+2 Chelated Antidotes)
              </div>
              <div className="text-slate-400">
                Synthesize Sulphur-Immune Quartz-Chelated Antidotes for Silver Stag (+15 Hero Trust, creates DM demand for 8kg Acid Traps).
              </div>
            </button>

            <button
              onClick={() => onResolveBasiliskDecision('REFUND_GUILD')}
              disabled={gold < 180}
              className="w-full text-left p-3 bg-[#0B0E14] hover:bg-slate-900 disabled:opacity-40 border border-slate-800 rounded-lg text-xs transition-colors cursor-pointer"
            >
              <div className="font-semibold text-sky-400 mb-0.5">
                B. Indemnify &amp; Refund Silver Stag Guild (-180g)
              </div>
              <div className="text-slate-400">
                Quashes the Guild Investigation and restores +20 Hero Trust across the Warrens.
              </div>
            </button>

            <button
              onClick={() => onResolveBasiliskDecision('BRIBE_GRIMTHORN')}
              disabled={gold < 150}
              className="w-full text-left p-3 bg-[#0B0E14] hover:bg-slate-900 disabled:opacity-40 border border-slate-800 rounded-lg text-xs transition-colors cursor-pointer"
            >
              <div className="font-semibold text-amber-400 mb-0.5">
                C. Subsidy Pact with Overseer Grimthorn (-150g)
              </div>
              <div className="text-slate-400">
                Grimthorn throttles his Sulphur vents to keep raids profitable (+20 DM Trust, +320g contract order).
              </div>
            </button>

            <button
              onClick={() => onResolveBasiliskDecision('BLAME_RIVAL')}
              className="w-full text-left p-3 bg-[#0B0E14] hover:bg-slate-900 border border-slate-800 rounded-lg text-xs transition-colors cursor-pointer"
            >
              <div className="font-semibold text-rose-400 mb-0.5">
                D. Frame Rival House Vane &amp; Sons for Diluted Bile
              </div>
              <div className="text-slate-400">
                Shifts blame onto Vane &amp; Sons (-6% Rival Market Share) and boosts demand for your Charcoal Breathers.
              </div>
            </button>
          </div>
        </div>

        {/* Central Campaign Political Resolution (Blackspire Hard Mode) */}
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <h3 className="font-display text-base font-bold text-slate-100">
              03. Blackspire Central Campaign Resolution
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {blackspireResolution === 'NONE' ? 'Active Story Horizon' : `Resolved: ${blackspireResolution}`}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            The core narrative resolves in Blackspire Labyrinth (Hard) without requiring Expert. Choose your merchant house’s permanent political doctrine:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              {
                id: 'HONEST_BROKER' as const,
                title: 'Ethical Bilateral Broker',
                desc: 'Transparent warranties & non-lethal deterrence (+Trust with both sides).'
              },
              {
                id: 'CARTEL_SYNDICATE' as const,
                title: 'Unchallenged Monopoly',
                desc: 'Corner reagent supply & fix prices across all four regions (+Margin).'
              },
              {
                id: 'PARTISAN_ARMOURER' as const,
                title: 'Crown Defence Contractor',
                desc: 'Indemnified state supplier to Dungeon Masters or Guilds.'
              },
              {
                id: 'CALCULATED_CHAOS' as const,
                title: 'Catastrophe Profiteer',
                desc: 'Engineer perpetual arms-race escalation between masters & raiders.'
              }
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => onChooseBlackspireEnding(opt.id)}
                className={`p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                  blackspireResolution === opt.id
                    ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                    : 'bg-[#0B0E14] border-slate-800 hover:border-slate-700 text-slate-200'
                }`}
              >
                <div className="font-semibold mb-1">{opt.title}</div>
                <div className="text-slate-400 text-[11px]">{opt.desc}</div>
              </button>
            ))}
          </div>
          {!blackspireUnlocked && (
            <p className="text-[11px] font-mono text-amber-400/90 mt-3">
              Note: You can pre-select your house doctrine now; full Crown ratification triggers upon unlocking Blackspire Labyrinth.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

interface ClientDirectoryProps {
  masters: DungeonMaster[];
  parties: AdventuringParty[];
}

export const ClientDirectoryPanel: React.FC<ClientDirectoryProps> = ({ masters, parties }) => {
  const [regionFilter, setRegionFilter] = useState<RegionId | 'ALL'>('ALL');

  const filteredMasters = masters.filter((m) => regionFilter === 'ALL' || m.region === regionFilter);
  const filteredParties = parties.filter((p) => regionFilter === 'ALL' || p.region === regionFilter);

  return (
    <div className="space-y-6">
      <div className="bg-[#131822] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-100">
            Client Memory &amp; Dossier Registry (12 Masters · 16 Parties)
          </h2>
          <p className="text-xs text-slate-400">
            No forced 50/50 reputation bar. Faction loyalty, specialist arms dealing, or bilateral balance are all viable.
          </p>
        </div>
        <div className="flex gap-1 bg-[#0B0E14] p-1 rounded-lg border border-slate-800">
          {(['ALL', 'cellar', 'warrens', 'blackspire', 'vault'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRegionFilter(r)}
              className={`px-3 py-1 text-xs font-mono rounded cursor-pointer whitespace-nowrap shrink-0 ${
                regionFilter === r ? 'bg-amber-600 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 12 Named Dungeon Masters */}
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
          <h3 className="font-display text-base font-bold text-rose-400 mb-3">
            Dungeon Masters ({filteredMasters.length})
          </h3>
          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
            {filteredMasters.map((m) => (
              <div key={m.id} className="p-3.5 bg-[#0B0E14] border border-slate-800 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-100 text-sm">{m.name}</span>
                  <span className="font-mono text-amber-400 tabular-nums">
                    {m.region.toUpperCase()} · Budget {m.budget}g · Trust {m.trust}
                  </span>
                </div>
                <div className="text-slate-400">{m.title} — {m.personality}</div>
                <div className="font-mono text-slate-300 tabular-nums">
                  Deterrence {m.deterrenceScore} · Prestige {m.prestigeScore} · Visitor Traffic {m.visitorTraffic}%
                </div>
                <div className="text-emerald-400 font-mono">Wants: {m.desiredTrait}</div>
                <div className="text-slate-400 italic">
                  Latest Memory: "{m.memoryLog[m.memoryLog.length - 1]}"
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 16 Named Adventuring Parties */}
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
          <h3 className="font-display text-base font-bold text-emerald-400 mb-3">
            Adventuring Parties ({filteredParties.length})
          </h3>
          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
            {filteredParties.map((p) => (
              <div key={p.id} className="p-3.5 bg-[#0B0E14] border border-slate-800 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-100 text-sm">{p.name}</span>
                  <span className="font-mono text-amber-400 tabular-nums">
                    {p.region.toUpperCase()} · Gold {p.budget}g · Trust {p.trust}
                  </span>
                </div>
                <div className="text-slate-400">
                  Ethics: {p.ethics} · Caution: {p.caution}/100 · "{p.motto}"
                </div>
                <div className="font-mono text-sky-300 tabular-nums">
                  Roster: {p.members.map((mem) => `${mem.name} (${mem.role}, ${mem.massKg}kg)`).join(' · ')}
                </div>
                <div className="text-amber-300 font-mono">Seeking: {p.desiredCounter}</div>
                <div className="text-slate-400 italic">
                  Latest Memory: "{p.memoryLog[p.memoryLog.length - 1]}"
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SpecialisationsProps {
  skillPoints: number;
  skills: SkillNode[];
  onUnlockSkill: (skillId: string) => void;
}

export const SpecialisationsPanel: React.FC<SpecialisationsProps> = ({
  skillPoints,
  skills,
  onUnlockSkill
}) => {
  const branches: Array<'Alchemy' | 'Engineering' | 'Commerce' | 'Intelligence'> = [
    'Alchemy',
    'Engineering',
    'Commerce',
    'Intelligence'
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#131822] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-100">
            Merchant Specialisation Trees (Combinable Freely)
          </h2>
          <p className="text-xs text-slate-400">
            No classes are sealed. Earn +1 Skill Point per resolved expedition or milestone.
          </p>
        </div>
        <div className="text-sm font-mono font-semibold text-amber-400 tabular-nums">
          Available Skill Points: {skillPoints} SP
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {branches.map((branch) => (
          <div key={branch} className="bg-[#131822] border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="font-display text-base font-bold text-slate-100 pb-2 border-b border-slate-800">
              {branch} Branch
            </h3>
            {skills
              .filter((s) => s.branch === branch)
              .map((sk) => (
                <div
                  key={sk.id}
                  className={`p-3 rounded-lg border text-xs flex flex-col justify-between gap-2 ${
                    sk.unlocked
                      ? 'bg-emerald-950/25 border-emerald-700/70'
                      : 'bg-[#0B0E14] border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between font-mono text-[11px] text-slate-400 mb-1">
                      <span>TIER {sk.tier}</span>
                      <span>{sk.unlocked ? 'ACTIVE' : `${sk.costPoints} SP`}</span>
                    </div>
                    <div className="font-semibold text-slate-100 mb-1">{sk.name}</div>
                    <p className="text-slate-400 leading-relaxed">{sk.description}</p>
                  </div>
                  {!sk.unlocked && (
                    <button
                      onClick={() => onUnlockSkill(sk.id)}
                      disabled={skillPoints < sk.costPoints}
                      className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-mono font-semibold rounded cursor-pointer"
                    >
                      Unlock ({sk.costPoints} SP)
                    </button>
                  )}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
};

interface ArchivesAndCatalystProps {
  day: number;
  seed: number;
  blackspireUnlocked: boolean;
  expertUnlocked: boolean;
  catalystLedger: ParadoxCatalystEntry[];
  expeditionReports: ExpeditionReport[];
  customBrewsCount: number;
  customTrapsCount: number;
  masterSalesCount: number;
  heroSalesCount: number;
  onClaimSoloDmCatalyst: () => void;
  onImportPeerCatalyst: (code: string) => { valid: boolean; message: string };
  onExportSaveJson: () => string;
  onImportSaveJson: (jsonStr: string) => boolean;
}

export const ArchivesAndCatalystPanel: React.FC<ArchivesAndCatalystProps> = ({
  day,
  seed,
  blackspireUnlocked,
  expertUnlocked,
  catalystLedger,
  expeditionReports,
  customBrewsCount,
  customTrapsCount,
  masterSalesCount,
  heroSalesCount,
  onClaimSoloDmCatalyst,
  onImportPeerCatalyst,
  onExportSaveJson,
  onImportSaveJson
}) => {
  const [subView, setSubView] = useState<'SIM_001' | 'CATALYST_SAVES'>('SIM_001');
  const [peerInputCode, setPeerInputCode] = useState('');
  const [peerFeedback, setPeerFeedback] = useState<string | null>(null);
  const [saveJsonText, setSaveJsonText] = useState('');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const outboundShareCode = generatePeerCatalystCode('HOUSE_MERCHANT', day);
  const sampleValidPeerCode = generatePeerCatalystCode('VESPERA_ENVOY', day + 1);

  const bilateralVerified = masterSalesCount >= 2 && heroSalesCount >= 2;
  const soloCommissionReady =
    blackspireUnlocked &&
    customBrewsCount >= 2 &&
    customTrapsCount >= 2 &&
    bilateralVerified;

  const handlePeerSubmit = () => {
    const res = onImportPeerCatalyst(peerInputCode);
    setPeerFeedback(res.message);
    if (res.valid) setPeerInputCode('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#131822] border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-mono text-slate-300">
          ARCHIVES &amp; INDEPENDENT AUDIT WORKSPACE (SIM-001 BASELINE &amp; SIM-002 REPAIR)
        </div>
        <div className="flex gap-1 bg-[#0B0E14] p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setSubView('SIM_001')}
            className={`min-h-[38px] px-3 py-1.5 text-xs font-mono rounded cursor-pointer whitespace-nowrap shrink-0 ${
              subView === 'SIM_001'
                ? 'bg-amber-600 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SIM-001 &amp; SIM-002 Empirical Audit (5,000 Campaigns)
          </button>
          <button
            onClick={() => setSubView('CATALYST_SAVES')}
            className={`min-h-[38px] px-3 py-1.5 text-xs font-mono rounded cursor-pointer whitespace-nowrap shrink-0 ${
              subView === 'CATALYST_SAVES'
                ? 'bg-amber-600 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Paradox Catalyst Gate &amp; Save Ledger
          </button>
        </div>
      </div>

      {subView === 'SIM_001' ? (
        <Sim001AuditPanel />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 7 Cols: Paradox Catalyst Gate & Provenance Gift Ledger */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-800">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-100">
                01. The Paradox Catalyst Gate (Hard → Expert)
              </h2>
              <p className="text-xs text-slate-400">
                Hard Rule: Requires prior Blackspire Labyrinth (Hard) access + an attributable Catalyst via Vespera’s Commission or Cryptographic Peer Exchange.
              </p>
            </div>
            <span className={`text-xs font-mono font-semibold ${expertUnlocked ? 'text-emerald-400' : 'text-amber-400'}`}>
              {expertUnlocked ? 'THE PARADOX VAULT UNLOCKED' : 'AWAITING HARD CHARTER & CATALYST'}
            </span>
          </div>

          {/* Route A: Solo Self-Found Offline DM Commission */}
          <div className="p-4 bg-[#0B0E14] border border-slate-800 rounded-lg mb-4">
            <div className="text-xs font-mono text-amber-400 mb-1">
              ROUTE A · SOLO OFFLINE DUNGEON MASTER COMMISSION (Arch-Architect Vespera)
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Satisfy Vespera’s four-part Hard-mode engineering, alchemy, and bilateral supply audit to receive a couriered Paradox Catalyst:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono tabular-nums mb-3">
              <div className={`p-2 rounded border ${blackspireUnlocked ? 'border-emerald-700 text-emerald-400' : 'border-slate-800 text-slate-400'}`}>
                1. Hard Mode (Blackspire): {blackspireUnlocked ? 'UNLOCKED' : 'LOCKED'}
              </div>
              <div className={`p-2 rounded border ${customBrewsCount >= 2 ? 'border-emerald-700 text-emerald-400' : 'border-slate-800 text-slate-400'}`}>
                2. Custom Alchemy Brews: {customBrewsCount}/2
              </div>
              <div className={`p-2 rounded border ${customTrapsCount >= 2 ? 'border-emerald-700 text-emerald-400' : 'border-slate-800 text-slate-400'}`}>
                3. Custom Trap Assemblies: {customTrapsCount}/2
              </div>
              <div className={`p-2 rounded border ${bilateralVerified ? 'border-emerald-700 text-emerald-400' : 'border-slate-800 text-slate-400'}`}>
                4. Bilateral Contracts: {masterSalesCount}/2 DM · {heroSalesCount}/2 Hero
              </div>
            </div>
            <button
              onClick={onClaimSoloDmCatalyst}
              disabled={!soloCommissionReady || expertUnlocked}
              className="min-h-[42px] px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-mono font-semibold text-xs rounded-lg cursor-pointer"
            >
              {expertUnlocked
                ? 'Catalyst Recorded in Gift Ledger'
                : soloCommissionReady
                ? 'Receive Couriered Paradox Catalyst from Arch-Architect Vespera'
                : 'Complete All 4 Hard-Mode Commission Requirements Above'}
            </button>
          </div>

          {/* Route B: Community Merchant Dispatch Code Exchange */}
          <div className="p-4 bg-[#0B0E14] border border-slate-800 rounded-lg">
            <div className="text-xs font-mono text-sky-400 mb-1">
              ROUTE B · COMMUNITY MERCHANT DISPATCH CODE (Format Checksum &amp; Replay Protection)
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Once Blackspire Labyrinth (Hard) is unlocked, enter a community peer dispatch code. Codes are verified for format syntax and local replay prevention. Note: this is a casual community trade code; authentic offline progression is earned via Vespera’s Solo Commission above.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900 border border-slate-800 rounded text-xs font-mono mb-3">
              <span className="text-slate-300">Your Outbound Community Dispatch Code:</span>
              <span className="text-emerald-400 font-semibold select-all">{outboundShareCode}</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <input
                type="text"
                value={peerInputCode}
                onChange={(e) => setPeerInputCode(e.target.value)}
                placeholder="Enter Community Dispatch Code (CATALYST-...)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-slate-100"
              />
              <button
                onClick={handlePeerSubmit}
                className="min-h-[40px] px-4 py-2 bg-sky-600 hover:bg-sky-500 text-slate-950 font-mono font-semibold text-xs rounded cursor-pointer whitespace-nowrap shrink-0"
              >
                Verify &amp; Record Catalyst
              </button>
            </div>
            {peerFeedback && (
              <div className="text-xs font-mono text-amber-300 mt-1">{peerFeedback}</div>
            )}
          </div>
        </div>

        {/* Gift Ledger History */}
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
          <h3 className="font-display text-base font-bold text-slate-100 mb-3">
            02. Attributable Paradox Catalyst Gift Ledger ({catalystLedger.length})
          </h3>
          {catalystLedger.length === 0 ? (
            <div className="text-xs text-slate-400 font-mono p-3 bg-[#0B0E14] border border-slate-800 rounded">
              No Paradox Catalysts recorded yet. Complete Vespera’s Solo Commission or verify a Peer Code above.
            </div>
          ) : (
            <div className="space-y-2">
              {catalystLedger.map((entry) => (
                <div key={entry.id} className="p-3 bg-[#0B0E14] border border-emerald-800/70 rounded text-xs font-mono">
                  <div className="flex items-center justify-between text-emerald-400 font-semibold">
                    <span>Sender: {entry.senderName} ({entry.senderType})</span>
                    <span>Hash: #{entry.provenanceHash} · Day {entry.dayReceived}</span>
                  </div>
                  <div className="text-slate-300 mt-1">{entry.commissionNote}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right 5 Cols: Seeded Deterministic Replay Log & Atomic Save Backup Export/Import */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
          <h3 className="font-display text-base font-bold text-slate-100 mb-2">
            03. Atomic Save Export &amp; Restore
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Game state auto-saves atomically after every action and on app visibility change. Export or restore a full JSON snapshot anytime.
          </p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => {
                const dumped = onExportSaveJson();
                setSaveJsonText(dumped);
                setSaveFeedback('Snapshot exported to text box below.');
              }}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-mono rounded cursor-pointer"
            >
              Export Save JSON
            </button>
            <button
              onClick={() => {
                const ok = onImportSaveJson(saveJsonText);
                setSaveFeedback(ok ? 'Save snapshot restored successfully!' : 'Invalid JSON snapshot.');
              }}
              disabled={!saveJsonText.trim()}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-semibold text-xs font-mono rounded cursor-pointer"
            >
              Import Save JSON
            </button>
          </div>
          <textarea
            value={saveJsonText}
            onChange={(e) => setSaveJsonText(e.target.value)}
            rows={4}
            placeholder="Click 'Export Save JSON' or paste a saved campaign JSON string here..."
            className="w-full bg-[#0B0E14] border border-slate-800 rounded p-2.5 text-xs font-mono text-slate-300"
          />
          {saveFeedback && <div className="text-xs font-mono text-emerald-400 mt-1.5">{saveFeedback}</div>}
        </div>

        {/* Deterministic Seeded Expedition Replay Archive */}
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-base font-bold text-slate-100">
              04. Deterministic Replay Archive
            </h3>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              Campaign Seed: #{seed}
            </span>
          </div>
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {expeditionReports.length === 0 ? (
              <div className="text-xs text-slate-400 font-mono p-3 bg-[#0B0E14] border border-slate-800 rounded">
                No expeditions resolved yet. Complete a trade day to record seeded causal replays.
              </div>
            ) : (
              expeditionReports.map((rep) => (
                <div key={rep.id} className="p-3 bg-[#0B0E14] border border-slate-800 rounded text-xs">
                  <div className="flex items-center justify-between font-mono text-slate-400 mb-1">
                    <span>Day {rep.day} · {rep.region.toUpperCase()}</span>
                    <span>Seed #{rep.seed} · {rep.rulesVersion}</span>
                  </div>
                  <div className="font-semibold text-slate-100 mb-1">{rep.summaryHeadline}</div>
                  <div className="text-slate-400 font-mono">
                    Loot: {rep.totalLooted}g · Master Δ: {rep.masterTreasuryDelta >= 0 ? `+${rep.masterTreasuryDelta}g` : `${rep.masterTreasuryDelta}g`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </div>
      )}
    </div>
  );
};
