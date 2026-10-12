// Game modes: the pure rules around a match (rounds, endless, practice dummy). No DOM, no clock, no random.
// main.js owns the screens and the timers; this file only answers questions, so tests/duel-sim.js can check it.
(function (global) {
  const M = CONFIG.modes;
  const inList = (v, list) => list.indexOf(v) >= 0;

  // Match rules from settings or from the network: anything unusual falls back to the defaults.
  function cleanRules(r) {
    r = r || {};
    return {
      rounds: inList(r.rounds, M.roundSteps) ? r.rounds : 1,
      timer: inList(r.timer, M.timerSteps) ? r.timer : 0,
      endless: r.endless === true,
      words: inList(r.words, M.wordModes) ? r.words : "mix",
    };
  }

  // Who has won the match so far. wins = [mine, theirs]. The match ends when someone has more than half the rounds,
  // or after the last round when the wins differ. A tie after the last round plays one more round.
  function status(rules, wins) {
    const played = wins[0] + wins[1] + (wins.draws || 0);
    if (rules.endless) return { over: false, winner: null, played };
    if (wins[0] * 2 > rules.rounds) return { over: true, winner: 0, played };
    if (wins[1] * 2 > rules.rounds) return { over: true, winner: 1, played };
    if (played >= rules.rounds && wins[0] !== wins[1]) return { over: true, winner: wins[0] > wins[1] ? 0 : 1, played };
    return { over: false, winner: null, played };
  }

  // Does this typist end a word by itself (no Space) under the room's word mode and their own preference?
  function autoEnds(words, ownSpaceSetting) {
    if (words === "on") return false;
    if (words === "off") return true;
    return !ownSpaceSetting;
  }

  // Practice: settings from storage or a message, cleaned.
  function cleanPractice(p) {
    const D = M.practice.defaults;
    p = p || {};
    return {
      wpm: inList(p.wpm, M.practice.wpmSteps) ? p.wpm : D.wpm,
      accuracy: inList(p.accuracy, M.practice.accuracySteps) ? p.accuracy : D.accuracy,
      dummyHurt: typeof p.dummyHurt === "boolean" ? p.dummyHurt : D.dummyHurt,
      youHurt: typeof p.youHurt === "boolean" ? p.youHurt : D.youHurt,
    };
  }

  // The bot settings for a practice dummy (wpm 0 means no bot at all).
  function dummyCard(p) {
    return { name: "DUMMY", style: p.wpm ? p.wpm + " wpm" : "stands still", wpm: p.wpm, accuracy: p.accuracy / 100 > 0.999 ? 0.999 : p.accuracy / 100,
      recovery: [0.18, 0.15], drift: 0.1 };
  }

  // The duel options for each kind of fight. `hurt` is the Endless setting "HP loss".
  // Only online matches use the rules' own endless switch (nobody loses HP); offline, Endless is a mode of its own.
  function duelOpts(kind, rules, practice, hurt) {
    if (kind === "practice") return { timer: 0, noDamage: [!practice.youHurt, !practice.dummyHurt] };
    if (kind === "endless") return { timer: 0, noDamage: [hurt === false, hurt === false] };
    if (kind === "online" && rules.endless) return { timer: 0, noDamage: [true, true] };
    return { timer: rules.timer, noDamage: [false, false] };
  }

  global.Modes = { cleanRules, status, autoEnds, cleanPractice, dummyCard, duelOpts };
})(typeof window !== "undefined" ? window : globalThis);
