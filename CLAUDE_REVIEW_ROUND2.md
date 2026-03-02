# CLAUDE_REVIEW_ROUND2.md — ESCALATION Deep Review (Round 2)

**Reviewer:** Claude (Cowork)
**Date:** 2026-03-02
**Commit:** `c93a10d` (main)
**Baseline checks:** All passed — lint (3 workspaces), ci:phase1 (content validation 0 errors, Monte Carlo 18/18 beat coverage, token regression, vitest 16/16 tests across 9 files)

**Scope:** This review covers findings NOT addressed in Round 1 (`CLAUDE_REVIEW.md`). Round 1 Critical items (C-1, C-2, C-3) and High items (H-1, H-2, H-3, H-4) have been **fixed** in subsequent commits (`30c2d52`, `ded051d`, `ba8873f`). This round validates those fixes and identifies new findings from a deeper pass across all source files.

---

## A) Critical / High Findings

### R2-C1 · `Date.now()` in default seed construction (non-deterministic seed generation)

**File:** `apps/api/src/index.ts` line 129

```ts
const seed = payload.seed ?? `${payload.profileId}:${Date.now()}`;
```

When the client omits `seed`, the API generates one using `Date.now()`. This means replay/reproduction requires the client to always supply an explicit seed. The engine itself is now properly deterministic (C-1 fix applied), but the default seed generation defeats reproducibility at the API entry point.

**Impact:** Any episode started without an explicit seed cannot be replayed. Seed-based regression testing from the API layer is broken unless the test harness always specifies a seed. This is a design gap more than a bug — the engine is fine — but it undermines the determinism contract at the system level.

**Severity:** High (not Critical because the engine internals are fixed; this is an API-layer default)

**Fix path:** Replace `Date.now()` with a deterministic seed derivation (e.g., `${profileId}:${episodeId}` — the `episodeId` is already a UUID generated one line later). If wall-clock uniqueness is desired, document that omitting `seed` opts out of replay.

---

### R2-C2 · `Date.now()` in report generation view (residual determinism leak)

**File:** `apps/api/src/index.ts` line 604

```ts
const view = toEpisodeView(episode, actionMap, imageMap, Date.now());
```

The `/api/episodes/:episodeId/report` GET handler calls `toEpisodeView` with `Date.now()`. This is the only remaining `Date.now()` call that feeds into the engine's `toEpisodeView`. All other endpoints (start, actions, inaction, extend) correctly use `requestTimestamp` captured at the top of the handler.

For completed episodes, `activeCountdown` is null (cleared on completion at simulator.ts line 512), so the `nowMs` parameter is inert. However: (a) if a report is requested for a non-completed episode that somehow bypasses the `status !== 'completed'` check (e.g., a code refactor removes the guard), the `Date.now()` would produce non-deterministic countdown recalculation, and (b) it's an inconsistency that invites copy-paste propagation.

**Impact:** Currently inert because the guard at line 585 rejects non-completed episodes. Fragile — a future refactor removing that guard would re-introduce a C-1-class bug.

**Severity:** High (latent, but directly in the `Date.now()` class that required a Critical fix in Round 1)

**Fix path:** Capture `const requestTimestamp = Date.now()` at the top of the handler (like all other endpoints) and thread it through. Consistent pattern eliminates the risk.

---

### R2-H1 · Timer extension race: `expectedTurn` doesn't change on extend, allowing concurrent extend+action

**File:** `apps/api/src/index.ts` lines 481–569 (extend route) vs. lines 208–363 (actions route)

The optimistic concurrency check in `updateEpisodeStateOptimistic` (repository.ts line 129) uses `currentTurn` as the version column. Timer extension does NOT increment the turn (correct — it's not a turn). But this means:

1. Client sends `POST /extend` with `expectedTurn: 5`
2. Simultaneously, client sends `POST /actions` with `expectedTurn: 5`
3. Both read `currentTurn = 5` from DB
4. Extend resolves first, writes state with `currentTurn = 5` (unchanged) → succeeds
5. Action resolves, writes state with `currentTurn = 6` → `WHERE currentTurn = 5` matches → also succeeds

The action handler overwrites the extended countdown with a fresh resolution, effectively discarding the extension. The player sees their extension credit consumed (the DB state from step 4 was overwritten) but gets no actual time benefit.

**Impact:** Extension credits silently wasted under concurrent requests. Low probability in single-player, but a real race if the client fires rapidly (e.g., extend button click during network retry of an action).

**Severity:** High

**Fix path:** Add a secondary version column (e.g., `stateVersion INTEGER` incremented on every write) or use a composite check (`currentTurn` + `activeCountdown.extendsUsed`). Alternatively, serialize all writes per episode with a D1 transaction or queue.

---

### R2-H2 · `ensureSchema` module-scoped flag resets on Worker eviction (cold-start schema race)

**File:** `apps/api/src/db.ts` lines 118–137

The `schemaReady` boolean is module-scoped. On Cloudflare Workers, module scope is per-isolate and resets when the Worker is evicted. The `schemaReadyPromise` deduplication at line 124 handles concurrent requests within a single isolate lifetime, but there's a window: if two requests arrive on a cold isolate simultaneously, they both enter `ensureSchema` before `schemaReadyPromise` is set. The first sets `schemaReadyPromise`; the second awaits it. This works correctly.

However, `schemaReady` is set to `true` inside the async IIFE (line 133), and the early return at line 122 checks it synchronously. If a request arrives after the promise starts but before it resolves, and the JS runtime interleaves execution, the request hits line 122 (`schemaReady` still `false`), then line 124 (`schemaReadyPromise` exists), and awaits correctly. This path is safe.

**Actual issue:** The `CREATE TABLE IF NOT EXISTS` DDL is idempotent, so concurrent execution is safe from a correctness standpoint. But on cold starts with many simultaneous requests, N-1 of them wait on `schemaReadyPromise` while the first one serially executes 14 DDL statements. D1 rate limits may cause failures under burst traffic.

**Severity:** Medium (previously listed as H-3 in Round 1 — the fix applied is correct; residual risk is burst-traffic cold-start latency, not correctness)

**Fix path:** Consider a separate migration script run at deploy time (like Atlas's approach) rather than runtime DDL. This eliminates cold-start DDL entirely.

---

### R2-H3 · `turnLog` insert uses `onConflictDoNothing` — silent data loss on retry

**File:** `apps/api/src/repository.ts` lines 141–156

```ts
await db.insert(turnLogs).values({ ... }).onConflictDoNothing();
```

The turn log primary key is `${episodeId}:${resolution.turn}`. If the same turn is resolved twice (e.g., the first write succeeded but the response was lost, and the client retries), the second insert is silently dropped. This is intentional for idempotency — but the second resolution may have different data (different `requestTimestamp`, different server-side timing).

More critically: the `insertBeatProgress` call (lines 160–192) does NOT use `onConflictDoNothing` — it generates a fresh UUID each time. So a retry would insert a duplicate beat_progress row while silently dropping the turn_log. Analytics now show two beat_progress entries for one turn_log entry.

**Impact:** Analytics inconsistency on retry. Not a gameplay bug, but complicates debugging and analytics queries.

**Severity:** Medium (downgraded from High because retries are rare in practice)

**Fix path:** Either use `onConflictDoNothing` on `insertBeatProgress` too (with a deterministic ID like `${episodeId}:${turnNumber}:${transitionSource}`), or wrap both inserts in a D1 batch/transaction.

---

## B) Medium / Low Findings

### R2-M1 · Report `buildBranchNotTaken` only examines last 4 history entries

**File:** `packages/engine/src/report.ts` line 363

```ts
for (const entry of state.history.slice(-4)) {
```

The branches-not-taken section of the post-game report only looks at the final 4 turns. For an 18-beat scenario with potentially 10+ turns, this means early pivotal decisions (turn 1–3 are often the most consequential) are never shown in the post-game analysis.

**Impact:** Post-game report underrepresents early-game decision points. Players miss seeing the "what if" for their most impactful early choices.

**Fix path:** Either remove the `slice(-4)` limit entirely (at most ~18 entries for a full game), or make it configurable. The post-game context is post-episode, so performance is not a concern.

---

### R2-M2 · Debrief secondary line token attribution (confirmed from Round 1)

**File:** `packages/engine/src/debrief.ts` lines 72–75

Round 1 flagged this as M-3. The code is unchanged — `payload.narrativeTokens[0]` grabs the first token from a mixed array containing player side-effects, rival side-effects, and event tokens. The line reads:

```ts
const rivalToken = payload.narrativeTokens[0];
```

At simulator.ts lines 450–455, `allNarrativeTokens` is assembled as:
```ts
[...playerResult.triggeredSideEffects, ...rivalResult.triggeredSideEffects, ...preRivalEvents, ...postRivalEvents]
```

Player tokens appear first. If the player action triggers any side-effects, the "rival" debrief line will describe a player effect.

**Impact:** Narrative misattribution in debrief text. Confirmed still present.

**Fix path:** Pass separate `rivalNarrativeTokens` (from `rivalResult.triggeredSideEffects`) into `buildTurnDebrief`.

---

### R2-M3 · `visibleRanges` in view.ts uses cached history value when available

**File:** `packages/engine/src/view.ts` lines 19–20

```ts
const visibleRanges: Record<keyof typeof state.meters, MeterRange> =
  state.history[state.history.length - 1]?.visibleRanges ?? projectVisibleRanges(state, previewRng);
```

The view always returns the most recent history entry's `visibleRanges` if available. This is correct for post-turn display. But if `projectVisibleRanges` were to be called with a different RNG state (e.g., after extend, which doesn't add a history entry), the fallback path would produce ranges derived from a `previewRng` seeded from `state.rngState ^ 0x9e3779b9`. This XOR-derived seed is deterministic but may not match what the engine would produce on the next turn.

**Impact:** After a timer extension (no new history entry), the visible ranges remain stale from the last turn. This is arguably correct (intel doesn't change on extend), but the fallback RNG path could produce surprising results if triggered.

**Severity:** Low

**Fix path:** No change needed unless the intent is to refresh intel on extend. Document the invariant.

---

### R2-M4 · `extendActiveCountdown` default `now` uses `expiresAt` as fallback

**File:** `packages/engine/src/simulator.ts` line 210

```ts
export const extendActiveCountdown = (
  currentState: GameState,
  now = currentState.activeCountdown?.expiresAt ?? 0
): GameState => {
```

If `now` is not provided, the function defaults to `expiresAt` — the countdown's expiry timestamp. This means `remaining` at line 235 computes as `Math.max(0, Math.ceil((countdown.expiresAt - countdown.expiresAt) / 1000)) = 0`, which triggers the "Countdown already expired" error at line 237.

In practice, the API always passes `requestTimestamp` as `now`, so this default is never hit. But the function signature is misleading — the default makes the function unusable without an explicit `now` argument.

**Severity:** Low (unreachable in production, but a trap for unit test callers)

**Fix path:** Change the default to `0` or remove the default entirely (require explicit `now`). Alternatively, use `Date.now()` as the default with a code comment noting it's only for standalone testing (not engine-deterministic path).

---

### R2-M5 · No input size limits on `stateJson` column

**File:** `apps/api/src/db.ts` line 31 (`state_json TEXT NOT NULL`)

The `state_json` column has no size constraint. A GameState with maximum history (18 turns, each with meter snapshots, belief snapshots, RNG traces, narrative bundles) can grow significantly. D1 has a 1MB row size limit. While unlikely to hit in normal play, a scenario expansion (more turns, more meters, richer narrative) could approach this limit.

**Severity:** Low

**Fix path:** Monitor actual state sizes in production. If approaching limits, consider storing history entries separately or compressing the JSON.

---

### R2-L1 · `computeCompositeScore` references `episode.meters` after completion (frozen state)

**File:** `apps/api/src/index.ts` lines 68–116

The composite score function reads from the episode view's meters. Since the episode is completed, meters are frozen at their final values. This is correct. No issue — noting for completeness.

---

### R2-L2 · `timeoutGuardRef` now resets on beat/turn change (H-1 Round 1 area — confirmed fixed)

**File:** `apps/web/src/App.tsx` lines 210–212

```ts
useEffect(() => {
  timeoutGuardRef.current = null;
}, [episode?.episodeId, episode?.turn, episode?.currentBeatId]);
```

Round 1 L-5 flagged that the timeout guard might not reset on new beats. This is now fixed — the guard resets on `episodeId`, `turn`, or `currentBeatId` changes. The `timeoutKey` pattern at line 220 (`${episodeId}:${turn}:${beatId}`) provides additional protection against duplicate timeout for the same beat.

**Status:** Fixed. No remaining issue.

---

## C) UX / Gameplay Issues

### R2-UX1 · MeterDashboard and IntelPanel still rendered (spec drift — unchanged from Round 1 L-1)

**File:** `apps/web/src/App.tsx` lines 370–380

Both components are still present. This is a known spec drift item tracked since Round 1. The spec says to remove both, but D-028 deferred the decision.

**Recommendation:** Make an explicit decision (keep or remove) and record it. If keeping, update the spec to match reality.

---

### R2-UX2 · Timer mode "off" on timed beats shows ambiguous messaging

**File:** `apps/web/src/App.tsx` lines 353–354

```ts
{showTakeNoAction ? 'Timed beat active: choose an action or trigger Take No Action.' : 'No active countdown in this beat.'}
```

When `timerMode === 'off'` and the beat has a `decisionWindow`, the player sees "Timed beat active" — which is confusing because there's no visible countdown. The beat is timed by design, but the timer is disabled by user preference. The messaging should distinguish "this beat would have a timer, but you turned timers off" from "this beat has no timer."

**Severity:** Low UX

**Fix path:** Rephrase to: "This beat has a decision window. Timer mode is off — use Take No Action to proceed without choosing."

---

### R2-UX3 · Pressure text disappears instantly when countdown reaches 0

**File:** `apps/web/src/App.tsx` lines 292–298

The `pressureText` is only shown when `remainingSeconds > 0`. At exactly 0, it vanishes. Since the timeout handler fires asynchronously (via the 250ms interval), there's a brief flash where the countdown shows "0:00" with no pressure text before the timeout resolution replaces the view. The pressure text should persist through the timeout transition for narrative continuity.

**Severity:** Low UX

**Fix path:** Change the condition to `remainingSeconds >= 0` or keep the last pressure text visible during the loading state.

---

### R2-UX4 · No loading/transition state between turn resolution and next turn display

**File:** `apps/web/src/App.tsx`

When the player submits an action, `loading` goes `true` and action cards are disabled, but the previous turn's briefing, meters, and debrief remain visible. There's no visual indication that the resolution is being processed. For fast responses this is fine, but on slow networks (or with polisher LLM calls enabled), the UI appears frozen.

**Severity:** Low UX

**Fix path:** Add a subtle transition overlay or skeleton state during resolution. Even a "Resolving situation..." text replacement for the briefing area would help.

---

## D) Atlas-to-ESCALATION Operational Relevance

Cross-project pattern comparison between Atlas (`Code/active/farmland-terminal`) and ESCALATION (`Code/active/Wargames`):

### D1 · Deploy Automation (HIGH relevance — adopt now)

Atlas has GitHub Actions CI/CD (`deploy.yml`) that auto-deploys on push to `main` touching deploy paths. ESCALATION has no CI/CD. The GitHub repo exists (`altiratech/ESCALATION`) but has no workflow file.

**Recommendation:** Create `.github/workflows/deploy.yml` for ESCALATION mirroring Atlas's pattern. The monorepo structure means the path filter should be `apps/api/**`, `apps/web/**`, and `packages/**`. Include `npm run lint`, `npm run ci:phase1`, and `wrangler deploy` steps.

**Priority:** First item in Codex queue. Without this, every deploy is manual and error-prone.

### D2 · Release Verification Script (MEDIUM relevance — adopt after CI/CD)

Atlas has `deploy/cloudflare-worker/scripts/check-domain-migration.sh` for post-deploy verification. ESCALATION has no equivalent.

**Recommendation:** Create a simple `scripts/verify-deploy.sh` that hits `/healthz`, `/api/reference/bootstrap`, and attempts a start/action cycle against the live endpoint. Run it post-deploy in CI or manually.

### D3 · Runtime Artifact Hygiene (LOW relevance — already clean)

Atlas went through extensive cleanup of runtime SQLite artifacts, seed data, and synthetic data (D-014). ESCALATION was built from scratch and doesn't have this legacy. No action needed.

### D4 · Public Endpoint Hardening (MEDIUM relevance — adopt before public launch)

Atlas has Cloudflare Access protecting authenticated endpoints, session-token auth, and `ALLOW_ANON_SESSIONS` controls. ESCALATION has no auth at all (codename-only model).

**Recommendation:** Not needed for MVP/playtesting, but before any public URL exposure, add at minimum CORS restriction to known origins (R1 M-1 still open) and basic rate limiting (R1 M-2 still open). Full auth is deferred per D-028.

### D5 · Frontend Build Pipeline (MEDIUM relevance — adopt when frontend stabilizes)

Atlas uses a build script (`build-frontend.mjs`) that generates fingerprinted JS assets with immutable cache headers. ESCALATION's web app uses Vite's standard build. No fingerprinted deploy artifacts yet.

**Recommendation:** Defer until frontend is stable. When ready, add fingerprinted asset output and cache headers in the Worker's asset serving.

---

## E) Codex Implementation Queue (Ordered)

### Fast Wins (1–2 hour each)

| # | Finding | File(s) | Fix Summary |
|---|---------|---------|-------------|
| Q1 | R2-C2: Report handler `Date.now()` | `apps/api/src/index.ts:604` | Capture `requestTimestamp` at handler top, thread into `toEpisodeView` |
| Q2 | R2-M2: Debrief token misattribution | `packages/engine/src/debrief.ts:72` + `simulator.ts:450–474` | Pass separate `rivalNarrativeTokens` array into `buildTurnDebrief` |
| Q3 | R2-M1: Report branch-not-taken limit | `packages/engine/src/report.ts:363` | Remove `.slice(-4)` or expand to full history |
| Q4 | R2-M4: `extendActiveCountdown` misleading default | `packages/engine/src/simulator.ts:210` | Remove default for `now` param (require explicit) |
| Q5 | R2-C1: Default seed uses `Date.now()` | `apps/api/src/index.ts:129` | Use `${profileId}:${episodeId}` or document opt-out |
| Q6 | R2-UX2: Timer-off messaging | `apps/web/src/App.tsx:353` | Rephrase ambiguous "Timed beat active" text |
| Q7 | R2-UX3: Pressure text at countdown 0 | `apps/web/src/App.tsx:292` | Change condition to `>= 0` |

### Structural Work (half-day+ each)

| # | Finding | File(s) | Fix Summary |
|---|---------|---------|-------------|
| Q8 | D1: CI/CD pipeline | `.github/workflows/deploy.yml` (new) | Create GitHub Actions workflow mirroring Atlas pattern |
| Q9 | R2-H1: Extension race condition | `apps/api/src/repository.ts` + `index.ts` extend route | Add `stateVersion` column or composite optimistic check |
| Q10 | R2-H3: Turn log / beat progress atomicity | `apps/api/src/repository.ts:141–192` | Wrap in D1 batch or use deterministic IDs with `onConflictDoNothing` |
| Q11 | R1-M1+M2: CORS + rate limiting | `apps/api/src/index.ts:54–58` | Restrict CORS origins, add per-IP rate limiter |
| Q12 | D2: Deploy verification script | `scripts/verify-deploy.sh` (new) | Create post-deploy health check script |
| Q13 | R2-UX1: Dashboard/intel panel decision | `apps/web/src/App.tsx:370–380` | Make spec decision (keep or remove), record as D-0XX |

### Deferred (track, don't block)

| # | Finding | Notes |
|---|---------|-------|
| D-a | R2-H2: Cold-start schema DDL burst | Consider deploy-time migration long-term |
| D-b | R2-M5: State JSON size monitoring | Monitor in production after launch |
| D-c | D4: Auth hardening | Before public URL, after MVP playtesting |
| D-d | D5: Frontend fingerprinted assets | After frontend stabilizes |
| D-e | R2-M3: Visible ranges staleness on extend | Document invariant, no code change needed |

---

## F) Residual Risks and Testing Gaps

### F1 · No integration tests for timer extension + action concurrency

The race condition in R2-H1 has no test coverage. The vitest suite tests engine functions in isolation but doesn't simulate concurrent API calls. A minimal integration test using `unstable_dev` from wrangler or a direct D1-backed test harness would catch this.

### F2 · Monte Carlo still doesn't exercise timeout/inaction paths

Round 1 GQ-5 flagged this. The Monte Carlo simulator (`packages/engine/src/monteCarlo.ts`) always picks a random valid action and never times out or uses explicit inaction. Timer extension is also never exercised. Beat coverage shows 18/18, but that's only through action-path reachability.

**Recommendation:** Add a policy sweep that (a) times out on every timed beat, (b) uses explicit inaction on every timed beat, and (c) extends then acts. This would validate timeout resolution, inaction branches, and extension mechanics under the deterministic engine.

### F3 · No replay/snapshot test

The determinism fixes (C-1/C-2/C-3 from Round 1) were validated by the token regression test, which checks that a fixed seed produces the same narrative tokens. But there's no full-state snapshot test that serializes the complete `GameState` after N turns and compares against a golden file. This would catch future determinism regressions more completely than token-only comparison.

### F4 · `chat_messages`, `advisor_state`, `llm_calls` tables are schema-only

These tables exist in the DDL (db.ts lines 69–103) but are never written to by any feature flow. They're scaffolding for future advisor chat and LLM integration features. No risk, but they inflate the schema init on cold starts (3 extra CREATE TABLE + 3 CREATE INDEX statements).

### F5 · Polisher is passthrough-only in current config

`apps/api/src/polisher.ts` returns input text unchanged unless `LLM_MODE` is set. This means all narrative text is engine-generated without LLM enhancement. Not a risk — just noting that the polisher pipeline is untested with actual LLM calls.

---

## Round 1 Fix Verification

| Round 1 ID | Status | Verification |
|------------|--------|-------------|
| C-1 (Date.now in countdown) | **FIXED** | `setCountdownForBeat` now accepts `nowMs` param (beatTraversal.ts:110,123). `buildCountdownForBeat` default changed to `0` (simulator.ts:47). API threads `requestTimestamp` through all paths. |
| C-2 (Date.now in view.ts) | **FIXED** | `toEpisodeView` now accepts `nowMs?` param (view.ts:16). Fallback at line 26 uses state-derived calculation, not `Date.now()`. |
| C-3 (collectReachable inaction) | **FIXED** | `collectReachable` now pushes `beat.decisionWindow?.inactionBeatId` (validation.ts, confirmed by Monte Carlo 18/18 coverage). |
| H-1 (same-beat countdown reset) | **FIXED** | Simulator lines 516–527 now preserve `previousCountdown` on same-beat turns. Renamed to `postTraversalBeat`. |
| H-2 (JSON.parse crash) | **FIXED** | `parseStateJson` wrapper with `CorruptEpisodeStateError` (repository.ts:21–27). API handlers at lines 220–224, 393, 494 use try/catch. |
| H-3 (ensureSchema per-request) | **FIXED** | `schemaReady` boolean flag at db.ts:118. `schemaReadyPromise` deduplication at db.ts:119–137. |
| H-4 (Zod inaction source) | **CONFIRMED** | `inactionSchema` uses `z.enum(['timeout', 'explicit'])` at index.ts:201. Already constrained. |
| L-5 (timeoutGuardRef reset) | **FIXED** | `useEffect` resets on `[episodeId, turn, currentBeatId]` at App.tsx:210–212. |

---

**End of Review Round 2**
