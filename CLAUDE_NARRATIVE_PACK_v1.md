# CLAUDE_NARRATIVE_PACK_v1 — ESCALATION Narrative Content Candidates

**Author:** Claude (Cowork)
**Date:** 2026-03-02
**Scenario:** Northern Strait Flashpoint
**Compatibility:** All content is deterministic-engine safe. No game state mutation. All facts derivable from GameState + TurnResolution fields. Fog-of-war compliant for turn-time outputs.

---

## 1. Advisor Lines (Beat-Scoped)

Each advisor has a distinct voice. Cross = military/hawk, Chen = diplomat/restraint, Okonkwo = economic/markets, Reed = intel/cyber. Lines are 1-sentence max and scoped to a specific beat, consistent with existing `advisorLines` field structure. These are candidates to expand the current 1-line-per-advisor slots.

### ns_opening_signal (Opening)
```
cross:  ["Show steel early or the window closes.", "If they interpret caution as permission, the corridor is lost."]
chen:   ["Preserve diplomatic oxygen before this hardens.", "Every public statement narrows the off-ramp."]
okonkwo: ["Markets are pricing fear faster than facts.", "Freight desks will front-run any deployment signal."]
```

### ns_backchannel_opening (Opening)
```
cross:  ["Talk if you must, but move assets first.", "Backchannels buy time only if matched by posture."]
chen:   ["A quiet off-ramp exists. It will not stay open.", "Silence on our part signals either wisdom or paralysis — they cannot tell which."]
okonkwo: ["If the channel holds, tanker futures will tell us before the cables do."]
```

### ns_strait_pressure (Rising)
```
cross:  ["This is rehearsal for a blockade. Treat it that way.", "Forward presence now or contested passage later — choose."]
okonkwo: ["Every hour of uncertainty compounds freight risk.", "Insurance markets are a leading indicator; they just stopped writing."]
reed:   ["Their command frequency shifted to exercise encryption — that is not exercise behavior."]
```

### ns_trade_friction (Rising)
```
okonkwo: ["Liquidity remains thin. One bad headline could cascade.", "Precautionary buying is rational for them but ruinous for us."]
chen:   ["Economic signaling can box everyone into harder lines.", "Sanctions rhetoric outruns sanctions policy — fill the gap before markets do."]
cross:  ["Economic leverage without credible force is just noise."]
```

### ns_info_war (Rising)
```
reed:   ["Their objective is panic, not persuasion.", "Attribution will take weeks. Containment must happen in hours."]
chen:   ["Public overreaction could validate their narrative.", "The best counter-narrative is operational competence, not louder messaging."]
okonkwo: ["Sentiment gauges are diverging from macro fundamentals — that gap is exploitable or explosive."]
```

### ns_alliance_split (Rising)
```
chen:   ["Lose the coalition and every option gets costlier.", "A private consensus is worth more than a public declaration right now."]
cross:  ["Allies follow credible leadership, not hesitation.", "If they sense we are negotiating with ourselves, they will hedge."]
okonkwo: ["Alliance discount is now a measurable spread in defense and sovereign instruments."]
```

### ns_crisis_window (Crisis — TIMED: 90s)
```
cross:  ["Delay cedes initiative.", "The decision is not between war and peace — it is between controlled escalation and drift."]
okonkwo: ["A misstep now detonates the balance sheet.", "Every second of ambiguity is priced in real time."]
chen:   ["Escalation cannot be your only language.", "If you speak only through force posture, the other side hears only threat."]
reed:   ["Command-channel latency suggests they are waiting for us to move first."]
```

### ns_missile_warning (Crisis — TIMED: 75s)
```
cross:  ["Assume readiness, not bluff.", "Fueling signatures do not reverse. Act on what we see, not what we hope."]
chen:   ["One wrong move here is irreversible.", "Miscalculation at this altitude is not recoverable through diplomacy."]
reed:   ["We can blind targeting windows briefly, not indefinitely.", "Electronic coverage degrades in 40 minutes — that is the real clock."]
```

### ns_covert_shadow (Crisis)
```
reed:   ["Plausible deniability is thinning by the hour.", "The pattern has shifted from probing to preparation."]
okonkwo: ["Off-ledger disruption is now bleeding into real supply lines.", "Insurance underwriters have already priced in what intelligence has not confirmed."]
cross:  ["Shadow operations accelerate when they believe we are not watching."]
```

### ns_carrier_faceoff (Climax)
```
cross:  ["One signal now decides whether this breaks.", "Force geometry says we have advantage for six hours — not twelve."]
chen:   ["We are one incident away from strategic lock-in.", "A live deconfliction channel is worth more than a strike plan right now."]
reed:   ["Misread intent is now the most dangerous actor.", "Both sides are interpreting noise as signal."]
```

### ns_ceasefire_channel (Climax)
```
chen:   ["This is the off-ramp. It will not survive maximalist language.", "Verification first — trust comes later."]
okonkwo: ["Markets will reward credible verification, not vague optimism.", "A framework without enforcement triggers is a press release."]
cross:  ["Ceasefire without maintained posture invites resumption."]
```

---

## 2. Turn Debrief Variants

These extend the debrief system. Each variant is a template string with placeholders derived from TurnResolution fields. The engine selects by matching conditions against post-resolution state. All meter references use qualitative language (fog-of-war safe).

### Player Action Lines (source: PlayerAction)
```
default:         "You authorized {action_name}; {strongest_shift_meter} {qualitative_shift} after implementation."
bounded:         "You authorized {action_name}; immediate effects remained bounded under current conditions."
high_escalation: "You authorized {action_name}; escalation pressure intensified sharply following execution."
stabilizing:     "You authorized {action_name}; conditions appear to have stabilized in the near term."
costly:          "You authorized {action_name}; implementation costs exceeded initial estimates across multiple indicators."
```

### Secondary Effect Lines (source: SecondaryEffect)
```
default:            "The rival answered with {rival_action_name}, and follow-on reporting suggests {token_phrase} across the theater."
no_token:           "The rival answered with {rival_action_name}, reinforcing a contested signaling environment."
rival_escalatory:   "The rival answered with {rival_action_name}; their posture shifted markedly toward confrontation."
rival_conciliatory: "The rival answered with {rival_action_name}; signals suggest a measured pullback from previous positioning."
rival_ambiguous:    "The rival answered with {rival_action_name}; intent remains difficult to parse from available reporting."
```

### System Event Lines (source: SystemEvent)
```
visible_event:   "Operational reporting indicates {event_label} activity; intelligence handling remains partially contested."
hidden_activity: "System activity accelerated in the background; available reporting remains incomplete."
multi_event:     "Multiple concurrent developments reported; analytical bandwidth is stretched across competing priorities."
high_visibility: "A high-profile development has entered the public record: {event_label}. Containment options narrowed."
```

### Beat Transition Lines (source: SystemEvent — new category)
```
beat_transition: "The strategic landscape has shifted — operational priorities are recalibrating."
crisis_entry:    "The situation has crossed into a narrower decision corridor. Response windows are compressing."
climax_entry:    "Events have reached a decisive phase. The next actions carry irreversible weight."
resolution_entry: "The crisis has resolved into its terminal configuration."
```

---

## 3. Timed-Beat Pressure Text

These text candidates are for UI display during countdown sequences on timed beats. Keyed by time-remaining thresholds. All are fog-of-war safe (no exact meter values).

### ns_crisis_window (90s decision window)
```
threshold_75:  "Command channels are holding for your directive."
threshold_60:  "Allied capitals have flagged the delay. Coordination options narrow."
threshold_45:  "Signal intelligence indicates the rival is interpreting your silence."
threshold_30:  "Forward commanders report declining confidence in restraint on both sides."
threshold_15:  "The decision horizon is closing. Inaction will be read as a signal."
threshold_5:   "Window expiring. No directive will default to contingency posture."
expired:       "No directive was issued inside the decision window."
```

### ns_missile_warning (75s decision window)
```
threshold_60:  "Warning operators await guidance on threat classification."
threshold_45:  "Regional embassies are requesting immediate confirmation of U.S. intent."
threshold_30:  "Electronic countermeasure coverage is degrading. The real clock is shorter than the display."
threshold_15:  "Launch-ready indicators are active. The window for preemptive clarity is nearly closed."
threshold_5:   "Final seconds. Silence will be interpreted as paralysis by both sides."
expired:       "No classification directive issued during the warning window."
```

### Generic (fallback for any future timed beat)
```
threshold_75:  "The clock is running. Your team awaits direction."
threshold_50:  "Time pressure is mounting. Options narrow with each passing moment."
threshold_25:  "The decision window is closing. Remaining options are increasingly constrained."
threshold_10:  "Critical seconds remaining. Inaction becomes the de facto decision."
expired:       "The timer expired without a directive."
```

---

## 4. Post-Game Causality Reveal Copy

These are shown after the episode completes when fog-of-war is lifted. They reference exact meter values, hidden state, and causal chains — none of this is visible during play.

### Terminal Outcome Summaries

**stabilization**
```
title: "Managed De-Escalation"
summary: "Through sustained diplomatic engagement and credible deterrence posture, you achieved a verified framework that reduced immediate confrontation risk. Alliance trust held above the fracture threshold and escalation pressure was contained below the critical band."
causal_note: "Key inflection: your policy mix kept escalationIndex below 45 while maintaining allianceTrust above 54 by turn {resolution_turn}. The ceasefire channel opened because both conditions held simultaneously — losing either would have routed to carrier_faceoff or frozen_line."
```

**frozen_conflict**
```
title: "Uneasy Deterrence"
summary: "Neither side escalated to open conflict, but no diplomatic framework emerged to resolve the underlying dispute. The crisis receded from immediate danger but remains structurally embedded in the region's security architecture."
causal_note: "The frozen outcome triggered because no terminal condition was met before turn limits. EscalationIndex peaked at {peak_escalation} on turn {peak_turn} but never crossed the war threshold while alliance trust held above fragmentation level. This is a deferred crisis, not a resolution."
```

**war**
```
title: "Strategic Breakdown"
summary: "A contested engagement crossed the political point of no return. Alliance cohesion splintered as capitals pivoted to force protection and national contingencies. The escalation index exceeded survivable thresholds while alliance trust collapsed beneath the coordination floor."
causal_note: "The war outcome required escalationIndex > 85, militaryReadiness > 60, AND allianceTrust < 35 — all three simultaneously. Your path crossed these thresholds because {primary_driver}. The critical turn was {critical_turn}, where {critical_action} pushed escalation past the point of diplomatic recovery."
```

**economic_collapse**
```
title: "Systemic Financial Break"
summary: "Credit channels seized, emergency interventions lagged, and strategic options narrowed under fiscal stress. The crisis transformed from a deterrence problem into a systemic economic stabilization emergency."
causal_note: "Economic collapse triggered when economicStability fell below 20 (final: {final_econ}). The cascade accelerated after turn {cascade_turn} when {cascade_trigger}. Market spiral dynamics compounded each turn — once economicStability dropped below 38, the trade_friction → market_spiral → economic_break path became nearly deterministic."
```

**regime_instability**
```
title: "Domestic Legitimacy Crisis"
summary: "Sustained pressure and contradictory emergency directives fractured domestic legitimacy. Security institutions pivoted inward as political continuity became uncertain, subordinating the external theater to domestic survival."
causal_note: "Regime instability triggered when domesticCohesion fell below 22 (final: {final_cohesion}). The info_war → urban_unrest → regime_shock path was driven by sustained cohesion erosion. Turn {critical_turn} was decisive — {critical_event} dropped cohesion below recovery threshold while your attention was on {player_focus}."
```

### Advisor Retrospective Lines (Post-Game)

These are for the post-game report where advisors comment on the outcome with full knowledge.

**Cross (Military)**
```
stabilization:      "Deterrence held because force posture was credible. That is the only reason the channel opened."
frozen_conflict:    "We avoided catastrophe but ceded strategic initiative. The corridor remains contested."
war:                "The failure was not military. It was the gap between signaling intent and maintaining alliance discipline."
economic_collapse:  "We cannot fight what we cannot fund. The economic front was the real center of gravity."
regime_instability: "Internal fracture always undermines external strategy. We lost the home front first."
```

**Chen (Diplomat)**
```
stabilization:      "The framework works because both sides found language they could sell domestically. That is fragile, not permanent."
frozen_conflict:    "The absence of war is not peace. We deferred the question, and the next crisis will arrive with less room."
war:                "Every missed off-ramp compounded the next. The trajectory became irreversible three turns before it looked that way."
economic_collapse:  "Economic collapse narrows political space to zero. There are no diplomatic options when governments cannot govern."
regime_instability: "When domestic legitimacy fractures, foreign policy becomes an afterthought. We lost agency before we lost the crisis."
```

**Okonkwo (Economic)**
```
stabilization:      "Markets will stabilize if verification holds. The spread compression has already begun."
frozen_conflict:    "Risk premium remains elevated. The market is pricing in the next escalation, not celebrating the pause."
war:                "The balance sheet absorbed what diplomacy could not. Recovery will be measured in quarters, not weeks."
economic_collapse:  "The cascade followed textbook stress mechanics: liquidity withdrawal, counterparty fear, then systemic lock. Earlier intervention was the only answer."
regime_instability: "Domestic instability is the one risk that monetary policy cannot reach. The economic damage is second-order but lasting."
```

**Reed (Intel)**
```
stabilization:      "The intelligence picture held long enough for the framework. Collection gaps remain — do not confuse resolution with clarity."
frozen_conflict:    "Both sides are still running operations in the shadow layer. The frozen surface conceals active maneuvering."
war:                "Attribution failures compounded decision errors. Better intelligence would not have prevented war, but it would have given us one more turn."
economic_collapse:  "Economic indicators were the clearest signal channel throughout. The intelligence community was watching the wrong dashboard."
regime_instability: "We tracked external threats while the domestic threat multiplied unchecked. That is a structural blind spot, not an operational failure."
```

---

## 5. Integration Notes

### JSON Pipeline Compatibility
All content above is structured for the `narrative_candidates_v1.json` companion file. The JSON uses typed entries with `category`, `id`, `scope`, and `variants` arrays. No YAML. No external dependencies.

### Determinism Contract
Every text template above uses only these substitution sources:
- `{action_name}` → `ActionDefinition.name` (from resolution)
- `{rival_action_name}` → rival `ActionDefinition.name` (from resolution)
- `{strongest_shift_meter}` → computed from `meterBefore` / `meterAfter` (deterministic)
- `{qualitative_shift}` → "rose/fell sharply/moderately" (deterministic function of delta)
- `{token_phrase}` → narrative token string replacement (deterministic)
- `{event_label}` → `EventDefinition.label` (from content data)
- `{resolution_turn}` / `{peak_turn}` / `{critical_turn}` → turn numbers from history
- `{peak_escalation}` / `{final_econ}` / `{final_cohesion}` → exact meter values (post-game only, fog lifted)
- `{primary_driver}` / `{cascade_trigger}` / `{critical_action}` / `{player_focus}` → derived from history array + action names

No LLM call required. No state mutation. All fog-of-war sensitive values (exact meters) appear only in Section 4 (post-game, fog lifted).

### Missing Content (Future Packs)
- Advisor lines for terminal beats (currently empty `{}` in scenario data)
- Image-linked narrative fragments (waiting on image asset pipeline)
- Inaction-specific advisor reactions ("You chose to hold. Cross is furious." etc.)
- Multi-advisor exchange formats (advisor disagreement dialogue)
