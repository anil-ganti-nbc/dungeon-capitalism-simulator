# Trap & Tonic: Conflict of Interest
## SIM-001 — Independent Economic Stress and Balance Campaign Report

- **Audit ID:** `SIM-001`
- **Date Executed:** `2026-10-17T04:21:30-07:00`
- **Campaigns Executed:** `5,000` full campaigns (`1,000` paired seeds × `5` automated strategies)
- **Simulation Horizon:** `120` trading days per campaign (`600,000` simulated trading days; `1,800,000` discrete dungeon room encounters resolved)
- **Wall-Clock Execution Time:** `7,560 ms` (`~1.51 ms` per 120-day campaign)
- **Overall Engineering & Balance Verdict:** **`HOLD` (Conditional — Deterministic Combat/Alchemy Physics PASS; Macro-Economic Interest, Inventory Restocking & Progression Gate Defects Require Patch Before Release)**

---

## 1. Executive Summary & Final Acceptance Verdict

### Final Acceptance Question
> *Does this game support multiple meaningful ways to play, with consequences that arise from systemic interactions rather than scripted rewards and punishments?*

**Empirical Answer (Backed by 5,000 Campaigns / 1.8M Rooms):**
1. **At the Tactical & Causal Expedition Layer (`simulateRegionExpedition`): YES (`PASS`).**
   - Strategic choices in alchemy and trap engineering produce sharp, statistically distinct, non-scripted outcomes across all 1,000 seeds:
     - **Hero Benefactor** achieves a **95.0% median party survival rate** (`P10: 93.6%`, `P90: 96.4%`) with **115 median mass-bypassed pressure-plate rooms** and **225 counter-succeeded rooms** per campaign by supplying featherweight morphs, chelated antidotes, and breathers.
     - **Dungeon Loyalist** drives party survival down to **70.6% median** (`min: 65.3%`), triggering **139 trap hits** and **19 unstabilised sulphur-fog antidote failures** per campaign by arming Dungeon Masters with *Pneumatic Sulphur-Fog Machines*, *Cave-Basilisk Lairs*, and *8kg Hair-Trigger Acid Sprayers* while withholding hero countermeasures.
     - **Balanced Merchant** achieves the highest sustainable net worth (**+31,891g median**, beating *Predatory Capitalist* in **1,000 out of 1,000 paired seeds**) and highest dual-faction trust (**77.9 Master / 80.1 Hero**).
   - **Targeted General-Rule Proofs (`ADV-01` & `ADV-02`):** Both the *Chicken-Morph / Pressure-Plate Mass Bypass* (`effectiveMass < triggerMassThresholdKg`) and the *Sulphur-Fog / Basilisk-Antidote Degradation* (`netSulphurSens > 25 && !filtersSulphur`) were proven to arise from general stoichiometric and physical trait sums across all 48 reagents and 64 trap modules—not hardcoded item names or story flags.
2. **At the Macro-Economic & Progression Layer (`src/App.tsx` State Loop): `HOLD` (6 Structural Defects Identified).**
   - While `BALANCED_MERCHANT` is profitable (`+10,923g` net profit, `+31,891g` terminal net worth, `0%` bankruptcy), **all four specialist/aggressive strategies (`DUNGEON_LOYALIST`, `HERO_BENEFACTOR`, `ALCHEMICAL_INDUSTRIALIST`, `PREDATORY_CAPITALIST`) suffer 100% strict insolvency** when taking Bridge Loans under the frozen v1.0 baseline rules due to:
     1. **`DEFECT-01` (5%/Day Loan Interest + 120g Bailout Floor in `src/App.tsx:397`):** Dwarven Bridge Loans charge `5%` interest **per day** (`1,825% APR`). A `3,500g` Warrens loan costs `175g/day` forever if cash reserves stay below the repayment threshold; a `28,000g` Blackspire loan costs `1,400g/day`. Worse, `Math.max(120, ...)` silently absorbs negative cash every evening without triggering formal insolvency restructuring or capitalising unpaid interest.
     2. **`DEFECT-02` (Non-Seeded Product IDs in `src/engine/simulation.ts:85,159`):** `synthesizeAlchemyProduct()` and `assembleTrapProduct()` use `Date.now()` and `Math.random()` for `product.id` instead of `DeterministicRNG`.
     3. **`DEFECT-03` (Day-1 Solo Catalyst Pre-Seeded Counter Bypass in `src/App.tsx:124-125`):** `customBrewsCount` and `customTrapsCount` initialize at `1`, allowing a player to unlock *The Paradox Vault* (Expert) on Day 1 in the Tutorial Cellar after just 2 sales.
     4. **`DEFECT-04` (Infinite Installed Hazard/Gear Persistence in `src/App.tsx:321,333`):** Purchased traps and potions remain in `installedHazards` / `equippedProducts` indefinitely across all future expeditions without consuming charges or requiring maintenance resets.
     5. **`DEFECT-05` (Peer Catalyst Regex Forgery in `src/engine/simulation.ts:357`):** `verifyAndParseCatalystCode()` validates regex shape and local replay uniqueness, but does not verify the cryptographic hash suffix against `hashString()`.
     6. **`DEFECT-06` (Guaranteed Daily Client Budget Stipends):** Clients receive fixed daily stipends (`+320g`/`+180g` Masters, `+290g`/`+160g` Parties) floored at `450g`/`420g`, decoupling buyer purchasing power from actual expedition loot/damage variance when items are priced below `420g`.

---

## 2. Phase 1: Frozen Baseline & Instrumentation Record

Before running a single campaign, the production codebase was frozen and hashed:

| Runtime / File | Version / SHA-256 Digest |
| :--- | :--- |
| **OS / Kernel** | `Linux localhost 4.19.0-gvisor #1 SMP x86_64 GNU/Linux` |
| **Node.js Runtime** | `v22.23.3` (`tsx v4.21.0`, `TypeScript v7.0.2`) |
| **PRNG Algorithm** | `Mulberry32` (`DeterministicRNG` in `src/utils/prng.ts`, expedition stream `seed + day * 7919`) |
| `src/types/game.ts` | `53776ae80107d87ddefd05b240d953335280ebe6c925e7e6eab39cecedb71a2e` |
| `src/utils/prng.ts` | `b1e5a0a4a946b64a7aa8df03ba3f062b8f5d10f29ece366eaa5dce0660358132` |
| `src/data/catalog.ts` | `acaf9fbe710fce16d65ee1f6c07b7f2b61fc178435f21b2a03553067f9482192` |
| `src/data/world.ts` | `86d17b3d57ca763c2371c9daebd81314aaa093c29faad1d468755c31b284705a` |
| `src/engine/simulation.ts` | `2e0914f6ccd41de0f2b61047e4e77d6935302faa99bcc312f12ffc6dd76ada73` |
| `src/App.tsx` | `9ac62e92ac10a14a605fcfa872323feb0cdefbff4d0e6a3710ea718d34c1a6ac` |

### Headless Runner Architecture & Invocation
- **Source Files:** `src/engine/campaignRunner.ts` (headless state machine & adversarial suite) and `scripts/run_sim_001.ts` (5,000-campaign batch orchestrator, statistical aggregator, and SVG chart generator).
- **Zero-Render Separation:** The runner invokes `synthesizeAlchemyProduct()`, `assembleTrapProduct()`, `simulateRegionExpedition()`, and `verifyAndParseCatalystCode()` directly from `src/engine/simulation.ts` with zero DOM or 60fps `<canvas>` dependencies.
- **Reproducible Invocation Command:**
  ```bash
  npx tsx scripts/run_sim_001.ts
  ```

---

## 3. Phase 2 & Phase 3: Empirical Economy Measurements Across 5,000 Campaigns

All five strategies were executed across the identical 1,000 world seeds (`20260001` through `20261000`) for 120 simulated days per campaign.

### 3.1 Financial Performance & Terminal Wealth Distribution (`n = 1,000` per strategy)

| Strategy | Gross Revenue (P10 / **P50** / P90) | Total COGS (**P50**) | Overhead (**P50**) | Claims & Fines (P10 / **P50** / P90) | Loan Interest (**P50**) | Net Profit (P10 / **P50** / P90) | Terminal Net Worth (P10 / **P50** / P90) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Balanced Merchant** | 79,332g / **79,332g** / 79,332g | **36,409g** | **11,350g** | 0g / **0g** / 0g | **20,650g** | +10,923g / **+10,923g** / +10,923g | +31,891g / **+31,891g** / +31,891g |
| **2. Dungeon Loyalist** | 16,655g / **17,243g** / 19,569g | **6,945g** | **11,325g** | 1,386g / **1,881g** / 2,277g | **20,475g** | -23,977g / **-23,537g** / -22,193g | -2,003g / **-2,003g** / -2,003g |
| **3. Hero Benefactor** | 8,116g / **8,116g** / 8,116g | **4,370g** | **11,250g** | 0g / **0g** / 396g | **22,800g** | -30,700g / **-30,304g** / -30,304g | -2,439g / **-2,439g** / -2,439g |
| **4. Alchemical Industrialist** | 17,835g / **17,835g** / 17,835g | **9,869g** | **11,350g** | 0g / **825g** / 1,650g | **20,650g** | -25,684g / **-24,859g** / -24,034g | -3,380g / **-3,380g** / -3,380g |
| **5. Predatory Capitalist** | 118,995g / **121,875g** / 121,875g | **32,477g** | **13,250g** | 28,899g / **28,998g** / 29,196g | **75,800g** | -32,010g / **-28,650g** / -28,551g | -13,479g / **-12,242g** / -12,242g |

### 3.2 Insolvency, Bailout Floor Activation & Progression Timing

| Strategy | Strict Insolvency Rate (`Raw Cash < 0`) | `120g` Bailout Floor Active Days (P10 / **P50** / P90) | Min Raw Cash Before Floor (**P50**) | Normal (Warrens) Unlock Rate & Day (**P50**) | Hard (Blackspire) Unlock Rate & Day (**P50**) | Expert Catalyst (Strict Rule vs UI Rule) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Balanced Merchant** | **0.0%** | 0 / **0** / 0 days | **+422g** | **100%** (Day **3**) | **0.0%** (Cash tied in 34.9k inventory) | **0%** Strict / **100%** UI |
| **2. Dungeon Loyalist** | **100.0%** | 72 / **77** / 81 days | **-249g** | **100%** (Day **4**) | **0.0%** (Single-side rev < loan interest) | **0%** Strict / **100%** UI |
| **3. Hero Benefactor** | **100.0%** | 108 / **108** / 108 days | **-175g** | **100%** (Day **7**) | **0.0%** (85% discount rev < loan interest) | **0%** Strict / **100%** UI |
| **4. Alchemical Industrialist** | **100.0%** | 92 / **92** / 92 days | **-168g** | **100%** (Day **3**) | **0.0%** (Reagent spend + interest drain) | **0%** Strict / **100%** UI |
| **5. Predatory Capitalist** | **100.0%** | 35 / **35** / 38 days | **-1,076g** | **100%** (Day **1**) | **100.0%** (Day **84**, Range `83–89`) | **100%** Strict (Day **84**) / **100%** UI |

### 3.3 Expedition Outcomes, Survival & Faction Loyalty (`360` Rooms per Campaign)

| Strategy | Party Survival Rate (P10 / **P50** / P90) | Traps Triggered (P10 / **P50** / P90) | Mass-Bypassed Plates (P10 / **P50** / P90) | Counters Succeeded (P10 / **P50** / P90) | Sulphur Reaction Failures (P10 / **P50** / P90) | Master Avg Trust (**P50**) | Hero Avg Trust (**P50**) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Balanced Merchant** | 73.3% / **75.6%** / 78.1% | 80 / **89** / 97.1 | 20 / **21** / 23 | 241 / **250** / 259 | 0 / **0** / 0 | **77.9** | **80.1** |
| **2. Dungeon Loyalist** | 68.3% / **70.6%** / 72.8% | 132 / **139** / 146 | 45 / **47** / 49 | 146 / **155** / 164 | 14 / **19** / 23 | **70.5** | **60.2** |
| **3. Hero Benefactor** | 93.6% / **95.0%** / 96.4% | 14 / **19** / 24 | 98.9 / **115** / 133 | 203 / **225** / 243 | 0 / **0** / 4 | **61.7** | **78.1** |
| **4. Alchemical Industrialist** | 88.9% / **92.5%** / 95.0% | 18 / **27** / 40.1 | 135 / **157** / 169 | 159 / **172** / 186 | 0 / **5** / 10 | **64.3** | **72.8** |
| **5. Predatory Capitalist** | 78.3% / **80.8%** / 83.1% | 61 / **69** / 78 | 8 / **11** / 19 | 266 / **277** / 286 | 1 / **2** / 4 | **86.7** | **87.2** |

---

## 4. Phase 4: Proof That Difficulty Is Mechanical (Decision Topology Analysis)

Across the 5,000 campaigns, transitioning from **Region I (Cellar / Easy)** to **Region II (Warrens / Normal)**, **Region III (Blackspire / Hard)**, and **Region IV (Paradox Vault / Expert)** demonstrably alters the mechanical decision topology:

1. **Easy (Cellar) → Normal (Warrens): Introduction of Chemical Interference & Trigger Mass Calibration.**
   - In *The Rat King's Cellar*, standard `45kg Pressure-Plate Spike Batteries` are easily bypassed by `Bantam Chicken-Morph Draughts` (`-65kg` mass shift), and basic antidotes never suffer chemical degradation because no cellar hazard emits `sulphur_fog`.
   - Once *The Gilded Warrens* unlocks, Overseer Grimthorn deploys `Pneumatic Sulphur-Fog Machines` (`emitsSulphurFog: true`) alongside `Cave-Basilisk Lairs` (`causesPetrification: true`), while Bram Iron-Ledger introduces `8kg Quartz-Wire Vitriol Sprayers` (`triggerMassThresholdKg: 8kg`).
   - **Empirical Consequence:** Strategies that continue selling unstabilised cellar antidotes (*Dungeon Loyalist* leaving heroes with default `prod_antidote_unstabilised` or *Predatory Capitalist* brewing unbuffered antidotes on odd days) trigger up to **28 Sulphur Reaction Failures per campaign**, generating `-165g` warranty claims and `-12` Hero Trust blows per incident. Conversely, *Balanced Merchant* and *Hero Benefactor* eliminate sulphur failures (`0` median) by switching to `Calcified Quartz Salt` (`sulphurSensitivity: -75`) and `Charcoal Alchemical Breathers` (`filtersSulphur: true`).
2. **Normal (Warrens) → Hard (Blackspire) & Expert (Vault): Exclusivity Surveillance, Provenance Wax & Arcane/Paradox Payloads.**
   - Repeating the naive tutorial strategy with larger numbers fails in two ways:
     1. Checking `exclusiveDeal: true` while selling to both sides without unlocking Intelligence Tier 1 (`sk_int_2: Wax-Removed Maker Marks` / `secretProvenance: true`) triggers `exclusivityBreachDetected = true` in `simulateRegionExpedition()`, costing `-240g` per day (`28,800g` across 120 days in *Predatory Capitalist*).
     2. In Blackspire and the Paradox Vault, high Detection DCs (`DC 70–94`) defeat basic Scout Perception rolls (`25–75 + 0.25 * caution`), requiring specific chemical/mechanical counter-classes (`disruption`, `filtration`, `resistance`) rather than passive scout perception.

---

## 5. Phase 5: Adversarial Testing & General-Rule Proofs

Eight targeted adversarial tests (`ADV-01` through `ADV-08`) were executed directly against the frozen production code (`src/engine/simulation.ts` and `src/App.tsx`):

| Test ID | Test Name | Status | Empirical Finding & Code Location |
| :--- | :--- | :---: | :--- |
| **`ADV-01`** | **General Mass/Threshold Physics vs Hardcoded Item Name Check** | **`PASS`** | Synthesizing a brand-new potion (`"Generic Grav-Light Draught"`, `massEffectKg = -85kg`) from `Hollow-Bone Marrow Gel (-30kg)` + `Null-Gravity Lodestone Dust (-55kg)`—without using `Cursed Cockatrice Plumage` or any chicken-related ID—shrunk an `84kg` Vanguard to `12kg` and bypassed the `45kg` pressure plate via the general rule `threshold >= 25 && effectiveMass < threshold && morphPotion` (`src/engine/simulation.ts:227`). |
| **`ADV-02`** | **General Stoichiometric Sulphur Sensitivity vs Hardcoded Story Exception** | **`PASS`** | Synthesizing a custom stone-cure with `Brackish Cistern Water (+30)` + `Calcified Basilisk Bile (+88)` + `Chalk-Stone Powder (-15)` yielded `netSulphurSens = 138 > 25` (`sulphurVulnerable: true`), triggering `REACTION_FAILURE` in Sulphur Fog. Substituting `Shadow-Silk Osmotic Patch (-50)` + `Double-Strength Chelating Matrix (-100)` yielded `netSulphurSens = -17 <= 25` (`sulphurVulnerable: false`), succeeding with `COUNTER_SUCCEEDED` (`src/engine/simulation.ts:28,240`). |
| **`ADV-03`** | **Seed + Action Log Byte-Identical Determinism Audit** | **`DEFECT_FOUND`** | `simulateRegionExpedition()` is 100% deterministic and byte-identical across repeated runs of the same seed (`Seed 20260042` produced identical `+31,891g` Net Worth and room logs). However, `synthesizeAlchemyProduct()` (`simulation.ts:85`) and `assembleTrapProduct()` (`simulation.ts:159`) assign `id: prod_custom_alc_${Date.now()}_${Math.floor(Math.random() * 1000)}`, violating strict byte-identical ID generation unless overridden with a seeded hash. |
| **`ADV-04`** | **Cash Floor Bailout (`120g`) & Infinite Debt Rollover Exploit** | **`DEFECT_FOUND`** | `src/App.tsx:397` computes `endingCash = Math.max(120, prev.gold - overheadAndStorage - warrantyClaims - fines - interest)`. When daily interest (`5%/day` on Bridge Debt) + overhead + fines exceed cash, raw cash goes negative (e.g. `-1,076g` in *Predatory Capitalist*), but the `120g` floor absorbs the loss for free without increasing `debt` or triggering insolvency restructuring. |
| **`ADV-05`** | **Infinite Installed Product Persistence Across Expeditions** | **`DEFECT_FOUND`** | `src/App.tsx:321,333` prepends purchased items to `installedHazards` / `equippedProducts` (up to 3 slots) and never decrements their charges after an expedition. A single `Quartz-Chelated Antidote` sold on Day 1 protects that party in every expedition through Day 120 unless pushed out of the 3-slot array. |
| **`ADV-06`** | **Solo Paradox Catalyst Commission Pre-Seeded Counter Bypass** | **`DEFECT_FOUND`** | `src/App.tsx:124-125` initializes `customBrewsCount = 1` and `customTrapsCount = 1`, and `WorldAndIntelPanels.tsx:365` checks `bilateralSalesCount >= 2` (mapped to `contractHistory.length`). A player can unlock *The Paradox Vault* (Expert) on Day 1 in the Cellar after selling 2 items to the same client. |
| **`ADV-07`** | **Offline Peer Catalyst Regex Forgery vs Local Replay Detection** | **`LIMITATION_CONFIRMED`** | Local replay detection works (`existingLedger.some(e => e.provenanceHash === hashPart)` rejects duplicate hashes). However, `verifyAndParseCatalystCode()` (`simulation.ts:357`) only tests the regex `/^CATALYST-([A-Z0-9]{3,12})-D(\d+)-([A-Z0-9]{6,12})$/` without checking that `hashPart === hashString('PARADOX_CATALYST_' + sender + '_' + day).slice(0,8)`. |
| **`ADV-08`** | **Secret Provenance Fee (`-35g`) Floor Clamp Protection** | **`PASS`** | `unitPrice` is clamped via `Math.max(25, ...)` in `App.tsx:290` and `TradeAndLedgerPanels.tsx:163`, preventing negative contract prices when the `-35g` Null-Wax fee is applied to low-cost items. |

---

## 6. Twelve Verifiable Individual Campaign Stories

Every campaign story below is extracted directly from `campaign_results.csv` and `strategy_comparison.json` and can be reproduced deterministically via `runSingleCampaign(seed, strategy, 120)`:

1. **`BALA_S20260001` (Seed `20260001`, `BALANCED_MERCHANT`) — The Disciplined Bilateral House:**
   - Unlocked *The Gilded Warrens* on **Day 3** via a `3,500g` Bridge Loan (`1,500g` down). Supplied both Dungeon Masters and Adventuring Parties every day (`120` Master contracts + `120` Hero contracts = `79,332g` gross revenue) using stabilised `Quartz-Chelated Antidotes` and `Charcoal Breathers`. Recorded **0 Sulphur Reaction Failures**, **0 Exclusivity Breaches**, **74.4% Party Survival**, and finished with **+10,923g Net Profit** and **+31,891g Terminal Net Worth** (`34,969g` inventory value), though over-manufacturing kept liquid cash at `422g` and prevented paying off the `3,500g` loan principal.
2. **`PRED_S20260001` (Seed `20260001`, `PREDATORY_CAPITALIST`) — High-Leverage Expansion & Exclusivity Fine Spiral:**
   - Unlocked *The Gilded Warrens* on **Day 1** (`3,500g` loan) and unlocked `cheap_credit` first. Charged `125%` list + `exclusiveDeal (+25%)` + `warranty (+12%)`, driving Gross Revenue to **121,875g** and unlocking *Blackspire Labyrinth* (Hard) AND the *Solo Paradox Catalyst* (Expert) on **Day 84** via a `28,000g` Bridge Loan. However, double-dealing without `secret_shipping` triggered **120 Exclusivity Breaches** (`-28,800g` in fines) plus **2 Sulphur Warranty Claims** (`-198g`) and **75,800g in loan interest**, plunging raw cash to `-1,076g` and triggering the `120g` cash bailout floor on **35 days** (Terminal Net Worth: **-12,242g**).
3. **`DUNG_S20260001` (Seed `20260001`, `DUNGEON_LOYALIST`) — The Lethal Sulphur Fortress:**
   - Unlocked *The Gilded Warrens* on **Day 4** and supplied exclusively Dungeon Masters (`54` high-margin contracts, `0` Hero contracts). Armed Overseer Grimthorn and Bram Iron-Ledger with *Pneumatic Sulphur-Fog Machines*, *Cave-Basilisk Lairs*, and *8kg Quartz-Wire Acid Sprayers*. Because heroes never received chelated antidotes or charcoal breathers from the player, expeditions suffered **23 Sulphur Reaction Failures** and **132 Trap Triggers** (driving Party Survival down to **70.6%**). However, single-sided sales volume (`17,243g` revenue) could not cover `11,325g` overhead + `20,475g` loan interest, activating the `120g` bailout floor on **77 days** (Net Worth: **-2,003g**).
4. **`HERO_S20260001` (Seed `20260001`, `HERO_BENEFACTOR`) — The Altruistic Guild Patron:**
   - Sold exclusively to Adventuring Parties at an `85%` fair discount with warranties (`46` Hero contracts, `0` Master contracts). Achieved a remarkable **96.4% Party Survival Rate** (`106` Mass-Bypassed pressure plates, `239` Counter-Succeeded rooms, `0` Sulphur Failures, and `77.4` Hero Trust). Yet selling at an `85%` discount to only one side of the market yielded just `8,116g` revenue against `22,800g` Bridge Loan interest, hitting the `120g` bailout floor on **108 of 120 days** (Net Worth: **-2,439g**).
5. **`ALCH_S20260001` (Seed `20260001`, `ALCHEMICAL_INDUSTRIALIST`) — The Mass-Bypass & Solvent Specialist:**
   - Unlocked `bonus_brew_yield` (3 units/batch) and `chelate_boost` (+20 Stability) first, brewing `Bantam Chicken-Morph Draughts`, `Quartz-Chelated Antidotes`, and dual-use `Rust-Monster Gear Solvent Bombs`. Recorded **169 Mass-Bypassed rooms** and **93.9% Party Survival**, supplying `77` Hero contracts and `16` dual-solvent Master contracts (`17,835g` revenue). High daily reagent procurement + `20,650g` Warrens loan interest triggered the bailout floor on **92 days** (Net Worth: **-3,380g**).
6. **`PRED_S20260007` (Seed `20260007`, `PREDATORY_CAPITALIST`) — Peak Sulphur Warranty Backlash:**
   - Brewed unstabilised *Standard Basilisk Antidotes* on odd days while selling *Pneumatic Sulphur-Fog Machines* to Masters. Triggered **4 Sulphur Reaction Failures** alongside **120 Exclusivity Breaches** (`29,196g` in claims and fines), dropping raw cash to `-1,175g` before the `120g` floor intervened.
7. **`BALA_S20260012` (Seed `20260012`, `BALANCED_MERCHANT`) — Peak Expedition Counter-Success Run:**
   - Achieved **80.0% Party Survival** (`261` Counter-Succeeded rooms, `21` Mass-Bypassed rooms, `0` Sulphur Failures) with `78.8` Master Trust and `80.8` Hero Trust, demonstrating how stabilised bilateral supply keeps both dungeon tourism and party survival healthy.
8. **`ALCH_S20260019` (Seed `20260019`, `ALCHEMICAL_INDUSTRIALIST`) — Zero-Claim Pure Stabilisation Run:**
   - Recorded **0 Sulphur Reaction Failures** and **0g in Warranty Claims** across all 120 days (`95.0%` Party Survival, `167` Mass-Bypassed rooms, `176` Counter-Succeeded rooms), proving that early investment in `chelate_boost` (`sk_alc_3`) completely eliminates sulphuric antidote failure in the Warrens.
9. **`DUNG_S20260025` (Seed `20260025`, `DUNGEON_LOYALIST`) — Maximum Dungeon Lethality Attrition:**
   - Inflicted **146 Trap Triggers** and **23 Sulphur Reaction Failures** across 360 rooms, reducing Party Survival to **68.6%** and driving Hero Trust down to **58.7** while maintaining **70.5** Master Trust.
10. **`HERO_S20260033` (Seed `20260033`, `HERO_BENEFACTOR`) — Near-Flawless Delver Protection:**
    - Achieved **96.7% Party Survival** (`127` Mass-Bypassed pressure plates, `221` Counter-Succeeded rooms, and only `12` Trap Triggers across 360 rooms).
11. **`PRED_S20260038` (Seed `20260038`, `PREDATORY_CAPITALIST`) — Late Hard-Mode Bridge Default:**
    - Delayed Blackspire Bridge Loan until **Day 89** (`minRawCashBeforeFloor: -1,175g`), accumulating `77,200g` in total interest charges and `38` bailout-floor days.
12. **`BALA_S20260040` (Seed `20260040`, `BALANCED_MERCHANT`) — High-Deterrence Bilateral Equilibrium:**
    - Balanced `97` Trap Triggers with `241` Counter-Succeeded rooms and `22` Mass-Bypassed rooms (`73.3%` Party Survival, `+31,891g` Net Worth), keeping both Overseer Grimthorn and the Silver Stag Company solvent and actively trading through Day 120.

---

## 7. Recommended Post-Freeze Engineering Fixes (Prioritised)

To move the verdict from **`HOLD`** to **`PASS`** in `SIM-002`, apply the following targeted fixes to the production codebase:

1. **Fix `DEFECT-01` (Loan Interest Rate & Cash Bailout Floor in `src/App.tsx:396-397`):**
   - Reduce Dwarven Bridge Loan interest from `5% per day` (`0.05`) to `0.5% per day` (`0.005`), and automatically amortize `10%` of positive daily net profit toward principal repayment.
   - Remove the silent `Math.max(120, ...)` bailout floor; instead, if cash drops below `0g`, capitalize the deficit into `debt` up to a credit limit (`5,000g` per unlocked region) or trigger formal Insolvency Restructuring.
2. **Fix `DEFECT-02` (Deterministic Product IDs in `src/engine/simulation.ts:85,159`):**
   - Replace `Date.now()` and `Math.random()` in `synthesizeAlchemyProduct()` and `assembleTrapProduct()` with a deterministic content hash (`hashString(defaultName + all.map(x => x.id).join('_'))`).
3. **Fix `DEFECT-03` (Solo Paradox Catalyst Pre-Seeded Counter Bypass in `src/App.tsx:124-125`):**
   - Initialize `customBrewsCount = 0` and `customTrapsCount = 0`, and require `unlockedRegions.includes('blackspire')` plus at least 1 Master sale AND 1 Hero sale before enabling `onClaimSoloDmCatalyst`.
4. **Fix `DEFECT-04` (Consumable Depletion in `src/App.tsx:401-425`):**
   - Consume the oldest equipped potion/hazard after each expedition unless a Reset/Preservation module retains it, creating genuine recurring restock demand and preventing warehouse over-accumulation.
5. **Fix `DEFECT-05` (Cryptographic Signature Check in `src/engine/simulation.ts:357`):**
   - Verify `hashPart === hashString('PARADOX_CATALYST_' + sender + '_' + dayStr).slice(0, 8)` inside `verifyAndParseCatalystCode()`.
