/**
 * Creator page (#scr-creator): build up to three fighters of your own (the data lives in creator.js).
 * The live fighter on the left plays the draft as you edit it; the form on the right sets the look, the moveset,
 * the finishers and the stat points.
 */
CounterType.define(
  "creator-page",
  [
    "router",
    "registry",
    "actions",
    "events",
    "creator",
    "player",
    "characters",
    "fighter-stage",
    "settings",
    "layout",
    "loop",
    "toast",
    "buttons",
    "keyline",
    "dom",
  ],
  (
    router,
    registry,
    actions,
    events,
    creator,
    player,
    Chars,
    DuelChars,
    settings,
    layout,
    loop,
    toast,
    buttons,
    keyline,
    dom,
  ) => {
    "use strict";

    const PREVIEW_SIZE = [446, 520];
    const BUTTON_NAME = { hp: "High punch", lp: "Low punch", hk: "High kick", lk: "Low kick" };
    const STATS = [
      ["power", "Power", "More damage per hit"],
      ["speed", "Speed", "Faster attacks"],
      ["reach", "Reach", "Hits from farther away"],
    ];
    const esc = dom.escapeHtml;

    let draft = null;
    let slot = 0;
    let returnTo = "fighter";

    const el = router.register({ id: "creator", onKey, onAction });

    // ---------- The form ----------

    const segs = (field, choices, current, cls = "") =>
      `<span class="segs ${cls}">` +
      choices.map(([v, l]) => buttons.segment(`cr:${field}:${v}`, l, { selected: v === current })).join("") +
      `</span>`;

    // A clip's name, with its length when a mode that times the moves says it ("clip-timing": { seconds(base, clip) }).
    function clipLabel(d, clip) {
      const timing = registry.list("clip-timing")[0];
      const seconds = timing ? timing.seconds(d.base, clip) : null;
      return (clip === "air" ? "Air" : "Style " + clip[1]) + (seconds ? ` ${seconds.toFixed(2)}s` : "");
    }

    const row = (label, hint, control) =>
      `<div class="optrow cr-row"><span class="lbl">${label}${hint ? `<span class="hint">${hint}</span>` : ""}</span>${control}</div>`;

    function html() {
      const d = draft;
      const left = creator.POINTS - d.pts.power - d.pts.speed - d.pts.reach;
      const slots = segs(
        "slot",
        [0, 1, 2].map((i) => {
          const saved = creator.get(i);
          return [i, saved ? esc(saved.name) : "Empty " + (i + 1)];
        }),
        slot,
        "cr-slots",
      );
      const templates = Chars.ORDER.map((k) =>
        buttons.segment(`cr:base:${k}`, esc(Chars.DEFS[k].name), { selected: k === d.base }),
      ).join("");
      const clipChoices = (withAir) =>
        creator.CLIPS.filter((c) => withAir || c !== "air").map((c) => [c, c === "air" ? "Air" : c[1]]);
      const moves =
        creator.BUTTONS.map((b) =>
          row(
            BUTTON_NAME[b],
            `plays ${clipLabel(d, d.map[b])}`,
            segs(
              "map." + b,
              clipChoices(true).filter((o) => o[0] !== "air"),
              d.map[b],
            ),
          ),
        ).join("") +
        row("Projectile (Q)", `plays ${clipLabel(d, d.q)}`, segs("q", clipChoices(false), d.q)) +
        row("Rising move (R)", `plays ${clipLabel(d, d.r)}`, segs("r", clipChoices(true), d.r));
      const finishers = d.combos
        .map((c, k) => {
          const presses = [0, 1, 2]
            .map((j) => buttons.segment(`cr:cb:${k}${j}`, BUTTON_NAME[c.seq[j]].replace(" ", "<br>")))
            .join("");
          return `<div class="optrow cr-row"><span class="lbl">Finisher ${k + 1}<span class="hint">land a hit, then press the three buttons in order</span></span>
      <span class="cr-combo">${presses}
      ${buttons.segment(`cr:cclip:${k}`, clipLabel(d, c.clip))}
      <input class="cr-name" data-cname="${k}" maxlength="${creator.NAME_MAX}" value="${esc(c.name)}" aria-label="Finisher ${k + 1} name"></span></div>`;
        })
        .join("");
      const stats = STATS.map(([id, label, hint]) => {
        const full = left <= 0 || d.pts[id] >= creator.STAT_MAX;
        return row(
          label,
          hint,
          `<span class="cr-stat">${buttons.segment(`cr:dec:${id}`, "-")}<b>${d.pts[id]}</b>${buttons.segment(`cr:inc:${id}`, "+", { disabled: full })}</span>`,
        );
      }).join("");
      return `<div id="cr-stage" class="panel"><canvas id="creator-preview"></canvas><div id="loadout-tag"><span>${esc(d.name)}</span><span>CUSTOM FIGHTER</span></div></div>
      <div id="cr-side" class="panel"><h2 class="screen-title">Create a fighter</h2>
      <div class="cr-scroll">
        <div class="set-head">Slot</div>${slots}
        <div class="set-head">Look</div>
        ${row("Name", "up to 14 letters", `<input id="cr-name" maxlength="${creator.NAME_MAX}" value="${esc(d.name)}" aria-label="Fighter name">`)}
        ${row("Template", "its body, weapon and animations", `<span class="cr-bases">${templates}</span>`)}
        ${row("Main color", "recolors the costume", `<input type="color" id="cr-main" value="${d.main}" aria-label="Main color">`)}
        ${row("Glow color", "weapon and energy effects", `<input type="color" id="cr-glow" value="${d.glow}" aria-label="Glow color">`)}
        <div class="set-head">Moveset</div>${moves}
        <div class="set-head">Finishers</div>${finishers}
        <div class="set-head">Stats <span class="tag">${left} point${left === 1 ? "" : "s"} left</span></div>${stats}
      </div>
      <div class="btn-row">${buttons.button("crback", "Back")}${buttons.button("crdelete", "Delete")}${buttons.button("crsave", "Save")}${buttons.button("cruse", "Save and use", { primary: true })}</div></div>`;
    }

    function preview() {
      return dom.byId("creator-preview");
    }

    function sizePreview() {
      const canvas = preview();
      if (!canvas) return;
      const ratio = dom.pixelRatio(3);
      canvas.width = Math.round(PREVIEW_SIZE[0] * layout.scale() * ratio);
      canvas.height = Math.round(PREVIEW_SIZE[1] * layout.scale() * ratio);
    }

    function render() {
      const kept = el.querySelector(".cr-scroll");
      const scrollTop = kept ? kept.scrollTop : 0;
      el.innerHTML = html();
      const scroller = el.querySelector(".cr-scroll");
      if (scroller) scroller.scrollTop = scrollTop;
      creator.preview(draft, slot); // the live preview plays the draft under the slot's key
      sizePreview();
    }

    // Typing in the form's text and color boxes updates the draft at once.
    el.addEventListener("input", (e) => {
      const t = e.target;
      if (t.id === "cr-name") {
        draft.name = t.value
          .replace(/[^\w -]/g, "")
          .toUpperCase()
          .slice(0, creator.NAME_MAX);
        creator.preview(draft, slot);
        const tag = el.querySelector("#loadout-tag span");
        if (tag) tag.textContent = draft.name;
      } else if (t.id === "cr-main") {
        draft.main = t.value;
        creator.preview(draft, slot);
      } else if (t.id === "cr-glow") {
        draft.glow = t.value;
        creator.preview(draft, slot);
      } else if (t.dataset && t.dataset.cname !== undefined) {
        draft.combos[+t.dataset.cname].name = t.value.replace(/[^\w -]/g, "").slice(0, creator.NAME_MAX);
      }
    });

    // ---------- Opening and closing ----------

    /** Opens the page on a slot (or on the first saved fighter). */
    function open(startSlot) {
      const from = router.current();
      returnTo = from === "title" ? "title" : "fighter";
      const first = creator.fighters()[0];
      slot = startSlot !== undefined && startSlot !== null ? startSlot : first ? creator.slotOf(first.key) : 0;
      draft = creator.clean(creator.get(slot) || creator.blank(slot), slot);
      router.show("creator");
      keyline.clear();
      render();
    }

    function close() {
      creator.endPreview(slot);
      draft = null;
      router.restore(returnTo);
    }

    function save(use) {
      const key = creator.commit(draft, slot);
      draft = creator.clean(creator.get(slot), slot);
      toast.show(use ? "Fighter saved and ready." : "Fighter saved.");
      if (use) {
        player.setFighter(key);
        close();
      } else {
        sizePreview();
      }
    }

    function remove() {
      creator.remove(slot);
      draft = creator.clean(creator.blank(slot), slot);
      render();
      toast.show("Fighter deleted.");
    }

    // ---------- Editing ----------

    // Clicks on the form: "cr:field:value".
    function edit(field, value) {
      const d = draft;
      const cycle = (list, current) => list[(list.indexOf(current) + 1) % list.length];
      if (field === "slot") {
        creator.endPreview(slot);
        slot = +value;
        draft = creator.clean(creator.get(slot) || creator.blank(slot), slot);
      } else if (field === "base") d.base = value;
      else if (field.startsWith("map.")) d.map[field.slice(4)] = value;
      else if (field === "q") d.q = value;
      else if (field === "r") d.r = value;
      else if (field === "cb") {
        const k = +value[0];
        const j = +value[1];
        const combo = d.combos[k];
        combo.seq[j] = cycle(creator.BUTTONS, combo.seq[j]);
        // Two finishers may not share a string: skip to the next button if this one is taken.
        const same = d.combos.some((other, n) => n !== k && other.seq.join(",") === combo.seq.join(","));
        if (same) combo.seq[j] = cycle(creator.BUTTONS, combo.seq[j]);
      } else if (field === "cclip") {
        const combo = d.combos[+value];
        combo.clip = cycle(["a1", "a2", "a3", "a4"], combo.clip);
      } else if (field === "inc" || field === "dec") {
        const used = d.pts.power + d.pts.speed + d.pts.reach;
        if (field === "inc" && used < creator.POINTS && d.pts[value] < creator.STAT_MAX) d.pts[value]++;
        if (field === "dec" && d.pts[value] > 0) d.pts[value]--;
      }
      render();
    }

    // ---------- Input ----------

    function onKey(e) {
      if (e.key === "Escape") actions.run("crback");
      return true;
    }

    function onAction(name, x, y) {
      switch (name) {
        case "cr":
          edit(x, y);
          return true;
        case "crsave":
          save(false);
          return true;
        case "cruse":
          save(true);
          return true;
        case "crdelete":
          remove();
          return true;
        case "crback":
        case "back":
          close();
          return true;
        default:
          return false;
      }
    }

    actions.on("creator", (x, y, top) => {
      const from = router.current();
      if (top || (from !== "fighter" && from !== "title")) return;
      const mine = player.fighter();
      open(creator.isCustom(mine) ? creator.slotOf(mine) : null);
    });

    // The Fighter page offers a card that opens this page.
    registry.add("fighter-card", {
      id: "create",
      html: () =>
        `<button class="char pick char-new" data-act="creator" tabindex="-1"><b>+ Create</b><span>Your own moveset</span></button>`,
    });

    loop.onFrame((dt) => {
      const canvas = preview();
      if (router.current() === "creator" && canvas) {
        DuelChars.drawPreview(canvas, creator.keyOf(slot), dt, settings.values.reduceMotion);
      }
    });
    events.on("layout:resized", () => {
      if (router.current() === "creator") sizePreview();
    });

    return Object.freeze({ open, close });
  },
);
