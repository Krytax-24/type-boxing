/**
 * Home page: the title screen (#scr-title). The logo over a column of big buttons on the left, a panel on the right,
 * and the sparring loop playing in the middle.
 *
 * The title screen has views: "home" (every loaded mode, then Profile, Ranks and Help; your rank in each mode on
 * the right) and one view per game mode, which that mode draws itself (its menu() hook). This page also owns the
 * way back to the menus from anywhere (goMenu).
 */
CounterType.define(
  "home-page",
  [
    "router",
    "registry",
    "session",
    "modals",
    "actions",
    "events",
    "online-gateway",
    "layout",
    "looks",
    "banner",
    "buttons",
    "keyline",
    "backend",
    "profile",
    "ranked",
    "rank-badges",
    "dom",
  ],
  (
    router,
    registry,
    session,
    modals,
    actions,
    events,
    net,
    layout,
    looks,
    banner,
    buttons,
    keyline,
    Backend,
    Profile,
    Ranked,
    rankBadges,
    dom,
  ) => {
    "use strict";

    let view = "home";

    const el = router.register({
      id: "title",
      restore: () => show(),
      refresh: () => show(),
      onKey,
      onAction,
    });
    el.innerHTML = `
      <div id="title-left">
        <h1 class="logo" aria-label="CounterType"><span class="l1">COUNTER</span><span class="l2">TYPE</span></h1>
        <nav id="title-menu"></nav>
      </div>
      <div id="title-bots" class="panel"></div>`;
    const menuEl = dom.byId("title-menu");
    const sideEl = dom.byId("title-bots");

    const modes = () => registry.list("mode");
    const modeOf = (id) => registry.get("mode", id);
    const subOf = (mode) => (typeof mode.sub === "function" ? mode.sub() : mode.sub || "");

    /** Shows the title screen, in the current view (or the one given). */
    function show(nextView) {
      if (nextView) view = nextView;
      router.show("title");
      if (layout.isPhone()) {
        const phoneMode = modes().find((mode) => mode.phone);
        if (phoneMode) view = phoneMode.id; // phones play the touch modes only
      }
      if (view !== "home" && !modeOf(view)) view = "home";
      sideEl.classList.remove("hidden");
      el.dataset.view = view;
      const mode = modeOf(view);
      if (mode) mode.menu({ menu: menuEl, side: sideEl });
      else drawHome();
      looks.apply();
    }

    // ---------- The home view ----------

    function drawHome() {
      menuEl.innerHTML =
        modes()
          .map((mode) => buttons.menuButton(mode.id, mode.label, { primary: mode.primary, sub: subOf(mode) }))
          .join("") +
        `<div class="mini-row">${buttons.button("profile", "Profile")}${buttons.button("leaders", "Ranks")}` +
        `${buttons.button("howto", "Help")}</div>`;
      sideEl.innerHTML = ranksHtml(null);
      Backend.getAllRanked()
        .then((records) => {
          if (router.current() === "title" && view === "home") sideEl.innerHTML = ranksHtml(records);
        })
        .catch(() => {});
      keyline.set(modes().flatMap((mode) => (mode.homeChips ? mode.homeChips() : [])));
    }

    // Your rank in each mode at a glance (filled in when the backend answers).
    function ranksHtml(records) {
      const me = Profile.get();
      const rows = session
        .rankedLadders()
        .map(([mode, label]) => {
          const r = records && records[mode];
          const right = !r
            ? `<span class="skel w40"></span>`
            : `${rankBadges.badge(r.tier, r.placementsLeft)}${r.placementsLeft ? "" : `<b>${r.rp}</b>`}`;
          return `<button class="rank-row pick" data-act="leaders:${mode}" tabindex="-1"><span>${label}</span><span class="rr">${right}</span></button>`;
        })
        .join("");
      const season = Ranked.seasonOf(Date.now());
      return (
        `<div class="card-label"><span>${dom.escapeHtml(me.name)}<i class="tagi">#${me.tag}</i></span><span>Season ${season.id}</span></div>${rows}` +
        `<p class="opt-note">Ranked is a preview: opponents are simulated and your rating stays in this browser until online ranked launches.</p>`
      );
    }

    // ---------- Back to the menus from anywhere ----------

    /** Ends whatever runs (a fight, a race, a queue, a room) and shows the title, in the view the run came from. */
    function goMenu() {
      session.cancelRoundTimer();
      banner.hide();
      const run = session.current();
      if (run && run.kind === "online") view = "home";
      else if (run && modeOf(run.mode)) view = run.mode;
      session.stopModes();
      events.emit("app:menu");
      session.end();
      net.leave();
      modals.clear();
      looks.setFight(null);
      show();
    }

    // ---------- Input ----------

    function onAction(name) {
      if (name === "back" && view !== "home") {
        view = "home";
        show();
        return true;
      }
      return false;
    }

    function onKey(e, key) {
      const mode = modeOf(view);
      if (mode) {
        // A mode's title view: its own keys first, then the shell's.
        if (mode.menuKey && mode.menuKey(e, key)) return true;
        if (e.key === "Escape") actions.run("back");
        else if (key === "s") actions.run("settings");
        else if (key === "f") actions.run("fullscreen");
        else if (key === "c") actions.run("fighter");
        else if (key === "h") actions.run("howto");
        return true;
      }
      const homeMode = modes().find((m) => m.homeKey === key || (m.primary && e.key === "Enter"));
      if (key === "c") actions.run("fighter");
      else if (key === "h") actions.run("howto");
      else if (key === "t") actions.run("stats");
      else if (homeMode) actions.run(homeMode.id);
      else if (key === "p") actions.run("profile");
      else if (key === "l") actions.run("leaders");
      else if (key === "s") actions.run("settings");
      else if (key === "f") actions.run("fullscreen");
      else if (e.key === "F2") {
        e.preventDefault();
        actions.run("view");
      }
      return true;
    }

    // A mode's name as an action opens its title view (from the title, the profile or How to play; phones only
    // play the touch modes).
    const OPENS_FROM = ["title", "profile", "howto"];
    actions.onUnknown((name, x, y, top) => {
      const mode = modeOf(name);
      if (!mode) return false;
      if (!top && OPENS_FROM.includes(router.current()) && (!layout.isPhone() || mode.phone)) show(name);
      return true;
    });
    actions.on("menu", () => goMenu());

    return Object.freeze({
      show,
      goMenu,
      view: () => view,
      setView: (next) => {
        view = next;
      },
    });
  },
);
