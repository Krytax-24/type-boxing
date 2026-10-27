/**
 * Toast: a short message at the bottom of the screen that fades after a few seconds. Text only (never markup), so
 * any message is safe to show, including one that came from another player.
 */
CounterType.define("toast", ["dom"], (dom) => {
  "use strict";

  const VISIBLE_MS = 4000;
  let timer = 0;

  /** Shows a message, replacing the one on screen. */
  function show(message) {
    const el = dom.byId("toast");
    if (!el) return;
    el.textContent = String(message);
    el.classList.add("on");
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove("on"), VISIBLE_MS);
  }

  return Object.freeze({ show });
});
