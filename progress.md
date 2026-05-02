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
