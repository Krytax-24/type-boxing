/**
 * Backspace Brawl mode: plugs the no-typing fighting sandbox into the game. Fight a bot or a friend online with
 * keys, a controller or touch; the only mode a phone plays.
 *
 * This module runs a fight (rounds, the host and guest loops, the result) and registers the mode with its
 * contributions to the shared pages. The rules are brawl-rules.js (60 Hz frames, pure), the devices
 * brawl-input.js, the picture brawl-fx.js; the network goes through the online gateway only. Remove the Brawl
 * scripts and the game plays on without it.
 */
CounterType.define(
  "brawl-mode",
  [
    "brawl-config",
    "brawl-rules",
    "brawl-input",
    "brawl-fx",
    "brawl-hud",
    "brawl-menu",
    "brawl-result-page",
    "brawl-touch",
    "brawl-custom",
    "match-rules",
    "characters",
    "fighter-stage",
    "player",
    "registry",
    "router",
    "session",
    "modals",
    "actions",
    "online-gateway",
    "settings",
    "arena",
    "looks",
    "banner",
    "random",
    "audio",
  ],
  (
    CONFIG,
    Brawl,
    BrawlInput,
    brawlFx,
    hud,
    brawlMenu,
    resultPage,
    _touch,
    _custom,
    Modes,
    Chars,
    DuelChars,
    player,
    registry,
    router,
    session,
    modals,
    actions,
    net,
    settings,
    arena,
    looks,
    banner,
    random,
    Sfx,
  ) => {
    "use strict";

    const B = CONFIG.brawl;
    const MODE = CONFIG.modes;
    const CH = CONFIG.chars;
    const STEP = B.step;
    const ORDER = 50;
    const MAX_STEPS_PER_FRAME = 4;
    const GUEST_AHEAD_MAX = 8; // frames the guest plays the last snapshot forward
    const GUEST_RESEND_MS = 250; // the guest resends its buttons this often even when they did not change
    const REMOTE_MASK = 8191;

    const G = {
      active: false,
      mode: "bot", // "bot" | "online"
      s: null, // the fight (brawl-rules.js)
      ai: null,
      acc: 0,
      side: 0, // the seat of the human on this screen (online guest = 1)
      chars: ["cyborg", "ronin"],
      names: ["YOU", "BOT"],
      botIdx: B.defaultBot,
      seed: 0,
      remoteMask: 0,
      lastSent: -1,
      sentAt: 0,
      guestSeq: 0,
      snapN: 0,
      snapEv: [],
      base: null, // guest: the host's last snapshot
      snapAt: 0,
      resultShown: false,
      over: false,
      handled: false,
      matchWinner: 0,
    };

    const safeChar = (fighterKey) => (Chars.DEFS[fighterKey] ? fighterKey : Chars.ORDER[0]);
    const isGuest = () => G.mode === "online" && net.state.role === "guest";
    const colors = () => (G.side === 0 ? [CH.you.body, CH.foe.body] : [CH.foe.body, CH.you.body]);

    // ---------- Start, stop, rounds ----------

    /**
     * Starts a fight on this screen.
     *
     * @param {object} opts
     * @param {"bot"|"online"} opts.mode
     * @param {number} [opts.bot] The bot's index (vs bot).
     * @param {number} [opts.side] The seat of the human: 0 left, 1 right (online: 0 host, 1 guest).
     * @param {string[]} [opts.names] [left, right].
     * @param {number} opts.seed
     * @param {string[]} opts.chars [left fighter, right fighter].
     */
    function begin(opts) {
      G.mode = opts.mode;
      G.side = opts.side || 0;
      G.botIdx = opts.bot !== undefined ? opts.bot : G.botIdx;
      const botName = B.bots[G.botIdx].name;
      G.names = opts.names || (G.mode === "bot" ? (G.side ? [botName, "YOU"] : ["YOU", botName]) : ["YOU", "OPPONENT"]);
      G.seed = opts.seed >>> 0;
      G.chars = (opts.chars || ["cyborg", "ronin"]).map(safeChar);
      G.active = true;
      hud.build(G.side);
      BrawlInput.setHand(settings.values.hand);
      BrawlInput.showTouch(BrawlInput.isTouchDevice());
      BrawlInput.setLayout(settings.values.hand);
      BrawlInput.clear();
      BrawlInput.setPause(() => {
        if (!modals.count()) actions.run("pause");
      });
      newRound(G.seed);
      router.show(null);
    }

    function newRound(seed) {
      const run = session.current();
      G.s = Brawl.create(seed, { timer: run.rules.timer, chars: G.chars });
      G.ai = G.mode === "bot" ? Brawl.newAi(B.bots[G.botIdx]) : null;
      G.acc = 0;
      G.base = null;
      G.snapEv = [];
      G.snapN = 0;
      G.remoteMask = 0;
      G.lastSent = -1;
      G.resultShown = false;
      G.over = false;
      G.handled = false;
      session.cancelRoundTimer();
      banner.hide();
      hud.reset();
      looks.hideFighters(); // the puppets draw the fighters, not the duel's renderer
      brawlFx.reset();
      brawlFx.setup(G.chars, colors(), () => G.s);
    }

    function stop() {
      if (!G.active) return;
      G.active = false;
      BrawlInput.showTouch(false);
      BrawlInput.setPause(null);
      session.cancelRoundTimer();
      banner.hide();
      hud.clear();
      looks.apply();
    }

    /** A fight against a bot from the menu (also Again). */
    function start() {
      session.cancelRoundTimer();
      net.stop();
      session.begin({
        mode: "brawl",
        kind: "bot",
        rules: Object.assign(session.rulesNow(), { endless: false }),
        wins: [0, 0],
        round: 1,
      });
      modals.clear();
      const bot = brawlMenu.bot();
      const mine = player.fighter();
      const foe = DuelChars.botKey(B.bots[bot].char, mine);
      const side = settings.values.side === "right" ? 1 : 0; // which side of the screen you start on (like P1 or P2)
      begin({ mode: "bot", bot, side, seed: random.newSeed(), chars: side ? [foe, mine] : [mine, foe] });
    }

    const seatWon = (winner) => winner === G.side;

    function roundOver() {
      const run = session.current();
      const winner = G.s.winner;
      run.wins[winner]++;
      run.round++;
      const status = Modes.status(run.rules, run.wins);
      run.over = status.over;
      if (!status.over) {
        const mine = seatWon(winner);
        banner.show(mine ? "YOU WIN THE ROUND" : "YOU LOSE THE ROUND", `${run.wins[0]} - ${run.wins[1]}`);
        Sfx.play(mine ? "win" : "lose");
        if (G.mode === "online") session.adoptRoundTimer(net.nextRound(MODE.roundGap * 1000));
        else session.scheduleRound(() => newRound(random.newSeed()), MODE.roundGap * 1000);
        return;
      }
      if (G.mode === "online" && net.state.role === "host") {
        net.send("result", winner, G.s.fr / 60, { wins: run.wins.slice(), game: "brawl" });
      }
      showResult();
    }

    function showResult() {
      const run = session.current();
      banner.hide();
      G.resultShown = true;
      const winner = run.rules.rounds > 1 || run.over ? Modes.status(run.rules, run.wins).winner : G.s.winner;
      G.matchWinner = winner === null || winner === undefined ? G.s.winner : winner;
      net.onResult();
      resultPage.show(resultData());
    }

    function resultData() {
      const run = session.current();
      const winner = G.matchWinner;
      const mine = seatWon(winner);
      const how = G.s.byTime ? "Time up" : "K.O.";
      const online = G.mode === "online";
      const sub =
        (run.rules.rounds > 1
          ? `${run.wins[0]} - ${run.wins[1]} over ${run.round - 1} rounds`
          : `${how} after ${(G.s.fr / 60).toFixed(1)} s`) + (online ? ", unranked online" : "");
      return {
        title: mine ? "YOU WIN" : "YOU LOSE",
        win: mine,
        sub,
        names: G.names,
        mySeat: G.side,
        stats: [0, 1].map((i) => ({
          hp: Math.ceil(G.s.f[i].hp),
          dealt: G.s.dealt[i],
          meter: Math.round(G.s.f[i].meter),
        })),
        online,
        localRematch: net.state.localRematch,
        remoteRematch: net.state.remoteRematch,
      };
    }

    // ---------- Every frame ----------

    function stepFight() {
      const s = G.s;
      const mine = BrawlInput.mask();
      let left = mine;
      let right;
      if (G.mode === "bot") {
        // You sit on the left or the right (Settings > Starting side)
        const botInput = Brawl.botInput(s, 1 - G.side, G.ai);
        if (G.side) {
          left = botInput;
          right = mine;
        } else right = botInput;
      } else right = G.remoteMask;
      Brawl.step(s, left, right);
      const evs = Brawl.drain(s);
      brawlFx.drive(s);
      evs.forEach(brawlFx.onEvent);
      if (G.mode === "online") {
        // The host sends a snapshot every second frame (and at the end), with the events since the last one.
        G.snapEv.push(...evs);
        if (++G.snapN % 2 === 0 || s.phase === "over") {
          net.send("state", G.snapN, Brawl.snapshot(s, G.snapEv), net.state.mid);
          G.snapEv = [];
        }
      }
    }

    // A bot fight, or the online host: the rules run here.
    function frameHost(dt) {
      G.acc += dt;
      let steps = 0;
      while (G.acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
        G.acc -= STEP;
        steps++;
        if (brawlFx.fx.hitstop > 0 && G.s.phase === "fight") {
          brawlFx.fx.hitstop--;
          continue;
        }
        stepFight();
      }
      if (G.acc > STEP * MAX_STEPS_PER_FRAME) G.acc = 0;
      if (G.s.phase === "over") G.over = true;
      if (G.over && !G.handled && G.s.overFr >= B.overFrames) {
        G.handled = true;
        roundOver();
      }
    }

    // The online guest never judges: it draws the host's last snapshot, played forward a few frames so motion stays
    // smooth, and sends its own buttons to the host.
    function frameGuest() {
      const mask = BrawlInput.mask();
      const now = performance.now();
      if (mask !== G.lastSent || now - G.sentAt > GUEST_RESEND_MS) {
        G.lastSent = mask;
        G.sentAt = now;
        G.guestSeq++;
        net.send("bin", G.guestSeq, mask);
      }
      if (!G.base) return;
      const ahead = Math.max(0, Math.min(GUEST_AHEAD_MAX, Math.floor((now - G.snapAt) / (STEP * 1000))));
      const copy = Brawl.clone(G.base);
      for (let i = 0; i < ahead; i++) {
        if (copy.phase === "over") break;
        Brawl.step(copy, copy.in[0], copy.phase === "fight" ? mask : 0);
      }
      copy.ev = [];
      G.s = copy;
      brawlFx.drive(copy);
      if (G.s.phase === "over" && !G.over) G.over = true;
      if (G.over && !G.resultShown && !G.handled && G.s.overFr >= B.overFrames) {
        // The host decides what comes next: a new round arrives as a start message, the end as a result message.
        G.handled = true;
        const mine = G.s.winner === G.side;
        banner.show(mine ? "YOU WIN THE ROUND" : "YOU LOSE THE ROUND", "next round starting");
        Sfx.play(mine ? "win" : "lose");
      }
    }

    function frame(dt) {
      if (!G.s) return;
      const frozen = session.paused();
      if (!frozen) {
        if (isGuest()) frameGuest();
        else if (!G.resultShown) frameHost(dt);
      }
      brawlFx.draw(arena.renderer, G.s, colors(), dt, frozen);
      hud.update(G.s, { names: G.names, chars: G.chars, run: session.current() }, frozen ? 0 : dt);
    }

    // A Brawl fight reads its buttons through brawl-input.js; the keyboard event only pauses and keeps the page still.
    function key(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        actions.run("pause");
      } else if (BrawlInput.isGameKey(e.code) || e.key === " ") e.preventDefault();
    }

    // ---------- Online (the net module calls these through the mode's `net` hook) ----------

    /** An online fight (or its next round). Wins stay in seat order, [host, guest], on both screens. */
    function beginOnline(m) {
      session.cancelRoundTimer();
      banner.hide();
      session.begin({ mode: "brawl", kind: "online", game: "brawl", rules: m.rules, wins: m.wins, round: m.round });
      modals.clear();
      const side = m.role === "guest" ? 1 : 0;
      begin({
        mode: "online",
        side,
        seed: m.seed,
        chars: m.fighters,
        names: side === 0 ? ["YOU", "OPPONENT"] : ["OPPONENT", "YOU"],
      });
    }

    function onSnapshot(msg) {
      if (!G.active || G.mode !== "online" || !isGuest() || msg.mid !== net.state.mid) return;
      if (!G.base) G.base = Brawl.create(1, { chars: G.chars });
      Brawl.applySnapshot(G.base, msg.s);
      G.snapAt = performance.now();
      Brawl.eventsOf(msg.s).forEach(brawlFx.onEvent);
    }

    function onInput(msg) {
      if (G.active && G.mode === "online" && net.state.role === "host") G.remoteMask = msg.m & REMOTE_MASK;
    }

    // The host says the match is over (wins in seat order).
    function onResult(msg) {
      if (!G.active || !isGuest()) return;
      const run = session.current();
      if (msg.stats && Array.isArray(msg.stats.wins)) {
        run.wins = msg.stats.wins.slice();
        run.round = run.wins[0] + run.wins[1] + 1;
      }
      G.matchWinner = msg.winner;
      G.s = G.s || Brawl.create(1, { chars: G.chars });
      G.resultShown = true;
      banner.hide();
      net.onResult();
      resultPage.show(resultData());
    }

    // ---------- The mode ----------

    registry.add("mode", {
      id: "brawl",
      label: "Backspace Brawl",
      order: ORDER,
      sub: "sandbox: fight with keys, no typing",
      homeKey: "b",
      phone: true,
      typing: false,
      pitch: "<b>Backspace Brawl</b> is a sandbox for the fighters, played with keys, a controller or touch.",
      legend:
        "Vs a bot or online. Four attack buttons, a projectile, a rising move and a super, plus finisher strings that are different for every fighter.",
      get active() {
        return G.active;
      },
      inMatch: () => G.active && !!G.s && !G.resultShown && (G.s.phase === "countdown" || G.s.phase === "fight"),
      menu: (parts) => brawlMenu.draw(parts),
      menuKey: (e, k) => brawlMenu.menuKey(e, k),
      start,
      restart: start,
      stop,
      frame,
      key,
      renderResult: () => {
        if (G.s) resultPage.render(resultData());
      },
      net: {
        game: "brawl",
        label: "Backspace Brawl",
        begin: beginOnline,
        onSnapshot,
        onInput,
        onResult,
        get active() {
          return G.active;
        },
      },
    });

    actions.on("brawl-start", (x, y, top) => {
      if (top || router.current() !== "title") return false;
      start();
      return true;
    });
    actions.on("brawl-bot", (index, y, top) => {
      if (top || router.current() !== "title") return false;
      brawlMenu.pickBot(Number(index));
      router.refresh();
      return true;
    });
    actions.on("brawl-online", (x, y, top) => {
      if (top || router.current() !== "title") return false;
      settings.set("mGame", "brawl");
      net.open();
      return true;
    });

    // The playing hand picks the key map and mirrors the touch controls.
    settings.watch((v) => {
      BrawlInput.setHand(v.hand);
      BrawlInput.setLayout(v.hand);
    });

    // ---------- How to play and Keys ----------

    registry.add("howto-section", {
      id: "brawl",
      order: ORDER,
      html: (step) => `<h3 class="sec">Backspace Brawl</h3>
    <div class="steps">
      ${step(1, "Four attack buttons", "High punch, low punch, high kick and low kick, plus a projectile and a rising move on their own buttons. Crouch to go low, jump to hit from the air.")}
      ${step(2, "Chain and finish", "Attacks chain while a hit is landing. Every fighter also has three finisher strings of three buttons: land a hit, then press one in order. The Backspace Brawl menu lists yours.")}
      ${step(3, "Specials", `The projectile and the rising move together make the super (${B.superCost}% meter). The old motions still work: down, down forward, forward plus a punch throws the projectile. Low punch and low kick together throw an opponent who is blocking.`)}
      ${step(4, "Dash and block", "Tap forward or back twice to dash. Hold back to block, and add down to block low attacks. On a phone or a controller, the pad has buttons for the motions.", "ult")}
    </div>`,
    });

    registry.add("key-help", {
      id: "brawl",
      order: ORDER,
      rows: () => {
        const L = BrawlInput.labels();
        return [
          ["Backspace Brawl move", L.move + ", up to jump, down to crouch, hold back to block."],
          ["Backspace Brawl attacks", `High: ${L.high}. Low: ${L.low}.`],
          ["Backspace Brawl specials", L.specials + "."],
          [
            "Backspace Brawl finishers",
            "Land a hit, then press the buttons of your fighter's string in order. Each fighter has three, listed in the Backspace Brawl menu.",
          ],
        ];
      },
    });

    return Object.freeze({ start, stop });
  },
);
