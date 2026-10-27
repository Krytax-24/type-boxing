/**
 * Race mode: plugs the Race into the game. 2 to 6 racers type the same passage; your speed drives your vehicle.
 *
 * This module runs a race (bots, the fixed step, keys, the finish and the record) and registers the mode with its
 * contributions to the shared pages. The rules are race-rules.js; the track, the HUD, the menu and the result
 * screen are their own modules. Remove the Race's scripts and the game plays on without it.
 */
CounterType.define(
  "race-mode",
  [
    "race-config",
    "race-rules",
    "race-records",
    "race-track",
    "race-hud",
    "race-menu",
    "race-result",
    "race-vehicles",
    "registry",
    "router",
    "session",
    "modals",
    "actions",
    "online-gateway",
    "random",
    "ranked",
    "backend",
    "profile",
    "audio",
    "toast",
    "buttons",
    "format",
    "dom",
  ],
  (
    CONFIG,
    Race,
    records,
    track,
    hud,
    raceMenu,
    raceResult,
    Vehicles,
    registry,
    router,
    session,
    modals,
    actions,
    net,
    random,
    Ranked,
    Backend,
    Profile,
    Sfx,
    toast,
    buttons,
    format,
    dom,
  ) => {
    "use strict";

    const C = CONFIG.race;
    const STEP = 1 / 120;
    const ORDER = 20;
    const RESULT_AFTER_MS = 1400; // the finish plays this long before the result screen
    const DEFAULT_MMR = 1000;
    const RANKED_SPEED = { min: 15, max: 170, doubleEvery: 450 };
    const BOT_COLORS = ["#fb923c", "#7ce3ff", "#f472b6", "#facc15", "#a78bfa", "#4ade80", "#e8edff"];
    const PREF_PREFIX = "r.";

    const G = {
      active: false,
      s: null, // the race (race-rules.js)
      bots: [],
      others: [],
      acc: 0,
      ranked: false,
      opponents: null, // ranked: the matchmaker's players
      myMmr: DEFAULT_MMR,
      overAt: 0,
      resultShown: false,
      rankedOut: null,
      rankedErr: false,
      seed: 0,
      record: null,
    };

    // ---------- Starting a race ----------

    function shuffled(list, rand) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }

    /** The other racers: the ranked players at your speed scaled by the rating gap, or practice bots near it. */
    function opponents(target, rand) {
      if (G.ranked && G.opponents) {
        return G.opponents.map((p) => {
          const gap = (p.mmr - G.myMmr) / RANKED_SPEED.doubleEvery;
          const wpm = Math.max(RANKED_SPEED.min, Math.min(RANKED_SPEED.max, target * Math.pow(2, gap)));
          return { name: p.name, tag: p.tag, mock: p, wpm, acc: 0.95 + rand() * 0.035 };
        });
      }
      const prefs = records.preferences();
      const n = Math.max(1, Math.min(C.maxRacers - 1, prefs.bots));
      const out = [];
      for (let i = 0; i < n; i++) {
        const spread = C.spread[(i + Math.floor(rand() * C.spread.length)) % C.spread.length];
        out.push({
          name: Ranked.mockName(rand).toUpperCase().slice(0, 10),
          tag: "",
          wpm: Math.max(12, target * spread),
          acc: C.botAccuracy[0] + rand() * (C.botAccuracy[1] - C.botAccuracy[0]),
        });
      }
      return out;
    }

    function newRace() {
      const prefs = records.preferences();
      const you = {
        name: "YOU",
        tag: Profile.get().tag,
        human: true,
        vehicle: prefs.vehicle,
        color: CONFIG.chars.you.body,
      };
      const target = prefs.speed === "match" || G.ranked ? records.myWpm() : Number(prefs.speed);
      const rand = random.mulberry32(G.seed ^ 0x9e3779b9);
      // Opponents drive the whole roster (your unlocks only limit your own pick), each a different vehicle when
      // possible.
      const vehicles = shuffled(
        CONFIG.vehicles.filter((v) => v.id !== prefs.vehicle).map((v) => v.id),
        rand,
      );
      const colors = BOT_COLORS.filter((c) => c.toLowerCase() !== String(CONFIG.chars.you.body).toLowerCase());
      const others = opponents(target, rand);
      const racers = [you].concat(
        others.map((o, i) => ({
          name: o.name,
          tag: o.tag,
          vehicle: vehicles[i % vehicles.length],
          color: colors[i % colors.length],
        })),
      );
      G.s = Race.create(G.seed, racers, { length: G.ranked ? "medium" : prefs.length });
      G.others = others;
      G.bots = [null].concat(
        others.map(
          (o, i) =>
            new Race.Bot(
              { wpm: Race.Bot.rawFor(o.wpm, o.acc), accuracy: o.acc, recovery: [0.18, 0.12], drift: 0.12 },
              G.seed + 101 * (i + 1),
            ),
        ),
      );
      G.acc = 0;
      G.resultShown = false;
      G.overAt = 0;
      G.rankedOut = null;
      G.rankedErr = false;
      G.record = null;
      track.reset(G.s);
      hud.build(G.s, G.ranked);
      modals.clear();
      G.active = true;
      router.show(null);
    }

    /**
     * Starts a race.
     *
     * @param {{ranked?: boolean, opponents?: object[], myMmr?: number}} [opts]
     */
    function start(opts = {}) {
      session.cancelRoundTimer();
      net.stop();
      G.ranked = !!opts.ranked;
      G.opponents = opts.opponents || null;
      G.myMmr = opts.myMmr || DEFAULT_MMR;
      session.begin({
        mode: "race",
        kind: G.ranked ? "ranked" : "practice",
        ranked: G.ranked,
        rules: session.rulesNow(),
        wins: [0, 0],
        round: 1,
      });
      G.seed = random.newSeed();
      newRace();
    }

    /** A new race at once (Tab, Race again). A ranked race is never replayed: it becomes a practice race. */
    function restart() {
      G.seed = random.newSeed();
      if (G.ranked) {
        G.ranked = false;
        G.opponents = null;
        const run = session.current();
        if (run && run.mode === "race") {
          run.ranked = false;
          run.kind = "practice";
        }
      }
      newRace();
    }

    function stop() {
      if (!G.active) return;
      G.active = false;
      track.clear();
      hud.clear();
    }

    // ---------- Keys ----------
    // Like Monkeytype: letters type, Backspace deletes a letter, Ctrl (or Alt) + Backspace the whole word, Tab starts
    // a new race (practice only). Space on a wrong word skips it (a time penalty, shown on the live line and the
    // lane); with CONFIG.race.skip off it is refused with a shake.

    function key(e) {
      const s = G.s;
      if (e.key === "Escape") {
        e.preventDefault();
        actions.run("pause");
        return;
      }
      if (e.key === "Backspace" || e.key === " " || e.key === "Enter" || e.key === "Tab" || e.key.length === 1) {
        e.preventDefault();
      }
      if (e.key === "Tab") {
        if (!G.ranked && !e.repeat) {
          Sfx.play("beep");
          restart();
        }
        return;
      }
      if (s.phase !== "race") return;
      if (e.repeat && e.key !== "Backspace") return; // a held key never types twice
      if (e.key === "Backspace") {
        if (Race.backspace(s, 0, e.ctrlKey || e.altKey || e.metaKey)) {
          Sfx.play("key");
          hud.updateText();
        }
        return;
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey) return;
      const evs = Race.press(s, 0, e.key);
      if (evs.some((x) => x.type === "blocked")) {
        Sfx.play("typo");
        hud.nudge();
      } else if (evs.some((x) => x.type === "skip" || x.type === "wrong")) Sfx.play("typo");
      else if (evs.length) Sfx.play("key");
      hud.updateText();
    }

    // ---------- Every frame ----------

    function frame(dt) {
      const s = G.s;
      if (!s) return;
      const frozen = session.paused();
      if (!frozen && !G.resultShown) {
        G.acc += dt;
        while (G.acc >= STEP) {
          for (let i = 1; i < G.bots.length; i++) G.bots[i].update(s, i, s.t);
          Race.step(s, STEP);
          G.acc -= STEP;
        }
        if (s.phase === "over" && !G.overAt) {
          G.overAt = performance.now();
          finishRace();
        }
        if (G.overAt && performance.now() - G.overAt > RESULT_AFTER_MS && !G.resultShown) showResult();
      }
      track.draw(s, frozen ? 0 : dt);
      if (!G.resultShown) {
        hud.update(s);
        hud.sounds(s);
      }
    }

    // ---------- The finish ----------

    function finishRace() {
      const s = G.s;
      const me = s.racers[0];
      const results = Race.results(s);
      const mine = results.find((x) => x.human);
      const secs = me.finishT !== null ? me.finishT : s.t;
      const stats = raceResult.typeStats(s, me, secs);
      G.record = {
        at: Date.now(),
        mode: "race",
        ranked: G.ranked,
        place: mine.place,
        players: s.racers.length,
        wpm: mine.wpm,
        raw: stats.raw,
        acc: mine.acc,
        cons: stats.cons,
        time: me.finishT !== null ? Math.round((me.finishT + me.penalty) * 10) / 10 : null,
        finished: me.finishT !== null,
        length: s.length,
        chars: s.text.length,
        vehicle: me.vehicle,
        bestStreak: me.bestStreak,
        skips: me.skips,
        penalty: Math.round(me.penalty * 10) / 10,
        opponents: results
          .filter((x) => !x.human)
          .map((x) => ({ name: x.name, tag: x.tag, place: x.place, wpm: x.wpm })),
      };
      if (!records.addRecord(G.record)) {
        toast.show("This race could not be saved: the browser's storage is full or blocked.");
      }
      if (G.ranked && G.opponents) submitRanked(results, mine);
    }

    function submitRanked(results, mine) {
      const opponentsPlaced = results
        .filter((x) => !x.human)
        .map((x) => {
          const o = G.others[x.id - 1].mock;
          return { id: o.id, name: o.name, tag: o.tag, mu: o.mu, sigma: o.sigma, place: x.place };
        });
      Backend.submitRanked("race", mine.place, opponentsPlaced, { wpm: mine.wpm, acc: mine.acc, time: G.record.time })
        .then((out) => {
          G.rankedOut = out;
          if (G.resultShown) renderResult();
        })
        .catch(() => {
          G.rankedErr = true;
          if (G.resultShown) renderResult();
        });
    }

    /** What the result screen shows (race-result.js). */
    function resultInfo() {
      return { state: G.s, record: G.record, ranked: G.ranked, rankedOut: G.rankedOut, rankedErr: G.rankedErr };
    }

    function showResult() {
      G.resultShown = true;
      raceResult.show(resultInfo());
      Sfx.play(G.record && G.record.place === 1 ? "win" : "lose");
    }

    /** Draws the result again (a late ranked update, or back on the result screen from another one). */
    function renderResult() {
      if (G.s && G.record) raceResult.render(resultInfo());
    }

    // ---------- The mode ----------

    registry.add("mode", {
      id: "race",
      label: "Race",
      order: ORDER,
      sub: "2 to 6 racers, your speed drives",
      homeKey: "r",
      typing: true,
      pitch: "In a <b>Race</b> your speed drives your vehicle.",
      legend: "Against bots near your speed, or ranked.",
      ranked: { label: "Race", lobby: { min: C.minRacers, max: C.maxRacers, noun: "racers" }, alwaysSpace: true },
      get active() {
        return G.active;
      },
      inMatch: () => G.active && !!G.s && !G.resultShown && (G.s.phase === "countdown" || G.s.phase === "race"),
      menu: (parts) => raceMenu.draw(parts),
      menuKey: (e, k) => raceMenu.menuKey(e, k),
      opt: (optKey, value) => {
        if (!optKey.startsWith(PREF_PREFIX)) return false;
        records.setPref(optKey.slice(PREF_PREFIX.length), value);
        return true;
      },
      start: () => start(),
      restart,
      startRanked: (match, myMmr) => start({ ranked: true, opponents: match.opponents, myMmr }),
      stop,
      frame,
      key,
      wordDelete: true,
      renderResult,
    });

    actions.on("race-start", (x, y, top) => {
      if (top || router.current() !== "title") return false;
      start();
      return true;
    });
    actions.on("race-vehicle", (id) => {
      records.setPref("vehicle", id);
      router.refresh();
    });

    // ---------- How to play, Keys, Profile ----------

    registry.add("howto-section", {
      id: "race",
      order: ORDER,
      html: (step) => `<h3 class="sec">Race</h3>
    <div class="steps">
      ${step(1, "Same passage for all", "Everyone types the same text, 2 to 6 racers. Your vehicle sits exactly as far along the track as you have typed.")}
      ${step(2, "Fix or skip", `It types like Monkeytype: a wrong letter shows red. Backspace fixes a letter, Ctrl+Backspace the whole word. Space on a wrong word skips it, but adds ${C.skip.base} s plus ${C.skip.perError} s per wrong letter to your time, so fixing is usually faster. Tab starts a new race.`)}
      ${step(3, "Nitro", `${C.streakForBoost} clean words in a row light the nitro. It only looks fast: vehicles never change the result.`)}
      ${step(4, "Finish", `Places go by your time at the line plus any skip penalty. The race closes ${C.lateSec} s after the first racer crosses the line.`, "ult")}
    </div>`,
    });

    registry.add("key-help", {
      id: "race",
      order: ORDER,
      rows: () => [
        [
          "Race",
          "Type the passage like Monkeytype. A wrong letter shows red; Space on a wrong word skips it for a time penalty. Ctrl+Backspace clears a word, Tab restarts.",
        ],
      ],
    });

    registry.add("profile-history", {
      id: "race",
      mode: "race",
      label: "Race",
      order: ORDER,
      entries: () =>
        records.records().map((r) => ({
          at: r.at,
          mode: "race",
          ranked: !!r.ranked,
          foe: `${r.players - 1} racer${r.players > 2 ? "s" : ""}`,
          result: `${format.ordinal(r.place)} of ${r.players}`,
          win: r.place === 1,
          wpm: r.wpm,
          acc: r.acc,
          rp: r.rpDelta,
        })),
    });

    registry.add("profile-tile", {
      id: "race-wpm",
      order: 30,
      tile: () => {
        const list = records.records();
        return {
          label: "Race WPM",
          value: list.length ? Math.max(...list.map((r) => r.wpm)) : "-",
          sub: list.length ? `${list.filter((r) => r.place === 1).length} wins` : "no races yet",
        };
      },
    });

    // Your vehicle on the Profile page, with a Vehicle button (R) that opens the Race view.
    registry.add("profile-extra", {
      id: "race-vehicle",
      order: ORDER,
      html: () => {
        const v = Vehicles.byId(records.preferences().vehicle);
        return `<div class="card-label"><span>Race vehicle</span><span></span></div>
            <canvas id="pf-vehicle" width="180" height="80" aria-label="Your vehicle"></canvas><span class="pf-vname">${v.name}</span>`;
      },
      draw: (root) => {
        const canvas = root.querySelector("#pf-vehicle");
        if (!canvas) return;
        const ratio = dom.pixelRatio(2);
        canvas.width = 180 * ratio;
        canvas.height = 80 * ratio;
        Vehicles.preview(canvas, Vehicles.byId(records.preferences().vehicle), CONFIG.chars.you.body);
      },
      button: buttons.button("race", "Vehicle"),
      key: "r",
      action: "race",
    });

    return Object.freeze({ start, restart, stop });
  },
);
