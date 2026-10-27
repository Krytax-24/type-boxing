/**
 * Race rules: 2 to 6 racers type the same passage. No DOM, no canvas, no clock, no Math.random: the screen
 * (race-mode.js) feeds keys in and steps the race on a fixed timestep, so the same keys always give the same race.
 *
 * Typing works like Monkeytype: you type a word letter by letter (wrong letters show red, extra letters dark red,
 * Backspace and Ctrl+Backspace fix them). Space on a right word moves on. Space on a wrong word SKIPS it (CONFIG.race
 * .skip): you move on, the word stays underlined, and your official time gets a penalty (base + perError seconds per
 * wrong, missing or extra letter), so fixing a typo is usually faster than skipping and mashing never pays. With
 * skip off, a Space on a wrong word is refused instead. The last word ends the race the moment it is right, or with
 * a Space (a skip). Track position = the passage up to the current word (skipped words included) + the right start
 * of the current word. Places go by official time: the moment you cross the line plus your penalty.
 */
CounterType.define("race-rules", ["race-config", "race-passages", "random"], (CONFIG, PASSAGES, random) => {
  "use strict";

  const { mulberry32 } = random;

  const C = () => CONFIG.race;

  // A passage of the given length picked by seed (passages.js).
  function pickPassage(seed, length) {
    const list = PASSAGES[length] || PASSAGES[C().defaultLength];
    return list[Math.floor(mulberry32(seed >>> 0)() * list.length)];
  }

  function racer(i, r) {
    return {
      id: i,
      name: r.name || "RACER " + (i + 1),
      human: !!r.human,
      vehicle: r.vehicle || "lime",
      color: r.color || "#7ce3ff",
      rating: r.rating || null,
      tag: r.tag || "",
      wi: 0, // current word
      typed: "", // what is typed in the current word (wrong and extra letters included)
      base: 0, // characters of the passage before the current word (finished and skipped words, their spaces)
      pos: 0, // track position: base + the right start of the current word
      good: 0, // characters of words typed right, with their spaces (Monkeytype's net wpm counts these)
      skips: 0,
      penalty: 0,
      missed: 0,
      skipped: {}, // skipped words: count, seconds added, letters left out, what was typed (by word)
      right: 0,
      wrong: 0,
      extra: 0,
      backs: 0, // keystrokes: right, wrong (extra letters and refused spaces too), extra, backspaces
      stamps: [], // race time of every key that moved progress, in the live window (speed readout)
      net: [],
      raw: [],
      err: [], // per second of race time: progress keys, all typed keys, wrong keys (result chart)
      firstKeyAt: null,
      wordClean: true,
      streak: 0,
      bestStreak: 0,
      words: 0,
      lastWrongAt: -1e9,
      lastWordAt: -1e9,
      lastBoostAt: -1e9,
      lastBlockAt: -1e9,
      lastSkipAt: -1e9,
      lastPenalty: 0,
      finishT: null,
      place: null,
    };
  }

  // racers: [{ name, human, vehicle, color, rating, tag }]. opts: { length, text }.
  function create(seed, racers, opts = {}) {
    const length = opts.length || C().defaultLength;
    const text = opts.text || pickPassage(seed, length);
    return {
      seed: seed >>> 0,
      length,
      text,
      words: text.split(" "),
      t: 0,
      phase: "countdown",
      countdown: C().countdown,
      racers: racers.map((r, i) => racer(i, r)),
      finishers: [],
      firstFinishT: null,
      endReason: null,
      timeLimit: C().timeLimit[length] || C().timeLimit.medium,
    };
  }

  // Length of the right start of the current word.
  function prefix(word, typed) {
    let k = 0;
    while (k < typed.length && k < word.length && typed[k] === word[k]) k++;
    return k;
  }
  const bucket = (arr, t) => {
    const b = Math.floor(t);
    arr[b] = (arr[b] || 0) + 1;
  };
  // Progress moved: stamp the keys for the speed readout and the chart.
  function gained(s, r, n) {
    for (let k = 0; k < n; k++) {
      r.stamps.push(s.t);
      bucket(r.net, s.t);
    }
  }
  function setPos(s, r) {
    const before = r.pos;
    r.pos = r.base + prefix(s.words[r.wi], r.typed);
    if (r.pos > before) gained(s, r, r.pos - before);
  }

  const official = (r) => r.finishT + r.penalty;
  // Finishers are ranked by official time (crossing + penalty), so a later crosser with a clean run can move ahead.
  function rankFinishers(s) {
    const list = s.finishers
      .map((k) => s.racers[k])
      .sort((a, b) => official(a) - official(b) || a.finishT - b.finishT || a.id - b.id);
    list.forEach((r, n) => {
      r.place = n + 1;
    });
  }
  function finishRacer(s, i, ev) {
    const r = s.racers[i];
    r.finishT = s.t;
    s.finishers.push(i);
    if (s.firstFinishT === null) s.firstFinishT = s.t;
    rankFinishers(s);
    ev.push({ type: "finish", place: r.place });
  }
  // Wrong, missing or extra letters of a typed word against its target.
  function errorsIn(word, typed) {
    let e = Math.abs(word.length - typed.length);
    for (let k = 0; k < Math.min(word.length, typed.length); k++) if (typed[k] !== word[k]) e++;
    return e;
  }
  function wordDone(s, r) {
    r.words++;
    if (r.wordClean) {
      r.streak++;
      r.bestStreak = Math.max(r.bestStreak, r.streak);
      if (r.streak % C().streakForBoost === 0) r.lastBoostAt = s.t;
    }
    r.wordClean = true;
    r.lastWordAt = s.t;
  }
  function mistake(s, r) {
    r.wrong++;
    r.wordClean = false;
    r.streak = 0;
    r.lastWrongAt = s.t;
    bucket(r.err, s.t);
  }

  // One key from racer i. Returns events: { type: "correct" | "wrong" | "blocked" | "word" | "finish" }.
  // "blocked" is a Space on a word that is not right yet (refused, counted as a mistake).
  function press(s, i, ch) {
    const r = s.racers[i];
    if (s.phase !== "race" || !r || r.finishT !== null || typeof ch !== "string" || ch.length !== 1) return [];
    if (r.firstKeyAt === null) r.firstKeyAt = s.t;
    const word = s.words[r.wi],
      ev = [];
    if (ch === " ") {
      if (!r.typed.length) return []; // Space before the word starts does nothing (like Monkeytype)
      bucket(r.raw, s.t);
      const last = r.wi === s.words.length - 1;
      if (r.typed !== word) {
        const K = C().skip;
        if (!K || !K.on) {
          mistake(s, r);
          r.lastBlockAt = s.t;
          return [{ type: "blocked" }];
        }
        // Skip: move on with a time penalty. The word stays underlined; its letters never count as right text.
        mistake(s, r);
        const pen = K.base + K.perError * errorsIn(word, r.typed);
        r.skips++;
        r.penalty += pen;
        r.lastSkipAt = s.t;
        r.lastPenalty = pen;
        r.missed += Math.max(0, word.length - r.typed.length);
        r.skipped[r.wi] = r.typed;
        r.words++;
        r.wordClean = true;
        r.lastWordAt = s.t;
        const skipEvents = [{ type: "skip", penalty: pen }];
        r.base += word.length + (last ? 0 : 1);
        r.wi++;
        r.typed = "";
        r.pos = r.base;
        if (last) finishRacer(s, i, skipEvents);
        return skipEvents;
      }
      r.right++;
      wordDone(s, r);
      r.good += word.length + 1;
      r.base += word.length + 1;
      r.wi++;
      r.typed = "";
      r.pos = r.base;
      gained(s, r, 1);
      return [{ type: "correct" }, { type: "word" }];
    }
    if (r.typed.length >= word.length + C().maxExtra) return []; // too many extra letters: the key is ignored
    bucket(r.raw, s.t);
    const at = r.typed.length;
    r.typed += ch;
    if (at < word.length && ch === word[at]) {
      r.right++;
      ev.push({ type: "correct" });
    } else {
      if (at >= word.length) r.extra++;
      mistake(s, r);
      ev.push({ type: "wrong", extra: at >= word.length });
    }
    setPos(s, r);
    if (r.wi === s.words.length - 1 && r.typed === word) {
      r.good += word.length;
      wordDone(s, r);
      ev.push({ type: "word" });
      finishRacer(s, i, ev);
    }
    return ev;
  }

  // Backspace removes the last letter of the current word; `word` (Ctrl+Backspace) clears the whole word. Finished
  // words are always right under this rule, so there is nothing to go back to.
  function backspace(s, i, word = false) {
    const r = s.racers[i];
    if (s.phase !== "race" || !r || r.finishT !== null || !r.typed.length) return false;
    r.typed = word ? "" : r.typed.slice(0, -1);
    r.backs++;
    r.pos = r.base + prefix(s.words[r.wi], r.typed);
    return true;
  }

  // Fixed timestep. Ends when everyone finished, lateSec after the first finisher, or at the time limit.
  function step(s, dt) {
    if (s.phase === "countdown") {
      s.countdown -= dt;
      if (s.countdown <= 0) {
        s.countdown = 0;
        s.phase = "race";
      }
      return;
    }
    if (s.phase !== "race") return;
    s.t += dt;
    const all = s.racers.every((r) => r.finishT !== null);
    const late = s.firstFinishT !== null && s.t - s.firstFinishT >= C().lateSec;
    const timeUp = s.t >= s.timeLimit;
    if (all || late || timeUp) finish(s, all ? "all" : late ? "late" : "time");
  }

  // Everyone still on the track is placed by progress (then by fewer errors, then by seat).
  function finish(s, reason) {
    s.phase = "over";
    s.endReason = reason;
    rankFinishers(s);
    const rest = s.racers
      .filter((r) => r.finishT === null)
      .sort((a, b) => b.pos - a.pos || a.wrong - b.wrong || a.id - b.id);
    let place = s.finishers.length;
    for (const r of rest) r.place = ++place;
  }

  const progress = (s, r) => r.pos / s.text.length;
  const endT = (s, r) => (r.finishT !== null ? r.finishT : s.t);

  // Live speed: progress keys over the last few seconds (5 characters = 1 word), softened at the start.
  function wpm(s, r) {
    const W = C().rateWindow,
      t = endT(s, r);
    while (r.stamps.length && r.stamps[0] < t - W) r.stamps.shift();
    if (!r.stamps.length || r.firstKeyAt === null) return 0;
    const span = Math.min(W, Math.max(t - r.firstKeyAt, 1.5));
    return r.stamps.length / 5 / (span / 60);
  }

  // Text typed right: right words with their spaces, plus the right start of the current word.
  const goodChars = (s, r) =>
    r.good + (r.finishT === null && r.wi < s.words.length ? prefix(s.words[r.wi], r.typed) : 0);
  // Whole race speed, Monkeytype's "wpm": text typed right, from the green light to the finish (or now).
  function avgWpm(s, r) {
    const t = endT(s, r);
    return t > 0 ? goodChars(s, r) / 5 / (t / 60) : 0;
  }
  // Monkeytype's "raw": every typed key (spaces included), right or wrong.
  function rawWpm(s, r) {
    const t = endT(s, r);
    return t > 0 ? (r.right + r.wrong) / 5 / (t / 60) : 0;
  }
  const accuracy = (r) => (r.right + r.wrong ? r.right / (r.right + r.wrong) : 0);
  // Monkeytype's character counts: correct / incorrect / extra / missed (letters of the passage left untyped).
  function chars(s, r) {
    return {
      correct: r.right,
      incorrect: r.wrong - r.extra,
      extra: r.extra,
      missed: r.missed + Math.max(0, s.text.length - r.pos),
    };
  }

  function results(s) {
    return s.racers
      .slice()
      .sort((a, b) => a.place - b.place)
      .map((r) => ({
        id: r.id,
        name: r.name,
        tag: r.tag,
        human: r.human,
        place: r.place,
        finished: r.finishT !== null,
        time: r.finishT === null ? null : official(r),
        crossed: r.finishT,
        penalty: r.penalty,
        skips: r.skips,
        wpm: Math.round(avgWpm(s, r)),
        raw: Math.round(rawWpm(s, r)),
        acc: Math.round(accuracy(r) * 100),
        progress: progress(s, r),
        bestStreak: r.bestStreak,
        vehicle: r.vehicle,
        color: r.color,
        rating: r.rating,
      }));
  }

  // A computer racer. Seeded, so a practice race with the same seed plays the same way. It types like a person:
  // a typo is noticed after 0 to 2 more letters, then it pauses, backspaces to the mistake and carries on.
  //   cfg: { wpm (raw key rate), accuracy (per letter), recovery: [base, extra] seconds, drift }
  class Bot {
    constructor(cfg, seed) {
      this.cfg = cfg;
      this.rand = mulberry32(seed >>> 0);
      this.nextKeyAt = 0.35 + this.rand() * 0.5; // a human-like reaction to the green light
      this.phase = this.rand() * 6;
      this.blind = 0; // letters still typed before the typo is noticed
      this.fixing = false;
    }
    update(s, i, t) {
      const r = s.racers[i];
      if (s.phase !== "race" || r.finishT !== null) return;
      if (t - this.nextKeyAt > 0.5) this.nextKeyAt = t;
      while (t >= this.nextKeyAt && r.finishT === null) this.nextKeyAt += this.key(s, i, t);
    }
    key(s, i, t) {
      const r = s.racers[i],
        c = this.cfg,
        word = s.words[r.wi];
      const drift = 1 + (c.drift !== undefined ? c.drift : 0.12) * Math.sin(t * 0.6 + this.phase);
      const delay = (12 / (c.wpm * drift)) * (0.6 + this.rand() * 0.8);
      const ok = prefix(word, r.typed);
      if (this.fixing) {
        // delete back to the last right letter
        if (r.typed.length > ok) {
          backspace(s, i);
          return delay * 0.6;
        }
        this.fixing = false;
      }
      if (r.typed.length > ok) {
        // a typo is in: keep going blind a little, then notice it
        if (this.blind > 0 && r.typed.length < word.length) {
          this.blind--;
          press(s, i, word[r.typed.length]);
          return delay;
        }
        this.fixing = true;
        const rec = c.recovery || [0.18, 0.12];
        return rec[0] + this.rand() * rec[1];
      }
      if (ok === word.length) {
        press(s, i, " ");
        return delay;
      }
      const want = word[ok];
      if (this.rand() > c.accuracy) {
        const code = 97 + Math.floor(this.rand() * 26),
          ch = String.fromCharCode(code);
        press(s, i, ch === want ? (want === "z" ? "y" : "z") : ch);
        this.blind = Math.floor(this.rand() * 3); // 0, 1 or 2 more letters before noticing
        return delay;
      }
      press(s, i, want);
      return delay;
    }
    // The raw key rate that lands on a measured average of `target` wpm. Per typo: the wrong key, about one blind
    // letter, the same number of backspaces (at 0.6 of a key) and the recovery pause.
    static rawFor(target, letterAccuracy, recovery = [0.18, 0.12]) {
      const e = ((1 - letterAccuracy) / letterAccuracy) * (5 / 6); // typos per progress key (spaces never get a typo)
      const keys = 2 * 0.85; // wrong letter + blind letters typed, each needs a backspace
      const pause = e * (recovery[0] + recovery[1] / 2);
      // seconds per progress key = d * (1 + e * keys * 1.6) + pause = 12 / target, with d = 12 / raw
      const d = Math.max(0.005, (12 / target - pause) / (1 + e * keys * 1.6));
      return 12 / d;
    }
  }

  return {
    create,
    press,
    backspace,
    step,
    finish,
    progress,
    wpm,
    avgWpm,
    rawWpm,
    accuracy,
    chars,
    results,
    pickPassage,
    prefix,
    errorsIn,
    Bot,
  };
});
