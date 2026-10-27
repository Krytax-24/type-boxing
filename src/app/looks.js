/**
 * Looks: who is drawn on the arena and in which identity colors.
 *
 * Each typist keeps one identity color (CONFIG.chars.you and .foe, which the theme can change) for the HUD, the
 * word plate letters, the sparks and the glow around the fighter. On the menus the arena shows a sparring loop of
 * your fighter against the opponent the menu has picked; in a fight it shows the two fighters of that fight.
 * Cosmetic only: no rule reads any of this.
 */
CounterType.define(
  "looks",
  ["config", "arena", "player", "themes", "events"],
  (CONFIG, arena, player, Themes, events) => {
    "use strict";

    const CH = CONFIG.chars;
    let menuOpponent = null; // the fighter the menus show against yours (the Duel picks it from its bot)
    let fightKeys = null; // [left, right] while a fight shows its own fighters

    /** The fighter shown against yours on the menus when no mode has picked one: the next one in the roster. */
    function defaultOpponent() {
      const roster = player.roster();
      const mine = roster.indexOf(player.fighter());
      return roster[(mine + 1) % roster.length] || player.fighter();
    }

    /** Applies the identity colors and the fighters to draw. */
    function apply() {
      const you = CH.you;
      const foe = CH.foe;
      const root = document.documentElement.style;
      root.setProperty("--you", you.body);
      root.setProperty("--you-letters", you.letters);
      root.setProperty("--foe", foe.body);
      const keys = fightKeys || [player.fighter(), menuOpponent || defaultOpponent()];
      arena.renderer.chars = { keys, glows: [you.body, foe.body] };
      arena.renderer.menuSpar = keys;
      events.emit("looks:changed");
    }

    /** The menus show your fighter against this one. */
    function setMenuOpponent(key) {
      menuOpponent = key;
      apply();
    }

    /** A fight shows these two fighters ([left, right]); null goes back to the menu pair. */
    function setFight(keys) {
      fightKeys = keys ? keys.slice() : null;
      apply();
    }

    /** Backspace Brawl draws its own puppets: the renderer's duel fighters are switched off while it runs. */
    function hideFighters() {
      arena.renderer.chars = null;
    }

    events.on("player:changed", apply);
    Themes.onChange(apply);

    return Object.freeze({ apply, setMenuOpponent, setFight, hideFighters });
  },
);
