/**
 * Ranked play: skill ratings, visible points and tiers, seasons, and the matchmaking state machine.
 * Pure logic: no DOM, no storage, no clock reads (every function takes `now` in seconds or milliseconds as stated).
 * backend.js keeps the records and feeds this file; today it runs on mocked players (MockQueue, mockBoard),
 * later the same functions run on the server (the server decides; the browser only shows the result).
 *
 * Rating: Weng-Lin with the Bradley-Terry full-pairing model (the method behind OpenSkill). It rates a 1v1 and a
 * 2 to 6 racer free-for-all with the same code and tracks uncertainty (sigma), so new players move fast.
 * Hidden MMR = mmrBase + mmrScale x (mu - 3 sigma). Visible RP follows MMR changes plus a pull toward the RP that
 * MMR implies, so a misplaced player converges. Tiers: Bronze to Master by RP, Grandmaster = Master in the top 500.
 */
CounterType.define("ranked", ["config", "random"], (CONFIG, random) => {
  "use strict";

  const { mulberry32 } = random;

  const K = () => CONFIG.ranked;

  // ---------- Rating ----------
  const newRating = () => ({ mu: K().mu, sigma: K().sigma });
  const ordinal = (r) => r.mu - 3 * r.sigma;
  const mmr = (r) => Math.round(K().mmrBase + K().mmrScale * ordinal(r));

  // ratings: [{ mu, sigma }], places: [1 = best, ties share a number]. Returns new [{ mu, sigma }] in the same order.
  function rate(ratings, places) {
    const { beta, kappa } = K(),
      b2 = beta * beta;
    return ratings.map((ri, i) => {
      let omega = 0,
        delta = 0;
      ratings.forEach((rq, q) => {
        if (q === i) return;
        const c = Math.sqrt(ri.sigma * ri.sigma + rq.sigma * rq.sigma + 2 * b2);
        const ei = Math.exp(ri.mu / c),
          eq = Math.exp(rq.mu / c);
        const p = ei / (ei + eq);
        const s = places[i] < places[q] ? 1 : places[i] === places[q] ? 0.5 : 0;
        const gamma = ri.sigma / c;
        omega += ((ri.sigma * ri.sigma) / c) * (s - p);
        delta += gamma * ((ri.sigma * ri.sigma) / (c * c)) * p * (1 - p);
      });
      return { mu: ri.mu + omega, sigma: ri.sigma * Math.sqrt(Math.max(1 - delta, kappa)) };
    });
  }

  // Chance that rating a beats rating b (for the queue screen and the mock opponents).
  function winChance(a, b) {
    const c = Math.sqrt(a.sigma * a.sigma + b.sigma * b.sigma + 2 * K().beta * K().beta);
    return 1 / (1 + Math.exp((b.mu - a.mu) / c));
  }

  // The RP a given MMR deserves (new players land in Silver; about 2200 MMR reaches Master).
  const targetRp = (m) => Math.max(0, Math.round((m - 700) * 1.2));

  // ---------- Tiers ----------
  // { id, name ("Gold II"), color, tierIndex, division (3, 2, 1, or 0 for Master and Grandmaster), floor, next }
  // `top` overrides how many Masters count as Grandmaster (a small mock board uses a smaller number).
  function tierOf(rp, rank, top) {
    const T = K().tiers,
      per = K().rpPerDivision;
    let ti = 0;
    for (let i = 0; i < T.length; i++) if (!T[i].top && rp >= T[i].rp) ti = i;
    const t = T[ti];
    if (t.id === "master") {
      const gm = T.find((x) => x.top);
      if (gm && rank && rank <= (top || gm.top)) {
        return {
          id: gm.id,
          name: gm.name,
          color: gm.color,
          tierIndex: T.indexOf(gm),
          division: 0,
          floor: t.rp,
          next: null,
        };
      }
      return { id: t.id, name: t.name, color: t.color, tierIndex: ti, division: 0, floor: t.rp, next: null };
    }
    const into = Math.min(2, Math.floor((rp - t.rp) / per));
    const division = 3 - into;
    const floor = t.rp + into * per;
    return {
      id: t.id,
      name: `${t.name} ${["", "I", "II", "III"][division]}`,
      color: t.color,
      tierIndex: ti,
      division,
      floor,
      next: floor + per,
    };
  }
  const tierStart = (rp) => K().tiers[tierOf(rp).tierIndex].rp;

  // ---------- Seasons ----------
  // Seasons are calendar quarters (seasonMonths 3): "2026-S4" runs 1 Oct to 31 Dec. `ms` is a time in ms.
  function seasonOf(ms) {
    const d = new Date(ms),
      m = K().seasonMonths,
      q = Math.floor(d.getUTCMonth() / m);
    const start = Date.UTC(d.getUTCFullYear(), q * m, 1),
      end = Date.UTC(d.getUTCFullYear(), q * m + m, 1);
    return { id: `${d.getUTCFullYear()}-S${q + 1}`, start, end, daysLeft: Math.max(0, Math.ceil((end - ms) / 864e5)) };
  }

  // ---------- A player's ranked record for one mode ----------
  function newRecord(mode, season) {
    const r = newRating();
    return {
      mode,
      season,
      mu: r.mu,
      sigma: r.sigma,
      rp: 0,
      games: 0,
      wins: 0,
      losses: 0,
      placementsLeft: K().placements,
      shield: 0,
      peakRp: 0,
      lastPlayed: null,
      seasons: [],
    };
  }

  // A new season: pull mu toward the start value, widen sigma a little, and play a few placement matches again.
  function softReset(rec, season) {
    if (rec.season === season) return rec;
    if (rec.games) {
      rec.seasons.unshift({
        season: rec.season,
        rp: rec.rp,
        peakRp: rec.peakRp,
        tier: tierOf(rec.peakRp).name,
        games: rec.games,
      });
    }
    rec.seasons = rec.seasons.slice(0, 8);
    rec.mu = rec.mu + (K().mu - rec.mu) * K().softReset;
    rec.sigma = Math.min(K().sigma, rec.sigma + K().sigma * 0.25);
    rec.season = season;
    rec.rp = 0;
    rec.peakRp = 0;
    rec.games = 0;
    rec.wins = 0;
    rec.losses = 0;
    rec.shield = 0;
    rec.placementsLeft = K().seasonPlacements;
    return rec;
  }

  // Inactivity decay for Diamond and above: perWeek RP for every full week past afterDays without a ranked match,
  // never below the first division of the decay tier. Returns the RP lost. `ms` is now in ms.
  function decay(rec, ms) {
    const D = K().decay,
      T = K().tiers,
      from = T.find((t) => t.id === D.fromTier).rp;
    if (!rec.lastPlayed || rec.placementsLeft > 0 || rec.rp < from) return 0;
    const idleDays = (ms - rec.lastPlayed) / 864e5;
    if (idleDays <= D.afterDays) return 0;
    const weeks = Math.floor((idleDays - D.afterDays) / 7) - (rec.decayWeeks || 0);
    if (weeks <= 0) return 0;
    const before = rec.rp;
    rec.rp = Math.max(from, rec.rp - weeks * D.perWeek);
    rec.decayWeeks = (rec.decayWeeks || 0) + weeks;
    return before - rec.rp;
  }

  // One finished ranked match. rec: your record (changed in place). opponents: [{ mu, sigma, place }], place: yours.
  // Returns what the result screen shows.
  function applyMatch(rec, place, opponents, ms) {
    const G = K().rpGain;
    const mine = { mu: rec.mu, sigma: rec.sigma };
    const mmrBefore = mmr(mine),
      rpBefore = rec.rp,
      tierBefore = tierOf(rpBefore);
    const next = rate(
      [mine].concat(opponents.map((o) => ({ mu: o.mu, sigma: o.sigma }))),
      [place].concat(opponents.map((o) => o.place)),
    )[0];
    rec.mu = next.mu;
    rec.sigma = next.sigma;
    const mmrAfter = mmr(next);
    const won = place === 1,
      last = place === opponents.length + 1;
    rec.games++;
    if (won) rec.wins++;
    else rec.losses++;
    rec.lastPlayed = ms;
    rec.decayWeeks = 0;
    let delta = 0,
      placementDone = false,
      promoted = false,
      demoted = false;
    if (rec.placementsLeft > 0) {
      rec.placementsLeft--;
      if (rec.placementsLeft === 0) {
        placementDone = true;
        rec.rp = Math.round((targetRp(mmrAfter) * 0.8) / 10) * 10; // a careful start: the rest is earned
        delta = rec.rp - rpBefore;
      }
    } else {
      let d = (mmrAfter - mmrBefore) * G.scale + G.pull * (targetRp(mmrAfter) - rec.rp);
      if (won || (!last && mmrAfter > mmrBefore)) d = Math.max(d, G.min);
      else d = Math.min(d, -G.min);
      d = Math.round(Math.max(-G.max, Math.min(G.max, d)));
      let rp = Math.max(0, rec.rp + d);
      if (d < 0 && rec.shield > 0) {
        rp = Math.max(rp, tierStart(rec.rp));
        rec.shield--;
      }
      delta = rp - rec.rp;
      rec.rp = rp;
    }
    const tierAfter = tierOf(rec.rp);
    if (!placementDone && rec.placementsLeft === 0) {
      promoted = tierAfter.tierIndex > tierBefore.tierIndex;
      demoted = tierAfter.tierIndex < tierBefore.tierIndex;
      if (promoted) rec.shield = K().shieldMatches;
    }
    rec.peakRp = Math.max(rec.peakRp, rec.rp);
    return {
      place,
      players: opponents.length + 1,
      won,
      delta,
      rpBefore,
      rpAfter: rec.rp,
      mmrBefore,
      mmrAfter,
      tierBefore: tierBefore.name,
      tierAfter: tierAfter.name,
      promoted,
      demoted,
      placementDone,
      placementsLeft: rec.placementsLeft,
      shield: rec.shield,
    };
  }

  // ---------- Mocked players (until the backend exists) ----------
  const SYL = [
    "ka",
    "ri",
    "zen",
    "mo",
    "tsu",
    "la",
    "vex",
    "nor",
    "pi",
    "dra",
    "quin",
    "so",
    "bel",
    "ark",
    "tor",
    "ny",
    "ix",
    "ru",
    "fae",
    "gal",
    "vo",
    "shi",
    "ren",
    "kai",
    "mira",
    "dax",
    "lu",
    "sef",
    "oro",
    "pan",
  ];
  function mockName(rand) {
    const n = 2 + Math.floor(rand() * 2);
    let s = "";
    for (let i = 0; i < n; i++) s += SYL[Math.floor(rand() * SYL.length)];
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (rand() < 0.2) s += Math.floor(rand() * 99);
    return s.slice(0, 16);
  }
  const tag4 = (rand) => String(1 + Math.floor(rand() * 9999)).padStart(4, "0");
  const gauss = (rand) => {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const hashStr = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // A mock player of a given skill: mu from an MMR, a settled sigma, and RP near what that MMR deserves.
  function mockPlayer(rand, m, region, countries) {
    const sigma = 2 + rand() * 2.5;
    const mu = (m - K().mmrBase) / K().mmrScale + 3 * sigma;
    const games = 20 + Math.floor(rand() * 400);
    const wr = Math.max(0.3, Math.min(0.75, 0.5 + gauss(rand) * 0.08));
    const rp = Math.max(0, Math.round(targetRp(m) + gauss(rand) * 60));
    const country = countries && countries.length ? countries[Math.floor(rand() * countries.length)] : "";
    return {
      id: "mock-" + Math.floor(rand() * 1e9).toString(36),
      name: mockName(rand),
      tag: tag4(rand),
      mock: true,
      region,
      country,
      mu,
      sigma,
      mmr: m,
      rp,
      games,
      wins: Math.round(games * wr),
    };
  }

  // A mock leaderboard: `size` players for a mode, scope and season, the same every time (seeded by its key).
  function mockBoard(key, size, region, countries) {
    const rand = mulberry32(hashStr(key));
    const list = [];
    for (let i = 0; i < size; i++) {
      list.push(mockPlayer(rand, 1000 + Math.abs(gauss(rand)) * 520 + rand() * 60, region, countries));
    }
    return list.sort((a, b) => b.rp - a.rp);
  }

  // ---------- Matchmaking ----------
  // The search window in MMR after `waited` seconds: startWindow, widened by widenBy every widenEvery, up to maxWindow.
  function windowAfter(waited) {
    const Q = K().queue;
    return Math.min(Q.maxWindow, Q.startWindow + Q.widenBy * Math.floor(Math.max(0, waited) / Q.widenEvery));
  }

  // Simulated players searching in the same queue. Seeded; `now` is seconds.
  class MockQueue {
    constructor(opts) {
      this.rand = mulberry32(opts.seed >>> 0 || 1);
      this.mode = opts.mode;
      this.center = opts.mmr;
      this.region = opts.region;
      this.rate = opts.rate !== undefined ? opts.rate : 0.45; // arrivals per second
      this.searchers = [];
      this.nextAt = 0;
      this.started = null;
    }
    update(now) {
      if (this.started === null) {
        this.started = now;
        this.nextAt = now + this.gap();
      }
      while (now >= this.nextAt) {
        const m = Math.round(this.center + gauss(this.rand) * 220);
        const p = mockPlayer(this.rand, m, this.region, []);
        p.joinedAt = this.nextAt;
        p.leaveAt = this.nextAt + 15 + this.rand() * 45;
        p.submit = this.rand() < 0.85 ? "space" : "auto";
        this.searchers.push(p);
        this.nextAt += this.gap();
      }
      this.searchers = this.searchers.filter((p) => p.leaveAt > now && !p.taken);
    }
    gap() {
      return -Math.log(1 - this.rand()) / this.rate;
    }
    take(p) {
      p.taken = true;
      this.searchers = this.searchers.filter((x) => x !== p);
    }
  }

  // The queue a player sits in. States:
  //   idle -> searching -> found (accept check) -> ready (both accepted) | searching (the other side declined)
  //   searching -> lobby (race: gathering racers, then ready) ; any -> cancelled ; found -> declined (a dodge penalty)
  // opts: { mode, me: { mmr, submit }, ranked, seed, queue (a MockQueue or a server adapter), onChange }
  class Matchmaker {
    constructor(opts) {
      this.mode = opts.mode;
      this.me = opts.me;
      this.ranked = opts.ranked !== false;
      this.rand = mulberry32(opts.seed >>> 0 || 7);
      this.queue = opts.queue;
      this.onChange = opts.onChange || (() => {});
      this.state = "idle";
      this.startedAt = 0;
      this.match = null;
      this.lobby = null;
      this.acceptBy = 0;
      this.foeAcceptsAt = 0;
      this.foeDeclines = false;
      this.accepted = false;
      this.fallback = false;
      this.penaltyUntil = opts.penaltyUntil || 0;
      this.dodges = opts.dodges || 0; // earlier dodges: each one doubles the next penalty
      this.lobbySize = opts.lobby || null; // { min, max } players: a lobby that fills up (Race), else 1 v 1
    }
    set(state) {
      this.state = state;
      this.onChange(this);
    }
    waited(now) {
      return this.state === "idle" ? 0 : now - this.startedAt;
    }
    window(now) {
      return windowAfter(this.waited(now));
    }
    start(now) {
      if (now < this.penaltyUntil) {
        this.set("penalty");
        return false;
      }
      this.startedAt = now;
      this.match = null;
      this.lobby = null;
      this.accepted = false;
      this.fallback = false;
      this.set("searching");
      return true;
    }
    cancel() {
      if (this.lobby) this.lobby.players.filter((p) => p.mock).forEach((p) => (p.taken = false));
      this.set("cancelled");
    }
    // Candidates in range: inside the window, same submit mode in ranked (mixed settings stay casual only).
    inRange(now) {
      const w = this.window(now),
        me = this.me;
      return this.queue.searchers
        .filter((p) => !p.taken && Math.abs(p.mmr - me.mmr) <= w && (!this.ranked || p.submit === me.submit))
        .sort((a, b) => Math.abs(a.mmr - me.mmr) - Math.abs(b.mmr - me.mmr));
    }
    tick(now) {
      const Q = K().queue;
      if (this.state === "searching" || this.state === "lobby") this.queue.update(now);
      if (this.state === "searching") {
        if (!this.fallback && this.waited(now) >= Q.fallbackSec) {
          this.fallback = true;
          this.onChange(this);
        }
        const c = this.inRange(now);
        if (this.lobbySize) {
          if (c.length) {
            this.lobby = { openedAt: now, players: [], startsAt: now + Q.raceFillSec };
            this.set("lobby");
            this.tick(now);
          }
          return;
        }
        if (c.length) {
          const foe = c[0];
          this.queue.take(foe);
          this.match = { opponents: [foe], foundAt: now };
          this.acceptBy = now + Q.acceptSec;
          this.accepted = false;
          this.foeAcceptsAt = now + 0.8 + this.rand() * 4;
          this.foeDeclines = this.rand() < 0.06;
          this.set("found");
        }
      } else if (this.state === "lobby") {
        const L = this.lobby,
          max = this.lobbySize.max - 1;
        if (L.players.length < max && now <= L.startsAt - Q.raceLateSec) {
          for (const p of this.inRange(now)) {
            if (L.players.length >= max) break;
            this.queue.take(p);
            L.players.push(p);
            this.onChange(this);
          }
        }
        if (L.players.length >= max || (now >= L.startsAt && L.players.length >= this.lobbySize.min - 1)) {
          this.match = { opponents: L.players.slice(), foundAt: now };
          this.set("ready");
        } else if (now >= L.startsAt) L.startsAt = now + 5; // nobody came yet: keep the lobby open
      } else if (this.state === "found") {
        if (this.foeDeclines && now >= this.foeAcceptsAt) {
          this.match = null;
          this.set("searching");
          return;
        }
        if (now >= this.acceptBy) {
          if (!this.accepted) {
            this.decline(now);
            return;
          }
          this.match = null;
          this.set("searching");
          return; // the other side never answered: back in the queue
        }
        if (this.accepted && now >= this.foeAcceptsAt) this.set("ready");
      }
    }
    accept(now) {
      if (this.state !== "found") return;
      this.accepted = true;
      this.onChange(this);
      this.tick(now);
    }
    // Declining (or letting the accept check run out) is a dodge: out of the queue for dodgeSec, doubling each time.
    decline(now) {
      const Q = K().queue;
      this.penaltyUntil = now + Q.dodgeSec * Math.pow(2, Math.min(4, this.dodges));
      this.dodges++;
      this.match = null;
      this.set("declined");
    }
  }

  return {
    newRating,
    ordinal,
    mmr,
    rate,
    winChance,
    targetRp,
    tierOf,
    tierStart,
    seasonOf,
    newRecord,
    softReset,
    decay,
    applyMatch,
    mockName,
    mockPlayer,
    mockBoard,
    hashStr,
    windowAfter,
    MockQueue,
    Matchmaker,
  };
});
