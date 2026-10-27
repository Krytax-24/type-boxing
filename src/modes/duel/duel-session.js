/**
 * Duel session: the life of a Duel fight, from the countdown to the result.
 *
 * It owns the one Duel (the rules, duel.js) and everything around a fight that is not a rule: the bot, the stats
 * recorder, your typing view, the fixed 1/120 s step, the rounds of a match, the ranked submit and the moment the
 * result screen is due. The rules never read the keyboard or the clock; this module feeds them.
 *
 *   run (session.js): { mode: "duel", kind, rules, wins: [mine, theirs], round, over?, foe?, card? }
 *     kind: "bots" | "endless" | "practice" (offline), "ranked" (a simulated ranked duel), "online" (a private room)
 *
 * Events it sends: "duel:result" (the result screen is due), "duel:ranked" (the ranked update arrived).
 */
CounterType.define(
  "duel-session",
  [
    "config",
    "duel",
    "typing",
    "match-rules",
    "random",
    "characters",
    "fighter-stage",
    "player",
    "settings",
    "stats",
    "speed-history",
    "backend",
    "ranked",
    "session",
    "router",
    "modals",
    "online-gateway",
    "looks",
    "arena",
    "audio",
    "banner",
    "toast",
    "events",
    "duel-bots",
    "duel-practice",
    "duel-hud",
    "duel-stream-view",
  ],
  (
    CONFIG,
    Duel,
    typing,
    Modes,
    random,
    Chars,
    DuelChars,
    player,
    settings,
    Stats,
    speedHistory,
    Backend,
    Ranked,
    session,
    router,
    modals,
    net,
    looks,
    arena,
    Sfx,
    banner,
    toast,
    events,
    bots,
    practice,
    hud,
    streamView,
  ) => {
    "use strict";

    const { Bot } = typing;
    const MODE = CONFIG.modes;
    const CH = CONFIG.chars;

    const STEP = 1 / 120; // the fixed step of the rules
    const TRACE_EVERY = 0.5; // seconds of duel time between two samples of the speed graph
    const BOT_FIRST_KEY_AT = 0.6; // a human-like pause before the bot starts typing
    const KO_SHOW_AFTER = 0.6; // seconds a knocked out fighter lies down before the result
    const TIME_UP_SHOW_AFTER = 1.4; // seconds the TIME text plays before the result
    const MIN_SECONDS_FOR_HISTORY = 5; // shorter fights do not count for MATCH ME
    // A ranked stand-in types at your recent speed, doubled for every 450 points the opponent is rated above you.
    const RANKED_SPEED = { min: 15, max: 160, doubleEvery: 450 };
    const RANKED_RULES = { rounds: 1, timer: 120, endless: false, words: "mix" };

    const duel = new Duel();

    /** Everything about the fight on screen that is not a rule. */
    const fight = {
      bot: null, // the computer typist (a network peer takes its place online)
      botCfg: null, // the opponent of this fight: { name, beatAt, ... }
      record: null, // the stats recorder (stats.js): watches your typing, never changes it
      lastRecord: null, // the finished record shown on the result screen
      traceNext: 0, // next duel time to sample the speed graph
      matchSpace: true, // "Space ends a word" for this fight, fixed when it starts
      view: null, // your typing view (Classic view)
      shownResult: false, // the result of this round was handled
      resultShownAt: 0, // performance.now() when it was
      acc: 0, // time not yet stepped
    };

    let active = false; // the Duel owns the view (a fight, the pause between rounds or its result screen)
    let offlineKind = "bots"; // chosen on the Duel menu: bots | endless | practice
    let rankedResult = { out: null, err: false };

    // ---------- Looks (cosmetic only: no rule reads any of this) ----------

    /** The identity colors on the two fighters: your plate letters and sparks, the opponent's letters. */
    function paintFighters() {
      const [mine, theirs] = duel.fighters;
      mine.letterColor = CH.you.letters;
      mine.sparkColor = CH.you.body;
      theirs.letterColor = CH.foe.letters;
    }

    /** You on the left or the right of the arena: the fighters, the damage numbers, the rope and the HUD follow. */
    function seat(right) {
      duel.mirror = !!right;
      hud.seat(right);
    }

    events.on("looks:changed", paintFighters);
    settings.watch((v) => {
      duel.hitstopOn = !v.reduceMotion && v.hitstop; // visual only: hit-stop freezes poses, never rules
    });

    // ---------- Starting a fight ----------

    /**
     * Puts a new fight on screen: the duel, the HUD, the fighters, the bot and your typing view.
     *
     * @param {object} setup
     * @param {number} setup.seed Picks both word streams.
     * @param {string[]} [setup.weapons] [yours, theirs] (default Medium).
     * @param {object} setup.opts Duel options (timer, noDamage).
     * @param {boolean} setup.mirror You stand on the right.
     * @param {string[]} setup.fighters [yours, theirs] fighter keys.
     * @param {string} setup.foeName The opponent's name on their plate (text only).
     * @param {object} setup.botCfg The opponent's card ({ name, beatAt, wpm ... }).
     * @param {boolean} setup.withBot A bot types for the opponent (offline).
     * @param {boolean} setup.matchSpace Space ends a word in this fight.
     * @param {object|null} setup.record Stats recorder meta, or null when the fight is not recorded.
     * @param {boolean} [setup.swapStreams] Online guest: your stream is the second one.
     */
    function stageFight(setup) {
      modals.clear();
      banner.hide();
      fight.shownResult = false;
      seat(setup.mirror);
      duel.start(setup.seed, setup.weapons, setup.opts);
      if (setup.swapStreams) duel.streams = [duel.streams[1], duel.streams[0]];
      fight.matchSpace = setup.matchSpace;
      fight.record = setup.record ? new Stats.Recorder(setup.record) : null;
      hud.setFighter(0, setup.fighters[0], duel.typists[0].weapon);
      hud.setFighter(1, setup.fighters[1], duel.typists[1].weapon);
      hud.setName(0, "YOU");
      hud.setName(1, setup.foeName);
      fight.botCfg = setup.botCfg;
      looks.setFight(setup.fighters);
      fight.bot =
        setup.withBot && setup.botCfg.wpm
          ? new Bot(setup.botCfg, duel.streams[1], (evs, t) => duel.handleEvents(1, evs, t))
          : null; // a dummy at 0 wpm just stands there
      if (fight.bot) fight.bot.nextKeyAt = BOT_FIRST_KEY_AT;
      if (!fight.record) fight.lastRecord = null;
      fight.view = streamView.create(duel.streams[0]);
      fight.traceNext = 0;
      active = true;
      router.show(null);
    }

    /** One fight of an offline run: a round of a bots match, the next Endless round, the practice or a ranked duel. */
    function startRound() {
      const run = session.current();
      net.stop();
      let card = null;
      let slot = bots.picked();
      if (run.kind === "practice") {
        card = Modes.dummyCard(practice.current());
        slot = 0;
      } else if (run.kind === "ranked") {
        card = run.card;
      }
      const botCfg = card
        ? Object.assign(card.wpm ? Bot.cfgFor(card) : card, { beatAt: card.wpm })
        : bots.configFor(slot);
      const mine = player.fighter();
      const foeChar = run.kind === "ranked" ? DuelChars.botKey(run.card.char, mine) : bots.fighterFor(slot);
      const seed = random.newSeed();
      const values = settings.values;
      const matchSpace = !Modes.autoEnds(run.rules.words, values.wordSubmit); // a pause menu change counts next fight
      const recorded = !(run.kind === "practice" || (run.kind === "endless" && !values.eHurt));
      stageFight({
        seed,
        weapons: undefined,
        opts: Modes.duelOpts(run.kind, run.rules, practice.current(), values.eHurt),
        mirror: values.side === "right",
        fighters: [mine, foeChar],
        foeName: run.kind === "ranked" ? run.foe.name.toUpperCase() : botCfg.name,
        botCfg,
        withBot: true,
        matchSpace,
        record: recorded
          ? {
              mode: matchSpace ? "space" : "auto",
              seed,
              bot: botCfg.name,
              botIdx: slot,
              beatAt: botCfg.beatAt,
              char: mine,
              foeChar,
            }
          : null,
      });
    }

    /** A new offline run of one kind (the Duel menu's Fight, Rematch, Restart). */
    function startOffline(kind) {
      session.cancelRoundTimer();
      session.begin({
        mode: "duel",
        kind,
        rules: Object.assign(session.rulesNow(), { endless: false }),
        wins: [0, 0],
        round: 1,
      });
      startRound();
    }

    /**
     * A ranked duel from the queue. The opponent is a simulated player, played by a stand-in bot whose speed is your
     * recent speed scaled by the rating gap.
     *
     * @param {{opponents: object[]}} match The matchmaker's match.
     * @param {number} myMmr Your hidden rating when the match was found.
     */
    function startRanked(match, myMmr) {
      const foe = match.opponents[0];
      session.cancelRoundTimer();
      const gap = (foe.mmr - myMmr) / RANKED_SPEED.doubleEvery;
      const wpm = Math.max(RANKED_SPEED.min, Math.min(RANKED_SPEED.max, speedHistory.average() * Math.pow(2, gap)));
      const others = Chars.ORDER.filter((key) => key !== player.fighter());
      const card = {
        name: `${foe.name}#${foe.tag}`,
        style: "Ranked",
        wpm,
        accuracy: 0.95,
        recovery: [0.18, 0.15],
        drift: 0.15,
        char: others[Ranked.hashStr(foe.id) % others.length],
      };
      session.begin({
        mode: "duel",
        kind: "ranked",
        foe,
        card,
        rules: Modes.cleanRules(RANKED_RULES),
        wins: [0, 0],
        round: 1,
      });
      rankedResult = { out: null, err: false };
      startRound();
    }

    /** Leaves the fight (back to the menus). */
    function stop() {
      if (active) hud.clear();
      active = false;
      duel.phase = "menu";
      fight.bot = null;
    }

    // ---------- Every frame ----------

    function step(dt) {
      const frozen = session.paused();
      const remoteView = net.isGuestView();
      if (duel.phase !== "menu" && !frozen && !remoteView) {
        fight.acc += dt;
        while (fight.acc >= STEP) {
          if (fight.bot && duel.phase === "fight") fight.bot.update(duel.t);
          duel.update(STEP);
          fight.acc -= STEP;
          if (fight.record && duel.phase === "fight") {
            fight.record.step(duel, STEP);
            // Both typists twice a second, for the speed graph (stats only).
            if (duel.t >= fight.traceNext) {
              fight.record.sample(duel);
              fight.traceNext += TRACE_EVERY;
            }
          }
        }
        if (fight.view) fight.view.sync();
      } else {
        fight.acc = 0;
        if (remoteView && fight.view) {
          // An online guest only mirrors the host: between snapshots the picture keeps moving on its own.
          if (!frozen) duel.advanceRemote(dt);
          fight.view.sync();
        }
      }
      return frozen;
    }

    /** The round is decided once the K.O. (or TIME) has played out, or when the online host says so. */
    function checkRoundOver() {
      const waiting = net.state.waitingResult;
      const koDone = duel.fighters.some((f) => f.dead && f.state === "down" && f.stateT > KO_SHOW_AFTER);
      const timeDone = duel.result && duel.result.byTime && duel.overT > TIME_UP_SHOW_AFTER;
      if (duel.phase === "over" && !fight.shownResult && (waiting || koDone || timeDone)) {
        fight.shownResult = true;
        fight.resultShownAt = performance.now();
        roundOver();
      }
      if (duel.phase !== "over") fight.shownResult = false;
    }

    /** The Duel's frame: steps the rules at a fixed rate, then draws the arena and the HUD. */
    function frame(dt) {
      const frozen = step(dt);
      checkRoundOver();
      arena.renderer.draw(duel, frozen ? 0 : dt);
      hud.update(duel, session.current(), dt);
    }

    // ---------- Rounds and the result ----------

    function saveRecord(run) {
      fight.record.sample(duel);
      fight.lastRecord = fight.record.finish(duel);
      if (run && run.kind === "ranked") fight.lastRecord.ranked = true;
      if (!Stats.add(fight.lastRecord)) {
        toast.show("This match could not be saved to your stats: the browser's storage is full or blocked.");
      }
      // Your speed in this match, for MATCH ME.
      const st = duel.typists[0].stats;
      const keys = st.correct + st.wrong;
      if (keys > 0 && duel.t > MIN_SECONDS_FOR_HISTORY && st.lastKeyAt > st.firstKeyAt) {
        speedHistory.remember(st.correct / 5 / ((st.lastKeyAt - st.firstKeyAt) / 60));
      }
    }

    function nextRoundBanner(title, sub, youWon) {
      banner.show(title, sub);
      Sfx.play(youWon ? "win" : "lose");
    }

    /** The round (or the whole match) is decided: count it, then the next round or the result screen. */
    function roundOver() {
      const run = session.current();
      const winner = duel.result.winner; // 0 = you
      if (fight.record) saveRecord(run);
      if (!run) {
        showResult();
        return;
      }
      if (run.kind === "ranked") {
        run.over = true;
        submitRanked(run);
        showResult();
        return;
      }
      if (run.kind === "endless") {
        run.wins[winner]++;
        run.round++;
        const title = winner === 0 ? "YOU WIN THE ROUND" : "YOU LOSE THE ROUND";
        nextRoundBanner(title, `${run.wins[0]} - ${run.wins[1]}, next round starting`, winner === 0);
        session.scheduleRound(startRound, MODE.roundGap * 1000);
        return;
      }
      if (run.kind === "practice") {
        run.over = true;
        showResult();
        return;
      }
      run.wins[winner]++;
      run.round++;
      const status = Modes.status(run.rules, run.wins);
      run.over = status.over;
      if (status.over) {
        showResult();
        return;
      }
      const title = `ROUND ${run.round - 1} ${winner === 0 ? "WON" : "LOST"}`;
      nextRoundBanner(title, `${run.wins[0]} - ${run.wins[1]}`, winner === 0);
      // Online, only the host starts the next round (with a new start message); offline a timer does.
      if (run.kind === "online") session.adoptRoundTimer(net.nextRound(MODE.roundGap * 1000));
      else session.scheduleRound(startRound, MODE.roundGap * 1000);
    }

    function showResult() {
      banner.hide();
      net.onResult();
      events.emit("duel:result");
    }

    function submitRanked(run) {
      const won = duel.result.winner === 0;
      const foe = run.foe;
      const you = duel.typists[0];
      const opponent = { id: foe.id, name: foe.name, tag: foe.tag, mu: foe.mu, sigma: foe.sigma, place: won ? 2 : 1 };
      Backend.submitRanked("duel", won ? 1 : 2, [opponent], { wpm: averageWpm(you), acc: accuracyText(you) })
        .then((out) => {
          rankedResult.out = out;
          events.emit("duel:ranked");
        })
        .catch(() => {
          rankedResult.err = true;
          events.emit("duel:ranked");
        });
    }

    // ---------- Typing ----------

    /**
     * One key for one side's stream: a letter, "Backspace", "Submit" (Space) or "AutoSubmit" (a word that ended by
     * itself). Returns the stream's events, which the caller hands to the duel.
     */
    function applyKey(side, key) {
      const stream = duel.streams && duel.streams[side];
      if (!stream) return [];
      if (key === "Backspace") {
        stream.backspace();
        return [];
      }
      if (key === "Submit") return stream.submit(true);
      if (key === "AutoSubmit") return stream.submit(false);
      if (key && key.length === 1) return stream.press(key);
      return [];
    }

    // ---------- Numbers for the result screen ----------

    /** Average wpm over the time the typist was typing (correct keys only). */
    function averageWpm(typist) {
      const s = typist.stats;
      const secs = Math.max(s.lastKeyAt - (s.firstKeyAt || 0), 1);
      return Math.round(s.correct / 5 / (secs / 60));
    }

    /** Keystroke accuracy as shown ("96%", or "-" before the first key). */
    function accuracyText(typist) {
      const s = typist.stats;
      const keys = s.correct + s.wrong;
      return keys ? Math.round((s.correct / keys) * 100) + "%" : "-";
    }

    return Object.freeze({
      duel,
      STEP,
      // state
      isActive: () => active,
      inMatch: () => active && (duel.phase === "countdown" || duel.phase === "fight"),
      koPlaying: () => active && duel.phase === "over" && !fight.shownResult,
      offlineKind: () => offlineKind,
      setOfflineKind: (kind) => {
        offlineKind = kind;
      },
      foeName: () => (fight.botCfg ? fight.botCfg.name : ""),
      botConfig: () => fight.botCfg,
      recorder: () => fight.record,
      lastRecord: () => fight.lastRecord,
      resultShownAt: () => fight.resultShownAt,
      matchSpace: () => fight.matchSpace,
      typingView: () => fight.view,
      rankedResult: () => rankedResult,
      // lifecycle
      stageFight,
      startRound,
      startOffline,
      startRanked,
      stop,
      frame,
      // typing and numbers
      applyKey,
      averageWpm,
      accuracyText,
    });
  },
);
