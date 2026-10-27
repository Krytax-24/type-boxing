/**
 * Match rules rows: the option rows for the match rules (rounds, round timer, endless, word submit), shared by the
 * Duel menu, the Backspace Brawl menu and the online room. Each row runs "opt:<setting>:<value>", so a choice is
 * saved as a player setting (settings.js) and every screen that shows the rows draws them again.
 */
CounterType.define(
  "match-rules-rows",
  ["config", "settings", "match-rules", "option-row"],
  (CONFIG, settings, Modes, optionRow) => {
    "use strict";

    const MODES = CONFIG.modes;
    const WORD_HINT =
      "On: everyone presses Space to end a word. Off: a word ends by itself when it is exactly right. Mix: each player keeps their own Typing setting.";
    const WORD_CHOICES = [
      ["on", "On"],
      ["off", "Off"],
      ["mix", "Mix"],
    ];

    /** The match rules the player chose, cleaned (Modes.cleanRules). */
    function current() {
      const v = settings.values;
      return Modes.cleanRules({ rounds: v.mRounds, timer: v.mTimer, endless: v.mEndless, words: v.mWords });
    }

    /**
     * The rows as markup.
     *
     * @param {object} [options]
     * @param {boolean} [options.rounds=true]   the Rounds and Round timer rows
     * @param {boolean} [options.endless=false] the Endless row (online rooms only)
     * @param {boolean} [options.words=true]    the Word submit row (typing games only)
     * @param {boolean} [options.compact=false] smaller rows without hints
     * @param {boolean} [options.disabled=false] greyed out (an online guest cannot change the host's rules)
     * @param {string}  [options.before=""]     rows to put first (the online room's Game row)
     * @param {string}  [options.after=""]      rows to put last (the Brawl menu's Starting side row)
     */
    function html(options = {}) {
      const { rounds = true, endless = false, words = true, compact = false, disabled = false } = options;
      const { before = "", after = "" } = options;
      const rules = current();
      let rows = before;
      if (rounds) {
        rows += optionRow.optionRow(
          "Rounds",
          "Best of this many. A tie plays one more.",
          "mRounds",
          MODES.roundSteps.map((n) => [n, String(n)]),
          rules.rounds,
          disabled,
        );
        rows += optionRow.optionRow(
          "Round timer",
          "When time runs out, the higher HP wins.",
          "mTimer",
          MODES.timerSteps.map((n) => [n, n ? n + "s" : "Off"]),
          rules.timer,
          disabled,
        );
      }
      if (endless) {
        rows += optionRow.optionRow(
          "Endless",
          "Nobody loses HP and nobody is knocked out. Just type.",
          "mEndless",
          [
            [false, "Off"],
            [true, "On"],
          ],
          rules.endless,
          disabled,
        );
      }
      if (words) rows += optionRow.optionRow("Word submit", WORD_HINT, "mWords", WORD_CHOICES, rules.words, disabled);
      return `<div class="optrows ${compact ? "compact" : ""}">${rows}${after}</div>`;
    }

    return Object.freeze({ current, html });
  },
);
