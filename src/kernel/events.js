/**
 * Event bus: one-to-many messages between modules that should not know each other.
 *
 * A module announces something ("settings:changed", "creator:changed", "app:menu") and any module that cares
 * listens. The sender never names the listeners, so either side can be removed without touching the other.
 * A listener that throws is logged and skipped; the other listeners still run.
 *
 * Event names used by the game are listed in ARCHITECTURE.md.
 */
CounterType.define("events", [], () => {
  "use strict";

  /** @type {Map<string, Function[]>} */
  const listeners = new Map();

  /**
   * Listens for an event.
   *
   * @param {string} name
   * @param {Function} handler Called with the event's payload.
   * @returns {Function} Call it to stop listening.
   */
  function on(name, handler) {
    if (typeof handler !== "function") throw new TypeError(`events.on("${name}"): the handler must be a function.`);
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(handler);
    return () => off(name, handler);
  }

  /** Stops one handler from listening. */
  function off(name, handler) {
    const list = listeners.get(name);
    if (!list) return;
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }

  /** Listens for the next event only. */
  function once(name, handler) {
    const stop = on(name, (payload) => {
      stop();
      handler(payload);
    });
    return stop;
  }

  /**
   * Sends an event to every listener, in the order they started listening.
   *
   * @param {string} name
   * @param {*} [payload]
   */
  function emit(name, payload) {
    const list = listeners.get(name);
    if (!list || !list.length) return;
    for (const handler of list.slice()) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`events: a "${name}" listener failed.`, error);
      }
    }
  }

  return Object.freeze({ on, off, once, emit });
});
