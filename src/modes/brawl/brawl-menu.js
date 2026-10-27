/**
 * Brawl menu: Backspace Brawl's view of the title screen. Fight (Enter), Online (N), Create a fighter and Back on
 * the left; the bots (keys 1 to 3), the match rules with the starting side, and the controls card (the buttons
 * for your playing hand and your fighter's finishers) on the right. Phones get How to play instead of Back.
 * Actions: "brawl-start", "brawl-bot:<index>", "brawl-online".
 */
CounterType.define(
  "brawl-menu",
  [
    "brawl-config",
    "brawl-rules",
    "brawl-input",
    "storage",
    "settings",
    "player",
    "layout",
    "online-gateway",
    "actions",
    "buttons",
    "option-row",
    "keyline",
    "dom",
    "match-rules-rows",
  ],
  (
    CONFIG,
    Brawl,
    BrawlInput,
    storage,
    settings,
    player,
    layout,
    net,
    actions,
    buttons,
    optionRow,
    keyline,
    dom,
    rulesRows,
  ) => {
    "use strict";

    const B = CONFIG.brawl;
    const TOUCH_NAMES = { hp: "HP", lp: "LP", hk: "HK", lk: "LK" };

    let botIndex = B.defaultBot;
    const saved = storage.readJson(B.storageKey);
    if (saved && B.bots[saved.bot]) botIndex = saved.bot;

    /** The picked bot (an index into CONFIG.brawl.bots). */
    function bot() {
      return botIndex;
    }

    function pickBot(i) {
      botIndex = Math.max(0, Math.min(B.bots.length - 1, i));
      storage.writeJson(B.storageKey, { bot: botIndex });
    }

    function controlsHtml() {
      const L = BrawlInput.labels();
      const phone = layout.isPhone();
      const mine = player.fighter();
      const def = player.def(mine);
      const finishers = Brawl.combosOf(mine)
        .map((c) => {
          const keys = c.seq
            .split(",")
            .map((b) => (phone ? TOUCH_NAMES[b] : L.keys[b]))
            .join(" ");
          return `<dt>${dom.escapeHtml(c.name)}</dt><dd>${keys}</dd>`;
        })
        .join("");
      const finisherCard =
        `<div class="card-label"><span>${dom.escapeHtml(def ? def.name : "")} finishers</span><span>land a hit, then press in order</span></div>` +
        `<dl class="ctl">${finishers}</dl>`;
      if (phone) {
        return (
          `<div class="card-label"><span>Controls</span><span>touch</span></div><p class="opt-note">Left thumb: the pad moves, jumps and crouches. Right thumb: HP and HK high punch and kick, LP and LK low punch and kick, with the two small buttons for the projectile and the rising move. Both together make the super. Hold back to block.</p>` +
          finisherCard
        );
      }
      const rows = [
        ["Move", L.move],
        ["High", L.high],
        ["Low", L.low],
        ["Specials", L.specials],
      ]
        .map(([name, text]) => `<dt>${name}</dt><dd>${text}</dd>`)
        .join("");
      return (
        `<div class="card-label"><span>Buttons</span><span>${settings.values.hand} hand</span></div><dl class="ctl">${rows}</dl>` +
        `<p class="opt-note">Up jumps, down crouches, hold back to block (and down for low). Low punch and low kick together throw. Tap forward or back twice to dash. The super costs ${B.superCost}% meter. Change the hand in Settings.</p>` +
        finisherCard
      );
    }

    /** Draws the Brawl view into the title screen's left menu and right panel. */
    function draw({ menu, side }) {
      const online = net.offline
        ? ""
        : buttons.menuButton("brawl-online", "Online", {
            className: "mode",
            sub: net.available() ? "private room" : "needs http",
          });
      menu.innerHTML =
        buttons.menuButton("brawl-start", "Fight", { primary: true, sub: `vs ${B.bots[botIndex].name}` }) +
        online +
        buttons.menuButton("creator", "Create a fighter", { className: "mode", sub: "your own moveset" }) +
        (layout.isPhone()
          ? buttons.menuButton("howto", "How to play", { className: "mode" })
          : buttons.menuButton("back", "Back", { className: "mode" }));
      const bots =
        `<div class="card-label"><span>Choose your opponent</span><span></span></div>` +
        B.bots
          .map(
            (b, i) =>
              `<button class="bot-opt pick ${i === botIndex ? "sel" : ""}" data-act="brawl-bot:${i}" tabindex="-1"><span><span class="bname">${b.name}</span><span class="bstyle">${b.style}</span></span><span class="beat"></span></button>`,
          )
          .join("");
      const startingSide = optionRow.optionRow(
        "Starting side",
        "Start on the left (like player 1) or the right (like player 2).",
        "side",
        [
          ["left", "Left"],
          ["right", "Right"],
        ],
        settings.values.side,
      );
      side.innerHTML = bots + rulesRows.html({ compact: true, words: false, after: startingSide }) + controlsHtml();
      keyline.clear();
    }

    /** Keys of the Brawl view (the title screen adds Esc, S, F, C and H). */
    function menuKey(e, key) {
      if (key === "n") actions.run("brawl-online");
      else if (e.key >= "1" && e.key <= String(B.bots.length)) actions.run("brawl-bot:" + (Number(e.key) - 1));
      else if (e.key === "Enter") actions.run("brawl-start");
      else return false;
      return true;
    }

    return Object.freeze({ draw, menuKey, bot, pickBot });
  },
);
