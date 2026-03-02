# CLAUDE_REVIEW.md — ESCALATION Phase 1 Bug/Risk/Regression Review

**Reviewer:** Claude (Cowork)
**Date:** 2026-03-02
**Commit:** `d849d8f` (main)
**Baseline checks:** All passed — lint (3 workspaces), ci:phase1 (content validation 0 errors, Monte Carlo 18/18 beat coverage, token regression, 13 vitest tests)

---

## Critical

### C-1 · `Date.now()` in countdown initialization breaks seed reproducibility

**Files:**
- `packages/engine/src/beatTraversal.ts` line 123 (`setCountdownForBeat`)
- `packages/engine/src/simulator.ts` lines 46–47 (`buildCountdownForBeat`)

Both countdown constructors call `Date.now()` to compute `expiresAt`. This means two episodes started from the same seed at different wall-clock times produce different `activeCountdown.expiresAt` values and, therefore, different `GameState` objects. The Monte Carlo simulator and token-regression scripts exercise these paths — their `expiresAt` values vary across runs, making serialized state non-reproducible.

`buildCountdownForBeat` accepts an optional `now` parameter (default `Date.now()`), but `setCountdownForBeat` does not — it hard-codes `Date.now()` at line 123.

**Impact:** Seed determinism contract is broken for any state that includes a countdown. Replay, save/restore, and regression testing of timed-beat flows are all affected.

**Recommended fix:** Thread a `nowMs` parameter from the caller (API request timestamp or test fixture) into all countdown construction. Remove all `Date.now()` calls from engine internals. `beatTraversal.setCountdownForBeat` should accept the same `now` parameter that `simulator.buildCountdownForBeat` already supports.

---

### C-2 · `view.ts` recalculates `secondsRemaining` with server-side `Date.now()`

**File:** `packages/engine/src/view.ts` line 26

```ts
secondsRemaining: Math.max(0, Math.ceil((state.activeCountdown.expiresAt - Date.now()) / 1000))
```

`toEpisodeView` is called on the server to serialize the client response. The `Date.now()` here means the value baked into the JSON response drifts depending on server processing time and serialization delay. Two identical game states produce different views.

**Impact:** Client receives a `secondsRemaining` that's already stale by network latency. If the client also independently counts down from `expiresAt`, the two values diverge, potentially triggering premature or delayed timeout detection.

**Recommended fix:** Either (a) remove the server-side recalculation entirely and let the client compute `secondsRemaining` from `expiresAt`, or (b) pass a reference `now` into `toEpisodeView` so it's at least consistent with the request timestamp.

---

### C-3 · `collectReachable` omits inaction-path beats from reachability analysis

**File:** `packages/engine/src/validation.ts` lines 25–49

`collectReachable` traverses `beat.branches` only. Beats reachable exclusively via `decisionWindow.inactionBeatId` are never added to the visited set.

If a beat is only reachable through an inaction/timeout path, the validator will report it as unreachable. The current Northern Strait scenario may mask this because inaction targets also happen to appear in branch targets, but any future scenario where an inaction-only beat exists will trigger a false "unreachable" warning (or silently inflate the unreachable count).

**Impact:** Content validation CI gate (`validate:content`) could produce false positives or miss genuine unreachable beats. Monte Carlo coverage assertions could pass while real graph topology gaps exist.

**Recommended fix:** Inside the `while` loop, also push `beat.decisionWindow?.inactionBeatId` if present and not yet visited. Same fix needed in `computeTerminalReachability` (line 71) which likewise only follows `beat.branches`.

---

## High

### H-1 · `buildCountdownForBeat` at line 510 uses post-traversal beat reference but naming suggests pre-traversal

**File:** `packages/engine/src/simulator.ts` line 510

```ts
state.activeCountdown = buildCountdownForBeat(activeBeat, state.timerMode);
```

After `traverseBeatGraph` at line 419 mutates `state.currentBeatId`, `activeBeat` is fetched at line 421 using the *new* `currentBeatId`. The variable name `activeBeat` is correct in that it reflects the post-traversal beat, so the countdown is built for the right beat. However, the naming is misleading — "active" suggests "currently active before resolution" when it's actually "the beat we just transitioned into."

More critically: if `traverseBeatGraph` did NOT transition (i.e., no branch conditions met), `activeBeat` still represents the current beat, and `buildCountdownForBeat` re-initializes the countdown for the same beat with a fresh `expiresAt`. This means that every turn on the same beat resets the timer, even if the player submitted an action well before expiry.

**Impact:** Players get a fresh timer every turn on a multi-turn beat, even if they're supposed to be under cumulative time pressure. This may be intentional design, but it contradicts the spec's "decision timer accumulates pressure" framing.

**Recommended fix:** Confirm whether countdown-reset-on-same-beat is intended. If not, only call `buildCountdownForBeat` when `traversal.beatIdAfter !== traversal.beatIdBefore`. Also rename `activeBeat` to `postTraversalBeat` for clarity.

---

### H-2 · `JSON.parse(stateJson)` without validation or error handling

**Files:**
- `apps/api/src/repository.ts` line 93
- `apps/api/src/index.ts` lines 202, 348, 454

Five call sites parse `stateJson` from the database with bare `JSON.parse()`. If the database contains corrupted or truncated JSON (D1 write failure, migration issue, manual edit), the worker crashes with an unhandled exception rather than returning a meaningful error.

**Impact:** A single corrupt episode row crashes the API for that request with no recovery path. No type validation means a structurally-valid-but-semantically-wrong state could propagate silently.

**Recommended fix:** Wrap in try/catch with a specific error response (e.g., 422 with `{ message: 'Corrupt episode state' }`). Optionally validate the parsed object against a Zod schema derived from `GameState`.

---

### H-3 · `ensureSchema` runs on every single request

**File:** `apps/api/src/index.ts` lines 48–51

```ts
app.use('*', async (context, next) => {
  await ensureSchema(context.env);
  await next();
});
```

Every request — including GET endpoints — executes schema creation DDL against D1. Even if D1 fast-paths `CREATE TABLE IF NOT EXISTS`, this adds latency and D1 read units to every request.

**Impact:** Unnecessary latency and cost at scale. On cold starts this is fine, but on warm workers serving repeated requests it's wasteful.

**Recommended fix:** Gate with a module-scoped boolean (`let schemaReady = false`), or move schema initialization to a one-time migration workflow. At minimum, only run on mutating endpoints.

---

### H-4 · Inaction route missing `insertBeatProgress` for the same-beat case

**File:** `apps/api/src/index.ts` lines 391–420 (inaction route) vs. lines 310–316 (timeout fallback in actions route)

The `/actions` route has a timeout fallback path (lines 297–316) that correctly calls `finalizeResolvedTurn`, which calls `insertBeatProgress`. The `/inaction` route (line 338+) has its own inline persistence logic (lines 391–420) that also calls `insertBeatProgress`. However, the timeout fallback in `/actions` and the explicit `/inaction` route use different `source` values and code paths.

The `/inaction` route never validates that `payload.source` is a legitimate `BeatTransitionSource` value beyond Zod schema check. If the Zod schema permits arbitrary strings, analytics data is polluted.

**Impact:** Potential analytics inconsistency between timeout-via-actions and explicit-inaction paths. Source field could contain unexpected values if schema is loose.

**Recommended fix:** Verify the Zod schema for `inactionSchema` restricts `source` to the `BeatTransitionSource` union. Add a shared helper for inaction resolution to avoid divergent code paths.

---

## Medium

### M-1 · CORS wide open (`origin: '*'`)

**File:** `apps/api/src/index.ts` line 43

The API accepts requests from any origin. For a Cloudflare Worker behind Cloudflare Access, this may be acceptable in early development, but it exposes the API to cross-origin abuse (CSRF-style state mutations, automated episode creation).

**Recommended fix:** Restrict to known origins (the deployed frontend domain and localhost for dev).

---

### M-2 · No rate limiting on any API endpoint

**File:** `apps/api/src/index.ts` (all routes)

No rate limiting, throttling, or abuse protection on episode creation, action submission, or countdown extension. A malicious client can create unlimited episodes or spam extend requests.

**Recommended fix:** Add Cloudflare rate limiting rules or a simple in-memory counter per IP for the Worker.

---

### M-3 · Debrief uses only the first narrative token for rival line

**File:** `packages/engine/src/debrief.ts` line 72

```ts
const rivalToken = payload.narrativeTokens[0];
```

`narrativeTokens` contains tokens from player side effects, rival side effects, and pre/post-rival events — not just rival tokens. The first token could easily be from the *player's* action. This means the rival debrief line may describe player effects attributed to the rival.

**Impact:** Debrief text could misattribute effects. Low gameplay severity today since the token is interpolated into a generic sentence, but breaks narrative accuracy.

**Recommended fix:** Filter `narrativeTokens` to only rival-sourced tokens before selecting the first, or pass rival tokens separately into `buildTurnDebrief`.

---

### M-4 · `extendActiveCountdown` doesn't persist via API

**File:** `apps/api/src/index.ts` lines 435–500+ (extend countdown route)

After calling `extendActiveCountdown(state, ...)`, the API calls `updateEpisodeStateOptimistic` which persists the new state. However, the `insertBeatProgress` call uses `transitionSource: 'extend'` even though no beat transition occurred — this inflates the `beat_progress` table with non-transition rows that look like transitions.

The `transitioned` field is correctly `false`, so it's queryable, but `timerExpired` is hardcoded `false` and `timerSecondsRemaining` captures the pre-extend value. The semantics are muddled.

**Recommended fix:** Either use a dedicated analytics event type for extensions (not `beat_progress`), or add a clear `eventType` column to disambiguate transition vs. extension vs. timeout rows.

---

### M-5 · Optimistic concurrency uses `expectedTurn` but state mutations don't bump it atomically

**File:** `apps/api/src/repository.ts` `updateEpisodeStateOptimistic`

The optimistic concurrency check compares `expectedTurn` against the stored `currentTurn`. But the new `currentTurn` is pulled from `nextState.turn`, which is bumped by the engine. If two concurrent requests both read turn N, both resolve turn N, and both try to write turn N+1, only one succeeds — which is correct. But if the engine throws mid-resolution (leaving `state.turn` still at N), the API catches the error and returns 400. Meanwhile, the state object has been partially mutated in memory (the engine mutates the state object in place). A retry would then operate on corrupted in-memory state.

**Impact:** Partial mutation on engine error could cause subtle bugs if the state object is reused (currently it's re-fetched from DB on retry, so this is theoretical, but the pattern is fragile).

**Recommended fix:** Deep-clone the state before passing to the engine, so the DB-fetched version remains pristine.

---

## Low

### L-1 · MeterDashboard and IntelPanel still rendered (spec says remove)

**File:** `apps/web/src/App.tsx` lines 339, 344 (imports at lines 16–17)

Tech spec Section 5 flags "Remove meter dashboard from play screen" and "Remove intel panel." Both components are still imported and rendered.

**Impact:** UI shows more information than spec intends. Not a bug per se, but a known spec-drift item.

---

### L-2 · Rival archetype still required (spec says remove)

**File:** `packages/content/src/index.ts` exports archetypes; `apps/api/src/index.ts` requires `rivalArchetypeId` in start request.

Decision D-028 (Codex Handoff) says "keep archetypes for now" and the spec flags removal as future work. Tracked but not a bug.

---

### L-3 · `openingBriefing` duplicated in initial state

**File:** `packages/engine/src/simulator.ts` line 112

`openingBriefing` is set from `context.scenario.openingBriefing`, and also exposed via `view.briefing` when `recentTurn` is null. This is correct behavior but the briefing is stored twice (once in `openingBriefing` field, once potentially in first history entry). Minor memory waste, no functional issue.

---

### L-4 · Timer countdown interval at 250ms may cause UI jank on slow devices

**File:** `apps/web/src/App.tsx` (timer `setInterval`)

The 250ms interval for countdown display is aggressive for low-end devices. A 1-second interval would be visually equivalent for a countdown displaying whole seconds and would reduce render thrash.

---

### L-5 · `timeoutGuardRef` prevents duplicate timeout but doesn't reset on new beat

**File:** `apps/web/src/App.tsx` (timeout guard logic)

The `timeoutGuardRef` is set `true` when a timeout fires, preventing duplicate submissions. If the player somehow advances to a new beat (via a concurrent response), the guard could remain `true` and block legitimate timeout handling on the next beat. Needs to reset when the beat changes.

---

## Gameplay Quality Improvements (Not Bugs)

### GQ-1 · Debrief could include beat-transition context

`buildTurnDebrief` doesn't reference whether a beat transition occurred. Adding a line like "The situation has shifted — intelligence reassessment underway" on beat transitions would improve narrative flow.

### GQ-2 · Post-game report could surface timer behavior analytics

The `buildPostGameReport` function doesn't incorporate `beat_progress` data about timer usage, extensions, or timeouts. Adding a "decision pacing" section to the report (average time-to-action, extensions used, timeouts) would add depth.

### GQ-3 · Inaction narrative could vary by remaining time

When a player explicitly chooses "Take No Action," the narrative uses the same `inactionNarrative` regardless of whether they had 90 seconds remaining or 2 seconds. Time-pressure-sensitive phrasing would improve immersion.

### GQ-4 · Advisor unlock could trigger a debrief line

When `applyBeatEntryEffects` unlocks a new advisor, no debrief or narrative acknowledges it. The player silently gains access. A brief acknowledgment line would improve discoverability.

### GQ-5 · Monte Carlo could test timer-pressure paths specifically

The Monte Carlo simulator doesn't exercise timeout/inaction branches at all — it always picks a random valid action. Adding a policy sweep that times out on timed beats (or picks inaction) would improve coverage of those paths.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| Critical | 3 | Determinism broken by `Date.now()` in engine; validation misses inaction paths |
| High | 4 | State parse fragility, schema overhead, analytics inconsistency |
| Medium | 5 | CORS, rate limits, debrief accuracy, concurrency fragility |
| Low | 5 | Spec drift (UI components, archetypes), minor UX/perf |
| Gameplay | 5 | Narrative depth, analytics richness, timer-aware content |

**Blocking for production:** C-1, C-2, C-3 (determinism + validation integrity)
**Should fix before playtesting:** H-1, H-2, M-3, M-5
**Can defer:** Everything else
