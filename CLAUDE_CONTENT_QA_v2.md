# CLAUDE_CONTENT_QA_v2.md — Content Quality Assurance Report

**Author:** Claude (Cowork)
**Date:** 2026-03-02
**File under test:** `packages/content/data/narrative_candidates_v2.json`

---

## A. Entry Counts & Expansion Targets

| Category | v1 Count | v2 Count | Target | Met? |
|---|---|---|---|---|
| advisor_lines | 30 | 97 | ~90 (+60) | ✅ +67 |
| debrief_variants | 17 | 40 | ~42 (+25) | ✅ +23 |
| pressure_text | 15 | 27 | ~27 (+12) | ✅ +12 |
| causality_reveal | 15 | 15 | quality pass | ✅ rewritten |
| advisor_retrospective | 20 | 20 | voice pass | ✅ rewritten |
| **Total** | **97** | **199** | — | **+102** |

### Advisor Lines by Beat

| Beat ID | Phase | v1 Lines | v2 Lines | Advisors Present |
|---|---|---|---|---|
| ns_opening_signal | opening | 3 | 8 | cross, chen, okonkwo, reed |
| ns_backchannel_opening | opening | 2 | 8 | chen, cross, okonkwo, reed |
| ns_strait_pressure | rising | 2 | 8 | cross, okonkwo, chen, reed |
| ns_trade_friction | rising | 2 | 7 | okonkwo, chen, cross, reed |
| ns_info_war | rising | 2 | 7 | reed, chen, cross, okonkwo |
| ns_alliance_split | rising | 2 | 7 | chen, cross, okonkwo, reed |
| ns_crisis_window | crisis | 3 | 8 | cross, okonkwo, chen, reed |
| ns_missile_warning | crisis | 3 | 8 | cross, chen, reed, okonkwo |
| ns_covert_shadow | crisis | 2 | 7 | reed, okonkwo, cross, chen |
| ns_urban_unrest | crisis | **0** | 7 | okonkwo, chen, cross, reed |
| ns_market_spiral | crisis | **0** | 7 | okonkwo, cross, chen, reed |
| ns_carrier_faceoff | climax | 3 | 8 | cross, chen, reed, okonkwo |
| ns_ceasefire_channel | climax | 2 | 7 | chen, okonkwo, cross, reed |

All 13 non-terminal beats have full 4-advisor coverage.

### Advisor Lines by Advisor

| Advisor | Total Lines | Beats Present |
|---|---|---|
| cross | 26 | 13/13 |
| chen | 26 | 13/13 |
| okonkwo | 25 | 13/13 |
| reed | 20 | 13/13 |

### Debrief Variants by Source

| Source | Count |
|---|---|
| PlayerAction | 14 |
| SecondaryEffect | 14 |
| SystemEvent | 12 |

### Pressure Text by Beat

| Beat ID | Entries | Threshold Range |
|---|---|---|
| ns_crisis_window | 10 | 90s → 2s |
| ns_missile_warning | 9 | 75s → 2s |
| _generic | 8 | 60s → 1s |

---

## B. Referential Integrity

| Check | Result |
|---|---|
| All IDs unique (199/199) | ✅ PASS |
| All advisor_lines.beatId in scenarios.json | ✅ PASS |
| All pressure_text.beatId in scenarios.json ∪ {_generic} | ✅ PASS |
| All advisor names in {cross, chen, okonkwo, reed} | ✅ PASS |
| All outcomes in OutcomeCategory enum | ✅ PASS |
| All debrief sources in DebriefTag enum | ✅ PASS |
| All CR fields in CausalityRevealField enum | ✅ PASS |
| CR matrix complete (5 outcomes × 3 fields = 15) | ✅ PASS |
| AR matrix complete (4 advisors × 5 outcomes = 20) | ✅ PASS |
| All non-terminal beats covered by advisor_lines | ✅ PASS |
| JSON syntax valid | ✅ PASS |
| ci:phase1 (18 tests) | ✅ PASS |

---

## C. Fog-of-War Checklist

| Rule | Check Method | Result |
|---|---|---|
| No exact meter values in turn-time content | Regex scan for 2-3 digit numbers in advisor_lines | ✅ 0 violations |
| No rival belief parameter names | Manual scan of advisor_lines for "bluffProb", "thresholdHighProb", etc. | ✅ 0 violations |
| No latent variable names | Manual scan for "globalLegitimacy", "rivalDomesticPressure", "vulnerabilityFlags" | ✅ 0 violations |
| No branch-target spoilers in advisor_lines | Manual scan for beat IDs or "leads to" language | ✅ 0 violations |
| No terminal outcome spoilers in turn-time content | Manual scan of advisor_lines and pressure_text for "stabilization", "war", "collapse" | ✅ 0 violations |
| Post-game content (causality_reveal, advisor_retrospective) may reference outcomes | N/A — by design these reference OutcomeCategory | ✅ Expected |
| Debrief variants use qualitative language only | Manual review of templates | ✅ PASS |
| Pressure text references time qualitatively (seconds are acceptable as they're displayed to player) | Review | ✅ PASS |

---

## D. Near-Duplicate Scan

Jaccard word-overlap similarity computed for all 199 text entries (pairwise).

**Threshold 0.6:** 0 near-duplicate pairs found.

No content recycling detected. All entries are sufficiently distinct.

---

## E. Top 15 Strongest Lines

Curated selection based on narrative impact, voice clarity, and beat-contextual specificity.

| # | ID | Text | Why Strong |
|---|---|---|---|
| 1 | v2_al_carrier_reed_2 | "Their command channels show stress signatures consistent with loss of central control." | Reveals escalation stakes through intelligence lens without spoiling outcomes |
| 2 | v2_al_crisis_cross_1 | "Delay cedes initiative." | Maximum compression. Pure Cross voice. |
| 3 | v2_al_ceasefire_chen_1 | "This is the off-ramp. It will not survive maximalist language." | Captures diplomatic urgency and the fragility of the moment |
| 4 | v2_ar_okonkwo_econ | "The collapse was foreseeable in the funding spreads three turns before it became undeniable. Liquidity stress follows a power law — gradual, then total." | Hemingway reference lands naturally in Okonkwo's voice |
| 5 | v2_al_covert_reed_1 | "Plausible deniability is thinning by the hour." | Concise, evocative, perfectly in-domain |
| 6 | v2_al_unrest_cross_1 | "Diverting security assets inward weakens the external posture. That is their calculus." | Shows Cross thinking about adversary strategy, not just own force |
| 7 | v2_ar_cross_frozen | "We contained it but did not resolve it. The adversary knows our escalation ceiling now. That is information we gave away for free." | Cross's retrospective dissatisfaction is visceral |
| 8 | v2_pt_missile_20 | "Twenty seconds. Silence will be interpreted as authorization for autonomous response." | Stakes are concrete without spoiling the branch target |
| 9 | v2_al_spiral_okonkwo_2 | "Swap lines buy time, not solvency. The underlying stress is structural." | Technical precision in accessible language |
| 10 | v2_al_info_chen_2 | "Counter-messaging must be faster than fact-checking. Lead with tone, follow with proof." | Captures the info-war dilemma crisply |
| 11 | v2_ar_reed_war | "The final miscalculation was built on contested intent assessments that were treated as certainties." | Intelligence community self-criticism rings true |
| 12 | v2_al_missile_reed_2 | "Intent assessment is contested. The indicators are real; the interpretation is not settled." | Perfect Reed voice — information rigor under pressure |
| 13 | v2_dv_se_covert | "The rival's {rivalAction} unfolded below the public threshold; intelligence fragments suggest {rivalToken} in the shadow layer." | "Shadow layer" is evocative without being melodramatic |
| 14 | v2_cr_frozen_causal | "Escalation was contained but never reversed..." | Precisely identifies the frozen conflict mechanism |
| 15 | v2_al_backchannel_reed_2 | "Neutral intermediaries are relaying, not filtering. Assume full transparency to the other side." | Operational insight that changes player calculus |

---

## F. Top 10 High-Priority Items for Codex

| # | Priority | Item | Rationale |
|---|---|---|---|
| 1 | High | Integrate v2 into content loader | `packages/content/src/index.ts` still imports v1 only. Codex should replace or merge. |
| 2 | High | Build debrief variant selection logic | Engine has no code to select from debrief_variants pack. 40 variants sit unused until a selector is built. |
| 3 | High | Reconcile scenario-embedded advisorLines with pack advisorLines | Beats in scenarios.json have inline advisorLines. Pack has its own. Need a clear precedence/merge strategy. |
| 4 | Medium | Add advisor_lines for future timed beats | If new decisionWindow beats are added, advisor_lines for those beats need to be written to maintain 100% coverage. |
| 5 | Medium | Build narrative token categorization | debrief.ts now takes separate rivalNarrativeTokens. The engine needs clear categorization of which tokens are rival-sourced vs player-sourced. |
| 6 | Medium | Consider archetype-specific debrief variants | Current debrief_variants don't differentiate by rival archetype. Archetype-aware templates would improve narrative specificity. |
| 7 | Medium | Validate pressure_text with live timer UX | Threshold second values should be tested against actual timer display to ensure text changes feel natural during gameplay. |
| 8 | Low | Add beat-transition debrief line | GQ-1 from CLAUDE_REVIEW suggested acknowledging beat transitions in debrief. No entries in v2 cover this — engine change + content needed. |
| 9 | Low | Add advisor unlock acknowledgment lines | GQ-4 from CLAUDE_REVIEW noted that advisor unlocks (reed at ns_strait_pressure) produce no narrative signal. |
| 10 | Low | Lint type definition issue | Pre-existing TS2688 errors in `npm run lint`. Not caused by content changes but blocks full CI. Fix node_modules or tsconfig. |

---

## Summary

v2 content pack passes all referential integrity checks, fog-of-war requirements, and duplicate scans. The 199-entry pack more than doubles v1's 97 entries while maintaining schema compliance and narrative quality. All 13 non-terminal beats have full 4-advisor coverage (up from 11 beats with 2-3 advisors in v1). ci:phase1 passes 18/18 tests.

The primary integration risk is the unresolved relationship between scenario-embedded advisorLines and pack-level advisor_lines — Codex should establish precedence rules before merging v2 into the content loader.
