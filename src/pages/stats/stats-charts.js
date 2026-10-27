/**
 * Stats charts: the speed and HP chart of one Duel match, and the extra numbers under it. Drawn with plain SVG.
 * Used by the Duel result screen and by My stats when a match is opened again.
 *
 * Colors: the player's identity color for their own lines, the opponent's for theirs, `danger` for mistakes. Every
 * chart has a legend and a hover tooltip, so no meaning is carried by color alone.
 */
CounterType.define("stats-charts", ["config", "dom", "format"], (CONFIG, dom, format) => {
  "use strict";

  const ui = () => CONFIG.theme.ui;
  const esc = dom.escapeHtml;

  /**
   * Speed over the match: your WPM, your raw WPM (every key, dashed), the opponent's WPM, a red tick under every
   * mistake, and both HP lines underneath so you can see where the fight turned.
   */
  function chartSvg(rec, you, foe, tall) {
    const u = ui();
    const W = 600;
    const H = tall ? 120 : 64;
    const HP = tall ? 40 : 22;
    const trace = rec.trace || [];
    const n = trace.length;
    if (n < 2) return `<div class="chart-empty">No speed graph for this match.</div>`;
    const top = Math.max(40, ...trace.map((p) => Math.max(p[0], p[1], p[2])));
    const max = Math.ceil(top / 20) * 20;
    const X = (i) => ((i / (n - 1)) * W).toFixed(1);
    const Y = (v) => (H - (v / max) * H).toFixed(1);
    const line = (k) => trace.map((p, i) => `${X(i)},${Y(p[k])}`).join(" ");
    const grid = [0.5, 1]
      .map(
        (f) =>
          `<line x1="0" x2="${W}" y1="${H - f * H}" y2="${H - f * H}" stroke="${u.line}" stroke-width="1" stroke-dasharray="2 4"/>`,
      )
      .join("");
    const yLabels = [0.5, 1]
      .map((f) => `<span class="ylab" style="top:${((1 - f) * 100).toFixed(1)}%">${Math.round(max * f)}</span>`)
      .join("");
    const span = rec.secs || n / 2 || 1;
    const ticks = (rec.typos || [])
      .map((t) => {
        const x = Math.min(W, (t / span) * W).toFixed(1);
        return `<line x1="${x}" x2="${x}" y1="${H - 9}" y2="${H}" stroke="${u.danger}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
      })
      .join("");
    const hpLine = (k, color) =>
      `<polyline points="${trace.map((p, i) => `${X(i)},${(HP - (p[k] / 100) * HP).toFixed(1)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
    const points = JSON.stringify(
      trace.map((p, i) => [
        i / (n - 1),
        `${format.clock(i / 2)}  YOU ${p[0]} WPM (raw ${p[1]})  ${rec.bot} ${p[2]} WPM  HP ${p[3]} / ${p[4]}`,
      ]),
    );
    return `<div class="hover-wrap" data-pts='${esc(points)}'>
      <div class="sp">${yLabels}<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="speed" role="img" aria-label="Words per minute over the match">${grid}
        <line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="${u.line}" stroke-width="1"/>${ticks}
        <polyline points="${line(2)}" fill="none" stroke="${foe}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
        <polyline points="${line(1)}" fill="none" stroke="${you}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.65" vector-effect="non-scaling-stroke"/>
        <polyline points="${line(0)}" fill="none" stroke="${you}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg></div>
      <svg viewBox="0 0 ${W} ${HP}" preserveAspectRatio="none" class="hpline" role="img" aria-label="Both fighters' HP over the match">
        <line x1="0" x2="${W}" y1="${HP}" y2="${HP}" stroke="${u.line}" stroke-width="1"/>${hpLine(4, foe)}${hpLine(3, you)}</svg>
      <div class="cross"></div><div class="tip"></div></div>`;
  }

  /** The chart block of the Duel result screen. */
  function resultChart(rec, you, foe) {
    if (!rec) return "";
    return (
      `<div class="chart-head"><span>Speed and HP, ${format.fixed(rec.secs)} s</span><span>` +
      `<span class="key-i"><i style="background:${you}"></i>YOU</span><span class="key-i"><i class="dash" style="color:${you}"></i>your raw WPM</span>` +
      `<span class="key-i"><i style="background:${foe}"></i>${esc(rec.bot)}</span><span class="key-i"><i class="tick"></i>mistake</span></span></div>` +
      chartSvg(rec, you, foe, false)
    );
  }

  /** The extra numbers of the Duel result screen. */
  function resultExtra(rec) {
    if (!rec) return "";
    const c = rec.chars;
    const words = rec.missedWords.slice(0, 6);
    return `<dl class="extra">
      <div><dt>Consistency</dt><dd>${rec.cons}%</dd></div>
      <div><dt>Raw WPM</dt><dd>${rec.raw}</dd></div>
      <div><dt>Characters</dt><dd>${c.ok} right, ${c.bad - c.extra} wrong, ${c.extra} extra, ${c.missed} missed</dd></div>
      <div class="wide"><dt>Words to practise</dt><dd>${words.length ? words.map(esc).join(", ") : "none, a clean match"}</dd></div></dl>`;
  }

  return Object.freeze({ chartSvg, resultChart, resultExtra });
});
