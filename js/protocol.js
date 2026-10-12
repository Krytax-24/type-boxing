// Small JSON message helpers for private-room multiplayer. Pure JS: no DOM, no PeerJS.
(function (global) {
  const V = 1;
  const TYPES = new Set(["hello", "welcome", "ready", "start", "keys", "bin", "state", "result", "ping", "pong", "rematch", "leave", "busy", "error"]);
  const KEYS = new Set(["Backspace", "Submit", "AutoSubmit"]);

  const cleanName = (name) => {
    const s = String(name || "PLAYER").replace(/\s+/g, " ").trim().slice(0, 16);
    return s || "PLAYER";
  };
  const cleanFighter = (fighter) => String(fighter || "").replace(/[^a-z0-9-]/gi, "").slice(0, 24);
  const okSize = (msg, cfg) => {
    try { return JSON.stringify(msg).length <= ((cfg && cfg.maxMessageBytes) || 4096); }
    catch (e) { return false; }
  };
  const uint = (n) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
  const num = (n, lo, hi) => typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi;
  const str = (s, max) => typeof s === "string" && s.length <= max;
  const bool = (b) => typeof b === "boolean";
  const profile = (p) => ({
    name: cleanName(p && p.name),
    fighter: cleanFighter(p && p.fighter),
    color: str(p && p.color, 32) ? p.color : "",
    gameVersion: str(p && p.gameVersion, 64) ? p.gameVersion : "",
  });
  const keyEvent = (e) => e && typeof e === "object" && num(e.lt, 0, 60 * 60) &&
    ((str(e.k, 1) && e.k.length === 1) || KEYS.has(e.k));
  const rulesOk = (r) => r && typeof r === "object" && Number.isInteger(r.rounds) && r.rounds >= 1 && r.rounds <= 5 &&
    [0, 30, 45, 60, 120].includes(r.timer) && bool(r.endless) && ["on", "off", "mix"].includes(r.words);
  const snapshot = (s) => s && typeof s === "object" && num(s.t, 0, 60 * 60) && str(s.phase, 16) &&
    Array.isArray(s.hp) && s.hp.length === 2 && s.hp.every((x) => num(x, 0, 1000));

  function validate(msg, cfg) {
    if (!msg || typeof msg !== "object" || msg.v !== V || !TYPES.has(msg.t) || !okSize(msg, cfg)) return null;
    switch (msg.t) {
      case "hello": case "welcome":
        if (!str(msg.name, 16) || !str(msg.fighter, 24) || !str(msg.color, 32) || !str(msg.gameVersion, 64)) return null;
        break;
      case "ready":
        if (!bool(msg.ready)) return null;
        break;
      case "start":
        if (!uint(msg.seed) || !Array.isArray(msg.fighters) || msg.fighters.length !== 2 || !msg.fighters.every((x) => str(x, 24))) return null;
        if (!Array.isArray(msg.names) || msg.names.length !== 2 || !msg.names.every((x) => str(x, 16))) return null;
        if (!num(msg.countdown, 0, 10)) return null;
        if (msg.game !== undefined && msg.game !== "typing" && msg.game !== "brawl") return null;
        if (!uint(msg.mid) || !rulesOk(msg.rules) || !Number.isInteger(msg.round) || msg.round < 1 || msg.round > 99 ||
          !Array.isArray(msg.wins) || msg.wins.length !== 2 || !msg.wins.every((x) => Number.isInteger(x) && x >= 0 && x <= 99)) return null;
        break;
      case "bin": // the guest's buttons in a Brawl fight: a bit mask (see js/brawl.js)
        if (!uint(msg.n) || !Number.isInteger(msg.m) || msg.m < 0 || msg.m > 8191) return null;
        break;
      case "keys":
        if (!uint(msg.seq) || !Array.isArray(msg.events) || msg.events.length > ((cfg && cfg.maxKeysPerMessage) || 64) || !msg.events.every(keyEvent)) return null;
        break;
      case "state":
        if (!uint(msg.n) || !uint(msg.mid) || !snapshot(msg.s)) return null;
        break;
      case "result":
        if (!(msg.winner === 0 || msg.winner === 1) || !num(msg.time, 0, 60 * 60)) return null;
        break;
      case "ping": case "pong":
        if (!uint(msg.id) || !num(msg.ts, 0, Number.MAX_SAFE_INTEGER)) return null;
        break;
      case "rematch":
        if (!bool(msg.want)) return null;
        break;
      case "error":
        if (!str(msg.message, 120)) return null;
        break;
      case "leave": case "busy":
        break;
    }
    return msg;
  }

  global.Protocol = {
    cleanName, cleanFighter, validate,
    hello: (p) => Object.assign({ t: "hello", v: V }, profile(p)),
    welcome: (p) => Object.assign({ t: "welcome", v: V }, profile(p)),
    ready: (ready) => ({ t: "ready", v: V, ready: !!ready }),
    // rules: { rounds, timer, endless, words }; round: 1 for a new match; wins: [host, guest] round wins so far;
    // game: "typing" or "brawl". mid: counts the rounds this room has started, so a late state message of the last round is never applied to the next.
    start: (seed, fighters, names, countdown, rules, round, wins, mid, game) => ({ t: "start", v: V, game: game === "brawl" ? "brawl" : "typing", mid: (mid || 0) >>> 0, seed: seed >>> 0, fighters, names, countdown, rules: rules || { rounds: 1, timer: 0, endless: false, words: "mix" }, round: round || 1, wins: wins || [0, 0] }),
    bin: (n, m) => ({ t: "bin", v: V, n: n >>> 0, m: m & 8191 }),
    keys: (seq, events) => ({ t: "keys", v: V, seq: seq >>> 0, events }),
    state: (n, s, mid) => ({ t: "state", v: V, n: n >>> 0, mid: (mid || 0) >>> 0, s }),
    result: (winner, time, stats) => ({ t: "result", v: V, winner, time, stats: stats || null }),
    ping: (id, ts) => ({ t: "ping", v: V, id: id >>> 0, ts }),
    pong: (id, ts) => ({ t: "pong", v: V, id: id >>> 0, ts }),
    rematch: (want) => ({ t: "rematch", v: V, want: !!want }),
    leave: () => ({ t: "leave", v: V }),
    busy: () => ({ t: "busy", v: V }),
    error: (message) => ({ t: "error", v: V, message: String(message || "").slice(0, 120) }),
  };
})(typeof window !== "undefined" ? window : globalThis);
