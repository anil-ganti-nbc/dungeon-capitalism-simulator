# Loyalist renewal — mechanism, evidence and next implementation contract

B3 local successor addendum: [Encounter renewal](ENCOUNTER_RENEWAL.md) implements one finite ordinary-mass-bypass evidence family and explicit opt-in use of the existing paid command, with no subsidy/stock/capacity/reset gift. It does not solve every renewal family or establish Loyalist viability. Existing untreated control source/results and the original wear study are preserved. The completed builder smoke is one seed per five strategies over six days, plus a separately labelled conserved30-day mechanism, not the required20-seed120-day comparison; the coordinator owns that composed gate. Historical diagnosis and absence statements below remain attributed to their original checkpoint.

**Checkpoint-002 addendum:** this is the preserved checkpoint-001 diagnosis/decision. The transaction/UI portion is now implemented locally; see [Paid installation replacement](PAID_INSTALLATION_REPLACEMENT.md). Structured encounter-driven renewal and policy adoption remain unfinished. The unchanged-policy 100-campaign control has been rerun and matches this baseline exactly; no economic improvement is claimed.

## Decision

Develop **explicit paid replacement/retrofit of a selected installation** before adding more trap stock or nerfing permanent reset. Preserve the cam's accepted +12 newly built DC and existing global wear immunity. Add structured upgrade demand from observed past encounters as the following causal slice; do not manufacture infinite replacement appetite.

This is the direct lead's recommended bounded engineering direction within the existing commission, not a claim of measured rebalance improvement. At checkpoint 001, no replacement/retrofit code or balance change was included; checkpoint 002 implements the transaction/UI only, as noted above. The original baseline and all historical evidence remain intact.

## Three hypotheses and discriminating evidence

| Hypothesis | Prediction | Observation |
|---|---|---|
| 1 Full finite installations plus global wear immunity close the purchase loop | Even rich, willing buyer with ample stock stops at three units under permanent reset | Reproduced: controlled 30-day reset branch has 3 paid sales then full-loadout refusals, while no-reset branch has 12. Only wear reset argument differs. |
| 2 Only low liquidity causes the dead end | A large fixed starting budget should prevent purchase collapse | Fixed 99,999g control still collapses with permanent reset; buyer budget is conserved and no daily top-up occurs. This rejects liquidity-only explanation for that control, not all campaign financial failure. |
| 3 Boycotts/markup are the sole cause | At normal pricing and sufficient trust the loop should continue | Same control uses 1.0 price, no warranty/exclusivity/secrecy, rising trust and actual stock. It still stops at capacity. Boycotts and claims remain important for other policies, especially Predatory. |

Mechanism: `economyEngine.ts:125–129` and `219–223` reject a full loadout before a new purchase. `resolveConsumableWear` (`333–381`) never removes an installation while `auto_reset_cam` is unlocked. The skill is acquired by the Loyalist policy (`campaignRunner.ts:188–195`). There is no shared paid replace/retrofit command. `desiredTrait` is changed/displayed as text but does not enter `computeQuotation` or `executeCommercialTransaction`; a desire cannot overcome full slots. Remaining inventory stops selling while overhead/interest continue.

This is more than a tuning problem: finite storage is correct; infinite wear immunity without an upgrade transaction/demand channel leaves an essential decision missing.

## Newly executed baseline (not copied result totals)

Hermes ran the current engine on the same explicitly recorded 20 seeds per policy, `731900 + n*7919` for n=0..19, 120 days. This is a new self-execution of existing policies, not an independent review or new human playtest. No treatment changes were applied.

| Policy | Insolvent / sample | Median revenue | Median overhead | Median net profit | Median last sale day |
|---|---:|---:|---:|---:|---:|
| Balanced | 0 / 20 | 87,336g | 12,680g | 43,463.5g | 120 |
| Dungeon Loyalist | 20 / 20 | 4,832g | 8,940g | −7,399g | 10.5 |
| Hero Benefactor | 0 / 20 | 64,393g | 10,890g | 29,184g | 120 |
| Alchemical Industrialist | 0 / 20 | 93,769g | 12,840g | 52,579g | 120 |
| Predatory | 18 / 20 | 29,557g | 12,360g | 2,589g | 114.5 |

`fullRefusalsWithStock` counts refused attempts, not unique demand opportunities: Loyalist 4,800 across this sample. Repeated attempts per day are deliberately not converted to lost-revenue estimates. No impact number for paid replacement is justified yet. Positive median Predatory accounting profit does not imply solvency; cash, debt, inventory and daily deficits are distinct.

Controlled mechanism reproduction (`seed=88191`, one selected Cellar master, empty initial installation slots, fixed 99,999g budget, 100 stock, 30 days, no raids/market income/overhead/progression):

| Wear control | Actual paid purchases |
|---|---:|
| Normal wear | 12 |
| Existing permanent-reset wear immunity | 3 |

Each step asserts buyer budget + paid revenue equals starting budget, merchant cash increase equals paid receipts, remaining stock + paid contracts equals starting stock, slot count <=3, reserve alignment, transaction input immutability. The control isolates capacity/wear, not whole-campaign profitability. Full traces and summaries: `evidence/content-reconciliation/renewal-diagnosis.json` in coordinator workspace. Reproduce with `npm run diagnose:renewal` and a fresh `EVIDENCE_DIR`.

## Alternatives

| Option | Actual decision added | Benefits | Risks / why not first |
|---|---|---|---|
| **Explicit paid selected-slot replacement/retrofit** | Which installation to retire, what useful change to buy, what budget/stock/remaining reserve is spent | Preserves finite 3-slot capacity and permanent-reset investment; integrates real stock, client budget and new engineering outcomes | A replacement transaction alone does not make buyers rationally renew. Requires demand/value evidence and no self-generated refund loops. Implement shared command before giving policies new authority. |
| Change permanent reset to finite maintenance/wear protection | Buy maintenance, tolerate condition loss or replace | Creates recurring service decisions and uses currently ignored maintenance fields | Changes an accepted advertised skill benefit and existing saves/installed inventory. Needs explicit migration and preservation contract; cannot silently be a D04 follow-up. |
| Observation-driven upgrade demand without a replacement command | Respond to proven enemy counters with meaningful design changes | Makes two-sided learning drive new business rather than arbitrarily spawning purchases | Currently cannot purchase into full capacity. Must be paired with explicit replacement channel; otherwise only more misleading demand text. |
| Lower overhead / grant subsidies / force hero sales | No missing installation decision repaired | Can make a policy metric look solvent | Rejected as the causal repair: masks the dead end, erases strategic distinction or adds arbitrary income. Cost tuning may be evaluated later, separately. |

## Next tranche acceptance contract

### Shared atomic replacement primitive

- Add an explicitly requested replacement operation, separate from ordinary sale. Ordinary sale to a full master must continue refusing; no silent eviction.
- Identify master, canonical new SKU and exact existing slot/expected old SKU. Validate current stock, region unlock/active region, audience, budget/terms and stale slot state before any mutation.
- Replace exactly one selected installation, preserving the order/identity/remaining reset reserves of all other slots. A new temporal installation receives exactly its paid one charge; old unused reserve is retired with its old installation and never silently transferred, duplicated or refunded.
- Preserve master capacity, merchant stock, buyer liquidity and receipt/financial accounting. Failure returns no state change; repeated/stale requests cannot repeat stock/cash effects. Saving/reloading retains the replacement and explanation.
- Reuse shared quotation math; do not implement a competing UI price path. Extend receipt metadata minimally and compatibly so old sales and historical saves remain valid. Keep ordinary sale shape/behaviour untouched where possible.
- An identical installation/relabel is not evidence of useful renewal. Do not count a canonical-ID change as improved value. Explicit deliberate player experimentation remains possible, but buyers do not become unconditional repeat-purchase sinks.

### Learned demand and actual policy use

- Model an attributable request based on completed encounter evidence (e.g. observed mass bypass, filtration or sabotage); persist its source report/client/day and the relevant known counter. No future-roll oracle.
- Provide more than one costly response when rules permit. Reject/reason about an alleged upgrade that cannot address the observed weakness; retain the option to decline, pursue another customer, accept risk or use a different engineering route.
- Update structured knowledge used by the actual resolver/purchase logic, not just text logs. Distinguish new functionality from fixing misleading descriptions. No automatic subsidy, compulsory neutral/bilateral strategy or limitless upgrades.
- Have runner policy and real UI issue the same command; do not mutate runner inventories privately to make economics pass.

### Tests and experiments before tuning claims

1. Vertical TDD at command seam: new desired failure first, then minimal implementation. Preserve full-loadout ordinary-sale refusal, stale SKU/slot, budget, wrong region/audience, 0 stock, reserve alignment, exact paid cash/stock and input immutability.
2. Real browser selected-slot action, negative +1g control, cancelled/failed action, reload, historical save recovery; UI/runner parity through settlement and later quotes.
3. Controlled 30-day study with identical starting seed/save/budget/stock and explicit treatment deltas. Preserve original no-reset/reset controls; distinguish installation purchases from service income and retired stock/reserves.
4. Paired 120-day policies with explicit replacement selection logic; record gross revenue, COGS, overhead, net profit, cash/debt/net worth, last sale, stock conservation, client survival, unique useful upgrades and refusal reasons. Report distributions, not only mean wealth.
5. Useful controls: Hero/neutral legitimate behaviour, no-sale campaigns, finite temporal resources and permanent-reset immunity stay valid. A solvent Loyalist bot is necessary evidence, not proof a human faction strategy is enjoyable or universally viable.

## Non-goals and preserved decisions

No initial-stock gifts, cap removal, arbitrary subsidy, guaranteed return customer, cam DC change, global-reset nerf, silent save rewrite, forced hero supply, art production, engine migration or Android acceptance. The full game still requires all connected regions, meaningful distinct tier mechanics and a multi-path offline Hard commission/ending. Future work is Hermes-owned and self-tested unless a separately authorised independent review occurs; no Codex involvement is needed to make progress.
