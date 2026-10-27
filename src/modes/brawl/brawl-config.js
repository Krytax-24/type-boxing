/**
 * Backspace Brawl numbers (brawl-rules.js and brawl-mode.js), counted in frames at 60 per second.
 * Added to CONFIG when the Backspace Brawl module starts; Brawl modules receive CONFIG from here.
 */
CounterType.define("brawl-config", ["config"], (CONFIG) => {
  "use strict";

  // Brawl: the fighting mode that needs no typing (brawl-rules.js). Everything is counted in frames at 60 per second.
  // Moves: startup, active and recover are frames; dmg is HP; reach is how far in front of the body the hit reaches; h
  // is where it hits (high: a crouching fighter ducks it, mid: hits anyone on the ground, low: must be blocked
  // crouching); hitstun and blockstun are the frames the other fighter is stuck; knock is the push in units per second;
  // meter is gained on a hit.
  CONFIG.brawl = {
    step: 1 / 60,
    countdown: 3,
    hp: 100,
    arena: { width: 1100, left: 90, right: 1010 },
    floorY: 300,
    startX: [430, 670],
    halfW: 32,
    walk: 190,
    back: 150,
    jumpV: 600,
    gravity: 1700,
    downFrames: 62,
    wakeInvuln: 14,
    overFrames: 100,
    bufferFrames: 7,
    comboScale: [1, 1, 0.85, 0.7, 0.55, 0.4],
    meterMax: 100,
    superCost: 50,
    dash: { fwd: 430, back: 360, fwdFrames: 13, backFrames: 15, window: 12, backInv: 6 }, // double tap forward or back
    motionFrames: 20,
    superMotionFrames: 34, // how long a quarter circle (or two) may take
    // The four attack buttons: A high punch, S low punch, Z high kick, X low kick. clip: the fighter's own attack
    // animation that plays; spd: how fast it plays (frames come from the animation itself, so a heavy weapon is
    // slower); rb: reach bonus; tier: a chain may only go up (or stay) in tier; kind: p punch, k kick; h: where it hits
    // (a low attack must be blocked crouching, a high one can be ducked).
    btn: {
      lp: {
        clip: "a1",
        spd: 1.3,
        dmg: 4,
        rk: 0.55,
        rb: 0,
        hit: 13,
        blk: 8,
        knock: 50,
        meter: 5,
        tier: 1,
        kind: "p",
        h: "low",
      },
      lk: {
        clip: "a3",
        spd: 1.2,
        dmg: 6,
        rk: 0.62,
        rb: 16,
        hit: 15,
        blk: 10,
        knock: 90,
        meter: 6,
        tier: 1,
        kind: "k",
        h: "low",
      },
      hp: {
        clip: "a2",
        spd: 1.1,
        dmg: 8,
        rk: 0.7,
        rb: 4,
        hit: 17,
        blk: 11,
        knock: 110,
        meter: 8,
        tier: 2,
        kind: "p",
        h: "high",
      },
      hk: {
        clip: "a4",
        spd: 1.0,
        dmg: 13,
        rk: 0.8,
        rb: 16,
        hit: 0,
        blk: 15,
        knock: 230,
        meter: 11,
        tier: 3,
        kind: "k",
        h: "mid",
        kd: true,
      },
    },
    // A jumping attack by button strength.
    air: { clip: "air", spd: 1.2, dmg: [5, 7, 9], hit: 17, blk: 10, knock: 120, meter: 6, rk: 0.55, rb: 14 },
    fire: {
      clip: "a2",
      spd: 0.85,
      dmg: [6, 8, 10],
      speed: [210, 310, 430],
      hit: 22,
      blk: 14,
      knock: 120,
      chip: 2,
      minTotal: 36,
    }, // down, down forward, forward + punch
    dp: {
      clip: "air",
      spd: 1.15,
      dmg: [9, 11, 13],
      hit: 0,
      blk: 18,
      knock: 200,
      lift: 520,
      drift: 90,
      inv: 8,
      active: 12,
      reach: 80,
      lag: 18,
    }, // forward, down, down forward + punch
    // Down, down forward, forward twice + punch (costs superCost)
    sup: { clip: "a4", spd: 1.0, dmg: 26, speed: 500, hit: 0, blk: 20, knock: 260, chip: 5, minTotal: 40 },
    // Light punch + light kick together, close.
    throwMove: { clip: "a2", spd: 1.0, dmg: 10, reach: 64, startup: 5, total: 26, knock: 200 },
    // What makes each fighter different on top of its own animations. fire (Q) and dp (R) override numbers of the
    // shared moves. combos: button strings. Land a hit, then chain the next buttons in order and the last press becomes
    // the finisher: a stronger move with its own animation clip (spd: clip speed, dmg, kd: knocks down, rb: reach
    // bonus, knock: push). Q and R together are the super.
    style: {
      cyborg: {
        fire: { dmg: [6, 9, 12], speed: [240, 340, 460] },
        dp: { dmg: [10, 12, 14] },
        combos: [
          { seq: "lp,hp,hk", name: "Vanguard Cut", clip: "a4", spd: 1.1, dmg: 16, kd: true, rb: 20 },
          { seq: "lk,lp,hp", name: "Arc Chain", clip: "a3", spd: 1.2, dmg: 12, rb: 10 },
          { seq: "hp,hp,lk", name: "Hilt Break", clip: "a2", spd: 0.9, dmg: 14, kd: true, rb: 6 },
        ],
      },
      bluex: {
        fire: { dmg: [5, 7, 9], speed: [200, 290, 400] },
        dp: { dmg: [11, 13, 15], lift: 560 },
        combos: [
          { seq: "lp,lp,hk", name: "Grand Slam", clip: "a4", spd: 1.0, dmg: 18, kd: true, rb: 24 },
          { seq: "lk,hp,hp", name: "Double Play", clip: "a3", spd: 1.1, dmg: 13, rb: 14 },
          { seq: "hp,lk,hk", name: "Steal Home", clip: "a2", spd: 1.0, dmg: 15, kd: true, rb: 10 },
        ],
      },
      voss: {
        fire: { dmg: [5, 7, 9], speed: [260, 360, 470] },
        dp: { dmg: [9, 11, 13], reach: 95 },
        combos: [
          { seq: "lp,lp,hp", name: "Pole Flurry", clip: "a2", spd: 1.2, dmg: 12, rb: 24 },
          { seq: "lk,hp,hk", name: "Sweep Vault", clip: "a4", spd: 1.0, dmg: 17, kd: true, rb: 30 },
          { seq: "hp,hk,lk", name: "Ribbon Crush", clip: "a3", spd: 1.0, dmg: 15, kd: true, rb: 20 },
        ],
      },
      barbarian: {
        fire: { dmg: [7, 10, 13], speed: [190, 270, 360] },
        dp: { dmg: [12, 14, 16] },
        combos: [
          { seq: "hp,hp,hk", name: "Glacier Fall", clip: "a4", spd: 0.95, dmg: 20, kd: true, rb: 18 },
          { seq: "lp,lk,hp", name: "Frost Rend", clip: "a3", spd: 1.05, dmg: 14, rb: 12 },
          { seq: "lk,lk,hk", name: "Avalanche", clip: "a4", spd: 1.0, dmg: 17, kd: true, rb: 14 },
        ],
      },
      flame: {
        fire: { dmg: [7, 9, 12], speed: [230, 330, 450] },
        dp: { dmg: [10, 12, 14], lift: 540 },
        combos: [
          { seq: "lp,lp,lp", name: "Orb Barrage", clip: "a2", spd: 1.0, dmg: 14, rb: 40 },
          { seq: "hp,lk,hp", name: "Comet Drop", clip: "a4", spd: 1.0, dmg: 17, kd: true, rb: 30 },
          { seq: "lk,hp,hk", name: "Pillar Burst", clip: "a3", spd: 1.0, dmg: 16, kd: true, rb: 26 },
        ],
      },
      dancer: {
        fire: { dmg: [5, 7, 9], speed: [220, 310, 420] },
        dp: { dmg: [9, 11, 13], inv: 12 },
        combos: [
          { seq: "lp,hp,lp", name: "Four Palms", clip: "a1", spd: 1.0, dmg: 14, rb: 14 },
          { seq: "lk,lk,hk", name: "Crane Fall", clip: "a4", spd: 1.0, dmg: 15, kd: true, rb: 10 },
          { seq: "hp,hp,hk", name: "Lotus Whirl", clip: "a2", spd: 1.0, dmg: 16, kd: true, rb: 12 },
        ],
      },
      veil: {
        fire: { dmg: [5, 8, 10], speed: [260, 360, 480] },
        dp: { dmg: [9, 11, 13], reach: 90 },
        combos: [
          { seq: "lp,hp,hp", name: "Twin Lash", clip: "a3", spd: 1.1, dmg: 14, rb: 24 },
          { seq: "lk,lp,hk", name: "Rope Whirl", clip: "a4", spd: 1.0, dmg: 18, kd: true, rb: 28 },
          { seq: "hp,lk,lp", name: "Dagger Snap", clip: "a3", spd: 1.2, dmg: 12, rb: 18 },
        ],
      },
      ronin: {
        fire: { dmg: [6, 8, 11], speed: [250, 350, 470] },
        dp: { dmg: [10, 12, 14] },
        combos: [
          { seq: "lp,lp,hk", name: "Iaido", clip: "a4", spd: 1.15, dmg: 17, kd: true, rb: 22 },
          { seq: "hp,lp,hp", name: "Shadow Step", clip: "a2", spd: 1.15, dmg: 13, rb: 12 },
          { seq: "lk,hp,hk", name: "Moon Arc", clip: "a4", spd: 1.0, dmg: 16, kd: true, rb: 18 },
        ],
      },
      reaver: {
        fire: { dmg: [7, 9, 12], speed: [200, 280, 380] },
        dp: { dmg: [11, 13, 15] },
        combos: [
          { seq: "hp,hp,hk", name: "Blood Cleave", clip: "a4", spd: 1.0, dmg: 19, kd: true, rb: 16 },
          { seq: "lp,hp,lk", name: "Red Spin", clip: "a3", spd: 1.05, dmg: 14, rb: 14 },
          { seq: "lk,lp,hk", name: "Scarlet Rush", clip: "a4", spd: 1.1, dmg: 15, kd: true, rb: 12 },
        ],
      },
      varun: {
        fire: { dmg: [8, 11, 14], speed: [180, 250, 340] },
        dp: { dmg: [13, 15, 17] },
        combos: [
          { seq: "hp,lk,hk", name: "Hammerfall", clip: "a4", spd: 0.95, dmg: 21, kd: true, rb: 16 },
          { seq: "lp,hp,hp", name: "Skull Knock", clip: "a3", spd: 1.0, dmg: 15, rb: 10 },
          { seq: "hp,hp,lp", name: "Quake Swing", clip: "a2", spd: 0.95, dmg: 15, kd: true, rb: 12 },
        ],
      },
      grin: {
        fire: { dmg: [4, 6, 8], speed: [320, 440, 560] },
        dp: { dmg: [8, 10, 12] },
        combos: [
          { seq: "lp,lp,lp", name: "Rapid Fire", clip: "a1", spd: 1.3, dmg: 11, rb: 50 },
          { seq: "lk,hp,lp", name: "Quick Draw", clip: "a2", spd: 1.2, dmg: 12, rb: 44 },
          { seq: "hp,lk,hk", name: "Trick Shot", clip: "a4", spd: 1.1, dmg: 15, kd: true, rb: 38 },
        ],
      },
    },
    // Frame facts of every fighter's own animations: [duration in seconds, impact (fraction of the clip), impacts,
    // cancel (fraction)]. They are read from the animation clips (src/engine/animation/clips.js); tests/brawl-sim.js
    // checks they still match. tempo: the fighter's animation speed factor.
    chars: {
      cyborg: {
        name: "IRON VANGUARD",
        reach: 150,
        tempo: 1.02,
        trail: "255, 160, 80",
        a1: [0.42, 0.46, 1, 0.51],
        a2: [0.44, 0.46, 1, 0.51],
        a3: [0.54, 0.5, 1, 0.55],
        a4: [0.55, 0.48, 1, 0.53],
        air: [0.44, 0.48, 1, 0.53],
      },
      bluex: {
        name: "BLUE X",
        reach: 150,
        tempo: 1,
        trail: "120, 170, 255",
        a1: [0.42, 0.46, 1, 0.51],
        a2: [0.46, 0.5, 1, 0.55],
        a3: [0.66, 0.5, 1, 0.55],
        a4: [0.7, 0.58, 1, 0.63],
        air: [0.44, 0.48, 1, 0.53],
      },
      voss: {
        name: "COMMANDER VOSS",
        reach: 200,
        tempo: 0.92,
        trail: "130, 175, 255",
        a1: [0.42, 0.44, 1, 0.49],
        a2: [0.5, 0.48, 1, 0.53],
        a3: [0.74, 0.68, 1, 0.73],
        a4: [0.76, 0.44, 1, 0.49],
        air: [0.5, 0.58, 1, 0.63],
      },
      barbarian: {
        name: "FROSTJAW",
        reach: 175,
        tempo: 1.12,
        trail: "140, 215, 255",
        a1: [0.6, 0.54, 1, 0.59],
        a2: [0.6, 0.54, 1, 0.59],
        a3: [0.86, 0.6, 1, 0.65],
        a4: [0.96, 0.62, 1, 0.67],
        air: [0.5, 0.52, 1, 0.57],
      },
      flame: {
        name: "NOVA",
        reach: 190,
        tempo: 0.88,
        trail: "110, 160, 255",
        a1: [0.42, 0.4, 1, 0.45],
        a2: [0.7, 0.4, 1, 0.45],
        a3: [0.8, 0.54, 1, 0.59],
        a4: [0.96, 0.6, 1, 0.65],
        air: [0.5, 0.32, 1, 0.37],
      },
      dancer: {
        name: "SUVARNA",
        reach: 110,
        tempo: 0.85,
        trail: "255, 200, 90",
        a1: [0.82, 0.22, 4, 0.75],
        a2: [0.64, 0.44, 2, 0.79],
        a3: [0.62, 0.46, 1, 0.51],
        a4: [0.82, 0.56, 1, 0.61],
        air: [0.46, 0.32, 1, 0.37],
      },
      veil: {
        name: "CRIMSON VEIL",
        reach: 150,
        tempo: 0.9,
        trail: "230, 60, 80",
        a1: [0.44, 0.36, 1, 0.41],
        a2: [0.44, 0.36, 1, 0.41],
        a3: [0.7, 0.3, 2, 0.63],
        a4: [0.8, 0.42, 2, 0.81],
        air: [0.48, 0.3, 1, 0.35],
      },
      ronin: {
        name: "RONIN UNIT",
        reach: 150,
        tempo: 0.96,
        trail: "255, 150, 70",
        a1: [0.42, 0.46, 1, 0.51],
        a2: [0.44, 0.46, 1, 0.51],
        a3: [0.54, 0.5, 1, 0.55],
        a4: [0.55, 0.48, 1, 0.53],
        air: [0.44, 0.48, 1, 0.53],
      },
      reaver: {
        name: "SCARLET REAVER",
        reach: 175,
        tempo: 1,
        trail: "255, 90, 60",
        a1: [0.6, 0.54, 1, 0.59],
        a2: [0.6, 0.54, 1, 0.59],
        a3: [0.86, 0.6, 1, 0.65],
        a4: [0.96, 0.62, 1, 0.67],
        air: [0.5, 0.52, 1, 0.57],
      },
      varun: {
        name: "VARUN BLOODMANE",
        reach: 175,
        tempo: 1.1,
        trail: "255, 210, 120",
        a1: [0.6, 0.54, 1, 0.59],
        a2: [0.6, 0.54, 1, 0.59],
        a3: [0.86, 0.6, 1, 0.65],
        a4: [0.96, 0.62, 1, 0.67],
        air: [0.5, 0.52, 1, 0.57],
      },
      grin: {
        name: "GRIN",
        reach: 95,
        tempo: 0.96,
        trail: "255, 200, 60",
        a1: [0.3, 0.42, 1, 0.47],
        a2: [0.38, 0.44, 1, 0.49],
        a3: [0.46, 0.5, 1, 0.55],
        a4: [0.62, 0.44, 1, 0.49],
        air: [0.46, 0.32, 1, 0.37],
      },
    },
    // Offline opponents. think: frames between decisions (lower is sharper), block/aggr/jump/fire/chain: chances.
    bots: [
      {
        name: "ROOKIE",
        char: "bluex",
        style: "Slow, blocks a little",
        think: 28,
        block: 0.2,
        aggr: 0.35,
        jump: 0.04,
        fire: 0.05,
        chain: 0.1,
        low: 0,
      },
      {
        name: "FIGHTER",
        char: "ronin",
        style: "Mixes high and low",
        think: 16,
        block: 0.5,
        aggr: 0.55,
        jump: 0.1,
        fire: 0.14,
        chain: 0.45,
        low: 0.25,
      },
      {
        name: "CHAMPION",
        char: "reaver",
        style: "Fast, blocks, chains",
        think: 9,
        block: 0.8,
        aggr: 0.75,
        jump: 0.14,
        fire: 0.24,
        chain: 0.8,
        low: 0.4,
      },
    ],
    defaultBot: 1,
    storageKey: "typeboxing.brawl",
    touchOpacity: 0.55,
  };

  return CONFIG;
});
