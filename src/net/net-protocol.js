/**
 * Small JSON message helpers for private-room multiplayer. Pure JS: no DOM, no PeerJS.
 */
CounterType.define("net-protocol", [], () => {
  "use strict";

  const V = 1;
  const KEYS = new Set(["Backspace", "Submit", "AutoSubmit"]);

  const cleanName = (name) => {
    const s = String(name || "PLAYER")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16);
    return s || "PLAYER";
  };
  const cleanFighter = (fighter) =>
    String(fighter || "")
      .replace(/[^a-z0-9-]/gi, "")
      .slice(0, 24);
  const okSize = (msg, cfg) => {
    try {
      return JSON.stringify(msg).length <= ((cfg && cfg.maxMessageBytes) || 4096);
    } catch (e) {
      return false;
    }
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
  const keyEvent = (e) =>
    e && typeof e === "object" && num(e.lt, 0, 60 * 60) && ((str(e.k, 1) && e.k.length === 1) || KEYS.has(e.k));
  const rulesOk = (r) =>
    r &&
    typeof r === "object" &&
    Number.isInteger(r.rounds) &&
    r.rounds >= 1 &&
    r.rounds <= 5 &&
    [0, 30, 45, 60, 120].includes(r.timer) &&
    bool(r.endless) &&
    ["on", "off", "mix"].includes(r.words);
  const snapshot = (s) =>
    s &&
    typeof s === "object" &&
    num(s.t, 0, 60 * 60) &&
    str(s.phase, 16) &&
    Array.isArray(s.hp) &&
    s.hp.length === 2 &&
    s.hp.every((x) => num(x, 0, 1000));

  const pair = (list, ok) => Array.isArray(list) && list.length === 2 && list.every(ok);
  const roundWins = (x) => Number.isInteger(x) && x >= 0 && x <= 99;
  const playerInfo = (m) => str(m.name, 16) && str(m.fighter, 24) && str(m.color, 32) && str(m.gameVersion, 64);
  const pingInfo = (m) => uint(m.id) && num(m.ts, 0, Number.MAX_SAFE_INTEGER);

  // Every message type and what it must carry. A message of another type, or one that fails its check, is dropped.
  const CHECKS = new Map([
    ["hello", playerInfo],
    ["welcome", playerInfo],
    ["ready", (m) => bool(m.ready)],
    [
      "start",
      (m) =>
        uint(m.seed) &&
        pair(m.fighters, (x) => str(x, 24)) &&
        pair(m.names, (x) => str(x, 16)) &&
        num(m.countdown, 0, 10) &&
        (m.game === undefined || m.game === "typing" || m.game === "brawl") &&
        uint(m.mid) &&
        rulesOk(m.rules) &&
        Number.isInteger(m.round) &&
        m.round >= 1 &&
        m.round <= 99 &&
        pair(m.wins, roundWins),
    ],
    // The guest's keys in a typing fight, at most maxKeysPerMessage at a time.
    [
      "keys",
      (m, cfg) =>
        uint(m.seq) &&
        Array.isArray(m.events) &&
        m.events.length <= ((cfg && cfg.maxKeysPerMessage) || 64) &&
        m.events.every(keyEvent),
    ],
    // The guest's buttons in a Brawl fight: a bit mask (see brawl-rules.js).
    ["bin", (m) => uint(m.n) && Number.isInteger(m.m) && m.m >= 0 && m.m <= 8191],
    ["state", (m) => uint(m.n) && uint(m.mid) && snapshot(m.s)],
    ["result", (m) => (m.winner === 0 || m.winner === 1) && num(m.time, 0, 60 * 60)],
    ["ping", pingInfo],
    ["pong", pingInfo],
    ["rematch", (m) => bool(m.want)],
    ["leave", () => true],
    ["busy", () => true],
    ["error", (m) => str(m.message, 120)],
  ]);

  /** The message when it is well formed, else null. Every message from the other player goes through here. */
  function validate(msg, cfg) {
    if (!msg || typeof msg !== "object" || msg.v !== V || !CHECKS.has(msg.t) || !okSize(msg, cfg)) return null;
    return CHECKS.get(msg.t)(msg, cfg) ? msg : null;
  }

  return {
    cleanName,
    cleanFighter,
    validate,
    hello: (p) => Object.assign({ t: "hello", v: V }, profile(p)),
    welcome: (p) => Object.assign({ t: "welcome", v: V }, profile(p)),
    ready: (ready) => ({ t: "ready", v: V, ready: !!ready }),
    // rules: { rounds, timer, endless, words }; round: 1 for a new match; wins: [host, guest] round wins so far; game:
    // "typing" or "brawl". mid: counts the rounds this room has started, so a late state message of the last round is
    // never applied to the next.
    start: (seed, fighters, names, countdown, rules, round, wins, mid, game) => ({
      t: "start",
      v: V,
      game: game === "brawl" ? "brawl" : "typing",
      mid: (mid || 0) >>> 0,
      seed: seed >>> 0,
      fighters,
      names,
      countdown,
      rules: rules || { rounds: 1, timer: 0, endless: false, words: "mix" },
      round: round || 1,
      wins: wins || [0, 0],
    }),
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
});
