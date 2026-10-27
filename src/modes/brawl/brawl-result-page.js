/**
 * Brawl result (#scr-bresult): who won the match, how, and both fighters' numbers, with Again (Rematch online) and
 * Main menu (Leave online). Keys: Enter again, Esc menu, S settings, F fullscreen.
 *
 *   show(d) / render(d) with d: { title, win, sub, names: [left, right], mySeat, stats: [{ hp, dealt, meter }],
 *                                 online, localRematch, remoteRematch }
 */
CounterType.define(
  "brawl-result-page",
  ["router", "actions", "audio", "buttons", "keyline", "dom"],
  (router, actions, Sfx, buttons, keyline, dom) => {
    "use strict";

    const esc = dom.escapeHtml;
    let last = null;

    const el = router.register({
      id: "bresult",
      restore: () => {
        router.show("bresult");
        if (last) render(last);
      },
      refresh: () => {
        if (last) render(last);
      },
      onKey,
    });

    function column(d, i) {
      const s = d.stats[i];
      return `<div class="rcol panel" style="--id:var(${i === d.mySeat ? "--you" : "--foe"})"><h3>${esc(d.names[i])}</h3><dl>
      <dt>HP left</dt><dd>${s.hp}</dd><dt>Damage dealt</dt><dd>${s.dealt}</dd><dt>Special meter</dt><dd>${s.meter}%</dd></dl></div>`;
    }

    /** Draws the result in place. */
    function render(d) {
      last = d;
      const rematch = d.online ? (d.localRematch ? "Waiting" : "Rematch") : "Again";
      const note = d.online
        ? `<p class="modal-note">${d.remoteRematch ? "Your opponent wants a rematch." : "Press Rematch when you are ready."}</p>`
        : "";
      el.innerHTML =
        `<div id="bko" class="panel"><div class="ko-title ${d.win === false ? "lose" : "win"}">${esc(d.title)}</div><div class="ko-sub">${esc(d.sub)}</div></div>
      <div class="bcols">${column(d, 0)}${column(d, 1)}</div>
      <div class="btn-row">${buttons.button("rematch", rematch, { primary: !(d.online && d.localRematch) })}${buttons.button("menu", d.online ? "Leave" : "Main menu")}</div>` +
        note;
      if (router.current() === "bresult") {
        keyline.set([buttons.keyChip("settings", "settings"), buttons.keyChip("fullscreen", "fullscreen")]);
      }
    }

    /** Shows the result screen and plays the win or loss. */
    function show(d) {
      router.show("bresult");
      render(d);
      Sfx.play(d.win === false ? "lose" : "win");
    }

    function onKey(e, key) {
      if (e.key === "Enter") actions.run("rematch");
      else if (e.key === "Escape") actions.run("menu");
      else if (key === "s") actions.run("settings");
      else if (key === "f") actions.run("fullscreen");
      return true;
    }

    return Object.freeze({ show, render });
  },
);
