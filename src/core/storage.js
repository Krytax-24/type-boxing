/**
 * Storage: the one place that touches localStorage.
 *
 * Every read and write is wrapped, because storage can be blocked (private windows, strict browser settings) or
 * full. Reads then fall back to a default and writes report false, so the game always keeps working for the
 * current visit. All keys start with "typeboxing." (the game's first name), so saved data from older versions
 * keeps working.
 */
CounterType.define("storage", [], () => {
  "use strict";

  function store() {
    try {
      return window.localStorage || null;
    } catch (error) {
      return null; // reading localStorage itself can throw when it is blocked
    }
  }

  /**
   * Reads a JSON value.
   *
   * @param {string} key
   * @param {*} [fallback=null] Returned when the key is missing, unreadable or blocked.
   */
  function readJson(key, fallback = null) {
    const text = readText(key, null);
    if (text === null) return fallback;
    try {
      const value = JSON.parse(text);
      return value === null || value === undefined ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  /** Writes a JSON value. Returns false when storage is full or blocked. */
  function writeJson(key, value) {
    return writeText(key, JSON.stringify(value));
  }

  /** Reads a plain string. */
  function readText(key, fallback = "") {
    const s = store();
    if (!s) return fallback;
    try {
      const text = s.getItem(key);
      return text === null ? fallback : text;
    } catch (error) {
      return fallback;
    }
  }

  /** Writes a plain string. Returns false when storage is full or blocked. */
  function writeText(key, text) {
    const s = store();
    if (!s) return false;
    try {
      s.setItem(key, text);
      return true;
    } catch (error) {
      return false;
    }
  }

  /** Removes a key. Returns false when storage is blocked. */
  function remove(key) {
    const s = store();
    if (!s) return false;
    try {
      s.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  return Object.freeze({ readJson, writeJson, readText, writeText, remove });
});
