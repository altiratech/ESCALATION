# Altira Flashpoint (legacy repo: ESCALATION / WARGAMES)

Cloudflare-native, single-player strategic scenario-intelligence product.

## Stack
- Frontend: React + Vite + TypeScript + Tailwind
- Backend: Hono on Cloudflare Workers
- Database: Cloudflare D1 + Drizzle ORM
- Engine: deterministic TypeScript simulation core (seeded RNG)
- Content: data-driven JSON definitions for scenarios, actions, adversary profiles, and image metadata

## Quick Start (One Command)
From repo root:

```bash
npm run quickstart
```

This does:
1. install dependencies
2. generate placeholder image lexicon
3. run local D1 migration + seed
4. start API (`wrangler dev`) + web (`vite`) concurrently

Local URLs:
- Web: `http://localhost:5173`
- API: `http://localhost:8787`

## Manual Setup
```bash
npm install
npm run generate:images
npm run db:migrate
npm run db:seed
npm run dev
```

## Gameplay Loop (MVP)
- One 10-turn scenario
- 6 core visible meters + hidden latent variables
- 12 player actions with immediate, probabilistic, and delayed effects
- Scenario-embedded adversary profile with belief-driven policy (no player-selected rival profile)
- Beat-graph-driven narrative traversal (18-beat authored graph for Northern Strait)
- Deterministic Turn Debrief strip (2-3 causal lines per turn, fog-of-war preserving)
- Timed-beat runtime with ambient countdown, urgency thresholds, timeout-to-inaction branching, and per-beat/episode timer extension controls
- Timer accessibility mode at episode start (`standard`, `relaxed`, `off`) with explicit `Take No Action` path in `off` mode
- Beat/timer analytics metadata persisted per run (`beat_progress` table: transitions, timeout/explicit inaction, extension usage)
- Narrative candidate pack integrated into content pipeline (`narrative_candidates_v2.json`) for timed pressure text, debrief variants, and post-game reveal overlays
- Narrative-first advisor panel sourced from beat-authored guidance (dashboard/intel meter panes removed)
- End-of-episode post-game intelligence report with Full Causality sections (hidden deltas, adversary logic summary, unseen events, branch alternatives, advisor retrospectives)

## API Surface
- `POST /api/profiles`
- `POST /api/episodes/start`
- `GET /api/episodes/:episodeId`
- `POST /api/episodes/:episodeId/actions`
- `POST /api/episodes/:episodeId/inaction`
- `POST /api/episodes/:episodeId/countdown/extend`
- `GET /api/episodes/:episodeId/report`
- `GET /api/reference/bootstrap`

## Project Structure
```text
apps/
  api/                  # Hono Worker + D1 persistence
  web/                  # React/Vite client
packages/
  engine/               # deterministic simulation core
  content/              # JSON game definitions
  shared-types/         # shared domain and API types
db/
  migrations/           # SQL migrations
  seed/                 # seed SQL
scripts/
  generate-placeholders.ts
  generate-placeholders.mjs
tests/
  engine/               # deterministic/unit tests
```

## Data-Driven Content
Primary files:
- `packages/content/data/scenarios.json`
- `packages/content/data/actions.json`
- `packages/content/data/adversary_profiles.json`
- `packages/content/data/images.json`

Add or tune gameplay by editing these JSON files. Engine loads them directly at runtime.

Narrative extension pack:
- `packages/content/data/narrative_candidates_v2.json`

Beat graph authoring (Phase 1):
- `ScenarioDefinition.startingBeatId`
- `ScenarioDefinition.beats[]` (`BeatNode` with ordered branches and optional timed decision windows)

## Image Lexicon
Generate local placeholder visuals and metadata:

```bash
npm run generate:images
```

Assets are written to:
- `apps/web/public/assets/images/`
- `packages/content/data/images.json`

## Optional Narrative Polishing (LLM Adapter)
Default mode is deterministic template-only facts.

Set in Worker env (`apps/api/wrangler.toml` or Cloudflare vars):
- `LLM_MODE=off` (default)
- `LLM_MODE=mock` (mock tone-polish adapter)
- `CORS_ALLOW_ORIGINS` (comma-separated allowlist; use `*` only for temporary diagnostics)
- `RATE_LIMIT_ENABLED=1` (set `0` to disable)
- `RATE_LIMIT_MAX_REQUESTS=120` (per IP + method, within the configured window)
- `RATE_LIMIT_WINDOW_SECONDS=60`

No provider key is required for MVP.

## Testing
Run tests:

```bash
npm test
```

Includes:
- deterministic seed replay
- delayed effect scheduling
- belief update behavior
- outcome rule evaluation
- beat traversal logic
- beat graph structural validation

Phase 1 content-tooling gates:

```bash
npm run validate:content
npm run simulate:balance
npm run test:token-regression
```

One-shot Phase 1 gate:

```bash
npm run ci:phase1
```

`ci:phase1` fails on:
- beat graph integrity errors (unreachable beats, broken branch targets, terminal-orphan paths)
- degenerate Monte Carlo distributions (>80% convergence to one terminal beat)
- missing Monte Carlo beat coverage
- token budget regressions >10% over configured limits

## Cloudflare Deployment
1. Authenticate:
```bash
npx wrangler whoami
# if needed
npx wrangler login
```

2. Create D1 DB (once):
```bash
npx wrangler d1 create escalation-db
```

3. Update `apps/api/wrangler.toml` with returned `database_id`.

4. Apply migration + seed remotely:
```bash
cd apps/api
npx wrangler d1 execute escalation-db --remote --file=../../db/migrations/0001_init.sql
npx wrangler d1 execute escalation-db --remote --file=../../db/migrations/0002_tracking_analytics.sql
npx wrangler d1 execute escalation-db --remote --file=../../db/seed/seed.sql
```

5. Deploy API Worker:
```bash
npm run deploy --workspace @wargames/api
```

6. Deploy web app (static) using your Cloudflare web hosting flow and point it to Worker API route.

7. Attach DNS for `escalation.altiratech.com` in Cloudflare.

## GitHub Actions CI/CD
- `CI` workflow (`.github/workflows/ci.yml`) runs on pull requests.
- `Deploy` workflow (`.github/workflows/deploy.yml`) runs on `main` pushes and:
  1. runs lint + `ci:phase1`,
  2. deploys API Worker,
  3. builds/deploys web to Cloudflare Pages,
  4. runs post-deploy verification checks.

Required repo secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Optional repo variables:
- `CLOUDFLARE_PAGES_PROJECT` (default `escalation-web`)
- `CLOUDFLARE_PAGES_BRANCH` (default `main`)
- `ESCALATION_VERIFY_API_HEALTH_URL`
- `ESCALATION_VERIFY_API_BOOTSTRAP_URL`
- `ESCALATION_VERIFY_WEB_URL`

## Deployment Verification
Run production verification checks manually:

```bash
./scripts/verify-deploy.sh
```

Override targets via env vars:

```bash
VERIFY_API_HEALTH_URL=https://escalation.altiratech.com/api/healthz \
VERIFY_API_BOOTSTRAP_URL=https://escalation.altiratech.com/api/reference/bootstrap \
VERIFY_WEB_URL=https://escalation.altiratech.com \
./scripts/verify-deploy.sh
```

## Notes
- No real-world leaders/networks are referenced.
- Narrative facts are state-derived, not free-form invented.
- No live image generation in turn loop.
