// Typing engine for the duel. No DOM, no canvas, no combat rules.
// TypingStream behaves like Monkeytype: an endless line of words, space ends a word,
// a wrong letter still moves the caret, backspace fixes letters inside the current word.

class TypingStream {
  constructor(source) {
    this.source = source;
    this.words = [];       // { text, ultimate, clean }
    this.index = 0;        // current word
    this.typed = "";       // what has been typed in the current word
    this.wordErrors = 0;   // wrong keystrokes in the current word, even if fixed later
    this.extend();
  }

  extend(n = 40) {
    for (let i = 0; i < n; i++) this.words.push({ text: this.source.next(), ultimate: false, clean: null });
  }

  current() { return this.words[this.index]; }

  // Put a hard ultimate word right after the current word.
  insertNext(text) {
    this.words.splice(this.index + 1, 0, { text, ultimate: true, clean: null });
  }

  ultimateAhead() {
    return this.words.some((w, i) => w.ultimate && i >= this.index);
  }

  // One keystroke. Returns a list of events:
  //   { type: "correct" } | { type: "wrong" } | { type: "word", word, clean, ultimate }
  submit(countKey = true) {
    const w = this.current();
    const events = [];
    if (this.typed.length === 0) return events; // submit on an empty word does nothing
    const exact = this.typed === w.text;
    const clean = exact && this.wordErrors === 0;
    if (countKey) events.push({ type: exact ? "correct" : "wrong" });
    w.clean = clean;
    w.typedFinal = this.typed;
    events.push({ type: "word", word: w, clean, ultimate: w.ultimate });
    this.index++;
    this.typed = "";
    this.wordErrors = 0;
    if (this.words.length - this.index < 40) this.extend();
    return events;
  }

  press(ch) {
    const w = this.current();
    const events = [];

    if (ch === " ") return this.submit(true);

    if (this.typed.length >= w.text.length + 5) return events; // too many extra letters
    const ok = ch === w.text[this.typed.length];
    this.typed += ch;
    if (!ok) this.wordErrors++;
    events.push({ type: ok ? "correct" : "wrong" });
    return events;
  }

  backspace() {
    if (this.typed.length) this.typed = this.typed.slice(0, -1);
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

// A weapon from CONFIG.weapons with every field filled in: anything it leaves out comes from the
// globals in CONFIG.duel, so Medium is exactly the original game. Unknown ids give the default weapon.
function weaponFor(id) {
  const W = CONFIG.weapons, D = CONFIG.duel;
  const w = W.list.find((x) => x.id === id) || W.list.find((x) => x.id === W.defaultWeapon);
  return Object.assign({ power: 1, comboBonus: D.comboBonus, wordsPerCombo: D.wordsPerCombo, comboRequired: D.ultimate.comboRequired,
    mistakeCharge: D.ultimate.mistakeCharge }, w);
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
    this.stamps = [];          // times of correct keystrokes
    this.firstStamp = null;
    this.streak = 0;           // clean words in a row
    this.comboLevel = 0;
    this.charge = 0;           // ultimate charge, 0 to 100
    this.stunUntil = 0;
    this.counterUntil = 0;     // duel time until which this typist's counter boost lasts (set by Duel.handleEvents)
    // Visual only (set by Duel.handleEvents, read by the word plates).
    this.lastCorrectAt = -1e9; this.lastCorrectIndex = -1;
    this.lastWrongAt = -1e9; this.lastWrongIndex = -1; this.lastWrongWord = -1;
    this.lastComboBreakAt = -1e9;
    this.stats = { correct: 0, wrong: 0, words: 0, ultimates: 0, bestCombo: 0, firstKeyAt: null, lastKeyAt: 0 };
  }

  correct(t) {
    this.stamps.push(t);
    if (this.firstStamp === null) this.firstStamp = t;
    this.stats.correct++;
    if (this.stats.firstKeyAt === null) this.stats.firstKeyAt = t;
    this.stats.lastKeyAt = t;
  }

  // Returns true if the combo level changed.
  wrong(t) {
    this.stats.wrong++;
    if (this.stats.firstKeyAt === null) this.stats.firstKeyAt = t;
    this.stats.lastKeyAt = t;
    this.streak = 0;
    this.charge = Math.max(0, this.charge - this.weapon.mistakeCharge);
    return this.updateCombo();
  }

  // Returns true if the combo level went up.
  wordDone(clean) {
    if (!clean) return false;
    this.streak++;
    this.stats.words++;
    return this.updateCombo();
  }

  updateCombo() {
    const D = CONFIG.duel;
    const level = Math.min(Math.floor(this.streak / this.weapon.wordsPerCombo), D.maxComboLevel);
    const up = level > this.comboLevel;
    this.comboLevel = level;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, level);
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

  // Attack and guard strength.
  power(t) {
    if (t < this.stunUntil) return 0; // a stun always wins, even over a counter
    const D = CONFIG.duel;
    const counter = t < this.counterUntil ? 1 + D.counter.powerBonus : 1;
    return this.wpm(t) * this.weapon.power * (1 + this.weapon.comboBonus * this.comboLevel) * counter;
  }

  countering(t) { return t < this.counterUntil; }

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

  // The raw key rate (cfg.wpm) that gives a measured average of `target` wpm, counted the way the result
  // screen counts yours (correct keystrokes only). From the key timing below: a typo is a wasted key plus a
  // recovery pause, typos only happen on letters (never on space), and drift averages out.
  //   e = typos per correct key = letter share x (1 - accuracy) / accuracy
  //   seconds per correct key = (1 + e) x 12 / raw + e x mean recovery = 12 / target
  static rawWpmFor(target, cfg) {
    const pool = WORD_POOLS[weaponFor(cfg.weapon || CONFIG.weapons.botWeapon).pool];
    const len = pool.reduce((n, w) => n + w.length, 0) / pool.length;
    const rec = cfg.recovery || [0.18, 0.15];
    const e = (len / (len + 1)) * (1 - cfg.accuracy) / cfg.accuracy;
    return (12 * (1 + e)) / (12 / target - e * (rec[0] + rec[1] / 2));
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
      s.backspace();
      const rec = this.cfg.recovery || [0.18, 0.15]; // pause after a typo: [base, random extra] seconds
      return delay + rec[0] + Math.random() * rec[1];
    }
    this.onEvents(s.press(w.text[s.typed.length]), t);
    return delay;
  }
}
