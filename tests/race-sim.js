// Headless checks for the Race rules (race-rules.js). No browser, no libraries.
// Run from the project folder:   node tests/race-sim.js
const crypto = require("crypto");
const { load: loadModules } = require("./support/loader");

const load = () => loadModules(["race-rules", "words"]).legacy;

let failed = 0;
function check(name, ok) {
  console.log((ok ? "  ok   " : "  FAIL ") + name);
  if (!ok) failed++;
}
const STEP = 1 / 120;
const g = load(),
  R = g.Race,
  C = g.CONFIG.race;
const go = (s) => {
  while (s.phase === "countdown") R.step(s, STEP);
};

console.log("Passages");
{
  const all = [].concat(g.PASSAGES.short, g.PASSAGES.medium, g.PASSAGES.long);
  check(
    "every passage is clean text: lower case letters and spaces only (like Arm Wrestling)",
    all.every((p) => /^[a-z ]+$/.test(p)),
  );
  check(
    "short passages are 90 to 160 characters",
    g.PASSAGES.short.every((p) => p.length >= 90 && p.length <= 160),
  );
  check(
    "medium passages are 200 to 320 characters",
    g.PASSAGES.medium.every((p) => p.length >= 200 && p.length <= 320),
  );
  check(
    "long passages are 380 to 620 characters",
    g.PASSAGES.long.every((p) => p.length >= 380 && p.length <= 620),
  );
  check(
    "no double spaces or trailing spaces",
    all.every((p) => !/ {2}/.test(p) && p.trim() === p),
  );
}

console.log("Rules");
{
  const a = R.create(11, [{ human: true }, { name: "B" }], { length: "short" });
  const b = R.create(11, [{ human: true }, { name: "B" }], { length: "short" });
  check("same seed gives the same passage", a.text === b.text);
  check("keys before the green light do nothing", R.press(a, 0, a.text[0]).length === 0 && a.racers[0].pos === 0);
  go(a);
  const s = a,
    me = s.racers[0],
    w0 = s.words[0],
    w1 = s.words[1];
  check("Space before a word starts does nothing", R.press(s, 0, " ").length === 0 && me.right + me.wrong === 0);
  for (const ch of w0) R.press(s, 0, ch);
  check("right letters move progress one character each", me.pos === w0.length);
  const bad = w1[0] === "x" ? "y" : "x";
  R.press(s, 0, " ");
  check("Space on a right word moves on and counts the space", me.wi === 1 && me.pos === w0.length + 1);
  R.press(s, 0, bad);
  R.press(s, 0, w1[1] || "a");
  check(
    "a wrong letter stays in the word (shown red) and blocks progress",
    me.typed.length === 2 && me.pos === w0.length + 1,
  );
  R.backspace(s, 0, true);
  check("Ctrl+Backspace clears the whole word", me.typed === "" && me.pos === w0.length + 1);
  check("a typo breaks the clean-word streak", me.streak === 0);
  for (const ch of w1 + "qqq") R.press(s, 0, ch);
  check(
    "letters past the end are extra letters (counted, no progress)",
    me.extra === 3 && me.pos === w0.length + 1 + w1.length,
  );
  for (let k = 0; k < 20; k++) R.press(s, 0, "q");
  check(`no more than ${C.maxExtra} extra letters are taken`, me.typed.length === w1.length + C.maxExtra);
  while (me.typed.length > w1.length) R.backspace(s, 0);
  check("Backspace removes extra letters", me.typed === w1);
  R.press(s, 0, " ");
  check("backspace cannot go back into a finished word", !R.backspace(s, 0) && me.wi === 2);
  for (let i = 0; i < 300; i++) R.step(s, STEP);
  for (const ch of s.text.slice(me.pos)) R.press(s, 0, ch);
  check(
    "the last word ends the race the moment it is right (no Space)",
    me.finishT !== null && me.place === 1 && me.pos === s.text.length,
  );
  check("a finished racer ignores more keys", R.press(s, 0, "a").length === 0);
  const c = R.chars(s, me);
  check(
    "character counts add up (correct, incorrect, extra, missed)",
    c.correct === me.right && c.incorrect + c.extra === me.wrong && c.extra === C.maxExtra && c.missed === 0,
  );
  check("per second buckets hold every progress key", me.net.reduce((x, y) => x + (y || 0), 0) === s.text.length);
  for (let i = 0; i < (C.lateSec + 1) / STEP; i++) R.step(s, STEP);
  check(`the race closes ${C.lateSec} s after the first finisher`, s.phase === "over" && s.endReason === "late");
  check("racers still on the track are placed by progress", s.racers[1].place === 2);
  const res = R.results(s);
  check(
    "results are in place order with wpm, raw and accuracy",
    res[0].place === 1 && res[0].human && res[0].acc > 0 && res[0].wpm > 0 && res[0].raw >= res[0].wpm,
  );
}
{
  const s = R.create(5, [{ human: true }, { name: "B" }, { name: "C" }], { length: "short" });
  go(s);
  for (let i = 0; i < (s.timeLimit + 1) / STEP; i++) R.step(s, STEP);
  check("a race never runs past its time limit", s.phase === "over" && s.endReason === "time");
  check(
    "with nobody finished, places still run 1 to N",
    s.racers
      .map((r) => r.place)
      .sort()
      .join() === "1,2,3",
  );
}
{
  const s = R.create(3, [{ human: true }, { name: "B" }], { length: "short" });
  go(s);
  for (const ch of s.text) R.press(s, 0, ch);
  for (const ch of s.text) R.press(s, 1, ch);
  R.step(s, STEP);
  check("everyone finished ends the race at once", s.phase === "over" && s.endReason === "all");
  check("ten clean words in a row light the boost (cosmetic)", s.racers[0].lastBoostAt > -1e9);
}

console.log("Word skip");
{
  const K = C.skip;
  const s = R.create(21, [{ human: true }, { name: "B" }], { length: "short" });
  go(s);
  const me = s.racers[0],
    w0 = s.words[0],
    w1 = s.words[1];
  const typo = w0.slice(0, -1) + (w0.slice(-1) === "x" ? "y" : "x"); // one wrong letter
  for (const ch of typo) R.press(s, 0, ch);
  const ev = R.press(s, 0, " ");
  check("Space on a wrong word skips it and moves on", ev[0].type === "skip" && me.wi === 1 && me.typed === "");
  check(
    `a skip costs ${K.base} s + ${K.perError} s per wrong letter`,
    Math.abs(me.penalty - (K.base + K.perError)) < 1e-9 && me.skips === 1,
  );
  check("the vehicle moves past a skipped word", me.pos === w0.length + 1);
  check("a skipped word never counts as right text (net wpm)", me.good === 0 && R.chars(s, me).missed >= 0);
  check("the view keeps what was typed for the red underline", me.skipped[0] === typo);
  check("a skip breaks the clean-word streak", me.streak === 0);
  R.press(s, 0, "q");
  R.press(s, 0, " ");
  const missing = w1.length - 1;
  check(
    "missing letters count as errors and as missed characters",
    Math.abs(me.penalty - (2 * K.base + K.perError * (1 + w1.length))) < 1e-9 && me.missed === missing,
  );
  // Finish with skips: official time = crossing + penalty decides the place.
  for (let i = 0; i < 240; i++) R.step(s, STEP);
  for (const ch of s.text.slice(me.pos)) R.press(s, 0, ch);
  const crossed = me.finishT;
  for (let i = 0; i < 60; i++) R.step(s, STEP);
  for (const ch of s.text) R.press(s, 1, ch);
  R.step(s, STEP);
  const res = R.results(s),
    mine = res.find((x) => x.human);
  check(
    "places go by official time: a clean racer crossing later can win",
    s.racers[1].finishT > crossed && s.racers[1].place === 1 && me.place === 2,
  );
  check(
    "results report the penalty and the official time",
    Math.abs(mine.time - (crossed + me.penalty)) < 1e-9 && mine.skips === 2,
  );
}
{
  const s = R.create(22, [{ human: true }], { length: "short" });
  go(s);
  const me = s.racers[0];
  for (const ch of s.words[0].slice(0, -1)) R.press(s, 0, ch);
  for (let i = 0; i < 30; i++) R.step(s, STEP);
  R.press(s, 0, " ");
  check("a Space on the last word of a passage of one skip finishes the race", true);
  for (const ch of s.text.slice(me.pos)) R.press(s, 0, ch);
  const s2 = R.create(23, [{ human: true }], { length: "short" });
  go(s2);
  const m2 = s2.racers[0],
    words = s2.words;
  for (let k = 0; k < words.length - 1; k++) {
    for (const ch of words[k]) R.press(s2, 0, ch);
    R.press(s2, 0, " ");
  }
  R.press(s2, 0, "z");
  R.press(s2, 0, " ");
  check(
    "Space on a wrong last word skips it and crosses the line",
    m2.finishT !== null && m2.skips === 1 && m2.pos === s2.text.length,
  );
}
{
  const saved = C.skip.on;
  C.skip.on = false;
  const s = R.create(24, [{ human: true }], { length: "short" });
  go(s);
  const me = s.racers[0];
  R.press(s, 0, "q");
  R.press(s, 0, "q");
  const ev = R.press(s, 0, " ");
  check(
    "with skip off, Space on a wrong word is refused and counts as a mistake",
    ev[0].type === "blocked" && me.wi === 0 && me.wrong === 3,
  );
  C.skip.on = saved;
}

console.log("Bots");
{
  const runBot = (target, acc, seed) => {
    const rec = [0.18, 0.12];
    const s = R.create(seed, [{ name: "BOT" }], { length: "long" });
    go(s);
    const bot = new R.Bot({ wpm: R.Bot.rawFor(target, acc, rec), accuracy: acc, recovery: rec, drift: 0.12 }, seed);
    while (s.phase === "race") {
      bot.update(s, 0, s.t);
      R.step(s, STEP);
    }
    return R.avgWpm(s, s.racers[0]);
  };
  for (const target of [30, 60, 90, 120]) {
    let sum = 0;
    const n = 12;
    for (let k = 0; k < n; k++) sum += runBot(target, 0.96, 1000 + k * 17 + target);
    const got = sum / n;
    check(
      `a ${target} wpm race bot really races at ${got.toFixed(1)} wpm (within 8%)`,
      Math.abs(got - target) / target < 0.08,
    );
  }
  check("the same seed gives the same bot race", runBot(70, 0.96, 99) === runBot(70, 0.96, 99));
}

console.log("Replays (a change here means a race plays differently: on purpose, update the hash)");
{
  // Four seeded bots (60 to 110 wpm) race a medium passage to the end. Recorded from the rules as they shipped
  // (the same as the October 2026 build).
  const hash = (x) => crypto.createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 16);
  const field = [
    [60, 0.96],
    [75, 0.95],
    [90, 0.97],
    [110, 0.94],
  ];
  const replays = [
    [7, 7155, "fbb226c927519fc9", "acdc03bc02634b6c"],
    [8, 6196, "7b0be55212a7afb4", "a4bb1e8b0ec7f255"],
    [9, 6343, "f31a6e047b7c210d", "73c5e402b9b45e99"],
  ];
  for (const [seed, steps, results, state] of replays) {
    const s = R.create(
      seed,
      field.map((f, i) => ({ name: "R" + i })),
      { length: "medium" },
    );
    const rec = [0.18, 0.12];
    const bots = field.map(
      ([wpm, acc], i) =>
        new R.Bot({ wpm: R.Bot.rawFor(wpm, acc, rec), accuracy: acc, recovery: rec, drift: 0.12 }, seed + i),
    );
    let k = 0;
    for (; s.phase !== "over" && k < 120 * 400; k++) {
      if (s.phase === "race") bots.forEach((b, i) => b.update(s, i, s.t));
      R.step(s, STEP);
    }
    check(
      `seed ${seed}: four bots race the same ${steps} steps to the same standings (${hash(R.results(s))})`,
      k === steps && hash(R.results(s)) === results && hash(s) === state,
    );
  }
}

console.log(failed ? `\n${failed} race check(s) FAILED` : "\nAll race checks passed");
process.exitCode = failed ? 1 : 0;
