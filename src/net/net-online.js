/**
 * Net online: private online rooms over PeerJS (net-peer.js) for the typing Duel and Backspace Brawl.
 *
 * Everything online lives here: the room's state, the lobby handshake, the host and guest loops, snapshots, key
 * forwarding, the ping badge, rematches and the next round. It installs itself into the online gateway, which is the
 * only way the rest of the game reaches it. The games plug in through their mode's `net` hook (registry "mode",
 * { net: { game, begin, ... } }), so this module never names a mode. The room screen is net-room-page.js.
 *
 * Lag design (host judges, guest mirrors): the guest sends each key at once (lt on the real clock); the host sends
 * slim snapshots on the real clock (CONFIG.net.snapshotHz) plus an early one right after any key; between
 * snapshots the guest plays the duel forward on its own. A ping every 2 s feeds the badge.
 *
 * Events it sends: "net:changed" (the room changed: redraw it), "net:open" (show the room screen).
 */
CounterType.define(
  "net-online",
  [
    "net-config",
    "?net-keys",
    "net-peer",
    "net-protocol",
    "registry",
    "router",
    "session",
    "settings",
    "player",
    "?creator",
    "characters",
    "layout",
    "toast",
    "events",
    "online-gateway",
    "home-page",
    "match-rules",
    "random",
    "buttons",
    "dom",
  ],
  (
    CONFIG,
    _keys,
    NetPlay,
    Protocol,
    registry,
    router,
    session,
    settings,
    player,
    creator,
    Chars,
    layout,
    toast,
    events,
    gateway,
    home,
    Modes,
    random,
    buttons,
    dom,
  ) => {
    "use strict";

    const NET = CONFIG.net;
    const CH = CONFIG.chars;
    const TRACE_EVERY = 0.5; // seconds of duel time between two samples of the online speed chart
    const PING_EVERY_MS = 2000;
    const RTT_SMOOTH = 0.3;
    const PING_GOOD = 80;
    const PING_FAIR = 160;
    const FULL_SNAPSHOT_EVERY = 10; // every 10th snapshot carries the stats
    const esc = dom.escapeHtml;

    const online = {
      net: null,
      screenState: "idle", // idle | creating | waiting | joining | connected | playing | result | error | closed
      status: "",
      code: "",
      role: null, // "host" | "guest"
      connected: false,
      localReady: false,
      remoteReady: false,
      localRematch: false,
      remoteRematch: false,
      profile: null,
      peerProfile: null,
      foeName: "",
      seed: 0,
      seq: 0,
      snapN: 0,
      keyQueue: [],
      hostSentResult: false,
      active: false,
      waitingResult: null,
      trace: [],
      traceAt: 0,
      startedAt: 0,
      lastSnapAt: 0,
      snapDirty: false,
      pingAt: 0,
      pingId: 0,
      rtt: 0,
      mid: 0,
    };

    // ---------- The games (each mode with a `net` hook) ----------

    const games = () => registry.list("mode").filter((mode) => mode.net);
    const hookOf = (game) => {
      const mode = games().find((m) => m.net.game === game);
      return mode ? mode.net : null;
    };
    const typing = () => hookOf("typing");
    const brawl = () => hookOf("brawl");
    const brawlActive = () => !!brawl() && brawl().active;

    /** The games this build can play online, ["typing", "brawl"] at most. */
    function gameIds() {
      return games().map((mode) => mode.net.game);
    }

    const changed = () => events.emit("net:changed");

    // ---------- The ping badge ("ping 48 ms": green under 80, amber under 160, red above) ----------

    let badge = null;
    function updateBadge() {
      if (!badge) {
        badge = dom.create("div", { id: "ping-badge", attrs: { "aria-hidden": "true" } });
        document.body.appendChild(badge);
      }
      const show = online.active && online.rtt > 0;
      badge.hidden = !show;
      if (!show) return;
      const ms = Math.round(online.rtt);
      badge.textContent = "ping " + ms + " ms";
      badge.dataset.q = ms < PING_GOOD ? "good" : ms < PING_FAIR ? "fair" : "bad";
    }

    // ---------- The room ----------

    function available() {
      return NetPlay.available(NET);
    }

    function profileNow() {
      const mine = player.fighter();
      // A custom fighter plays as its template online: the protocol only allows roster keys and both peers must agree.
      return {
        name: "PLAYER",
        fighter: creator ? creator.baseOf(mine) : mine,
        color: CH.you.body,
        gameVersion: NET.gameVersion,
      };
    }

    function safeChar(key) {
      return Chars.DEFS[key] ? key : CH.defaultChar;
    }

    function reset(keepNet) {
      if (!keepNet && online.net) online.net.close();
      Object.assign(online, {
        screenState: "idle",
        status: "",
        code: "",
        role: null,
        connected: false,
        localReady: false,
        remoteReady: false,
        localRematch: false,
        remoteRematch: false,
        peerProfile: null,
        keyQueue: [],
        trace: [],
        active: false,
        waitingResult: null,
        hostSentResult: false,
      });
      if (!keepNet) online.net = null;
    }

    function makeNet() {
      if (online.net) online.net.close();
      online.net = new NetPlay(NET, { status: onStatus, message: onMessage });
      online.profile = profileNow();
      return online.net;
    }

    /** Creates a private room (you host). */
    function createRoom() {
      if (!available()) {
        toast.show("Serve the game over http, or use ?server=lan for LAN play.");
        return;
      }
      reset();
      online.profile = profileNow();
      online.screenState = "creating";
      makeNet().createRoom();
      changed();
    }

    /** Joins a friend's room by its code. */
    function joinRoom(text) {
      if (!available()) {
        toast.show("Serve the game over http, or use ?server=lan for LAN play.");
        return;
      }
      const code = NetPlay.codeOk(text, NET);
      if (!code) {
        toast.show("Enter a valid room code.");
        return;
      }
      reset();
      online.profile = profileNow();
      online.screenState = "joining";
      makeNet().joinRoom(code);
      changed();
    }

    function toggleReady() {
      online.localReady = !online.localReady;
      if (online.net) online.net.send(Protocol.ready(online.localReady));
      if (online.role === "host" && online.localReady && online.remoteReady) {
        hostStart();
        return;
      }
      changed();
    }

    function onStatus(e) {
      online.screenState = e.state;
      online.code = e.code || online.code;
      online.role = e.role || online.role;
      if (e.state === "waiting") online.status = "Share the code with your opponent.";
      else if (e.state === "joining") online.status = e.message || "Joining room...";
      else if (e.state === "connected") {
        online.connected = true;
        online.status = "Connected. Ready up when both players are here.";
        if (online.role === "guest") online.net.send(Protocol.hello(online.profile));
      } else if (e.state === "error") {
        online.status = e.message || "Network error";
        toast.show(online.status);
      } else if (e.state === "closed") {
        if (online.active) toast.show(e.message || "The other player left.");
        reset(true);
        online.status = e.message || "Connection closed.";
      }
      changed();
    }

    // ---------- Messages ----------

    function peerFrom(msg) {
      return { name: Protocol.cleanName(msg.name), fighter: safeChar(msg.fighter), color: msg.color };
    }

    function onHello(msg) {
      if (msg.gameVersion !== NET.gameVersion) {
        online.net.send(Protocol.error("The other player has a different version. Refresh the page."));
        return;
      }
      online.peerProfile = peerFrom(msg);
      online.net.send(Protocol.welcome(online.profile));
      online.status = "Opponent joined. Ready up.";
      changed();
    }

    function onWelcome(msg) {
      if (msg.gameVersion !== NET.gameVersion) {
        toast.show("The other player has a different version. Refresh the page.");
        return;
      }
      online.peerProfile = peerFrom(msg);
      online.status = "Joined. Ready up.";
      changed();
    }

    function onState(msg) {
      if (brawlActive()) {
        brawl().onSnapshot(msg);
        return;
      }
      const game = typing();
      if (!game || msg.mid !== online.mid) return; // a late message of the round before
      game.applySnapshot(msg.s);
      sampleTrace(game);
      if (game.resultPending()) online.waitingResult = msg.s.result || { winner: 0 };
    }

    function onResultMessage(msg) {
      if (!online.active) return;
      if (brawlActive()) {
        brawl().onResult(msg);
        return;
      }
      const game = typing();
      if (game) online.waitingResult = game.remoteResult(msg.winner);
    }

    function onMessage(msg) {
      const host = online.role === "host";
      const guest = online.role === "guest";
      switch (msg.t) {
        case "busy":
          toast.show("This room already has two players.");
          break;
        case "leave":
          toast.show("The other player left.");
          home.goMenu();
          break;
        case "error":
          toast.show(msg.message);
          break;
        case "hello":
          if (host) onHello(msg);
          break;
        case "welcome":
          if (guest) onWelcome(msg);
          break;
        case "ready":
          online.remoteReady = msg.ready;
          changed();
          if (host && online.localReady && online.remoteReady) hostStart();
          break;
        case "start":
          guestStart(msg);
          break;
        case "bin":
          if (host && brawl()) brawl().onInput(msg);
          break;
        case "keys":
          if (host && typing()) {
            typing().remoteKeys(msg.events);
            online.snapDirty = true; // tell the guest at once, not at the next periodic snapshot
          }
          break;
        case "state":
          if (guest) onState(msg);
          break;
        case "result":
          if (guest) onResultMessage(msg);
          break;
        case "rematch":
          online.remoteRematch = msg.want;
          if (host && online.localRematch && online.remoteRematch) hostStart();
          router.refresh();
          break;
        case "ping":
          online.net.send(Protocol.pong(msg.id, msg.ts));
          break;
        case "pong": {
          const rtt = performance.now() - msg.ts;
          online.rtt = online.rtt ? online.rtt * (1 - RTT_SMOOTH) + rtt * RTT_SMOOTH : rtt; // smoothed round trip
          updateBadge();
          break;
        }
        default:
          break;
      }
    }

    // ---------- Starting a match ----------

    function startCommon(seed, mid, foeName) {
      online.active = true;
      online.screenState = "playing";
      online.seed = seed >>> 0;
      online.seq = 0;
      online.snapN = 0;
      online.startedAt = performance.now();
      online.lastSnapAt = 0;
      online.snapDirty = false;
      online.pingAt = 0;
      online.rtt = 0;
      online.keyQueue = [];
      online.trace = [];
      online.traceAt = 0;
      online.localRematch = false;
      online.remoteRematch = false;
      online.hostSentResult = false;
      online.waitingResult = null;
      online.mid = mid;
      online.foeName = foeName;
      changed();
    }

    /** Which game a new match plays: the only one there is, a phone's, the one in progress, or the room's choice. */
    function pickGame(cont, run) {
      const ids = gameIds();
      if (!ids.length) return null;
      if (ids.length === 1) return ids[0];
      if (layout.isPhone()) return "brawl";
      if (cont && run) return run.mode === "brawl" ? "brawl" : "typing";
      return settings.values.mGame === "brawl" ? "brawl" : "typing";
    }

    function startGame(game, m) {
      const hook = hookOf(game);
      if (!hook) {
        toast.show("This build cannot play that game online.");
        home.goMenu();
        return;
      }
      hook.begin(m);
    }

    /** The host starts a new match, or with `next` the next round of the match in progress. */
    function hostStart(next) {
      const peer = online.peerProfile || { name: "OPPONENT", fighter: CH.defaultChar };
      const run = session.current();
      const cont = !!next && !!run && run.kind === "online";
      const game = pickGame(cont, run);
      if (!game) return;
      const seed = random.cryptoSeed();
      const fighters = [safeChar(online.profile.fighter), safeChar(peer.fighter)];
      const rules = cont ? run.rules : session.rulesNow();
      const round = cont ? run.round : 1;
      // Wins travel in seat order, [host, guest]; the Duel keeps them as [yours, theirs], the same for the host.
      const wins = cont ? run.wins.slice() : [0, 0];
      const mid = (online.mid || 0) + 1;
      online.net.send(
        Protocol.start(seed, fighters, ["PLAYER", peer.name], CONFIG.duel.countdown, rules, round, wins, mid, game),
      );
      startCommon(seed, mid, peer.name);
      startGame(game, { role: "host", seed, rules, round, wins, mid, fighters, foeName: peer.name });
    }

    function guestStart(msg) {
      const rules = Modes.cleanRules(msg.rules);
      if (layout.isPhone() && msg.game !== "brawl") {
        toast.show("This room plays the typing game. Phones play Backspace Brawl only.");
        home.goMenu();
        return;
      }
      const hostFighter = safeChar(msg.fighters[0]);
      const guestFighter = safeChar(msg.fighters[1]);
      const hostName = msg.names[0];
      startCommon(msg.seed, msg.mid, hostName);
      if (msg.game === "brawl") {
        startGame("brawl", {
          role: "guest",
          seed: msg.seed,
          rules,
          round: msg.round,
          wins: msg.wins.slice(),
          mid: msg.mid,
          fighters: [hostFighter, guestFighter],
          foeName: hostName,
        });
      } else {
        startGame("typing", {
          role: "guest",
          seed: msg.seed,
          rules,
          round: msg.round,
          wins: [msg.wins[1], msg.wins[0]], // yours first
          mid: msg.mid,
          fighters: [guestFighter, hostFighter], // yours first
          foeName: hostName,
        });
      }
    }

    // ---------- Every frame ----------

    function sampleTrace(game) {
      if (game.phase() === "fight" && game.clock() >= online.traceAt) {
        online.trace.push(game.sample());
        online.traceAt += TRACE_EVERY;
      }
    }

    function queueKey(key) {
      if (!online.active || online.role !== "guest") return;
      // Real elapsed time, not the duel clock: the guest's duel clock only moves with the host's snapshots.
      online.keyQueue.push({ k: key, lt: Math.max(0, (performance.now() - online.startedAt) / 1000) });
      flushKeys(); // send at once: a key waiting for a timer is lag you can feel
    }

    function flushKeys() {
      if (!online.net || online.role !== "guest" || !online.keyQueue.length) return;
      const batch = online.keyQueue.splice(0, NET.maxKeysPerMessage);
      online.net.send(Protocol.keys(online.seq++, batch));
    }

    // Online timing runs on the real clock (performance.now), not on the duel clock: the guest's duel clock only
    // moves when a snapshot arrives, so anything timed by it would wait for the very message it is meant to send.
    function sendSnapshot(game, now) {
      online.snapN++;
      online.net.send(
        Protocol.state(online.snapN, game.snapshot(online.snapN % FULL_SNAPSHOT_EVERY === 1), online.mid),
      );
      online.lastSnapAt = now;
      online.snapDirty = false;
    }

    function tick() {
      if (!online.active) return;
      const now = performance.now();
      if (online.role === "guest" && online.keyQueue.length) flushKeys();
      const game = typing();
      const host = online.role === "host";
      if (host && online.net && game && game.phase() !== "menu") {
        const every = 1000 / NET.snapshotHz;
        // Periodic snapshot, plus an early one right after the judge changed something (a key from either player).
        const due = now - online.lastSnapAt >= every;
        const early = online.snapDirty && now - online.lastSnapAt >= NET.snapshotMinMs;
        if (due || early) sendSnapshot(game, now);
      }
      if (online.net && now - online.pingAt >= PING_EVERY_MS) {
        online.pingAt = now;
        online.net.send(Protocol.ping(++online.pingId, now));
      }
      if (host && game) {
        sampleTrace(game);
        const result = game.result();
        if (game.phase() === "over" && result && !online.hostSentResult) {
          online.hostSentResult = true;
          online.net.send(Protocol.result(result.winner, game.clock(), game.stats()));
        }
      }
    }

    // ---------- Result, rematch, leaving ----------

    function chartHtml(you, foe) {
      const W = 600;
      const H = 64;
      const data = online.trace;
      const ui = CONFIG.theme.ui;
      if (data.length < 2) {
        return `<div class="chart-head"><span>Online WPM over time</span><span>unranked</span></div><svg class="speed" viewBox="0 0 ${W} ${H}"></svg>`;
      }
      const top = Math.max(40, ...data.map((p) => Math.max(p[0], p[1])));
      const max = Math.ceil(top / 20) * 20;
      const line = (i) =>
        data
          .map((p, k) => `${((k / (data.length - 1)) * W).toFixed(1)},${(H - (p[i] / max) * H).toFixed(1)}`)
          .join(" ");
      const game = typing();
      const secs = game ? game.clock().toFixed(0) : "0";
      return (
        `<div class="chart-head"><span>Online WPM over time, ${secs} s</span><span>` +
        `<span class="key-i"><i style="background:${you}"></i>YOU</span><span class="key-i"><i style="background:${foe}"></i>${esc(online.foeName)}</span></span></div>` +
        `<svg class="speed" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="${ui.line}" stroke-width="1"/>` +
        `<polyline points="${line(1)}" fill="none" stroke="${foe}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>` +
        `<polyline points="${line(0)}" fill="none" stroke="${you}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`
      );
    }

    const isMatch = () => online.active || online.screenState === "result";

    /** The Duel result screen's right column during an online match. */
    function resultColumn() {
      if (!isMatch()) return null;
      const waiting = online.localRematch;
      return {
        column:
          `<div class="card-label"><span>Online room</span><span>${waiting ? "Waiting" : "Ready for rematch"}</span></div>` +
          `<button class="bot-chip pick ${online.remoteRematch ? "sel" : ""}" tabindex="-1"><b>${esc(online.foeName)}</b>${online.remoteRematch ? "wants rematch" : "not ready"}</button>`,
        buttons:
          buttons.button("rematch", waiting ? "Waiting" : "Rematch", { primary: !waiting }) +
          buttons.button("menu", "Leave"),
      };
    }

    function rematch() {
      online.localRematch = true;
      if (online.net) online.net.send(Protocol.rematch(true));
      if (online.role === "host" && online.remoteRematch) hostStart();
      router.refresh();
    }

    function leave() {
      if (online.net) online.net.close();
      online.net = null;
      reset(true);
      online.rtt = 0;
      updateBadge();
    }

    /** The next round of an online match: only the host starts it, after the banner. */
    function nextRound(ms) {
      if (online.role !== "host") return 0;
      return setTimeout(() => {
        if (online.connected) hostStart(true);
      }, ms);
    }

    function send(type, ...args) {
      const build = Protocol[type];
      if (typeof build !== "function") throw new Error(`net-online: no "${type}" message in the protocol.`);
      if (online.net) online.net.send(build(...args));
    }

    // ---------- Into the gateway ----------

    gateway.install({
      state: online,
      available,
      isMatch,
      isGuestView: () => online.active && online.role === "guest",
      open: () => {
        online.profile = profileNow();
        events.emit("net:open");
      },
      tick,
      queueKey,
      dirty() {
        if (online.active && online.role === "host") online.snapDirty = true;
      },
      stop() {
        online.active = false;
        online.screenState = "idle";
      },
      leave,
      onResult() {
        if (online.active) online.screenState = "result";
      },
      rematch,
      nextRound,
      chartHtml,
      resultColumn,
      refreshProfile() {
        online.profile = profileNow();
      },
      send,
      hostStart,
    });

    return Object.freeze({ state: online, gameIds, createRoom, joinRoom, toggleReady, leave, available });
  },
);
