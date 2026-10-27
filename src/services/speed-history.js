/**
 * Speed history: your typing speed in your last few finished duels, saved in this browser.
 *
 * MATCH ME (the Duel's own-speed bot) aims at the average, and the other modes use it as a fallback for "about how
 * fast is this player" (Race practice bots, ranked stand-ins), so it lives here and no mode needs another one.
 * Kept under the older storage key in CONFIG.duel.matchMe, so existing histories carry over.
 */
CounterType.define("speed-history", ["config", "storage"], (CONFIG, storage) => {
  "use strict";

  const MM = CONFIG.duel.matchMe;

  /** Your recent speeds, oldest first (only sensible numbers). */
  function list() {
    const saved = storage.readJson(MM.storageKey, []);
    return Array.isArray(saved) ? saved.filter((x) => typeof x === "number" && x > 0) : [];
  }

  /** Remembers the speed of a finished match (one decimal), keeping the newest few. */
  function remember(wpm) {
    const next = list()
      .concat([Math.round(wpm * 10) / 10])
      .slice(-MM.history);
    storage.writeJson(MM.storageKey, next);
  }

  /** Your average over the last few matches, rounded; CONFIG.duel.matchMe.start before you have any. */
  function average() {
    const recent = list().slice(-MM.history);
    return recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : MM.start;
  }

  /** True once you have finished a match of your own. */
  function has() {
    return list().length > 0;
  }

  return Object.freeze({ list, remember, average, has });
});
