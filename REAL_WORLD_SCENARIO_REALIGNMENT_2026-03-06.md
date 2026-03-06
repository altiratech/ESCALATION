# ESCALATION Real-World Scenario Realignment

Date: 2026-03-06  
Scope: `/Users/ryanjameson/Desktop/Lifehub/Code/active/Wargames`

## Purpose

ESCALATION is being repositioned from a well-authored fictional crisis prototype into a real-world scenario-intelligence product.

Locked direction:
- Real places, geography, alliances, trade routes, infrastructure, and conflict context
- Fictional individual leaders, advisors, and named companies where needed
- Same deterministic engine and content architecture
- Northern Strait remains a useful prototype, but it should not stay the public-facing flagship scenario

## Product Framing

ESCALATION should be framed as interactive scenario intelligence for three user groups:
- Public officials: national security, emergency management, infrastructure, cyber, continuity
- Corporate executives: CEO/COO/CTO/CISO/general counsel resilience and continuity planning
- Financial executives: investment, risk, operations, compliance, and market-contingency planning

Commercial wedge:
- Financial and risk users are the strongest monetization path
- Public-official scenarios remain valuable as the free/acquisition layer because they are easier to explain and more shareable

Platform fit:
- Atlas = current world conditions and operational exposure
- Signal = entity, sanctions, and compliance exposure
- ESCALATION = forward scenario layer showing how a crisis could evolve

## Content Audit

### Keep As-Is Or With Light Editing

These assets have the right structure and should be reused.

- `packages/content/data/narrative_candidates_v2.json`
  - Keep advisor voice system, pressure text structure, debrief/causality scaffolding
  - Rewrite any references only if they rely on fictional theater language
- `packages/content/data/advisor_dossiers.json`
  - Keep the fictional advisors, their roles, and reasoning styles
  - Light edits only if a role title needs better alignment to the chosen real-world lens
- `packages/content/data/debrief_deep_ns.json`
  - Keep the report structure and analytical style
  - Rewrite references to fictional states and theater-specific details
- `packages/content/data/cinematics_ns.json`
  - Keep presentation structure
  - Rewrite theater language and opening facts

### Keep Structure, Rewrite References

These files are useful, but they are currently anchored to fictional geography or fictional states.

- `packages/content/data/scenario_world_ns.json`
  - Strong schema and useful level of detail
  - Must be rewritten around a real named theater, real logistics and alliance stakes, and a baseline date
- `packages/content/data/scenarios.json`
  - Keep beat graph, branch logic, and action mappings where possible
  - Rewrite beat text, briefing copy, headlines, and any fictional-world references
- `packages/content/data/action_narratives_ns.json`
  - Keep the category structure and action-resolution pattern
  - Rewrite execution and consequence copy around real-world theater logic
- `packages/content/data/rival_leader_ns.json`
  - Keep the reveal structure
  - Re-anchor it to a fictionalized leader operating inside a real country and real strategic context
- `packages/content/data/intel_fragments_ns.json`
  - Keep the fragment schema and pacing
  - Rewrite to real-world geography, real institutions, real trade and military stakes
- `packages/content/data/news_wire_ns.json`
  - Keep the newsroom/output structure
  - Rewrite headlines and ledes around real-world context

### Retain As Internal Prototype Reference

- Current Northern Strait scenario naming and fictional country system (`Kaltor`, `Helix`, `Castan Basin`)
  - Useful for internal testing and continuity
  - Not suitable as the public-facing flagship if ESCALATION is meant to model real-world crisis dynamics

## First Flagship Recommendation

Recommended public flagship:
- Taiwan Strait crisis

Why this is the best first conversion target:
- Immediately legible to general users
- High-stakes public-official scenario for acquisition
- Natural corporate continuity implications: shipping, semiconductors, suppliers, cloud, logistics
- Natural financial implications: sanctions, insurance, shipping disruption, commodity stress, portfolio rotation, counterparty risk
- Strong fit with Altira platform positioning

Recommended rule:
- Same crisis core, multiple role lenses
  - Public-official lens for acquisition
  - Corporate lens for resilience and continuity
  - Financial lens for paid/professional value

## Required Scenario Content Standard

Every flagship scenario should answer the following within the first 20 seconds of use:
- Where is this happening?
- Why does this location matter?
- Who is involved?
- What happened today that triggered the crisis?
- What is at risk in the next 24 to 72 hours?
- What is the player actually being asked to decide?

Every scenario should include:
- Baseline date
- Real location and region
- Real strategic and commercial significance
- Real involved states, blocs, and institutions
- Trigger incident with timestamp
- Immediate risk horizon
- Role-specific consequence framing
- Public-information disclaimer and scenario versioning

## Immediate Next Build Sequence

1. Fix live UX clarity issues so the current build is easier to evaluate
   - Advisor collapse bug
   - Make action cards the primary path to advance
   - Move command input into a secondary/advanced role

2. Replace the fictional flagship scenario foundation
   - New real-world scenario-world file
   - Re-anchored opening brief and turn-one framing

3. Convert the supporting content packs in order
   - Scenario world
   - Headlines and intel fragments
   - Action narratives
   - Rival leader / deep debrief / cinematics

4. Only then expand scenario count

## Non-Goals For This Realignment

- Do not discard the existing content framework
- Do not create separate products for public, corporate, and financial users
- Do not continue investing in fictional-theater positioning for the public flagship
