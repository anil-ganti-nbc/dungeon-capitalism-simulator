# Checkpoint004: player forecast honesty

Bounded initial slice on local hermes/forecast-uncertainty, based on published29ed6aec27a6ad692c2b87ae1f4e2886a4d1a02c. The original bible asks for demand forecasts with uncertainty (section3/Warrens), inspectable incomplete intelligence (Vault), known facts distinguished from rumours (daily loop), and actual seeded causal reports after expeditions (6.4). No new scouting/learning progression is implemented here.

## Knowledge boundary

Before commitment, the Arena shows current recorded party members/mass/health, current equipment, installed loadout slots and their trigger rules/DC/potency/paid reset reserve. These are already inspectable client/catalogue facts, not room discoveries. Loadout slots are not labelled predicted chambers. Conditional heuristic guidance calls out morph/inversion compatibility, vulnerable antidotes with fog and absent petrification protection where applicable, and two-sided commercial trade-offs. It supplies no calibrated probabilities or numerical profit ranges.

Only after the real expedition do actual room order/events, resolved detection, damage, loot, casualties, discovery and learned renewal facts appear. The existing seeded diagnostic predictExpeditionForecast API is preserved byte-for-byte for internal diagnostics/tests, but App no longer imports it. The second oracle path was App's unresolved activeCanvasReport fallback; it is removed too. The canvas accepts null before any report and remains an empty replay stage. When history exists, replay always uses the latest completed report and labels its day/region/participants explicitly, even if the next selection or later sales differ. Archived reports are never rewritten as forecasts.

No simulator/RNG, economy, renewal/payment/validation, save schema, skill or balance code changes. No new save fields, resources, learned evidence, content families or art assets.

## Implementation scope

- src/engine/expeditionScouting.ts: pure known-input snapshot and qualitative conditions, no seed/day/contracts/RNG/simulator input.
- src/components/ExpeditionScoutingPanel.tsx: wrapped text (16px Normal; existing .text-base XLARGE rule yields25px with20px root), separate facts/guidance/unknowns, no new interaction controls.
- src/App.tsx: route player preview to snapshot; completed-only replay rather than simulation fallback.
- scripts/forecast-uncertainty.test.ts and forecast-browser.ts: new own tests, old assertions untouched.
- package.json: append own unit node entrypoint and test:forecast script.

Executable unit: concrete Node24 -> node_modules/tsx/dist/cli.mjs --test scripts/forecast-uncertainty.test.ts.
Executable browser: concrete Node24 -> node_modules/tsx/dist/cli.mjs scripts/forecast-browser.ts, TEST_URL=http://127.0.0.1:4520 and fresh absolute EVIDENCE_DIR. MODE=before captures the baseline oracle; default runs375/412 ×Normal/XLARGE. Service workers blocked for this targeted production UI test, not offline qualification.

## Fixed execution budget and limits

One bounded initial implementation/self-test delivery, then at most ONE review-driven repair pass if parent requests it. No automatic recursive repair/refactoring. Further bugs become an explicit Anil-inspection backlog, with failed evidence retained and no known failed gate called green. No full300-campaign rerun: numerical execution is unchanged; parent decides integrated qualification. No new art production, Android, 200%-rem, calibrated economics, intelligence progression or whole-game acceptance is claimed.
