// FROSTJAW: ice barbarian. The heaviest body and the greataxe in every move: haft rams, reaving swings, the
// Glacier Cleave, an overhead slam that sends a line of ice spikes along the floor and freezes whoever it touches,
// and the axe itself thrown spinning like a boomerang. Super: ABSOLUTE ZERO.
(() => {
  const S = T3Moves.STANCE.axe, st = T3.P(null, S), A = T3A, M = A.M, F = A.F, K = A.K;
  const two = { g: 1, gd: 0.38 };
  const WP = (tR, wa, x) => M({ tR: [tR[0], tR[1], tR[2], 1], wa: [wa[0], wa[1], wa[2], 1] }, two, x || {});
  const ICE = 0x9fe6ff;
  const spikes = (at, d0) => [0, 1, 2].map((i) => ({ at, type: "spawn", kind: "spikes", dist: d0 + i * 0.6, delay: i * 0.07, life: 0.5, r: 0.24, column: true, y0: 0.05, y1: 0.8, once: "spikes",
    hit: { dmg: 14, level: "M", react: "freeze", push: 0.3 } }));
  const moves = {
    jab: M(A.jab(st, { t: [0.08, 0.16, 0.22, 0.42], wind: { aL: [70, 6, -10, 100], cy: st.cy - 4, g: 0 }, hitPose: M({ aL: [90, -10, -10, 4], tL: [0.84, 1.5, -0.02, 1], cy: st.cy - 16, sp: st.sp + 4, x: 0.12, g: 0 }, F(st, 0.12, 0.02, { pr: -14 })), hit: { dmg: 9 } }), { cmd: "1", name: "Gauntlet Jab" }),
    haft: M(A.buttJab(st, { two, t: [0.1, 0.22, 0.28, 0.52], hit: { dmg: 14, level: "H", react: "heavy" } }), { cmd: "2", name: "Haft Ram" }),
    cleave: M(A.overhead(st, { two, t: [0.26, 0.42, 0.5, 0.86], hit: { dmg: 30, react: "crumple", r: 0.24 } }), { cmd: "f+2", name: "Glacier Cleave (crumple)" }),
    reaver: M(A.hSlash(st, { two, t: [0.2, 0.36, 0.42, 0.74], hit: { dmg: 24, react: "stagger", r: 0.24 } }), { cmd: "b+2", name: "Wide Reaver", track: 50 }),
    lowChop: M(A.lowSlash(st, { two, t: [0.18, 0.32, 0.38, 0.7], hit: { dmg: 16, react: "heavy", r: 0.22 } }), { cmd: "d+2", name: "Ankle Reaper (low)", track: 30 }),
    launcher: M(A.rising(st, { two, t: [0.18, 0.32, 0.4, 0.74], hit: { dmg: 20, pop: 6.6 } }), { cmd: "df+2", name: "Avalanche Rise (launcher)" }),
    // Permafrost: the axe driven into the floor; a line of ice spikes runs out along the fight line and freezes.
    permafrost: M(A.overhead(st, { two, t: [0.24, 0.4, 0.5, 0.92], hitPose: M(WP([0.56, 0.62, 0.06], [0, -62, 0]), { sp: st.sp + 34, dp: st.dp + 12, y: st.y - 0.2, cy: st.cy + 14, x: 0.12 }, F(st, 0.14, 0.04)),
      hold: M(WP([0.54, 0.56, 0.06], [0, -66, 0]), { sp: st.sp + 36, y: st.y - 0.22, x: 0.12 }), hit: { dmg: 12, react: "heavy", ground: true },
      events: spikes(0.4, 0.75).concat([{ at: 0.4, type: "cam", kind: "shake", power: 0.05 }]) }), { cmd: "db+2", name: "Permafrost (ice spikes, freeze)" }),
    // Glacial Boomerang: the axe thrown spinning; it comes back to the hand.
    boomerang: { cmd: "d,df,f+2", name: "Glacial Boomerang (thrown axe)", dur: 1.25,
      keys: [K(0, {}), K(0.22, M(WP([-0.1, 1.7, 0.36], [-150, 40, 0]), { g: 0, cy: st.cy - 40, hy: st.hy - 20, sp: st.sp - 10 }), "inout"),
        K(0.32, M(WP([0.6, 1.3, -0.1], [20, 0, 0]), { g: 0, aR: [90, -20, 0, 10], cy: st.cy + 40, hy: st.hy + 24, sp: st.sp + 14, x: 0.12 }, F(st, 0.16, 0.06, { pr: -30 })), "snap"),
        K(0.95, M({ g: 0, aR: [80, 10, 0, 30], oR: 1, aL: [60, 20, 0, 90], cy: st.cy + 20, x: 0.12 }, F(st, 0.14, 0.08)), "inout"),
        K(1.1, M({ g: 0, aR: [70, 20, 0, 70], oR: 0, x: 0.12 }, F(st, 0.12, 0.12)), "inout"), K(1.25, M({ x: 0.12 }, F(st, 0.12, 0.12)), "inout")],
      events: [{ at: 0.31, type: "weapon", show: false }, { at: 0.31, type: "spawn", kind: "axe", from: "hR", speed: 7, returnAt: 0.42, r: 0.3, trail: ICE, light: ICE,
        hit: { dmg: 16, level: "M", react: "heavy", push: 1.2 } }, { at: 1.24, type: "weapon", show: true }] },
    stomp: M(A.lowKick(st, { hit: { dmg: 12 } }), { cmd: "3", name: "Bone Stomp (low)" }),
    boot: M(A.pushKick(st, { t: [0.16, 0.3, 0.36, 0.66], hit: { dmg: 20 } }), { cmd: "4", name: "Frost Boot" }),
    mammoth: M(A.roundhouse(st, { t: [0.18, 0.36, 0.42, 0.72], hit: { dmg: 22 } }), { cmd: "f+4", name: "Mammoth Kick", track: 30 }),
    sweep: M(A.sweep(st, { t: [0.2, 0.4, 0.48, 0.86] }), { cmd: "d+4", name: "Tundra Sweep (low)" }),
    charge: M(A.body(st, { t: [0.12, 0.26, 0.34, 0.66], point: "elL", wind: M({ y: st.y - 0.1, sp: st.sp + 20, aL: [40, 30, 0, 110] }, two), hitPose: M({ y: st.y - 0.12, sp: st.sp + 26, aL: [60, -10, 0, 100], tL: [0.42, 1.25, -0.08, 1], cy: st.cy - 20, x: 0.55 }, two, F(st, 0.55, 0.4)), end: M({ x: 0.6 }, F(st, 0.6, 0.6)), hit: { dmg: 20, level: "M", react: "knockdown", push: 2.4, r: 0.3 } }), { cmd: "f,f+2", name: "Shoulder Charge", dash: true }),
    blizzard: M(A.spin(st, { two, t: [0.16, 0.36, 0.56, 0.9] }), { cmd: "1+2", name: "Blizzard Spin" }),
    drop: M(A.jumpChop(st, { two, hit: { dmg: 24 } }), { cmd: "uf+2", name: "Mountain Drop (bound)" }),
    // ABSOLUTE ZERO: the haft to the chest; if it lands, the axe hits the floor, ice closes around the victim, three
    // chops crack it and the Glacier Cleave shatters it.
    super: M(A.superMove(st, { color: ICE, fx: "ice", dur: 2.5, cine: { dur: 2.2, a0: 1.45, a1: 2.0, h0: 1.1, h1: 0.6 },
      chargePose: M(WP([0.0, 1.9, 0.12], [0, 125, 0]), { sp: st.sp - 14, dp: st.dp - 10 }),
      open: { keys: [K(0.3, M(WP([0.15, 1.36, 0.2], [180, -6, 0]), { cy: st.cy - 10 }), "snap"), K(0.4, M(WP([0.52, 1.4, 0.04], [180, 0, 0]), { cy: st.cy + 14, x: 0.12 }, F(st, 0.14, 0.04)), "hold")],
        hit: { at: 0.36, until: 0.46, point: "butt", dmg: 12, r: 0.26 } },
      steps: [
        { t: 0.66, pose: M(WP([0.56, 0.62, 0.06], [0, -62, 0]), { sp: st.sp + 34, y: st.y - 0.2, x: 0.12 }, F(st, 0.14, 0.04)), hold: 0.2,
          events: [{ at: 0.64, type: "spawn", kind: "spikes", dist: 0.9, life: 0.6, track: true }, { at: 0.66, type: "freezeOpp" }, { at: 0.66, type: "cam", kind: "shake", power: 0.06 }] },
        { t: 1.06, pose: M(WP([0.5, 1.45, -0.12], [45, 0, 90]), { cy: st.cy + 36, hy: st.hy + 24, x: 0.12 }, F(st, 0.14, 0.04)), hit: { dmg: 10, react: "heavy" }, fx: { type: "fx", from: "opp", kind: "ice", color: ICE, power: 1.2 } },
        { t: 1.3, pose: M(WP([0.52, 1.42, 0.24], [-50, 0, -90]), { cy: st.cy - 26, hy: st.hy - 14, x: 0.12 }, F(st, 0.14, 0.04)), hit: { dmg: 10, react: "heavy" }, fx: { type: "fx", from: "opp", kind: "ice", color: ICE, power: 1.2 } },
        { t: 1.54, pose: M(WP([0.5, 1.08, -0.08], [30, -40, 45]), { cy: st.cy + 26, sp: st.sp + 20, y: st.y - 0.1, x: 0.12 }, F(st, 0.14, 0.04)), hit: { dmg: 10, react: "heavy" }, fx: { type: "fx", from: "opp", kind: "ice", color: ICE, power: 1.3 } },
        { t: 1.86, pose: M(WP([0.0, 1.95, 0.12], [0, 128, 0]), { sp: st.sp - 16, dp: st.dp - 10, y: st.y + 0.02, x: 0.06 }, F(st, 0.08, 0.02)), ease: "inout" },
        { t: 2.0, pose: M(WP([0.48, 1.0, 0.06], [0, -40, 0]), { sp: st.sp + 24, dp: st.dp + 10, y: st.y - 0.14, cy: st.cy + 14, x: 0.16 }, F(st, 0.2, 0.04)), hold: 0.2,
          hit: { dmg: 26, react: "blast", push: 2.6 }, fx: [{ type: "fx", from: "opp", kind: "ice", color: 0xffffff, power: 2.6 }, { type: "cam", kind: "superHit" }] },
      ] }), { cmd: "df+1+2", name: "ABSOLUTE ZERO (super)" }),
  };
  const C = (from, over, hit) => T3Moves.clone(moves, from, over, hit);
  moves.s1b = C("haft", {}, { dmg: 11 });
  moves.s1c = C("cleave", {}, { dmg: 24 });
  moves.s2b = C("jab", {}, { dmg: 8 });
  moves.s2c = C("reaver", {}, { dmg: 18 });
  moves.s3b = C("cleave", {}, { dmg: 22 });
  moves.s4b = M(A.backhand(st, { two, t: [0.14, 0.28, 0.34, 0.6], hit: { dmg: 14, react: "heavy", r: 0.24 } }), { hidden: true, name: "Return Reaver", base: "haft" });
  moves.s4c = C("permafrost", { name: "Permafrost" }, { dmg: 10 });
  const ten = [["jab", { dmg: 7 }], ["jab", { dmg: 7 }], ["haft", { dmg: 9 }], ["stomp", { dmg: 8 }], ["boot", { dmg: 9, react: "heavy", push: 0.7 }], ["haft", { dmg: 9, level: "M" }], ["lowChop", { dmg: 10, react: "light" }], ["jab", { dmg: 7 }], ["reaver", { dmg: 12, react: "heavy" }], ["cleave", { dmg: 20, react: "crumple" }]];
  const tenIds = ten.map(([from, hit], i) => { const id = "ten" + (i + 1); moves[id] = C(from, { name: "Ten Hit " + (i + 1) }, hit); return id; });
  T3Moves.define("barbarian", {
    name: "FROSTJAW", stance: S,
    loco: { walkF: 1.05, walkB: 0.85, dash: 3.8, backdash: 3.4, sidestep: 3.4, jumpV: 5.0, weight: 1.5 },
    moves,
    strings: [
      { name: "Frost Fall (crumple)", inputs: ["1", "2", "2"], steps: ["jab", "s1b", "s1c"] },
      { name: "Reaver Line", inputs: ["2", "1", "2"], steps: ["haft", "s2b", "s2c"] },
      { name: "Low and Cleave", inputs: ["d+2", "2"], steps: ["lowChop", "s3b"] },
      { name: "Shatterline (ends in a freeze)", inputs: ["2", "2", "d+2"], steps: ["haft", "s4b", "s4c"] },
      { name: "Ten Hit: Long Winter", inputs: ["1", "1", "2", "3", "4", "2", "d+2", "1", "2", "2"], steps: ["jab"].concat(tenIds.slice(1)) },
    ],
    juggles: [
      { name: "Avalanche Rise, jab, Mountain Drop (bound), Shoulder Charge", notation: "df+2, 1, uf+2, f,f+2", steps: ["launcher", "jab", "drop", "charge"] },
      { name: "Permafrost freeze, Avalanche Rise, jab, Mountain Drop (bound), Blizzard Spin", notation: "db+2, df+2, 1, uf+2, 1+2", steps: ["permafrost", "launcher", "jab", "drop", "blizzard"] },
    ],
    notes: ["Heaviest fighter: slowest walk and dashes, the biggest damage. Wide Reaver (b+2) tracks sidesteps.", "Permafrost (db+2) runs ice spikes along the floor: a hit freezes the opponent for a free follow-up.",
      "Glacial Boomerang (d,df,f+2) throws the axe; it hits going out and coming back.", "Super (df+1+2) needs a full meter."],
  });
})();
