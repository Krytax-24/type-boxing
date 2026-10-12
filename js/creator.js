// Fighter creator: players build up to three fighters of their own. A custom fighter is a roster fighter used as a
// template (body, weapon and animations stay the real, designed ones) plus the choices the player makes:
// a name, a main color and a glow color, which of the template's animations each of the four buttons plays, the
// animations of the projectile (Q) and the rising move (R), three finisher strings of three buttons each with their own
// names, and 9 stat points shared between power, speed and reach. Everything is cosmetic or a bounded tuning, so a
// custom fighter is never stronger than a roster one: the stat points are a budget, the finishers have fixed damage.
// Saved in localStorage ("typeboxing.custom"). Online, a custom fighter plays as its template, so both screens agree.
const Creator = (() => {
  const B = CONFIG.brawl, KEY = "typeboxing.custom", SLOTS = 3, POINTS = 9, STAT_MAX = 6;
  const BUTTONS = ["hp", "lp", "hk", "lk"];
  const BUTTON_NAME = { hp: "High punch", lp: "Low punch", hk: "High kick", lk: "Low kick" };
  const CLIPS = ["a1", "a2", "a3", "a4", "air"];
  const STATS = [["power", "Power", "More damage per hit"], ["speed", "Speed", "Faster attacks"], ["reach", "Reach", "Hits from farther away"]];
  let list = [null, null, null];     // the saved fighters, one per slot
  let draft = null, slot = 0;        // the fighter being edited and its slot
  let onChange = () => {};

  const keyOf = (i) => "my" + (i + 1);
  const isCustom = (key) => /^my[1-3]$/.test(key);
  const hexOk = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
  const clipOk = (c) => CLIPS.includes(c);
  const bases = () => Chars.ORDER;

  function blank(i) {
    return { name: "FIGHTER " + (i + 1), base: "cyborg", main: "#6b48a8", glow: "#ff9b3d",
      map: { hp: "a2", lp: "a1", hk: "a4", lk: "a3" }, q: "a2", r: "air",
      combos: [{ seq: ["lp", "hp", "hk"], name: "Combo one", clip: "a4" }, { seq: ["lk", "lp", "hp"], name: "Combo two", clip: "a3" }, { seq: ["hp", "hp", "hk"], name: "Combo three", clip: "a2" }],
      pts: { power: 3, speed: 3, reach: 3 } };
  }

  // Make any saved or edited value safe: known template, hex colors, known animations, unique strings, a point budget.
  function clean(d, i) {
    const o = blank(i || 0);
    if (!d || typeof d !== "object") return o;
    o.name = String(d.name || o.name).replace(/[^\w \-]/g, "").trim().toUpperCase().slice(0, 14) || o.name;
    o.base = bases().includes(d.base) ? d.base : o.base;
    if (hexOk(d.main)) o.main = d.main.toLowerCase();
    if (hexOk(d.glow)) o.glow = d.glow.toLowerCase();
    for (const b of BUTTONS) if (d.map && clipOk(d.map[b])) o.map[b] = d.map[b];
    if (clipOk(d.q) && d.q !== "air") o.q = d.q;
    if (clipOk(d.r)) o.r = d.r;
    const used = new Set();
    o.combos = o.combos.map((c0, k) => {
      const c = d.combos && d.combos[k] ? d.combos[k] : c0;
      let seq = Array.isArray(c.seq) && c.seq.length === 3 && c.seq.every((b) => BUTTONS.includes(b)) ? c.seq.slice() : c0.seq.slice();
      while (used.has(seq.join(","))) seq = [seq[0], seq[1], BUTTONS[(BUTTONS.indexOf(seq[2]) + 1) % 4]];   // two strings may not be the same
      used.add(seq.join(","));
      return { seq, name: String(c.name || c0.name).replace(/[^\w \-]/g, "").trim().slice(0, 14) || c0.name, clip: clipOk(c.clip) && c.clip !== "air" ? c.clip : c0.clip };
    });
    const p = d.pts || {}, v = (k) => Math.max(0, Math.min(STAT_MAX, Math.round(+p[k] || 0)));
    let pts = { power: v("power"), speed: v("speed"), reach: v("reach") };
    if (!d.pts) pts = { power: 3, speed: 3, reach: 3 };
    while (pts.power + pts.speed + pts.reach > POINTS) { const k = Object.keys(pts).sort((a, b) => pts[b] - pts[a])[0]; pts[k]--; }
    o.pts = pts;
    return o;
  }

  // ---------- Colors ----------
  function toHsl(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, sat = 0;
    if (d) {
      sat = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return [h, sat, l];
  }
  function fromHsl(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
  }
  // Turn the template's palette toward the chosen main color: every colorful entry keeps its lightness and saturation and moves by the
  // same hue step, so a two-color design stays two-colored. Greys, skin, hair and outlines stay as designed. The glow follows the glow color.
  function recolor(pal, main, glow) {
    const out = Object.assign({}, pal), skip = /outline|skin|hair|brown|boot|black|grey/i;
    const entries = Object.keys(pal).filter((k) => hexOk(pal[k]) && !skip.test(k) && toHsl(pal[k])[1] > 0.2 && !/glow|accent/.test(k));
    if (!entries.length) {   // an all-grey template (the ronin): tint its armor and cloak toward the main color instead
      const t = toHsl(main);
      for (const k of Object.keys(pal)) if (/armor|cloak|steel|jacket/i.test(k) && hexOk(pal[k])) out[k] = fromHsl(t[0], Math.max(0.35, t[1] * 0.7), toHsl(pal[k])[2]);
    } else {
    const baseHue = toHsl(pal[entries[0]])[0], target = toHsl(main), step = target[0] - baseHue;
    for (const k of entries) { const [h, sat, l] = toHsl(pal[k]); out[k] = fromHsl((h + step + 360) % 360, Math.min(1, sat * (0.6 + target[1] * 0.5)), l); }
    }
    for (const k of Object.keys(pal)) if (/glow|accent/.test(k) && hexOk(pal[k])) out[k] = glow;
    return out;
  }

  // ---------- Registering a fighter with the game ----------
  function register(d, i) {
    const key = keyOf(i), base = Chars.DEFS[d.base], pal = recolor(base.pal, d.main, d.glow);
    const def = Object.assign({}, base, { key, name: d.name, title: "Custom " + base.title.toLowerCase(), pal });
    def.parts = { arms: def.arms(pal), legs: def.legs(pal), torso: def.torso(pal), head: def.head(pal) };
    def.prof = { key, body: base.body, style: base.style };
    def.custom = true;
    Chars.DEFS[key] = def;
    const bs = B.style[d.base] || B.style.cyborg;
    B.chars[key] = Object.assign({}, B.chars[d.base], { name: d.name });
    B.style[key] = {
      fire: Object.assign({}, bs.fire, { clip: d.q }), dp: Object.assign({}, bs.dp, { clip: d.r }),
      btn: { hp: { clip: d.map.hp }, lp: { clip: d.map.lp }, hk: { clip: d.map.hk }, lk: { clip: d.map.lk } },
      pow: 0.85 + d.pts.power * 0.05, spdK: 0.9 + d.pts.speed * 0.04, reachK: 0.9 + d.pts.reach * 0.03,
      combos: d.combos.map((c) => ({ seq: c.seq.join(","), name: c.name, clip: c.clip, spd: 1.0, dmg: 14, kd: true, rb: 14 })),
    };
    Brawl.dropCache(key);
    if (typeof DuelChars !== "undefined") DuelChars.resetPreview();
    return key;
  }

  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { /* storage blocked: no custom fighters */ }
    list = [0, 1, 2].map((i) => (raw && raw[i] ? clean(raw[i], i) : null));
    list.forEach((d, i) => { if (d) register(d, i); });
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* not saved, still works */ } }

  const keys = () => list.map((d, i) => (d ? keyOf(i) : null)).filter(Boolean);
  const baseOf = (key) => (isCustom(key) && list[+key[2] - 1] ? list[+key[2] - 1].base : key);

  // ---------- The creator screen ----------
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const seg = (field, opts, cur, cls = "") => `<span class="segs ${cls}">` + opts.map(([v, l]) => `<button class="seg ${v === cur ? "sel" : ""}" data-act="cr:${field}:${v}" tabindex="-1">${l}</button>`).join("") + `</span>`;
  const clipLabel = (d, c) => { const t = B.chars[d.base][c]; return (c === "air" ? "Air" : "Style " + c[1]) + (t ? ` ${t[0].toFixed(2)}s` : ""); };
  const row = (label, hint, ctl) => `<div class="optrow cr-row"><span class="lbl">${label}${hint ? `<span class="hint">${hint}</span>` : ""}</span>${ctl}</div>`;

  function html() {
    const d = draft, left = POINTS - d.pts.power - d.pts.speed - d.pts.reach;
    const slots = seg("slot", [0, 1, 2].map((i) => [i, list[i] ? esc(list[i].name) : "Empty " + (i + 1)]), slot, "cr-slots");
    const baseBtns = bases().map((k) => `<button class="seg ${k === d.base ? "sel" : ""}" data-act="cr:base:${k}" tabindex="-1">${esc(Chars.DEFS[k].name)}</button>`).join("");
    const clipOpts = (withAir) => CLIPS.filter((c) => withAir || c !== "air").map((c) => [c, c === "air" ? "Air" : c[1]]);
    const moves = BUTTONS.map((b) => row(BUTTON_NAME[b], `plays ${clipLabel(d, d.map[b])}`, seg("map." + b, clipOpts(true).filter((o) => o[0] !== "air"), d.map[b]))).join("") +
      row("Projectile (Q)", `plays ${clipLabel(d, d.q)}`, seg("q", clipOpts(false), d.q)) +
      row("Rising move (R)", `plays ${clipLabel(d, d.r)}`, seg("r", clipOpts(true), d.r));
    const combos = d.combos.map((c, k) => `<div class="optrow cr-row"><span class="lbl">Finisher ${k + 1}<span class="hint">land a hit, then press the three buttons in order</span></span>
      <span class="cr-combo">${[0, 1, 2].map((j) => `<button class="seg" data-act="cr:cb:${k}${j}" tabindex="-1">${BUTTON_NAME[c.seq[j]].replace(" ", "<br>")}</button>`).join("")}
      <button class="seg" data-act="cr:cclip:${k}" tabindex="-1">${clipLabel(d, c.clip)}</button>
      <input class="cr-name" data-cname="${k}" maxlength="14" value="${esc(c.name)}" aria-label="Finisher ${k + 1} name"></span></div>`).join("");
    const stats = STATS.map(([id, label, hint]) => row(label, hint, `<span class="cr-stat"><button class="seg" data-act="cr:dec:${id}" tabindex="-1">-</button><b>${d.pts[id]}</b><button class="seg" data-act="cr:inc:${id}" tabindex="-1" ${left <= 0 || d.pts[id] >= STAT_MAX ? "disabled" : ""}>+</button></span>`)).join("");
    return `<div id="cr-stage" class="panel"><canvas id="creator-preview"></canvas><div id="loadout-tag"><span>${esc(d.name)}</span><span>CUSTOM FIGHTER</span></div></div>
      <div id="cr-side" class="panel"><h2 class="screen-title">Create a fighter</h2>
      <div class="cr-scroll">
        <div class="set-head">Slot</div>${slots}
        <div class="set-head">Look</div>
        ${row("Name", "up to 14 letters", `<input id="cr-name" maxlength="14" value="${esc(d.name)}" aria-label="Fighter name">`)}
        ${row("Template", "its body, weapon and animations", `<span class="cr-bases">${baseBtns}</span>`)}
        ${row("Main color", "recolors the costume", `<input type="color" id="cr-main" value="${d.main}" aria-label="Main color">`)}
        ${row("Glow color", "weapon and energy effects", `<input type="color" id="cr-glow" value="${d.glow}" aria-label="Glow color">`)}
        <div class="set-head">Moveset</div>${moves}
        <div class="set-head">Finishers</div>${combos}
        <div class="set-head">Stats <span class="tag">${left} point${left === 1 ? "" : "s"} left</span></div>${stats}
      </div>
      <div class="btn-row">${btn("crback", "Back", "")}${btn("crdelete", "Delete", "")}${btn("crsave", "Save", "")}${btn("cruse", "Save and use", "", "primary")}</div></div>`;
  }

  let root = null;
  function render() {
    if (!root) return;
    const keep = root.querySelector(".cr-scroll"), top = keep ? keep.scrollTop : 0;
    root.innerHTML = html();
    const sc = root.querySelector(".cr-scroll"); if (sc) sc.scrollTop = top;
    previewKey();
  }
  function previewKey() { register(draft, slot); }   // the live preview plays the draft under the slot's key

  function open(el, i) {
    root = el; slot = i == null ? Math.max(0, list.findIndex((d) => d)) : i;
    if (slot < 0) slot = 0;
    draft = clean(list[slot] || blank(slot), slot);
    if (!el.dataset.wired) {
      el.dataset.wired = "1";
      el.addEventListener("input", (e) => {
        const t = e.target;
        if (t.id === "cr-name") { draft.name = t.value.replace(/[^\w \-]/g, "").toUpperCase().slice(0, 14); previewKey(); const tag = el.querySelector("#loadout-tag span"); if (tag) tag.textContent = draft.name; }
        else if (t.id === "cr-main") { draft.main = t.value; previewKey(); }
        else if (t.id === "cr-glow") { draft.glow = t.value; previewKey(); }
        else if (t.dataset && t.dataset.cname !== undefined) draft.combos[+t.dataset.cname].name = t.value.replace(/[^\w \-]/g, "").slice(0, 14);
      });
    }
    render();
  }
  const previewKeyName = () => keyOf(slot);

  // Clicks from main.js act(): "cr:field:value".
  function act(field, value) {
    const d = draft, cycle = (arr, cur) => arr[(arr.indexOf(cur) + 1) % arr.length];
    if (field === "slot") { slot = +value; draft = clean(list[slot] || blank(slot), slot); }
    else if (field === "base") { d.base = value; }
    else if (field.startsWith("map.")) d.map[field.slice(4)] = value;
    else if (field === "q") d.q = value;
    else if (field === "r") d.r = value;
    else if (field === "cb") {
      const k = +value[0], j = +value[1], c = d.combos[k];
      c.seq[j] = cycle(BUTTONS, c.seq[j]);
      if (d.combos.some((o, n) => n !== k && o.seq.join(",") === c.seq.join(","))) c.seq[j] = cycle(BUTTONS, c.seq[j]);
    }
    else if (field === "cclip") { const c = d.combos[+value]; c.clip = cycle(["a1", "a2", "a3", "a4"], c.clip); }
    else if (field === "inc" || field === "dec") {
      const used = d.pts.power + d.pts.speed + d.pts.reach;
      if (field === "inc" && used < POINTS && d.pts[value] < STAT_MAX) d.pts[value]++;
      if (field === "dec" && d.pts[value] > 0) d.pts[value]--;
    }
    render();
  }
  // Save the draft into its slot. Returns the key.
  function commit() {
    list[slot] = clean(draft, slot); draft = clean(list[slot], slot);
    register(list[slot], slot); save(); onChange();
    return keyOf(slot);
  }
  function remove() {
    list[slot] = null; save(); delete Chars.DEFS[keyOf(slot)]; onChange();
    draft = clean(blank(slot), slot); render();
  }
  function close() {
    // Drop an unsaved preview: put the saved fighter (or nothing) back under the slot key.
    if (list[slot]) register(list[slot], slot); else delete Chars.DEFS[keyOf(slot)];
    draft = null;
  }

  return { load, keys, baseOf, isCustom, keyOf, open, act, commit, remove, close, render, draft: () => draft, slotKey: previewKeyName, setOnChange: (f) => { onChange = f; }, clean, blank, register, recolor, POINTS };
})();
