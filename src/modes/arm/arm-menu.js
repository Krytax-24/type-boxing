/**
 * Arm Wrestling menu: the mode's view of the title screen. Wrestle (Enter), Ranked (K) and Back on the left; the
 * six opponents (keys 1 to 6) with their speed and accuracy on the right.
 * Actions: "arm-start", "arm-bot:<index>".
 */
CounterType.define(
  "arm-menu",
  ["arm-config", "arm-records", "actions", "buttons", "keyline", "?queue-page"],
  (CONFIG, records, actions, buttons, keyline, queue) => {
    "use strict";

    const A = CONFIG.arm;

    function botCard(bot, i) {
      const accuracy = (bot.accuracy * 100).toFixed(1).replace(".0", "");
      return (
        `<button class="bot-opt pick ${i === records.bot() ? "sel" : ""}" data-act="arm-bot:${i}" tabindex="-1">` +
        `<span><span class="bname">${bot.name}</span><span class="bstyle">${bot.style}</span></span>` +
        `<span class="beat">${bot.wpm} wpm<b>${accuracy}%</b></span></button>`
      );
    }

    /** Draws the Arm Wrestling view into the title screen's left menu and right panel. */
    function draw({ menu, side }) {
      const bot = A.bots[records.bot()];
      menu.innerHTML =
        buttons.menuButton("arm-start", "Wrestle", { primary: true, sub: `vs ${bot.name}` }) +
        (queue
          ? buttons.menuButton("ranked:arm", "Ranked", { className: "mode", sub: "preview: simulated opponents" })
          : "") +
        buttons.menuButton("back", "Back", { className: "mode" });
      side.innerHTML =
        `<div class="card-label"><span>Choose your opponent</span><span>speed, accuracy</span></div>` +
        A.bots.map(botCard).join("") +
        `<p class="opt-note">Power is ${A.accWeight * 100}% accuracy and ${A.speedWeight * 100}% speed. Your accuracy only counts in full while you keep up at least ${A.gate * 100}% of their speed. Pin their hand, or be past the middle when the ${A.timer} s clock runs out.</p>`;
      keyline.clear();
    }

    /** Keys of the Arm Wrestling view (the title screen adds Esc, S, F, C and H). */
    function menuKey(e, key) {
      if (e.key === "Enter") actions.run("arm-start");
      else if (key === "k") actions.run("ranked:arm");
      else if (e.key >= "1" && e.key <= String(A.bots.length)) actions.run("arm-bot:" + (Number(e.key) - 1));
      else return false;
      return true;
    }

    return Object.freeze({ draw, menuKey });
  },
);
