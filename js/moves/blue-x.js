// BLUE X: baseball brawler. Everything comes off the aluminum bat: the knob jab, the brush-back, the bunt at the
// shins, the Pop Fly launcher, the Grand Slam that bounces bodies off the floor, a batted fastball, and the Home Run
// that sends people out of the park. Super: GRAND SLAM HOMER.
(() => {
  const S = T3Moves.STANCE.bat, st = T3.P(null, S), A = T3A, M = A.M, F = A.F, K = A.K;
  const two = { g: 1, gd: 0.16 };
  const WP = (tR, wa, x) => M({ tR: [tR[0], tR[1], tR[2], 1], wa: [wa[0], wa[1], wa[2], 1] }, two, x || {});
  const BLUE = 0x6fa0ff;
  const offJab = { wind: { aL: [70, 6, -10, 100], cy: st.cy - 4, g: 0 }, hitPose: M({ aL: [90, -10, -10, 4], tL: [0.82, 1.5, -0.02, 1], cy: st.cy - 16, sp: st.sp + 4, x: 0.12, g: 0 }, F(st, 0.12, 0.02, { pr: -14 })) };
  const moves = {
    jab: M(A.jab(st, M(offJab, { hit: { dmg: 7 } })), { cmd: "1", name: "Street Jab" }),
    knob: M(A.buttJab(st, { two, hit: { dmg: 11, level: "H" } }), { cmd: "2", name: "Knob Jab" }),
    brush: M(A.backhand(st, { two, t: [0.1, 0.22, 0.28, 0.5], hit: { dmg: 13, react: "heavy" } }), { cmd: "b+1", name: "Brush Back", track: 40 }),
    homeRun: M(A.homeRun(st, { two }), { cmd: "f+2", name: "Home Run (sends them flying)", track: 50 }),
    slam: M(A.overhead(st, { two, hit: { dmg: 22, react: "bound", ground: true } }), { cmd: "b+2", name: "Grand Slam (bound)" }),
    bunt: M(A.strike(st, { t: [0.1, 0.2, 0.26, 0.48], point: "wpn", wind: M(WP([0.1, 0.62, 0.0], [70, -10, 0]), { y: st.y - 0.22, sp: st.sp + 18, cy: st.cy + 20 }),
      hitPose: M(WP([0.56, 0.58, 0.0], [80, -6, 0]), { y: st.y - 0.26, sp: st.sp + 24, cy: st.cy + 26, x: 0.16 }, F(st, 0.18, 0.06)),
      hit: { dmg: 11, level: "L", react: "light", push: 0.6, r: 0.2 }, crouch: [0.06, 0.4] }), { cmd: "d+2", name: "Bunt (low)" }),
    grounder: M(A.lowSlash(st, { two, hit: { dmg: 14, react: "sweep" } }), { cmd: "db+2", name: "Ground Ball (low)", track: 30 }),
    popFly: M(A.rising(st, { two }), { cmd: "df+2", name: "Pop Fly (launcher)" }),
    doublePlay: M(A.spin(st, { two }), { cmd: "1+2", name: "Double Play" }),
    lineDrive: M(A.hSlash(st, { two, t: [0.12, 0.24, 0.3, 0.62], hitPose: M(WP([0.5, 1.4, -0.12], [45, 0, 90]), { cy: st.cy + 36, hy: st.hy + 24, sp: st.sp + 12, x: 0.55 }, F(st, 0.56, 0.4, { pr: -30 })),
      hold: M(WP([0.36, 1.42, -0.34], [80, -4, 90]), { cy: st.cy + 42, hy: st.hy + 28, x: 0.6 }), end: M({ x: 0.62 }, F(st, 0.62, 0.62)), hit: { dmg: 20, level: "M", react: "knockdown", push: 2.2 }, dash: true }), { cmd: "f,f+2", name: "Line Drive" }),
    slide: { cmd: "f,f+3", name: "Slide In (low)", dash: true, dur: 0.8, crouch: [0.1, 0.7],
      keys: [K(0, {}), K(0.12, M({ y: -0.3, sp: st.sp + 10, x: 0.2 }, F(st, 0.22, 0.16)), "out"),
        K(0.26, { y: -0.68, hp: -38, sp: -10, ikL: 0, ikR: 0, kL: [70, 4, 0, 6], kR: [20, 10, 0, 100], fL: [0, 0, 0, 10], fR: [0, 0, 0, -20], aL: [-30, 40, 0, 20], x: 0.85 }, "hold"),
        K(0.46, { y: -0.68, hp: -38, sp: -10, ikL: 0, ikR: 0, kL: [70, 4, 0, 6], kR: [20, 10, 0, 100], fL: [0, 0, 0, 10], fR: [0, 0, 0, -20], aL: [-30, 40, 0, 20], x: 1.05 }, "inout"),
        K(0.8, M({ x: 1.1 }, F(st, 1.1, 1.1)), "inout")],
      hits: [{ at: 0.22, until: 0.44, point: "ftL", r: 0.22, dmg: 15, level: "L", react: "sweep", push: 0.8 }] },
    // Fungo Drive: toss the ball up with the free hand, then bat it down the fight line.
    fungo: { cmd: "d,df,f+2", name: "Fungo Drive (batted ball)", dur: 0.8,
      keys: [K(0, {}), K(0.14, M(WP([-0.02, 1.52, 0.42], [-150, 20, 90]), { g: 0, aL: [150, 10, 0, 30], oL: 1, cy: st.cy - 40, hy: st.hy - 22 }), "inout"),
        K(0.36, M(WP([-0.06, 1.55, 0.42], [-160, 20, 90]), { g: 1, cy: st.cy - 44, hy: st.hy - 26 }), "snap"),
        K(0.44, M(WP([0.52, 1.32, -0.1], [40, -4, 90]), { cy: st.cy + 50, hy: st.hy + 34, sp: st.sp + 10, x: 0.12 }, F(st, 0.16, 0.04, { pr: -40 })), "hold"),
        K(0.52, M(WP([0.26, 1.5, -0.42], [120, 20, 90]), { cy: st.cy + 64, hy: st.hy + 44, x: 0.12 }), "inout"), K(0.8, M({ x: 0.12 }, F(st, 0.12, 0.12)), "inout")],
      events: [{ at: 0.12, type: "spawn", kind: "ball", from: "hL", vy: 3.4, grav: 11, life: 0.3 },
        { at: 0.42, type: "spawn", kind: "ball", from: "front", off: [0.75, 1.3, 0], speed: 12, grav: 1.5, r: 0.14, life: 0.8, trail: BLUE, hit: { dmg: 15, level: "M", react: "heavy", push: 1.6 } }] },
    snap: M(A.snapKick(st), { cmd: "3", name: "Front Snap" }),
    round: M(A.roundhouse(st), { cmd: "4", name: "Street Roundhouse", track: 30 }),
    stomp: M(A.lowKick(st), { cmd: "d+4", name: "Shin Stomp (low)" }),
    liver: M(A.body(st, { point: "hL", wind: { aL: [30, 50, 0, 100], cy: st.cy + 10, y: st.y - 0.1, sp: st.sp + 10, g: 0 }, hitPose: M({ aL: [70, -10, 0, 70], tL: [0.72, 1.08, -0.04, 1], cy: st.cy - 30, y: st.y - 0.16, sp: st.sp + 18, x: 0.1, g: 0 }, F(st, 0.1, 0.04)) }), { cmd: "df+1", name: "Liver Shot" }),
    dropkick: M(A.jumpKick(st), { cmd: "uf+4", name: "Dropkick" }),
    // GRAND SLAM HOMER: a knob to the face; if it lands, the bunt, the brush-back, the forehand, a bat flip, and the
    // full home run swing.
    super: M(A.superMove(st, { color: BLUE, fx: "impact", dur: 2.3, cine: { dur: 2.0, a0: 2.3, a1: 1.4 },
      chargePose: M(WP([0.0, 1.75, 0.2], [0, 100, 0]), { y: st.y - 0.04, sp: st.sp - 8, dp: st.dp - 10 }),
      open: { keys: [K(0.3, M(WP([0.15, 1.36, 0.2], [180, -6, 0]), { cy: st.cy - 10 }), "snap"), K(0.38, M(WP([0.52, 1.4, 0.04], [180, 0, 0]), { cy: st.cy + 14, x: 0.18 }, F(st, 0.2, 0.08)), "hold")],
        hit: { at: 0.34, until: 0.44, point: "butt", dmg: 10, r: 0.24 } },
      steps: [
        { t: 0.6, pose: M(WP([0.56, 0.9, 0.0], [80, -6, 0]), { y: st.y - 0.2, sp: st.sp + 24, cy: st.cy + 26, x: 0.18 }, F(st, 0.2, 0.08)), hit: { dmg: 8, react: "heavy" }, fx: { type: "fx", from: "opp", kind: "impact", color: BLUE, power: 1 } },
        { t: 0.8, pose: M(WP([0.52, 1.42, 0.24], [-50, 0, -90]), { cy: st.cy - 26, hy: st.hy - 14, x: 0.18 }, F(st, 0.2, 0.08)), hit: { dmg: 8 }, fx: { type: "fx", from: "opp", kind: "impact", color: BLUE, power: 1.1 } },
        { t: 1.0, pose: M(WP([0.5, 1.45, -0.12], [45, 0, 90]), { cy: st.cy + 36, hy: st.hy + 24, x: 0.18 }, F(st, 0.2, 0.08)), hit: { dmg: 8, react: "heavy" }, fx: { type: "fx", from: "opp", kind: "impact", color: BLUE, power: 1.2 } },
        { t: 1.3, pose: M(WP([0.1, 1.9, 0.12], [0, 140, 0]), { g: 0, aL: [140, 30, 0, 40], oL: 1, sp: st.sp - 12, x: 0.12 }, F(st, 0.14, 0.04)), ease: "inout" },
        { t: 1.62, pose: M(WP([-0.06, 1.55, 0.42], [-165, 22, 90]), { cy: st.cy - 48, hy: st.hy - 30, sp: st.sp - 4, y: st.y - 0.08, x: 0.0 }, F(st, -0.04, 0)), ease: "inout",
          events: [{ at: 1.5, type: "fx", from: "wpn", kind: "spark", color: 0xffffff, power: 1.4 }] },
        { t: 1.76, pose: M(WP([0.52, 1.32, -0.1], [40, -4, 90]), { cy: st.cy + 50, hy: st.hy + 34, sp: st.sp + 10, x: 0.18, y: st.y - 0.08 }, F(st, 0.22, 0.06, { pr: -40 })), hold: 0.24,
          holdPose: M(WP([0.26, 1.5, -0.42], [120, 20, 90]), { cy: st.cy + 64, hy: st.hy + 44, x: 0.18 }),
          hit: { dmg: 24, react: "blast", push: 3.2 }, fx: [{ type: "fx", from: "opp", kind: "impact", color: 0xffffff, power: 2.4 }, { type: "cam", kind: "superHit" }] },
      ] }), { cmd: "df+1+2", name: "GRAND SLAM HOMER (super)" }),
  };
  const C = (from, over, hit) => T3Moves.clone(moves, from, over, hit);
  moves.s1b = C("jab", {}, { dmg: 6 });
  moves.s1c = M(A.homeRun(st, { two, t: [0.18, 0.32, 0.38, 0.76], hit: { dmg: 18 } }), { hidden: true, name: "Home Run", base: "knob" });
  moves.s2b = M(A.backhand(st, { two, t: [0.08, 0.2, 0.26, 0.48], hit: { dmg: 10, react: "light" } }), { hidden: true, name: "Brush Back", base: "knob" });
  moves.s2c = M(A.diagDown(st, { two, hit: { dmg: 16, react: "crumple" } }), { hidden: true, name: "Strike Three (crumple)", base: "knob" });
  moves.s3b = C("slam", { name: "Grand Slam" }, { dmg: 18 });
  moves.s4b = M(A.homeRun(st, { two, t: [0.2, 0.34, 0.4, 0.78], hit: { dmg: 18 } }), { hidden: true, name: "Home Run", base: "knob" });
  const ten = [["jab", { dmg: 6 }], ["knob", { dmg: 7 }], ["jab", { dmg: 6 }], ["snap", { dmg: 8, react: "light" }], ["stomp", { dmg: 7 }], ["s2b", { dmg: 8 }], ["round", { dmg: 9, react: "heavy" }], ["grounder", { dmg: 8, react: "light" }], ["popFly", { dmg: 10, react: "heavy" }], ["s4b", { dmg: 16 }]];
  const tenIds = ten.map(([from, hit], i) => { const id = "ten" + (i + 1); moves[id] = C(from, { name: "Ten Hit " + (i + 1) }, hit); return id; });
  T3Moves.define("bluex", {
    name: "BLUE X", stance: S,
    loco: { walkF: 1.3, walkB: 1.05, weight: 1.1 },
    moves,
    strings: [
      { name: "Batter Up (ends in a Home Run)", inputs: ["1", "1", "2"], steps: ["jab", "s1b", "s1c"] },
      { name: "Three Strikes (crumple)", inputs: ["2", "2", "2"], steps: ["knob", "s2b", "s2c"] },
      { name: "Bunt and Slam", inputs: ["d+2", "2"], steps: ["bunt", "s3b"] },
      { name: "Seventh Inning", inputs: ["4", "2"], steps: ["round", "s4b"] },
      { name: "Ten Hit: Nine Innings", inputs: ["1", "2", "1", "3", "d+4", "2", "4", "d+2", "2", "2"], steps: ["jab"].concat(tenIds.slice(1)) },
    ],
    juggles: [
      { name: "Pop Fly, jab, Grand Slam (bound), Line Drive", notation: "df+2, 1, b+2, f,f+2", steps: ["popFly", "jab", "slam", "lineDrive"] },
      { name: "Three Strikes crumple, Pop Fly, jab, Grand Slam (bound), Double Play", notation: "2,2,2, df+2, 1, b+2, 1+2", pre: 1, steps: ["popFly", "jab", "slam", "doublePlay"] },
    ],
    notes: ["Both hands stay on the bat for swings; 1 lets go with the lead hand for a quick jab.", "Home Run (f+2) is slow but sends the opponent across the arena; Grand Slam (b+2) bounces a juggled or downed body back up.",
      "Fungo Drive (d,df,f+2) bats a real ball down the fight line: sidestep it.", "Super (df+1+2) needs a full meter."],
  });
})();
