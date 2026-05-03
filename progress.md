Original prompt: Ok please start working through each Linear task. Keep going until you are finished

## 2026-05-01

- Starting with the Linear critical path instead of broad visual work: `ALT-27`, `ALT-40`, `ALT-43`, then report/playthrough blockers.
- Worktree already had `CURRENT_STATUS.md` modified and untracked `CODEX_TASK_EVALUATION.md`; preserve both.
- Added `scripts/decision-visual-diagnostics.ts` and `npm run diagnose:decision-visuals`; first run confirmed early and late active beats still collapse to one next beat/gallery.
- Fixed `action_narratives_ns.json` scenario/action IDs for `ALT-40`; added content validation for action narrative scenario, action IDs, duplicates, phase coverage, and local build gating.
- Added `schemaVersion` to game state plus API parse migration for pre-versioned state snapshots and rejection of future versions; covered with API tests for `ALT-43`.
- Hardened `ReportView` list keys for report arrays whose content can repeat, including duplicate branch alternatives that produced the observed React key warnings.
- Added manual response-envelope selection in `ActionCards` and changed briefing preview selection so selected action/variant context can influence visuals even when a beat already has an authored image.
- Changed engine image selection so beat-authored hero art remains authoritative for passive briefing, but action/variant-matched images can lead after a player chooses a response; diagnostic hero diversity improved from 1 per collapsed beat to 4-7 on active windows, though next-beat graph collapse remains.
- Tuned active black-swan branches so every non-terminal diagnostic beat now has at least 2 reachable next-beat outcomes across offered action/variant combinations; content validation now reports 0 warnings.
- Reconciled legacy `narrative_candidates_v2` beat IDs into the active black-swan scenario with explicit aliases, so advisor overlays and timer pressure text now surface in active gameplay instead of silently staying on the old scenario path.
- Restored truthful timer UX: setup now exposes user-paced/relaxed/standard modes, the live decision screen shows countdown state, extension affordance, urgency styling, and timeout auto-resolution through the existing API.
- Reduced briefing visual rail repetition by showing the static theater map only on the opening turn or when no other visual is available, which directly addresses the blank-left-column screenshot pattern.
- Cleaned standalone preview/deploy assumptions: verification defaults now target Pages + Workers preview, require the active black-swan scenario, README documents the preview path, and stale Altiratech route/CORS defaults were removed.
- Added `.rgignore` and `.auditignore` for generated/cache directories so repo scans do not drown in `tmp`, build output, Wrangler cache, imagegen output, or dependencies.
- Added `DEPENDENCY_SECURITY_TRIAGE.md` with current `npm audit` / `npm audit --omit=dev` results, runtime exposure assessment, and no-force-upgrade guidance.
- Added lightweight client telemetry storage/API and web pings for `session_start`, `decision_made`, `game_completed`, and `game_abandoned` with turn/timing metadata for playtest measurement.
- Added `npm run smoke:browser` full-run Playwright smoke; after installing Chromium and running local dev outside the sandbox, it completed a full 6-window run to the mandate report with no captured console/page errors.
- Added `IMAGE_GENERATION_MATRIX.md` so the next image pass is decision-context-driven instead of another broad replacement sweep.

## 2026-05-02

- Verified the follow-up bug-fix pass: `npm run simulate:balance`, `npm test`, `npm run lint`, and `npm run build` all pass.
- Balance result: legacy `northern_strait_flashpoint` improved to 31.5% top terminal share, but active `northern_strait_black_swan` still concentrates at 43.7%, so content/branch tuning remains a real next task.
- Updated `IMAGE_GENERATION_MATRIX.md` around Ryan's new direction: US decision-maker perspective, chips/AI/economy as the dominant theme, US domestic/government visuals first, accurate thermal/IR guidance, and less Asia-default casting.
- Next implementation tranche after this commit: curate the Codex-generated images, copy selected assets into `apps/web/public/assets/images/`, add image metadata in `packages/content/data/images.json`, and rerun visual diagnostics/browser smoke.
- Wired the first five single-image Codex assets: Situation Room chip crisis, AI/data-center supply chain exposure, US supermarket panic, nuclear-risk command display, and corrected thermal boarding imagery. Contact sheets were intentionally not wired as gameplay art.
- Re-ran `npm run validate:content`, `npm run diagnose:decision-visuals`, `npm test`, `npm run build`, and browser smoke against Flashpoint on `127.0.0.1:5179`; smoke passed after discovering `5173` was occupied by an unrelated Altira Wire dev server.
- Screenshot review confirmed the new Situation Room image renders in-game, but same-response smoke paths still repeat it heavily. The next visual pass should add more single-image US domestic/economic variants and/or improve selector recency/action diversity.
- Generated and wired 11 more individual US-centric images: market crash, family cable-news anxiety, tech layoffs, port congestion, White House press briefing, Congressional chip hearing, deployment pier families, electronics shortage, gas lines/freight shock, semiconductor fab disruption, and allied coordination call.
- Adjusted image selector weighting so selected action/variant tags can lead over generic beat-matched maritime imagery; added regression coverage proving action-matched domestic imagery can beat a stronger beat-only match.
- Verification after tranche 2: `npm run validate:content`, `npm run diagnose:decision-visuals`, `npm test -- tests/engine/images.test.ts`, `npm run lint`, full `npm test`, `npm run build`, and browser smoke against `127.0.0.1:5179` all passed. Playwright Chromium had to be reinstalled with `npx playwright install chromium` before smoke.
- Screenshot review confirmed Situation Room plus allied coordination imagery render in the Backchannel smoke path. Remaining testing gap: add/adjust smoke coverage to choose varied actions so market/gas/electronics/deployment images are screenshot-verified, not only selector-diagnostic verified.

## 2026-05-03

- Started the varied-action browser smoke pass. Goal: preserve the existing Backchannel-heavy smoke as default while adding `npm run smoke:browser:varied` for public/economic/resource/military/intel/concession choices and visible-image logging per screenshot.
- Found the deeper cause of the smoke/image loop: offered responses still collapse around a narrow control set, so several valid public/economic/cyber/covert actions rarely appear. Tried a rotating pressure-slot engine change, but rejected it because Monte Carlo concentration worsened; keep that fix for a balance-aware pass.
- Verification: `npm run smoke:browser:varied` reached the mandate report and screenshot-verified port congestion, AI/data-center, supermarket panic, family cable-news, and deployment pier images under varied non-backchannel choices.
- Full gates passed after reverting the risky action-selection change: `npm run validate:content`, `npm run diagnose:decision-visuals`, `npm run lint`, `npm test`, `npm run simulate:balance`, `npm run build`, default browser smoke, and varied browser smoke against `127.0.0.1:5179`.
- Balance caveat: active `northern_strait_black_swan` terminal concentration remains the next major gameplay task at 43.7%; targeted visual coverage is still needed for electronics shortage, semiconductor fab disruption, White House, market-crash, gas/freight, nuclear-risk, and Congressional-hearing assets.
- Tuned active `northern_strait_black_swan` final-window branch gates so high-pressure sanctions now split into limited strike risk, military-only catastrophic tail risk is more explicit, and blockade lock no longer swallows the whole terminal distribution. `npm run simulate:balance` now reports active top terminal share at 30.0% (`ns_blockade_lock=360`, `ns_managed_relief=319`, `ns_limited_strike_exchange=237`, `ns_managed_freeze=209`, `ns_invasion_tail=75`).
- Improved balance diagnostics: `scripts/monte-carlo.ts` now prints the dominant terminal beat in warnings and the full terminal distribution per scenario. Beat validation now treats empty/no-action-tag branches as real default fallbacks and warns when an unbounded fallback can shadow later branches; regression coverage added in `tests/engine/beat-validation.test.ts`.
- Verification after the balance pass: `npm run validate:content`, `npm run simulate:balance`, `npm run diagnose:decision-visuals`, `npm test` (17 files / 48 tests), `npm run lint`, `npm run build`, default browser smoke, and varied browser smoke against `127.0.0.1:5179` all passed. Wrangler API had to run with `HOME=/tmp/flashpoint-wrangler XDG_CONFIG_HOME=/tmp/flashpoint-wrangler`; Playwright smoke required sandbox escalation for Chromium on macOS.
