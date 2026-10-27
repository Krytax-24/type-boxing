// Checks for the fighters' character controller (src/engine/animation/motion.js): walking, running, jumping,
// dashing, turning and attacks, then a replay of every designed fighter that must match frame for frame.
// Run from the project folder:   node tests/motion-sim.js
const crypto = require("crypto");
const { load } = require("./support/loader");

const game = load(["motion", "clips", "characters"]);
const Move = game.get("motion");
const Chars = game.get("characters");

let failed = 0;
function check(name, ok) {
  console.log((ok ? "  ok   " : "  FAIL ") + name);
  if (!ok) failed++;
}

/** Runs fn with Math.random replaced by a seeded generator (the controller uses it for idle breaks and dust). */
function seeded(seed, fn) {
  const saved = Math.random;
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = saved;
  }
}

const DT = 1 / 60;
const fighter = (key = "cyborg") => {
  const def = Chars.DEFS[key];
  return new Move.Character(def.weapon, def.gender, 300, 1, def.prof);
};
const steps = (ch, n, inp, fx) => {
  for (let i = 0; i < n; i++) ch.update(DT, inp, fx);
  return ch;
};

console.log("Moving");
seeded(1, () => {
  const walker = steps(fighter(), 60, { move: 1 });
  check("holding forward walks forward", walker.x > 340 && walker.label === "walk");
  const runner = steps(fighter(), 60, { move: 1, run: true });
  check("running is faster than walking", runner.x - 300 > (walker.x - 300) * 1.3);
  const back = steps(fighter(), 60, { move: -1 });
  check("holding back walks backward while still facing the opponent", back.x < 290 && back.facing === 1);
  const crouch = steps(fighter(), 30, { crouch: true });
  check("holding down crouches", crouch.crouch > 0.8 && crouch.label === "crouch");
});

console.log("Jumping and dashing");
seeded(2, () => {
  const ch = fighter();
  const fx = [];
  ch.update(DT, { jump: true, jumpPressed: true }, (c, name) => fx.push(name));
  steps(ch, 20, { jump: true }, (c, name) => fx.push(name));
  check("a jump leaves the ground after a short crouch", ch.state === "air" && ch.jumpY > 0 && fx.includes("dust"));
  steps(ch, 120, {}, (c, name) => fx.push(name));
  check("a jump comes back down and lands", ch.state === "ground" && ch.jumpY === 0 && fx.some((n) => /land/.test(n)));
  const dasher = fighter();
  dasher.dash(1);
  steps(dasher, 20, {});
  check("a dash moves the fighter forward fast", dasher.x > 340);
});

console.log("Facing and attacks");
seeded(3, () => {
  const ch = fighter();
  ch.target = { x: 100 };
  steps(ch, 40, {});
  check("lock-on turns to face a target behind", ch.facing === -1 && ch.turnT === -1);
  const attacker = fighter();
  check("an attack starts", attacker.play("a1") === true && attacker.busy);
  steps(attacker, 180, {});
  check("an attack ends and the fighter is free again", !attacker.busy && attacker.label === "idle");
  const buffered = fighter();
  buffered.play("a3");
  buffered.play("a1");
  check("a second attack waits in the buffer until the first can be cancelled", !!buffered.buffer);
});

/** 1500 frames of seeded random input for one fighter; the hash covers its state and pose on every frame. */
function replay(key, frames) {
  let r = 12345 + key.charCodeAt(0);
  const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ch = fighter(key);
  const names = Object.keys(ch.clips)
    .filter((n) => n !== "death" && (Array.isArray(ch.clips[n].keys) || Array.isArray(ch.clips[n].seq)))
    .sort();
  const digest = crypto.createHash("sha1");
  let move = 0,
    hold = 0,
    jump = false;
  for (let k = 0; k < frames; k++) {
    if (hold-- <= 0) {
      hold = Math.floor(rnd() * 40);
      move = [-1, 0, 1, 1, 0][Math.floor(rnd() * 5)];
    }
    const jumpPressed = !jump && rnd() < 0.02;
    jump = jumpPressed || (jump && rnd() > 0.08);
    const roll = rnd();
    if (roll < 0.03) ch.play(names[Math.floor(rnd() * names.length)]);
    else if (roll < 0.04) ch.dash(rnd() < 0.5 ? 1 : -1);
    else if (roll < 0.045) {
      ch.mode = ch.mode === "lock" ? "free" : "lock";
      ch.target = ch.mode === "lock" ? { x: 100 + rnd() * 700 } : null;
    }
    ch.update(rnd() < 0.1 ? 1 / 30 : DT, { move, run: rnd() < 0.4, crouch: rnd() < 0.1, jump, jumpPressed });
    digest.update(JSON.stringify([ch.x, ch.vx, ch.state, ch.label, ch.facing, ch.crouch, ch.lean, ch.pose]));
  }
  return digest.digest("hex").slice(0, 16);
}

console.log("Replays (a change here means the fighters move differently: on purpose, update the hash)");
{
  // Every designed fighter, 1500 frames of seeded random input (walking, running, jumps, crouches, attacks, dashes,
  // lock-on and free facing). Recorded from the controller as it shipped (the same as the October 2026 build).
  const EXPECTED = {
    cyborg: "90efad7788439ae2",
    bluex: "b820b1ce5c0e88d0",
    voss: "30609b743cd7042f",
    barbarian: "008a7e01a130e5a1",
    flame: "e8c3624d38c357db",
    dancer: "b856270809ed07ad",
    veil: "6ab30b85c29d7c47",
    ronin: "70d840334604d6da",
    reaver: "0dcd452c5ba3ac42",
    varun: "5dbc8637dacb8a0e",
    grin: "f0f90c1b3e9ed9c6",
  };
  for (const key of Chars.ORDER) {
    const hash = seeded(97 + key.length, () => replay(key, 1500));
    check(`${key} replays the same 1500 frames (${hash})`, EXPECTED[key] === hash);
  }
}

console.log(failed ? `\n${failed} motion check(s) FAILED` : "\nAll motion checks passed");
process.exitCode = failed ? 1 : 0;
