// 3D Lab animation makers: the shared building blocks every move list uses (strikes, kicks, weapon swings),
// so each move reads pose to pose: anticipation (wind-up, inout), action (the strike, snap), contact (held),
// recovery (inout back to the stance). Every maker takes the character's resolved stance `st` and options, and
// returns a partial move ({ keys, hits, dur, ... }) that a move list finishes with cmd, name and damage.
const T3A = (() => {
  const K = T3Moves.K;
  // Feet relative to the stance, in the move's starting frame: lead (L) and rear (R) foot forward offsets.
  const F = (st, dl, dr, o) => {
    o = o || {};
    return { fL: [st.fL0 + (dl || 0), o.liftL || 0, st.fL2 + (o.zl || 0), o.pl !== undefined ? o.pl : st.fL3], fR: [st.fR0 + (dr || 0), o.liftR || 0, st.fR2 + (o.zr || 0), o.pr !== undefined ? o.pr : st.fR3] };
  };
  const M = (...a) => Object.assign({}, ...a);
  // Maker defaults merged with the caller's options; the hit settings merge field by field.
  const mk = (d, o, x) => { const r = Object.assign({}, d, o || {}, x || {}); r.hit = Object.assign({}, d.hit, (o && o.hit) || {}, (x && x.hit) || {}); return r; };
  const hit = (o, d) => Object.assign({ r: 0.14, dmg: 10, level: "M", react: "light", push: 0.8 }, d, o.hit || {});

  // The core: wind-up pose, strike pose, contact pose, then back to the stance.
  // t: [wind, strike, contact end, end]. active: the hit window [from, to] (default strike - 0.02 .. contact end).
  function strike(st, o) {
    const [tw, ts, tc, te] = o.t;
    const keys = [K(0, {}, "inout"), K(tw, o.wind || {}, o.windEase || "snap"), K(ts, o.hitPose, "hold"), K(tc, o.hold || o.hitPose, "inout")];
    if (o.recover) keys.push(K(o.recover[0], o.recover[1], "inout"));
    keys.push(K(te, o.end || { x: (o.hitPose && o.hitPose.x) || 0 }, "inout"));
    // Thrusts make contact at the strike pose; swings (arc) make contact while sweeping through the front.
    const active = o.active || (o.arc ? [tw + (ts - tw) * 0.15, ts + 0.04] : [ts - 0.02, Math.min(tc, ts + 0.08)]);
    const out = { keys, hits: o.hits || (o.noHit ? [] : [Object.assign({ at: active[0], until: active[1], point: o.point || "hR" }, hit(o, {}))]), dur: te };
    for (const f of ["crouch", "air", "track", "dash", "fx", "events"]) if (o[f] !== undefined) out[f] = o[f];
    return out;
  }

  // ---------- Hands ----------
  // Lead jab: fast, high, the lead shoulder turns in.
  const jab = (st, o) => strike(st, mk({ t: [0.06, 0.13, 0.19, 0.36], point: "hL",
    wind: { aL: [70, 6, -10, 100], cy: st.cy - 4 },
    hitPose: M({ aL: [90, -12, -10, 2], tL: [0.82, 1.5, -0.02, 1], oL: 0, cy: st.cy - 20, hy: st.hy - 6, sp: st.sp + 8, dp: st.dp - 4, x: 0.14 }, F(st, 0.16, 0.04, { pr: -14 })),
    hit: { dmg: 7, level: "H", react: "light", push: 0.5, r: 0.17 } }, o));
  // Rear straight: the hips and rear shoulder drive through, rear heel turns.
  const cross = (st, o) => strike(st, mk({ t: [0.08, 0.18, 0.25, 0.46], point: "hR",
    wind: { aR: [40, 26, -20, 140], cy: st.cy - 10, hy: st.hy - 6, y: st.y - 0.02 },
    hitPose: M({ aR: [90, -14, -10, 4], tR: [0.86, 1.5, 0.02, 1], cy: st.cy + 30, hy: st.hy + 20, sp: st.sp + 8, dp: st.dp - 4, aL: [56, 10, -10, 120], x: 0.16, y: st.y - 0.04 }, F(st, 0.16, 0.05, { pr: -32 })),
    hit: { dmg: 12, level: "H", react: "light", push: 0.8, r: 0.17 } }, o));
  // Hook: a wide horizontal swing with the whole torso.
  const hook = (st, o) => strike(st, mk({ t: [0.14, 0.27, 0.33, 0.58], point: "hR", arc: true,
    wind: { aR: [82, 66, 0, 88], cy: st.cy - 26, hy: st.hy - 14, sp: st.sp + 6, y: st.y - 0.05 },
    hitPose: M({ aR: [86, -24, 0, 76], cy: st.cy + 44, hy: st.hy + 26, sp: st.sp + 10, dr: -6, x: 0.12, y: st.y - 0.06 }, F(st, 0.08, 0.06, { pr: -40 })),
    hold: { aR: [80, -40, 0, 80], cy: st.cy + 50, hy: st.hy + 30, sp: st.sp + 10, x: 0.12, y: st.y - 0.06 },
    hit: { dmg: 18, level: "H", react: "heavy", push: 1.2, r: 0.18 } }, o));
  // Body blow: a mid hook into the ribs, knees dip.
  const body = (st, o) => strike(st, mk({ t: [0.1, 0.2, 0.26, 0.48], point: "hR",
    wind: { aR: [30, 50, 0, 100], cy: st.cy - 16, y: st.y - 0.1, sp: st.sp + 10 },
    hitPose: M({ aR: [70, -10, 0, 70], tR: [0.72, 1.08, 0.04, 1], cy: st.cy + 32, hy: st.hy + 14, y: st.y - 0.16, sp: st.sp + 18, x: 0.1 }, F(st, 0.1, 0.04, { pr: -24 })),
    hit: { dmg: 13, level: "M", react: "heavy", push: 0.9, r: 0.16 } }, o));
  // Uppercut launcher: sink, then rise through the strike; lifts the opponent into the air.
  const uppercut = (st, o) => strike(st, mk({ t: [0.12, 0.26, 0.33, 0.62], point: "hR",
    wind: M({ aR: [12, 20, 0, 110], cy: st.cy - 14, y: st.y - 0.24, sp: st.sp + 22, hy: st.hy - 8 }, F(st, 0.06, 0)),
    hitPose: M({ aR: [150, -6, 0, 70], tR: [0.64, 1.38, 0.04, 1], cy: st.cy + 24, hy: st.hy + 16, y: st.y + 0.04, sp: st.sp - 12, dp: st.dp - 14, x: 0.14 }, F(st, 0.14, 0.06, { pr: -40 })),
    hold: { aR: [160, -6, 0, 60], tR: [0.5, 1.72, 0.04, 1], cy: st.cy + 24, hy: st.hy + 16, y: st.y + 0.04, sp: st.sp - 14, dp: st.dp - 16, x: 0.14 },
    active: [0.17, 0.3], hit: { dmg: 15, level: "M", react: "launch", pop: 6.2, push: 0.6, r: 0.24 } }, o));
  // Low punch: a crouching jab at the shins.
  const lowPunch = (st, o) => strike(st, mk({ t: [0.06, 0.15, 0.2, 0.42], point: "hL",
    wind: { y: -0.4, sp: st.sp + 22, aL: [40, 8, 0, 110] },
    hitPose: M({ y: -0.46, sp: st.sp + 34, aL: [30, -6, 0, 6], tL: [0.72, 0.3, 0, 1], cy: st.cy - 14, x: 0.06 }, F(st, 0.08, 0)),
    hold: { y: -0.46, sp: st.sp + 34, aL: [30, -6, 0, 10], tL: [0.7, 0.32, 0, 1], cy: st.cy - 14, x: 0.06 },
    hit: { dmg: 6, level: "L", react: "light", push: 0.4 } }, o, { crouch: [0.04, 0.4] }));

  // ---------- Legs ----------
  // Snap kick (lead leg): knee up, then snap the foot out at the belly.
  const snapKick = (st, o) => strike(st, mk({ t: [0.12, 0.22, 0.28, 0.5], point: "ftL",
    wind: { kL: [92, 4, 0, 120], fL: [0, 0, 0, -50], sp: st.sp - 6, aL: [70, 30, 0, 90], y: st.y + 0.02 },
    hitPose: { kL: [86, 0, 0, 6], fL: [0, 0, 0, -50], sp: st.sp - 16, hp: st.hp - 6, aL: [40, 40, 0, 70], aR: [50, 30, 0, 130], y: st.y + 0.03, x: 0.06 },
    recover: [0.38, { kL: [70, 4, 0, 100], fL: [0, 0, 0, -30], x: 0.08 }],
    end: M({ x: 0.1 }, F(st, 0, 0)),
    hit: { dmg: 13, level: "M", react: "heavy", push: 1.1, r: 0.16 } }, o));
  // Roundhouse (rear leg, high): turn the hips over, whip the shin round at head height.
  const roundhouse = (st, o) => strike(st, mk({ t: [0.16, 0.32, 0.38, 0.66], point: "ftR", arc: true,
    wind: { kR: [56, 64, 0, 120], fR: [0, 0, 0, -40], hy: st.hy + 30, cy: st.cy + 10, sp: st.sp - 8, hr: -10, aR: [60, 50, 0, 90], y: st.y + 0.02 },
    hitPose: { kR: [84, -2, 0, 6], fR: [0, 0, 0, -50], hy: st.hy + 70, cy: st.cy + 20, sp: st.sp - 22, hr: -26, dr: 16, aR: [30, 60, 0, 40], aL: [70, 40, 0, 80], y: st.y + 0.04, x: 0.08 },
    hold: { kR: [80, -18, 0, 10], fR: [0, 0, 0, -50], hy: st.hy + 84, cy: st.cy + 24, sp: st.sp - 20, hr: -24, dr: 16, aR: [30, 60, 0, 40], aL: [70, 40, 0, 80], y: st.y + 0.04, x: 0.08 },
    recover: [0.5, { kR: [40, 30, 0, 90], fR: [0, 0, 0, -20], hy: st.hy + 40, x: 0.1 }],
    end: M({ x: 0.12 }, F(st, 0, 0)),
    hit: { dmg: 20, level: "H", react: "stagger", push: 1.5, r: 0.2 } }, o));
  // Low kick (lead leg): a stamp at the shin.
  const lowKick = (st, o) => strike(st, mk({ t: [0.1, 0.2, 0.26, 0.46], point: "ftL",
    wind: { kL: [50, 6, 0, 80], fL: [0, 0, 0, -20], y: st.y - 0.04, sp: st.sp + 4 },
    hitPose: { kL: [52, -4, 0, 6], fL: [0, 0, 0, -10], y: st.y - 0.08, sp: st.sp + 8, hp: st.hp - 4, aL: [50, 30, 0, 100], x: 0.14, fR: [st.fR0 + 0.08, 0, st.fR2, st.fR3] },
    end: M({ x: 0.16 }, F(st, 0.08, 0.08)),
    hit: { dmg: 10, level: "L", react: "light", push: 0.6, r: 0.15 } }, o));
  // Low sweep (rear leg): drop to a crouch and spin the leg along the floor. Knocks down.
  const sweep = (st, o) => {
    const low = { y: -0.5, sp: st.sp + 30, fL: [st.fL0 - 0.04, 0, st.fL2, 0], ikL: 1, kL: [40, 20, 0, 120], aL: [-20, 40, 0, 30], aR: [10, 50, 0, 40], ikR: 0, fR: [0, 0, 0, -10] };
    const out = {
      keys: [K(0, {}, "inout"), K(0.14, M(low, { kR: [10, 60, 0, 60], yaw: 10 }), "linear"), K(0.34, M(low, { kR: [26, 84, 0, 4], yaw: 200 }), "linear"),
        K(0.44, M(low, { kR: [26, 84, 0, 4], yaw: 300 }), "out"), K(0.6, M({ y: -0.3, sp: st.sp + 16, yaw: 360 }, F(st, 0, 0)), "inout"), K(0.78, M({ yaw: 360 }, F(st, 0, 0)), "inout")],
      hits: [{ at: 0.18, until: 0.27, point: "ftR", r: 0.2, dmg: 14, level: "L", react: "sweep", push: 0.6 }], dur: 0.78, crouch: [0.1, 0.7] };
    if (o && o.hit) Object.assign(out.hits[0], o.hit);
    if (o && o.t) { const k = o.t[3] / 0.78; out.keys = out.keys.map(([t, p, e]) => [t * k, p, e]); out.hits[0].at *= k; out.hits[0].until *= k; out.dur = o.t[3]; }
    return out;
  };
  // Knee launcher (rear knee): drive the hips forward, lift the body off the floor.
  const knee = (st, o) => strike(st, mk({ t: [0.1, 0.24, 0.3, 0.58], point: "knR",
    wind: { y: st.y - 0.06, sp: st.sp + 6, aL: [80, 30, 0, 100], aR: [80, 30, 0, 100] },
    hitPose: M({ kR: [110, 0, 0, 140], fR: [0, 0, 0, -40], ikR: 0, y: st.y + 0.06, sp: st.sp - 10, hp: st.hp - 8, aL: [40, 20, 0, 80], aR: [40, 20, 0, 80], x: 0.32 }, { fL: [st.fL0 + 0.3, 0, st.fL2, -6] }),
    end: M({ x: 0.38 }, F(st, 0.36, 0.36)),
    hit: { dmg: 16, level: "M", react: "launch", pop: 5.8, push: 0.5, r: 0.2 } }, o));
  // Front push kick (rear leg, mid): a heavy straight kick that knocks back.
  const pushKick = (st, o) => strike(st, mk({ t: [0.14, 0.27, 0.33, 0.6], point: "ftR",
    wind: { kR: [96, 4, 0, 120], fR: [0, 0, 0, -10], sp: st.sp - 6, hy: st.hy + 10, y: st.y + 0.02 },
    hitPose: { kR: [86, -2, 0, 4], fR: [0, 0, 0, 10], sp: st.sp - 20, hp: st.hp - 10, hy: st.hy + 16, y: st.y + 0.04, aL: [60, 40, 0, 90], x: 0.1 },
    recover: [0.46, { kR: [60, 0, 0, 90], fR: [0, 0, 0, -10], x: 0.12 }],
    end: M({ x: 0.16 }, F(st, 0.02, 0.06)),
    hit: { dmg: 16, level: "M", react: "knockdown", push: 2.2, r: 0.2 } }, o));
  // Jump kick: a hop forward, the lead leg thrust out mid-air. Hops over lows.
  const jumpKick = (st, o) => strike(st, mk({ t: [0.16, 0.3, 0.38, 0.62], point: "ftL",
    wind: { y: st.y + 0.32, kL: [100, 0, 0, 120], kR: [40, 6, 0, 120], fL: [0, 0, 0, -40], fR: [0, 0, 0, -40], sp: st.sp + 4, aL: [80, 40, 0, 90], aR: [60, 50, 0, 90], x: 0.2 },
    hitPose: { y: st.y + 0.4, kL: [80, 0, 0, 4], kR: [20, 6, 0, 110], fL: [0, 0, 0, -50], fR: [0, 0, 0, -40], sp: st.sp - 16, aL: [40, 50, 0, 60], aR: [60, 60, 0, 70], x: 0.42 },
    hold: { y: st.y + 0.3, kL: [74, 0, 0, 10], kR: [24, 6, 0, 110], fL: [0, 0, 0, -50], fR: [0, 0, 0, -40], sp: st.sp - 12, aL: [40, 50, 0, 60], aR: [60, 60, 0, 70], x: 0.5 },
    end: M({ x: 0.58 }, F(st, 0.58, 0.58)),
    hit: { dmg: 18, level: "M", react: "knockdown", push: 1.8, r: 0.2 } }, o, { air: [0.08, 0.46] }));

  // ---------- Weapons (right hand, the other hand joins on two-handed weapons) ----------
  // Swings are written as a hand path (tR, by arm IK) and a weapon aim (wa: yaw, pitch, roll in the body frame),
  // so the blade really arcs through the space in front. o.two: { g, gd } keeps the other hand on the weapon.
  // o.reach scales the hand distances for longer or shorter arms.
  const W2 = (o, pose) => M(pose, o.two || {});
  // Thrust: pull back, then drive the point straight in down the fight line.
  const thrust = (st, o) => { o = o || {}; return strike(st, mk({ t: [0.12, 0.24, 0.3, 0.56], point: "wpn",
    wind: W2(o, { tR: [0.12, 1.3, 0.22, 1], wa: [-8, 8, 0, 1], cy: st.cy - 14, hy: st.hy - 6 }),
    hitPose: W2(o, M({ tR: [0.62, 1.3, 0.04, 1], wa: [0, 0, 0, 1], cy: st.cy + 22, hy: st.hy + 12, sp: st.sp + 10, x: 0.14 }, F(st, 0.16, 0.06, { pr: -24 }))),
    hit: { dmg: 14, level: "M", react: "light", push: 1.0, r: 0.14 } }, o)); };
  // Horizontal slash at head height: from back on the right, across the front, to the left.
  const hSlash = (st, o) => { o = o || {}; return strike(st, mk({ t: [0.14, 0.28, 0.34, 0.6], point: "wpn", arc: true,
    wind: W2(o, { tR: [0.1, 1.5, 0.45, 1], wa: [-125, 6, 90, 1], cy: st.cy - 30, hy: st.hy - 16, sp: st.sp + 4 }),
    hitPose: W2(o, M({ tR: [0.5, 1.45, -0.12, 1], wa: [45, 0, 90, 1], cy: st.cy + 36, hy: st.hy + 24, sp: st.sp + 8, x: 0.1 }, F(st, 0.1, 0.04, { pr: -30 }))),
    hold: W2(o, { tR: [0.36, 1.42, -0.34, 1], wa: [80, -4, 90, 1], cy: st.cy + 42, hy: st.hy + 28, sp: st.sp + 8, x: 0.1 }),
    hit: { dmg: 16, level: "H", react: "heavy", push: 1.2, r: 0.18 } }, o)); };
  // Overhead: the weapon high behind the head, then chopped down in front. A heavy mid.
  const overhead = (st, o) => { o = o || {}; return strike(st, mk({ t: [0.2, 0.34, 0.42, 0.74], point: "wpn", arc: true,
    wind: W2(o, { tR: [0.0, 1.9, 0.12, 1], wa: [0, 125, 0, 1], sp: st.sp - 14, dp: st.dp - 10, y: st.y + 0.02, cy: st.cy - 6 }),
    hitPose: W2(o, M({ tR: [0.48, 1.0, 0.06, 1], wa: [0, -40, 0, 1], sp: st.sp + 22, dp: st.dp + 10, y: st.y - 0.12, cy: st.cy + 14, x: 0.12 }, F(st, 0.14, 0.04))),
    hold: W2(o, { tR: [0.46, 0.92, 0.06, 1], wa: [0, -48, 0, 1], sp: st.sp + 24, dp: st.dp + 10, y: st.y - 0.13, cy: st.cy + 14, x: 0.12 }),
    hit: { dmg: 22, level: "M", react: "crumple", push: 1.0, r: 0.2 } }, o)); };
  // Low slash along the shins from a crouch.
  const lowSlash = (st, o) => { o = o || {}; return strike(st, mk({ t: [0.14, 0.27, 0.33, 0.6], point: "wpn", arc: true,
    wind: W2(o, { y: -0.34, sp: st.sp + 22, tR: [0.1, 0.72, 0.42, 1], wa: [-115, -26, 90, 1], cy: st.cy - 24 }),
    hitPose: W2(o, M({ y: -0.4, sp: st.sp + 28, tR: [0.46, 0.6, -0.18, 1], wa: [50, -32, 90, 1], cy: st.cy + 30, hy: st.hy + 16, x: 0.08 }, F(st, 0.1, 0.02))),
    hit: { dmg: 13, level: "L", react: "light", push: 0.6, r: 0.18 } }, o, { crouch: [0.08, 0.5] })); };
  // Rising slash launcher: from low behind to high in front, lifting the opponent.
  const rising = (st, o) => { o = o || {}; return strike(st, mk({ t: [0.14, 0.28, 0.35, 0.66], point: "wpn", arc: true,
    wind: W2(o, M({ y: st.y - 0.22, sp: st.sp + 20, tR: [0.02, 0.62, 0.26, 1], wa: [0, -125, 0, 1], cy: st.cy - 16 }, F(st, 0.04, 0))),
    hitPose: W2(o, M({ y: st.y + 0.04, sp: st.sp - 6, tR: [0.42, 1.68, 0.06, 1], wa: [0, 72, 0, 1], cy: st.cy + 20, dp: st.dp - 12, x: 0.16 }, F(st, 0.18, 0.06, { pr: -30 }))),
    hit: { dmg: 16, level: "M", react: "launch", pop: 6.4, push: 0.5, r: 0.26 } }, o)); };
  // Spin slash: two full turns with the weapon held out to the side. Two mid hits.
  const spin = (st, o) => {
    o = o || {};
    const arm = W2(o, { aR: [80, 60, 0, 10], tR: [0.05, 1.12, 0.52, 1], wa: [-80, -6, 90, 1], y: st.y - 0.08 });
    const W = W2(o, { tR: [0.0, 1.2, 0.4, 1], wa: [-120, 0, 90, 1], cy: st.cy - 20, y: st.y - 0.06 });
    const k = o.t ? o.t[3] / 0.84 : 1;
    const keys = [K(0, {}, "inout"), K(0.12 * k, W, "in"), K(0.3 * k, M(arm, { yaw: 300, x: 0.12 }, F(st, 0.12, 0.12)), "linear"),
      K(0.48 * k, M(arm, { yaw: 600, x: 0.22 }, F(st, 0.22, 0.22)), "out"), K(0.62 * k, M(arm, { yaw: 720, x: 0.26 }, F(st, 0.26, 0.26)), "inout"),
      K(0.84 * k, M({ yaw: 720, x: 0.26 }, F(st, 0.26, 0.26)), "inout")];
    const hits = [{ at: 0.13 * k, until: 0.22 * k, point: "wpn", r: 0.24, dmg: 12, level: "M", react: "heavy", push: 0.9 },
      { at: 0.33 * k, until: 0.44 * k, point: "wpn", r: 0.24, dmg: 14, level: "M", react: "stagger", push: 1.4 }];
    if (o.hit) for (const h of hits) Object.assign(h, o.hit);
    return { keys, hits, dur: 0.84 * k };
  };
  // A lunge version of a thrust (f,f+2): a long step, the point driven through.
  const lungeThrust = (st, o) => { o = o || {}; return strike(st, mk({ t: [0.1, 0.22, 0.3, 0.6], point: "wpn",
    wind: W2(o, { tR: [0.12, 1.3, 0.22, 1], wa: [-8, 8, 0, 1], cy: st.cy - 14 }),
    hitPose: W2(o, M({ tR: [0.62, 1.25, 0.04, 1], wa: [0, -4, 0, 1], cy: st.cy + 26, hy: st.hy + 14, sp: st.sp + 14, x: 0.5 }, F(st, 0.5, 0.36, { pr: -30 }))),
    end: M({ x: 0.55 }, F(st, 0.55, 0.55)),
    hit: { dmg: 20, level: "M", react: "knockdown", push: 2, r: 0.16 } }, o, { dash: true })); };
  // Butt or knob jab: the back end of the weapon (point "butt"), quick and high.
  const buttJab = (st, o) => { o = o || {}; return strike(st, mk({ t: [0.06, 0.15, 0.21, 0.4], point: "butt",
    wind: W2(o, { tR: [0.15, 1.36, 0.2, 1], wa: [180, -6, 0, 1], cy: st.cy - 10 }),
    hitPose: W2(o, M({ tR: [0.52, 1.4, 0.04, 1], wa: [180, 0, 0, 1], cy: st.cy + 14, x: 0.1 }, F(st, 0.12, 0.02, { pr: -12 }))),
    hit: { dmg: 8, level: "H", react: "light", push: 0.6, r: 0.14 } }, o)); };


  // ---------- More weapon swings ----------
  // Backhand: the return swing, from the left side across to the right.
  const backhand = (st, o) => { o = o || {}; return strike(st, mk({ t: [0.1, 0.22, 0.28, 0.52], point: "wpn", arc: true,
    wind: W2(o, { tR: [0.24, 1.48, -0.32, 1], wa: [80, 4, -90, 1], cy: st.cy + 30, hy: st.hy + 14, sp: st.sp + 6 }),
    hitPose: W2(o, M({ tR: [0.52, 1.42, 0.24, 1], wa: [-50, 0, -90, 1], cy: st.cy - 26, hy: st.hy - 14, sp: st.sp + 8, x: 0.1 }, F(st, 0.1, 0.04))),
    hold: W2(o, { tR: [0.36, 1.4, 0.44, 1], wa: [-100, -4, -90, 1], cy: st.cy - 34, hy: st.hy - 18, sp: st.sp + 8, x: 0.1 }),
    hit: { dmg: 14, level: "H", react: "heavy", push: 1.0, r: 0.18 } }, o)); };
  // Diagonal down cut: from high on the right, down through the body to low on the left.
  const diagDown = (st, o) => { o = o || {}; return strike(st, mk({ t: [0.14, 0.27, 0.33, 0.6], point: "wpn", arc: true,
    wind: W2(o, { tR: [0.04, 1.86, 0.3, 1], wa: [-50, 105, 45, 1], cy: st.cy - 20, hy: st.hy - 10, sp: st.sp - 8, y: st.y + 0.02 }),
    hitPose: W2(o, M({ tR: [0.5, 1.08, -0.08, 1], wa: [30, -40, 45, 1], cy: st.cy + 26, hy: st.hy + 16, sp: st.sp + 20, y: st.y - 0.1, x: 0.14 }, F(st, 0.16, 0.04, { pr: -24 }))),
    hold: W2(o, { tR: [0.42, 0.92, -0.24, 1], wa: [50, -52, 45, 1], cy: st.cy + 30, hy: st.hy + 18, sp: st.sp + 22, y: st.y - 0.12, x: 0.14 }),
    hit: { dmg: 16, level: "M", react: "heavy", push: 1.0, r: 0.2 } }, o)); };
  // Diagonal up cut: from low on the left, rising across to high on the right.
  const diagUp = (st, o) => { o = o || {}; return strike(st, mk({ t: [0.12, 0.25, 0.31, 0.58], point: "wpn", arc: true,
    wind: W2(o, M({ tR: [0.16, 0.74, -0.28, 1], wa: [60, -60, -45, 1], cy: st.cy + 26, hy: st.hy + 12, sp: st.sp + 20, y: st.y - 0.14 }, F(st, 0.04, 0))),
    hitPose: W2(o, M({ tR: [0.5, 1.6, 0.22, 1], wa: [-30, 62, -45, 1], cy: st.cy - 22, hy: st.hy - 10, sp: st.sp - 8, y: st.y + 0.02, x: 0.14 }, F(st, 0.16, 0.04, { pr: -24 }))),
    hold: W2(o, { tR: [0.36, 1.78, 0.34, 1], wa: [-50, 76, -45, 1], cy: st.cy - 26, sp: st.sp - 12, y: st.y + 0.02, x: 0.14 }),
    hit: { dmg: 15, level: "M", react: "heavy", push: 0.9, r: 0.2 } }, o)); };
  // Flurry: n quick thrusts in one move (a hit each), the hand driving in and out down the fight line.
  const flurry = (st, o) => {
    o = o || {};
    const n = o.n || 4, gap = o.gap || 0.09, t0 = o.t0 || 0.14, keys = [K(0, {}, "inout")], hits = [];
    const back = W2(o, M({ tR: [0.16, 1.28, 0.2, 1], wa: [-6, 6, 0, 1], cy: st.cy - 12 }, F(st, 0.04, 0)));
    keys.push(K(t0 - 0.06, back, "snap"));
    for (let i = 0; i < n; i++) {
      const t = t0 + i * gap, y = (o.heights || [1.3, 1.15, 1.35, 1.2, 1.25])[i % 5], dx = 0.08 + i * (o.step || 0.04);
      keys.push(K(t, W2(o, M({ tR: [o.reach || 0.62, y, 0.04, 1], wa: [0, (y - 1.3) * -40, 0, 1], cy: st.cy + 22, hy: st.hy + 12, sp: st.sp + 10, x: dx }, F(st, dx + 0.06, dx, { pr: -24 }))), "snap"));
      if (i < n - 1) keys.push(K(t + gap * 0.55, W2(o, M({ tR: [0.22, 1.28, 0.16, 1], wa: [-4, 4, 0, 1], cy: st.cy, x: dx + 0.01 }, F(st, dx + 0.06, dx))), "snap"));
      hits.push({ at: t - 0.02, until: t + 0.035, point: o.point || "wpn", r: o.r || 0.16, dmg: o.dmg || 6, level: o.level || "M", react: i === n - 1 ? (o.last || "heavy") : "light", push: i === n - 1 ? 1.2 : 0.25 });
    }
    const te = t0 + n * gap + (o.recover || 0.26), xe = 0.08 + n * (o.step || 0.04);
    keys.push(K(te, M({ x: xe }, F(st, xe, xe)), "inout"));
    return { keys, hits, dur: te, track: o.track };
  };
  // Whirl: the long weapon spun flat over the head like a rotor; o.n hits as the ends come round.
  const whirl = (st, o) => {
    o = o || {};
    const n = o.n || 3, per = o.per || 0.14, t0 = o.t0 || 0.16, h = o.h || 1.72, keys = [K(0, {}, "inout")], hits = [];
    const up = (yaw, x) => W2(o, M({ tR: [0.18, h, 0.0, 1], wa: [yaw, 0, 0, 1], aL: [160, 20, 0, 40], sp: st.sp - 6, cy: st.cy, x }, F(st, x, x)));
    keys.push(K(t0, up(-90, 0.04), "linear"));
    for (let i = 1; i <= n * 2; i++) keys.push(K(t0 + i * per / 2, up(-90 + i * 180, 0.04 + i * 0.03), "linear"));
    const tl = t0 + n * per;
    for (let i = 0; i < n; i++) hits.push({ at: t0 + i * per + per * 0.25, until: t0 + i * per + per * 0.75, point: "wpn", r: 0.24, dmg: o.dmg || 8, level: o.level || "H", react: i === n - 1 ? (o.last || "stagger") : "light", push: i === n - 1 ? 1.4 : 0.3 });
    const xe = 0.04 + n * 2 * 0.03;
    keys.push(K(tl + 0.24, M({ x: xe }, F(st, xe, xe)), "inout"));
    return { keys, hits, dur: tl + 0.24, track: o.track !== undefined ? o.track : 120 };
  };
  // Pole vault kick: the staff planted ahead, the body swung up on it, both feet driven into the chest.
  const vaultKick = (st, o) => {
    o = o || {};
    const plant = W2(o, { tR: [0.42, 1.22, 0.06, 1], wa: [0, -66, 0, 1] });
    const keys = [K(0, {}, "inout"), K(0.14, M(plant, { y: st.y - 0.12, sp: st.sp + 18, x: 0.12 }, F(st, 0.14, 0.06)), "out"),
      K(0.28, M(plant, { y: st.y + 0.42, ikL: 0, ikR: 0, kL: [60, 6, 0, 120], kR: [50, 8, 0, 130], fL: [0, 0, 0, -40], fR: [0, 0, 0, -40], sp: st.sp - 6, hp: st.hp - 10, x: 0.3 }), "snap"),
      K(0.38, M(plant, { y: st.y + 0.46, ikL: 0, ikR: 0, kL: [84, 2, 0, 6], kR: [80, 8, 0, 10], fL: [0, 0, 0, 10], fR: [0, 0, 0, 10], sp: st.sp - 34, hp: st.hp - 26, x: 0.46 }), "hold"),
      K(0.46, M(plant, { y: st.y + 0.36, ikL: 0, ikR: 0, kL: [70, 2, 0, 40], kR: [66, 8, 0, 50], fL: [0, 0, 0, -10], fR: [0, 0, 0, -10], sp: st.sp - 24, hp: st.hp - 16, x: 0.52 }), "inout"),
      K(0.72, M({ x: 0.6 }, F(st, 0.6, 0.6)), "inout")];
    const hits = [{ at: 0.33, until: 0.44, point: "ftL", r: 0.22, dmg: (o.hit && o.hit.dmg) || 20, level: "M", react: (o.hit && o.hit.react) || "knockdown", push: 2.2 }];
    return { keys, hits, dur: 0.72, air: [0.2, 0.55] };
  };
  // Low spin: crouched, a full turn with the weapon skimming the floor. Knocks the legs out.
  const spinLow = (st, o) => {
    o = o || {};
    const arm = W2(o, { tR: [0.1, 0.62, 0.5, 1], wa: [-90, -30, 90, 1], y: -0.42, sp: st.sp + 24 });
    const keys = [K(0, {}, "inout"), K(0.12, W2(o, { tR: [0.0, 0.7, 0.4, 1], wa: [-140, -26, 90, 1], y: -0.38, sp: st.sp + 22, cy: st.cy - 20 }), "in"),
      K(0.32, M(arm, { yaw: 270, x: 0.06 }, F(st, 0.06, 0.06)), "linear"), K(0.42, M(arm, { yaw: 360, x: 0.08 }, F(st, 0.08, 0.08)), "out"),
      K(0.7, M({ yaw: 360, x: 0.1 }, F(st, 0.1, 0.1)), "inout")];
    const hits = [{ at: 0.14, until: 0.3, point: "wpn", r: 0.2, dmg: (o.hit && o.hit.dmg) || 15, level: "L", react: (o.hit && o.hit.react) || "sweep", push: 0.8 }];
    return { keys, hits, dur: 0.7, crouch: [0.08, 0.6], track: 60 };
  };
  // A jumping weapon chop: up, then the weapon brought down hard on landing. Hops over lows; hits the downed.
  const jumpChop = (st, o) => { o = o || {}; return strike(st, mk({ t: [0.2, 0.36, 0.4, 0.66], point: "wpn", arc: true,
    wind: W2(o, { y: st.y + 0.5, ikL: 0, ikR: 0, kL: [80, 4, 0, 110], kR: [30, 6, 0, 120], tR: [0.0, 2.1, 0.12, 1], wa: [0, 130, 0, 1], sp: st.sp - 16, x: 0.14 }),
    hitPose: W2(o, M({ tR: [0.5, 0.86, 0.06, 1], wa: [0, -48, 0, 1], sp: st.sp + 30, dp: st.dp + 10, y: st.y - 0.16, x: 0.3 }, F(st, 0.35, 0.2))),
    hold: W2(o, { tR: [0.48, 0.8, 0.06, 1], wa: [0, -52, 0, 1], sp: st.sp + 30, y: st.y - 0.18, x: 0.3 }),
    end: M({ x: 0.34 }, F(st, 0.34, 0.34)),
    hit: { dmg: 22, level: "M", react: "bound", push: 1.0, r: 0.22, ground: true } }, o, { air: [0.08, 0.36] })); };
  // Home run: a huge two-handed swing with a long wind-up that sends the opponent flying.
  const homeRun = (st, o) => { o = o || {}; return strike(st, mk({ t: [0.28, 0.42, 0.48, 0.86], point: "wpn", arc: true,
    wind: W2(o, M({ tR: [-0.06, 1.55, 0.42, 1], wa: [-160, 20, 90, 1], cy: st.cy - 44, hy: st.hy - 26, sp: st.sp - 4, y: st.y - 0.06, dp: st.dp + 6 }, F(st, -0.04, 0))),
    hitPose: W2(o, M({ tR: [0.52, 1.32, -0.1, 1], wa: [40, -4, 90, 1], cy: st.cy + 50, hy: st.hy + 34, sp: st.sp + 10, x: 0.16, y: st.y - 0.08 }, F(st, 0.2, 0.06, { pr: -40 }))),
    hold: W2(o, { tR: [0.26, 1.5, -0.42, 1], wa: [120, 20, 90, 1], cy: st.cy + 64, hy: st.hy + 44, sp: st.sp + 4, x: 0.16, y: st.y - 0.06 }),
    hit: { dmg: 28, level: "M", react: "blast", push: 2.6, r: 0.24 } }, o)); };

  // ---------- Magic (Nova) ----------
  // A cast: gather (hands drawn back, the flame swelling), then release with a palm thrust; the spell (a move
  // event: spawn) appears at the release. o.spell: the spawn event without `at`; o.two: both palms.
  const cast = (st, o) => {
    o = o || {};
    const [tw, ts, tc, te] = o.t || [0.1, 0.18, 0.26, 0.48];
    const two = !!o.two, hand = o.hand || "L";
    const arm = (s, p) => ({ ["a" + s]: p });
    const wind = M(o.wind || {}, arm(hand, [60, 30, -10, 120]), two ? arm(hand === "L" ? "R" : "L", [50, 34, -10, 130]) : {}, { ["o" + hand]: 1, fx: 1.2, cy: st.cy + (hand === "L" ? 14 : -14), sp: st.sp - 4, y: st.y - 0.04 });
    const rel = M(arm(hand, [92, -4, 0, 4]), { ["t" + hand]: [0.74, o.h || 1.32, hand === "L" ? -0.04 : 0.04, 1], ["o" + hand]: 1, fx: 1.6, cy: st.cy + (hand === "L" ? -22 : 26), hy: st.hy + (hand === "L" ? -6 : 16), sp: st.sp + 8, x: 0.08 }, F(st, 0.1, 0.03, { pr: -20 }), o.release || {});
    if (two) { const other = hand === "L" ? "R" : "L"; Object.assign(rel, arm(other, [88, -4, 0, 6]), { ["t" + other]: [0.72, (o.h || 1.32) - 0.12, other === "L" ? -0.06 : 0.06, 1], ["o" + other]: 1, cy: st.cy, hy: st.hy + 4 }); }
    const keys = [K(0, {}, "inout"), K(tw, wind, o.windEase || "inout"), K(ts, rel, "hold"), K(tc, M(rel, { fx: 1.0 }), "inout"), K(te, M({ x: 0.08 }, F(st, 0.08, 0.08)), "inout")];
    const events = [Object.assign({ at: ts - 0.01, type: "spawn", from: "h" + hand }, o.spell)];
    if (o.flash !== false) events.push({ at: ts - 0.01, type: "fx", from: "h" + hand, kind: "fire", color: 0x6a8bff, power: o.flashPower || 0.7 });
    return { keys, hits: o.hits || [], events, dur: te, track: o.track };
  };
  // A blink: vanish in a burst of blue fire and reappear (forward, back, or behind the opponent).
  const blink = (st, o) => {
    o = o || {};
    const at = o.at || 0.14;
    const keys = [K(0, {}, "inout"), K(at - 0.02, M({ y: st.y - 0.16, sp: st.sp + 16, aL: [40, 50, 0, 60], aR: [40, 50, 0, 60], oL: 1, oR: 1, fx: 1.6 }, F(st, 0.02, 0)), "snap"),
      K(at + 0.06, M({ y: st.y + 0.02, sp: st.sp - 4, aL: [70, 40, 0, 50], aR: [60, 50, 0, 60], oL: 1, oR: 1, fx: 1.2 }), "inout")];
    const events = [{ at: at - 0.03, type: "fx", from: "chest", kind: "fire", color: 0x6a8bff, power: 1.4 }, Object.assign({ at, type: "blink", face: true }, o.blink || {}), { at: at + 0.01, type: "fx", from: "chest", kind: "fire", color: 0x9fb8ff, power: 1.2 }];
    if (o.then) { for (const k of o.then.keys) keys.push(K(at + 0.06 + k[0], k[1], k[2])); }
    keys.push(K(o.dur || at + 0.4, M({}, F(st, 0, 0)), "inout"));
    const hits = (o.then && o.then.hits || []).map((h) => Object.assign({}, h, { at: h.at + at + 0.06, until: h.until + at + 0.06 }));
    return { keys, hits, events, dur: o.dur || at + 0.4, noAssist: true };
  };

  // ---------- Supers ----------
  // A super: a flashy start (pose and effect), one real strike (react "cine": if it lands the opponent is held),
  // then scripted steps, each a pose and an auto hit (lands on the held victim), and a finisher that sends them
  // flying. steps: [{ t, pose, hit, fx }]; the camera swings in for cine.dur seconds.
  const superMove = (st, o) => {
    const keys = [K(0, {}, "inout"), K(o.charge || 0.22, o.chargePose || {}, "inout")];
    const hits = [], events = [{ at: 0.02, type: "fx", from: "chest", kind: o.fx || "spark", color: o.color || 0xffffff, power: 1.8 }, { at: 0.02, type: "cam", kind: "superFlash" }];
    for (const k of o.open.keys) keys.push(k);
    hits.push(Object.assign({ react: "cine", level: "M", push: 0.2, r: 0.24, dmg: 10 }, o.open.hit));
    for (const s of o.steps) {
      keys.push(K(s.t, s.pose, s.ease || "snap"));
      if (s.hold) keys.push(K(s.t + s.hold, s.holdPose || s.pose, "inout"));
      if (s.hit) hits.push(Object.assign({ at: s.t - 0.01, until: s.t + 0.03, auto: true, point: "hR", level: "M", react: "light", push: 0.2 }, s.hit));
      if (s.fx) for (const f of [].concat(s.fx)) events.push(Object.assign({ at: s.t - 0.01 }, f));
      if (s.events) for (const e of s.events) events.push(e);
    }
    keys.push(K(o.dur, o.endPose || {}, "inout"));
    return { keys, hits, events, dur: o.dur, super: true, cine: o.cine || { dur: o.dur - 0.3 }, noAssist: true, track: 20 };
  };

  return { strike, F, M, K, mk, W2, backhand, diagDown, diagUp, flurry, whirl, vaultKick, spinLow, jumpChop, homeRun, cast, blink, superMove, jab, cross, hook, body, uppercut, lowPunch, snapKick, roundhouse, lowKick, sweep, knee, pushKick, jumpKick, thrust, hSlash, overhead, lowSlash, rising, spin, lungeThrust, buttJab };
})();
