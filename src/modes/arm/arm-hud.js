/**
 * Arm Wrestling HUD: the clock and the pull meter on top, a panel per wrestler in the bottom corners (power,
 * accuracy, speed, grip), the typing box over your own endless word stream, and the big texts (WRESTLE, SUDDEN
 * DEATH, PINNED). It also plays the match's sounds that happen once. Drawing only: it reads the match, never
 * changes it.
 */
CounterType.define(
  "arm-hud",
  ["arm-config", "arm-rules", "type-view", "audio", "format", "dom"],
  (CONFIG, Arm, TypeView, Sfx, format, dom) => {
    "use strict";

    const A = CONFIG.arm;
    const WRESTLE_SHOWS = 0.8;
    const SUDDEN_SHOWS = 1.2;
    const OVER_TEXT_AFTER = 0.25;
    const STRAIN_BAND = 0.04; // a power gap under this reads as STRAIN
    const HOT_BAND = 0.03; // a wrestler this far ahead in power glows

    const hud = dom.ensure(dom.byId("hud-layer"), "ahud");
    let view = null;

    function side(i, name) {
      return `<div class="a-side ${i ? "right" : "left"} panel" id="a-side${i}" style="--id:var(${i ? "--foe" : "--you"})">
      <div class="a-name">${dom.escapeHtml(name)}</div>
      <div class="a-power"><span>POWER</span><b>0</b></div>
      <div class="a-bar"><i></i></div>
      <dl class="a-kv"><dt>Accuracy</dt><dd class="acc">-</dd><dt>WPM</dt><dd class="wpm">0</dd><dt>Grip</dt><dd class="grip">-</dd></dl>
      ${i ? `<div class="a-word"><span>Typing</span><b class="foe-word"></b></div>` : ""}
    </div>`;
    }

    /** Builds the HUD and the typing box for a new match against `card`. */
    function build(state, card, ranked) {
      hud.innerHTML = `
      <div id="a-top" class="panel">
        <div id="a-timer">1:00</div>
        <div id="a-tug"><div id="a-tug-mid"></div><div id="a-tug-knot"></div></div>
        <div id="a-tug-row"><span>YOU</span><span id="a-state">GRIP</span><span>${dom.escapeHtml(card.short)}</span></div>
        ${ranked ? `<span class="r-tag">Ranked preview</span>` : ""}
      </div>
      ${side(0, "YOU")}${side(1, card.short)}
      <div id="arm-box" class="panel"></div>
      <div id="a-go" aria-live="polite"></div>`;
      const stream = state.streams[0];
      if (view) view.destroy();
      view = new TypeView(
        dom.byId("arm-box"),
        {
          count: () => stream.words.length,
          text: (i) => stream.words[i].text,
          index: () => stream.index,
          typed: () => stream.typed,
          final: (i) => {
            const typed = stream.words[i].typedFinal;
            return typed === undefined || typed === stream.words[i].text ? null : typed;
          },
          done: () => false,
        },
        { cls: "mt-arm" },
      );
    }

    function clear() {
      hud.innerHTML = "";
      if (view) view.destroy();
      view = null;
    }

    /** Redraws your words after a key (or quietly, when the endless stream grew). */
    function updateText(quiet) {
      if (view) view.update(quiet);
    }

    /** True when the stream has words the view does not show yet. */
    function behind(state) {
      return !!view && view.els.length !== state.streams[0].words.length;
    }

    function liveLine(state) {
      const you = state.typists[0];
      if (state.phase === "countdown") return `<span class="dim">grip ready</span>`;
      const accuracy = you.right + you.wrong ? Math.round(state.acc[0] * 100) + "%" : "-";
      return `<span>${Math.round(state.wpm[0])} wpm</span><span>${accuracy}</span><span class="dim">${you.words} words</span>`;
    }

    function stateText(state) {
      if (state.phase !== "fight") return state.phase === "over" ? "PINNED" : "READY";
      if (state.sudden) return "SUDDEN DEATH";
      const gap = state.power[0] - state.power[1];
      if (Math.abs(gap) < STRAIN_BAND) return "STRAIN";
      return gap > 0 ? "PUSHING" : "HOLDING";
    }

    function goText(state, scene) {
      const r = state.result;
      if (state.phase === "countdown") return String(Math.ceil(state.countdown));
      if (state.phase === "fight" && state.t < WRESTLE_SHOWS) return "WRESTLE";
      if (state.phase === "fight" && state.sudden && state.suddenT < SUDDEN_SHOWS) return "SUDDEN DEATH";
      if (r && scene.overT > OVER_TEXT_AFTER) return r.how === "pin" ? "PINNED" : "TIME";
      return "";
    }

    function updateSide(state, i) {
      const el = dom.byId("a-side" + i);
      const typist = state.typists[i];
      const foeWpm = state.wpm[1 - i];
      const grip = Math.min(1, foeWpm > 0 ? state.wpm[i] / (A.gate * foeWpm) : 1, state.wpm[i] / A.minWpm);
      el.querySelector(".a-power b").textContent = Math.round(state.power[i] * 100);
      el.querySelector(".a-bar i").style.width = Math.min(100, state.power[i] * 100) + "%";
      el.querySelector(".acc").textContent = typist.right + typist.wrong ? Math.round(state.acc[i] * 100) + "%" : "-";
      el.querySelector(".wpm").textContent = Math.round(state.wpm[i]);
      el.classList.toggle("hot", state.phase === "fight" && state.power[i] > state.power[1 - i] + HOT_BAND);
      let gripText = "-";
      if (typist.lastKeyAt !== null) gripText = grip >= 0.999 ? "FULL" : Math.round(grip * 100) + "%";
      el.querySelector(".grip").textContent = gripText;
    }

    /** Every frame while the match runs. `scene` gives the eased pull and the time since the end. */
    function update(state, scene) {
      const timer = dom.byId("a-timer");
      timer.textContent = format.clock(Math.ceil(Arm.timeLeft(state)));
      timer.classList.toggle("sudden", state.sudden);
      dom.byId("a-tug-knot").style.left = 50 + 50 * Math.max(-1, Math.min(1, scene.x)) + "%";
      dom.byId("a-state").textContent = stateText(state);
      updateSide(state, 0);
      updateSide(state, 1);
      // The opponent's current word, with the part they have typed underlined.
      const foeWord = dom.byId("a-side1").querySelector(".foe-word");
      if (foeWord) {
        const word = state.streams[1].current().text;
        const typed = state.streams[1].typed;
        foeWord.innerHTML = `<u>${dom.escapeHtml(typed)}</u>${dom.escapeHtml(word.slice(typed.length))}`;
      }
      const go = dom.byId("a-go");
      const text = goText(state, scene);
      if (go.textContent !== text) {
        go.textContent = text;
        go.className = state.result ? (state.result.winner === 0 ? "win" : "lose") : "";
      }
      if (view) view.live(liveLine(state));
    }

    // ---------- Sounds that follow the match (watching it, never changing it) ----------

    const heard = { beat: 0, phase: "", sudden: false };

    function sounds(state) {
      if (state.phase === "countdown") {
        const beat = Math.ceil(state.countdown);
        if (beat !== heard.beat) {
          heard.beat = beat;
          Sfx.play("beep");
        }
      } else heard.beat = 0;
      if (state.phase === "fight" && heard.phase === "countdown") Sfx.play("go");
      if (state.phase === "over" && heard.phase === "fight") Sfx.play("ko");
      if (state.sudden && !heard.sudden) Sfx.play("counter");
      heard.sudden = state.sudden;
      heard.phase = state.phase;
    }

    return Object.freeze({ build, clear, update, updateText, behind, sounds });
  },
);
