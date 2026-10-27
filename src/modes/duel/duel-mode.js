/**
 * Duel mode: plugs the Duel into the game. The main typing fight: your typing speed does the hitting.
 *
 * Registers the mode (the home menu button, the title view, the fight, ranked and online play) and its
 * contributions to the shared pages: How to play, the Profile history and tiles, the Keys tab and the Fighter
 * screen. Everything else lives in the duel-* modules this one assembles. Remove the Duel's scripts and the game
 * plays on without it: no screen names the Duel.
 */
CounterType.define(
  "duel-mode",
  [
    "config",
    "registry",
    "router",
    "session",
    "actions",
    "events",
    "settings",
    "looks",
    "online-gateway",
    "home-page",
    "typing",
    "stats",
    "buttons",
    "dom",
    "duel-session",
    "duel-input",
    "duel-menu",
    "duel-result-page", // required: the Duel never runs without its result screen
    "duel-online",
    "duel-bots",
    "duel-practice",
  ],
  (
    CONFIG,
    registry,
    router,
    session,
    actions,
    events,
    settings,
    looks,
    net,
    home,
    typing,
    Stats,
    buttons,
    dom,
    duelSession,
    duelInput,
    duelMenu,
    _resultPage,
    duelOnline,
    bots,
    practice,
  ) => {
    "use strict";

    const ORDER = 10; // first on the home menu and in every list of modes
    const OFFLINE_KINDS = ["bots", "endless", "practice"];

    /** Plays the same run again (Rematch, Restart). A ranked duel is never replayed: you queue again. */
    function restart() {
      const run = session.current();
      if (run && run.kind === "ranked") {
        home.goMenu();
        actions.run("ranked:duel");
        return;
      }
      duelSession.startOffline(run && OFFLINE_KINDS.includes(run.kind) ? run.kind : duelSession.offlineKind());
    }

    registry.add("mode", {
      id: "duel",
      label: "Duel",
      order: ORDER,
      primary: true,
      homeKey: "o",
      sub: () => (net.offline ? "bots or ranked" : "bots, ranked or a friend"),
      typing: true,
      pitch: "In a <b>Duel</b> your typing speed does the hitting.",
      legend:
        "<b>Bots</b>: a match against one bot. <b>Endless</b>: one bot, no timer, a running score. <b>Practice</b>: a dummy you set up. <b>Ranked</b>: rated one-round duels. <b>Online room</b>: a private match with a friend.",
      ranked: { label: "Duel" },
      get active() {
        return duelSession.isActive();
      },
      inMatch: () => duelSession.inMatch(),
      menu: (parts) => duelMenu.draw(parts),
      menuKey: (e, key) => duelMenu.menuKey(e, key),
      homeChips: () => [buttons.keyChip("view", "words: " + settings.viewName())],
      opt: (key, value) => practice.set(key, value),
      start: () => duelSession.startOffline(duelSession.offlineKind()),
      practice: () => {
        bots.pickMatchMe();
        duelSession.startOffline("bots");
      },
      restart,
      startRanked: (match, myMmr) => duelSession.startRanked(match, myMmr),
      stop: () => duelSession.stop(),
      frame: (dt) => duelSession.frame(dt),
      key: (e) => duelInput.key(e),
      wordDelete: false,
      net: duelOnline,
    });

    // ---------- Actions ----------

    actions.on("duel-start", (x, y, top) => {
      if (top || router.current() !== "title") return false;
      duelSession.startOffline(duelSession.offlineKind());
      return true;
    });
    actions.on("duel-kind", (kind, y, top) => {
      if (top || router.current() !== "title" || !OFFLINE_KINDS.includes(kind)) return false;
      duelSession.setOfflineKind(kind);
      router.refresh();
      return true;
    });
    actions.on("duel-bot", (index) => {
      bots.pick(Number(index));
      router.refresh();
    });
    actions.on("duel-next-bot", () => {
      bots.pickNext();
      router.refresh();
    });
    // F2 on the menus: the word view (Over-head plates or the Classic typing box).
    actions.on("view", () => {
      settings.toggleView();
      router.refresh();
    });
    // Clicks wait while a K.O. plays out.
    actions.addGuard(() => duelSession.koPlaying());

    // ---------- The word view and the menu opponent (cosmetic) ----------

    function syncView() {
      dom.byId("ui").classList.toggle("classic", settings.getView() === "classic");
      const view = duelSession.typingView();
      if (view) view.update();
    }
    events.on("view:changed", syncView);
    syncView();

    // The menus spar against the picked bot's fighter.
    const showMenuOpponent = () => looks.setMenuOpponent(bots.fighterFor(bots.picked()));
    events.on("duel:bot-picked", showMenuOpponent);
    events.on("player:changed", showMenuOpponent);
    showMenuOpponent();

    // ---------- How to play ----------

    registry.add("howto-section", {
      id: "duel",
      order: ORDER,
      html: (step) => {
        const D = CONFIG.duel;
        const U = D.ultimate;
        const w = typing.weaponFor("medium");
        return `<h3 class="sec">Typing fights</h3>
    <div class="steps">
      ${step(1, "Type your word", "The word above your fighter is yours. Type it, then press Space. Fix a letter with Backspace. With Word submit off, a word ends by itself when it is exactly right.")}
      ${step(2, "Be faster", "Your power is your speed in words per minute. Whoever types faster hits for the difference. Typing also heals you a little.")}
      ${step(3, "Stay clean", "Every clean word builds your combo and adds a little power. A mistake halves the combo, and a big drop gives your opponent a counter.")}
      ${step(4, "Land the ultimate", "Fast typing fills the gold bar. At 100% with a big combo, a gold word appears. Type it exactly for a heavy hit and a stun.", "ult")}
    </div>
    <p class="fine">Numbers: +${D.comboStep * 100}% power per clean word, combo level every ${w.wordsPerCombo} words, healing ${D.healPerWpm} HP a second per wpm, counter ${D.counter.damagePerWord} HP per lost combo word (up to ${D.counter.maxDamage}), ultimate ${U.damage} damage and a ${U.stun} second stun (${U.sloppyDamage} if sloppy), needs a combo of ${w.comboRequired * w.wordsPerCombo}.</p>`;
      },
    });
    registry.add("howto-section", {
      id: "duel-screen",
      order: 70, // after the list of modes
      html: () => {
        const row = (term, text) => `<dt>${term}</dt><dd>${text}</dd>`;
        return `<h3 class="sec">Reading the screen</h3>
    <dl class="legend">
      ${row("HP bars", "Top corners. Yours is on the left, theirs on the right.")}
      ${row("EDGE", "Who is winning the typing exchange right now, in HP per second.")}
      ${row("WPM and POWER", "Your speed, and your speed plus combo and counter bonuses.")}
      ${row("Keys", "The pause button is top right in a fight.")}
    </dl>`;
      },
    });

    // ---------- Keys tab ----------

    registry.add("key-help", {
      id: "duel",
      order: ORDER,
      rows: () => [
        [
          "Typing fight",
          settings.values.wordSubmit
            ? "Letters type, Space or Enter ends a word, Backspace fixes a letter."
            : "Letters type, a word ends when it is exactly right (or press Space), Backspace fixes a letter.",
        ],
      ],
    });

    // ---------- Profile ----------

    registry.add("profile-history", {
      id: "duel",
      mode: "duel",
      label: "Duel",
      order: ORDER,
      entries: () =>
        Stats.all().map((m) => ({
          at: new Date(m.at).getTime(),
          mode: "duel",
          ranked: !!m.ranked,
          foe: m.bot,
          result: m.won ? "Win" : "Loss",
          win: m.won,
          wpm: m.wpm,
          acc: m.acc,
          rp: m.rpDelta,
        })),
    });
    registry.add("profile-tile", {
      id: "duel-wpm",
      order: 20,
      tile: () => {
        const list = Stats.all();
        const o = Stats.overview(list);
        return {
          label: "Duel WPM",
          value: list.length ? Math.round(o.avgWpm) : "-",
          sub: list.length ? `best ${o.bestWpm}` : "no duels yet",
        };
      },
    });
    registry.add("profile-tile", {
      id: "duel-wins",
      order: 60,
      tile: () => {
        const list = Stats.all();
        const o = Stats.overview(list);
        return {
          label: "Duel win rate",
          value: list.length ? o.winRate + "%" : "-",
          sub: list.length ? `${o.wins} of ${o.played}` : "",
        };
      },
    });

    // ---------- Fighter screen ----------

    // A bot whose own fighter is yours plays as someone else; the Fighter screen says so.
    registry.add("fighter-note", {
      id: "duel-bots",
      order: ORDER,
      note: (key) => {
        const names = bots.BOTS.filter((card) => card.char === key).map((card) => card.name);
        return names.length ? `${names.join(", ")} will fight as someone else, since this is their fighter.` : "";
      },
    });

    // Your fighter changed: the online room learns it next time.
    events.on("player:changed", () => net.refreshProfile());

    return Object.freeze({ restart });
  },
);
