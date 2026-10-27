/**
 * Online gateway: the one door between the game and the online layer (src/net).
 *
 * The online module (src/net) installs itself here when it starts. Until it does, or when it is not part of the
 * build, the gateway answers with an offline stand-in that has the same methods, so no screen ever has to check
 * whether multiplayer exists: it is simply never "in a match" and never "available".
 *
 * The methods below are the whole contract between the game and the online layer.
 */
CounterType.define("online-gateway", ["toast"], (toast) => {
  "use strict";

  const OFFLINE = Object.freeze({
    offline: true,
    state: Object.freeze({
      active: false,
      connected: false,
      role: null,
      screenState: "idle",
      rtt: 0,
      waitingResult: null,
      localRematch: false,
      remoteRematch: false,
      mid: 0,
      trace: [],
    }),
    available: () => false,
    isMatch: () => false,
    isGuestView: () => false,
    open: () => toast.show("Online play is not part of this build."),
    tick() {},
    queueKey() {},
    dirty() {},
    stop() {},
    leave() {},
    onResult() {},
    rematch() {},
    nextRound: () => 0,
    chartHtml: () => "",
    resultColumn: () => null,
    refreshProfile() {},
    send() {},
    hostStart() {},
  });

  let impl = OFFLINE;

  /** The online module calls this once when it starts. */
  function install(implementation) {
    impl = implementation;
  }

  return Object.freeze({
    install,
    /** True while no online module is installed. */
    get offline() {
      return impl === OFFLINE;
    },
    /** The online state (role, connected, rematch flags, round id ...). Read only. */
    get state() {
      return impl.state;
    },
    /** True when online play can work here (the page is served over http and PeerJS is loaded). */
    available: () => impl.available(),
    /** True during an online match, including its result screen. */
    isMatch: () => impl.isMatch(),
    /** True when this screen only mirrors the host's duel (an online guest). */
    isGuestView: () => impl.isGuestView(),
    /** Opens the room screen. */
    open: () => impl.open(),
    /** Called every frame: snapshots, pings, key batches. */
    tick: () => impl.tick(),
    /** A guest's key for the host. */
    queueKey: (key) => impl.queueKey(key),
    /** The host's duel changed: send a snapshot soon. */
    dirty: () => impl.dirty(),
    /** The match ended or was left: stop sending. */
    stop: () => impl.stop(),
    /** Leaves the room and closes the connection. */
    leave: () => impl.leave(),
    /** The result screen of an online match is showing. */
    onResult: () => impl.onResult(),
    /** Asks the other player for a rematch. */
    rematch: () => impl.rematch(),
    /** Schedules the next round (only the host starts it). Returns a timer id or 0. */
    nextRound: (ms) => impl.nextRound(ms),
    /** The online speed chart for the result screen. */
    chartHtml: (you, foe) => impl.chartHtml(you, foe),
    /** The online part of the Duel result screen, { column, buttons } markup, or null when no online match is on. */
    resultColumn: () => impl.resultColumn(),
    /** Your fighter changed: tell the other player next time. */
    refreshProfile: () => impl.refreshProfile(),
    /** Sends a protocol message by name: send("state", n, snapshot, roundId). */
    send: (type, ...args) => impl.send(type, ...args),
    /** The host starts a new match, or with `next` the next round. */
    hostStart: (next) => impl.hostStart(next),
  });
});
