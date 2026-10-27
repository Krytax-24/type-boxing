/**
 * Keyboard: the one keydown listener, and where each key goes.
 *
 *   1. a text box (theme code, image address, custom CSS, a name) keeps its own keys; Esc leaves it
 *   2. the top modal (pause, settings, quit confirm)
 *   3. the mode that owns the view, when no screen is showing (typing in a fight, a race, a match)
 *   4. the screen that is showing (each page maps its keys to the same actions its buttons run)
 * Modifier combinations are left to the browser, except Ctrl or Alt + Backspace in a mode that deletes whole words.
 */
CounterType.define(
  "keyboard",
  ["audio", "modals", "router", "session", "actions"],
  (Sfx, modals, router, session, actions) => {
    "use strict";

    /** The key in the form screens compare against: a lower case letter, or the key's name ("Escape", "F2"). */
    function keyName(e) {
      return e.key.length === 1 ? e.key.toLowerCase() : e.key;
    }

    function onKeyDown(e) {
      Sfx.unlock(); // browsers allow audio only after a key or a click
      const target = e.target;
      if (target && (target.tagName === "TEXTAREA" || (target.tagName === "INPUT" && target.type !== "range"))) {
        if (e.key === "Escape") {
          e.preventDefault();
          target.blur();
        } else if (e.key === "Enter" && target.dataset.enterAct) {
          // A text box can name the action Enter runs (the profile's name box saves).
          e.preventDefault();
          actions.run(target.dataset.enterAct);
        }
        return;
      }

      const owner = session.activeMode();
      const screen = router.current();
      const top = modals.top();
      const wordDelete =
        e.key === "Backspace" && (e.ctrlKey || e.altKey) && !top && !screen && !!owner && !!owner.wordDelete;
      if ((e.ctrlKey || e.metaKey || e.altKey) && !wordDelete) return;

      if (top) {
        if (e.key === "Enter" || e.key === " " || e.key === "Tab" || e.key.startsWith("Arrow")) e.preventDefault();
        modals.handleKey(e, keyName(e));
        return;
      }
      if (owner && !screen) {
        owner.key(e);
        return;
      }
      if (screen) {
        if (e.key === " " || e.key === "Enter") e.preventDefault();
        router.handleKey(e, keyName(e));
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return Object.freeze({ keyName });
  },
);
