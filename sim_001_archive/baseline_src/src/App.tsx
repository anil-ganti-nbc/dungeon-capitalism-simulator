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
  SaleContract
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
  simulateRegionExpedition,
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

const SAVE_STORAGE_KEY = 'trap_and_tonic_save_v1';
const SAVE_BACKUP_KEY = 'trap_and_tonic_backup_v1';

function createInitialSaveState(): GameSaveState {
  const initReagents: Record<string, number> = {};
  REAGENTS_CATALOG.slice(0, 20).forEach((r) => {
    initReagents[r.id] = 3;
  });
  const initParts: Record<string, number> = {};
  TRAP_PARTS_CATALOG.slice(0, 20).forEach((p) => {
    initParts[p.id] = 2;
  });

  return {
    version: '1.0.0',
    seed: 20261017,
    day: 1,
    phase: 'MORNING',
    activeRegion: 'cellar',
    unlockedRegions: ['cellar'],
    gold: 1850,
    debt: 0,
    skillPoints: 2,
    reagentInventory: initReagents,
    partInventory: initParts,
    products: INITIAL_PRODUCTS.map((p) => ({ ...p })),
    masters: INITIAL_MASTERS.map((m) => ({ ...m, memoryLog: [...m.memoryLog], installedHazards: [...m.installedHazards] })),
    parties: INITIAL_PARTIES.map((p) => ({
      ...p,
      members: p.members.map((mem) => ({ ...mem })),
      observedTraps: [...p.observedTraps],
      equippedProducts: [...p.equippedProducts],
      memoryLog: [...p.memoryLog]
    })),
    rivals: INITIAL_RIVALS.map((r) => ({ ...r })),
    contractsToday: [],
    contractHistory: [],
    intelFeed: INITIAL_INTEL_FEED.map((i) => ({ ...i })),
    expeditionReports: [],
    financialLedger: [
      {
        day: 0,
        grossRevenue: 0,
        cogs: 0,
        grossMargin: 0,
        overheadAndStorage: 0,
        warrantyAndClaims: 0,
        finesAndBribes: 0,
        financingInterest: 0,
        netProfit: 0,
        endingCash: 1850,
        inventoryValue: 1420,
        debt: 0,
        netWorth: 3270
      }
    ],
    catalystLedger: [],
    expertUnlocked: false,
    skills: SKILL_TREE_NODES.map((s) => ({ ...s })),
    basiliskChainStage: 1,
    blackspireResolution: 'NONE'
  };
}

export default function App() {
  const [shellState, setShellState] = useState<GameShellState>('TITLE_MENU');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('DAY_DESK');
  const [activeRoomIdx, setActiveRoomIdx] = useState<number>(0);
  const [statusBanner, setStatusBanner] = useState<string>(
    'Morning Ledger Open: Inspect Verified Facts, brew tonics or traps, supply both sides, and resolve the expedition.'
  );

  const [a11y, setA11y] = useState<AccessibilitySettings>({
    fontScale: 'normal',
    colorblindLabels: true,
    reducedMotion: false,
    oneThumbPortraitMode: false,
    simSpeed: 1,
    audioMuted: false
  });

  const [gameState, setGameState] = useState<GameSaveState>(() => {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY) || localStorage.getItem(SAVE_BACKUP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GameSaveState;
        if (parsed && typeof parsed.day === 'number' && Array.isArray(parsed.products)) {
          return parsed;
        }
      }
    } catch {
      // Fallback to fresh save
    }
    return createInitialSaveState();
  });

  const [customBrewsCount, setCustomBrewsCount] = useState<number>(1);
  const [customTrapsCount, setCustomTrapsCount] = useState<number>(1);

  // Atomic save rotation on state update & app lifecycle interruption
  const persistAtomicSave = useCallback((stateToSave: GameSaveState) => {
    try {
      const prev = localStorage.getItem(SAVE_STORAGE_KEY);
      if (prev) {
        localStorage.setItem(SAVE_BACKUP_KEY, prev);
      }
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // Ignore storage quota errors in restricted sandboxes
    }
  }, []);

  useEffect(() => {
    persistAtomicSave(gameState);
  }, [gameState, persistAtomicSave]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistAtomicSave(gameState);
      }
    };
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', () => persistAtomicSave(gameState));
    return () => window.removeEventListener('visibilitychange', onVisibilityChange);
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

  // Load "The Basilisk Supply Chain" Scenario (Unlocks Warrens immediately & stages Grimthorn + Silver Stag)
  const handleLoadBasiliskScenario = useCallback(() => {
    const base = createInitialSaveState();
    base.unlockedRegions = ['cellar', 'warrens'];
    base.activeRegion = 'warrens';
    base.gold = 3400;
    base.phase = 'TRADE';
    setGameState(base);
    setShellState('PLAYING');
    setActiveTab('DAY_DESK');
    setStatusBanner(
      'Scenario Loaded: Overseer Grimthorn has deployed a Cave-Basilisk + Sulphur-Fog Machine against the Silver Stag Company!'
    );
    soundFX.playCatalystChord();
  }, []);

  // Brew Alchemy Product
  const handleBrewProduct = useCallback(
    (product: CraftedProduct, spotCost: number, consumedIds: string[], batchSize: number) => {
      soundFX.playBrew();
      setCustomBrewsCount((c) => c + 1);
      setGameState((prev) => {
        const nextReagents = { ...prev.reagentInventory };
        consumedIds.forEach((id) => {
          if ((nextReagents[id] || 0) > 0) {
            nextReagents[id] -= 1;
          }
        });

        const existingIdx = prev.products.findIndex((p) => p.name === product.name);
        let nextProducts = [...prev.products];
        if (existingIdx >= 0) {
          nextProducts[existingIdx] = {
            ...nextProducts[existingIdx],
            stock: nextProducts[existingIdx].stock + batchSize
          };
        } else {
          nextProducts = [{ ...product, stock: batchSize }, ...nextProducts];
        }

        return {
          ...prev,
          phase: 'PREPARATION',
          gold: prev.gold - spotCost,
          reagentInventory: nextReagents,
          products: nextProducts
        };
      });
      setStatusBanner(`Synthesized ${batchSize}x ${product.name} (${product.sulphurVulnerable ? 'Sulphur Vulnerable' : 'Sulphur Safe'}).`);
    },
    []
  );

  // Assemble Trap Product
  const handleAssembleTrap = useCallback(
    (trapProduct: CraftedProduct, spotCost: number, consumedIds: string[]) => {
      soundFX.playRatchet();
      setCustomTrapsCount((c) => c + 1);
      setGameState((prev) => {
        const nextParts = { ...prev.partInventory };
        consumedIds.forEach((id) => {
          if ((nextParts[id] || 0) > 0) {
            nextParts[id] -= 1;
          }
        });

        const existingIdx = prev.products.findIndex((p) => p.name === trapProduct.name);
        let nextProducts = [...prev.products];
        if (existingIdx >= 0) {
          nextProducts[existingIdx] = {
            ...nextProducts[existingIdx],
            stock: nextProducts[existingIdx].stock + 2
          };
        } else {
          nextProducts = [{ ...trapProduct, stock: 2 }, ...nextProducts];
        }

        return {
          ...prev,
          phase: 'PREPARATION',
          gold: prev.gold - spotCost,
          partInventory: nextParts,
          products: nextProducts
        };
      });
      setStatusBanner(
        `Assembled 2x ${trapProduct.name} (Trigger Threshold: ${trapProduct.triggerMassThresholdKg}kg, DC ${trapProduct.detectionDC}).`
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
      soundFX.playCoin();
      const unitPrice = Math.max(
        25,
        Math.round(product.suggestedPrice * priceMultiplier) - (secretProvenance ? 35 : 0)
      );

      setGameState((prev) => {
        const buyerName =
          buyerType === 'MASTER'
            ? prev.masters.find((m) => m.id === buyerId)?.name || 'Master'
            : prev.parties.find((p) => p.id === buyerId)?.name || 'Party';

        const newContract: SaleContract = {
          id: `cnt_d${prev.day}_${Date.now()}_${Math.floor(Math.random() * 999)}`,
          day: prev.day,
          buyerType,
          buyerId,
          buyerName,
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice,
          totalRevenue: unitPrice,
          unitCost: product.productionCost,
          warrantyBacked,
          exclusiveDeal,
          secretProvenance,
          creditFinanced: false
        };

        const nextProducts = prev.products.map((p) =>
          p.id === product.id ? { ...p, stock: Math.max(0, p.stock - 1) } : p
        );

        const nextMasters = prev.masters.map((m) => {
          if (buyerType === 'MASTER' && m.id === buyerId) {
            return {
              ...m,
              budget: Math.max(0, m.budget - unitPrice),
              trust: Math.min(100, m.trust + (warrantyBacked ? 5 : 2)),
              installedHazards: Array.from(new Set([product.id, ...m.installedHazards])).slice(0, 3),
              memoryLog: [...m.memoryLog, `Day ${prev.day}: Bought ${product.name} for ${unitPrice}g.`]
            };
          }
          return m;
        });

        const nextParties = prev.parties.map((p) => {
          if (buyerType === 'HERO' && p.id === buyerId) {
            return {
              ...p,
              budget: Math.max(0, p.budget - unitPrice),
              trust: Math.min(100, p.trust + (warrantyBacked ? 6 : 3)),
              equippedProducts: Array.from(new Set([product.id, ...p.equippedProducts])).slice(0, 3),
              memoryLog: [...p.memoryLog, `Day ${prev.day}: Bought ${product.name} for ${unitPrice}g.`]
            };
          }
          return p;
        });

        return {
          ...prev,
          phase: 'TRADE',
          gold: prev.gold + unitPrice,
          products: nextProducts,
          masters: nextMasters,
          parties: nextParties,
          contractsToday: [...prev.contractsToday, newContract],
          contractHistory: [...prev.contractHistory, newContract]
        };
      });

      setStatusBanner(
        `Sold 1x ${product.name} to ${buyerType === 'MASTER' ? 'Dungeon Master' : 'Adventuring Party'} for +${unitPrice}g!`
      );
    },
    []
  );

  // Resolve Seeded Expedition & Advance Day
  const handleLaunchExpedition = useCallback(() => {
    setGameState((prev) => {
      const regionMasters = prev.masters.filter((m) => m.region === prev.activeRegion);
      const regionParties = prev.parties.filter((p) => p.region === prev.activeRegion);
      const master = regionMasters[(prev.day - 1) % regionMasters.length] || prev.masters[0];
      const party = regionParties[(prev.day - 1) % regionParties.length] || prev.parties[0];

      const report = simulateRegionExpedition(
        prev.day,
        prev.seed,
        master,
        party,
        prev.products,
        prev.contractsToday
      );

      // Accounting math
      const grossRevenue = prev.contractsToday.reduce((acc, c) => acc + c.totalRevenue, 0);
      const cogs = prev.contractsToday.reduce((acc, c) => acc + c.unitCost * c.quantity, 0);
      const grossMargin = grossRevenue - cogs;
      const overheadAndStorage = 45 + prev.unlockedRegions.length * 25;

      const hasWarrantyShield = prev.skills.some((s) => s.effectKey === 'warranty_shield' && s.unlocked);
      const warrantyClaims = Math.round(
        report.warrantyClaimsTriggered * 165 * (hasWarrantyShield ? 0.6 : 1)
      );
      const fines = report.exclusivityBreachDetected ? 240 : 0;
      const interest = Math.round(prev.debt * 0.05);

      const netProfit = grossMargin - overheadAndStorage - warrantyClaims - fines - interest;
      const endingCash = Math.max(120, prev.gold - overheadAndStorage - warrantyClaims - fines - interest);
      const inventoryVal = prev.products.reduce((acc, p) => acc + p.stock * p.productionCost, 0);
      const netWorth = endingCash + inventoryVal - prev.debt;

      // Update Master & Party memory + budgets from expedition outcome
      const nextMasters = prev.masters.map((m) => {
        if (m.id === master.id) {
          const lastRoom = report.rooms[report.rooms.length - 1];
          return {
            ...m,
            budget: Math.max(450, m.budget + report.masterTreasuryDelta + 320),
            memoryLog: [...m.memoryLog, `Day ${prev.day} After-Action: ${lastRoom.learnedByMaster}`],
            desiredTrait: report.doubleSaleDemandCreated[0] || m.desiredTrait
          };
        }
        return { ...m, budget: m.budget + 180 };
      });

      const nextParties = prev.parties.map((p) => {
        if (p.id === party.id) {
          const lastRoom = report.rooms[report.rooms.length - 1];
          return {
            ...p,
            budget: Math.max(420, p.budget + report.partyBudgetDelta + 290),
            trust: Math.max(15, p.trust - report.warrantyClaimsTriggered * 12),
            memoryLog: [...p.memoryLog, `Day ${prev.day} After-Action: ${lastRoom.learnedByHeroes}`],
            desiredCounter:
              report.doubleSaleDemandCreated.find((d) => d.includes(p.name)) || p.desiredCounter
          };
        }
        return { ...p, budget: p.budget + 160 };
      });

      // Generate new Morning Intel item from actual causal expedition outcome
      const newFact = {
        id: `intel_d${prev.day + 1}_${Date.now()}`,
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
        skillPoints: prev.skillPoints + 1,
        masters: nextMasters,
        parties: nextParties,
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
            inventoryValue: inventoryVal,
            debt: prev.debt,
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

  // Claim Solo Offline DM Paradox Catalyst (from Arch-Architect Vespera)
  const handleClaimSoloDmCatalyst = useCallback(() => {
    soundFX.playCatalystChord();
    setGameState((prev) => {
      const hash = hashString(`SOLO_VESPERA_CATALYST_DAY_${prev.day}`).slice(0, 8);
      const entry = {
        id: `cat_solo_${Date.now()}`,
        senderName: 'Arch-Architect Vespera (Blackspire Panopticon)',
        senderType: 'SOLO_DM_COURIER' as const,
        provenanceHash: hash,
        dayReceived: prev.day,
        commissionNote:
          'Solo Offline Commission Fulfilled: Demonstrated offensive trap engineering, stabilised alchemy, and bilateral double-sales.',
        isAuthentic: true
      };
      const nextRegions: RegionId[] = prev.unlockedRegions.includes('vault')
        ? prev.unlockedRegions
        : [...prev.unlockedRegions, 'vault'];
      return {
        ...prev,
        expertUnlocked: true,
        unlockedRegions: nextRegions,
        activeRegion: 'vault',
        catalystLedger: [entry, ...prev.catalystLedger]
      };
    });
    setStatusBanner(
      'Paradox Catalyst Received by Courier from Arch-Architect Vespera! Region IV: The Paradox Vault (Expert) is now permanently unlocked!'
    );
  }, []);

  // Verify & Record Offline Peer Paradox Catalyst Code
  const handleImportPeerCatalyst = useCallback(
    (code: string): { valid: boolean; message: string } => {
      const check = verifyAndParseCatalystCode(code, gameState.day, gameState.catalystLedger);
      if (!check.valid || !check.entry) {
        return { valid: false, message: check.error || 'Invalid Catalyst Code.' };
      }
      soundFX.playCatalystChord();
      setGameState((prev) => ({
        ...prev,
        expertUnlocked: true,
        unlockedRegions: prev.unlockedRegions.includes('vault')
          ? prev.unlockedRegions
          : [...prev.unlockedRegions, 'vault'],
        activeRegion: 'vault',
        catalystLedger: [check.entry!, ...prev.catalystLedger]
      }));
      setStatusBanner(
        `Verified Offline Peer Catalyst (#${check.entry.provenanceHash})! The Paradox Vault is now permanently unlocked!`
      );
      return {
        valid: true,
        message: `Verified Peer Catalyst from ${check.entry.senderName} (#${check.entry.provenanceHash}). The Paradox Vault is unlocked!`
      };
    },
    [gameState.day, gameState.catalystLedger]
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
              id: `intel_basilisk_${Date.now()}`,
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

  // Preview report if no expedition has been run yet so the 60fps canvas is always alive and interactive
  const activeCanvasReport = useMemo(() => {
    if (latestReport) return latestReport;
    const regionMasters = gameState.masters.filter((m) => m.region === gameState.activeRegion);
    const regionParties = gameState.parties.filter((p) => p.region === gameState.activeRegion);
    return simulateRegionExpedition(
      gameState.day,
      gameState.seed,
      regionMasters[0] || gameState.masters[0],
      regionParties[0] || gameState.parties[0],
      gameState.products,
      gameState.contractsToday
    );
  }, [
    latestReport,
    gameState.masters,
    gameState.parties,
    gameState.activeRegion,
    gameState.day,
    gameState.seed,
    gameState.products,
    gameState.contractsToday
  ]);

  const fontScaleClass =
    a11y.fontScale === 'xlarge'
      ? 'text-[17px]'
      : a11y.fontScale === 'large'
      ? 'text-[15.5px]'
      : 'text-sm';

  if (shellState === 'TITLE_MENU') {
    return (
      <TitleScreen
        hasSavedGame={gameState.day > 1 || gameState.contractHistory.length > 0}
        savedDay={gameState.day}
        savedGold={gameState.gold}
        reducedMotion={a11y.reducedMotion}
        onStartNewOrContinue={() => setShellState('PLAYING')}
        onLoadBasiliskScenario={handleLoadBasiliskScenario}
        onResetSave={() => {
          const fresh = createInitialSaveState();
          setGameState(fresh);
          persistAtomicSave(fresh);
        }}
      />
    );
  }

  return (
    <div
      className={`w-screen h-screen overflow-hidden bg-[#0B0E14] text-[#F1F5F9] flex flex-col select-none ${fontScaleClass}`}
    >
      {/* Top Bar Contract: Zone 1 Brand Wordmark — Zone 2 Concise Nav Links — Zone 3 Primary Action */}
      <header className="flex items-center justify-between gap-8 px-5 py-3 bg-[#0B0E14] border-b border-slate-800/90 shrink-0">
        <button
          onClick={() => setShellState('TITLE_MENU')}
          className="font-display text-base sm:text-lg font-bold tracking-tight text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Trap &amp; Tonic
        </button>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          {[
            { id: 'DAY_DESK' as const, label: 'Bilateral Desk' },
            { id: 'ALCHEMY_LAB' as const, label: 'Alchemy Lab' },
            { id: 'TRAP_WORKSHOP' as const, label: 'Trap Workshop' },
            { id: 'EXPEDITION_MAP' as const, label: 'Expedition Arena' },
            { id: 'INTEL_RUMOURS' as const, label: 'Intel & Story' },
            { id: 'FINANCIALS' as const, label: 'Charters & Ledger' },
            { id: 'CLIENT_LEDGER' as const, label: 'Clients' },
            { id: 'SPECIALISATIONS' as const, label: 'Skills' },
            { id: 'ARCHIVES_CATALYST' as const, label: 'Catalyst & Saves' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === item.id
                  ? 'text-amber-400 underline underline-offset-8 decoration-2 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShellState('PAUSED')}
            className="px-3.5 py-1.5 text-xs font-mono font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Options &amp; A11y (Esc)
          </button>
        </div>
      </header>

      {/* Main Scrollable Game Shell Container (Supports One-Thumb Portrait Mode or Full 1440px Desktop) */}
      <main
        className={`flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5 ${
          a11y.oneThumbPortraitMode ? 'max-w-md mx-auto w-full border-x border-slate-800' : 'max-w-[1440px] mx-auto w-full'
        }`}
      >
        {/* Perimeter Telemetry Strip & Active Dungeon Region Selector (Clean unboxed metadata + segmented realm switcher) */}
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
          <div className="flex items-center gap-1 p-1 bg-[#131822] border border-slate-800 rounded-lg">
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
                  className={`px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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

        {/* Mobile / Compact Tab Switcher */}
        <div className="flex md:hidden overflow-x-auto gap-1.5 pb-1">
          {[
            { id: 'DAY_DESK' as const, label: 'Trade' },
            { id: 'ALCHEMY_LAB' as const, label: 'Alchemy' },
            { id: 'TRAP_WORKSHOP' as const, label: 'Traps' },
            { id: 'EXPEDITION_MAP' as const, label: 'Arena' },
            { id: 'INTEL_RUMOURS' as const, label: 'Intel' },
            { id: 'FINANCIALS' as const, label: 'Charters' },
            { id: 'CLIENT_LEDGER' as const, label: 'Clients' },
            { id: 'ARCHIVES_CATALYST' as const, label: 'Catalyst' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-xs font-mono rounded whitespace-nowrap shrink-0 ${
                activeTab === t.id ? 'bg-amber-600 text-slate-950 font-semibold' : 'bg-slate-900 text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Live Action Consequence Banner */}
        <div className="px-4 py-2.5 bg-[#131822] border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <span className="text-slate-200">{statusBanner}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLaunchExpedition}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded cursor-pointer whitespace-nowrap shrink-0"
            >
              Run Today’s Expedition →
            </button>
          </div>
        </div>

        {/* Active Workspace View */}
        {activeTab === 'EXPEDITION_MAP' && (
          <div className="space-y-4">
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

              {/* Low-Occlusion Perimeter HUD Overlay (pointer-events-none, zero backdrop-filter) */}
              <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
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
                    WASD Pan Camera · Space Step Room ({activeRoomIdx + 1}/{activeCanvasReport.rooms.length})
                  </div>
                  <div className="pointer-events-auto flex items-center gap-2">
                    {activeCanvasReport.rooms.map((rm, idx) => (
                      <button
                        key={rm.roomIndex}
                        onClick={() => setActiveRoomIdx(idx)}
                        className={`px-3 py-1 text-xs font-mono rounded cursor-pointer whitespace-nowrap shrink-0 ${
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
            activeRegion={gameState.activeRegion}
            products={gameState.products}
            masters={gameState.masters}
            parties={gameState.parties}
            contractsToday={gameState.contractsToday}
            bilateralSkillUnlocked={isSkillUnlocked('bilateral_margin')}
            secretShippingUnlocked={isSkillUnlocked('secret_shipping')}
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
            expertUnlocked={gameState.expertUnlocked}
            catalystLedger={gameState.catalystLedger}
            expeditionReports={gameState.expeditionReports}
            customBrewsCount={customBrewsCount}
            customTrapsCount={customTrapsCount}
            bilateralSalesCount={gameState.contractHistory.length}
            onClaimSoloDmCatalyst={handleClaimSoloDmCatalyst}
            onImportPeerCatalyst={handleImportPeerCatalyst}
            onExportSaveJson={() => JSON.stringify(gameState)}
            onImportSaveJson={(jsonStr) => {
              try {
                const parsed = JSON.parse(jsonStr) as GameSaveState;
                if (parsed && typeof parsed.day === 'number' && Array.isArray(parsed.products)) {
                  setGameState(parsed);
                  persistAtomicSave(parsed);
                  return true;
                }
              } catch {
                return false;
              }
              return false;
            }}
          />
        )}
      </main>

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
                      className={`px-2.5 py-1 rounded cursor-pointer ${
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
                      className={`px-2.5 py-1 rounded cursor-pointer ${
                        a11y.simSpeed === spd ? 'bg-amber-600 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between p-3 bg-[#0B0E14] border border-slate-800 rounded-lg cursor-pointer">
                <span>One-Thumb Portrait Layout Container</span>
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
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-lg cursor-pointer"
              >
                Return to Title Screen
              </button>
              <button
                onClick={() => setShellState('PLAYING')}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs font-mono rounded-lg cursor-pointer"
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
