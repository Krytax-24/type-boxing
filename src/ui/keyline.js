/**
 * The key line: a row of clickable chips under the menus (for example "F2 words: Over-head").
 * Each screen sets its own chips when it is drawn; an empty list hides the line.
 */
CounterType.define("keyline", ["dom"], (dom) => {
  "use strict";

  /** @param {string[]} chips Markup of the chips (buttons.keyChip). */
  function set(chips) {
    const el = dom.byId("keyline");
    if (el) el.innerHTML = chips.join("");
  }

  function clear() {
    set([]);
  }

  return Object.freeze({ set, clear });
});
