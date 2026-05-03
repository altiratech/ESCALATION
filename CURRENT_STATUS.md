# Current Status

Product: Flashpoint / ESCALATION scenario and response simulation.

Current state:
- Stabilization checkpoint is pushed to `origin/main` through `077f287`; gameplay recovery landed in `d408151`; balance/code fixes landed in `c385af0`.
- Belief update now decays `economicallyWeakProb` (* 0.82), `allianceFragileProb` (* 0.82), and `deescalateUnderPressure` (* 0.78) each turn, preventing monotonic saturation that was driving concentrated terminal distributions.
- Action selection forced-military-posture inject now validates against `scenario.availablePlayerActionIds` before adding to the offered set.
- `ensureEpisodeProfileColumn` ALTER TABLE is wrapped in try/catch with a re-check, preventing concurrent cold-start crashes on D1.
- `IMAGE_GENERATION_MATRIX.md` now prioritizes US domestic impact, chips/AI economy, US government response, and technically accurate thermal imagery.
- Codex-generated image tranche 1 is wired into `images.json`: Situation Room chip crisis, AI/data-center supply exposure, US supermarket panic, nuclear-risk command display, and corrected thermal boarding imagery.
- Codex-generated image tranche 2 is applied and verified locally: market crash, family cable-news crisis, tech layoffs, port congestion, White House press briefing, Congressional chip hearing, deployment pier families, electronics shortage, gas lines/freight shock, semiconductor fab disruption, and allied coordination call.
- Image selector weighting now lets selected action/variant context lead over generic beat-matched maritime assets, with regression coverage in `tests/engine/images.test.ts`.
- Gameplay/UX recovery pass covers Linear `ALT-27` through `ALT-44`; `ALT-38` still only partially closed.
- Timer setup exposes user-paced, relaxed, and standard modes; decision screens show countdown/extend/timeout UX.
- Full-run browser smoke exists as `npm run smoke:browser` and reached the mandate report locally with no console/page errors.

Validation:
- Passed: `npm run lint`, `npm test` (17 files / 47 tests), `npm run build`, `npm run simulate:balance`, `npm run validate:content`, `npm run diagnose:decision-visuals`, and `PLAYTEST_WEB_URL=http://127.0.0.1:5179 npm run smoke:browser`.
- Balance note: older `northern_strait_flashpoint` top terminal share improved to 31.5%; active `northern_strait_black_swan` remains concentrated at 43.7% and needs another content/balance pass.
- Visual note: screenshot review confirms the new Situation Room and allied coordination images render in-game. Smoke currently chooses Backchannel Diplomacy every turn, so market/gas/electronics assets are covered by diagnostics rather than that smoke path.
- Known red: `npm audit` remains red for no-fix Hono/Drizzle runtime advisories; see `DEPENDENCY_SECURITY_TRIAGE.md`.

Next:
- Commit and push the second image tranche plus selector weighting fix.
- Add a broader browser smoke that varies selected actions so public/economic/military imagery is exercised in screenshots, not only diagnostics.
- Tune active black-swan branch balance to reduce terminal concentration without making outcomes feel random.
- Finish `ALT-38`: durable rate limits, idempotency/retry behavior, D1 migration governance, and bootstrap payload strategy.
