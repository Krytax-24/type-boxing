/**
 * How to play (#scr-howto): built from what is loaded. Each game mode adds its own sections through the registry
 * ("howto-section": { id, order, html(step) }), so the page always matches the modes in the build and the numbers
 * always match CONFIG. Short sentences first, exact numbers last.
 */
CounterType.define(
  "howto-page",
  ["config", "router", "registry", "modals", "actions", "layout", "buttons", "keyline"],
  (CONFIG, router, registry, modals, actions, layout, buttons, keyline) => {
    "use strict";

    const RANKED_ORDER = 40; // where the ranked section sits between the modes' own sections
    const LEGEND_ORDER = 60;
    const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
    let returnTo = "title";

    const el = router.register({
      id: "howto",
      className: "panel",
      restore: () => render(),
      onKey,
      onAction,
    });

    /** One numbered step of a section. */
    function step(n, title, text, cls = "") {
      return `<div class="step ${cls}"><b class="num">${n}</b><div><h4>${title}</h4><p>${text}</p></div></div>`;
    }

    const legendRow = (term, text) => `<dt>${term}</dt><dd>${text}</dd>`;
    const modes = () => registry.list("mode");

    function lead() {
      if (layout.isPhone()) return "Backspace Brawl: fight with the on-screen buttons, no typing at all.";
      const typing = modes().filter((mode) => mode.typing).length;
      const sandbox = modes().some((mode) => !mode.typing);
      const opening = `${NUMBER_WORDS[typing] || typing} typing mode${typing === 1 ? "" : "s"}${sandbox ? " and a sandbox" : ""}.`;
      const pitches = modes()
        .map((mode) => mode.pitch || "")
        .filter(Boolean);
      return [opening].concat(pitches).join(" ");
    }

    function rankedSection() {
      const R = CONFIG.ranked;
      return `<h3 class="sec">Ranked (preview)</h3>
    <p class="fine">Each mode has its own rating. ${R.placements} placement matches give you a tier from Bronze to Master; Grandmaster is the top of the board. Wins earn points (RP), losses cost them, and a promotion comes with a ${R.shieldMatches} match shield. Seasons last ${R.seasonMonths} months. Until online ranked launches, opponents are simulated and your rating stays in this browser.</p>`;
    }

    function legendSection() {
      const rows = modes()
        .map((mode) => (mode.legend ? legendRow(mode.label, mode.legend) : ""))
        .join("");
      const wordSubmit = legendRow(
        "Word submit",
        "<b>On</b>: press Space after each word. <b>Off</b>: a word ends when it is exactly right. <b>Mix</b>: each player keeps their own choice. A race always needs Space.",
      );
      return `<h3 class="sec">Modes</h3>
    <dl class="legend">
      ${rows}
      ${wordSubmit}
    </dl>`;
    }

    function render() {
      router.show("howto");
      const sections = registry
        .list("howto-section")
        .concat([
          { id: "ranked", order: RANKED_ORDER, html: rankedSection },
          { id: "legend", order: LEGEND_ORDER, html: legendSection },
        ])
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((section) => section.html(step))
        .join("\n\n    ");
      const duel = registry.get("mode", "duel") ? buttons.button("duel", "Duel") : "";
      el.innerHTML = `
    <h2 class="screen-title">How to play</h2>
    <p class="lead">${lead()}</p>

    ${sections}
    <div class="btn-row">${buttons.button("back", "Back", { primary: true })}${duel}</div>`;
      keyline.clear();
    }

    function open() {
      const from = router.current();
      if (from === "title" || from === "result") returnTo = from;
      render();
    }

    function close() {
      router.restore(returnTo);
    }

    function onKey(e, key) {
      if (e.key === "Escape" || key === "h") actions.run("back");
      else if (key === "c") actions.run("fighter");
      else if (e.key === "Enter") actions.run("duel");
      return true;
    }

    function onAction(name) {
      if (name !== "back") return false;
      close();
      return true;
    }

    actions.on("howto", (x, y, top) => {
      const from = router.current();
      if (!top && (from === "title" || from === "result")) open();
    });

    return Object.freeze({ open, close });
  },
);
