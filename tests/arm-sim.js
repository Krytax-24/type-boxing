// Headless checks and the balance table for Arm Wrestling (arm-rules.js). No browser, no libraries.
// Run from the project folder:   node tests/arm-sim.js          (about 20 seconds)
//   optional number: matches per matchup (default 200; 0 runs only the rule checks)
const crypto = require("crypto");
const { load: loadModules } = require("./support/loader");
const N = process.argv[2] !== undefined ? +process.argv[2] : 200;

const load = () => loadModules(["arm-rules", "typing"]).legacy;

let failed = 0;
function check(name, ok) {
  console.log((ok ? "  ok   " : "  FAIL ") + name);
  if (!ok) failed++;
}
const STEP = 1 / 120;
const g = load(),
  Arm = g.Arm,
  AC = g.CONFIG.arm;
const go = (s) => {
  while (s.phase === "countdown") Arm.step(s, STEP);
};
const typeWord = (s, i) => {
  const st = s.streams[i];
  for (const ch of st.current().text) Arm.handleEvents(s, i, st.press(ch));
  Arm.handleEvents(s, i, st.press(" "));
};

console.log("Rules");
{
  const a = Arm.create(42),
    b = Arm.create(42);
  check(
    "same seed gives the same words on both sides",
    a.streams[0].words.map((w) => w.text).join() === b.streams[0].words.map((w) => w.text).join(),
  );
  check(
    "the two sides get different words",
    a.streams[0].words.map((w) => w.text).join() !== a.streams[1].words.map((w) => w.text).join(),
  );
  check("perfect accuracy gives the full accuracy term", Arm.accTerm(1) === 1);
  check(`accuracy at the floor (${AC.accFloor * 100}%) gives nothing`, Arm.accTerm(AC.accFloor) === 0);
  check("the accuracy term rises with accuracy", Arm.accTerm(0.96) > Arm.accTerm(0.92));
  check("equal numbers give equal power", Arm.powerFrom(0.96, 60, 60) === Arm.powerFrom(0.96, 60, 60));
  check("crawling at 12 wpm gets almost no power from accuracy", Arm.powerFrom(1, 12, 70) < 0.3);
  const s = Arm.create(9);
  go(s);
  for (let i = 0; i < 6; i++) typeWord(s, 0);
  for (let i = 0; i < 120; i++) Arm.step(s, STEP);
  check("typing pulls the hands your way while the foe is idle", s.x > 0 && s.power[0] > 0 && s.power[1] === 0);
  const t = Arm.create(10);
  go(t);
  for (let k = 0; k < (AC.timer + 1) / STEP; k++) Arm.step(t, STEP);
  check("nobody typing at time up goes to sudden death", t.sudden && t.phase === "fight");
  for (let k = 0; k < (AC.suddenDeath + 1) / STEP; k++) Arm.step(t, STEP);
  check(
    "sudden death always ends the match",
    t.phase === "over" && t.result && (t.result.winner === 0 || t.result.winner === 1),
  );
  const u = Arm.create(11);
  go(u);
  const st = u.streams[0],
    w = st.current().text;
  for (const ch of w) Arm.handleEvents(u, 0, st.press(ch));
  const before = u.typists[0].right;
  Arm.handleEvents(u, 0, st.submit(false), true);
  check(
    "a word that ends by itself credits the missing Space (fair mixed settings)",
    u.typists[0].right === before + 1,
  );
}

// Simulated typists: the duel's Bot class types each side's stream with a given speed and per-letter accuracy.
function match(pa, pb, seed) {
  const s = Arm.create(seed);
  const mk = (p, i) =>
    new g.Bot(g.Bot.cfgFor({ wpm: p.wpm, accuracy: p.acc, recovery: [0.18, 0.12], drift: 0.12 }), s.streams[i], (ev) =>
      Arm.handleEvents(s, i, ev),
    );
  const bots = [mk(pa, 0), mk(pb, 1)];
  go(s);
  bots.forEach((b) => (b.nextKeyAt = 0.3));
  let guard = 0;
  while (s.phase === "fight" && guard++ < 200 / STEP) {
    bots.forEach((b) => b.update(s.t));
    Arm.step(s, STEP);
  }
  return s.result;
}
function table(rows) {
  console.log("\nMatchup (per-letter accuracy)                     A wins   median length");
  for (const [na, pa, nb, pb, test] of rows) {
    let wins = 0;
    const lens = [];
    for (let k = 0; k < N; k++) {
      const flip = k % 2 === 1; // alternate seats
      const r = flip ? match(pb, pa, 7000 + k) : match(pa, pb, 7000 + k);
      const aWon = flip ? r.winner === 1 : r.winner === 0;
      if (aWon) wins++;
      lens.push(r.t);
    }
    lens.sort((x, y) => x - y);
    const pct = Math.round((100 * wins) / N);
    console.log(
      `  ${(na + " vs " + nb).padEnd(48)} ${String(pct).padStart(3)}%   ${lens[lens.length >> 1].toFixed(0)} s`,
    );
    if (test) check(test[0], test[1](pct));
  }
}
if (N > 0) {
  const P = (wpm, acc) => ({ wpm, acc });
  table([
    [
      "Equal (60 wpm, 96%)",
      P(60, 0.96),
      "Equal (60 wpm, 96%)",
      P(60, 0.96),
      ["equal skill is a fair fight (40 to 60%)", (p) => p >= 40 && p <= 60],
    ],
    [
      "Fast clean (100, 98%)",
      P(100, 0.98),
      "Fast sloppy (110, 93%)",
      P(110, 0.93),
      ["clean beats sloppy at the same speed (70% or more)", (p) => p >= 70],
    ],
    [
      "Average (70, 96%)",
      P(70, 0.96),
      "Fast sloppy (110, 93%)",
      P(110, 0.93),
      ["accuracy outweighs raw speed (55% or more)", (p) => p >= 55],
    ],
    [
      "Average (70, 96%)",
      P(70, 0.96),
      "Slow perfect (35, 100%)",
      P(35, 1),
      ["crawling perfectly does not beat a 96% typist at twice the speed (55% or more)", (p) => p >= 55],
    ],
    [
      "Fast clean (100, 98%)",
      P(100, 0.98),
      "Average (70, 96%)",
      P(70, 0.96),
      ["better on both counts wins clearly (80% or more)", (p) => p >= 80],
    ],
    [
      "Average (70, 96%)",
      P(70, 0.96),
      "Crawler (12, 100%)",
      P(12, 1),
      ["a crawler never wins (95% or more)", (p) => p >= 95],
    ],
  ]);
}

console.log("Replays (a change here means a match plays differently: on purpose, update the hash)");
{
  // Two scripted typists: one key every 12 steps against one every 15 steps with a typo in every 7th word, to the
  // pin. Recorded from the rules as they shipped (the same as the October 2026 build).
  const hash = (x) => crypto.createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 16);
  const replays = [
    [17, 2477, "2554630eea8a4a79"],
    [18, 2594, "cf76fca49d0c8c83"],
    [19, 2618, "66244bce9d95951a"],
  ];
  for (const [seed, steps, state] of replays) {
    const s = Arm.create(seed);
    const plan = [
      [12, 0],
      [15, 7],
    ];
    const words = [0, 0];
    let k = 0;
    for (; s.phase !== "over" && k < 120 * 200; k++) {
      for (let i = 0; i < 2 && s.phase === "fight"; i++) {
        const [every, typoEvery] = plan[i];
        if (k % every !== 0) continue;
        const st = s.streams[i];
        const word = st.current().text;
        const pos = st.typed.length;
        let key = " ";
        if (pos < word.length) key = typoEvery && words[i] % typoEvery === typoEvery - 1 && pos === 1 ? "q" : word[pos];
        else words[i]++;
        Arm.handleEvents(s, i, st.press(key));
      }
      Arm.step(s, STEP);
    }
    const got = hash({ x: s.x, result: s.result, you: Arm.summary(s, 0), foe: Arm.summary(s, 1) });
    check(`seed ${seed}: the same ${steps} steps to the same pin (${got})`, k === steps && got === state);
  }
}

console.log(failed ? `\n${failed} arm check(s) FAILED` : "\nAll arm checks passed");
process.exitCode = failed ? 1 : 0;
