// NOVA: blue flame sorceress. She fights with spells, not fists: quick bolts flicked off the lead palm from the
// floating spell orb, a slow heavy comet, a low ember that runs along the floor, a flame pillar that erupts under
// the opponent and launches them, close palm blasts, and blinks through blue fire (behind the opponent or away).
// Her kicks trail flame. Super: SUPERNOVA.
(() => {
  const S = T3Moves.STANCE.mage, st = T3.P(null, S), A = T3A, M = A.M, F = A.F, K = A.K;
  const BLUE = 0x6a8bff, WHITE = 0xcfe0ff;
  const bolt = (o) => Object.assign({ kind: "fireball", speed: 9, r: 0.16, life: 0.55, trail: BLUE, light: BLUE, lightK: 1.2, hit: { dmg: 8, level: "H", react: "light", push: 0.5 } }, o);
  const fire = (o) => M(o, { fx: 1.6 });
  const moves = {
    bolt: M(A.cast(st, { t: [0.06, 0.13, 0.2, 0.38], spell: bolt({}) }), { cmd: "1", name: "Flicker Bolt (fireball, high)" }),
    palm: M(A.cross(st, { point: "hR", wind: { aR: [40, 30, -20, 130], oR: 1, fx: 1.2, cy: st.cy - 10, y: st.y - 0.04 },
      hitPose: fire(M({ aR: [90, -10, 0, 6], tR: [0.74, 1.3, 0.04, 1], oR: 1, cy: st.cy + 30, hy: st.hy + 18, sp: st.sp + 8, x: 0.12, y: st.y - 0.04 }, F(st, 0.14, 0.04, { pr: -30 }))),
      hit: { dmg: 13, level: "M", react: "heavy", push: 1.3, r: 0.22 }, events: [{ at: 0.17, type: "fx", from: "hR", kind: "fire", color: BLUE, power: 1.2 }] }), { cmd: "2", name: "Ember Palm" }),
    comet: M(A.cast(st, { t: [0.2, 0.34, 0.44, 0.72], two: true, h: 1.25, flashPower: 1.4,
      spell: { kind: "comet", speed: 5.5, r: 0.3, life: 1.0, trail: WHITE, light: BLUE, lightK: 2, hit: { dmg: 20, level: "M", react: "knockdown", push: 2 } } }), { cmd: "f+2", name: "Comet (big fireball)" }),
    ember: M(A.cast(st, { t: [0.1, 0.2, 0.28, 0.5], h: 0.45, wind: { y: -0.36, sp: st.sp + 24 }, release: { y: -0.42, sp: st.sp + 30, tL: [0.62, 0.3, -0.04, 1] },
      spell: { kind: "ember", from: "front", off: [0.6, 0.06, 0], ground: true, speed: 6.5, r: 0.2, y1: 0.35, life: 0.7, trail: BLUE, hit: { dmg: 10, level: "L", react: "light", push: 0.5 } } }), { cmd: "d+1", name: "Ground Ember (low)", crouch: [0.06, 0.45] }),
    pillar: M(A.cast(st, { t: [0.14, 0.24, 0.34, 0.62], two: true, h: 1.75, wind: { y: st.y - 0.12, sp: st.sp + 14 }, release: { y: st.y + 0.04, sp: st.sp - 10, dp: st.dp - 10 },
      spell: { kind: "pillar", dist: 1.1, track: true, trackMax: 2.8, delay: 0.2, column: true, y0: 0, y1: 2, life: 0.45, r: 0.34, light: BLUE, lightK: 2.5,
        hit: { dmg: 16, level: "M", react: "launch", pop: 6.6, push: 0.4 } } }), { cmd: "df+2", name: "Flame Pillar (launcher, under the opponent)" }),
    rising: M(A.uppercut(st, { hitPose: fire(M({ aR: [150, -6, 0, 70], tR: [0.64, 1.38, 0.04, 1], oR: 1, cy: st.cy + 24, hy: st.hy + 16, y: st.y + 0.04, sp: st.sp - 12, dp: st.dp - 14, x: 0.14 }, F(st, 0.14, 0.06, { pr: -40 }))),
      events: [{ at: 0.24, type: "fx", from: "hR", kind: "fire", color: BLUE, power: 1.4 }] }), { cmd: "df+1", name: "Rising Flame (launcher)" }),
    spiral: M(A.hook(st, { hitPose: fire(M({ aR: [86, -24, 0, 76], oR: 1, cy: st.cy + 44, hy: st.hy + 26, sp: st.sp + 10, x: 0.12, y: st.y - 0.06 }, F(st, 0.08, 0.06, { pr: -40 }))) }), { cmd: "b+2", name: "Spiral Flame", track: 60 }),
    snap: M(A.snapKick(st, { hitPose: fire({ kL: [86, 0, 0, 6], fL: [0, 0, 0, -50], sp: st.sp - 16, hp: st.hp - 6, aL: [40, 40, 0, 70], aR: [50, 30, 0, 130], y: st.y + 0.03, x: 0.06 }) }), { cmd: "3", name: "Comet Kick" }),
    round: M(A.roundhouse(st, { hit: { dmg: 19 } }), { cmd: "4", name: "Blue Roundhouse", track: 30 }),
    sweep: M(A.sweep(st), { cmd: "d+4", name: "Ash Sweep (low)" }),
    burst: M(A.cross(st, { t: [0.14, 0.28, 0.4, 0.7], wind: { aR: [20, 30, 0, 120], aL: [20, 30, 0, 120], y: st.y - 0.1, sp: st.sp + 10, fx: 1.4 },
      hitPose: fire(M({ aR: [80, -4, 0, 4], aL: [86, -4, 0, 4], tR: [0.74, 1.15, 0.08, 1], tL: [0.76, 1.3, -0.08, 1], oL: 1, oR: 1, cy: st.cy, sp: st.sp + 6, x: 0.08, y: st.y - 0.06 }, F(st, 0.1, 0.02))),
      hit: { dmg: 20, level: "M", react: "blast", push: 2.4, r: 0.3 }, events: [{ at: 0.27, type: "fx", from: "hR", kind: "fire", color: WHITE, power: 2 }] }), { cmd: "1+2", name: "Nova Burst" }),
    phase: M(A.blink(st, { at: 0.14, blink: { behind: true, past: 0.75 }, dur: 0.78,
      then: M(A.snapKick(st, { t: [0.06, 0.14, 0.2, 0.34], hitPose: fire({ kL: [86, 0, 0, 6], fL: [0, 0, 0, -50], sp: st.sp - 16, hp: st.hp - 6, aL: [40, 40, 0, 70], y: st.y + 0.03, x: 0.06 }), hit: { dmg: 14, react: "spin" } })) }),
      { cmd: "f+1+2", name: "Phase Strike (blinks behind)" }),
    away: M(A.blink(st, { at: 0.12, blink: { dx: -1.7 }, dur: 0.5 }), { cmd: "b+1+2", name: "Phase Back (leaves a flame)" }),
    starfall: { cmd: "uf+1", name: "Starfall (from the air)", dur: 0.78, air: [0.08, 0.6],
      keys: [K(0, {}), K(0.2, { y: st.y + 0.5, ikL: 0, ikR: 0, kL: [80, 4, 0, 110], kR: [30, 6, 0, 120], aL: [140, 20, 0, 40], oL: 1, fx: 1.4, sp: st.sp - 10, x: 0.15 }, "out"),
        K(0.32, { y: st.y + 0.56, ikL: 0, ikR: 0, kL: [70, 4, 0, 90], kR: [20, 6, 0, 110], aL: [70, -10, 0, 6], tL: [0.7, 1.0, -0.04, 1], oL: 1, fx: 1.6, sp: st.sp + 10, x: 0.2 }, "hold"),
        K(0.5, { y: st.y + 0.1, ikL: 0, ikR: 0, kL: [40, 4, 0, 80], kR: [20, 6, 0, 80], aL: [60, 10, 0, 30], oL: 1, x: 0.25 }, "in"), K(0.78, M({ x: 0.28 }, F(st, 0.28, 0.28)), "inout")],
      events: [{ at: 0.31, type: "spawn", kind: "fireball", from: "hL", speed: 5, vy: -3.2, r: 0.22, life: 0.6, trail: BLUE, light: BLUE, hit: { dmg: 14, level: "M", react: "heavy", push: 1.2 } }] },
    barrage: { cmd: "d,df,f+1", name: "Orb Barrage (three bolts)", dur: 0.72,
      keys: [K(0, {}), K(0.1, M({ aL: [70, 20, -10, 90], oL: 1, fx: 1.6, cy: st.cy + 10 }), "inout"),
        ...[0, 1, 2].flatMap((i) => [K(0.15 + i * 0.12, M({ aL: [92, -4, 0, 4], tL: [0.74, 1.32, -0.04, 1], oL: 1, fx: 1.8, cy: st.cy - 22, x: 0.04 + i * 0.03 }, F(st, 0.06 + i * 0.03, 0.02 + i * 0.03)), "hold"),
          K(0.21 + i * 0.12, M({ aL: [80, 10, 0, 60], oL: 1, fx: 1.4, cy: st.cy, x: 0.04 + i * 0.03 }, F(st, 0.06 + i * 0.03, 0.02 + i * 0.03)), "inout")]),
        K(0.72, M({ x: 0.1 }, F(st, 0.1, 0.1)), "inout")],
      events: [0, 1, 2].map((i) => ({ at: 0.15 + i * 0.12, type: "spawn", ...bolt({ from: "hL", speed: 10, hit: { dmg: i === 2 ? 10 : 6, level: "M", react: i === 2 ? "heavy" : "light", push: i === 2 ? 1.2 : 0.3 } }) })) },
    // SUPERNOVA: a palm to the chest; if it lands she rises on blue fire, the orb fires point-blank, a pillar
    // erupts under the opponent and a comet the size of a body finishes it.
    super: M(A.superMove(st, { color: BLUE, fx: "fire", dur: 2.4, cine: { dur: 2.1, a0: 2.2, a1: 1.5, h0: 0.6, h1: 1.6 },
      chargePose: { aL: [150, 30, 0, 30], aR: [150, 30, 0, 30], oL: 1, oR: 1, fx: 2, sp: st.sp - 10, dp: st.dp - 14 },
      open: { keys: [K(0.3, { aR: [40, 30, -20, 130], oR: 1, fx: 1.4, cy: st.cy - 10 }, "snap"), K(0.38, fire(M({ aR: [90, -10, 0, 6], tR: [0.74, 1.3, 0.04, 1], oR: 1, cy: st.cy + 30, hy: st.hy + 18, x: 0.14 }, F(st, 0.16, 0.06))), "hold")],
        hit: { at: 0.34, until: 0.44, point: "hR", dmg: 10, r: 0.26 } },
      steps: [
        { t: 0.6, pose: { y: st.y + 0.3, ikL: 0, ikR: 0, kL: [40, 10, 0, 90], kR: [10, 10, 0, 100], aL: [90, 10, 0, 20], aR: [60, 40, 0, 60], oL: 1, oR: 1, fx: 2, x: 0.1 }, ease: "inout" },
        ...[0, 1, 2].map((i) => ({ t: 0.78 + i * 0.16, pose: { y: st.y + 0.36, ikL: 0, ikR: 0, kL: [40, 10, 0, 90], kR: [10, 10, 0, 100], aL: [92, -4, 0, 4], tL: [0.74, 1.5, -0.04, 1], aR: [60, 40, 0, 60], oL: 1, oR: 1, fx: 2, x: 0.1 },
          hit: { dmg: 7 }, fx: { type: "fx", from: "opp", kind: "fire", color: BLUE, power: 1.2 } })),
        { t: 1.4, pose: { y: st.y + 0.4, ikL: 0, ikR: 0, kL: [40, 10, 0, 90], kR: [10, 10, 0, 100], aL: [160, 10, 0, 20], aR: [160, 10, 0, 20], oL: 1, oR: 1, fx: 2.4, x: 0.1 }, ease: "inout",
          events: [{ at: 1.42, type: "spawn", kind: "pillar", dist: 1, track: true, life: 0.5 }], hit: { dmg: 12, react: "heavy" }, fx: { type: "fx", from: "opp", kind: "fire", color: WHITE, power: 1.6 } },
        { t: 1.82, pose: { y: st.y + 0.2, aL: [60, 30, -10, 120], aR: [50, 34, -10, 130], oL: 1, oR: 1, fx: 2.6, cy: st.cy, sp: st.sp - 6, x: 0.06 }, ease: "inout" },
        { t: 1.96, pose: fire(M({ aL: [88, -4, 0, 6], aR: [92, -4, 0, 4], tL: [0.72, 1.2, -0.06, 1], tR: [0.74, 1.32, 0.04, 1], oL: 1, oR: 1, cy: st.cy, sp: st.sp + 8, x: 0.14 }, F(st, 0.16, 0.04, { pr: -20 }))), hold: 0.2,
          hit: { dmg: 22, react: "blast", push: 3 }, fx: [{ type: "fx", from: "opp", kind: "fire", color: WHITE, power: 2.8 }, { type: "cam", kind: "superHit" }] },
      ] }), { cmd: "df+1+2", name: "SUPERNOVA (super)" }),
  };
  moves.away.events.unshift({ at: 0.11, type: "spawn", kind: "fireball", from: "front", off: [0.55, 1.1, 0], speed: 0, r: 0.36, life: 0.35, delay: 0.06, light: BLUE, hit: { dmg: 10, level: "M", react: "heavy", push: 1.4 } });
  const C = (from, over, hit) => T3Moves.clone(moves, from, over, hit);
  moves.s1b = C("bolt", {}, { dmg: 7 });
  moves.s1c = C("palm", {}, { dmg: 12 });
  moves.s2b = C("bolt", {}, { dmg: 7, level: "M" });
  moves.s2c = C("round", {}, { dmg: 16 });
  moves.s3b = C("comet", {}, { dmg: 16 });
  moves.s4b = C("palm", {}, { dmg: 11, react: "light" });
  moves.s4c = C("pillar", { name: "Flame Pillar" }, { dmg: 14 });
  const ten = [["palm", { dmg: 6, react: "light" }], ["palm", { dmg: 6, react: "light" }], ["bolt", { dmg: 5, level: "M" }], ["bolt", { dmg: 5, level: "M" }], ["snap", { dmg: 7, react: "light" }], ["snap", { dmg: 6, react: "light" }], ["round", { dmg: 8, react: "heavy" }], ["bolt", { dmg: 6, level: "M" }], ["comet", { dmg: 9, react: "light", push: 0.2 }], ["burst", { dmg: 16 }]];
  const tenIds = ten.map(([from, hit], i) => { const id = "ten" + (i + 1); moves[id] = C(from, { name: "Ten Hit " + (i + 1) }, hit); return id; });
  T3Moves.define("flame", {
    name: "NOVA", stance: S,
    loco: { walkF: 1.5, walkB: 1.2, dash: 4.9, backdash: 4.6, sidestep: 3.9, weight: 0.85 },
    moves,
    strings: [
      { name: "Spellweave", inputs: ["1", "1", "2"], steps: ["bolt", "s1b", "s1c"] },
      { name: "Starfire", inputs: ["2", "1", "4"], steps: ["palm", "s2b", "s2c"] },
      { name: "Low Ember to Comet", inputs: ["d+1", "2"], steps: ["ember", "s3b"] },
      { name: "Pyre (ends in a pillar launch)", inputs: ["1", "2", "df+2"], steps: ["bolt", "s4b", "s4c"] },
      { name: "Ten Hit: Supernova Sequence", inputs: ["2", "2", "1", "1", "3", "3", "4", "1", "f+2", "1+2"], steps: ["palm"].concat(tenIds.slice(1)) },
    ],
    juggles: [
      { name: "Flame Pillar, Flicker Bolt, Ember Palm, Comet", notation: "df+2, 1, 2, f+2", steps: ["pillar", "bolt", "palm", "comet"] },
      { name: "Rising Flame, bolt, Nova Burst", notation: "df+1, 1, 1+2", steps: ["rising", "bolt", "burst"] },
      { name: "Pyre launch, Orb Barrage", notation: "1,2,df+2, d,df,f+1", pre: 3, steps: ["barrage"] },
    ],
    notes: ["Spells: Flicker Bolt (1) is a fast high fireball, Comet (f+2) a slow mid, Ground Ember (d+1) runs along the floor (low).", "Flame Pillar (df+2) erupts under an opponent up to about 2.8 m away after a short warning: sidestep it.",
      "Phase Strike (f+1+2) blinks behind the opponent; Phase Back (b+1+2) blinks away and leaves a flame where she stood.", "Super (df+1+2) needs a full meter."],
  });
})();
