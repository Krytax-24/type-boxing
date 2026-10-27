/**
 * Modals: a small stack of windows over a screen or a fight (pause, settings, the quit confirm).
 *
 * A modal module registers itself with a render function and, optionally, its own keys and actions. Only the top
 * modal is shown and gets input. While a modal is open in a fight, the fight is paused (session.js).
 */
CounterType.define("modals", ["dom", "events"], (dom, events) => {
  "use strict";

  /**
   * Every registered modal by id: what register() was given, plus `el`, the modal's section.
   *
   * @type {Map<string, object>}
   */
  const entries = new Map();
  let stack = [];

  function container() {
    return dom.byId("modal");
  }

  /**
   * Registers a modal. Creates its <section id="mod-ID" class="modal panel"> inside #modal.
   *
   * @param {{id: string, render: Function, onKey?: Function, onAction?: Function, preview?: boolean}} modal
   *   render(el) fills the section; onKey(e, key) and onAction(name, x, y) return true when they handled it;
   *   preview: the modal manages the "preview" look of #modal itself (the settings window does).
   * @returns {HTMLElement} The modal's section.
   */
  function register(modal) {
    if (entries.has(modal.id)) throw new Error(`modals: "${modal.id}" is registered twice.`);
    const el = dom.ensure(container(), "mod-" + modal.id, "section", "modal panel");
    entries.set(modal.id, Object.assign({ el }, modal));
    return el;
  }

  /** The id of the top modal, or null. */
  function top() {
    return stack.length ? stack[stack.length - 1] : null;
  }

  function count() {
    return stack.length;
  }

  /** Shows the top modal (or hides the layer when there is none). */
  function render() {
    const layer = container();
    const id = top();
    layer.classList.toggle("hidden", !id);
    for (const entry of entries.values()) entry.el.classList.toggle("is-active", entry.id === id);
    if (!id) return;
    layer.dataset.top = id;
    const entry = entries.get(id);
    if (!entry.preview) layer.classList.remove("preview");
    entry.render(entry.el);
  }

  /** Opens a modal on top of the stack (nothing happens if it is already on top). */
  function open(id) {
    if (!entries.has(id)) throw new Error(`modals: no modal "${id}".`);
    if (top() === id) return;
    stack.push(id);
    render();
  }

  /** Closes the top modal. When the last one closes, the screen behind refreshes itself. */
  function close() {
    stack.pop();
    render();
    if (!stack.length) events.emit("modals:closed");
  }

  /** Closes every modal at once, without refreshing the screen (a new fight or the menu is about to show). */
  function clear() {
    stack = [];
    render();
  }

  /** The top modal's key handler. */
  function handleKey(e, key) {
    const entry = entries.get(top());
    return entry && entry.onKey ? entry.onKey(e, key) === true : false;
  }

  /** The top modal's action handler. */
  function handleAction(name, x, y) {
    const entry = entries.get(top());
    return entry && entry.onAction ? entry.onAction(name, x, y) === true : false;
  }

  return Object.freeze({ register, top, count, render, open, close, clear, handleKey, handleAction });
});
