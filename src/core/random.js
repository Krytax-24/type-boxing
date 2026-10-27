/**
 * Random numbers. The rules only ever use the seeded generator, so two players (or a test) that start from the same
 * seed get the same words, bots and races. The unseeded helpers are for things that should differ every time,
 * like the seed of a new match.
 */
CounterType.define("random", [], () => {
  "use strict";

  /**
   * A small, fast seeded generator (mulberry32). Returns a function that gives numbers in [0, 1).
   *
   * @param {number} seed Any 32-bit number.
   * @returns {() => number}
   */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** A fresh seed for a new match, race or round. */
  function newSeed() {
    return (Math.random() * 1e9) >>> 0;
  }

  /** A seed from the browser's crypto generator when there is one (online matches), else newSeed(). */
  function cryptoSeed() {
    const cryptoApi = typeof crypto !== "undefined" ? crypto : null;
    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
      const value = new Uint32Array(1);
      cryptoApi.getRandomValues(value);
      return value[0] >>> 0;
    }
    return newSeed();
  }

  return Object.freeze({ mulberry32, newSeed, cryptoSeed });
});
