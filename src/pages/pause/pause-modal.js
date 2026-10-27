/**
 * Pause menu (#mod-pause): Esc in a fight, the pause button, leaving the browser tab or the window, or leaving
 * fullscreen. While it is open in an offline fight nothing steps (session.paused), so the fight stays
 * deterministic. Online fights keep running; the menu then offers to leave the room instead.
 */
CounterType.define(
  "pause-modal",
  ["modals", "actions", "events", "session", "online-gateway", "buttons"],
  (modals, actions, events, session, net, buttons) => {
    "use strict";

    function render(el) {
      if (net.isMatch()) {
        el.innerHTML =
          `<h2 class="screen-title">Online</h2>` +
          buttons.menuButton("resume", "Close", { primary: true }) +
          buttons.menuButton("settings", "Settings") +
          buttons.menuButton("quit-yes", "Leave room") +
          `<p class="modal-note">Online fights keep running while this menu is open.</p>`;
        return;
      }
      el.innerHTML =
        `<h2 class="screen-title">Paused</h2>` +
        buttons.menuButton("resume", "Resume", { primary: true }) +
        buttons.menuButton("restart", "Restart") +
        buttons.menuButton("settings", "Settings") +
        buttons.menuButton("quit", "Quit to menu") +
        `<p class="modal-note">The fight is frozen: the clock and the bot wait for you.</p>`;
    }

    function onKey(e, key) {
      if (e.key === "Escape" || e.key === "Enter") actions.run("resume");
      else if (key === "r") actions.run("restart");
      else if (key === "s") actions.run("settings");
      else if (key === "q") actions.run("quit");
      else if (key === "f") actions.run("fullscreen");
      return true;
    }

    function onAction(name) {
      if (name === "resume") {
        modals.clear();
        return true;
      }
      if (name === "quit") {
        modals.open("confirm");
        return true;
      }
      return false;
    }

    modals.register({ id: "pause", render, onKey, onAction });

    /** Pauses a match in progress (nothing happens on the menus or when a modal is already open). */
    function open() {
      if (!session.inMatch() || modals.count()) return;
      modals.open("pause");
    }

    actions.on("pause", () => open());

    // Leaving the browser tab or the window pauses an offline fight; so does leaving fullscreen.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !net.isMatch()) open();
    });
    window.addEventListener("blur", () => {
      if (!net.isMatch()) open();
    });
    events.on("fullscreen:changed", (on) => {
      if (!on) open();
    });

    return Object.freeze({ open });
  },
);
