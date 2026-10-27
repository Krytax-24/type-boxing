/**
 * Random combos for the 2D fighters (Combo2D). No drawing, no input: a combo is a list of the fighter's own attack
 * clips (a1 to a4), built from a seed, so the same seed always gives the same combo (online play sends the seed,
 * not the moves). Used by the title sparring loop, the duel and the bots.
 *
 * Shape of a combo: an opener (a quick attack), links (any attack, never three alike in a row, never two heavy
 * attacks back to back), and an ender (the heavy attack or the knockdown). Each fighter weighs its attacks by how
 * often they appear in its own designed combo (Anim.W[weapon].combo), so a staff fighter keeps her thrusts and
 * sweeps and a brawler keeps his jabs.
 */
CounterType.define("combos", ["random", "clips"], (randomModule, Anim) => {
  "use strict";

  const { mulberry32 } = randomModule;

  // The shared seeded generator (random.js), under the name the combo code uses.
  const rng = mulberry32;
  const LIGHT = ["a1", "a2"],
    HEAVY = ["a3"],
    ENDERS = ["a3", "a4"];

  // Weights of a1..a4 from the weapon's own combo (plus one each, so nothing is left out).
  function weights(weapon) {
    const W = Anim.W[weapon] || {},
      w = { a1: 1, a2: 1, a3: 1, a4: 1 };
    for (const n of W.combo || []) if (w[n] !== undefined) w[n] += 1;
    return w;
  }
  function pick(r, list, w) {
    const tot = list.reduce((s, n) => s + (w[n] || 1), 0);
    let x = r() * tot;
    for (const n of list) {
      x -= w[n] || 1;
      if (x <= 0) return n;
    }
    return list[list.length - 1];
  }

  // One combo of `len` attacks (3 to 6 when not given). opt.finisher: end on the knockdown (a4).
  function random(weapon, seed, opt) {
    opt = opt || {};
    const r = rng(seed),
      w = weights(weapon);
    const len = opt.len || 3 + Math.floor(r() * 4);
    const steps = [pick(r, LIGHT, w)];
    while (steps.length < len - 1) {
      const last = steps[steps.length - 1],
        prev = steps[steps.length - 2];
      const options = ["a1", "a2", "a3"].filter(
        (n) => !(n === last && n === prev) && !(HEAVY.includes(n) && HEAVY.includes(last)),
      );
      steps.push(pick(r, options, w));
    }
    const last = steps[steps.length - 1];
    const end = opt.finisher
      ? "a4"
      : pick(
          r,
          ENDERS.filter((n) => !(HEAVY.includes(n) && HEAVY.includes(last))),
          w,
        );
    steps.push(end);
    return steps;
  }

  // The ultimate: a fast run through every attack, ending on the knockdown.
  function ultimate(weapon, seed) {
    const r = rng(seed ^ 0x5bd1e995);
    const mid = r() < 0.5 ? ["a1", "a2", "a1", "a3"] : ["a2", "a1", "a3", "a2"];
    return mid.concat(["a4"]);
  }

  // An endless supply of moves for a typist: each finished word asks for the next attack. A new combo starts
  // when the last one is used up; `kind` "heavy" (a long word) prefers the heavy attack, "finisher" (a combo
  // level reached) ends the current combo on the knockdown at once.
  function stream(weapon, seed) {
    let n = 0,
      cur = [],
      i = 0;
    return {
      next(kind) {
        if (kind === "finisher") {
          cur = [];
          i = 0;
          return "a4";
        }
        if (i >= cur.length) {
          cur = random(weapon, seed + 977 * n++);
          i = 0;
        }
        let mv = cur[i++];
        if (kind === "heavy" && mv !== "a3" && mv !== "a4" && r01(seed + n * 31 + i) < 0.6) mv = "a3";
        return mv;
      },
    };
  }
  const r01 = (s) => rng(s)();

  return { random, ultimate, stream };
});
