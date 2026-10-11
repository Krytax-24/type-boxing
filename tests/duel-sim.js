// Headless checks for the duel rules. No browser, no libraries.
// Run from the project folder:   node tests/duel-sim.js
//   optional numbers: matches per cell for the calibration table and per bot for the beat-at check
//   (default 40 300; e.g. node tests/duel-sim.js 0 0 runs only the rule checks)
// Part 1 checks the rules. Part 2 calibrates the bots against a simulated player.
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");

// Load the same classic scripts the page loads, in one shared scope.
function load() {
  const ctx = { console, Math };
  vm.createContext(ctx);
  for (const f of ["config.js", "words.js", "duel-typing.js", "fighter.js", "duel.js"]) {
    const src = fs.readFileSync(path.join(root, "js", f), "utf8")
      .replace(/^const (\w+) =/gm, "var $1 =")
      .replace(/^class (\w+)/gm, "var $1 = class $1");
    vm.runInContext(src, ctx, { filename: f });
  }
  return ctx;
}

const STEP = 1 / 120;
function fight(g, duel) { while (duel.phase === "countdown") duel.update(STEP); }
function typeWord(duel, side) {
  const s = duel.streams[side];
  for (const ch of s.current().text) duel.handleEvents(side, s.press(ch), duel.t);
  duel.handleEvents(side, s.press(" "), duel.t);
}

let failed = 0;
function check(name, ok) { console.log((ok ? "  ok   " : "  FAIL ") + name); if (!ok) failed++; }

// ---------- Part 1: rules ----------
console.log("Rules");
{
  const g = load(), D = g.CONFIG.duel;
  const a = new g.Duel(), b = new g.Duel();
  a.start(42); b.start(42);
  check("same seed gives the same words", a.streams[0].words.map((w) => w.text).join() === b.streams[0].words.map((w) => w.text).join());
  check("same seed gives the same ultimate word", a.streams[0].source.hardWord() === b.streams[0].source.hardWord());

  const duel = new g.Duel(); duel.start(7); fight(g, duel);
  const me = duel.typists[0];
  for (let i = 0; i < D.wordsPerCombo; i++) typeWord(duel, 0);
  check(`${D.wordsPerCombo} clean words give combo x1`, me.comboLevel === 1);
  duel.handleEvents(0, duel.streams[0].press("#"), duel.t);
  check("a wrong key breaks the combo", me.comboLevel === 0 && duel.fx.some((f) => f.text === "COMBO BROKEN"));

  me.streak = D.wordsPerCombo * D.ultimate.comboRequired; me.updateCombo(); me.charge = 100;
  duel.checkUltimateReady(0);
  check("full charge and combo insert an ultimate word", duel.streams[0].ultimateAhead());
  typeWord(duel, 0); // the word before it
  const hpBefore = duel.typists[1].hp;
  typeWord(duel, 0); // the ultimate word, clean
  for (let i = 0; i < 240 && !duel.fighters[0].ult.fired; i++) duel.update(STEP);
  const lost = hpBefore - duel.typists[1].hp;
  check(`a clean ultimate deals about ${D.ultimate.damage} and stuns`, lost >= D.ultimate.damage - 3 && duel.t < duel.typists[1].stunUntil);

  duel.typists[1].hp = 0.5; duel.damage(1, 1);
  check("reaching 0 HP ends the match", duel.phase === "over" && duel.result.winner === 0);

  const src = fs.readFileSync(path.join(root, "js", "duel.js"), "utf8");
  check("duel.js has no Math.random, clock, keyboard or bot", !/Math\.random|performance\.now|Date\.now|keydown|new Bot/.test(src));
}

// ---------- Part 1b: the counter rule ----------
console.log("Counter");
{
  const g = load(), D = g.CONFIG.duel, C = D.counter;
  const duel = new g.Duel(); duel.start(11); fight(g, duel);
  const [me, foe] = duel.typists;
  // Give both typists the same steady typing, so power differences come only from the counter.
  const warm = () => { for (const t of duel.typists) { t.stamps = []; t.firstStamp = duel.t - 4; for (let k = 0; k < 20; k++) t.stamps.push(duel.t - k * 0.15); } };
  const step = (secs) => { for (let i = 0; i < Math.round(secs / STEP); i++) duel.update(STEP); };
  const ratio = () => foe.power(duel.t) / (foe.wpm(duel.t) * (1 + D.comboBonus * foe.comboLevel));
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  const miss = () => { duel.handleEvents(0, duel.streams[0].press("#"), duel.t); duel.streams[0].backspace(); };
  // Finish the (dirty) word in progress, then type enough clean words for combo x1.
  const buildCombo = () => { typeWord(duel, 0); for (let i = 0; i < D.wordsPerCombo; i++) typeWord(duel, 0); };

  // (2) A mistake with no combo gives nothing.
  warm();
  miss();
  check("a mistake at combo 0 gives no counter", !foe.countering(duel.t) && close(ratio(), 1));

  // (1) A mistake at combo 1+ gives the opponent x1.20 power.
  buildCombo();
  check("setup: combo x1", me.comboLevel === 1);
  warm();
  miss();
  const t0 = duel.t;
  check(`a mistake at combo 1+ gives the opponent x${1 + C.powerBonus} power`, foe.countering(duel.t) && close(ratio(), 1 + C.powerBonus) && !me.countering(duel.t));

  // (4) A second counter restarts the timer and does not stack.
  step(0.5);
  buildCombo();
  warm();
  miss();
  const t1 = duel.t;
  check("a second counter restarts the timer and does not stack",
    close(foe.counterUntil, t1 + C.duration) && t1 > t0 && close(ratio(), 1 + C.powerBonus));

  // (3) The window ends after the duration.
  step(C.duration - 0.05); warm();
  const stillOn = foe.countering(duel.t) && close(ratio(), 1 + C.powerBonus);
  step(0.1); warm();
  check(`the window ends after ${C.duration} s`, stillOn && !foe.countering(duel.t) && close(ratio(), 1));

  // (5) A stunned typist stays at power 0, even with a counter running.
  buildCombo();
  warm();
  foe.stunUntil = duel.t + 1;
  miss();
  check("a stunned typist stays at power 0", foe.countering(duel.t) && foe.power(duel.t) === 0);
}

// ---------- Part 1c: one rule set ----------
// The Light and Heavy weapon tiers were removed: every typist uses the one rule set (the old Medium).
console.log("One rule set");
{
  const g = load(), D = g.CONFIG.duel, W = g.weaponFor("medium");
  const words = (d, side) => d.streams[side].words.map((w) => w.text);
  check("only one rule set is left", g.CONFIG.weapons.list.length === 1 && g.CONFIG.weapons.list[0].id === "medium");
  check("its numbers are the globals", W.power === 1 && W.comboBonus === D.comboBonus && W.wordsPerCombo === D.wordsPerCombo &&
    W.comboRequired === D.ultimate.comboRequired && W.mistakeCharge === D.ultimate.mistakeCharge);
  check("an old saved weapon id falls back to it", g.weaponFor("heavy").id === "medium" && g.weaponFor("light").id === "medium");
  const a = new g.Duel(), b = new g.Duel(); a.start(42); b.start(42);
  check("same seed gives the same words and ultimate words", words(a, 0).join() === words(b, 0).join() && words(a, 1).join() === words(b, 1).join() &&
    a.streams[0].source.hardWord() === b.streams[0].source.hardWord());
  const u = new g.Duel(); u.start(5); const src = u.streams[0].source;
  check("ultimate words are HARD_WORDS", Array.from({ length: 50 }, () => src.hardWord()).every((w) => g.HARD_WORDS.includes(w)));
  const d = new g.Duel(); d.start(9); fight(g, d);
  const me = d.typists[0]; let toCombo = 0, toUlt = 0;
  for (let n = 1; n <= 40 && !toUlt; n++) { typeWord(d, 0); me.charge = 100; if (!toCombo && me.comboLevel >= 1) toCombo = n; if (me.ultReady()) toUlt = n; }
  check(`combo x1 after 5 clean words (${toCombo}), ultimate after 10 (${toUlt})`, toCombo === 5 && toUlt === 10);
  check("no bot carries a weapon", D.bots.every((x) => x.weapon === undefined) && D.matchMe.weapon === undefined);
}

// ---------- Part 1d: bots ----------
console.log("Bots");
{
  const g = load(), B = g.CONFIG.duel.bots, M = g.CONFIG.duel.matchMe;
  check("six levels at about 30, 45, 60, 75, 90 and 110 wpm", B.length === 6 && B.map((b) => b.beatAt).join() === "30,45,60,75,90,110");
  check("each level has a personality (style, accuracy, recovery, drift)", B.every((b) => b.style && b.accuracy > 0.8 && b.recovery.length === 2 && b.drift >= 0) &&
    new Set(B.map((b) => b.style)).size === 6);
  check("each bot plays as a fighter, all different", B.every((b) => typeof b.char === "string") && new Set(B.map((b) => b.char).concat([M.char])).size === 7);
  check("MATCH ME: last 3 matches, starts at 50 wpm", M.history === 3 && M.start === 50 && M.storageKey);
  // Recovery is a bot setting: a bot that always misses waits at least recovery[0] after each typo.
  const d = new g.Duel(); d.start(8); fight(g, d);
  const slow = new g.Bot({ wpm: 60, accuracy: 0, recovery: [1, 0], drift: 0 }, d.streams[1], () => {});
  check("the bot's typo recovery comes from its settings", slow.keystroke(0) >= 1);
  const plain = new g.Bot({ wpm: 60, accuracy: 0 }, d.streams[1], () => {});
  check("a bot without settings keeps the old recovery (0.18 to 0.33 s)", (() => { const x = plain.keystroke(0); return x >= 0.18 && x < 0.33 + 0.4; })());
  // Bot.rawWpmFor: the measured average of a typist lands on the target.
  const cfg = { accuracy: 0.96 }; cfg.wpm = g.Bot.rawWpmFor(60, cfg);
  const m = soloWpm(g, cfg, 240);
  check(`Bot.rawWpmFor(60) gives a measured average near 60 (${m.toFixed(1)})`, Math.abs(m - 60) < 3);
}

// ---------- Part 2: bot calibration ----------
// The simulated player: a Bot typing at 96% accuracy with the default typo recovery, its key
// rate set by Bot.rawWpmFor so its MEASURED average (correct keystrokes only, like the result screen) is the
// given wpm. A bot is calibrated when that player, at the bot's `beatAt`, wins 45 to 55%.
const NC = process.argv[2] !== undefined ? +process.argv[2] : 40, NB = process.argv[3] !== undefined ? +process.argv[3] : 300;
const playerCfg = (g, wpm) => { const c = { accuracy: 0.96 }; c.wpm = g.Bot.rawWpmFor(wpm, c); return c; };
function botVs(g, playerWpm, botCfg) {
  const duel = new g.Duel();
  duel.start((Math.random() * 1e9) | 0);
  const bots = [
    new g.Bot(playerCfg(g, playerWpm), duel.streams[0], (e, t) => duel.handleEvents(0, e, t)),
    new g.Bot(botCfg, duel.streams[1], (e, t) => duel.handleEvents(1, e, t)),
  ];
  bots[0].nextKeyAt = 0.6; bots[1].nextKeyAt = 0.6;
  while (duel.phase !== "over" && duel.t < 300) {
    if (duel.phase === "fight") bots.forEach((b) => b.update(duel.t));
    duel.update(STEP);
  }
  return { t: duel.t, won: duel.result ? duel.result.winner === 0 : Math.random() < 0.5 };
}
function soloWpm(g, cfg, secs) {
  const d = new g.Duel(); d.start((Math.random() * 1e9) | 0); fight(g, d);
  const b = new g.Bot(cfg, d.streams[0], (e, t) => d.handleEvents(0, e, t)); b.nextKeyAt = 0.5;
  for (let t = 0; t < secs; t += STEP) { d.t = t; b.update(t); }
  const s = d.typists[0].stats; return s.correct / 5 / ((s.lastKeyAt - s.firstKeyAt) / 60);
}
const g = load();
const matchBot = (target) => { const M = g.CONFIG.duel.matchMe; const c = Object.assign({}, M, { beatAt: target }); c.wpm = g.Bot.rawWpmFor(target, c); return c; };
const calBots = g.CONFIG.duel.bots.concat([Object.assign(matchBot(50), { name: "MATCH ME 50" }), Object.assign(matchBot(90), { name: "MATCH ME 90" })]);
if (NC > 0) {
  const speeds = [30, 45, 60, 75, 90, 110, 130];
  console.log(`\nCalibration table (${NC} matches per cell): win% of a simulated player at 96% accuracy`);
  console.log("player wpm  " + calBots.map((b) => b.name.padEnd(12)).join(""));
  for (const w of speeds) {
    const cells = calBots.map((b) => { let won = 0; for (let k = 0; k < NC; k++) if (botVs(g, w, b).won) won++; return Math.round((100 * won) / NC) + "%"; });
    console.log(String(w).padStart(6) + "      " + cells.map((c) => c.padEnd(12)).join(""));
  }
}
if (NB > 0) {
  console.log(`\nBeat-at check (${NB} matches per bot): the player at the card's number should win 45 to 55%`);
  for (const b of calBots) {
    let won = 0; const lens = [];
    for (let k = 0; k < NB; k++) { const r = botVs(g, b.beatAt, b); if (r.won) won++; lens.push(r.t); }
    lens.sort((x, y) => x - y);
    const pct = (100 * won) / NB, ok = pct >= 45 && pct <= 55;
    console.log(`  ${b.name.padEnd(12)} beat it at about ${String(b.beatAt).padStart(3)} wpm: player wins ${pct.toFixed(0)}%  ` +
      `(bot ${b.wpm.toFixed(0)} raw wpm, ${Math.round(b.accuracy * 100)}%; median ${lens[lens.length >> 1].toFixed(0)} s)  ${ok ? "ok" : "OUTSIDE 45 to 55"}`);
  }
}
console.log(failed ? `\n${failed} check(s) failed` : "\nAll rule checks passed");
process.exitCode = failed ? 1 : 0;
