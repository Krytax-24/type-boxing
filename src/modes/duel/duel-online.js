/**
 * Duel online: what the online layer (src/net) may do with a Duel, and nothing more.
 *
 * The online module never touches the duel itself. It starts an online round here, and the host asks for
 * snapshots and feeds in the guest's keys; the guest feeds in the host's snapshots and the result. The host judges
 * everything; the guest mirrors it (see the lag design in ARCHITECTURE.md). The Duel mode hands this object to the
 * registry as its `net` hook (game "typing").
 */
CounterType.define(
  "duel-online",
  ["config", "match-rules", "settings", "session", "duel-session"],
  (CONFIG, Modes, settings, session, duelSession) => {
    "use strict";

    const duel = duelSession.duel;
    const ONLINE_WEAPONS = ["medium", "medium"]; // online fights use the Bo staff on both sides (both peers agree)

    /**
     * Starts an online round on this screen.
     *
     * @param {object} m
     * @param {"host"|"guest"} m.role
     * @param {number} m.seed The host's seed (both peers start the same duel).
     * @param {string[]} m.fighters [yours, theirs] on this screen.
     * @param {string} m.foeName The other player's name.
     * @param {object} m.rules Cleaned match rules (the host's).
     * @param {number} m.round
     * @param {number[]} m.wins [yours, theirs].
     */
    function begin(m) {
      session.cancelRoundTimer();
      session.begin({ mode: "duel", kind: "online", rules: m.rules, wins: m.wins, round: m.round });
      duelSession.stageFight({
        seed: m.seed,
        weapons: ONLINE_WEAPONS,
        opts: Modes.duelOpts("online", m.rules),
        mirror: false, // online, each screen shows its own player on the left
        fighters: m.fighters,
        foeName: m.foeName,
        botCfg: { name: m.foeName, beatAt: 0 },
        withBot: false,
        matchSpace: !Modes.autoEnds(m.rules.words, settings.values.wordSubmit),
        record: null, // online matches are not saved to My stats
        swapStreams: m.role === "guest",
      });
    }

    // ---------- Host ----------

    /**
     * The guest's keys, applied to the second stream. A guest may only end a word by itself when the room allows
     * it.
     */
    function remoteKeys(keyEvents) {
      const run = session.current();
      for (const ev of keyEvents) {
        if (ev.k === "AutoSubmit" && (!run || run.rules.words === "on" || !duel.streams[1].autoEnds())) continue;
        const evs = duelSession.applyKey(1, ev.k);
        if (evs.length) duel.handleEvents(1, evs, duel.t);
      }
    }

    /** One sample of the online speed chart: [your wpm, theirs, your HP, theirs]. */
    function sample() {
      return [duel.wpmNow[0], duel.wpmNow[1], duel.typists[0].hp, duel.typists[1].hp];
    }

    // ---------- Guest ----------

    /** The host's view of the duel. */
    function applySnapshot(snapshot) {
      duel.applySnapshot(snapshot, true);
    }

    /** The host's verdict (its winner index is in the host's seat order). */
    function remoteResult(hostWinner) {
      duel.result = { winner: 1 - hostWinner };
      duel.phase = "over";
      return duel.result;
    }

    return Object.freeze({
      game: "typing",
      begin,
      remoteKeys,
      sample,
      applySnapshot,
      remoteResult,
      phase: () => duel.phase,
      clock: () => duel.t,
      snapshot: (full) => duel.snapshot(full),
      result: () => duel.result,
      stats: () => duel.typists.map((t) => t.stats),
      /** True while the round is over but its result is not handled yet (the K.O. still plays). */
      resultPending: () => duelSession.koPlaying(),
    });
  },
);
