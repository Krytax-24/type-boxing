/**
 * Option rows: a label with a hint and a row of choices, as used by the match rules, the practice dummy and the
 * mode menus. A choice runs the action "opt:<key>:<value>" (actions.js turns the value back into a number or a
 * boolean, and hands it to whoever owns the key).
 */
CounterType.define("option-row", ["buttons"], (buttons) => {
  "use strict";

  /**
   * @param {string} label
   * @param {string} hint
   * @param {string} key The option key: a setting ("mRounds") or a component's own ("p.wpm", "r.bots").
   * @param {Array<[*, string]>} choices [value, label] pairs.
   * @param {*} current The selected value.
   * @param {boolean} [disabled] Greys the row out (an online guest cannot change the host's rules).
   */
  function optionRow(label, hint, key, choices, current, disabled = false) {
    const segments = choices
      .map(([value, text]) => buttons.segment(`opt:${key}:${value}`, text, { selected: value === current, disabled }))
      .join("");
    return (
      `<div class="optrow"><span class="lbl">${label}<span class="hint">${hint}</span></span>` +
      `<span class="segs">${segments}</span></div>`
    );
  }

  /** Turns the text value of an "opt:" action back into what the row offered. */
  function parseValue(raw) {
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    return raw;
  }

  return Object.freeze({ optionRow, parseValue });
});
