/**
 * Duel result (#scr-result): the K.O. card (YOU WIN or YOU LOSE, how and against whom), both typists' numbers,
 * the speed and HP chart, the extra numbers (or the ranked update), and the way on: pick another opponent, the
 * practice dummy, the online room's rematch, or queue again after a ranked duel.
 *
 * Keys are ignored for a moment after the screen appears (CONFIG.theme.resultKeyDelay), so letters you are still
 * typing do not fire menu keys. Clicks work at once.
 */
CounterType.define(
  "duel-result-page",
  [
    "config",
    "router",
    "actions",
    "events",
    "session",
    "settings",
    "online-gateway",
    "match-rules",
    "stats-charts",
    "chart-hover",
    "rank-badges",
    "audio",
    "buttons",
    "keyline",
    "dom",
    "duel-session",
    "duel-bots",
    "duel-practice",
  ],
  (
    CONFIG,
    router,
    actions,
    events,
    session,
    settings,
    net,
    Modes,
    charts,
    chartHover,
    rankBadges,
    Sfx,
    buttons,
    keyline,
    dom,
    duelSession,
    bots,
    practice,
  ) => {
    "use strict";

    const duel = duelSession.duel;
    const esc = dom.escapeHtml;
    const ONLINE_NOTE =
      `<div class="card-label"><span>Online</span><span>Private room</span></div>` +
      `<p class="modal-note">Online matches are unranked and are not saved to My stats.</p>`;

    const el = router.register({ id: "result", restore, refresh: drawSide, onKey });
    el.innerHTML = `
      <div id="ko-card" class="panel"><div id="ko-title"></div><div id="ko-sub"></div></div>
      <div id="result-cols"></div>
      <div id="wpm-chart" class="panel"></div>
      <div id="result-extra" class="panel"></div>
      <div id="result-bots" class="panel"></div>
      <div class="btn-row" id="result-btns"></div>`;
    const part = {
      title: dom.byId("ko-title"),
      sub: dom.byId("ko-sub"),
      cols: dom.byId("result-cols"),
      chart: dom.byId("wpm-chart"),
      extra: dom.byId("result-extra"),
      side: dom.byId("result-bots"),
      buttons: dom.byId("result-btns"),
    };

    const isRanked = (run) => !!run && run.kind === "ranked";
    const isPractice = (run) => !!run && run.kind === "practice";

    /** "stats:<id>" opens this match in My stats; plain "stats" when the fight was not recorded. */
    function statsAction() {
      const record = duelSession.lastRecord();
      return record ? "stats:" + record.id : "stats";
    }

    // ---------- The result ----------

    function youWon(run) {
      if (isPractice(run)) return false;
      const multi = !!run && run.rules.rounds > 1;
      return multi ? Modes.status(run.rules, run.wins).winner === 0 : duel.result.winner === 0;
    }

    function subLine(run) {
      const foe = duelSession.foeName();
      const how = duel.result.byTime ? `Time up after ${duel.t.toFixed(1)} s` : `K.O. after ${duel.t.toFixed(1)} s`;
      if (isPractice(run)) return `${how} against the dummy`;
      if (run && run.rules.rounds > 1) {
        return `Match ${run.wins[0]} to ${run.wins[1]} over ${run.round - 1} rounds against ${foe}`;
      }
      if (net.isMatch()) return `${how} against ${foe}, unranked online`;
      if (isRanked(run)) return `${how} against ${foe}, ranked preview`;
      return `${how} against ${foe} (about ${Math.round(duelSession.botConfig().beatAt)} wpm)`;
    }

    function column(typist, i, name) {
      return `<div class="rcol panel" style="--id:var(${i ? "--foe" : "--you"})"><h3>${esc(name)}</h3><dl>
    <dt>Average WPM</dt><dd>${duelSession.averageWpm(typist)}</dd><dt>Accuracy</dt><dd>${duelSession.accuracyText(typist)}</dd>
    <dt>Best combo</dt><dd>x${typist.stats.bestCombo}</dd><dt>Ultimates landed</dt><dd>${typist.stats.ultimates}</dd></dl></div>`;
    }

    function drawRanked() {
      const result = duelSession.rankedResult();
      part.extra.innerHTML = rankBadges.rankedPanel({ out: result.out, err: result.err, mode: "duel" }, true);
    }

    /** Draws the whole result. */
    function draw() {
      const run = session.current();
      const won = youWon(run);
      part.title.className = won ? "win" : "lose";
      part.title.textContent = isPractice(run) ? "KNOCKED OUT" : won ? "YOU WIN" : "YOU LOSE";
      part.sub.textContent = subLine(run);
      part.cols.innerHTML = column(duel.typists[0], 0, "YOU") + column(duel.typists[1], 1, duelSession.foeName());
      const you = dom.cssVar("--you");
      const foe = dom.cssVar("--foe");
      const record = duelSession.lastRecord();
      part.chart.innerHTML = net.isMatch() ? net.chartHtml(you, foe) : charts.resultChart(record, you, foe);
      chartHover.bind(part.chart);
      part.extra.innerHTML = net.isMatch() ? ONLINE_NOTE : charts.resultExtra(record);
      if (isRanked(run)) drawRanked();
      drawSide();
      return won;
    }

    // ---------- The way on ----------

    function botStrip() {
      const chips = bots.BOTS.map((card, i) => {
        const locked = bots.isLocked(i);
        const speed = locked ? "locked" : Math.round(bots.configFor(i).beatAt) + " wpm";
        return `<button class="bot-chip pick ${i === bots.picked() ? "sel" : ""}" data-act="duel-bot:${i}" tabindex="-1" ${locked ? "disabled" : ""}><b>${card.name}</b>${speed}</button>`;
      }).join("");
      return `<div class="card-label"><span>Pick another opponent</span><span></span></div>${chips}`;
    }

    /** The right part of the result: what you can do next. Redrawn when a setting or the online room changes. */
    function drawSide() {
      const run = session.current();
      const online = net.resultColumn();
      const stats = buttons.button(statsAction(), "My stats");
      const menu = buttons.button("menu", "Main menu");
      if (online) {
        part.side.innerHTML = online.column;
        part.buttons.innerHTML = online.buttons;
      } else if (isRanked(run)) {
        part.side.innerHTML = ""; // no opponent picker: queue again for a new opponent
        part.buttons.innerHTML =
          buttons.button("ranked:duel", "Queue again", { primary: true }) +
          buttons.button("profile", "Profile") +
          stats +
          menu;
      } else if (isPractice(run)) {
        part.side.innerHTML = practice.panelHtml();
        part.buttons.innerHTML = buttons.button("rematch", "Again", { primary: true }) + stats + menu;
      } else {
        part.side.innerHTML = botStrip();
        part.buttons.innerHTML =
          buttons.button("rematch", "Rematch", { primary: true }) +
          buttons.button("duel-next-bot", "Next opponent") +
          stats +
          menu;
      }
      if (router.current() === "result") keyline.set([buttons.keyChip("view", "words: " + settings.viewName())]);
    }

    /** Shows the result of the fight that just ended. */
    function show() {
      router.show("result");
      const won = draw();
      Sfx.play(won ? "win" : "lose");
    }

    /** Back to the result from another screen (the profile, My stats, the Fighter screen). */
    function restore() {
      router.show("result");
      drawSide();
    }

    // ---------- Keys ----------

    function onKey(e, key) {
      if (performance.now() - duelSession.resultShownAt() < CONFIG.theme.resultKeyDelay) return true; // still typing
      const run = session.current();
      if (key === "c") actions.run("fighter");
      else if (key === "h") actions.run("howto");
      else if (key === "t") actions.run(statsAction());
      else if (key === "s") actions.run("settings");
      else if (key === "f") actions.run("fullscreen");
      else if (e.key === "F2") {
        e.preventDefault();
        actions.run("view");
      } else if (e.key >= "1" && e.key <= String(bots.BOTS.length)) actions.run("duel-bot:" + (Number(e.key) - 1));
      else if (e.key === "Enter") actions.run(isRanked(run) ? "ranked:duel" : "rematch");
      else if (e.key === "Escape") actions.run("menu");
      else if (key === "p") actions.run("profile");
      return true;
    }

    events.on("duel:result", show);
    events.on("duel:ranked", () => {
      if (router.current() === "result" && isRanked(session.current())) drawRanked();
    });

    return Object.freeze({ show, restore, drawSide });
  },
);
