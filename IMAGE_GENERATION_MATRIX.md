# Flashpoint Image Generation Matrix

This matrix turns the current diagnosis into a targeted asset plan. The app now lets selected actions and response variants influence briefing visuals, but the content pack still needs bespoke assets for repeated decision-path reads.

## Perspective Mandate

The player is a US decision-maker. The scenario is a US response to a China-Taiwan crisis. **Images must reflect what this player sees, feels, and fears** — not what's happening on the ground in the Taiwan Strait.

The dominant visual perspective should be:
- **US mainland consequences**: chip shortages, market crashes, mass layoffs, recession panic, supermarket runs, generic cable-news crisis coverage on living room TVs, empty semiconductor fabs, shipping container bottlenecks at US ports.
- **US government response**: White House Situation Room, Pentagon briefing rooms, Congressional hearings, press conferences, National Security Council meetings.
- **US military (home-side)**: carrier groups departing US ports, families watching deployments, military command centers in the continental US, NORAD-style facilities.
- **Worst-case escalation**: nuclear mushroom clouds, fallout preparation, emergency broadcast screens, civil defense imagery, DEFCON boards.

The scenario is about **chips, AI, and the US economy** being held hostage by a geopolitical crisis. Military theater imagery (Taiwan Strait naval operations, ISR fusion centers, maritime intercepts) should be secondary — used sparingly for military-posture decisions, not as the default.

### Casting and representation

The player base and scenario perspective are US-centric. Images should reflect that:
- White House staff, Pentagon officials, Wall Street traders, suburban families, tech workers, military families
- Diverse American faces — not predominantly Asian individuals
- When showing diplomatic contexts, allied leaders (European, Japanese, Australian, etc.) alongside US officials
- Chinese military/government only when the narrative specifically calls for the adversary perspective

### Technical accuracy notes

- Thermal/IR imagery shows heat signatures, not visible light. A spotlight on water would NOT appear on thermal. Engines, exhaust, body heat, and running electronics show up. Water surfaces appear dark/cold.
- Stock tickers and financial screens should show plausible but not real ticker symbols.
- Military displays should look credible but never show real classified formats.

## Current Diagnosis

- `npm run diagnose:decision-visuals` now reports at least 2 reachable next beats and 4-7 distinct hero images for every active non-terminal beat.
- The remaining repetition clusters are concentrated around `tw_bs_003`, `tw_bs_023`, `tw_bs_029`, `tw_bs_035`, `tw_bs_016`, and `tw_bs_033`.
- The static situation map should remain orientation support, not a primary repeated scene asset.
- Generated assets should reflect the chosen response posture, not merely the current turn number.

## Priority Asset Gaps

### P0 — US domestic impact (biggest gap)

| Decision Context | Needed Image |
| --- | --- |
| `resource_stockpiling` / economic resilience | Panicked semiconductor buyers on a trading floor, broad market-index screens deep red, generic financial-news "CHIP CRISIS" chyron visible on screens in the background |
| `resource_stockpiling` / supply chain | Empty shelves at a US electronics retailer, shipping containers stacked at a congested US port (Long Beach/Newark style), truckers waiting |
| Economic collapse outcome | Mass layoffs — tech campus with security escorting workers out, "CLOSED" signs on a chip fab, unemployment office line |
| Domestic cohesion stress | American family watching generic cable-news crisis coverage in their living room, tension visible, kids in background. Split-screen TV showing military footage and market data |
| Domestic cohesion stress | Protest/demonstration outside the US Capitol or White House, signs about jobs/economy/war, police barriers |
| General economic meter | US gas station with $8+ prices, long lines, "LIMIT 10 GALLONS" sign |

### P0 — US government/command (second biggest gap)

| Decision Context | Needed Image |
| --- | --- |
| `backchannel_diplomacy` / quiet de-risking | White House Situation Room — senior officials around the table, multiple screens, serious faces, secure phones |
| `intelligence_surge` / fusion-cell clarity | Pentagon or NSC briefing room — intelligence analysts presenting to officials, wall displays showing satellite imagery and force disposition |
| `public_signaling_speech` / public messaging | White House press briefing room — press secretary at podium, reporters, cameras, tension |
| `limited_concession` / procedural pause | State Department corridor meeting — diplomats with folders, hushed negotiation, US and allied flags visible |
| General alliance meter | Video conference screen showing a grid of allied leaders (US, Japan, Australia, UK, EU) — coalition coordination call |

### P0 — Worst-case / escalation outcomes

| Decision Context | Needed Image |
| --- | --- |
| War outcome | Nuclear mushroom cloud on the horizon, seen from a distance — city skyline in foreground, ominous scale |
| War outcome (alt) | Emergency broadcast system on a TV screen, family huddled, civil defense siren implied |
| War outcome (alt) | DEFCON status board at NORAD/Cheyenne Mountain — officers staring at screens, red indicators |
| High escalation | US aircraft carrier battle group at sea — imposing but not combat, grey sky, tension |
| Catastrophic termination | Satellite view of city lights going dark across a region — infrastructure collapse implied |

### P1 — Military (US-perspective, used sparingly)

| Decision Context | Needed Image |
| --- | --- |
| `military_posture_increase` / visible deterrence | US Navy destroyer departing San Diego or Norfolk — families on the pier watching, deployment mood |
| `military_posture_decrease` / quiet reposition | Military command center standing down one alert level — officers removing headsets, slightly relaxed posture, still tense |
| `cyber_disruption` / offensive cyber | Dark cyber operations center — screens with network diagrams, operators in military uniforms, blue-lit |

### P1 — Theater-side (keep but de-prioritize)

| Decision Context | Needed Image |
| --- | --- |
| `backchannel_diplomacy` / coalition | Closed-door allied backchannel cell with secure phones, muted reference material |
| `intelligence_surge` / maritime ISR | Maritime fusion center comparing tracking data — analysts at screens |
| `military_posture_increase` / forward presence | Naval watchfloor with readiness board — credible but not primary |

## Prompt Pattern

Use this structure for new image generation:

```text
Create a cinematic documentary-style Flashpoint scenario image for [decision context].
Scene: [specific US-mainland or US-government setting].
Narrative function: show that the player's decision is reverberating through [economic/domestic/military/diplomatic consequence] as experienced from the US perspective.
Casting: predominantly American faces reflecting US diversity. Only show Asian individuals when the scene specifically calls for it (e.g., allied Japanese officials in a coalition call, or Asian-American characters in a diverse US crowd).
Visual constraints: serious national-security simulation, no readable real classified text, no real logos or ticker symbols, no gore, no glamorized combat, realistic lighting, 16:9, dark console-compatible contrast.
Avoid: generic map overlays, repeated stock trading charts, repeated Taiwan Strait maps, predominantly Asian casting in US-domestic scenes, spotlights or visible light in thermal/IR imagery.
```

## Suggested Batch Order

### Batch 1 — US domestic impact (generate first)
- `tw_dom_market_crash_01.png`: Trading floor in chaos, broad market-index screens deep red, traders with hands on heads, "CHIP SUPPLY CRISIS" chyron on overhead TVs.
- `tw_dom_shelf_shortage_01.png`: US electronics store with sparse shelves, "LIMIT 1 PER CUSTOMER" signs, worried shoppers.
- `tw_dom_family_cable_news_01.png`: American family in living room watching generic cable-news split-screen (military footage + market crash), visible anxiety.
- `tw_dom_gas_lines_01.png`: US gas station with elevated prices, long car queue, "CASH ONLY / LIMIT 10 GAL" sign.
- `tw_dom_layoffs_01.png`: Silicon Valley tech campus — workers carrying boxes to cars, security present, overcast mood.
- `tw_dom_protest_01.png`: Demonstration outside the US Capitol — mixed crowd, signs about jobs and war, police line, American flags.

### Batch 2 — US government/command
- `tw_gov_sitroom_01.png`: White House Situation Room — officials seated around the table, multiple wall screens, secure phones, intense deliberation.
- `tw_gov_pentagon_brief_01.png`: Pentagon briefing room — uniformed officers and civilian officials, intelligence wall displays, satellite imagery.
- `tw_gov_press_brief_01.png`: White House press briefing — press secretary at podium, packed press corps, camera flashes.
- `tw_gov_coalition_call_01.png`: Secure video conference — grid of allied leaders on a large screen, US official in foreground.
- `tw_gov_state_dept_01.png`: State Department corridor — diplomats in quiet negotiation, US and allied flags, tension.

### Batch 3 — Worst-case escalation
- `tw_esc_mushroom_cloud_01.png`: Nuclear mushroom cloud on the horizon, seen from suburban US distance, city skyline silhouette, ominous scale.
- `tw_esc_emergency_broadcast_01.png`: Emergency broadcast system on a TV, family huddled on couch, civil defense siren tone implied.
- `tw_esc_defcon_board_01.png`: DEFCON status display at a command center — officers staring at red indicators, grim.
- `tw_esc_carrier_group_01.png`: US carrier battle group at sea under grey sky — imposing but not in combat, projection of power and risk.
- `tw_esc_lights_out_01.png`: Satellite night-view of a coastal region with city lights flickering/going dark — infrastructure collapse.

### Batch 4 — Military (US-perspective)
- `tw_mil_deployment_pier_01.png`: US Navy ship departing port — families on the pier, American flags, departure mood.
- `tw_mil_standdown_01.png`: Military command center stepping down one alert level — some tension releasing, still wary.
- `tw_mil_cyber_ops_01.png`: Dark cyber operations center — screens with network topology, military operators, blue glow.

### Batch 5 — Theater-side (lower priority, generate last)
- `tw_bs_backchannel_01.png`: Closed-door allied backchannel cell with secure phones, muted wall reference.
- `tw_bs_intel_fusion_01.png`: Maritime fusion center comparing AIS ghost tracks and satellite confidence.
- `tw_bs_deterrence_watch_01.png`: Naval watchfloor preparing escort posture — credible but supporting role.
- `tw_bs_procedural_pause_01.png`: Port and customs compliance desk — temporary route-clearance paperwork.
- `tw_bs_quiet_reposition_01.png`: Night operations room tracking force repositioning — low visibility.

## Wiring Checklist

- Add new files under `apps/web/public/assets/images/`.
- Add entries in `packages/content/data/images.json` with action tags matching `actions.json` IDs and variant tags where possible.
- Prefer `kind=documentary_still` or `kind=artifact` over `map` unless the visual is truly a map.
- Include phase tags plus action posture tags so `selectImageAssets` can rank them after a selected response.
- Tag domestic-impact images with the relevant meter key (`economicStability`, `domesticCohesion`, `energySecurity`) so the image selector can match them to meter stress.
- Tag escalation/worst-case images with `escalationIndex` and outcome categories (`war`, `economic_collapse`, `regime_instability`).
- Re-run `npm run diagnose:decision-visuals`; target no hero asset repeated more than 3 times within any single beat's action/variant combinations.
