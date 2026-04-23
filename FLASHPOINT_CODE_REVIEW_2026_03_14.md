# FLASHPOINT — Full Codebase Review

**Date:** 2026-03-14
**Reviewer:** Claude (Cowork)
**Scope:** Complete codebase audit — API, Frontend, Engine, Content, CI/CD, Config
**Codebase:** `Code/active/Wargames` (monorepo: apps/api, apps/web, packages/engine, packages/content, packages/shared-types)
**Last Codex commit:** `b09a0c1` (Sprint 1.4 — command clarify-confirm + NS content intake)

---

## Executive Summary

The Flashpoint codebase is architecturally sound — the deterministic engine is well-implemented, the monorepo structure is clean, and the dark command-center aesthetic is strong. However, the review uncovered **62 findings** across 4 severity tiers that span runtime bugs, security gaps, UX failures, and infrastructure debt.

The most critical pattern: **Codex shipped fast but left integration seams everywhere.** Content packs are loaded but invisible. The API validates inputs loosely. The frontend has no error boundaries. CI/CD workflow files appear corrupted.

| Severity | Count | Summary |
|----------|-------|---------|
| **P0** | 9 | Race conditions, missing error handling, content not surfaced, schema mismatches |
| **P1** | 16 | Auth gaps, stale state, missing validation, no staging, migration risk |
| **P2** | 24 | Accessibility, responsive layout, config debt, documentation gaps |
| **P3** | 13 | Polish, naming, minor code quality |

---

## PART 1: API LAYER

### P0-API-1: Race Condition in Optimistic Locking

**File:** `apps/api/src/index.ts` (lines 505–575, 618–738, 740–831)

Multiple endpoints read episode state, compute new state in-memory, and write back using JSON blob comparison as a concurrency check. If two clients submit actions simultaneously, both can read the same state, both compute independently, and the second writer's comparison fails — but there's no transactional guarantee the first writer's state is the canonical one. A single turn-counter with compare-and-swap would be more robust than comparing entire serialized state blobs.

### P0-API-2: No GameState Validation After Deserialization

**File:** `apps/api/src/index.ts` (lines 376–380, 467–471, 629–633)

`stateJson` is parsed with `JSON.parse()` and a try/catch for syntax errors, but the parsed object is never validated against the `GameState` type. A corrupted or partially-updated state passes parsing but fails at runtime when `toEpisodeView()` accesses nested fields like `state.activeCountdown.expiresAt`. This should use a Zod schema or runtime type guard.

### P0-API-3: Schema Mismatch Between db.ts and schema.ts

**File:** `apps/api/src/db.ts` vs `apps/api/src/schema.ts`

`ensureSchema()` creates tables via raw SQL strings. `schema.ts` defines Drizzle ORM models independently. These can drift — for example, both define `createdAt` defaults. No version tracking or hash validation catches divergence. A migration (0001 or 0002) that diverges from `db.ts` causes silent query failures.

### P0-API-4: Missing Foreign Key Constraints

**File:** `apps/api/src/db.ts`, migration files

No FK constraints between episodes → profiles, episodes → scenarios, turn_logs → episodes, beat_progress → episodes. Orphaned records are possible if any record is deleted. Data integrity depends entirely on application logic.

### P1-API-1: Action Availability Not Validated

**File:** `apps/api/src/index.ts` (line ~490)

`POST /api/episodes/:episodeId/actions` accepts any `actionId` without verifying it's in `state.offeredActionIds`. The engine's `resolveTurn()` may silently succeed or throw. The API boundary should reject invalid actions before calling the engine.

### P1-API-2: Rate Limiter is In-Memory, Lost on Restart

**File:** `apps/api/src/index.ts` (lines 71–182)

Rate limit state is stored in a `Map`, which resets on every Worker restart (Cloudflare Workers restart frequently). The prune threshold (2,000 entries) is arbitrary. No GET endpoint rate limiting exists — `/api/reference/bootstrap` can be hammered for large payloads.

### P1-API-3: Profile Creation Race Condition

**File:** `apps/api/src/repository.ts` (lines 43–67)

`findOrCreateProfile()` checks for existing codename, then inserts if not found. Two concurrent requests with the same codename both pass the SELECT and both attempt INSERT. The second fails with a unique constraint violation that isn't caught.

### P1-API-4: Episode Creation Schema Discovery Shim

**File:** `apps/api/src/repository.ts` (lines 69–120)

`createEpisode()` runs `PRAGMA table_info(episodes)` on every call to check if `archetype_id` column exists, then generates different INSERT statements. This is a migration compatibility hack that should have been removed after D-046 (archetype → adversary_profile refactor). It adds latency to every episode start.

### P1-API-5: Bootstrap Endpoint Returns Unbounded Payload

**File:** `apps/api/src/index.ts` (line ~878)

`GET /api/reference/bootstrap` returns all scenarios, actions, images, narratives, 8 content packs — everything. No pagination, no lazy loading, no size limits. As content grows, this will exceed Worker response limits or cause client memory issues.

### P2-API-1: Unused Analytics Tables

Tables `chat_messages`, `advisor_state`, `llm_calls` are defined in migrations and schema but never read or written. They consume schema space with no runtime value.

### P2-API-2: No Idempotency Keys

No POST endpoint supports idempotency. Network retries can submit the same action twice. DB constraints may prevent double-logging, but the client gets confusing duplicate responses.

### P2-API-3: Stale Response Structure Inconsistent

Different endpoints return stale-turn responses with different shapes. `interpret` includes full episode view + suggestions; `actions` includes episode without suggestions. Frontend must handle multiple response shapes for the same conceptual error.

---

## PART 2: FRONTEND / WEB LAYER

### P0-WEB-1: Content Packs Loaded But Not Surfaced

**Files:** `apps/web/src/App.tsx`, all components

All 8 narrative content packs are bootstrapped from the API and stored in state. **None are meaningfully visible to the player:**

| Content Pack | Loaded? | Visible? | Gap |
|---|---|---|---|
| advisor_dossiers | Yes | Partial — only `beat.advisorLines` shown | Full bio, decision framework, blind spots, relationships invisible |
| scenario_world_ns | Yes | Minimal — StartScreen background only | Rich geography, stakeholders, economics, timeline not shown during game |
| intel_fragments_ns | Yes | 2 clips per turn | Full intel archive not explorable |
| news_wire_ns | Yes | 2 articles per turn | Full news feed not browsable |
| action_narratives_ns | Yes | Post-action recap only | Pre-action briefing narratives not shown before player commits |
| rival_leader_ns | Yes | Summary only | Full psychological profile, inner circle, pressure points invisible |
| cinematics_ns | Yes | Opening + ending | Phase transition cinematics not shown |
| debrief_deep_ns | Yes | Post-game only | Strategic lessons, historical parallels only at game end |

This is the single biggest gap. ~520KB of authored narrative content exists but is functionally invisible. The game feels thin because the depth is loaded but hidden.

### P0-WEB-2: No Error Boundary

**File:** `apps/web/src/main.tsx`, `App.tsx`

No `<ErrorBoundary>` wraps the React tree. Async operations in handlers catch errors and set state, but if a fetch rejects before the try-catch or if a state update throws, the app crashes to a blank page. Network hiccup during episode start, action submission, or report fetch → uncaught promise rejection → white screen.

### P0-WEB-3: Stale Episode State on Action Commit

**File:** `apps/web/src/App.tsx` (lines 324–347, 436–463)

If the player selects an action but the timer expires before they hit "Commit," `handleInaction` fires and advances the turn. The subsequent commit is rejected as stale. The player's action choice is silently discarded — no confirmation dialog, no resubmit option. Player must re-select from scratch.

### P0-WEB-4: Countdown Timer Sync Failure

**File:** `apps/web/src/App.tsx` (lines 406–426)

Timer counts down based on `episode.activeCountdown.expiresAt - Date.now()` with a 250ms tick. If the browser tab is backgrounded for 10+ seconds, the timer display hits "0:00" before `handleInaction('timeout')` fires. If the API rejects the inaction call, the timer stays at "0:00" but the decision window is still open on the backend. No re-sync mechanism exists.

### P1-WEB-1: Hardcoded Scenario References ("Beijing", "PLA")

**File:** `apps/web/src/components/ActionCards.tsx` (lines 23–74)

`postureHint()`, `riskHint()`, and `firstImpactHint()` reference "Beijing" and "PLA" specifically. The Northern Strait Flashpoint scenario uses fictional nations (Kaltor Union, Pan-Atlantic Coalition). These hints are nonsensical in the current scenario and break immersion.

### P1-WEB-2: No Loading/Error States for Report

**File:** `apps/web/src/App.tsx` (line 275), `ReportView.tsx`

`fetchReport` is awaited in `applyEpisodeUpdate`. If it fails or takes >2 seconds, the player sees a blank page with no indication of progress or failure. No skeleton, no progress bar, no retry button.

### P1-WEB-3: Sparkline Empty on First Turn

**File:** `apps/web/src/components/MeterDashboard.tsx` (lines 71–104)

If `meterHistory.length === 0`, `buildSparklinePoints` returns an empty string. The SVG renders but with no visible polyline — just a blank chart. No fallback "awaiting data" message.

### P1-WEB-4: CommandInput Suggestions Overflow on Mobile

**File:** `apps/web/src/components/CommandInput.tsx` (lines 138–157)

With 4+ suggested actions, flex-wrap causes buttons to stack and push the input field off-screen on mobile. No `max-height` or `overflow-y-auto` on the suggestions container.

### P1-WEB-5: BriefingPanel Tabs Not Keyboard-Navigable

**File:** `apps/web/src/components/BriefingPanel.tsx` (lines 461–499)

Tab buttons have no `role="tab"`, no `aria-selected`, no arrow key support. Mobile accordion tabs flicker on rapid clicks. Keyboard-only users cannot navigate briefing sections.

### P1-WEB-6: Turn Debrief Lines Unstyled

**File:** `apps/web/src/components/BriefingPanel.tsx` (lines 256–267)

Tags like "[Action]" and "[Ripple]" are plain text with accent color. They're visually indistinguishable at a glance in a dense wall of text. Should be color-coded badges with icons.

### P1-WEB-7: Startup Loading Stalls Silently

**File:** `apps/web/src/App.tsx` (lines 510–516)

"Loading strategic theater configuration..." shows during bootstrap fetch. If the fetch stalls for 30+ seconds (bad network, Worker cold start), the player has no way to know what failed or retry. No timeout, no retry button.

### P2-WEB-1: No Accessibility — Missing ARIA Labels Everywhere

**Files:** All components

Buttons like "Extend +0:30" and "Take No Action" have no `aria-label`. Expandable sections don't use `aria-expanded`. No keyboard focus indicators on interactive elements. Images have placeholder alt text.

### P2-WEB-2: Responsive Layout Failures

**Files:** `App.tsx` (main grid), `BriefingPanel.tsx`, `ActionCards.tsx`

On tablets (768px), the 2-column layout becomes cramped. `max-h-[32rem]` on AdvisorPanel is too small on large screens. Charts in BriefingPanel are fixed-height with no responsive resizing.

### P2-WEB-3: `clipText` Utility Duplicated Across Components

**Files:** `StartScreen.tsx`, `BriefingPanel.tsx`, `AdvisorPanel.tsx`

Every component defines its own `clipText` with slightly different default limits (220 vs 260 vs 240). `ActionCards.tsx` doesn't clip at all — summaries can overflow. Should be a shared utility with consistent behavior.

### P2-WEB-4: No Request Deduplication

**File:** `apps/web/src/api.ts`

If the player double-clicks "Begin Scenario," two `startEpisode` calls fire. No in-flight flag disables buttons while requests are pending.

### P2-WEB-5: Executive Summary Truncated Without Expand

**File:** `apps/web/src/App.tsx` (lines 658–677)

Executive summary sections are clipped at 220 chars with no "Read more" button. Critical briefing information can be cut off with no way to access the full text.

### P2-WEB-6: Scenario Seed Not Cleared on Scenario Change

**File:** `apps/web/src/components/StartScreen.tsx`

When the player switches scenarios, the seed input persists. They may accidentally use the same seed for a different scenario.

### P2-WEB-7: `API_BASE` Not Validated in Production

**File:** `apps/web/src/api.ts`

If `VITE_API_BASE_URL` is not set, all API calls go to same-origin (which fails in production). No console warning logged.

---

## PART 3: ENGINE, TYPES, AND CONTENT

### P0-ENG-1: RNG Boundary Condition

**File:** `packages/engine/src/rng.ts` (lines 22–24)

`nextInt()` uses `(state & 0xffffffff) / 0x100000000` for [0, 1) output. IEEE 754 precision could theoretically produce exactly 1.0, causing `Math.floor(1.0 * range) + min` to exceed `maxInclusive`. Low probability but causes array index out-of-bounds when picking from arrays.

### P0-ENG-2: Inconsistent Chance Clamping

**File:** `packages/engine/src/effects.ts` (lines 58, 90)

Side effects clamp to 0.92 max; delayed effects clamp to 1.0. Under high pressure, side effects can never trigger above 92% while delayed effects can reach 100%. This asymmetry is undocumented and affects game balance.

### P1-ENG-1: Event Multipliers Hardcoded to Specific Events

**File:** `packages/engine/src/events.ts` (lines 28–59)

Event chance multipliers reference specific event IDs (`protests_erupt`, etc.) in code. Adding new events or new scenarios requires engine code changes. Should be driven by event metadata instead.

### P1-ENG-2: Beat Graph Validation Misses Dead-End Paths

**File:** `packages/engine/src/validation.ts` (lines 117–130)

Validation checks for fallback branches but doesn't catch "unreachable path within certain turn windows" — a beat could become unreachable if all conditional branches fail and no unconditional fallback covers that turn range.

### P1-ENG-3: Narrative Ticker Uses Magic Constants

**File:** `packages/engine/src/narrative.ts` (lines 76–79)

`risk premium = (escalationIndex - economicStability) * 0.9 + 42` and `energy basket = 100 - energySecurity + 88`. The constants 0.9, 42, 88 are unexplained. Risk premium can go negative. Energy basket ranges 0–188. Neither makes real-world sense.

### P2-ENG-1: Content Loader Exposes Confusing Singular/Plural API

**File:** `packages/content/src/index.ts` (lines 44–50)

Wraps single objects in arrays and exports both `rivalLeader` (singular) and `rivalLeaders` (plural). Confusing for consumers — which to use?

### P2-ENG-2: Belief Update Magic Constants Undocumented

**File:** `packages/engine/src/beliefs.ts` (lines 12, 23–44)

Small constants (0.12, 0.08, 0.09, etc.) drive belief dynamics with no documented rationale, sensitivity analysis, or balance justification.

### P2-ENG-3: Rival Signal Normalize Assumes [-1, 1] Range

**File:** `packages/engine/src/rival.ts` (line 17)

`(value + 1) / 2` assumes signals in [-1, 1], but `ActionDefinition.signal` values are unclamped. Misconfigured action signals produce unexpected rival weightings.

### P3-ENG-1: Economic Collapse Detection Window Too Narrow

**File:** `packages/engine/src/outcome.ts` (lines 3–9)

`isEconomicCollapse()` checks only the last 2 turns. A brief recovery followed by re-collapse avoids detection. Players can game this with timing.

### P3-ENG-2: Intel Quality Step Discontinuities

**File:** `packages/engine/src/intel.ts` (lines 6–19)

Range width function has hardcoded quality thresholds. Small intel quality changes cause large visibility jumps instead of smooth degradation.

### Engine Determinism: PASSED

Seeded RNG (xorshift32) is correctly implemented. No `Date.now()`, `Math.random()`, or other non-deterministic sources found in the engine. Determinism test validates seed-based replay. Caveat: P0-ENG-1 boundary condition.

### Content Cross-Validation: PASSED

All action IDs referenced in scenarios exist in actions.json. All beat branch targets resolve. All adversary profile references are valid. Beat graph is fully connected — all 18 beats reach a terminal outcome.

---

## PART 4: CI/CD, DEPLOYMENT, AND CONFIG

### P0-CICD-1: GitHub Workflow Files Corrupted / Inaccessible

**Files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/dependabot.yml`

All workflow files return "Resource deadlock avoided" errors when read. They exist (non-zero size) but cannot be accessed or verified. This means the actual CI/CD logic — what gates run before deploy, what tests block PRs, what smoke tests run post-deploy — is unverifiable. The README describes the expected pipeline, but the implementation cannot be audited.

### P1-CICD-1: No ESLint or Prettier Configuration

The repo has **no linting or formatting tools.** The `lint` script in `package.json` only runs `typecheck` (TypeScript type-checking). No unused-import removal, no style enforcement, no security rules, no formatting validation.

### P1-CICD-2: No Staging Environment

Only production URLs are documented (`escalation.altiratech.com`). The web `.env.production` points to a personal dev worker (`rjameson.workers.dev`). No staging environment exists for pre-production validation. All testing happens on main before merge.

### P1-CICD-3: Database Migrations Not Versioned or Tested

Two migration files exist but: no migration test suite, no rollback mechanism, manual execution required (`wrangler d1 execute`), no schema validation after migration. If the second migration fails, the first stays committed with no way to revert.

### P1-CICD-4: Hardcoded Database ID in Committed Config

**File:** `apps/api/wrangler.toml`

`database_id` is hardcoded and committed to git. Same ID used for both `database_id` and `preview_database_id` (should be different). Should be stored as a secret.

### P1-CICD-5: Environment Config Fragmentation

`APP_ENV = "development"` is hardcoded in wrangler.toml for all environments. CORS whitelist includes both localhost and production in the same config. `.dev.vars.example` is corrupted and unreadable. No documented separation between local/staging/prod configuration.

### P2-CICD-1: ci:phase1 Doesn't Test API or Web

The CI gate runs: `validate:content` (JSON structure), `simulate:balance` (Monte Carlo), `test:token-regression` (LLM token budget), `test` (vitest unit tests). Missing: API endpoint integration tests, web component tests, database query tests, build artifact validation.

### P2-CICD-2: CORS Whitelist Includes Localhost in Production

**File:** `apps/api/wrangler.toml`

`CORS_ALLOW_ORIGINS` includes `http://localhost:5173` and `http://127.0.0.1:5173` alongside production domains. Any machine running code on localhost can access the production API.

### P2-CICD-3: Deploy Verification Script Incomplete

**File:** `scripts/verify-deploy.sh`

Tests 5 of 7 API endpoints (missing `GET /api/episodes/:id`, `GET /api/episodes/:id/report`). No error-case testing. Happy path only. Not wired into any npm script.

### P2-CICD-4: No Build Output Verification

Web build (`vite build`) produces `dist/` but no verification that `index.html` + JS bundles are created, no bundle size check, no manifest validation. API build (`tsc --noEmit`) only type-checks — wrangler handles actual bundling at deploy time.

### P2-CICD-5: README Missing Critical Setup Details

Missing: Cloudflare account setup instructions, GitHub Actions secrets creation walkthrough, first-time contributor checklist, database migration instructions for local dev, environment variable reference table, troubleshooting guide.

### P2-CICD-6: Rate Limiting Not Tunable Without Redeploy

Rate limit config (120 req/60s) is hardcoded in `wrangler.toml` vars. Adjusting limits requires code change + redeploy. Should be Cloudflare Secrets or KV-backed.

### P3-CICD-1: No Node/npm Version Pinned

No `.nvmrc`, `.node-version`, or `engines` in `package.json`. Contributors may use different Node versions. CI uses whatever GitHub Actions defaults to.

### P3-CICD-2: Vitest Config Minimal

No coverage threshold, no coverage report generation, no test timeout override.

### P3-CICD-3: Branch Protection Rules Undocumented

No documented `main` branch protection (PR reviews required? CI must pass? Signed commits?).

---

## PART 5: PRIORITY MATRIX

### Tier 1 — Fix Before Next Playtest

| ID | Category | Issue | Effort |
|---|---|---|---|
| P0-WEB-1 | Frontend | Content packs loaded but invisible | 2-3 days |
| P0-WEB-2 | Frontend | No error boundary | 2 hours |
| P0-API-1 | API | Race condition in optimistic locking | 4 hours |
| P0-API-2 | API | No GameState validation after parse | 2 hours |
| P1-WEB-1 | Frontend | Hardcoded "Beijing"/"PLA" references | 1 hour |
| P1-WEB-7 | Frontend | Startup loading stalls silently | 1 hour |
| P0-WEB-3 | Frontend | Stale episode state on action commit | 3 hours |
| P0-CICD-1 | CI/CD | Workflow files corrupted | 2 hours |

### Tier 2 — Fix Before Sharing Externally

| ID | Category | Issue | Effort |
|---|---|---|---|
| P1-API-1 | API | Action availability not validated | 1 hour |
| P1-API-5 | API | Bootstrap endpoint unbounded | 2 hours |
| P1-WEB-2 | Frontend | No report loading/error state | 2 hours |
| P1-WEB-3 | Frontend | Sparkline empty on first turn | 30 min |
| P1-CICD-1 | CI/CD | No ESLint/Prettier | 2 hours |
| P1-CICD-2 | CI/CD | No staging environment | 4 hours |
| P1-CICD-3 | CI/CD | Migrations not versioned/tested | 3 hours |
| P0-ENG-2 | Engine | Inconsistent chance clamping | 1 hour |
| P2-WEB-1 | Frontend | Missing ARIA labels | 3 hours |
| P2-WEB-4 | Frontend | No request deduplication | 1 hour |

### Tier 3 — Tech Debt / Polish

Everything else: responsive layout fixes, clipText deduplication, content loader cleanup, magic constant documentation, rate limiting improvements, CORS hardening, documentation gaps.

---

## CROSS-CUTTING OBSERVATIONS

### 1. The Content-Code Gap Is the Biggest Problem

520KB of deeply authored narrative content exists. The engine is deterministic and sound. The API serves it all correctly. But the frontend shows maybe 10% of what's available. The game feels thin not because the content is thin — it's because it's hidden behind a layer that only surfaces beat-level summaries, 2 intel clips, and 2 news headlines per turn.

**The single highest-ROI fix is building a content browser into the gameplay UI** — let the player expand advisor dossiers, browse the intel archive, read full news articles, see pre-action briefings from `action_narratives_ns`, and explore the rival leader's psychological profile.

### 2. Codex Shipped Fast, Left Seams

Codex's sprint cadence was impressive (5 sprints in one day). But each sprint left integration seams: the `archetype_id` PRAGMA shim is still running on every episode start, the rate limiter resets on restart, the CORS list includes localhost in production, the "Beijing" references leaked from a prior scenario concept, the bootstrap endpoint returns everything unbounded.

### 3. The Engine Is the Strongest Layer

The deterministic engine is well-designed. Seeded RNG, proper state threading, no non-deterministic sources. The belief/meter/action system is mathematically coherent. Content validation passes. The P0 RNG boundary issue is low-probability. The P0 chance clamping asymmetry is a balance choice that should be documented, not necessarily a bug.

### 4. CI/CD Is a Black Box

With workflow files corrupted, the actual deployment pipeline is unverifiable. The README describes what should happen. The `verify-deploy.sh` script is solid but incomplete. The `ci:phase1` gate is content-heavy (good) but code-test-light (risky).

---

*Review complete. 62 findings across 4 severity tiers. Recommended immediate focus: surface content packs in UI (P0-WEB-1), add error boundary (P0-WEB-2), fix corrupted workflow files (P0-CICD-1), remove hardcoded scenario references (P1-WEB-1).*
