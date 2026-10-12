// Themes: preset palettes, the theme editor's engine, a share code, a custom background and custom CSS.
// Visual only. Nothing here touches js/duel.js, js/duel-typing.js or any number in CONFIG.duel.
//
// How it works: CONFIG.theme (js/config.js) holds the Terminal Arcade palette. Everything that draws
// (render.js, duel.js, main.js, css/duel.css through CSS variables) reads that one object, so a theme
// is applied by rewriting its values IN PLACE and telling the renderer to rebuild its scenery layers.
// A theme is described by 11 colors ("slots"); everything else (raised panels, scenery, floating text,
// word plate colors) is derived from them, so a custom theme can never leave a color behind.
//
// Only the player's own CSS is ever applied, never CSS received from another player: CSS can load remote
// images and hide parts of the interface.
const Themes = (() => {
  const KEY = "typeboxing.theme";        // { id, slots }  (slots only when the theme is custom)
  const BG_KEY = "typeboxing.bg";        // background settings (the image file itself lives in IndexedDB)
  const CSS_KEY = "typeboxing.css";      // the player's custom CSS
  const MAX_CSS = 20000;

  // The 11 slots a theme is made of (what the editor shows). `you` and `foe` are the two identity colors.
  const SLOTS = [
    { key: "bg", label: "Background" }, { key: "surface", label: "Panels" }, { key: "line", label: "Lines" },
    { key: "text", label: "Text" }, { key: "dim", label: "Quiet text" },
    { key: "accent", label: "Accent" }, { key: "focus", label: "Focus" }, { key: "gold", label: "Ultimate" },
    { key: "danger", label: "Danger" }, { key: "you", label: "Your color" }, { key: "foe", label: "Opponent" },
  ];

  // ---------- color helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isHex = (s) => typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
  const rgbStr = (h) => rgb(h).join(", ");
  const rgba = (h, a) => `rgba(${rgbStr(h)}, ${a})`;
  const lum = (h) => { const c = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const isLight = (bg) => lum(bg) > 0.4;

  // ---------- presets ----------
  // Terminal Arcade is the original look and is captured from config.js at load, so it can never drift.
  // The others are given as slots only; everything else is derived.
  const ORIGINAL = {
    ui: JSON.parse(JSON.stringify(CONFIG.theme.ui)),
    arena: JSON.parse(JSON.stringify(CONFIG.theme.arena)),
    fx: JSON.parse(JSON.stringify(CONFIG.theme.fx)),
    you: Object.assign({}, CONFIG.chars.you), foe: Object.assign({}, CONFIG.chars.foe),
  };
  const slotsOfOriginal = () => ({
    bg: ORIGINAL.ui.bg, surface: ORIGINAL.ui.surface, line: ORIGINAL.ui.line, text: ORIGINAL.ui.text, dim: ORIGINAL.ui.dim,
    accent: ORIGINAL.ui.phosphor, focus: ORIGINAL.ui.magenta, gold: ORIGINAL.ui.gold, danger: ORIGINAL.ui.danger,
    you: ORIGINAL.you.body, foe: ORIGINAL.foe.body,
  });

  const PRESETS = [
    { id: "terminal-arcade", name: "Terminal Arcade", note: "The original: navy, green and magenta", slots: slotsOfOriginal(), original: true },
    { id: "amber-crt", name: "Amber CRT", note: "Old monitor, amber on warm black",
      slots: { bg: "#0d0905", surface: "#17100a", line: "#6b4a22", text: "#ffecc8", dim: "#cfa86c", accent: "#ffb000", focus: "#5fd7ff", gold: "#ffe27a", danger: "#ff5a4d", you: "#ffb000", foe: "#6ec8ff" } },
    { id: "blueprint", name: "Blueprint", note: "Drafting paper blue with white lines",
      slots: { bg: "#06213f", surface: "#0a2d54", line: "#4a86c8", text: "#eef6ff", dim: "#a5c8f0", accent: "#8fe9ff", focus: "#ff9ec7", gold: "#ffd45e", danger: "#ff7070", you: "#8fe9ff", foe: "#ffc78a" } },
    { id: "moss", name: "Moss Console", note: "Forest green, calm and low glare",
      slots: { bg: "#08120c", surface: "#0e1c13", line: "#34663f", text: "#e8f6ea", dim: "#9cc4a5", accent: "#8dff6b", focus: "#ff9ad5", gold: "#ffd76a", danger: "#ff6060", you: "#8dff6b", foe: "#f9a65b" } },
    { id: "violet", name: "Midnight Violet", note: "Deep indigo with a mint accent",
      slots: { bg: "#0e0a1f", surface: "#170f33", line: "#5a48a8", text: "#f1ecff", dim: "#b8abea", accent: "#7cffd0", focus: "#ff7ad9", gold: "#ffd166", danger: "#ff6482", you: "#7cffd0", foe: "#ffa45c" } },
    { id: "graphite", name: "Graphite", note: "Neutral greys, one warm highlight",
      slots: { bg: "#0b0b0c", surface: "#151517", line: "#46464c", text: "#f2f2f4", dim: "#a9a9b2", accent: "#f2f2f4", focus: "#ffb347", gold: "#ffd84d", danger: "#ff6060", you: "#d9d9e0", foe: "#ff9d5c" } },
    { id: "contrast", name: "High Contrast", note: "Maximum readability",
      slots: { bg: "#000000", surface: "#0a0a0a", line: "#c4c4c4", text: "#ffffff", dim: "#d6d6d6", accent: "#39ff88", focus: "#ff5fdc", gold: "#ffc400", danger: "#ff6060", you: "#39ff88", foe: "#ffa01f" } },
    { id: "daylight", name: "Daylight", note: "A light theme for bright rooms",
      slots: { bg: "#e7ecf6", surface: "#ffffff", line: "#8d9bbd", text: "#0d1630", dim: "#46557a", accent: "#08724a", focus: "#b3125a", gold: "#7a4f00", danger: "#b3261e", you: "#08724a", foe: "#a84300" } },
  ];
  const presetById = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0];

  // ---------- from slots to a whole theme ----------
  // `base` (optional) is the preset a custom theme started from; its hand-made values are reused while the
  // slots they depend on are unchanged, so tweaking one color of Terminal Arcade leaves the rest identical.
  function build(slots, base) {
    const s = slots, light = isLight(s.bg);
    const same = (keys) => base && keys.every((k) => base.slots[k] === s[k]);
    const ui = {
      bg: s.bg, surface: s.surface, line: s.line, text: s.text, dim: s.dim,
      phosphor: s.accent, magenta: s.focus, gold: s.gold, danger: s.danger,
      raised: mix(s.surface, s.line, light ? 0.18 : 0.25),
      track: mix(s.surface, s.line, light ? 0.45 : 0.45),
      warn: mix(s.danger, s.gold, 0.5),
      info: mix(s.accent, s.text, 0.35),
    };
    if (base && base.original) {
      if (same(["surface", "line"])) { ui.raised = ORIGINAL.ui.raised; ui.track = ORIGINAL.ui.track; }
      if (same(["danger", "gold"])) ui.warn = ORIGINAL.ui.warn;
      if (same(["accent", "text"])) ui.info = ORIGINAL.ui.info;
    }
    let arena;
    if (base && base.original && same(["bg", "surface", "line", "accent", "focus", "gold"])) {
      arena = JSON.parse(JSON.stringify(ORIGINAL.arena));
    } else {
      arena = {
        skyTop: s.bg, skyBottom: mix(s.bg, s.line, light ? 0.18 : 0.26),
        glow: rgba(s.accent, light ? 0.1 : 0.07),
        far: mix(s.bg, s.line, light ? 0.2 : 0.16), farEdge: mix(s.bg, s.line, light ? 0.4 : 0.32), farWindow: rgba(ui.info, light ? 0.18 : 0.1),
        mid: mix(s.bg, s.line, light ? 0.3 : 0.2), midEdge: mix(s.bg, s.line, light ? 0.5 : 0.4),
        screen: mix(s.bg, s.accent, light ? 0.22 : 0.1), screenText: rgba(s.accent, light ? 0.5 : 0.22),
        floor: mix(s.bg, s.surface, 0.7), floorLine: s.line, grid: rgba(s.line, 0.55), cable: ui.raised,
        scan: light ? "rgba(0, 0, 0, 0.05)" : "rgba(0, 0, 0, 0.16)",
        sweep: light ? "rgba(255, 255, 255, 0.22)" : rgba(ui.info, 0.035),
        leds: [s.accent, s.focus, ui.info],
        shadow: light ? "rgba(20, 30, 60, 0.28)" : "rgba(0, 0, 0, 0.45)",
        flash: rgbStr(s.gold),
      };
    }
    const fx = {
      combo: ui.info, broken: s.dim, counter: s.focus, ult: s.gold, sloppy: s.dim,
      ko: s.danger, hit: "#ffffff", block: ui.info, ring: s.dim,
    };
    if (base && base.original && same(["accent", "text", "dim", "focus", "gold", "danger"])) Object.assign(fx, ORIGINAL.fx);
    const you = { body: s.you, letters: s.you };
    const foe = { body: s.foe, letters: light ? mix(s.foe, "#000000", 0.12) : mix(s.foe, "#ffffff", 0.35) };
    if (base && base.original && s.you === ORIGINAL.you.body) you.letters = ORIGINAL.you.letters;
    if (base && base.original && s.foe === ORIGINAL.foe.body) foe.letters = ORIGINAL.foe.letters;
    // Word plate colors (the plates are drawn on the canvas, from CONFIG.wordPlate.colors).
    const plate = {
      plate: rgba(s.surface, 0.92), border: s.line,
      untyped: mix(s.text, s.dim, 0.25), next: s.dim, extra: mix(s.danger, s.surface, 0.35),
      wrong: s.danger, caret: s.focus, caretAlt: s.text, wrongMark: s.danger, extraMark: mix(s.danger, s.surface, 0.35),
      ultPlate: rgba(mix(s.surface, s.gold, light ? 0.18 : 0.1), 0.94), ultBorder: s.gold, ultGlow: rgba(s.gold, 0.55), ultTag: s.gold,
      ultUntyped: mix(s.gold, s.text, 0.6), ultNext: mix(s.gold, s.surface, 0.35),
    };
    return { ui, arena, fx, you, foe, plate, light };
  }

  // ---------- state ----------
  let current = { id: "terminal-arcade", slots: Object.assign({}, PRESETS[0].slots), baseId: "terminal-arcade" };
  const listeners = [];

  function writeCss(t) {
    const root = document.documentElement.style, U = t.ui;
    for (const k in U) root.setProperty("--" + k, U[k]);
    for (const k of ["bg", "surface", "raised", "line", "text", "phosphor", "magenta", "gold"]) root.setProperty("--" + k + "-rgb", rgbStr(U[k]));
    root.setProperty("--outline-rgb", t.light ? "255, 255, 255" : "2, 4, 12");
    root.setProperty("--panel-bg", rgba(U.surface, 0.9));
    root.setProperty("--ult-dim", mix(t.ui.gold, t.ui.surface, 0.35));
    root.setProperty("--extra", mix(t.ui.danger, t.ui.surface, 0.35));
    root.setProperty("color-scheme", t.light ? "light" : "dark");
  }

  function applyTheme() {
    const base = presetById(current.baseId);
    const t = build(current.slots, base);
    // Rewrite the shared objects in place: every module holds a reference to them.
    Object.assign(CONFIG.theme.ui, t.ui);
    Object.assign(CONFIG.theme.arena, t.arena);
    Object.assign(CONFIG.theme.fx, t.fx);
    Object.assign(CONFIG.chars.you, t.you);
    Object.assign(CONFIG.chars.foe, t.foe);
    Object.assign(CONFIG.wordPlate.colors, t.plate);
    CONFIG.floatText.lose = t.ui.warn;
    CONFIG.floatText.gain = t.ui.phosphor;
    writeCss(t);
    listeners.forEach((fn) => { try { fn(); } catch (e) { /* a listener must never break the theme */ } });
    save();
  }

  function save() {
    try {
      const o = { id: current.id, baseId: current.baseId };
      if (current.id === "custom") o.slots = current.slots;
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) { /* storage blocked: the theme just is not remembered */ }
  }

  function validSlots(o) {
    return o && typeof o === "object" && SLOTS.every((s) => isHex(o[s.key]));
  }

  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || "null");
      if (o && o.id === "custom" && validSlots(o.slots)) {
        current = { id: "custom", slots: Object.assign({}, o.slots), baseId: PRESETS.some((p) => p.id === o.baseId) ? o.baseId : "terminal-arcade" };
      } else if (o && PRESETS.some((p) => p.id === o.id)) {
        current = { id: o.id, slots: Object.assign({}, presetById(o.id).slots), baseId: o.id };
      }
    } catch (e) { /* corrupt: keep the default */ }
  }

  function setPreset(id) {
    const p = presetById(id);
    current = { id: p.id, slots: Object.assign({}, p.slots), baseId: p.id };
    applyTheme();
  }
  // Change one color: the theme becomes "custom", based on the preset it started from.
  function setSlot(key, value) {
    if (!isHex(value) || !SLOTS.some((s) => s.key === key)) return false;
    current = { id: "custom", slots: Object.assign({}, current.slots, { [key]: value.toLowerCase() }), baseId: current.baseId };
    applyTheme();
    return true;
  }

  // ---------- share code: "TB1." + 11 colors ----------
  // Short enough to paste in a chat. Only hex colors are read back, so a code can never carry anything else.
  function exportCode() {
    const raw = SLOTS.map((s) => current.slots[s.key].slice(1)).join("");
    return "TB1." + raw;
  }
  function importCode(code) {
    const m = /^TB1\.([0-9a-fA-F]{66})$/.exec(String(code || "").trim());
    if (!m) return false;
    const slots = {};
    SLOTS.forEach((s, i) => { slots[s.key] = "#" + m[1].slice(i * 6, i * 6 + 6).toLowerCase(); });
    current = { id: "custom", slots, baseId: "terminal-arcade" };
    applyTheme();
    return true;
  }

  // ---------- custom CSS ----------
  let cssText = "";
  const cssSafeMode = typeof location !== "undefined" && /[?&]nocss\b/.test(location.search); // ?nocss starts without it
  function applyCss() {
    let el = document.getElementById("user-css");
    if (!el) { el = document.createElement("style"); el.id = "user-css"; document.head.appendChild(el); }
    el.textContent = cssSafeMode ? "" : cssText; // added last, so it wins over css/duel.css
  }
  function setCss(text) {
    cssText = String(text || "").slice(0, MAX_CSS);
    try { localStorage.setItem(CSS_KEY, cssText); } catch (e) { /* not saved, still applied */ }
    applyCss();
  }
  function loadCss() {
    try { cssText = (localStorage.getItem(CSS_KEY) || "").slice(0, MAX_CSS); } catch (e) { cssText = ""; }
    applyCss();
  }

  // ---------- custom background ----------
  // An image URL, or a file from this computer (kept in IndexedDB: images are too big for localStorage).
  // Four filters and a size mode. The renderer draws it in place of the far and mid scenery layers.
  const BG_DEFAULT = { url: "", hasFile: false, mode: "cover", blur: 0, brightness: 100, opacity: 100, saturate: 100 };
  const bg = Object.assign({}, BG_DEFAULT);
  let bgImage = null, bgVersion = 0, bgBlobUrl = "";

  function saveBg() { try { localStorage.setItem(BG_KEY, JSON.stringify(bg)); } catch (e) { /* ignore */ } }
  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open("typeboxing", 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => req.result.createObjectStore("files");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction("files", mode), store = tx.objectStore("files"), r = fn(store);
          tx.oncomplete = () => resolve(r && "result" in r ? r.result : undefined);
          tx.onerror = () => reject(tx.error);
        } catch (e) { reject(e); }
      };
    });
  }
  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The image could not be loaded."));
    img.src = src;
  });
  async function refreshBgImage() {
    bgVersion++;
    if (bgBlobUrl) { URL.revokeObjectURL(bgBlobUrl); bgBlobUrl = ""; }
    bgImage = null;
    try {
      if (bg.hasFile) {
        const blob = await idb("readonly", (s) => s.get("bg"));
        if (blob) { bgBlobUrl = URL.createObjectURL(blob); bgImage = await loadImage(bgBlobUrl); }
      } else if (bg.url) {
        bgImage = await loadImage(bg.url);
      }
    } catch (e) { bgImage = null; listeners.forEach((fn) => fn(e)); return false; }
    bgVersion++;
    listeners.forEach((fn) => { try { fn(); } catch (e2) { /* ignore */ } });
    return !!bgImage;
  }
  function setBg(patch) {
    Object.assign(bg, patch);
    saveBg();
    bgVersion++;
    listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
  }
  async function setBgUrl(url) {
    url = String(url || "").trim();
    if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url) && url !== "") throw new Error("Use an address that starts with https://");
    bg.url = url; bg.hasFile = false; saveBg();
    try { await idb("readwrite", (s) => s.delete("bg")); } catch (e) { /* ignore */ }
    return refreshBgImage();
  }
  async function setBgFile(file) {
    if (!file || !/^image\//.test(file.type)) throw new Error("Choose an image file.");
    if (file.size > 15 * 1024 * 1024) throw new Error("That image is over 15 MB. Pick a smaller one.");
    try { await idb("readwrite", (s) => s.put(file, "bg")); } catch (e) { throw new Error("This browser would not store the image here."); }
    bg.hasFile = true; bg.url = ""; saveBg();
    return refreshBgImage();
  }
  async function clearBg() {
    Object.assign(bg, { url: "", hasFile: false });
    saveBg();
    try { await idb("readwrite", (s) => s.delete("bg")); } catch (e) { /* ignore */ }
    return refreshBgImage();
  }
  function loadBg() {
    try {
      const o = JSON.parse(localStorage.getItem(BG_KEY) || "null");
      if (o && typeof o === "object") {
        for (const k in BG_DEFAULT) if (typeof o[k] === typeof BG_DEFAULT[k]) bg[k] = o[k];
        if (!["cover", "contain", "stretch"].includes(bg.mode)) bg.mode = "cover";
      }
    } catch (e) { /* defaults */ }
    if (bg.url || bg.hasFile) refreshBgImage();
  }

  function init() {
    load();
    applyTheme();
    loadCss();
    loadBg();
  }

  return {
    SLOTS, PRESETS, init, onChange: (fn) => listeners.push(fn),
    get current() { return current; }, get light() { return isLight(current.slots.bg); },
    setPreset, setSlot, exportCode, importCode,
    get css() { return cssText; }, setCss, MAX_CSS, cssSafeMode,
    bg, setBg, setBgUrl, setBgFile, clearBg,
    get bgImage() { return bgImage; }, get bgVersion() { return bgVersion; },
    // exposed for tests
    build, contrast, mix, isHex, rgba,
  };
})();
