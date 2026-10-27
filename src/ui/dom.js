/**
 * DOM helpers shared by every component: element lookup, HTML escaping and small element factories.
 *
 * Every piece of text that can come from outside the game (another player's name over the network, a saved
 * record, a name the player typed) goes through escapeHtml() before it is placed in markup.
 */
CounterType.define("dom", [], () => {
  "use strict";

  const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  /** The element with this id, or null. */
  function byId(id) {
    return document.getElementById(id);
  }

  /** Text made safe to place inside HTML markup and attribute values. */
  function escapeHtml(text) {
    return String(text === undefined || text === null ? "" : text).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
  }

  /**
   * Creates an element.
   *
   * @param {string} tag
   * @param {{id?: string, className?: string, html?: string, attrs?: object}} [options]
   */
  function create(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.id) el.id = options.id;
    if (options.className) el.className = options.className;
    if (options.attrs) for (const [name, value] of Object.entries(options.attrs)) el.setAttribute(name, value);
    if (options.html !== undefined) el.innerHTML = options.html;
    return el;
  }

  /**
   * The element with this id inside `parent`, created (and appended) the first time it is asked for. Components
   * use it to own their markup, so index.html needs none for them.
   */
  function ensure(parent, id, tag = "div", className = "") {
    let el = byId(id);
    if (!el) {
      el = create(tag, { id, className });
      parent.appendChild(el);
    }
    return el;
  }

  /** Restarts a CSS animation class on an element (remove, force a layout, add again). */
  function replayClass(el, className, ...others) {
    el.classList.remove(className, ...others);
    void el.offsetWidth; // a layout read makes the browser see the class as new
    el.classList.add(className);
  }

  /** The value of a CSS custom property on :root (for example "--you"). */
  function cssVar(name, fallback = "") {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  /** Device pixels per CSS pixel, capped so huge displays do not make canvases enormous. */
  function pixelRatio(cap = 3) {
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  return Object.freeze({ byId, escapeHtml, create, ensure, replayClass, cssVar, pixelRatio });
});
