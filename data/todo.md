# Scale to Millions — TODO & Context

This is the cross-session handoff doc. Update it before ending a session so
future-Claude can pick up without a long re-orientation.

---

## Visualizations

| # | Name                | Status      | Folder            |
|---|---------------------|-------------|-------------------|
| 1 | Evolution Scrubber  | ✅ ready    | `01-evolution/`   |
| 2 | Failure Simulator   | ✅ ready    | `02-failure-sim/` |
| 3 | Traffic Playground  | ⏳ planned  | —                 |
| 4 | Sharding & Hotspots | ✅ ready    | `04-sharding/`    |
| 5 | Cache Visualizer    | ⏳ planned  | —                 |
| 6 | Build Your Stack    | ⏳ planned  | —                 |

The numbering on the landing page is the canonical order, but build order
doesn't have to match — folders are named after the landing-page number.

---

## Open todos

- [ ] **URL state for failure simulator.** Encode `dead` set into a query
      param (e.g. `?dead=lb,cache,shard-2`) so failure scenarios are
      shareable links. Mirror the pattern used in `01-evolution/evolution.js`
      (`init()` + `$watch` + `popstate`).
- [ ] **URL state for sharding lab.** Encode `shardKey`, `shardCount`,
      `celebrityActive`, `seed` so configurations are deep-linkable.
- [ ] **Sharding lab v2.** Two big follow-ups:
      - Resharding diff view — when N changes, highlight which keys moved.
      - Consistent hashing ring — show the K/N-keys-move property.
- [ ] **Build #3 Traffic Playground.**
- [ ] **Build #5 Cache Visualizer** — TTL countdowns + LRU/LFU/FIFO side by side.
- [ ] **Build #6 Build Your Stack** — biggest of the six, save for last.
- [ ] **Polish pass** before publishing: mobile layout audit, a11y check,
      keyboard nav on failure sim and sharding lab.

---

## Stack & conventions

- **Alpine.js 3.x** via CDN — no build step.
- **SVG + CSS transitions** for diagrams. Components have a `.node` class,
  transitions are opacity-only (SVG `<g>` already uses `transform` for
  positioning, so a CSS `transform` would conflict).
- **Marker arrows** use `fill="context-stroke"` so they inherit each line's
  stroke color (including red for dead links).
- **Vanilla JS** in page-specific files. Alpine `data()` factories are
  registered inside `alpine:init` listeners.
- **Per-page styles** in `<folder>/styles.css`. Avoid inline `<style>`
  blocks and `style="…"` attributes — landing was refactored away from
  these (commit history will show the cleanup).
- **Static multi-page site.** Each viz is `index.html` + `styles.css` +
  one JS file in its own folder.
- Loaded into the browser via `python3 -m http.server 8765 --directory .`
  for local dev. No build / no bundler.

### File layout

```
/index.html              landing page
/styles.css              landing-page CSS
/shared/styles.css       base palette + primitives (every page links it)
/01-evolution/           Evolution Scrubber
/02-failure-sim/         Failure Simulator
/04-sharding/            Sharding & Hotspots
/data/todo.md            this file
```

---

## Key design decisions

- **URLs use 1-indexed stage params** (`?stage=1` reads better than
  `?stage=0` for sharing). Conversion happens in `_parseUrlStage()` /
  the `$watch` push.
- **Three-state health** (ok / degraded / down) for the failure sim,
  not binary. "Degraded" is where the chapter's most interesting
  lessons live (cache off → still works just slower; one shard down →
  25 % of users affected).
- **DC2 stub kept decorative** (not killable) in the failure sim. A
  full multi-DC model would double every component and isn't worth
  the visual cost.
- **Final-state architecture** in the failure sim — no scrubber. The
  sim assumes you've already evolved your stack to the multi-region
  sharded form; only then do failures get interesting.
- **Worker is downstream of message queue, not the data tier.** When
  drawing the queue → worker → DB chain, the worker's writes are
  implicit; we don't draw worker → shard arrows because they would
  visually compete with the web-server → shard arrows. (User caught
  an early version where the NoSQL arrow came from the worker; it
  should come from the web tier.)

---

## Things to remember when picking up

- Local dev server runs on **port 8765**. Start with
  `python3 -m http.server 8765 --directory <project root>`.
- Stage 11 of the evolution scrubber is the "final" architecture; the
  failure sim re-uses its layout exactly.
- Component IDs are kebab-case (`web-1`, `master-db`, `session-store`).
- The cache → shard-1 link at evolution stage 11 is the "cache miss"
  arrow that replaces cache → master-db when sharding takes over.
- A user-visible TODO list is also tracked in the Claude Code task
  system during a session; that doesn't persist between sessions, so
  anything still pending at session-end goes into "Open todos" above.
