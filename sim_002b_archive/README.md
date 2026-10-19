# SIM-002B foundation handoff

**SELF-TESTED / INDEPENDENT ACCEPTANCE PENDING. Release recommendation: HOLD.**

Implements issue #2 from frozen `c45f33e143f71acd7a66edacf773161fb4b9416f`.
Gameplay source verified at published commit `be2608c930bd6ba9e846ae0d35bba8ac066c9c16`, tree `001ad0425f51dbe234a980a5c73af412b31b976d`. Subsequent handoff changes add evidence, test coverage and CI commands; they do not change production gameplay.

## Implemented contracts

- Daily market `market-v1` hashes simulation rules / seed / day / region into a separate RNG stream. Quotes, actual trades, contract history and financial records use the same context. Callers cannot inject a market factor. The trade desk displays it.
- UI and runner share immutable validated sales, including phase and scheduled-client updates. Rejection changes no authoritative state. Trading is **regional only** and requires an unlocked active region. Hero capacity is four individual charges; master capacity is three individual installations. A full loadout refuses purchase before payment, with the shared refusal reason displayed verbatim. No silent replacement/reserve was added.
- One fresh-state factory uses the former runner baseline: nine finished SKUs, first 20 reagent types ×3, first 20 part types ×2, two skill points and canonical client schedules. Existing saves retain stock, money, contracts and progression. Missing historical catalogue definitions are restored with **zero shop stock** only when an existing installation references them.
- Save version `2.1.0-sim002b` validates nested stats, arrays, IDs, schedules, counters, skills, financial records and version. Recovery precedence is primary → current v2 backup → historical `trap_and_tonic_backup_v2` → v1 backup → v1 primary. Safely repairable old schedules/new optional fields migrate; damaged gameplay stats are rejected. Rejected text and original checkpoint snapshots are retained under content-addressed storage keys. Failed validation/write cannot rotate corrupt text into a healthy fallback. If all checkpoints fail, autosave pauses until explicit reset/import. Recovery source/day is visible. JSON imports use the same validation policy.
- Runner-only paid equipment grants and casual-peer Expert bypass are removed. Solo courier eligibility and state transition are shared with the UI; policies may still choose when to claim it. Native masonry remains separate from paid SKUs.
- Workshop and live raids share the mass predicate: inversion triggers below 25kg and is bypassed at 25kg or above. Each newly paid temporal installation carries **one** slot-aligned rewind charge. At an ordinary wear-removal event it spends that charge and retains the installation; the next removal exhausts it normally. A new purchase replenishes a charge. Historical installed traps migrate to zero unprovable remaining charges. The existing auto-reset skill still prevents ordinary wear; this packet does not redesign that skill.
- The existing 2D canvas has bounded pointer pan with matching keyboard controls. Full-width room geometry, separate-flow HUD and portrait wrapping replace overlapping tiny rooms and clipped core controls. Detailed causal room text remains available below the canvas. Forecast determinism/design is unchanged.

## Verification and reproduction

Node 24.18.0 / npm 11.16.0 / Vite 8.3.4; Windows Edge 155 with Playwright 1.62.1. Lockfile install needs no peer override or undeclared dependency. Local clean installation used `npm ci --ignore-scripts`; GitHub Linux CI runs ordinary `npm ci`. `workbox-window` is declared and esbuild satisfies Vite's peer range.

```sh
npm ci
npm run lint
npm test
npm run build
# In separate terminals:
npm run dev -- --host 127.0.0.1 --port 4178
npm run preview -- --host 127.0.0.1 --port 4179
# Install the browser once:
npx playwright install chromium
npm run test:browser
npm run test:negative
npm run test:offline
npx tsx scripts/run_sim_002b.ts
```

Set `BROWSER_PATH` to an installed Chromium executable if necessary. `EVIDENCE_DIR` selects a new browser-evidence destination; `CAMPAIGN_DIR` selects a new campaign destination. The campaign generator refuses to overwrite an existing CSV. CI uploads browser evidence and the newly generated 5,000-campaign archive.

- 11 hard assertion suites, including 60 populated fresh runner traces before daily clearing.
- Historical f368 suite **60/60**, historical c45 suite **60/60**, captured actual UI-input suite **60/60**: 381 attempted sales through real stock-card controls. Full before / quote / expected result / actual after / diff records are in three compressed replay files. Quote/refusal, budgets, trust, cash/debt, stock, charges, contracts and schedule are compared. Migration is applied identically before each diagnostic fixture replay.
- The negative control changes a real compared quote by +1g. The comparison exits **1**; a separate verifier asserts that failure and records the original/mutated price and actual button text.
- Original Day-5 v2 backup recovery, v1 preservation, nested corruption, refused import, interrupted writes, five-dose refusal, 50 runner and 10 UI no-purchase raids, finite reset/reload/exhaustion.
- Real CDP touch drags at 375×812 and 412×915 in Normal/XLARGE: camera X **284→140**, main scrollLeft **0→0**; main scrollWidth equals clientWidth; header/core controls measured inside viewport. Actual touch navigation, brewing and assembly included. Four short screenshot clips and raw frames accompany measurements.
- Network blocked before closing and before navigating in a new browser process; production service worker restored the exact ledger. No page or console errors in the successful foundation run.

Fixtures copied from historical Codex evidence are labelled diagnostics; originals were not edited. Neither simulated campaigns nor builder browser automation constitute an independent gameplay/enjoyment review.

## Remaining concerns and review request

- **Dungeon-only policy: 1,000/1,000 insolvent campaigns.** Finite customer slots fill, and permanent reset installations remove recurring trap demand. Median revenue 4,878g versus median profit −7,317g over 120 days. This is a consequential business-design/policy failure revealed by honest conservation. No implicit subsidy or balance workaround was reinstated. Review paid replacement/reserve semantics or policy/product lifecycle in a separately scoped design decision.
- Predatory policy: 857/1,000 insolvent; median profit 2,813.5g. These are strategy-policy results, not proof of player-level viability. Hero-only and dungeon-only policies do not satisfy the bilateral solo Expert commission.
- Headless strategy preparation, financing choices and progression timing are policy models. This packet proves commercial command parity, not whole-campaign UI equivalence.
- Physical Android, APK install, native keyboard/file pickers, OS-kill recovery and device performance: **NOT TESTED**. No measured FPS certification.
- Deterministic exact forecasting remains as requested; its strategic effect needs a separate product decision.

Argon/operator review requested for recovery/migration choices, one-charge temporal semantics, mobile measurements and the specialist economy. Keep issue #1 open for fresh independent acceptance. Do not self-approve or merge on the strength of this builder report.

Full datasets, 381 action-state comparisons, recovery storage snapshots, screenshots, gesture clips, exact command exit codes and hashes are delivered in the separate SIM-002B builder evidence ZIP. The adjacent report and manifest identify the tested commit and data checksums; scripts reproduce the full archive without touching SIM-001 or previous SIM-002 results.
