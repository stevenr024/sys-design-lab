// ---------- helpers ----------

// Mulberry32 — small, fast, deterministic PRNG
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a 32-bit string hash
function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Pick a shard for a user given the chosen key + shard count.
// `id` uses plain modulo (the chapter's textbook example).
// String fields go through FNV-1a then mod N.
function shardFor(user, key, n) {
  const v = user[key];
  if (key === 'id')      return ((v % n) + n) % n;
  return fnv1a(String(v)) % n;
}

// Generate 100 deterministic users from a seed.
// Country distribution is intentionally skewed so "shard by country"
// produces a visible hotspot.
function generateUsers(seed) {
  const r = mulberry32(seed);
  const FIRST = ['Alice','Bob','Carol','David','Eve','Frank','Grace','Henry','Ivy','Jack','Karen','Liam','Mia','Noah','Olivia','Paul','Quinn','Rose','Sam','Tara','Uma','Victor','Wendy','Xavier','Yara','Zack'];
  const LAST  = ['Adams','Brown','Chen','Davis','Evans','Foster','Garcia','Hall','Iyer','Jones','Kim','Lee','Martinez','Nguyen','OBrien','Patel','Qureshi','Rao','Smith','Tan','Ueno','Volkov','Wong','Xu','Young','Ziegler'];
  const COUNTRIES = [
    ['US',     30],
    ['India',  20],
    ['Brazil', 15],
    ['Germany', 8],
    ['UK',      7],
    ['Japan',   6],
    ['France',  5],
    ['Canada',  4],
    ['Mexico',  3],
    ['Sweden',  2],
  ];
  const totalWeight = COUNTRIES.reduce((s, [, w]) => s + w, 0);

  const users = [];
  for (let i = 1; i <= 100; i++) {
    const first = FIRST[Math.floor(r() * FIRST.length)];
    const last  = LAST [Math.floor(r() * LAST.length)];
    const name  = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`;

    let pick = r() * totalWeight;
    let country = COUNTRIES[0][0];
    for (const [c, w] of COUNTRIES) {
      pick -= w;
      if (pick <= 0) { country = c; break; }
    }

    users.push({ id: i, name, email, country, traffic: 1, isCelebrity: false });
  }

  // Always-present celebrity user (toggle their traffic, they don't disappear).
  users.push({ id: 999, name: '🌟 Pop Star', email: 'popstar999@example.com', country: 'US', traffic: 1, isCelebrity: true });

  return users;
}

// ---------- Alpine data ----------

document.addEventListener('alpine:init', () => {
  Alpine.data('shardingLab', () => ({

    seed: 42,
    users: [],

    // controls
    shardKey: 'id',
    shardCount: 4,
    celebrityActive: false,

    keyOptions: [
      { id: 'id',      label: 'user_id',    desc: 'integer % N' },
      { id: 'name',    label: 'name',       desc: 'fnv1a(name) % N' },
      { id: 'email',   label: 'email',      desc: 'fnv1a(email) % N' },
      { id: 'country', label: 'country',    desc: 'fnv1a(country) % N' },
    ],

    init() {
      this.users = generateUsers(this.seed);
    },

    regenerate() {
      this.seed = Math.floor(Math.random() * 1e6);
      this.users = generateUsers(this.seed);
    },

    toggleCelebrity() {
      this.celebrityActive = !this.celebrityActive;
      const celeb = this.users.find(u => u.isCelebrity);
      if (celeb) celeb.traffic = this.celebrityActive ? 1000 : 1;
    },

    // ---------- derived ----------

    get activeUsers() {
      return this.celebrityActive ? this.users : this.users.filter(u => !u.isCelebrity);
    },

    get shards() {
      const out = Array.from({ length: this.shardCount }, () => []);
      for (const u of this.activeUsers) {
        const idx = shardFor(u, this.shardKey, this.shardCount);
        out[idx].push(u);
      }
      return out;
    },

    get countDistribution() {
      return this.shards.map(s => s.length);
    },

    get trafficDistribution() {
      return this.shards.map(s => s.reduce((sum, u) => sum + u.traffic, 0));
    },

    get totalTraffic() {
      return this.trafficDistribution.reduce((s, x) => s + x, 0);
    },

    get maxCount() { return Math.max(1, ...this.countDistribution); },
    get maxTraffic() { return Math.max(1, ...this.trafficDistribution); },

    // ---------- insights ----------

    get countSkew() {
      const counts = this.countDistribution;
      const max = Math.max(...counts);
      const min = Math.min(...counts);
      if (min === 0) return Infinity;
      return max / min;
    },

    get insights() {
      const counts = this.countDistribution;
      const max = Math.max(...counts);
      const min = Math.min(...counts);
      const ideal = Math.round(this.activeUsers.length / this.shardCount);

      const items = [];

      // Count distribution
      if (min === 0) {
        items.push({ kind: 'warn', text: `${counts.filter(c => c === 0).length} shard(s) hold no users — wasted capacity.` });
      } else if (max / min > 1.5) {
        items.push({ kind: 'warn', text: `Count skew ${(max / min).toFixed(1)}× (${min}–${max}). Ideal is ~${ideal} per shard.` });
      } else {
        items.push({ kind: 'ok', text: `Even distribution: ${min}–${max} users per shard (ideal ≈${ideal}).` });
      }

      // Traffic / hotspot
      if (this.celebrityActive) {
        const t = this.trafficDistribution;
        const total = this.totalTraffic;
        const hotIdx = t.indexOf(Math.max(...t));
        const pct = Math.round((t[hotIdx] / total) * 100);
        if (pct > 50) {
          items.push({ kind: 'danger', text: `Shard ${hotIdx} carries ${pct}% of traffic — celebrity hotspot.` });
        } else {
          items.push({ kind: 'ok', text: `Celebrity active but traffic is spread (${pct}% on the hottest shard).` });
        }
      }

      // Sharding-key hint
      if (this.shardKey === 'country') {
        items.push({ kind: 'info', text: `Hashing on a low-cardinality field (country) collapses many users onto the same shard.` });
      } else if (this.shardKey === 'id') {
        items.push({ kind: 'info', text: `Sequential id mod N gives perfect distribution — but only because ids are dense and unique.` });
      }

      return items;
    },

    // What shard the celebrity ends up on (for highlighting)
    get celebShardIdx() {
      const celeb = this.users.find(u => u.isCelebrity);
      if (!celeb) return -1;
      return shardFor(celeb, this.shardKey, this.shardCount);
    },
  }));
});
