// The designed characters (from Krishna's concept art in "Character Designs"), rebuilt as side-view vector
// puppets on the Rig skeleton. Each one keeps its design: proportions, palette, costume pieces, hair, headgear,
// weapon and glow effects. Drawing only: the controller (anim-move.js) and the clips (anim-clips.js) move them.
//
// A character: { key, name, gender (base body and movement), weapon (move set), weaponDraw, body (overrides of
// Rig.BODY), style (overrides of Move.STYLE), pal (colors), arms / legs / torso / head (layered parts), cloth
// (verlet strands: hair, braid, cape, ribbons, sash, chain), fx (glows, flames, frost) }.
// Limb layers: [t0, t1, k0, k1, color]: a tapered capsule from t0 to t1 along the bone, k = width multiplier of
// the body's base limb width. Torso bands: [t0, t1, color] across the torso; torso shapes: points [t, n] with
// t along the torso (0 hip, 1 shoulder) and n across it (positive = chest side).
const Chars = (() => {
  const { lerp, clamp, pt } = Rig;
  const DEG = Math.PI / 180, OL = 0.8;
  // One light for the whole scene, from the upper left of the screen (a unit vector pointing toward it).
  const LIGHT = [-0.55, -0.835];
  const EDGE = "rgba(8, 8, 14, 0.62)";

  function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  // Shade a color: k < 0 darkens toward black, k > 0 lightens toward white.
  function shade(c, k) {
    if (!c || c[0] !== "#") return c;
    const [r, g, b] = hex(c), f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  // ---------------- The six characters ----------------
  const DEFS = {};

  DEFS.cyborg = {
    key: "cyborg", name: "IRON VANGUARD", title: "Cyborg swordsman", gender: "M", weapon: "sword", weaponDraw: "cyberSword",
    body: { torso: 57, headR: 10.8, neck: 8, upper: 27, fore: 26, thigh: 38, shin: 38, foot: 12.5, limb: [13.2, 11.4, 14.6, 12],
      front: [6.2, 5.6, 10.8, 8.2], back: [7.2, 6.2, 8.8, 9.4], neckW: 9.4 },
    style: { speedK: 0.96, tempo: 1.02, leanK: 1.1 },
    trail: "255, 160, 80",
    pal: { outline: "#141019", skin: "#dba37c", hair: "#1b1820", purple: "#6b48a8", purpleD: "#4b3479", red: "#cf3a3a", black: "#1d1c25",
      grey: "#b9bec7", greyD: "#5c616b", brown: "#6e5a3b", glow: "#ff9b3d", boot: "#8e7c67", accent: "#ff9b3d" },
  };
  DEFS.cyborg.arms = (P) => ({
    front: { upper: [[0, 1, 1.08, 0.98, P.grey], [0.02, 0.2, 1.16, 1.12, P.greyD]], fore: [[0, 1, 0.98, 1.02, P.grey], [0.38, 0.52, 1.06, 1.06, P.greyD]],
      hand: { type: "mech", color: P.grey, dark: P.greyD }, pad: { color: P.grey, trim: P.greyD, r: 9.5 }, glow: P.glow },
    back: { upper: [[0, 1, 1, 0.95, P.black]], fore: [[0, 0.82, 1.08, 1.12, P.red], [0.82, 1, 0.92, 0.92, P.black]],
      hand: { type: "glove", color: P.black }, pad: { color: P.purple, trim: P.red, r: 9 } },
  });
  DEFS.cyborg.legs = (P) => ({
    thigh: [[0, 1, 1.06, 1, P.purple], [0.84, 1, 1.02, 1.02, P.black]], shin: [[0, 1, 1, 0.95, P.purple], [0.02, 0.26, 1.08, 1.06, P.purpleD]],
    stripe: { seg: "shin", t0: 0.3, t1: 0.95, color: P.red }, glowLine: { seg: "thigh", t0: 0.2, t1: 0.75, color: P.glow },
    foot: { type: "boot", color: P.boot, dark: shade(P.boot, -0.35) },
  });
  DEFS.cyborg.torso = (P) => ({
    base: P.purple,
    bands: [[0.03, 0.15, P.brown], [0.15, 0.22, P.black], [0.965, 1.05, P.red]],
    shapes: [
      { pts: [[0.48, -12], [0.5, 4], [0.6, 11.4], [0.84, 11.4], [0.98, 7], [0.98, -12]], color: P.purple, edge: P.red },
      { pts: [[0.22, -2], [0.22, 5.4], [0.46, 5.6], [0.46, -2]], color: P.purpleD, edge: P.black },
      { pts: [[0.2, -12], [0.2, -6], [0.96, -7], [0.96, -12]], color: P.black },
      { pts: [[0.03, 2], [0.03, 7.4], [0.15, 7.4], [0.15, 2]], color: shade(P.brown, -0.25) },
      { pts: [[0.06, -1], [0.06, 2], [0.13, 2], [0.13, -1]], color: "#9aa0a8" },
    ],
  });
  DEFS.cyborg.head = (P) => ({ skin: P.skin, hair: { style: "spiky", color: P.hair }, eye: "#1a1418", brow: true, jaw: true });
  DEFS.cyborg.cloth = [];

  DEFS.bluex = {
    key: "bluex", name: "BLUE X", title: "Baseball brawler", gender: "M", weapon: "bat", weaponDraw: "bat",
    body: { torso: 56, headR: 10.8, neck: 8, upper: 26, fore: 25, thigh: 37, shin: 36, foot: 13, limb: [12.8, 11, 13.4, 10.8],
      front: [5.8, 5.2, 10.2, 7.8], back: [6.8, 5.8, 8.6, 8.8], neckW: 9.4 },
    style: { speedK: 1.0, tempo: 1.0, leanK: 1.05 },
    trail: "120, 170, 255",
    pal: { outline: "#0c1020", skin: "#a86a45", hair: "#14110f", blue: "#1f4fd1", blueD: "#163a9c", white: "#e8e9ee", black: "#121316",
      grime: "#7a4b3a", accent: "#1f4fd1" },
  };
  DEFS.bluex.arms = (P) => {
    const a = { upper: [[0, 0.48, 1.3, 1.2, P.blue], [0.4, 0.48, 1.32, 1.3, P.white], [0.46, 1, 1.02, 0.96, P.skin]],
      fore: [[0, 1, 1, 1.02, P.skin], [0.72, 0.94, 1.16, 1.16, P.black]], hand: { type: "glove", color: P.black, accent: P.blue } };
    return { front: a, back: a };
  };
  DEFS.bluex.legs = (P) => ({
    thigh: [[0, 1, 1.16, 1.12, P.white]], shin: [[0, 0.44, 1.12, 1.02, P.white], [0.4, 1, 1.0, 0.94, P.blue]],
    pinstripes: { color: P.blue, segs: ["thigh"] }, strap: { seg: "thigh", t: 0.55, color: P.black, front: true },
    foot: { type: "sneaker", color: P.white, dark: P.black, accent: P.blue },
  });
  DEFS.bluex.torso = (P) => ({
    base: P.blue,
    bands: [[0.03, 0.13, P.black]],
    shapes: [
      { pts: [[0.13, 7.6], [1.0, 5.6], [1.0, 4.4], [0.13, 6.4]], color: P.white },
      { pts: [[0.06, 1.5], [0.06, 4.5], [0.11, 4.5], [0.11, 1.5]], color: "#a9adb5" },
      { x: { t: 0.72, n: 4.4, size: 7, color: P.black, edge: P.white } },
      { spots: [[0.3, 1, 2.2], [0.55, -3, 1.6], [0.78, 2, 1.4], [0.4, 5, 1.2]], color: shade(P.blue, -0.45) },
    ],
  });
  DEFS.bluex.head = (P) => ({ skin: P.skin, hair: { style: "fade", color: P.hair }, eye: "#1a1210", brow: true, beard: P.hair, hood: P.black, stud: "#0e0e10" });
  DEFS.bluex.cloth = [{ kind: "chain", at: "waistFront", n: 6, seg: 4.5, color: "#9aa0a8", layer: "front" }];

  DEFS.voss = {
    key: "voss", name: "COMMANDER VOSS", title: "Staff commander", gender: "F", weapon: "staff", weaponDraw: "staff",
    body: { torso: 52, headR: 10.2, neck: 8.6, upper: 25, fore: 24, thigh: 39, shin: 38, foot: 10.4, limb: [9, 7.8, 12.6, 9.4],
      front: [5, 3, 6.6, 4.4], back: [7.6, 3.4, 5, 5.4], neckW: 6.2 },
    style: { speedK: 1.0, tempo: 0.92, leanK: 0.9 },
    trail: "130, 175, 255",
    pal: { outline: "#0d0e13", skin: "#c99470", hair: "#d9dadf", hairD: "#a7a9b1", black: "#1b1d24", blackL: "#2b2e38", blue: "#2f5fc4",
      white: "#e9ecf1", accent: "#2f5fc4" },
  };
  DEFS.voss.arms = (P) => {
    const a = { upper: [[0, 1, 1, 0.95, P.black]], fore: [[0, 1, 1.05, 1.1, P.black], [0.22, 0.76, 1.2, 1.2, P.white]],
      camo: { seg: "fore", t0: 0.24, t1: 0.74 }, hand: { type: "gauntlet", color: P.black },
      pad: { color: P.white, trim: P.black, r: 10, camo: true } };
    return { front: a, back: a };
  };
  DEFS.voss.legs = (P) => ({
    thigh: [[0, 1, 1.08, 1.02, P.black]], shin: [[0, 1, 1.02, 1.08, P.black], [0, 0.2, 1.24, 1.18, P.blackL], [0.6, 0.7, 1.22, 1.22, P.white]],
    camo: { seg: "shin", t0: 0.6, t1: 0.7 }, kneeTrim: P.blue,
    foot: { type: "boot", color: P.black, dark: "#0b0c10", chunky: true },
  });
  DEFS.voss.torso = (P) => ({
    base: P.black, scales: P.blackL,
    bands: [[0.03, 0.12, P.black], [0.94, 1.08, P.black]],
    shapes: [
      { pts: [[0.7, 6], [0.9, 2], [0.98, 6.4], [0.98, -1], [0.82, -3], [0.7, -1]], color: P.white, camo: true },
      { pts: [[0.02, -6], [0.16, 6], [0.2, 6], [0.06, -6]], color: P.blue },
      { pts: [[0.03, 3], [0.03, 6.4], [0.12, 6.4], [0.12, 3]], color: P.blackL },
    ],
  });
  DEFS.voss.head = (P) => ({ skin: P.skin, hair: { style: "swept", color: P.hair }, eye: "#2b3550", brow: true, lips: "#a5605a" });
  DEFS.voss.cloth = [
    { kind: "hair", at: "headTop", n: 9, seg: 7.4, w0: 11, w1: 3, color: "#d9dadf", color2: "#a7a9b1", layer: "back", gravity: 700, wind: 0.8, tie: "#2f5fc4" },
    { kind: "ribbon", at: "weapon", u: 84, v: 5, n: 6, seg: 6, w0: 3.4, w1: 2, color: "#2f5fc4", layer: "front", gravity: 500, flutter: 220 },
    { kind: "ribbon", at: "weapon", u: 84, v: 5, n: 5, seg: 6.5, w0: 3, w1: 1.6, color: "#2549a0", layer: "front", gravity: 520, flutter: 180, phase: 2 },
  ];

  DEFS.barbarian = {
    key: "barbarian", name: "FROSTJAW", title: "Ice barbarian", gender: "M", weapon: "axe", weaponDraw: "axe",
    body: { torso: 61, headR: 11.4, neck: 7, upper: 28, fore: 27, thigh: 38, shin: 37, foot: 13, limb: [15.6, 13.6, 15.6, 12.6],
      front: [7.4, 6.6, 12.6, 9.8], back: [8.4, 7.2, 11, 11.4], neckW: 12 },
    style: { speedK: 0.86, tempo: 1.12, leanK: 1.2, stance: [27, -26], landK: 1.4, jumpV: 505, accel: 1050, decel: 1450, breath: 2.4 },
    trail: "140, 215, 255",
    pal: { outline: "#0b0c11", skin: "#b07a52", steel: "#2c3139", steelL: "#454c57", gold: "#c99a3a", leather: "#3b2a20", leatherD: "#281d17",
      fur: "#e6eef5", furB: "#8ccaf0", cape: "#1f3f6e", capeEdge: "#5fb8ff", pants: "#1f2633", edge: "#8fdcff", accent: "#8fdcff" },
  };
  DEFS.barbarian.arms = (P) => {
    const a = { upper: [[0, 1, 1.02, 0.96, P.skin]], fore: [[0, 0.44, 1, 1.02, P.skin], [0.42, 1, 1.14, 1.12, P.leather], [0.4, 0.5, 1.3, 1.3, P.fur]],
      goldBand: { seg: "fore", t: 0.92 }, hand: { type: "wrapped", color: P.skin, wrap: P.leatherD } };
    return { front: Object.assign({ pad: { color: P.steel, trim: P.gold, r: 12 } }, a), back: a };
  };
  DEFS.barbarian.legs = (P) => ({
    thigh: [[0, 1, 1.1, 1.04, P.pants]], shin: [[0, 1, 1.04, 1.08, P.pants], [0.5, 1, 1.14, 1.16, P.steel], [0.46, 0.56, 1.24, 1.22, P.fur]],
    goldBand: { seg: "shin", t: 0.62 },
    foot: { type: "boot", color: P.steel, dark: "#15181d", chunky: true, trim: P.gold },
  });
  DEFS.barbarian.torso = (P) => ({
    base: P.leather,
    bands: [[0.02, 0.16, P.leatherD]],
    shapes: [
      { pts: [[0.16, 9], [0.95, -8], [1.0, -6], [0.22, 10]], color: P.leatherD, edge: P.gold },
      { pts: [[0.03, 4], [0.03, 9.4], [0.15, 9.4], [0.15, 4]], color: P.gold, edge: "#7a5a1f" },
      { pts: [[0.55, 2], [0.55, 9], [0.7, 9.6], [0.7, 2]], color: shade(P.leather, 0.12) },
    ],
    mantle: { fur: P.fur, tint: P.furB },
  });
  DEFS.barbarian.head = (P) => ({ skin: P.skin, helmet: { color: P.steel, light: P.steelL, trim: P.gold, horns: "#d8d2c4", visor: "#06080c" } });
  DEFS.barbarian.cloth = [
    { kind: "cape", at: "shoulderBack", n: 8, seg: 10, w0: 26, w1: 14, color: "#1f3f6e", color2: "#5fb8ff", layer: "back", gravity: 700, flutter: 260, ragged: true },
    { kind: "hair", at: "headTop", n: 7, seg: 7, w0: 9, w1: 3, color: "#121216", layer: "back", gravity: 700, wind: 0.8, tie: "#c99a3a" },
  ];

  DEFS.flame = {
    key: "flame", name: "NOVA", title: "Blue flame brawler", gender: "F", weapon: "flame", weaponDraw: null,
    body: { torso: 51, headR: 10.2, neck: 8.4, upper: 24.5, fore: 23.5, thigh: 38, shin: 37, foot: 10, limb: [8.2, 7, 11.6, 9.2],
      front: [4.8, 2.6, 6.4, 4], back: [7.4, 3, 4.2, 4.6], neckW: 5.6 },
    style: { speedK: 1.04, tempo: 0.88 },
    trail: "110, 160, 255",
    pal: { outline: "#0a0b13", skin: "#6b4a3c", hair: "#1c1d24", top: "#16171d", jacket: "#5b6878", jacketD: "#3e4956", belt: "#46515e",
      pants: "#2b3039", pantsD: "#20242c", flame: "#5a8bff", core: "#bfe6ff", tattoo: "#8fc4ff", eye: "#c45cff", accent: "#5a8bff" },
  };
  DEFS.flame.arms = (P) => {
    const a = { upper: [[0, 0.5, 1.22, 1.16, P.jacket], [0.44, 0.52, 1.24, 1.22, P.jacketD], [0.5, 1, 1, 0.95, P.skin]],
      fore: [[0, 1, 1, 1.02, P.skin], [0.78, 1, 1.12, 1.12, P.top]], tattoo: P.tattoo, hand: { type: "glove", color: P.top, flame: true } };
    return { front: a, back: a };
  };
  DEFS.flame.legs = (P) => ({
    thigh: [[0, 1, 1.1, 1.16, P.pants]], shin: [[0, 0.72, 1.18, 1.22, P.pants], [0.62, 0.8, 1.32, 1.3, P.pantsD]],
    strap: { seg: "thigh", t: 0.32, color: P.pantsD, front: true },
    foot: { type: "boot", color: P.pantsD, dark: "#101216" },
  });
  DEFS.flame.torso = (P) => ({
    base: P.skin,
    bands: [[0, 0.12, P.pants], [0.07, 0.16, P.belt], [0.6, 0.92, P.top]],
    shapes: [
      { pts: [[0.08, 2.2], [0.08, 6.2], [0.15, 6.2], [0.15, 2.2]], color: "#8b96a3" },
      { pts: [[0.56, -9], [0.56, -1], [0.98, -1], [1.06, -9]], color: P.jacket, edge: P.jacketD },
      { pts: [[0.56, 3.6], [0.56, 7], [1.0, 5.8], [1.0, 2.6]], color: P.jacket, edge: P.jacketD },
      { tattoo: [[0.3, 2], [0.42, 3.4], [0.5, 1.6]], color: P.tattoo },
    ],
    collar: P.jacket,
  });
  DEFS.flame.head = (P) => ({ skin: P.skin, hair: { style: "sidecut", color: P.hair }, eye: P.eye, eyeGlow: true, brow: true, hoop: "#c9ccd3", lips: "#3f2620" });
  DEFS.flame.cloth = [{ kind: "braid", at: "headBack", n: 9, seg: 7, w0: 8, w1: 4, color: "#1c1d24", layer: "back", gravity: 1000, wind: 0.3, tie: "#8fc4ff" }];

  DEFS.dancer = {
    key: "dancer", name: "SUVARNA", title: "Golden four-arm dancer", gender: "F", weapon: "dance", weaponDraw: null,
    body: { torso: 50, headR: 10, neck: 8.6, upper: 24, fore: 23, thigh: 39, shin: 37.5, foot: 10.4, limb: [7.6, 6.6, 15.6, 11.4],
      front: [5, 2.8, 6.8, 3.8], back: [7, 3.2, 4.2, 4.4], neckW: 6, arms4: true },
    style: { speedK: 1.06, tempo: 0.85, sway: 4.2, pelvis: 4, lead: 1, breath: 1.2, bounce: 0 },
    trail: "255, 200, 90",
    pal: { outline: "#3a1d10", skin: "#c98b5f", hair: "#16121a", yellow: "#f2c04c", yellowD: "#d4952a", cream: "#f3e2b2", gold: "#e8b23a",
      red: "#e2532c", teal: "#2aa59a", orange: "#e98a2c", accent: "#e8b23a" },
  };
  DEFS.dancer.arms = (P) => {
    const a = { upper: [[0, 1, 1, 0.95, P.skin], [0.26, 0.4, 1.3, 1.28, P.gold]], fore: [[0, 1, 1, 1.0, P.skin], [0.74, 0.96, 1.32, 1.36, P.gold]],
      bangles: { seg: "fore", t0: 0.74, t1: 0.96, color: shade(P.gold, -0.3) }, hand: { type: "open", color: P.skin } };
    return { front: a, back: a, lower: a };
  };
  DEFS.dancer.legs = (P) => ({
    thigh: [[0, 1, 1.08, 1.24, P.yellow]], shin: [[0, 0.56, 1.3, 1.16, P.yellow], [0.5, 0.62, 1.04, 0.86, P.yellowD], [0.58, 0.94, 0.78, 0.72, P.orange]],
    wraps: { seg: "shin", t0: 0.6, t1: 0.93, color: shade(P.orange, -0.25) },
    foot: { type: "bare", color: P.skin },
  });
  DEFS.dancer.torso = (P) => ({
    base: P.skin,
    bands: [[0, 0.06, P.yellow], [0.02, 0.13, P.red], [0.5, 0.6, P.cream], [0.6, 0.93, P.yellow]],
    shapes: [{ pts: [[0.03, 3.5], [0.1, 6.6], [0.13, 4], [0.06, 1.5]], color: shade(P.red, -0.15) }],
  });
  DEFS.dancer.head = (P) => ({ skin: P.skin, faceless: true, hair: { style: "bun", color: P.hair, tie: P.gold }, hoop: P.gold });
  DEFS.dancer.cloth = [
    { kind: "hair", at: "headTop", n: 10, seg: 7.6, w0: 12, w1: 5, color: "#16121a", layer: "back", gravity: 950, wind: 0.32 },
    { kind: "hair", at: "headBack", n: 8, seg: 7.4, w0: 10, w1: 4, color: "#211a24", layer: "back", gravity: 1000, wind: 0.28, phase: 1.4 },
    { kind: "panel", at: "waistFront", n: 6, seg: 8, w0: 10, w1: 9, color: "#2aa59a", color2: "#f2c04c", layer: "front", gravity: 700, flutter: 90 },
    { kind: "ribbon", at: "waistFront", n: 6, seg: 8, w0: 5, w1: 3, color: "#e2532c", layer: "front", gravity: 650, flutter: 160, phase: 1 },
    { kind: "ribbon", at: "waistFront", n: 5, seg: 8, w0: 5, w1: 3, color: "#c94524", layer: "front", gravity: 650, flutter: 140, phase: 2.2 },
    { kind: "ribbon", at: "armletBack", n: 4, seg: 6, w0: 5, w1: 2.6, color: "#f2c04c", layer: "back", gravity: 400, flutter: 200, phase: 0.6 },
    { kind: "ribbon", at: "armletFront", n: 4, seg: 6, w0: 5, w1: 2.6, color: "#f2c04c", layer: "front", gravity: 400, flutter: 200, phase: 1.6 },
  ];

  const ORDER = ["cyborg", "bluex", "voss", "barbarian", "flame", "dancer"];
  // Fill in the parts from each palette; the profile the controller needs.
  for (const k of ORDER) {
    const d = DEFS[k];
    d.parts = { arms: d.arms(d.pal), legs: d.legs(d.pal), torso: d.torso(d.pal), head: d.head(d.pal) };
    d.prof = { key: k, body: d.body, style: d.style };
  }

  // ---------------- Geometry helpers ----------------
  const lp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  // A tapered capsule between world points a and b (radii r0, r1), added to the current path.
  function capsulePath(ctx, a, b, r0, r1) {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.moveTo(a[0] + Math.cos(ang + Math.PI / 2) * r0, a[1] + Math.sin(ang + Math.PI / 2) * r0);
    ctx.arc(a[0], a[1], Math.max(0.1, r0), ang + Math.PI / 2, ang - Math.PI / 2);
    ctx.arc(b[0], b[1], Math.max(0.1, r1), ang - Math.PI / 2, ang + Math.PI / 2);
    ctx.closePath();
  }
  function capsule(ctx, a, b, r0, r1, fill) { ctx.beginPath(); capsulePath(ctx, a, b, r0, r1); ctx.fillStyle = fill; ctx.fill(); }

  // Faceted shading (the Tekken 3 look): flat bands of light and shadow across a form, from the one light.
  // Lit band, a flat middle, a shadow band and a deeper core shadow on the far edge, with hard steps.
  function bands(g, dl, k) {
    const hi = (0.05 + 0.2 * dl) * k, lo = (0.2 + 0.1 * (1 - dl)) * k;
    g.addColorStop(0, `rgba(255, 248, 236, ${hi})`); g.addColorStop(0.3, `rgba(255, 248, 236, ${hi})`);
    g.addColorStop(0.3, "rgba(0, 0, 0, 0)"); g.addColorStop(0.58, "rgba(0, 0, 0, 0)");
    g.addColorStop(0.58, `rgba(12, 8, 24, ${lo})`); g.addColorStop(0.84, `rgba(12, 8, 24, ${lo})`);
    g.addColorStop(0.84, `rgba(12, 8, 24, ${lo * 1.7})`); g.addColorStop(1, `rgba(12, 8, 24, ${lo * 1.7})`);
    return g;
  }
  // Across a form whose axis runs from a to b, half width r.
  function facetAxis(ctx, a, b, r, k) {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    let nx = -dy / d, ny = dx / d, dl = nx * LIGHT[0] + ny * LIGHT[1];
    if (dl < 0) { nx = -nx; ny = -ny; dl = -dl; }
    const c = lp(a, b, 0.5);
    return bands(ctx.createLinearGradient(c[0] + nx * r, c[1] + ny * r, c[0] - nx * r, c[1] - ny * r), dl, k === undefined ? 1 : k);
  }
  // Straight from the light across a round form centered at c (heads, hands, feet, pads).
  function facetDir(ctx, c, r, k) {
    return bands(ctx.createLinearGradient(c[0] + LIGHT[0] * r, c[1] + LIGHT[1] * r, c[0] - LIGHT[0] * r, c[1] - LIGHT[1] * r), 1, k === undefined ? 1 : k);
  }
  // A limb segment from world a to world b with layers: a thin dark edge, the flat costume colors, then the
  // faceted shading over the whole segment. thick: extra width near the start (fuller upper thighs).
  function limb(ctx, a, b, base, layers, tint, ghost, thick) {
    const r = (k, t) => (base * k) / 2 * (thick ? 1 + thick * Math.max(0, 1 - t * 1.6) : 1);
    for (const [t0, t1, k0, k1] of layers) capsule(ctx, lp(a, b, t0), lp(a, b, t1), r(k0, t0) + OL, r(k1, t1) + OL, ghost || tint.ol);
    for (const [t0, t1, k0, k1, c] of layers) capsule(ctx, lp(a, b, t0), lp(a, b, t1), r(k0, t0), r(k1, t1), ghost || tint.c(c));
    if (ghost || tint.flat) return;
    ctx.beginPath();
    let wmax = 0;
    for (const [t0, t1, k0, k1] of layers) { capsulePath(ctx, lp(a, b, t0), lp(a, b, t1), r(k0, t0), r(k1, t1)); wmax = Math.max(wmax, r(k0, t0), r(k1, t1)); }
    ctx.fillStyle = facetAxis(ctx, a, b, wmax + 0.5); ctx.fill();
  }
  function smoothPath(ctx, pts) {
    const n = pts.length, mid = (i) => { const u = pts[i % n], v = pts[(i + 1) % n]; return [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2]; };
    ctx.beginPath(); const m0 = mid(n - 1); ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const m = mid(i); ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
    ctx.closePath();
  }
  function polyPath(ctx, pts) { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); }

  // A point on the torso in local space: t along the (bent) torso from hip (0) to shoulder (1), n across it.
  function torsoLocal(S, t, n) {
    const lower = t <= 0.5, k = lower ? t * 2 : (t - 0.5) * 2, a0 = lower ? S.L.hip : S.L.mid, a1 = lower ? S.L.mid : S.L.sh;
    const ang = ((lower ? S.tdir : S.tdir2) - 90) * DEG;
    const c = [lerp(a0[0], a1[0], k), lerp(a0[1], a1[1], k)];
    return [c[0] + Math.cos(ang) * n, c[1] - Math.sin(ang) * n];
  }
  const torsoPt = (S, t, n) => S.xf(torsoLocal(S, t, n));
  // A point in the head's frame: f forward, u up (in units of the head radius).
  function headLocal(S, f, u) {
    const R = S.B.headR, a = (S.tdir2 + S.p.head - 90) * DEG, h = S.L.head;
    const fx = Math.cos(a), fy = -Math.sin(a), ux = Math.cos(a + Math.PI / 2), uy = -Math.sin(a + Math.PI / 2);
    return [h[0] + (fx * f + ux * u) * R, h[1] + (fy * f + uy * u) * R];
  }
  const headPt = (S, f, u) => S.xf(headLocal(S, f, u));

  // ---------------- Cloth (verlet strands) ----------------
  function anchor(S, it) {
    const L = S.L, p = S.p;
    switch (it.c.at) {
      case "headTop": return headPt(S, -0.78, 0.72);
      case "headBack": return headPt(S, -0.9, 0.1);
      case "waistFront": return torsoPt(S, 0.06, (S.B.front[0] || 4) + 1);
      case "shoulderBack": return torsoPt(S, 0.95, -(S.B.back[3] || 6));
      case "weapon": return S.wpt(L.fh, p.w, it.c.u, it.c.v || 0);
      case "armletBack": return S.xf(lp(L.sb, L.be, 0.36), -1);
      case "armletFront": return S.xf(lp(L.sf, L.fe, 0.36), 1);
    }
    return S.J.hip;
  }
  function makeCloth(def) {
    return def.cloth.map((c) => ({ c, ch: new Rig.Chain(c.n, c.seg, { gravity: c.gravity !== undefined ? c.gravity : 800, flutter: c.flutter || 80,
      damp: c.damp || 0.95, phase: c.phase || 0, wind: c.wind || (c.kind === "cape" ? 1.2 : c.kind === "hair" || c.kind === "braid" ? 0.25 : 0.6) }) }));
  }
  function stepCloth(cloth, S, dt, floorY, t, vel) {
    const wind = [-S.facing * 220 - vel * 2.2, -60];
    for (const it of cloth) {
      const k = it.ch.opt.wind;
      it.ch.step(anchor(S, it), dt, [wind[0] * k, wind[1] * k], floorY, t);
    }
  }
  function resetCloth(cloth, S) { for (const it of cloth) it.ch.reset(anchor(S, it), S.facing); }

  function drawStrand(ctx, it, tint, ghost) {
    const c = it.c, pts = it.ch.p;
    if (c.kind === "chain") {
      for (let i = 1; i < pts.length; i++) { ctx.strokeStyle = ghost || "#2b2e33"; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
      for (let i = 0; i < pts.length; i++) { ctx.strokeStyle = ghost || c.color; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 2, 0, Math.PI * 2); ctx.stroke(); }
      return;
    }
    // Outline, then fill.
    Rig.ribbon(ctx, pts, c.w0 + OL * 2, c.w1 + OL * 2, ghost || tint.ol, c.ragged);
    Rig.ribbon(ctx, pts, c.w0, c.w1, ghost || tint.c(c.color), c.ragged);
    if (ghost) return;
    if (!tint.flat && (c.kind === "hair" || c.kind === "braid" || c.kind === "cape")) {
      // A lit streak on the side toward the light.
      const q = pts.map((v) => [v[0] + LIGHT[0] * c.w0 * 0.2, v[1] + LIGHT[1] * c.w0 * 0.2]);
      Rig.ribbon(ctx, q.slice(0, -1), c.w0 * 0.32, c.w1 * 0.3, tint.c(shade(c.color2 && c.kind !== "cape" ? c.color2 : c.color, 0.3)), false);
    }
    if (c.kind === "cape" && c.color2) {
      // A glowing edge along the cape's free side.
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = c.color2; ctx.globalAlpha = 0.55; ctx.lineWidth = 2.4;
      ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.restore();
    }
    if (c.kind === "braid") {
      ctx.strokeStyle = shade(c.color, 0.25); ctx.lineWidth = 1.2;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], m = lp(a, b, 0.5), dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = lerp(c.w0, c.w1, i / pts.length) / 2;
        ctx.beginPath(); ctx.moveTo(m[0] - (dy / d) * w, m[1] + (dx / d) * w); ctx.lineTo(b[0] + (dy / d) * w * 0.3, b[1] - (dx / d) * w * 0.3); ctx.stroke();
      }
    }
    if (c.kind === "panel" && c.color2) {
      // Yellow leaf pattern on the teal panel.
      ctx.fillStyle = c.color2;
      for (let i = 1; i < pts.length - 1; i++) { ctx.beginPath(); ctx.ellipse(pts[i][0], pts[i][1], 2.2, 1.2, i, 0, Math.PI * 2); ctx.fill(); }
    }
    if (c.tie) Rig.dot(ctx, pts[1], 3.2, c.tie);
  }

  // ---------------- Body parts ----------------
  function drawFoot(ctx, S, ankle, deg, side, F, tint, ghost) {
    const f = S.B.foot, q = (u, v) => Rig.footPt(S, ankle, deg, u, v, side);
    const fill = (pts, c) => { polyPath(ctx, pts); ctx.fillStyle = ghost || tint.c(c); ctx.fill(); };
    const out = (pts, w) => { polyPath(ctx, pts); ctx.strokeStyle = ghost || tint.ol; ctx.lineWidth = w || OL * 2; ctx.stroke(); };
    let shape;
    if (F.type === "bare") shape = [q(-3, 0), q(f, 0), q(f + 1, 2), q(f - 2, 3.4), q(1, 5), q(-3, 4.4)];
    else if (F.chunky) shape = [q(-5, -1.5), q(f + 2, -1.5), q(f + 3, 3), q(f - 1, 5.5), q(1, 8), q(-5, 7)];
    else shape = [q(-4.5, -1), q(f + 1, -1), q(f + 2, 3), q(f - 2, 5), q(1, 7), q(-4.5, 6)];
    out(shape, OL * 2); fill(shape, F.color);
    if (ghost) return;
    if (!tint.flat) { polyPath(ctx, shape); ctx.fillStyle = facetDir(ctx, q(f * 0.4, 3), 9, 0.8); ctx.fill(); }
    if (F.type === "sneaker") {
      fill([q(-4.5, -1), q(f + 1.5, -1), q(f + 1.5, 0.8), q(-4.5, 0.8)], "#f4f4f6");
      fill([q(1, 2), q(f - 3, 1.5), q(f - 5, 3), q(2, 3.5)], F.dark);
      fill([q(-4.5, 4.4), q(1, 6.8), q(-1, 7.6), q(-4.5, 6.6)], F.accent);
    } else if (F.dark) fill([q(-4.5, -1.5), q(f + 2, -1.5), q(f + 2, 0.6), q(-4.5, 0.6)], F.dark);
    if (F.trim) fill([q(-5, 5.5), q(2, 7.2), q(1, 8.4), q(-5, 7.2)], F.trim);
  }

  function drawHand(ctx, S, hand, wrist, H, tint, ghost, open, t) {
    const color = ghost || tint.c(H.color);
    if (ghost) { Rig.dot(ctx, hand, 4.8, ghost); return; }
    if (open || H.type === "open") {
      Rig.openHand(ctx, hand, wrist, tint.ol, false);
      const dx = hand[0] - wrist[0], dy = hand[1] - wrist[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      ctx.save(); ctx.translate(0, 0);
      ctx.strokeStyle = color; ctx.lineCap = "round";
      ctx.lineWidth = 5.4; ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.lineTo(hand[0] + ux * 6, hand[1] + uy * 6); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hand[0] + ux * 4, hand[1] + uy * 4); ctx.lineTo(hand[0] + ux * 10.5, hand[1] + uy * 10.5); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.lineTo(hand[0] + ux * 3 - uy * 4.6, hand[1] + uy * 3 + ux * 4.6); ctx.stroke();
      ctx.restore();
      return;
    }
    const r = H.type === "gauntlet" ? 6.4 : H.type === "mech" ? 6 : 5.6;
    Rig.dot(ctx, hand, r + OL, tint.ol);
    Rig.dot(ctx, hand, r, color);
    if (!tint.flat) { ctx.beginPath(); ctx.arc(hand[0], hand[1], r, 0, Math.PI * 2); ctx.fillStyle = facetDir(ctx, hand, r); ctx.fill(); }
    if (H.type === "mech") { ctx.strokeStyle = tint.c(H.dark); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(hand[0], hand[1], r - 2, 0.4, 2.6); ctx.stroke(); }
    if (H.type === "wrapped") { ctx.strokeStyle = tint.c(H.wrap); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hand[0] - 4, hand[1] - 2); ctx.lineTo(hand[0] + 4, hand[1] + 2); ctx.stroke(); }
    if (H.accent) Rig.dot(ctx, hand, 2, tint.c(H.accent));
  }

  // Thin decorations along a bone (glow lines, stripes, tattoos).
  function boneLine(ctx, a, b, t0, t1, off, color, w, glow, cap) {
    const p0 = lp(a, b, t0), p1 = lp(a, b, t1), dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d * off, ny = dx / d * off;
    ctx.save();
    if (glow) { ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = color; ctx.globalAlpha = 0.35; ctx.lineWidth = w + 4; ctx.beginPath(); ctx.moveTo(p0[0] + nx, p0[1] + ny); ctx.lineTo(p1[0] + nx, p1[1] + ny); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = cap || "round";
    ctx.beginPath(); ctx.moveTo(p0[0] + nx, p0[1] + ny); ctx.lineTo(p1[0] + nx, p1[1] + ny); ctx.stroke();
    ctx.restore();
  }
  function band(ctx, a, b, t0, t1, color, w) { boneLine(ctx, a, b, t0, t1, 0, color, w, false, "butt"); }
  function camoDots(ctx, a, b, t0, t1, w, blue) {
    for (let i = 0; i < 4; i++) {
      const p = lp(a, b, lerp(t0, t1, (i + 0.5) / 4)), dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, o = ((i % 2) - 0.5) * w * 0.5;
      ctx.fillStyle = blue; ctx.beginPath(); ctx.ellipse(p[0] - dy / d * o, p[1] + dx / d * o, w * 0.28, w * 0.2, Math.atan2(dy, dx), 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawArm(ctx, S, which, spec, tint, ghost, opt) {
    const B = S.B, J = S.J, p = S.p;
    const map = { front: ["sf", "fe", "fh", 1, "fa1", "fo"], back: ["sb", "be", "bh", -1, "ba1", "bo"], lowerF: ["lf", "fce", "fch", 1, "fc1", null], lowerB: ["lb", "bce", "bch", -1, "bc1", null] }[which];
    const [ks, ke, kh, side, foreKey, openKey] = map;
    const sJ = J[ks], eJ = J[ke], hJ = J[kh];
    const scaleW = which.startsWith("lower") ? 0.92 : 1;
    limb(ctx, sJ, eJ, B.limb[0] * scaleW, spec.upper, tint, ghost);
    limb(ctx, eJ, hJ, B.limb[1] * scaleW, spec.fore, tint, ghost);
    if (!ghost) {
      if (spec.glow) { boneLine(ctx, sJ, eJ, 0.15, 0.85, 1.6, spec.glow, 1.4, true); boneLine(ctx, eJ, hJ, 0.1, 0.9, -1.4, spec.glow, 1.4, true); }
      if (spec.tattoo) { boneLine(ctx, eJ, hJ, 0.15, 0.6, 1.2, spec.tattoo, 1.1, true); boneLine(ctx, sJ, eJ, 0.6, 0.95, -1, spec.tattoo, 1, true); }
      if (spec.camo) camoDots(ctx, eJ, hJ, spec.camo.t0, spec.camo.t1, B.limb[1] * 1.2, tint.c("#2f5fc4"));
      if (spec.bangles) for (let k = 0; k < 4; k++) { const t = lerp(spec.bangles.t0, spec.bangles.t1, (k + 0.5) / 4); band(ctx, eJ, hJ, t - 0.012, t + 0.012, tint.c(spec.bangles.color), B.limb[1] * scaleW * 1.36); }
      if (spec.goldBand) band(ctx, eJ, hJ, spec.goldBand.t - 0.04, spec.goldBand.t + 0.04, tint.c("#c99a3a"), B.limb[1] * 1.16);
    }
    const wrist = S.xf(pt(S.L[kh], -9, p[foreKey] !== undefined ? p[foreKey] : 0), side);
    const open = openKey ? (p[openKey] || 0) > 0.5 : false;
    drawHand(ctx, S, hJ, wrist, spec.hand, tint, ghost, open, opt.t);
    return { hand: hJ, wrist };
  }
  function drawPad(ctx, S, which, pad, tint, ghost) {
    if (!pad || ghost) return;
    const shadeIt = !tint.flat;
    const J = S.J, s = which === "front" ? J.sf : J.sb, e = which === "front" ? J.fe : J.be;
    const c = lp(s, e, 0.12), r = pad.r;
    const ang = Math.atan2(e[1] - s[1], e[0] - s[0]);
    ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95 + OL, r * 0.78 + OL, 0, 0, Math.PI * 2); ctx.fillStyle = tint.ol; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.78, 0, 0, Math.PI * 2); ctx.fillStyle = tint.c(pad.color); ctx.fill();
    if (shadeIt) { const l = [LIGHT[0] * Math.cos(ang) + LIGHT[1] * Math.sin(ang), -LIGHT[0] * Math.sin(ang) + LIGHT[1] * Math.cos(ang)];
      const g = bands(ctx.createLinearGradient(l[0] * r, l[1] * r, -l[0] * r, -l[1] * r), 1, 1); ctx.fillStyle = g; ctx.fill(); }
    if (pad.camo) { ctx.fillStyle = tint.c("#2f5fc4"); for (const [x, y, rx] of [[-3, -2, 3.2], [3, 2.5, 2.4], [4, -3.5, 1.8]]) { ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.7, 0.5, 0, Math.PI * 2); ctx.fill(); } }
    ctx.strokeStyle = tint.c(pad.trim); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95 - 1.5, r * 0.78 - 1.5, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    ctx.restore();
  }

  function drawLeg(ctx, S, which, spec, tint, ghost) {
    const B = S.B, J = S.J, p = S.p, side = which === "front" ? 1 : -1;
    const h = which === "front" ? J.hf : J.hb, k = which === "front" ? J.fk : J.bk, a = which === "front" ? J.ff : J.bf;
    limb(ctx, h, k, B.limb[2], spec.thigh, tint, ghost, S.fem ? 0.16 : 0);
    limb(ctx, k, a, B.limb[3], spec.shin, tint, ghost);
    if (!ghost) {
      const segs = { thigh: [h, k, B.limb[2]], shin: [k, a, B.limb[3]] };
      if (spec.stripe) { const [x, y] = segs[spec.stripe.seg]; boneLine(ctx, x, y, spec.stripe.t0, spec.stripe.t1, side * 1.5, tint.c(spec.stripe.color), 1.8); }
      if (spec.glowLine) { const [x, y] = segs[spec.glowLine.seg]; boneLine(ctx, x, y, spec.glowLine.t0, spec.glowLine.t1, 2, spec.glowLine.color, 1.3, true); }
      if (spec.pinstripes) for (const sg of spec.pinstripes.segs) { const [x, y, w] = segs[sg]; for (const o of [-w * 0.28, w * 0.1, w * 0.45]) boneLine(ctx, x, y, 0.05, 0.98, o, tint.c(spec.pinstripes.color), 0.9); }
      if (spec.pinstripes) { const [x, y, w] = segs.shin; for (const o of [-w * 0.25, w * 0.2]) boneLine(ctx, x, y, 0.02, 0.42, o, tint.c(spec.pinstripes.color), 0.9); }
      if (spec.strap && (!spec.strap.front || which === "front")) { const [x, y, w] = segs[spec.strap.seg]; const q = lp(x, y, spec.strap.t); band(ctx, x, y, spec.strap.t - 0.05, spec.strap.t + 0.05, tint.c(spec.strap.color), w * 1.2); Rig.dot(ctx, q, 1.6, tint.c("#8a9099")); }
      if (spec.camo) { const [x, y, w] = segs[spec.camo.seg]; camoDots(ctx, x, y, spec.camo.t0, spec.camo.t1, w * 1.2, tint.c("#2f5fc4")); }
      if (spec.kneeTrim) boneLine(ctx, k, a, 0.02, 0.18, side * 2.5, tint.c(spec.kneeTrim), 1.6);
      if (spec.wraps) { const [x, y, w] = segs[spec.wraps.seg]; for (let i = 0; i < 6; i++) { const t = lerp(spec.wraps.t0, spec.wraps.t1, i / 5); band(ctx, x, y, t - 0.008, t + 0.008, tint.c(spec.wraps.color), w * 0.8); } }
      if (spec.goldBand) { const [x, y, w] = segs[spec.goldBand.seg]; band(ctx, x, y, spec.goldBand.t - 0.03, spec.goldBand.t + 0.03, tint.c("#c99a3a"), w * 1.18); }
    }
    drawFoot(ctx, S, which === "front" ? S.L.ff : S.L.bf, which === "front" ? p.ffa || 0 : p.bfa || 0, side, spec.foot, tint, ghost);
  }

  // The side silhouette of the torso as [t, n] points (t 0 hip to 1 shoulder, n positive toward the chest).
  // Women: bust, a narrow waist and fuller hips; men: a broad, squarer chest and back.
  function torsoProfile(S) {
    const F = S.B.front, Bk = S.B.back;
    const front = S.fem
      ? [[0, F[0]], [0.18, F[0] * 0.86], [0.4, F[1]], [0.55, F[1] + 0.6], [0.63, F[2] + 3.6], [0.74, F[2] + 3.8], [0.84, F[2] * 0.86], [1, F[3]]]
      : [[0, F[0]], [0.3, F[1]], [0.56, F[2] * 0.94], [0.72, F[2] * 1.06], [0.86, F[2] * 1.02], [1, F[3]]];
    const back = S.fem
      ? [[0, Bk[0] + 1.8], [0.1, Bk[0] + 1.6], [0.24, Bk[0] * 0.8], [0.42, Bk[1]], [0.72, Bk[2]], [1, Bk[3]]]
      : [[0, Bk[0]], [0.3, Bk[1]], [0.62, Bk[2] * 1.02], [0.82, Bk[2] * 1.08], [1, Bk[3]]];
    return front.concat(back.reverse().map(([t, n]) => [t, -n]));
  }
  function drawTorso(ctx, S, T, tint, ghost) {
    const B = S.B, pts = torsoProfile(S).map(([t, n]) => torsoPt(S, t, n));
    smoothPath(ctx, pts);
    ctx.strokeStyle = ghost || tint.ol; ctx.lineWidth = OL * 2; ctx.lineJoin = "round"; ctx.stroke();
    ctx.fillStyle = ghost || tint.c(T.base); ctx.fill();
    if (ghost) return;
    ctx.save();
    smoothPath(ctx, pts); ctx.clip();
    if (T.scales) {
      ctx.strokeStyle = tint.c(T.scales); ctx.lineWidth = 1;
      for (let t = 0.2; t < 0.95; t += 0.07) for (let n = -8; n < 8; n += 4) { const q = torsoPt(S, t, n + ((t * 100) % 2 ? 2 : 0)); ctx.beginPath(); ctx.arc(q[0], q[1], 2.2, 0.2, Math.PI - 0.2); ctx.stroke(); }
    }
    for (const [t0, t1, c] of T.bands) { polyPath(ctx, [torsoPt(S, t0, -30), torsoPt(S, t0, 30), torsoPt(S, t1, 30), torsoPt(S, t1, -30)]); ctx.fillStyle = tint.c(c); ctx.fill(); }
    for (const sh of T.shapes) {
      if (sh.pts) {
        const w = sh.pts.map(([t, n]) => torsoPt(S, t, n));
        polyPath(ctx, w); ctx.fillStyle = tint.c(sh.color); ctx.fill();
        if (sh.edge) { ctx.strokeStyle = tint.c(sh.edge); ctx.lineWidth = 1.4; ctx.stroke(); }
        if (sh.camo) { ctx.fillStyle = tint.c("#2f5fc4"); for (const [t, n, r] of [[0.84, 3, 2.6], [0.92, -1, 2], [0.76, 1, 1.6]]) { const q = torsoPt(S, t, n); ctx.beginPath(); ctx.ellipse(q[0], q[1], r * 1.3, r, 0.4, 0, Math.PI * 2); ctx.fill(); } }
      }
      if (sh.x) {
        const c = torsoPt(S, sh.x.t, sh.x.n), r = sh.x.size / 2;
        ctx.lineCap = "butt";
        for (const [col, w] of [[sh.x.edge, 4.6], [sh.x.color, 2.6]]) { ctx.strokeStyle = tint.c(col); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(c[0] - r, c[1] - r); ctx.lineTo(c[0] + r, c[1] + r); ctx.moveTo(c[0] - r, c[1] + r); ctx.lineTo(c[0] + r, c[1] - r); ctx.stroke(); }
        ctx.lineCap = "round";
      }
      if (sh.spots) for (const [t, n, r] of sh.spots) { const q = torsoPt(S, t, n); ctx.fillStyle = tint.c(sh.color); ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill(); }
      if (sh.tattoo) { ctx.strokeStyle = sh.color; ctx.globalAlpha = 0.8; ctx.lineWidth = 1; ctx.beginPath(); sh.tattoo.forEach(([t, n], i) => { const q = torsoPt(S, t, n); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    if (!tint.flat) {
      const F = B.front, line = (list, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); list.forEach(([t, n], i) => { const q = torsoPt(S, t, n); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); };
      if (S.fem) {
        // The bust: a soft lit plane on top and a shadow fold underneath.
        line([[0.58, F[1] - 1.5], [0.58, F[1] + 1.4], [0.63, F[2] + 3.4]], "rgba(12, 8, 24, 0.34)", 1.6);
        const hq = torsoPt(S, 0.74, F[2] + 1.6); ctx.fillStyle = "rgba(255, 248, 236, 0.13)"; ctx.beginPath(); ctx.ellipse(hq[0], hq[1], 2.6, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        // The chest: a pectoral fold and a shoulder blade line.
        line([[0.64, 0], [0.62, F[2] * 0.6], [0.66, F[2] * 1.02]], "rgba(12, 8, 24, 0.26)", 1.4);
        line([[0.86, -B.back[2] * 0.4], [0.7, -B.back[2] * 0.75]], "rgba(12, 8, 24, 0.2)", 1.2);
      }
      smoothPath(ctx, pts); ctx.fillStyle = facetAxis(ctx, torsoPt(S, 0, 0), torsoPt(S, 1, 0), Math.max(B.front[2], B.back[2]) + 4); ctx.fill();
      // Top light: the lower torso and the belt line sit a step darker.
      polyPath(ctx, [torsoPt(S, -0.1, -30), torsoPt(S, -0.1, 30), torsoPt(S, 0.18, 30), torsoPt(S, 0.18, -30)]); ctx.fillStyle = "rgba(12, 8, 24, 0.12)"; ctx.fill();
    }
    ctx.restore();
  }

  // The barbarian's fur mantle over the shoulders.
  function drawMantle(ctx, S, M, tint, ghost) {
    const pts = [];
    // Around the shoulders and down the back, open at the chest.
    for (let i = 0; i <= 12; i++) {
      const a = i / 12, n = lerp(-S.B.back[3] - 10, S.B.front[3] - 1, a);
      pts.push(torsoPt(S, 1.1 + Math.sin(a * Math.PI) * 0.06 + (i % 2 ? 0.05 : 0), n));
    }
    for (let i = 12; i >= 0; i--) { const a = i / 12, n = lerp(-S.B.back[3] - 13, S.B.front[3] - 2, a); pts.push(torsoPt(S, lerp(0.56, 0.9, a * a) - (i % 2 ? 0.09 : 0.02), n)); }
    smoothPath(ctx, pts);
    ctx.strokeStyle = ghost || tint.ol; ctx.lineWidth = OL * 2; ctx.stroke();
    ctx.fillStyle = ghost || tint.c(M.fur); ctx.fill();
    if (ghost) return;
    ctx.fillStyle = tint.c(M.tint); ctx.globalAlpha = 0.55;
    for (let i = 0; i < 5; i++) { const q = torsoPt(S, 0.7 + (i % 2) * 0.12, -S.B.back[3] - 4 + i * 4); ctx.beginPath(); ctx.ellipse(q[0], q[1], 4, 2.4, i, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  function drawHead(ctx, S, H, tint, ghost) {
    const J = S.J, R = S.B.headR;
    const hp = (f, u) => headPt(S, f, u);
    const lit = !ghost && !tint.flat;
    const shape = (list, color, edge, poly) => {
      const w = list.map(([f, u]) => hp(f, u));
      (poly ? polyPath : smoothPath)(ctx, w);
      if (edge !== false) { ctx.strokeStyle = ghost || tint.ol; ctx.lineWidth = OL * 2; ctx.stroke(); }
      ctx.fillStyle = ghost || tint.c(color); ctx.fill();
      if (lit) { ctx.fillStyle = facetDir(ctx, J.head, R * 1.15, 0.6); ctx.fill(); }
    };
    if (H.hood && !ghost) shape([[-1.2, -0.2], [-1.35, 0.6], [-0.7, 0.9], [-0.2, 0.5], [-0.3, -0.6], [-0.9, -0.9]], H.hood);
    // Skull and face in profile: forehead, brow, nose, lips, chin and jaw. Men: a heavier brow, a bigger
    // nose and a square jaw angle; women: a small nose, fuller lips and a soft, narrow chin.
    const fem = S.fem;
    const skull = H.faceless
      ? [[-0.95, 0.15], [-0.8, 0.78], [-0.3, 1.02], [0.3, 0.98], [0.74, 0.66], [0.9, 0.2], [0.88, -0.3], [0.7, -0.72], [0.38, -0.95], [0.02, -0.82], [-0.3, -0.55], [-0.62, -0.42], [-0.92, -0.14]]
      : fem
      ? [[-0.95, 0.15], [-0.8, 0.78], [-0.3, 1.02], [0.3, 0.98], [0.72, 0.68], [0.86, 0.34], [0.84, 0.16], [0.9, 0.02], [1.0, -0.15], [0.88, -0.24], [0.92, -0.36], [0.84, -0.46], [0.88, -0.56], [0.76, -0.68], [0.7, -0.84], [0.44, -0.94], [0.08, -0.8], [-0.24, -0.56], [-0.62, -0.42], [-0.92, -0.14]]
      : [[-0.95, 0.18], [-0.8, 0.8], [-0.3, 1.04], [0.32, 1.0], [0.76, 0.7], [0.9, 0.36], [0.94, 0.2], [0.9, 0.08], [0.98, -0.04], [1.12, -0.2], [0.94, -0.3], [0.96, -0.42], [0.88, -0.52], [0.9, -0.62], [0.82, -0.72], [0.86, -0.92], [0.58, -1.04], [0.2, -0.98], [-0.12, -0.7], [-0.2, -0.5], [-0.6, -0.44], [-0.94, -0.12]];
    shape(skull, H.skin, true, !fem && !H.faceless);
    if (ghost) return;
    if (H.helmet) {
      const h = H.helmet;
      shape([[-1.08, -0.2], [-1.05, 0.55], [-0.5, 1.08], [0.25, 1.1], [0.8, 0.7], [1.05, 0.15], [1.04, -0.55], [0.6, -1.0], [-0.2, -1.05], [-0.8, -0.8]], h.color);
      shape([[0.15, 0.2], [1.02, 0.18], [1.0, -0.12], [0.2, -0.1]], h.visor, false);
      shape([[-0.25, 1.05], [0.4, 1.08], [0.2, 0.6], [-0.3, 0.7]], h.light, false);
      ctx.strokeStyle = tint.c(h.trim); ctx.lineWidth = 2;
      ctx.beginPath(); [[0.1, 1.08], [0.4, 0.55], [0.95, 0.25]].forEach(([f, u], i) => { const q = hp(f, u); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
      // Horns.
      shape([[-0.2, 0.9], [-0.55, 1.45], [-0.95, 1.6], [-0.6, 1.25], [-0.45, 0.85]], h.horns);
      return;
    }
    // Hair.
    const hr = H.hair;
    if (hr) H.hairCol = hr.color;
    if (hr) {
      if (hr.style === "spiky") shape([[-1.05, 0.0], [-1.0, 0.7], [-0.7, 1.2], [-0.35, 1.0], [-0.1, 1.35], [0.25, 1.05], [0.6, 1.2], [0.75, 0.8], [0.95, 0.55], [0.55, 0.45], [-0.3, 0.3], [-0.85, -0.3]], hr.color);
      if (hr.style === "fade") shape([[-1.0, -0.1], [-0.95, 0.6], [-0.4, 1.06], [0.4, 1.06], [0.85, 0.65], [0.5, 0.5], [-0.4, 0.25], [-0.8, -0.35]], hr.color);
      if (hr.style === "swept") shape([[-1.08, -0.4], [-1.05, 0.6], [-0.5, 1.12], [0.3, 1.12], [0.85, 0.7], [1.0, 0.25], [0.55, 0.55], [0.0, 0.5], [-0.55, 0.0], [-0.75, -0.8]], hr.color);
      if (hr.style === "sidecut") shape([[-1.05, -0.5], [-1.05, 0.55], [-0.5, 1.1], [0.35, 1.1], [0.9, 0.7], [1.05, 0.1], [0.75, -0.25], [0.55, 0.45], [-0.1, 0.45], [-0.6, -0.1], [-0.8, -0.9]], hr.color);
      if (hr.style === "bun") {
        shape([[-1.06, -0.6], [-1.05, 0.55], [-0.5, 1.08], [0.35, 1.08], [0.9, 0.68], [0.98, 0.3], [0.4, 0.62], [-0.3, 0.45], [-0.75, -0.2], [-0.9, -1.0]], hr.color);
        shape([[-0.75, 0.95], [-0.45, 1.5], [0.0, 1.45], [0.05, 1.05]], hr.color);
        if (hr.tie) { const q = hp(-0.35, 1.12); Rig.dot(ctx, q, 2.6, tint.c(hr.tie)); }
      }
    }
    if (H.faceless) return earring(ctx, S, H, tint);
    if (H.beard) shape([[0.05, -0.15], [0.6, -0.28], [0.9, -0.5], [0.92, -0.62], [0.86, -0.96], [0.56, -1.08], [0.18, -1.0], [-0.14, -0.7], [-0.22, -0.3]], H.beard, false, true);
    const stroke = (list, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); list.forEach(([f, u], i) => { const q = hp(f, u); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); };
    const poly = (list, col) => { polyPath(ctx, list.map(([f, u]) => hp(f, u))); ctx.fillStyle = col; ctx.fill(); };
    // Ear, eye socket shadow, eye (white, iris), brow, lips.
    const ear = hp(-0.12, -0.05);
    ctx.fillStyle = tint.c(shade(H.skin, -0.22)); ctx.beginPath(); ctx.ellipse(ear[0], ear[1], R * 0.16, R * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    poly([[0.48, 0.24], [0.84, 0.22], [0.82, 0.02], [0.5, 0.04]], "rgba(12, 8, 24, 0.18)");
    poly([[0.56, 0.14], [0.8, 0.13], [0.74, 0.04], [0.58, 0.06]], tint.c("#f1ece4"));
    const e = hp(0.71, 0.09);
    if (H.eyeGlow) { ctx.save(); ctx.globalCompositeOperation = "lighter"; Rig.dot(ctx, e, R * 0.3, "rgba(196, 92, 255, 0.45)"); ctx.restore(); }
    Rig.dot(ctx, e, R * 0.07, tint.c(H.eye));
    if (fem) stroke([[0.54, 0.15], [0.7, 0.17], [0.84, 0.15], [0.9, 0.2]], tint.c("#120d10"), 1.3);
    else stroke([[0.56, 0.15], [0.8, 0.15]], tint.c("#120d10"), 0.9);
    if (H.brow) stroke(fem ? [[0.5, 0.3], [0.7, 0.36], [0.86, 0.3]] : [[0.48, 0.28], [0.9, 0.26]], tint.c(shade(H.hairCol || "#1a1418", -0.1)), fem ? 1.1 : 1.9);
    if (fem) poly([[0.9, -0.33], [0.98, -0.37], [0.92, -0.44], [0.97, -0.5], [0.86, -0.56], [0.82, -0.44]], tint.c(H.lips || shade(H.skin, -0.3)));
    else stroke([[0.88, -0.46], [0.97, -0.47]], "rgba(12, 8, 24, 0.5)", 1.1);
    if (!fem && !H.beard) stroke([[0.16, -0.9], [-0.1, -0.66]], "rgba(12, 8, 24, 0.22)", 1.4);
    if (H.stud) Rig.dot(ctx, hp(-0.15, -0.05), 1.2, tint.c(H.stud));
    earring(ctx, S, H, tint);
  }
  function earring(ctx, S, H, tint) {
    if (!H.hoop) return;
    const q = headPt(S, -0.12, -0.4);
    ctx.strokeStyle = tint.c(H.hoop); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(q[0], q[1], 2.8, 0, Math.PI * 2); ctx.stroke();
  }

  // Blue flames around a hand (drawn additively, flickering with time).
  function flames(ctx, hand, wrist, t, k, P) {
    const dx = hand[0] - wrist[0], dy = hand[1] - wrist[1], d = Math.hypot(dx, dy) || 1;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const ph = t * 9 + i * 1.7, r = (5 + 4 * k) * (0.7 + 0.3 * Math.sin(ph * 1.3));
      const x = hand[0] + Math.sin(ph) * 3 + (dx / d) * 2, y = hand[1] - 3 - ((ph * 3) % 9) * (1 + k);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(191, 230, 255, 0.85)"); g.addColorStop(0.45, "rgba(90, 139, 255, 0.55)"); g.addColorStop(1, "rgba(60, 80, 255, 0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Nova's spell orb: a ball of blue fire with a white-hot core, flame tongues licking upward, and a glow.
  function orb(ctx, S, opt, ghost) {
    const c = S.J.orb, k = Math.max(0.05, S.p.os), r = 7.5 * k, t = opt.t || 0, heat = opt.heat || 0;
    if (ghost) return; // afterimages show the body only; the orb has its own smear
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    let g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r * (3 + heat));
    g.addColorStop(0, "rgba(120, 170, 255, 0.5)"); g.addColorStop(0.4, "rgba(70, 110, 255, 0.18)"); g.addColorStop(1, "rgba(40, 60, 255, 0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], r * (3 + heat), 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) {
      // Tongues: teardrops rising off the top, each on its own flicker.
      const ph = t * 7 + i * 1.9, a = -Math.PI / 2 + Math.sin(ph * 0.7 + i) * 0.7, len = r * (1.2 + 0.6 * Math.sin(ph * 1.3) + 0.5 * heat), w = r * 0.45;
      const bx = c[0] + Math.cos(a) * r * 0.5, by = c[1] + Math.sin(a) * r * 0.5, tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len - ((ph * 2) % 3);
      const ng = ctx.createLinearGradient(bx, by, tx, ty);
      ng.addColorStop(0, "rgba(120, 175, 255, 0.7)"); ng.addColorStop(1, "rgba(60, 90, 255, 0)");
      ctx.fillStyle = ng; ctx.beginPath(); ctx.moveTo(bx - Math.sin(a) * w, by + Math.cos(a) * w); ctx.quadraticCurveTo(tx, ty, bx + Math.sin(a) * w, by - Math.cos(a) * w); ctx.closePath(); ctx.fill();
    }
    g = ctx.createRadialGradient(c[0] - r * 0.25, c[1] - r * 0.25, 0, c[0], c[1], r);
    g.addColorStop(0, "rgba(245, 252, 255, 1)"); g.addColorStop(0.35, "rgba(170, 215, 255, 0.95)"); g.addColorStop(0.75, "rgba(80, 130, 255, 0.8)"); g.addColorStop(1, "rgba(50, 80, 255, 0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, Math.PI * 2); ctx.fill();
    // A swirl inside the core.
    ctx.strokeStyle = "rgba(230, 245, 255, 0.55)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c[0], c[1], r * 0.55, t * 5, t * 5 + 2.2); ctx.stroke();
    ctx.restore();
  }

  // ---------------- The whole character ----------------
  // opt: { alpha, ghost (a color: draw a flat silhouette), t (time, for flames), heat (0..1 flame size), flash }
  function draw(ctx, S, def, cloth, opt) {
    opt = opt || {};
    const P = def.pal, parts = def.parts, ghost = opt.ghost || null, p = S.p;
    const front = { ol: EDGE, flat: !!opt.flash, c: (c) => (opt.flash ? "#f4f6fb" : c) };
    const back = { ol: EDGE, flat: !!opt.flash, c: (c) => (opt.flash ? "#c9cdd6" : shade(c, -0.3)) };
    S.fem = def.gender === "F";
    ctx.save();
    ctx.globalAlpha = opt.alpha !== undefined ? opt.alpha : 1;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const layer = (name, tint) => { if (!ghost) for (const it of cloth) if ((it.c.layer || "back") === name) drawStrand(ctx, it, tint, null); };
    const W = Rig.WEAPONS[def.weapon], twoHanded = W && W.hands === 2 && !W.fists && !W.dual;
    const weapon = () => { if (def.weaponDraw) Rig.WEAPON_DRAW[def.weaponDraw](ctx, S, S.L.fh, p.w, P.accent, P); };

    layer("back", back);
    if (S.B.arms4) drawArm(ctx, S, "lowerB", parts.arms.lower, back, ghost, opt);
    drawLeg(ctx, S, "back", parts.legs, back, ghost);
    const bArm = drawArm(ctx, S, "back", parts.arms.back, back, ghost, opt);
    drawPad(ctx, S, "back", parts.arms.back.pad, back, ghost);
    drawTorso(ctx, S, parts.torso, front, ghost);
    if (parts.torso.mantle) drawMantle(ctx, S, parts.torso.mantle, front, ghost);
    // Neck (and a standing collar).
    capsule(ctx, S.J.sh, S.J.neck, S.B.neckW / 2 + OL, S.B.neckW / 2 + OL, ghost || EDGE);
    capsule(ctx, S.J.sh, S.J.neck, S.B.neckW / 2, S.B.neckW / 2, ghost || front.c(parts.torso.collar || (parts.torso.bands.find((b) => b[0] > 0.9) || [0, 0, parts.head.skin])[2]));
    drawLeg(ctx, S, "front", parts.legs, front, ghost);
    layer("front", front);
    // A two-handed weapon held back over the shoulder passes behind the head; otherwise it is in front.
    const behind = twoHanded && Math.cos(p.w * Math.PI / 180) < -0.15;
    if (behind) weapon();
    drawHead(ctx, S, parts.head, front, ghost);
    if (S.B.arms4) drawArm(ctx, S, "lowerF", parts.arms.lower, front, ghost, opt);
    if (twoHanded && !behind) weapon();
    const fArm = drawArm(ctx, S, "front", parts.arms.front, front, ghost, opt);
    drawPad(ctx, S, "front", parts.arms.front.pad, front, ghost);
    if (!twoHanded) weapon();
    if (!ghost && parts.arms.front.hand.flame && (opt.heat || 0) > 0.05) {
      flames(ctx, fArm.hand, fArm.wrist, opt.t || 0, opt.heat - 0.6, P);
      flames(ctx, bArm.hand, bArm.wrist, (opt.t || 0) + 0.7, opt.heat - 0.6, P);
    }
    if (W && W.orb) orb(ctx, S, opt, ghost);
    ctx.restore();
  }

  return { DEFS, ORDER, draw, makeCloth, stepCloth, resetCloth, shade, torsoPt, headPt };
})();
