// Headless checks for the duel rules. No browser, no libraries.
// Run from the project folder:   node tests/duel-sim.js
//   optional numbers: matches per cell for the calibration table, per bot for the beat-at check, per weapon pair
//   (default 40 300 300; e.g. node tests/duel-sim.js 0 0 0 runs only the rule checks)
// Part 1 checks the rules. Part 2 calibrates the bots against a simulated player. Part 3 plays weapon pairs at equal skill.
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

// ---------- Part 1c: weapons ----------
console.log("Weapons");
{
  const g = load(), D = g.CONFIG.duel;
  const W = (id) => g.weaponFor(id);
  const words = (d, side) => d.streams[side].words.map((w) => w.text);
  const a = new g.Duel(), b = new g.Duel();
  a.start(42, ["light", "heavy"]); b.start(42, ["light", "heavy"]);
  check("same seed and weapons give the same words and ultimate words",
    words(a, 0).join() === words(b, 0).join() && words(a, 1).join() === words(b, 1).join() &&
    a.streams[0].source.hardWord() === b.streams[0].source.hardWord() && a.streams[1].source.hardWord() === b.streams[1].source.hardWord());
  check("Light words are easy common words of 2 to 4 letters (no q x z j, no same-finger pairs)",
    words(a, 0).every((w) => g.COMMON_WORDS.includes(w) && w.length >= 2 && w.length <= 4 && g.easyWord(w)) &&
    !g.LIGHT_POOL.includes("kill") && !g.LIGHT_POOL.includes("my") && g.LIGHT_POOL.length >= 100);
  check("Heavy words come from the greatsword list (7 to 12 letters)", words(a, 1).every((w) => g.GREATSWORD_WORDS.includes(w) && w.length >= 7 && w.length <= 12));
  check("greatsword list has at least 150 unique words of 7 to 12 letters",
    g.GREATSWORD_WORDS.length >= 150 && new Set(g.GREATSWORD_WORDS).size === g.GREATSWORD_WORDS.length && g.GREATSWORD_WORDS.every((w) => /^[a-z]{7,12}$/.test(w)));
  const ults = (id, n) => { const d = new g.Duel(); d.start(5, [id, id]); const s = d.streams[0].source; return Array.from({ length: n }, () => s.hardWord()); };
  check("Light ultimate words are 6 to 8 letters", ults("light", 50).every((w) => g.LIGHT_ULT_WORDS.includes(w) && w.length >= 6 && w.length <= 8));
  check("Medium ultimate words are HARD_WORDS", ults("medium", 50).every((w) => g.HARD_WORDS.includes(w)));
  check("Heavy ultimate words are 11 letters or more", ults("heavy", 50).every((w) => g.GREATSWORD_ULT_WORDS.includes(w) && w.length >= 11));
  const m = new g.Duel(), o = new g.Duel(); m.start(42, ["medium", "medium"]); o.start(42);
  check("Medium uses the original words (same as no weapon)", words(m, 0).join() === words(o, 0).join() && words(m, 1).join() === words(o, 1).join());
  check("Medium numbers are the globals", W("medium").power === 1 && W("medium").wordsPerCombo === D.wordsPerCombo &&
    W("medium").comboRequired === D.ultimate.comboRequired && W("medium").mistakeCharge === D.ultimate.mistakeCharge);
  check("a bot without a weapon uses Medium", g.CONFIG.weapons.botWeapon === "medium");

  // Clean words to combo x1 and to the ultimate, per weapon.
  const reach = (id) => {
    const d = new g.Duel(); d.start(9, [id, "medium"]); fight(g, d);
    const me = d.typists[0]; me.charge = 100;
    let toCombo = 0, toUlt = 0;
    for (let n = 1; n <= 40 && !toUlt; n++) {
      typeWord(d, 0); me.charge = 100;
      if (!toCombo && me.comboLevel >= 1) toCombo = n;
      if (me.ultReady()) toUlt = n;
    }
    return [toCombo, toUlt];
  };
  const [hc, hu] = reach("heavy"), [lc, lu] = reach("light"), [mc, mu] = reach("medium");
  check(`Heavy: combo x1 after 3 clean words (${hc}), ultimate after 3 (${hu})`, hc === 3 && hu === 3);
  check(`Light: combo x1 after 5 (${lc}), ultimate after 15 (${lu})`, lc === 5 && lu === 15);
  check(`Medium: combo x1 after 5 (${mc}), ultimate after 10 (${mu})`, mc === 5 && mu === 10);

  // Power multiplier and mistake charge.
  const d = new g.Duel(); d.start(3, ["heavy", "light"]); fight(g, d);
  for (const t of d.typists) { t.stamps = []; t.firstStamp = d.t - 4; for (let k = 0; k < 20; k++) t.stamps.push(d.t - k * 0.15); }
  const [hv, lt] = d.typists, close = (x, y) => Math.abs(x - y) < 1e-9;
  check(`the power multiplier applies (heavy x${W("heavy").power}, light x${W("light").power})`,
    close(hv.power(d.t), hv.wpm(d.t) * W("heavy").power) && close(lt.power(d.t), lt.wpm(d.t) * W("light").power));
  hv.charge = 50; lt.charge = 50; hv.wrong(d.t); lt.wrong(d.t);
  check("mistake charge comes from the weapon", close(hv.charge, 50 - W("heavy").mistakeCharge) && close(lt.charge, 50 - W("light").mistakeCharge));
  hv.counterUntil = d.t + 1; hv.stunUntil = d.t + 1;
  check("a stun still means power 0 with any weapon", hv.power(d.t) === 0);
  check(`power multipliers stay in their ranges (light ${W("light").power} in 0.80 to 0.95, heavy ${W("heavy").power} in 1.10 to 1.35)`,
    W("light").power >= 0.8 && W("light").power <= 0.95 && W("heavy").power >= 1.1 && W("heavy").power <= 1.35);
  const h0 = new g.Duel(); h0.start(4, ["heavy", "medium"]); fight(g, h0);
  h0.typists[0].charge = 99;
  for (let i = 0; i < 3; i++) typeWord(h0, 0);
  check("Heavy at combo x1 still needs a full gold bar", h0.typists[0].comboLevel === 1 && !h0.typists[0].ultReady());
}

// ---------- Part 1d: bots ----------
console.log("Bots");
{
  const g = load(), B = g.CONFIG.duel.bots, M = g.CONFIG.duel.matchMe;
  check("six levels at about 30, 45, 60, 75, 90 and 110 wpm", B.length === 6 && B.map((b) => b.beatAt).join() === "30,45,60,75,90,110");
  check("each level has a personality (style, accuracy, recovery, drift)", B.every((b) => b.style && b.accuracy > 0.8 && b.recovery.length === 2 && b.drift >= 0) &&
    new Set(B.map((b) => b.style)).size === 6 && B.some((b) => b.weapon === "heavy"));
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
// The simulated player: a Bot typing at 96% accuracy with the Bo staff and the default typo recovery, its key
// rate set by Bot.rawWpmFor so its MEASURED average (correct keystrokes only, like the result screen) is the
// given wpm. A bot is calibrated when that player, at the bot's `beatAt`, wins 45 to 55%.
const NC = process.argv[2] !== undefined ? +process.argv[2] : 40, NB = process.argv[3] !== undefined ? +process.argv[3] : 300;
const playerCfg = (g, wpm) => { const c = { accuracy: 0.96, weapon: "medium" }; c.wpm = g.Bot.rawWpmFor(wpm, c); return c; };
function botVs(g, playerWpm, botCfg) {
  const duel = new g.Duel();
  duel.start((Math.random() * 1e9) | 0, ["medium", botCfg.weapon || g.CONFIG.weapons.botWeapon]);
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
  const d = new g.Duel(); d.start((Math.random() * 1e9) | 0, [cfg.weapon || "medium", "medium"]); fight(g, d);
  const b = new g.Bot(cfg, d.streams[0], (e, t) => d.handleEvents(0, e, t)); b.nextKeyAt = 0.5;
  for (let t = 0; t < secs; t += STEP) { d.t = t; b.update(t); }
  const s = d.typists[0].stats; return s.correct / 5 / ((s.lastKeyAt - s.firstKeyAt) / 60);
}
const g = load();
const matchBot = (target) => { const M = g.CONFIG.duel.matchMe; const c = Object.assign({}, M, { beatAt: target }); c.wpm = g.Bot.rawWpmFor(target, c); return c; };
const calBots = g.CONFIG.duel.bots.concat([Object.assign(matchBot(50), { name: "MATCH ME 50" }), Object.assign(matchBot(90), { name: "MATCH ME 90" })]);
if (NC > 0) {
  const speeds = [30, 45, 60, 75, 90, 110, 130];
  console.log(`\nCalibration table (${NC} matches per cell): win% of a simulated player at 96% accuracy, Bo staff`);
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
      `(bot ${b.wpm.toFixed(0)} raw wpm, ${Math.round(b.accuracy * 100)}%, ${b.weapon || "medium"}; median ${lens[lens.length >> 1].toFixed(0)} s)  ${ok ? "ok" : "OUTSIDE 45 to 55"}`);
  }
}
// ---------- Part 3: weapon pairs at equal skill ----------
// MODELLING ASSUMPTIONS (sim only, not game rules; GUESSES, to replace with measured numbers after real play):
// easier words are typed faster and cleaner, harder words slower and sloppier. Light's pool is now truly easy
// (2 to 4 letters, no awkward pairs), so the guess is 6% faster and 1 point more accurate; Heavy 8% slower and
// 1.5 points less accurate.
const TYPING_MODEL = {
  light:  { speed: 1.06, accuracy: 0.01 },   // GUESS
  medium: { speed: 1.00, accuracy: 0 },
  heavy:  { speed: 0.92, accuracy: -0.015 }, // GUESS
};
const NW = process.argv[4] !== undefined ? +process.argv[4] : 300;
function weaponMatch(g, wpm, acc, wa, wb, seed) {
  const duel = new g.Duel();
  duel.start(seed, [wa, wb]);
  const cfg = (w) => ({ wpm: wpm * TYPING_MODEL[w].speed, accuracy: acc + TYPING_MODEL[w].accuracy });
  const bots = [
    new g.Bot(cfg(wa), duel.streams[0], (e, t) => duel.handleEvents(0, e, t)),
    new g.Bot(cfg(wb), duel.streams[1], (e, t) => duel.handleEvents(1, e, t)),
  ];
  bots[0].nextKeyAt = 0.5; bots[1].nextKeyAt = 0.5;
  while (duel.phase !== "over" && duel.t < 300) {
    if (duel.phase === "fight") bots.forEach((b) => b.update(duel.t));
    duel.update(STEP);
  }
  return { won: duel.result ? duel.result.winner === 0 : Math.random() < 0.5, t: duel.t };
}
if (NW > 0) {
  console.log(`\nWeapon pairs at equal skill (${NW} matches per pair, seats alternated; win% of the FIRST weapon; target 40 to 60%)`);
  console.log("weapons: " + g.CONFIG.weapons.list.map((w0) => { const w = g.weaponFor(w0.id); return `${w.id} x${w.power} power, ${w.wordsPerCombo}/combo, ult at x${w.comboRequired}`; }).join("  |  "));
  console.log("sim typing model (GUESSES): " + Object.entries(TYPING_MODEL).map(([k, v]) => `${k} x${v.speed} speed ${v.accuracy >= 0 ? "+" : ""}${(v.accuracy * 100).toFixed(1)} acc`).join(", "));
  const pairs = [["light", "medium"], ["heavy", "medium"], ["light", "heavy"]];
  console.log("skill            " + pairs.map(([a, b]) => `${a} vs ${b}`.padEnd(20)).join(""));
  for (const [w, acc, note] of [[60, 0.96, ""], [80, 0.97, ""], [40, 0.95, "  (information only, see CLAUDE.md)"]]) {
    const cells = pairs.map(([a, b]) => {
      let won = 0;
      for (let k = 0; k < NW; k++) { const first = k % 2 === 0; const r = weaponMatch(g, w, acc, first ? a : b, first ? b : a, (Math.random() * 1e9) | 0); if (r.won === first) won++; }
      const pct = Math.round((100 * won) / NW);
      return (pct + "%" + (pct < 40 || pct > 60 ? " !" : "")).padEnd(20);
    });
    console.log(`${w} wpm, ${Math.round(acc * 100)}% acc   ${cells.join("")}${note}`);
  }
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll rule checks passed");
process.exitCode = failed ? 1 : 0;
