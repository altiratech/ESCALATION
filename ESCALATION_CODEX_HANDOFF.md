# ESCALATION CODEX HANDOFF

Date: 2026-03-02
Workspace: `/Users/ryanjameson/Desktop/Lifehub/Code/active/Wargames`
Thread scope limitation: This thread ran under `Code/active/Wargames` and could not read/write `Lifehub/SYSTEM/*` coordination files.

## 1) Implementation Status

### 1.1 What has been built in this thread

1. Requirements re-lock from updated docs was completed before implementation.
2. Phase 1 beat-graph engine scaffolding was implemented end-to-end.
3. Deterministic Turn Debrief (causal panel payload) was implemented in engine and surfaced in UI.
4. Timer accessibility mode plumbing was added (state + start UI + API parameter).
5. Phase 1 content tooling was implemented and wired into npm scripts: validator, Monte Carlo, token regression.
6. Tests were added for beat traversal and beat validation.
7. Docs were updated with new commands and Phase 1 gates.

### 1.2 Working code paths and current file state

1. Shared types significantly extended:
- `packages/shared-types/src/index.ts`
- Added beat graph types (`BeatNode`, `BranchCondition`, `Condition`, `BeatDecisionWindow`), timer/debrief types, state extensions (`currentBeatId`, `beatHistory`, `timerMode`, `activeCountdown`, `turnDebrief`), and new interfaces (`CompressedStateSummary`, `InterpretedAction`, `ChatMessage`).

2. Scenario content now contains authored beat graph in JSON:
- `packages/content/data/scenarios.json`
- `northern_strait_flashpoint` now includes `role`, `meterLabels`, `startingBeatId`, `beats[]` (18 beats), branch conditions, timed beats, and terminal outcomes.

3. Beat traversal implemented:
- `packages/engine/src/beatTraversal.ts`
- Includes ordered branch evaluation, condition checks across meter/latent/belief domains, priority sorting, turn gating, action-tag gating, meter overrides, advisor unlocks, and countdown setup.

4. Simulator integration completed:
- `packages/engine/src/simulator.ts`
- `initializeGameState(...)` now seeds beat/timer/debrief fields.
- `resolveTurn(...)` now traverses beat graph post-resolution, applies terminal beat outcome path, and includes beat transition data in `TurnResolution`.

5. Deterministic debrief builder implemented:
- `packages/engine/src/debrief.ts`
- Produces 2–3 lines with tags: `PlayerAction`, `SecondaryEffect`, `SystemEvent`.
- Uses qualitative wording to reduce hidden-state leakage.

6. Narrative now beat-aware:
- `packages/engine/src/narrative.ts`
- Added `buildOpeningNarrativeFromBeat(...)` and optional beat-aware stitching inputs.

7. Episode view now exposes new gameplay fields:
- `packages/engine/src/view.ts`
- Exposes `meterLabels`, `currentBeatId`, `beatHistory`, `timerMode`, `extendTimerUsesRemaining`, `activeCountdown`, `turnDebrief`.

8. API start endpoint accepts timer mode:
- `apps/api/src/index.ts`
- `POST /api/episodes/start` accepts optional `timerMode` and forwards it into `initializeGameState`.

9. UI shows Turn Debrief panel and timer mode selection at episode start:
- `apps/web/src/components/BriefingPanel.tsx`
- `apps/web/src/components/StartScreen.tsx`
- `apps/web/src/App.tsx`

10. Validation and balancing tooling added:
- `packages/engine/src/validation.ts`
- `scripts/validate-content.ts`
- `scripts/monte-carlo.ts`
- `scripts/token-regression.ts`
- `packages/engine/src/css.ts` (CSS builder + serialization + coarse token estimate used by token regression script)

11. Tests added/updated:
- `tests/engine/beat-traversal.test.ts`
- `tests/engine/beat-validation.test.ts`
- `tests/engine/outcome.test.ts` updated for expanded history entry schema.

12. README updated with new scripts and gates:
- `README.md`

13. Exports updated:
- `packages/engine/src/index.ts`

14. Root scripts updated:
- `package.json` includes `validate:content`, `simulate:balance`, `test:token-regression`, `ci:phase1`.

### 1.3 Verification status

1. `npm test` passes.
2. `npm run lint` passes (engine/api/web typecheck).
3. `npm run ci:phase1` passes.
4. `npm run validate:content` passes (0 errors, 0 warnings).
5. `npm run test:token-regression` passes.
6. `npm run simulate:balance` passes gate; emits warnings for concentrated all-dove policies.

### 1.4 Partially done

1. Timer accessibility is only partially implemented.
- Implemented: `timerMode` selection and state plumbing.
- Not implemented: live countdown loop behavior in frontend, `Extend Timer` button behavior, turn timeout auto-resolution path.

2. Turn Debrief is implemented as a deterministic panel, but not fully spec-complete.
- Implemented: tagged lines and deterministic generation.
- Not implemented: explicit full post-game causality reveal section with hidden-driver reconstruction.

3. Beat graph is integrated into simulator and content, but persistence/analytics is partial.
- Implemented: runtime beat progression in `GameState`.
- Not implemented: dedicated DB tables (`beat_progress`, `chat_messages`, `advisor_state`, `llm_calls`) and related persistence endpoints.

### 1.5 Not started in this thread

1. Free-form player input pipeline (`Interpret`, plausibility routing, rejection narrative).
2. LLM stitch routing by beat phase and model routing enforcement.
3. Improvise path.
4. Advisor system implementation beyond placeholder advisor IDs in beat data.
5. Situation Room UI redesign from technical spec (chat-first feed and ambient strip behavior).
6. Multi-scenario expansion from Scenario Bible.

## 2) Architecture Decisions Made

1. Use the updated `.docx` files as roadmap source-of-truth for this implementation pass.
- Reason: user explicitly requested roadmap be driven by updated docs created with Claude.

2. Keep Cloudflare-native runtime and existing monorepo stack unchanged.
- Reason: locked decision set (React+Vite, Hono Worker, D1, Drizzle, TS engine).

3. Implement beat graph directly in existing JSON scenario content file (`scenarios.json`).
- Reason: fastest integration with current content loader and current engine data model.
- Tradeoff: diverges from YAML authoring direction in technical spec.

4. Integrate beat traversal into simulator post-turn sequence.
- Reason: aligns with spec traversal timing after turn resolution.

5. Keep deterministic engine authority and avoid LLM mutation of game state.
- Reason: core design principle for causality/reproducibility.

6. Implement Turn Debrief as deterministic engine output, then render in Briefing panel.
- Reason: matches user agreement that causal feedback layer should be added without restoring old dashboard paradigm.

7. Add timer accessibility mode now as schema/plumbing first.
- Reason: requested to formalize accessibility concern in roadmap while minimizing refactor risk in this pass.

8. Build Phase 1 tooling as executable scripts and wire into CI-style root command (`ci:phase1`).
- Reason: explicit user ask to formalize validator + Monte Carlo + token regression as deliverables.

9. Use coarse token estimator (`length/4`) for regression gate in Phase 1 script.
- Reason: deterministic, local, dependency-free baseline gate; fast to run in CI.

10. Use `node --import tsx` instead of `tsx` CLI for scripts.
- Reason: sandbox environment threw EPERM on `tsx` IPC pipe creation.

11. Keep rival archetype model intact for now.
- Reason: existing API/UI/engine were already wired to archetypes; removing it would be a broader refactor not required to ship current Phase 1 additions.

12. Adjust beat branch thresholds to ensure Monte Carlo beat coverage reaches all authored beats.
- Reason: initial gating failed due unreachable stabilization path under policy sweeps.

13. Keep per-policy concentration as warning, not hard fail.
- Reason: strict all-dove policy naturally converged heavily; overall degenerate distribution and beat coverage remain gated as hard failures.

## 3) Rejected Approaches

1. Rewriting the project to Next.js/Prisma stack.
- Rejected because this thread followed the Cloudflare-native locked stack.

2. Waiting to implement Turn Debrief until full UI redesign.
- Rejected because Turn Debrief was a high-priority feedback feature user explicitly wanted now.

3. Using `tsx` CLI scripts directly.
- Rejected due sandbox EPERM IPC failure.

4. Failing Monte Carlo gate for each archetype-policy pair when >80% terminal concentration.
- Rejected because this caused repeated false-positive gate failures for intentionally extreme policy probes (`all_dove`).

5. Migrating content immediately to YAML beat files.
- Rejected in this pass to avoid broad parser/content pipeline rewrite; kept current JSON path for velocity.

6. Removing rival archetypes immediately per technical spec breaking-change note.
- Rejected for this pass due high blast radius across start flow, game state, API, and action selection logic.

## 4) Current Blockers / Known Issues

1. No Git metadata in shell context.
- `git status` returns `fatal: not a git repository` in this environment.
- Impact: cannot provide normal commit-level diff tracking from this thread context.

2. Timer system incomplete.
- No real-time countdown progression in frontend.
- No `Extend Timer` button usage path.
- No API endpoint/action to trigger no-action timeout branch automatically.

3. UI spec mismatch remains.
- `MeterDashboard` and `IntelPanel` are still present in web UI.
- Technical spec includes a redesign away from old dashboard style; this is not yet applied.

4. Rival archetype breaking change not applied.
- Technical spec includes removal of player-selected rival archetypes, but code still requires and uses them.

5. Monte Carlo warning concentration for all-dove policies.
- Not blocking, but indicates balance tuning may still need iteration by policy style.

6. Post-game Full Causality Report (as defined in updated spec) is not fully implemented.
- Existing report exists, but does not yet reveal hidden drivers/branch-not-taken detail to spec depth.

7. D1 schema not extended for new phase-level tables.
- `beat_progress`, `chat_messages`, `advisor_state`, `llm_calls` not yet added.

## 5) Spec Drift

### 5.1 Drift against `ESCALATION_Technical_Spec_v1.docx`

1. Rival archetype removal not implemented.
- Spec note indicates removal as breaking change.
- Current code still uses archetype selection (`StartScreen`, `GameState.rivalArchetypeId`, API start payload).

2. Dashboard removal not implemented.
- Spec indicates `MeterDashboard` and `IntelPanel` removal in redesigned UX.
- Both still render in `apps/web/src/App.tsx`.

3. Timer system incomplete.
- Spec details full timed-beat UX, timer progression, expiry flow, Extend Timer affordance, and analytics metadata.
- Current implementation only covers timer mode storage/plumbing and beat metadata.

4. Turn Debrief is partial.
- Implemented deterministic debrief lines.
- Missing full post-game “Full Causality Report” reveal mechanics per Section 9.4 depth.

5. Content authoring format differs.
- Spec references YAML beat content pipeline.
- Implementation keeps beat content in JSON inside `scenarios.json`.

6. CI degenerate distribution interpretation differs.
- Spec language can be read as broad distribution gate; implementation hard-fails overall degeneracy, warns on per-policy concentration.

7. LLM jobs and chat system not implemented.
- Interpret/Stitch/Improvise flow, prompt templates, routing, and chat-first UI remain future work.

### 5.2 Drift against `ESCALATION_Scenario_Bible_v1.docx`

1. Only one scenario implemented.
- Scenario Bible outlines wider scenario family structure.
- Current implementation remains single-scenario MVP scope (`Northern Strait`).

2. Scenario specificity and cast depth not fully aligned.
- Current beat content includes authored beats and placeholder advisor IDs.
- It does not yet reflect full narrative roster/depth from Bible-level production content.

3. Cross-domain bleed and deception beats are present in spirit but not formally audited against Bible criteria.
- Needs explicit content QA pass against Bible requirements.

## 6) Next Steps (Ordered)

1. Move to Lifehub-root thread and sync SYSTEM protocol first.
- Start new Codex thread scoped to `/Users/ryanjameson/Desktop/Lifehub`.
- Read `SYSTEM/HANDOFF.md`, `SYSTEM/DECISIONS.md`, `SYSTEM/KNOWN_CONTEXT.md` at start.
- Log this handoff into system docs before further implementation.

2. Decide and execute rival-archetype direction.
- Option A: keep archetypes for MVP (document deviation).
- Option B: remove archetype selection and scenario-embed adversary behavior per technical spec; refactor API/UI/state accordingly.

3. Finish timed-beat runtime behavior.
- Implement live countdown in UI for beats with `decisionWindow`.
- Implement timer thresholds/visual urgency states.
- Implement timeout-to-inaction branch transition path.
- Implement `Extend Timer` button logic and decrement tracking.

4. Finish timer accessibility behavior.
- Enforce `standard`, `relaxed`, `off` semantics.
- In `off` mode, expose explicit “Take No Action” action path instead of timeout.
- Persist metadata needed for analytics segmentation.

5. Align UI with agreed direction (narrative-first + causal debrief, no redundant numeric duplication).
- Remove or significantly rework current `MeterDashboard`/`IntelPanel` depending on final product call.
- Build ambient status strip and narrative feed structure from spec.

6. Upgrade Turn Debrief to full causality pipeline.
- Keep in-turn debrief fog-safe.
- Add full post-game reveal section with hidden deltas, adversary logic summary, system events not shown in turn view, and branch-not-taken summaries.

7. Extend persistence schema for phase roadmap.
- Add D1 migrations for `beat_progress`, `chat_messages`, `advisor_state`, `llm_calls` (if proceeding into Phase 2/3 work).

8. Tighten Monte Carlo and balancing outputs.
- Emit structured JSON reports per scenario/policy/archetype.
- Add threshold config file.
- Add deterministic replay sample exports for tuning.

9. Strengthen token regression suite.
- Move from coarse static sample prompts toward prompt-template snapshot tests tied to real template files.
- Add budget baselines by phase and model route.

10. Reconcile content format choice.
- Either formalize JSON as accepted standard for now, or implement YAML pipeline with validation/build conversion.

11. Phase 2 prep.
- Integrate CSS builder into real LLM stitch adapter path (still deterministic fallback first).
- Add controlled chat log model and endpoint surfaces.

## 7) Environment & Tooling Notes

1. Runtime versions used in this thread:
- Node: `v20.17.0`
- npm: `10.8.2`

2. Package manager:
- npm workspaces (root `package.json` orchestrates app/package scripts).

3. Key commands:
- Install: `npm install`
- Dev: `npm run dev`
- Tests: `npm test`
- Typecheck: `npm run lint`
- Content validation: `npm run validate:content`
- Monte Carlo: `npm run simulate:balance`
- Token regression: `npm run test:token-regression`
- Combined Phase 1 gate: `npm run ci:phase1`

4. Important tooling nuance:
- `tsx` CLI failed in this sandbox with EPERM (IPC pipe create/listen).
- Root scripts were changed to `node --import tsx ...` to avoid this issue.

5. Local DB/dev notes:
- Existing scripts for local D1 migration/seed remain in place (`npm run db:migrate`, `npm run db:seed`).

6. Test status at handoff time:
- `npm run lint` passed.
- `npm run ci:phase1` passed.
- Monte Carlo emits warnings for all-dove concentration but does not fail gate.

## 8) Open Questions for Ryan

1. Rival model direction: keep archetype selector in MVP for continuity, or enforce technical spec breaking change and remove it now?

2. UI direction priority: should we remove the current meter dashboard/intel panel immediately to match narrative-first spec, or keep temporarily while building ambient strip/chat feed?

3. Monte Carlo gate policy: should per-policy >80% terminal concentration be warning (current) or hard fail?

4. Content format decision: keep JSON beat authoring for speed, or move now to YAML as spec describes?

5. Timer behavior priority: should timed-beat runtime + Extend Timer be the very next coding task before any further narrative/LLM work?

6. Scenario content strategy: continue deepening only Northern Strait first, or begin aligning additional Scenario Bible scenarios in parallel once timer/debrief UX is complete?

7. Spec authority in case of conflict: if Technical Spec says dashboard removed but practical playtesting benefits from minimal numeric hints, which should take precedence right now?

8. Should we add explicit legal-fiction disclaimer text into UI/start screen now, or defer until broader content pass?

## 9) Session Update — 2026-03-02 (Lifehub protocol resumed)

### 9.1 What changed in this session

1. Mandatory Lifehub protocol was executed first:
- Read `SYSTEM/HANDOFF.md`, `SYSTEM/DECISIONS.md`, `SYSTEM/KNOWN_CONTEXT.md`.
- Confirmed `Code/active/Wargames` has no `.git` metadata in this environment.
- Re-read source-of-truth docs:
  - `ESCALATION_Technical_Spec_v1.docx`
  - `ESCALATION_Scenario_Bible_v1.docx`

2. Pre-edit baseline gates were rerun:
- `npm run lint` passed.
- `npm run ci:phase1` passed (same known Monte Carlo concentration warnings for `all_dove` policies).

3. Timed-beat runtime was implemented end-to-end (priority milestone 1):
- Shared types:
  - `ActiveCountdown` now includes `expiresAt`.
  - Added request types for inaction and countdown extension.
- Engine:
  - Countdown timestamps now initialized deterministically at beat entry.
  - Added reusable beat-entry effects.
  - Added `extendActiveCountdown(...)` with constraints:
    - max one extension per beat
    - consume episode-level `extendTimerUsesRemaining`
    - +50% duration
  - Added `resolveInactionTurn(...)`:
    - timeout and explicit no-action paths
    - applies authored `inactionDeltas`
    - transitions to authored `inactionBeatId`
    - writes deterministic narrative + turn debrief + history entry
- API:
  - Existing `/actions` route now auto-resolves timeout branch if countdown already expired server-side.
  - Added `POST /api/episodes/:episodeId/inaction`.
  - Added `POST /api/episodes/:episodeId/countdown/extend`.
- Web:
  - Added ambient status strip countdown with urgency thresholds and progress bar.
  - Added Extend Timer control wired to new API endpoint.
  - Added explicit `Take No Action` control when `timerMode=off` and current beat is timed.
  - Added automatic timeout submission when countdown reaches zero.
- Tests:
  - Added `tests/engine/timer-runtime.test.ts` covering:
    - extension constraints
    - timeout-to-inaction resolution
    - explicit off-mode no-action path

### 9.2 Current verification after edits

1. `npm run lint` passed.
2. `npm run ci:phase1` passed.
3. `vitest` suite passed (7 files / 12 tests).
4. Monte Carlo concentration warnings remain unchanged and non-blocking.

### 9.3 Spec drift still remaining

1. Rival archetype removal still not implemented (breaking-change note remains open).
2. Dashboard/Intel panel removal still not implemented (`MeterDashboard` + `IntelPanel` still rendered).
3. Full post-game `Full Causality Report` depth remains partial.
4. YAML content pipeline still not adopted (content remains JSON).
5. New D1 analytics/persistence tables not yet added:
- `beat_progress`
- `chat_messages`
- `advisor_state`
- `llm_calls`

### 9.4 Exact next action for resume

1. Implement persistence + analytics metadata for timed beats and traversal:
- Add schema + repository support for `beat_progress` first.
- Persist timer usage metadata (mode, timeout vs explicit inaction, extension usage) per turn.
- Re-run `npm run lint` and `npm run ci:phase1`.
