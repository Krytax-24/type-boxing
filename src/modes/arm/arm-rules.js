/**
 * Arm Wrestling rules (1v1). No DOM, no canvas, no clock: arm-mode.js feeds typing events in and steps it on a
 * fixed timestep. Both typists type their own endless word stream (TypingStream from duel-typing.js, seeded).
 *
 * Power = accWeight x A x g + speedWeight x S
 *   A: keystroke accuracy over the last accKeys keys, mapped steeply: ((acc - accFloor) / (1 - accFloor)) ^ accCurve
 *   g: activity gate = min(1, wpm / (gate x foe wpm), wpm / minWpm), so typing slowly and perfectly cannot win
 *   S: your share of the combined speed, wpm / (wpm + foe wpm)
 * The locked hands sit at x = 0; x = +1 pins the foe (side 1), x = -1 pins you (side 0). Each step x moves by
 * pull x (P0 - P1) x dt. At time up the side past the middle wins; dead even plays sudden death with the pull doubled.
 */
CounterType.define("arm-rules", ["arm-config", "words", "typing"], (CONFIG, words, typing) => {
  "use strict";

  const { WORD_POOLS, ULT_POOLS, WordSource } = words;
  const { TypingStream } = typing;

  const A = () => CONFIG.arm;

  function typist() {
    return {
      log: [], // last accKeys keys, true = right
      stamps: [], // race time of correct keys in the live window (speed term)
      firstKeyAt: null,
      lastKeyAt: null,
      right: 0,
      wrong: 0,
      extra: 0,
      words: 0,
      streak: 0,
      bestStreak: 0,
      net: [],
      raw: [],
      err: [], // per second of match time: right keys, all keys, wrong keys (the result chart)
      lastWrongAt: -1e9,
      lastWordAt: -1e9,
      powerSum: 0,
      powerN: 0, // for the result screen: average power
    };
  }

  // opts: { seeds: [a, b] } so each side has its own word stream (both peers can rebuild them from the match seed).
  function create(seed, opts = {}) {
    const seeds = opts.seeds || [seed >>> 0, (seed + 7919) >>> 0];
    const pool = WORD_POOLS.common,
      hard = ULT_POOLS.hard;
    return {
      seed: seed >>> 0,
      t: 0,
      phase: "countdown",
      countdown: A().countdown,
      streams: seeds.map((sd) => new TypingStream(new WordSource(sd, pool, hard))),
      typists: [typist(), typist()],
      x: 0,
      power: [0, 0],
      wpm: [0, 0],
      acc: [0, 0],
      sudden: false,
      suddenT: 0,
      result: null,
    };
  }

  // The same events a TypingStream returns ({ type: "correct" | "wrong" | "word", clean }). `auto` is true when the
  // word ended by itself (word submit off): the missing Space is credited as a right key, so mixed settings are fair.
  function handleEvents(s, i, events, auto = false) {
    if (s.phase !== "fight") return;
    const tp = s.typists[i],
      N = A().accKeys,
      b = Math.floor(s.t);
    const add = (arr) => {
      arr[b] = (arr[b] || 0) + 1;
    };
    for (const ev of events) {
      if (ev.type === "correct") {
        tp.right++;
        tp.log.push(true);
        tp.stamps.push(s.t);
        add(tp.net);
        add(tp.raw);
      } else if (ev.type === "wrong") {
        tp.wrong++;
        tp.log.push(false);
        tp.lastWrongAt = s.t;
        tp.streak = 0;
        add(tp.raw);
        add(tp.err);
        if (ev.extra) tp.extra++;
      } else if (ev.type === "word") {
        tp.words++;
        tp.lastWordAt = s.t;
        if (ev.clean) {
          tp.streak++;
          tp.bestStreak = Math.max(tp.bestStreak, tp.streak);
        }
        if (auto) {
          tp.right++;
          tp.log.push(true);
          tp.stamps.push(s.t);
          add(tp.net);
        }
        continue;
      } else continue;
      if (tp.firstKeyAt === null) tp.firstKeyAt = s.t;
      tp.lastKeyAt = s.t;
      while (tp.log.length > N) tp.log.shift();
    }
  }

  function wpmOf(s, tp) {
    const W = A().rateWindow;
    while (tp.stamps.length && tp.stamps[0] < s.t - W) tp.stamps.shift();
    if (!tp.stamps.length || tp.firstKeyAt === null) return 0;
    const span = Math.min(W, Math.max(s.t - tp.firstKeyAt, 1.5));
    return tp.stamps.length / 5 / (span / 60);
  }
  function accOf(tp) {
    const P = A().accPrior;
    let ok = 0;
    for (const k of tp.log) if (k) ok++;
    return (ok + P) / (tp.log.length + P);
  }
  // The accuracy term A, 0 to 1.
  function accTerm(acc) {
    const c = A();
    const v = Math.max(0, Math.min(1, (acc - c.accFloor) / (1 - c.accFloor)));
    return Math.pow(v, c.accCurve);
  }
  // Power of side i from its numbers and the foe's speed. Exposed for the tests and the How to play numbers.
  function powerFrom(acc, wpm, foeWpm) {
    const c = A();
    const g = Math.min(1, foeWpm > 0 ? wpm / (c.gate * foeWpm) : 1, wpm / c.minWpm);
    const S = wpm + foeWpm > 0 ? wpm / (wpm + foeWpm) : 0;
    return c.accWeight * accTerm(acc) * Math.max(0, g) + c.speedWeight * S;
  }

  function measure(s) {
    const c = A();
    for (let i = 0; i < 2; i++) {
      s.wpm[i] = wpmOf(s, s.typists[i]);
      s.acc[i] = accOf(s.typists[i]);
    }
    for (let i = 0; i < 2; i++) {
      const tp = s.typists[i];
      const idle = tp.lastKeyAt === null || s.t - tp.lastKeyAt > c.idleAfter;
      s.power[i] = idle ? 0 : powerFrom(s.acc[i], s.wpm[i], s.wpm[1 - i]);
      tp.powerSum += s.power[i];
      tp.powerN++;
    }
  }

  function end(s, winner, how) {
    s.phase = "over";
    s.result = { winner, how, t: s.t };
  }

  function step(s, dt) {
    const c = A();
    if (s.phase === "countdown") {
      s.countdown -= dt;
      if (s.countdown <= 0) {
        s.countdown = 0;
        s.phase = "fight";
      }
      return;
    }
    if (s.phase !== "fight") return;
    s.t += dt;
    measure(s);
    s.x += c.pull * (s.sudden ? 2 : 1) * (s.power[0] - s.power[1]) * dt;
    if (s.x >= 1) {
      s.x = 1;
      end(s, 0, "pin");
      return;
    }
    if (s.x <= -1) {
      s.x = -1;
      end(s, 1, "pin");
      return;
    }
    if (!s.sudden && s.t >= c.timer) {
      if (Math.abs(s.x) >= c.tieBand) end(s, s.x > 0 ? 0 : 1, "time");
      else {
        s.sudden = true;
        s.suddenT = 0;
      }
      return;
    }
    if (s.sudden) {
      s.suddenT += dt;
      if (s.suddenT >= c.suddenDeath) {
        if (Math.abs(s.x) >= 1e-6) end(s, s.x > 0 ? 0 : 1, "sudden");
        else end(s, s.typists[0].right >= s.typists[1].right ? 0 : 1, "keys");
      }
    }
  }

  const timeLeft = (s) => (s.sudden ? Math.max(0, A().suddenDeath - s.suddenT) : Math.max(0, A().timer - s.t));

  // Whole match numbers, Monkeytype style: wpm from right keys and raw from every key, over the match time.
  function summary(s, i) {
    const tp = s.typists[i],
      n = tp.right + tp.wrong,
      secs = Math.max(1, s.t);
    return {
      wpm: tp.right ? Math.round(tp.right / 5 / (secs / 60)) : 0,
      raw: n ? Math.round(n / 5 / (secs / 60)) : 0,
      acc: n ? Math.round((100 * tp.right) / n) : 0,
      chars: { correct: tp.right, incorrect: tp.wrong - tp.extra, extra: tp.extra, missed: 0 },
      power: tp.powerN ? Math.round((100 * tp.powerSum) / tp.powerN) : 0,
      bestStreak: tp.bestStreak,
      words: tp.words,
    };
  }

  return { create, handleEvents, step, measure, powerFrom, accTerm, timeLeft, summary };
});
