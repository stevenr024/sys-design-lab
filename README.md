# Scale to Millions — Interactive Visualizations

Browser-based, interactive visualizations for the scaling concepts in Chapter 2 of *System Design Interview* by Alex Xu. No install, no build step — open in a browser and explore.

## Visualizations

| # | Name | Status | Description |
|---|------|--------|-------------|
| 1 | Evolution Scrubber | ✅ ready | Scrub through 11 architecture stages from a single server to a sharded, multi-region stack |
| 2 | Failure Simulator | ✅ ready | Kill any component and watch traffic reroute — or the site go dark |
| 3 | Traffic Playground | planned | Ramp users from 1 to 10M; add infrastructure as bottlenecks appear |
| 4 | Sharding & Hotspots | ✅ ready | Distribute users across shards by hash key; inject a celebrity key and try fixes |
| 5 | Cache Visualizer | planned | Read-through cache with TTL countdowns and LRU/LFU/FIFO eviction side by side |
| 6 | Build Your Stack | planned | Spend a budget on upgrades as traffic ticks up; score: uptime × users − cost |

## Running locally

```bash
python3 -m http.server 8765 --directory .
```

Then open `http://localhost:8765`.

## Tech

- **Alpine.js 3.x** via CDN for reactive UI — no build step
- **SVG + CSS transitions** for architecture diagrams
- Vanilla JS, static multi-page site — each visualization is self-contained in its own folder
