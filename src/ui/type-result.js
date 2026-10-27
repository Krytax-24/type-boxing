/**
 * Type result: the Monkeytype style result block shared by Race and Arm Wrestling. Big wpm and accuracy, the second
 * by second chart, then raw, characters, consistency and time.
 *
 *   html(d) d: { wpm, acc, raw, chars: { correct, incorrect, extra, missed }, consistency, time, kind,
 *                wpmLine: [per second], rawLine: [per second], errs: [per second], others: [{ name, color, line }] }
 */
CounterType.define("type-result", ["config", "dom", "format", "chart-hover"], (CONFIG, dom, format, chartHover) => {
  "use strict";

  const CHART_WIDTH = 640;
  const CHART_HEIGHT = 150;
  const ui = () => CONFIG.theme.ui;
  const esc = dom.escapeHtml;

  // Monkeytype's consistency: 100 means perfectly steady (kogasa of the coefficient of variation of raw wpm).
  function consistency(values) {
    const v = values.filter((x) => x > 0);
    if (v.length < 2) return 0;
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / v.length);
    const cv = mean ? sd / mean : 1;
    return Math.round(100 * (1 - Math.tanh(cv + Math.pow(cv, 3) / 3 + Math.pow(cv, 5) / 5)));
  }

  // Per second buckets (keys) into the two Monkeytype lines: wpm = running average of correct characters,
  // raw = that second's keys, lightly smoothed, errs = wrong keys. `net`, `raw` and `err` count whole seconds.
  function lines(net, raw, err, secs) {
    // The last point takes every key after it too, over the real remaining time, so it ends on the final numbers.
    const n = Math.max(1, Math.round(secs));
    const from = (arr, i) => {
      let total = 0;
      for (let k = i; k < arr.length; k++) total += arr[k] || 0;
      return total;
    };
    const wpmLine = [];
    const rawLine = [];
    const errs = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      sum += last ? from(net, i) : net[i] || 0;
      const span = last ? Math.max(0.5, secs) : i + 1;
      wpmLine.push(Math.round((sum / 5) * (60 / span)));
      const keys = last ? from(raw, i) : raw[i] || 0;
      const rawSpan = last ? Math.max(0.5, secs - (n - 1)) : 1;
      rawLine.push(Math.round((keys / 5) * (60 / rawSpan)));
      errs.push(last ? from(err, i) : err[i] || 0);
    }
    const at = (i, fallback) => (rawLine[i] !== undefined ? rawLine[i] : fallback);
    const smooth = rawLine.map((v, i) => Math.round((at(i - 1, v) + 2 * v + at(i + 1, v)) / 4));
    return { wpmLine, rawLine: smooth, rawPure: rawLine, errs };
  }

  function chart(d) {
    const u = ui();
    const W = CHART_WIDTH;
    const H = CHART_HEIGHT;
    const n = d.wpmLine.length;
    if (n < 2) return `<div class="chart-empty">Too short for a graph.</div>`;
    const others = d.others || [];
    const top = Math.max(40, ...d.wpmLine, ...d.rawLine, ...others.flatMap((o) => o.line));
    const max = Math.ceil(top / 25) * 25;
    const errMax = Math.max(1, ...d.errs);
    const X = (i) => ((i / (n - 1)) * W).toFixed(1);
    const Y = (v) => (H - (Math.min(v, max) / max) * H).toFixed(1);
    const poly = (arr, color, width, dash, opacity) =>
      `<polyline points="${arr
        .slice(0, n)
        .map((v, i) => `${X(i)},${Y(v)}`)
        .join(
          " ",
        )}" fill="none" stroke="${color}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}` +
      `${opacity ? ` opacity="${opacity}"` : ""} vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`;
    const grid = [0.25, 0.5, 0.75, 1]
      .map((f) => {
        const y = (H - f * H).toFixed(1);
        return `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="${u.line}" stroke-width="1" stroke-dasharray="2 5" vector-effect="non-scaling-stroke"/>`;
      })
      .join("");
    const yLabels = [0.5, 1]
      .map((f) => `<span class="ylab" style="top:${((1 - f) * 100).toFixed(1)}%">${Math.round(max * f)}</span>`)
      .join("");
    const xStep = Math.max(1, Math.ceil(n / 8));
    const xLabels = d.wpmLine
      .map((_, i) =>
        (i + 1) % xStep === 0 || i === n - 1 ? `<span style="left:${(i / (n - 1)) * 100}%">${i + 1}</span>` : "",
      )
      .join("");
    const errMarks = d.errs
      .slice(0, n)
      .map((e, i) => {
        if (!e) return "";
        const y = H - 8 - (e / errMax) * (H * 0.35);
        const x = +X(i);
        return `<path d="M${x - 4} ${y - 4} L${x + 4} ${y + 4} M${x + 4} ${y - 4} L${x - 4} ${y + 4}" stroke="${u.danger}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
      })
      .join("");
    const points = d.wpmLine.map((v, i) => {
      const errors = d.errs[i] ? `   errors ${d.errs[i]}` : "";
      const rivals = others.map((o) => `   ${o.name} ${o.line[i] !== undefined ? o.line[i] : "-"}`).join("");
      return [i / (n - 1), `${i + 1} s   wpm ${v}   raw ${d.rawLine[i]}${errors}${rivals}`];
    });
    return `<div class="mt-chart hover-wrap" data-pts='${esc(JSON.stringify(points))}'>
      <div class="sp">${yLabels}<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Words per minute, second by second">${grid}
        <line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="${u.line}" stroke-width="1" vector-effect="non-scaling-stroke"/>
        ${others.map((o) => poly(o.line, o.color, 1.5, "", 0.55)).join("")}
        ${poly(d.rawLine, u.dim, 1.5, "4 3", 0.8)}${poly(d.wpmLine, u.phosphor, 2.5)}${errMarks}</svg></div>
      <div class="mt-xlab">${xLabels}</div><div class="cross"></div><div class="tip"></div></div>`;
  }

  function html(d) {
    const c = d.chars;
    const u = ui();
    const legend =
      `<span class="key-i"><i style="background:${u.phosphor}"></i>wpm</span>` +
      `<span class="key-i"><i class="dash" style="color:${u.dim}"></i>raw</span>` +
      (d.others || [])
        .map((o) => `<span class="key-i"><i style="background:${o.color}"></i>${esc(o.name)}</span>`)
        .join("") +
      `<span class="key-i"><i class="xm">x</i>errors</span>`;
    return `<div class="mt-res">
      <div class="mt-big"><div><span>wpm</span><b>${d.wpm}</b></div><div><span>acc</span><b>${d.acc}%</b></div></div>
      <div class="mt-graph"><div class="chart-head"><span>${esc(d.kind || "")}</span><span>${legend}</span></div>${chart(d)}</div>
      <div class="mt-small">
        <div><span>raw</span><b>${d.raw}</b></div>
        <div title="correct / incorrect / extra / missed"><span>characters</span><b>${c.correct}<i>/</i>${c.incorrect}<i>/</i>${c.extra}<i>/</i>${c.missed}</b></div>
        <div><span>consistency</span><b>${d.consistency}%</b></div>
        <div><span>time</span><b>${format.shortTime(d.time)}</b></div>
      </div></div>`;
  }

  /** Wires the hover line and tooltip of the charts inside `root`. */
  function bind(root) {
    chartHover.bind(root, { selector: ".mt-chart.hover-wrap", tipMax: 62 });
  }

  return Object.freeze({ html, chart, lines, consistency, bind });
});
