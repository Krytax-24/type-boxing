/**
 * Duel HUD, versus style like a classic fighting game: each player's name plate and HP bar across the top (yours
 * left, the opponent's right, mirrored), the clock and the edge rope between them, and each player's other numbers
 * (WPM, power, combo, ultimate) in a small panel in their bottom corner. The center stays clear for the fighters.
 *
 * Every frame it reads the duel and writes the DOM; it never changes the duel. It also plays the moments that
 * sound once (countdown beeps, combo, counter, ultimate), found by watching the duel's state change.
 */
CounterType.define(
  "duel-hud",
  ["config", "typing", "settings", "audio", "characters", "format", "dom"],
  (CONFIG, typing, settings, Sfx, Chars, format, dom) => {
    "use strict";

    const { damageRate, duelTune } = typing;
    const D = CONFIG.duel;
    const LOW_HP = 40;
    const CRITICAL_HP = 20;
    const GHOST_HOLD = 0.4; // seconds the pale "ghost" bar holds lost HP before it drains
    const GHOST_DRAIN = 35; // HP per second

    // ---------- Markup ----------

    function plateHtml(name) {
      return `
    <div class="nameplate">
      <div class="who"><span class="pname">${name}</span><span class="pweapon"></span></div>
      <span class="hpnum">100</span><span class="healtag"></span>
    </div>
    <div class="hpbar"><div class="hpghost"></div><div class="hpfill"></div></div>`;
    }

    function cornerHtml() {
      return `
    <div class="stats">
      <span class="stat wpm"><b>0</b>WPM</span>
      <span class="stat power">POWER <b>0</b><span class="countertag">COUNTER</span></span>
      <span class="stun"></span>
    </div>
    <div class="meters">
      <span class="combo"><span class="pips"></span><b>x0</b></span>
      <span class="ultrow"><span class="ultbar"><span class="ultfill" style="display:block"></span></span><span class="ulttext">ULT 0%</span></span>
    </div>`;
    }

    const PAUSE_ICON =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/></svg>';

    // The HUD's own markup, in the HUD layer: the plates, the clock and the corner panels, and (Over-head view) the
    // thin progress line of your current word.
    const layer = dom.byId("hud-layer");
    const hud = dom.ensure(layer, "hud");
    dom.ensure(layer, "word-progress").innerHTML = `<div id="word-progress-fill"></div>`;
    hud.innerHTML = `
      <div class="hptop left" id="hp1">${plateHtml("YOU")}</div>
      <div id="center">
        <div id="timer">0:00</div>
        <div id="round-tag"></div>
        <div id="tug"><div id="tug-fill"></div><div id="tug-mid"></div><div id="tug-knot"></div></div>
        <div id="tug-row"><span id="tug-label">EDGE</span><span id="tug-val">0.0</span><span id="tug-unit">HP/S</span></div>
      </div>
      <div class="hptop right" id="hp2">${plateHtml("BOT")}</div>
      <div class="side left" id="p1">${cornerHtml()}</div>
      <div class="side right" id="p2">${cornerHtml()}</div>
      <button id="pause-btn" class="icon-btn" data-act="pause" tabindex="-1" aria-label="Pause" title="Pause">${PAUSE_ICON}</button>`;

    // One player's HUD parts, from the top plate and the corner panel.
    function partsOf(plate, corner) {
      const q = (selector) => plate.querySelector(selector) || corner.querySelector(selector);
      return {
        root: corner,
        name: q(".pname"),
        hpnum: q(".hpnum"),
        heal: q(".healtag"),
        hp: q(".hpfill"),
        ghost: q(".hpghost"),
        ghostHp: D.maxHp,
        ghostHold: 0,
        wpm: q(".wpm b"),
        power: q(".power b"),
        combo: q(".combo b"),
        comboBox: q(".combo"),
        stun: q(".stun"),
        counter: q(".countertag"),
        pipBox: q(".pips"),
        pips: [],
        weaponEl: q(".pweapon"),
        ult: q(".ultfill"),
        ultText: q(".ulttext"),
        lastCombo: 0,
      };
    }

    const seats = [partsOf(dom.byId("hp1"), dom.byId("p1")), partsOf(dom.byId("hp2"), dom.byId("p2"))];
    let panels = seats; // panels[0] is always you: the right-hand set when you stand on the right

    const el = {
      timer: dom.byId("timer"),
      roundTag: dom.byId("round-tag"),
      tug: dom.byId("tug"),
      knot: dom.byId("tug-knot"),
      fill: dom.byId("tug-fill"),
      value: dom.byId("tug-val"),
      countdown: dom.byId("countdown"),
      progress: dom.byId("word-progress-fill"),
    };

    // ---------- Setup per fight ----------

    /** Puts you on the left or the right: the HUD plates follow your seat. */
    function seat(right) {
      dom.byId("ui").classList.toggle("mirror", !!right);
      panels = right ? [seats[1], seats[0]] : seats;
      seats.forEach((p) => {
        p.ghostHp = D.maxHp;
        p.ghostHold = 0;
      });
    }

    /** A player's fighter name under their name, and one combo pip per clean word of a combo level. */
    function setFighter(i, key, weapon) {
      const p = panels[i];
      p.weaponEl.textContent = Chars.DEFS[key].name;
      p.pipBox.innerHTML = '<span class="pip"></span>'.repeat(weapon.wordsPerCombo);
      p.pips = [...p.pipBox.querySelectorAll(".pip")];
    }

    /** A player's name on their plate (text only, so another player's name is always safe). */
    function setName(i, name) {
      panels[i].name.textContent = name;
    }

    // ---------- Every frame ----------

    /**
     * @param {object} duel The Duel.
     * @param {object|null} run The run (for the round tag).
     * @param {number} dt Seconds since the last frame.
     */
    function update(duel, run, dt) {
      duel.typists.forEach((t, i) => updatePlayer(duel, t, panels[i], i, dt));

      const left = duel.timeLeft();
      el.timer.textContent = left !== null ? format.clock(Math.ceil(left)) : format.clock(duel.t);
      const tag = roundTag(run);
      if (el.roundTag.textContent !== tag) el.roundTag.textContent = tag;

      updateEdge(duel);

      // Over-head view: a thin line at the bottom shows how far into the current word you are.
      if (settings.getView() === "overhead" && duel.streams) {
        const stream = duel.streams[0];
        const word = stream.current();
        el.progress.style.width = Math.min(1, stream.typed.length / word.text.length) * 100 + "%";
        el.progress.classList.toggle("ult", !!word.ultimate);
      }

      fightSounds(duel);
      if (duel.phase === "countdown") el.countdown.textContent = Math.ceil(duel.countdown);
      else if (duel.goFlash > 0) el.countdown.textContent = "FIGHT!";
      else el.countdown.textContent = "";
    }

    function updatePlayer(duel, t, p, i, dt) {
      p.hpnum.textContent = Math.ceil(t.hp);
      // Healing readout: HP per second the typist is getting back right now (the floating number is net of damage).
      let healRate = 0;
      if (duel.phase === "fight" && t.hp > 0 && t.hp < D.maxHp) {
        healRate =
          D.basis !== "wpm"
            ? D.healPerWpm * duel.wpmNow[i]
            : duelTune("regenScale") * Math.min(duel.power[0], duel.power[1]);
      }
      const shown = healRate * duel.healFactor();
      p.heal.textContent = shown >= 0.05 ? "+" + shown.toFixed(1) + "/S" : "";
      p.hp.style.width = (t.hp / D.maxHp) * 100 + "%";
      // The pale "ghost" bar holds lost HP for a moment, then drains, so damage reads clearly.
      if (t.hp >= p.ghostHp) {
        p.ghostHp = t.hp;
        p.ghostHold = GHOST_HOLD;
      } else if ((p.ghostHold -= dt) <= 0) {
        p.ghostHp = Math.max(t.hp, p.ghostHp - GHOST_DRAIN * dt);
      }
      p.ghost.style.width = (p.ghostHp / D.maxHp) * 100 + "%";
      p.hp.className = "hpfill" + (t.hp < CRITICAL_HP ? " crit" : t.hp < LOW_HP ? " low" : "");
      p.wpm.textContent = Math.round(duel.wpmNow[i]);
      p.power.textContent = Math.round(duel.power[i]); // includes the counter boost
      p.counter.classList.toggle("on", duel.phase === "fight" && t.countering(duel.t));
      p.combo.textContent = "x" + (D.basis !== "wpm" ? Math.floor(t.streak) : t.comboLevel);
      if (t.comboLevel !== p.lastCombo) {
        const cls = t.comboLevel > p.lastCombo ? "pop" : "broke";
        if (duel.phase === "fight") Sfx.play(cls === "pop" ? "combo" : "broken", t.comboLevel);
        dom.replayClass(p.comboBox, cls, "pop", "broke");
      }
      p.lastCombo = t.comboLevel;
      const perLevel = t.weapon.wordsPerCombo;
      const inBlock = t.comboLevel >= D.maxComboLevel ? perLevel : t.streak % perLevel;
      p.pips.forEach((pip, k) => {
        pip.classList.toggle("on", k < Math.floor(inBlock));
        pip.classList.toggle("half", k === Math.floor(inBlock) && inBlock % 1 >= 0.5);
      });
      p.ult.style.width = t.charge + "%";
      const ready = t.ultReady();
      p.ult.classList.toggle("ready", ready);
      p.ultText.classList.toggle("ready", ready);
      if (ready) p.ultText.textContent = "ULTIMATE READY";
      else if (t.charge >= 100) {
        p.ultText.textContent = "NEEDS " + t.weapon.comboRequired * t.weapon.wordsPerCombo + " IN A ROW";
      } else p.ultText.textContent = "ULT " + Math.floor(t.charge) + "%";
      p.stun.textContent = duel.t < t.stunUntil ? "STUNNED" : "";
    }

    function roundTag(run) {
      if (!run) return "";
      if (run.kind === "endless") return `Endless, ${run.wins[0]} - ${run.wins[1]}`;
      if (run.kind === "practice") return "Practice";
      if (run.rules.endless) return "Endless";
      if (run.rules.rounds > 1) return `Round ${run.round}/${run.rules.rounds}, ${run.wins[0]} - ${run.wins[1]}`;
      return "";
    }

    // Net pressure in HP per second, from your point of view, as a tug-of-war rope: the knot slides toward whoever
    // is winning, full stretch at tugRange wpm of difference.
    function updateEdge(duel) {
      const net = damageRate(duel.power[0], duel.power[1]) - damageRate(duel.power[1], duel.power[0]);
      const full =
        D.basis === "speed"
          ? Math.min(D.maxDps, D.relDamage * D.tugRel)
          : duelTune("damageScale") * duelTune("tugRange");
      const pos = Math.max(-1, Math.min(1, net / full)); // -1: all the way to you, +1: all the way to the opponent
      const lead = net > 0.05;
      const trail = net < -0.05;
      el.tug.className = lead ? "lead" : trail ? "trail" : "";
      // You are on the left: when you lead, the knot comes toward you.
      const knot = 50 - pos * 50 * (duel.mirror ? -1 : 1);
      el.knot.style.left = knot + "%";
      el.fill.style.left = Math.min(knot, 50) + "%";
      el.fill.style.width = Math.abs(knot - 50) + "%";
      el.value.textContent = (net > 0 ? "+" : "") + net.toFixed(1);
      el.value.style.color = lead ? "var(--you)" : trail ? "var(--foe)" : "";
    }

    // ---------- Sounds that happen once ----------

    const heard = { beat: 0, phase: "menu", counter: [false, false], ready: [false, false], ult: [null, null] };

    function fightSounds(duel) {
      if (duel.phase === "countdown") {
        const beat = Math.ceil(duel.countdown);
        if (beat !== heard.beat) {
          heard.beat = beat;
          Sfx.play("beep");
        }
      } else heard.beat = 0;
      if (duel.phase === "fight" && heard.phase === "countdown") Sfx.play("go");
      if (duel.phase === "over" && heard.phase === "fight") Sfx.play("ko");
      heard.phase = duel.phase;
      if (duel.phase !== "fight") {
        heard.counter = [false, false];
        heard.ready = [false, false];
        return;
      }
      duel.typists.forEach((t, i) => {
        const countering = t.countering(duel.t);
        const ready = t.ultReady();
        const ult = duel.fighters[i].ult || null;
        if (countering && !heard.counter[i]) Sfx.play("counter");
        if (ready && !heard.ready[i] && i === 0) Sfx.play("ultReady");
        if (ult && ult !== heard.ult[i]) Sfx.play("ultimate");
        heard.counter[i] = countering;
        heard.ready[i] = ready;
        heard.ult[i] = ult;
      });
    }

    // The player's HUD settings.
    settings.watch((v) => {
      const ui = dom.byId("ui");
      ui.classList.toggle("hide-wpm", !v.showWpm);
      ui.classList.toggle("hide-power", !v.showPower);
      ui.classList.toggle("hide-edge", !v.showEdge);
    });

    /** Clears what the HUD leaves on the shared parts of the screen (the countdown) when the Duel stops. */
    function clear() {
      el.countdown.textContent = "";
    }

    return Object.freeze({ seat, setFighter, setName, update, clear });
  },
);
