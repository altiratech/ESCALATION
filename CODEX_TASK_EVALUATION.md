# Codex Task Evaluation: Flashpoint Gameplay & UX Recovery

**Evaluator:** Claude (commissioned by Ryan)
**Date:** 2026-05-01
**Scope:** ALT-27 through ALT-42 (16 tasks)
**Verdict:** Strong work with specific corrections needed

---

## Overall Assessment

Codex produced a well-structured backlog that covers the right surface area. Task descriptions are evidence-grounded, acceptance criteria are mostly testable, file references are accurate, and relation links exist between tasks. This is above-average task creation for an AI agent.

**Score: 7.5/10** — solid coverage and structure, with corrections needed on priority calibration, one overlap, and two genuine gaps.

---

## What Codex Did Well

1. **Evidence-backed descriptions.** Every task cites specific file paths, line numbers, and observed behavior (e.g., ALT-40 cites exact capitalized IDs vs lowercase IDs with file locations). This is unusually good — most task-creation agents write generic problem statements.

2. **Dependency graph established.** ALT-27 blocks ALT-39, ALT-31, ALT-29. ALT-37 is related to ALT-40, ALT-30, ALT-28. ALT-34 is related to ALT-41, ALT-42. This isn't just a flat list — there's a sequencing logic.

3. **Correct scoping of ALT-38.** The API hardening task explicitly defers itself ("should not block UX recovery, but should happen before public playtest"). Good judgment on what's a gate vs what's parallel work.

4. **ALT-27 → ALT-39 chain is smart.** Measure diversity before tuning the graph. This prevents premature optimization on bad data.

5. **ALT-40 is precisely scoped.** Specific IDs named, exact mismatch explained, verification step defined. A developer can pick this up and execute without ambiguity.

---

## Issues to Correct

### Issue 1: Priority Inflation (Medium severity)

**Problem:** 11 of 16 tasks are marked High. This flattens the signal.

**Fix:** Demote these to Medium priority:
- ALT-28 (manual response variants) — UX enhancement, not a blocker
- ALT-29 (action influence on visuals) — depends on ALT-27/28, decorative layer
- ALT-30 (briefing layout redesign) — cosmetic, doesn't block gameplay
- ALT-32 (deploy config cleanup) — housekeeping, not user-facing

**Actual critical path (keep High):**
ALT-40 (broken IDs) → ALT-37 (content reconciliation) → ALT-39 (graph tuning) → ALT-35 (report fix) → ALT-34/41 (smoke tests validate everything)

### Issue 2: ALT-37 and ALT-40 Overlap (Low severity)

**Problem:** Both tasks address the same root cause — content packs targeting `northern_strait_flashpoint` while the active scenario is `northern_strait_black_swan`. ALT-40 is the precise ID-mismatch fix; ALT-37 is the broader "reconcile all packs" task.

**Codex's mitigation:** They ARE linked as `relatedTo`. The separation is defensible: ALT-40 is a 30-minute data fix, ALT-37 is a design decision about content precedence.

**Recommendation:** Keep both, but make ALT-40 explicitly block ALT-37 (it's currently only `relatedTo`). You can't reconcile packs until the ID format is fixed.

### Issue 3: ALT-32 and ALT-41 Boundary (Low severity)

**Problem:** ALT-32 (config cleanup) and ALT-41 (deploy smoke test) both touch the deploy verification script and `escalation.altiratech.com` assumptions.

**Codex's mitigation:** ALT-34 is linked as `relatedTo` ALT-41. But ALT-32 → ALT-41 dependency is not stated.

**Recommendation:** Add ALT-32 as `blockedBy` for ALT-41. The smoke test should validate the new config, not the old one.

### Issue 4: ALT-42 Over-tracked (Trivial)

**Problem:** "Add repo audit excludes for tmp caches" is a 5-minute `.gitignore`/`.editorconfig` fix. Creating a Linear ticket with acceptance criteria for this is process overhead.

**Recommendation:** Just do it inline during any other task that touches the repo root. Close the ticket or convert to a subtask of ALT-33.

---

## Verified Gaps Not Covered by Existing Tasks

After codebase inspection, here are the genuine gaps (I've removed false claims from my first pass — error boundaries, responsive layout, and rate limiting all already exist):

### Gap 1: State Schema Versioning (Should be a new task)

**Evidence:** `apps/api/src/stateSchema.ts` has Zod validation with fallback defaults but no explicit version field or migration system. If the state shape changes between deploys, in-progress games will fail with validation errors and no recovery path.

**Note:** ALT-38's acceptance criteria mention "state versioning or idempotency" as one bullet among many. This deserves its own focused task because:
- It requires a design decision (version field + migration functions vs snapshot-and-restart)
- It blocks public playtest (can't break active games on deploy)
- It's testable independently

**Suggested task:** "Add state schema version field and migration path" — High, 3pts, blocks ALT-38.

### Gap 2: Client-Side Analytics/Telemetry (Should be a new task)

**Evidence:** The API persists beat progress and turn logs to D1, but there's no client-side event tracking. No way to measure: session start/abandon rates, decision time distribution, where players drop off, which actions are most/least chosen, error rates by device/browser.

**Note:** ALT-38 mentions "analytics" in its title but the acceptance criteria only address API-side durability, not measurement instrumentation.

**Suggested task:** "Add lightweight client telemetry for playtest measurement" — Medium, 3pts. Acceptance criteria: emit events for session_start, decision_made (with timing), game_completed, game_abandoned; aggregate in D1 or external service; queryable for playtest debrief.

### Gap 3: Content Validation Not in Build Script (Minor)

**Evidence:** `validate:content` exists and runs in `ci:phase1`, but it's NOT part of the standard `npm run build` flow. A developer could introduce a broken content ID and only catch it when CI runs, not during local iteration.

**Recommendation:** Add to ALT-40's acceptance criteria: "Hook content ID validation into the build script so broken IDs fail fast locally." One line addition, not a separate task.

---

## Tasks That Need No Changes (Confirmed Good)

| Task | Verdict |
|------|---------|
| ALT-27 | Well-scoped diagnostic with clear output format. Smart "measure first" positioning. |
| ALT-33 | Appropriate Medium priority. Good scope: triage, not fix-everything. |
| ALT-34 | Clear smoke test spec. Realistic about CI limitations ("if not available in CI immediately, provide local harness"). |
| ALT-35 | Specific duplicate keys cited. Good dual scope: fix bug + improve readability. |
| ALT-36 | Thorough timer audit. 5pts appropriate for the UX + engine work. |
| ALT-38 | Good catch-all for API durability. Correctly deferred behind UX recovery. |
| ALT-39 | Explicitly depends on ALT-27 output. Correct sequencing. |

---

## Recommended Changes for Codex to Implement

### Priority Changes
```
ALT-28: High → Medium
ALT-29: High → Medium
ALT-30: High → Medium
ALT-32: High → Medium
```

### Relation Changes
```
ALT-40 should BLOCK ALT-37 (currently only relatedTo)
ALT-32 should BLOCK ALT-41 (no current relation)
```

### Acceptance Criteria Addition
```
ALT-40: Add bullet: "Hook content ID validation into the build script (not just CI)
so broken IDs fail fast during local dev."
```

### New Tasks to Create
```
1. "Add state schema version field and migration path"
   Priority: High | Estimate: 3pts
   Blocks: ALT-38
   AC: Add version field to game state schema; write migration function template;
       ensure existing unversioned states are handled gracefully on load;
       add test for state from previous version loading correctly.

2. "Add lightweight client telemetry for playtest measurement"
   Priority: Medium | Estimate: 3pts
   AC: Emit events for session_start, decision_made (with timing),
       game_completed, game_abandoned; persist to D1 analytics table;
       add one query script to summarize playtest engagement.
```

### Task to Close or Downgrade
```
ALT-42: Convert to subtask of ALT-33, or just fix inline (5-min change).
```

---

## Summary for Codex

Your task creation was strong — evidence-grounded, well-linked, and covering the right areas. The main feedback: (1) deflate priorities so the critical path is legible, (2) tighten the ALT-40 → ALT-37 dependency from "related" to "blocks," (3) add state versioning as its own task rather than burying it in ALT-38, and (4) add the build-time validation hook to ALT-40's scope. The gap analysis turned up less than expected because you correctly identified the major issues — the remaining gaps are instrumentation (telemetry) and resilience (state migration), both pre-playtest concerns.
