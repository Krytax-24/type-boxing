/**
 * Mode result (#scr-mresult): the result screen shared by the typing modes that are not the Duel (Race, Arm
 * Wrestling). The mode hands over what to show; this page lays it out and maps its keys.
 *
 *   show(d)    shows the screen and draws it
 *   render(d)  draws it in place (a late ranked update)
 *   d: { title, win, sub, body (markup), ranked: { out, err, mode } | null, buttons (markup) }
 */
CounterType.define(
  "mode-result-page",
  ["router", "actions", "session", "rank-badges", "buttons", "keyline"],
  (router, actions, session, rankBadges, buttons, keyline) => {
    "use strict";

    const el = router.register({
      id: "mresult",
      restore: () => {
        const owner = session.activeMode();
        router.show("mresult");
        if (owner && owner.renderResult) owner.renderResult();
      },
      onKey,
    });

    /** Draws the result (without changing the screen: a late ranked update redraws it in place). */
    function render(d) {
      el.innerHTML = `<div class="panel mr-card"><div class="ko-title ${d.win ? "win" : "lose"}">${d.title}</div><div class="ko-sub">${d.sub}</div></div>
      <div class="panel mr-body">${d.body}</div>${rankBadges.rankedPanel(d.ranked)}<div class="btn-row">${d.buttons}</div>`;
      if (router.current() === "mresult") {
        keyline.set([buttons.keyChip("settings", "settings"), buttons.keyChip("fullscreen", "fullscreen")]);
      }
      return el;
    }

    function onKey(e, key) {
      const run = session.current();
      if (e.key === "Enter" || e.key === "Tab") {
        actions.run("rematch");
      } // Tab: a new test at once, like Monkeytype
      else if (e.key === "Escape") actions.run("menu");
      else if (key === "p") actions.run("profile");
      else if (key === "q" && run && run.ranked) actions.run("ranked:" + run.mode);
      else if (key === "s") actions.run("settings");
      else if (key === "f") actions.run("fullscreen");
      return true;
    }

    /** Shows the result screen and draws it. */
    function show(d) {
      router.show("mresult");
      return render(d);
    }

    return Object.freeze({ show, render, element: () => el });
  },
);
