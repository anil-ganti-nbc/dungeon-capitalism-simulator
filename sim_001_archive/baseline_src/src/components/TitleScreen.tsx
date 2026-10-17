import React, { useEffect } from 'react';
import { ExpeditionCanvas } from './ExpeditionCanvas';

interface TitleScreenProps {
  hasSavedGame: boolean;
  savedDay: number;
  savedGold: number;
  reducedMotion: boolean;
  onStartNewOrContinue: () => void;
  onLoadBasiliskScenario: () => void;
  onResetSave: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSavedGame,
  savedDay,
  savedGold,
  reducedMotion,
  onStartNewOrContinue,
  onLoadBasiliskScenario,
  onResetSave
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartNewOrContinue();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStartNewOrContinue]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0B0E14] select-none flex flex-col justify-between p-8 md:p-14">
      {/* Live 60fps Atmospheric Dungeon & Alchemy Cutaway Canvas */}
      <div className="absolute inset-0 z-0 opacity-75">
        <ExpeditionCanvas
          mode="TITLE_BACKDROP"
          report={null}
          activeRoomIdx={0}
          simSpeed={1}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* Measured contrast scrim for guaranteed WCAG AA legibility */}
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/65 to-[#0B0E14]/40 pointer-events-none" />

      {/* Top quiet edition metadata (unboxed text, zero pills) */}
      <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 font-mono">
        <span>TRAP &amp; TONIC · DETERMINISTIC EDITION v1.0</span>
        <span>4 REALMS · 12 MASTERS · 16 PARTIES · 48 REAGENTS · 64 TRAP MODULES</span>
      </div>

      {/* Centerpiece: Bespoke SVG Lockup over generous negative space */}
      <div className="relative z-10 max-w-3xl mx-auto text-center my-auto py-8">
        <div className="flex justify-center mb-6">
          <svg
            width="128"
            height="92"
            viewBox="0 0 128 92"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Trap and Tonic Balance Scale Emblem"
            className="text-amber-500"
          >
            {/* Central Merchant Balance Beam */}
            <path d="M64 10V78M42 78H86" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M20 26L64 18L108 26" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="64" cy="18" r="4.5" fill="#FDE68A" />
            {/* Left Pan: Alchemical Tonic Flask (Emerald) */}
            <path d="M20 26L12 46H28L20 26Z" stroke="#94A3B8" strokeWidth="1.5" />
            <path
              d="M16 38H24V43L29 53C30 55 28.5 58 26 58H14C11.5 58 10 55 11 53L16 43V38Z"
              fill="#064E3B"
              stroke="#10B981"
              strokeWidth="2"
            />
            <circle cx="19" cy="51" r="2" fill="#34D399" />
            <circle cx="23" cy="48" r="1.5" fill="#A7F3D0" />
            {/* Right Pan: Serrated Dungeon Trap Jaw (Crimson/Brass) */}
            <path d="M108 26L100 46H116L108 26Z" stroke="#94A3B8" strokeWidth="1.5" />
            <path
              d="M95 56C95 48 101 44 108 44C115 44 121 48 121 56H95Z"
              fill="#4C0519"
              stroke="#F43F5E"
              strokeWidth="2"
            />
            <path d="M99 48L102 53L105 47L108 53L111 47L114 53L117 48" stroke="#FDA4AF" strokeWidth="1.5" />
          </svg>
        </div>

        <p className="text-xs font-mono tracking-widest text-amber-400/90 mb-3">
          THE HOUSE ALWAYS SELLS TWICE
        </p>

        <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-slate-50 mb-4">
          Trap &amp; Tonic: Conflict of Interest
        </h1>

        <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed mb-8">
          Supply Dungeon Masters with lethal pressure plates, basilisks, and sulphur fog by morning—then sell Adventuring Parties the featherweight morphs and chelated antidotes to survive them by night.
        </p>

        {/* Primary CTA & Scenario Quick-Load */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onStartNewOrContinue}
            className="px-7 py-3.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-lg"
          >
            {hasSavedGame ? `Continue Ledger (Day ${savedDay} · ${savedGold.toLocaleString()}g)` : 'Open Merchant Ledger'}
          </button>

          <button
            onClick={onLoadBasiliskScenario}
            className="px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Load Scenario: The Basilisk Supply Chain
          </button>

          {hasSavedGame && (
            <button
              onClick={onResetSave}
              className="px-4 py-3.5 text-xs font-mono text-slate-400 hover:text-rose-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Reset Campaign
            </button>
          )}
        </div>
      </div>

      {/* Single flat control-hint line at bottom */}
      <div className="relative z-10 text-center text-xs font-mono text-slate-400">
        <span>Enter / Space Open Ledger · WASD Pan Dungeon Camera · Space Step Room Replay · Esc Pause &amp; Save</span>
      </div>
    </div>
  );
};
