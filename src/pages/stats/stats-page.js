/**
 * My stats (#scr-stats): every saved Duel match, drawn from stats.js with plain DOM and SVG (no chart library).
 * Filters, headline numbers, the journey graph, personal bests, fight insights, the keyboard heat map, the activity
 * calendar and the match history (sort, export, import, delete). A match can be opened again with the same details
 * as right after the fight. Reads records and the theme; never touches a fight.
 */
CounterType.define(
  "stats-page",
  [
    "config",
    "router",
    "registry",
    "actions",
    "stats",
    "themes",
    "stats-charts",
    "chart-hover",
    "toast",
    "buttons",
    "keyline",
    "format",
    "dom",
  ],
  (CONFIG, router, registry, actions, Stats, Themes, charts, chartHover, toast, buttons, keyline, format, dom) => {
    "use strict";

    const DAY = 86400000;
    const PAGE_SIZE = 15;
    const MORE = 30;
    const MIN_KEY_TRIES = 8;
    const KEYBOARD_ROWS = [
      ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
      ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
      ["z", "x", "c", "v", "b", "n", "m"],
    ];
    const HISTORY_COLUMNS = [
      ["at", "Date"],
      ["bot", "Opponent"],
      ["won", "Result"],
      ["wpm", "WPM"],
      ["acc", "Accuracy"],
      ["secs", "Time"],
      ["combo", "Best combo"],
      ["mode", "Mode"],
    ];

    const ui = () => CONFIG.theme.ui;
    const esc = dom.escapeHtml;
    const fix = format.fixed;
    const when = (iso) =>
      new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    const whenTime = (iso) =>
      new Date(iso).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    const seg = (action, label, on) => buttons.segment(`st:${action}`, label, { selected: on });

    const state = {
      openId: null,
      range: "all",
      metric: "wpm",
      mode: "all",
      bot: "all",
      sort: "at",
      dir: -1,
      heat: "err",
      limit: PAGE_SIZE,
      confirm: false,
    };
    let returnTo = "title";

    const el = router.register({ id: "stats", className: "panel", restore: () => open(), onKey, onAction });

    // ---------- Data ----------

    function filtered() {
      let list = Stats.all();
      if (state.range !== "all") {
        const from = Date.now() - +state.range * DAY;
        list = list.filter((m) => Date.parse(m.at) >= from);
      }
      if (state.mode !== "all") list = list.filter((m) => m.mode === state.mode);
      if (state.bot !== "all") list = list.filter((m) => m.bot === state.bot);
      return list;
    }

    const botNames = () => [...new Set(Stats.all().map((m) => m.bot))];

    // ---------- Journey graph ----------

    const movingAverage = (values, width) =>
      values.map((_, i) => {
        const window = values.slice(Math.max(0, i - width + 1), i + 1);
        return window.reduce((a, b) => a + b, 0) / window.length;
      });

    function journey(list) {
      const u = ui();
      const metric = state.metric;
      if (list.length < 2) return `<div class="empty">Play at least two matches to see your journey.</div>`;
      const valueOf = (x) => {
        if (metric === "wpm") return x.wpm;
        if (metric === "acc") return x.acc;
        return x.won ? 100 : 0;
      };
      const values = list.map(valueOf);
      const average = movingAverage(values, 10);
      const n = list.length;
      const unit = metric === "wpm" ? " WPM" : "%";
      // First-week and latest-week averages (or the first and last five matches when the history is short).
      const t0 = Date.parse(list[0].at);
      const t1 = Date.now();
      let first = list.filter((x) => Date.parse(x.at) < t0 + 7 * DAY);
      let last = list.filter((x) => Date.parse(x.at) > t1 - 7 * DAY);
      if (first.length === list.length || last.length === list.length || !last.length) {
        first = list.slice(0, Math.min(5, Math.floor(n / 2)));
        last = list.slice(-Math.min(5, Math.floor(n / 2)));
      }
      const avgFirst = Stats.avg(first.map(valueOf));
      const avgLast = Stats.avg(last.map(valueOf));
      const gain = avgLast - avgFirst;
      const gainText = `<span class="gain ${gain >= 0 ? "up" : "down"}">${gain >= 0 ? "+" : ""}${fix(gain, 0)}${metric === "wpm" ? " WPM" : " points"} since you started</span>`;
      const W = 1000;
      const H = 220;
      const L = 44;
      const R = 12;
      const T = 12;
      const B = 26;
      const plotW = W - L - R;
      const plotH = H - T - B;
      let lo = 0;
      let hi = metric === "wpm" ? Math.ceil(Math.max(...values) / 20) * 20 : 100;
      if (metric === "acc") lo = Math.max(0, Math.floor(Math.min(...values) / 10) * 10 - 10);
      if (hi - lo < 20) hi = lo + 20;
      const X = (i) => L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
      const Y = (v) => T + plotH - ((v - lo) / (hi - lo)) * plotH;
      const grid = [0, 0.25, 0.5, 0.75, 1]
        .map((f) => {
          const v = lo + (hi - lo) * f;
          return `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${u.line}" stroke-width="1" opacity="0.5"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" fill="${u.dim}" font-size="12">${Math.round(v)}</text>`;
        })
        .join("");
      const reference = (v, label, side) =>
        `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${u.dim}" stroke-width="1" stroke-dasharray="3 5"/><text x="${side === "l" ? L + 6 : W - R - 6}" y="${Y(v) - 6}" text-anchor="${side === "l" ? "start" : "end"}" fill="${u.dim}" font-size="12">${label} ${fix(v)}</text>`;
      const dots =
        metric === "win"
          ? ""
          : values
              .map(
                (v, i) =>
                  `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3" fill="var(--you)" stroke="${u.surface}" stroke-width="2"/>`,
              )
              .join("");
      const trend = `<polyline points="${average.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="${u.info}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      const raw =
        metric === "win"
          ? ""
          : `<polyline points="${values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--you)" stroke-width="1" opacity="0.35"/>`;
      const points = JSON.stringify(
        list.map((x, i) => [
          X(i) / W,
          `Match ${i + 1}, ${when(x.at)} vs ${x.bot}: ${valueOf(x)}${unit} (average of last 10: ${fix(average[i])})${x.won ? ", won" : ", lost"}`,
        ]),
      );
      const subject = metric === "wpm" ? "speed" : metric === "acc" ? "accuracy" : "win rate";
      return `<div class="journey-head">${gainText}<span class="key-row"><span class="key-i"><i class="dot"></i>${metric === "win" ? "each match (won or lost)" : "each match"}</span><span class="key-i"><i style="background:${u.info}"></i>average of the last 10</span></span></div>
      <div class="hover-wrap" data-pts='${esc(points)}'>
        <svg viewBox="0 0 ${W} ${H}" class="journey" role="img" aria-label="Your ${subject} in every match, oldest to newest">
          ${grid}${reference(avgFirst, "first week", "l")}${reference(avgLast, "latest week", "r")}${raw}${dots}${trend}
          <text x="${L}" y="${H - 6}" fill="${u.dim}" font-size="12">${when(list[0].at)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" fill="${u.dim}" font-size="12">${when(list[n - 1].at)}</text></svg>
        <div class="cross"></div><div class="tip"></div></div>`;
    }

    // ---------- Keyboard heat map ----------

    function keyboard(list) {
      const u = ui();
      const totals = Stats.keyTotals(list);
      const speed = state.heat === "speed";
      const keys = Object.keys(totals).filter((k) => totals[k].tries >= MIN_KEY_TRIES);
      const maxErr = Math.max(0.05, ...keys.map((k) => totals[k].err));
      const times = keys.map((k) => totals[k].avgMs).filter((v) => v > 0);
      const lo = Math.min(...times, 1e9);
      const hi = Math.max(...times, 1);
      const S = 52;
      const G = 6;
      const offsets = [0, 0.5, 1.5];
      const heat = speed ? u.warn : u.danger;
      const cell = (k, r, c) => {
        const t = totals[k];
        const x = (c + offsets[r]) * (S + G);
        const y = r * (S + G);
        let fill = u.track;
        let label = "";
        if (t && t.tries >= MIN_KEY_TRIES) {
          const level = speed ? (hi > lo ? (t.avgMs - lo) / (hi - lo) : 0) : Math.min(1, t.err / maxErr);
          fill = Themes.mix(u.track, heat, 0.15 + 0.85 * level);
          label = speed ? Math.round(t.avgMs) + " ms" : fix(t.err * 100) + "%";
        }
        const light = Themes.contrast(fill, u.text) < Themes.contrast(fill, u.bg);
        const ink = light ? u.bg : u.text;
        const tip = t
          ? `${k.toUpperCase()}: ${t.tries} tries, ${t.misses} mistakes (${fix(t.err * 100)}%), ${Math.round(t.avgMs)} ms between keys`
          : `${k.toUpperCase()}: not typed yet`;
        return (
          `<g><title>${tip}</title><rect x="${x}" y="${y}" width="${S}" height="${S}" rx="4" fill="${fill}" stroke="${u.line}"/>` +
          `<text x="${x + 8}" y="${y + 20}" fill="${ink}" font-size="16" font-weight="700">${k.toUpperCase()}</text>` +
          `<text x="${x + S / 2}" y="${y + S - 9}" text-anchor="middle" fill="${ink}" font-size="12">${label}</text></g>`
        );
      };
      const svg = `<svg viewBox="0 0 ${10 * (S + G)} ${3 * (S + G)}" class="kbd" role="img" aria-label="Keyboard colored by ${speed ? "speed per key" : "mistakes per key"}">${KEYBOARD_ROWS.map((row, r) => row.map((k, c) => cell(k, r, c)).join("")).join("")}</svg>`;
      // The weakest keys, and the words that broke combos most often with that key in them.
      const weak = keys
        .sort((a, b) => totals[b].err - totals[a].err)
        .filter((k) => totals[k].misses > 0)
        .slice(0, 10);
      const missedCount = {};
      for (const m of list) for (const w of m.missedWords) missedCount[w] = (missedCount[w] || 0) + 1;
      const weakList = weak.length
        ? weak
            .map((k) => {
              const words = Object.keys(missedCount)
                .filter((w) => w.includes(k))
                .sort((a, b) => missedCount[b] - missedCount[a])
                .slice(0, 3);
              return `<li><b>${k.toUpperCase()}</b><span class="bar"><i style="width:${Math.max(4, (totals[k].err / maxErr) * 100)}%"></i></span><span class="num">${fix(totals[k].err * 100)}%</span><span class="ws">${words.map(esc).join(", ")}</span></li>`;
            })
            .join("")
        : `<li class="empty">Type a few matches and your weakest keys show up here.</li>`;
      const legend = `<span class="grad-key">${speed ? "faster" : "fewer mistakes"}<i class="grad" style="background:linear-gradient(90deg,${Themes.mix(u.track, heat, 0.15)},${heat})"></i>${speed ? "slower" : "more mistakes"}</span>`;
      return { svg, weakList, legend };
    }

    // ---------- Activity calendar ----------

    function calendar(list) {
      const u = ui();
      const perDay = Stats.perDay(list);
      const WEEKS = 26;
      const S = 14;
      const G = 3;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(today.getTime() - ((WEEKS - 1) * 7 + ((today.getDay() + 6) % 7)) * DAY); // a Monday
      const busiest = Math.max(1, ...Object.values(perDay));
      let cells = "";
      for (let w = 0; w < WEEKS; w++) {
        for (let d = 0; d < 7; d++) {
          const day = new Date(start.getTime() + (w * 7 + d) * DAY);
          if (day > today) continue;
          const count = perDay[Stats.dayKey(day)] || 0;
          const level = count ? 0.25 + 0.75 * Math.min(1, count / Math.max(4, busiest)) : 0;
          const label = day.toLocaleDateString(undefined, { day: "numeric", month: "short" });
          cells += `<rect x="${w * (S + G)}" y="${d * (S + G)}" width="${S}" height="${S}" rx="2" fill="${count ? Themes.mix(u.track, u.phosphor, level) : u.track}" opacity="${count ? 1 : 0.6}"><title>${label}: ${count} ${count === 1 ? "match" : "matches"}</title></rect>`;
        }
      }
      return `<svg viewBox="0 0 ${WEEKS * (S + G)} ${7 * (S + G)}" class="cal" role="img" aria-label="Matches per day, last ${WEEKS} weeks">${cells}</svg>`;
    }

    // ---------- The page ----------

    const tile = (label, value, sub) =>
      `<div class="tile"><span class="tl">${label}</span><b>${value}</b>${sub ? `<span class="ts">${sub}</span>` : ""}</div>`;
    const importButton = () =>
      `<label class="seg filebtn">Import JSON<input type="file" id="st-import" accept=".json,application/json" tabindex="-1"></label>`;
    const header = (title, backButton) =>
      `<div class="st-head"><h2 class="screen-title">${title}</h2><div class="btn-row">${backButton}</div></div>`;

    function page() {
      const all = Stats.all();
      const list = filtered();
      if (!all.length) {
        return `${header("My stats", buttons.button("back", "Back"))}
        <div class="empty big">No matches yet. Finish a fight and your speed, accuracy, best moves and weakest keys will show up here.<br><br>${importButton()}</div>`;
      }
      const o = Stats.overview(list);
      const bests = Stats.bests(list);
      const modeName = { all: "All", space: "Space ends word", auto: "Auto-end" };
      const botLabel = state.bot === "all" ? "All" : state.bot;
      const filters = `<div class="filters"><span class="fl">Range</span>${seg("range:all", "All time", state.range === "all")}${seg("range:90", "90 days", state.range === "90")}${seg("range:30", "30 days", state.range === "30")}
      <span class="fl">Typing mode</span>${["all", "space", "auto"].map((v) => seg("mode:" + v, modeName[v], state.mode === v)).join("")}
      <span class="fl">Opponent</span>${seg("bot:next", esc(botLabel) + " &#9656;", state.bot !== "all")}</div>`;
      let fighting = Math.floor(o.secs) + " s";
      if (o.secs >= 3600) fighting = format.duration(o.secs);
      else if (o.secs >= 60) fighting = Math.floor(o.secs / 60) + " min";
      const tiles =
        `<div class="tiles">${tile("Matches", o.played, `${o.wins} won, ${o.losses} lost`)}${tile("Win rate", o.winRate + "%")}${tile("Time fighting", fighting)}` +
        `${tile("Average WPM", fix(o.avgWpm), `last 10: ${fix(o.last10)}`)}${tile("Best WPM", o.bestWpm)}${tile("Accuracy", fix(o.avgAcc) + "%", `consistency ${fix(o.avgCons)}%`)}</div>`;
      const metricSegs = `${seg("metric:wpm", "Speed", state.metric === "wpm")}${seg("metric:acc", "Accuracy", state.metric === "acc")}${seg("metric:win", "Win rate", state.metric === "win")}`;
      const journeyBlock = `<section class="blk"><div class="blk-head"><h3>Your journey</h3><span class="segs">${metricSegs}</span></div>${list.length ? journey(list) : '<div class="empty">No matches in this range.</div>'}</section>`;
      const bestRows = bests
        .map(
          (b) =>
            `<tr><td>${esc(b.bot)}</td><td>${b.wins}/${b.played}</td><td>${b.ko === null ? "-" : fix(b.ko, 1) + " s"}</td><td>${b.wpm}</td><td>x${b.combo}</td></tr>`,
        )
        .join("");
      const bestsBlock = `<section class="blk"><h3>Personal bests</h3><table class="tbl"><thead><tr><th>Opponent</th><th>Won</th><th>Fastest K.O.</th><th>Best WPM</th><th>Best combo</th></tr></thead><tbody>${bestRows || '<tr><td colspan="5">Nothing in this range.</td></tr>'}</tbody></table></section>`;
      const f = fightInsights(list);
      const insights = `<section class="blk"><h3>Fight insights</h3><dl class="kv"><div><dt>Combos broken per match</dt><dd>${fix(f.broken, 1)}</dd></div><div><dt>Clean ultimates per match</dt><dd>${fix(f.ult, 1)}</dd></div>
      <div><dt>Counters per match</dt><dd>${fix(f.counters, 1)}</dd></div><div><dt>Time stunned per match</dt><dd>${fix(f.stunned, 1)} s</dd></div>
      <div><dt>Average of last 100</dt><dd>${fix(o.last100)} WPM</dd></div></dl><p class="says">${f.says}</p></section>`;
      const kb = keyboard(list);
      const keyBlock = `<section class="blk"><div class="blk-head"><h3>Keyboard</h3><span class="segs">${seg("heat:err", "Mistakes", state.heat === "err")}${seg("heat:speed", "Speed", state.heat === "speed")}</span></div>
      <div class="kb-grid"><div>${kb.svg}<div class="legend-row">${kb.legend}<span class="note">Keys need at least ${MIN_KEY_TRIES} tries to show a color.</span></div></div>
      <div><h4>Your 10 weakest keys</h4><ol class="weak">${kb.weakList}</ol></div></div></section>`;
      const calendarBlock = `<section class="blk"><h3>Activity, last 26 weeks</h3>${calendar(list)}</section>`;
      return `${header("My stats", buttons.button("back", "Back"))}
      ${filters}${tiles}${journeyBlock}<div class="two">${bestsBlock}${insights}</div>${keyBlock}${calendarBlock}${historyBlock(list)}`;
    }

    function fightInsights(list) {
      const n = Math.max(1, list.length);
      const sum = (pick) => list.reduce((a, m) => a + pick(m), 0);
      const out = {
        broken: sum((m) => m.fight.broken) / n,
        ult: sum((m) => m.fight.ultClean) / n,
        counters: sum((m) => m.fight.counters) / n,
        stunned: sum((m) => m.fight.stunned) / n,
        says: "",
      };
      const won = list.filter((m) => m.won);
      const lost = list.filter((m) => !m.won);
      if (won.length < 2 || lost.length < 2) {
        out.says = "Win and lose a few matches each and this shows what separates them.";
        return out;
      }
      const gaps = [
        [
          "speed",
          Stats.avg(won.map((m) => m.wpm)),
          Stats.avg(lost.map((m) => m.wpm)),
          "You type about",
          " WPM slower in matches you lose.",
        ],
        [
          "accuracy",
          Stats.avg(won.map((m) => m.acc)),
          Stats.avg(lost.map((m) => m.acc)),
          "Your accuracy drops about",
          " points in matches you lose.",
        ],
        [
          "combos",
          Stats.avg(won.map((m) => m.fight.broken)),
          Stats.avg(lost.map((m) => m.fight.broken)),
          "You break about",
          " more combos in matches you lose.",
        ],
      ];
      // The gap that matters most, as a share of the winning average (combos compare the other way round).
      let best = null;
      for (const [kind, winning, losing, before, after] of gaps) {
        const gap = kind === "combos" ? losing - winning : winning - losing;
        const share = winning ? gap / Math.max(1, winning) : 0;
        if (gap > 0 && (!best || share > best.share)) best = { share, text: `${before} ${fix(gap, 1)}${after}` };
      }
      out.says = best
        ? "What separates your wins from your losses: " + best.text
        : "Your wins and losses look alike so far.";
      return out;
    }

    // ---------- Match history ----------

    const sortValue = (m, key) => {
      if (key === "combo") return m.fight.bestCombo;
      if (key === "at") return Date.parse(m.at);
      return m[key];
    };

    function historyBlock(list) {
      const rows = list.slice().sort((a, b) => {
        const x = sortValue(a, state.sort);
        const y = sortValue(b, state.sort);
        return (x > y ? 1 : x < y ? -1 : 0) * state.dir;
      });
      const shown = rows.slice(0, state.limit);
      const head = HISTORY_COLUMNS.map(([key, label]) => {
        const arrow = state.sort === key ? (state.dir > 0 ? " &#9650;" : " &#9660;") : "";
        return `<th><button class="th ${state.sort === key ? "on" : ""}" data-act="st:sort:${key}" tabindex="-1">${label}${arrow}</button></th>`;
      }).join("");
      const body = shown
        .map(
          (m) =>
            `<tr class="click" data-act="st:open:${m.id}" tabindex="-1"><td>${whenTime(m.at)}</td><td>${esc(m.bot)}</td><td class="${m.won ? "w" : "l"}">${m.won ? "Won" : "Lost"}</td><td>${m.wpm}</td><td>${m.acc}%</td><td>${format.clock(m.secs)}</td><td>x${m.fight.bestCombo}</td><td>${m.mode === "auto" ? "Auto-end" : "Space"}</td></tr>`,
        )
        .join("");
      const more =
        rows.length > shown.length ? seg("more", `Show ${Math.min(MORE, rows.length - shown.length)} more`, false) : "";
      const wipeLabel = state.confirm ? "Click again to delete all" : "Delete all";
      return `<section class="blk"><div class="blk-head"><h3>Match history</h3><span class="segs">${more}
      ${seg("csv", "Export CSV", false)}${seg("json", "Export JSON", false)}${importButton()}
      ${buttons.segment("st:wipe", wipeLabel, { className: "danger" })}</span></div>
      <table class="tbl hist"><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="8">No matches in this range.</td></tr>'}</tbody></table>
      <p class="note">Click a match to open it again. The newest ${Stats.MAX} matches are kept on this computer.</p></section>`;
    }

    // One match opened again: the same result details as right after the fight.
    function detail(rec) {
      const u = ui();
      const c = rec.chars;
      const f = rec.fight;
      const you = dom.cssVar("--you", u.phosphor);
      const foe = dom.cssVar("--foe", u.danger);
      const words = rec.missedWords.length ? rec.missedWords.map(esc).join(", ") : "None, every word was clean.";
      return `${header(`${rec.won ? "You won" : "You lost"} against ${esc(rec.bot)}`, buttons.button("st:list", "All stats"))}
      <p class="sub">${whenTime(rec.at)}, ${format.clock(rec.secs)} long, ${rec.mode === "auto" ? "words ended automatically" : "Space ended words"}, you as ${esc(rec.char)}</p>
      <div class="tiles">${tile("Average WPM", rec.wpm)}${tile("Raw WPM", rec.raw, "every key counted")}${tile("Accuracy", rec.acc + "%")}${tile("Consistency", rec.cons + "%", "100% is perfectly steady")}${tile("Best combo", "x" + f.bestCombo)}${tile("Win at", rec.beatAt + " WPM", "for this opponent")}</div>
      <section class="blk"><div class="chart-head"><span>Speed and HP</span><span><span class="key-i"><i style="background:${you}"></i>YOU</span><span class="key-i"><i class="dash" style="color:${you}"></i>raw</span><span class="key-i"><i style="background:${foe}"></i>${esc(rec.bot)}</span><span class="key-i"><i class="tick"></i>mistake</span></span></div>${charts.chartSvg(rec, you, foe, true)}</section>
      <div class="two"><section class="blk"><h3>Characters</h3><dl class="kv"><div><dt>Right</dt><dd>${c.ok}</dd></div><div><dt>Wrong</dt><dd>${c.bad - c.extra}</dd></div><div><dt>Extra</dt><dd>${c.extra}</dd></div><div><dt>Missed</dt><dd>${c.missed}</dd></div></dl>
        <h3 class="mt">Words to practise</h3><p class="words">${words}</p></section>
      <section class="blk"><h3>The fight</h3><dl class="kv"><div><dt>Damage dealt</dt><dd>${f.dealt}</dd></div><div><dt>Damage taken</dt><dd>${f.taken}</dd></div><div><dt>Combos broken</dt><dd>${f.broken}</dd></div><div><dt>Counters</dt><dd>${f.counters}</dd></div>
        <div><dt>Ultimates (clean, messy)</dt><dd>${f.ultClean}, ${f.ultSloppy}</dd></div><div><dt>Time stunned</dt><dd>${f.stunned} s</dd></div></dl></section></div>
      <div class="btn-row">${buttons.button("st:del:" + rec.id, "Delete this match")}</div>`;
    }

    // ---------- Render, open, close ----------

    function render() {
      const scroll = el.scrollTop;
      const rec = state.openId ? Stats.find(state.openId) : null;
      el.innerHTML = rec ? detail(rec) : page();
      el.scrollTop = scroll;
      chartHover.bind(el);
      const importer = el.querySelector("#st-import");
      if (importer) importer.addEventListener("change", () => importFile(importer.files && importer.files[0]));
    }

    function importFile(file) {
      if (!file) return;
      file
        .text()
        .then((text) => {
          const json = JSON.parse(text);
          const added = Stats.importList(Array.isArray(json) ? json : json.matches);
          toast.show(added ? `Imported ${added} ${added === 1 ? "match" : "matches"}.` : "Nothing new to import.");
          render();
        })
        .catch(() => toast.show("That file is not a CounterType stats file."));
    }

    /** Opens My stats, on one match when `id` is given. */
    function open(id) {
      const from = router.current();
      if (from === "title" || from === "result" || from === "profile") returnTo = from;
      state.openId = id || null;
      state.confirm = false;
      state.limit = PAGE_SIZE;
      router.show("stats");
      el.scrollTop = 0;
      keyline.clear(); // the panel has its own Back button
      render();
    }

    function close() {
      state.openId = null;
      router.restore(returnTo);
    }

    function download(name, text, type) {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function csv() {
      const head = [
        "date",
        "opponent",
        "result",
        "wpm",
        "raw_wpm",
        "accuracy",
        "consistency",
        "seconds",
        "best_combo",
        "damage_dealt",
        "damage_taken",
        "combos_broken",
        "mode",
        "fighter",
      ];
      const rows = Stats.all().map((m) => [
        m.at,
        m.bot,
        m.won ? "won" : "lost",
        m.wpm,
        m.raw,
        m.acc,
        m.cons,
        m.secs,
        m.fight.bestCombo,
        m.fight.dealt,
        m.fight.taken,
        m.fight.broken,
        m.mode,
        m.char,
      ]);
      return [head]
        .concat(rows)
        .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");
    }

    // ---------- Input ----------

    // Page actions: "st:<what>:<value>".
    function act(what, value) {
      if (what !== "wipe") state.confirm = false;
      switch (what) {
        case "range":
          state.range = value;
          state.limit = PAGE_SIZE;
          break;
        case "mode":
          state.mode = value;
          state.limit = PAGE_SIZE;
          break;
        case "metric":
          state.metric = value;
          break;
        case "heat":
          state.heat = value;
          break;
        case "bot": {
          const names = ["all"].concat(botNames());
          state.bot = names[(Math.max(0, names.indexOf(state.bot)) + 1) % names.length];
          state.limit = PAGE_SIZE;
          break;
        }
        case "sort":
          if (state.sort === value) state.dir = -state.dir;
          else {
            state.sort = value;
            state.dir = value === "bot" || value === "mode" ? 1 : -1;
          }
          break;
        case "more":
          state.limit += MORE;
          break;
        case "open":
          state.openId = value;
          el.scrollTop = 0;
          break;
        case "list":
          state.openId = null;
          break;
        case "del":
          Stats.remove(value);
          state.openId = null;
          toast.show("Match deleted.");
          break;
        case "csv":
          download("type-boxing-matches.csv", csv(), "text/csv");
          return;
        case "json":
          download("type-boxing-stats.json", JSON.stringify({ v: 1, matches: Stats.all() }), "application/json");
          return;
        case "wipe":
          if (state.confirm) {
            Stats.clear();
            state.confirm = false;
            toast.show("All stats deleted.");
          } else {
            state.confirm = true;
          }
          break;
        default:
          return;
      }
      render();
    }

    /** Back: from one match to the list, from the list to where you came from. */
    function back() {
      if (state.openId) {
        state.openId = null;
        render();
        return;
      }
      close();
    }

    function onKey(e, key) {
      if (e.key === "Escape" || key === "t") actions.run("back");
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        el.scrollBy({ top: e.key === "ArrowUp" ? -90 : 90 });
      }
      return true;
    }

    function onAction(name, x, y) {
      if (name === "back") back();
      else if (name === "st") act(x, y);
      else return false;
      return true;
    }

    actions.on("stats", (x, y, top) => {
      const from = router.current();
      if (top || !["title", "result", "profile"].includes(from)) return;
      open(x);
    });

    // The Profile page links here (T).
    registry.add("profile-link", {
      id: "stats",
      order: 10,
      button: buttons.button("stats", "Duel stats"),
      key: "t",
      action: "stats",
    });

    return Object.freeze({ open, close });
  },
);
