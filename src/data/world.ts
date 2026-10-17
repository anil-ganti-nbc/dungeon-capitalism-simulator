import {
  RegionId,
  DifficultyTier,
  DungeonMaster,
  AdventuringParty,
  RivalHouse,
  MarketFactOrRumour
} from '../types/game';

export interface RegionInfo {
  id: RegionId;
  roman: string;
  name: string;
  difficulty: DifficultyTier;
  charterCostGold: number;
  requiresCatalyst: boolean;
  tagline: string;
  mechanicsSummary: string[];
  environmentModifiers: string;
}

export const REGIONS_DATA: RegionInfo[] = [
  {
    id: 'cellar',
    roman: 'I',
    name: "The Rat King's Cellar",
    difficulty: 'Easy',
    charterCostGold: 0,
    requiresCatalyst: false,
    tagline: 'A ramshackle cellar, swampy tunnels, criminally negligent rats and dungeon management on a shoestring budget.',
    mechanicsSummary: [
      'Two-sided customer demand & same-night double delivery',
      'Forgiving finances & bridge credit to prevent permanent softlocks',
      'Transparent post-expedition causal reports'
    ],
    environmentModifiers: 'High humidity (+10% organic spoilage), basic 45kg flagstone plates.'
  },
  {
    id: 'warrens',
    roman: 'II',
    name: 'The Gilded Warrens',
    difficulty: 'Normal',
    charterCostGold: 4500,
    requiresCatalyst: false,
    tagline: 'Layered golden mines, smugglers’ entrances, moving walls, dwarven insurance adjusters and competing merchants.',
    mechanicsSummary: [
      'Adaptive parties remember previously observed hazards',
      'Sulphur Fog & Basilisk Antidote chemical interference',
      'Rival merchant counter-bids & perishable reagent grades'
    ],
    environmentModifiers: 'Geothermal sulphur vents; dwarven underwriters audit warranty claims.'
  },
  {
    id: 'blackspire',
    roman: 'III',
    name: 'Blackspire Labyrinth',
    difficulty: 'Hard',
    charterCostGold: 14000,
    requiresCatalyst: false,
    tagline: 'A fortress of lucrative monsters, surveillance sorcery, industrialised dungeon defence and a kingdom terrified of its own insurance claims.',
    mechanicsSummary: [
      'Intelligence asymmetry, provenance tracing & guild inspections',
      'Central political investigation & 4 branching campaign resolutions',
      'Solo Dungeon Master Commission path to earn the Paradox Catalyst'
    ],
    environmentModifiers: 'Active anti-scrying wards; unmasked dual-dealing triggers cartel inquiries.'
  },
  {
    id: 'vault',
    roman: 'IV',
    name: 'The Paradox Vault',
    difficulty: 'Expert',
    charterCostGold: 0,
    requiresCatalyst: true,
    tagline: 'A physically impossible dungeon whose chambers intersect supply routes, political borders, and the contracts of every earlier master.',
    mechanicsSummary: [
      'Unlocked strictly via attributable Paradox Catalyst (Solo DM Courier or Offline Peer Exchange)',
      'Cross-region economic cascades & non-Euclidean trap geometry',
      'Masters turning adventurer & veteran heroes becoming landlords'
    ],
    environmentModifiers: 'Inverted mass plates, temporal loops, and multi-region supply shocks.'
  }
];

// 12 Named Dungeon Masters (3 per region)
export const INITIAL_MASTERS: DungeonMaster[] = [
  // === REGION I: THE RAT KING'S CELLAR ===
  {
    id: 'dm_cellar_1',
    name: 'Skritch the Under-Bailiff',
    title: 'Self-Appointed Tollkeeper of Cistern Four',
    region: 'cellar',
    personality: 'Frugal, jumpy, obsessed with keeping shiny brass trinkets out of hero hands.',
    secretive: false,
    budget: 650,
    deterrenceScore: 38,
    prestigeScore: 25,
    visitorTraffic: 78,
    trust: 65,
    knownHeroCounters: ['Basic Scout Detection'],
    installedHazards: ['prod_trap_plate_spikes'],
    memoryLog: ['Day 1: Opened trade ledger with your shop. Needs cheap pressure-plate traps.'],
    desiredTrait: 'Low-maintenance physical traps (45kg Pressure Plates)',
    catalystCommissionStage: 0
  },
  {
    id: 'dm_cellar_2',
    name: 'Matron Brine-Bog',
    title: 'Proprietor of the Sunken Mushroom Grotto',
    region: 'cellar',
    personality: 'Chatty swamp-witch who views dungeon raids as ticketed tourist attractions.',
    secretive: false,
    budget: 780,
    deterrenceScore: 44,
    prestigeScore: 40,
    visitorTraffic: 84,
    trust: 70,
    knownHeroCounters: [],
    installedHazards: ['prod_trap_plate_spikes'],
    memoryLog: ['Day 1: Wants non-lethal or poison hazards that scare heroes into dropping gear without killing all future customers.'],
    desiredTrait: 'Poison & Deterrence hazards with high visitor survival',
    catalystCommissionStage: 0
  },
  {
    id: 'dm_cellar_3',
    name: 'Alderman Vance (Disgraced)',
    title: 'Custodian of the Old Debtors’ Vault',
    region: 'cellar',
    personality: 'Pompous ex-magistrate hiding embezzlement ledgers behind rusted portcullises.',
    secretive: true,
    budget: 920,
    deterrenceScore: 52,
    prestigeScore: 34,
    visitorTraffic: 65,
    trust: 55,
    knownHeroCounters: [],
    installedHazards: ['prod_trap_plate_spikes'],
    memoryLog: ['Day 1: Demands discreet deliveries so town auditors do not question his trap budget.'],
    desiredTrait: 'Concealed triggers & chest-latch booby traps',
    catalystCommissionStage: 0
  },

  // === REGION II: THE GILDED WARRENS ===
  {
    id: 'dm_warrens_1',
    name: 'Overseer Grimthorn',
    title: 'Warden of the Basilisk Smelting Pits',
    region: 'warrens',
    personality: 'Calculating dwarven industrialist at the heart of the Basilisk Supply Chain.',
    secretive: false,
    budget: 1850,
    deterrenceScore: 64,
    prestigeScore: 68,
    visitorTraffic: 74,
    trust: 62,
    knownHeroCounters: ['Standard Basilisk Antidote'],
    installedHazards: ['prod_hazard_basilisk', 'prod_trap_sulphur_fog'],
    memoryLog: [
      'Day 1: Purchased Cave-Basilisk Lair and Sulphur-Fog Machine.',
      'Noticed that Sulphur Fog obscures the basilisk AND weakens cheap hero antidotes!'
    ],
    desiredTrait: 'Basilisk Petrification + Sulphur Fog synergy combos',
    catalystCommissionStage: 0
  },
  {
    id: 'dm_warrens_2',
    name: 'Bram Iron-Ledger',
    title: 'Chief Underwriter of Deep-Vein Six',
    region: 'warrens',
    personality: 'Minotaur actuary who calculates maintenance cost per hero limb bruised.',
    secretive: false,
    budget: 2100,
    deterrenceScore: 60,
    prestigeScore: 62,
    visitorTraffic: 80,
    trust: 68,
    knownHeroCounters: ['Bantam Chicken-Morph Draught'],
    installedHazards: ['prod_trap_plate_spikes', 'prod_trap_hairtrigger_acid'],
    memoryLog: ['Day 1: Furious that Chicken-Morphed heroes bypassed his 45kg pressure plates. Wants 8kg Hair-Trigger Quartz wires!'],
    desiredTrait: 'Low-mass triggers (<10kg) to catch featherweight heroes',
    catalystCommissionStage: 0
  },
  {
    id: 'dm_warrens_3',
    name: 'Duchess Sallowgold',
    title: 'Matriarch of the Glittering Maze',
    region: 'warrens',
    personality: 'Flamboyant collector who streams dungeon spectacles to high-society patrons.',
    secretive: false,
    budget: 2450,
    deterrenceScore: 58,
    prestigeScore: 86,
    visitorTraffic: 90,
    trust: 60,
    knownHeroCounters: [],
    installedHazards: ['prod_hazard_basilisk'],
    memoryLog: ['Day 1: Pays premium margins for high-prestige, visually dramatic traps.'],
    desiredTrait: 'High Prestige & Pyrite-camouflaged hazards',
    catalystCommissionStage: 0
  },

  // === REGION III: BLACKSPIRE LABYRINTH ===
  {
    id: 'dm_blackspire_1',
    name: 'Arch-Architect Vespera',
    title: 'Grand Magus of the Blackspire Panopticon',
    region: 'blackspire',
    personality: 'Brilliant, paranoid necromancer-engineer who holds a stock of Paradox Catalysts.',
    secretive: true,
    budget: 5400,
    deterrenceScore: 82,
    prestigeScore: 88,
    visitorTraffic: 72,
    trust: 58,
    knownHeroCounters: ['Quartz-Chelated Basilisk Antidote', 'Rust-Monster Gear Solvent Bomb'],
    installedHazards: ['prod_trap_sulphur_fog', 'prod_trap_hairtrigger_acid'],
    memoryLog: [
      'Day 1: Issued the Blackspire Solo Commission: Prove mastery of both offensive trap engineering and stabilised counter-alchemy to receive her couriered Paradox Catalyst.'
    ],
    desiredTrait: 'Secret-provenance arcane traps & Catalyst Commission fulfilment',
    catalystCommissionStage: 1
  },
  {
    id: 'dm_blackspire_2',
    name: 'Inquisitor Malakor',
    title: 'Director of Crown Claims & Dungeon Compliance',
    region: 'blackspire',
    personality: 'Ruthless bureaucrat balancing royal tax revenue against catastrophic insurance payouts.',
    secretive: true,
    budget: 4800,
    deterrenceScore: 76,
    prestigeScore: 79,
    visitorTraffic: 68,
    trust: 52,
    knownHeroCounters: ['Charcoal Alchemical Breather Tonic'],
    installedHazards: ['prod_trap_hairtrigger_acid'],
    memoryLog: ['Day 1: Audits supplier maker-marks. Rewards merchants who use Null-Signature Wax.'],
    desiredTrait: 'Untraceable traps & low-variance deterrence',
    catalystCommissionStage: 0
  },
  {
    id: 'dm_blackspire_3',
    name: 'Lord Kaelen the Unsleeping',
    title: 'Lich-Regent of the Obsidian Treasury',
    region: 'blackspire',
    personality: 'Ancient undead financier who hedges his own dungeon raids on the bond market.',
    secretive: true,
    budget: 6200,
    deterrenceScore: 88,
    prestigeScore: 91,
    visitorTraffic: 64,
    trust: 60,
    knownHeroCounters: ['Bantam Chicken-Morph Draught'],
    installedHazards: ['prod_hazard_basilisk', 'prod_trap_sulphur_fog'],
    memoryLog: ['Day 1: Seeks multi-room chemical combos that force heroes into expensive retreats.'],
    desiredTrait: 'High-lethality Arcane & Elder Gorgon payloads',
    catalystCommissionStage: 0
  },

  // === REGION IV: THE PARADOX VAULT ===
  {
    id: 'dm_vault_1',
    name: 'The Tesseract Factor',
    title: 'Syndicate Arbiter of Non-Euclidean Fold Seven',
    region: 'vault',
    personality: 'Speaks in probabilities; views heroes and monsters as interchangeable liquidity.',
    secretive: true,
    budget: 11500,
    deterrenceScore: 92,
    prestigeScore: 95,
    visitorTraffic: 76,
    trust: 65,
    knownHeroCounters: ['Quartz-Chelated Basilisk Antidote', 'Bantam Chicken-Morph Draught', 'Charcoal Alchemical Breather Tonic'],
    installedHazards: ['prod_trap_hairtrigger_acid', 'prod_trap_sulphur_fog', 'prod_hazard_basilisk'],
    memoryLog: ['Vault Access: Monitors cross-region price cascades across all four realms.'],
    desiredTrait: 'Paradox Mass-Inversion & Temporal Reset modules',
    catalystCommissionStage: 0
  },
  {
    id: 'dm_vault_2',
    name: 'Dame Cassia (Retired Vanguard)',
    title: 'Former Hero Turned Vault Landlord',
    region: 'vault',
    personality: 'Veteran adventurer who bought out her own dungeon and knows every cheap potion trick in the book.',
    secretive: false,
    budget: 9800,
    deterrenceScore: 89,
    prestigeScore: 90,
    visitorTraffic: 82,
    trust: 70,
    knownHeroCounters: ['Bantam Chicken-Morph Draught', 'Rust-Monster Gear Solvent Bomb'],
    installedHazards: ['prod_trap_hairtrigger_acid'],
    memoryLog: ['Vault Access: Remembering her own raiding days, she pre-counters standard hero bypass routes.'],
    desiredTrait: 'Counter-countermeasure traps & Tamper-Punishing failsafes',
    catalystCommissionStage: 0
  },
  {
    id: 'dm_vault_3',
    name: 'Ouroboros Collective',
    title: 'Tri-Partite Council of Chimeric Ecologists',
    region: 'vault',
    personality: 'Breeds reality-warping monsters that feed on unstabilised potion runoff.',
    secretive: true,
    budget: 12800,
    deterrenceScore: 95,
    prestigeScore: 94,
    visitorTraffic: 70,
    trust: 55,
    knownHeroCounters: ['Quartz-Chelated Basilisk Antidote'],
    installedHazards: ['prod_hazard_basilisk', 'prod_trap_sulphur_fog'],
    memoryLog: ['Vault Access: Experiments with ecological mutation from alchemical residue.'],
    desiredTrait: 'Sublime-grade Entropy & Chrono hazards',
    catalystCommissionStage: 0
  }
];

// 16 Named Adventuring Parties (4 per region)
export const INITIAL_PARTIES: AdventuringParty[] = [
  // === REGION I: THE RAT KING'S CELLAR ===
  {
    id: 'pty_cellar_1',
    name: 'The Cobblestone Irregulars',
    region: 'cellar',
    motto: 'No sewer too damp, no tab too small.',
    ethics: 'Pragmatic',
    budget: 520,
    reputation: 32,
    trust: 72,
    caution: 45,
    members: [
      { name: 'Halvar Mud-Boot', role: 'Vanguard', hp: 90, maxHp: 90, massKg: 84, status: 'Healthy' },
      { name: 'Pip Quick-Fingers', role: 'Scout', hp: 65, maxHp: 65, massKg: 52, status: 'Healthy' },
      { name: 'Sister Marta', role: 'Alchemist', hp: 70, maxHp: 70, massKg: 60, status: 'Healthy' }
    ],
    observedTraps: [],
    equippedProducts: ['prod_antidote_unstabilised'],
    memoryLog: ['Day 1: Looking for affordable healing tonics and pressure-plate bypasses for Skritch’s cellar.'],
    desiredCounter: 'Mass-Bypass (Chicken-Morph) or Basic Antidotes'
  },
  {
    id: 'pty_cellar_2',
    name: 'Lantern & Spade Co-op',
    region: 'cellar',
    motto: 'Unionised delvers since the Third Plague.',
    ethics: 'Chivalrous',
    budget: 610,
    reputation: 38,
    trust: 68,
    caution: 60,
    members: [
      { name: 'Brenn Oakshield', role: 'Vanguard', hp: 95, maxHp: 95, massKg: 88, status: 'Healthy' },
      { name: 'Tamsin Wire-Cut', role: 'Scout', hp: 68, maxHp: 68, massKg: 54, status: 'Healthy' },
      { name: 'Aldo Sparks', role: 'Arcanist', hp: 60, maxHp: 60, massKg: 58, status: 'Healthy' }
    ],
    observedTraps: ['prod_trap_plate_spikes'],
    equippedProducts: ['prod_chicken_morph'],
    memoryLog: ['Day 1: Refuses unethical poison gear; loves Bantam Chicken-Morph Draughts to step over 45kg plates.'],
    desiredCounter: 'Featherweight / Chicken-Morph & Rust Solvents'
  },
  {
    id: 'pty_cellar_3',
    name: 'Gutter-Crown Mercenaries',
    region: 'cellar',
    motto: 'We loot the fixtures if the chest is empty.',
    ethics: 'Mercenary',
    budget: 580,
    reputation: 28,
    trust: 58,
    caution: 35,
    members: [
      { name: 'Grix Ironjaw', role: 'Vanguard', hp: 100, maxHp: 100, massKg: 92, status: 'Healthy' },
      { name: 'Vex Needle', role: 'Scout', hp: 62, maxHp: 62, massKg: 50, status: 'Healthy' }
    ],
    observedTraps: [],
    equippedProducts: ['prod_rust_solvent'],
    memoryLog: ['Day 1: Heavy vanguard (92kg) triggers every pressure plate unless given morph tonics or rust bombs.'],
    desiredCounter: 'Trap Sabotage Solvents & High-Potency Tonics'
  },
  {
    id: 'pty_cellar_4',
    name: 'Novices of St. Jude',
    region: 'cellar',
    motto: 'Faith shields the righteous (and warranties cover the rest).',
    ethics: 'Puritan',
    budget: 640,
    reputation: 42,
    trust: 75,
    caution: 70,
    members: [
      { name: 'Brother Cedric', role: 'Vanguard', hp: 88, maxHp: 88, massKg: 80, status: 'Healthy' },
      { name: 'Initiate Lyra', role: 'Alchemist', hp: 72, maxHp: 72, massKg: 56, status: 'Healthy' },
      { name: 'Novice Finn', role: 'Scout', hp: 64, maxHp: 64, massKg: 53, status: 'Healthy' }
    ],
    observedTraps: [],
    equippedProducts: ['prod_antidote_unstabilised'],
    memoryLog: ['Day 1: Always demands Warranty-Backed potions; sues suppliers if a tonic fails mid-raid.'],
    desiredCounter: 'Warranty-Backed Antidotes & Pure Restoratives'
  },

  // === REGION II: THE GILDED WARRENS ===
  {
    id: 'pty_warrens_1',
    name: 'The Silver Stag Company',
    region: 'warrens',
    motto: 'Antlers high through stone and smog.',
    ethics: 'Chivalrous',
    budget: 1650,
    reputation: 64,
    trust: 66,
    caution: 58,
    members: [
      { name: 'Captain Valen Stagheart', role: 'Vanguard', hp: 115, maxHp: 115, massKg: 86, status: 'Healthy' },
      { name: 'Elena Glass-Eye', role: 'Scout', hp: 85, maxHp: 85, massKg: 55, status: 'Healthy' },
      { name: 'Master Corin', role: 'Alchemist', hp: 82, maxHp: 82, massKg: 62, status: 'Healthy' },
      { name: 'Sera Vane', role: 'Arcanist', hp: 78, maxHp: 78, massKg: 57, status: 'Healthy' }
    ],
    observedTraps: ['prod_hazard_basilisk'],
    equippedProducts: ['prod_antidote_unstabilised'],
    memoryLog: [
      'Day 1: Planning an expedition into Overseer Grimthorn’s Basilisk Smelting Pits.',
      'Carrying Standard Basilisk Antidotes—unaware that Grimthorn just installed a Sulphur-Fog Machine!'
    ],
    desiredCounter: 'Quartz-Chelated Basilisk Antidote & Charcoal Breathers'
  },
  {
    id: 'pty_warrens_2',
    name: 'Deep-Delve Syndicate',
    region: 'warrens',
    motto: 'Every ounce of gold accounted for.',
    ethics: 'Pragmatic',
    budget: 1800,
    reputation: 60,
    trust: 64,
    caution: 68,
    members: [
      { name: 'Durgan Pick-Hand', role: 'Vanguard', hp: 125, maxHp: 125, massKg: 95, status: 'Healthy' },
      { name: 'Kestrel Flint', role: 'Scout', hp: 88, maxHp: 88, massKg: 58, status: 'Healthy' },
      { name: 'Mora Vial', role: 'Alchemist', hp: 84, maxHp: 84, massKg: 60, status: 'Healthy' }
    ],
    observedTraps: ['prod_trap_plate_spikes', 'prod_trap_sulphur_fog'],
    equippedProducts: ['prod_chicken_morph', 'prod_breather_mask'],
    memoryLog: ['Day 1: Adapted to 45kg plates using Chicken-Morph Draughts; watching out for Bram’s new 8kg quartz wires.'],
    desiredCounter: 'Filtration Masks & Acid-Resistant Salves'
  },
  {
    id: 'pty_warrens_3',
    name: 'Aurelia’s Pathfinders',
    region: 'warrens',
    motto: 'Light Steps, Heavy Purses.',
    ethics: 'Pragmatic',
    budget: 1520,
    reputation: 56,
    trust: 70,
    caution: 75,
    members: [
      { name: 'Aurelia Swift', role: 'Scout', hp: 92, maxHp: 92, massKg: 51, status: 'Healthy' },
      { name: 'Joran Greaves', role: 'Vanguard', hp: 110, maxHp: 110, massKg: 82, status: 'Healthy' },
      { name: 'Pell the Wise', role: 'Arcanist', hp: 76, maxHp: 76, massKg: 59, status: 'Healthy' }
    ],
    observedTraps: ['prod_trap_plate_spikes'],
    equippedProducts: ['prod_rust_solvent'],
    memoryLog: ['Day 1: Prefers high-detection and trap-disarming solvents over brute tanking.'],
    desiredCounter: 'Rust-Monster Solvents & Scout Perception Tonics'
  },
  {
    id: 'pty_warrens_4',
    name: 'The Red Anvil Charter',
    region: 'warrens',
    motto: 'Strike first, claim salvage second.',
    ethics: 'Mercenary',
    budget: 1950,
    reputation: 68,
    trust: 54,
    caution: 42,
    members: [
      { name: 'Korgath Hammer', role: 'Vanguard', hp: 135, maxHp: 135, massKg: 104, status: 'Healthy' },
      { name: 'Zanna Fuse', role: 'Alchemist', hp: 90, maxHp: 90, massKg: 64, status: 'Healthy' },
      { name: 'Rikard Keen', role: 'Scout', hp: 86, maxHp: 86, massKg: 61, status: 'Healthy' }
    ],
    observedTraps: ['prod_hazard_basilisk'],
    equippedProducts: ['prod_antidote_chelated'],
    memoryLog: ['Day 1: Willing to pay top gold for Quartz-Chelated Antidotes if exclusivity is guaranteed.'],
    desiredCounter: 'Chelated Antidotes & Exclusive Supply Contracts'
  },

  // === REGION III: BLACKSPIRE LABYRINTH ===
  {
    id: 'pty_blackspire_1',
    name: 'Order of the Obsidian Scale',
    region: 'blackspire',
    motto: 'Truth weighed in blood and silver.',
    ethics: 'Puritan',
    budget: 4200,
    reputation: 80,
    trust: 62,
    caution: 82,
    members: [
      { name: 'Justicar Thorne', role: 'Vanguard', hp: 145, maxHp: 145, massKg: 90, status: 'Healthy' },
      { name: 'Inquisitor Vael', role: 'Arcanist', hp: 105, maxHp: 105, massKg: 62, status: 'Healthy' },
      { name: 'Sable Hound', role: 'Scout', hp: 110, maxHp: 110, massKg: 56, status: 'Healthy' },
      { name: 'Apothecary Lin', role: 'Alchemist', hp: 100, maxHp: 100, massKg: 58, status: 'Healthy' }
    ],
    observedTraps: ['prod_trap_sulphur_fog', 'prod_trap_hairtrigger_acid', 'prod_hazard_basilisk'],
    equippedProducts: ['prod_antidote_chelated', 'prod_breather_mask'],
    memoryLog: ['Day 1: Employs forensic alchemists to inspect potion residue after every Blackspire raid.'],
    desiredCounter: 'Military-Chelated Elixirs & Anti-Magic Wards'
  },
  {
    id: 'pty_blackspire_2',
    name: 'Sable Mantle Cooperative',
    region: 'blackspire',
    motto: 'Shared risk, silent blades.',
    ethics: 'Pragmatic',
    budget: 4600,
    reputation: 78,
    trust: 65,
    caution: 76,
    members: [
      { name: 'Nyx Shadow-Step', role: 'Scout', hp: 115, maxHp: 115, massKg: 49, status: 'Healthy' },
      { name: 'Darian Coil', role: 'Alchemist', hp: 108, maxHp: 108, massKg: 60, status: 'Healthy' },
      { name: 'Garrick Vane', role: 'Vanguard', hp: 140, maxHp: 140, massKg: 85, status: 'Healthy' }
    ],
    observedTraps: ['prod_trap_plate_spikes', 'prod_trap_hairtrigger_acid'],
    equippedProducts: ['prod_chicken_morph', 'prod_rust_solvent'],
    memoryLog: ['Day 1: Pools purchasing power with sister guilds to demand bulk discounts and provenance transparency.'],
    desiredCounter: 'Stealth Osmotic Patches & Arcane Disruptors'
  },
  {
    id: 'pty_blackspire_3',
    name: 'Crown’s Own Breachers',
    region: 'blackspire',
    motto: 'By Royal Warrant we enter.',
    ethics: 'Chivalrous',
    budget: 5100,
    reputation: 85,
    trust: 60,
    caution: 70,
    members: [
      { name: 'Sir Roland Vance', role: 'Vanguard', hp: 160, maxHp: 160, massKg: 98, status: 'Healthy' },
      { name: 'Magister Elia', role: 'Arcanist', hp: 112, maxHp: 112, massKg: 59, status: 'Healthy' },
      { name: 'Corporal Briggs', role: 'Scout', hp: 118, maxHp: 118, massKg: 66, status: 'Healthy' }
    ],
    observedTraps: ['prod_hazard_basilisk', 'prod_trap_sulphur_fog'],
    equippedProducts: ['prod_antidote_chelated', 'prod_breather_mask'],
    memoryLog: ['Day 1: Investigates illicit arms dealers supplying Arch-Architect Vespera.'],
    desiredCounter: 'Certified High-Stability Countermeasures'
  },
  {
    id: 'pty_blackspire_4',
    name: 'Ash-Hound Freelancers',
    region: 'blackspire',
    motto: 'Pay the hound or feed the pyre.',
    ethics: 'Mercenary',
    budget: 3900,
    reputation: 74,
    trust: 55,
    caution: 52,
    members: [
      { name: 'Raze Cinder', role: 'Vanguard', hp: 150, maxHp: 150, massKg: 94, status: 'Healthy' },
      { name: 'Skulk', role: 'Scout', hp: 105, maxHp: 105, massKg: 50, status: 'Healthy' },
      { name: 'Vespera’s Ex-Apprentice', role: 'Arcanist', hp: 98, maxHp: 98, massKg: 57, status: 'Healthy' }
    ],
    observedTraps: ['prod_trap_hairtrigger_acid'],
    equippedProducts: ['prod_rust_solvent', 'prod_chicken_morph'],
    memoryLog: ['Day 1: Happy to buy experimental or black-market potions with zero questions asked.'],
    desiredCounter: 'Volatile Solvents & Experimental Polymorphs'
  },

  // === REGION IV: THE PARADOX VAULT ===
  {
    id: 'pty_vault_1',
    name: 'Zero-Meridian Voyagers',
    region: 'vault',
    motto: 'We walk where angles bend.',
    ethics: 'Pragmatic',
    budget: 9200,
    reputation: 92,
    trust: 68,
    caution: 88,
    members: [
      { name: 'Astra Null', role: 'Arcanist', hp: 145, maxHp: 145, massKg: 54, status: 'Healthy' },
      { name: 'Kaelen Stride', role: 'Vanguard', hp: 185, maxHp: 185, massKg: 84, status: 'Healthy' },
      { name: 'Cipher', role: 'Scout', hp: 150, maxHp: 150, massKg: 48, status: 'Healthy' },
      { name: 'Dr. Hesper', role: 'Alchemist', hp: 140, maxHp: 140, massKg: 58, status: 'Healthy' }
    ],
    observedTraps: ['prod_trap_plate_spikes', 'prod_trap_sulphur_fog', 'prod_hazard_basilisk', 'prod_trap_hairtrigger_acid'],
    equippedProducts: ['prod_antidote_chelated', 'prod_breather_mask', 'prod_chicken_morph'],
    memoryLog: ['Vault Access: Requires Invariant Anchor-Salt potions to survive non-Euclidean Vault pressure rooms.'],
    desiredCounter: 'Sublime Paradox Elixirs & Multi-Stage Tesseract Tonics'
  },
  {
    id: 'pty_vault_2',
    name: 'The Sovereign Liquidators',
    region: 'vault',
    motto: 'Foreclosing on impossible realities.',
    ethics: 'Mercenary',
    budget: 10400,
    reputation: 94,
    trust: 62,
    caution: 84,
    members: [
      { name: 'Bailiff-General Orin', role: 'Vanguard', hp: 195, maxHp: 195, massKg: 96, status: 'Healthy' },
      { name: 'Lyssandra', role: 'Arcanist', hp: 155, maxHp: 155, massKg: 56, status: 'Healthy' },
      { name: 'Vane Jr.', role: 'Alchemist', hp: 148, maxHp: 148, massKg: 60, status: 'Healthy' }
    ],
    observedTraps: ['prod_trap_hairtrigger_acid', 'prod_trap_sulphur_fog'],
    equippedProducts: ['prod_antidote_chelated', 'prod_rust_solvent'],
    memoryLog: ['Vault Access: Funded by cross-region bond syndicates to crack high-deterrence vaults.'],
    desiredCounter: 'Bifurcated Ouroboros Solvents & Phase-Plasma Draughts'
  },
  {
    id: 'pty_vault_3',
    name: 'Grimthorn’s Reclamation Crew',
    region: 'vault',
    motto: 'A Dungeon Master knows where the gold is buried.',
    ethics: 'Pragmatic',
    budget: 8800,
    reputation: 89,
    trust: 65,
    caution: 90,
    members: [
      { name: 'Ex-Warden Hulda', role: 'Vanguard', hp: 180, maxHp: 180, massKg: 88, status: 'Healthy' },
      { name: 'Engineer Tock', role: 'Scout', hp: 160, maxHp: 160, massKg: 55, status: 'Healthy' },
      { name: 'Chemist Brenn', role: 'Alchemist', hp: 145, maxHp: 145, massKg: 59, status: 'Healthy' }
    ],
    observedTraps: ['prod_hazard_basilisk', 'prod_trap_sulphur_fog', 'prod_trap_hairtrigger_acid'],
    equippedProducts: ['prod_antidote_chelated', 'prod_breather_mask'],
    memoryLog: ['Vault Access: Former dungeon masters who teamed up to raid the Paradox Vault themselves!'],
    desiredCounter: 'Counter-Countermeasure Gear & Temporal Anchors'
  },
  {
    id: 'pty_vault_4',
    name: 'Aether-Sworn Vanguard',
    region: 'vault',
    motto: 'Beyond the horizon of gold.',
    ethics: 'Chivalrous',
    budget: 11200,
    reputation: 96,
    trust: 74,
    caution: 86,
    members: [
      { name: 'Seraphina the Unbound', role: 'Vanguard', hp: 200, maxHp: 200, massKg: 78, status: 'Healthy' },
      { name: 'Orion Glass', role: 'Scout', hp: 165, maxHp: 165, massKg: 50, status: 'Healthy' },
      { name: 'Solon', role: 'Arcanist', hp: 160, maxHp: 160, massKg: 55, status: 'Healthy' }
    ],
    observedTraps: ['prod_trap_plate_spikes', 'prod_trap_sulphur_fog', 'prod_hazard_basilisk'],
    equippedProducts: ['prod_antidote_chelated', 'prod_chicken_morph', 'prod_breather_mask'],
    memoryLog: ['Vault Access: Seeks to stabilise the Vault’s reality fractures through apex alchemical mastery.'],
    desiredCounter: 'Apex Resonance Elixirs & Zero-Gravity Lodestone Tonics'
  }
];

// 4 Rival Merchant Houses
export const INITIAL_RIVALS: RivalHouse[] = [
  {
    id: 'riv_vane',
    name: 'Vane & Sons Alchemicals',
    specialty: 'Cheap mass-market antidotes & breathable charcoal masks',
    regionFocus: 'warrens',
    aggressiveness: 65,
    priceUndercutPct: 12,
    marketShare: 24,
    signatureProduct: 'Bargain Charcoal Breather Masks',
    lastAction: 'Stockpiling Alkali Charcoal to sell breathable masks if Sulphur Fog raids increase.'
  },
  {
    id: 'riv_ironwright',
    name: 'Ironwright Mechanica',
    specialty: 'Heavy clockwork traps & hair-trigger tripwires',
    regionFocus: 'cellar',
    aggressiveness: 58,
    priceUndercutPct: 10,
    marketShare: 22,
    signatureProduct: 'Refurbished 10kg Tripwire Crossbows',
    lastAction: 'Pitching low-threshold tripwires to Dungeon Masters frustrated by Chicken-Morph potions.'
  },
  {
    id: 'riv_gilded',
    name: 'Gilded Scale Syndicate',
    specialty: 'Dungeon insurance underwriting & bulk guild supply contracts',
    regionFocus: 'blackspire',
    aggressiveness: 78,
    priceUndercutPct: 15,
    marketShare: 30,
    signatureProduct: 'Indemnified Anti-Petrification Bonds',
    lastAction: 'Lobbying Blackspire inspectors to fine merchants whose unstabilised potions fail in sulphur.'
  },
  {
    id: 'riv_whisper',
    name: 'Whisperglass Apothecary',
    specialty: 'Untraceable poisons, counterfeit maker-marks & Vault smuggling',
    regionFocus: 'vault',
    aggressiveness: 84,
    priceUndercutPct: 8,
    marketShare: 18,
    signatureProduct: 'Counterfeit Chelating Salts',
    lastAction: 'Spreading rumours about contaminated Calcified Basilisk Bile in the Warrens.'
  }
];

// Initial Morning Intel & Rumours (Distinguishes Verified Facts from Unconfirmed Rumours)
export const INITIAL_INTEL_FEED: MarketFactOrRumour[] = [
  {
    id: 'intel_day1_basilisk_fact',
    day: 1,
    timestamp: '06:15 AM',
    region: 'warrens',
    isVerifiedFact: true,
    source: 'Gilded Warrens Freight Manifest',
    reliabilityPct: 100,
    headline: 'Overseer Grimthorn Installed Cave-Basilisk & Sulphur-Fog Vents',
    detail: 'Verified bill of lading confirms Grimthorn has paired a Cave-Basilisk with a Sulphur-Fog Machine. Standard unstabilised Basilisk Antidotes will lose 55% potency in that sulphur atmosphere unless chelated with Calcified Quartz Salt or paired with Charcoal Breathers!',
    affectedTag: 'basilisk_chain'
  },
  {
    id: 'intel_day1_stag_fact',
    day: 1,
    timestamp: '06:40 AM',
    region: 'warrens',
    isVerifiedFact: true,
    source: 'Guild Quartermaster Registry',
    reliabilityPct: 100,
    headline: 'Silver Stag Company Preparing Smelting Pit Expedition',
    detail: 'Captain Valen Stagheart’s party is purchasing anti-petrification supplies today. Selling them unstabilised antidotes while supplying Grimthorn’s sulphur vents will cause partial petrification and trigger a Guild Investigation—unless you reformulate with Quartz Salt or sell them Breather Tonics.',
    affectedTag: 'basilisk_chain'
  },
  {
    id: 'intel_day1_cellar_fact',
    day: 1,
    timestamp: '07:05 AM',
    region: 'cellar',
    isVerifiedFact: true,
    source: 'Cellar Scout Ledger',
    reliabilityPct: 100,
    headline: 'Skritch the Under-Bailiff Relies on 45kg Flagstone Pressure Plates',
    detail: 'All three entry rooms in Cistern Four use 45kg Rusted Iron Pressure Plates. Heroes drinking Bantam Chicken-Morph Draughts (-65kg mass) shrink to ~20kg and walk right over the plates without triggering a single spike!',
    affectedTag: 'mass_bypass'
  },
  {
    id: 'intel_day1_rumour_1',
    day: 1,
    timestamp: '07:30 AM',
    region: 'warrens',
    isVerifiedFact: false,
    source: 'Tavern Whisper (Unconfirmed)',
    reliabilityPct: 62,
    headline: 'Rumour: Vane & Sons Dumping Cheap Breathable Masks Next Turn',
    detail: 'A warehouse clerk claims Vane & Sons Alchemicals has crated 40 units of bargain Charcoal Breathers to undercut your countermeasure sales if the Silver Stag raid goes poorly.',
    affectedTag: 'rival_vane'
  },
  {
    id: 'intel_day1_catalyst_fact',
    day: 1,
    timestamp: '07:50 AM',
    region: 'blackspire',
    isVerifiedFact: true,
    source: 'Sealed Courier Dispatch — Arch-Architect Vespera',
    reliabilityPct: 100,
    headline: 'Paradox Catalyst Commission Protocol Active',
    detail: 'Gold cannot buy entry to The Paradox Vault. Complete Vespera’s 3-Stage Bilateral Commission (supplying both high-lethality traps and sulphur-immune chelated tonics across campaigns) OR receive a verified Offline Peer Catalyst Transfer in the Archives.',
    affectedTag: 'paradox_catalyst'
  }
];
