document.addEventListener('alpine:init', () => {
  Alpine.data('evolution', () => ({
    stage: 0,
    deadComponents: [],

    stages: [
      {
        shortTitle: 'Single server',
        title: 'Single server',
        whatChanged: 'Everything — web app, database, cache — runs on one machine. The browser does a DNS lookup, gets back the server\'s IP, and talks HTTP directly to it.',
        why: 'Simplest possible setup. Cheap to run, fast to ship, and easy to reason about while traffic is small.',
        tradeoffs: 'Single point of failure. No redundancy. Vertical scaling only — when the box runs out of CPU or RAM, the site does too.',
      },
      {
        shortTitle: 'Separate DB tier',
        title: 'Web tier and data tier separated',
        whatChanged: 'The database moves to its own server. Web app stays on its own host. Each tier can now be sized, tuned, and scaled independently.',
        why: 'Web traffic and database load have different resource profiles. Splitting them lets each tier grow on its own schedule and unblocks the next round of scaling.',
        tradeoffs: 'Adds a network hop between web and DB. One more server to operate.',
      },
      {
        shortTitle: 'Load balancer',
        title: 'Load balancer + multiple web servers',
        whatChanged: 'A load balancer fronts a pool of web servers. Clients connect to the LB\'s public IP; web servers sit behind it on a private network.',
        why: 'Eliminates the web server as a SPOF and lets the web tier scale horizontally. Add more boxes to absorb more traffic; if one dies, the LB routes around it.',
        tradeoffs: 'The LB is now a SPOF (mitigated with redundant LBs). Web servers should be roughly stateless or rely on sticky sessions, which has its own pain.',
      },
      {
        shortTitle: 'DB replication',
        title: 'Database replication (master / slaves)',
        whatChanged: 'One master takes writes; multiple read-replicas (slaves) get a copy of the data and serve reads. Web servers route writes to master and reads to a slave.',
        why: 'Reads dominate most workloads. Spreading them across replicas multiplies read throughput, and the replicas double as warm backups for durability and DB failover.',
        tradeoffs: 'Replication lag — replicas can be stale. Master is still a SPOF for writes; promoting a replica on failure is non-trivial because the new master may be missing recent writes.',
      },
      {
        shortTitle: 'Cache',
        title: 'Cache tier added',
        whatChanged: 'An in-memory cache (Redis, Memcached) sits between web servers and the DB. Reads check cache first; on a miss, fetch from DB and populate the cache (read-through).',
        why: 'Memory is orders of magnitude faster than disk. The cache absorbs hot reads, slashing DB load and tail latency.',
        tradeoffs: 'Cache and DB can drift out of sync. TTL and eviction (LRU / LFU / FIFO) need tuning. Cache stampedes on cold start. The cache itself is a SPOF unless replicated.',
      },
      {
        shortTitle: 'CDN',
        title: 'CDN for static content',
        whatChanged: 'Static assets (JS, CSS, images, video) are served from a geographically distributed CDN instead of the origin web servers.',
        why: 'Content cached close to the user dramatically cuts latency and offloads bandwidth from your origin. Often the single biggest perceived-performance win.',
        tradeoffs: 'Per-byte transfer cost. Cache invalidation pain. Need a fallback path to origin if the CDN has an outage.',
      },
      {
        shortTitle: 'Stateless web tier',
        title: 'Stateless web tier',
        whatChanged: 'Session state moves out of web servers and into a shared store (Redis, NoSQL, RDBMS). Any web server can now serve any request from any user.',
        why: 'Stateful servers force sticky sessions and make autoscaling and failover painful. Stateless servers are interchangeable — kill one, spin up ten — which is what cloud autoscaling assumes.',
        tradeoffs: 'Every request now does a session lookup. The shared session store becomes critical infrastructure that must itself be HA.',
      },
      {
        shortTitle: 'Multi-data-center',
        title: 'Multiple data centers + geoDNS',
        whatChanged: 'The whole stack is deployed in multiple regions. GeoDNS routes each user to their nearest data center; on outage, traffic shifts to a healthy DC.',
        why: 'Lower latency for global users plus regional failover. A whole DC can go offline and the site stays up.',
        tradeoffs: 'Cross-DC data replication is hard (eventual consistency, conflicts). Test and deploy must cover all regions. Significantly more cost and operational complexity.',
      },
      {
        shortTitle: 'Message queue',
        title: 'Message queue for async work',
        whatChanged: 'A durable queue sits between web servers (producers) and worker processes (consumers). Slow jobs — image processing, emails, billing — are enqueued and handled asynchronously.',
        why: 'Decouples slow work from request handling. Producers and consumers scale independently. Buffers traffic spikes and survives downstream outages.',
        tradeoffs: 'Async means eventual completion — UX must accommodate. The queue itself needs to be durable and monitored. Failure modes (poison messages, dead-letter queues) add complexity.',
      },
      {
        shortTitle: 'Observability',
        title: 'Logging, metrics, automation',
        whatChanged: 'Centralized log aggregation, metrics collection (host / tier / business KPIs), and CI/CD automation are added.',
        why: 'At scale you can\'t debug or operate by ssh-ing into boxes. Aggregated logs and metrics make incidents diagnosable; automation makes deploys safe and frequent.',
        tradeoffs: 'More moving parts to run. Cost of storing logs and metrics. Not optional past a certain size.',
      },
      {
        shortTitle: 'Sharded database',
        title: 'Database sharding',
        whatChanged: 'The database is partitioned across shards by a sharding key (e.g. user_id). Each shard holds a slice of the data. NoSQL is added for use cases that don\'t need joins or transactions.',
        why: 'A single master eventually can\'t keep up with writes or hold all the data. Sharding scales writes horizontally — add more shards to add more capacity.',
        tradeoffs: 'Cross-shard joins are painful (de-normalize instead). Resharding is hard (consistent hashing helps). Hotspot / "celebrity" keys can overload one shard.',
      },
    ],

    get current() { return this.stages[this.stage]; },
    get stageCount() { return this.stages.length; },

    init() {
      // Initial sync: ?stage=N in the URL → set stage (URL is 1-indexed for humans).
      const fromUrl = this._parseUrlStage();
      if (fromUrl !== null) this.stage = fromUrl;

      // Stage changes → push to history (so back/forward walks the scrubber).
      this.$watch('stage', (newStage) => {
        if (this._suppressUrlSync) return;
        const url = new URL(window.location);
        url.searchParams.set('stage', newStage + 1);
        history.pushState({ stage: newStage }, '', url);
      });

      // Browser back/forward → re-read URL → set stage (without re-pushing).
      window.addEventListener('popstate', () => {
        const target = this._parseUrlStage() ?? 0;
        this._suppressUrlSync = true;
        this.stage = target;
        this.$nextTick(() => { this._suppressUrlSync = false; });
      });
    },

    _parseUrlStage() {
      const raw = new URLSearchParams(location.search).get('stage');
      if (raw === null) return null;
      const n = parseInt(raw, 10) - 1;
      return (!isNaN(n) && n >= 0 && n < this.stages.length) ? n : null;
    },

    next() { if (this.stage < this.stages.length - 1) this.stage++; },
    prev() { if (this.stage > 0) this.stage--; },

    visibleAt(from, to) {
      if (this.stage < from) return false;
      if (to !== undefined && this.stage > to) return false;
      return true;
    },

    toggleDead(id) {
      const i = this.deadComponents.indexOf(id);
      if (i === -1) this.deadComponents.push(id);
      else this.deadComponents.splice(i, 1);
    },
    isDead(id) { return this.deadComponents.includes(id); },
    resetDead() { this.deadComponents = []; },

    onKeydown(e) {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') { this.next(); e.preventDefault(); }
      if (e.key === 'ArrowLeft')  { this.prev(); e.preventDefault(); }
    },
  }));
});
