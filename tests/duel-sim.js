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
  for (const f of ["config.js", "words.js", "duel-typing.js", "fighter.js", "duel.js", "modes.js"]) {
    const src = fs.readFileSync(path.join(root, "js", f), "utf8")
      .replace(/^const (\w+) =/gm, "var $1 =")
      .replace(/^class (\w+)/gm, "var $1 = class $1");
    vm.runInContext(src, ctx, { filename: f });
  }
  ctx.CONFIG.duel.basis = "wpm"; // the older rule checks assume power from wpm; the accuracy basis has its own part below
  ctx.CONFIG.duel.typo.ultimateOnly = false; // the rule checks below test the skip rule on every word; the default (ultimate word only) has its own part
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
  check("a wrong key from combo x1 drops it to x0 (half a level off the streak)", me.comboLevel === 0 && me.streak === D.wordsPerCombo * (1 - D.typo.comboLoss) && duel.fx.some((f) => f.text === "COMBO BROKEN"));

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

  const auto = new g.Duel(); auto.start(13); fight(g, auto);
  const s = auto.streams[0], w = s.current().text;
  for (const ch of w) s.press(ch);
  const cleanAuto = s.submit(false);
  check("auto-submit advances a completed clean word without a phantom key", s.index === 1 &&
    cleanAuto.length === 1 && cleanAuto[0].type === "word" && cleanAuto[0].clean);
  // A dirty word that is finished by auto-submit only exists with the typo rule off (with it on, the first
  // wrong key skips the word, see the Typo rule part).
  const gl = load(); gl.CONFIG.duel.typo.skipWord = false;
  const autoL = new gl.Duel(); autoL.start(13); fight(gl, autoL);
  const sl = autoL.streams[0]; sl.press("z"); const dirty = sl.current().text;
  for (let i = 1; i < dirty.length; i++) sl.press(dirty[i]);
  const dirtyAuto = sl.submit(false);
  check("auto-submit advances a completed dirty word (typo rule off)", sl.index === 1 &&
    dirtyAuto.length === 1 && dirtyAuto[0].type === "word" && !dirtyAuto[0].clean);

  const src = fs.readFileSync(path.join(root, "js", "duel.js"), "utf8");
  check("duel.js has no Math.random, clock, keyboard or bot", !/Math\.random|performance\.now|Date\.now|keydown|new Bot/.test(src));
}

// ---------- Part 1c: counter strike (damage for the combo words lost) ----------
console.log("Counter strike");
{
  const g = load(), D = g.CONFIG.duel, C = D.counter;
  g.CONFIG.duel.basis = "accuracy"; g.CONFIG.duel.typo.ultimateOnly = true;
  const fresh = () => { const d = new g.Duel(); d.start(31); fight(g, d); return d; };
  const wrong = (d, side) => { const s = d.streams[side]; const c = s.current().text[0]; d.handleEvents(side, s.press(c === "z" ? "y" : "z"), d.t); };
  const near = (a, b) => Math.abs(a - b) < 1e-6;

  let d = fresh(), me = d.typists[0], foe = d.typists[1];
  me.streak = 20; me.updateCombo(); wrong(d, 0);
  check("losing 10 combo words costs 5 HP", near(me.hp, 100 - 10 * C.damagePerWord) && foe.hp === 100 && me.streak === 10);
  check("the counter text shows the damage", d.fx.some((f) => f.text === "-5 HP"));
  check("the counter power window still starts", foe.countering(d.t));

  d = fresh(); me = d.typists[0];
  me.streak = 200; me.updateCombo(); wrong(d, 0);
  check(`the damage is capped at ${C.maxDamage} HP`, near(me.hp, 100 - C.maxDamage));

  d = fresh(); me = d.typists[0];
  me.streak = 4; me.updateCombo(); wrong(d, 0);
  check("a combo too small to drop a level costs no HP", me.hp === 100);

  d = fresh(); me = d.typists[0];
  me.streak = 20; me.updateCombo(); wrong(d, 0); wrong(d, 0);
  check("a second slip in the same word does not strike again", near(me.hp, 95));

  d = fresh(); me = d.typists[0];
  me.hp = 3; me.streak = 20; me.updateCombo(); wrong(d, 0);
  check("a counter strike can knock out", d.phase === "over" && d.result.winner === 1 && me.hp === 0);

  // The snapshot carries the HP, so the guest sees the same loss.
  d = fresh(); me = d.typists[0];
  me.streak = 20; me.updateCombo(); wrong(d, 0);
  const guest = new g.Duel(); guest.start(31); fight(g, guest);
  guest.applySnapshot(JSON.parse(JSON.stringify(d.snapshot(true))), true);
  check("the guest receives the damaged HP", near(guest.typists[0].hp, me.hp) || near(guest.typists[1].hp, me.hp));
}

// ---------- Part 1d: round timer, no-damage sides, carried HP ----------
console.log("Round options");
{
  const g = load(), D = g.CONFIG.duel;
  const mk = (opts) => { const d = new g.Duel(); d.start(41, undefined, opts); fight(g, d); return d; };
  const run = (d, secs) => { for (let i = 0; i < Math.round(secs / STEP) && d.phase === "fight"; i++) d.update(STEP); };
  let d = mk({ timer: 30 });
  check("a timed round reports time left", Math.abs(d.timeLeft() - 30) < 0.05);
  d.typists[0].hp = 70; run(d, 31);
  check("the timer ends the round and the higher HP wins", d.phase === "over" && d.result.winner === 1 && d.result.byTime === true);
  d = mk({ timer: 30 }); d.typists[1].hp = 40; run(d, 31);
  check("... on the other side too", d.result.winner === 0);
  d = mk({ timer: 30 }); d.typists[0].stats.correct = 9; run(d, 31);
  check("level HP goes to the typist with more right keys", d.result.winner === 0);
  d = mk({}); run(d, 40);
  check("no timer means no time limit", d.phase === "fight" && d.timeLeft() === null);
  d = mk({ noDamage: [true, true], timer: 0 });
  d.damage(0, 50); d.damage(1, 50);
  check("a no-damage side loses no HP", d.typists[0].hp === D.maxHp && d.typists[1].hp === D.maxHp);
  d.power = [0, 0]; d.typists[0].power = () => 10; d.typists[1].power = () => 90; run(d, 5);
  check("... even against a much faster typist, and nobody is knocked out", d.typists[0].hp === D.maxHp && d.phase === "fight");
  d = mk({ noDamage: [false, true] });
  d.damage(0, 30); d.damage(1, 30);
  check("only the protected side is spared", d.typists[0].hp === D.maxHp - 30 && d.typists[1].hp === D.maxHp);
  d = mk({ hp: [55, 100] });
  check("the starting HP can be carried in", d.typists[0].hp === 55 && d.typists[1].hp === 100);
  d = mk({ timer: 30 }); run(d, 12);
  const snap = JSON.parse(JSON.stringify(d.snapshot(true)));
  const gd = new g.Duel(); gd.start(41, undefined, { timer: 30 }); fight(g, gd); gd.applySnapshot(snap, true);
  check("the guest gets the same time left from a snapshot", Math.abs(gd.timeLeft() - d.timeLeft()) < 0.02);
}

// ---------- Part 1e: game modes (js/modes.js) ----------
console.log("Modes");
{
  const g = load(), M = g.Modes, C = g.CONFIG.modes;
  const R = (o) => M.cleanRules(o);
  check("bad rules fall back to the defaults", JSON.stringify(R({ rounds: 9, timer: 17, endless: "yes", words: "x" })) === JSON.stringify({ rounds: 1, timer: 0, endless: false, words: "mix" }));
  check("good rules pass through", JSON.stringify(R({ rounds: 5, timer: 45, endless: true, words: "off" })) === JSON.stringify({ rounds: 5, timer: 45, endless: true, words: "off" }));
  check("the defaults are one round, 120 s, not endless, mix", g.CONFIG.settings.defaults.mRounds === 1 && g.CONFIG.settings.defaults.mTimer === 120 && g.CONFIG.settings.defaults.mEndless === false && g.CONFIG.settings.defaults.mWords === "mix");
  check("rounds go up to 5, timers are 30 45 60 120 or off", Math.max(...C.roundSteps) === 5 && [30, 45, 60, 120, 0].every((t) => C.timerSteps.includes(t)));
  check("one round: the first win ends the match", M.status(R({ rounds: 1 }), [1, 0]).over && M.status(R({ rounds: 1 }), [0, 1]).winner === 1);
  check("best of 3 ends at 2 wins", !M.status(R({ rounds: 3 }), [1, 0]).over && M.status(R({ rounds: 3 }), [2, 0]).over && M.status(R({ rounds: 3 }), [1, 2]).winner === 1);
  check("best of 5 ends at 3 wins", !M.status(R({ rounds: 5 }), [2, 1]).over && M.status(R({ rounds: 5 }), [3, 1]).winner === 0);
  check("2 rounds: a 1 to 1 tie plays one more", !M.status(R({ rounds: 2 }), [1, 1]).over && M.status(R({ rounds: 2 }), [2, 1]).winner === 0);
  check("endless never ends", !M.status(R({ endless: true }), [5, 0]).over);
  check("word submit: on and off decide for both, mix follows the player", !M.autoEnds("on", false) && M.autoEnds("off", true) && M.autoEnds("mix", false) && !M.autoEnds("mix", true));
  check("practice settings are cleaned", M.cleanPractice({ wpm: 77, accuracy: 12, dummyHurt: 1 }).wpm === C.practice.defaults.wpm && M.cleanPractice({ wpm: 0 }).wpm === 0);
  check("a dummy that cannot be hurt, a player that can", JSON.stringify(M.duelOpts("practice", R({}), M.cleanPractice({ youHurt: true, dummyHurt: false })).noDamage) === "[false,true]");
  check("online endless protects both, offline bots ignore it", JSON.stringify(M.duelOpts("online", R({ endless: true })).noDamage) === "[true,true]" && JSON.stringify(M.duelOpts("bots", R({ endless: true })).noDamage) === "[false,false]");
  check("a bots match passes the round timer on", M.duelOpts("bots", R({ timer: 45 })).timer === 45 && M.duelOpts("endless", R({ timer: 45 })).timer === 0);
  check("offline Endless can switch HP loss off", JSON.stringify(M.duelOpts("endless", R({}), null, false).noDamage) === "[true,true]" && JSON.stringify(M.duelOpts("endless", R({}), null, true).noDamage) === "[false,false]");
  check("every dummy speed can become a bot that really types it", C.practice.wpmSteps.filter((w) => w > 0).every((w) => { const c = g.Bot.cfgFor(M.dummyCard(M.cleanPractice({ wpm: w }))); return isFinite(c.wpm) && c.wpm >= w * 0.9; }));
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
  const miss = () => { duel.handleEvents(0, duel.streams[0].press("#"), duel.t); duel.streams[0].backspace(); me.streak = me.streak; };
  // Start from an empty streak, then type exactly enough clean words for combo x1 (the typo rule only takes half a level,
  // so a mistake from combo x1 drops it to x0 and counters; leftover streak from earlier tests would hide that).
  const buildCombo = () => { me.streak = 0; me.updateCombo(); for (let i = 0; i < D.wordsPerCombo; i++) typeWord(duel, 0); };

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

// ---------- Part 1b2: the typo rule ----------
console.log("Typo rule");
{
  const g = load(), D = g.CONFIG.duel, T = D.typo;
  const fresh = (seed) => { const d = new g.Duel(); d.start(seed || 21); fight(g, d); return d; };
  const wrongKey = (text, i) => (text[i] === "z" ? "y" : "z");
  const type = (d, side, str) => { const s = d.streams[side]; for (const ch of str) d.handleEvents(side, s.press(ch), d.t); };

  let d = fresh(), s = d.streams[0], me = d.typists[0];
  const first = s.current().text, second = s.words[1].text;
  type(d, 0, first[0] + wrongKey(first, 1));
  check("a wrong key skips the word at once", s.index === 1 && s.typed === "" && s.words[0].skipped === true && s.words[0].clean === false);
  check("the skipped word is reported for the plate", me.lastSkipText === first && me.lastSkipAt === d.t && me.stats.skipped === 1);
  check("no punch is thrown for a skipped word", d.fighters[0].state === "idle" && d.fighters[0].moveCount === 0);
  check("the wrong key is counted as a mistake", me.stats.wrong === 1 && me.stats.correct === 1);

  // Half a combo level comes off the streak; the level holds when it can.
  d = fresh(); s = d.streams[0]; me = d.typists[0]; const foe = d.typists[1];
  me.streak = D.wordsPerCombo * 2; me.updateCombo();
  type(d, 0, wrongKey(s.current().text, 0));
  check(`a mistake at combo x2 takes ${T.comboLoss} of a level: x2 with ${D.wordsPerCombo * 1.5} words`, me.streak === D.wordsPerCombo * 1.5 && me.comboLevel === 1);
  check("... that dropped it to x1 (a level is gone)", me.comboLevel === 1 && foe.countering(d.t) && d.fx.some((f) => f.text === "COMBO BROKEN"));
  me.streak = D.wordsPerCombo * 1.8; me.updateCombo(); foe.counterUntil = 0; d.fx = [];
  type(d, 0, wrongKey(s.current().text, 0));
  check("a mistake that keeps the level gives a small text and no counter", me.comboLevel === 1 && !foe.countering(d.t) && d.fx.some((f) => /^MISS -/.test(f.text)));
  me.streak = 1; me.updateCombo();
  type(d, 0, wrongKey(s.current().text, 0));
  check("the streak never goes below 0", me.streak === 0);

  // The streak is capped at the top level, so a long streak does not hide the loss.
  d = fresh(); s = d.streams[0]; me = d.typists[0];
  for (let i = 0; i < D.wordsPerCombo * D.maxComboLevel + 8; i++) typeWord(d, 0);
  check("the streak stops at the top combo level", me.comboLevel === D.maxComboLevel && me.streak === D.wordsPerCombo * D.maxComboLevel);
  type(d, 0, wrongKey(s.current().text, 0));
  check("a mistake at the top costs half a level at once", me.comboLevel === D.maxComboLevel - 1);

  // Ending a word early with Space is a miss too.
  d = fresh(); s = d.streams[0]; me = d.typists[0]; me.streak = D.wordsPerCombo; me.updateCombo();
  type(d, 0, s.current().text.slice(0, 2));
  d.handleEvents(0, s.press(" "), d.t);
  check("Space before the end of the word is a miss", s.words[0].skipped === true && me.streak === D.wordsPerCombo * (1 - T.comboLoss));

  // The letters you were still typing for the skipped word do not skip the next one.
  d = fresh(); s = d.streams[0]; me = d.typists[0];
  const w0 = s.current().text, w1 = s.words[1].text;
  const tail = w0.slice(2);
  type(d, 0, w0[0] + wrongKey(w0, 1));          // skipped at letter 2
  const wrongAfter = me.stats.wrong;
  // finishing the old word: letters after the failed one, then Space
  const rest = w0.slice(2) + " ";
  type(d, 0, rest);
  const swallowed = w1[0] !== rest[0] ? (s.index === 1 && s.typed === "" && me.stats.wrong === wrongAfter) : true;
  check("the rest of the skipped word is swallowed, then Space ends it", swallowed);
  type(d, 0, w1);
  d.handleEvents(0, s.press(" "), d.t);
  check("the next word still types normally afterwards", s.words[1].clean === true && s.index === 2);
  // Starting the next word right away is never swallowed.
  d = fresh(); s = d.streams[0]; me = d.typists[0];
  type(d, 0, s.current().text[0] + wrongKey(s.current().text, 1));
  const n1 = s.current().text;
  type(d, 0, n1[0]);
  check("the first letter of the next word is never swallowed", s.typed === n1[0]);

  // A skipped ultimate word is a sloppy ultimate.
  d = fresh(); s = d.streams[0]; me = d.typists[0];
  me.streak = D.wordsPerCombo * D.ultimate.comboRequired; me.updateCombo(); me.charge = 100; d.checkUltimateReady(0);
  typeWord(d, 0);
  const ultText = s.current().text;
  check("the ultimate word is next", s.current().ultimate === true);
  const hp0 = d.typists[1].hp;
  type(d, 0, wrongKey(ultText, 0));
  for (let i = 0; i < 240 && !(d.fighters[0].ult && d.fighters[0].ult.fired); i++) d.update(STEP);
  check("a typo on the ultimate word fires the sloppy ultimate (no stun)", d.fighters[0].ult && d.fighters[0].ult.clean === false && d.typists[1].hp < hp0 && d.t >= d.typists[1].stunUntil);

  // The bot never swallows its own next word.
  d = fresh();
  const bot = new g.Bot({ wpm: 60, accuracy: 0, drift: 0, recovery: [0, 0] }, d.streams[1], (e, t) => d.handleEvents(1, e, t));
  bot.keystroke(1);
  check("a bot moves straight on after a typo (nothing left to swallow)", d.streams[1].rest === null && d.streams[1].index === 1);

  // The old rule is one config flag away.
  const g2 = load(); g2.CONFIG.duel.typo.skipWord = false;
  const d2 = new g2.Duel(); d2.start(21); fight(g2, d2);
  const s2 = d2.streams[0], m2 = d2.typists[0]; m2.streak = 7; m2.updateCombo();
  d2.handleEvents(0, s2.press(wrongKey(s2.current().text, 0)), d2.t);
  check("with skipWord off a wrong key keeps the caret going and resets the streak", s2.index === 0 && s2.typed.length === 1 && m2.streak === 0);
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
  check("seven levels, each faster than the one before", B.length === 7 && B.every((b, i) => i === 0 || b.wpm > B[i - 1].wpm));
  check("each level has a personality (style, accuracy, recovery, drift)", B.every((b) => b.style && b.accuracy > 0.75 && b.recovery.length === 2 && b.drift >= 0) &&
    new Set(B.map((b) => b.style)).size === 7);
  check("each bot plays as a fighter, all different", B.every((b) => typeof b.char === "string") && new Set(B.map((b) => b.char).concat([M.char])).size === 8);
  check("MATCH ME: last 3 matches, starts at 60 wpm", M.history === 3 && M.start === 60 && /wpm/.test(M.storageKey));
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

// Power from accuracy, and the combo bonus per clean word.
console.log("Accuracy power");
{
  const g = load(); g.CONFIG.duel.basis = "accuracy"; g.CONFIG.duel.typo.ultimateOnly = true;
  const D = g.CONFIG.duel, d = new g.Duel(); d.start(77); fight(g, d);
  const me = d.typists[0], s = d.streams[0];
  check("before any key a typist has no power", me.power(d.t) === 0);
  typeWord(d, 0); typeWord(d, 0);
  const p0 = me.power(d.t);
  check(`all keys right: power is about 100 (${p0.toFixed(1)})`, p0 > 99 && p0 <= 100.5);
  const first = s.current().text, wrongCh = first[1] === "q" ? "z" : "q";
  d.handleEvents(0, s.press(first[0]), d.t); d.handleEvents(0, s.press(wrongCh), d.t);
  check("a wrong key lowers power", me.power(d.t) < p0 - 5);
  check("power ignores speed: the same keys typed slower give the same power", (() => { const a = me.power(d.t); d.t += 1.5; return Math.abs(me.power(d.t) - a) < 1e-9; })());
  d.t += D.accuracy.idleAfter + 0.1;
  check("no key for idleAfter seconds means no power", me.power(d.t) === 0);
  // The combo bonus: +0.25% per clean word.
  const e = new g.Duel(); e.start(78); fight(g, e);
  const m2 = e.typists[0];
  for (let i = 0; i < 20; i++) typeWord(e, 0);
  check("20 clean words in a row is combo 20", Math.floor(m2.streak) === 20 && m2.stats.bestCombo === 20);
  check(`combo 20 multiplies power by ${1 + 20 * D.comboStep}`, Math.abs(m2.comboMultiplier() - (1 + 20 * D.comboStep)) < 1e-9);
  check("combo is not capped at the old level 5 (25 words)", (() => { for (let i = 0; i < 15; i++) typeWord(e, 0); return Math.floor(m2.streak) === 35; })());
  const before = m2.power(e.t);
  e.handleEvents(0, e.streams[0].press("#"), e.t);
  check("a mistake halves the combo (35 words become 17.5)", m2.streak === 17.5 && m2.power(e.t) < before);
  e.handleEvents(0, e.streams[0].press("#"), e.t);
  check("a second wrong key in the same word does not halve it again", m2.streak === 17.5);
  e.streams[0].backspace();
  typeWord(e, 0); e.handleEvents(0, e.streams[0].press("#"), e.t);
  check("a mistake in the next word halves it again", m2.streak === 9.25 || m2.streak === 8.75 || m2.streak === 9.5 || (m2.streak > 8 && m2.streak < 10));
  // Healing follows the typist's own speed.
  const h = new g.Duel(); h.start(79); fight(g, h);
  h.typists[0].hp = 50; h.typists[1].hp = 50;
  h.typists[0].wpm = () => 100; h.typists[1].wpm = () => 20;
  h.typists.forEach((x) => { x.power = () => 90; });
  const hp0 = h.typists.map((x) => x.hp);
  for (let i = 0; i < 120; i++) { h.t += STEP; h.fightMath(STEP); }
  check("the faster typist heals more", h.typists[0].hp - hp0[0] > 2 * (h.typists[1].hp - hp0[1]) && h.typists[1].hp > hp0[1]);
  // The numbers swap with the basis.
  check("duelTune picks the accuracy numbers", g.duelTune("damageScale") === D.accuracy.damageScale);
  g.CONFIG.duel.basis = "wpm";
  check("duelTune picks the wpm numbers when the basis is wpm", g.duelTune("damageScale") === D.damageScale);
}

// The default: the skip rule applies to the ultimate word only.
console.log("Typo rule: ultimate word only");
{
  const g = load(); g.CONFIG.duel.typo.ultimateOnly = true;
  const D = g.CONFIG.duel, d = new g.Duel(); d.start(31); fight(g, d);
  const me = d.typists[0], s = d.streams[0];
  for (let i = 0; i < D.wordsPerCombo; i++) typeWord(d, 0);
  check("combo x1 built", me.comboLevel === 1);
  const first = s.current().text, wrongCh = first[0] === "q" ? "z" : "q";
  d.handleEvents(0, s.press(wrongCh), d.t);
  check("a normal word is not skipped: the caret keeps going", s.current().text === first && s.typed.length === 1);
  check("a normal word mistake resets the streak (the old rule)", me.streak === 0 && me.comboLevel === 0);
  s.backspace();
  check("Backspace works on a normal word", s.typed.length === 0);
  // Put an ultimate word in front and mistype it.
  const ult = { text: "quarantine", ultimate: true, clean: true };
  s.words.splice(s.index, 0, ult);
  for (let i = 0; i < D.wordsPerCombo; i++) { /* rebuild some streak */ }
  me.streak = D.wordsPerCombo * 2;
  me.comboLevel = 2;
  d.handleEvents(0, s.press("x"), d.t);
  check("the ultimate word is skipped at once", s.current().text !== "quarantine" && ult.skipped === true);
  check("a skipped ultimate word costs only half a level", me.streak === D.wordsPerCombo * 2 - D.wordsPerCombo * D.typo.comboLoss);
  s.current().text = "zebra"; // so the next word does not start with the key we press
  const at = s.index;
  d.handleEvents(0, s.press("u"), d.t);
  check("the rest of the skipped ultimate word is ignored", s.index === at && s.typed === "");
}

// Online: the snapshot the host sends stays small, and the guest can play it back and keep it moving.
console.log("Online snapshot");
{
  const g = load();
  const host = new g.Duel(); host.start(777, ["medium", "medium"]);
  const guest = new g.Duel(); guest.start(777, ["medium", "medium"]); guest.streams = [guest.streams[1], guest.streams[0]];
  fight(g, host);
  for (let i = 0; i < 6; i++) { typeWord(host, 0); typeWord(host, 1); for (let k = 0; k < 40; k++) host.update(STEP); }
  const snap = host.snapshot(true), json = JSON.stringify({ t: "state", v: 1, n: 1, s: snap });
  const plain = JSON.stringify({ t: "state", v: 1, n: 2, s: host.snapshot(false) }).length;
  check(`a full snapshot is under 2 KB and a plain one under 1.6 KB (${json.length} and ${plain} bytes)`, json.length < 2000 && plain < 1600);
  check("a plain snapshot has no stats block", host.snapshot(false).stats === undefined);
  check("the guest's own stream is not sent", snap.streams[1] === null);
  guest.applySnapshot(JSON.parse(json).s, true);
  check("the guest sees the host's hp mirrored", guest.typists[1].hp === Math.round(host.typists[0].hp * 100) / 100 && guest.typists[0].hp === Math.round(host.typists[1].hp * 100) / 100);
  check("the guest sees the host's word stream on the far side", guest.streams[1].current().text === host.streams[0].current().text);
  const hp = guest.typists.map((x) => x.hp), t0 = guest.t;
  for (let i = 0; i < 30; i++) guest.advanceRemote(1 / 60);
  check("advanceRemote moves the clock but never the hp", guest.t > t0 + 0.4 && guest.typists.every((x, i) => x.hp === hp[i]));
  const fx0 = guest.fighters[0].x, tx = guest.fighters[0].tx;
  check("fighters ease toward the host's position", Math.abs(guest.fighters[0].x - tx) <= Math.abs(fx0 - tx) + 1e-9);
}

// ---------- Part 2: bot calibration ----------
// Power comes from accuracy, so the simulated player is a Bot typing at 60 raw wpm with the default typo recovery,
// its per-letter accuracy set by Bot.letterAccFor so its MEASURED keystroke accuracy (right keys over all keys,
// like the result screen) is the given percent. A bot is calibrated when that player, at the bot's `beatAt`,
// wins 45 to 55%.
const NC = process.argv[2] !== undefined ? +process.argv[2] : 40, NB = process.argv[3] !== undefined ? +process.argv[3] : 300;
// The simulated player: a Bot that types `wpm` measured wpm with 95% per-letter accuracy and the default recovery.
const playerCfg = (g, wpm) => g.Bot.cfgFor({ wpm, accuracy: 0.95, recovery: [0.18, 0.15], drift: 0.15 });
function soloAcc(g, cfg, secs) {
  const d = new g.Duel(); d.start((Math.random() * 1e9) | 0); fight(g, d);
  const b = new g.Bot(cfg, d.streams[0], (e, t) => d.handleEvents(0, e, t)); b.nextKeyAt = 0.5;
  for (let t = 0; t < secs; t += STEP) { d.t = t; b.update(t); }
  const s = d.typists[0].stats; return (100 * s.correct) / (s.correct + s.wrong);
}
function botVs(g, playerWpm, botCfg) {
  const duel = new g.Duel();
  duel.start((Math.random() * 1e9) | 0);
  const bots = [
    new g.Bot(playerCfg(g, playerWpm), duel.streams[0], (e, t) => duel.handleEvents(0, e, t)),
    new g.Bot(g.Bot.cfgFor(botCfg), duel.streams[1], (e, t) => duel.handleEvents(1, e, t)),
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
const g = load(); g.CONFIG.duel.typo.ultimateOnly = true; g.CONFIG.duel.basis = "speed"; // calibrate the bots with the shipped rules

console.log("Typing: Space ends a word off (auto-end)");
{
  const src = { n: 0, next() { return "alpha"; } };
  const st = new g.TypingStream(src);
  for (const ch of "alph") st.press(ch);
  check("a half typed word does not auto-end", !st.autoEnds());
  st.press("a");
  check("an exactly typed word auto-ends", st.autoEnds());
  const ev = st.submit(false);
  check("auto-end counts no phantom Space key", !ev.some((e) => e.type === "correct" || e.type === "wrong") && ev.some((e) => e.type === "word" && e.clean));
  const gl2 = load(); gl2.CONFIG.duel.typo.skipWord = false; // a typo that stays in the word only exists with the typo rule off
  const st2 = new gl2.TypingStream(src);
  for (const ch of "alphx") st2.press(ch);
  check("a full length word with a typo does not auto-end", !st2.autoEnds());
  st2.backspace(); st2.press("a");
  check("fixing the typo lets it auto-end, but the word is not clean", st2.autoEnds() && !st2.submit(false).find((e) => e.type === "word").clean);
  const st3 = new g.TypingStream(src);
  check("an empty word never auto-ends", !st3.autoEnds());
}
const matchBot = (target) => Object.assign({}, g.CONFIG.duel.matchMe, { wpm: target });
const calBots = g.CONFIG.duel.bots.concat([Object.assign(matchBot(40), { name: "MATCH ME 40" }), Object.assign(matchBot(90), { name: "MATCH ME 90" })]);
{
  console.log("Speed basis: a card is the wpm the bot really types");
  for (const b of calBots) {
    const m = soloWpm(g, g.Bot.cfgFor(b), 600);
    check(`${b.name.trim()} card says ${b.wpm} wpm and it really types ${m.toFixed(1)}`, Math.abs(m - b.wpm) <= Math.max(1.5, b.wpm * 0.04));
  }
  check("the cards run from 15 to 120 wpm, in order", g.CONFIG.duel.bots[0].wpm === 15 && g.CONFIG.duel.bots[g.CONFIG.duel.bots.length - 1].wpm === 120 &&
    g.CONFIG.duel.bots.every((x, i, a) => i === 0 || x.wpm > a[i - 1].wpm));
}
if (NC > 0) {
  const speeds = [15, 30, 45, 60, 80, 100, 120];
  console.log(`\nCalibration table (${NC} matches per cell): win% of a simulated player (95% accurate) at the given wpm`);
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
    for (let k = 0; k < NB; k++) { const r = botVs(g, b.wpm, b); if (r.won) won++; lens.push(r.t); }
    lens.sort((x, y) => x - y);
    const pct = (100 * won) / NB, ok = pct >= 45 && pct <= 55;
    console.log(`  ${b.name.padEnd(12)} beat it at about ${String(b.wpm).padStart(3)} wpm: player wins ${pct.toFixed(0)}%  ` +
      `(bot ${g.Bot.rawWpmFor(b.wpm, b).toFixed(0)} raw wpm, ${(b.accuracy * 100).toFixed(1)}% per letter; median ${lens[lens.length >> 1].toFixed(0)} s)  ${ok ? "ok" : "OUTSIDE 45 to 55"}`);
  }
}
console.log(failed ? `\n${failed} check(s) failed` : "\nAll rule checks passed");
process.exitCode = failed ? 1 : 0;
