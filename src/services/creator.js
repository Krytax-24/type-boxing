/**
 * Creator: the player's own fighters (up to three), saved in this browser.
 *
 * A custom fighter is a roster fighter used as a template (body, weapon and animations stay the real, designed ones)
 * plus the player's choices: a name, a main color and a glow color, which of the template's animations each of the
 * four buttons plays, the animations of the projectile (Q) and the rising move (R), three finisher strings of three
 * buttons each with their own names, and 9 stat points shared between power, speed and reach. Everything is cosmetic
 * or a bounded tuning, so a custom fighter is never stronger than a roster one: the stat points are a budget and
 * the finishers have fixed damage. Online, a custom fighter plays as its template, so both screens agree.
 *
 * This module keeps the data and dresses the fighter (characters.js). Modes that give custom fighters their own
 * numbers (Backspace Brawl) listen for "creator:changed" and read fighters().
 */
CounterType.define(
  "creator",
  ["storage", "events", "characters", "fighter-stage"],
  (storage, events, Chars, DuelChars) => {
    "use strict";

    const STORAGE_KEY = "typeboxing.custom";
    const SLOTS = 3;
    const POINTS = 9;
    const STAT_MAX = 6;
    const BUTTONS = ["hp", "lp", "hk", "lk"];
    const CLIPS = ["a1", "a2", "a3", "a4", "air"];
    const NAME_MAX = 14;

    let list = new Array(SLOTS).fill(null); // the saved fighters, one per slot

    const keyOf = (slot) => "my" + (slot + 1);
    const slotOf = (key) => +key[2] - 1;
    const isCustom = (key) => /^my[1-3]$/.test(key);
    const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
    const isClip = (c) => CLIPS.includes(c);
    const templates = () => Chars.ORDER;
    const cleanName = (text, upper) => {
      const name = String(text || "").replace(/[^\w -]/g, "");
      return (upper ? name.trim().toUpperCase() : name.trim()).slice(0, NAME_MAX);
    };

    /** A fresh fighter for a slot. */
    function blank(slot) {
      return {
        name: "FIGHTER " + (slot + 1),
        base: "cyborg",
        main: "#6b48a8",
        glow: "#ff9b3d",
        map: { hp: "a2", lp: "a1", hk: "a4", lk: "a3" },
        q: "a2",
        r: "air",
        combos: [
          { seq: ["lp", "hp", "hk"], name: "Combo one", clip: "a4" },
          { seq: ["lk", "lp", "hp"], name: "Combo two", clip: "a3" },
          { seq: ["hp", "hp", "hk"], name: "Combo three", clip: "a2" },
        ],
        pts: { power: 3, speed: 3, reach: 3 },
      };
    }

    /**
     * Makes any saved or edited value safe: a known template, hex colors, known animations, unique strings and a
     * point budget.
     */
    function clean(d, slot) {
      const o = blank(slot || 0);
      if (!d || typeof d !== "object") return o;
      o.name = cleanName(d.name || o.name, true) || o.name;
      o.base = templates().includes(d.base) ? d.base : o.base;
      if (isHex(d.main)) o.main = d.main.toLowerCase();
      if (isHex(d.glow)) o.glow = d.glow.toLowerCase();
      for (const b of BUTTONS) if (d.map && isClip(d.map[b])) o.map[b] = d.map[b];
      if (isClip(d.q) && d.q !== "air") o.q = d.q;
      if (isClip(d.r)) o.r = d.r;
      const used = new Set();
      o.combos = o.combos.map((fallback, k) => {
        const c = d.combos && d.combos[k] ? d.combos[k] : fallback;
        const valid = Array.isArray(c.seq) && c.seq.length === 3 && c.seq.every((b) => BUTTONS.includes(b));
        let seq = valid ? c.seq.slice() : fallback.seq.slice();
        // Two strings may not be the same: nudge the last button until this one is new.
        while (used.has(seq.join(","))) seq = [seq[0], seq[1], BUTTONS[(BUTTONS.indexOf(seq[2]) + 1) % 4]];
        used.add(seq.join(","));
        return {
          seq,
          name: cleanName(c.name || fallback.name, false) || fallback.name,
          clip: isClip(c.clip) && c.clip !== "air" ? c.clip : fallback.clip,
        };
      });
      const p = d.pts || {};
      const stat = (k) => Math.max(0, Math.min(STAT_MAX, Math.round(+p[k] || 0)));
      let pts = { power: stat("power"), speed: stat("speed"), reach: stat("reach") };
      if (!d.pts) pts = { power: 3, speed: 3, reach: 3 };
      while (pts.power + pts.speed + pts.reach > POINTS) {
        const highest = Object.keys(pts).sort((a, b) => pts[b] - pts[a])[0];
        pts[highest]--;
      }
      o.pts = pts;
      return o;
    }

    // ---------- Colors ----------

    function toHsl(hex) {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      let h = 0;
      let s = 0;
      if (d) {
        s = d / (1 - Math.abs(2 * l - 1));
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
      }
      return [h, s, l];
    }

    function fromHsl(h, s, l) {
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      const sextants = [
        [c, x, 0],
        [x, c, 0],
        [0, c, x],
        [0, x, c],
        [x, 0, c],
        [c, 0, x],
      ];
      const [r, g, b] = sextants[Math.min(5, Math.floor(h / 60))];
      return (
        "#" +
        [r, g, b]
          .map((v) =>
            Math.round((v + m) * 255)
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")
      );
    }

    // Turns the template's palette toward the chosen main color: every colorful entry keeps its lightness and
    // saturation and moves by the same hue step, so a two-color design stays two-colored. Greys, skin, hair and
    // outlines stay as designed. The glow follows the glow color.
    function recolor(pal, main, glow) {
      const out = Object.assign({}, pal);
      const keep = /outline|skin|hair|brown|boot|black|grey/i;
      const colorful = Object.keys(pal).filter(
        (k) => isHex(pal[k]) && !keep.test(k) && toHsl(pal[k])[1] > 0.2 && !/glow|accent/.test(k),
      );
      if (!colorful.length) {
        // An all-grey template (the ronin): tint its armor and cloak toward the main color instead.
        const t = toHsl(main);
        for (const k of Object.keys(pal)) {
          if (/armor|cloak|steel|jacket/i.test(k) && isHex(pal[k])) {
            out[k] = fromHsl(t[0], Math.max(0.35, t[1] * 0.7), toHsl(pal[k])[2]);
          }
        }
      } else {
        const baseHue = toHsl(pal[colorful[0]])[0];
        const target = toHsl(main);
        const step = target[0] - baseHue;
        for (const k of colorful) {
          const [h, s, l] = toHsl(pal[k]);
          out[k] = fromHsl((h + step + 360) % 360, Math.min(1, s * (0.6 + target[1] * 0.5)), l);
        }
      }
      for (const k of Object.keys(pal)) if (/glow|accent/.test(k) && isHex(pal[k])) out[k] = glow;
      return out;
    }

    // ---------- Dressing a fighter ----------

    /** Adds (or replaces) the fighter in the roster under its slot's key. Returns the key. */
    function dress(d, slot) {
      const key = keyOf(slot);
      const base = Chars.DEFS[d.base];
      const pal = recolor(base.pal, d.main, d.glow);
      const def = Object.assign({}, base, { key, name: d.name, title: "Custom " + base.title.toLowerCase(), pal });
      def.parts = { arms: def.arms(pal), legs: def.legs(pal), torso: def.torso(pal), head: def.head(pal) };
      def.prof = { key, body: base.body, style: base.style };
      def.custom = true;
      Chars.DEFS[key] = def;
      DuelChars.resetPreview();
      return key;
    }

    function undress(slot) {
      delete Chars.DEFS[keyOf(slot)];
    }

    // ---------- Saved fighters ----------

    function load() {
      const raw = storage.readJson(STORAGE_KEY); // storage blocked: no custom fighters
      list = list.map((_, slot) => (raw && raw[slot] ? clean(raw[slot], slot) : null));
      list.forEach((d, slot) => {
        if (d) dress(d, slot);
      });
    }

    function save() {
      storage.writeJson(STORAGE_KEY, list);
    }

    function announce(key) {
      events.emit("creator:changed", { key });
    }

    /** The keys of the saved custom fighters. */
    function keys() {
      return list.map((d, slot) => (d ? keyOf(slot) : null)).filter(Boolean);
    }

    /** The saved custom fighters: [{ key, fighter }]. */
    function fighters() {
      return list.map((d, slot) => (d ? { key: keyOf(slot), fighter: d } : null)).filter(Boolean);
    }

    /** A saved fighter (a copy), or null. */
    function get(slot) {
      return list[slot] ? clean(list[slot], slot) : null;
    }

    /** The roster fighter a key plays as online (a custom fighter plays as its template). */
    function baseOf(key) {
      if (isCustom(key) && list[slotOf(key)]) return list[slotOf(key)].base;
      return key;
    }

    /** Saves a fighter into a slot. Returns its key. */
    function commit(draft, slot) {
      list[slot] = clean(draft, slot);
      dress(list[slot], slot);
      save();
      announce(keyOf(slot));
      return keyOf(slot);
    }

    /** Deletes the fighter in a slot. */
    function remove(slot) {
      list[slot] = null;
      save();
      undress(slot);
      announce(keyOf(slot));
    }

    /** Shows an unsaved draft under the slot's key (the live preview while editing). */
    function preview(draft, slot) {
      dress(draft, slot);
    }

    /** Ends a preview: the saved fighter (or nothing) goes back under the slot's key. */
    function endPreview(slot) {
      if (list[slot]) dress(list[slot], slot);
      else undress(slot);
    }

    load();

    return Object.freeze({
      SLOTS,
      POINTS,
      STAT_MAX,
      BUTTONS,
      CLIPS,
      NAME_MAX,
      keyOf,
      slotOf,
      isCustom,
      blank,
      clean,
      recolor,
      keys,
      fighters,
      get,
      baseOf,
      commit,
      remove,
      preview,
      endPreview,
    });
  },
);
