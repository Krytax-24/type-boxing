/**
 * Arm Wrestling mode: plugs Arm Wrestling into the game. Each side types its own words; accuracy beats raw speed.
 *
 * This module runs a match (the bot, the fixed step, keys, the end and the record) and registers the mode with its
 * contributions to the shared pages. The rules are arm-rules.js, the picture arm-scene.js; the HUD, the menu and
 * the result are their own modules. Remove the Arm Wrestling scripts and the game plays on without it.
 */
CounterType.define(
  "arm-mode",
  [
    "arm-config",
    "arm-rules",
    "arm-scene",
    "arm-records",
    "arm-hud",
    "arm-menu",
    "arm-result",
    "typing",
    "registry",
    "router",
    "session",
    "modals",
    "actions",
    "online-gateway",
    "settings",
    "arena",
    "layout",
    "random",
    "ranked",
    "backend",
    "speed-history",
    "audio",
    "toast",
    "dom",
  ],
  (
    CONFIG,
    Arm,
    ArmScene,
    records,
    hud,
    armMenu,
    armResult,
    typing,
    registry,
    router,
    session,
    modals,
    actions,
    net,
    settings,
    arena,
    layout,
    random,
    Ranked,
    Backend,
    speedHistory,
    Sfx,
    toast,
    dom,
  ) => {
    "use strict";

    const { Bot } = typing;
    const A = CONFIG.arm;
    const STEP = 1 / 120;
    const ORDER = 30;
    const RESULT_AFTER_MS = 1600; // the pin plays this long before the result screen
    const BOT_FIRST_KEY_AT = 0.45;
    const DEFAULT_MMR = 1000;
    const RANKED_SPEED = { min: 15, max: 160, doubleEvery: 450 };

    const G = {
      active: false,
      s: null, // the match (arm-rules.js)
      bot: null,
      card: null, // the opponent: { name, short, wpm, accuracy, ... }
      acc: 0,
      ranked: false,
      foe: null, // ranked: the matchmaker's player
      myMmr: DEFAULT_MMR,
      resultShown: false,
      overAt: 0,
      rankedOut: null,
      rankedErr: false,
      record: null,
      space: true, // your own word submit setting (mixed settings are fair: see arm-rules.js)
      scene: null,
      seen: [0, 0], // typos already shown in the scene
    };

    // ---------- Starting a match ----------

    function foeCard() {
      if (G.ranked && G.foe) {
        const gap = (G.foe.mmr - G.myMmr) / RANKED_SPEED.doubleEvery;
        const wpm = Math.max(RANKED_SPEED.min, Math.min(RANKED_SPEED.max, speedHistory.average() * Math.pow(2, gap)));
        const accuracy = 0.95 + (Ranked.hashStr(G.foe.id) % 35) / 1000;
        return {
          name: `${G.foe.name}#${G.foe.tag}`,
          short: G.foe.name.toUpperCase(),
          wpm,
          accuracy,
          recovery: [0.18, 0.12],
          drift: 0.12,
        };
      }
      const bot = A.bots[records.bot()];
      return Object.assign({ short: bot.name }, bot);
    }

    function newMatch() {
      const seed = random.newSeed();
      G.s = Arm.create(seed);
      G.card = foeCard();
      G.bot = new Bot(Bot.cfgFor(G.card), G.s.streams[1], (evs) => Arm.handleEvents(G.s, 1, evs));
      G.bot.nextKeyAt = BOT_FIRST_KEY_AT;
      G.space = settings.values.wordSubmit;
      hud.build(G.s, G.card, G.ranked);
      if (!G.scene) G.scene = new ArmScene.Scene();
      G.scene.reset({
        you: dom.cssVar("--you", "#4ade80"),
        foe: dom.cssVar("--foe", "#fb923c"),
        foeName: G.ranked ? "" : G.card.name,
        foeSeed: G.foe ? Ranked.hashStr(G.foe.id) : 0,
      });
      G.acc = 0;
      G.resultShown = false;
      G.overAt = 0;
      G.rankedOut = null;
      G.rankedErr = false;
      G.record = null;
      G.seen = [0, 0];
      modals.clear();
      G.active = true;
      router.show(null);
    }

    /**
     * Starts a match.
     *
     * @param {{ranked?: boolean, foe?: object, myMmr?: number}} [opts]
     */
    function start(opts = {}) {
      session.cancelRoundTimer();
      net.stop();
      G.ranked = !!opts.ranked;
      G.foe = opts.foe || null;
      G.myMmr = opts.myMmr || DEFAULT_MMR;
      session.begin({
        mode: "arm",
        kind: G.ranked ? "ranked" : "practice",
        ranked: G.ranked,
        rules: session.rulesNow(),
        wins: [0, 0],
        round: 1,
      });
      newMatch();
    }

    /** A new match at once (Tab, Rematch). A ranked match is never replayed: it becomes a practice match. */
    function restart() {
      if (G.ranked) {
        G.ranked = false;
        G.foe = null;
        const run = session.current();
        if (run && run.mode === "arm") {
          run.ranked = false;
          run.kind = "practice";
        }
      }
      newMatch();
    }

    function stop() {
      if (!G.active) return;
      G.active = false;
      hud.clear();
      arena.renderer.layers = null; // the duel's scenery is drawn again next time
    }

    // ---------- Keys: Monkeytype typing (Space ends a word even if it is wrong, Backspace fixes the current word,
    // Ctrl+Backspace clears it, Tab starts a new match in practice) ----------

    function backspace(e, stream) {
      if (!stream.typed.length) return;
      if (e.ctrlKey || e.altKey || e.metaKey) while (stream.typed.length) stream.backspace();
      else stream.backspace();
      Sfx.play("key");
      hud.updateText();
    }

    function key(e) {
      const s = G.s;
      const stream = s.streams[0];
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
      if (s.phase !== "fight") return;
      if (e.repeat && e.key !== "Backspace") return;
      if (e.key === "Backspace") {
        backspace(e, stream);
        return;
      }
      let evs = [];
      if (e.key === " " || e.key === "Enter") evs = stream.submit(true);
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        const extra = stream.typed.length >= stream.current().text.length;
        evs = stream.press(e.key.toLowerCase());
        if (extra) {
          for (const x of evs) if (x.type === "wrong") x.extra = true;
        }
        if (!G.space && stream.autoEnds()) {
          // Word submit off: an exactly typed word ends by itself (the rules credit the missing Space).
          Arm.handleEvents(s, 0, evs);
          Arm.handleEvents(s, 0, stream.submit(false), true);
          hud.updateText();
          Sfx.play("key");
          return;
        }
      } else return;
      Arm.handleEvents(s, 0, evs);
      if (evs.some((x) => x.type === "wrong")) Sfx.play("typo");
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
          if (s.phase === "fight") G.bot.update(s.t);
          Arm.step(s, STEP);
          G.acc -= STEP;
        }
        if (hud.behind(s)) hud.updateText(true);
        // Typos (yours and the bot's) jerk that hand in the scene.
        for (let i = 0; i < 2; i++) {
          const wrong = s.typists[i].wrong;
          if (wrong > G.seen[i]) {
            G.seen[i] = wrong;
            G.scene.typo(i);
          }
        }
        if (s.phase === "over" && !G.overAt) {
          G.overAt = performance.now();
          finishMatch();
        }
        if (G.overAt && performance.now() - G.overAt > RESULT_AFTER_MS && !G.resultShown) showResult();
      }
      draw(frozen ? 0 : dt);
      if (!G.resultShown) {
        hud.update(s, G.scene);
        hud.sounds(s);
      }
    }

    // The scene fits between the top HUD and the typing box.
    function draw(dt) {
      const canvas = arena.renderer.canvas;
      const { width: W, height: H } = arena.designSize(layout.scale());
      const k = canvas.width / W;
      const top = dom.byId("a-top");
      const box = dom.byId("arm-box");
      const area = {
        top: top ? top.offsetTop + top.offsetHeight + 8 : 110,
        bottom: box && box.offsetHeight ? H - 16 - box.offsetHeight - 4 : H - 220,
      };
      G.scene.update(dt, G.s);
      G.scene.draw(arena.renderer.ctx, W, H, k, G.s, area, dt);
    }

    // ---------- The end ----------

    function finishMatch() {
      const s = G.s;
      const mine = Arm.summary(s, 0);
      const theirs = Arm.summary(s, 1);
      const won = s.result.winner === 0;
      G.record = {
        at: Date.now(),
        mode: "arm",
        ranked: G.ranked,
        won,
        how: s.result.how,
        secs: Math.round(s.t * 10) / 10,
        foe: G.card.name,
        wpm: mine.wpm,
        acc: mine.acc,
        power: mine.power,
        foeWpm: theirs.wpm,
        foeAcc: theirs.acc,
        foePower: theirs.power,
        bestStreak: mine.bestStreak,
      };
      if (!records.addRecord(G.record)) {
        toast.show("This match could not be saved: the browser's storage is full or blocked.");
      }
      if (G.ranked && G.foe) {
        const foe = G.foe;
        const opponent = { id: foe.id, name: foe.name, tag: foe.tag, mu: foe.mu, sigma: foe.sigma, place: won ? 2 : 1 };
        Backend.submitRanked("arm", won ? 1 : 2, [opponent], { wpm: mine.wpm, acc: mine.acc, power: mine.power })
          .then((out) => {
            G.rankedOut = out;
            if (G.resultShown) renderResult();
          })
          .catch(() => {
            G.rankedErr = true;
            if (G.resultShown) renderResult();
          });
      }
    }

    /** What the result screen shows (arm-result.js). */
    function resultInfo() {
      return {
        s: G.s,
        record: G.record,
        card: G.card,
        ranked: G.ranked,
        rankedOut: G.rankedOut,
        rankedErr: G.rankedErr,
      };
    }

    function showResult() {
      G.resultShown = true;
      armResult.show(resultInfo());
      Sfx.play(G.record.won ? "win" : "lose");
    }

    function renderResult() {
      if (G.s && G.record) armResult.render(resultInfo());
    }

    // ---------- The mode ----------

    registry.add("mode", {
      id: "arm",
      label: "Arm Wrestling",
      order: ORDER,
      sub: "accuracy beats raw speed",
      homeKey: "a",
      typing: true,
      pitch: "In <b>Arm Wrestling</b> accuracy counts most.",
      legend: "Against six opponents with different speed and accuracy, or ranked.",
      ranked: { label: "Arm Wrestling" },
      get active() {
        return G.active;
      },
      inMatch: () => G.active && !!G.s && !G.resultShown && (G.s.phase === "countdown" || G.s.phase === "fight"),
      menu: (parts) => armMenu.draw(parts),
      menuKey: (e, k) => armMenu.menuKey(e, k),
      start: () => start(),
      restart,
      startRanked: (match, myMmr) => start({ ranked: true, foe: match.opponents[0], myMmr }),
      stop,
      frame,
      key,
      wordDelete: true,
      renderResult,
    });

    actions.on("arm-start", (x, y, top) => {
      if (top || router.current() !== "title") return false;
      start();
      return true;
    });
    actions.on("arm-bot", (index, y, top) => {
      if (top || router.current() !== "title") return false;
      records.pickBot(Number(index));
      router.refresh();
      return true;
    });

    // ---------- How to play, Keys, Profile ----------

    registry.add("howto-section", {
      id: "arm",
      order: ORDER,
      html: (step) => `<h3 class="sec">Arm Wrestling</h3>
    <div class="steps">
      ${step(1, "Type to push", "Type your words like Monkeytype (a wrong word is underlined and costs accuracy). Your power pulls the locked hands toward your opponent.")}
      ${step(2, "Accuracy first", `Power is ${A.accWeight * 100}% accuracy over your last ${A.accKeys} keys and ${A.speedWeight * 100}% your share of the speed.`)}
      ${step(3, "Keep up", `Accuracy only counts in full while you type at least ${A.gate * 100}% of your opponent's speed. Crawling perfectly does not win.`)}
      ${step(4, "Pin or outlast", `Pin their hand to the table, or be past the middle when the ${A.timer} s clock runs out. A dead even match plays ${A.suddenDeath} s of sudden death.`, "ult")}
    </div>`,
    });

    registry.add("key-help", {
      id: "arm",
      order: ORDER,
      rows: () => [
        [
          "Arm Wrestling",
          "Type the words like Monkeytype. Accuracy is 70% of your power, so a clean word beats a fast sloppy one.",
        ],
      ],
    });

    registry.add("profile-history", {
      id: "arm",
      mode: "arm",
      label: "Arm",
      order: ORDER,
      entries: () =>
        records.records().map((r) => ({
          at: r.at,
          mode: "arm",
          ranked: !!r.ranked,
          foe: r.foe,
          result: r.won ? "Win" : "Loss",
          win: r.won,
          wpm: r.wpm,
          acc: r.acc,
          rp: r.rpDelta,
        })),
    });

    registry.add("profile-tile", {
      id: "arm-wins",
      order: 40,
      tile: () => {
        const list = records.records();
        return {
          label: "Arm wins",
          value: list.filter((r) => r.won).length,
          sub: list.length ? `of ${list.length}` : "no matches yet",
        };
      },
    });

    return Object.freeze({ start, restart, stop });
  },
);
