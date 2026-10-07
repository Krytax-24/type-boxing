// COMMANDER VOSS: staff commander. The longest reach in the roster and every end of the staff in play: butt jabs,
// long thrusts, a five-thrust flurry, the staff spun overhead like a rotor, a planted pole-vault double kick, a
// banner slam that bounces bodies off the floor. Super: COMMANDER'S STORM.
(() => {
  const S = T3Moves.STANCE.staff, st = T3.P(null, S), A = T3A, M = A.M, F = A.F, K = A.K;
  const two = { g: 1, gd: 0.42 };
  const WP = (tR, wa, x) => M({ tR: [tR[0], tR[1], tR[2], 1], wa: [wa[0], wa[1], wa[2], 1] }, two, x || {});
  const PALE = 0x9fc0ff;
  const moves = {
    butt: M(A.buttJab(st, { two }), { cmd: "1", name: "Butt Jab" }),
    poke: M(A.thrust(st, { two, hit: { dmg: 13, level: "M" } }), { cmd: "2", name: "Long Thrust" }),
    flurry: M(A.flurry(st, { two, n: 5, dmg: 5, last: "heavy" }), { cmd: "f+2", name: "Commander's Flurry (5 hits)" }),
    rotor: M(A.whirl(st, { two, n: 3, dmg: 7 }), { cmd: "b+2", name: "Rotor Guard (tracks)" }),
    sweepStaff: M(A.lowSlash(st, { two, hit: { dmg: 13, react: "light" } }), { cmd: "d+2", name: "Ground Sweep (low)", track: 30 }),
    moon: M(A.spinLow(st, { two, hit: { dmg: 15 } }), { cmd: "db+2", name: "Moon Sweep (low)" }),
    rising: M(A.rising(st, { two }), { cmd: "df+2", name: "Rising Pole (launcher)" }),
    banner: M(A.overhead(st, { two, hit: { dmg: 20, react: "bound", ground: true } }), { cmd: "f+1", name: "Banner Strike (bound)" }),
    front: M(A.pushKick(st, { point: "ftR", hit: { dmg: 13, level: "M", react: "heavy", push: 1.4 } }), { cmd: "3", name: "Front Kick" }),
    high: M(A.roundhouse(st, { hit: { dmg: 18 } }), { cmd: "4", name: "High Crescent", track: 30 }),
    lowKick: M(A.lowKick(st), { cmd: "d+4", name: "Low Snap (low)" }),
    vault: M(A.vaultKick(st, { two }), { cmd: "uf+3", name: "Pole Vault Kick" }),
    lunge: M(A.lungeThrust(st, { two, hit: { dmg: 18 } }), { cmd: "f,f+2", name: "Lunge Thrust" }),
    windmill: M(A.spin(st, { two }), { cmd: "1+2", name: "Windmill" }),
    dragon: M(A.flurry(st, { two, n: 3, gap: 0.12, step: 0.14, dmg: 7, last: "launch", t0: 0.16 }), { cmd: "d,df,f+2", name: "Dragon Rush (launcher)" }),
    knee: M(A.knee(st), { cmd: "df+4", name: "Rising Knee (launcher)" }),
    // COMMANDER'S STORM: a thrust to the chest; if it lands, a volley of thrusts, the staff spun through the body
    // twice, and the Rising Pole straight up.
    super: M(A.superMove(st, { color: PALE, fx: "wind", dur: 2.2, cine: { dur: 1.9, a0: 1.4, a1: 2.2 },
      chargePose: M(WP([0.18, 1.72, 0.0], [90, 0, 0]), { aL: [160, 20, 0, 40], sp: st.sp - 6 }),
      open: { keys: [K(0.3, M(WP([0.12, 1.3, 0.22], [-8, 8, 0]), { cy: st.cy - 14 }), "snap"), K(0.4, M(WP([0.62, 1.3, 0.04], [0, 0, 0]), { cy: st.cy + 22, hy: st.hy + 12, sp: st.sp + 10, x: 0.14 }, F(st, 0.16, 0.06)), "hold")],
        hit: { at: 0.36, until: 0.46, point: "wpn", dmg: 10, r: 0.26 } },
      steps: [0, 1, 2, 3].map((i) => ({ t: 0.56 + i * 0.11, pose: M(WP([0.62, [1.3, 1.15, 1.35, 1.2][i], 0.04], [0, 0, 0]), { cy: st.cy + 22, sp: st.sp + 10, x: 0.14 }, F(st, 0.16, 0.06)),
        hit: { dmg: 5 }, fx: { type: "fx", from: "opp", kind: "wind", color: PALE, power: 0.8 } })).concat([
        { t: 1.06, pose: M(WP([0.18, 1.5, 0.0], [-90, 0, 0]), { aL: [150, 20, 0, 40], x: 0.14 }, F(st, 0.16, 0.06)), ease: "linear" },
        { t: 1.18, pose: M(WP([0.18, 1.5, 0.0], [90, 0, 0]), { aL: [150, 20, 0, 40], x: 0.14 }, F(st, 0.16, 0.06)), ease: "linear", hit: { dmg: 8, react: "heavy" }, fx: { type: "fx", from: "opp", kind: "wind", color: PALE, power: 1.2 } },
        { t: 1.3, pose: M(WP([0.18, 1.5, 0.0], [270, 0, 0]), { aL: [150, 20, 0, 40], x: 0.14 }, F(st, 0.16, 0.06)), ease: "linear" },
        { t: 1.42, pose: M(WP([0.18, 1.5, 0.0], [450, 0, 0]), { aL: [150, 20, 0, 40], x: 0.14 }, F(st, 0.16, 0.06)), ease: "inout", hit: { dmg: 8, react: "heavy" }, fx: { type: "fx", from: "opp", kind: "wind", color: PALE, power: 1.4 } },
        { t: 1.6, pose: M(WP([0.02, 0.62, 0.26], [0, -125, 0]), { y: st.y - 0.24, sp: st.sp + 22, cy: st.cy - 16, x: 0.14 }, F(st, 0.18, 0.06)), ease: "inout" },
        { t: 1.72, pose: M(WP([0.42, 1.85, 0.06], [0, 80, 0]), { y: st.y + 0.06, sp: st.sp - 10, cy: st.cy + 20, dp: st.dp - 12, x: 0.26 }, F(st, 0.3, 0.12, { pr: -30 })), hold: 0.2,
          hit: { dmg: 20, react: "launch", pop: 7.6, push: 0.8 }, fx: [{ type: "fx", from: "opp", kind: "wind", color: 0xffffff, power: 2.2 }, { type: "cam", kind: "superHit" }] },
      ]) }), { cmd: "df+1+2", name: "COMMANDER'S STORM (super)" }),
  };
  const C = (from, over, hit) => T3Moves.clone(moves, from, over, hit);
  moves.s1b = C("poke", {}, { dmg: 10 });
  moves.s1c = C("poke", {}, { dmg: 12, react: "heavy" });
  moves.s2b = C("poke", {}, { dmg: 10 });
  moves.s2c = C("high", {}, { dmg: 16 });
  moves.s3b = C("butt", {}, { dmg: 7 });
  moves.s3c = M(A.whirl(st, { two, n: 3, dmg: 6, t0: 0.1 }), { hidden: true, name: "Rotor Guard", base: "poke" });
  moves.s4b = M(A.rising(st, { two, t: [0.1, 0.24, 0.31, 0.62], hit: { dmg: 14, pop: 6.0 } }), { hidden: true, name: "Rising Pole (launcher)", base: "poke" });
  moves.s5b = M(A.spinLow(st, { two, hit: { dmg: 12 } }), { hidden: true, name: "Moon Sweep (low)", base: "poke" });
  const ten = [["poke", { dmg: 7 }], ["butt", { dmg: 6 }], ["butt", { dmg: 6 }], ["snap", { dmg: 7 }], ["sweepStaff", { dmg: 8, react: "light" }], ["butt", { dmg: 6 }], ["front", { dmg: 8, react: "light" }], ["high", { dmg: 9, react: "heavy" }], ["poke", { dmg: 7 }], ["banner", { dmg: 14, react: "crumple" }]];
  moves.snap = M(A.snapKick(st, { hit: { dmg: 11, level: "M", react: "light" } }), { hidden: true, name: "Quick Snap", cmd: null, base: "front" });
  const tenIds = ten.map(([from, hit], i) => { const id = "ten" + (i + 1); moves[id] = C(from, { name: "Ten Hit " + (i + 1) }, hit); return id; });
  T3Moves.define("voss", {
    name: "COMMANDER VOSS", stance: S,
    loco: { walkF: 1.4, walkB: 1.15, sidestep: 3.8, weight: 0.95 },
    moves,
    strings: [
      { name: "Triple Thrust", inputs: ["2", "2", "2"], steps: ["poke", "s1b", "s1c"] },
      { name: "Drill Order", inputs: ["1", "2", "4"], steps: ["butt", "s2b", "s2c"] },
      { name: "Phalanx Rotor (5 hits)", inputs: ["1", "1", "2"], steps: ["butt", "s3b", "s3c"] },
      { name: "Low, then Rising Pole (launcher)", inputs: ["d+2", "2"], steps: ["sweepStaff", "s4b"] },
      { name: "Low, then Moon Sweep (low)", inputs: ["d+2", "d+2"], steps: ["sweepStaff", "s5b"] },
      { name: "Ten Hit: Chain of Command", inputs: ["2", "1", "1", "3", "d+2", "1", "3", "4", "2", "f+1"], steps: ["poke"].concat(tenIds.slice(1)) },
    ],
    juggles: [
      { name: "Rising Pole, butt, Banner Strike (bound), Pole Vault Kick", notation: "df+2, 1, f+1, uf+3", steps: ["rising", "butt", "banner", "vault"] },
      { name: "Low then Rise, butt, Banner Strike (bound), Windmill", notation: "d+2,2, 1, f+1, 1+2", pre: 3, steps: ["butt", "banner", "windmill"] },
      { name: "Dragon Rush, Commander's Flurry", notation: "d,df,f+2, f+2", steps: ["dragon", "flurry"] },
    ],
    notes: ["The longest reach in the roster; thrusts are linear, the Rotor Guard (b+2) tracks a sidestep.", "Pole Vault Kick (uf+3) plants the staff and jumps over lows.", "Super (df+1+2) needs a full meter."],
  });
})();
