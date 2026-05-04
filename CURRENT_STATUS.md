# Current Status

Product: Flashpoint / ESCALATION scenario and response simulation.

Current state:
- Stabilization and visual-expansion work is pushed to `origin/main`; gameplay recovery landed in `d408151`, balance/code fixes landed in `c385af0`, and the second US visual tranche landed in `ca3ea5d`.
- Belief update now decays `economicallyWeakProb` (* 0.82), `allianceFragileProb` (* 0.82), and `deescalateUnderPressure` (* 0.78) each turn, preventing monotonic saturation that was driving concentrated terminal distributions.
- Action selection forced-military-posture inject now validates against `scenario.availablePlayerActionIds` before adding to the offered set.
- `ensureEpisodeProfileColumn` ALTER TABLE is wrapped in try/catch with a re-check, preventing concurrent cold-start crashes on D1.
- `IMAGE_GENERATION_MATRIX.md` now prioritizes US domestic impact, chips/AI economy, US government response, and technically accurate thermal imagery.
- Codex-generated image tranche 1 is wired into `images.json`: Situation Room chip crisis, AI/data-center supply exposure, US supermarket panic, nuclear-risk command display, and corrected thermal boarding imagery.
- Codex-generated image tranche 2 is applied and verified locally: market crash, family cable-news crisis, tech layoffs, port congestion, White House press briefing, Congressional chip hearing, deployment pier families, electronics shortage, gas lines/freight shock, semiconductor fab disruption, and allied coordination call.
- Image selector weighting now lets selected action/variant context lead over generic beat-matched maritime assets, with regression coverage in `tests/engine/images.test.ts`.
- `npm run diagnose:visual-targets` now proves the seven priority US/chips/economy images are selector-reachable; electronics, gas/freight, nuclear-risk, and Congress are also reachable under the normal offer model.
- Browser smoke now has default, varied, and `npm run smoke:browser:public-econ` paths; public-econ uses seed `public-econ-2` and asserts White House, market-crash, and semiconductor-fab imagery.
- Active `northern_strait_black_swan` final-window branch gates now split severe endings across blockade lock, limited strike, managed freeze, managed relief, and military-only invasion tail risk instead of over-defaulting to managed freeze.
- `npm run simulate:balance` now prints dominant terminal IDs and full terminal distributions; beat validation warns if an unbounded default fallback can shadow later branches.
- Gameplay/UX recovery pass covers Linear `ALT-27` through `ALT-44`; `ALT-38` still only partially closed.
- Timer setup exposes user-paced, relaxed, and standard modes; decision screens show countdown/extend/timeout UX.
- Full-run browser smoke paths reached the mandate report locally with no console/page errors.

Validation:
- Passed: `npm run lint`, `npm test` (17 files / 48 tests), `npm run build`, `npm run simulate:balance`, `npm run validate:content`, `npm run diagnose:decision-visuals`, `npm run diagnose:visual-targets`, default/varied/public-econ browser smokes against `127.0.0.1:5179`.
- Balance note: older `northern_strait_flashpoint` top terminal share is 31.5%; active `northern_strait_black_swan` top terminal share is now 30.0% at `ns_blockade_lock` with all five terminals represented.
- Visual note: screenshot review confirms Situation Room, allied coordination, corrected thermal, electronics shortage, port congestion, AI/data-center, supermarket, family cable-news, deployment-pier, White House, market-crash, semiconductor-fab, and Congress imagery in-game.
- Known red: `npm audit` remains red for no-fix Hono/Drizzle runtime advisories; see `DEPENDENCY_SECURITY_TRIAGE.md`.

Next:
- Finish `ALT-38`: durable rate limits, idempotency/retry behavior, D1 migration governance, and bootstrap payload strategy.
