/**
 * Ranked queue (#scr-queue): searching, a found match to accept, the race lobby filling up, a dodge penalty.
 *
 * The matchmaking state machine is Ranked.Matchmaker (ranked.js), driven here by a timer; the backend fills it with
 * mock players until the server exists. When the match is ready, the mode that owns it starts it (its
 * startRanked(match, myMmr) hook, with your hidden rating so it can scale its stand-in opponents). A mode with a
 * lobby says so in its registration (ranked.lobby: { min, max, noun }).
 */
CounterType.define(
  "queue-page",
  [
    "config",
    "router",
    "registry",
    "actions",
    "events",
    "session",
    "settings",
    "layout",
    "home-page",
    "backend",
    "ranked",
    "profile",
    "rank-badges",
    "audio",
    "buttons",
    "keyline",
    "format",
    "dom",
  ],
  (
    CONFIG,
    router,
    registry,
    actions,
    events,
    session,
    settings,
    layout,
    home,
    Backend,
    Ranked,
    Profile,
    rankBadges,
    Sfx,
    buttons,
    keyline,
    format,
    dom,
  ) => {
    "use strict";

    const TICK_MS = 200;
    const READY_HOLD_MS = 900; // "READY" stays on screen this long before the match starts
    const Q = () => CONFIG.ranked.queue;
    const now = () => Date.now() / 1000;
    const esc = dom.escapeHtml;

    const S = { mm: null, mode: null, timer: 0, record: null, readyAt: 0 };

    const el = router.register({ id: "queue", className: "panel", restore: () => render(), onKey, onAction });

    const modeOf = (id) => registry.get("mode", id);
    const modeName = (id) => rankBadges.modeLabel(id);
    const lobbyOf = (id) => {
      const mode = modeOf(id);
      return mode && mode.ranked && mode.ranked.lobby ? mode.ranked.lobby : null;
    };

    /** Joins the queue of a mode. */
    function open(modeId) {
      close(true);
      const mode = modeOf(modeId);
      const lobby = lobbyOf(modeId);
      const alwaysSpace = !!(mode && mode.ranked && mode.ranked.alwaysSpace);
      S.mode = modeId;
      S.mm = Backend.queue(modeId, {
        submit: settings.values.wordSubmit || alwaysSpace ? "space" : "auto",
        lobby,
        onChange: () => render(),
      });
      S.record = S.mm.myRecord;
      router.show("queue");
      S.mm.start(now());
      if (S.mm.state === "searching") Sfx.play("beep");
      S.timer = setInterval(tick, TICK_MS);
      render();
    }

    function tick() {
      if (!S.mm) return;
      const before = S.mm.state;
      S.mm.tick(now());
      if (S.mm.state === "found" && before !== "found") Sfx.play("ultReady");
      if (S.mm.state === "declined" && before !== "declined") S.mm.saveDodge();
      if (S.mm.state === "ready") {
        if (!S.readyAt) {
          S.readyAt = performance.now();
          Sfx.play("go");
        } else if (performance.now() - S.readyAt > READY_HOLD_MS) {
          const match = S.mm.match;
          const myMmr = S.mm.me.mmr; // the mode scales its stand-in opponents by the rating gap
          const owner = modeOf(S.mode);
          close(true);
          S.mm = null;
          if (owner) owner.startRanked(match, myMmr);
          return;
        }
      }
      render();
    }

    /** Stops the queue timer; `silent` keeps the matchmaker (a match is starting). */
    function close(silent) {
      if (S.timer) clearInterval(S.timer);
      S.timer = 0;
      S.readyAt = 0;
      if (S.mm && !silent && (S.mm.state === "searching" || S.mm.state === "lobby")) S.mm.cancel();
      if (!silent) S.mm = null;
    }

    function cancel() {
      const mode = S.mode;
      close(false);
      home.show(mode);
    }

    function accept() {
      if (!S.mm || S.mm.state !== "found") return;
      S.mm.accept(now());
      render();
    }

    function decline() {
      if (!S.mm) return;
      if (S.mm.state === "found") {
        S.mm.decline(now());
        S.mm.saveDodge();
        render();
      } else cancel();
    }

    // The penalty can end while the screen is open; Queue again restarts it.
    function retry() {
      if (S.mm && now() >= S.mm.penaltyUntil) open(S.mode);
    }

    // Practice while you wait: the mode's own practice (the Duel picks MATCH ME).
    function practice() {
      const owner = modeOf(S.mode);
      close(false);
      if (!owner) return;
      if (owner.practice) owner.practice();
      else owner.start();
    }

    // ---------- Drawing ----------

    function card(p, extra) {
      return `<div class="q-foe pick"><b>${esc(p.name)}<i>#${p.tag}</i></b><span>${rankBadges.badge(Ranked.tierOf(p.rp))} MMR ${p.mmr}</span>${extra || ""}</div>`;
    }

    function bodyFor(mm, t, me, tier) {
      const record = S.record;
      const lobby = lobbyOf(S.mode);
      let body = "";
      let btns = buttons.button("q-cancel", "Cancel");
      if (mm.state === "searching") {
        body = `<div class="q-big">${format.clock(mm.waited(t))}</div><div class="q-scan" aria-hidden="true"><i></i></div>
        <p class="q-line">Searching for a ${modeName(S.mode).toLowerCase()} opponent within <b>${mm.window(t)}</b> rating points</p>
        <p class="q-line dim">${mm.queue.searchers.length} players searching nearby. The range widens every ${Q().widenEvery} s.</p>`;
        if (mm.fallback) {
          body += `<p class="q-line">Taking a while. You can practice while you wait.</p>`;
          btns = buttons.button("q-practice", "Practice instead") + btns;
        }
      } else if (mm.state === "lobby") {
        const L = mm.lobby;
        const left = Math.max(0, Math.ceil(L.startsAt - t));
        const noun = lobby ? lobby.noun : "players";
        const max = lobby ? lobby.max : L.players.length + 1;
        body = `<div class="q-big">${L.players.length + 1}<span>/${max}</span></div>
        <p class="q-line">${noun[0].toUpperCase() + noun.slice(1)} joining. Green light in <b>${left} s</b>, or as soon as the grid is full.</p>
        <div class="q-grid"><div class="q-foe pick sel"><b>${esc(me.name)}<i>#${me.tag}</i></b><span>${rankBadges.badge(tier, record.placementsLeft)}</span></div>${L.players.map((p) => card(p)).join("")}</div>`;
      } else if (mm.state === "found") {
        const left = Math.max(0, mm.acceptBy - t);
        const pct = (left / Q().acceptSec) * 100;
        const line = mm.accepted
          ? "Accepted. Waiting for your opponent."
          : `Accept within ${Math.ceil(left)} s. Declining puts you out of the queue for a while.`;
        body = `<div class="q-big found">MATCH FOUND</div>${card(mm.match.opponents[0])}
        <div class="q-accept"><i style="width:${pct}%"></i></div>
        <p class="q-line">${line}</p>`;
        btns = mm.accepted
          ? buttons.button("q-cancel", "Leave")
          : buttons.button("q-accept", "Accept", { primary: true }) + buttons.button("q-decline", "Decline");
      } else if (mm.state === "ready") {
        const grid = lobby
          ? `<p class="q-line">${mm.match.opponents.length + 1} ${lobby.noun} on the grid.</p>`
          : card(mm.match.opponents[0]);
        body = `<div class="q-big found">READY</div>${grid}`;
        btns = "";
      } else if (mm.state === "declined" || mm.state === "penalty") {
        const left = Math.max(0, mm.penaltyUntil - t);
        body = `<div class="q-big lose">${format.clock(left)}</div><p class="q-line">You declined or missed a match. The ranked queue opens again when this runs out. Each dodge doubles it.</p>`;
        btns =
          (left <= 0 ? buttons.button("q-retry", "Queue again", { primary: true }) : "") +
          buttons.button("q-cancel", "Back");
      } else if (mm.state === "cancelled") {
        body = `<p class="q-line">Queue cancelled.</p>`;
      }
      return { body, btns };
    }

    function render() {
      if (router.current() !== "queue" || !S.mm) return;
      const mm = S.mm;
      const t = now();
      const record = S.record;
      const me = Profile.get();
      const tier = record.placementsLeft ? null : Ranked.tierOf(record.rp);
      const { body, btns } = bodyFor(mm, t, me, tier);
      el.innerHTML = `<h2 class="screen-title">Ranked ${modeName(S.mode)}</h2>
      <div class="q-me"><b>${esc(me.name)}<i>#${me.tag}</i></b>${rankBadges.badge(tier, record.placementsLeft)}<span>MMR ${Ranked.mmr(record)}</span><span>${Profile.regionName(me.region)}</span></div>
      <div class="q-body">${body}</div>
      <p class="q-preview">Preview: opponents are simulated until online ranked launches. Your rating is kept in this browser.</p>
      <div class="btn-row">${btns}</div>`;
      keyline.clear();
    }

    // ---------- Input ----------

    function onKey(e, key) {
      const state = S.mm ? S.mm.state : null;
      if (e.key === "Enter") {
        if (state === "found") actions.run("q-accept");
        else if (state === "declined" || state === "penalty") actions.run("q-retry");
      } else if (e.key === "Escape") actions.run(state === "found" ? "q-decline" : "q-cancel");
      else if (key === "p") actions.run("q-practice");
      return true;
    }

    function onAction(name) {
      switch (name) {
        case "q-accept":
          accept();
          return true;
        case "q-decline":
          decline();
          return true;
        case "q-cancel":
        case "back":
          cancel();
          return true;
        case "q-retry":
          retry();
          return true;
        case "q-practice":
          practice();
          return true;
        default:
          return false;
      }
    }

    // "ranked:<mode>" from the menus, a result screen or the profile.
    actions.on("ranked", (modeId, y, top) => {
      const from = router.current();
      if (top || layout.isPhone() || !["title", "result", "mresult", "profile", "queue"].includes(from)) return;
      if (!modeOf(modeId)) return;
      session.stopModes();
      session.end();
      open(modeId);
    });

    events.on("app:menu", () => close(false));

    registry.add("key-help", {
      id: "ranked-queue",
      order: 15,
      rows: () => [["Ranked queue", "Enter accepts a found match, Escape declines it or leaves the queue."]],
    });

    return Object.freeze({ open, close, cancel });
  },
);
