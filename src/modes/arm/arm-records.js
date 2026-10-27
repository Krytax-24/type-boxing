/**
 * Arm Wrestling records and the picked opponent, saved in this browser (the newest 200 finished matches).
 */
CounterType.define("arm-records", ["arm-config", "storage"], (CONFIG, storage) => {
  "use strict";

  const A = CONFIG.arm;
  const KEEP = 200;

  let botIndex = A.defaultBot;
  const saved = storage.readJson(A.storageKey);
  if (saved && A.bots[saved.bot]) botIndex = saved.bot;

  /** The picked opponent (an index into CONFIG.arm.bots). */
  function bot() {
    return botIndex;
  }

  /** Picks an opponent (wraps around) and remembers it. */
  function pickBot(i) {
    botIndex = (i + A.bots.length) % A.bots.length;
    storage.writeJson(A.storageKey, { bot: botIndex });
  }

  /** Finished matches, newest first. */
  function records() {
    const list = storage.readJson(A.records, []);
    return Array.isArray(list) ? list : [];
  }

  /** Saves a finished match. Returns false when storage is full or blocked. */
  function addRecord(record) {
    return storage.writeJson(A.records, [record].concat(records()).slice(0, KEEP));
  }

  return Object.freeze({ bot, pickBot, records, addRecord });
});
