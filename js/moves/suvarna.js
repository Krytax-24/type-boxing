// SUVARNA: the golden four-arm dancer. Every arm strikes on its own beat: upper palms high, lower palms mid, the
// four-palm cascade, the Thousand Palms (eight palms in a blur), a whirling mandala spin, the Divine Hammer (all
// four arms brought down together, bouncing bodies off the floor), crane and lotus kicks. Gold trails on every
// hand. Super: THOUSAND-ARM MANDALA.
(() => {
  const S = T3Moves.STANCE.dance, st = T3.P(null, S), A = T3A, M = A.M, F = A.F, K = A.K;
  const GOLD = 0xffcf5a;
  const PT = { aL: "hL", aR: "hR", bL: "hbL", bR: "hbR" }, TG = { aL: "tL", aR: "tR", bL: "uL", bR: "uR" };
  // The pose of one arm's palm strike (the other arms keep flowing), and its wind-up.
  const palmPose = (arm, x) => {
    const upper = arm[0] === "a", left = arm[1] === "L";
    return M({ [arm]: upper ? [92, -8, 0, 6] : [62, -10, 0, 6], [TG[arm]]: upper ? [0.82, 1.5, left ? -0.04 : 0.04, 1] : [0.76, 1.12, left ? -0.06 : 0.06, 1],
      cy: st.cy + (left ? -18 : 24), hy: st.hy + (left ? -4 : 12), sp: st.sp + 6, x: x || 0.08 }, F(st, (x || 0.08) + 0.02, 0.03, { pr: -16 }));
  };
  const windPose = (arm) => { const upper = arm[0] === "a", left = arm[1] === "L"; return { [arm]: upper ? [100, 30, 0, 110] : [20, 40, 0, 120], cy: st.cy + (left ? 10 : -14) }; };
  const palm = (arm, o) => {
    const upper = arm[0] === "a";
    const r = M({ t: [0.06, 0.15, 0.21, 0.4], point: PT[arm], wind: windPose(arm), hitPose: palmPose(arm) }, o);
    r.hit = M({ dmg: upper ? 8 : 9, level: upper ? "H" : "M", react: "light", push: 0.5 }, (o && o.hit) || {});
    return A.strike(st, r);
  };
  // Four palms, one per arm, each landing on its own beat.
  const cascade = () => {
    const P = (d) => M(d, F(st, (d.x || 0) + 0.1, (d.x || 0) + 0.04, { pr: -18 }));
    const keys = [K(0, {}, "inout"),
      K(0.08, P({ aL: [100, 30, 0, 110], bL: [20, 40, 0, 120] }), "snap"), K(0.16, P({ aL: [92, -8, 0, 6], tL: [0.8, 1.5, -0.04, 1], bL: [20, 40, 0, 120], x: 0.12 }), "snap"),
      K(0.26, P({ aL: [120, 20, 0, 90], bL: [62, -10, 0, 6], uL: [0.78, 1.12, -0.06, 1], x: 0.16 }), "snap"), K(0.36, P({ aR: [92, -8, 0, 6], tR: [0.8, 1.5, 0.04, 1], bL: [30, 30, 0, 90], cy: st.cy + 20, x: 0.2 }), "snap"),
      K(0.46, P({ aR: [120, 30, 0, 90], bR: [62, -10, 0, 6], uR: [0.78, 1.12, 0.06, 1], cy: st.cy + 26, x: 0.24 }), "hold"), K(0.54, P({ aR: [120, 30, 0, 90], bR: [64, -14, 0, 8], uR: [0.76, 1.12, 0.06, 1], cy: st.cy + 26, x: 0.24 }), "inout"),
      K(0.8, M({ x: 0.26 }, F(st, 0.26, 0.26)), "inout")];
    const h = (at, point, level, dmg, react) => ({ at, until: at + 0.06, point, r: 0.19, dmg, level, react, push: 0.5 });
    return { keys, hits: [h(0.14, "hL", "H", 6, "light"), h(0.24, "hbL", "M", 6, "light"), h(0.34, "hR", "H", 7, "light"), h(0.44, "hbR", "M", 10, "heavy")], dur: 0.8 };
  };
  // Thousand Palms: eight palms in a blur, the arms in turn.
  const ORDER = ["aL", "bR", "aR", "bL", "aL", "bR", "aR", "bL"];
  const thousand = () => {
    const keys = [K(0, {}), K(0.12, M({ aL: [100, 30, 0, 110], aR: [100, 30, 0, 110], bL: [20, 40, 0, 120], bR: [20, 40, 0, 120], sp: st.sp + 4 }, F(st, 0.04, 0)), "snap")], hits = [];
    ORDER.forEach((arm, i) => {
      const t = 0.18 + i * 0.075, x = 0.1 + i * 0.03;
      keys.push(K(t, palmPose(arm, x), "snap"));
      hits.push({ at: t - 0.02, until: t + 0.03, point: PT[arm], r: 0.2, dmg: i === 7 ? 9 : 4, level: arm[0] === "a" ? "H" : "M", react: i === 7 ? "stagger" : "light", push: i === 7 ? 1.4 : 0.15, trailLead: 0.05 });
    });
    keys.push(K(0.18 + 8 * 0.075 + 0.28, M({ x: 0.34 }, F(st, 0.34, 0.34)), "inout"));
    return { keys, hits, dur: 0.18 + 8 * 0.075 + 0.28 };
  };
  // Mandala Spin: two full turns with all four arms flung out wide.
  const mandala = () => {
    const wide = { aL: [80, 80, 0, 10], aR: [80, 80, 0, 10], bL: [50, 85, 0, 10], bR: [50, 85, 0, 10], oL: 1, oR: 1, y: st.y - 0.04, sp: st.sp - 4 };
    const keys = [K(0, {}), K(0.1, M(wide, { yaw: -30 }), "in"), K(0.3, M(wide, { yaw: 300, x: 0.12 }, F(st, 0.12, 0.12)), "linear"), K(0.48, M(wide, { yaw: 600, x: 0.2 }, F(st, 0.2, 0.2)), "out"),
      K(0.58, M(wide, { yaw: 720, x: 0.22 }, F(st, 0.22, 0.22)), "inout"), K(0.82, M({ yaw: 720, x: 0.22 }, F(st, 0.22, 0.22)), "inout")];
    return { keys, dur: 0.82, track: 90, hits: [{ at: 0.12, until: 0.3, point: "hR", r: 0.26, dmg: 10, level: "M", react: "heavy", push: 0.4 }, { at: 0.32, until: 0.5, point: "hL", r: 0.26, dmg: 12, level: "M", react: "spin", push: 1.2 }] };
  };
  // Divine Hammer: all four arms raised high, then brought down together.
  const hammer = () => {
    const up = { aL: [170, 10, 0, 30], aR: [170, 10, 0, 30], bL: [150, 20, 0, 40], bR: [150, 20, 0, 40], oL: 0, oR: 0, sp: st.sp - 14, y: st.y + 0.04, dp: st.dp - 10 };
    const down = M({ aL: [80, -6, 0, 10], aR: [80, -6, 0, 10], bL: [60, -6, 0, 10], bR: [60, -6, 0, 10], tL: [0.62, 0.9, -0.06, 1], tR: [0.62, 0.9, 0.06, 1], uL: [0.58, 0.82, -0.08, 1], uR: [0.58, 0.82, 0.08, 1], sp: st.sp + 34, dp: st.dp + 10, y: st.y - 0.18, x: 0.14 }, F(st, 0.16, 0.04));
    return { dur: 0.8, keys: [K(0, {}), K(0.24, up, "snap"), K(0.36, down, "hold"), K(0.46, M(down, { y: st.y - 0.2 }), "inout"), K(0.8, M({ x: 0.14 }, F(st, 0.14, 0.14)), "inout")],
      hits: [{ at: 0.3, until: 0.42, point: "hR", r: 0.24, dmg: 22, level: "M", react: "bound", push: 1.0, ground: true, trailLead: 0.1 }] };
  };
  const moves = {
    upperL: M(palm("aL"), { cmd: "1", name: "Upper Palm" }),
    lowerR: M(palm("bR"), { cmd: "2", name: "Lower Palm" }),
    upperR: M(palm("aR", { hit: { dmg: 10 } }), { cmd: "f+1", name: "Rising Palm" }),
    lowerL: M(palm("bL", { hit: { dmg: 9 } }), { cmd: "f+2", name: "Coiled Palm" }),
    cascade: M(cascade(), { cmd: "1+2", name: "Four-Palm Cascade" }),
    thousand: M(thousand(), { cmd: "f+1+2", name: "Thousand Palms (8 hits)" }),
    mandala: M(mandala(), { cmd: "b+2", name: "Mandala Spin" }),
    hammer: M(hammer(), { cmd: "b+1+2", name: "Divine Hammer (bound)" }),
    crane: M(A.snapKick(st, { hit: { dmg: 15, level: "H", react: "heavy" }, hitPose: { kL: [100, 0, 0, 6], fL: [0, 0, 0, -60], sp: st.sp - 20, aL: [160, 30, 0, 40], aR: [120, 50, 0, 60], bL: [40, 60, 0, 40], bR: [40, 60, 0, 40], y: st.y + 0.04, x: 0.06 } }), { cmd: "3", name: "Crane Kick" }),
    spinKick: M(A.roundhouse(st, { hit: { dmg: 19 } }), { cmd: "4", name: "Lotus Spin Kick", track: 40 }),
    lowKick: M(A.lowKick(st), { cmd: "d+3", name: "Ankle Tap (low)" }),
    sweep: M(A.sweep(st), { cmd: "d+4", name: "Circle Sweep (low)" }),
    lowPalm: M(A.lowPunch(st, { point: "hbL", wind: { y: -0.4, sp: st.sp + 22, bL: [10, 30, 0, 110] }, hitPose: M({ y: -0.46, sp: st.sp + 34, bL: [20, -6, 0, 6], uL: [0.72, 0.32, -0.04, 1], tL: [0, 0, 0, 0], x: 0.06 }, F(st, 0.08, 0)), hold: { y: -0.46, sp: st.sp + 34, bL: [20, -6, 0, 10], uL: [0.7, 0.34, -0.04, 1], tL: [0, 0, 0, 0], x: 0.06 } }), { cmd: "d+1", name: "Root Palm (low)" }),
    serpent: M(A.lowPunch(st, { t: [0.1, 0.2, 0.3, 0.56], point: "hbR", wind: { y: -0.44, sp: st.sp + 24, bR: [10, 50, 0, 110], bL: [10, 50, 0, 110], cy: st.cy - 30 },
      hitPose: M({ y: -0.5, sp: st.sp + 34, bR: [20, -6, 0, 6], uR: [0.74, 0.26, 0.04, 1], bL: [30, 30, 0, 30], cy: st.cy + 30, x: 0.1 }, F(st, 0.12, 0.02)), hit: { dmg: 12, level: "L", react: "sweep", push: 0.6, r: 0.2 } }), { cmd: "db+1", name: "Serpent Coil (low)" }),
    lotus: M(A.uppercut(st, { point: "hbR", wind: M({ bR: [0, 20, 0, 110], aR: [160, 20, 0, 40], cy: st.cy - 14, y: st.y - 0.24, sp: st.sp + 22 }, F(st, 0.06, 0)), hitPose: M({ bR: [140, -6, 0, 60], uR: [0.58, 1.5, 0.06, 1], aR: [170, 10, 0, 30], aL: [170, 10, 0, 30], cy: st.cy + 24, y: st.y + 0.06, sp: st.sp - 12, dp: st.dp - 14, x: 0.12 }, F(st, 0.12, 0.06, { pr: -40 })), hold: { bR: [150, -6, 0, 50], uR: [0.5, 1.62, 0.06, 1], aR: [170, 10, 0, 30], aL: [170, 10, 0, 30], y: st.y + 0.06, sp: st.sp - 14, x: 0.12 } }), { cmd: "df+2", name: "Lotus Bloom (launcher)" }),
    lunge: M(palm("bR", { t: [0.1, 0.22, 0.3, 0.6], hitPose: M({ bR: [62, -10, 0, 6], uR: [0.74, 1.12, 0.06, 1], aR: [100, -6, 0, 10], cy: st.cy + 24, sp: st.sp + 12, x: 0.5 }, F(st, 0.5, 0.36, { pr: -30 })), end: M({ x: 0.55 }, F(st, 0.55, 0.55)), hit: { dmg: 18, level: "M", react: "knockdown", push: 2.1, r: 0.2 } }), { cmd: "f,f+2", name: "Gilded Rush", dash: true }),
    jumpKick: M(A.jumpKick(st), { cmd: "uf+4", name: "Leaping Lotus" }),
    push: M(A.pushKick(st, { hit: { dmg: 14 } }), { cmd: "b+4", name: "Temple Push" }),
    // THOUSAND-ARM MANDALA: a palm; if it lands, sixteen palms from four arms, then the lotus rises through the body.
    super: M(A.superMove(st, { color: GOLD, fx: "gold", dur: 2.4, cine: { dur: 2.1, a0: 1.35, a1: 2.25, h0: 1.4, h1: 0.8 },
      chargePose: { aL: [170, 30, 0, 40], aR: [170, 30, 0, 40], bL: [90, 80, 0, 20], bR: [90, 80, 0, 20], oL: 1, oR: 1, sp: st.sp - 8 },
      open: { keys: [K(0.3, windPose("aL"), "snap"), K(0.38, palmPose("aL", 0.14), "hold")], hit: { at: 0.34, until: 0.44, point: "hL", dmg: 10, r: 0.26 } },
      steps: Array.from({ length: 12 }, (_, i) => ({ t: 0.55 + i * 0.075, pose: palmPose(ORDER[i % 8], 0.14), hit: { dmg: 3, react: i % 4 === 3 ? "heavy" : "light" },
        fx: { type: "fx", from: "opp", kind: "gold", color: GOLD, power: 0.6 } })).concat([
        { t: 1.6, pose: M({ bR: [0, 20, 0, 110], bL: [0, 20, 0, 110], aR: [160, 20, 0, 40], aL: [160, 20, 0, 40], y: st.y - 0.26, sp: st.sp + 24, x: 0.12 }, F(st, 0.14, 0.04)), ease: "inout" },
        { t: 1.74, pose: M({ bR: [140, -6, 0, 60], bL: [140, -6, 0, 60], uR: [0.58, 1.5, 0.06, 1], uL: [0.58, 1.5, -0.06, 1], aR: [170, 10, 0, 30], aL: [170, 10, 0, 30], y: st.y + 0.08, sp: st.sp - 14, dp: st.dp - 14, x: 0.18 }, F(st, 0.2, 0.08, { pr: -40 })), hold: 0.24,
          hit: { dmg: 22, react: "launch", pop: 7.8, push: 0.8 }, fx: [{ type: "fx", from: "opp", kind: "gold", color: 0xffffff, power: 2.6 }, { type: "cam", kind: "superHit" }] },
      ]) }), { cmd: "df+1+2", name: "THOUSAND-ARM MANDALA (super)" }),
  };
  const C = (from, over, hit) => T3Moves.clone(moves, from, over, hit);
  moves.s1b = C("lowerR", {}, { dmg: 7 });
  moves.s1c = C("upperR", {}, { dmg: 8 });
  moves.s1d = C("lowerL", {}, { dmg: 10, react: "heavy" });
  moves.s2b = C("spinKick", {}, { dmg: 16 });
  moves.s3b = C("crane", {}, { dmg: 13 });
  moves.s4b = C("lowerR", {}, { dmg: 7 });
  moves.s4c = C("lotus", { name: "Lotus Bloom" }, { dmg: 13 });
  const ten = [["upperL", { dmg: 5 }], ["upperL", { dmg: 5 }], ["lowerR", { dmg: 5 }], ["upperR", { dmg: 6 }], ["lowerL", { dmg: 6 }], ["crane", { dmg: 7, react: "light" }], ["lowPalm", { dmg: 6 }], ["spinKick", { dmg: 8, react: "light", push: 0.3 }], ["lowerR", { dmg: 7 }], ["thousand", { dmg: 3 }]];
  const tenIds = ten.map(([from, hit], i) => { const id = "ten" + (i + 1); moves[id] = C(from, { name: "Ten Hit " + (i + 1) }, hit); return id; });
  T3Moves.define("dancer", {
    name: "SUVARNA", stance: S,
    loco: { walkF: 1.45, walkB: 1.2, sidestep: 4.0, weight: 0.85 },
    moves,
    strings: [
      { name: "Four Beats", inputs: ["1", "2", "1", "2"], steps: ["upperL", "s1b", "s1c", "s1d"] },
      { name: "Palm to Lotus Spin", inputs: ["2", "4"], steps: ["lowerR", "s2b"] },
      { name: "Low to Crane", inputs: ["d+3", "3"], steps: ["lowKick", "s3b"] },
      { name: "Blooming Palms (ends in a launch)", inputs: ["2", "2", "df+2"], steps: ["lowerR", "s4b", "s4c"] },
      { name: "Ten Hit: Thousand Arms (17 hits, ends in the Thousand Palms)", inputs: ["1", "1", "2", "1", "2", "3", "1", "4", "2", "1+2"], steps: ["upperL"].concat(tenIds.slice(1)) },
    ],
    juggles: [
      { name: "Lotus Bloom, palm, Divine Hammer (bound), Mandala Spin", notation: "df+2, 1, b+1+2, b+2", steps: ["lotus", "upperL", "hammer", "mandala"] },
      { name: "Blooming Palms launch, palm, Thousand Palms", notation: "2,2,df+2, 1, f+1+2", pre: 3, steps: ["upperL", "thousand"] },
    ],
    notes: ["Four real arms: 1 and f+1 are the upper palms, 2 and f+2 the lower; 1+2 uses all four in turn, f+1+2 is eight palms.", "Divine Hammer (b+1+2) bounces a juggled or downed body off the floor.", "Super (df+1+2) needs a full meter."],
  });
})();
