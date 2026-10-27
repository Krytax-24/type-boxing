/**
 * Session: the run in progress and the questions every part of the game asks about it.
 *
 *   run: { mode, kind, rules, wins: [mine, theirs], round, ... }   null on the menus
 *     mode  the game mode that owns it ("duel", "race", "arm", "brawl")
 *     kind  what sort of run inside that mode ("bots", "endless", "practice", "ranked", "online", ...)
 *
 * It also owns the timer between two rounds, and answers "is a match on?" and "is it paused?" by asking the
 * registered modes, so it never names one.
 */
CounterType.define(
  "session",
  ["registry", "modals", "online-gateway", "settings", "match-rules", "router", "actions"],
  (registry, modals, net, settings, Modes, router, actions) => {
    "use strict";

    let run = null;
    let roundTimer = 0;

    /** The run in progress, or null. */
    function current() {
      return run;
    }

    /** Starts a new run (the mode that owns it fills it in). */
    function begin(newRun) {
      run = newRun;
      return run;
    }

    /** Forgets the run (back to the menus). */
    function end() {
      run = null;
    }

    // ---------- The pause between rounds ----------

    function cancelRoundTimer() {
      if (roundTimer) clearTimeout(roundTimer);
      roundTimer = 0;
    }

    /** Runs `next` after `ms`, replacing any pending round timer. */
    function scheduleRound(next, ms) {
      cancelRoundTimer();
      roundTimer = setTimeout(() => {
        roundTimer = 0;
        next();
      }, ms);
    }

    /** Adopts a timer started elsewhere (the online host schedules its own next round). */
    function adoptRoundTimer(timerId) {
      cancelRoundTimer();
      roundTimer = timerId || 0;
    }

    // ---------- Questions about the game ----------

    const modes = () => registry.list("mode");

    /** The mode that owns the view right now (its fight or its result screen), or null on the menus. */
    function activeMode() {
      return modes().find((mode) => mode.active) || null;
    }

    /** True while a fight, a race or a match is being played (not on its result screen). */
    function inMatch() {
      return modes().some((mode) => mode.inMatch && mode.inMatch());
    }

    /** True when a modal is open over an offline match: nothing steps while paused. Online matches never pause. */
    function paused() {
      return inMatch() && modals.count() > 0 && !net.isMatch();
    }

    /** The ranked ladders on show, [id, label]: those of the loaded modes that have one. */
    function rankedLadders() {
      return modes()
        .filter((mode) => mode.ranked)
        .map((mode) => [mode.id, mode.ranked.label]);
    }

    /** Stops every mode (back to the menus). */
    function stopModes() {
      for (const mode of modes()) mode.stop();
    }

    /** The match rules the player chose (rounds, timer, endless, word submit), cleaned. */
    function rulesNow() {
      const v = settings.values;
      return Modes.cleanRules({ rounds: v.mRounds, timer: v.mTimer, endless: v.mEndless, words: v.mWords });
    }

    /** Plays the same run again: Rematch, Restart and Tab all come here. Each mode decides what "again" means. */
    function restart() {
      const owner = run && registry.get("mode", run.mode);
      if (owner) owner.restart();
    }

    // The HUD shows only while something is being played, and only the HUD of the mode that plays.
    router.setModeSource(() => {
      const mode = activeMode();
      return mode ? mode.id : null;
    });

    actions.on("restart", () => restart());
    actions.on("rematch", () => {
      if (net.isMatch()) net.rematch();
      else restart();
    });

    return Object.freeze({
      current,
      begin,
      end,
      cancelRoundTimer,
      scheduleRound,
      adoptRoundTimer,
      activeMode,
      inMatch,
      paused,
      stopModes,
      rankedLadders,
      rulesNow,
      restart,
    });
  },
);
