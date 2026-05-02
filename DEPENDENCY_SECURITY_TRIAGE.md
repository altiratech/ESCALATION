# Flashpoint Dependency Security Triage

Last checked: 2026-05-02

## Current Audit Result

- `npm audit --omit=dev`: 2 high-severity runtime advisories, both reported as no-fix-available by npm.
- `npm audit`: 30 total advisories, with most additional findings in local dev/build tooling (`vite`, `vitest`, `tailwindcss`, `wrangler`, `miniflare`, `drizzle-kit`, transitive `esbuild`, `picomatch`, `postcss`, `undici`).

## Runtime Findings

- `hono`: advisories are concentrated around APIs this app does not currently use in production paths: cookie helpers, static serving middleware, SSE writer, JSX SSR, SSG output, and `parseBody({ dot: true })`. Keep Hono pinned/monitored and upgrade as soon as a fixed release is available.
- `drizzle-orm`: advisory concerns escaping SQL identifiers. Current API code uses fixed schema/query builders and does not accept user-controlled table or column identifiers. Avoid introducing dynamic identifier construction until this advisory has a fix or a local escaping review.

## Dev/Build Findings

- `vite`/`esbuild` dev-server advisories affect local development exposure. Do not run dev servers on public interfaces.
- `wrangler`/`miniflare` `undici` advisories affect local/deploy tooling paths. Keep deployment machines trusted and update Cloudflare tooling when fixes land.
- `picomatch`/`postcss` findings are transitive through build/test tooling. Treat as build-chain monitoring, not player-facing runtime exposure, unless user-provided globs/CSS enter the build path.

## Follow-Up

- Re-run `npm audit --omit=dev` before public playtest.
- Prefer dependency upgrades that keep Hono, Wrangler, Vite, and Drizzle inside supported release lines.
- Do not apply broad `npm audit fix --force` without a browser/gameplay regression pass; it can change Vite/Wrangler behavior.
