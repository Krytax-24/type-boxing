/**
 * Quit confirm (#mod-confirm): "Quit to menu?" over the pause menu. Enter or Y quits, Esc or N keeps fighting.
 */
CounterType.define("confirm-modal", ["modals", "actions", "home-page", "buttons"], (modals, actions, home, buttons) => {
  "use strict";

  function render(el) {
    el.innerHTML =
      `<h2 class="screen-title">Quit to menu?</h2><p>This fight ends without a result.</p>` +
      `<div class="btn-row">${buttons.button("quit-no", "Keep fighting", { primary: true })}${buttons.button("quit-yes", "Quit")}</div>`;
  }

  function onKey(e, key) {
    if (e.key === "Enter" || key === "y") actions.run("quit-yes");
    else if (e.key === "Escape" || key === "n") actions.run("quit-no");
    return true;
  }

  function onAction(name) {
    if (name !== "quit-no") return false;
    modals.close();
    return true;
  }

  modals.register({ id: "confirm", render, onKey, onAction });

  // Quit (from this window, or "Leave room" in the online pause menu): back to the menus.
  actions.on("quit-yes", () => home.goMenu());

  return Object.freeze({});
});
