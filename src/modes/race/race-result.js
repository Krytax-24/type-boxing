/**
 * Race result: Monkeytype's numbers for your race (wpm, accuracy, raw, characters, consistency, time and the second
 * by second chart with the winner's line when it is not you), the standings table and, after a ranked race, the
 * rating update. Laid out by the shared mode result screen (mode-result-page.js).
 */
CounterType.define(
  "race-result",
  ["race-config", "race-rules", "race-vehicles", "type-result", "mode-result-page", "buttons", "format", "dom"],
  (CONFIG, Race, Vehicles, TypeResult, modeResult, buttons, format, dom) => {
    "use strict";

    const esc = dom.escapeHtml;
    const ord = (n) => format.ordinal(n, true);
    const MIN_SECONDS = 0.5;

    /** The typing numbers of one racer over `secs` seconds. */
    function typeStats(state, racer, secs) {
      const lines = TypeResult.lines(racer.net, racer.raw, racer.err, secs);
      return {
        lines,
        wpm: Math.round(Race.avgWpm(state, racer)),
        raw: Math.round(Race.rawWpm(state, racer)),
        acc: Math.round(Race.accuracy(racer) * 100),
        cons: TypeResult.consistency(lines.rawPure),
      };
    }

    function standingsTable(results) {
      const rows = results
        .map((x) => {
          const tag = x.tag && !x.human ? `<i>#${esc(x.tag)}</i>` : "";
          const penalty = x.penalty > 0 ? `<span class="pen">+${x.penalty.toFixed(1)} s</span>` : "-";
          const time = x.finished ? x.time.toFixed(1) + " s" : Math.round(x.progress * 100) + "%";
          return (
            `<tr class="${x.human ? "you" : ""}"><td>${ord(x.place)}</td><td><i class="dot" style="background:${x.color}"></i>${x.human ? "YOU" : esc(x.name)}${tag}</td>` +
            `<td>${x.wpm}</td><td>${x.acc}%</td><td>${penalty}</td><td>${time}</td></tr>`
          );
        })
        .join("");
      return `<table class="tbl mr-table"><thead><tr><th>Place</th><th>Racer</th><th>WPM</th><th>Acc</th><th>Penalty</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    /**
     * The result as the mode result screen wants it.
     *
     * @param {{state: object, record: object, ranked: boolean, rankedOut: object|null, rankedErr: boolean}} race
     */
    function data(race) {
      const { state, record } = race;
      const me = state.racers[0];
      const secs = Math.max(MIN_SECONDS, me.finishT !== null ? me.finishT : state.t);
      const stats = typeStats(state, me, secs);
      const skips = me.skips
        ? `, ${me.skips} skipped word${me.skips > 1 ? "s" : ""} (+${me.penalty.toFixed(1)} s)`
        : "";
      const vehicle = record.vehicle ? Vehicles.byId(record.vehicle).name : "";
      const sub = record.finished
        ? `${state.racers.length} racers, ${state.length} passage, ${vehicle}${skips}`
        : `Did not finish: ${Math.round(Race.progress(state, me) * 100)}% of the passage`;
      const winner = state.racers.find((r) => r.place === 1);
      const others =
        winner && !winner.human
          ? [
              {
                name: winner.name,
                color: winner.color,
                line: TypeResult.lines(
                  winner.net,
                  winner.raw,
                  winner.err,
                  Math.max(MIN_SECONDS, winner.finishT !== null ? winner.finishT : state.t),
                ).wpmLine,
              },
            ]
          : [];
      const numbers = TypeResult.html({
        wpm: stats.wpm,
        acc: stats.acc,
        raw: stats.raw,
        chars: Race.chars(state, me),
        consistency: stats.cons,
        time: secs,
        kind: `race ${state.length}${race.ranked ? ", ranked" : ""}`,
        wpmLine: stats.lines.wpmLine,
        rawLine: stats.lines.rawLine,
        errs: stats.lines.errs,
        others,
      });
      return {
        title: record.place === 1 ? "1ST PLACE" : `${ord(record.place)} PLACE`,
        win: record.place === 1,
        sub,
        body: numbers + standingsTable(Race.results(state)),
        ranked: race.ranked ? { out: race.rankedOut, err: race.rankedErr, mode: "race" } : null,
        buttons:
          buttons.button("rematch", race.ranked ? "Race again (practice)" : "Race again", { primary: true }) +
          (race.ranked ? buttons.button("ranked:race", "Queue again") : "") +
          buttons.button("profile", "Profile") +
          buttons.button("menu", "Main menu"),
      };
    }

    /** Shows the result screen. */
    function show(race) {
      TypeResult.bind(modeResult.show(data(race)));
    }

    /** Draws it again in place (a late ranked update, or back from the profile). */
    function render(race) {
      TypeResult.bind(modeResult.render(data(race)));
    }

    return Object.freeze({ show, render, typeStats });
  },
);
