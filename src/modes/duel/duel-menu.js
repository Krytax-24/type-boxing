/**
 * Duel menu: the Duel's view of the title screen.
 *
 * Left: Fight (Enter), the kind of fight (Bots, Endless, Practice: B, E, P), Ranked (K), Online room (O) and Back.
 * Right: the opponent cards (keys 1 to 8) with the match rules, the Endless options, or the practice dummy.
 * Actions: "duel-start", "duel-kind:<kind>", "duel-bot:<index>", "duel-next-bot".
 */
CounterType.define(
  "duel-menu",
  [
    "settings",
    "player",
    "looks",
    "online-gateway",
    "actions",
    "buttons",
    "option-row",
    "keyline",
    "dom",
    "match-rules-rows",
    "duel-session",
    "duel-bots",
    "duel-practice",
    "?queue-page",
  ],
  (
    settings,
    player,
    looks,
    net,
    actions,
    buttons,
    optionRow,
    keyline,
    dom,
    rulesRows,
    duelSession,
    bots,
    practice,
    queue,
  ) => {
    "use strict";

    const KINDS = { b: "bots", e: "endless", p: "practice" };

    function botCard(card, i) {
      const cfg = bots.configFor(i);
      const def = player.def(bots.fighterFor(i));
      const locked = bots.isLocked(i);
      const cls = ["bot-opt", "pick", card.match && "match", locked && "locked", i === bots.picked() && "sel"]
        .filter(Boolean)
        .join(" ");
      const style = locked ? "Finish a match first, then it copies your speed" : card.style;
      const beat = locked ? "locked" : `win at about<b>${Math.round(cfg.beatAt)} wpm</b>`;
      return (
        `<button class="${cls}" data-act="duel-bot:${i}" tabindex="-1">` +
        `<span><span class="bname">${card.name}<i>${dom.escapeHtml(def ? def.name : "")}</i></span>` +
        `<span class="bstyle">${style}</span></span><span class="beat">${beat}</span></button>`
      );
    }

    function botList() {
      return (
        `<div class="card-label"><span>Choose your opponent</span><span></span></div>` + bots.BOTS.map(botCard).join("")
      );
    }

    function endlessHtml() {
      const hurt = optionRow.optionRow(
        "HP loss",
        "Off: nobody can be knocked out, so you just type.",
        "eHurt",
        [
          [true, "On"],
          [false, "Off"],
        ],
        settings.values.eHurt,
      );
      return (
        `<div class="card-label"><span>Endless</span><span>no timer</span></div>` +
        `<p class="opt-note">One bot, no clock. Every knock out starts the next round and the score keeps counting until you quit from the pause menu. Pick the bot, then fight.</p>` +
        `<div class="optrows compact">${hurt}</div>` +
        rulesRows.html({ rounds: false, compact: true })
      );
    }

    function fightSub(kind) {
      const pick = bots.picked();
      const name = bots.BOTS[pick].name;
      if (kind === "bots") return `vs ${name}, ${Math.round(bots.configFor(pick).beatAt)} wpm to win`;
      if (kind === "endless") return `endless vs ${name}`;
      return "your own dummy";
    }

    /** Draws the Duel view into the title screen's left menu and right panel. */
    function draw({ menu, side }) {
      const kind = duelSession.offlineKind();
      const kindButton = (id, label) =>
        buttons.menuButton("duel-kind:" + id, label, { className: "mode" + (kind === id ? " sel" : "") });
      const ranked = queue
        ? buttons.menuButton("ranked:duel", "Ranked", { className: "mode", sub: "preview: simulated opponents" })
        : "";
      const online = net.offline
        ? ""
        : buttons.menuButton("play", "Online room", {
            className: "mode",
            sub: net.available() ? "private 1v1 with a friend" : "needs http, see the online notes",
          });
      menu.innerHTML =
        buttons.menuButton("duel-start", "Fight", { primary: true, sub: fightSub(kind) }) +
        `<div class="mode-row">${kindButton("bots", "Bots")}${kindButton("endless", "Endless")}${kindButton("practice", "Practice")}</div>` +
        ranked +
        online +
        buttons.menuButton("back", "Back", { className: "mode" });
      if (kind === "bots") side.innerHTML = botList() + rulesRows.html({ compact: true });
      else if (kind === "endless") side.innerHTML = botList() + endlessHtml();
      else side.innerHTML = practice.panelHtml();
      keyline.clear();
      looks.setMenuOpponent(bots.fighterFor(bots.picked()));
    }

    /** Keys of the Duel view (the title screen adds Esc, S, F, C and H). Returns true when a key was used. */
    function menuKey(e, key) {
      const kind = duelSession.offlineKind();
      if (KINDS[key]) actions.run("duel-kind:" + KINDS[key]);
      else if (key === "k") actions.run("ranked:duel");
      else if (key === "o") actions.run("play");
      else if (key === "t") actions.run("stats");
      else if (e.key === "F2") {
        e.preventDefault();
        actions.run("view");
      } else if (e.key >= "1" && e.key <= String(bots.BOTS.length) && kind !== "practice") {
        actions.run("duel-bot:" + (Number(e.key) - 1));
      } else if (e.key === "Enter") actions.run("duel-start");
      else return false;
      return true;
    }

    return Object.freeze({ draw, menuKey });
  },
);
