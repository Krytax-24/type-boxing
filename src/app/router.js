/**
 * Router: one screen at a time in the overlay (#overlay), floating over the live arena.
 *
 * A page module registers its screen and gets its own <section id="scr-ID" class="screen ...">. It draws into
 * that section itself; the router only decides which one is visible, and remembers a few hooks:
 *   restore()            go back to this screen without side effects (no sound, no new data)
 *   refresh()            redraw the parts that depend on settings or on the top modal closing
 *   onKey(e, key)        keys while the screen is showing (return true when handled)
 *   onAction(n, x, y, p) button actions while the screen is showing (return true when handled); p: all the
 *                        parts of the action, for actions with more than two values
 * show(null) hides every screen: a fight owns the view.
 */
CounterType.define("router", ["dom", "events"], (dom, events) => {
  "use strict";

  /** @type {Map<string, object>} */
  const pages = new Map();
  let current = null;
  let modeSource = () => null; // the id of the game mode that owns the view, or null (set by the session)

  const ui = () => dom.byId("ui");
  const overlay = () => dom.byId("overlay");

  /**
   * Registers a screen.
   *
   * @param {object} page The screen: `id`, an optional `className` for its section, and the optional hooks
   *   described at the top of this file (restore, refresh, onKey, onAction).
   * @returns {HTMLElement} The screen's section.
   */
  function register(page) {
    if (pages.has(page.id)) throw new Error(`router: the screen "${page.id}" is registered twice.`);
    const before = dom.byId("keyline");
    let el = dom.byId("scr-" + page.id);
    if (!el) {
      el = dom.create("section", { id: "scr-" + page.id, className: ("screen " + (page.className || "")).trim() });
      overlay().insertBefore(el, before);
    }
    pages.set(page.id, Object.assign({ el }, page));
    return el;
  }

  /** Shows a screen by id, or no screen at all (null). Visibility only: the page draws itself. */
  function show(id) {
    if (id !== null && !pages.has(id)) throw new Error(`router: no screen "${id}".`);
    current = id;
    for (const page of pages.values()) page.el.classList.toggle("is-active", page.id === id);
    overlay().classList.toggle("hidden", !id);
    if (id) overlay().dataset.screen = id;
    ui().dataset.screen = id || "";
    syncIdle();
    events.emit("screen:changed", id);
  }

  /**
   * Two marks on #ui that the stylesheets read:
   *   .idle            no fight HUD: a screen shows, or nothing is being played
   *   [data-mode="id"] the game mode that owns the view; each mode's CSS shows its own HUD only under its own id
   * The session tells the router which mode owns the view (so the router never needs the game modes).
   */
  function setModeSource(source) {
    modeSource = source;
    syncIdle();
  }

  function syncIdle() {
    const el = ui();
    if (!el) return;
    const mode = modeSource();
    el.classList.toggle("idle", !!current || !mode);
    if (mode) el.dataset.mode = mode;
    else delete el.dataset.mode;
  }

  /** The id of the screen showing, or null during a fight. */
  function currentId() {
    return current;
  }

  /** The section of a screen. */
  function element(id) {
    const page = pages.get(id);
    return page ? page.el : null;
  }

  /** Goes back to a screen through its restore() hook (or just shows it). */
  function restore(id) {
    const page = pages.get(id);
    if (page && page.restore) page.restore();
    else show(id);
  }

  /** Redraws the current screen's dynamic parts. */
  function refresh() {
    const page = pages.get(current);
    if (page && page.refresh) page.refresh();
  }

  function handleKey(e, key) {
    const page = pages.get(current);
    return page && page.onKey ? page.onKey(e, key) === true : false;
  }

  function handleAction(name, x, y, parts) {
    const page = pages.get(current);
    return page && page.onAction ? page.onAction(name, x, y, parts) === true : false;
  }

  // The screen behind the last modal redraws (its key line can depend on what the modal changed).
  events.on("modals:closed", refresh);

  return Object.freeze({
    register,
    show,
    current: currentId,
    element,
    restore,
    refresh,
    handleKey,
    handleAction,
    setModeSource,
    syncIdle,
  });
});
