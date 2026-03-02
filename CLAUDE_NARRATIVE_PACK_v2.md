# CLAUDE_NARRATIVE_PACK_v2.md — Design Document

**Author:** Claude (Cowork)
**Date:** 2026-03-02
**File:** `packages/content/data/narrative_candidates_v2.json`
**Status:** Standalone v2 pack — integration into content loader is Codex's job

---

## Overview

v2 is a complete standalone narrative candidates pack for the Northern Strait Flashpoint scenario. It replaces v1 as the canonical content source (199 entries vs 97 in v1). All entries conform to the `NarrativeCandidatesPack` schema defined in `@wargames/shared-types`.

---

## Entry Counts

| Category | v1 | v2 | Delta | Notes |
|---|---|---|---|---|
| advisor_lines | 30 | 97 | +67 | Full 4-advisor coverage on all 13 non-terminal beats |
| debrief_variants | 17 | 40 | +23 | Balanced across PlayerAction (14), SecondaryEffect (14), SystemEvent (12) |
| pressure_text | 15 | 27 | +12 | Denser tick coverage for timed beats + expanded _generic |
| causality_reveal | 15 | 15 | 0 | Quality rewrite; structure unchanged |
| advisor_retrospective | 20 | 20 | 0 | Voice differentiation pass; structure unchanged |
| **Total** | **97** | **199** | **+102** | |

---

## Design Decisions

### Advisor Lines

**Coverage model:** Every non-terminal beat gets all 4 advisors (7-8 lines per beat). v1 had 2 beats with zero coverage (ns_urban_unrest, ns_market_spiral) and most beats with only 2-3 advisors. v2 fills all gaps.

**Voice differentiation:**

- **cross** (military/strategy): Terse, direct, action-oriented. Uses military framing. Prefers decisive posture over deliberation. Typical cadence: short declarative sentences, imperative mood.
- **chen** (diplomacy): Measured, process-aware. Sees diplomatic architecture and coalition dynamics. Frames choices in terms of preserved vs. foreclosed options. Longer, compound sentences.
- **okonkwo** (economics/markets): Market-literate, systemic risk awareness. Connects political decisions to financial consequences. Uses quantitative metaphor without exact numbers. Balance-sheet vocabulary.
- **reed** (intelligence/signals): Information-focused, comfortable with ambiguity. Distinguishes signal from noise. Attribution-aware. Warns about collection gaps and intent uncertainty.

**Beat-awareness:** Each advisor line references the specific beat's narrative context (e.g., maritime harassment in ns_strait_pressure, disinformation in ns_info_war) rather than generic strategic advice. Lines are written so the beat context is assumed, not restated.

**Fog-of-war compliance:** Zero advisor lines contain exact meter values, rival belief parameters, latent variable names, branch-target IDs, or terminal outcome spoilers. All meter references use qualitative language ("thinning," "fragile," "elevated").

### Debrief Variants

**Architecture compatibility:** v2 debrief variants are written for the updated `buildTurnDebrief` which takes separate `rivalNarrativeTokens` and `narrativeTokens` parameters. All SecondaryEffect templates reference `{rivalToken}` assuming it contains rival-specific effects only (not mixed player/rival tokens as in pre-fix v1).

**Condition field:** Uses human-readable condition strings describing the game state context where the variant applies. These are not machine-parsed in the current engine — they serve as selection guidance for when Codex integrates variant selection logic.

**Template interpolation tokens:** `{playerAction}`, `{rivalAction}`, `{rivalToken}`, `{eventLabel}` — consistent with `debrief.ts` interpolation patterns.

**Balance:** 14 PlayerAction variants (covering escalation deltas, meter-specific impacts, temporal, and phase conditions), 14 SecondaryEffect variants (covering rival action categories, token availability, pressure levels), 12 SystemEvent variants (covering visibility tiers, event domains, compound scenarios).

### Pressure Text

**Coverage model:** Dense second-by-second coverage for the two timed beats (ns_crisis_window at 90s, ns_missile_warning at 75s) plus _generic fallback. Thresholds are calibrated to the beat's actual `decisionWindow.seconds` value.

**Urgency curve:** Text escalates from situational to visceral. Early thresholds are informational ("The crisis window is open"), mid-range adds consequence framing ("Inaction carries its own consequences"), final seconds are terse and direct ("Time.").

**_generic entries:** 8 entries from 60s down to 1s, usable as fallback for any future timed beats.

### Causality Reveal

**Quality rewrite:** All 15 entries rewritten for clarity and causal precision. Each `causal_note` specifically identifies which meter dynamics or decision patterns produced the outcome, without naming exact thresholds.

**Post-game context:** These are displayed after game completion. They may reference meter dynamics in qualitative terms ("alliance trust held above fragmentation thresholds") since fog-of-war does not apply post-game.

### Advisor Retrospective

**Voice differentiation pass:** Each advisor's retrospective reflects their domain perspective on the same outcome. Cross frames outcomes in military terms, Chen in diplomatic architecture, Okonkwo in market/economic terms, Reed in information/intelligence terms. No two advisors use similar phrasing for the same outcome.

**Tone calibration:** Retrospectives avoid self-congratulation on good outcomes and avoid blame on bad outcomes. They analyze what happened through their professional lens — consistent with the advisory role.

---

## ID Convention

All v2 IDs use the prefix `v2_` followed by category abbreviation and descriptive suffix:

- `v2_al_{beat_short}_{advisor}_{n}` — advisor lines
- `v2_dv_{source_short}_{descriptor}` — debrief variants
- `v2_pt_{beat_short}_{threshold}` — pressure text
- `v2_cr_{outcome_short}_{field}` — causality reveal
- `v2_ar_{advisor}_{outcome_short}` — advisor retrospective

No ID collisions with v1 entries. All IDs are unique within the v2 pack (validated).

---

## Integration Notes for Codex

1. **Content loader (`packages/content/src/index.ts`)** currently imports only v1. Codex should update to import v2, or merge v1+v2, or replace v1 entirely.
2. **Debrief variant selection logic** does not exist in the engine yet — `buildTurnDebrief` uses hardcoded template construction. If Codex wants to use the debrief_variants from the content pack, a selection function needs to be written.
3. **Pressure text** is already consumed via `getPressureText()`. v2 entries follow the same schema and will work with the existing accessor.
4. **Advisor lines** in the content pack are supplementary to the `advisorLines` embedded in `scenarios.json` beat definitions. Codex should decide whether pack lines replace, augment, or are selected from alongside scenario-embedded lines.
5. The JSON file is valid and passes all referential integrity checks. No code changes are required to store it — it's a data file.

---

## Validation Results

- JSON syntax: valid
- Unique IDs: 199/199 unique
- Beat ID referential integrity: all beatIds exist in scenarios.json or are `_generic`
- Advisor names: all in {cross, chen, okonkwo, reed}
- Outcome values: all in {stabilization, frozen_conflict, war, regime_instability, economic_collapse}
- Debrief sources: all in {PlayerAction, SecondaryEffect, SystemEvent}
- CR fields: all in {title, summary, causal_note}
- Non-terminal beat coverage: 13/13 (100%)
- Fog-of-war scan: 0 violations (no 2-3 digit numbers in advisor lines)
- ci:phase1: 18/18 tests pass, 0 content validation errors
