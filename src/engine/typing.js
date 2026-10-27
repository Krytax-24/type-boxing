/**
 * Typing engine for the duel: no DOM, no canvas, no combat rules.
 * TypingStream is an endless line of words; Space ends a word. It types like Monkeytype: a wrong letter still moves
 * the caret and Backspace fixes letters inside the current word. Under the typo rule (CONFIG.duel.typo) a wrong
 * letter on the ultimate word skips that word at once.
 * Typist keeps one typist's speed, combo and ultimate charge. Bot types like a person at a set speed and accuracy.
 */
CounterType.define("typing", ["config", "words"], (CONFIG, words) => {
  "use strict";

  const { WORD_POOLS } = words;

  class TypingStream {
    constructor(source) {
      this.source = source;
      this.words = []; // { text, ultimate, clean }
      this.index = 0; // current word
      this.typed = ""; // what has been typed in the current word
      this.wordErrors = 0; // wrong keystrokes in the current word, even if fixed later
      // After a skipped word: { word, pos }, so the letters you were still typing are not read as the next word.
      this.rest = null;
      this.extend();
    }

    extend(n = 40) {
      for (let i = 0; i < n; i++) this.words.push({ text: this.source.next(), ultimate: false, clean: null });
    }

    current() {
      return this.words[this.index];
    }

    // Put a hard ultimate word right after the current word.
    insertNext(text) {
      this.words.splice(this.index + 1, 0, { text, ultimate: true, clean: null });
    }

    ultimateAhead() {
      return this.words.some((w, i) => w.ultimate && i >= this.index);
    }

    // The typo rule (CONFIG.duel.typo.skipWord, on by default): a wrong key ends the word at once as a miss.
    // Off, the stream behaves like Monkeytype (the caret keeps going and a wrong word is fixed with Backspace).
    // With `ultimateOnly` (the default) only the ultimate word follows the rule; every other word keeps the old
    // Monkeytype behavior (the caret keeps going, Backspace fixes it, a mistake resets the streak).
    skipsOnTypo() {
      const T = CONFIG.duel.typo;
      if (!T) return true;
      if (T.skipWord === false) return false;
      return !T.ultimateOnly || !!(this.current() && this.current().ultimate);
    }

    // Move on to the next word.
    advance() {
      this.index++;
      this.typed = "";
      this.wordErrors = 0;
      if (this.words.length - this.index < 40) this.extend();
    }

    // One keystroke. Returns a list of events:
    //   { type: "correct" } | { type: "wrong" } | { type: "word", word, clean, ultimate, skipped }
    // `skipped` is true when the word ended as a miss under the typo rule (a wrong key, or Space before the end).
    submit(countKey = true) {
      const w = this.current();
      const events = [];
      if (this.typed.length === 0) return events; // submit on an empty word does nothing
      const exact = this.typed === w.text;
      const clean = exact && this.wordErrors === 0;
      const skipped = !clean && this.skipsOnTypo();
      if (countKey) events.push(exact ? { type: "correct" } : { type: "wrong", skip: skipped, wi: this.index });
      w.clean = clean;
      w.skipped = skipped;
      w.typedFinal = this.typed;
      events.push({ type: "word", word: w, clean, ultimate: w.ultimate, skipped });
      this.advance();
      return events;
    }

    // A wrong key under the typo rule: the word is skipped right now. The wrong key counts as a mistake and the
    // word is reported as a miss, so the rules take half a combo level and the plate shows the skipped word.
    skip(ch) {
      const w = this.current();
      w.clean = false;
      w.skipped = true;
      w.typedFinal = this.typed + ch;
      const events = [
        { type: "wrong", skip: true, wi: this.index },
        { type: "word", word: w, clean: false, ultimate: w.ultimate, skipped: true },
      ];
      this.rest = { word: w.text, pos: this.typed.length };
      this.advance();
      return events;
    }

    // Fingers keep moving for a moment after a typo: you finish the word you were typing, or hit the right letter
    // again. Those keys belong to the word that was just skipped, so they are swallowed (no event, no wpm) instead of
    // skipping the next word too. Space always ends it, and a key that starts the next word wins.
    absorbs(ch) {
      const r = this.rest;
      if (!r) return false;
      if (ch === " ") return true;
      if (ch === this.current().text[0]) return false;
      return ch === r.word[r.pos] || ch === r.word[r.pos + 1];
    }

    press(ch) {
      const w = this.current();

      if (this.rest) {
        if (this.absorbs(ch)) {
          if (ch === " ") this.rest = null;
          else this.rest.pos += ch === this.rest.word[this.rest.pos] ? 1 : 2;
          return [];
        }
        this.rest = null;
      }

      if (ch === " ") return this.submit(true);

      const ok = ch === w.text[this.typed.length];
      if (!ok && this.skipsOnTypo()) return this.skip(ch);

      const events = [];
      if (this.typed.length >= w.text.length + 5) return events; // too many extra letters
      this.typed += ch;
      if (!ok) this.wordErrors++;
      events.push(ok ? { type: "correct" } : { type: "wrong", wi: this.index });
      return events;
    }

    // Under the typo rule there is nothing to fix (a wrong key already skipped the word), so Backspace does nothing.
    // That also closes a speed trick: deleting a right letter and typing it again would count the key twice.
    backspace() {
      if (this.skipsOnTypo()) return;
      if (this.typed.length) this.typed = this.typed.slice(0, -1);
    }

    // A computer typist moves on at once and never finishes the skipped word.
    forgetRest() {
      this.rest = null;
    }

    // "Space ends a word" off: a word ends by itself the moment it is typed exactly right (the caller then calls
    // submit(false), no key is counted for the missing Space). A word with a wrong letter in it is not exact, so it
    // still needs Space (or Backspace and a fix). The words per minute are the same either way: with Space off you
    // press one key less per word, and the credit for that missing Space is not given.
    autoEnds() {
      const w = this.current();
      return this.typed.length > 0 && this.typed === w.text;
    }
  }

  // HP per second that power `pa` deals to power `pb` (0 when pa is not higher). Speed basis: the gap RELATIVE to the
  // faster typist, so a 10% speed edge hurts the same at 20 wpm as at 100 (the old flat rule made slow fights endless).
  // Other bases: a flat damageScale per point of gap.
  function damageRate(pa, pb) {
    const D = CONFIG.duel,
      gap = Math.max(0, pa - pb);
    if (D.basis === "speed") return Math.min(D.maxDps, (D.relDamage * gap) / Math.max(pa, pb, D.relFloor));
    return duelTune("damageScale") * gap;
  }

  // A duel number that has an accuracy version: while CONFIG.duel.basis is "accuracy" the entry of the same name in
  // CONFIG.duel.accuracy replaces the one in CONFIG.duel (they live in different units: wpm gaps or percent gaps).
  // The "speed" and "wpm" bases use the plain numbers.
  function duelTune(name) {
    const D = CONFIG.duel;
    return D.basis === "accuracy" && D.accuracy && D.accuracy[name] !== undefined ? D.accuracy[name] : D[name];
  }

  // A weapon from CONFIG.weapons with every field filled in: anything it leaves out comes from the
  // globals in CONFIG.duel, so Medium is exactly the original game. Unknown ids give the default weapon.
  function weaponFor(id) {
    const W = CONFIG.weapons,
      D = CONFIG.duel;
    const w = W.list.find((x) => x.id === id) || W.list.find((x) => x.id === W.defaultWeapon);
    return Object.assign(
      {
        power: 1,
        comboBonus: D.comboBonus,
        wordsPerCombo: D.wordsPerCombo,
        comboRequired: D.ultimate.comboRequired,
        mistakeCharge: D.ultimate.mistakeCharge,
      },
      w,
    );
  }

  // Everything the fight needs to know about one typist.
  class Typist {
    constructor(name, weaponId) {
      this.name = name;
      this.weapon = weaponFor(weaponId);
      this.reset();
    }

    reset() {
      this.hp = CONFIG.duel.maxHp;
      this.stamps = []; // times of correct keystrokes
      this.keyLog = []; // the last CONFIG.duel.accuracy.keys keystrokes, true = right (accuracy based power)
      this.firstStamp = null;
      this.streak = 0; // clean words in a row
      this.comboLevel = 0;
      this.charge = 0; // ultimate charge, 0 to 100
      this.stunUntil = 0;
      this.counterUntil = 0; // duel time until which this typist's counter boost lasts (set by Duel.handleEvents)
      // Visual only (set by Duel.handleEvents, read by the word plates).
      this.lastCorrectAt = -1e9;
      this.lastCorrectIndex = -1;
      this.lastWrongAt = -1e9;
      this.lastWrongIndex = -1;
      this.lastWrongWord = -1;
      this.lastComboBreakAt = -1e9;
      this.lastSkipAt = -1e9;
      this.lastSkipText = "";
      this.lastMistakeWord = -1; // the stream index of the last word that cost combo (one cut per word)
      this.stats = {
        correct: 0,
        wrong: 0,
        words: 0,
        skipped: 0,
        ultimates: 0,
        bestCombo: 0,
        firstKeyAt: null,
        lastKeyAt: 0,
      };
    }

    logKey(ok) {
      this.keyLog.push(ok);
      if (this.keyLog.length > CONFIG.duel.accuracy.keys) this.keyLog.shift();
    }

    correct(t) {
      this.logKey(true);
      this.stamps.push(t);
      if (this.firstStamp === null) this.firstStamp = t;
      this.stats.correct++;
      if (this.stats.firstKeyAt === null) this.stats.firstKeyAt = t;
      this.stats.lastKeyAt = t;
    }

    // Returns true if the combo level went up (a mistake never raises it).
    // `skip` is true when the typo rule skipped the word (see TypingStream.skipsOnTypo): then the streak loses
    // `comboLoss` of a level; any other mistake resets it, like the old rule.
    wrong(t, skip, wi) {
      this.logKey(false);
      this.stats.wrong++;
      if (this.stats.firstKeyAt === null) this.stats.firstKeyAt = t;
      this.stats.lastKeyAt = t;
      // The typo rule: a mistake takes `comboLoss` of a combo level off the streak (half a level by default).
      // With skipWord off it is the old rule: any mistake resets the streak.
      const T = CONFIG.duel.typo,
        D = CONFIG.duel;
      if (D.basis !== "wpm") {
        // Combo count (speed and accuracy bases): a mistake cuts the combo by `mistakeFactor` (0.5 = halves it). Only
        // the first mistake in a word counts, so a fumbled word does not halve it again for every wrong key.
        if (wi === undefined || wi !== this.lastMistakeWord) {
          this.streak = Math.round(this.streak * D.mistakeFactor * 1000) / 1000;
        }
        this.lastMistakeWord = wi;
      } else if (!skip || (T && T.skipWord === false)) this.streak = 0;
      else {
        this.streak = Math.max(
          0,
          Math.round((this.streak - this.weapon.wordsPerCombo * (T ? T.comboLoss : 1)) * 1000) / 1000,
        );
      }
      this.charge = Math.max(0, this.charge - this.weapon.mistakeCharge);
      return this.updateCombo();
    }

    // Returns true if the combo level went up.
    wordDone(clean) {
      if (!clean) return false;
      const D = CONFIG.duel;
      this.streak = Math.min(
        this.streak + 1,
        D.basis !== "wpm" ? D.comboCap : this.weapon.wordsPerCombo * D.maxComboLevel,
      );
      this.stats.words++;
      return this.updateCombo();
    }

    updateCombo() {
      const D = CONFIG.duel;
      const level = Math.min(Math.floor(this.streak / this.weapon.wordsPerCombo), D.maxComboLevel);
      const up = level > this.comboLevel;
      this.comboLevel = level;
      // The best combo is a count of clean words in a row on the accuracy basis, a level on the old wpm one.
      this.stats.bestCombo = Math.max(this.stats.bestCombo, D.basis !== "wpm" ? Math.floor(this.streak) : level);
      return up;
    }

    // Words per minute over the last few seconds, counting only correct keystrokes.
    wpm(t) {
      const W = CONFIG.duel.rateWindow;
      while (this.stamps.length && this.stamps[0] < t - W) this.stamps.shift();
      if (!this.stamps.length) return 0;
      const span = Math.min(W, Math.max(t - this.firstStamp, 1.5));
      return this.stamps.length / 5 / (span / 60);
    }

    // Right keys over the last few keystrokes, 0 to 1 (a few virtual right keys soften the first seconds).
    accuracy() {
      const A = CONFIG.duel.accuracy,
        n = this.keyLog.length;
      let ok = 0;
      for (const k of this.keyLog) if (k) ok++;
      return (ok + A.prior) / (n + A.prior);
    }

    // The combo bonus on power: +comboStep per clean word in a row (accuracy basis), or the old level bonus.
    comboMultiplier() {
      const D = CONFIG.duel;
      return D.basis !== "wpm"
        ? 1 + D.comboStep * Math.floor(this.streak)
        : 1 + this.weapon.comboBonus * this.comboLevel;
    }

    // Attack and guard strength.
    power(t) {
      if (t < this.stunUntil) return 0; // a stun always wins, even over a counter
      const D = CONFIG.duel;
      if (D.basis === "accuracy") {
        // Accuracy in percent. Nothing typed for a few seconds means no power at all, so nobody can stall.
        if (this.stats.firstKeyAt === null || t - this.stats.lastKeyAt > D.accuracy.idleAfter) return 0;
        const counter = t < this.counterUntil ? 1 + D.accuracy.counterBonus : 1;
        return this.accuracy() * 100 * this.weapon.power * this.comboMultiplier() * counter;
      }
      const counter = t < this.counterUntil ? 1 + D.counter.powerBonus : 1; // speed basis and the oldest wpm rule
      return this.wpm(t) * this.weapon.power * this.comboMultiplier() * counter;
    }

    countering(t) {
      return t < this.counterUntil;
    }

    ultReady() {
      return this.charge >= 100 && this.comboLevel >= this.weapon.comboRequired;
    }
  }

  // A computer opponent. It types its own stream, one key at a time, with human like
  // speed drift, mistakes and corrections, and feeds the same Typist the player uses.
  class Bot {
    constructor(cfg, stream, onEvents) {
      this.cfg = cfg;
      this.stream = stream;
      this.onEvents = onEvents;
      this.nextKeyAt = 0;
      this.phase = Math.random() * 6;
    }

    // The per-letter accuracy (cfg.accuracy) that gives a measured keystroke accuracy of `target` (0 to 1), counted
    // the way the result screen counts yours: right keys over all keys, spaces included (a space never misses).
    static letterAccFor(target, cfg) {
      const pool = WORD_POOLS[weaponFor(cfg.weapon || CONFIG.weapons.botWeapon).pool];
      const len = pool.reduce((n, w) => n + w.length, 0) / pool.length;
      return Math.min(0.999, Math.max(0.5, 1 - (1 - target) * ((len + 1) / len)));
    }

    // The raw key rate (cfg.wpm) that gives a measured average of `target` wpm, counted the way the result
    // screen counts yours (correct keystrokes only). From the key timing below: a typo is a wasted key plus a
    // recovery pause, typos only happen on letters (never on space), and drift averages out.
    //   e = typos per correct key = letter share x (1 - accuracy) / accuracy
    //   seconds per correct key = (1 + e) x 12 / raw + e x mean recovery = 12 / target
    static rawWpmFor(target, cfg) {
      const pool = WORD_POOLS[weaponFor(cfg.weapon || CONFIG.weapons.botWeapon).pool];
      const len = pool.reduce((n, w) => n + w.length, 0) / pool.length;
      const rec = cfg.recovery || [0.18, 0.15];
      const e = ((len / (len + 1)) * (1 - cfg.accuracy)) / cfg.accuracy;
      return (12 * (1 + e)) / (12 / target - e * (rec[0] + rec[1] / 2));
    }

    // The bot settings the game and the tests use: a card's `wpm` is the measured average the bot should type, so the
    // key rate it is given is the raw rate that lands on it.
    static cfgFor(card) {
      return Object.assign({}, card, { wpm: Bot.rawWpmFor(card.wpm, card) });
    }

    update(t) {
      // Never let a lag spike produce a burst of keystrokes.
      if (t - this.nextKeyAt > 0.5) this.nextKeyAt = t;
      while (t >= this.nextKeyAt) {
        const delay = this.keystroke(t);
        this.nextKeyAt += delay;
      }
    }

    // Types one key. Returns the time until the next key.
    keystroke(t) {
      const s = this.stream;
      const w = s.current();
      const drift = 1 + (this.cfg.drift !== undefined ? this.cfg.drift : 0.15) * Math.sin(t * 0.7 + this.phase);
      const cps = (this.cfg.wpm * drift) / 12;
      let delay = (1 / cps) * (0.6 + Math.random() * 0.8);
      if (w.ultimate) delay *= 1.35; // hard word, slower

      if (s.typed.length >= w.text.length) {
        this.onEvents(s.press(" "), t);
        return delay;
      }
      if (Math.random() > this.cfg.accuracy) {
        // Hits a wrong key, notices, backspaces.
        const wrong = String.fromCharCode(97 + Math.floor(Math.random() * 26));
        const expected = w.text[s.typed.length];
        this.onEvents(s.press(wrong === expected ? (expected === "z" ? "y" : "z") : wrong), t);
        // Fixes a wrong letter when the typo rule is off; under the typo rule the word is already skipped.
        s.backspace();
        s.forgetRest(); // the bot never carries on with the skipped word
        const rec = this.cfg.recovery || [0.18, 0.15]; // pause after a typo: [base, random extra] seconds
        return delay + rec[0] + Math.random() * rec[1];
      }
      this.onEvents(s.press(w.text[s.typed.length]), t);
      return delay;
    }
  }

  return Object.freeze({ TypingStream, Typist, Bot, damageRate, duelTune, weaponFor });
});
