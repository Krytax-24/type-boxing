/**
 * Player: which fighter you play as.
 *
 * The roster is the eleven designed fighters plus your own custom fighters (creator.js, when it is loaded). Your
 * pick is saved in this browser. Cosmetic only: fighters never change a number of the rules.
 */
CounterType.define(
  "player",
  ["config", "storage", "events", "characters", "?creator"],
  (CONFIG, storage, events, Chars, creator) => {
    "use strict";

    const CH = CONFIG.chars;

    function buildRoster() {
      return Chars.ORDER.concat(creator ? creator.keys() : []);
    }

    let roster = buildRoster();
    let fighterKey = CH.defaultChar;
    const saved = storage.readText(CH.storageKey, "");
    if (roster.includes(saved)) fighterKey = saved;

    /** Every fighter you can pick, designed ones first. */
    function rosterKeys() {
      return roster.slice();
    }

    /** Your fighter's key. */
    function fighter() {
      return fighterKey;
    }

    /** A fighter's definition (name, title, weapon ...). */
    function def(key) {
      return Chars.DEFS[key] || null;
    }

    /** Picks your fighter and remembers it. */
    function setFighter(key) {
      if (!roster.includes(key)) return false;
      fighterKey = key;
      storage.writeText(CH.storageKey, fighterKey);
      events.emit("player:changed", fighterKey);
      return true;
    }

    /** Your custom fighters changed: the roster follows, and a deleted pick falls back to the default fighter. */
    function syncRoster() {
      roster = buildRoster();
      if (!roster.includes(fighterKey)) {
        fighterKey = CH.defaultChar;
        storage.writeText(CH.storageKey, fighterKey);
      }
      events.emit("player:changed", fighterKey);
    }

    events.on("creator:changed", syncRoster);

    return Object.freeze({ roster: rosterKeys, fighter, def, setFighter });
  },
);
