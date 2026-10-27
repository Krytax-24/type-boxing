/**
 * Arm Wrestling result: Monkeytype's numbers for your match (with the opponent's speed line in the chart), both
 * wrestlers' averages and, after a ranked match, the rating update. Laid out by the shared mode result screen.
 */
CounterType.define(
  "arm-result",
  ["arm-rules", "type-result", "mode-result-page", "buttons", "dom"],
  (Arm, TypeResult, modeResult, buttons, dom) => {
    "use strict";

    const esc = dom.escapeHtml;
    const MIN_SECONDS = 0.5;

    function howItEnded(record) {
      if (record.how === "pin") return `Pinned after ${record.secs.toFixed(1)} s`;
      if (record.how === "time") return "Won on time, past the middle";
      if (record.how === "sudden") return "Decided in sudden death";
      return "Decided on right keys";
    }

    function column(name, i, a) {
      return `<div class="rcol" style="--id:var(${i ? "--foe" : "--you"})"><h3>${esc(name)}</h3><dl>
      <dt>Average power</dt><dd>${a.power}</dd><dt>Accuracy</dt><dd>${a.acc}%</dd><dt>WPM</dt><dd>${a.wpm}</dd><dt>Best clean streak</dt><dd>${a.bestStreak}</dd></dl></div>`;
    }

    /**
     * The result as the mode result screen wants it.
     *
     * @param {{s: object, record: object, card: object, ranked: boolean, rankedOut: ?object, rankedErr: boolean}} match
     */
    function data(match) {
      const { s, record, card } = match;
      const you = s.typists[0];
      const mine = Arm.summary(s, 0);
      const theirs = Arm.summary(s, 1);
      const secs = Math.max(MIN_SECONDS, s.t);
      const lines = TypeResult.lines(you.net, you.raw, you.err, secs);
      const foeLines = TypeResult.lines(s.typists[1].net, s.typists[1].raw, s.typists[1].err, secs);
      const numbers = TypeResult.html({
        wpm: mine.wpm,
        acc: mine.acc,
        raw: mine.raw,
        chars: mine.chars,
        consistency: TypeResult.consistency(lines.rawPure),
        time: secs,
        kind: `arm wrestling vs ${card.short.toLowerCase()}${match.ranked ? ", ranked" : ""}`,
        wpmLine: lines.wpmLine,
        rawLine: lines.rawLine,
        errs: lines.errs,
        others: [{ name: card.short, color: dom.cssVar("--foe", "#fb923c"), line: foeLines.wpmLine }],
      });
      return {
        title: record.won ? "YOU WIN" : "YOU LOSE",
        win: record.won,
        sub: `${howItEnded(record)} against ${esc(card.name)}`,
        body: numbers + `<div class="mr-cols">${column("YOU", 0, mine)}${column(card.short, 1, theirs)}</div>`,
        ranked: match.ranked ? { out: match.rankedOut, err: match.rankedErr, mode: "arm" } : null,
        buttons:
          buttons.button("rematch", match.ranked ? "Wrestle again (practice)" : "Rematch", { primary: true }) +
          (match.ranked ? buttons.button("ranked:arm", "Queue again") : "") +
          buttons.button("profile", "Profile") +
          buttons.button("menu", "Main menu"),
      };
    }

    function show(match) {
      TypeResult.bind(modeResult.show(data(match)));
    }

    function render(match) {
      TypeResult.bind(modeResult.render(data(match)));
    }

    return Object.freeze({ show, render });
  },
);
