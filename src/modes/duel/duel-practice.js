/**
 * Duel practice: the dummy you set up (its speed and accuracy, and whether either of you can lose HP), saved in
 * this browser, and the panel that sets it (the Duel menu's Practice view and the practice result screen).
 * A choice runs "opt:p.<key>:<value>"; the Duel mode hands those to set().
 */
CounterType.define(
  "duel-practice",
  ["config", "storage", "match-rules", "option-row", "match-rules-rows"],
  (CONFIG, storage, Modes, optionRow, rulesRows) => {
    "use strict";

    const P = CONFIG.modes.practice;
    const OPTION_PREFIX = "p.";

    let values = Modes.cleanPractice(storage.readJson(P.storageKey));

    /** The dummy's settings (cleaned). */
    function current() {
      return values;
    }

    /**
     * Changes one setting from an option row ("opt:p.wpm:60" arrives as set("p.wpm", 60)).
     *
     * @returns {boolean} False when the key is not a practice key.
     */
    function set(key, value) {
      if (!key.startsWith(OPTION_PREFIX)) return false;
      values = Modes.cleanPractice(Object.assign({}, values, { [key.slice(OPTION_PREFIX.length)]: value }));
      storage.writeJson(P.storageKey, values);
      return true;
    }

    const yesNo = [
      [false, "No"],
      [true, "Yes"],
    ];

    /** The practice panel: the dummy's rows, then the word submit row. */
    function panelHtml() {
      const p = values;
      return (
        `<div class="card-label"><span>Practice dummy</span><span>set it your way</span></div><div class="optrows">` +
        optionRow.optionRow(
          "Dummy speed",
          "0 makes a dummy that only stands there.",
          "p.wpm",
          P.wpmSteps.map((n) => [n, n ? String(n) : "Still"]),
          p.wpm,
        ) +
        optionRow.optionRow(
          "Dummy accuracy",
          "How often each of its letters is right.",
          "p.accuracy",
          P.accuracySteps.map((n) => [n, n + "%"]),
          p.accuracy,
        ) +
        optionRow.optionRow(
          "Dummy loses HP",
          "Off: it can never be knocked out, so you can practice forever.",
          "p.dummyHurt",
          yesNo,
          p.dummyHurt,
        ) +
        optionRow.optionRow("You lose HP", "Off: you cannot be knocked out either.", "p.youHurt", yesNo, p.youHurt) +
        `</div>` +
        rulesRows.html({ rounds: false })
      );
    }

    return Object.freeze({ current, set, panelHtml });
  },
);
