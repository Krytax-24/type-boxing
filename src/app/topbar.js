/**
 * Top bar (menus only): your fighter chip on the left (click opens the Fighter screen), and the Settings and
 * Fullscreen buttons on the right.
 */
CounterType.define("topbar", ["dom", "player", "events"], (dom, player, events) => {
  "use strict";

  const SETTINGS_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2h4l.6 3 2.2 1.3 2.9-1 2 3.4-2.3 2v2.6l2.3 2-2 3.4-2.9-1-2.2 1.3-.6 3h-4l-.6-3-2.2-1.3-2.9 1-2-3.4 2.3-2v-2.6l-2.3-2 2-3.4 2.9 1L9.4 5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const FULLSCREEN_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"/></svg>';

  const bar = dom.byId("topbar");
  bar.innerHTML = `
    <button class="fighter-chip" data-act="fighter" tabindex="-1" aria-label="Your fighter">
      <span class="chip-swatch"></span><span class="chip-name">YOU</span><span class="chip-color"></span><span class="chip-weapon"></span>
    </button>
    <div class="icons">
      <button class="icon-btn" data-act="settings" tabindex="-1" aria-label="Settings" title="Settings (S)">${SETTINGS_ICON}</button>
      <button class="icon-btn" data-act="fullscreen" tabindex="-1" aria-label="Fullscreen" title="Fullscreen (F)">${FULLSCREEN_ICON}</button>
    </div>`;
  const name = bar.querySelector(".chip-color");
  const title = bar.querySelector(".chip-weapon");

  /** Shows your current fighter on the chip. */
  function update() {
    const def = player.def(player.fighter());
    name.textContent = def ? def.name : "";
    title.textContent = def ? def.title.toLowerCase() : "";
  }

  events.on("player:changed", update);
  events.on("looks:changed", update);
  update();

  return Object.freeze({ update });
});
