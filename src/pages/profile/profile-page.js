/**
 * Profile (#scr-profile): who you are (Name#tag, country, region), your character, your rank in each mode,
 * headline numbers across every mode, and one history of every match you played.
 *
 * The page knows no game mode. Modes add to it through the registry:
 *   "profile-history" { id, mode, label, order, entries() }
 *       its matches: { at, mode, ranked, foe, result, win, wpm, acc, rp }
 *   "profile-tile"    { id, order, tile(history) }
 *       a headline number: { label, value, sub } or null
 *   "profile-extra"   { id, order, html(), draw(root), button, key, action }
 *       more about your character (the Race vehicle)
 *   "profile-link"    { id, order, button, key, action }
 *       a header button (My stats)
 * Writes only through Backend.rename and Backend.setCountry.
 */
CounterType.define(
  "profile-page",
  [
    "router",
    "registry",
    "actions",
    "events",
    "session",
    "player",
    "backend",
    "profile",
    "ranked",
    "rank-badges",
    "fighter-stage",
    "settings",
    "loop",
    "toast",
    "buttons",
    "keyline",
    "config",
    "dom",
  ],
  (
    router,
    registry,
    actions,
    events,
    session,
    player,
    Backend,
    Profile,
    Ranked,
    rankBadges,
    DuelChars,
    settings,
    loop,
    toast,
    buttons,
    keyline,
    CONFIG,
    dom,
  ) => {
    "use strict";

    const HISTORY_ROWS = 25;
    const RANKED_MATCH_WINDOW_MS = 8000; // a ranked result and its match record are this close in time
    const esc = dom.escapeHtml;

    const state = { ranked: null, rankedMatches: null, err: false, filter: "all", editing: false, nameErr: "" };
    let returnTo = "title";

    const el = router.register({ id: "profile", className: "panel", restore: () => open(), onKey, onAction });

    const isOpen = () => router.current() === "profile";
    const when = (at) => {
      const d = new Date(at);
      if (isNaN(d)) return "";
      const day = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
      return day + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    };

    function load() {
      state.err = false;
      Promise.all([Backend.getAllRanked(), Backend.rankedHistory()])
        .then(([records, list]) => {
          state.ranked = records;
          state.rankedMatches = list;
          if (isOpen()) render();
        })
        .catch(() => {
          state.err = true;
          if (isOpen()) render();
        });
    }

    // Every match in this browser, newest first, from every mode that keeps a history.
    function history() {
      const out = registry.list("profile-history").flatMap((provider) => provider.entries());
      // RP changes come from the ranked match list (Backend), matched by mode and time.
      for (const m of (state.ranked && state.rankedMatches) || []) {
        const entry = out.find(
          (x) => x.mode === m.mode && x.ranked && x.rp === undefined && Math.abs(x.at - m.at) < RANKED_MATCH_WINDOW_MS,
        );
        if (entry) entry.rp = m.delta;
      }
      return out.sort((a, b) => b.at - a.at);
    }

    function rankCard(mode, label) {
      const r = state.ranked && state.ranked[mode];
      if (!r) {
        return `<div class="pf-rank panel loading"><div class="card-label"><span>${label}</span><span></span></div><div class="skel w60"></div><div class="skel w90"></div></div>`;
      }
      const season = Ranked.seasonOf(Date.now());
      const peak =
        r.seasons && r.seasons[0]
          ? `Last season ${r.seasons[0].tier}`
          : `Season ${season.id}, ${season.daysLeft} days left`;
      const placements = `<p class="opt-note">${r.placementsLeft} placement match${r.placementsLeft > 1 ? "es" : ""} to a rank.</p>`;
      return `<div class="pf-rank panel" style="--tc:${r.tier ? r.tier.color : "var(--line)"}">
      <div class="card-label"><span>${label}</span><span>${r.rank ? "#" + r.rank + " global" : ""}</span></div>
      <div class="pf-tier">${rankBadges.badge(r.tier, r.placementsLeft)}${r.placementsLeft ? "" : `<b>${r.rp} RP</b>`}</div>
      ${r.placementsLeft ? placements : rankBadges.rpBar(r.rp, r.tier)}
      <dl class="kv"><div><dt>Record</dt><dd>${r.wins} W ${r.losses} L</dd></div><div><dt>Hidden rating</dt><dd>${r.mmr}</dd></div><div><dt>Season</dt><dd>${peak}</dd></div></dl>
      ${buttons.button("ranked:" + mode, "Play ranked")}</div>`;
    }

    function tilesHtml(list) {
      const accuracies = list.filter((x) => x.acc > 0).map((x) => x.acc);
      const core = [
        { id: "matches", order: 10, tile: () => ({ label: "Matches", value: list.length, sub: "every mode" }) },
        {
          id: "accuracy",
          order: 50,
          tile: () => ({
            label: "Accuracy",
            value: accuracies.length
              ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) + "%"
              : "-",
            sub: "average",
          }),
        },
      ];
      const tiles = core
        .concat(registry.list("profile-tile"))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((item) => item.tile(list))
        .filter(Boolean)
        .map(
          (t) =>
            `<div class="tile"><span class="tl">${t.label}</span><b>${t.value}</b><span class="ts">${t.sub}</span></div>`,
        )
        .join("");
      return `<div class="tiles">${tiles}</div>`;
    }

    function historyHtml(list) {
      const filter = state.filter;
      const shown = list
        .filter((x) => filter === "all" || (filter === "ranked" ? x.ranked : x.mode === filter))
        .slice(0, HISTORY_ROWS);
      const filters = [["all", "All"]]
        .concat(registry.list("profile-history").map((provider) => [provider.mode, provider.label]))
        .concat([["ranked", "Ranked"]])
        .map(([value, label]) => buttons.segment(`pf:filter:${value}`, label, { selected: filter === value }))
        .join("");
      const rows = shown
        .map((x) => {
          const rp = x.rp === undefined || x.rp === null ? "" : (x.rp >= 0 ? "+" : "") + x.rp;
          return (
            `<tr><td>${when(x.at)}</td><td>${rankBadges.modeLabel(x.mode)}${x.ranked ? ' <span class="tag-r">R</span>' : ""}</td><td>${esc(x.foe || "")}</td>` +
            `<td class="${x.win ? "w" : "l"}">${x.result}</td><td>${x.wpm || "-"}</td><td>${x.acc ? x.acc + "%" : "-"}</td><td>${rp}</td></tr>`
          );
        })
        .join("");
      const empty =
        filter === "all"
          ? "No matches yet. Play a race or a duel and it shows up here."
          : "Nothing here yet for this filter.";
      const table = shown.length
        ? `<table class="tbl"><thead><tr><th>When</th><th>Mode</th><th>Opponent</th><th>Result</th><th>WPM</th><th>Acc</th><th>RP</th></tr></thead><tbody>${rows}</tbody></table>`
        : `<p class="note">${empty}</p>`;
      return `<div class="blk"><div class="blk-head"><h3>History</h3><span class="segs">${filters}</span></div>${table}</div>`;
    }

    function identityHtml(me) {
      if (state.editing) {
        const hint =
          state.nameErr ||
          "3 to 16 letters, digits, spaces or underscores. Names can repeat; your tag keeps you unique. One change every 30 days.";
        return `<div class="pf-edit"><input id="pf-name" type="text" maxlength="${Profile.NAME_MAX}" value="${esc(me.name)}" spellcheck="false" autocomplete="off" aria-label="Display name" data-enter-act="pf:save">
          ${buttons.button("pf:save", "Save", { primary: true })}${buttons.button("pf:cancel", "Cancel")}</div>
         <p class="pf-hint ${state.nameErr ? "err" : ""}">${hint}</p>`;
      }
      return `<div class="pf-name"><b>${esc(me.name)}</b><i>#${me.tag}</i>${buttons.segment("pf:edit", "Edit name")}</div>`;
    }

    function render() {
      const me = Profile.get();
      const def = player.def(player.fighter());
      const list = history();
      const extras = registry.list("profile-extra");
      const links = registry.list("profile-link");
      const countries = Profile.COUNTRIES.map(
        ([code, name]) => `<option value="${code}" ${code === me.country ? "selected" : ""}>${name}</option>`,
      ).join("");
      const ranks = state.err
        ? `<div class="blk"><p class="note">Ranked data could not load.</p>${buttons.button("pf:retry", "Retry")}</div>`
        : `<div class="pf-ranks">${session
            .rankedLadders()
            .map(([mode, label]) => rankCard(mode, label))
            .join("")}</div>`;
      el.innerHTML = `
      <div class="st-head"><h2 class="screen-title">Profile</h2><div class="btn-row">${buttons.button("leaders", "Leaderboards")}${links.map((link) => link.button).join("")}${buttons.button("back", "Back", { primary: true })}</div></div>
      <div class="pf-top">
        <div class="pf-id panel">
          ${identityHtml(me)}
          <div class="pf-row"><label for="pf-country">Country</label><select id="pf-country" tabindex="-1">${countries}</select><span class="pf-region">Region: ${Profile.regionName(me.region)}</span></div>
          <div class="pf-row"><span class="pf-local">Saved in this browser.</span>${buttons.segment("pf:signin", "Sign in with Google")}</div>
        </div>
        <div class="pf-char panel">
          <canvas id="pf-preview" width="200" height="232" aria-label="Your fighter"></canvas>
          <div class="pf-char-info">
            <div class="card-label"><span>Character</span><span></span></div>
            <b class="pf-fname">${def ? esc(def.name) : ""}</b><span class="pf-ftitle">${def ? esc(def.title) : ""}</span>
            <div class="pf-swatch"><i style="background:${CONFIG.chars.you.body}"></i>Identity color</div>
            ${extras.map((extra) => extra.html()).join("")}
            <div class="btn-row left">${buttons.button("fighter", "Fighter")}${extras.map((extra) => extra.button || "").join("")}</div>
          </div>
        </div>
      </div>
      ${ranks}
      ${tilesHtml(list)}
      ${historyHtml(list)}`;
      for (const extra of extras) if (extra.draw) extra.draw(el);
      const portrait = el.querySelector("#pf-preview");
      if (portrait) {
        const ratio = dom.pixelRatio(2);
        portrait.width = 200 * ratio;
        portrait.height = 232 * ratio;
      }
      const country = el.querySelector("#pf-country");
      if (country) {
        country.addEventListener("change", () => {
          Backend.setCountry(country.value).then(() => render());
          country.blur();
        });
      }
      const nameBox = el.querySelector("#pf-name");
      if (nameBox) {
        nameBox.focus();
        nameBox.select();
      }
      keyline.clear();
    }

    /** Opens the profile. */
    function open() {
      const from = router.current();
      if (from === "title" || from === "result" || from === "mresult") returnTo = from;
      state.editing = false;
      state.nameErr = "";
      router.show("profile");
      load();
      render();
    }

    function close() {
      state.editing = false;
      router.restore(returnTo);
    }

    function saveName() {
      const box = el.querySelector("#pf-name");
      if (!box) return;
      Backend.rename(box.value).then((result) => {
        if (!result.ok) {
          state.nameErr = result.error;
          render();
          return;
        }
        state.editing = false;
        state.nameErr = "";
        toast.show(`You are now ${Profile.label()}.`);
        render();
      });
    }

    // ---------- Input ----------

    function act(what, value) {
      if (what === "filter") {
        state.filter = value;
        render();
      } else if (what === "edit") {
        state.editing = true;
        state.nameErr = "";
        render();
      } else if (what === "cancel") {
        state.editing = false;
        render();
      } else if (what === "save") saveName();
      else if (what === "retry") {
        load();
        render();
      } else if (what === "signin") Backend.signIn().then((result) => toast.show(result.error || "Signed in."));
    }

    function onKey(e, key) {
      if (state.editing) {
        if (e.key === "Escape") actions.run("pf:cancel");
        else if (e.key === "Enter") actions.run("pf:save");
        return true;
      }
      const extra = registry
        .list("profile-extra")
        .concat(registry.list("profile-link"))
        .find((item) => item.key && item.key === key);
      if (e.key === "Escape") actions.run("back");
      else if (key === "l") actions.run("leaders");
      else if (key === "c") actions.run("fighter");
      else if (extra) actions.run(extra.action);
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        el.scrollBy({ top: e.key === "ArrowUp" ? -90 : 90 });
      }
      return true;
    }

    function onAction(name, x, y) {
      if (name === "back") close();
      else if (name === "pf") act(x, y);
      else return false;
      return true;
    }

    actions.on("profile", (x, y, top) => {
      if (!top && ["title", "result", "mresult", "leaders"].includes(router.current())) open();
    });

    // The portrait plays your fighter.
    loop.onFrame((dt) => {
      const canvas = isOpen() ? el.querySelector("#pf-preview") : null;
      if (canvas) DuelChars.drawPreview(canvas, player.fighter(), dt, settings.values.reduceMotion);
    });
    events.on("player:changed", () => {
      if (isOpen()) render();
    });

    return Object.freeze({ open, close });
  },
);
