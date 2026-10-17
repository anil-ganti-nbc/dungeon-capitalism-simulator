export type GameShellState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY_MODAL' | 'GAME_OVER';

export type DayPhase = 'MORNING' | 'PREPARATION' | 'TRADE' | 'EXPEDITIONS' | 'EVENING';

export type RegionId = 'cellar' | 'warrens' | 'blackspire' | 'vault';

export type DifficultyTier = 'Easy' | 'Normal' | 'Hard' | 'Expert';

export type WorkspaceTab =
  | 'DAY_DESK'
  | 'ALCHEMY_LAB'
  | 'TRAP_WORKSHOP'
  | 'TRADE_FLOOR'
  | 'EXPEDITION_MAP'
  | 'INTEL_RUMOURS'
  | 'CLIENT_LEDGER'
  | 'FINANCIALS'
  | 'SPECIALISATIONS'
  | 'ARCHIVES_CATALYST';

export type ReagentSlotRole = 'base' | 'active' | 'carrier' | 'stabiliser' | 'catalyst';

export interface ReagentTraits {
  toxicity: number;          // 0-100
  volatility: number;        // 0-100
  acidity: number;           // 0-100
  heatAffinity: number;      // -50 to +100
  antiMagic: number;         // 0-100
  potency: number;           // 0-100
  stability: number;         // 0-100
  duration: number;          // 1-10 rooms
  massDeltaKg: number;       // e.g. -65kg for Avian Shrinking / Chicken Morph
  contamination: number;     // 0-100
  sulphurSensitivity: number;// 0-100 (high means degrades in Sulphur Fog unless stabilised)
  perishability: number;     // 0-100 (% chance to lose grade per day without cold storage)
}

export interface Reagent {
  id: string;
  name: string;
  role: ReagentSlotRole;
  regionOrigin: RegionId;
  baseCost: number;
  grade: 'Crude' | 'Standard' | 'Refined' | 'Sublime';
  description: string;
  traits: ReagentTraits;
  tags: string[];
}

export type TrapSlotRole = 'trigger' | 'concealment' | 'delivery' | 'payload' | 'power' | 'reset';

export type CounterClass =
  | 'detection'
  | 'disruption'
  | 'resistance'
  | 'bypass_mass'
  | 'sabotage'
  | 'routing'
  | 'filtration';

export interface TrapPart {
  id: string;
  name: string;
  role: TrapSlotRole;
  regionTier: RegionId;
  baseCost: number;
  maintenanceCost: number;
  massThresholdKg?: number; // For triggers (e.g. 45kg pressure plate, 5kg hair-trigger)
  detectionDC: number;      // 10-95
  lethality: number;        // 0-100
  deterrence: number;       // 0-100
  damageType: 'physical' | 'poison' | 'acid' | 'petrification' | 'sulphur_fog' | 'arcane' | 'corrosive';
  counterplayRoutes: CounterClass[];
  description: string;
}

export type ProductCategory = 'TONIC_HERO' | 'COUNTER_GEAR' | 'TRAP_MASTER' | 'HAZARD_MONSTER' | 'DUAL_SOLVENT';

export interface CraftedProduct {
  id: string;                    // Canonical deterministic build ID based on composition + skills + rulesVersion
  formulaSignature?: string;     // Short 8-char canonical hex signature of composition + skills + rules
  rulesVersion?: string;         // e.g. 'v2.0-sim002'
  name: string;
  category: ProductCategory;
  targetAudience: 'HERO' | 'MASTER' | 'BOTH';
  productionCost: number;
  suggestedPrice: number;
  stock: number;
  potency: number;
  stability: number;
  reliability: number;
  massEffectKg: number;          // e.g. -65kg shrinks heroes below pressure plate threshold
  sulphurVulnerable: boolean;    // True if high sulphurSensitivity and low stabiliser
  emitsSulphurFog: boolean;      // True if creates sulphur atmosphere in dungeon
  causesPetrification: boolean;  // True for Basilisk / Gorgon hazards
  curesPetrification: boolean;   // True for Basilisk Antidote
  filtersSulphur: boolean;       // True for Alchemical Breather Mask / Scrubbing Tonic
  triggerMassThresholdKg: number;// If trap, mass needed to trigger
  detectionDC: number;
  damageType: string;
  counterClasses: CounterClass[];
  recipeComponents: string[];    // IDs of reagents or trap parts in slot order
  appliedSkills?: string[];      // Applicable skill flags present at synthesis/assembly
  description: string;
  reactionNotes: string[];
}

export interface DungeonMaster {
  id: string;
  name: string;
  title: string;
  region: RegionId;
  personality: string;
  secretive: boolean;
  budget: number;
  deterrenceScore: number;   // 0-100
  prestigeScore: number;     // 0-100
  visitorTraffic: number;    // 0-100 (too lethal = 0 traffic; too easy = looted treasury)
  trust: number;             // 0-100
  knownHeroCounters: string[];
  installedHazards: string[]; // Canonical Product IDs
  memoryLog: string[];
  desiredTrait: string;
  catalystCommissionStage: number; // 0 = not started, 1 = phase 1, 2 = phase 2, 3 = sent catalyst
}

export interface HeroMember {
  name: string;
  role: 'Vanguard' | 'Alchemist' | 'Scout' | 'Arcanist';
  hp: number;
  maxHp: number;
  massKg: number;
  status: 'Healthy' | 'Petrified' | 'Poisoned' | 'Recovering';
}

export interface AdventuringParty {
  id: string;
  name: string;
  region: RegionId;
  motto: string;
  ethics: 'Chivalrous' | 'Pragmatic' | 'Mercenary' | 'Puritan';
  budget: number;
  reputation: number;        // 0-100
  trust: number;             // 0-100
  caution: number;           // 0-100
  members: HeroMember[];
  observedTraps: string[];   // Trap/Hazard IDs they have learned to counter
  equippedProducts: string[];// Canonical Product IDs bought from player or rivals
  memoryLog: string[];
  desiredCounter: string;
}

export interface RivalHouse {
  id: string;
  name: string;
  specialty: string;
  regionFocus: RegionId;
  aggressiveness: number;
  priceUndercutPct: number;
  marketShare: number;
  signatureProduct: string;
  lastAction: string;
}

export interface MarketFactOrRumour {
  id: string;
  day: number;
  timestamp: string;
  region: RegionId;
  isVerifiedFact: boolean; // True = Verified Ledger Fact, False = Unconfirmed Rumour
  source: string;
  reliabilityPct: number;
  headline: string;
  detail: string;
  affectedTag: string;
  resolved?: boolean;
}

export interface SaleContract {
  id: string;
  day: number;
  buyerType: 'MASTER' | 'HERO';
  buyerId: string;
  buyerName: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalRevenue: number;
  unitCost: number;
  warrantyBacked: boolean;   // Refunds buyer if item fails due to reaction/counter
  exclusiveDeal: boolean;    // Promises not to sell direct counter on same day
  secretProvenance: boolean; // Hides seller mark in Blackspire/Vault
  creditFinanced: boolean;   // Collects 115% next day
}

export interface ExpeditionRoomEvent {
  roomIndex: number;
  roomName: string;
  hazardName: string;
  hazardId: string;
  triggerType: string;
  triggerMassThresholdKg: number;
  heroEffectiveMassKg: number;
  heroCounterUsed: string | null;
  chemicalReaction: string | null; // e.g., "Sulphur Fog degraded unstabilised Basilisk Antidote (-55% potency)!"
  outcome: 'TRAP_TRIGGERED' | 'TRAP_BYPASSED' | 'COUNTER_SUCCEEDED' | 'REACTION_FAILURE' | 'MONSTER_CLASH';
  damageDealt: number;
  lootSecured: number;
  casualtyName: string | null;
  causalExplanation: string;
  learnedByHeroes: string;
  learnedByMaster: string;
}

export interface ExpeditionReport {
  id: string;
  day: number;
  seed: number;
  rulesVersion: string;
  region: RegionId;
  masterId: string;
  masterName: string;
  partyId: string;
  partyName: string;
  masterSupplies: string[];
  heroSupplies: string[];
  masterSupplyIds?: string[];
  heroSupplyIds?: string[];
  rooms: ExpeditionRoomEvent[];
  totalLooted: number;
  masterTreasuryDelta: number;
  partyBudgetDelta: number;
  warrantyClaimsTriggered: number;
  exclusivityBreachDetected: boolean;
  doubleSaleDemandCreated: string[];
  summaryHeadline: string;
}

export interface FinancialRecord {
  day: number;
  grossRevenue: number;
  cogs: number;
  grossMargin: number;
  overheadAndStorage: number;
  warrantyAndClaims: number;
  finesAndBribes: number;
  financingInterest: number;
  netProfit: number;
  endingCash: number;
  inventoryValue: number;
  debt: number;
  netWorth: number;
}

export interface ParadoxCatalystEntry {
  id: string;
  senderName: string;
  senderType: 'SOLO_DM_COURIER' | 'PEER_QR_EXCHANGE';
  provenanceHash: string;
  dayReceived: number;
  commissionNote: string;
  isAuthentic: boolean;
}

export interface SkillNode {
  id: string;
  branch: 'Alchemy' | 'Engineering' | 'Commerce' | 'Intelligence';
  name: string;
  tier: 1 | 2 | 3;
  costPoints: number;
  unlocked: boolean;
  description: string;
  effectKey: string;
}

export interface AccessibilitySettings {
  fontScale: 'normal' | 'large' | 'xlarge';
  colorblindLabels: boolean;
  reducedMotion: boolean;
  oneThumbPortraitMode: boolean;
  simSpeed: 1 | 2 | 4;
  audioMuted: boolean;
}

export interface ScheduledMatchup {
  masterId: string;
  partyId: string;
}

export interface GameSaveState {
  version: string;
  seed: number;
  day: number;
  phase: DayPhase;
  activeRegion: RegionId;
  unlockedRegions: RegionId[];
  gold: number;
  debt: number;
  skillPoints: number;
  customBrewsCount: number;
  customTrapsCount: number;
  scheduledMatchups: Record<RegionId, ScheduledMatchup>;
  reagentInventory: Record<string, number>;
  partInventory: Record<string, number>;
  products: CraftedProduct[];
  masters: DungeonMaster[];
  parties: AdventuringParty[];
  rivals: RivalHouse[];
  contractsToday: SaleContract[];
  contractHistory: SaleContract[];
  intelFeed: MarketFactOrRumour[];
  expeditionReports: ExpeditionReport[];
  financialLedger: FinancialRecord[];
  catalystLedger: ParadoxCatalystEntry[];
  expertUnlocked: boolean;
  skills: SkillNode[];
  basiliskChainStage: number; // Tracks the emergent Basilisk Supply Chain story progression
  blackspireResolution: 'NONE' | 'HONEST_BROKER' | 'CARTEL_SYNDICATE' | 'PARTISAN_ARMOURER' | 'CALCULATED_CHAOS';
  insolvencyEvents?: number;
}
