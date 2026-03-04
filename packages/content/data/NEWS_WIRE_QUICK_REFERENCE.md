# News Wire Northern Strait — Quick Reference

## File Location
```
packages/content/data/news_wire_ns.json
```

## Data Structure
```typescript
{
  id: string;                    // nw_001, nw_002, ...
  beatId: string;                // ns_opening_signal, ns_strait_pressure, ...
  phase: string;                 // opening | rising | crisis | climax | resolution
  outlet: string;                // The Capital Standard, MarketPulse, @StraitWatch, ...
  outletType: string;            // wire | broadsheet | financial | defense_trade | tabloid | state_media | social_media
  region: string;                // domestic | allied | rival | neutral | international | regional
  headline: string;              // 8-15 words, punchy, journalistic
  lede: string;                  // 2-3 sentences, journalistic voice
  pullQuote?: string;            // Optional: quoted attribution (27.5% of articles)
  tone: string;                  // neutral | hawkish | dovish | alarmist | skeptical | analytical
  tags: string[];                // 1-3 topics: military, diplomatic, economic, cyber, energy, alliance, humanitarian, domestic
  narrativeWeight: string;       // background | developing | breaking | exclusive | opinion
}
```

## Quick Filters

**By Beat (Article Count)**
```
ns_opening_signal: 8
ns_backchannel_opening: 8
ns_strait_pressure: 8
ns_trade_friction: 8
ns_info_war: 6
ns_alliance_split: 6
ns_crisis_window: 7
ns_missile_warning: 6
ns_covert_shadow: 6
ns_urban_unrest: 5
ns_market_spiral: 7
ns_carrier_faceoff: 5
ns_ceasefire_channel: 5
ns_frozen_line: 4
ns_stabilization_settlement: 5
ns_regime_shock: 4
ns_economic_break: 5
ns_open_war: 17
```

**By Outlet (Article Count)**
```
The Capital Standard: 19         (broadsheet, domestic voice)
Global Press Wire: 17            (wire service, international)
Kaltor State Broadcasting: 17    (state media, propaganda)
The Herald-Tribune: 13           (broadsheet, allied voice)
MarketPulse: 10                  (financial, data-first)
Pacific Monitor: 10              (broadsheet, neutral regional)
Jane's Conflict Monitor: 10      (defense trade, technical)
The Daily Signal: 7              (tabloid, hawkish domestic)
@StraitWatch: 9                  (social media, OSINT aggregator)
Strait Bureau: 3                 (wire service, regional)
Sovereign Risk Weekly: 5         (financial, credit-focused)
```

**By Phase (Article Count)**
```
opening: 16          (Subtle signals, diplomatic openers)
rising: 28           (Escalating pressure, trade friction, alliance cracks)
crisis: 31           (Military posturing, market panic, covert ops)
climax: 31           (Carrier standoff, ceasefire channels, war outbreak)
resolution: 14       (Settlements, economic recovery, regime shock)
```

**By Region (Article Count)**
```
international: 51    (Global perspective)
domestic: 26         (Player nation perspective)
rival: 17            (Kaltor-aligned narratives)
allied: 13           (Coalition partner perspective)
neutral: 10          (Third-party mediators)
regional: 3          (Regional specialists)
```

**By Tone (Article Count)**
```
analytical: 60       (Balanced, thoughtful analysis)
alarmist: 28         (Crisis, panic, urgency)
hawkish: 17          (Conflict-supportive, aggressive)
neutral: 13          (Factual, non-emotional)
dovish: 2            (Peace-seeking, diplomatic)
```

**By Narrative Weight (Article Count)**
```
developing: 56       (Ongoing coverage, follow-ups)
breaking: 32         (First reports, major announcements)
exclusive: 16        (Intelligence leaks, scoops)
opinion: 4           (Op-eds, analysis pieces)
background: 8        (Context, explanation)
```

## Sample Queries

### Get all articles about missile deployments
```javascript
articles.filter(a => a.beatId === 'ns_missile_warning');
// Returns 6 articles covering the threat from multiple outlets
```

### Get domestic opinion on the crisis
```javascript
articles.filter(a => 
  a.region === 'domestic' && 
  a.phase === 'crisis'
);
// Returns 8-10 domestic perspective articles during crisis phase
```

### Get breaking news (all phases)
```javascript
articles.filter(a => a.narrativeWeight === 'breaking');
// Returns 32 articles marking major developments
```

### Get propagandistic coverage
```javascript
articles.filter(a => a.outlet === 'Kaltor State Broadcasting');
// Returns 17 articles with regime-favorable spin
```

### Get market/economic analysis
```javascript
articles.filter(a => a.tags.includes('economic'));
// Returns ~30 articles covering financial impact
```

### Get articles for live news feed during opening phase
```javascript
articles.filter(a => 
  a.phase === 'opening' && 
  ['breaking', 'developing'].includes(a.narrativeWeight)
);
// Returns 12-14 articles to populate opening news updates
```

## Editorial Voices (For Writing Additional Articles)

**The Capital Standard** — Institutional, measured, policy-focused
- Example: "Defense officials briefed Congress on intelligence indicating..."
- Tone: cautious, detail-oriented, authoritative

**The Daily Signal** — Populist, hawkish, sometimes sensational
- Example: "Kaltor's aggressive war games caught Pentagon off guard..."
- Tone: alarmist, combative, eye-catching headlines

**MarketPulse** — Data-first, trend-focused, financial
- Example: "Shipping insurance premiums have ticked upward as traders price in geopolitical risk..."
- Tone: analytical, numbers-based, market-aware

**Kaltor State Broadcasting** — Propaganda, regime-favorable, defensive
- Example: "Kaltor strengthens defense in response to foreign military encroachment..."
- Tone: hawkish (in Kaltor's favor), blame-shifting, nationalist

**Jane's Conflict Monitor** — Technical, equipment-focused, dry
- Example: "Kaltor has positioned several battalion-level cruise missile units in forward locations..."
- Tone: analytical, precise, military-technical

**@StraitWatch** — OSINT aggregator, crowdsourced, unverified
- Example: "Multiple diplomatic sources and open-source monitors have reported movement of high-level envoys..."
- Tone: analytical, hedged, crowd-sourced

## Integration Checklist

- [ ] Load `news_wire_ns.json` into content pipeline bootstrap
- [ ] Connect live news feed UI to filter by beatId/phase/region/tone
- [ ] Verify articles render correctly in news feed component
- [ ] Test filtering and sorting during playtest
- [ ] Confirm tone escalation matches phase progression in gameplay
- [ ] Validate pull quotes display properly with attribution
- [ ] Check that outlet names and types match UI expectations
- [ ] Consider optional enrichment for terminal scenarios

---

*Quick reference for ESCALATION narrative content integration | Updated 2026-03-04*
