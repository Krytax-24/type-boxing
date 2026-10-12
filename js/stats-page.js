// The Stats page ("My stats") and the richer result screen. Drawn from the saved match records (js/stats.js) with
// plain DOM and SVG, no chart library. Reads records and the theme; never touches the duel or the rules.
//
// Colors come from the theme: the player's identity color for their own numbers, `info` for the trend line,
// `danger` for mistakes and `phosphor` for activity. Charts have a legend when they show more than one thing, a hover
// tooltip, and text values for every mark, so no meaning is color alone.
const StatsPage = (() => {
  const U = () => CONFIG.theme.ui;
  const state = { root: null, openId: null, range: "all", metric: "wpm", mode: "all", bot: "all", sort: "at", dir: -1, heat: "err", limit: 15, confirm: false };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fix = (n, d = 0) => (isFinite(n) ? n.toFixed(d) : "0");
  const DAY = 86400000;
  const when = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const whenTime = (iso) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const mmss = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  const dur = (s) => (s >= 3600 ? Math.floor(s / 3600) + " h " + Math.floor((s % 3600) / 60) + " min" : s >= 60 ? Math.floor(s / 60) + " min " + Math.floor(s % 60) + " s" : Math.floor(s) + " s");
  const seg = (act, label, on) => `<button class="seg ${on ? "sel" : ""}" data-act="st:${act}" tabindex="-1">${label}</button>`;

  // ---------- the result screen's chart and numbers ----------
  // Speed over the match: your WPM, your raw WPM (every key, dashed), the opponent's WPM, a red tick under every
  // mistake, and both HP lines underneath so you can see where the fight turned.
  function chartSvg(rec, you, foe, tall) {
    const u = U(), W = 600, H = tall ? 120 : 64, HP = tall ? 40 : 22, tr = rec.trace || [], n = tr.length;
    if (n < 2) return `<div class="chart-empty">No speed graph for this match.</div>`;
    const top = Math.max(40, ...tr.map((p) => Math.max(p[0], p[1], p[2])));
    const max = Math.ceil(top / 20) * 20;
    const X = (i) => ((i / (n - 1)) * W).toFixed(1), Y = (v) => (H - (v / max) * H).toFixed(1);
    const line = (k) => tr.map((p, i) => `${X(i)},${Y(p[k])}`).join(" ");
    const grid = [0.5, 1].map((f) => `<line x1="0" x2="${W}" y1="${H - f * H}" y2="${H - f * H}" stroke="${u.line}" stroke-width="1" stroke-dasharray="2 4"/>`).join("");
    const ylab = [0.5, 1].map((f) => `<span class="ylab" style="top:${((1 - f) * 100).toFixed(1)}%">${Math.round(max * f)}</span>`).join("");
    const span = (rec.secs || n / 2) || 1;
    const ticks = (rec.typos || []).map((t) => `<line x1="${Math.min(W, (t / span) * W).toFixed(1)}" x2="${Math.min(W, (t / span) * W).toFixed(1)}" y1="${H - 9}" y2="${H}" stroke="${u.danger}" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join("");
    const hp = (k, c) => `<polyline points="${tr.map((p, i) => `${X(i)},${(HP - (p[k] / 100) * HP).toFixed(1)}`).join(" ")}" fill="none" stroke="${c}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
    const pts = JSON.stringify(tr.map((p, i) => [i / (n - 1), `${mmss(i / 2)}  YOU ${p[0]} WPM (raw ${p[1]})  ${esc(rec.bot)} ${p[2]} WPM  HP ${p[3]} / ${p[4]}`]));
    return `<div class="hover-wrap" data-pts='${esc(pts).replace(/'/g, "&#39;")}'>
      <div class="sp">${ylab}<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="speed" role="img" aria-label="Words per minute over the match">${grid}
        <line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="${u.line}" stroke-width="1"/>${ticks}
        <polyline points="${line(2)}" fill="none" stroke="${foe}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
        <polyline points="${line(1)}" fill="none" stroke="${you}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.65" vector-effect="non-scaling-stroke"/>
        <polyline points="${line(0)}" fill="none" stroke="${you}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg></div>
      <svg viewBox="0 0 ${W} ${HP}" preserveAspectRatio="none" class="hpline" role="img" aria-label="Both fighters' HP over the match">
        <line x1="0" x2="${W}" y1="${HP}" y2="${HP}" stroke="${u.line}" stroke-width="1"/>${hp(4, foe)}${hp(3, you)}</svg>
      <div class="cross"></div><div class="tip"></div></div>`;
  }
  function resultChart(rec, you, foe) {
    if (!rec) return "";
    return `<div class="chart-head"><span>Speed and HP, ${fix(rec.secs)} s</span><span>` +
      `<span class="key-i"><i style="background:${you}"></i>YOU</span><span class="key-i"><i class="dash" style="color:${you}"></i>your raw WPM</span>` +
      `<span class="key-i"><i style="background:${foe}"></i>${esc(rec.bot)}</span><span class="key-i"><i class="tick"></i>mistake</span></span></div>` + chartSvg(rec, you, foe, false);
  }
  function resultExtra(rec) {
    if (!rec) return "";
    const c = rec.chars, words = rec.missedWords.slice(0, 6);
    return `<dl class="extra">
      <div><dt>Consistency</dt><dd>${rec.cons}%</dd></div>
      <div><dt>Raw WPM</dt><dd>${rec.raw}</dd></div>
      <div><dt>Characters</dt><dd>${c.ok} right, ${c.bad - c.extra} wrong, ${c.extra} extra, ${c.missed} missed</dd></div>
      <div class="wide"><dt>Words to practise</dt><dd>${words.length ? words.map(esc).join(", ") : "none, a clean match"}</dd></div></dl>`;
  }

  // Hover for a chart: a vertical line and a tooltip that follow the mouse. Works on any .hover-wrap with data-pts.
  function bindHover(root) {
    root.querySelectorAll(".hover-wrap").forEach((wrap) => {
      let pts;
      try { pts = JSON.parse(wrap.dataset.pts || "[]"); } catch (e) { pts = []; }
      if (!pts.length) return;
      const cross = wrap.querySelector(".cross"), tip = wrap.querySelector(".tip");
      wrap.addEventListener("mousemove", (e) => {
        const r = wrap.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        let best = pts[0];
        for (const p of pts) if (Math.abs(p[0] - f) < Math.abs(best[0] - f)) best = p;
        cross.style.left = best[0] * 100 + "%"; cross.style.display = "block";
        tip.textContent = best[1]; tip.style.display = "block";
        tip.style.left = Math.min(70, Math.max(0, best[0] * 100 - 8)) + "%";
      });
      wrap.addEventListener("mouseleave", () => { cross.style.display = "none"; tip.style.display = "none"; });
    });
  }

  // ---------- data for the page ----------
  function data() {
    let list = Stats.all();
    if (state.range !== "all") { const from = Date.now() - +state.range * DAY; list = list.filter((m) => Date.parse(m.at) >= from); }
    if (state.mode !== "all") list = list.filter((m) => m.mode === state.mode);
    if (state.bot !== "all") list = list.filter((m) => m.bot === state.bot);
    return list;
  }
  const botNames = () => [...new Set(Stats.all().map((m) => m.bot))];

  // ---------- journey graph ----------
  const movingAvg = (v, w) => v.map((_, i) => { const s = v.slice(Math.max(0, i - w + 1), i + 1); return s.reduce((a, b) => a + b, 0) / s.length; });
  function journey(list) {
    const u = U(), m = state.metric;
    if (list.length < 2) return `<div class="empty">Play at least two matches to see your journey.</div>`;
    const val = (x) => (m === "wpm" ? x.wpm : m === "acc" ? x.acc : x.won ? 100 : 0);
    const vals = list.map(val), mv = movingAvg(vals, 10), n = list.length;
    const unit = m === "wpm" ? " WPM" : "%";
    // first-week and latest-week averages (or the first and last five matches when the history is short)
    const t0 = Date.parse(list[0].at), t1 = Date.now();
    let first = list.filter((x) => Date.parse(x.at) < t0 + 7 * DAY), last = list.filter((x) => Date.parse(x.at) > t1 - 7 * DAY);
    if (first.length === list.length || last.length === list.length || !last.length) { first = list.slice(0, Math.min(5, Math.floor(n / 2))); last = list.slice(-Math.min(5, Math.floor(n / 2))); }
    const aF = Stats.avg(first.map(val)), aL = Stats.avg(last.map(val)), gain = aL - aF;
    const gainText = `<span class="gain ${gain >= 0 ? "up" : "down"}">${gain >= 0 ? "+" : ""}${fix(gain, m === "wpm" ? 0 : 0)}${m === "wpm" ? " WPM" : " points"} since you started</span>`;
    const W = 1000, H = 220, L = 44, R = 12, T = 12, B = 26, pw = W - L - R, ph = H - T - B;
    let lo = 0, hi = m === "wpm" ? Math.ceil(Math.max(...vals) / 20) * 20 : 100;
    if (m === "acc") lo = Math.max(0, Math.floor(Math.min(...vals) / 10) * 10 - 10);
    if (hi - lo < 20) hi = lo + 20;
    const X = (i) => L + (n === 1 ? pw / 2 : (i / (n - 1)) * pw), Y = (v) => T + ph - ((v - lo) / (hi - lo)) * ph;
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => { const v = lo + (hi - lo) * f; return `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${u.line}" stroke-width="1" opacity="0.5"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" fill="${u.dim}" font-size="12">${Math.round(v)}</text>`; }).join("");
    const ref = (v, label, side) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${u.dim}" stroke-width="1" stroke-dasharray="3 5"/><text x="${side === "l" ? L + 6 : W - R - 6}" y="${Y(v) - 6}" text-anchor="${side === "l" ? "start" : "end"}" fill="${u.dim}" font-size="12">${label} ${fix(v)}</text>`;
    const dots = m === "win" ? "" : vals.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3" fill="var(--you)" stroke="${u.surface}" stroke-width="2"/>`).join("");
    const trend = `<polyline points="${mv.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="${u.info}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    const pts = JSON.stringify(list.map((x, i) => [(X(i) - 0) / W, `Match ${i + 1}, ${when(x.at)} vs ${esc(x.bot)}: ${val(x)}${unit} (average of last 10: ${fix(mv[i])})${x.won ? ", won" : ", lost"}`]));
    return `<div class="journey-head">${gainText}<span class="key-row"><span class="key-i"><i class="dot"></i>${m === "win" ? "each match (won or lost)" : "each match"}</span><span class="key-i"><i style="background:${u.info}"></i>average of the last 10</span></span></div>
      <div class="hover-wrap" data-pts='${esc(pts).replace(/'/g, "&#39;")}'>
        <svg viewBox="0 0 ${W} ${H}" class="journey" role="img" aria-label="Your ${m === "wpm" ? "speed" : m === "acc" ? "accuracy" : "win rate"} in every match, oldest to newest">
          ${grid}${ref(aF, "first week", "l")}${ref(aL, "latest week", "r")}${m === "win" ? "" : `<polyline points="${vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--you)" stroke-width="1" opacity="0.35"/>`}${dots}${trend}
          <text x="${L}" y="${H - 6}" fill="${u.dim}" font-size="12">${when(list[0].at)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" fill="${u.dim}" font-size="12">${when(list[n - 1].at)}</text></svg>
        <div class="cross"></div><div class="tip"></div></div>`;
  }

  // ---------- keyboard heat map ----------
  const ROWS = [["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"], ["a", "s", "d", "f", "g", "h", "j", "k", "l"], ["z", "x", "c", "v", "b", "n", "m"]];
  function keyboard(list) {
    const u = U(), tot = Stats.keyTotals(list), speed = state.heat === "speed";
    const MIN = 8;
    const keys = Object.keys(tot).filter((k) => tot[k].tries >= MIN);
    const maxErr = Math.max(0.05, ...keys.map((k) => tot[k].err));
    const ms = keys.map((k) => tot[k].avgMs).filter((v) => v > 0), lo = Math.min(...ms, 1e9), hi = Math.max(...ms, 1);
    const S = 52, G = 6, offs = [0, 0.5, 1.5];
    const cell = (k, r, c) => {
      const t = tot[k], x = (c + offs[r]) * (S + G), y = r * (S + G);
      let fill = u.track, label = "", tt = 0;
      if (t && t.tries >= MIN) {
        tt = speed ? (hi > lo ? (t.avgMs - lo) / (hi - lo) : 0) : Math.min(1, t.err / maxErr);
        fill = Themes.mix(u.track, speed ? u.warn : u.danger, 0.15 + 0.85 * tt);
        label = speed ? Math.round(t.avgMs) + " ms" : fix(t.err * 100) + "%";
      }
      const light = Themes.contrast(fill, u.text) < Themes.contrast(fill, u.bg);
      const ink = light ? u.bg : u.text;
      const tip = t ? `${k.toUpperCase()}: ${t.tries} tries, ${t.misses} mistakes (${fix(t.err * 100)}%), ${Math.round(t.avgMs)} ms between keys` : `${k.toUpperCase()}: not typed yet`;
      return `<g><title>${tip}</title><rect x="${x}" y="${y}" width="${S}" height="${S}" rx="4" fill="${fill}" stroke="${u.line}"/>` +
        `<text x="${x + 8}" y="${y + 20}" fill="${ink}" font-size="16" font-weight="700">${k.toUpperCase()}</text>` +
        `<text x="${x + S / 2}" y="${y + S - 9}" text-anchor="middle" fill="${ink}" font-size="12">${label}</text></g>`;
    };
    const svg = `<svg viewBox="0 0 ${10 * (S + G)} ${3 * (S + G)}" class="kbd" role="img" aria-label="Keyboard colored by ${speed ? "speed per key" : "mistakes per key"}">${ROWS.map((row, r) => row.map((k, c) => cell(k, r, c)).join("")).join("")}</svg>`;
    // weakest keys and the words that broke combos most often
    const weak = keys.sort((a, b) => tot[b].err - tot[a].err).filter((k) => tot[k].misses > 0).slice(0, 10);
    const freq = {};
    for (const m of list) for (const w of m.missedWords) freq[w] = (freq[w] || 0) + 1;
    const weakList = weak.length ? weak.map((k) => {
      const ws = Object.keys(freq).filter((w) => w.includes(k)).sort((a, b) => freq[b] - freq[a]).slice(0, 3);
      return `<li><b>${k.toUpperCase()}</b><span class="bar"><i style="width:${Math.max(4, (tot[k].err / maxErr) * 100)}%"></i></span><span class="num">${fix(tot[k].err * 100)}%</span><span class="ws">${ws.length ? ws.map(esc).join(", ") : ""}</span></li>`;
    }).join("") : `<li class="empty">Type a few matches and your weakest keys show up here.</li>`;
    const legend = `<span class="grad-key">${speed ? "faster" : "fewer mistakes"}<i class="grad" style="background:linear-gradient(90deg,${Themes.mix(u.track, speed ? u.warn : u.danger, 0.15)},${speed ? u.warn : u.danger})"></i>${speed ? "slower" : "more mistakes"}</span>`;
    return { svg, weakList, legend };
  }

  // ---------- calendar ----------
  function calendar(list) {
    const u = U(), per = Stats.perDay(list), WEEKS = 26, S = 14, G = 3;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today.getTime() - ((WEEKS - 1) * 7 + ((today.getDay() + 6) % 7)) * DAY); // a Monday
    const max = Math.max(1, ...Object.values(per));
    let out = "";
    for (let w = 0; w < WEEKS; w++) for (let d = 0; d < 7; d++) {
      const day = new Date(start.getTime() + (w * 7 + d) * DAY);
      if (day > today) continue;
      const k = Stats.dayKey(day), c = per[k] || 0, t = c ? 0.25 + 0.75 * Math.min(1, c / Math.max(4, max)) : 0;
      out += `<rect x="${w * (S + G)}" y="${d * (S + G)}" width="${S}" height="${S}" rx="2" fill="${c ? Themes.mix(u.track, u.phosphor, t) : u.track}" opacity="${c ? 1 : 0.6}"><title>${day.toLocaleDateString(undefined, { day: "numeric", month: "short" })}: ${c} ${c === 1 ? "match" : "matches"}</title></rect>`;
    }
    return `<svg viewBox="0 0 ${WEEKS * (S + G)} ${7 * (S + G)}" class="cal" role="img" aria-label="Matches per day, last ${WEEKS} weeks">${out}</svg>`;
  }

  // ---------- the page ----------
  const tile = (label, value, sub) => `<div class="tile"><span class="tl">${label}</span><b>${value}</b>${sub ? `<span class="ts">${sub}</span>` : ""}</div>`;
  function page() {
    const all = Stats.all(), list = data();
    if (!all.length) {
      return `<div class="st-head"><h2 class="screen-title">My stats</h2><div class="btn-row">${btn("back", "Back", "Esc")}</div></div>
        <div class="empty big">No matches yet. Finish a fight and your speed, accuracy, best moves and weakest keys will show up here.<br><br>${importButton()}</div>`;
    }
    const o = Stats.overview(list), bests = Stats.bests(list);
    const modeName = { all: "All", space: "Space ends word", auto: "Auto-end" };
    const botLabel = state.bot === "all" ? "All" : state.bot;
    const filters = `<div class="filters"><span class="fl">Range</span>${seg("range:all", "All time", state.range === "all")}${seg("range:90", "90 days", state.range === "90")}${seg("range:30", "30 days", state.range === "30")}
      <span class="fl">Typing mode</span>${["all", "space", "auto"].map((v) => seg("mode:" + v, modeName[v], state.mode === v)).join("")}
      <span class="fl">Opponent</span>${seg("bot:next", esc(botLabel) + " &#9656;", state.bot !== "all")}</div>`;
    const tiles = `<div class="tiles">${tile("Matches", o.played, `${o.wins} won, ${o.losses} lost`)}${tile("Win rate", o.winRate + "%")}${tile("Time fighting", o.secs >= 3600 ? dur(o.secs) : o.secs >= 60 ? Math.floor(o.secs / 60) + " min" : Math.floor(o.secs) + " s")}` +
      `${tile("Average WPM", fix(o.avgWpm), `last 10: ${fix(o.last10)}`)}${tile("Best WPM", o.bestWpm)}${tile("Accuracy", fix(o.avgAcc) + "%", `consistency ${fix(o.avgCons)}%`)}</div>`;
    const journeyBlock = `<section class="blk"><div class="blk-head"><h3>Your journey</h3><span class="segs">${seg("metric:wpm", "Speed", state.metric === "wpm")}${seg("metric:acc", "Accuracy", state.metric === "acc")}${seg("metric:win", "Win rate", state.metric === "win")}</span></div>${list.length ? journey(list) : '<div class="empty">No matches in this range.</div>'}</section>`;
    const bestRows = bests.map((b) => `<tr><td>${esc(b.bot)}</td><td>${b.wins}/${b.played}</td><td>${b.ko === null ? "-" : fix(b.ko, 1) + " s"}</td><td>${b.wpm}</td><td>x${b.combo}</td></tr>`).join("");
    const bestsBlock = `<section class="blk"><h3>Personal bests</h3><table class="tbl"><thead><tr><th>Opponent</th><th>Won</th><th>Fastest K.O.</th><th>Best WPM</th><th>Best combo</th></tr></thead><tbody>${bestRows || '<tr><td colspan="5">Nothing in this range.</td></tr>'}</tbody></table></section>`;
    const f = fightInsights(list);
    const insights = `<section class="blk"><h3>Fight insights</h3><dl class="kv"><div><dt>Combos broken per match</dt><dd>${fix(f.broken, 1)}</dd></div><div><dt>Clean ultimates per match</dt><dd>${fix(f.ult, 1)}</dd></div>
      <div><dt>Counters per match</dt><dd>${fix(f.counters, 1)}</dd></div><div><dt>Time stunned per match</dt><dd>${fix(f.stunned, 1)} s</dd></div>
      <div><dt>Average of last 100</dt><dd>${fix(o.last100)} WPM</dd></div></dl><p class="says">${f.says}</p></section>`;
    const kb = keyboard(list);
    const keyBlock = `<section class="blk"><div class="blk-head"><h3>Keyboard</h3><span class="segs">${seg("heat:err", "Mistakes", state.heat === "err")}${seg("heat:speed", "Speed", state.heat === "speed")}</span></div>
      <div class="kb-grid"><div>${kb.svg}<div class="legend-row">${kb.legend}<span class="note">Keys need at least 8 tries to show a color.</span></div></div>
      <div><h4>Your 10 weakest keys</h4><ol class="weak">${kb.weakList}</ol></div></div></section>`;
    const calBlock = `<section class="blk"><h3>Activity, last 26 weeks</h3>${calendar(list)}</section>`;
    return `<div class="st-head"><h2 class="screen-title">My stats</h2><div class="btn-row">${btn("back", "Back", "Esc")}</div></div>
      ${filters}${tiles}${journeyBlock}<div class="two">${bestsBlock}${insights}</div>${keyBlock}${calBlock}${historyBlock(list)}`;
  }

  function fightInsights(list) {
    const n = Math.max(1, list.length), sum = (f) => list.reduce((a, m) => a + f(m), 0);
    const out = { broken: sum((m) => m.fight.broken) / n, ult: sum((m) => m.fight.ultClean) / n, counters: sum((m) => m.fight.counters) / n, stunned: sum((m) => m.fight.stunned) / n, says: "" };
    const W = list.filter((m) => m.won), L = list.filter((m) => !m.won);
    if (W.length >= 2 && L.length >= 2) {
      const gaps = [
        ["speed", Stats.avg(W.map((m) => m.wpm)), Stats.avg(L.map((m) => m.wpm)), "You type about", " WPM slower in matches you lose."],
        ["accuracy", Stats.avg(W.map((m) => m.acc)), Stats.avg(L.map((m) => m.acc)), "Your accuracy drops about", " points in matches you lose."],
        ["combos", Stats.avg(W.map((m) => m.fight.broken)), Stats.avg(L.map((m) => m.fight.broken)), "You break about", " more combos in matches you lose."],
      ];
      // the gap that matters most, as a share of the winning average (combos compare the other way round)
      let best = null;
      for (const g of gaps) { const d = g[0] === "combos" ? g[2] - g[1] : g[1] - g[2], rel = g[1] ? d / Math.max(1, g[1]) : 0; if (d > 0 && (!best || rel > best.rel)) best = { rel, text: `${g[3]} ${fix(d, 1)}${g[4]}` }; }
      out.says = best ? "What separates your wins from your losses: " + best.text : "Your wins and losses look alike so far.";
    } else out.says = "Win and lose a few matches each and this shows what separates them.";
    return out;
  }

  // ---------- match history ----------
  const COLS = [["at", "Date"], ["bot", "Opponent"], ["won", "Result"], ["wpm", "WPM"], ["acc", "Accuracy"], ["secs", "Time"], ["combo", "Best combo"], ["mode", "Mode"]];
  const sortVal = (m, k) => (k === "combo" ? m.fight.bestCombo : k === "at" ? Date.parse(m.at) : m[k]);
  function historyBlock(list) {
    const rows = list.slice().sort((a, b) => { const x = sortVal(a, state.sort), y = sortVal(b, state.sort); return (x > y ? 1 : x < y ? -1 : 0) * state.dir; });
    const shown = rows.slice(0, state.limit);
    const head = COLS.map(([k, l]) => `<th><button class="th ${state.sort === k ? "on" : ""}" data-act="st:sort:${k}" tabindex="-1">${l}${state.sort === k ? (state.dir > 0 ? " &#9650;" : " &#9660;") : ""}</button></th>`).join("");
    const body = shown.map((m) => `<tr class="click" data-act="st:open:${m.id}" tabindex="-1"><td>${whenTime(m.at)}</td><td>${esc(m.bot)}</td><td class="${m.won ? "w" : "l"}">${m.won ? "Won" : "Lost"}</td><td>${m.wpm}</td><td>${m.acc}%</td><td>${mmss(m.secs)}</td><td>x${m.fight.bestCombo}</td><td>${m.mode === "auto" ? "Auto-end" : "Space"}</td></tr>`).join("");
    const more = rows.length > shown.length ? `<button class="seg" data-act="st:more" tabindex="-1">Show ${Math.min(30, rows.length - shown.length)} more</button>` : "";
    return `<section class="blk"><div class="blk-head"><h3>Match history</h3><span class="segs">${more}
      <button class="seg" data-act="st:csv" tabindex="-1">Export CSV</button><button class="seg" data-act="st:json" tabindex="-1">Export JSON</button>${importButton()}
      <button class="seg danger" data-act="st:wipe" tabindex="-1">${state.confirm ? "Click again to delete all" : "Delete all"}</button></span></div>
      <table class="tbl hist"><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="8">No matches in this range.</td></tr>'}</tbody></table>
      <p class="note">Click a match to open it again. The newest ${Stats.MAX} matches are kept on this computer.</p></section>`;
  }
  const importButton = () => `<label class="seg filebtn">Import JSON<input type="file" id="st-import" accept=".json,application/json" tabindex="-1"></label>`;

  // One match opened again: the same result details as right after the fight.
  function detail(rec) {
    const u = U(), c = rec.chars, f = rec.fight, css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const you = css("--you") || u.phosphor, foe = css("--foe") || u.danger;
    return `<div class="st-head"><h2 class="screen-title">${rec.won ? "You won" : "You lost"} against ${esc(rec.bot)}</h2><div class="btn-row">${btn("st:list", "All stats", "Esc")}</div></div>
      <p class="sub">${whenTime(rec.at)}, ${mmss(rec.secs)} long, ${rec.mode === "auto" ? "words ended automatically" : "Space ended words"}, you as ${esc(rec.char)}</p>
      <div class="tiles">${tile("Average WPM", rec.wpm)}${tile("Raw WPM", rec.raw, "every key counted")}${tile("Accuracy", rec.acc + "%")}${tile("Consistency", rec.cons + "%", "100% is perfectly steady")}${tile("Best combo", "x" + f.bestCombo)}${tile("Win at", rec.beatAt + " WPM", "for this opponent")}</div>
      <section class="blk"><div class="chart-head"><span>Speed and HP</span><span><span class="key-i"><i style="background:${you}"></i>YOU</span><span class="key-i"><i class="dash" style="color:${you}"></i>raw</span><span class="key-i"><i style="background:${foe}"></i>${esc(rec.bot)}</span><span class="key-i"><i class="tick"></i>mistake</span></span></div>${chartSvg(rec, you, foe, true)}</section>
      <div class="two"><section class="blk"><h3>Characters</h3><dl class="kv"><div><dt>Right</dt><dd>${c.ok}</dd></div><div><dt>Wrong</dt><dd>${c.bad - c.extra}</dd></div><div><dt>Extra</dt><dd>${c.extra}</dd></div><div><dt>Missed</dt><dd>${c.missed}</dd></div></dl>
        <h3 class="mt">Words to practise</h3><p class="words">${rec.missedWords.length ? rec.missedWords.map(esc).join(", ") : "None, every word was clean."}</p></section>
      <section class="blk"><h3>The fight</h3><dl class="kv"><div><dt>Damage dealt</dt><dd>${f.dealt}</dd></div><div><dt>Damage taken</dt><dd>${f.taken}</dd></div><div><dt>Combos broken</dt><dd>${f.broken}</dd></div><div><dt>Counters</dt><dd>${f.counters}</dd></div>
        <div><dt>Ultimates (clean, messy)</dt><dd>${f.ultClean}, ${f.ultSloppy}</dd></div><div><dt>Time stunned</dt><dd>${f.stunned} s</dd></div></dl></section></div>
      <div class="btn-row">${btn("st:del:" + rec.id, "Delete this match", "")}</div>`;
  }

  // ---------- render and actions ----------
  function render() {
    if (!state.root) return;
    const scroll = state.root.scrollTop;
    const rec = state.openId ? Stats.find(state.openId) : null;
    state.root.innerHTML = rec ? detail(rec) : page();
    state.root.scrollTop = scroll;
    bindHover(state.root);
    const imp = state.root.querySelector("#st-import");
    if (imp) imp.addEventListener("change", () => {
      const file = imp.files && imp.files[0];
      if (!file) return;
      file.text().then((t) => {
        const j = JSON.parse(t), n = Stats.importList(Array.isArray(j) ? j : j.matches);
        toast(n ? `Imported ${n} ${n === 1 ? "match" : "matches"}.` : "Nothing new to import.");
        render();
      }).catch(() => toast("That file is not a Type Boxing stats file."));
    });
  }
  function open(root, id) {
    state.root = root; state.openId = id || null; state.confirm = false; state.limit = 15;
    root.scrollTop = 0;
    render();
  }
  function close() { state.openId = null; state.root = null; }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function csv() {
    const head = ["date", "opponent", "result", "wpm", "raw_wpm", "accuracy", "consistency", "seconds", "best_combo", "damage_dealt", "damage_taken", "combos_broken", "mode", "fighter"];
    const rows = Stats.all().map((m) => [m.at, m.bot, m.won ? "won" : "lost", m.wpm, m.raw, m.acc, m.cons, m.secs, m.fight.bestCombo, m.fight.dealt, m.fight.taken, m.fight.broken, m.mode, m.char]);
    return [head].concat(rows).map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  function act(a, b, c) {
    if (a !== "wipe") state.confirm = false;
    switch (a) {
      case "range": state.range = b; state.limit = 15; break;
      case "mode": state.mode = b; state.limit = 15; break;
      case "metric": state.metric = b; break;
      case "heat": state.heat = b; break;
      case "bot": { const names = ["all"].concat(botNames()); state.bot = names[(Math.max(0, names.indexOf(state.bot)) + 1) % names.length]; state.limit = 15; break; }
      case "sort": if (state.sort === b) state.dir = -state.dir; else { state.sort = b; state.dir = b === "bot" || b === "mode" ? 1 : -1; } break;
      case "more": state.limit += 30; break;
      case "open": state.openId = b; state.root.scrollTop = 0; break;
      case "list": state.openId = null; break;
      case "del": Stats.remove(b); state.openId = null; toast("Match deleted."); break;
      case "csv": download("type-boxing-matches.csv", csv(), "text/csv"); return;
      case "json": download("type-boxing-stats.json", JSON.stringify({ v: 1, matches: Stats.all() }), "application/json"); return;
      case "wipe": if (state.confirm) { Stats.clear(); state.confirm = false; toast("All stats deleted."); } else { state.confirm = true; } break;
    }
    render();
  }

  return { open, close, render, act, resultChart, resultExtra, get isDetail() { return !!state.openId; }, back: () => { if (state.openId) { state.openId = null; render(); return true; } return false; } };
})();
