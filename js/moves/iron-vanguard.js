// IRON VANGUARD: cyborg swordsman. The cyber arm drives a broad glowing blade: quick horizontal cuts, crossing
// diagonals, a plasma crescent thrown off the edge, and the Overclock Flash that cuts straight through and comes
// out behind. The flesh hand jabs to open strings. Super: OVERCLOCK: THOUSAND CUTS.
(() => {
  const S = T3Moves.STANCE.blade, st = T3.P(null, S), A = T3A, M = A.M, F = A.F, K = A.K;
  const WP = (tR, wa, x) => M({ tR: [tR[0], tR[1], tR[2], 1], wa: [wa[0], wa[1], wa[2], 1] }, x || {});
  const ORANGE = 0xffa040;
  const moves = {
    jab: M(A.jab(st), { cmd: "1", name: "Iron Jab" }),
    cut: M(A.hSlash(st, { t: [0.1, 0.22, 0.28, 0.5], hit: { dmg: 13, level: "H", react: "light" } }), { cmd: "2", name: "Quick Cut" }),
    pommel: M(A.cross(st, { point: "hR", hit: { dmg: 11, level: "H" } }), { cmd: "f+1", name: "Pommel Smash" }),
    cleave: M(A.overhead(st, { hit: { dmg: 24, level: "M", react: "crumple" } }), { cmd: "f+2", name: "Overclock Cleave (crumple)" }),
    ret: M(A.backhand(st, { t: [0.14, 0.28, 0.34, 0.62], hit: { dmg: 18, react: "stagger" } }), { cmd: "b+2", name: "Return Cut", track: 60 }),
    lowCut: M(A.lowSlash(st, { hit: { dmg: 13, level: "L", react: "light" } }), { cmd: "d+2", name: "Shin Cutter (low)", track: 20 }),
    rising: M(A.rising(st), { cmd: "df+2", name: "Rising Edge (launcher)", track: 15 }),
    reaper: M(A.spinLow(st, { hit: { dmg: 16 } }), { cmd: "db+2", name: "Floor Reaper (low)" }),
    snap: M(A.snapKick(st), { cmd: "3", name: "Iron Snap Kick" }),
    round: M(A.roundhouse(st), { cmd: "4", name: "Breaker Roundhouse", track: 30 }),
    lowKick: M(A.lowKick(st), { cmd: "d+4", name: "Shin Kick (low)" }),
    knee: M(A.knee(st, { hit: { dmg: 15, react: "launch", pop: 5.6 } }), { cmd: "df+4", name: "Piston Knee (launcher)" }),
    dash: M(A.lungeThrust(st), { cmd: "f,f+2", name: "Dash Thrust" }),
    orbit: M(A.spin(st), { cmd: "1+2", name: "Orbit Slash" }),
    falling: M(A.jumpChop(st, { hit: { dmg: 20 } }), { cmd: "uf+2", name: "Falling Star (bound)" }),
    jumpKick: M(A.jumpKick(st), { cmd: "uf+4", name: "Leaping Kick" }),
    // Overclock Flash: a low draw, a burst of speed straight through the opponent, out behind them.
    flash: { cmd: "f+1+2", name: "Overclock Flash (passes through)", noAssist: true, dur: 0.78,
      keys: [K(0, {}), K(0.13, M(WP([0.05, 1.0, -0.32], [70, -20, 90]), { y: st.y - 0.18, sp: st.sp + 22, cy: st.cy + 30, hy: st.hy + 10 }, F(st, 0.06, -0.04)), "snap"),
        K(0.2, M(WP([0.42, 1.32, 0.42], [-120, 0, 90]), { y: st.y - 0.08, sp: st.sp + 14, cy: st.cy - 40, hy: st.hy - 20, x: 0.05 }, F(st, 0.1, 0.0)), "hold"),
        K(0.5, M(WP([0.36, 1.3, 0.46], [-130, -6, 90]), { y: st.y - 0.06, sp: st.sp + 10, cy: st.cy - 44, hy: st.hy - 22, x: 0.05 }, F(st, 0.1, 0.0)), "inout"),
        K(0.78, M({ x: 0.05 }, F(st, 0.05, 0.05)), "inout")],
      events: [{ at: 0.14, type: "fx", from: "wpn", kind: "spark", color: ORANGE, power: 1.2 }, { at: 0.16, type: "blink", behind: true, past: 0.9, face: true }],
      hits: [{ at: 0.16, until: 0.19, point: "path", r: 0.34, dmg: 18, level: "M", react: "spin", push: 0.3 }] },
    // Plasma Crescent: a rising cut that throws an arc of plasma down the fight line.
    wave: { cmd: "d,df,f+2", name: "Plasma Crescent (projectile)", dur: 0.62,
      keys: [K(0, {}), K(0.14, M(WP([0.1, 0.9, 0.36], [-40, -70, 0]), { y: st.y - 0.12, sp: st.sp + 16, cy: st.cy - 20 }, F(st, 0.04, 0)), "snap"),
        K(0.24, M(WP([0.5, 1.6, 0.1], [0, 70, 0]), { y: st.y + 0.02, sp: st.sp - 6, cy: st.cy + 22, x: 0.1 }, F(st, 0.14, 0.04, { pr: -20 })), "hold"),
        K(0.34, M(WP([0.46, 1.66, 0.1], [0, 78, 0]), { sp: st.sp - 8, cy: st.cy + 24, x: 0.1 }, F(st, 0.14, 0.04)), "inout"), K(0.62, M({ x: 0.12 }, F(st, 0.12, 0.12)), "inout")],
      events: [{ at: 0.22, type: "spawn", kind: "crescent", from: "front", off: [0.55, 1.15, 0], speed: 8.5, r: 0.22, y0: -0.35, y1: 0.35, life: 0.7, trail: ORANGE, light: ORANGE,
        hit: { dmg: 16, level: "M", react: "heavy", push: 1.4 } }] },
    // OVERCLOCK: THOUSAND CUTS. A lunging thrust; if it lands, a storm of cuts from both sides and a launching
    // rise through the body.
    super: M(A.superMove(st, { color: ORANGE, fx: "spark", dur: 2.1, cine: { dur: 1.8 },
      chargePose: M(WP([0.28, 1.5, 0.1], [0, 88, 0]), { y: st.y - 0.06, sp: st.sp - 6, fx: 1 }),
      open: { keys: [K(0.3, M(WP([0.1, 1.3, 0.22], [-8, 8, 0]), { cy: st.cy - 14 }), "snap"), K(0.4, M(WP([0.66, 1.28, 0.04], [0, 0, 0]), { cy: st.cy + 26, hy: st.hy + 14, sp: st.sp + 14, x: 0.2 }, F(st, 0.22, 0.12)), "hold")],
        hit: { at: 0.36, until: 0.46, point: "wpn", dmg: 10, r: 0.26 } },
      steps: [
        { t: 0.58, pose: M(WP([0.5, 1.45, -0.12], [45, 0, 90]), { cy: st.cy + 36, hy: st.hy + 24, x: 0.2 }, F(st, 0.22, 0.12)), hit: { dmg: 7 }, fx: { type: "fx", from: "opp", kind: "spark", color: ORANGE, power: 1 } },
        { t: 0.72, pose: M(WP([0.52, 1.42, 0.24], [-50, 0, -90]), { cy: st.cy - 26, hy: st.hy - 14, x: 0.2 }, F(st, 0.22, 0.12)), hit: { dmg: 7 }, fx: { type: "fx", from: "opp", kind: "spark", color: ORANGE, power: 1 } },
        { t: 0.86, pose: M(WP([0.5, 1.08, -0.08], [30, -40, 45]), { cy: st.cy + 26, sp: st.sp + 20, y: st.y - 0.1, x: 0.2 }, F(st, 0.22, 0.12)), hit: { dmg: 7, react: "heavy" }, fx: { type: "fx", from: "opp", kind: "spark", color: ORANGE, power: 1.2 } },
        { t: 1.0, pose: M(WP([0.5, 1.6, 0.22], [-30, 62, -45]), { cy: st.cy - 22, sp: st.sp - 8, x: 0.2 }, F(st, 0.22, 0.12)), hit: { dmg: 7 }, fx: { type: "fx", from: "opp", kind: "spark", color: ORANGE, power: 1.2 } },
        { t: 1.16, pose: M(WP([0.05, 1.0, -0.32], [70, -20, 90]), { y: st.y - 0.18, sp: st.sp + 22, x: 0.2 }, F(st, 0.22, 0.12)), ease: "inout",
          events: [{ at: 1.14, type: "fx", from: "chest", kind: "spark", color: ORANGE, power: 1.6 }, { at: 1.2, type: "blink", behind: true, past: 0.85, face: true }] },
        { t: 1.3, pose: M(WP([0.42, 1.32, 0.42], [-120, 0, 90]), { y: st.y - 0.08, cy: st.cy - 40, hy: st.hy - 20, x: 0.2 }, F(st, 0.22, 0.12)), hit: { dmg: 9, react: "heavy" }, fx: { type: "fx", from: "opp", kind: "spark", color: ORANGE, power: 1.4 } },
        { t: 1.5, pose: M(WP([0.02, 0.62, 0.26], [0, -125, 0]), { y: st.y - 0.24, sp: st.sp + 22, cy: st.cy - 16, x: 0.2 }, F(st, 0.22, 0.12)), ease: "inout" },
        { t: 1.62, pose: M(WP([0.42, 1.8, 0.06], [0, 80, 0]), { y: st.y + 0.06, sp: st.sp - 10, cy: st.cy + 20, dp: st.dp - 12, x: 0.3 }, F(st, 0.34, 0.18, { pr: -30 })), hold: 0.2,
          hit: { dmg: 20, react: "launch", pop: 7.2, push: 0.8 }, fx: [{ type: "fx", from: "opp", kind: "spark", color: ORANGE, power: 2.2 }, { type: "cam", kind: "superHit" }] },
      ] }), { cmd: "df+1+2", name: "OVERCLOCK: THOUSAND CUTS (super)" }),
  };
  const C = (from, over, hit) => T3Moves.clone(moves, from, over, hit);
  // String steps (each a hidden copy, so strings never clash).
  moves.s1b = C("cut", { name: "Quick Cut" }, { dmg: 11 });
  moves.s1c = M(A.backhand(st, { hit: { dmg: 16, react: "stagger" } }), { hidden: true, name: "Return Cut", base: "cut" });
  moves.s2b = M(A.backhand(st, { t: [0.08, 0.2, 0.26, 0.48], hit: { dmg: 11, react: "light" } }), { hidden: true, name: "Backhand", base: "cut" });
  moves.s2c = M(A.diagDown(st, { t: [0.1, 0.22, 0.28, 0.52], hit: { dmg: 13, react: "light" } }), { hidden: true, name: "Falling Diagonal", base: "cut" });
  moves.s2d = M(A.diagUp(st, { t: [0.12, 0.25, 0.31, 0.62], hit: { dmg: 14, react: "launch", pop: 5.8 } }), { hidden: true, name: "Rising Diagonal (launcher)", base: "cut" });
  moves.s3b = M(A.diagUp(st, { hit: { dmg: 15, react: "heavy" } }), { hidden: true, name: "Rising Diagonal", base: "cut" });
  moves.s3c = M(A.spinLow(st, { hit: { dmg: 13 } }), { hidden: true, name: "Floor Reaper (low)", base: "cut" });
  moves.s5b = C("cut", { name: "Quick Cut" }, { dmg: 11, level: "M" });
  moves.s5c = C("cleave", { name: "Overclock Cleave" }, { dmg: 20 });
  // Ten hit string: 1, 1, 2, 2, 3, 4, 2, d+2, 2, f+2.
  const ten = [["jab", { dmg: 6 }], ["jab", { dmg: 6 }], ["cut", { dmg: 7 }], ["s2b", { dmg: 7 }], ["snap", { dmg: 8, react: "light" }], ["round", { dmg: 9, react: "heavy" }], ["s2c", { dmg: 8 }], ["lowCut", { dmg: 8 }], ["s3b", { dmg: 9 }], ["cleave", { dmg: 16, react: "crumple" }]];
  const tenIds = ten.map(([from, hit], i) => { const id = "ten" + (i + 1); moves[id] = C(from, { name: "Ten Hit " + (i + 1) }, hit); return id; });
  T3Moves.define("cyborg", {
    name: "IRON VANGUARD", stance: S,
    loco: { walkF: 1.25, walkB: 1.0, dash: 4.4, backdash: 4.2, weight: 1.15 },
    moves,
    strings: [
      { name: "Vanguard Line", inputs: ["1", "2", "2"], steps: ["jab", "s1b", "s1c"] },
      { name: "Edge Storm (ends in a launch)", inputs: ["2", "2", "2", "2"], steps: ["cut", "s2b", "s2c", "s2d"] },
      { name: "Low Edge, rising", inputs: ["d+2", "2"], steps: ["lowCut", "s3b"] },
      { name: "Low Edge, reaper", inputs: ["d+2", "d+2"], steps: ["lowCut", "s3c"] },
      { name: "Iron Breaker", inputs: ["3", "2", "f+2"], steps: ["snap", "s5b", "s5c"] },
      { name: "Ten Hit: Overclock", inputs: ["1", "1", "2", "2", "3", "4", "2", "d+2", "2", "f+2"], steps: tenIds.map((id, i) => (i === 0 ? "jab" : id)) },
    ],
    juggles: [
      { name: "Rising Edge, jab, Falling Star (bound), Dash Thrust", notation: "df+2, 1, uf+2, f,f+2", steps: ["rising", "jab", "falling", "dash"] },
      { name: "Edge Storm launch, jab, Falling Star (bound), Dash Thrust", notation: "2,2,2,2, 1, uf+2, f,f+2", pre: 1, steps: ["jab", "falling", "dash"] },
      { name: "Piston Knee, Quick Cut, Falling Star (bound), Orbit Slash", notation: "df+4, 2, uf+2, 1+2", steps: ["knee", "cut", "falling", "orbit"] },
    ],
    notes: ["Blade in the cyber (right) hand: 2 is the sword, 1 and 3 the flesh side.", "Overclock Flash (f+1+2) cuts through and comes out behind the opponent, spinning them round.",
      "Edge Storm (2,2,2,2) ends in a launcher; Low Edge mixes a mid (d+2, 2) with a low (d+2, d+2).", "Super (df+1+2) needs a full meter (fills as you deal and take damage)."],
  });
})();
