/**
 * Settings: the player's own settings (look, sound, input, match rule defaults), saved in this browser.
 *
 * One object holds the values (`values`). Only this module writes to it; everyone else reads it, or calls set().
 * Every change is saved and announced, and the modules it concerns apply it themselves:
 *
 *     settings.watch((values) => { renderer.shakeScale = values.shake; });   // now and on every change
 *
 * None of these settings changes a rule. Defaults and step tables live in CONFIG.settings.
 * The Duel's word view ("Over-head" or "Classic") is kept under its own older storage key (CONFIG.wordPlate).
 */
CounterType.define("settings", ["config", "storage", "events"], (CONFIG, storage, events) => {
  "use strict";

  const SETTINGS = CONFIG.settings;
  const VIEW_KEY = CONFIG.wordPlate.storageKey;
  const VIEWS = ["overhead", "classic"];

  /** The current values. Read freely; change them only through set() and assign(). */
  const values = Object.assign({}, SETTINGS.defaults);

  const saved = storage.readJson(SETTINGS.storageKey);
  if (saved && typeof saved === "object") {
    for (const key in SETTINGS.defaults) {
      if (typeof saved[key] === typeof SETTINGS.defaults[key]) values[key] = saved[key];
    }
  } else if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    values.reduceMotion = true; // first visit: follow the system setting
  }

  let view = storage.readText(VIEW_KEY, "overhead");
  if (!VIEWS.includes(view)) view = "overhead";

  function save() {
    return storage.writeJson(SETTINGS.storageKey, values);
  }

  function announce(keys) {
    events.emit("settings:changed", { keys, values });
  }

  /** One setting: saves it and tells every module that cares. */
  function set(key, value) {
    values[key] = value;
    save();
    announce([key]);
  }

  /** Several settings at once (a graphics quality preset), announced once. */
  function assign(patch) {
    Object.assign(values, patch);
    save();
    announce(Object.keys(patch));
  }

  /** Runs `apply(values)` now and after every change. Returns a function that stops it. */
  function watch(apply) {
    apply(values, null);
    return events.on("settings:changed", ({ keys }) => apply(values, keys));
  }

  // ---------- The Duel's word view ----------

  /** "overhead" (words float over the fighters) or "classic" (a typing box at the bottom). */
  function getView() {
    return view;
  }

  function setView(mode) {
    if (!VIEWS.includes(mode)) return;
    view = mode;
    storage.writeText(VIEW_KEY, view);
    events.emit("view:changed", view);
  }

  function toggleView() {
    setView(view === "overhead" ? "classic" : "overhead");
  }

  /** The view's name on screen. */
  function viewName() {
    return view === "overhead" ? "Over-head" : "Classic";
  }

  return Object.freeze({ values, set, assign, save, watch, getView, setView, toggleView, viewName });
});
