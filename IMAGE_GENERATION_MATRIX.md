# Flashpoint Image Generation Matrix

This matrix turns the current diagnosis into a targeted asset plan. The app now lets selected actions and response variants influence briefing visuals, but the content pack still needs bespoke assets for repeated decision-path reads.

## Current Diagnosis

- `npm run diagnose:decision-visuals` now reports at least 2 reachable next beats and 4-7 distinct hero images for every active non-terminal beat.
- The remaining repetition clusters are concentrated around `tw_bs_003`, `tw_bs_023`, `tw_bs_029`, `tw_bs_035`, `tw_bs_016`, and `tw_bs_033`.
- The static situation map should remain orientation support, not a primary repeated scene asset.
- Generated assets should reflect the chosen response posture, not merely the current turn number.

## Priority Asset Gaps

| Priority | Decision Context | Current Repeated Asset | Needed Replacement |
| --- | --- | --- | --- |
| P0 | `backchannel_diplomacy` / quiet de-risking | `tw_bs_003`, `tw_bs_016` | Secure-channel diplomacy room, low-light coalition backchannel, cable draft with route language visible but not readable |
| P0 | `intelligence_surge` / fusion-cell clarity | `tw_bs_003`, `tw_bs_035` | Maritime ISR fusion wall, analysts comparing AIS/radar/satellite confidence layers, classified source-protection board |
| P0 | `military_posture_increase` / visible deterrence | `tw_bs_029`, `tw_bs_033`, `tw_bs_035` | Naval watchfloor with readiness board, escort planning table, non-combat show-of-presence image |
| P1 | `military_posture_decrease` / quiet reposition | `tw_bs_023`, `tw_bs_029` | De-escalatory repositioning scene: ships moving beyond public sightline, watch team standing down one layer without leaving |
| P1 | `resource_stockpiling` / market resilience | `tw_bs_003`, `tw_bs_020` | Semiconductor buyer war room, shipping insurer desk, reserve logistics board without generic stock-chart treatment |
| P1 | `limited_concession` / procedural pause | `tw_bs_016`, `tw_bs_023` | Customs/legal documentation scene, corridor inspection paperwork, port authority screen showing temporary procedural route |

## Prompt Pattern

Use this structure for new Codex image generation:

```text
Create a cinematic documentary-style Flashpoint scenario image for [decision context].
Scene: [specific room, vessel, desk, or operations setting].
Narrative function: show that the player chose [response posture] and that the crisis is now read through [market/alliance/military/diplomatic consequence].
Visual constraints: serious national-security simulation, no readable real classified text, no logos, no gore, no glamorized combat, realistic lighting, 16:9, dark console-compatible contrast.
Avoid: generic map overlays, repeated stock trading chart, repeated Taiwan map, generic war room with unrelated screens.
```

## Suggested First Batch

- `tw_bs_backchannel_01.png`: closed-door allied backchannel cell with secure phones, muted Taiwan Strait wall reference, draft off-ramp language redacted.
- `tw_bs_intel_fusion_01.png`: maritime fusion center comparing AIS ghost tracks, radar confidence, and satellite revisit windows.
- `tw_bs_deterrence_watch_01.png`: naval watchfloor preparing visible escort posture with readiness and replenishment constraints.
- `tw_bs_market_resilience_01.png`: semiconductor and shipping risk desk coordinating freight, insurance, and inventory decisions.
- `tw_bs_procedural_pause_01.png`: port and customs compliance desk showing temporary route-clearance paperwork before public language settles.
- `tw_bs_quiet_reposition_01.png`: night operations room tracking forces repositioning out of headline visibility while preserving response options.

## Wiring Checklist

- Add new files under `apps/web/public/assets/images/`.
- Add entries in `packages/content/data/images.json` with action tags matching `actions.json` IDs and variant tags where possible.
- Prefer `kind=documentary_still` or `kind=artifact` over `map` unless the visual is truly a map.
- Include phase tags plus action posture tags so `selectImageAssets` can rank them after a selected response.
- Re-run `npm run diagnose:decision-visuals`; target no hero asset repeated more than 3 times within any single beat's action/variant combinations.
