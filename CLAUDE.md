# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Interactive visualizations for Chapter 2 of the System Design Interview book ("Scale from Zero to Millions of Users"). Six planned visualizations; three are complete.

| # | Name | Status | Folder |
|---|------|--------|--------|
| 1 | Evolution Scrubber | ready | `01-evolution/` |
| 2 | Failure Simulator | ready | `02-failure-sim/` |
| 3 | Traffic Playground | planned | — |
| 4 | Sharding & Hotspots | ready | `04-sharding/` |
| 5 | Cache Visualizer | planned | — |
| 6 | Build Your Stack | planned | — |

## Running locally

```
python3 -m http.server 8765 --directory .
```

No build step, no bundler, no npm. Everything runs as static files in the browser.

## Stack & conventions

- **Alpine.js 3.x** via CDN. All Alpine components are registered inside `document.addEventListener('alpine:init', ...)` using `Alpine.data()`.
- **SVG + CSS transitions** for diagrams. Components use a `.node` class. Transitions are opacity-only — SVG `<g>` elements already use `transform` for positioning, so CSS `transform` on them would conflict.
- **Marker arrows** use `fill="context-stroke"` to inherit each line's stroke color (including red for dead links).
- **Per-page styles** go in `<folder>/styles.css`. Avoid inline `<style>` blocks and `style="…"` attributes.
- **Shared base** in `/shared/styles.css` — CSS custom properties for the dark palette (`--bg`, `--accent`, `--danger`, etc.), typography, and base element resets. Every page links it before its own stylesheet.
- Component IDs are kebab-case: `web-1`, `master-db`, `session-store`.

## Architecture patterns

### URL state
The evolution scrubber (`01-evolution/evolution.js`) is the reference implementation for URL state. Use its `init()` + `$watch` + `popstate` pattern when adding URL state to other visualizations.

Stage params are 1-indexed in the URL (`?stage=1`) for readability; conversion happens inside `_parseUrlStage()`.

### Failure simulator health model
Three states: `ok` / `degraded` / `down` — not binary. Each service has a `compute(deadSet, ctx)` function that derives its state from which components are in the dead set and a pre-computed context object (e.g., `ctx.anyWeb`, `ctx.aliveShards`).

### Sharding lab
Uses FNV-1a 32-bit hash for string keys and plain modulo for numeric `id` keys. User data is generated deterministically from a seed via Mulberry32 PRNG. Country distribution is intentionally skewed to produce a visible hotspot when sharding by country.

## Open todos (from `data/todo.md`)

- URL state for failure simulator — encode `dead` set as `?dead=lb,cache,shard-2`
- URL state for sharding lab — encode `shardKey`, `shardCount`, `celebrityActive`, `seed`
- Sharding lab v2: resharding diff view + consistent hashing ring
- Build viz #3 (Traffic Playground), #5 (Cache Visualizer), #6 (Build Your Stack)
- Polish pass before publishing: mobile layout, a11y, keyboard nav on failure sim and sharding lab

## Key design decisions

- **DC2 is decorative** in the failure sim — kept as a visual stub but not killable. A full multi-DC model would double every component and isn't worth the visual complexity.
- **Failure sim assumes the final evolved architecture** (stage 11 of the evolution scrubber). The sim is only interesting once the full stack exists.
- **Worker → DB arrows are implicit** in the failure sim. Drawing worker → shard arrows would visually compete with the web-server → shard arrows, so worker writes are not shown.
- **Stage 11 cache → shard-1** is the "cache miss" arrow — it replaces cache → master-db once sharding takes over.
