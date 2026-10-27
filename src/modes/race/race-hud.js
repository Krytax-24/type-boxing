/**
 * Race HUD: the strip at the top (start lights, your place, your time, the time left) and the passage box at the
 * bottom (the Monkeytype style typing view with its live line). It also plays the race's sounds that happen once.
 * Drawing only: it reads the race state, never changes it.
 */
CounterType.define(
  "race-hud",
  ["race-config", "race-rules", "type-view", "audio", "format", "dom"],
  (CONFIG, Race, TypeView, Sfx, format, dom) => {
    "use strict";

    const SKIP_FLASH = 0.9; // seconds the "+x.x s" penalty pops after a skip
    const GO_SHOWS = 0.8; // seconds "GO" stays up
    const ord = (n) => format.ordinal(n, true);

    const layer = dom.byId("hud-layer");
    const hud = dom.ensure(layer, "rhud");
    const box = dom.ensure(layer, "race-box", "div", "panel");

    let view = null;
    let lastKey = "";

    /** Builds the HUD and the passage box for a new race. */
    function build(state, ranked) {
      hud.innerHTML = `
      <div id="r-top" class="panel">
        <div class="r-lights" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="r-stat big"><span>Place</span><b id="r-place">-</b></div>
        <div class="r-stat"><span>Time</span><b id="r-time">0:00</b></div>
        <div class="r-stat"><span>Left</span><b id="r-left">-</b></div>
        ${ranked ? `<span class="r-tag">Ranked preview</span>` : ""}
      </div>
      <div id="r-go" aria-live="polite"></div>`;
      if (view) view.destroy();
      const me = () => state.racers[0];
      view = new TypeView(
        box,
        {
          count: () => state.words.length,
          text: (i) => state.words[i],
          index: () => Math.min(me().wi, state.words.length - 1),
          typed: () => me().typed,
          // A skipped word keeps what was typed (it shows with a red underline).
          final: (i) => (me().skipped[i] !== undefined ? me().skipped[i] : null),
          done: () => me().finishT !== null,
        },
        { cls: "mt-race" },
      );
      lastKey = "";
    }

    /** Empties the HUD (the race left the screen). */
    function clear() {
      hud.innerHTML = "";
      if (view) view.destroy();
      view = null;
      box.innerHTML = "";
    }

    /** Your live place: finished racers by finish order, then everyone else by progress. */
    function standing(state) {
      const list = state.racers.slice().sort((a, b) => {
        if (a.place && b.place) return a.place - b.place;
        if (a.place) return -1;
        if (b.place) return 1;
        return b.pos - a.pos || a.id - b.id;
      });
      return list.indexOf(state.racers[0]) + 1;
    }

    function liveLine(state) {
      const me = state.racers[0];
      if (state.phase === "countdown") {
        return `<span>${state.words.length} words</span><span class="dim">get ready</span>`;
      }
      const accuracy = me.right + me.wrong ? Math.round(Race.accuracy(me) * 100) + "%" : "-";
      const penalty =
        me.penalty > 0
          ? `<span class="pen${state.t - me.lastSkipAt < SKIP_FLASH ? " hit" : ""}">+${me.penalty.toFixed(1)} s</span>`
          : "";
      return (
        `<span>${Math.min(me.words, state.words.length)}/${state.words.length}</span>` +
        `<span>${Math.round(Race.wpm(state, me))} wpm</span><span>${accuracy}</span>${penalty}`
      );
    }

    function goText(state) {
      const me = state.racers[0];
      if (state.phase === "countdown") return String(Math.ceil(state.countdown));
      if (state.t < GO_SHOWS) return "GO";
      if (me.finishT !== null && state.phase === "race") return `${ord(me.place)}! waiting for the others`;
      return "";
    }

    /** Every frame while the race runs. */
    function update(state) {
      const me = state.racers[0];
      const lit = state.phase === "countdown" ? Math.min(3, 3 - Math.ceil(state.countdown) + 1) : 0;
      hud.querySelectorAll(".r-lights i").forEach((light, i) => {
        light.className = state.phase === "countdown" ? (i < lit ? "red" : "") : "green";
      });
      const left =
        state.firstFinishT !== null
          ? Math.max(0, CONFIG.race.lateSec - (state.t - state.firstFinishT))
          : Math.max(0, state.timeLimit - state.t);
      const place = standing(state);
      const time = me.finishT !== null ? me.finishT : state.t;
      const key = [place, Math.floor(time), Math.ceil(left), state.phase].join("|");
      if (key !== lastKey) {
        lastKey = key;
        dom.byId("r-place").textContent = `${ord(place)} / ${state.racers.length}`;
        dom.byId("r-time").textContent = format.clock(time);
        const leftEl = dom.byId("r-left");
        leftEl.textContent = format.clock(Math.ceil(left));
        leftEl.parentElement.classList.toggle("hot", state.firstFinishT !== null && state.phase === "race");
      }
      if (view) view.live(liveLine(state));
      const go = dom.byId("r-go");
      const text = goText(state);
      if (go.textContent !== text) go.textContent = text;
    }

    /** Redraws your words after a key. */
    function updateText() {
      if (view) view.update();
    }

    /** A refused Space: a short shake on the current word. */
    function nudge() {
      if (view) view.nudge();
    }

    // ---------- Sounds that follow the race (watching it, never changing it) ----------

    const heard = { beat: 0, phase: "", finish: false };

    function sounds(state) {
      const me = state.racers[0];
      if (state.phase === "countdown") {
        const beat = Math.ceil(state.countdown);
        if (beat !== heard.beat) {
          heard.beat = beat;
          Sfx.play("beep");
        }
      } else heard.beat = 0;
      if (state.phase === "race" && heard.phase === "countdown") Sfx.play("go");
      if (me.finishT !== null && !heard.finish) {
        heard.finish = true;
        Sfx.play(me.place === 1 ? "win" : "combo", 3);
      }
      if (me.finishT === null) heard.finish = false;
      heard.phase = state.phase;
    }

    return Object.freeze({ build, clear, update, updateText, nudge, sounds });
  },
);
