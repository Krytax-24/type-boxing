/**
 * Brawl custom fighters: gives the player's own fighters (creator.js) their Backspace Brawl numbers.
 *
 * A custom fighter plays its template's frame data (CONFIG.brawl.chars) with the player's choices on top: which
 * animation each button, the projectile and the rising move play, the three finishers, and the stat points turned
 * into bounded multipliers (power, speed, reach). Kept here so the creator never needs Backspace Brawl, and
 * Backspace Brawl works the same without the creator.
 */
CounterType.define(
  "brawl-custom",
  ["brawl-config", "brawl-rules", "events", "registry", "?creator"],
  (CONFIG, Brawl, events, registry, creator) => {
    "use strict";

    const B = CONFIG.brawl;
    const FINISHER = { spd: 1.0, dmg: 14, kd: true, rb: 14 }; // every custom finisher hits the same: never stronger
    let registered = [];

    function styleFor(d) {
      const base = B.style[d.base] || B.style.cyborg;
      return {
        fire: Object.assign({}, base.fire, { clip: d.q }),
        dp: Object.assign({}, base.dp, { clip: d.r }),
        btn: { hp: { clip: d.map.hp }, lp: { clip: d.map.lp }, hk: { clip: d.map.hk }, lk: { clip: d.map.lk } },
        pow: 0.85 + d.pts.power * 0.05,
        spdK: 0.9 + d.pts.speed * 0.04,
        reachK: 0.9 + d.pts.reach * 0.03,
        combos: d.combos.map((c) => Object.assign({ seq: c.seq.join(","), name: c.name, clip: c.clip }, FINISHER)),
      };
    }

    /** Writes the numbers of every saved custom fighter (and forgets the deleted ones). */
    function sync() {
      for (const key of registered) {
        delete B.chars[key];
        delete B.style[key];
        Brawl.dropCache(key);
      }
      registered = [];
      if (!creator) return;
      for (const { key, fighter } of creator.fighters()) {
        B.chars[key] = Object.assign({}, B.chars[fighter.base], { name: fighter.name });
        B.style[key] = styleFor(fighter);
        Brawl.dropCache(key);
        registered.push(key);
      }
    }

    events.on("creator:changed", sync);
    sync();

    // The creator page shows how long each animation lasts in a Brawl fight (the frame data times the moves).
    registry.add("clip-timing", {
      id: "brawl",
      seconds: (base, clip) => {
        const frames = B.chars[base] ? B.chars[base][clip] : null;
        return frames ? frames[0] : null;
      },
    });

    return Object.freeze({ sync });
  },
);
