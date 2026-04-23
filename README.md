# Altira Flashpoint

Altira Flashpoint is a Cloudflare-native, single-player strategic scenario-intelligence product.

The public GitHub repo is `altiratech/ESCALATION`. Some package and folder names still use the older `wargames` naming.

## Status

Active MVP build.

Current runtime capabilities include:
- one flagship black-swan scenario with deterministic simulation state
- authored beat-graph narrative traversal
- player actions with immediate, probabilistic, and delayed effects
- visible meters plus hidden latent variables
- timed decision windows with accessibility modes
- scenario-embedded adversary behavior
- turn debriefs and post-game intelligence reports
- D1-backed run persistence and analytics metadata

Flashpoint does not use real-world leaders or real private networks. Narrative facts are state-derived rather than free-form invented during play.

## Quick Start

```bash
git clone https://github.com/altiratech/ESCALATION.git
cd ESCALATION
npm run quickstart
```

`npm run quickstart` installs dependencies, generates the placeholder image lexicon, applies local D1 setup, seeds local content, and starts the API and web app together.

Local URLs:
- Web: `http://localhost:5173`
- API: `http://localhost:8787`

Manual setup:

```bash
npm install
npm run generate:images
npm run db:migrate
npm run db:seed
npm run dev
```

## Product Loop

- read the current scenario beat
- choose an action or explicitly take no action
- watch deterministic state and hidden variables evolve
- receive a concise causal debrief
- continue through the authored beat graph
- review full causality after the episode ends

## API Surface

- `POST /api/profiles`
- `POST /api/episodes/start`
- `GET /api/episodes/:episodeId`
- `POST /api/episodes/:episodeId/actions`
- `POST /api/episodes/:episodeId/inaction`
- `POST /api/episodes/:episodeId/countdown/extend`
- `GET /api/episodes/:episodeId/report`
- `GET /api/reference/bootstrap`

## Access Model

Flashpoint currently uses a lightweight playtest profile model:
- `POST /api/profiles` creates a temporary run profile keyed by codename
- episodes attach to that profile for persistence, scoring, and report lookup
- there is no shared Altira account, workspace membership, subscription, or entitlement layer in this repo yet

The scenario `role` field is an in-scenario viewpoint, not an access-control role.

## Repo Shape

```text
apps/api/          Hono Worker API and D1 persistence
apps/web/          React/Vite client
packages/engine/   deterministic simulation core
packages/content/  scenario, action, adversary, beat, and image metadata
packages/shared-types/
db/                D1 migrations and seed data
scripts/           validation, image, simulation, and deployment helpers
tests/             deterministic and content integrity tests
```

## Content and Asset Authoring

Primary content lives in:
- `packages/content/data/scenarios.json`
- `packages/content/data/actions.json`
- `packages/content/data/adversary_profiles.json`
- `packages/content/data/images.json`
- `packages/content/data/narrative_candidates_v2.json`

Generate local placeholder visuals and metadata:

```bash
npm run generate:images
```

Optional image-generation workflows exist for offline asset authoring only. Live gameplay does not generate images during the turn loop.

## Testing

```bash
npm test
```

Phase 1 content-tooling gates:

```bash
npm run validate:content
npm run simulate:balance
npm run test:token-regression
```

One-shot gate:

```bash
npm run ci:phase1
```

## Deployment

Flashpoint deploys through Cloudflare Workers, D1, and Cloudflare Pages. Required production credentials should be configured as GitHub Actions or Cloudflare secrets, not committed to the repo.

Useful deployment verification:

```bash
npm run verify:deploy
```

## License

No open-source license has been selected yet. Public source visibility does not grant reuse rights until a license file is added.
