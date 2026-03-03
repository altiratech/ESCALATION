# ESCALATION UI/UX Audit — Consolidated Observations & Implementation Notes

**Author:** Claude (Cowork)
**Date:** 2026-03-03
**Scope:** Start screen + in-game layout
**Reference:** Technical Spec v1 (Section 9), DECISIONS D-044/D-046, scenario data schema, current component source
**Status:** Review document for Codex implementation

---

## Part 1: Start Screen

### 1A. Redundant Title

**Current:** The subheader reads `ESCALATION // PRE-MISSION DOSSIER` and directly below it the hero title reads `ESCALATION` again. The word appears twice in the first three lines.

**Fix:** Either drop the word from the subheader (use just `PRE-MISSION DOSSIER` or `CLASSIFIED // PRE-MISSION DOSSIER`) or replace the hero title with the scenario name as the visual anchor. The product identity is already established by the subheader — the large type should create dramatic weight, not repeat branding.

**File:** `apps/web/src/components/StartScreen.tsx` lines 82–83.

---

### 1B. Weak Description

**Current:** "You are entering a ten-turn strategic crisis simulation with hidden state, rival adaptation, and deterministic causality."

**Problem:** This reads like a spec summary. It describes engine features (hidden state, deterministic causality) instead of setting a tone. A player about to step into a geopolitical crisis shouldn't be reading a feature list.

**Suggested direction:** Something that establishes stakes and role. Examples:

- "The situation is deteriorating. Your decisions over the next ten turns will shape whether this ends in diplomacy or destruction. Every choice has consequences — some you'll see immediately, others you won't understand until it's too late."
- "You've been called into the Situation Room. A crisis is unfolding and the clock is already running. What you do next — and what you choose not to do — will determine the outcome."

The key principle: describe the *experience*, not the *system*. The player discovers hidden state and deterministic causality through gameplay — they don't need it explained upfront.

**File:** `apps/web/src/components/StartScreen.tsx` lines 84–87.

---

### 1C. Thin Classified Brief

**Current:** The right-side panel shows the scenario name, one paragraph briefing, a "Cold Open" box, initial intelligence headlines, role, and environment. The briefing is a single sentence: "A disputed maritime corridor has become the center of coercive signaling, cyber probing, and alliance stress."

**Problems:**

1. **"Cold Open" is spec jargon** — this label comes from Technical Spec Section 9.2 ("Cold opens: Each scenario begins with a full-screen cinematic text sequence"). Players don't know what a "cold open" is in this context. It's pulling `startingBeat.sceneFragments[0]` — the first scene fragment from the opening beat. Should be labeled something like `OPENING SITUATION` or `SITUATION REPORT` or `INITIAL ASSESSMENT`.

2. **The briefing is too short.** One sentence doesn't justify a "Classified Brief" label. This needs to feel like opening a folder. The scenario JSON `briefing` field itself needs enrichment (Layer 2 — schema change), but even now we could compose a richer intro by pulling the second scene fragment, the memo line, and the ticker line from the starting beat alongside the briefing.

3. **"Environment: coastal" is meaningless.** This is an internal engine tag for image asset matching. It tells the player nothing. It should either be removed entirely or expanded with scenario-specific geography. The scenario data currently lacks a region/coordinates field — that's a schema enrichment need (see Section 3 below).

**File:** `apps/web/src/components/StartScreen.tsx` lines 226–261, `packages/content/data/scenarios.json` line 9 (environment field).

---

### 1D. Non-Interactive Intelligence Items

**Current:** The "Initial Intelligence" headlines render as static text boxes. Role and Environment render as static key-value rows.

**What it should do:**

- **Headlines should be clickable/expandable.** On click, reveal supporting context pulled from the starting beat: the `memoLine` ("Intercepted note: coalition envoys expect private assurances within six hours") and `tickerLine` ("Risk ticker: shipping insurance spreads +12 bps pre-open"). These exist in the data but aren't surfaced here. Each headline could expand to show a 2-3 line intel snippet that gives the player a sense of depth.

- **Role should be expandable.** "National Security Advisor" is the label, but clicking it should reveal a brief role description — what authority you have, what you can and can't do, who reports to you. This doesn't exist in the scenario data yet (see Section 3), but could be hardcoded per-scenario in the short term or added as a `roleDescription` field.

- **Environment should either be removed or replaced** with a meaningful geographic anchor. "Coastal" as a tag is useless to the player.

**Implementation approach:** Add `useState` expand/collapse toggles to each intel item and role row. Pull `memoLine`, `tickerLine`, and `sceneFragments[1]` from the starting beat to populate the expanded states. For role, hardcode a brief description per scenario until the schema is enriched.

**File:** `apps/web/src/components/StartScreen.tsx` lines 239–260.

---

### 1E. Missing Geographic Context

**Current:** No map, no coordinates, no named geography. "Northern Strait Flashpoint" implies a specific place but the UI doesn't ground it. The entire experience feels generic because nothing is anchored in physical space.

**What it needs:** At minimum, a regional label (e.g., "Western Pacific — Taiwan Strait" or "South China Sea / Luzon Strait"). Ideally a simple map visualization — even a static SVG with a highlighted region would transform the feel. A small map in the classified brief panel would make the scenario instantly more tangible.

**This requires schema enrichment** — see Section 3.

---

### 1F. Advisor First Takes (Missing from Start Screen)

**Current:** The starting beat has advisor lines from cross, chen, and okonkwo — but these aren't shown on the start screen at all. The player enters the game cold without knowing who their advisors are or what they think.

**Suggestion:** Add a collapsed "Senior Staff Assessment" section to the classified brief that shows the 3-4 advisor first takes from the opening beat. Each advisor name + one line. This primes the player on who they'll be hearing from and the initial tension between perspectives. It sets up the advisor dynamic before Turn 1.

**Data available:** `startingBeat.advisorLines` — already loaded in StartScreen via the `startingBeat` memo.

---

## Part 2: In-Game Layout

### 2A. Massive Dead Space Between Briefing and Advisors

**Current layout structure (App.tsx lines 304–397):**
```
Header card (full width) — ESCALATION title + HUD chips
Decision Window card (full width) — countdown or "no active countdown"
Grid [1.22fr | 0.78fr] at xl breakpoint:
  Left: BriefingPanel + ActionCards (stacked)
  Right: AdvisorPanel
```

**Problem:** The two-column grid only activates at `xl` breakpoint (1280px+). At most window sizes, everything stacks vertically: briefing → actions → advisors. This creates the huge gap visible in the screenshots — the briefing card has `h-full` but little content, and the advisor panel sits far below with empty space between.

Even at `xl`, the proportions are wrong. The briefing panel content is thin (one paragraph + two headlines + one ticker line), so the left column has dead space while the right column is dense with advisor cards.

**Fix:** Drop the breakpoint to `lg` (1024px). Restructure the proportions. Consider making advisors always visible in a sidebar rather than stacking below.

---

### 2B. Layout Order Is Wrong

**Current flow (top to bottom):** Header → Decision Window → Briefing → Actions → Advisors.

**Problems with this order:**

1. **The header is too heavy.** It shows "ESCALATION // COMMAND LAYER", the title "ESCALATION" in large text, "Deterministic strategic escalation simulator" as a subtitle, commander name, scenario name, and three HUD chips (Turn, Pacing, Status). That's a lot of screen real estate for ambient information. The spec calls for an "Ambient Status Strip" — a thin horizontal bar with turn number, scenario clock, and 1-3 alert dots. Not a card with a title and subtitle.

2. **Decision Window gets its own full-width card even when empty.** On most turns there's no active countdown, so it just says "No active countdown in this beat" with a disabled Extend button. That's wasted space for 80%+ of gameplay. When a countdown IS active, it should be urgent and prominent — but it shouldn't occupy permanent real estate when inactive.

3. **Actions are buried below the briefing.** The player reads the briefing, then has to scroll past it to find their decision options. This is backwards — the briefing sets context, but the actions are where agency lives. They should be visually prominent and accessible without scrolling.

4. **Advisors are disconnected from actions.** Advisors exist to influence your decision. They should be visually adjacent to the action cards, not separated by a scroll gap. The natural flow should be: read the situation → hear your advisors → make your choice.

**Proposed layout:**

```
Thin status strip (full width): Commander | Turn X/10 | Scenario | Pacing
  (Countdown folds into this strip when active — becomes prominent with color/animation)

Two-column grid (lg breakpoint):
  Left (~58%): BriefingPanel (situation + intel signals + debrief)
  Right (~42%): AdvisorPanel → ActionCards (stacked, in this order)
```

This puts advisors right above the actions — you see what they think, then you see your options. The briefing is the reading pane, the right column is the decision pane.

**Files:** `apps/web/src/App.tsx` lines 304–397.

---

### 2C. Header Leaks Engine Internals

**Current header content (App.tsx lines 305–322):**
- "ESCALATION // Command Layer" label
- "ESCALATION" title (repeats product name again)
- "Deterministic strategic escalation simulator" subtitle
- HUD chips: "TURN 1/10", "PACING: REAL-TIME", "STATUS: ACTIVE"

**Previous version also showed (now partially fixed):**
- Beat ID (`Beat: ns_crisis_window`) — raw engine graph node ID
- Beat Phase (`Beat Phase: crisis`) — reveals narrative arc structure
- Adversary Model name — leaks rival characterization
- Extends Left count

**Current state is better but still has issues:**
- "Deterministic strategic escalation simulator" is a tagline, not gameplay info. Remove it.
- "STATUS: ACTIVE" is redundant — if you're playing, it's active.
- The title "ESCALATION" shouldn't be in the in-game header. The player knows what game they're playing. Use the scenario name or commander codename as the anchor instead.

**Proposed thin strip:**
```
SABLE-ONE | Northern Strait Flashpoint | Turn 3 / 10 | Real-Time
```
One line. When a countdown activates, it appears as a colored timer element in this strip that demands attention through color shift (white → amber → red at <25%) per spec Section 9.3.

**File:** `apps/web/src/App.tsx` lines 305–322.

---

### 2D. Advisor Panel Needs More Depth

**Current:** Each advisor card shows name, agency title, stance tag (Hawk/Dove/Pragmatist/Wildcard), and 1-2 lines of dialogue. That's it. Cards are not interactive.

**What's missing:**

1. **No advisor background.** Who is ADM Vivian Cross? 15 years INDOPACOM, commanded Seventh Fleet? The player should be able to click/hover to see a brief bio that establishes credibility and perspective. This is hardcoded data — it doesn't exist in the schema but can be added to the `advisorMeta` object in `AdvisorPanel.tsx`.

2. **No stance history.** After a few turns, it would be valuable to know: "Cross has recommended escalation 4 of 5 turns." This tracks pattern — is this advisor always hawkish, or did they shift? The data to compute this exists in `beatHistory` + advisor lines per beat, though it would need accumulation logic.

3. **No expandable detail.** The advisor card should expand on click to show their full dialogue (not just line 1 and a muted line 2), their assessment of the current situation, and potentially which action they'd recommend. Even without explicit recommendation data, framing the second line as their "assessment" and making the card expandable adds depth.

4. **Phase badge leaks graph structure.** The "OPENING" badge in the top-right corner of the advisor panel comes from `beat.phase`. This is engine metadata (opening → rising → crisis → climax → resolution). Remove it or map it to a narrative label.

**File:** `apps/web/src/components/AdvisorPanel.tsx`.

---

### 2E. Briefing Panel Needs Interactive Depth

**Current:** The briefing shows a paragraph, two headline cards, an optional image, a ticker line, and an optional debrief section. Everything is static.

**What it should do:**

1. **Headlines should be expandable.** Click a headline to reveal a 2-3 sentence intelligence snippet. The data for this doesn't exist per-headline in the current schema, but the `memoLine` and scene fragments could be surfaced as expanded context on the first headline, and the `tickerLine` context on the second.

2. **"Deterministic Debrief" label should change.** This is engine terminology. Call it "Situation Update" or "Turn Assessment" or just "Debrief." The `[Player Action]` / `[Secondary Effect]` / `[System Event]` source tags are good — they teach the player about causality without using spec jargon.

3. **"Mission Briefing" / "Turn 1 Situation" header is generic.** Consider making the title scenario-aware or beat-aware. E.g., "Maritime Corridor — Initial Assessment" for Turn 1 of Northern Strait.

4. **"Incoming Signals" section should feel more alive.** The two static headline cards could have subtle visual differentiation — a severity indicator, a source label (SIGINT, OSINT, HUMINT), or a classification badge. Even cosmetic, this adds the feeling that you're reading real intelligence.

**File:** `apps/web/src/components/BriefingPanel.tsx`.

---

### 2F. Action Cards Placement and Depth

**Current:** Action cards sit below the briefing in the left column. Each card shows action name, visibility tag (public/semi-public/secret), summary, tags, and "Commit Action" text.

**Placement issue:** They should move to the right column, below advisors. Read left (situation) → decide right (counsel + options).

**Depth issue:** The cards show a summary and tags, but no sense of consequence. The player is choosing between 12 actions and the only differentiation is a one-line summary and a visibility tag. Consider:

- **Hover state:** Show a brief risk/consequence hint. Not exact meter impacts (that violates fog-of-war), but qualitative framing like "This action will be visible to all parties and may accelerate tensions" for a public escalatory action, vs. "This channel is private but carries risk of exposure" for a covert action.
- **Advisor alignment indicator:** A subtle dot or icon showing which advisor(s) would support this action. This connects the advisor panel to the action choice.
- **Confirmation step:** Currently clicking an action immediately commits it. Consider a brief confirmation: "You are about to [action name]. This action is [visibility]. Confirm?" This adds weight to the decision.

**Files:** `apps/web/src/components/ActionCards.tsx`, `apps/web/src/App.tsx` (grid structure).

---

## Part 3: Schema Enrichment Needs (Layer 2 — Content/Data Changes)

The UI can only be as rich as the data behind it. Several improvements above are blocked or limited by thin scenario data. These fields should be added to `ScenarioDefinition` in `packages/shared-types/src/index.ts` and populated in `packages/content/data/scenarios.json`:

| Field | Type | Example | Purpose |
|---|---|---|---|
| `region` | `string` | `"Western Pacific — Taiwan Strait"` | Geographic anchor for classified brief |
| `dateAnchor` | `string` | `"March 2026"` | Temporal grounding |
| `roleDescription` | `string` | `"As NSA, you coordinate interagency response..."` | Expandable role detail |
| `stakeholders` | `string[]` | `["PRC Navy","JSDF","7th Fleet","Treasury"]` | Named actors for context |
| `environmentDescription` | `string` | `"Congested maritime corridor, 40% of global trade"` | Replaces useless "coastal" tag |
| `mapHint` | `string` | `"western_pacific"` | Key for static map SVG |
| `classificationLevel` | `string` | `"TOP SECRET // SCI // NOFORN"` | Cosmetic header for classified brief |
| `openingNarrative` | `string` | (2-3 paragraph scene setter) | Rich cold-open text for start screen |

**Advisor metadata enrichment** — add to `AdvisorPanel.tsx` advisorMeta or create a new `advisors.json`:

| Field | Type | Example |
|---|---|---|
| `bio` | `string` | `"15 years INDOPACOM, commanded 7th Fleet carrier group"` |
| `perspective` | `string` | `"Believes early force projection prevents larger conflicts"` |
| `trustIndicator` | `string` | `"Reliable but hawkish — filter for escalation bias"` |

---

## Part 4: Priority Summary

### Tier 1 — Fix Now (Breaks Vision or Leaks State)

| # | Issue | Severity | File(s) |
|---|---|---|---|
| 1 | Redundant ESCALATION title on start screen | Medium | StartScreen.tsx:82-83 |
| 2 | "Cold Open" spec jargon in UI | Medium | StartScreen.tsx:234 |
| 3 | "Environment: coastal" meaningless to player | Low | StartScreen.tsx:257-259 |
| 4 | In-game header too heavy, repeats title | Medium | App.tsx:305-322 |
| 5 | Phase badge leaks graph structure | Medium | AdvisorPanel.tsx:58-60 |
| 6 | "Deterministic Debrief" spec jargon | Low | BriefingPanel.tsx:71 |
| 7 | "STATUS: ACTIVE" chip is redundant | Low | App.tsx:320 |
| 8 | Generic description text on start screen | Medium | StartScreen.tsx:84-87 |

### Tier 2 — Ship Soon (Immersion Gaps)

| # | Issue | File(s) |
|---|---|---|
| 9 | Decision Window wastes space when inactive | App.tsx:328-378 |
| 10 | Layout only goes two-column at xl (1280px+) | App.tsx:380 |
| 11 | Actions buried below briefing — wrong reading order | App.tsx:380-396 |
| 12 | Headlines / intel items not clickable/expandable | BriefingPanel.tsx:35-41, StartScreen.tsx:239-250 |
| 13 | Advisor cards not expandable, no bio/depth | AdvisorPanel.tsx:77-91 |
| 14 | No advisor first takes on start screen | StartScreen.tsx (new section) |
| 15 | No action confirmation step | ActionCards.tsx:39 |

### Tier 3 — Build Toward (Spec Features)

| # | Issue | Dependency |
|---|---|---|
| 16 | No geographic context / map | Schema enrichment (region, mapHint) |
| 17 | No rich role description | Schema enrichment (roleDescription) |
| 18 | No cinematic elements (cold open animation, screen shake, sound) | Feature build |
| 19 | No chat/free-form input | Spec Section 9.1 — major feature |
| 20 | No Intel Feed sidebar | Spec Section 9.1 — major feature |
| 21 | No advisor stance history tracking | Accumulation logic + UI |
| 22 | No action-advisor alignment indicators | Mapping logic + UI |

---

## Implementation Notes for Codex

**Start screen:** The `StartScreen.tsx` has already been partially cleaned up (timer labels renamed, seed hidden behind advanced toggle, adversary profile card removed, beat count / timed beat stats removed). Remaining work is relabeling (1A, 1B, 1C), adding expandable sections (1D), and advisor first takes (1F).

**In-game layout:** The restructure (2A, 2B) is the highest-impact change. Compress header to thin strip, fold countdown into it, switch to `lg:grid-cols-[0.58fr_0.42fr]` with briefing left and advisors+actions right. This is pure CSS/layout — no API changes needed.

**Schema enrichment:** This is a content authoring task. Add the new fields to `ScenarioDefinition` interface, populate them for Northern Strait in `scenarios.json`, and update the UI components to consume them. No engine changes required.

**All changes are presentation-only.** Nothing here touches the engine, API, or simulation logic. The `EpisodeView`, `BeatNode`, and `NarrativeBundle` data contracts remain unchanged.
