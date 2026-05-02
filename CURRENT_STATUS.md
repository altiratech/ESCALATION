# Current Status

Product: Flashpoint / ESCALATION scenario and response simulation.

Current state:
- Stabilization checkpoint is pushed to `origin/main` through `bdb7201`; gameplay recovery landed in `d408151`; the current bug-fix pass is verified locally and ready to commit.
- Belief update now decays `economicallyWeakProb` (* 0.82), `allianceFragileProb` (* 0.82), and `deescalateUnderPressure` (* 0.78) each turn, preventing monotonic saturation that was driving concentrated terminal distributions.
- Action selection forced-military-posture inject now validates against `scenario.availablePlayerActionIds` before adding to the offered set.
- `ensureEpisodeProfileColumn` ALTER TABLE is wrapped in try/catch with a re-check, preventing concurrent cold-start crashes on D1.
- `IMAGE_GENERATION_MATRIX.md` now prioritizes US domestic impact, chips/AI economy, US government response, and technically accurate thermal imagery.
- Gameplay/UX recovery pass covers Linear `ALT-27` through `ALT-44`; `ALT-38` still only partially closed.
- Timer setup exposes user-paced, relaxed, and standard modes; decision screens show countdown/extend/timeout UX.
- Full-run browser smoke exists as `npm run smoke:browser` and reached the mandate report locally with no console/page errors.

Validation:
- Passed: `npm run lint`, `npm test` (17 files / 46 tests), `npm run build`, and `npm run simulate:balance`.
- Balance note: older `northern_strait_flashpoint` top terminal share improved to 31.5%; active `northern_strait_black_swan` remains concentrated at 43.7% and needs another content/balance pass.
- Known red: `npm audit` remains red for no-fix Hono/Drizzle runtime advisories; see `DEPENDENCY_SECURITY_TRIAGE.md`.

Next:
- Commit and push the verified bug-fix pass.
- Curate the 26 Codex-generated images, copy selected assets into the repo, and wire them through `packages/content/data/images.json`.
- Tune active black-swan branch balance to reduce terminal concentration without making outcomes feel random.
- Finish `ALT-38`: durable rate limits, idempotency/retry behavior, D1 migration governance, and bootstrap payload strategy.
