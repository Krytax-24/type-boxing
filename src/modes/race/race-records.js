/**
 * Race records and preferences, saved in this browser.
 *
 *   preferences: { vehicle, length, bots, speed }   your vehicle and the practice race you like
 *   records:     the newest 200 finished races (local until the backend exists)
 * Vehicles unlock by races finished, never by payment. Your recent race speed is the target for practice bots.
 */
CounterType.define("race-records", ["race-config", "storage", "speed-history"], (CONFIG, storage, speedHistory) => {
  "use strict";

  const C = CONFIG.race;
  const KEEP = 200;
  const RECENT = 5; // races behind "your recent race speed"

  const prefs = { vehicle: CONFIG.vehicles[0].id, length: C.defaultLength, bots: C.defaultBots, speed: C.defaultSpeed };
  const saved = storage.readJson(C.storageKey);
  if (saved && typeof saved === "object") Object.assign(prefs, saved);
  if (!CONFIG.vehicles.some((v) => v.id === prefs.vehicle)) prefs.vehicle = CONFIG.vehicles[0].id; // an old vehicle id

  /** Your preferences (read only: change them with setPref). */
  function preferences() {
    return prefs;
  }

  function setPref(key, value) {
    prefs[key] = value;
    storage.writeJson(C.storageKey, prefs);
  }

  /** Finished races, newest first. */
  function records() {
    const list = storage.readJson(C.records, []);
    return Array.isArray(list) ? list : [];
  }

  /** Saves a finished race. Returns false when storage is full or blocked. */
  function addRecord(record) {
    return storage.writeJson(C.records, [record].concat(records()).slice(0, KEEP));
  }

  function finishedRaces() {
    return records().length;
  }

  function unlocked(vehicle) {
    return finishedRaces() >= vehicle.unlock;
  }

  /** Your recent race speed, or your duel speed (MATCH ME history) before your first race. */
  function myWpm() {
    const recent = records()
      .slice(0, RECENT)
      .filter((x) => x.wpm > 0);
    if (recent.length) return Math.round(recent.reduce((a, x) => a + x.wpm, 0) / recent.length);
    return speedHistory.average();
  }

  return Object.freeze({ preferences, setPref, records, addRecord, finishedRaces, unlocked, myWpm });
});
