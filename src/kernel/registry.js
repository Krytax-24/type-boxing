/**
 * Registry: named extension points that modules plug into.
 *
 * The shell never names a plug-in. It asks the registry what is there ("which game modes are loaded?") and
 * plug-ins add themselves when they start. Remove a plug-in's scripts and it is simply not in the list.
 *
 * Extension points used by the game (see ARCHITECTURE.md for each contract):
 *   "mode"            game modes: Duel, Race, Arm Wrestling, Backspace Brawl
 *   "howto-section"   sections of the How to play page
 *   "key-help"        rows of the Settings > Keys table
 *   "settings-tab"    tabs of the Settings window
 *   "profile-history" match history providers for the Profile page
 *   "profile-tile"    headline numbers on the Profile page
 *   "profile-extra"   more about your character on the Profile page (the Race vehicle)
 *   "profile-link"    header buttons on the Profile page (My stats)
 *   "fighter-card"    extra cards after the roster on the Fighter page (+ Create)
 *   "fighter-note"    a line about the highlighted fighter on the Fighter page
 *   "clip-timing"     how long an animation clip lasts in a fight, shown on the Creator page (Backspace Brawl)
 */
CounterType.define("registry", ["events"], (events) => {
  "use strict";

  /** @type {Map<string, Map<string, object>>} */
  const points = new Map();

  /** Sorted lists, kept until their point changes: the game loop asks for the modes on every frame. */
  const sorted = new Map();

  function pointOf(name) {
    if (!points.has(name)) points.set(name, new Map());
    return points.get(name);
  }

  /**
   * Adds an item to an extension point. Items are objects with a unique `id` and an optional `order`.
   *
   * @param {string} point
   * @param {{id: string, order?: number}} item
   * @returns {object} The item, so a module can keep a reference.
   */
  function add(point, item) {
    if (!item || typeof item.id !== "string" || !item.id) {
      throw new TypeError(`registry.add("${point}"): every item needs a string id.`);
    }
    const items = pointOf(point);
    if (items.has(item.id)) throw new Error(`registry.add("${point}"): "${item.id}" is already registered.`);
    items.set(item.id, item);
    sorted.delete(point);
    events.emit("registry:changed", { point, id: item.id });
    return item;
  }

  /** Removes an item. Returns true when it was there. */
  function remove(point, id) {
    const removed = pointOf(point).delete(id);
    if (removed) {
      sorted.delete(point);
      events.emit("registry:changed", { point, id });
    }
    return removed;
  }

  /** One item, or null. */
  function get(point, id) {
    return pointOf(point).get(id) || null;
  }

  /**
   * Every item of a point, sorted by `order` (then by the order they were added). The array is frozen and shared
   * until the point changes: copy it (concat, slice) before sorting or changing it.
   */
  function list(point) {
    if (!sorted.has(point)) {
      const items = Array.from(pointOf(point).values())
        .map((item, index) => ({ item, index }))
        .sort((a, b) => (a.item.order || 0) - (b.item.order || 0) || a.index - b.index)
        .map(({ item }) => item);
      sorted.set(point, Object.freeze(items));
    }
    return sorted.get(point);
  }

  return Object.freeze({ add, remove, get, list });
});
