/**
 * Race menu: the Race's view of the title screen. Race (Enter), Ranked race (K) and Back on the left; your vehicle
 * and the practice race (how many opponents, their speed, the passage length) on the right.
 * Actions: "race-start", "race-vehicle:<id>"; option rows run "opt:r.<pref>:<value>" (race-mode.js saves them).
 */
CounterType.define(
  "race-menu",
  ["race-config", "race-records", "race-vehicles", "actions", "buttons", "option-row", "keyline", "dom", "?queue-page"],
  (CONFIG, records, Vehicles, actions, buttons, optionRow, keyline, dom, queue) => {
    "use strict";

    const C = CONFIG.race;
    const PREVIEW = [150, 66]; // vehicle card canvas, design px

    function vehicleCard(v, prefs, done) {
      const open = done >= v.unlock;
      const cls = ["veh", "pick", prefs.vehicle === v.id && "sel", !open && "locked"].filter(Boolean).join(" ");
      const kind = open ? (v.kind === "bike" ? "bike" : "car") : `after ${v.unlock} races`;
      return (
        `<button class="${cls}" data-act="race-vehicle:${v.id}" tabindex="-1" ${open ? "" : "disabled"}>` +
        `<canvas data-veh="${v.id}" width="${PREVIEW[0]}" height="${PREVIEW[1]}"></canvas><b>${v.name}</b><span>${kind}</span></button>`
      );
    }

    /** Draws the Race view into the title screen's left menu and right panel. */
    function draw({ menu, side }) {
      const prefs = records.preferences();
      const done = records.finishedRaces();
      const sub = `${prefs.bots} bot${prefs.bots > 1 ? "s" : ""}, ${prefs.length} passage`;
      menu.innerHTML =
        buttons.menuButton("race-start", "Race", { primary: true, sub }) +
        (queue
          ? buttons.menuButton("ranked:race", "Ranked race", { className: "mode", sub: "preview: simulated racers" })
          : "") +
        buttons.menuButton("back", "Back", { className: "mode" });
      const vehicles = CONFIG.vehicles.map((v) => vehicleCard(v, prefs, done)).join("");
      side.innerHTML =
        `<div class="card-label"><span>Your vehicle</span><span>looks only, never faster</span></div><div class="veh-grid">${vehicles}</div>` +
        `<div class="optrows compact">` +
        optionRow.optionRow(
          "Opponents",
          "",
          "r.bots",
          C.botCounts.map((n) => [n, String(n)]),
          prefs.bots,
        ) +
        optionRow.optionRow(
          "Their speed",
          "",
          "r.speed",
          C.speeds.map(([value, label]) => [value, label.replace(" wpm", "")]),
          prefs.speed,
        ) +
        optionRow.optionRow("Passage", "", "r.length", C.lengths, prefs.length) +
        `</div>` +
        `<p class="opt-note">Types like Monkeytype. Space on a wrong word skips it for a small time penalty. Tab starts over.</p>`;
      const ratio = dom.pixelRatio(2);
      side.querySelectorAll("canvas[data-veh]").forEach((canvas) => {
        canvas.width = PREVIEW[0] * ratio;
        canvas.height = PREVIEW[1] * ratio;
        Vehicles.preview(canvas, Vehicles.byId(canvas.dataset.veh), CONFIG.chars.you.body);
      });
      keyline.clear();
    }

    /** Keys of the Race view (the title screen adds Esc, S, F, C and H). */
    function menuKey(e, key) {
      if (e.key === "Enter") actions.run("race-start");
      else if (key === "k") actions.run("ranked:race");
      else if (e.key >= "1" && e.key <= "5") actions.run("opt:r.bots:" + e.key);
      else return false;
      return true;
    }

    return Object.freeze({ draw, menuKey });
  },
);
