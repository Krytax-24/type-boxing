// 3D Lab move system: stances, reusable animation makers and the move list format. Each character's move list
// lives in its own file in js/moves/ and registers itself with T3Moves.define(id, list).
//
// A move: { name, cmd, level (H, M, L), keys: [[time s, pose spec, ease], ...], hits: [hit, ...], dur, ...flags }
//   cmd      Tekken notation, relative to facing: 1 2 3 4 are left punch, right punch, left kick, right kick;
//            f b u d df db uf ub are directions; "df+2" means down-forward with 2; "f,f+2" a double tap then 2;
//            "1+2" both buttons together.
//   keys     poses relative to the character's stance (T3.P fields). Foot targets (fL, fR) are measured from where
//            the move started, so a planted foot stays planted while the body travels (x in the pose).
//   hits     { at, until, point, r, dmg, level, react, push, pop, ground, auto } point: "hL" "hR" "hbL" "hbR" "ftL" "ftR"
//            "knL" "knR" "elL" "elR" "wpn" (hand to weapon tip), "butt" (the back end), "path" (the line a blink
//            crossed). react: light, heavy, stagger, crumple (folds to the floor), spin (spun round), launch,
//            knockdown, sweep, blast (sent flying), bound (a juggled or downed body slammed into the floor and
//            bounced back up, once per combo), freeze (frozen in ice for a moment), cine (a super's opener: the
//            opponent is held; the super's auto hits then land on them). ground: also hits a body lying down.
//   events   [{ at, type, ... }] spawn (a projectile or spell: kind, from, off, speed, vy, grav, r, y0, y1, life,
//            delay, dist, track, returnAt, once, trail, light, hit), blink (dx or behind; face), weapon (show),
//            fx (a burst of effect at a bone or "opp"), cam (superFlash, superHit, shake), freezeOpp.
//   super    a super move (needs a full meter; meter fills by dealing and taking damage); cine { dur, a0, a1, r }.
//   chain    { button: next move id } with `window` [from, to] in seconds: a string continues if the button is
//            pressed inside the window; the next move starts at `cancel` (just after this move's hit).
//   flags    crouch [t0, t1] (ducks highs), air [t0, t1] (hops over lows), track (degrees of homing, 0 = linear,
//            so a sidestep beats it), dash (keeps the run momentum), counter damage x1.25 on a counter hit.
const T3Moves = (() => {
  const LISTS = {};
  function define(id, list) { LISTS[id] = list; }

  // ---------- Stances ----------
  // Orthodox: left side forward (-z is the body's left). Feet: left foot leads, right foot back and out.
  const STANCE = {
    boxer: { y: -0.1, hy: -20, sy: -4, cy: -8, sp: 8, cp: 4, dy: 28, dp: -6, aL: [62, 8, -10, 112], aR: [42, 24, -20, 138], fL: [0.2, 0, -0.1, 0], fR: [-0.24, 0, 0.14, -6] },
    blade: { y: -0.12, hy: -24, cy: -6, sp: 8, dy: 26, dp: -4, aL: [48, 14, -10, 100], aR: [52, 16, 0, 72], wR: 10, w: [0, 0, 40], fL: [0.24, 0, -0.1, 0], fR: [-0.24, 0, 0.15, -8] },
    bat: { y: -0.12, hy: -26, cy: -10, sp: 6, dy: 30, dp: -4, aR: [30, 30, -30, 140], aL: [44, 10, 10, 112], w: [0, 0, 10], g: 1, gd: 0.16, fL: [0.24, 0, -0.12, 0], fR: [-0.24, 0, 0.16, -8] },
    staff: { y: -0.11, hy: -26, cy: -6, sp: 6, dy: 28, dp: -4, aR: [40, 20, 0, 92], aL: [30, 10, 0, 110], w: [0, 20, 20], g: 1, gd: 0.42, fL: [0.24, 0, -0.1, 0], fR: [-0.24, 0, 0.14, -6] },
    axe: { y: -0.15, hy: -28, cy: -6, sp: 10, dy: 30, dp: -6, aR: [42, 24, 0, 96], aL: [30, 8, 0, 120], w: [0, 0, 30], g: 1, gd: 0.38, fL: [0.27, 0, -0.13, 0], fR: [-0.26, 0, 0.18, -6] },
    flame: { y: -0.11, hy: -22, sy: -6, cy: -6, sp: 8, cp: 4, dy: 28, dp: -6, aL: [66, 4, -10, 104], aR: [40, 22, -20, 132], fL: [0.21, 0, -0.08, 0], fR: [-0.23, 0, 0.12, -10], oL: 1, fx: 0.35 },
    // Nova's casting stance: upright and light, the lead palm open with the orb over it, the rear hand raised.
    mage: { y: -0.1, hy: -18, sy: -4, cy: -10, sp: 4, cp: 2, dy: 24, dp: -4, aL: [74, 12, -40, 74], aR: [34, 40, -30, 120], oL: 1, oR: 1, wL: 20, fL: [0.22, 0, -0.1, 0], fR: [-0.25, 0, 0.15, -10], fx: 0.5 },
    dance: { y: -0.12, hy: -18, cy: -6, sp: 4, dy: 22, dr: 6, aL: [150, 14, 0, 70], aR: [96, 48, 30, 96], bL: [40, 40, 0, 60], bR: [-10, 52, 0, 80], fL: [0.2, 0, -0.08, -4], fR: [-0.22, 0, 0.12, -10], oL: 1, oR: 1 },
  };

  // ---------- Helpers for writing keys ----------
  // K(t, spec, ease): a key; the spec is merged onto the stance when the move is compiled.
  const K = (t, spec, ease) => [t, spec || {}, ease || "inout"];
  // Feet helpers relative to the stance: step the lead foot forward by d, the rear foot by r.
  const feet = (st, d, r, lift, pitchL, pitchR, wide) => ({ fL: [st.fL[0] + (d || 0), lift || 0, st.fL[2] - (wide || 0), pitchL || 0], fR: [st.fR[0] + (r || 0), 0, st.fR[2] + (wide || 0), pitchR === undefined ? st.fR[3] : pitchR] });
  const M = (...specs) => Object.assign({}, ...specs);

  // Compile a character's list: stance merged into every key, frame data computed, notation parsed.
  const cache = {};
  function get(id) {
    if (cache[id]) return cache[id];
    const L = LISTS[id];
    const st = T3.P(null, L.stance);
    const C = { id, name: L.name, stance: st, stanceSpec: L.stance, moves: {}, order: [], strings: L.strings || [], loco: L.loco || {}, react: L.react || {}, notes: L.notes || [] };
    for (const mid in L.moves) {
      const m = Object.assign({ id: mid }, L.moves[mid]);
      m.keys = m.keys.map(([t, spec, e]) => [t, T3.P(st, spec), e || "inout", spec]);
      m.dur = m.dur || m.keys[m.keys.length - 1][0];
      m.hits = m.hits || [];
      m.events = (m.events || []).slice().sort((a, b) => a.at - b.at);
      // Projectile hits count for frame data and levels: they start when the spell appears (plus its delay).
      const shots = m.events.filter((e) => e.type === "spawn" && e.hit).map((e) => ({ at: e.at + (e.delay || 0) + (e.active || 0), until: e.at + (e.delay || 0) + (e.active || 0) + 0.05, level: e.hit.level || "M", dmg: e.hit.dmg || 10 }));
      const all = m.hits.concat(shots);
      if (all.length) {
        const first = Math.min(...all.map((h) => h.at)), last = Math.max(...all.map((h) => h.until));
        m.frames = { startup: Math.round(first * 60) + 1, active: Math.round((last - first) * 60), recovery: Math.round(Math.max(0, m.dur - last) * 60) };
        const lastOwn = m.hits.length ? Math.max(...m.hits.map((h) => h.until)) : Math.max(...m.events.filter((e) => e.type === "spawn").map((e) => e.at));
        m.cancel = m.cancel !== undefined ? m.cancel : Math.min(m.dur, lastOwn + 0.02);
        m.level = m.level || all.map((h) => h.level).join(",");
        m.dmgTotal = all.reduce((n, h) => n + h.dmg, 0);
      }
      m.parsed = parse(m.cmd);
      C.moves[mid] = m; if (!m.hidden) C.order.push(mid);
    }
    // Strings: each step's button links the previous move to the next (the moves keep their own chain maps, so a
    // step that would branch differently in two strings must be its own (hidden) copy).
    for (const s of C.strings) {
      for (let i = 0; i + 1 < s.steps.length; i++) {
        const a = C.moves[s.steps[i]], b = s.steps[i + 1], key = s.inputs[i + 1];
        if (!a || !C.moves[b]) throw new Error(id + ": string " + s.name + " has an unknown step " + (a ? b : s.steps[i]));
        a.chain = Object.assign({}, a.chain || {});
        if (a.chain[key] && a.chain[key] !== b) throw new Error(id + ": string " + s.name + " conflicts at " + s.steps[i] + " +" + key);
        a.chain[key] = b;
      }
      s.levels = s.steps.map((sid) => C.moves[sid].level).join(",");
      s.dmg = s.steps.reduce((n, sid) => n + (C.moves[sid].dmgTotal || 0), 0);
      s.hits = s.steps.reduce((n, sid) => n + C.moves[sid].level.split(",").length, 0);
    }
    C.juggles = L.juggles || [];
    return (cache[id] = C);
  }

  // "df+2" -> { seq: ["df"], btn: ["2"] }; "f,f+2" -> { seq: ["f","f"], btn: ["2"] }; "1+2" -> { seq: [], btn: ["1","2"] }
  function parse(cmd) {
    if (!cmd) return null;
    const parts = cmd.split("+"), btn = [], seq = [];
    for (const p of parts) { if (/^[1-4]$/.test(p)) btn.push(p); else seq.push(...p.split(",")); }
    return { seq, btn, hold: seq.length === 1 ? seq[0] : null };
  }

  // Shared reactions (every character): keys relative to the stance, built per character at runtime.
  function reactions(st) {
    const P = (spec) => T3.P(st, spec);
    return {
      light: { dur: 0.32, keys: [[0, P({}), "out"], [0.08, P({ hp: -8, sp: -14, cp: -6, dp: -18, x: -0.03, aL: [70, 30, 0, 80], aR: [50, 40, 0, 90] }), "inout"], [0.32, P({ x: -0.05 }), "inout"]] },
      heavy: { dur: 0.5, keys: [[0, P({}), "out"], [0.1, P({ hp: -14, sp: -20, cp: -10, dp: -22, dr: 10, hy: 14, x: -0.16, aL: [90, 50, 0, 60], aR: [70, 60, 0, 70], fL: [st.fL0 - 0.1, 0, st.fL2, 10] }), "inout"], [0.5, P({ x: -0.24 }), "inout"]] },
      stagger: { dur: 0.75, keys: [[0, P({}), "out"], [0.12, P({ hp: -18, sp: -18, cp: -12, dp: -20, x: -0.22, aL: [100, 60, 0, 40], aR: [80, 70, 0, 50], fL: [st.fL0 - 0.24, 0.04, st.fL2, 20] }), "inout"], [0.36, P({ hp: -10, sp: -10, x: -0.36, aL: [60, 40, 0, 50], aR: [50, 50, 0, 60] }), "inout"], [0.75, P({ x: -0.4 }), "inout"]] },
      block: { dur: 0.22, keys: [[0, P({ aL: [96, 10, -20, 120], aR: [80, 20, -20, 140], sp: 10, x: -0.05 }), "out"], [0.22, P({ x: -0.08 }), "inout"]] },
      // Crumple: the legs give out, a slow fold to the knees, then down to the floor (open to a follow-up).
      crumple: { dur: 1.0, then: "down", keys: [[0, P({}), "out"], [0.12, P({ dp: -26, sp: -16, hp: -10, x: -0.06, aL: [40, 40, 0, 40], aR: [30, 50, 0, 40], oL: 1, oR: 1 }), "inout"],
        [0.5, P({ y: -0.42, sp: 30, cp: 10, dp: 30, x: -0.08, aL: [-10, 30, 0, 20], aR: [-10, 30, 0, 20], oL: 1, oR: 1 }), "inout"],
        [0.85, P({ y: -0.62, hp: 40, sp: 30, dp: 20, x: -0.04, aL: [20, 40, 0, 20], aR: [20, 40, 0, 20], oL: 1, oR: 1 }), "in"], [1.0, P({ y: -0.66, hp: 60, sp: 20, x: 0, aL: [60, 40, 0, 20], aR: [60, 40, 0, 20], oL: 1, oR: 1 }), "inout"]] },
      // Spun out: whipped round a full turn, off balance.
      spin: { dur: 0.7, keys: [[0, P({}), "out"], [0.35, P({ yaw: 300, hp: -10, sp: -14, dp: -20, x: -0.15, aL: [90, 70, 0, 30], aR: [70, 80, 0, 30], oL: 1, oR: 1 }), "out"], [0.7, P({ yaw: 360, x: -0.2 }), "inout"]] },
      // Held by a super: rocked by each scripted hit.
      held: { dur: 0.3, keys: [[0, P({ hp: -12, sp: -16, dp: -24, aL: [80, 60, 0, 40], aR: [60, 70, 0, 50], oL: 1, oR: 1, y: -0.04 }), "out"], [0.3, P({ hp: -6, sp: -8, dp: -10, aL: [60, 50, 0, 50], aR: [50, 60, 0, 60], oL: 1, oR: 1, y: -0.06 }), "inout"]] },
      heldHeavy: { dur: 0.3, keys: [[0, P({ hp: -22, sp: -24, dp: -34, dr: 14, aL: [110, 70, 0, 30], aR: [90, 80, 0, 30], oL: 1, oR: 1, y: -0.02 }), "out"], [0.3, P({ hp: -10, sp: -12, dp: -14, aL: [70, 50, 0, 40], aR: [60, 60, 0, 50], oL: 1, oR: 1, y: -0.08 }), "inout"]] },
      crouchBlock: { dur: 0.22, keys: [[0, P({ y: -0.36, sp: 18, aL: [80, 10, -20, 120], aR: [70, 20, -20, 140], x: -0.05 }), "out"], [0.22, P({ y: -0.36, sp: 18, x: -0.08 }), "inout"]] },
    };
  }

  // A hidden copy of a move (for string steps), with overrides for the copy and its hits.
  function clone(moves, from, over, hitOver) {
    const m = Object.assign({}, moves[from], { hidden: true, cmd: null, chain: null, base: from }, over || {});
    m.hits = moves[from].hits.map((h) => Object.assign({}, h, hitOver || {}));
    if (moves[from].events) m.events = moves[from].events.map((e) => (e.hit ? Object.assign({}, e, { hit: Object.assign({}, e.hit, hitOver || {}) }) : e));
    return m;
  }
  function uncache(id) { delete cache[id]; }
  return { define, get, uncache, LISTS, STANCE, K, feet, M, parse, reactions, clone };
})();
