# Paid selected-slot installation replacement — checkpoint 002

## Scope and ownership

Hermes develops directly; no Codex actor or replacement worker is involved. The development branch is `hermes/paid-installation-replacement`, based on `1be1732738dcf14db1f70804887d1143afe13e33`, carrying the preserved checkpoint-001 changes. Anil separately authorised publishing the latest developments to GitHub; that does not authorise merge/release or art production, nor establish Android qualification. This is self-tested work, not a new independent verdict. See [checkpoint status](CHECKPOINT_002_STATUS.md).

This package implements the **transaction and usable UI** portion of `RENEWAL_ECONOMICS.md`. It does not implement observation-driven upgrade appetite or modify any campaign strategy. Availability of an explicit paid command is not proof of profitable or engaging Loyalist play.

## Transaction contract

- `computeInstallationReplacementQuote(state, request, terms)` is a pure preview; it returns acceptance/reason/price, never a state to install.
- `executeInstallationReplacement(state, request, terms, expectedUnitPrice)` is the shared pure command used by the real UI and headless proofs. Ordinary sales still refuse full loadouts and never evict a slot implicitly.
- Select a real occupied zero-based slot. Bind its exact product ID/reset reserve, current day and current contract count. Any stale binding refuses without returning a contract/state. A repeated accepted command cannot run twice against its successor state.
- All slots must retain valid product definitions and slot-aligned 0/1 temporal reserves. Refuse corrupt capacity/resources rather than repairing by truncation.
- The replacement must have different currently resolved installation mechanics. Merely changing name, price or canonical ID does not qualify; rebuying the same SKU is refused. This package is not a paid rearming service for an identical temporal trap.
- Different need not mean universally stronger. Deliberate sidegrades/downgrades remain possible; the interface explicitly does not promise improved results. Mechanical distinctness is not an authenticated buyer need or infinite upgrade demand.
- Delegate stock, audience, unlocked/current region, budget, boycott, markup, trust, warranty/exclusivity/provenance, schedule and ordinary contract accounting to the unchanged sale function. Temporarily excluding only the selected slot is a private immutable calculation, not an intermediate persisted save.
- Bill exactly one new unit, consume one shop unit, preserve existing production cost as COGS and preserve all other stock/client/skill records. No additional invented upgrade fee or subsidy is introduced.
- Retire the selected old installation and its unused reserve permanently, with no refund, salvage or stock return. Install the new paid product **at that same index**. New temporal products bring one paid reserve; other new products bring zero. Neither reserve is transferred or cloned.
- Bind the displayed price at commit and refuse unsafe integer-currency quotes. A changed price requires a new review, not silent repricing.

The implementation composes the existing sale instead of introducing a second pricing or financial model. No physics, wear, cam skill, progression, overhead, initial budgets, difficulty rules or catalogue content are rebalanced.

## Receipt and compatibility

Each new contract optionally includes `installationReplacement`: slot index, retired product ID/name and retired reset reserve. Both daily and full contract histories receive the same receipt. Client text memory records the retirement and no-refund rule. New metadata is validated before import or checkpoint rotation: invalid slot, buyer, SKU, name or reserve is rejected. Older receipts without the optional field remain valid; no persistence version/rules-version bump is needed for this additive command/receipt, and existing expedition resolution remains unchanged.

The trade desk shows same-day replacement receipts after payment/reload. Full history persists in the saved/exported contract history after the day advances; a dedicated multi-day graphical receipt browser is not added here. Save provenance is not a cryptographic claim that an offline user cannot edit/copy their own save.

## UI

In the existing Bilateral Desk master column: select occupied slot, select a stocked new build, inspect old/new identities/stats/reserves, then **Review replacement**. Review/cancel never buys. The separate confirmation names the master, slot, old/new products, exact price, bound terms and permanently retired reserve, with explicit no-refund/salvage warning. A day/client/contract change remounts the selection; the engine also revalidates at commit. The normal sale buttons are unchanged.

New controls have labels, full wrapping summaries and minimum 44px control height. Portrait automation uses genuine emulated touch events for buttons but programmatic browser option selection, not native Android picker interaction. Functional controls use existing styling; no A/A0 asset production is undertaken.

## Executable qualification contract

Canonical commands after the existing lockfile installation and matching Node 24:

```text
npm run lint
npm test
npm run build
npm run test:replacement
```

`npm test` includes the unchanged original foundation/remediation tests, checkpoint-001 authored-count test and the added replacement tests. `npm run test:replacement` runs the rendered replacement proof; `TEST_URL`, `BROWSER_PATH` and `EVIDENCE_DIR` are configurable. Existing browser/negative/offline commands remain required preservation gates. CI is wired to run the new desktop browser proof and upload its JSON/PNG; no remote CI execution is claimed for unpushed files.

Useful variants (set environment before the command, using the shell's syntax):

- `REPLACEMENT_WIDTH=375` or `412`: portrait touch buttons; default desktop is 1440.
- `REPLACEMENT_XLARGE=1`: enable the actual XLARGE accessibility control.
- `REPLACEMENT_COLD=1`, portrait width, production `TEST_URL`: buy through the UI, prove uncached fetch refusal, close the persistent browser process, reopen the same owned profile with networking restricted **before navigation**, then require complete paid-state and receipt preservation plus a second uncached fetch refusal.
- Use a distinct evidence directory for every invocation. Generated diagnostic profiles contain only synthetic test state, never the user's normal browser profile.

Required proofs: exact selected-slot conservation across all three slots; immutable preview/review/cancel; current quote/command and complete UI/headless state parity; replay/stale/budget/stock/audience/regional/invalid-resource refusal; malformed receipt rejection and legacy compatibility; one-use temporal depletion; cam +12 for newly built stock with old stock unchanged; existing global wear immunity including warranty and reserve retention; an actual UI expedition using the selected new hazard; desktop/375/412 normal and XLARGE layouts; paid-state production offline cold reopen; all original foundation gates preserved.

## Economic boundary and next causal slice

The original five campaign policies do not call this command yet. A new 100-campaign/120-day diagnostic and the two 30-day reset controls match checkpoint 001 exactly, including 20/20 sampled Loyalist insolvency. That is preservation of the untreated control, **not an improvement measurement**. Next: derive structured, bounded replacement offers from actual prior encounter evidence, expose their provenance and trade-offs, then make explicit policies issue this same command and compare identical seeds against the retained untreated baseline. Do not inflate renewal by blind A→B→A purchases or declare all faction strategies viable from a finite sample.

Physical Android installation, native lifecycle/OS kill, APK, device FPS, full content integration, human enjoyment and fresh independent review remain unproven. The production bundle also emits Vite's >500kB chunk warning; build success is not device performance acceptance.
