/**
 * Leaderboards (#scr-leaders): one board per ranked mode, global, your region or your country, 50 rows a page, your
 * own row highlighted (or pinned under the table when it is off the page). Data comes from the backend (mocked
 * players until the server exists), so the screen has real loading, empty and error states.
 */
CounterType.define(
  "leaderboard-page",
  ["router", "actions", "session", "backend", "profile", "ranked", "rank-badges", "buttons", "keyline", "dom"],
  (router, actions, session, Backend, Profile, Ranked, rankBadges, buttons, keyline, dom) => {
    "use strict";

    const PAGE = 50;
    const SKELETON_ROWS = 10;
    const esc = dom.escapeHtml;

    const state = { mode: "duel", scope: "global", offset: 0, data: null, loading: false, err: false, request: 0 };
    let returnTo = "title";

    const el = router.register({ id: "leaders", className: "panel", restore: () => open(), onKey, onAction });
    const isOpen = () => router.current() === "leaders";

    function scopeKey() {
      const me = Profile.get();
      if (state.scope === "region") return me.region;
      if (state.scope === "country") return me.country;
      return null;
    }

    function load() {
      const request = ++state.request;
      state.loading = true;
      state.err = false;
      render();
      Backend.leaderboard(state.mode, state.scope, scopeKey(), state.offset)
        .then((data) => {
          if (request !== state.request) return;
          state.data = data;
          state.loading = false;
          if (isOpen()) render();
        })
        .catch(() => {
          if (request !== state.request) return;
          state.loading = false;
          state.err = true;
          if (isOpen()) render();
        });
    }

    function row(p, you) {
      const winRate = p.games ? Math.round((100 * p.wins) / p.games) : 0;
      const tier = p.tier ? rankBadges.badge(p.tier) : rankBadges.badge(null, p.placementsLeft);
      return (
        `<tr class="${you ? "you" : ""}"><td class="rk">${p.rank || "-"}</td><td class="pl">${esc(p.name)}<i>#${p.tag}</i></td><td>${Profile.countryName(p.country)}</td>` +
        `<td>${tier}</td><td class="num">${p.rp}</td><td class="num">${p.wins}-${p.games - p.wins}</td><td class="num">${winRate}%</td></tr>`
      );
    }

    function tableHtml(me) {
      const d = state.data;
      if (state.err) {
        return `<div class="lb-empty"><p class="note">The leaderboard could not load.</p>${buttons.button("lb:retry", "Retry")}</div>`;
      }
      if (state.loading || !d) {
        const skeleton = Array.from(
          { length: SKELETON_ROWS },
          () => `<tr class="skel-row"><td colspan="7"><div class="skel w90"></div></td></tr>`,
        ).join("");
        return `<table class="tbl lb"><tbody>${skeleton}</tbody></table>`;
      }
      if (!d.rows.length) return `<div class="lb-empty"><p class="note">Nobody is ranked here yet.</p></div>`;
      const youOnPage = d.rows.some((p) => p.you);
      let footer = "";
      if (!youOnPage) {
        const left = d.you.placementsLeft;
        const how = left
          ? `finish ${left} placement match${left > 1 ? "es" : ""} to appear here`
          : "play a ranked match to appear here";
        footer = d.you.rank
          ? `<tfoot>${row(d.you, true)}</tfoot>`
          : `<tfoot><tr class="you"><td class="rk">-</td><td class="pl" colspan="6">${esc(me.name)}<i>#${me.tag}</i> ${how}</td></tr></tfoot>`;
      }
      return `<table class="tbl lb"><thead><tr><th>#</th><th>Player</th><th>Country</th><th>Tier</th><th class="num">RP</th><th class="num">W-L</th><th class="num">Win</th></tr></thead>
        <tbody>${d.rows.map((p) => row(p, p.you)).join("")}</tbody>
        ${footer}</table>`;
    }

    function pagerHtml() {
      const d = state.data;
      if (!d || state.loading) return "";
      const findMe = d.you.rank ? buttons.segment("lb:me", "Find me") : "";
      return (
        `<div class="lb-pager">${buttons.segment("lb:page:-1", "Previous 50", { disabled: !state.offset })}` +
        `<span>${state.offset + 1} to ${Math.min(d.total, state.offset + PAGE)} of ${d.total}</span>` +
        `${buttons.segment("lb:page:1", "Next 50", { disabled: state.offset + PAGE >= d.total })}${findMe}</div>`
      );
    }

    function render() {
      if (!isOpen()) return;
      const me = Profile.get();
      const tabs = session
        .rankedLadders()
        .map(
          ([mode, label]) =>
            `<button class="tab ${state.mode === mode ? "sel" : ""}" data-act="lb:mode:${mode}" tabindex="-1">${label}</button>`,
        )
        .join("");
      const scopes = [
        ["global", "Global"],
        ["region", Profile.regionName(me.region)],
        ["country", Profile.countryName(me.country)],
      ]
        .map(([value, label]) => buttons.segment(`lb:scope:${value}`, label, { selected: state.scope === value }))
        .join("");
      const season = Ranked.seasonOf(Date.now());
      el.innerHTML = `
      <div class="st-head"><h2 class="screen-title">Leaderboards</h2><div class="btn-row">${buttons.button("profile", "Profile")}${buttons.button("back", "Back", { primary: true })}</div></div>
      <div class="tabs">${tabs}</div>
      <div class="lb-bar"><span class="segs">${scopes}</span><span class="lb-season">Season ${season.id}, ${season.daysLeft} days left. Grandmaster: the top Masters of the board.</span></div>
      <div class="lb-wrap">${tableHtml(me)}</div>${pagerHtml()}
      <p class="q-preview">Preview: the other players are simulated until online ranked launches. Your own row is real.</p>`;
      keyline.clear();
    }

    /** Opens the boards, on a mode's board when one is named. */
    function open(mode) {
      const from = router.current();
      if (from === "title" || from === "result" || from === "mresult" || from === "profile") returnTo = from;
      if (mode) state.mode = mode;
      state.offset = 0;
      router.show("leaders");
      load();
    }

    function close() {
      router.restore(returnTo);
    }

    function act(what, value) {
      if (what === "mode") {
        state.mode = value;
        state.offset = 0;
        load();
      } else if (what === "scope") {
        state.scope = value;
        state.offset = 0;
        load();
      } else if (what === "page") {
        state.offset = Math.max(0, state.offset + PAGE * +value);
        load();
      } else if (what === "me" && state.data && state.data.you.rank) {
        state.offset = Math.floor((state.data.you.rank - 1) / PAGE) * PAGE;
        load();
      } else if (what === "retry") load();
    }

    function cycleMode(direction) {
      const modes = session.rankedLadders().map(([mode]) => mode);
      const at = modes.indexOf(state.mode);
      act("mode", modes[(at + direction + modes.length) % modes.length]);
    }

    function onKey(e, key) {
      if (e.key === "Escape") actions.run("back");
      else if (key === "p") actions.run("profile");
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        cycleMode(e.key === "ArrowLeft" ? -1 : 1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        el.scrollBy({ top: e.key === "ArrowUp" ? -90 : 90 });
      }
      return true;
    }

    function onAction(name, x, y) {
      if (name === "back") close();
      else if (name === "lb") act(x, y);
      else return false;
      return true;
    }

    actions.on("leaders", (x, y, top) => {
      if (!top && ["title", "result", "mresult", "profile"].includes(router.current())) open(x);
    });

    return Object.freeze({ open, close });
  },
);
