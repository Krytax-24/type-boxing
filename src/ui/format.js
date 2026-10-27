/**
 * Number and time formats used across the screens, so every clock and ordinal reads the same way.
 */
CounterType.define("format", [], () => {
  "use strict";

  /** Whole seconds as m:ss ("1:05"). */
  function clock(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  /** 1st, 2nd, 3rd, 4th ... (upper case with `upper`). */
  function ordinal(n, upper = false) {
    const tens = n % 100;
    const units = n % 10;
    let suffix = "th";
    if (units === 1 && tens !== 11) suffix = "st";
    else if (units === 2 && tens !== 12) suffix = "nd";
    else if (units === 3 && tens !== 13) suffix = "rd";
    return n + (upper ? suffix.toUpperCase() : suffix);
  }

  /** A number with `digits` decimals, or "0" for anything that is not a finite number. */
  function fixed(n, digits = 0) {
    return Number.isFinite(n) ? n.toFixed(digits) : "0";
  }

  /** 0.25 -> "25%". */
  function percent(value) {
    return Math.round(value * 100) + "%";
  }

  /** A long duration: "1 h 5 min", "3 min 20 s" or "45 s". */
  function duration(seconds) {
    if (seconds >= 3600) return Math.floor(seconds / 3600) + " h " + Math.floor((seconds % 3600) / 60) + " min";
    if (seconds >= 60) return Math.floor(seconds / 60) + " min " + Math.floor(seconds % 60) + " s";
    return Math.floor(seconds) + " s";
  }

  /** A short result time: "1:05" from a minute, else seconds with one decimal ("12.5s"). */
  function shortTime(seconds) {
    if (seconds >= 60) return Math.floor(seconds / 60) + ":" + String(Math.round(seconds % 60)).padStart(2, "0");
    return Math.round(seconds * 10) / 10 + "s";
  }

  return Object.freeze({ clock, ordinal, fixed, percent, duration, shortTime });
});
