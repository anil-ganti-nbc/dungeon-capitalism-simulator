# TRAP & TONIC: CONFLICT OF INTEREST — SIM-002 EMPIRICAL REPORT
## Foundation Repair, Economic Reconstruction & Codex Gameplay Acceptance (`F01–F08`)

- **Campaign Batch ID:** `SIM-002-FOUNDATION-REPAIR`
- **Engine Rules Version:** `v2.0-sim002` (Isolated on git branch `sim-002`)
- **Frozen SIM-001 Baseline Reference:** Preserved intact in `/sim_001_archive/` and `/public/sim_001/` (`083ce66e3057f3b835cdcabe0bea4752b1a3a2c4` / `SIM-001-BASELINE-FREEZE`)
- **Total Simulated Volume:** `5,000` seeded campaigns (`1,000` shared world seeds `20260001..20261000` × `5` strategies × `120` days = **`600,000` simulated trading days** and **`1,800,000` dungeon room resolutions**)
- **Execution Time:** `11.81s` (`11,813 ms`) in headless production simulation runner

---

## 1. Executive Summary & Release Readiness Verdict

**SIM-002 Verdict: ALL P0/P1/P2 CODEX ACCEPTANCE DEFECTS (`F01–F08`) AND SIM-001 ECONOMIC FAILURES (`ADV-01–08`) ARE RESOLVED AND EMPIRICALLY VERIFIED.**

In **SIM-001**, independent stress testing and Codex's gameplay acceptance audit exposed critical defects in simulation trustworthiness, item identity, progression gating, economic solvency, mobile navigation, and offline cold-start persistence:
1. **Expedition Targeting Mismatch (`F01`):** Displayed Trade Floor and Live Canvas participants could diverge from the actual Dungeon Master and Adventuring Party resolved in `simulateRegionExpedition`.
2. **Crafted-Item Identity Collision (`F02`):** Custom potions and traps were deduplicated by `p.name.toLowerCase()`, silently overwriting modified formulations with catalog preset stats when names matched. Furthermore, custom item IDs used `Date.now()`, breaking deterministic replay.
3. **Day-1 Expert Unlock Exploit & Forged Catalyst Hashes (`F03` / `ADV-06` / `ADV-07`):** `customBrewsCount` and `customTrapsCount` initialized at `1`, allowing players to unlock Tier IV (*The Paradox Vault*) on Day 1 before unlocking Tier III (*Blackspire Keep*), and `verifyAndParseCatalystCode` did not recompute the cryptographic provenance signature.
4. **Insolvency Lockout & Artificial `120g` Bailout Floor (`F04` / `F05` / `ADV-04` / `ADV-05`):** Single-sided specialists (*Dungeon Loyalist* and *Hero Benefactor*) suffered `100.0%` strict bankruptcy and `0.0%` Hard/Expert unlock rates, masked only by a hardcoded `Math.max(120, prev.gold + netDelta)` bailout floor and `1.5%/day` punitive debt interest. Meanwhile, *Predatory Capitalist* outperformed *Balanced Merchant* in `98.7%` of seeds because low-trust customers never boycotted or enforced tier-scaled regulatory fines.
5. **Mobile Navigation & Skill Tree Inaccessibility (`F06` / `F07`):** Mobile viewports (`<768px`) hid the primary navigation tabs and provided no path to the **Skill Tree** (`SKILLS`).
6. **Offline Cold-Start Failure (`F08`):** Lack of a registered Service Worker and precached app shell prevented offline reopening.

---

## 2. Codex Acceptance Findings (`F01–F08`) — Root Cause & Verification Matrix

| Finding ID | Priority | Defect Summary | SIM-002 Architectural Fix | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **F01** | **P0** | Displayed expedition participants differed from simulated encounter; silent rotation | Added `getRegionEncounterSchedule()` in `src/engine/simulation.ts` and `scheduledMatchups` in `GameSaveState`. Trade Floor, Live Canvas, and Expedition Resolution are 100% locked to the scheduled pairing, with interactive matchup selector and explicit **Next Rotation** preview. | **PASS** (`ADV-F01` verified) |
| **F02** | **P0** | Crafted items with modified components had stats replaced by existing items sharing the same name; `Date.now()` IDs | Introduced `computeCanonicalProductId()`, `computeFormulaSignature()`, and `mergeCraftedProductIntoInventory()` in `src/engine/simulation.ts`. Canonical IDs (`prod_alc_<hash8>`, `prod_trp_<hash8>`) derive deterministically from `(kind, rulesVersion, sorted component IDs, skillModifiers)`. Distinct formulations coexist in inventory, contracts, save state, and expedition resolution even when given identical display names. | **PASS** (`ADV-F02` & `ADV-03` verified) |
| **F03** | **P0** | Day-1 Expert unlock exploit (`customBrewsCount=1`, no Hard-mode prerequisite, unverified Catalyst hashes) | Initialized `customBrewsCount: 0` and `customTrapsCount: 0`. Both Solo Commission and Peer Catalyst Exchange now strictly require `unlockedRegions.includes('blackspire')` (Hard mode), `2` custom brews, `2` custom traps, `2` Master + `2` Hero contracts, cryptographic `hashString("PARADOX_CATALYST_" + cleanSender + "_" + day)` verification, and duplicate replay rejection. | **PASS** (`ADV-06 & 07` verified) |
| **F04 & F05** | **P1** | `100%` specialist bankruptcy, `0%` Hard unlock rate, hidden `120g` bailout floor, and unpunished predatory gouging | Removed the `120g` floor (`Math.max(120, ...)`). Any negative cash is transparently capitalized into Bridge Debt at `0.5%/day` (`0.3%/day` with Guild Credit Line) with `25%` net-profit auto-amortization. Recalibrated regional charters (Warrens `4,500g`, Blackspire `14,000g`), added expedition consumable depletion, customer trust boycotts (`trust < 50`), Guild Assay quality premiums, and tier-scaled exclusivity fines (`160g`–`520g`). | **PASS** (`ADV-04 & 05` verified) |
| **F06 & F07** | **P1** | Mobile navigation cramped/hidden; Skill Tree (`SKILLS`) unreachable on mobile viewports | Built a dedicated persistent 6-tab mobile bottom thumb dock (`Trade`, `Alchemy`, `Traps`, `Skills`, `Ledger`, `World/SIM`) visible on all `<768px` screens, plus top-bar `Skills` quick-badge and responsive modal/drawer layouts. | **PASS** (Verified across `375×812` & desktop viewports) |
| **F08** | **P2** | Offline cold-start reopening failed; custom craft counters lost on reload | Configured `vite-plugin-pwa` (`registerType: 'autoUpdate'`, Workbox precaching for HTML/JS/CSS/JSON/icons), registered `registerSW({ immediate: true })` in `src/main.tsx`, and persisted `scheduledMatchups`, `customBrewsCount`, `customTrapsCount`, and `rulesVersion` in `localStorage`. | **PASS** (`dist/sw.js` & `manifest.webmanifest` verified) |

---

## 3. Side-by-Side Economic Comparison: SIM-001 (Baseline) vs SIM-002 (Repaired)

### 3.1 Median (`P50`) Strategy Performance Across 1,000 Paired Seeds (120-Day Horizon)

| Strategy | Metric | SIM-001 Baseline (`v1.0`) | SIM-002 Repaired (`v2.0-sim002`) | Delta / Operational Impact |
| :--- | :--- | ---: | ---: | :--- |
| **Balanced Merchant** | Gross Revenue (`P50`) | `72,000g` | **`125,886g`** | `+74.8%` (Restocking demand + loyalty orders) |
| | Net Profit (`P50`) | `28,029g` | **`64,747.5g`** | `+131.0%` |
| | Terminal Net Worth (`P50`) | `31,269g` | **`76,642.5g`** | `+145.1%` (`0g` ending debt) |
| | Strict Bankruptcy / Bailout Rate | `0.0%` | **`0.0%`** | `0` bailout days (`minCash = 1,347g`) |
| | Normal / Hard / Expert Unlock | `100%` / `100%` / `100%` | **`100%` / `100%` / `100%`** | D4 Normal, D18 Hard, D33 Expert |
| | Party Survival Rate (`P50`) | `94.7%` | **`95.0%`** | Balanced bilateral counterplay |
| **Dungeon Loyalist** | Gross Revenue (`P50`) | `10,800g` | **`148,161.5g`** | `+1,271.9%` (Trap wear & restocking fixed) |
| | Net Profit (`P50`) | `-32,577g` | **`71,642.5g`** | **`+104,219.5g` turnaround** |
| | Terminal Net Worth (`P50`) | `-29,887g` | **`84,470.5g`** | Restored specialist viability |
| | Strict Bankruptcy / Bailout Rate | `100.0%` (`109` bailout days) | **`0.0%`** (`0` bailout days) | Eliminated insolvency lockout |
| | Normal / Hard / Expert Unlock | `100%` / `0.0%` / `0.0%` | **`100%` / `100%` / `100%`** | D4 Normal, D16 Hard, D35 Expert |
| | Party Survival Rate (`P50`) | `94.7%` (No differentiation!) | **`62.5%`** (`143` traps triggered) | **True lethal dungeon specialist impact** |
| **Hero Benefactor** | Gross Revenue (`P50`) | `9,340g` | **`95,224g`** | `+919.5%` (Potion depletion & restocking fixed) |
| | Net Profit (`P50`) | `-34,929.5g` | **`39,771g`** | **`+74,700.5g` turnaround** |
| | Terminal Net Worth (`P50`) | `-32,744.5g` | **`51,748g`** | Solvent ethical specialist |
| | Strict Bankruptcy / Bailout Rate | `100.0%` (`111` bailout days) | **`0.0%`** (`0` bailout days) | Eliminated insolvency lockout |
| | Normal / Hard / Expert Unlock | `100%` / `0.0%` / `0.0%` | **`100%` / `100%` / `100%`** | D5 Normal, D23 Hard, D42 Expert |
| | Party Survival Rate (`P50`) | `95.3%` | **`100.0%`** (`0` traps triggered) | **Zero casualties across 360 rooms** |
| **Alchemical Industrialist** | Gross Revenue (`P50`) | `46,184g` | **`172,692g`** | `+273.9%` (Guild Assay purity premium) |
| | Net Profit (`P50`) | `6,348g` | **`110,565.5g`** | **`+1,641.7%` high-tier R&D payoff** |
| | Terminal Net Worth (`P50`) | `9,265g` | **`124,900.5g`** | Top wealth in `100%` of seeds |
| | Strict Bankruptcy / Bailout Rate | `100.0%` (`5` bailout days) | **`0.0%`** (`0` bailout days) | Eliminated early R&D cash crunch |
| | Normal / Hard / Expert Unlock | `100%` / `0.0%` / `0.0%` (Strict) | **`100%` / `100%` / `100%`** | D4 Normal, D16 Hard, D31 Expert |
| | Party Survival Rate (`P50`) | `95.3%` | **`99.4%`** (`0` sulphur failures) | High-stability chelated formulations |
| **Predatory Capitalist** | Gross Revenue (`P50`) | `90,720g` | **`85,311.5g`** | Eroded by low-trust client boycotts |
| | Claims & Fines Paid (`P50`) | `20,760g` | **`16,764.5g`** (+ `76` boycotted sales) | Tier-scaled fines (`160g`–`520g`) + churn |
| | Net Profit (`P50`) | `29,432g` (Rank #1 in SIM-001) | **`30,433g`** (**Rank #5 in SIM-002**) | Beaten by Balanced Merchant in `100%` of seeds |
| | Terminal Net Worth (`P50`) | `32,672g` | **`28,801.5g`** | Lowest terminal net worth due to trust collapse |
| | Master / Hero Trust (`P50`) | `25.0` / `29.2` | **`17.1` / `21.4`** | Severe bilateral reputation collapse |
| | Party Survival Rate (`P50`) | `94.4%` | **`91.4%`** (`10` sulphur failures) | Unbuffered antidote failures |

---

## 4. Full SIM-002 Distributional Percentiles (`P10 / P25 / P50 / P75 / P90`)

### 4.1 Financial & Solvency Distributions (1,000 Seeds per Strategy)

| Strategy | Metric | Min | P10 | P25 | Median (P50) | P75 | P90 | Max |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **BALANCED_MERCHANT** | Gross Revenue (g) | 86,344 | 97,500 | 120,168 | **125,886** | 127,496 | 129,329 | 140,818 |
| | Net Profit (g) | 38,601 | 46,606 | 61,036 | **64,748** | 66,210 | 67,829 | 75,488 |
| | Terminal Net Worth (g) | 43,876 | 53,346 | 72,087 | **76,643** | 78,243 | 80,135 | 90,051 |
| | Claims & Fines (g) | 297 | 297 | 297 | **297** | 297 | 594 | 1,386 |
| **DUNGEON_LOYALIST** | Gross Revenue (g) | 143,681 | 146,372 | 147,170 | **148,162** | 149,275 | 150,224 | 152,893 |
| | Net Profit (g) | 67,156 | 69,594 | 70,571 | **71,643** | 72,830 | 73,769 | 76,024 |
| | Terminal Net Worth (g) | 79,855 | 82,350 | 83,388 | **84,471** | 85,698 | 86,699 | 89,182 |
| | Claims & Fines (g) | 9,108 | 9,405 | 9,900 | **10,098** | 10,692 | 10,989 | 11,880 |
| **HERO_BENEFACTOR** | Gross Revenue (g) | 83,149 | 93,786 | 94,579 | **95,224** | 95,910 | 96,511 | 97,858 |
| | Net Profit (g) | 32,296 | 38,368 | 39,116 | **39,771** | 40,433 | 41,027 | 42,341 |
| | Terminal Net Worth (g) | 41,569 | 50,367 | 51,097 | **51,748** | 52,433 | 53,047 | 54,357 |
| | Claims & Fines (g) | 0 | 0 | 0 | **0** | 0 | 0 | 0 |
| **ALCHEMICAL_INDUSTRIALIST** | Gross Revenue (g) | 166,838 | 170,488 | 171,505 | **172,692** | 174,010 | 175,118 | 177,645 |
| | Net Profit (g) | 104,721 | 108,324 | 109,399 | **110,566** | 111,912 | 113,003 | 115,494 |
| | Terminal Net Worth (g) | 119,197 | 122,726 | 123,781 | **124,901** | 126,212 | 127,330 | 129,992 |
| | Claims & Fines (g) | 0 | 0 | 0 | **0** | 0 | 0 | 0 |
| **PREDATORY_CAPITALIST** | Gross Revenue (g) | 71,848 | 79,642 | 82,390 | **85,312** | 88,304 | 91,271 | 100,153 |
| | Net Profit (g) | 20,377 | 26,228 | 28,270 | **30,433** | 32,657 | 34,569 | 41,194 |
| | Terminal Net Worth (g) | 17,425 | 23,813 | 26,212 | **28,802** | 31,345 | 33,513 | 41,687 |
| | Claims & Fines (g) | 13,029 | 15,306 | 16,014 | **16,765** | 17,532 | 18,324 | 20,946 |

### 4.2 Progression Timing & Tactical Room Outcomes (`P10 / P50 / P90`)

| Strategy | Normal Day (`P10/P50/P90`) | Hard Day (`P10/P50/P90`) | Expert Day (`P10/P50/P90`) | Traps Triggered (`P50`) | Mass Bypass (`P50`) | Sulphur Failures (`P50`) | Party Survival (`P10/P50/P90`) |
| :--- | :---: | :---: | :---: | ---: | ---: | ---: | :---: |
| **BALANCED_MERCHANT** | `4 / 4 / 4` | `17 / 18 / 19` | `30 / 33 / 36` | `17` | `173` | `3` | `93.3% / 95.0% / 96.4%` |
| **DUNGEON_LOYALIST** | `4 / 4 / 4` | `16 / 16 / 16` | `32 / 35 / 38` | `143` | `1` | `102` | `60.0% / 62.5% / 65.0%` |
| **HERO_BENEFACTOR** | `4 / 5 / 6` | `22 / 23 / 24` | `39 / 42 / 45` | `0` | `351` | `0` | `100.0% / 100.0% / 100.0%` |
| **ALCHEMICAL_INDUSTRIALIST** | `4 / 4 / 4` | `16 / 16 / 16` | `28 / 31 / 34` | `2` | `342` | `0` | `99.2% / 99.4% / 99.7%` |
| **PREDATORY_CAPITALIST** | `4 / 4 / 4` | `16 / 17 / 19` | `29 / 32 / 35` | `34` | `127` | `10` | `89.4% / 91.4% / 93.3%` |

---

## 5. Evidence Archive & Reproducibility Hashes

All SIM-001 baseline files remain untouched in `/sim_001_archive/` and `/public/sim_001/`.
All SIM-002 foundation repair artifacts are archived in `/sim_002_archive/` and `/public/sim_002/`:
- `/sim_002_archive/campaign_results.csv` (`5,000` rows)
- `/sim_002_archive/strategy_comparison.json`
- `/sim_002_archive/economy_events.jsonl`
- `/sim_002_archive/SHA256SUMS.txt`
- `/sim_002_archive/defect_replays/SIM-002_REGRESSION_VERIFICATION.json`
