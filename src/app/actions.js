/**
 * Actions: the one road every button click and every menu key takes.
 *
 * A button carries data-act="name:x:y"; a key handler calls actions.run("name:x:y"). Either way the action goes to
 * the first part of the game that takes it, in this order:
 *   1. the top modal (modals.js)
 *   2. the screen that is showing (router.js)
 *   3. handlers registered for that action name with actions.on(name, handler) (game modes register theirs)
 *   4. fallback handlers (actions.onUnknown), for names that are only known at run time
 * A handler returns false to let the next one try; anything else means it took the action.
 *
 * Clicks never take focus and never type: a mousedown on a button is cancelled.
 */
CounterType.define(
  "actions",
  ["audio", "modals", "router", "registry", "settings", "option-row", "dom"],
  (Sfx, modals, router, registry, settings, optionRow, dom) => {
    "use strict";

    /** @type {Map<string, Function[]>} */
    const handlers = new Map();
    const fallbacks = [];
    const guards = [];

    /**
     * Registers a handler for an action name. handler(x, y, topModal) returns false to pass the action on.
     *
     * @returns {Function} Call it to remove the handler.
     */
    function on(name, handler) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(handler);
      return () => {
        const list = handlers.get(name);
        list.splice(list.indexOf(handler), 1);
      };
    }

    /** A handler for action names nobody registered: handler(name, x, y, topModal) returns true when it took it. */
    function onUnknown(handler) {
      fallbacks.push(handler);
    }

    /** While any guard returns true, clicks are ignored (for example while a K.O. plays out). */
    function addGuard(guard) {
      guards.push(guard);
    }

    /**
     * Runs an action.
     *
     * @param {string} action "name", "name:x" or "name:x:y" (x and y stay strings).
     */
    function run(action) {
      const parts = String(action).split(":");
      const [name, x, y] = parts;
      Sfx.play("ui");
      if (modals.handleAction(name, x, y)) return;
      if (router.handleAction(name, x, y, parts)) return;
      const top = modals.top();
      for (const handler of (handlers.get(name) || []).slice()) {
        if (handler(x, y, top, parts) !== false) return;
      }
      for (const handler of fallbacks) {
        if (handler(name, x, y, top)) return;
      }
    }

    // ---------- Built-in: option rows ("opt:key:value") ----------
    // A mode's own option first (Race "r.bots", the Duel's practice dummy "p.wpm"), then a player setting.
    // Then whatever shows the row draws it again.
    on("opt", (key, raw) => {
      const value = optionRow.parseValue(raw);
      const taken = registry.list("mode").some((mode) => mode.opt && mode.opt(key, value));
      if (!taken && key in settings.values) settings.set(key, value);
      if (modals.top()) modals.render();
      else router.refresh();
    });

    // ---------- Mouse ----------
    document.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) e.preventDefault();
    });
    dom.byId("ui").addEventListener("click", (e) => {
      Sfx.unlock();
      const button = e.target.closest("[data-act]");
      if (!button) return;
      if (guards.some((guard) => guard())) return;
      run(button.dataset.act);
      button.blur();
    });

    return Object.freeze({ on, onUnknown, addGuard, run });
  },
);
