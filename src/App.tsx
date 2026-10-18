import { claimSoloCatalyst } from './engine/progression';
import { getDailyMarketContext } from './engine/marketContext';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GameShellState,
  WorkspaceTab,
  RegionId,
  GameSaveState,
  AccessibilitySettings,
  CraftedProduct,
  Reagent,
  TrapPart,
  SaleContract,
  ScheduledMatchup
} from './types/game';
import {
  REAGENTS_CATALOG,
  TRAP_PARTS_CATALOG,
  INITIAL_PRODUCTS,
  SKILL_TREE_NODES
} from './data/catalog';
import {
  REGIONS_DATA,
  INITIAL_MASTERS,
  INITIAL_PARTIES,
  INITIAL_RIVALS,
  INITIAL_INTEL_FEED
} from './data/world';
import {
  SIM_RULES_VERSION,
  computeCanonicalFormulaSignature,
  mergeCraftedProductIntoInventory,
  getRegionEncounterSchedule,
  simulateRegionExpedition,
  predictExpeditionForecast,
  verifyAndParseCatalystCode
} from './engine/simulation';
import { hashString } from './utils/prng';
import { soundFX } from './utils/sound';
import { TitleScreen } from './components/TitleScreen';
import { ExpeditionCanvas } from './components/ExpeditionCanvas';
import { AlchemyLabPanel, TrapWorkshopPanel } from './components/CraftingPanels';
import { TradeFloorPanel, FinancialsPanel } from './components/TradeAndLedgerPanels';
import {
  IntelAndStoryPanel,
  ClientDirectoryPanel,
  SpecialisationsPanel,
  ArchivesAndCatalystPanel
} from './components/WorldAndIntelPanels';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallWidgets';
import {
  createInitialSaveState,
  validateSavePayload,
  quarantinePayload,
  loadGameWithRecovery,
  persistAtomicSaveSafe,
  SAVE_STORAGE_KEY,
  SAVE_BACKUP_KEY,
  LEGACY_SAVE_KEY
} from './engine/saveManager';
import {
  executeCommercialTransaction,
  computeRegionalFinesAndClaims,
  resolvePostRaidClients
} from './engine/economyEngine';

const WORKSPACE_NAV_ITEMS: Array<{ id: WorkspaceTab; label: string; shortLabel: string }> = [
  { id: 'DAY_DESK', label: 'Bilateral Desk', shortLabel: 'Trade' },
  { id: 'ALCHEMY_LAB', label: 'Alchemy Lab', shortLabel: 'Alchemy' },
  { id: 'TRAP_WORKSHOP', label: 'Trap Workshop', shortLabel: 'Traps' },
  { id: 'EXPEDITION_MAP', label: 'Expedition Arena', shortLabel: 'Arena' },
  { id: 'INTEL_RUMOURS', label: 'Intel & Story', shortLabel: 'Intel' },
  { id: 'FINANCIALS', label: 'Charters & Ledger', shortLabel: 'Charters' },
  { id: 'CLIENT_LEDGER', label: 'Clients', shortLabel: 'Clients' },
  { id: 'SPECIALISATIONS', label: 'Skills', shortLabel: 'Skills' },
  { id: 'ARCHIVES_CATALYST', label: 'Catalyst & Audit', shortLabel: 'Catalyst' }
];

export default function App() {
  const [shellState, setShellState] = useState<GameShellState>('TITLE_MENU');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('DAY_DESK');
  const [activeRoomIdx, setActiveRoomIdx] = useState<number>(0);
  const [statusBanner, setStatusBanner] = useState<string>(
    'Morning Ledger Open: Inspect Verified Facts, brew tonics or traps, supply both sides, and resolve the scheduled expedition.'
  );

  const [a11y, setA11y] = useState<AccessibilitySettings>({
    fontScale: 'normal',
    colorblindLabels: true,
    reducedMotion: false,
    oneThumbPortraitMode: false,
    simSpeed: 1,
    audioMuted: false
  });

  const [loaded] = useState(() => loadGameWithRecovery(localStorage));
  const [recoveryNotice, setRecoveryNotice] = useState(loaded.notice);
  const saveBlocked = React.useRef(!!loaded.writeBlocked);
  const [gameState, setGameState] = useState<GameSaveState>(loaded.state);

  // Atomic save rotation on state update & app lifecycle interruption (F08, A02)
  const persistAtomicSave = useCallback((stateToSave: GameSaveState) => {
    if (!saveBlocked.current && !persistAtomicSaveSafe(stateToSave, localStorage)) {
      setRecoveryNotice('Save failed validation or storage is full. Existing checkpoints preserved; export your ledger.');
    }
  }, []);

  useEffect(() => {
    persistAtomicSave(gameState);
  }, [gameState, persistAtomicSave]);

  // Accessible typography scaling on document element (Codex A05)
  useEffect(() => {
    document.documentElement.classList.remove('font-scale-large', 'font-scale-xlarge');
    if (a11y.fontScale === 'large') {
      document.documentElement.classList.add('font-scale-large');
    } else if (a11y.fontScale === 'xlarge') {
      document.documentElement.classList.add('font-scale-xlarge');
    }
  }, [a11y.fontScale]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistAtomicSave(gameState);
      }
    };
    const onPageHide = () => persistAtomicSave(gameState);
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [gameState, persistAtomicSave]);

  // Escape key to toggle Pause / Settings Modal during play
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setShellState((prev) =>
          prev === 'PLAYING' ? 'PAUSED' : prev === 'PAUSED' ? 'PLAYING' : prev
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Sync audio mute
  useEffect(() => {
    soundFX.muted = a11y.audioMuted;
  }, [a11y.audioMuted]);

  const isSkillUnlocked = useCallback(
    (effectKey: string) => gameState.skills.some((s) => s.effectKey === effectKey && s.unlocked),
    [gameState.skills]
  );

  // F01: Compute active scheduled encounter & next rotation for the current region
  const activeRegionSchedule = useMemo(
    () =>
      getRegionEncounterSchedule(
        gameState.activeRegion,
        gameState.day,
        gameState.masters,
        gameState.parties,
        gameState.scheduledMatchups
      ),
    [
      gameState.activeRegion,
      gameState.day,
      gameState.masters,
      gameState.parties,
      gameState.scheduledMatchups
    ]
  );

  // Pre-expedition deterministic forecast (Gate 4)
  const expeditionForecast = useMemo(() => {
    return predictExpeditionForecast(
      gameState.day,
      gameState.seed,
      activeRegionSchedule.currentMaster,
      activeRegionSchedule.currentParty,
      gameState.products,
      gameState.contractsToday
    );
  }, [
    gameState.day,
    gameState.seed,
    activeRegionSchedule.currentMaster,
    activeRegionSchedule.currentParty,
    gameState.products,
    gameState.contractsToday
  ]);

  const handleSelectScheduledMatchup = useCallback((masterId: string, partyId: string) => {
    setGameState((prev) => ({
      ...prev,
      scheduledMatchups: {
        ...prev.scheduledMatchups,
        [prev.activeRegion]: { masterId, partyId }
      }
    }));
  }, []);

  // Load "The Basilisk Supply Chain" Scenario (Unlocks Warrens immediately & stages Grimthorn + Silver Stag)
  const handleLoadBasiliskScenario = useCallback(() => {
    const base = createInitialSaveState();
    saveBlocked.current = false;
    setRecoveryNotice(undefined);
    base.unlockedRegions = ['cellar', 'warrens'];
    base.activeRegion = 'warrens';
    base.gold = 3400;
    base.phase = 'TRADE';
    base.scheduledMatchups.warrens = {
      masterId: 'dm_warrens_1',
      partyId: 'pty_warrens_1'
    };
    setGameState(base);
    setShellState('PLAYING');
    setActiveTab('DAY_DESK');
    setStatusBanner(
      'Scenario Loaded: Overseer Grimthorn has deployed a Cave-Basilisk + Sulphur-Fog Machine against the Silver Stag Company!'
    );
    soundFX.playCatalystChord();
  }, []);

  // F02 Fix: Brew Alchemy Product with Canonical Composition Identity
  const handleBrewProduct = useCallback(
    (product: CraftedProduct, spotCost: number, consumedIds: string[], batchSize: number) => {
      soundFX.playBrew();
      setGameState((prev) => {
        const nextReagents = { ...prev.reagentInventory };
        consumedIds.forEach((id) => {
          if ((nextReagents[id] || 0) > 0) {
            nextReagents[id] -= 1;
          }
        });

        const nextProducts = mergeCraftedProductIntoInventory(prev.products, product, batchSize);

        return {
          ...prev,
          phase: 'PREPARATION',
          gold: prev.gold - spotCost,
          customBrewsCount: prev.customBrewsCount + 1,
          reagentInventory: nextReagents,
          products: nextProducts
        };
      });
      setStatusBanner(
        `Synthesized ${batchSize}x ${product.name} [#${product.formulaSignature}] (${
          product.sulphurVulnerable ? 'Sulphur Vulnerable' : 'Sulphur Safe'
        }).`
      );
    },
    []
  );

  // F02 Fix: Assemble Trap Product with Canonical Composition Identity
  const handleAssembleTrap = useCallback(
    (trapProduct: CraftedProduct, spotCost: number, consumedIds: string[]) => {
      soundFX.playRatchet();
      setGameState((prev) => {
        const nextParts = { ...prev.partInventory };
        consumedIds.forEach((id) => {
          if ((nextParts[id] || 0) > 0) {
            nextParts[id] -= 1;
          }
        });

        const nextProducts = mergeCraftedProductIntoInventory(prev.products, trapProduct, 2);

        return {
          ...prev,
          phase: 'PREPARATION',
          gold: prev.gold - spotCost,
          customTrapsCount: prev.customTrapsCount + 1,
          partInventory: nextParts,
          products: nextProducts
        };
      });
      setStatusBanner(
        `Assembled 2x ${trapProduct.name} [#${trapProduct.formulaSignature}] (Trigger: ${trapProduct.triggerMassThresholdKg}kg, DC ${trapProduct.detectionDC}).`
      );
    },
    []
  );

  // Buy Wholesale Reagents / Parts
  const handleBuyReagent = useCallback((reagent: Reagent, qty: number) => {
    soundFX.playCoin();
    const cost = reagent.baseCost * qty;
    setGameState((prev) => ({
      ...prev,
      gold: prev.gold - cost,
      reagentInventory: {
        ...prev.reagentInventory,
        [reagent.id]: (prev.reagentInventory[reagent.id] || 0) + qty
      }
    }));
    setStatusBanner(`Procured ${qty}x ${reagent.name} for ${cost}g.`);
  }, []);

  const handleBuyPart = useCallback((part: TrapPart, qty: number) => {
    soundFX.playCoin();
    const cost = part.baseCost * qty;
    setGameState((prev) => ({
      ...prev,
      gold: prev.gold - cost,
      partInventory: {
        ...prev.partInventory,
        [part.id]: (prev.partInventory[part.id] || 0) + qty
      }
    }));
    setStatusBanner(`Procured ${qty}x ${part.name} for ${cost}g.`);
  }, []);

  // Execute Bilateral Sale to either Dungeon Master or Adventuring Party
  // Execute Bilateral Sale to either Dungeon Master or Adventuring Party (A01: Shared Authoritative Economy Engine)
  const handleExecuteSale = useCallback(
    (
      buyerType: 'MASTER' | 'HERO',
      buyerId: string,
      product: CraftedProduct,
      priceMultiplier: number,
      warrantyBacked: boolean,
      exclusiveDeal: boolean,
      secretProvenance: boolean
    ) => {
      setGameState((prev) => {
        const tx = executeCommercialTransaction(prev, buyerType, buyerId, product, {
          priceMultiplier,
          warrantyBacked,
          exclusiveDeal,
          secretProvenance
        });

        if (!tx.success || !tx.nextState) {
          setStatusBanner(tx.reason || 'Transaction could not be completed.');
          return prev;
        }

        soundFX.playCoin();
        setStatusBanner(
          `Sold 1x ${product.name} [#${product.formulaSignature || product.id.slice(-6)}] to ${
            tx.contract?.buyerName || (buyerType === 'MASTER' ? 'Dungeon Master' : 'Adventuring Party')
          } for +${tx.unitPrice}g!`
        );

        return tx.nextState;
      });
    },
    []
  );

  // F01 & F04/F05 Fix: Resolve Explicitly Scheduled Expedition & Advance Day with Real Debt/Consumption Math
  const handleLaunchExpedition = useCallback(() => {
    setGameState((prev) => {
      const schedule = getRegionEncounterSchedule(
        prev.activeRegion,
        prev.day,
        prev.masters,
        prev.parties,
        prev.scheduledMatchups
      );
      const master = schedule.currentMaster;
      const party = schedule.currentParty;

      const report = simulateRegionExpedition(
        prev.day,
        prev.seed,
        master,
        party,
        prev.products,
        prev.contractsToday
      );

      // Accounting math (SIM-002 Reconstructed Economy)
      const grossRevenue = prev.contractsToday.reduce((acc, c) => acc + c.totalRevenue, 0);
      const cogs = prev.contractsToday.reduce((acc, c) => acc + c.unitCost * c.quantity, 0);
      const grossMargin = grossRevenue - cogs;
      const overheadAndStorage = 35 + prev.unlockedRegions.length * 20;

      const skillKeys = prev.skills.filter((s) => s.unlocked).map((s) => s.effectKey);
      const claimsAndFines = computeRegionalFinesAndClaims(
        prev.activeRegion,
        report.exclusivityBreachDetected,
        report.warrantyClaimsTriggered,
        skillKeys
      );
      const warrantyClaims = claimsAndFines.warrantyPayout;
      const fines = claimsAndFines.breachFine;

      const cheapCredit = prev.skills.some((s) => s.effectKey === 'cheap_credit' && s.unlocked);
      const dailyInterestRate = cheapCredit ? 0.003 : 0.005;
      const interest = Math.round(prev.debt * dailyInterestRate);

      const netProfit = grossMargin - overheadAndStorage - warrantyClaims - fines - interest;
      const rawEndingCash = prev.gold - overheadAndStorage - warrantyClaims - fines - interest;

      // Remove silent 120g bailout floor: if rawEndingCash < 0, capitalize deficit into debt!
      let endingCash = rawEndingCash;
      let nextDebt = prev.debt;
      let nextInsolvencyEvents = prev.insolvencyEvents || 0;

      if (rawEndingCash < 0) {
        nextDebt += Math.abs(rawEndingCash);
        endingCash = 0;
        nextInsolvencyEvents += 1;
      } else if (nextDebt > 0 && netProfit > 0 && endingCash > 800) {
        // Auto-amortize 25% of positive net profit when liquid cash > 800g
        const autoPaydown = Math.min(nextDebt, Math.min(endingCash - 600, Math.round(netProfit * 0.25)));
        if (autoPaydown > 0) {
          nextDebt -= autoPaydown;
          endingCash -= autoPaydown;
        }
      }

      const inventoryVal = prev.products.reduce((acc, p) => acc + p.stock * p.productionCost, 0);
      const netWorth = endingCash + inventoryVal - nextDebt;

      // Shared breach, warranty, budget, loadout and memory consequences.
      const { masters: nextMasters, parties: nextParties } = resolvePostRaidClients(prev, report);

      // Generate new Morning Intel item from actual causal expedition outcome
      const newFact = {
        id: `intel_d${prev.day + 1}_${report.id}`,
        day: prev.day + 1,
        timestamp: '06:00 AM',
        region: prev.activeRegion,
        isVerifiedFact: true,
        source: 'Expedition After-Action Audit',
        reliabilityPct: 100,
        headline: report.summaryHeadline,
        detail: `${report.rooms.map((r) => r.causalExplanation).join(' ')} Emergent Demand: ${
          report.doubleSaleDemandCreated.join(' | ') || 'Steady regional restocking.'
        }`,
        affectedTag: 'expedition_consequence'
      };

      return {
        ...prev,
        day: prev.day + 1,
        phase: 'EVENING',
        gold: endingCash,
        debt: nextDebt,
        insolvencyEvents: nextInsolvencyEvents,
        skillPoints: prev.skillPoints + 1,
        masters: nextMasters,
        parties: nextParties,
        scheduledMatchups: {
          ...prev.scheduledMatchups,
          [prev.activeRegion]: {
            masterId: schedule.nextMaster.id,
            partyId: schedule.nextParty.id
          }
        },
        contractsToday: [],
        intelFeed: [newFact, ...prev.intelFeed],
        expeditionReports: [report, ...prev.expeditionReports],
        financialLedger: [
          {
            day: prev.day,
            grossRevenue,
            cogs,
            grossMargin,
            overheadAndStorage,
            warrantyAndClaims: warrantyClaims,
            finesAndBribes: fines,
            financingInterest: interest,
            netProfit,
            endingCash,
          marketContext: getDailyMarketContext(prev.seed, prev.day, prev.activeRegion, prev.rulesVersion),
            inventoryValue: inventoryVal,
            debt: nextDebt,
            netWorth
          },
          ...prev.financialLedger
        ]
      };
    });

    setActiveRoomIdx(0);
    setActiveTab('EXPEDITION_MAP');
    setStatusBanner(
      'Expedition Resolved! Inspect the 60fps causal room replay below or press Space to step through each encounter.'
    );
  }, []);

  // Unlock Regional Trading Charter (Cash or Bridge Financing)
  const handleUnlockRegionCharter = useCallback(
    (regionId: RegionId, cost: number, useBridgeLoan: boolean) => {
      soundFX.playCatalystChord();
      setGameState((prev) => {
        if (prev.unlockedRegions.includes(regionId)) return prev;
        const cheapCredit = prev.skills.some((s) => s.effectKey === 'cheap_credit' && s.unlocked);
        const downPayment = useBridgeLoan ? Math.round(cost * (cheapCredit ? 0.2 : 0.3)) : cost;
        const loanAdded = useBridgeLoan ? cost - downPayment : 0;

        return {
          ...prev,
          gold: Math.max(0, prev.gold - downPayment),
          debt: prev.debt + loanAdded,
          unlockedRegions: [...prev.unlockedRegions, regionId],
          activeRegion: regionId
        };
      });
      setStatusBanner(
        `Charter Unlocked: ${regionId.toUpperCase()} is now connected to your multi-region merchant network!`
      );
    },
    []
  );

  // F03 Fix: Claim Solo Offline DM Paradox Catalyst (Requires Hard Mode + 2 Custom Brews + 2 Custom Traps + 2 DM & 2 Hero Sales)
  const handleClaimSoloDmCatalyst = useCallback(() => {
    setGameState(prev => {
      const next=claimSoloCatalyst(prev);
      if (next !== prev) soundFX.playCatalystChord();
      return next;
    });
    setStatusBanner(
      'Paradox Catalyst Received by Courier from Arch-Architect Vespera! Region IV: The Paradox Vault (Expert) is now permanently unlocked!'
    );
  }, []);

  // F03 Fix: Verify & Record Offline Peer Paradox Catalyst Code (Enforces Hard-mode access & authentic courier verification)
  const handleImportPeerCatalyst = useCallback(
    (code: string): { valid: boolean; message: string } => {
      const check = verifyAndParseCatalystCode(
        code,
        gameState.day,
        gameState.catalystLedger,
        gameState.unlockedRegions
      );
      if (!check.valid || !check.entry) {
        return { valid: false, message: check.error || 'Invalid Catalyst Code.' };
      }
      soundFX.playCatalystChord();
      const isAuthentic = check.entry.isAuthentic;
      setGameState((prev) => ({
        ...prev,
        expertUnlocked: isAuthentic ? true : prev.expertUnlocked,
        unlockedRegions:
          isAuthentic && !prev.unlockedRegions.includes('vault')
            ? [...prev.unlockedRegions, 'vault']
            : prev.unlockedRegions,
        activeRegion: isAuthentic ? 'vault' : prev.activeRegion,
        catalystLedger: [check.entry!, ...prev.catalystLedger]
      }));

      if (isAuthentic) {
        setStatusBanner(
          `Verified Authentic Courier Catalyst (#${check.entry.provenanceHash})! The Paradox Vault (Expert) is now permanently unlocked!`
        );
        return {
          valid: true,
          message: `Verified Authentic Courier Catalyst from ${check.entry.senderName} (#${check.entry.provenanceHash}). The Paradox Vault is unlocked!`
        };
      } else {
        setStatusBanner(
          `Recorded Community Catalyst Code (#${check.entry.provenanceHash}) in ledger. Note: Unauthenticated casual codes do not attune to The Paradox Vault.`
        );
        return {
          valid: true,
          message: `Recorded Community Gift from ${check.entry.senderName} (#${check.entry.provenanceHash}) in gift ledger. Note: Legitimate Arch-Architect Courier commission is required to unlock Expert Mode.`
        };
      }
    },
    [gameState.day, gameState.catalystLedger, gameState.unlockedRegions]
  );

  // Basilisk Supply Chain Story Branch Decisions
  const handleResolveBasiliskDecision = useCallback(
    (choice: 'REFORMULATE' | 'REFUND_GUILD' | 'BRIBE_GRIMTHORN' | 'BLAME_RIVAL') => {
      soundFX.playBrew();
      setGameState((prev) => {
        let goldDelta = 0;
        let headline = '';
        let detail = '';
        const nextProducts = [...prev.products];

        if (choice === 'REFORMULATE') {
          const idx = nextProducts.findIndex((p) => p.id === 'prod_antidote_chelated');
          if (idx >= 0) {
            nextProducts[idx] = { ...nextProducts[idx], stock: nextProducts[idx].stock + 2 };
          }
          headline = 'Basilisk Chain: Quartz-Chelated Antidotes Deployed';
          detail =
            'Your Calcified Quartz formulation resisted Grimthorn’s Sulphur Fog. The Silver Stag survived and Grimthorn now wants 8kg Quartz-Wire Acid Sprayers!';
        } else if (choice === 'REFUND_GUILD') {
          goldDelta = -180;
          headline = 'Basilisk Chain: Silver Stag Indemnified (-180g)';
          detail =
            'Full warranty restitution paid to Captain Valen Stagheart. The Guild Investigation was dropped and Hero Trust surged across the Warrens.';
        } else if (choice === 'BRIBE_GRIMTHORN') {
          goldDelta = 170; // -150g bribe + 320g contract retainer
          headline = 'Basilisk Chain: Secret Ventilation Pact with Grimthorn (+170g Net)';
          detail =
            'Overseer Grimthorn agreed to cycle his Sulphur Fog vents at half pressure so heroes survive just long enough to buy more antidotes next week.';
        } else {
          headline = 'Basilisk Chain: Vane & Sons Blamed for Adulterated Bile';
          detail =
            'Guild inspectors fined Vane & Sons Alchemicals for selling unbuffered antidotes, shifting 6% regional market share to your house.';
        }

        return {
          ...prev,
          gold: Math.max(0, prev.gold + goldDelta),
          products: nextProducts,
          basiliskChainStage: Math.min(3, prev.basiliskChainStage + 1),
          intelFeed: [
            {
              id: `intel_basilisk_d${prev.day}_${choice}`,
              day: prev.day,
              timestamp: '12:30 PM',
              region: 'warrens',
              isVerifiedFact: true,
              source: 'Basilisk Supply Chain Dossier',
              reliabilityPct: 100,
              headline,
              detail,
              affectedTag: 'basilisk_chain'
            },
            ...prev.intelFeed
          ]
        };
      });
      setStatusBanner(`Basilisk Supply Chain Updated: Decision [${choice}] recorded in world ledger.`);
    },
    []
  );

  const latestReport = useMemo(
    () => gameState.expeditionReports[0] || null,
    [gameState.expeditionReports]
  );

  // F01 Fix: Preview report uses the exact scheduled encounter if no expedition has been resolved on this day yet
  const activeCanvasReport = useMemo(() => {
    if (latestReport && latestReport.day === gameState.day - 1 && gameState.phase === 'EVENING') {
      return latestReport;
    }
    return simulateRegionExpedition(
      gameState.day,
      gameState.seed,
      activeRegionSchedule.currentMaster,
      activeRegionSchedule.currentParty,
      gameState.products,
      gameState.contractsToday
    );
  }, [
    latestReport,
    gameState.day,
    gameState.phase,
    gameState.seed,
    activeRegionSchedule.currentMaster,
    activeRegionSchedule.currentParty,
    gameState.products,
    gameState.contractsToday
  ]);

  const masterSalesCount = useMemo(
    () => gameState.contractHistory.filter((c) => c.buyerType === 'MASTER').length,
    [gameState.contractHistory]
  );
  const heroSalesCount = useMemo(
    () => gameState.contractHistory.filter((c) => c.buyerType === 'HERO').length,
    [gameState.contractHistory]
  );

  const fontScaleClass =
    a11y.fontScale === 'xlarge'
      ? 'text-[17px]'
      : a11y.fontScale === 'large'
      ? 'text-[15.5px]'
      : 'text-sm';

  if (shellState === 'TITLE_MENU') {
    return (
      <>
        <OfflineIndicator />
        {recoveryNotice && <div role="alert" className="p-3 bg-amber-950 text-amber-200 text-sm">{recoveryNotice}</div>}
        <TitleScreen
          hasSavedGame={saveBlocked.current || gameState.day > 1 || gameState.contractHistory.length > 0}
          savedDay={gameState.day}
          savedGold={gameState.gold}
          reducedMotion={a11y.reducedMotion}
          onStartNewOrContinue={() => setShellState('PLAYING')}
          onLoadBasiliskScenario={handleLoadBasiliskScenario}
          onResetSave={() => {
            const fresh = createInitialSaveState();
            setGameState(fresh);
            saveBlocked.current = false;
            setRecoveryNotice(undefined);
            persistAtomicSave(fresh);
          }}
        />
      </>
    );
  }

  return (
    <div
      className={`w-screen h-screen overflow-hidden bg-[#0B0E14] text-[#F1F5F9] flex flex-col select-none font-scale-${a11y.fontScale} ${fontScaleClass}`}
    >
      <OfflineIndicator />

      {/* Top Bar Contract: Zone 1 Brand Wordmark — Zone 2 Concise Nav Links — Zone 3 Primary Action */}
      <header className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 px-4 sm:px-5 py-2.5 bg-[#0B0E14] border-b border-slate-800/90 shrink-0">
        <button
          onClick={() => setShellState('TITLE_MENU')}
          className="font-display text-base sm:text-lg font-bold tracking-tight text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Trap &amp; Tonic
        </button>

        {!a11y.oneThumbPortraitMode && (
          <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-slate-300">
            {WORKSPACE_NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === item.id
                    ? 'text-amber-400 underline underline-offset-8 decoration-2 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />
          <button
            onClick={() => setShellState('PAUSED')}
            className="min-h-[40px] px-3.5 py-1.5 text-xs font-mono font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Options &amp; A11y (Esc)
          </button>
        </div>
      </header>

      {/* Main Scrollable Game Shell Container (Supports One-Thumb Portrait Mode or Full 1440px Desktop) */}
      {recoveryNotice && <div role="alert" className="px-4 py-3 text-sm text-amber-200 bg-amber-950 border border-amber-700 break-words">{recoveryNotice}</div>}
      <main
        className={`flex-1 overflow-y-auto overflow-x-hidden max-w-full px-4 sm:px-6 pt-4 pb-24 lg:pb-6 space-y-5 ${
          a11y.oneThumbPortraitMode ? 'max-w-md mx-auto w-full border-x border-slate-800 pb-28' : 'max-w-[1440px] mx-auto w-full'
        }`}
      >
        {/* Perimeter Telemetry Strip & Active Dungeon Region Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-300">
            <span className="text-amber-400 font-semibold">DAY {gameState.day} / 120+</span>
            <span aria-hidden="true">·</span>
            <span>PHASE: {gameState.phase}</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400 font-semibold">CASH: {gameState.gold.toLocaleString()}g</span>
            {gameState.debt > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-rose-400">DEBT: {gameState.debt.toLocaleString()}g</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-sky-400">SKILL PTS: {gameState.skillPoints} SP</span>
            <span aria-hidden="true">·</span>
            <span>
              EXPERT VAULT: {gameState.expertUnlocked ? 'UNLOCKED (CATALYST VERIFIED)' : 'LOCKED'}
            </span>
          </div>

          {/* Connected Realm Switcher */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#131822] border border-slate-800 rounded-lg">
            {REGIONS_DATA.map((reg) => {
              const unlocked = gameState.unlockedRegions.includes(reg.id);
              const isSelected = gameState.activeRegion === reg.id;
              return (
                <button
                  key={reg.id}
                  onClick={() => {
                    if (unlocked) {
                      setGameState((prev) => ({ ...prev, activeRegion: reg.id }));
                    } else {
                      setActiveTab(reg.requiresCatalyst ? 'ARCHIVES_CATALYST' : 'FINANCIALS');
                    }
                  }}
                  className={`min-h-[36px] px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-amber-600 text-slate-950 font-semibold'
                      : unlocked
                      ? 'text-slate-300 hover:text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {reg.roman}. {reg.name.replace("The Rat King's ", '').replace('The ', '')}{' '}
                  {!unlocked ? '(Locked)' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Action Consequence Banner with Explicit Scheduled Matchup */}
        <div className="px-4 py-2.5 bg-[#131822] border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="text-slate-200">{statusBanner}</div>
            <div className="text-amber-400/90 truncate">
              Scheduled Matchup: {activeRegionSchedule.currentParty.name} vs {activeRegionSchedule.currentMaster.name} · Next: {activeRegionSchedule.nextParty.name} vs {activeRegionSchedule.nextMaster.name}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 max-w-full">
            <button
              onClick={handleLaunchExpedition}
              className="min-h-[44px] px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded-lg cursor-pointer max-w-full text-left sm:text-center text-xs font-mono leading-tight whitespace-normal"
            >
              Run Scheduled Expedition ({activeRegionSchedule.currentParty.name} vs {activeRegionSchedule.currentMaster.name}) →
            </button>
          </div>
        </div>

        {/* Active Workspace View */}
        {activeTab === 'EXPEDITION_MAP' && (
          <div className="space-y-4">
            {/* Pre-Expedition Deterministic Causal Forecast (Gate 4) */}
            <div className="p-4 bg-[#131822] border border-slate-800 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono font-semibold text-slate-200">
                    PRE-EXPEDITION INTELLIGENCE &amp; CAUSAL FORECAST
                  </span>
                </div>
                <div className="text-xs font-mono text-amber-400">
                  {expeditionForecast.summaryHeadline}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {expeditionForecast.predictedRooms.map((rm) => (
                  <div
                    key={`forecast_${rm.roomIndex}`}
                    className="p-3 bg-[#0B0E14] border border-slate-800/80 rounded-lg text-xs font-mono space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-slate-400">
                      <span>CHAMBER 0{rm.roomIndex}</span>
                      <span
                        className={
                          rm.outcome === 'TRAP_BYPASSED' || rm.outcome === 'COUNTER_SUCCEEDED'
                            ? 'text-emerald-400 font-semibold'
                            : rm.outcome === 'REACTION_FAILURE'
                            ? 'text-amber-400 font-semibold'
                            : 'text-rose-400 font-semibold'
                        }
                      >
                        {rm.outcome}
                      </span>
                    </div>
                    <div className="text-slate-200 font-semibold truncate">{rm.hazardName}</div>
                    <div className="text-slate-400 text-[11px] leading-relaxed">
                      {rm.causalExplanation}
                    </div>
                    {rm.chemicalReaction?.includes('PARADOX MASS-INVERSION') && (
                      <div className="text-amber-400 text-[11px] font-semibold bg-amber-950/40 p-1.5 rounded border border-amber-800/50">
                        ⚠ Inversion Detonation: Lightweight morph triggers inverted polarity!
                      </div>
                    )}
                    {rm.chemicalReaction?.includes('Temporal Rewind Loop') && (
                      <div className="text-cyan-400 text-[11px] bg-cyan-950/40 p-1.5 rounded border border-cyan-800/50">
                        ↻ Temporal module: one paid charge prevents one wear removal; settlement persists after the raid.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 60fps Live Dungeon Expedition Viewport with >=85% Unobstructed Playfield & pointer-events:none HUD */}
            <div className="relative w-full h-[380px] sm:h-[430px] rounded-xl overflow-hidden border border-slate-800 bg-[#0B0E14]">
              <ExpeditionCanvas
                mode="EXPEDITION_LIVE"
                report={activeCanvasReport}
                activeRoomIdx={activeRoomIdx}
                simSpeed={a11y.simSpeed}
                reducedMotion={a11y.reducedMotion}
                onRoomAdvance={setActiveRoomIdx}
              />

            </div>
            {/* Status and room controls occupy their own flow; never cover the touch playfield. */}
            <div className="p-3 bg-[#0B0E14] border border-slate-800 rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="bg-[#0B0E14]/90 border border-slate-800 px-3 py-1.5 rounded text-xs font-mono tabular-nums text-slate-200">
                    <span>
                      RAID: {activeCanvasReport.partyName} vs {activeCanvasReport.masterName}
                    </span>
                    <span className="mx-2">·</span>
                    <span className="text-amber-400">SEED #{activeCanvasReport.seed}</span>
                  </div>

                  <div className="bg-[#0B0E14]/90 border border-slate-800 px-3 py-1.5 rounded text-xs font-mono tabular-nums text-emerald-400">
                    LOOTED: +{activeCanvasReport.totalLooted}g · MASTER Δ:{' '}
                    {activeCanvasReport.masterTreasuryDelta >= 0
                      ? `+${activeCanvasReport.masterTreasuryDelta}g`
                      : `${activeCanvasReport.masterTreasuryDelta}g`}
                  </div>
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div className="bg-[#0B0E14]/90 border border-slate-800 px-3 py-1.5 rounded text-xs font-mono text-slate-300">
                    Drag to pan · WASD / arrows · Space steps rooms ({activeRoomIdx + 1}/{activeCanvasReport.rooms.length})
                  </div>
                  <div className="pointer-events-auto flex items-center gap-2">
                    {activeCanvasReport.rooms.map((rm, idx) => (
                      <button
                        key={rm.roomIndex}
                        onClick={() => setActiveRoomIdx(idx)}
                        className={`min-h-[38px] px-3 py-1 text-xs font-mono rounded cursor-pointer whitespace-nowrap shrink-0 ${
                          activeRoomIdx === idx
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-[#0B0E14] text-slate-300 border border-slate-700'
                        }`}
                      >
                        Room {rm.roomIndex}
                      </button>
                    ))}
                  </div>
                </div>
            </div>

            {/* Causal Chain After-Action Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeCanvasReport.rooms.map((rm, idx) => (
                <div
                  key={rm.roomIndex}
                  onClick={() => setActiveRoomIdx(idx)}
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                    activeRoomIdx === idx
                      ? 'bg-[#131822] border-amber-500/80'
                      : 'bg-[#131822] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
                    <span>
                      ROOM 0{rm.roomIndex} · {rm.roomName}
                    </span>
                    <span
                      className={
                        rm.outcome === 'TRAP_BYPASSED' || rm.outcome === 'COUNTER_SUCCEEDED'
                          ? 'text-emerald-400 font-semibold'
                          : rm.outcome === 'REACTION_FAILURE'
                          ? 'text-amber-400 font-semibold'
                          : 'text-rose-400 font-semibold'
                      }
                    >
                      {rm.outcome}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-100 mb-1">{rm.hazardName}</div>
                  {rm.chemicalReaction && (
                    <div className="text-xs font-mono text-amber-300 bg-[#0B0E14] border border-slate-800 p-2 rounded mb-2">
                      {rm.chemicalReaction}
                    </div>
                  )}
                  {rm.chemicalReaction?.includes('Temporal Rewind Loop') && (
                    <div className="text-xs font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/60 p-2 rounded mb-2">
                      <div className="font-semibold mb-1">↻ Temporal Rewind Chronology:</div>
                      <div className="text-[11px] text-cyan-200/90 space-y-0.5">
                        <div>· t=0.00s: Intruder steps onto pressure trigger</div>
                        <div>· t=0.18s: Detonation sequence actuates</div>
                        <div>· t=0.35s: Closed timelike loop re-cocks trigger mechanism</div>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-300 leading-relaxed mb-2">{rm.causalExplanation}</p>
                  <div className="text-[11px] font-mono text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
                    <div>Hero Adaptation: {rm.learnedByHeroes}</div>
                    <div>Master Adaptation: {rm.learnedByMaster}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'DAY_DESK' && (
          <TradeFloorPanel
            day={gameState.day}
            seed={gameState.seed}
            activeRegion={gameState.activeRegion}
            products={gameState.products}
            masters={gameState.masters}
            parties={gameState.parties}
            scheduledMasterId={activeRegionSchedule.currentMaster.id}
            scheduledPartyId={activeRegionSchedule.currentParty.id}
            nextMasterName={activeRegionSchedule.nextMaster.name}
            nextPartyName={activeRegionSchedule.nextParty.name}
            contractsToday={gameState.contractsToday}
            bilateralSkillUnlocked={isSkillUnlocked('bilateral_margin')}
            secretShippingUnlocked={isSkillUnlocked('secret_shipping')}
            unlockedSkills={gameState.skills.filter((s) => s.unlocked).map((s) => s.effectKey)}
            tradeTerms={gameState.tradeTerms}
            onUpdateTradeTerms={(terms) =>
              setGameState((prev) => ({
                ...prev,
                tradeTerms: terms
              }))
            }
            onSelectScheduledMatchup={handleSelectScheduledMatchup}
            onExecuteSale={handleExecuteSale}
            onLaunchExpedition={handleLaunchExpedition}
          />
        )}

        {activeTab === 'ALCHEMY_LAB' && (
          <AlchemyLabPanel
            gold={gameState.gold}
            unlockedRegions={gameState.unlockedRegions}
            reagentInventory={gameState.reagentInventory}
            chelateSkillUnlocked={isSkillUnlocked('chelate_boost')}
            bonusYieldUnlocked={isSkillUnlocked('bonus_brew_yield')}
            onBrewProduct={handleBrewProduct}
            onBuyReagent={handleBuyReagent}
          />
        )}

        {activeTab === 'TRAP_WORKSHOP' && (
          <TrapWorkshopPanel
            gold={gameState.gold}
            unlockedRegions={gameState.unlockedRegions}
            partInventory={gameState.partInventory}
            zincGuardUnlocked={isSkillUnlocked('zinc_guard')}
            autoResetCamUnlocked={isSkillUnlocked('auto_reset_cam')}
            onAssembleTrap={handleAssembleTrap}
            onBuyPart={handleBuyPart}
          />
        )}

        {activeTab === 'INTEL_RUMOURS' && (
          <IntelAndStoryPanel
            day={gameState.day}
            gold={gameState.gold}
            intelFeed={gameState.intelFeed}
            basiliskChainStage={gameState.basiliskChainStage}
            blackspireUnlocked={gameState.unlockedRegions.includes('blackspire')}
            blackspireResolution={gameState.blackspireResolution}
            onResolveBasiliskDecision={handleResolveBasiliskDecision}
            onChooseBlackspireEnding={(ending) => {
              setGameState((prev) => ({ ...prev, blackspireResolution: ending }));
              setStatusBanner(`House Political Doctrine Set: ${ending.replace('_', ' ')}.`);
            }}
          />
        )}

        {activeTab === 'FINANCIALS' && (
          <FinancialsPanel
            gold={gameState.gold}
            debt={gameState.debt}
            unlockedRegions={gameState.unlockedRegions}
            expertUnlocked={gameState.expertUnlocked}
            ledger={gameState.financialLedger}
            rivals={gameState.rivals}
            cheapCreditUnlocked={isSkillUnlocked('cheap_credit')}
            onUnlockRegionCharter={handleUnlockRegionCharter}
            onPayDownDebt={(amt) => {
              setGameState((prev) => ({
                ...prev,
                gold: prev.gold - amt,
                debt: Math.max(0, prev.debt - amt)
              }));
              setStatusBanner(`Repaid ${amt}g of Dwarven Bridge Financing.`);
            }}
          />
        )}

        {activeTab === 'CLIENT_LEDGER' && (
          <ClientDirectoryPanel masters={gameState.masters} parties={gameState.parties} />
        )}

        {activeTab === 'SPECIALISATIONS' && (
          <SpecialisationsPanel
            skillPoints={gameState.skillPoints}
            skills={gameState.skills}
            onUnlockSkill={(skillId) => {
              soundFX.playCoin();
              setGameState((prev) => {
                const target = prev.skills.find((s) => s.id === skillId);
                if (!target || target.unlocked || prev.skillPoints < target.costPoints) return prev;
                return {
                  ...prev,
                  skillPoints: prev.skillPoints - target.costPoints,
                  skills: prev.skills.map((s) => (s.id === skillId ? { ...s, unlocked: true } : s))
                };
              });
            }}
          />
        )}

        {activeTab === 'ARCHIVES_CATALYST' && (
          <ArchivesAndCatalystPanel
            day={gameState.day}
            seed={gameState.seed}
            blackspireUnlocked={gameState.unlockedRegions.includes('blackspire')}
            expertUnlocked={gameState.expertUnlocked}
            catalystLedger={gameState.catalystLedger}
            expeditionReports={gameState.expeditionReports}
            customBrewsCount={gameState.customBrewsCount}
            customTrapsCount={gameState.customTrapsCount}
            masterSalesCount={masterSalesCount}
            heroSalesCount={heroSalesCount}
            onClaimSoloDmCatalyst={handleClaimSoloDmCatalyst}
            onImportPeerCatalyst={handleImportPeerCatalyst}
            onExportSaveJson={() => JSON.stringify(gameState)}
            onImportSaveJson={(jsonStr) => {
              const check = validateSavePayload(jsonStr);
              if (!check.valid || !check.state) {
                try { quarantinePayload(localStorage, jsonStr); } catch { /* preserve checkpoints even when quota is full */ }
                setRecoveryNotice(`Import refused: ${check.error}. Current campaign unchanged.`);
                return false;
              }
              if (!persistAtomicSaveSafe(check.state, localStorage)) return false;
              saveBlocked.current = false;
              setGameState(check.state);
              setRecoveryNotice(`Imported validated ledger: Day ${check.state.day}.`);
              return true;
            }}
          />
        )}
      </main>

      {/* F06/F07 Fix: Ergonomic Bottom Thumb Navigation Bar for Mobile (<1024px) & One-Thumb Portrait Mode (Includes ALL 9 Tabs including Skills!) */}
      <nav
        aria-label="Mobile and One-Thumb Workspace Navigation"
        className={`${
          a11y.oneThumbPortraitMode ? 'flex' : 'flex lg:hidden'
        } fixed bottom-0 inset-x-0 z-40 bg-[#0B0E14]/95 border-t border-slate-800 px-2 py-1.5 overflow-x-auto items-center justify-start sm:justify-center gap-1`}
      >
        {WORKSPACE_NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`min-h-[44px] min-w-[64px] px-2.5 py-1.5 text-xs font-mono rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex flex-col items-center justify-center ${
              activeTab === item.id
                ? 'bg-amber-600 text-slate-950 font-bold'
                : 'bg-[#131822] text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <span>{item.shortLabel}</span>
          </button>
        ))}
      </nav>

      {/* Pause & Accessibility Modal */}
      {shellState === 'PAUSED' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#131822] border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="font-display text-xl font-bold text-slate-100">
                Ledger Paused &amp; Accessibility Settings
              </h2>
              <button
                onClick={() => setShellState('PLAYING')}
                className="text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
              >
                Resume (Esc)
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Accessibility controls are completely separate from gameplay difficulty and never restrict Paradox Catalyst or Expert Vault eligibility.
            </p>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between p-3 bg-[#0B0E14] border border-slate-800 rounded-lg">
                <span>Typography Scale</span>
                <div className="flex gap-1">
                  {(['normal', 'large', 'xlarge'] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setA11y((prev) => ({ ...prev, fontScale: sz }))}
                      className={`min-h-[36px] px-2.5 py-1 rounded cursor-pointer ${
                        a11y.fontScale === sz ? 'bg-amber-600 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {sz.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#0B0E14] border border-slate-800 rounded-lg">
                <span>Expedition Simulation Speed</span>
                <div className="flex gap-1">
                  {([1, 2, 4] as const).map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setA11y((prev) => ({ ...prev, simSpeed: spd }))}
                      className={`min-h-[36px] px-2.5 py-1 rounded cursor-pointer ${
                        a11y.simSpeed === spd ? 'bg-amber-600 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between p-3 bg-[#0B0E14] border border-slate-800 rounded-lg cursor-pointer">
                <span>One-Thumb Portrait Layout &amp; Bottom Dock</span>
                <input
                  type="checkbox"
                  checked={a11y.oneThumbPortraitMode}
                  onChange={(e) => setA11y((prev) => ({ ...prev, oneThumbPortraitMode: e.target.checked }))}
                  className="accent-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#0B0E14] border border-slate-800 rounded-lg cursor-pointer">
                <span>Reduced Animation &amp; Zero Camera Shake</span>
                <input
                  type="checkbox"
                  checked={a11y.reducedMotion}
                  onChange={(e) => setA11y((prev) => ({ ...prev, reducedMotion: e.target.checked }))}
                  className="accent-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#0B0E14] border border-slate-800 rounded-lg cursor-pointer">
                <span>Mute Procedural Web Audio Synth</span>
                <input
                  type="checkbox"
                  checked={a11y.audioMuted}
                  onChange={(e) => setA11y((prev) => ({ ...prev, audioMuted: e.target.checked }))}
                  className="accent-amber-500"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShellState('TITLE_MENU')}
                className="min-h-[42px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-lg cursor-pointer"
              >
                Return to Title Screen
              </button>
              <button
                onClick={() => setShellState('PLAYING')}
                className="min-h-[42px] px-5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs font-mono rounded-lg cursor-pointer"
              >
                Resume Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
