/**
 * The one door to the server. Every screen talks to `Backend` and gets Promises back, exactly as it will when a
 * real server answers. Today `Backend` is MockBackend: it keeps your ratings and ranked matches in localStorage
 * and invents the other players (Ranked.mockBoard, Ranked.MockQueue). To go live, write a second object with the
 * same methods (Supabase for sign-in and data, a WebSocket room server for matchmaking) and assign it to Backend.
 * Nothing outside this file knows which one is running, except the "preview" labels the screens show while
 * Backend.live is false.
 */
CounterType.define("backend", ["config", "storage", "ranked", "profile"], (CONFIG, storage, Ranked, Profile) => {
  "use strict";

  const K = () => CONFIG.ranked;
  const LATENCY = [120, 320]; // ms: a pretend network round trip, so loading states are real
  const MODES = CONFIG.ranked.modes.map(([mode]) => mode);
  const BOARD_SIZE = { global: 900, region: 600, country: 300 };
  const GM_TOP = 10; // on a mock board only the top 10 Masters are Grandmaster (the real boards use CONFIG: 500)
  const wait = (v) =>
    new Promise((res) => setTimeout(() => res(v), LATENCY[0] + Math.random() * (LATENCY[1] - LATENCY[0])));

  function read() {
    const d = storage.readJson(K().storageKey); // blocked or corrupt: start empty
    if (d && d.v === 1 && d.records) return d;
    return { v: 1, records: {}, matches: [], dodges: 0, penaltyUntil: 0 };
  }
  let db = null;
  const data = () => db || (db = read());
  function write() {
    return storage.writeJson(K().storageKey, data());
  }

  // Your record for a mode in the current season (a season change soft-resets it; inactivity decays it).
  function record(mode, ms = Date.now()) {
    const d = data(),
      season = Ranked.seasonOf(ms).id;
    let r = d.records[mode];
    if (!r) r = d.records[mode] = Ranked.newRecord(mode, season);
    if (r.season !== season) Ranked.softReset(r, season);
    Ranked.decay(r, ms);
    return r;
  }

  // Is this name and tag already used? Checked against every mock board so mock players and you never collide.
  function taken(norm, tag) {
    const me = Profile.get();
    for (const mode of MODES) {
      for (const p of board(mode, "global", null)) {
        if (p.tag === tag && Profile.normalize(p.name) === norm && p.id !== me.id) return true;
      }
    }
    return false;
  }

  const boards = {};
  function board(mode, scope, key) {
    const season = Ranked.seasonOf(Date.now()).id;
    const id = `${mode}|${scope}|${key || ""}|${season}`;
    if (!boards[id]) {
      const region = scope === "region" ? key : scope === "country" ? Profile.regionOf(key) : null;
      const countries =
        scope === "country" ? [key] : Profile.COUNTRIES.filter((c) => !region || c[2] === region).map((c) => c[0]);
      boards[id] = Ranked.mockBoard(id, BOARD_SIZE[scope] || 300, region, countries).map((p) => {
        if (!p.region) p.region = Profile.regionOf(p.country);
        return p;
      });
    }
    return boards[id];
  }

  // Your row on a board, with the rank you would hold among the mock players.
  function withYou(list, mode) {
    const me = Profile.get(),
      r = record(mode);
    const you = {
      id: me.id,
      name: me.name,
      tag: me.tag,
      country: me.country,
      region: me.region,
      rp: r.rp,
      games: r.games,
      wins: r.wins,
      mmr: Ranked.mmr(r),
      you: true,
      placementsLeft: r.placementsLeft,
    };
    const rows = list.filter((p) => p.id !== me.id);
    if (r.placementsLeft === 0 && r.games > 0) rows.push(you);
    rows.sort((a, b) => b.rp - a.rp);
    const rank = r.placementsLeft === 0 && r.games > 0 ? rows.indexOf(you) + 1 : null;
    return { rows, you, rank };
  }

  return {
    live: false,
    name: "mock",

    // ---------- Identity ----------
    // Google sign-in will replace this: the server creates the account, checks the name and assigns the tag.
    signIn() {
      return wait({
        ok: false,
        error: "Sign-in arrives with the online backend. Your progress is saved in this browser for now.",
      });
    },
    getProfile() {
      return wait(Object.assign({}, Profile.get(), { label: Profile.label() }));
    },
    rename(name) {
      return wait(Profile.rename(name, taken));
    },
    setCountry(cc) {
      return wait({ ok: Profile.setCountry(cc), profile: Profile.get() });
    },

    // ---------- Ranked records ----------
    getRanked(mode) {
      const r = record(mode);
      const lb = withYou(board(mode, "global", null), mode);
      write();
      return wait(
        Object.assign({}, r, {
          mmr: Ranked.mmr(r),
          tier: r.placementsLeft ? null : Ranked.tierOf(r.rp, lb.rank, GM_TOP),
          rank: lb.rank,
        }),
      );
    },
    getAllRanked() {
      return Promise.all(MODES.map((m) => this.getRanked(m))).then((list) =>
        Object.fromEntries(MODES.map((m, i) => [m, list[i]])),
      );
    },
    // A finished ranked match. place: 1 = best. opponents: [{ id, name, tag, mu, sigma, place }]. stats: what the
    // result screen keeps (wpm, acc, time). The server will replay the key log before trusting any of this.
    submitRanked(mode, place, opponents, stats) {
      const r = record(mode),
        now = Date.now();
      const out = Ranked.applyMatch(r, place, opponents, now);
      const lb = withYou(board(mode, "global", null), mode);
      out.rank = lb.rank;
      out.tierAfterFull = r.placementsLeft ? null : Ranked.tierOf(r.rp, lb.rank, GM_TOP);
      const d = data();
      d.matches.unshift({
        id: now.toString(36),
        at: now,
        mode,
        ranked: true,
        place,
        players: opponents.length + 1,
        opponents: opponents.map((o) => ({ name: o.name, tag: o.tag, place: o.place })),
        delta: out.delta,
        rp: r.rp,
        stats: stats || {},
      });
      d.matches = d.matches.slice(0, 200);
      write();
      return wait(out);
    },
    // Ranked matches played in this browser, newest first.
    rankedHistory(mode) {
      return wait(data().matches.filter((m) => !mode || m.mode === mode));
    },

    // ---------- Leaderboards ----------
    // scope: "global" | "region" | "country". key: a region id or a country code. Returns 50 rows from `offset`
    // plus your own row and rank (null until your placements are done).
    leaderboard(mode, scope = "global", key = null, offset = 0) {
      const lb = withYou(board(mode, scope, key), mode);
      const rows = lb.rows
        .slice(offset, offset + 50)
        .map((p, i) =>
          Object.assign({}, p, { rank: offset + i + 1, tier: Ranked.tierOf(p.rp, offset + i + 1, GM_TOP) }),
        );
      return wait({
        rows,
        total: lb.rows.length,
        you: Object.assign({}, lb.you, {
          rank: lb.rank,
          tier: lb.rank ? Ranked.tierOf(lb.you.rp, lb.rank, GM_TOP) : null,
        }),
        updatedAt: Date.now(),
        season: Ranked.seasonOf(Date.now()),
      });
    },

    // ---------- Matchmaking ----------
    // A queue for a mode. The Matchmaker is the same state machine the server will drive; here a MockQueue fills it.
    queue(mode, opts) {
      const r = record(mode),
        d = data(),
        me = Profile.get();
      const myMmr = Ranked.mmr(r);
      const q = new Ranked.MockQueue({
        mode,
        mmr: myMmr,
        region: me.region,
        seed: (Date.now() & 0xffffff) ^ 0x5a5a,
        rate: opts.lobby ? 0.9 : undefined,
      });
      const mm = new Ranked.Matchmaker({
        mode,
        me: { mmr: myMmr, submit: opts.submit || "space" },
        ranked: true,
        seed: Date.now() & 0xffff,
        queue: q,
        onChange: opts.onChange,
        lobby: opts.lobby || null,
        penaltyUntil: d.penaltyUntil / 1000,
        dodges: d.dodges,
      });
      mm.saveDodge = () => {
        d.dodges = mm.dodges;
        d.penaltyUntil = mm.penaltyUntil * 1000;
        write();
      };
      mm.myRecord = r;
      return mm;
    },

    // Wipe ranked data (Profile has a button for it while everything is local).
    reset() {
      db = { v: 1, records: {}, matches: [], dodges: 0, penaltyUntil: 0 };
      write();
      return wait(true);
    },
  };
});
