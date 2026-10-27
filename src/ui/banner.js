/**
 * Round banner: the big message between two rounds ("ROUND 1 WON", "2 - 1"). Shared by every mode with rounds.
 */
CounterType.define("banner", ["dom"], (dom) => {
  "use strict";

  /** Shows the banner. Both texts are written by the game, except names, which callers escape. */
  function show(title, sub = "") {
    const el = dom.byId("round-banner");
    if (!el) return;
    el.innerHTML = `<b>${title}</b><span>${sub}</span>`;
    el.classList.remove("hidden");
  }

  function hide() {
    const el = dom.byId("round-banner");
    if (el) el.classList.add("hidden");
  }

  return Object.freeze({ show, hide });
});
