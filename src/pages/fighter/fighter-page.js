/**
 * Fighter page (#scr-fighter): pick one of the fighters. Your fighter large on the left (a live preview), the
 * roster on the right. Up and Down move a row, Left and Right move in the row, Enter confirms.
 *
 * Other modules can add to it through the registry: "fighter-card" (an extra card after the roster, like + Create)
 * and "fighter-note" ({ id, note(key) } a line about the highlighted fighter).
 */
CounterType.define(
  "fighter-page",
  [
    "router",
    "registry",
    "actions",
    "events",
    "player",
    "clips",
    "fighter-stage",
    "settings",
    "layout",
    "loop",
    "buttons",
    "keyline",
    "dom",
  ],
  (router, registry, actions, events, player, Anim, DuelChars, settings, layout, loop, buttons, keyline, dom) => {
    "use strict";

    const COLUMNS = 3; // fighters per row (Up and Down move a row)
    const PREVIEW_SIZE = [446, 520]; // design px of the preview canvas

    let pickIndex = 0;
    let returnTo = "title";

    const el = router.register({ id: "fighter", restore: () => open(), onKey, onAction });
    el.innerHTML = `
      <div id="loadout-stage" class="panel">
        <canvas id="fighter-preview"></canvas>
        <div id="loadout-tag"><span id="fighter-name"></span><span id="fighter-wname"></span></div>
      </div>
      <div id="loadout-side" class="panel">
        <h2 class="screen-title">Choose your fighter</h2>
        <div class="row-label active" id="label-char">Pick your fighter</div>
        <div id="chars"></div>
        <div id="fighter-info"></div>
        <div class="btn-row" id="fighter-btns"></div>
      </div>`;
    const preview = dom.byId("fighter-preview");

    const roster = () => player.roster();

    function sizePreview() {
      const ratio = dom.pixelRatio(3);
      preview.width = Math.round(PREVIEW_SIZE[0] * layout.scale() * ratio);
      preview.height = Math.round(PREVIEW_SIZE[1] * layout.scale() * ratio);
    }

    /** Opens the page on your current fighter. */
    function open() {
      const from = router.current();
      if (from === "result" || from === "online" || from === "profile") returnTo = from;
      else if (from !== "fighter" && from !== "creator") returnTo = "title";
      pickIndex = Math.max(0, roster().indexOf(player.fighter()));
      router.show("fighter");
      const cards = roster()
        .map((key, i) => {
          const def = player.def(key);
          return `<button class="char pick" data-act="char:${i}" tabindex="-1"><b>${dom.escapeHtml(def.name)}</b><span>${dom.escapeHtml(def.title)}</span></button>`;
        })
        .join("");
      const extras = registry
        .list("fighter-card")
        .map((card) => card.html())
        .join("");
      dom.byId("chars").innerHTML = cards + extras;
      dom.byId("fighter-btns").innerHTML =
        buttons.button("back", "Back") + buttons.button("confirm", "Use this fighter", { primary: true });
      keyline.set([
        buttons.keyChip("prev", "previous"),
        buttons.keyChip("next", "next"),
        buttons.keyChip("down", "row"),
      ]);
      sizePreview();
      render();
    }

    function render() {
      const keys = roster();
      const key = keys[pickIndex];
      const def = player.def(key);
      const weapon = Anim.W[def.weapon];
      el.querySelectorAll(".char:not(.char-new)").forEach((card, i) => {
        card.classList.toggle("sel", i === pickIndex);
        card.classList.toggle("saved", keys[i] === player.fighter());
      });
      dom.byId("fighter-name").textContent = def.name;
      dom.byId("fighter-wname").textContent = def.title.toUpperCase();
      const notes = registry
        .list("fighter-note")
        .map((provider) => provider.note(key))
        .filter(Boolean)
        .map((note) => `<span>${note}</span>`)
        .join("");
      dom.byId("fighter-info").innerHTML =
        `<span>Moves: ${weapon.name.toLowerCase()} set, random combos every match.</span>` + notes;
    }

    function step(by) {
      const count = roster().length;
      pickIndex = (pickIndex + by + count) % count;
      render();
    }

    /** Leaves the page; with `confirm` the highlighted fighter becomes yours. */
    function close(confirm) {
      if (confirm) player.setFighter(roster()[pickIndex]);
      router.restore(returnTo);
    }

    function onKey(e) {
      const k = e.key;
      if (k === "ArrowUp" || k === "ArrowDown") {
        e.preventDefault();
        actions.run(k === "ArrowUp" ? "up" : "down");
      } else if (k === "ArrowLeft") {
        e.preventDefault();
        actions.run("prev");
      } else if (k === "ArrowRight") {
        e.preventDefault();
        actions.run("next");
      } else if (k === "Enter") actions.run("confirm");
      else if (k === "Escape") actions.run("back");
      return true;
    }

    function onAction(name, x) {
      switch (name) {
        case "back":
          close(false);
          return true;
        case "confirm":
          close(true);
          return true;
        case "prev":
          step(-1);
          return true;
        case "next":
          step(1);
          return true;
        case "up":
          step(-COLUMNS);
          return true;
        case "down":
          step(COLUMNS);
          return true;
        case "char":
          pickIndex = +x;
          render();
          return true;
        default:
          return false;
      }
    }

    actions.on("fighter", (x, y, top) => {
      const from = router.current();
      if (!top && ["title", "result", "howto", "online", "profile"].includes(from)) open();
    });

    // The live preview plays the highlighted fighter's moves.
    loop.onFrame((dt) => {
      if (router.current() === "fighter") {
        DuelChars.drawPreview(preview, roster()[pickIndex], dt, settings.values.reduceMotion);
      }
    });
    events.on("layout:resized", () => {
      if (router.current() === "fighter") sizePreview();
    });

    return Object.freeze({ open, close });
  },
);
