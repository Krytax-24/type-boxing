// Match records and the numbers behind the Stats page. No DOM, no rules: it only watches what the player does
// (main.js calls the Recorder) and keeps the finished matches in localStorage inside try/catch.
//
// One record per finished match (the "match record format", version 1). Compact on purpose: a few kilobytes.
//   { v, id, at, mode, seed, bot, botIdx, beatAt, char, foeChar, won, secs,
//     wpm, raw, acc, cons,                      average wpm (correct keys), raw wpm (all keys), accuracy %, consistency %
//     chars: { ok, bad, extra, missed },        characters typed right, wrong, beyond the word, skipped
//     trace: [[wpm, raw, foeWpm, hpYou, hpFoe]] every half second (only kept for the newest matches)
//     typos: [seconds],                         when each wrong key happened
//     keys: { a: [tries, misses, ms] },         per key the word asked for: tries, misses, total ms since the previous key
//     missedWords: [word],                      words that were not clean, newest first
//     fight: { dealt, taken, bestCombo, broken, counters, ultClean, ultSloppy, stunned } }
// `mode` is "space" (Space ends a word) or "auto" (a word ends when it is typed exactly right): the two are not
// the same race, so they are kept apart. The same record can be sent to a server later (phase 6).
const Stats = (() => {
  const KEY = "typeboxing.records";
  const VERSION = 1;
  const MAX = 500;          // newest matches kept
  const KEEP_TRACE = 60;    // only the newest matches keep their half-second trace and typo marks

  // ---------- storage ----------
  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && raw.v === VERSION && Array.isArray(raw.matches)) return raw.matches;
    } catch (e) { /* blocked or corrupt: start empty */ }
    return [];
  }
  function write(matches) {
    // Old matches give up their trace first, then the oldest are dropped, if the browser's storage is full.
    for (let attempt = 0; attempt < 3; attempt++) {
      matches.forEach((m, i) => { if (matches.length - i > KEEP_TRACE) { delete m.trace; delete m.typos; } });
      try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, matches })); return true; }
      catch (e) { matches = matches.slice(Math.ceil(matches.length * 0.2)); }
    }
    return false;
  }
  function add(rec) {
    const m = read();
    m.push(rec);
    while (m.length > MAX) m.shift();
    return write(m);
  }
  const all = () => read();                                  // oldest first
  const find = (id) => read().find((m) => m.id === id) || null;
  function remove(id) { return write(read().filter((m) => m.id !== id)); }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  // A record from a file must look like one before it is kept: numbers stay numbers, nothing else gets in.
  const num = (v, lo, hi) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);
  function clean(r) {
    if (!r || typeof r !== "object" || typeof r.id !== "string" || typeof r.at !== "string" || isNaN(Date.parse(r.at))) return null;
    const out = {
      v: VERSION, id: r.id.slice(0, 40), at: new Date(r.at).toISOString(), mode: r.mode === "auto" ? "auto" : "space",
      seed: num(r.seed, 0, 4e9), bot: String(r.bot || "?").slice(0, 20), botIdx: num(r.botIdx, 0, 20), beatAt: num(r.beatAt, 0, 400),
      char: String(r.char || "").slice(0, 20), foeChar: String(r.foeChar || "").slice(0, 20), won: !!r.won, secs: num(r.secs, 0, 7200),
      wpm: num(r.wpm, 0, 600), raw: num(r.raw, 0, 600), acc: num(r.acc, 0, 100), cons: num(r.cons, 0, 100),
      chars: { ok: 0, bad: 0, extra: 0, missed: 0 }, keys: {}, missedWords: [],
      fight: { dealt: 0, taken: 0, bestCombo: 0, broken: 0, counters: 0, ultClean: 0, ultSloppy: 0, stunned: 0 },
    };
    if (r.chars) for (const k in out.chars) out.chars[k] = num(r.chars[k], 0, 1e6);
    if (r.fight) for (const k in out.fight) out.fight[k] = num(r.fight[k], 0, 1e6);
    if (r.keys && typeof r.keys === "object") {
      for (const k of Object.keys(r.keys).slice(0, 60)) {
        const v = r.keys[k];
        if (k.length === 1 && Array.isArray(v)) out.keys[k] = [num(v[0], 0, 1e5), num(v[1], 0, 1e5), num(v[2], 0, 1e8)];
      }
    }
    if (Array.isArray(r.missedWords)) out.missedWords = r.missedWords.slice(0, 20).map((w) => String(w).slice(0, 30));
    if (Array.isArray(r.trace)) out.trace = r.trace.slice(0, 1200).map((p) => (Array.isArray(p) ? p.slice(0, 5).map((x) => num(x, 0, 1000)) : [0, 0, 0, 0, 0]));
    if (Array.isArray(r.typos)) out.typos = r.typos.slice(0, 600).map((x) => num(x, 0, 7200));
    return out;
  }
  // Merge a list of records from a file by id, never doubling a match. Returns how many were new.
  function importList(list) {
    if (!Array.isArray(list)) return 0;
    const m = read(), have = new Set(m.map((x) => x.id));
    let n = 0;
    for (const r of list) { const c = clean(r); if (c && !have.has(c.id)) { m.push(c); have.add(c.id); n++; } }
    m.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    while (m.length > MAX) m.shift();
    write(m);
    return n;
  }

  // ---------- numbers ----------
  // Monkeytype's consistency: 100 means perfectly steady, from how much the per-half-second wpm varies.
  function consistency(values) {
    const v = values.filter((x) => x > 0);
    if (v.length < 4) return 0;
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / v.length);
    const cv = mean ? sd / mean : 1;
    return Math.round(100 * (1 - Math.tanh(cv + Math.pow(cv, 3) / 3 + Math.pow(cv, 5) / 5)));
  }

  // ---------- the recorder: one per match, fed by main.js ----------
  class Recorder {
    constructor(meta) {
      this.meta = meta;
      this.keys = {};          // expected char -> [tries, misses, ms]
      this.chars = { ok: 0, bad: 0, extra: 0, missed: 0 };
      this.stamps = [];        // time of every key (right or wrong), for raw wpm
      this.lastKeyAt = null;
      this.trace = [];
      this.typos = [];
      this.missedWords = [];
      this.fight = { dealt: 0, taken: 0, bestCombo: 0, broken: 0, counters: 0, ultClean: 0, ultSloppy: 0, stunned: 0 };
      this.prev = { hp: [100, 100], combo: 0, counter: false };
      this.nextSample = 0;
    }

    // A letter key. `expected` is the letter the word asks for now (undefined when the word is already full).
    press(t, expected, ch) {
      const ok = expected !== undefined && ch === expected;
      this.stamps.push(t);
      const dt = this.lastKeyAt === null ? 0 : Math.min(2000, (t - this.lastKeyAt) * 1000);
      this.lastKeyAt = t;
      if (expected === undefined) { this.chars.extra++; this.chars.bad++; this.typos.push(Math.round(t * 10) / 10); return; }
      const k = this.keys[expected] || (this.keys[expected] = [0, 0, 0]);
      k[0]++;
      if (ok) { this.chars.ok++; k[2] += dt; } else { k[1]++; this.chars.bad++; this.typos.push(Math.round(t * 10) / 10); }
    }
    // Space or Enter: letters of the word that were skipped count as missed.
    space(t, typed, word) {
      this.stamps.push(t);
      this.lastKeyAt = t;
      if (typed.length > 0 && typed.length < word.length) this.chars.missed += word.length - typed.length;
    }
    // The events that came back from the stream: a word that was not clean goes on the practice list.
    events(evs) {
      for (const e of evs) {
        if (e.type !== "word") continue;
        if (e.ultimate) { if (e.clean) this.fight.ultClean++; else this.fight.ultSloppy++; }
        if (!e.clean && !e.ultimate && !this.missedWords.includes(e.word.text)) this.missedWords.unshift(e.word.text);
      }
      if (this.missedWords.length > 20) this.missedWords.length = 20;
    }
    rawWpm(t) {
      const W = CONFIG.duel.rateWindow;
      while (this.stamps.length && this.stamps[0] < t - W) this.stamps.shift();
      if (!this.stamps.length) return 0;
      const span = Math.min(W, Math.max(t, 1.5));
      return this.stamps.length / 5 / (span / 60);
    }
    // Every fixed step of the duel: damage, combo breaks, counters, stun. Reads the duel, never writes.
    step(duel, dt) {
      const me = duel.typists[0], foe = duel.typists[1];
      const hp = [me.hp, foe.hp];
      if (hp[1] < this.prev.hp[1]) this.fight.dealt += this.prev.hp[1] - hp[1];
      if (hp[0] < this.prev.hp[0]) this.fight.taken += this.prev.hp[0] - hp[0];
      this.prev.hp = hp;
      if (this.prev.combo > 0 && me.comboLevel === 0) this.fight.broken++;
      this.prev.combo = me.comboLevel;
      const c = me.countering(duel.t);
      if (c && !this.prev.counter) this.fight.counters++;
      this.prev.counter = c;
      if (duel.t < me.stunUntil) this.fight.stunned += dt;
      this.fight.bestCombo = Math.max(this.fight.bestCombo, me.comboLevel);
    }
    // Twice a second.
    sample(duel) {
      this.trace.push([Math.round(duel.wpmNow[0]), Math.round(this.rawWpm(duel.t)), Math.round(duel.wpmNow[1]),
        Math.round(duel.typists[0].hp), Math.round(duel.typists[1].hp)]);
    }
    finish(duel) {
      const me = duel.typists[0], s = me.stats, m = this.meta;
      const secs = Math.max(s.lastKeyAt - (s.firstKeyAt || 0), 1);
      const keys = {};
      for (const k in this.keys) keys[k] = [this.keys[k][0], this.keys[k][1], Math.round(this.keys[k][2])];
      const f = this.fight;
      const date = new Date().toISOString();
      return {
        v: VERSION, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: date,
        mode: m.mode, seed: m.seed, bot: m.bot, botIdx: m.botIdx, beatAt: Math.round(m.beatAt), char: m.char, foeChar: m.foeChar,
        won: duel.result.winner === 0, secs: Math.round(duel.t * 10) / 10,
        wpm: Math.round(s.correct / 5 / (secs / 60)),
        raw: Math.round((s.correct + s.wrong) / 5 / (secs / 60)),
        acc: s.correct + s.wrong ? Math.round((100 * s.correct) / (s.correct + s.wrong)) : 0,
        cons: consistency(this.trace.slice(4).map((p) => p[0])),
        chars: Object.assign({}, this.chars), trace: this.trace, typos: this.typos, keys,
        missedWords: this.missedWords.slice(),
        fight: { dealt: Math.round(f.dealt), taken: Math.round(f.taken), bestCombo: s.bestCombo, broken: f.broken, counters: f.counters,
          ultClean: f.ultClean, ultSloppy: f.ultSloppy, stunned: Math.round(f.stunned * 10) / 10 },
      };
    }
  }

  // ---------- summaries for the Stats page ----------
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  function overview(list) {
    const wins = list.filter((m) => m.won).length;
    return {
      played: list.length, wins, losses: list.length - wins, winRate: list.length ? Math.round((100 * wins) / list.length) : 0,
      secs: list.reduce((a, m) => a + m.secs, 0),
      avgWpm: avg(list.map((m) => m.wpm)), bestWpm: Math.max(0, ...list.map((m) => m.wpm)),
      avgAcc: avg(list.map((m) => m.acc)), avgCons: avg(list.map((m) => m.cons)),
      last10: avg(list.slice(-10).map((m) => m.wpm)), last100: avg(list.slice(-100).map((m) => m.wpm)),
    };
  }
  // Personal bests per bot: fastest K.O. (a win), best wpm, best combo.
  function bests(list) {
    const by = {};
    for (const m of list) {
      const b = by[m.bot] || (by[m.bot] = { bot: m.bot, idx: m.botIdx, played: 0, wins: 0, ko: null, wpm: 0, combo: 0 });
      b.played++;
      if (m.won) { b.wins++; if (b.ko === null || m.secs < b.ko) b.ko = m.secs; }
      b.wpm = Math.max(b.wpm, m.wpm);
      b.combo = Math.max(b.combo, m.fight.bestCombo);
    }
    return Object.values(by).sort((a, b) => a.idx - b.idx);
  }
  // Per key over many matches: attempts, misses, average ms between keys.
  function keyTotals(list) {
    const t = {};
    for (const m of list) for (const k in m.keys) {
      const o = t[k] || (t[k] = { tries: 0, misses: 0, ms: 0, okTries: 0 });
      o.tries += m.keys[k][0]; o.misses += m.keys[k][1]; o.ms += m.keys[k][2]; o.okTries += m.keys[k][0] - m.keys[k][1];
    }
    for (const k in t) { t[k].err = t[k].tries ? t[k].misses / t[k].tries : 0; t[k].avgMs = t[k].okTries ? t[k].ms / t[k].okTries : 0; }
    return t;
  }
  // Per day: number of matches, for the calendar.
  function perDay(list) {
    const d = {};
    for (const m of list) { const k = dayKey(new Date(m.at)); d[k] = (d[k] || 0) + 1; }
    return d;
  }
  const dayKey = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

  return { KEY, MAX, KEEP_TRACE, add, all, find, remove, clear, importList, clean, consistency, Recorder, overview, bests, keyTotals, perDay, dayKey, avg };
})();
