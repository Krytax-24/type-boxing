/**
 * Buttons: the one button kit every screen uses.
 *
 * Every action shown on screen is a button whose data-act names the same action its key runs (actions.js). Buttons
 * never take focus (tabindex -1, and the click handler cancels mousedown), so a click can never steal the typing
 * and never types a character. Keys are not printed on the buttons; they still work.
 */
CounterType.define("buttons", [], () => {
  "use strict";

  const classes = (...names) => names.filter(Boolean).join(" ");

  /**
   * A standard button.
   *
   * @param {string} action The action it runs ("rematch", "opt:mRounds:3" ...).
   * @param {string} label Markup allowed (labels are written by the game, never by players).
   * @param {{primary?: boolean, className?: string, disabled?: boolean}} [options]
   */
  function button(action, label, options = {}) {
    const cls = classes("btn", options.primary && "primary", options.className);
    return `<button class="${cls}" data-act="${action}" tabindex="-1"${options.disabled ? " disabled" : ""}>${label}</button>`;
  }

  /**
   * A big menu button (title views, pause menu), with an optional second line.
   *
   * @param {string} action
   * @param {string} label
   * @param {{primary?: boolean, className?: string, sub?: string}} [options]
   */
  function menuButton(action, label, options = {}) {
    const cls = classes("mbtn", options.primary && "primary", options.className);
    const sub = options.sub ? `<span class="sub">${options.sub}</span>` : "";
    return `<button class="${cls}" data-act="${action}" tabindex="-1"><span>${label}${sub}</span></button>`;
  }

  /** A chip of the key line under the menus. */
  function keyChip(action, label) {
    return `<button class="key" data-act="${action}" tabindex="-1"><b>${label}</b></button>`;
  }

  /**
   * One choice of a segmented control.
   *
   * @param {string} action
   * @param {string} label
   * @param {{selected?: boolean, disabled?: boolean, className?: string}} [options]
   */
  function segment(action, label, options = {}) {
    const cls = classes("seg", options.selected && "sel", options.className);
    return `<button class="${cls}" data-act="${action}" tabindex="-1"${options.disabled ? " disabled" : ""}>${label}</button>`;
  }

  return Object.freeze({ button, menuButton, keyChip, segment });
});
