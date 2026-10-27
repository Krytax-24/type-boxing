/**
 * Animation clips for the 2D fighters: every move for every weapon, designed in code.
 * A clip is a list of key poses on a 0..1 timeline; Rig.sample() runs a smooth spline through them.
 *   dur: seconds (run uses its stride instead)   loop: repeat   next: the clip that follows (null = hold)
 *   events: [[t, name]]: impact (a hit lands), dust, step, land, slam (ground hit), parry, hurt, thud
 *   trails: [[t0, t1, blade]]: when to draw the weapon smear (blade 0 = front hand, 1 = back hand)
 *   ghosts: [t0, t1]: afterimages (dash and lunges)    frames: the frame count on the reference sheet
 * Each weapon defines its stance (legs, lean), how its arms hold the weapon in the shared moves (arms.*), and its
 * own four attacks and taunt. Shared moves (idle, run, dash, jump, hit, parry, death) are built from the stance
 * plus those arm poses, so every weapon moves with the same body.
 */
CounterType.define("clips", ["rig", "motion"], (Rig, Move) => {
  "use strict";

  const P = Rig.P;

  // ---------- Weapons: stance, arm poses for shared moves, own attacks ----------
  const W = {};

  W.fists = {
    name: "Bare hands",
    tier: "Hand wraps in the game",
    reach: 95,
    heavy: 0,
    lean: 14,
    legs: [-64, -95],
    arms: {
      guard: { fa: [-35, 72], ba: [-58, 84] },
      guard2: { fa: [-39, 68], ba: [-62, 80] },
      runA: { fa: [-130, -50], ba: [-40, 40] },
      runB: { fa: [-40, 40], ba: [-130, -50] },
      dash: { fa: [-150, -125], ba: [-160, -135] },
      up: { fa: [70, 110], ba: [60, 100] },
      tuck: { fa: [10, 80], ba: [0, 70] },
      fall: { fa: [60, 30], ba: [110, 70] },
      land: { fa: [-30, 30], ba: [-60, 10] },
      hit: { fa: [80, 140], ba: [110, 160] },
      parry: { fa: [48, 108], ba: [36, 100] },
      slump: { fa: [-100, -80], ba: [-110, -90] },
      topple: { fa: [-40, -20], ba: [-60, -30] },
      dead: { fa: [-75, -70], ba: [-105, -110] },
    },
    attacks: (G) => ({
      a1: {
        label: "Attack 1: jab",
        dur: 0.34,
        frames: 4,
        keys: [
          [0, G],
          [0.12, P(G, { fa: [-45, 80], lean: 8 })],
          [0.32, P(G, { fa: [6, 4], lean: 20, x: 8, ba: [-20, 100] })],
          [0.55, P(G, { fa: [8, 12], lean: 18, x: 9 })],
          [1, P(G, { x: 9 })],
        ],
        events: [[0.32, "impact"]],
        trails: [[0.18, 0.45, 0]],
      },
      a2: {
        label: "Attack 2: cross",
        dur: 0.4,
        frames: 4,
        keys: [
          [0, G],
          [0.14, P(G, { ba: [-50, 80], lean: 4 })],
          [0.36, P(G, { ba: [4, 2], fa: [40, 120], lean: 26, x: 12 })],
          [0.6, P(G, { ba: [6, 10], lean: 24, x: 13 })],
          [1, P(G, { x: 13 })],
        ],
        events: [[0.36, "impact"]],
        trails: [[0.18, 0.5, 1]],
      },
      a3: {
        label: "Attack 3: uppercut",
        dur: 0.5,
        frames: 4,
        keys: [
          [0, G],
          [0.18, P(G, { legs: [-48, -100], lean: 26, fa: [-70, -10] })],
          [0.4, P(G, { legs: [-80, -92], lean: -6, fa: [78, 95], x: 10, y: 6 })],
          [0.62, P(G, { lean: -4, fa: [85, 100], x: 12 })],
          [1, P(G, { x: 12 })],
        ],
        events: [[0.4, "impact"]],
        trails: [[0.22, 0.55, 0]],
      },
      a4: {
        label: "Attack 4: flying knee",
        dur: 0.62,
        frames: 5,
        keys: [
          [0, G],
          [0.16, P(G, { legs: [-45, -102], lean: 20, fa: [-60, 10], ba: [-80, 0] })],
          [0.4, P(G, { air: 1, y: 40, x: 50, lean: 10, fl: [22, -60], bl: [-110, -150], fa: [10, 80], ba: [60, 110] })],
          [
            0.56,
            P(G, { air: 1, y: 24, x: 70, lean: 14, fl: [15, -70], bl: [-100, -140], fa: [10, 80], ba: [60, 110] }),
          ],
          [0.74, P(G, { legs: [-48, -104], lean: 18, x: 80, sq: 0.05 })],
          [1, P(G, { x: 82 })],
        ],
        events: [
          [0.14, "dust"],
          [0.42, "impact"],
          [0.74, "land"],
        ],
        trails: [[0.3, 0.5, 0]],
        ghosts: [0.2, 0.6],
      },
      taunt: {
        label: "Taunt: come on",
        dur: 1.3,
        frames: 4,
        keys: [
          [0, G],
          [0.15, P(G, { lean: -2, fa: [5, 40], ba: [-130, -40] })],
          [0.3, P(G, { lean: -2, fa: [5, 100], ba: [-130, -40] })],
          [0.45, P(G, { lean: -2, fa: [5, 40], ba: [-130, -40] })],
          [0.6, P(G, { lean: -2, fa: [5, 100], ba: [-130, -40] })],
          [0.8, P(G, { lean: -6, fa: [-20, 90], ba: [-40, 95] })],
          [1, G],
        ],
      },
    }),
    combo: ["a1", "a2", "a1", "a2", "a3", "a4"],
  };

  W.sword = {
    name: "Sword",
    tier: "",
    reach: 150,
    heavy: 0,
    lean: 16,
    legs: [-56, -98],
    arms: {
      guard: { fa: [-55, -15], w: -28, ba: [-110, -75] },
      guard2: { fa: [-58, -20], w: -33, ba: [-112, -78] },
      runA: { fa: [-130, -150], w: -165, ba: [-40, 30] },
      runB: { fa: [-105, -125], w: -160, ba: [-125, -60] },
      dash: { fa: [-150, -170], w: -176, ba: [-150, -150] },
      up: { fa: [40, 70], w: 60, ba: [80, 110] },
      tuck: { fa: [0, 30], w: 40, ba: [40, 80] },
      fall: { fa: [20, 0], w: -20, ba: [110, 70] },
      land: { fa: [-60, -20], w: -40, ba: [-80, -20] },
      hit: { fa: [60, 120], w: 150, ba: [-195, -150] },
      parry: { fa: [20, 95], w: 92, ba: [-10, 85] },
      slump: { fa: [-95, -85], w: -15, ba: [-110, -90] },
      topple: { fa: [-30, -20], w: 30, ba: [-60, -40] },
      dead: { fa: [-70, -60], w: 92, ba: [-110, -120] },
    },
    attacks: (G) => ({
      a1: {
        label: "Attack 1: light slash",
        dur: 0.42,
        frames: 4,
        keys: [
          [0, G],
          [0.2, P(G, { lean: 4, fa: [130, 165], w: 160, ba: [-60, 30] })],
          [0.42, P(G, { lean: 24, x: 14, fa: [2, 6], w: 6, ba: [-140, -100] })],
          [0.62, P(G, { lean: 22, x: 16, fa: [-25, -30], w: -38, ba: [-140, -100] })],
          [1, P(G, { x: 16 })],
        ],
        events: [[0.42, "impact"]],
        trails: [[0.24, 0.62, 0]],
      },
      a2: {
        label: "Attack 2: up slash",
        dur: 0.44,
        frames: 4,
        keys: [
          [0, G],
          [0.2, P(G, { lean: 26, legs: [-48, -102], fa: [-115, -135], w: -152, ba: [-60, 20] })],
          [0.44, P(G, { lean: -6, x: 10, legs: [-74, -93], fa: [70, 95], w: 100, ba: [-140, -110] })],
          [0.62, P(G, { lean: -8, x: 11, fa: [100, 120], w: 135 })],
          [1, P(G, { x: 11 })],
        ],
        events: [[0.44, "impact"]],
        trails: [[0.24, 0.62, 0]],
      },
      a3: {
        label: "Attack 3: down slash",
        dur: 0.5,
        frames: 4,
        keys: [
          [0, G],
          [0.24, P(G, { lean: -6, legs: [-70, -94], fa: [110, 130], w: 150, ba: [60, 100] })],
          [0.46, P(G, { lean: 34, x: 16, legs: [-44, -104], fa: [-15, -30], w: -42, ba: [-150, -120] })],
          [0.66, P(G, { lean: 30, x: 17, fa: [-22, -36], w: -50 })],
          [1, P(G, { x: 17 })],
        ],
        events: [
          [0.46, "impact"],
          [0.48, "slam"],
        ],
        trails: [[0.28, 0.6, 0]],
      },
      a4: {
        label: "Attack 4: forward thrust",
        dur: 0.55,
        frames: 5,
        keys: [
          [0, G],
          [0.24, P(G, { lean: 6, x: -6, fa: [-120, 10], w: 2, ba: [40, 60] })],
          [0.46, P(G, { lean: 30, x: 62, fl: [-30, -95], bl: [-132, -132], fa: [2, 0], w: 0, ba: [-190, -185] })],
          [0.66, P(G, { lean: 28, x: 66, fl: [-32, -95], bl: [-130, -130], fa: [4, 2], w: 0, ba: [165, 170] })],
          [1, P(G, { x: 66 })],
        ],
        events: [
          [0.42, "dust"],
          [0.46, "impact"],
        ],
        trails: [[0.3, 0.6, 0]],
        ghosts: [0.26, 0.56],
      },
      taunt: {
        label: "Taunt: flourish",
        dur: 1.4,
        frames: 4,
        keys: [
          [0, G],
          [0.22, P(G, { lean: 4, fa: [20, 25], w: 18, ba: [-120, -60] })],
          [0.42, P(G, { lean: 2, fa: [30, 40], w: 120, ba: [-120, -60] })],
          [0.62, P(G, { lean: 0, fa: [30, 40], w: 378, ba: [-120, -60] })],
          [0.82, P(G, { lean: -4, fa: [45, 145], w: 525, ba: [-110, -40] })],
          [1, P(G, { lean: -4, fa: [45, 145], w: 525, ba: [-110, -40] })],
        ],
      },
    }),
    combo: ["a1", "a2", "a3", "a1", "a2", "a4"],
  };

  W.dual = {
    name: "Dual blades",
    tier: "",
    reach: 115,
    heavy: 0,
    twoBlades: true,
    lean: 18,
    legs: [-58, -98],
    arms: {
      guard: { fa: [-50, -60], w: -70, ba: [-120, -70], w2: -100 },
      guard2: { fa: [-53, -64], w: -74, ba: [-123, -74], w2: -103 },
      runA: { fa: [-140, -160], w: -170, ba: [-150, -170], w2: -175 },
      runB: { fa: [-128, -150], w: -165, ba: [-140, -160], w2: -172 },
      dash: { fa: [-160, -170], w: -178, ba: [-165, -175], w2: -180 },
      up: { fa: [50, 80], w: 60, ba: [120, 150], w2: 150 },
      tuck: { fa: [-10, 30], w: 10, ba: [40, 90], w2: 120 },
      fall: { fa: [30, 0], w: -10, ba: [140, 110], w2: 150 },
      land: { fa: [-60, -40], w: -60, ba: [-100, -60], w2: -100 },
      hit: { fa: [70, 130], w: 160, ba: [120, 160], w2: 170 },
      parry: { fa: [30, 100], w: 140, ba: [45, 95], w2: 40 },
      slump: { fa: [-95, -85], w: -15, ba: [-100, -90], w2: -40 },
      topple: { fa: [-40, -30], w: 30, ba: [-60, -40], w2: 20 },
      dead: { fa: [-70, -60], w: 92, ba: [-110, -120], w2: -92 },
    },
    attacks: (G) => ({
      a1: {
        label: "Attack 1: left slash",
        dur: 0.38,
        frames: 4,
        keys: [
          [0, G],
          [0.16, P(G, { lean: 10, ba: [150, 170], w2: 170, fa: [-70, -30] })],
          [0.38, P(G, { lean: 24, x: 10, ba: [-5, -30], w2: -20, fa: [-90, -60] })],
          [0.6, P(G, { lean: 22, x: 11, ba: [-40, -70], w2: -80, fa: [-90, -60] })],
          [1, P(G, { x: 11 })],
        ],
        events: [[0.38, "impact"]],
        trails: [[0.2, 0.55, 1]],
      },
      a2: {
        label: "Attack 2: right slash",
        dur: 0.38,
        frames: 4,
        keys: [
          [0, G],
          [0.16, P(G, { lean: 10, fa: [130, 150], w: 160 })],
          [0.38, P(G, { lean: 24, x: 10, fa: [-10, -30], w: -30, ba: [-130, -80] })],
          [0.6, P(G, { lean: 22, x: 11, fa: [-40, -70], w: -90, ba: [-130, -80] })],
          [1, P(G, { x: 11 })],
        ],
        events: [[0.38, "impact"]],
        trails: [[0.2, 0.55, 0]],
      },
      a3: {
        label: "Attack 3: spin attack",
        dur: 0.7,
        frames: 4,
        keys: [
          [0, G],
          [0.15, P(G, { lean: 10, legs: [-52, -100], fa: [0, -5], w: -5, ba: [175, 180], w2: 185 })],
          [0.45, P(G, { turn: 180, lean: 4, x: 16, fa: [0, -5], w: -5, ba: [175, 180], w2: 185 })],
          [0.75, P(G, { turn: 360, lean: 8, x: 30, fa: [-10, -15], w: -20, ba: [175, 180], w2: 185 })],
          [1, P(G, { turn: 360, x: 30 })],
        ],
        events: [
          [0.4, "impact"],
          [0.72, "impact"],
        ],
        trails: [
          [0.12, 0.85, 0],
          [0.12, 0.85, 1],
        ],
      },
      a4: {
        label: "Attack 4: forward lunge",
        dur: 0.6,
        frames: 5,
        keys: [
          [0, G],
          [0.22, P(G, { lean: 12, x: -4, legs: [-50, -100], fa: [-140, -150], w: -170, ba: [-150, -160], w2: -175 })],
          [0.48, P(G, { lean: 30, x: 84, fl: [-30, -95], bl: [-132, -132], fa: [4, 0], w: 0, ba: [12, 6], w2: 6 })],
          [0.68, P(G, { lean: 28, x: 90, fl: [-32, -95], bl: [-130, -130], fa: [0, -10], w: -10, ba: [8, 0], w2: 0 })],
          [1, P(G, { x: 90 })],
        ],
        events: [
          [0.44, "dust"],
          [0.48, "impact"],
        ],
        trails: [
          [0.3, 0.6, 0],
          [0.3, 0.6, 1],
        ],
        ghosts: [0.28, 0.58],
      },
      taunt: {
        label: "Taunt: blade flip",
        dur: 1.3,
        frames: 4,
        keys: [
          [0, G],
          [0.2, P(G, { lean: 2, fa: [-60, -40], w: -50, ba: [-120, -80], w2: -110 })],
          [0.5, P(G, { lean: 2, fa: [-60, -40], w: 310, ba: [-120, -80], w2: 250 })],
          [0.72, P(G, { lean: -4, fa: [30, 90], w: 440, ba: [45, 95], w2: 400 })],
          [1, P(G, { lean: -4, fa: [30, 90], w: 440, ba: [45, 95], w2: 400 })],
        ],
      },
    }),
    combo: ["a1", "a2", "a1", "a2", "a3", "a4"],
  };

  // Crimson Veil: a braided whip held by its middle, a dagger tied to each end. The lashes are long (reach 150),
  // so every attack is a cast: a wind-up that cocks the arm, a snap that pulls the cord straight and puts the
  // dagger into the target, then a recoil that lets the cord fall slack again. w and w2 are the lash angles.
  W.lash = {
    name: "Dagger lash",
    tier: "Crimson Veil",
    reach: 150,
    heavy: 0,
    twoBlades: true,
    lean: 18,
    legs: [-58, -98],
    arms: Object.assign({}, W.dual.arms, {
      guard: { fa: [-50, -60], w: -78, ba: [-120, -70], w2: -104 },
      guard2: { fa: [-53, -64], w: -84, ba: [-123, -74], w2: -108 },
      hit: { fa: [70, 130], w: 150, ba: [120, 160], w2: 160 },
      parry: { fa: [40, 100], w: 20, ba: [50, 100], w2: 160 },
    }),
    attacks: (G) => ({
      a1: {
        label: "Attack 1: overhand lash",
        dur: 0.44,
        frames: 4,
        keys: [
          [0, G],
          [0.18, P(G, { lean: 4, x: -6, fa: [115, 140], w: 155, ba: [-70, -60], w2: -95 })],
          [0.36, P(G, { lean: 26, x: 14, fa: [-4, -14], w: -6, ba: [-70, -60], w2: -95 })],
          [0.58, P(G, { lean: 22, x: 16, fa: [-45, -60], w: -75, ba: [-70, -60], w2: -95 })],
          [1, P(G, { x: 16 })],
        ],
        events: [[0.36, "impact"]],
        trails: [[0.2, 0.52, 0]],
      },
      a2: {
        label: "Attack 2: backhand lash",
        dur: 0.44,
        frames: 4,
        keys: [
          [0, G],
          [0.18, P(G, { lean: 4, x: -6, fa: [-60, -50], w: -80, ba: [150, 172], w2: 172 })],
          [0.36, P(G, { lean: 26, x: 14, fa: [-60, -50], w: -80, ba: [-6, -16], w2: -8 })],
          [0.58, P(G, { lean: 22, x: 16, fa: [-60, -50], w: -80, ba: [-40, -70], w2: -80 })],
          [1, P(G, { x: 16 })],
        ],
        events: [[0.36, "impact"]],
        trails: [[0.2, 0.52, 1]],
      },
      a3: {
        label: "Attack 3: crossing snap",
        dur: 0.7,
        frames: 5,
        hitType: "hitHeavy",
        keys: [
          [0, G],
          [0.14, P(G, { lean: 6, x: -4, fa: [100, 125], w: 140, ba: [-40, -50], w2: -60 })],
          [0.3, P(G, { lean: 24, x: 12, fa: [-32, -48], w: -34, ba: [150, 165], w2: 168 })],
          [0.42, P(G, { lean: 14, x: 12, fa: [-60, -70], w: -85, ba: [160, 175], w2: 178 })],
          [0.58, P(G, { lean: 26, x: 22, fa: [-60, -70], w: -85, ba: [24, 36], w2: 30 })],
          [0.8, P(G, { lean: 22, x: 24, ba: [-30, -60], w2: -70 })],
          [1, P(G, { x: 24 })],
        ],
        events: [
          [0.3, "impact"],
          [0.58, "impact"],
        ],
        trails: [
          [0.16, 0.42, 0],
          [0.42, 0.7, 1],
        ],
      },
      a4: {
        label: "Attack 4: whirling lash",
        dur: 0.8,
        frames: 5,
        hitType: "knockdown",
        keys: [
          [0, G],
          [0.16, P(G, { lean: 10, legs: [-52, -100], fa: [0, -6], w: -4, ba: [175, 180], w2: 184 })],
          [0.46, P(G, { turn: 180, lean: 4, x: 22, fa: [0, -6], w: -4, ba: [175, 180], w2: 184 })],
          [0.78, P(G, { turn: 360, lean: 8, x: 44, fa: [-6, -12], w: -12, ba: [172, 176], w2: 180 })],
          [1, P(G, { turn: 360, x: 44 })],
        ],
        events: [
          [0.42, "impact"],
          [0.76, "impact"],
        ],
        trails: [
          [0.12, 0.88, 0],
          [0.12, 0.88, 1],
        ],
        ghosts: [0.14, 0.8],
      },
      taunt: {
        label: "Taunt: lash twirl",
        dur: 1.5,
        frames: 4,
        keys: [
          [0, G],
          [0.2, P(G, { lean: 2, fa: [60, 70], w: 90, ba: [-120, -80], w2: -110 })],
          [0.62, P(G, { lean: 0, fa: [60, 70], w: 810, ba: [-120, -80], w2: -110 })],
          [0.82, P(G, { lean: -4, fa: [30, 90], w: 800, ba: [45, 95], w2: 400 })],
          [1, P(G, { lean: -4, fa: [30, 90], w: 800, ba: [45, 95], w2: 400 })],
        ],
      },
    }),
    combo: ["a1", "a2", "a3", "a1", "a2", "a4"],
  };

  W.spear = {
    name: "Spear",
    tier: "Bo staff in the game",
    reach: 205,
    heavy: 0,
    lean: 12,
    legs: [-60, -96],
    arms: {
      guard: { fa: [-30, -8], w: 12, grip: 44 },
      guard2: { fa: [-33, -11], w: 9, grip: 44 },
      runA: { fa: [-50, -30], w: 8, grip: 40 },
      runB: { fa: [-44, -24], w: 13, grip: 40 },
      dash: { fa: [-60, -10], w: 0, grip: 40 },
      up: { fa: [40, 60], w: 40, grip: 44 },
      tuck: { fa: [0, 20], w: 20, grip: 44 },
      fall: { fa: [-10, -20], w: -10, grip: 44 },
      land: { fa: [-50, -30], w: -15, grip: 44 },
      hit: { fa: [50, 90], w: 70, grip: 40 },
      parry: { fa: [20, 80], w: 80, grip: 44 },
      slump: { fa: [-80, -70], w: -15, grip: 44 },
      topple: { fa: [-40, -20], w: 30, grip: 30 },
      dead: { fa: [-60, -40], w: 92, grip: 30 },
    },
    attacks: (G) => ({
      a1: {
        label: "Attack 1: thrust",
        dur: 0.42,
        frames: 4,
        keys: [
          [0, G],
          [0.18, P(G, { lean: 6, x: -6, fa: [-110, -10], w: 6 })],
          [0.4, P(G, { lean: 24, x: 40, fl: [-38, -96], bl: [-128, -125], fa: [-2, 2], w: 2 })],
          [0.6, P(G, { lean: 22, x: 42, fa: [-4, 0], w: 3 })],
          [1, P(G, { x: 42 })],
        ],
        events: [[0.4, "impact"]],
        trails: [[0.22, 0.55, 0]],
      },
      a2: {
        label: "Attack 2: low sweep",
        dur: 0.5,
        frames: 4,
        keys: [
          [0, G],
          [0.2, P(G, { lean: 4, fa: [30, 60], w: 55 })],
          [0.45, P(G, { lean: 28, x: 12, legs: [-46, -102], fa: [-45, -30], w: -20 })],
          [0.65, P(G, { lean: 26, x: 13, legs: [-46, -102], fa: [-55, -40], w: -27 })],
          [1, P(G, { x: 13 })],
        ],
        events: [[0.45, "impact"]],
        trails: [[0.22, 0.62, 0]],
      },
      a3: {
        label: "Attack 3: overhead slam",
        dur: 0.55,
        frames: 4,
        keys: [
          [0, G],
          [0.25, P(G, { lean: -6, legs: [-70, -94], fa: [100, 125], w: 140 })],
          [0.5, P(G, { lean: 32, x: 18, legs: [-44, -104], fa: [-20, -30], w: -25 })],
          [0.68, P(G, { lean: 30, x: 19, fa: [-30, -40], w: -32 })],
          [1, P(G, { x: 19 })],
        ],
        events: [
          [0.5, "impact"],
          [0.52, "slam"],
        ],
        trails: [[0.28, 0.6, 0]],
      },
      a4: {
        label: "Attack 4: forward lunge",
        dur: 0.6,
        frames: 5,
        keys: [
          [0, G],
          [0.22, P(G, { lean: 10, x: -8, legs: [-52, -100], fa: [-130, -20], w: 4 })],
          [0.48, P(G, { lean: 32, x: 100, fl: [-28, -95], bl: [-133, -133], fa: [0, 0], w: 0 })],
          [0.7, P(G, { lean: 30, x: 104, fl: [-30, -95], bl: [-131, -131], fa: [2, 2], w: 1 })],
          [1, P(G, { x: 104 })],
        ],
        events: [
          [0.44, "dust"],
          [0.48, "impact"],
        ],
        trails: [[0.3, 0.6, 0]],
        ghosts: [0.28, 0.58],
      },
      taunt: {
        label: "Taunt: twirl",
        dur: 1.4,
        frames: 4,
        keys: [
          [0, G],
          [0.2, P(G, { lean: 0, fa: [50, 60], w: 90, grip: 6 })],
          [0.65, P(G, { lean: 0, fa: [50, 60], w: 810, grip: 6 })],
          [0.85, P(G, { lean: -4, fa: [-20, 0], w: 810, grip: 6 })],
          [1, P(G, { lean: -4, fa: [-20, 0], w: 810, grip: 6 })],
        ],
      },
    }),
    combo: ["a1", "a2", "a1", "a3", "a2", "a4"],
  };

  W.hammer = {
    name: "Hammer",
    tier: "Greatsword in the game",
    reach: 175,
    heavy: 1,
    lean: 22,
    legs: [-54, -99],
    arms: {
      guard: { fa: [-62, -45], w: -40, grip: 36 },
      guard2: { fa: [-65, -48], w: -42, grip: 36 },
      runA: { fa: [-60, -40], w: -24, grip: 40 },
      runB: { fa: [-55, -35], w: -20, grip: 40 },
      dash: { fa: [-70, -30], w: -20, grip: 40 },
      up: { fa: [70, 90], w: 100, grip: 42 },
      tuck: { fa: [30, 50], w: 60, grip: 42 },
      fall: { fa: [10, -10], w: -30, grip: 42 },
      land: { fa: [-60, -50], w: -30, grip: 42 },
      hit: { fa: [40, 80], w: 80, grip: 40 },
      parry: { fa: [10, 70], w: 95, grip: 40 },
      slump: { fa: [-85, -80], w: -15, grip: 40 },
      topple: { fa: [-50, -40], w: 30, grip: 30 },
      dead: { fa: [-70, -60], w: 92, grip: 30 },
    },
    attacks: (G) => ({
      a1: {
        label: "Attack 1: horizontal swing",
        dur: 0.7,
        frames: 4,
        keys: [
          [0, G],
          [0.3, P(G, { lean: 2, legs: [-60, -96], fa: [-150, -165], w: -185 })],
          [0.5, P(G, { lean: 26, x: 14, fa: [-5, 0], w: 5 })],
          [0.7, P(G, { lean: 20, x: 16, fa: [60, 80], w: 100 })],
          [1, P(G, { x: 16 })],
        ],
        events: [[0.5, "impact"]],
        trails: [[0.32, 0.72, 0]],
      },
      a2: {
        label: "Attack 2: overhead smash",
        dur: 0.8,
        frames: 4,
        keys: [
          [0, G],
          [0.36, P(G, { lean: -10, legs: [-72, -93], fa: [100, 125], w: 125 })],
          [0.56, P(G, { lean: 38, x: 20, legs: [-42, -104], fa: [-40, -48], w: -34 })],
          [0.75, P(G, { lean: 36, x: 21, legs: [-42, -104], fa: [-42, -50], w: -36 })],
          [1, P(G, { x: 21 })],
        ],
        events: [
          [0.56, "impact"],
          [0.56, "slam"],
        ],
        trails: [[0.38, 0.6, 0]],
      },
      a3: {
        label: "Attack 3: upward swing",
        dur: 0.7,
        frames: 4,
        keys: [
          [0, G],
          [0.3, P(G, { lean: 30, legs: [-46, -102], fa: [-115, -125], w: -160 })],
          [0.5, P(G, { lean: -8, x: 10, legs: [-74, -93], fa: [85, 95], w: 95 })],
          [0.7, P(G, { lean: -10, x: 11, fa: [100, 115], w: 120 })],
          [1, P(G, { x: 11 })],
        ],
        events: [
          [0.3, "dust"],
          [0.5, "impact"],
        ],
        trails: [[0.32, 0.7, 0]],
      },
      a4: {
        label: "Attack 4: forward lunge",
        dur: 0.75,
        frames: 5,
        keys: [
          [0, G],
          [0.3, P(G, { lean: 10, x: -8, legs: [-52, -100], fa: [-130, -30], w: 0 })],
          [0.55, P(G, { lean: 30, x: 76, fl: [-30, -95], bl: [-132, -132], fa: [0, 0], w: 0 })],
          [0.75, P(G, { lean: 28, x: 80, fl: [-32, -95], bl: [-130, -130], fa: [2, 2], w: 0 })],
          [1, P(G, { x: 80 })],
        ],
        events: [
          [0.52, "dust"],
          [0.55, "impact"],
        ],
        trails: [[0.36, 0.66, 0]],
        ghosts: [0.34, 0.62],
      },
      taunt: {
        label: "Taunt: hammer high",
        dur: 1.5,
        frames: 4,
        keys: [
          [0, G],
          [0.3, P(G, { lean: 0, legs: [-68, -94], fa: [95, 95], w: 92 })],
          [0.55, P(G, { lean: -4, legs: [-66, -95], fa: [95, 95], w: 92 })],
          [0.78, P(G, { lean: -6, fa: [50, 140], w: 170 })],
          [1, P(G, { lean: -6, fa: [50, 140], w: 170 })],
        ],
      },
    }),
    combo: ["a1", "a3", "a1", "a3", "a2", "a4"],
  };

  W.scythe = {
    name: "Scythe",
    tier: "",
    reach: 190,
    heavy: 0,
    lean: 8,
    legs: [-64, -94],
    arms: {
      guard: { fa: [-60, -5], w: 80, grip: 50 },
      guard2: { fa: [-63, -8], w: 82, grip: 50 },
      runA: { fa: [-110, -80], w: 140, grip: 46 },
      runB: { fa: [-104, -74], w: 134, grip: 46 },
      dash: { fa: [-120, -90], w: 155, grip: 46 },
      up: { fa: [60, 90], w: 110, grip: 50 },
      tuck: { fa: [10, 40], w: 70, grip: 50 },
      fall: { fa: [20, 0], w: 40, grip: 50 },
      land: { fa: [-70, -20], w: 60, grip: 50 },
      hit: { fa: [60, 110], w: 120, grip: 46 },
      parry: { fa: [10, 60], w: 92, grip: 50 },
      slump: { fa: [-85, -80], w: -15, grip: 46 },
      topple: { fa: [-50, -30], w: 30, grip: 30 },
      dead: { fa: [-70, -60], w: 92, grip: 30 },
    },
    attacks: (G) => ({
      a1: {
        label: "Attack 1: horizontal slash",
        dur: 0.6,
        frames: 4,
        keys: [
          [0, G],
          [0.25, P(G, { lean: 0, fa: [40, 110], w: 160 })],
          [0.45, P(G, { lean: 26, x: 16, fa: [-5, 0], w: 8 })],
          [0.65, P(G, { lean: 22, x: 17, fa: [-40, -30], w: -40 })],
          [1, P(G, { x: 17 })],
        ],
        events: [[0.45, "impact"]],
        trails: [[0.26, 0.66, 0]],
      },
      a2: {
        label: "Attack 2: vertical slash",
        dur: 0.6,
        frames: 4,
        keys: [
          [0, G],
          [0.25, P(G, { lean: -8, legs: [-70, -94], fa: [95, 115], w: 120 })],
          [0.45, P(G, { lean: 30, x: 14, legs: [-46, -102], fa: [-15, -25], w: 10 })],
          [0.65, P(G, { lean: 28, x: 15, legs: [-46, -102], fa: [-30, -40], w: -10 })],
          [1, P(G, { x: 15 })],
        ],
        events: [[0.45, "impact"]],
        trails: [[0.26, 0.64, 0]],
      },
      a3: {
        label: "Attack 3: spin attack",
        dur: 0.9,
        frames: 4,
        keys: [
          [0, G],
          [0.15, P(G, { lean: 6, legs: [-56, -98], fa: [0, 0], w: 0, grip: 20 })],
          [0.5, P(G, { turn: 180, x: 14, lean: 6, legs: [-56, -98], fa: [0, 0], w: -20, grip: 20 })],
          [0.85, P(G, { turn: 360, x: 28, lean: 6, legs: [-56, -98], fa: [0, 0], w: -10, grip: 20 })],
          [1, P(G, { turn: 360, x: 28 })],
        ],
        events: [
          [0.45, "impact"],
          [0.8, "impact"],
        ],
        trails: [[0.12, 0.9, 0]],
      },
      a4: {
        label: "Attack 4: forward lunge",
        dur: 0.7,
        frames: 5,
        keys: [
          [0, G],
          [0.25, P(G, { lean: 8, x: -8, legs: [-52, -100], fa: [-130, -40], w: 20 })],
          [0.5, P(G, { lean: 30, x: 92, fl: [-28, -95], bl: [-133, -133], fa: [0, 0], w: 6 })],
          [0.72, P(G, { lean: 26, x: 96, fl: [-30, -95], bl: [-131, -131], fa: [-20, -30], w: -40 })],
          [1, P(G, { x: 96 })],
        ],
        events: [
          [0.46, "dust"],
          [0.5, "impact"],
        ],
        trails: [[0.32, 0.74, 0]],
        ghosts: [0.3, 0.6],
      },
      taunt: {
        label: "Taunt: reaper twirl",
        dur: 1.4,
        frames: 4,
        keys: [
          [0, G],
          [0.2, P(G, { lean: -2, fa: [70, 80], w: 90, grip: 10 })],
          [0.7, P(G, { lean: -2, fa: [70, 80], w: 810, grip: 10 })],
          [0.9, P(G, { lean: -6, fa: [-60, -5], w: 440, grip: 50 })],
          [1, P(G, { lean: -6, fa: [-60, -5], w: 440, grip: 50 })],
        ],
      },
    }),
    combo: ["a1", "a2", "a1", "a2", "a3", "a4"],
  };

  // ---------- Bare hands and sword: eased key clips built on each body's own guard ----------
  // Keys are [t, pose, ease]; the ease shapes the move from that key to the next: inout for the wind-up
  // (anticipation), snap for the strike, hold for the contact frames, inout for the recovery. `ft` places the
  // feet: [front x, back x, hip drop, front lift, back lift, front pitch, back pitch], x measured from where the
  // clip started, so planted feet stay planted while the root moves. A negative pitch lifts the heel.
  function maker(id, gender, prof) {
    const B = Move.bodyOf(gender, prof),
      St = Move.styleOf(gender, prof),
      G = Move.restPose(id, gender, prof);
    const H0 = G.y + B.hipBase,
      f0 = St.stance[0],
      b0 = St.stance[1];
    const pose = (spec) => {
      spec = Object.assign({}, spec);
      const ft = spec.ft;
      delete spec.ft;
      const p = P(G, spec);
      // The chest follows the lean: leaning into a strike curls the upper back further, leaning back arches it.
      if (spec.spine === undefined) p.spine = 0.45 * (p.lean - G.lean);
      const legsOwn = ["fl", "bl", "legs", "air", "fl0", "bl0"].some((k) => k in spec);
      if (ft) {
        const fp = ft[5] || 0,
          bp = ft[6] || 0,
          fl = ft[3] || 0,
          bl = ft[4] || 0;
        Object.assign(
          p,
          Move.legs(
            B,
            H0 + (ft[2] || 0),
            [ft[0] - p.x, Math.max(fl, Move.sole(B, fp))],
            [ft[1] - p.x, Math.max(bl, Move.sole(B, bp))],
            p.pel,
            fp,
            bp,
          ),
        );
        p._ft = { fx: ft[0], bx: ft[1], H: H0 + (ft[2] || 0), fl, bl, fp, bp };
      } else if (!legsOwn) {
        // No foot spec: the feet stand in the guard stance under the root.
        p._ft = { fx: f0 + p.x, bx: b0 + p.x, H: H0, fl: 0, bl: 0, fp: 0, bp: 0 };
      }
      return p;
    };
    const K = (t, spec, ease) => [t, pose(spec || {}), ease || "inout"];
    const HA = (B.thigh + B.shin) * 0.93;
    return {
      B,
      St,
      G,
      H0,
      f0,
      b0,
      K,
      pose,
      L: G.lean,
      M: gender === "M",
      GY: G.y,
      AY: HA - B.hipBase,
      lieY: 13 - B.hipBase,
    };
  }

  W.fists.moves = (m, A) => {
    const { K, f0, b0, L, M, GY, AY } = m;
    const C = {};
    C.a1 = M
      ? null
      : {
          label: "Attack 1: double jab",
          dur: 0.42,
          frames: 5,
          hitType: "hit",
          keys: [
            K(0, {}, "inout"),
            K(0.14, { fa: [-42, 62], lean: L - 2, chest: -2, ft: [f0, b0, -2] }, "snap"),
            K(0.28, { fa: [3, 3], lean: L + 6, chest: 6, pel: 2, x: 4, ft: [f0 + 8, b0, -3, 0, 0, 0, -10] }, "hold"),
            K(0.36, { fa: [3, 5], lean: L + 6, chest: 6, pel: 2, x: 4, ft: [f0 + 8, b0, -3, 0, 0, 0, -10] }, "inout"),
            K(0.46, { fa: [-38, 64], lean: L + 2, chest: 1, x: 5, ft: [f0 + 8, b0 + 2, -3] }, "snap"),
            K(
              0.6,
              { fa: [2, 2], lean: L + 8, chest: 7, pel: 2, x: 9, ft: [f0 + 16, b0 + 4, -5, 0, 0, 0, -14] },
              "hold",
            ),
            K(
              0.72,
              { fa: [1, 6], lean: L + 7, chest: 6, pel: 2, x: 9, ft: [f0 + 16, b0 + 4, -5, 0, 0, 0, -12] },
              "inout",
            ),
            K(1, { x: 9 }),
          ],
          events: [
            [0.28, "impact"],
            [0.6, "impact"],
          ],
          trails: [
            [0.18, 0.4, 0],
            [0.5, 0.74, 0],
          ],
        };
    if (M) {
      C.a1 = {
        label: "Attack 1: jab",
        dur: 0.3,
        frames: 4,
        hitType: "hit",
        keys: [
          K(0, {}, "inout"),
          K(0.22, { fa: [-44, 60], lean: L - 3, chest: -2, ft: [f0, b0, -2] }, "snap"),
          K(
            0.42,
            { fa: [3, 3], ba: [-62, 88], lean: L + 7, chest: 6, pel: 2, x: 6, ft: [f0 + 12, b0, -4, 0, 0, 0, -14] },
            "hold",
          ),
          K(
            0.6,
            { fa: [1, 6], ba: [-62, 88], lean: L + 6, chest: 5, pel: 2, x: 6, ft: [f0 + 12, b0, -4, 0, 0, 0, -12] },
            "inout",
          ),
          K(1, { x: 6 }),
        ],
        events: [[0.42, "impact"]],
        trails: [[0.28, 0.6, 0]],
      };
    }
    C.a2 = {
      label: "Attack 2: cross",
      dur: 0.38,
      frames: 4,
      hitType: "hit",
      keys: [
        K(0, {}, "inout"),
        K(0.24, { ba: [-74, 64], fa: [-46, 92], lean: L - 4, chest: 5, pel: 3, ft: [f0, b0, -3] }, "snap"),
        K(
          0.44,
          {
            ba: [4, 2],
            fa: [-52, 102],
            lean: L + 15,
            chest: -10,
            pel: -5,
            x: 10,
            ft: [f0 + 12, b0 + 4, -8, 0, 0, 0, -34],
          },
          "hold",
        ),
        K(
          0.62,
          {
            ba: [2, 6],
            fa: [-52, 102],
            lean: L + 14,
            chest: -9,
            pel: -5,
            x: 10,
            ft: [f0 + 12, b0 + 4, -8, 0, 0, 0, -30],
          },
          "inout",
        ),
        K(1, { x: 10 }),
      ],
      events: [[0.44, "impact"]],
      trails: [[0.3, 0.62, 1]],
    };
    C.a3 = {
      label: "Attack 3: uppercut",
      dur: 0.46,
      frames: 4,
      hitType: "hitHeavy",
      keys: [
        K(0, {}, "inout"),
        K(0.3, { fa: [-90, -28], ba: [-55, 86], lean: L + 18, chest: -4, pel: -2, ft: [f0, b0, -15] }, "snap"),
        K(
          0.5,
          {
            fa: [22, 84],
            ba: [-60, 80],
            lean: L - 12,
            head: -8,
            chest: 7,
            pel: 3,
            x: 8,
            ft: [f0 + 10, b0 + 4, 5, 0, 0, -16, -22],
          },
          "hold",
        ),
        K(
          0.68,
          {
            fa: [30, 92],
            ba: [-60, 80],
            lean: L - 11,
            head: -8,
            chest: 6,
            pel: 3,
            x: 8,
            ft: [f0 + 10, b0 + 4, 4, 0, 0, -12, -18],
          },
          "inout",
        ),
        K(1, { x: 8 }),
      ],
      events: [[0.5, "impact"]],
      trails: [[0.34, 0.64, 0]],
    };
    if (M) {
      C.a4 = {
        label: "Attack 4: flying knee",
        dur: 0.62,
        frames: 5,
        hitType: "knockdown",
        keys: [
          K(0, {}, "inout"),
          K(0.18, { lean: L + 16, fa: [-60, 10], ba: [-80, 0], chest: -3, ft: [f0, b0, -16] }, "snap"),
          K(
            0.42,
            {
              air: 1,
              y: GY + 44,
              x: 50,
              lean: L - 4,
              fl: [24, -62],
              bl: [-112, -150],
              ffa: -30,
              bfa: -50,
              fa: [8, 82],
              ba: [60, 112],
              chest: 5,
            },
            "out",
          ),
          K(
            0.58,
            {
              air: 1,
              y: GY + 26,
              x: 70,
              lean: L,
              fl: [12, -72],
              bl: [-104, -140],
              ffa: -20,
              bfa: -40,
              fa: [8, 82],
              ba: [60, 112],
            },
            "in",
          ),
          K(0.74, { x: 80, lean: L + 14, fa: [-40, 70], ft: [f0 + 80, b0 + 80, -16] }, "inout"),
          K(1, { x: 82 }),
        ],
        events: [
          [0.14, "dust"],
          [0.44, "impact"],
          [0.74, "land"],
        ],
        trails: [[0.3, 0.52, 0]],
        ghosts: [0.2, 0.6],
      };
      C.taunt = {
        label: "Taunt: come on",
        dur: 1.3,
        frames: 4,
        keys: [
          K(0, {}, "inout"),
          K(0.16, { lean: L - 10, fa: [6, 40], ba: [-130, -40], chest: -4, fo: 1 }, "inout"),
          K(0.3, { lean: L - 10, fa: [6, 104], ba: [-130, -40], chest: -4, fo: 1 }, "inout"),
          K(0.45, { lean: L - 10, fa: [6, 40], ba: [-130, -40], chest: -4, fo: 1 }, "inout"),
          K(0.6, { lean: L - 10, fa: [6, 104], ba: [-130, -40], chest: -4, fo: 1 }, "inout"),
          K(0.8, { lean: L - 14, fa: [-20, 92], ba: [-40, 96], head: -6 }, "inout"),
          K(1, {}),
        ],
      };
    } else {
      C.a4 = {
        label: "Attack 4: high kick",
        dur: 0.56,
        frames: 5,
        hitType: "knockdown",
        keys: [
          K(0, {}, "inout"),
          K(
            0.24,
            {
              air: 0,
              y: 0,
              lean: L - 10,
              fl: [30, -72],
              ffa: -40,
              fa: [-30, 82],
              ba: [-70, 60],
              chest: -5,
              pel: -3,
              bfa: -14,
            },
            "snap",
          ),
          K(
            0.44,
            {
              air: 0,
              y: 0,
              lean: L - 28,
              head: 8,
              fl: [58, 44],
              ffa: 30,
              fa: [-12, 58],
              ba: [-124, -60],
              chest: -8,
              pel: -5,
              bfa: -18,
              x: 4,
            },
            "hold",
          ),
          K(
            0.6,
            {
              air: 0,
              y: 0,
              lean: L - 26,
              head: 8,
              fl: [54, 36],
              ffa: 26,
              fa: [-12, 58],
              ba: [-124, -60],
              chest: -8,
              pel: -5,
              bfa: -16,
              x: 4,
            },
            "inout",
          ),
          K(0.8, { air: 0, y: 0, lean: L - 8, fl: [24, -76], ffa: -30, x: 4 }, "inout"),
          K(1, { x: 4 }),
        ],
        events: [[0.44, "impact"]],
        trails: [[0.3, 0.58, 0]],
      };
      C.taunt = {
        label: "Taunt: bring it",
        dur: 1.2,
        frames: 4,
        keys: [
          K(0, {}, "inout"),
          K(
            0.18,
            { lean: L - 8, fa: [34, 120], ba: [-84, 58], pel: 4, chest: -3, fo: 1, ft: [f0, b0, 3, 0, 0, 0, -20] },
            "inout",
          ),
          K(
            0.34,
            { lean: L - 8, fa: [34, 152], ba: [-84, 58], pel: 4, chest: -3, fo: 1, ft: [f0, b0, 3, 0, 0, 0, -20] },
            "inout",
          ),
          K(
            0.5,
            { lean: L - 8, fa: [34, 112], ba: [-84, 58], pel: 4, chest: -3, fo: 1, ft: [f0, b0, 3, 0, 0, 0, -20] },
            "inout",
          ),
          K(
            0.66,
            { lean: L - 8, fa: [34, 152], ba: [-84, 58], pel: 4, chest: -3, fo: 1, ft: [f0, b0, 3, 0, 0, 0, -20] },
            "inout",
          ),
          K(0.84, { lean: L - 2, fa: [-30, 76], ba: [-60, 84], pel: 2 }, "inout"),
          K(1, {}),
        ],
      };
    }
    // Air attack (one per jump): a flying side kick. y is relative to the jump height, added by the controller.
    C.air = {
      label: "Air attack: flying kick",
      dur: 0.46,
      frames: 4,
      air: true,
      hitType: "hitHeavy",
      keys: [
        K(
          0,
          { air: 1, y: AY, fl: [-10, -100], bl: [-55, -140], ffa: -30, bfa: -40, fa: [10, 84], ba: [-6, 76] },
          "snap",
        ),
        K(
          0.3,
          {
            air: 1,
            y: AY,
            lean: L - 22,
            fl: [-8, -6],
            bl: [-112, -152],
            ffa: 2,
            bfa: -40,
            fa: [24, 84],
            ba: [-70, 50],
          },
          "hold",
        ),
        K(
          0.62,
          {
            air: 1,
            y: AY,
            lean: L - 20,
            fl: [-10, -10],
            bl: [-110, -150],
            ffa: 0,
            bfa: -40,
            fa: [24, 84],
            ba: [-70, 50],
          },
          "inout",
        ),
        K(1, { air: 1, y: AY, fl: [-50, -96], bl: [-100, -106], ffa: -10, bfa: -20, fa: [42, 18], ba: [104, 66] }),
      ],
      events: [[0.32, "impact"]],
      trails: [],
    };
    // Idle breaks: short fidgets after standing still for a while.
    if (M) {
      C.idle1 = {
        label: "Idle break: shake out",
        dur: 2.0,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.15, { fa: [-86, -80], ba: [-96, -90], lean: L - 6, head: 8 }, "inout"),
          K(0.28, { fa: [-80, -66], ba: [-100, -96], lean: L - 6, head: 8 }, "linear"),
          K(0.36, { fa: [-90, -86], ba: [-92, -84], lean: L - 6, head: 8 }, "linear"),
          K(0.44, { fa: [-80, -66], ba: [-100, -96], lean: L - 6, head: 8 }, "linear"),
          K(0.52, { fa: [-90, -86], ba: [-92, -84], lean: L - 6, head: 8 }, "inout"),
          K(0.7, { fa: [-86, -80], ba: [-96, -90], lean: L - 4, head: -12 }, "inout"),
          K(1, {}),
        ],
      };
      C.idle2 = {
        label: "Idle break: neck roll",
        dur: 1.6,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.22, { head: 16, fa: [-44, 62], ba: [-64, 76] }, "inout"),
          K(0.45, { head: -16, fa: [-44, 62], ba: [-64, 76] }, "hold"),
          K(0.6, { head: -16, fa: [-44, 62], ba: [-64, 76] }, "inout"),
          K(1, {}),
        ],
      };
    } else {
      C.idle1 = {
        label: "Idle break: fix hair",
        dur: 1.8,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.22, { ba: [118, 12], bo: 1, lean: L - 4, head: -6 }, "inout"),
          K(0.4, { ba: [116, -14], bo: 1, lean: L - 4, head: -8 }, "inout"),
          K(0.58, { ba: [116, -14], bo: 1, lean: L - 4, head: -8 }, "inout"),
          K(1, {}),
        ],
      };
      C.idle2 = {
        label: "Idle break: bounce",
        dur: 1.2,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.16, { fa: [-30, 74], ba: [-52, 86], ft: [f0, b0, 5, 0, 0, -26, -26] }, "inout"),
          K(0.32, {}, "inout"),
          K(0.48, { fa: [-30, 74], ba: [-52, 86], ft: [f0, b0, 5, 0, 0, -26, -26] }, "inout"),
          K(0.64, {}, "inout"),
          K(1, {}),
        ],
      };
    }
    return C;
  };

  W.sword.moves = (m, A) => {
    const { K, f0, b0, L, M, AY } = m;
    const C = {};
    C.a1 = {
      label: "Attack 1: light slash",
      dur: 0.42,
      frames: 4,
      hitType: "hit",
      keys: [
        K(0, {}, "inout"),
        K(0.28, { fa: [96, 150], w: 158, ba: [-70, 20], lean: L - 6, chest: -5, pel: -2, ft: [f0, b0, 2] }, "snap"),
        K(
          0.5,
          {
            fa: [-8, -22],
            w: -34,
            ba: [-150, -110],
            lean: L + 18,
            chest: 7,
            pel: 3,
            x: 14,
            ft: [f0 + 18, b0 + 4, -8, 0, 0, 0, -22],
          },
          "hold",
        ),
        K(
          0.66,
          {
            fa: [-12, -28],
            w: -42,
            ba: [-150, -110],
            lean: L + 17,
            chest: 6,
            pel: 3,
            x: 14,
            ft: [f0 + 18, b0 + 4, -8, 0, 0, 0, -18],
          },
          "inout",
        ),
        K(1, { x: 14 }),
      ],
      events: [[0.46, "impact"]],
      trails: [[0.3, 0.62, 0]],
    };
    if (!M) {
      C.a1 = {
        label: "Attack 1: double slash",
        dur: 0.56,
        frames: 5,
        hitType: "hit",
        keys: [
          K(0, {}, "inout"),
          K(0.24, { fa: [96, 150], w: 158, ba: [-70, 20], lean: L - 5, chest: -4, ft: [f0, b0, 2] }, "snap"),
          K(
            0.4,
            {
              fa: [-8, -22],
              w: -34,
              ba: [-150, -110],
              lean: L + 14,
              chest: 6,
              pel: 3,
              x: 10,
              ft: [f0 + 12, b0 + 2, -6, 0, 0, 0, -16],
            },
            "hold",
          ),
          K(
            0.46,
            {
              fa: [-10, -26],
              w: -38,
              ba: [-150, -110],
              lean: L + 13,
              chest: 6,
              pel: 3,
              x: 10,
              ft: [f0 + 12, b0 + 2, -6, 0, 0, 0, -14],
            },
            "snap",
          ),
          K(
            0.66,
            {
              fa: [60, 92],
              w: 96,
              ba: [-150, -110],
              lean: L - 10,
              head: -5,
              chest: 4,
              x: 14,
              ft: [f0 + 18, b0 + 6, 2, 0, 0, -10, -20],
            },
            "hold",
          ),
          K(
            0.77,
            {
              fa: [64, 96],
              w: 104,
              ba: [-150, -110],
              lean: L - 9,
              head: -5,
              chest: 4,
              x: 14,
              ft: [f0 + 18, b0 + 6, 2, 0, 0, -8, -18],
            },
            "inout",
          ),
          K(1, { x: 14 }),
        ],
        events: [
          [0.37, "impact"],
          [0.62, "impact"],
        ],
        trails: [
          [0.26, 0.46, 0],
          [0.48, 0.72, 0],
        ],
      };
    }
    C.a2 = {
      label: "Attack 2: up slash",
      dur: 0.44,
      frames: 4,
      hitType: "hit",
      keys: [
        K(0, {}, "inout"),
        K(
          0.28,
          { fa: [-120, -140], w: -162, ba: [-60, 20], lean: L + 20, chest: -4, pel: -2, ft: [f0, b0, -12] },
          "snap",
        ),
        K(
          0.52,
          {
            fa: [66, 96],
            w: 104,
            ba: [-150, -110],
            lean: L - 14,
            head: -6,
            chest: 6,
            pel: 3,
            x: 10,
            ft: [f0 + 12, b0 + 4, 5, 0, 0, -14, -24],
          },
          "hold",
        ),
        K(
          0.68,
          {
            fa: [70, 100],
            w: 112,
            ba: [-150, -110],
            lean: L - 13,
            head: -6,
            chest: 5,
            pel: 3,
            x: 10,
            ft: [f0 + 12, b0 + 4, 4, 0, 0, -10, -20],
          },
          "inout",
        ),
        K(1, { x: 10 }),
      ],
      events: [[0.46, "impact"]],
      trails: [[0.3, 0.64, 0]],
    };
    if (M) {
      C.a3 = {
        label: "Attack 3: two-handed down slash",
        dur: 0.54,
        frames: 4,
        hitType: "hitHeavy",
        keys: [
          K(0, {}, "inout"),
          K(
            0.32,
            {
              fa: [108, 132],
              w: 168,
              ba: [64, 104],
              g2: 1,
              lean: L - 12,
              head: 4,
              chest: -4,
              pel: -2,
              ft: [f0, b0, 4],
            },
            "snap",
          ),
          K(
            0.54,
            {
              fa: [-18, -34],
              w: -48,
              ba: [-60, 10],
              g2: 1,
              lean: L + 30,
              chest: 6,
              pel: 4,
              x: 18,
              ft: [f0 + 22, b0 + 6, -20, 0, 0, 0, -24],
            },
            "hold",
          ),
          K(
            0.72,
            {
              fa: [-20, -38],
              w: -52,
              ba: [-64, 6],
              g2: 1,
              lean: L + 29,
              chest: 6,
              pel: 4,
              x: 18,
              ft: [f0 + 22, b0 + 6, -19, 0, 0, 0, -20],
            },
            "inout",
          ),
          K(1, { x: 18 }),
        ],
        events: [
          [0.5, "impact"],
          [0.54, "slam"],
        ],
        trails: [[0.34, 0.64, 0]],
      };
      C.taunt = {
        label: "Taunt: flourish",
        dur: 1.4,
        frames: 4,
        keys: [
          K(0, {}, "inout"),
          K(0.22, { lean: L - 4, fa: [20, 25], w: 18, ba: [-120, -60] }, "inout"),
          K(0.42, { lean: L - 6, fa: [30, 40], w: 120, ba: [-120, -60] }, "linear"),
          K(0.62, { lean: L - 8, fa: [30, 40], w: 378, ba: [-120, -60] }, "out"),
          K(0.82, { lean: L - 12, fa: [45, 145], w: 525, ba: [-110, -40], head: -6 }, "hold"),
          K(1, { lean: L - 12, fa: [45, 145], w: 525, ba: [-110, -40], head: -6 }),
        ],
      };
    } else {
      C.a3 = {
        label: "Attack 3: spin slash",
        dur: 0.6,
        frames: 4,
        hitType: "hitHeavy",
        keys: [
          K(0, {}, "inout"),
          K(
            0.2,
            { fa: [-30, -10], w: -10, ba: [-190, -185], lean: L + 6, chest: -6, pel: -3, ft: [f0, b0, -8] },
            "snap",
          ),
          K(
            0.5,
            { turn: 180, fa: [0, -4], w: -4, ba: [-190, -185], lean: L + 8, x: 16, ft: [f0 + 16, b0 + 16, -6] },
            "linear",
          ),
          K(
            0.76,
            { turn: 360, fa: [-6, -14], w: -20, ba: [-190, -185], lean: L + 12, x: 30, ft: [f0 + 30, b0 + 30, -10] },
            "out",
          ),
          K(1, { turn: 360, x: 30 }),
        ],
        events: [
          [0.45, "impact"],
          [0.72, "impact"],
        ],
        trails: [[0.14, 0.82, 0]],
      };
      C.taunt = {
        label: "Taunt: blade spin",
        dur: 1.3,
        frames: 4,
        keys: [
          K(0, {}, "inout"),
          K(0.2, { lean: L - 6, fa: [-60, -40], w: -50, ba: [-90, 70], pel: 4 }, "linear"),
          K(0.55, { lean: L - 6, fa: [-60, -40], w: 670, ba: [-90, 70], pel: 4 }, "out"),
          K(0.78, { lean: L - 10, fa: [-70, -60], w: 812, ba: [-60, 84], pel: 3, head: -5 }, "hold"),
          K(1, { lean: L - 10, fa: [-70, -60], w: 812, ba: [-60, 84], pel: 3, head: -5 }),
        ],
      };
    }
    C.a4 = {
      label: "Attack 4: forward thrust",
      dur: 0.55,
      frames: 5,
      hitType: "knockdown",
      keys: [
        K(0, {}, "inout"),
        K(0.3, { fa: [-140, 6], w: 4, ba: [30, 60], lean: L - 2, x: -6, chest: -8, pel: -3, ft: [f0, b0, -6] }, "snap"),
        K(
          0.48,
          {
            fa: [2, 0],
            w: 0,
            ba: [172, 176],
            lean: L + 26,
            chest: 10,
            pel: 6,
            x: 60,
            ft: [f0 + 90, b0 + 36, -18, 0, 0, 0, -30],
          },
          "hold",
        ),
        K(
          0.68,
          {
            fa: [4, 2],
            w: 1,
            ba: [168, 172],
            lean: L + 25,
            chest: 9,
            pel: 6,
            x: 62,
            ft: [f0 + 90, b0 + 36, -17, 0, 0, 0, -26],
          },
          "inout",
        ),
        K(1, { x: 66 }),
      ],
      events: [
        [0.44, "dust"],
        [0.48, "impact"],
      ],
      trails: [[0.34, 0.64, 0]],
      ghosts: [0.3, 0.6],
    };
    C.air = {
      label: "Air attack: aerial slash",
      dur: 0.44,
      frames: 4,
      air: true,
      hitType: "hitHeavy",
      keys: [
        K(
          0,
          { air: 1, y: AY, fl: [-10, -100], bl: [-55, -140], ffa: -30, bfa: -40, fa: [0, 30], w: 40, ba: [40, 82] },
          "inout",
        ),
        K(
          0.3,
          {
            air: 1,
            y: AY,
            lean: L - 10,
            fl: [-10, -100],
            bl: [-55, -140],
            ffa: -30,
            bfa: -40,
            fa: [100, 150],
            w: 160,
            ba: [-60, 30],
          },
          "snap",
        ),
        K(
          0.52,
          {
            air: 1,
            y: AY,
            lean: L + 22,
            fl: [-30, -96],
            bl: [-70, -130],
            ffa: -20,
            bfa: -30,
            fa: [-12, -28],
            w: -44,
            ba: [-150, -110],
          },
          "hold",
        ),
        K(
          0.7,
          {
            air: 1,
            y: AY,
            lean: L + 20,
            fl: [-32, -96],
            bl: [-72, -130],
            ffa: -20,
            bfa: -30,
            fa: [-14, -32],
            w: -48,
            ba: [-150, -110],
          },
          "inout",
        ),
        K(1, {
          air: 1,
          y: AY,
          fl: [-50, -96],
          bl: [-100, -106],
          ffa: -10,
          bfa: -20,
          fa: [20, 0],
          w: -18,
          ba: [-20, 30],
        }),
      ],
      events: [[0.48, "impact"]],
      trails: [[0.32, 0.72, 0]],
    };
    if (M) {
      C.idle1 = {
        label: "Idle break: blade on shoulder",
        dur: 2.2,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.25, { fa: [-40, 112], w: 166, ba: [-96, -60], lean: L - 6, head: -4 }, "inout"),
          K(0.75, { fa: [-38, 114], w: 168, ba: [-96, -60], lean: L - 7, head: -6 }, "inout"),
          K(1, {}),
        ],
      };
      C.idle2 = {
        label: "Idle break: check the edge",
        dur: 1.8,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.3, { fa: [-24, 70], w: 92, ba: [-34, 66], bo: 1, head: 8, lean: L - 4 }, "inout"),
          K(0.65, { fa: [-24, 72], w: 94, ba: [-34, 70], bo: 1, head: 10, lean: L - 4 }, "inout"),
          K(1, {}),
        ],
      };
    } else {
      C.idle1 = {
        label: "Idle break: blade twirl",
        dur: 1.4,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.2, { fa: [-40, 10], w: 30, ba: [-110, -60] }, "linear"),
          K(0.6, { fa: [-40, 10], w: 390, ba: [-110, -60] }, "out"),
          K(1, { w: 402 }),
        ],
      };
      C.idle2 = {
        label: "Idle break: stretch",
        dur: 1.6,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.35, { lean: L - 14, spine: -8, head: -10, ba: [140, 150], bo: 1, fa: [-30, 20], w: 50 }, "inout"),
          K(0.6, { lean: L - 14, spine: -8, head: -10, ba: [140, 150], bo: 1, fa: [-30, 20], w: 50 }, "inout"),
          K(1, {}),
        ],
      };
    }
    return C;
  };

  // ======================= Designed characters' weapons =======================
  // Two-handed weapons (bat, staff, axe) keep the back hand on the shaft by IK: `grip` is the distance
  // behind the front hand. Angles are absolute (0 forward, 90 up); w is the weapon angle.

  W.bat = {
    name: "Metal bat",
    tier: "",
    reach: 150,
    heavy: 0.5,
    arms: {
      hit: { fa: [40, 100], w: 140, grip: 12 },
      parry: { fa: [10, 80], w: 92, grip: 12 },
      slump: { fa: [-90, -80], w: -60, grip: 12 },
      topple: { fa: [-40, -20], w: 30, grip: 12 },
      dead: { fa: [-70, -60], w: 92, grip: 12 },
    },
    combo: ["a1", "a2", "a1", "a3", "a2", "a4"],
    moves: (m, A) => {
      const { K, f0, b0, L, AY } = m,
        C = {};
      C.a1 = {
        label: "Attack 1: chop swing",
        dur: 0.42,
        frames: 4,
        hitType: "hit",
        keys: [
          K(0, {}, "inout"),
          K(0.28, { fa: [-50, 76], w: 156, lean: L - 4, chest: -5, pel: -3, ft: [f0, b0, 0] }, "snap"),
          K(
            0.48,
            { fa: [-12, -8], w: -8, lean: L + 14, chest: 8, pel: 5, x: 10, ft: [f0 + 12, b0 + 2, -6, 0, 0, 0, -24] },
            "hold",
          ),
          K(
            0.62,
            { fa: [-16, -20], w: -40, lean: L + 13, chest: 9, pel: 5, x: 10, ft: [f0 + 12, b0 + 2, -6, 0, 0, 0, -20] },
            "inout",
          ),
          K(1, { x: 10 }),
        ],
        events: [[0.46, "impact"]],
        trails: [[0.32, 0.64, 0]],
      };
      C.a2 = {
        label: "Attack 2: rising swing",
        dur: 0.46,
        frames: 4,
        hitType: "hit",
        keys: [
          K(0, {}, "inout"),
          K(0.3, { fa: [-118, -136], w: -160, lean: L + 18, chest: -4, ft: [f0, b0, -12] }, "snap"),
          K(
            0.52,
            {
              fa: [62, 92],
              w: 104,
              lean: L - 12,
              head: -6,
              chest: 7,
              pel: 3,
              x: 8,
              ft: [f0 + 10, b0 + 4, 4, 0, 0, -12, -24],
            },
            "hold",
          ),
          K(
            0.68,
            {
              fa: [66, 96],
              w: 116,
              lean: L - 11,
              head: -6,
              chest: 6,
              pel: 3,
              x: 8,
              ft: [f0 + 10, b0 + 4, 3, 0, 0, -8, -20],
            },
            "inout",
          ),
          K(1, { x: 8 }),
        ],
        events: [[0.5, "impact"]],
        trails: [[0.34, 0.66, 0]],
      };
      C.a3 = {
        label: "Attack 3: home run swing",
        dur: 0.66,
        frames: 5,
        hitType: "hitHeavy",
        keys: [
          K(0, {}, "inout"),
          K(
            0.34,
            { fa: [-36, 84], w: 172, lean: L - 10, head: 4, chest: -8, pel: -5, ft: [f0 - 4, b0, 2, 7, 0, -20, 0] },
            "snap",
          ),
          K(
            0.52,
            { fa: [-2, -4], w: -4, lean: L + 10, chest: 10, pel: 7, x: 18, ft: [f0 + 22, b0 + 4, -10, 0, 0, 0, -36] },
            "out",
          ),
          K(
            0.66,
            {
              fa: [24, 70],
              w: 120,
              turn: 34,
              lean: L + 4,
              chest: 10,
              pel: 7,
              x: 20,
              ft: [f0 + 22, b0 + 6, -8, 0, 0, 0, -36],
            },
            "hold",
          ),
          K(
            0.78,
            {
              fa: [24, 70],
              w: 124,
              turn: 34,
              lean: L + 4,
              chest: 10,
              pel: 7,
              x: 20,
              ft: [f0 + 22, b0 + 6, -8, 0, 0, 0, -32],
            },
            "inout",
          ),
          K(1, { x: 22 }),
        ],
        events: [[0.5, "impact"]],
        trails: [[0.36, 0.66, 0]],
      };
      C.a4 = {
        label: "Attack 4: overhead slam",
        dur: 0.7,
        frames: 5,
        hitType: "knockdown",
        keys: [
          K(0, {}, "inout"),
          K(0.26, { fa: [96, 128], w: 150, lean: L - 12, head: 4, chest: -4, ft: [f0, b0, -14] }, "out"),
          K(
            0.42,
            {
              air: 1,
              y: m.GY + 26,
              x: 30,
              fa: [104, 132],
              w: 160,
              lean: L - 8,
              fl: [-10, -100],
              bl: [-100, -140],
              ffa: -30,
              bfa: -40,
            },
            "inout",
          ),
          K(0.6, { fa: [-30, -44], w: -64, lean: L + 34, chest: 8, x: 56, ft: [f0 + 60, b0 + 50, -22] }, "hold"),
          K(0.74, { fa: [-32, -46], w: -66, lean: L + 32, chest: 8, x: 56, ft: [f0 + 60, b0 + 50, -21] }, "inout"),
          K(1, { x: 56 }),
        ],
        events: [
          [0.2, "dust"],
          [0.58, "impact"],
          [0.6, "slam"],
          [0.6, "land"],
        ],
        trails: [[0.42, 0.62, 0]],
        ghosts: [0.3, 0.58],
      };
      C.air = {
        label: "Air attack: diving swing",
        dur: 0.44,
        frames: 4,
        air: true,
        hitType: "hitHeavy",
        keys: [
          K(0, { air: 1, y: AY, fl: [-10, -100], bl: [-55, -140], ffa: -30, bfa: -40, fa: [0, 72], w: 120 }, "inout"),
          K(
            0.3,
            {
              air: 1,
              y: AY,
              lean: L - 10,
              fl: [-10, -100],
              bl: [-55, -140],
              ffa: -30,
              bfa: -40,
              fa: [86, 124],
              w: 152,
            },
            "snap",
          ),
          K(
            0.52,
            {
              air: 1,
              y: AY,
              lean: L + 22,
              fl: [-30, -96],
              bl: [-70, -130],
              ffa: -20,
              bfa: -30,
              fa: [-16, -28],
              w: -40,
            },
            "hold",
          ),
          K(
            0.7,
            {
              air: 1,
              y: AY,
              lean: L + 20,
              fl: [-32, -96],
              bl: [-72, -130],
              ffa: -20,
              bfa: -30,
              fa: [-18, -30],
              w: -44,
            },
            "inout",
          ),
          K(1, { air: 1, y: AY, fl: [-50, -96], bl: [-100, -106], ffa: -10, bfa: -20, fa: [-20, 44], w: 100 }),
        ],
        events: [[0.48, "impact"]],
        trails: [[0.32, 0.72, 0]],
      };
      C.taunt = {
        label: "Taunt: call your shot",
        dur: 1.4,
        frames: 4,
        keys: [
          K(0, {}, "inout"),
          K(0.22, { fa: [-4, 4], w: 4, lean: L - 8, head: -8, chest: 4 }, "out"),
          K(0.55, { fa: [-4, 4], w: 4, lean: L - 8, head: -8, chest: 4 }, "inout"),
          K(0.78, { fa: [-70, 72], w: 152, lean: L - 6, head: -4 }, "inout"),
          K(1, {}),
        ],
      };
      C.idle1 = {
        label: "Idle break: bat tap",
        dur: 1.6,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.2, { fa: [-74, -64], w: -100, lean: L + 4 }, "inout"),
          K(0.34, { fa: [-72, -60], w: -94, lean: L + 4 }, "out"),
          K(0.46, { fa: [-74, -64], w: -100, lean: L + 4 }, "out"),
          K(0.58, { fa: [-72, -60], w: -94, lean: L + 4 }, "inout"),
          K(1, {}),
        ],
        events: [
          [0.33, "tap"],
          [0.57, "tap"],
        ],
      };
      C.idle2 = {
        label: "Idle break: neck crack",
        dur: 1.5,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.25, { fa: [-70, 72], w: 152, head: 16 }, "inout"),
          K(0.5, { fa: [-70, 72], w: 152, head: -16 }, "hold"),
          K(0.62, { fa: [-70, 72], w: 152, head: -16 }, "inout"),
          K(1, {}),
        ],
      };
      return C;
    },
  };

  W.staff = {
    name: "Battle staff",
    tier: "",
    reach: 200,
    heavy: 0,
    arms: {
      hit: { fa: [50, 90], w: 70, grip: 40 },
      parry: { fa: [20, 80], w: 80, grip: 44 },
      slump: { fa: [-80, -70], w: -15, grip: 44 },
      topple: { fa: [-40, -20], w: 30, grip: 30 },
      dead: { fa: [-60, -40], w: 92, grip: 30 },
    },
    combo: ["a1", "a2", "a1", "a3", "a2", "a4"],
    moves: (m, A) => {
      const { K, f0, b0, L, AY } = m,
        C = {};
      C.a1 = {
        label: "Attack 1: thrust",
        dur: 0.42,
        frames: 4,
        hitType: "hit",
        keys: [
          K(0, {}, "inout"),
          K(0.28, { fa: [-110, -12], w: 6, lean: L + 4, x: -4, chest: -6, pel: -3, ft: [f0 - 2, b0 - 4, -4] }, "snap"),
          K(
            0.46,
            { fa: [-2, 2], w: 2, lean: L + 20, chest: 8, pel: 5, x: 30, ft: [f0 + 44, b0 + 18, -12, 0, 0, 0, -26] },
            "hold",
          ),
          K(
            0.64,
            { fa: [-4, 0], w: 3, lean: L + 18, chest: 7, pel: 5, x: 32, ft: [f0 + 44, b0 + 20, -12, 0, 0, 0, -22] },
            "inout",
          ),
          K(1, { x: 34 }),
        ],
        events: [[0.44, "impact"]],
        trails: [[0.3, 0.6, 0]],
      };
      C.a2 = {
        label: "Attack 2: low sweep",
        dur: 0.5,
        frames: 4,
        hitType: "hit",
        keys: [
          K(0, {}, "inout"),
          K(0.28, { fa: [30, 62], w: 56, lean: L + 2, chest: -5, ft: [f0, b0, 0] }, "snap"),
          K(
            0.5,
            { fa: [-46, -32], w: -26, lean: L + 26, chest: 7, pel: 4, x: 12, ft: [f0 + 16, b0 + 2, -18, 0, 0, 0, -20] },
            "hold",
          ),
          K(
            0.68,
            { fa: [-56, -40], w: -32, lean: L + 24, chest: 6, pel: 4, x: 13, ft: [f0 + 16, b0 + 2, -17, 0, 0, 0, -16] },
            "inout",
          ),
          K(1, { x: 13 }),
        ],
        events: [[0.48, "impact"]],
        trails: [[0.3, 0.66, 0]],
      };
      C.a3 = {
        label: "Attack 3: twirl and strike",
        dur: 0.74,
        frames: 5,
        hitType: "hitHeavy",
        keys: [
          K(0, {}, "inout"),
          K(0.12, { fa: [40, 52], w: 30, grip: 8, lean: L - 4 }, "linear"),
          K(0.46, { fa: [40, 52], w: 390, grip: 8, lean: L - 4, ft: [f0, b0, 2] }, "linear"),
          K(0.56, { fa: [96, 120], w: 498, grip: 40, lean: L - 10, head: 4, chest: -4, ft: [f0, b0, 3] }, "snap"),
          K(
            0.7,
            {
              fa: [-24, -32],
              w: 340,
              grip: 44,
              lean: L + 26,
              chest: 8,
              pel: 4,
              x: 16,
              ft: [f0 + 20, b0 + 4, -14, 0, 0, 0, -24],
            },
            "hold",
          ),
          K(
            0.82,
            {
              fa: [-26, -34],
              w: 338,
              grip: 44,
              lean: L + 24,
              chest: 7,
              pel: 4,
              x: 16,
              ft: [f0 + 20, b0 + 4, -13, 0, 0, 0, -20],
            },
            "inout",
          ),
          K(1, { w: 378, x: 16 }),
        ],
        events: [
          [0.3, "whirl"],
          [0.68, "impact"],
        ],
        trails: [
          [0.14, 0.46, 0],
          [0.56, 0.74, 0],
        ],
      };
      C.a4 = {
        label: "Attack 4: vault kick",
        dur: 0.76,
        frames: 5,
        hitType: "knockdown",
        keys: [
          K(0, {}, "inout"),
          K(0.22, { fa: [-62, -60], w: -64, lean: L + 14, ft: [f0, b0, -12] }, "out"),
          K(
            0.44,
            {
              air: 1,
              y: m.GY + 34,
              x: 36,
              fa: [-80, -86],
              w: -90,
              lean: L - 18,
              fl: [22, 6],
              bl: [-30, -10],
              ffa: 10,
              bfa: 0,
            },
            "hold",
          ),
          K(
            0.56,
            {
              air: 1,
              y: m.GY + 30,
              x: 46,
              fa: [-84, -90],
              w: -94,
              lean: L - 16,
              fl: [20, 4],
              bl: [-28, -12],
              ffa: 10,
              bfa: 0,
            },
            "in",
          ),
          K(0.74, { x: 64, fa: [-30, 8], w: 18, lean: L + 12, ft: [f0 + 64, b0 + 64, -16] }, "inout"),
          K(1, { x: 64 }),
        ],
        events: [
          [0.2, "dust"],
          [0.44, "impact"],
          [0.74, "land"],
        ],
        trails: [],
        ghosts: [0.24, 0.62],
      };
      C.air = {
        label: "Air attack: aerial twirl",
        dur: 0.5,
        frames: 4,
        air: true,
        hitType: "hitHeavy",
        keys: [
          K(
            0,
            { air: 1, y: AY, fl: [-10, -100], bl: [-55, -140], ffa: -30, bfa: -40, fa: [20, 40], w: 30, grip: 8 },
            "linear",
          ),
          K(
            0.42,
            { air: 1, y: AY, fl: [-10, -100], bl: [-55, -140], ffa: -30, bfa: -40, fa: [60, 80], w: 390, grip: 8 },
            "snap",
          ),
          K(
            0.6,
            {
              air: 1,
              y: AY,
              lean: L + 20,
              fl: [-30, -96],
              bl: [-70, -130],
              ffa: -20,
              bfa: -30,
              fa: [-20, -30],
              w: 334,
              grip: 44,
            },
            "hold",
          ),
          K(
            0.76,
            {
              air: 1,
              y: AY,
              lean: L + 18,
              fl: [-32, -96],
              bl: [-72, -130],
              ffa: -20,
              bfa: -30,
              fa: [-22, -32],
              w: 332,
              grip: 44,
            },
            "inout",
          ),
          K(1, {
            air: 1,
            y: AY,
            fl: [-50, -96],
            bl: [-100, -106],
            ffa: -10,
            bfa: -20,
            fa: [-10, -20],
            w: 350,
            grip: 44,
          }),
        ],
        events: [[0.58, "impact"]],
        trails: [[0.1, 0.72, 0]],
      };
      C.taunt = {
        label: "Taunt: twirl and plant",
        dur: 1.5,
        frames: 4,
        keys: [
          K(0, {}, "inout"),
          K(0.14, { fa: [40, 52], w: 30, grip: 8 }, "linear"),
          K(0.62, { fa: [40, 52], w: 750, grip: 8, head: -4 }, "out"),
          K(0.8, { fa: [-76, -22], w: 812, grip: 26, lean: L - 6, head: -6 }, "hold"),
          K(1, { fa: [-76, -22], w: 812, grip: 26, lean: L - 6, head: -6 }),
        ],
      };
      C.idle1 = {
        label: "Idle break: lean on the staff",
        dur: 2.0,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.25, { fa: [-76, -22], w: 92, grip: 26, lean: L - 2, head: 8, pel: 4 }, "inout"),
          K(0.72, { fa: [-76, -20], w: 93, grip: 26, lean: L - 2, head: 10, pel: 4 }, "inout"),
          K(1, {}),
        ],
      };
      C.idle2 = {
        label: "Idle break: half twirl",
        dur: 1.3,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.2, { fa: [30, 44], w: 30, grip: 8 }, "inout"),
          K(0.55, { fa: [30, 44], w: 210, grip: 8 }, "inout"),
          K(0.8, { fa: [-30, 8], w: 198, grip: 46 }, "inout"),
          K(1, { w: 198 }),
        ],
      };
      return C;
    },
  };

  W.axe = {
    name: "Greataxe",
    tier: "",
    reach: 175,
    heavy: 1,
    arms: {
      hit: { fa: [40, 80], w: 80, grip: 40 },
      parry: { fa: [10, 70], w: 95, grip: 40 },
      slump: { fa: [-85, -80], w: -15, grip: 40 },
      topple: { fa: [-50, -40], w: 30, grip: 30 },
      dead: { fa: [-70, -60], w: 92, grip: 30 },
    },
    combo: ["a1", "a2", "a1", "a3", "a4"],
    moves: (m, A) => {
      const { K, f0, b0, L, AY } = m,
        C = {};
      C.a1 = {
        label: "Attack 1: cleave",
        dur: 0.6,
        frames: 4,
        hitType: "hit",
        keys: [
          K(0, {}, "inout"),
          K(0.36, { fa: [80, 120], w: 140, lean: L - 8, chest: -5, pel: -3, ft: [f0, b0, 2] }, "snap"),
          K(
            0.56,
            { fa: [-12, -30], w: -32, lean: L + 24, chest: 8, pel: 5, x: 16, ft: [f0 + 20, b0 + 4, -14, 0, 0, 0, -24] },
            "hold",
          ),
          K(
            0.72,
            { fa: [-16, -36], w: -40, lean: L + 22, chest: 7, pel: 5, x: 16, ft: [f0 + 20, b0 + 4, -13, 0, 0, 0, -20] },
            "inout",
          ),
          K(1, { x: 16 }),
        ],
        events: [[0.54, "impact"]],
        trails: [[0.4, 0.7, 0]],
      };
      C.a2 = {
        label: "Attack 2: upward reap",
        dur: 0.6,
        frames: 4,
        hitType: "hit",
        keys: [
          K(0, {}, "inout"),
          K(0.36, { fa: [-118, -130], w: -160, lean: L + 22, chest: -4, ft: [f0, b0, -16] }, "snap"),
          K(
            0.56,
            {
              fa: [70, 96],
              w: 100,
              lean: L - 10,
              head: -6,
              chest: 7,
              pel: 4,
              x: 10,
              ft: [f0 + 14, b0 + 4, 2, 0, 0, -12, -24],
            },
            "hold",
          ),
          K(
            0.72,
            {
              fa: [74, 100],
              w: 112,
              lean: L - 9,
              head: -6,
              chest: 6,
              pel: 4,
              x: 10,
              ft: [f0 + 14, b0 + 4, 1, 0, 0, -8, -20],
            },
            "inout",
          ),
          K(1, { x: 10 }),
        ],
        events: [[0.54, "impact"]],
        trails: [[0.4, 0.72, 0]],
      };
      C.a3 = {
        label: "Attack 3: overhead smash",
        dur: 0.86,
        frames: 5,
        hitType: "hitHeavy",
        keys: [
          K(0, {}, "inout"),
          K(0.4, { fa: [100, 124], w: 150, lean: L - 14, head: 4, chest: -6, ft: [f0, b0, 4] }, "hold"),
          K(0.48, { fa: [102, 126], w: 154, lean: L - 15, head: 4, chest: -6, ft: [f0, b0, 5] }, "snap"),
          K(
            0.62,
            { fa: [-40, -50], w: -42, lean: L + 38, chest: 8, pel: 4, x: 20, ft: [f0 + 26, b0 + 6, -24, 0, 0, 0, -26] },
            "hold",
          ),
          K(
            0.8,
            { fa: [-42, -52], w: -44, lean: L + 36, chest: 8, pel: 4, x: 20, ft: [f0 + 26, b0 + 6, -23, 0, 0, 0, -22] },
            "inout",
          ),
          K(1, { x: 20 }),
        ],
        events: [
          [0.6, "impact"],
          [0.62, "slam"],
          [0.62, "frost"],
        ],
        trails: [[0.48, 0.66, 0]],
      };
      C.a4 = {
        label: "Attack 4: leaping slam",
        dur: 0.96,
        frames: 5,
        hitType: "knockdown",
        keys: [
          K(0, {}, "inout"),
          K(0.22, { fa: [60, 96], w: 120, lean: L + 16, ft: [f0, b0, -20] }, "out"),
          K(
            0.46,
            {
              air: 1,
              y: m.GY + 52,
              x: 46,
              fa: [104, 126],
              w: 156,
              lean: L - 12,
              fl: [-4, -96],
              bl: [-96, -140],
              ffa: -30,
              bfa: -40,
            },
            "in",
          ),
          K(0.62, { fa: [-40, -52], w: -46, lean: L + 40, chest: 8, x: 84, ft: [f0 + 88, b0 + 76, -26] }, "hold"),
          K(0.82, { fa: [-42, -54], w: -48, lean: L + 38, chest: 8, x: 84, ft: [f0 + 88, b0 + 76, -25] }, "inout"),
          K(1, { x: 84 }),
        ],
        events: [
          [0.2, "dust"],
          [0.62, "impact"],
          [0.63, "slam"],
          [0.63, "land"],
          [0.63, "frost"],
        ],
        trails: [[0.48, 0.66, 0]],
        ghosts: [0.26, 0.62],
      };
      C.air = {
        label: "Air attack: falling chop",
        dur: 0.5,
        frames: 4,
        air: true,
        hitType: "hitHeavy",
        keys: [
          K(0, { air: 1, y: AY, fl: [-10, -100], bl: [-55, -140], ffa: -30, bfa: -40, fa: [20, 60], w: 80 }, "inout"),
          K(
            0.34,
            {
              air: 1,
              y: AY,
              lean: L - 12,
              fl: [-10, -100],
              bl: [-55, -140],
              ffa: -30,
              bfa: -40,
              fa: [100, 122],
              w: 150,
            },
            "snap",
          ),
          K(
            0.56,
            {
              air: 1,
              y: AY,
              lean: L + 24,
              fl: [-30, -96],
              bl: [-70, -130],
              ffa: -20,
              bfa: -30,
              fa: [-30, -42],
              w: -40,
            },
            "hold",
          ),
          K(
            0.74,
            {
              air: 1,
              y: AY,
              lean: L + 22,
              fl: [-32, -96],
              bl: [-72, -130],
              ffa: -20,
              bfa: -30,
              fa: [-32, -44],
              w: -42,
            },
            "inout",
          ),
          K(1, { air: 1, y: AY, fl: [-50, -96], bl: [-100, -106], ffa: -10, bfa: -20, fa: [0, -20], w: 20 }),
        ],
        events: [[0.52, "impact"]],
        trails: [[0.36, 0.72, 0]],
      };
      C.taunt = {
        label: "Taunt: war cry",
        dur: 1.6,
        frames: 4,
        keys: [
          K(0, {}, "inout"),
          K(0.25, { fa: [88, 94], w: 92, lean: L - 12, head: -16, spine: -8, ft: [f0 + 2, b0 - 2, -4] }, "out"),
          K(0.62, { fa: [90, 96], w: 92, lean: L - 14, head: -18, spine: -9, ft: [f0 + 2, b0 - 2, -5] }, "inout"),
          K(0.82, { fa: [-60, 72], w: 150, grip: 30, lean: L - 4 }, "inout"),
          K(1, {}),
        ],
        events: [[0.3, "roar"]],
      };
      C.idle1 = {
        label: "Idle break: rest the axe",
        dur: 2.2,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.28, { fa: [-62, -52], w: -72, lean: L + 4, head: 6 }, "inout"),
          K(0.72, { fa: [-62, -50], w: -71, lean: L + 3, head: 8 }, "inout"),
          K(1, {}),
        ],
        events: [[0.27, "tap"]],
      };
      C.idle2 = {
        label: "Idle break: shoulder roll",
        dur: 1.6,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.25, { fa: [-60, 72], w: 150, grip: 30, chest: 4, head: 10 }, "inout"),
          K(0.5, { fa: [-60, 72], w: 150, grip: 30, chest: -4, head: -10 }, "inout"),
          K(0.72, { fa: [-60, 72], w: 150, grip: 30 }, "inout"),
          K(1, {}),
        ],
      };
      return C;
    },
  };

  // Nova: a floating spell orb of blue fire (pose field o: [forward, height above the floor, size]). It hovers
  // over her front palm; she flings it, throws it as a blast and calls it back, and slams it into the floor.
  // `orb: true` on a clip: the orb is the striking point. `ranged: true`: no distance stretch in lock-on.
  W.flame = {
    name: "Spell orb",
    tier: "",
    reach: 190,
    heavy: 0.3,
    arms: Object.assign({}, W.fists.arms, {
      hit: { fa: [80, 140], ba: [110, 160], o: [8, 112, 0.85] },
      parry: { fa: [40, 100], ba: [36, 100], fo: 1, o: [46, 112, 1.25] },
      slump: { fa: [-100, -80], ba: [-110, -90], o: [26, 60, 0.6] },
      topple: { fa: [-40, -20], ba: [-60, -30], o: [20, 62, 0.45] },
      dead: { fa: [-75, -70], ba: [-105, -110], o: [4, 66, 0.2] },
    }),
    combo: ["a1", "a2", "a1", "a3", "a4"],
    moves: (m, A) => {
      const { K, f0, b0, L, AY } = m,
        C = {};
      C.a1 = {
        label: "Attack 1: orb jab",
        dur: 0.42,
        frames: 4,
        hitType: "hit",
        orb: true,
        keys: [
          K(0, {}, "inout"),
          K(
            0.2,
            { fa: [-44, 52], ba: [-70, 60], lean: L - 3, chest: -3, o: [22, 108, 0.85], ft: [f0, b0, -2] },
            "snap",
          ),
          K(
            0.4,
            {
              fa: [2, 4],
              fo: 1,
              ba: [-66, 70],
              lean: L + 7,
              chest: 6,
              pel: 2,
              x: 6,
              o: [104, 112, 1.1],
              ft: [f0 + 12, b0, -4, 0, 0, 0, -14],
            },
            "hold",
          ),
          K(
            0.56,
            {
              fa: [1, 6],
              fo: 1,
              ba: [-66, 70],
              lean: L + 6,
              chest: 5,
              pel: 2,
              x: 6,
              o: [98, 112, 1.05],
              ft: [f0 + 12, b0, -4, 0, 0, 0, -12],
            },
            "inout",
          ),
          K(1, { x: 6 }),
        ],
        events: [[0.4, "impact"]],
        trails: [[0.22, 0.58, 2]],
      };
      C.a2 = {
        label: "Attack 2: orb blast",
        dur: 0.7,
        frames: 5,
        hitType: "hit",
        orb: true,
        ranged: true,
        keys: [
          K(0, {}, "inout"),
          K(
            0.22,
            { fa: [-70, 80], fo: 1, ba: [-96, 40], lean: L - 6, chest: 6, pel: 3, o: [6, 110, 0.75], ft: [f0, b0, -4] },
            "snap",
          ),
          K(
            0.4,
            {
              fa: [4, 6],
              ba: [-8, -2],
              fo: 1,
              bo: 1,
              lean: L + 12,
              chest: -6,
              pel: -4,
              x: 8,
              o: [170, 112, 1.25],
              ft: [f0 + 12, b0 + 4, -8, 0, 0, 0, -26],
            },
            "hold",
          ),
          K(
            0.56,
            {
              fa: [4, 8],
              ba: [-8, 0],
              fo: 1,
              bo: 1,
              lean: L + 11,
              chest: -6,
              pel: -4,
              x: 8,
              o: [176, 114, 1.15],
              ft: [f0 + 12, b0 + 4, -8, 0, 0, 0, -22],
            },
            "out",
          ),
          K(0.84, { fa: [-30, 60], fo: 1, lean: L + 2, x: 8, o: [52, 104, 0.95], ft: [f0 + 12, b0 + 4, -3] }, "inout"),
          K(1, { x: 8 }),
        ],
        events: [
          [0.4, "impact"],
          [0.4, "blast"],
        ],
        trails: [
          [0.22, 0.46, 2],
          [0.58, 0.9, 2],
        ],
      };
      C.a3 = {
        label: "Attack 3: orb pillar",
        dur: 0.8,
        frames: 5,
        hitType: "hitHeavy",
        orb: true,
        keys: [
          K(0, {}, "inout"),
          K(
            0.3,
            {
              fa: [84, 100],
              fo: 1,
              ba: [-60, 60],
              lean: L - 10,
              head: -8,
              chest: -4,
              o: [24, 176, 1.15],
              ft: [f0, b0, 2],
            },
            "hold",
          ),
          K(
            0.38,
            {
              fa: [86, 104],
              fo: 1,
              ba: [-60, 60],
              lean: L - 11,
              head: -9,
              chest: -4,
              o: [26, 182, 1.2],
              ft: [f0, b0, 3],
            },
            "snap",
          ),
          K(
            0.54,
            {
              fa: [-34, -20],
              fo: 1,
              ba: [-70, 50],
              lean: L + 20,
              chest: 8,
              pel: 3,
              x: 10,
              o: [112, 22, 1.3],
              ft: [f0 + 14, b0 + 4, -12, 0, 0, 0, -22],
            },
            "hold",
          ),
          K(
            0.74,
            {
              fa: [-36, -22],
              fo: 1,
              ba: [-70, 50],
              lean: L + 19,
              chest: 7,
              pel: 3,
              x: 10,
              o: [110, 24, 1.22],
              ft: [f0 + 14, b0 + 4, -11, 0, 0, 0, -18],
            },
            "inout",
          ),
          K(1, { x: 10 }),
        ],
        events: [
          [0.54, "impact"],
          [0.54, "slam"],
          [0.55, "pillar"],
        ],
        trails: [[0.36, 0.6, 2]],
      };
      C.a4 = {
        label: "Attack 4: comet",
        dur: 0.96,
        frames: 5,
        hitType: "knockdown",
        orb: true,
        ranged: true,
        keys: [
          K(0, {}, "inout"),
          K(
            0.3,
            { fa: [-60, 70], ba: [-50, 80], fo: 1, bo: 1, lean: L - 8, chest: 4, o: [-6, 104, 0.7], ft: [f0, b0, -10] },
            "inout",
          ),
          K(
            0.46,
            { fa: [-56, 74], ba: [-46, 84], fo: 1, bo: 1, lean: L - 9, chest: 4, o: [-4, 106, 1.7], ft: [f0, b0, -11] },
            "snap",
          ),
          K(
            0.6,
            {
              fa: [2, 4],
              ba: [-4, 2],
              fo: 1,
              bo: 1,
              lean: L + 16,
              chest: -4,
              x: 12,
              o: [182, 108, 1.9],
              ft: [f0 + 18, b0 + 6, -12, 0, 0, 0, -30],
            },
            "hold",
          ),
          K(
            0.76,
            {
              fa: [2, 6],
              ba: [-4, 4],
              fo: 1,
              bo: 1,
              lean: L + 15,
              chest: -4,
              x: 12,
              o: [188, 110, 1.4],
              ft: [f0 + 18, b0 + 6, -11, 0, 0, 0, -26],
            },
            "out",
          ),
          K(1, { x: 12, o: [44, 102, 1] }),
        ],
        events: [
          [0.12, "flare"],
          [0.44, "flare"],
          [0.6, "impact"],
          [0.6, "blast"],
          [0.61, "slam"],
        ],
        trails: [[0.46, 0.66, 2]],
        ghosts: [0.46, 0.66],
      };
      C.air = {
        label: "Air attack: orb drop",
        dur: 0.5,
        frames: 4,
        air: true,
        hitType: "hitHeavy",
        orb: true,
        keys: [
          K(
            0,
            {
              air: 1,
              y: AY,
              fl: [-10, -100],
              bl: [-55, -140],
              ffa: -30,
              bfa: -40,
              fa: [70, 110],
              fo: 1,
              ba: [60, 100],
              o: [16, 150 + AY, 1],
            },
            "snap",
          ),
          K(
            0.32,
            {
              air: 1,
              y: AY,
              lean: L + 16,
              fl: [-20, -100],
              bl: [-70, -130],
              ffa: -20,
              bfa: -30,
              fa: [-40, -30],
              fo: 1,
              ba: [-50, -20],
              o: [96, 40 + AY, 1.3],
            },
            "hold",
          ),
          K(
            0.6,
            {
              air: 1,
              y: AY,
              lean: L + 14,
              fl: [-22, -100],
              bl: [-72, -130],
              ffa: -20,
              bfa: -30,
              fa: [-40, -30],
              fo: 1,
              ba: [-50, -20],
              o: [92, 44 + AY, 1.2],
            },
            "inout",
          ),
          K(1, {
            air: 1,
            y: AY,
            fl: [-50, -96],
            bl: [-100, -106],
            ffa: -10,
            bfa: -20,
            fa: [42, 18],
            ba: [104, 66],
            o: [34, 96 + AY, 1],
          }),
        ],
        events: [
          [0.32, "impact"],
          [0.32, "blast"],
        ],
        trails: [[0.04, 0.4, 2]],
      };
      // Taunt: the orb circles her raised palm.
      const ring = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ring.push(
          K(
            0.16 + 0.6 * (i / 8),
            {
              fa: [40, 96],
              fo: 1,
              ba: [-70, 50],
              lean: L - 8,
              head: -6,
              pel: 4,
              o: [30 + 28 * Math.cos(a), 156 + 22 * Math.sin(a), 1 + 0.15 * Math.sin(a * 2)],
              ft: [f0, b0, 3, 0, 0, 0, -16],
            },
            "linear",
          ),
        );
      }
      C.taunt = {
        label: "Taunt: orbit",
        dur: 1.6,
        frames: 4,
        keys: [K(0, {}, "inout")].concat(ring, [K(1, {})]),
        events: [
          [0.2, "flare"],
          [0.76, "flare"],
        ],
      };
      C.idle1 = {
        label: "Idle break: orb toss",
        dur: 1.8,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.18, { fa: [-30, 40], fo: 1, o: [34, 92, 1] }, "out"),
          K(0.42, { fa: [-10, 70], fo: 1, head: 16, o: [36, 176, 0.9] }, "in"),
          K(0.64, { fa: [-30, 40], fo: 1, head: 2, o: [34, 96, 1] }, "out"),
          K(1, {}),
        ],
        events: [[0.2, "flare"]],
      };
      C.idle2 = {
        label: "Idle break: orb spin",
        dur: 1.6,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.25, { fa: [-20, 60], fo: 1, head: -8, o: [52, 116, 0.8] }, "inout"),
          K(0.5, { fa: [-20, 60], fo: 1, head: -8, o: [30, 132, 1.25] }, "inout"),
          K(0.75, { fa: [-20, 60], fo: 1, head: -8, o: [52, 116, 0.8] }, "inout"),
          K(1, {}),
        ],
      };
      return C;
    },
  };

  // Golden dancer: four arms. The upper pair (fa, ba) works high, the lower pair (fc, bc) low; palms open.
  W.dance = {
    name: "Four-arm dance",
    tier: "",
    reach: 110,
    heavy: 0,
    arms: {
      hit: { fa: [110, 150], ba: [140, 170], fc: [40, 80], bc: [-170, -150] },
      parry: { fa: [40, 100], ba: [70, 120], fc: [10, 70], bc: [-20, 50] },
      slump: { fa: [-100, -80], ba: [-110, -90], fc: [-90, -80], bc: [-100, -90] },
      topple: { fa: [-40, -20], ba: [-60, -30], fc: [-40, -30], bc: [-60, -40] },
      dead: { fa: [-75, -70], ba: [-105, -110], fc: [-80, -76], bc: [-100, -104] },
    },
    combo: ["a1", "a2", "a1", "a3", "a4"],
    moves: (m, A) => {
      const { K, f0, b0, L, AY, GY } = m,
        C = {};
      // Four palms in sequence, each arm on its own beat: upper front, lower front, upper back, lower back.
      // The arm that just struck drifts back to the guard while the next one fires, so they overlap.
      C.a1 = {
        label: "Attack 1: four-palm cascade",
        dur: 0.82,
        frames: 6,
        hitType: "hit",
        keys: [
          K(0, {}, "inout"),
          K(0.12, { fa: [34, 146], fc: [-44, 36], lean: L - 2, chest: -4, ft: [f0, b0, -3] }, "snap"),
          K(
            0.22,
            { fa: [6, 2], fc: [-48, 44], lean: L + 6, chest: 5, pel: 2, x: 4, ft: [f0 + 8, b0, -4, 0, 0, 0, -10] },
            "hold",
          ),
          K(
            0.28,
            {
              fa: [8, 4],
              fc: [-50, 48],
              ba: [118, 70],
              lean: L + 6,
              chest: 5,
              pel: 2,
              x: 4,
              ft: [f0 + 8, b0, -4, 0, 0, 0, -10],
            },
            "snap",
          ),
          K(
            0.38,
            {
              fa: [30, 110],
              fc: [-8, -4],
              ba: [124, 74],
              bc: [-170, -150],
              lean: L + 9,
              chest: 7,
              pel: 3,
              x: 8,
              ft: [f0 + 12, b0 + 2, -5, 0, 0, 0, -14],
            },
            "hold",
          ),
          K(
            0.44,
            {
              fa: [40, 120],
              fc: [-10, -2],
              ba: [126, 76],
              bc: [-172, -148],
              lean: L + 9,
              chest: 7,
              pel: 3,
              x: 8,
              ft: [f0 + 12, b0 + 2, -5, 0, 0, 0, -14],
            },
            "snap",
          ),
          K(
            0.54,
            {
              fc: [-30, 20],
              ba: [6, 4],
              bc: [-176, -156],
              lean: L + 13,
              chest: -8,
              pel: -4,
              x: 12,
              ft: [f0 + 16, b0 + 4, -7, 0, 0, 0, -24],
            },
            "hold",
          ),
          K(
            0.6,
            {
              fc: [-30, 20],
              ba: [8, 6],
              bc: [-178, -160],
              lean: L + 13,
              chest: -8,
              pel: -4,
              x: 12,
              ft: [f0 + 16, b0 + 4, -7, 0, 0, 0, -24],
            },
            "snap",
          ),
          K(
            0.7,
            {
              ba: [60, 70],
              bc: [-4, -6],
              lean: L + 15,
              chest: -10,
              pel: -5,
              x: 16,
              ft: [f0 + 20, b0 + 6, -8, 0, 0, 0, -28],
            },
            "hold",
          ),
          K(
            0.82,
            {
              ba: [80, 56],
              bc: [-6, -4],
              lean: L + 14,
              chest: -9,
              pel: -5,
              x: 16,
              ft: [f0 + 20, b0 + 6, -8, 0, 0, 0, -26],
            },
            "inout",
          ),
          K(1, { x: 16 }),
        ],
        events: [
          [0.22, "impact"],
          [0.38, "impact"],
          [0.54, "impact"],
          [0.7, "impact"],
        ],
        trails: [
          [0.12, 0.28, 0],
          [0.28, 0.44, 2],
          [0.44, 0.6, 1],
          [0.6, 0.78, 3],
        ],
      };
      C.a2 = {
        label: "Attack 2: whirling palms",
        dur: 0.64,
        frames: 5,
        hitType: "hit",
        keys: [
          K(0, {}, "inout"),
          K(
            0.16,
            { fa: [10, 4], ba: [170, 178], fc: [-14, -10], bc: [-168, -176], lean: L + 4, ft: [f0, b0, -6] },
            "linear",
          ),
          K(
            0.48,
            {
              turn: 180,
              fa: [10, 4],
              ba: [170, 178],
              fc: [-14, -10],
              bc: [-168, -176],
              lean: L + 4,
              x: 10,
              ft: [f0 + 10, b0 + 10, -6],
            },
            "linear",
          ),
          K(
            0.78,
            {
              turn: 360,
              fa: [10, 4],
              ba: [170, 178],
              fc: [-14, -10],
              bc: [-168, -176],
              lean: L + 6,
              x: 20,
              ft: [f0 + 20, b0 + 20, -8],
            },
            "out",
          ),
          K(1, { turn: 360, x: 20 }),
        ],
        events: [
          [0.44, "impact"],
          [0.74, "impact"],
        ],
        trails: [
          [0.16, 0.8, 0],
          [0.16, 0.8, 2],
        ],
      };
      C.a3 = {
        label: "Attack 3: crane kick",
        dur: 0.62,
        frames: 5,
        hitType: "hitHeavy",
        keys: [
          K(0, {}, "inout"),
          K(
            0.26,
            {
              air: 0,
              y: 0,
              lean: L - 6,
              fl: [36, -66],
              ffa: -50,
              bfa: -16,
              fa: [70, 140],
              ba: [110, 50],
              fc: [-10, 30],
              bc: [-160, -130],
            },
            "snap",
          ),
          K(
            0.46,
            {
              air: 0,
              y: 0,
              lean: L - 24,
              head: 8,
              fl: [56, 46],
              ffa: 30,
              bfa: -20,
              fa: [80, 150],
              ba: [120, 60],
              fc: [10, 40],
              bc: [-150, -120],
              x: 4,
            },
            "hold",
          ),
          K(
            0.62,
            {
              air: 0,
              y: 0,
              lean: L - 22,
              head: 8,
              fl: [52, 38],
              ffa: 26,
              bfa: -18,
              fa: [80, 150],
              ba: [120, 60],
              fc: [10, 40],
              bc: [-150, -120],
              x: 4,
            },
            "inout",
          ),
          K(0.82, { air: 0, y: 0, lean: L - 6, fl: [36, -70], ffa: -40, x: 4 }, "inout"),
          K(1, { x: 4 }),
        ],
        events: [[0.46, "impact"]],
        trails: [],
      };
      C.a4 = {
        label: "Attack 4: lotus whirl kick",
        dur: 0.82,
        frames: 5,
        hitType: "knockdown",
        keys: [
          K(0, {}, "inout"),
          K(0.2, { lean: L + 12, ft: [f0, b0, -18], fa: [80, 130], ba: [110, 60] }, "out"),
          K(
            0.44,
            {
              air: 1,
              y: GY + 40,
              x: 34,
              turn: 180,
              lean: L - 6,
              fl: [8, 2],
              bl: [-100, -150],
              ffa: 0,
              bfa: -40,
              fa: [20, 10],
              ba: [160, 170],
              fc: [-20, -10],
              bc: [-160, -170],
            },
            "linear",
          ),
          K(
            0.62,
            {
              air: 1,
              y: GY + 34,
              x: 52,
              turn: 360,
              lean: L - 4,
              fl: [10, 4],
              bl: [-100, -150],
              ffa: 0,
              bfa: -40,
              fa: [20, 10],
              ba: [160, 170],
              fc: [-20, -10],
              bc: [-160, -170],
            },
            "in",
          ),
          K(0.78, { turn: 360, x: 64, lean: L + 10, ft: [f0 + 64, b0 + 64, -16] }, "inout"),
          K(1, { turn: 360, x: 64 }),
        ],
        events: [
          [0.18, "dust"],
          [0.56, "impact"],
          [0.78, "land"],
        ],
        trails: [],
        ghosts: [0.24, 0.72],
      };
      C.air = {
        label: "Air attack: diving palms",
        dur: 0.46,
        frames: 4,
        air: true,
        hitType: "hitHeavy",
        keys: [
          K(
            0,
            {
              air: 1,
              y: AY,
              fl: [-10, -100],
              bl: [-55, -140],
              ffa: -30,
              bfa: -40,
              fa: [80, 130],
              ba: [110, 60],
              fc: [10, 40],
              bc: [-150, -130],
            },
            "snap",
          ),
          K(
            0.32,
            {
              air: 1,
              y: AY,
              lean: L + 20,
              fl: [-20, -100],
              bl: [-70, -130],
              ffa: -20,
              bfa: -30,
              fa: [-20, -24],
              ba: [-30, -34],
              fc: [-30, -34],
              bc: [-40, -44],
            },
            "hold",
          ),
          K(
            0.62,
            {
              air: 1,
              y: AY,
              lean: L + 18,
              fl: [-22, -100],
              bl: [-72, -130],
              ffa: -20,
              bfa: -30,
              fa: [-22, -26],
              ba: [-32, -36],
              fc: [-32, -36],
              bc: [-42, -46],
            },
            "inout",
          ),
          K(1, {
            air: 1,
            y: AY,
            fl: [-50, -96],
            bl: [-100, -106],
            ffa: -10,
            bfa: -20,
            fa: [60, 30],
            ba: [120, 150],
            fc: [-40, -60],
            bc: [-140, -120],
          }),
        ],
        events: [[0.32, "impact"]],
        trails: [
          [0.04, 0.4, 0],
          [0.04, 0.4, 2],
        ],
      };
      // Her taunt is the pose from the design: on one leg, upper hands raised flat, lower hands out.
      C.taunt = {
        label: "Taunt: dancer's pose",
        dur: 1.6,
        frames: 4,
        keys: [
          K(0, {}, "inout"),
          K(
            0.3,
            {
              air: 0,
              y: 0,
              lean: L - 2,
              head: -4,
              fl: [40, -74],
              ffa: -60,
              bfa: 0,
              fa: [70, 160],
              ba: [110, 20],
              fc: [-6, 20],
              bc: [-170, -140],
              pel: 3,
            },
            "hold",
          ),
          K(
            0.72,
            {
              air: 0,
              y: 0,
              lean: L - 2,
              head: -4,
              fl: [40, -74],
              ffa: -60,
              bfa: 0,
              fa: [70, 160],
              ba: [110, 20],
              fc: [-6, 20],
              bc: [-170, -140],
              pel: 3,
            },
            "inout",
          ),
          K(1, {}),
        ],
      };
      C.idle1 = {
        label: "Idle break: flowing hands",
        dur: 2.0,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.25, { fa: [70, 150], fc: [-40, -10], pel: 3 }, "inout"),
          K(0.5, { fa: [40, 110], fc: [-10, 30], bc: [-130, -160], pel: -2 }, "inout"),
          K(0.75, { fa: [70, 150], fc: [-40, -10], pel: 3 }, "inout"),
          K(1, {}),
        ],
      };
      C.idle2 = {
        label: "Idle break: slow turn",
        dur: 2.2,
        frames: 4,
        idleBreak: true,
        tempo: false,
        keys: [
          K(0, {}, "inout"),
          K(0.2, { fa: [60, 120], ba: [120, 60], fc: [0, 20], bc: [-170, -150] }, "inout"),
          K(0.8, { turn: 360, fa: [60, 120], ba: [120, 60], fc: [0, 20], bc: [-170, -150] }, "inout"),
          K(1, { turn: 360 }),
        ],
      };
      return C;
    },
  };

  // Shared reactions for the eased characters: hit, parry, death.
  function sharedEased(m, A) {
    const { K, f0, b0, L, G, GY, lieY, B } = m;
    const at = (spec, arms) => Object.assign({}, arms || {}, spec);
    return {
      hit: {
        label: "Hit (light)",
        dur: 0.42,
        frames: 4,
        blendIn: 0.03,
        react: true,
        lockUntil: 0.45,
        keys: [
          K(0, {}, "snap"),
          K(
            0.14,
            at(
              { lean: L - 24, head: -14, chest: -5, x: -16, fo: 1, bo: 1, ft: [f0 - 8, b0 - 18, -6, 0, 0, 0, 0] },
              A.hit,
            ),
            "out",
          ),
          K(0.5, { lean: L - 6, x: -22, ft: [f0 - 22, b0 - 22, -2] }, "inout"),
          K(1, { x: -22 }),
        ],
        events: [[0.02, "hurt"]],
      },
      hitHeavy: {
        label: "Hit (heavy, stagger)",
        dur: 0.75,
        frames: 4,
        blendIn: 0.03,
        react: true,
        lockUntil: 0.6,
        keys: [
          K(0, {}, "snap"),
          K(
            0.12,
            at(
              {
                lean: L - 30,
                head: -18,
                spine: -10,
                chest: -6,
                x: -26,
                fo: 1,
                bo: 1,
                ft: [f0 - 16, b0 - 34, -10, 0, 0, 0, 0],
              },
              A.hit,
            ),
            "out",
          ),
          K(
            0.34,
            at(
              {
                lean: L - 26,
                head: -14,
                spine: -9,
                chest: -5,
                x: -30,
                fo: 1,
                bo: 1,
                ft: [f0 - 18, b0 - 36, -12, 0, 0, 0, 0],
              },
              A.hit,
            ),
            "inout",
          ),
          K(0.62, { lean: L - 8, x: -44, ft: [f0 - 44, b0 - 40, -6] }, "inout"),
          K(1, { x: -44 }),
        ],
        events: [
          [0.02, "hurt"],
          [0.5, "step"],
        ],
      },
      knockdown: {
        label: "Knockdown and get up",
        dur: 1.8,
        frames: 6,
        blendIn: 0.03,
        react: true,
        lockUntil: 0.94,
        keys: [
          K(0, {}, "snap"),
          K(
            0.08,
            at({ lean: L - 30, head: -16, spine: -12, x: -12, fo: 1, bo: 1, ft: [f0 - 6, b0 - 14, -6] }, A.hit),
            "out",
          ),
          K(
            0.24,
            {
              air: 1,
              y: GY + 22,
              rot: 28,
              x: -46,
              lean: L - 20,
              head: -10,
              fl: [-30, -100],
              bl: [-60, -125],
              ffa: -30,
              bfa: -30,
              fo: 1,
              bo: 1,
              fa: [100, 150],
              ba: [120, 165],
            },
            "in",
          ),
          K(
            0.4,
            {
              air: 1,
              y: lieY,
              rot: 84,
              x: -66,
              lean: 2,
              head: 6,
              spine: 0,
              fl: [-62, -80],
              bl: [-74, -92],
              ffa: -60,
              bfa: -60,
              fa: [44, 74],
              ba: [30, 62],
              fo: 1,
              bo: 1,
            },
            "out",
          ),
          K(
            0.46,
            {
              air: 1,
              y: lieY + 5,
              rot: 80,
              x: -66,
              lean: 2,
              head: 4,
              spine: 0,
              fl: [-58, -76],
              bl: [-70, -88],
              ffa: -60,
              bfa: -60,
              fa: [44, 74],
              ba: [30, 62],
              fo: 1,
              bo: 1,
            },
            "in",
          ),
          K(
            0.53,
            {
              air: 1,
              y: lieY,
              rot: 84,
              x: -66,
              lean: 2,
              head: 6,
              spine: 0,
              fl: [-62, -80],
              bl: [-74, -92],
              ffa: -60,
              bfa: -60,
              fa: [44, 74],
              ba: [30, 62],
              fo: 1,
              bo: 1,
            },
            "hold",
          ),
          K(
            0.66,
            {
              air: 1,
              y: lieY,
              rot: 84,
              x: -66,
              lean: 2,
              head: 6,
              spine: 0,
              fl: [-62, -80],
              bl: [-74, -92],
              ffa: -60,
              bfa: -60,
              fa: [44, 74],
              ba: [30, 62],
              fo: 1,
              bo: 1,
            },
            "inout",
          ),
          K(
            0.8,
            {
              air: 1,
              y: 16 - B.hipBase,
              rot: 0,
              x: -66,
              lean: -16,
              head: 6,
              spine: 6,
              fl: [0, -28],
              bl: [-12, -24],
              ffa: 30,
              bfa: 20,
              fa: [-100, -80],
              ba: [-130, -110],
              fo: 1,
              bo: 1,
            },
            "inout",
          ),
          K(0.92, { x: -66, lean: L + 26, ft: [f0 - 66, b0 - 66, -30] }, "inout"),
          K(1, { x: -66 }),
        ],
        events: [
          [0.02, "hurt"],
          [0.4, "thud"],
          [0.42, "dust"],
          [0.84, "dust"],
        ],
      },
      parry: {
        label: "Parry / block",
        dur: 0.44,
        frames: 4,
        keys: [
          K(0, {}, "out"),
          K(0.26, at({ lean: L - 6, x: -6, chest: -3, fo: 1, bo: 1, ft: [f0 - 4, b0 - 8, -5] }, A.parry), "hold"),
          K(0.56, at({ lean: L - 5, x: -8, chest: -3, fo: 1, bo: 1, ft: [f0 - 6, b0 - 8, -5] }, A.parry), "inout"),
          K(1, { x: -8 }),
        ],
        events: [[0.24, "parry"]],
      },
      death: {
        label: "Death",
        dur: 1.8,
        frames: 6,
        next: null,
        ease: false,
        react: true,
        lockUntil: 2,
        keys: [
          [0, G],
          [0.08, P(G, at({ lean: -24, head: -16, x: -14 }, A.hit))],
          [0.25, P(G, at({ lean: 28, head: 10, x: -18, air: 0, y: 0, legs: [-45, -108] }, A.slump))],
          [
            0.42,
            P(G, at({ lean: 30, head: 12, x: -16, air: 0, y: 0, fl: [-10, -95], bl: [-95, -178], bfa: -60 }, A.slump)),
          ],
          [
            0.62,
            P(
              G,
              at(
                { lean: 40, rot: -35, air: 0.5, y: -30, x: -12, fl: [-40, -120], bl: [-110, -150], ffa: -40, bfa: -40 },
                A.topple,
              ),
            ),
          ],
          [
            0.8,
            P(
              G,
              at(
                { lean: 5, rot: -88, air: 1, y: -56, x: -6, fl: [-92, -92], bl: [-88, -88], ffa: -90, bfa: -90 },
                A.dead,
              ),
            ),
          ],
          [
            0.86,
            P(
              G,
              at(
                { lean: 5, rot: -88, air: 1, y: -51, x: -6, fl: [-92, -92], bl: [-88, -88], ffa: -90, bfa: -90 },
                A.dead,
              ),
            ),
          ],
          [
            0.94,
            P(
              G,
              at(
                { lean: 5, rot: -88, air: 1, y: -56, x: -6, fl: [-92, -92], bl: [-88, -88], ffa: -90, bfa: -90 },
                A.dead,
              ),
            ),
          ],
          [
            1,
            P(
              G,
              at(
                { lean: 5, rot: -88, air: 1, y: -56, x: -6, fl: [-92, -92], bl: [-88, -88], ffa: -90, bfa: -90 },
                A.dead,
              ),
            ),
          ],
        ],
        events: [
          [0.02, "hurt"],
          [0.42, "dust"],
          [0.8, "thud"],
        ],
      },
    };
  }

  // ---------- Shared moves, built from a weapon's stance and arm poses ----------
  const ORDER = ["idle", "run", "dash", "jump", "a1", "a2", "a3", "a4", "combo", "hit", "parry", "taunt", "death"];

  function build(id, gender, prof) {
    if (W[id].moves) return buildEased(id, gender, prof);
    const w = W[id],
      A = w.arms,
      L0 = w.legs;
    const G = P(null, Object.assign({ lean: w.lean, legs: L0 }, A.guard));
    const at = (over, arms) => P(G, Object.assign({}, arms || {}, over));
    const mid = (a, b) => {
      const o = {};
      for (const k in a) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => (v + b[k][i]) / 2) : (a[k] + b[k]) / 2;
      return o;
    };
    const C = {};

    C.idle = {
      label: "Idle",
      dur: 1.8,
      loop: true,
      frames: 8,
      keys: [
        [0, G],
        [0.5, at({ lean: w.lean + 3, legs: [L0[0] + 4, L0[1] - 3] }, A.guard2)],
      ],
    };

    // Run: the legs cycle by distance (stride), not by time, so the feet never slide.
    const rA = A.runA,
      rB = A.runB,
      rM = mid(rA, rB);
    C.run = {
      label: "Run",
      stride: 150,
      loop: true,
      frames: 8,
      keys: [
        [0, at({ lean: 24, fl: [-30, -70], bl: [-150, -120] }, rA)],
        [0.25, at({ lean: 22, fl: [-75, -110], bl: [-95, -160] }, rM)],
        [0.5, at({ lean: 24, fl: [-150, -120], bl: [-30, -70] }, rB)],
        [0.75, at({ lean: 22, fl: [-95, -160], bl: [-75, -110] }, rM)],
      ],
      events: [
        [0.02, "step"],
        [0.52, "step"],
      ],
    };

    C.dash = {
      label: "Dash",
      dur: 0.42,
      frames: 6,
      keys: [
        [0, G],
        [0.12, at({ lean: 32, legs: [-48, -102], x: 16 }, A.dash)],
        [0.3, at({ lean: 42, fl: [-25, -70], bl: [-150, -160], x: 150, air: 0.25, y: 4 }, A.dash)],
        [0.62, at({ lean: 36, fl: [-40, -85], bl: [-140, -130], x: 225 }, A.dash)],
        [1, P(G, { x: 240 })],
      ],
      events: [
        [0.1, "dust"],
        [0.62, "step"],
      ],
      ghosts: [0.1, 0.7],
      speedLines: true,
    };

    C.jump = {
      label: "Jump + fall",
      dur: 1.15,
      frames: 8,
      keys: [
        [0, G],
        [0.12, at({ lean: w.lean + 14, legs: [-42, -104] }, A.land)],
        [0.22, at({ lean: 4, legs: [-82, -95], air: 0.6, y: 26 }, A.up)],
        [0.38, at({ lean: 6, fl: [-20, -110], bl: [-115, -150], air: 1, y: 92 }, A.up)],
        [0.5, at({ lean: 14, fl: [0, -120], bl: [-60, -150], air: 1, y: 112 }, A.tuck)],
        [0.64, at({ lean: 8, fl: [-45, -90], bl: [-110, -120], air: 1, y: 78 }, A.fall)],
        [0.78, at({ lean: 12, fl: [-60, -88], bl: [-112, -100], air: 1, y: 14 }, A.fall)],
        [0.84, at({ lean: w.lean + 16, legs: [-40, -106], sq: 0.07 }, A.land)],
        [1, G],
      ],
      events: [
        [0.18, "dust"],
        [0.84, "land"],
      ],
    };

    C.hit = {
      label: "Hit / hurt",
      dur: 0.45,
      frames: 4,
      keys: [
        [0, G],
        [0.14, at({ lean: -20, head: -14, x: -16, legs: [L0[0] + 8, L0[1] - 4] }, A.hit)],
        [0.45, P(G, { lean: w.lean - 6, x: -22 })],
        [1, P(G, { x: -22 })],
      ],
      events: [[0.02, "hurt"]],
    };

    // Heavy hit, knockdown and air attack, so a fighter built on this older path (Crimson Veil) has the same reactions
    // as the rest.
    C.hitHeavy = {
      label: "Hit (heavy, stagger)",
      dur: 0.75,
      frames: 4,
      blendIn: 0.03,
      react: true,
      lockUntil: 0.6,
      keys: [
        [0, G],
        [0.12, at({ lean: -30, head: -18, x: -26, legs: [L0[0] + 10, L0[1] - 6] }, A.hit)],
        [0.34, at({ lean: -26, head: -14, x: -30, legs: [L0[0] + 10, L0[1] - 6] }, A.hit)],
        [0.62, P(G, { lean: w.lean - 8, x: -44 })],
        [1, P(G, { x: -44 })],
      ],
      events: [
        [0.02, "hurt"],
        [0.5, "step"],
      ],
    };
    const lie = { lean: 5, rot: -88, air: 1, y: -56, x: -66, fl: [-92, -92], bl: [-88, -88], ffa: -90, bfa: -90 };
    C.knockdown = {
      label: "Knockdown and get up",
      dur: 1.8,
      frames: 6,
      blendIn: 0.03,
      react: true,
      lockUntil: 0.94,
      keys: [
        [0, G],
        [0.08, at({ lean: -30, head: -16, x: -12 }, A.hit)],
        [
          0.26,
          at(
            { lean: -20, rot: -30, air: 0.6, y: -22, x: -46, fl: [-30, -100], bl: [-60, -125], ffa: -30, bfa: -30 },
            A.topple,
          ),
        ],
        [0.4, at(lie, A.dead)],
        [0.66, at(lie, A.dead)],
        [
          0.8,
          at(
            { lean: 8, rot: -40, air: 0.5, y: -26, x: -66, fl: [-30, -100], bl: [-60, -125], ffa: -30, bfa: -30 },
            A.topple,
          ),
        ],
        [0.92, P(G, { x: -66, lean: w.lean + 24, legs: [-45, -108] })],
        [1, P(G, { x: -66 })],
      ],
      events: [
        [0.02, "hurt"],
        [0.4, "thud"],
        [0.42, "dust"],
        [0.84, "dust"],
      ],
    };
    C.parry = {
      label: "Parry / block",
      dur: 0.5,
      frames: 4,
      keys: [
        [0, G],
        [0.22, at({ lean: -2, x: -6 }, A.parry)],
        [0.55, at({ lean: 0, x: -8 }, A.parry)],
        [1, P(G, { x: -8 })],
      ],
      events: [[0.24, "parry"]],
    };

    C.death = {
      label: "Death",
      dur: 1.8,
      frames: 6,
      next: null,
      keys: [
        [0, G],
        [0.08, at({ lean: -24, head: -16, x: -14 }, A.hit)],
        [0.25, at({ lean: 28, head: 10, x: -18, legs: [-45, -108] }, A.slump)],
        [0.42, at({ lean: 30, head: 12, x: -16, fl: [-10, -95], bl: [-95, -178] }, A.slump)],
        [0.62, at({ lean: 40, rot: -35, air: 0.5, y: -30, x: -12, fl: [-40, -120], bl: [-110, -150] }, A.topple)],
        [0.8, at({ lean: 5, rot: -88, air: 1, y: -56, x: -6, fl: [-92, -92], bl: [-88, -88] }, A.dead)],
        [0.86, at({ lean: 5, rot: -88, air: 1, y: -51, x: -6, fl: [-92, -92], bl: [-88, -88] }, A.dead)],
        [0.94, at({ lean: 5, rot: -88, air: 1, y: -56, x: -6, fl: [-92, -92], bl: [-88, -88] }, A.dead)],
        [1, at({ lean: 5, rot: -88, air: 1, y: -56, x: -6, fl: [-92, -92], bl: [-88, -88] }, A.dead)],
      ],
      events: [
        [0.02, "hurt"],
        [0.42, "dust"],
        [0.8, "thud"],
      ],
    };

    const atk = w.attacks(G);
    for (const k in atk) C[k] = atk[k];
    if (w.attacks && !C.air) {
      const ag = (o) => P(G, Object.assign({ air: 1, y: 0, fl: [-20, -110], bl: [-60, -140], ffa: -20, bfa: -30 }, o));
      C.air = {
        label: "Air attack: diving lash",
        dur: 0.48,
        frames: 4,
        air: true,
        hitType: "hitHeavy",
        keys: [
          [0, ag({ lean: 6, fa: [115, 140], w: 155, ba: [-70, -60], w2: -95 })],
          [0.3, ag({ lean: 24, fa: [-4, -14], w: -6, ba: [-70, -60], w2: -95 })],
          [0.62, ag({ lean: 20, fa: [-30, -40], w: -40, ba: [-70, -60], w2: -95 })],
          [1, ag({ fl: [-50, -96], bl: [-100, -106] })],
        ],
        events: [[0.3, "impact"]],
        trails: [[0.2, 0.5, 0]],
      };
    }
    C.combo = { label: "Combo sequence", seq: w.combo, frames: 6 };

    for (const k in C) {
      const c = C[k];
      c.id = k;
      c.events = c.events || [];
      c.trails = c.trails || [];
      if (c.next === undefined) c.next = "idle";
      if (c.loop === undefined) c.loop = false;
      const hits = c.events.filter((e) => e[1] === "impact").map((e) => e[0]);
      if (/^a[1-4]$|^air$/.test(k) && hits.length) c.cancelAt = Math.min(0.92, Math.max(...hits) + 0.05);
    }
    C.guard = G;
    return C;
  }

  function buildEased(id, gender, prof) {
    const w = W[id],
      m = maker(id, gender, prof),
      C = Object.assign(sharedEased(m, w.arms), w.moves(m, w.arms));
    for (const k in C) if (!C[k]) delete C[k];
    C.combo = { label: "Combo sequence", seq: w.combo, frames: 6 };
    for (const k in C) {
      const c = C[k];
      c.id = k;
      c.events = c.events || [];
      c.trails = c.trails || [];
      if (c.ease === undefined) c.ease = true;
      if (c.next === undefined) c.next = "idle";
      c.loop = false;
      // Cancel window: an attack can be cancelled into the next one right after its last hit lands.
      const hits = c.events.filter((e) => e[1] === "impact").map((e) => e[0]);
      if (/^a[1-4]$|^air$/.test(k) && hits.length) c.cancelAt = Math.min(0.92, Math.max(...hits) + 0.05);
    }
    C.guard = m.G;
    return C;
  }

  // ---------- Looks (roster) ----------
  const BODY = "#111317",
    BACK = "#363b45";
  function look(id, gender) {
    const base = { body: BODY, back: BACK, rim: null, accent: "#c82a2a", cloth: [], hood: null, wraps: null };
    let o;
    switch (id) {
      case "sword":
        o = {
          accent: "#d3262b",
          trail: "255, 92, 92",
          cloth: [
            { kind: "scarf", color: "#d3262b" },
            { kind: "sash", color: "#b81f24" },
          ],
        };
        break;
      case "dual":
        o = {
          accent: "#c0162f",
          trail: "255, 80, 100",
          cloth: [
            { kind: "scarf", color: "#c0162f" },
            { kind: "sash", color: "#9e1428" },
          ],
        };
        break;
      case "spear":
        o = {
          accent: "#2e6fb5",
          trail: "150, 200, 255",
          headband: "#2e6fb5",
          cloth: [
            { kind: "skirt", color: "#2e6fb5", color2: "#24558c", strips: 5, len: 4, seg: 8 },
            { kind: "tassel", color: "#2e6fb5", u: 94 },
          ],
        };
        break;
      case "hammer":
        o = {
          accent: "#a06a32",
          trail: "240, 210, 160",
          wraps: "#c9a578",
          cloth: [{ kind: "skirt", color: "#8a5a2b", color2: "#a7743b", strips: 6, len: 4, seg: 9 }],
        };
        break;
      case "scythe":
        o = {
          accent: "#7a4bb8",
          trail: "200, 175, 255",
          hood: { color: "#17141d", edge: "#6a3fa6" },
          cloth: [
            { kind: "cape", color: "#211a2c", len: 7 },
            { kind: "skirt", color: "#2b2236", color2: "#5a3a85", strips: 6, len: 5, seg: 9 },
          ],
        };
        break;
      default:
        o = {
          accent: "#c8202a",
          trail: "255, 255, 255",
          wraps: "#eef0f4",
          cloth: [{ kind: "sash", color: "#c8202a" }],
        };
    }
    const L = Object.assign(base, o);
    L.cloth = L.cloth.slice();
    if (gender === "F") L.cloth.push({ kind: "ponytail", color: "#0d0e11" });
    return L;
  }

  const ROSTER = [
    { id: "sword", M: "SWORDSMAN", F: "SWORDSWOMAN" },
    { id: "dual", M: "DUAL BLADE (M)", F: "DUAL BLADE (F)" },
    { id: "spear", M: "SPEARMAN", F: "SPEARWOMAN" },
    { id: "hammer", M: "HAMMERMAN", F: "HAMMERWOMAN" },
    { id: "scythe", M: "SCYTHEMAN", F: "SCYTHEWOMAN" },
    { id: "fists", M: "BARE FIST (M)", F: "BARE FIST (F)" },
  ];

  const cache = {};
  function clips(id, gender, prof) {
    const k = id + (gender || "M") + (prof ? prof.key : "");
    return cache[k] || (cache[k] = build(id, gender || "M", prof));
  }

  const library = { W, ORDER, clips, look, ROSTER };
  Move.useClips(library);
  return library;
});
