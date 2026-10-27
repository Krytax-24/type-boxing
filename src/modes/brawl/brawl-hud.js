/**
 * Brawl HUD: each fighter's name, HP bar (with a ghost bar that drains after a hit) and super meter across the
 * top, the round clock and tag in the middle, a pause button, and the big countdown. Drawing only: it reads the
 * fight, never changes it. Your identity color follows your seat (the right side when you start on the right).
 */
CounterType.define(
  "brawl-hud",
  ["brawl-config", "brawl-rules", "brawl-fx", "audio", "dom"],
  (CONFIG, Brawl, brawlFx, Sfx, dom) => {
    "use strict";

    const B = CONFIG.brawl;
    const GHOST_EASE = 3; // the ghost bar catches up this fast (share per second)
    const FIGHT_TEXT_MS = 700;
    const PAUSE_ICON =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/></svg>';

    const hud = dom.ensure(dom.byId("hud-layer"), "bhud");
    const ghost = [100, 100];
    let parts = null;
    let count = -1; // the countdown number last shown (0: FIGHT was shown)

    function sideHtml(i) {
      return `<div class="bh-side ${i ? "right" : "left"}" id="bh${i}"><div class="bh-name"></div>
      <div class="bh-bar"><i class="bh-ghost"></i><i class="bh-fill"></i><b class="bh-hp"></b></div>
      <div class="bh-meter"><i></i><span>SUPER</span></div></div>`;
    }

    /** Builds the HUD (once); `mySeat` 1 colors the right side as yours. */
    function build(mySeat) {
      if (!hud.dataset.built) {
        hud.dataset.built = "1";
        hud.innerHTML =
          sideHtml(0) +
          `<div class="bh-mid"><div class="bh-clock" id="bh-clock">0</div><div class="bh-tag" id="bh-tag"></div></div>` +
          sideHtml(1) +
          `<button class="icon-btn bh-pause" data-act="pause" tabindex="-1" aria-label="Pause" title="Pause">${PAUSE_ICON}</button>`;
      }
      dom.byId("bh0").style.setProperty("--id", mySeat ? "var(--foe)" : "var(--you)");
      dom.byId("bh1").style.setProperty("--id", mySeat ? "var(--you)" : "var(--foe)");
      parts = [0, 1].map((i) => {
        const el = dom.byId("bh" + i);
        return {
          name: el.querySelector(".bh-name"),
          fill: el.querySelector(".bh-fill"),
          ghost: el.querySelector(".bh-ghost"),
          hp: el.querySelector(".bh-hp"),
          meter: el.querySelector(".bh-meter"),
        };
      });
    }

    /** A new round: full bars and a fresh countdown. */
    function reset() {
      ghost[0] = 100;
      ghost[1] = 100;
      count = -1;
      const countdown = dom.byId("countdown");
      countdown.textContent = "";
      countdown.classList.remove("go");
    }

    /** The fight left the screen. */
    function clear() {
      const countdown = dom.byId("countdown");
      countdown.textContent = "";
      countdown.classList.remove("go");
    }

    function updateCountdown(state) {
      const countdown = dom.byId("countdown");
      if (state.phase === "countdown") {
        const n = Math.ceil(state.cd / 60);
        countdown.textContent = n;
        countdown.classList.remove("go");
        if (n !== count) {
          count = n;
          Sfx.play("beep");
        }
      } else if (count !== 0) {
        count = 0;
        countdown.textContent = "FIGHT";
        countdown.classList.add("go");
        Sfx.play("go");
        setTimeout(() => {
          if (count === 0) countdown.textContent = "";
        }, FIGHT_TEXT_MS);
      }
    }

    /**
     * Every frame of a fight.
     *
     * @param {object} state The fight (brawl-rules.js).
     * @param {{names: string[], chars: string[], run: object|null}} info
     * @param {number} dt
     */
    function update(state, info, dt) {
      if (!parts) return;
      [0, 1].forEach((i) => {
        const f = state.f[i];
        const part = parts[i];
        const pct = (Math.max(0, f.hp) / B.hp) * 100;
        ghost[i] += (pct - ghost[i]) * Math.min(1, dt * GHOST_EASE);
        if (ghost[i] < pct) ghost[i] = pct;
        part.fill.style.width = pct + "%";
        part.ghost.style.width = ghost[i] + "%";
        part.hp.textContent = Math.ceil(Math.max(0, f.hp));
        part.meter.firstChild.style.width = f.meter + "%";
        part.meter.classList.toggle("ready", f.meter >= B.superCost);
        const label = info.names[i] + "  " + brawlFx.defOf(info.chars[i]).name;
        if (part.name.textContent !== label) part.name.textContent = label;
      });
      const left = Brawl.timeLeft(state);
      const clock = left === null ? "" : String(Math.ceil(left));
      const clockEl = dom.byId("bh-clock");
      if (clockEl.textContent !== clock) clockEl.textContent = clock;
      const run = info.run;
      const rules = run && run.rules;
      const tag =
        rules && rules.rounds > 1 ? `Round ${run.round}/${rules.rounds}, ${run.wins[0]} - ${run.wins[1]}` : "";
      const tagEl = dom.byId("bh-tag");
      if (tagEl.textContent !== tag) tagEl.textContent = tag;
      updateCountdown(state);
    }

    return Object.freeze({ build, reset, clear, update });
  },
);
