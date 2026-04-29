document.addEventListener('alpine:init', () => {

  // Helpers for service-status results.
  const ok        = (reason) => ({ state: 'ok',        reason });
  const degraded  = (reason) => ({ state: 'degraded',  reason });
  const down      = (reason) => ({ state: 'down',      reason });

  // Each service computes its status from the dead-set + helper context.
  // Predicates capture the chapter's reachability rules.
  const SERVICES = [
    {
      id: 'static',
      label: 'Static content',
      desc: 'images, JS, CSS',
      compute(d, ctx) {
        if (!d.cdn) return ok('CDN serving from edge');
        // CDN is dead; falls back to origin web servers via LB.
        if (d.lb)              return down('CDN down · origin LB also down');
        if (!ctx.anyWeb)       return down('CDN down · no web servers alive');
        return degraded('CDN down · serving from origin (slower, more bandwidth)');
      },
    },
    {
      id: 'read',
      label: 'Read requests',
      desc: 'load profile, view feed',
      compute(d, ctx) {
        if (d.lb)              return down('LB down · all traffic blocked');
        if (!ctx.anyWeb)       return down('no web servers alive');
        if (!ctx.anyShard)     return down('all shards dead · no data tier');
        const lostShards = 4 - ctx.aliveShards.length;
        if (lostShards > 0)    return degraded(`${lostShards}/4 shards down · ${Math.round(lostShards/4*100)}% of users get errors`);
        if (d.cache)           return degraded('cache down · reads hitting DB directly (slower)');
        return ok('all read paths healthy');
      },
    },
    {
      id: 'write',
      label: 'Write requests',
      desc: 'post, update, delete',
      compute(d, ctx) {
        if (d.lb)              return down('LB down');
        if (!ctx.anyWeb)       return down('no web servers alive');
        if (!ctx.anyShard)     return down('all shards dead · writes have nowhere to go');
        const lostShards = 4 - ctx.aliveShards.length;
        if (lostShards > 0)    return degraded(`${lostShards}/4 shards down · writes for that key range fail`);
        return ok('all write paths healthy');
      },
    },
    {
      id: 'session',
      label: 'Sessions',
      desc: 'login, auth lookups',
      compute(d, ctx) {
        if (d.lb)                  return down('LB down');
        if (!ctx.anyWeb)           return down('no web servers alive');
        if (d['session-store'])    return down('session store dead · users get logged out');
        return ok('session lookups healthy');
      },
    },
    {
      id: 'async',
      label: 'Async jobs',
      desc: 'image processing, emails',
      compute(d, ctx) {
        if (d.lb)                  return down('LB down · jobs can\'t be enqueued');
        if (!ctx.anyWeb)           return down('no web servers to enqueue jobs');
        if (d['message-queue'])    return down('queue down · enqueue fails');
        if (d.worker)              return degraded('queue alive but worker down · jobs piling up');
        return ok('queue + worker healthy');
      },
    },
    {
      id: 'nosql',
      label: 'NoSQL workload',
      desc: 'unstructured / non-relational',
      compute(d, ctx) {
        if (d.lb)              return down('LB down');
        if (!ctx.anyWeb)       return down('no web servers alive');
        if (d.nosql)           return down('NoSQL store dead · unstructured features broken');
        return ok('NoSQL paths healthy');
      },
    },
  ];

  // Preset failure scenarios. Each replaces the dead-set so the demo is clean.
  const SCENARIOS = [
    {
      id: 'lose-web',
      label: 'Lose a web server',
      desc: 'One of the two web servers dies. LB should route around it.',
      kills: ['web-1'],
    },
    {
      id: 'lose-shard',
      label: 'Lose a shard',
      desc: 'A single shard goes offline — only the users on that shard are affected.',
      kills: ['shard-2'],
    },
    {
      id: 'cache-fails',
      label: 'Cache fails',
      desc: 'Cache evaporates. System still works, just slower and DB load spikes.',
      kills: ['cache'],
    },
    {
      id: 'lb-dies',
      label: 'LB dies',
      desc: 'The classic SPOF. Without a redundant LB, everything goes dark.',
      kills: ['lb'],
    },
    {
      id: 'dc-blackout',
      label: 'DC blackout',
      desc: 'Whole data center fails. In real life geoDNS would route to DC2 — that\'s the multi-DC payoff.',
      kills: ['lb', 'web-1', 'web-2', 'cache', 'shard-1', 'shard-2', 'shard-3', 'shard-4', 'nosql', 'session-store', 'message-queue', 'worker'],
    },
  ];

  Alpine.data('failureSim', () => ({

    dead: {},
    activeScenario: null,

    // Killable component IDs
    components: [
      'cdn', 'lb', 'web-1', 'web-2', 'cache',
      'shard-1', 'shard-2', 'shard-3', 'shard-4',
      'nosql', 'session-store', 'message-queue', 'worker',
    ],

    scenarios: SCENARIOS,

    toggleDead(id) {
      this.dead = { ...this.dead, [id]: !this.dead[id] };
      this.activeScenario = null;
    },
    isDead(id) { return !!this.dead[id]; },
    deadIds() { return this.components.filter(c => this.dead[c]); },

    resetDead() {
      this.dead = {};
      this.activeScenario = null;
    },

    applyScenario(id) {
      const s = this.scenarios.find(x => x.id === id);
      if (!s) return;
      const next = {};
      s.kills.forEach(k => { next[k] = true; });
      this.dead = next;
      this.activeScenario = id;
    },

    // Computed: service health rows.
    get services() {
      const d = this.dead;
      const aliveWebs   = ['web-1', 'web-2'].filter(x => !d[x]);
      const aliveShards = ['shard-1', 'shard-2', 'shard-3', 'shard-4'].filter(x => !d[x]);
      const ctx = {
        anyWeb:   aliveWebs.length > 0,
        anyShard: aliveShards.length > 0,
        aliveWebs,
        aliveShards,
      };
      return SERVICES.map(s => ({
        id: s.id,
        label: s.label,
        desc: s.desc,
        ...s.compute(d, ctx),
      }));
    },

    // Aggregate banner
    get summary() {
      const states = this.services.map(s => s.state);
      if (states.every(s => s === 'ok')) return { state: 'ok', label: 'all services healthy' };
      if (states.some(s => s === 'down')) return { state: 'down', label: 'service degraded — outages active' };
      return { state: 'degraded', label: 'partial degradation' };
    },
  }));
});
