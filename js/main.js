// Wires the duel, the typing view, the HUD, the menus, the mouse and the keyboard together.
// The arena canvas fills the window; #ui floats over it (see resize()).

const $ = (id) => document.getElementById(id);
const LINE_H = 46;

// ---------- Monkeytype style text view for the human's stream (Classic view) ----------
class StreamView {
  constructor(stream) {
    this.stream = stream;
    this.inner = $("words-inner");
    this.caret = $("caret");
    this.els = [];
    this.rendered = 0;
    this.scroll = 0;
    this.typingTimer = null;
    this.rebuild();
  }

  rebuild() {
    [...this.inner.querySelectorAll(".word")].forEach((el) => el.remove());
    this.els = [];
    this.stream.words.forEach((w, i) => this.addWord(i));
    this.scroll = 0;
    this.inner.style.transform = "translateY(0)";
    this.rendered = 0;
    this.update();
  }

  addWord(i) {
    const el = document.createElement("span");
    el.className = "word";
    el._w = this.stream.words[i];
    this.inner.insertBefore(el, this.caret);
    this.els.push(el);
    this.renderWord(i);
  }

  // Keep the elements in step with the stream (new words, inserted ultimate word).
  sync() {
    const words = this.stream.words;
    if (words.length === this.els.length && this.els.every((el, i) => el._w === words[i])) return false;
    const stale = this.els.some((el, i) => i < words.length && el._w !== words[i]) || words.length < this.els.length;
    if (stale) { this.rebuild(); return true; }
    for (let i = this.els.length; i < words.length; i++) this.addWord(i);
    return true;
  }

  renderWord(i) {
    const w = this.stream.words[i], el = this.els[i];
    const s = this.stream;
    const typed = i < s.index ? w.typedFinal || "" : i === s.index ? s.typed : "";
    const done = i < s.index;
    let html = "";
    const n = Math.max(w.text.length, typed.length);
    for (let j = 0; j < n; j++) {
      const ch = j < w.text.length ? w.text[j] : typed[j];
      let cls = "";
      if (j < typed.length) cls = j < w.text.length ? (typed[j] === w.text[j] ? "ok" : "bad") : "bad extra";
      html += cls ? `<span class="${cls}">${ch}</span>` : `<span>${ch}</span>`;
    }
    el.innerHTML = html;
    el.className = "word" + (w.ultimate ? " ult" : "") + (done && w.typedFinal !== w.text ? " wrong" : "");
  }

  update() {
    this.sync();
    const s = this.stream;
    // Re-render the words that changed: everything from the last rendered word to the current one.
    for (let i = Math.max(0, this.rendered - 1); i <= s.index && i < this.els.length; i++) this.renderWord(i);
    this.rendered = s.index;

    const cur = this.els[s.index];
    if (!cur) return;
    const letters = cur.children;
    const at = Math.min(s.typed.length, letters.length);
    let left, top;
    if (at < letters.length) { left = letters[at].offsetLeft; top = letters[at].offsetTop; }
    else { const l = letters[letters.length - 1]; left = l.offsetLeft + l.offsetWidth; top = l.offsetTop; }
    this.caret.style.left = left - 1 + "px";
    this.caret.style.top = top + 6 + "px";

    // Keep the current word on the second line.
    const want = Math.max(0, cur.offsetTop - LINE_H);
    if (want !== this.scroll) {
      this.scroll = want;
      this.inner.style.transform = `translateY(${-want}px)`;
    }
    this.caret.classList.add("typing");
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.caret.classList.remove("typing"), 600);
  }
}

// ---------- HUD ----------
// Fighting game layout: each player's name plate and HP bar across the top (yours left, the bot's right,
// mirrored), the clock and the edge rope between them, like a classic versus HUD. The rest of each
// player's numbers (WPM, power, combo, ultimate) sit in a small panel in that player's bottom corner.
function hpHtml(name) {
  return `
    <div class="nameplate">
      <div class="who"><span class="pname">${name}</span><span class="pweapon"></span></div>
      <span class="hpnum">100</span>
    </div>
    <div class="hpbar"><div class="hpghost"></div><div class="hpfill"></div></div>`;
}
function statsHtml() {
  return `
    <div class="stats">
      <span class="stat wpm"><b>0</b>WPM</span>
      <span class="stat power">POWER <b>0</b><span class="countertag">COUNTER</span></span>
      <span class="stun"></span>
    </div>
    <div class="meters">
      <span class="combo"><span class="pips"></span><b>x0</b></span>
      <span class="ultrow"><span class="ultbar"><span class="ultfill" style="display:block"></span></span><span class="ulttext">ULT 0%</span></span>
    </div>`;
}

// One player's HUD refs, from the top plate (`top`) and the corner panel (`el`).
function panelRefs(top, el) {
  const q = (sel) => top.querySelector(sel) || el.querySelector(sel);
  return {
    root: el, name: q(".pname"), hpnum: q(".hpnum"), hp: q(".hpfill"),
    ghost: q(".hpghost"), ghostHp: CONFIG.duel.maxHp, ghostHold: 0,
    wpm: q(".wpm b"), power: q(".power b"), combo: q(".combo b"),
    comboBox: q(".combo"), stun: q(".stun"), counter: q(".countertag"),
    pipBox: q(".pips"), pips: [], weaponEl: q(".pweapon"), ult: q(".ultfill"), ultText: q(".ulttext"),
    lastCombo: 0,
  };
}

// ---------- Game wiring ----------
const duel = new Duel();
const renderer = new Renderer($("arena"));
const UI = CONFIG.theme.ui;
const ui = $("ui");
renderer.pal = CONFIG.theme.arena; // the duel uses the Terminal Arcade look; the sandbox keeps its own
renderer.scenery = true;
renderer.follow = true;            // full screen camera: follows the fighters, zooms out when they fly apart
$("hp1").innerHTML = hpHtml("YOU");
$("hp2").innerHTML = hpHtml("BOT");
$("p1").innerHTML = statsHtml();
$("p2").innerHTML = statsHtml();
const panels = [panelRefs($("hp1"), $("p1")), panelRefs($("hp2"), $("p2"))];

// The palette is defined once in CONFIG.theme; write it onto :root so CSS and canvas always agree.
for (const k in UI) document.documentElement.style.setProperty("--" + k, UI[k]);
document.documentElement.style.setProperty("--font", CONFIG.theme.font);

// The fighter's name under the player's name, and one combo pip per clean word of a combo level.
function setPanelChar(i, key, w) {
  const p = panels[i];
  p.weaponEl.textContent = Chars.DEFS[key].name;
  p.pipBox.innerHTML = '<span class="pip"></span>'.repeat(w.wordsPerCombo);
  p.pips = [...p.pipBox.querySelectorAll(".pip")];
}

// ---------- Settings (visual only), saved in localStorage inside try/catch ----------
const SET = CONFIG.settings;
const settings = Object.assign({}, SET.defaults);
let savedSettings = null;
try { savedSettings = JSON.parse(localStorage.getItem(SET.storageKey) || "null"); } catch (e) { /* storage blocked: defaults */ }
if (savedSettings && typeof savedSettings === "object") {
  for (const k in SET.defaults) if (typeof savedSettings[k] === typeof SET.defaults[k]) settings[k] = savedSettings[k];
} else if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) {
  settings.reduceMotion = true; // first visit: follow the system setting
}
function saveSettings() {
  try { localStorage.setItem(SET.storageKey, JSON.stringify(settings)); } catch (e) { /* not saved, still works */ }
}
function applySettings() {
  renderer.shakeScale = settings.reduceMotion ? 0 : settings.shake;
  renderer.noFlash = settings.reduceMotion;
  renderer.reduceMotion = settings.reduceMotion;
  renderer.damageNumbers = settings.damageNumbers;
  duel.hitstopOn = !settings.reduceMotion; // visual only: hit-stop freezes poses, never rules
  ui.classList.toggle("reduce-motion", settings.reduceMotion);
  Sfx.setEnabled(settings.sound);
  Sfx.setVolume(settings.volume);
}

// ---------- View mode: "overhead" (words float over the fighters) or "classic" (typing box) ----------
let viewMode = "overhead";
try {
  const saved = localStorage.getItem(CONFIG.wordPlate.storageKey);
  if (saved === "overhead" || saved === "classic") viewMode = saved;
} catch (e) { /* storage blocked: keep the default */ }

function setView(mode) {
  viewMode = mode;
  try { localStorage.setItem(CONFIG.wordPlate.storageKey, viewMode); } catch (e) { /* not saved, still works */ }
  applyView();
}
function toggleView() { setView(viewMode === "overhead" ? "classic" : "overhead"); }
function applyView() {
  const over = viewMode === "overhead";
  ui.classList.toggle("classic", !over);
  renderer.wordPlates = over;
  resize();
  if (view) view.update();
}
function viewName() { return viewMode === "overhead" ? "Over-head" : "Classic"; }

// ---------- Full screen layout ----------
// The canvas backing store matches the window times the pixel ratio (sharp at any size). The view is a
// fixed number of drawing units tall (CONFIG.view), so the fighters fill the same share of the screen at
// any aspect ratio; a wider window simply shows more of the arena's sides. The DOM UI is designed at
// CONFIG.view.uiSize and scaled to fit, anchored to the edges.
let uiScale = 1;
function resize() {
  const V = CONFIG.view, w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const canvas = $("arena");
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const over = viewMode === "overhead";
  renderer.res = canvas.height / (over ? V.height : V.classicHeight);
  renderer.floorFromBottom = over ? V.floorFromBottom : V.classicFloorFromBottom;

  uiScale = Math.max(V.uiMinScale, Math.min(V.uiMaxScale, w / V.uiSize[0], h / V.uiSize[1]));
  ui.style.width = w / uiScale + "px";
  ui.style.height = h / uiScale + "px";
  ui.style.transform = `scale(${uiScale})`;
  // How much of the half width the HUD side panels leave clear (the camera zooms out to keep the fighters there).
  const inner = (16 + 432 + 16) * uiScale;
  renderer.clearHalf = Math.max(0.25, (w / 2 - inner) / (w / 2));
  if (screen === "fighter") sizePreview();
}
window.addEventListener("resize", resize);

// ---------- Fullscreen: F on the menus, a button in the top bar, a setting ----------
function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function setFullscreen(on) {
  const el = document.documentElement;
  try {
    if (on && !isFullscreen()) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!req) { fullscreenRefused(); return; }
      const p = req.call(el);
      if (p && p.catch) p.catch(fullscreenRefused);
    } else if (!on && isFullscreen()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
  } catch (e) { fullscreenRefused(); }
}
// Fallback: the arena already fills the window, so the browser's own full screen key does the rest.
function fullscreenRefused() { toast("The browser refused fullscreen here. Press F11 (or Ctrl+Cmd+F on a Mac) instead."); }
function onFullscreenChange() {
  // In fullscreen, ask to keep Esc for the game (Chrome: hold Esc to leave), so Esc can still pause.
  try { if (isFullscreen() && navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(["Escape"]).catch(() => {}); } catch (e) { /* not supported */ }
  // Leaving fullscreen in a fight (the browser may eat the Esc) pauses it.
  if (!isFullscreen()) openPause();
  document.querySelectorAll('[data-act="fullscreen"]').forEach((b) => b.classList.toggle("on", isFullscreen()));
  resize();
  if (topModal() === "settings") renderSettings();
}
document.addEventListener("fullscreenchange", onFullscreenChange);
document.addEventListener("webkitfullscreenchange", onFullscreenChange);

let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 4000);
}

// ---------- Fighters: the 11 designed 2D characters (cosmetic only; no rule reads them) ----------
// Your fighter is saved in localStorage. Each bot plays as its own fighter (CONFIG.duel.bots[i].char), or the
// next one in the roster when it is yours. Both typists keep one identity color (CONFIG.chars.you and .foe)
// for the HUD, the word plate letters, the sparks and the glow around the fighter.
const CH = CONFIG.chars;
const ROSTER = Chars.ORDER;
let charKey = CH.defaultChar;
try {
  const saved = localStorage.getItem(CH.storageKey);
  if (ROSTER.includes(saved)) charKey = saved;
} catch (e) { /* storage blocked: keep the default */ }
const charDef = (k) => Chars.DEFS[k];

// ---------- Bots: the six levels plus MATCH ME (CONFIG.duel.bots and CONFIG.duel.matchMe) ----------
const MM = CONFIG.duel.matchMe;
const BOTS = CONFIG.duel.bots.concat([Object.assign({ match: true }, MM)]);

function loadHistory() {
  try {
    const h = JSON.parse(localStorage.getItem(MM.storageKey) || "[]");
    return Array.isArray(h) ? h.filter((x) => typeof x === "number" && x > 0) : [];
  } catch (e) { return []; }
}
function saveHistory(wpm) {
  const h = loadHistory().concat([Math.round(wpm)]).slice(-MM.history);
  try { localStorage.setItem(MM.storageKey, JSON.stringify(h)); } catch (e) { /* not saved, still works */ }
}
// MATCH ME aims at your average wpm over your last few matches (MM.start before you have any).
function matchTarget() {
  const h = loadHistory().slice(-MM.history);
  return h.length ? Math.round(h.reduce((a, b) => a + b, 0) / h.length) : MM.start;
}
// The settings the Bot class gets for bot i. MATCH ME's key rate comes from Bot.rawWpmFor, so its measured
// average (correct keystrokes only, like yours) lands on the target.
function botCfgFor(i) {
  const b = BOTS[i];
  if (!b.match) return b;
  const t = matchTarget();
  return Object.assign({}, b, { wpm: Bot.rawWpmFor(t, b), beatAt: t });
}
// The fighter bot i plays as against your fighter.
function botCharFor(i) { return DuelChars.botKey(BOTS[i].char, charKey); }

// Identity colors on the fighters (cosmetic fields only), the 2D fighters for the renderer, and every piece
// of HUD that belongs to a player.
function applyLooks() {
  const you = CH.you, foe = CH.foe;
  const [a, b] = duel.fighters;
  a.color = you.body; a.letterColor = you.letters; a.sparkColor = you.body;
  b.color = foe.body; b.letterColor = foe.letters;
  const root = document.documentElement.style;
  root.setProperty("--you", you.body);
  root.setProperty("--you-letters", you.letters);
  root.setProperty("--foe", foe.body);
  const keys = [charKey, botCharFor(botIndex)];
  renderer.chars = { keys, glows: [you.body, foe.body] };
  renderer.menuSpar = keys;
  // Top bar: your fighter.
  const d = charDef(charKey);
  document.querySelector(".chip-color").textContent = d.name;
  document.querySelector(".chip-weapon").textContent = d.title.toLowerCase();
}

// ---------- Screens and modals ----------
// screen: "title" | "howto" | "fighter" | "result" | null (fighting). `back` is where Back goes from How to play
// and the Fighter screen ("title" or "result"). Modals stack on top of a screen or the fight:
// "pause", "settings" (from the menus or the pause menu) and "confirm" (quit to menu).
let screen = "title";
let back = "title";
let modals = [];
let pickIndex = 0;       // fighter under the cursor on the Fighter screen
const PICK_COLS = 3;     // fighters per row on the Fighter screen (Up and Down move a row)
let setTab = 0;          // settings tab
let setRow = 0;          // focused settings row

let view = null;
let bot = null;          // the computer typist; a network peer will take its place later
let botCfg = null;       // the bot settings of the current match
let botIndex = 3;        // DUELIST
let shownResult = false;
let resultShownAt = 0;   // keys are ignored for a moment after the result appears (you may still be typing)
let wpmTrace = [];       // [your wpm, bot wpm] twice a second during the match (visual only, for the result chart)
let traceNext = 0;

function inMatch() { return duel.phase === "countdown" || duel.phase === "fight"; }
function topModal() { return modals[modals.length - 1] || null; }
function paused() { return inMatch() && modals.length > 0; }

function showScreen(name) {
  screen = name;
  const ov = $("overlay");
  ov.classList.toggle("hidden", !name);
  if (name) ov.dataset.screen = name;
  ui.dataset.screen = name || "";
  ui.classList.toggle("idle", !!name || duel.phase === "menu");
}

// Buttons. Every action shown on screen is a button with the same action as its key (act()).
const kb = (k) => `<kbd>${k}</kbd>`;
const btn = (act, label, k, cls = "") => `<button class="btn ${cls}" data-act="${act}" tabindex="-1">${label}${k ? kb(k) : ""}</button>`;
const mbtn = (act, label, k, cls = "", sub = "") =>
  `<button class="mbtn ${cls}" data-act="${act}" tabindex="-1"><span>${label}${sub ? `<span class="sub">${sub}</span>` : ""}</span>${kb(k)}</button>`;
const keyBtn = (act, k, label) => `<button class="key" data-act="${act}" tabindex="-1">${kb(k)}<b>${label}</b></button>`;
function keyline(items) { $("keyline").innerHTML = items.join(""); }
const botKeys = () => `1 to ${BOTS.length}`;

function botCard(b, i) {
  const cfg = botCfgFor(i), d = charDef(botCharFor(i));
  return `<button class="bot-opt pick ${b.match ? "match" : ""} ${i === botIndex ? "sel" : ""}" data-act="bot:${i}" tabindex="-1">` +
    `${kb(i + 1)}<span><span class="bname">${b.name}<i>${d.name}</i></span><span class="bstyle">${b.style}</span></span>` +
    `<span class="beat">beat it at about<b>${Math.round(cfg.beatAt)} wpm</b></span></button>`;
}

function renderTitle() {
  showScreen("title");
  const cfg = botCfgFor(botIndex);
  $("title-menu").innerHTML =
    mbtn("play", "Play", "Enter", "primary", `vs ${BOTS[botIndex].name}, about ${Math.round(cfg.beatAt)} wpm`) +
    mbtn("fighter", "Fighter", "C") + mbtn("howto", "How to play", "H") + mbtn("settings", "Settings", "S");
  $("title-bots").innerHTML = `<div class="card-label"><span>Opponent</span><span>${botKeys()}</span></div>` + BOTS.map(botCard).join("");
  keyline([keyBtn("nextbot", botKeys(), "bot"), keyBtn("view", "F2", "view: " + viewName()), keyBtn("fullscreen", "F", "fullscreen")]);
  applyLooks();
}

// How to play, built from CONFIG so the numbers always match the rules.
function renderHowto() {
  showScreen("howto");
  const D = CONFIG.duel, U = D.ultimate, w = weaponFor("medium");
  $("scr-howto").innerHTML = `
    <h2 class="screen-title">How to play</h2>
    <div class="group"><h3>Basics</h3>
      <p>Type the words. <b>Space</b> ends a word, <b>Backspace</b> fixes a letter.</p>
      <p><b>Power</b> is your wpm, plus your combo bonus. It is your attack and your guard.</p>
      <p>The faster typist hits for the difference; the blocked part heals you both (max ${D.maxHp} HP). <b>Edge</b>, at the top, shows the swing in HP per second.</p>
    </div>
    <div class="group"><h3>Combos and counter</h3>
      <p>${w.wordsPerCombo} clean words in a row fill the pips: <b>+1 combo</b>, +${Math.round(w.comboBonus * 100)}% power. One wrong key breaks it.</p>
      <p>Break your combo and the other typist gets a <b>counter</b>: +${Math.round(D.counter.powerBonus * 100)}% power for ${D.counter.duration} s. Break theirs and it is yours.</p>
    </div>
    <div class="group ult"><h3>Ultimate</h3>
      <p>Full gold bar and combo x${w.comboRequired}: a <b>gold word</b> appears. Type it clean for ${U.damage} damage and a ${U.stun} s stun. A sloppy one deals ${U.sloppyDamage}.</p>
      <p>Your word floats over your fighter, the bot's over the bot, so you see its attacks coming. <b>Esc</b> pauses.</p>
    </div>
    <div class="group"><h3>Fighters</h3>
      <p>Every word is a strike from your fighter's own random combo; a long word swings harder, a new combo level ends on a knockdown. Fighters only change the look and the moves: the numbers are the same for all, so the bot's speed is the only difficulty.</p>
    </div>
    <div class="btn-row">${btn("back", "Back", "Esc")}${btn("fighter", "Fighter", "C")}${btn("play", "Fight", "Enter", "primary")}</div>`;
  keyline([]);
}

// The bot of the selected level, and the weapons, colors and HUD for a new match.
function begin() {
  modals = [];
  renderModal();
  botCfg = botCfgFor(botIndex);
  duel.start((Math.random() * 1e9) | 0);
  setPanelChar(0, charKey, duel.typists[0].weapon);
  setPanelChar(1, botCharFor(botIndex), duel.typists[1].weapon);
  panels[1].name.textContent = botCfg.name;
  applyLooks(); // cosmetic; online, the color will travel with the seed
  bot = new Bot(botCfg, duel.streams[1], (events, t) => duel.handleEvents(1, events, t));
  bot.nextKeyAt = 0.6; // a human like pause before the bot starts
  view = new StreamView(duel.streams[0]);
  wpmTrace = [];
  traceNext = 0;
  showScreen(null);
}

function goMenu() {
  modals = [];
  renderModal();
  duel.phase = "menu";
  bot = null;
  renderTitle();
}

// ---------- Result screen ----------
function avgWpm(t) {
  const s = t.stats, secs = Math.max(s.lastKeyAt - (s.firstKeyAt || 0), 1);
  return Math.round(s.correct / 5 / (secs / 60));
}
function accuracy(t) {
  const s = t.stats, n = s.correct + s.wrong;
  return n ? Math.round((s.correct / n) * 100) + "%" : "-";
}

// A small WPM-over-time line for both players (SVG, drawn from wpmTrace).
function wpmChart() {
  const W = 600, H = 64, n = wpmTrace.length;
  if (n < 2) return `<div class="chart-head"><span>WPM over time</span></div><svg viewBox="0 0 ${W} ${H}"></svg>`;
  const top = Math.max(40, ...wpmTrace.map((p) => Math.max(p[0], p[1])));
  const max = Math.ceil(top / 20) * 20;
  const line = (i) => wpmTrace.map((p, k) => `${((k / (n - 1)) * W).toFixed(1)},${(H - (p[i] / max) * H).toFixed(1)}`).join(" ");
  const grid = [0.5, 1].map((f) => `<line x1="0" x2="${W}" y1="${H - f * H}" y2="${H - f * H}" stroke="${UI.line}" stroke-width="1" stroke-dasharray="2 4"/>` +
    `<text x="4" y="${H - f * H + 14}" fill="${UI.dim}" font-size="12">${Math.round(max * f)}</text>`).join("");
  const you = getComputedStyle(document.documentElement).getPropertyValue("--you").trim();
  const foe = getComputedStyle(document.documentElement).getPropertyValue("--foe").trim();
  return `<div class="chart-head"><span>WPM over time, ${duel.t.toFixed(0)} s</span><span>` +
    `<span class="key-i"><i style="background:${you}"></i>YOU</span><span class="key-i"><i style="background:${foe}"></i>${botCfg.name}</span></span></div>` +
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Words per minute over the match">${grid}` +
    `<line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="${UI.line}" stroke-width="1"/>` +
    `<polyline points="${line(1)}" fill="none" stroke="${foe}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>` +
    `<polyline points="${line(0)}" fill="none" stroke="${you}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}

function showResult() {
  showScreen("result");
  const youWon = duel.result.winner === 0;
  $("ko-title").className = youWon ? "win" : "lose";
  $("ko-title").textContent = youWon ? "YOU WIN" : "YOU LOSE";
  Sfx.play(youWon ? "win" : "lose");
  $("ko-sub").textContent = `K.O. after ${duel.t.toFixed(1)} s against ${botCfg.name} (beat it at about ${Math.round(botCfg.beatAt)} wpm)`;
  const col = (t, i, name) => `<div class="rcol panel" style="--id:var(${i ? "--foe" : "--you"})"><h3>${name}</h3><dl>
    <dt>Average WPM</dt><dd>${avgWpm(t)}</dd><dt>Accuracy</dt><dd>${accuracy(t)}</dd>
    <dt>Best combo</dt><dd>x${t.stats.bestCombo}</dd><dt>Ultimates landed</dt><dd>${t.stats.ultimates}</dd></dl></div>`;
  $("result-cols").innerHTML = col(duel.typists[0], 0, "YOU") + col(duel.typists[1], 1, botCfg.name);
  $("wpm-chart").innerHTML = wpmChart();
  resultBots();
}

function resultBots() {
  $("result-bots").innerHTML = `<div class="card-label"><span>Change bot</span><span>${botKeys()}</span></div>` +
    BOTS.map((b, i) => `<button class="bot-chip pick ${i === botIndex ? "sel" : ""}" data-act="bot:${i}" tabindex="-1"><b>${b.name}</b>${Math.round(botCfgFor(i).beatAt)} wpm</button>`).join("");
  $("result-btns").innerHTML = btn("rematch", "Rematch", "Enter", "primary") + btn("nextbot", "Change bot", botKeys()) + btn("menu", "Menu", "Esc");
  keyline([keyBtn("fighter", "C", "fighter"), keyBtn("howto", "H", "how to play"), keyBtn("settings", "S", "settings"),
    keyBtn("view", "F2", "view: " + viewName()), keyBtn("fullscreen", "F", "fullscreen")]);
}

// ---------- Fighter screen: pick one of the 11 fighters ----------
function sizePreview() {
  const cv = $("fighter-preview"), dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = Math.round(446 * uiScale * dpr);
  cv.height = Math.round(520 * uiScale * dpr);
}

function openFighter() {
  back = screen === "result" ? "result" : "title";
  pickIndex = Math.max(0, ROSTER.indexOf(charKey));
  showScreen("fighter");
  $("chars").innerHTML = ROSTER.map((k, i) => { const d = charDef(k); return `<button class="char pick" data-act="char:${i}" tabindex="-1"><b>${d.name}</b><span>${d.title}</span></button>`; }).join("");
  $("fighter-btns").innerHTML = btn("back", "Back", "Esc") + btn("confirm", "Confirm", "Enter", "primary");
  keyline([keyBtn("prev", "Left", "previous"), keyBtn("next", "Right", "next"), keyBtn("down", "Up / Down", "row")]);
  sizePreview();
  renderFighter();
}

function renderFighter() {
  const k = ROSTER[pickIndex], d = charDef(k), w = Anim.W[d.weapon];
  [...document.querySelectorAll(".char")].forEach((el, i) => {
    el.classList.toggle("sel", i === pickIndex);
    el.classList.toggle("saved", ROSTER[i] === charKey);
  });
  $("fighter-name").textContent = d.name;
  $("fighter-wname").textContent = d.title.toUpperCase();
  const vs = BOTS.filter((b) => b.char === k).map((b) => b.name);
  $("fighter-info").innerHTML = `<span>Moves: ${w.name.toLowerCase()} set, random combos every match.</span>` +
    (vs.length ? `<span>${vs.join(", ")} will fight as someone else, since this is their fighter.</span>` : "");
}

function stepPick(step) {
  pickIndex = (pickIndex + step + ROSTER.length) % ROSTER.length;
  renderFighter();
}

function closeFighter(confirm) {
  if (confirm) {
    charKey = ROSTER[pickIndex];
    try { localStorage.setItem(CH.storageKey, charKey); } catch (e) { /* not saved, still works */ }
    applyLooks();
  }
  if (back === "result") { showScreen("result"); resultBots(); } else renderTitle();
}

function openHowto() {
  if (screen === "title" || screen === "result") back = screen;
  renderHowto();
}
function closeHowto() { if (back === "result") { showScreen("result"); resultBots(); } else renderTitle(); }

function pickBot(i) {
  botIndex = (i + BOTS.length) % BOTS.length;
  if (screen === "title") renderTitle(); else if (screen === "result") resultBots();
  applyLooks();
}

// ---------- Pause, settings and confirm (modals) ----------
function renderModal() {
  const m = $("modal"), top = topModal();
  m.classList.toggle("hidden", !top);
  if (!top) return;
  m.dataset.top = top;
  if (top === "pause") {
    $("mod-pause").innerHTML = `<h2 class="screen-title">Paused</h2>` +
      mbtn("resume", "Resume", "Esc", "primary") + mbtn("restart", "Restart", "R") + mbtn("settings", "Settings", "S") + mbtn("quit", "Quit to menu", "Q") +
      `<p class="modal-note">The fight is frozen: the clock, the bot and your typing all wait for you.</p>`;
  } else if (top === "confirm") {
    $("mod-confirm").innerHTML = `<h2 class="screen-title">Quit to menu?</h2><p>This fight ends without a result.</p>` +
      `<div class="btn-row">${btn("quit-no", "Keep fighting", "Esc", "primary")}${btn("quit-yes", "Quit", "Enter")}</div>`;
  } else if (top === "settings") renderSettings();
}

function openPause() {
  if (!inMatch() || modals.length) return;
  modals = ["pause"];
  renderModal();
}
function closeModal() {
  modals.pop();
  renderModal();
  if (!modals.length && screen === "title") renderTitle(); // the key line shows the current view
  else if (!modals.length && screen === "result") resultBots();
}

// Settings rows, built from CONFIG.settings. Each option is [value, label].
const SETTINGS_TABS = [
  { name: "Game", rows: [
    { id: "view", label: "View", hint: "Over-head: words float over the fighters. Classic: a typing box.",
      opts: [["overhead", "Over-head"], ["classic", "Classic"]], get: () => viewMode, set: (v) => setView(v) },
    { id: "damageNumbers", label: "Damage numbers", hint: "The net HP numbers beside each fighter.",
      opts: [[true, "On"], [false, "Off"]], get: () => settings.damageNumbers, set: (v) => { settings.damageNumbers = v; } },
  ] },
  { name: "Video", rows: [
    { id: "reduceMotion", label: "Reduce motion", hint: "Turns off screen shake, flashes and hit-stop.",
      opts: [[false, "Off"], [true, "On"]], get: () => settings.reduceMotion, set: (v) => { settings.reduceMotion = v; } },
    { id: "shake", label: "Screen shake", hint: () => (settings.reduceMotion ? "Off while reduce motion is on." : "How hard the screen shakes on big hits."),
      opts: SET.shakeSteps, get: () => settings.shake, set: (v) => { settings.shake = v; } },
    { id: "fullscreen", label: "Fullscreen", hint: "Also F on the menus and the button in the top bar.",
      opts: [[false, "Off"], [true, "On"]], get: () => isFullscreen(), set: (v) => setFullscreen(v) },
  ] },
  { name: "Audio", rows: [
    { id: "sound", label: "Sound effects", hint: "Hits, typing clicks, combos, the countdown and the K.O.",
      opts: [[true, "On"], [false, "Off"]], get: () => settings.sound, set: (v) => { settings.sound = v; } },
    { id: "volume", label: "Volume", hint: "How loud the sound effects play.",
      opts: SET.volumeSteps, get: () => settings.volume, set: (v) => { settings.volume = v; Sfx.unlock(); } },
  ] },
  { name: "Controls", rows: [] },
];
const KEY_ROWS = [
  ["Typing", "Letters type, <kbd>Space</kbd> ends a word, <kbd>Backspace</kbd> fixes a letter"],
  ["Pause", "<kbd>Esc</kbd> in a fight (leaving the tab pauses too)"],
  ["Pause menu", "<kbd>Esc</kbd> resume, <kbd>R</kbd> restart, <kbd>S</kbd> settings, <kbd>Q</kbd> quit"],
  ["Title and result", "<kbd>Enter</kbd> fight, <kbd>1</kbd> to <kbd>7</kbd> bot, <kbd>C</kbd> fighter, <kbd>H</kbd> how to play"],
  ["", "<kbd>S</kbd> settings, <kbd>F2</kbd> view, <kbd>F</kbd> fullscreen, <kbd>Esc</kbd> menu (result)"],
  ["Fighter", "<kbd>Left</kbd> <kbd>Right</kbd> pick, <kbd>Up</kbd> <kbd>Down</kbd> row, <kbd>Enter</kbd> confirm, <kbd>Esc</kbd> back"],
  ["Settings", "<kbd>1</kbd> to <kbd>4</kbd> or <kbd>Tab</kbd> tab, <kbd>Up</kbd> <kbd>Down</kbd> row, <kbd>Left</kbd> <kbd>Right</kbd> change"],
  ["Mouse", "Click any button or key chip. Typing stays on the keyboard."],
];

function openSettings() {
  if (topModal() === "settings") return;
  modals.push("settings");
  setRow = 0;
  renderModal();
}

function renderSettings() {
  const tab = SETTINGS_TABS[setTab];
  setRow = Math.min(setRow, Math.max(0, tab.rows.length - 1));
  const tabs = SETTINGS_TABS.map((t, i) => `<button class="tab ${i === setTab ? "sel" : ""}" data-act="tab:${i}" tabindex="-1">${t.name}${kb(i + 1)}</button>`).join("");
  let body;
  if (tab.rows.length) {
    body = tab.rows.map((r, ri) => {
      const cur = r.get(), hint = typeof r.hint === "function" ? r.hint() : r.hint;
      const segs = r.opts.map(([v, label], oi) => `<button class="seg ${v === cur ? "sel" : ""}" data-act="set:${ri}:${oi}" tabindex="-1">${label}</button>`).join("");
      return `<div class="set-row ${ri === setRow ? "focus" : ""}"><span class="lbl">${r.label}<span class="hint">${hint}</span></span><span class="segs">${segs}</span></div>`;
    }).join("");
  } else {
    body = `<table class="keys-table">${KEY_ROWS.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</table>`;
  }
  $("mod-settings").innerHTML = `<h2 class="screen-title">Settings</h2><div class="tabs">${tabs}</div>` +
    `<div class="set-rows">${body}</div><div class="btn-row">${btn("back", "Back", "Esc", "primary")}</div>`;
}

function setValue(ri, oi) {
  const r = SETTINGS_TABS[setTab].rows[ri];
  if (!r) return;
  setRow = ri;
  r.set(r.opts[oi][0]);
  saveSettings();
  applySettings();
  renderSettings();
}
function stepValue(step) {
  const r = SETTINGS_TABS[setTab].rows[setRow];
  if (!r) return;
  const cur = r.opts.findIndex(([v]) => v === r.get());
  setValue(setRow, (Math.max(0, cur) + step + r.opts.length) % r.opts.length);
}
function setTabTo(i) { setTab = (i + SETTINGS_TABS.length) % SETTINGS_TABS.length; setRow = 0; renderSettings(); }

// ---------- Actions: the one place the keyboard and the mouse both go through ----------
function act(name) {
  const [a, x, y] = name.split(":");
  Sfx.play("ui");
  const top = topModal();
  switch (a) {
    case "play": case "rematch": begin(); break;
    case "fighter": if (!top && (screen === "title" || screen === "result" || screen === "howto")) openFighter(); break;
    case "howto": if (!top && (screen === "title" || screen === "result")) openHowto(); break;
    case "settings": openSettings(); break;
    case "fullscreen": setFullscreen(!isFullscreen()); break;
    case "view": toggleView(); if (screen === "title") renderTitle(); else if (screen === "result") resultBots(); break;
    case "nextbot": pickBot(botIndex + 1); break;
    case "bot": pickBot(+x); break;
    case "menu": goMenu(); break;
    case "back":
      if (top) closeModal();
      else if (screen === "howto") closeHowto();
      else if (screen === "fighter") closeFighter(false);
      break;
    case "confirm": closeFighter(true); break;
    case "prev": stepPick(-1); break;
    case "next": stepPick(1); break;
    case "up": stepPick(-PICK_COLS); break;
    case "down": stepPick(PICK_COLS); break;
    case "char": pickIndex = +x; renderFighter(); break;
    case "pause": openPause(); break;
    case "resume": modals = []; renderModal(); break;
    case "restart": begin(); break;
    case "quit": modals.push("confirm"); renderModal(); break;
    case "quit-yes": goMenu(); break;
    case "quit-no": closeModal(); break;
    case "tab": setTabTo(+x); break;
    case "set": setValue(+x, +y); break;
  }
}

// Mouse: a click never takes focus (so it can never steal the typing) and never types a character.
document.addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); });
ui.addEventListener("click", (e) => {
  Sfx.unlock();
  const b = e.target.closest("[data-act]");
  if (!b) return;
  if (duel.phase === "over" && !shownResult) return; // K.O. is playing out
  act(b.dataset.act);
  b.blur();
});

// ---------- Keyboard ----------
// Each screen maps its keys to the same actions the buttons use.
function menuKey(e) {
  const k = e.key, lower = k.length === 1 ? k.toLowerCase() : k;
  if (screen === "fighter") {
    if (k === "ArrowUp" || k === "ArrowDown") { e.preventDefault(); act(k === "ArrowUp" ? "up" : "down"); }
    else if (k === "ArrowLeft") { e.preventDefault(); act("prev"); }
    else if (k === "ArrowRight") { e.preventDefault(); act("next"); }
    else if (k === "Enter") act("confirm");
    else if (k === "Escape") act("back");
    return;
  }
  if (screen === "howto") {
    if (k === "Escape" || lower === "h") act("back");
    else if (lower === "c") act("fighter");
    else if (k === "Enter") act("play");
    return;
  }
  if (screen === "title" || screen === "result") {
    if (lower === "c") act("fighter");
    else if (lower === "h") act("howto");
    else if (lower === "s") act("settings");
    else if (lower === "f") act("fullscreen");
    else if (k === "F2") { e.preventDefault(); act("view"); }
    else if (k >= "1" && k <= String(BOTS.length)) act("bot:" + (+k - 1));
    else if (k === "Enter") act("play");
    else if (k === "Escape" && screen === "result") act("menu");
  }
}

function modalKey(top, e) {
  const k = e.key, lower = k.length === 1 ? k.toLowerCase() : k;
  if (k === "Enter" || k === " " || k === "Tab" || k.startsWith("Arrow")) e.preventDefault();
  if (top === "pause") {
    if (k === "Escape" || k === "Enter") act("resume");
    else if (lower === "r") act("restart");
    else if (lower === "s") act("settings");
    else if (lower === "q") act("quit");
    else if (lower === "f") act("fullscreen");
  } else if (top === "confirm") {
    if (k === "Enter" || lower === "y") act("quit-yes");
    else if (k === "Escape" || lower === "n") act("quit-no");
  } else if (top === "settings") {
    if (k === "Escape") act("back");
    else if (k >= "1" && k <= String(SETTINGS_TABS.length)) setTabTo(+k - 1);
    else if (k === "Tab") setTabTo(setTab + (e.shiftKey ? -1 : 1));
    else if (k === "ArrowUp" || k === "ArrowDown") {
      const n = SETTINGS_TABS[setTab].rows.length;
      if (n) { setRow = (setRow + (k === "ArrowUp" ? -1 : 1) + n) % n; renderSettings(); }
    }
    else if (k === "ArrowLeft") stepValue(-1);
    else if (k === "ArrowRight" || k === "Enter") stepValue(1);
  }
}

window.addEventListener("keydown", (e) => {
  Sfx.unlock(); // browsers allow audio only after a key or a click
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const top = topModal();
  if (top) { modalKey(top, e); return; }
  if (duel.phase === "over" && !shownResult) return; // K.O. is playing out: wait for the result screen
  if (screen === "result" && performance.now() - resultShownAt < CONFIG.theme.resultKeyDelay) return; // still typing: ignore
  if (screen) {
    if (e.key === " " || e.key === "Enter") e.preventDefault();
    menuKey(e);
    return;
  }
  if (e.key === "Escape") { e.preventDefault(); act("pause"); return; }
  if (e.key === "Backspace" || e.key === " " || e.key === "Tab" || e.key.length === 1) e.preventDefault();
  if (duel.phase !== "fight") return; // countdown: keys are ignored

  if (e.key === "Backspace") { duel.streams[0].backspace(); view.update(); return; }
  if (e.key.length === 1) {
    const evs = duel.streams[0].press(e.key.toLowerCase());
    duel.handleEvents(0, evs, duel.t);
    // Typing sounds: a soft click per right key, a dull knock per typo (the word strikes sound from the fighters).
    if (evs.some((v) => v.type === "wrong")) Sfx.play("typo");
    else if (evs.some((v) => v.type === "correct" || v.type === "word")) Sfx.play("key");
    view.update();
  }
});

// Leaving the browser tab (or the window) pauses the fight.
document.addEventListener("visibilitychange", () => { if (document.hidden) openPause(); });
window.addEventListener("blur", openPause);

// ---------- HUD ----------
function clock(t) {
  const s = Math.floor(t);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function updateHud(dt) {
  const D = CONFIG.duel;
  duel.typists.forEach((t, i) => {
    const p = panels[i];
    p.hpnum.textContent = Math.ceil(t.hp);
    p.hp.style.width = (t.hp / D.maxHp) * 100 + "%";
    // The pale "ghost" bar holds lost HP for a moment, then drains, so damage reads clearly.
    if (t.hp >= p.ghostHp) { p.ghostHp = t.hp; p.ghostHold = 0.4; }
    else if ((p.ghostHold -= dt) <= 0) p.ghostHp = Math.max(t.hp, p.ghostHp - 35 * dt);
    p.ghost.style.width = (p.ghostHp / D.maxHp) * 100 + "%";
    p.hp.className = "hpfill" + (t.hp < 20 ? " crit" : t.hp < 40 ? " low" : "");
    p.wpm.textContent = Math.round(duel.wpmNow[i]);
    p.power.textContent = Math.round(duel.power[i]); // includes the counter boost
    p.counter.classList.toggle("on", duel.phase === "fight" && t.countering(duel.t));
    p.combo.textContent = "x" + t.comboLevel;
    if (t.comboLevel !== p.lastCombo) {
      const cls = t.comboLevel > p.lastCombo ? "pop" : "broke";
      if (duel.phase === "fight") Sfx.play(cls === "pop" ? "combo" : "broken", t.comboLevel);
      p.comboBox.classList.remove("pop", "broke"); void p.comboBox.offsetWidth; p.comboBox.classList.add(cls);
    }
    p.lastCombo = t.comboLevel;
    const per = t.weapon.wordsPerCombo;
    const inBlock = t.comboLevel >= D.maxComboLevel ? per : t.streak % per;
    p.pips.forEach((pip, k) => pip.classList.toggle("on", k < inBlock));
    p.ult.style.width = t.charge + "%";
    const ready = t.ultReady();
    p.ult.classList.toggle("ready", ready);
    p.ultText.classList.toggle("ready", ready);
    p.ultText.textContent = ready ? "ULTIMATE READY"
      : t.charge >= 100 ? "NEEDS COMBO x" + t.weapon.comboRequired
      : "ULT " + Math.floor(t.charge) + "%";
    p.stun.textContent = duel.t < t.stunUntil ? "STUNNED" : "";
  });

  $("timer").textContent = clock(duel.t);

  // Net pressure in HP per second, from your point of view, as a tug-of-war rope:
  // the knot slides toward whoever is winning, full stretch at tugRange wpm of difference.
  const net = D.damageScale * (duel.power[0] - duel.power[1]);
  const full = D.damageScale * D.tugRange;
  const pos = Math.max(-1, Math.min(1, net / full)); // -1: all the way to you, +1: all the way to the bot
  const lead = net > 0.05, trail = net < -0.05;
  $("tug").className = lead ? "lead" : trail ? "trail" : "";
  // You are on the left: when you lead, the knot comes toward you.
  const knot = 50 - pos * 50;
  $("tug-knot").style.left = knot + "%";
  const fill = $("tug-fill");
  fill.style.left = Math.min(knot, 50) + "%";
  fill.style.width = Math.abs(knot - 50) + "%";
  const tv = $("tug-val");
  tv.textContent = (net > 0 ? "+" : "") + net.toFixed(1);
  tv.style.color = lead ? "var(--you)" : trail ? "var(--foe)" : "";

  // Over-head view: a thin line at the bottom shows how far into the current word you are.
  if (viewMode === "overhead" && duel.streams) {
    const s = duel.streams[0], w = s.current();
    const fillW = $("word-progress-fill");
    fillW.style.width = Math.min(1, s.typed.length / w.text.length) * 100 + "%";
    fillW.classList.toggle("ult", !!w.ultimate);
  }

  fightSounds();
  const cd = $("countdown");
  if (duel.phase === "countdown") cd.textContent = Math.ceil(duel.countdown);
  else if (duel.goFlash > 0) cd.textContent = "FIGHT!";
  else cd.textContent = "";
}

// Moments that sound once, found by watching the duel's state change (never by changing it).
const heard = { beat: 0, phase: "menu", counter: [false, false], ready: [false, false], ult: [null, null] };
function fightSounds() {
  if (duel.phase === "countdown") {
    const b = Math.ceil(duel.countdown);
    if (b !== heard.beat) { heard.beat = b; Sfx.play("beep"); }
  } else heard.beat = 0;
  if (duel.phase === "fight" && heard.phase === "countdown") Sfx.play("go");
  if (duel.phase === "over" && heard.phase === "fight") Sfx.play("ko");
  heard.phase = duel.phase;
  if (duel.phase !== "fight") { heard.counter = [false, false]; heard.ready = [false, false]; return; }
  duel.typists.forEach((t, i) => {
    const c = t.countering(duel.t), r = t.ultReady(), u = duel.fighters[i].ult || null;
    if (c && !heard.counter[i]) Sfx.play("counter");
    if (r && !heard.ready[i] && i === 0) Sfx.play("ultReady");
    if (u && u !== heard.ult[i]) Sfx.play("ultimate");
    heard.counter[i] = c; heard.ready[i] = r; heard.ult[i] = u;
  });
}

// ---------- The loop ----------
// Fixed timestep, so the fight plays the same at any frame rate. While paused nothing steps:
// the duel clock, the bot (it reads the duel clock) and the countdown all wait.
const STEP = 1 / 120;
let last = performance.now(), acc = 0;
const frameStats = { n: 0, ms: 0 }; // average cost of draw + HUD per frame (for tests)
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t0 = performance.now();
  const frozen = paused();
  if (duel.phase !== "menu" && !frozen) {
    acc += dt;
    while (acc >= STEP) {
      if (bot && duel.phase === "fight") bot.update(duel.t);
      duel.update(STEP);
      acc -= STEP;
      // Sample both typists' wpm twice a second for the result chart (visual only).
      if (duel.phase === "fight" && duel.t >= traceNext) { wpmTrace.push([duel.wpmNow[0], duel.wpmNow[1]]); traceNext += 0.5; }
    }
    if (view) view.sync();
  } else {
    acc = 0;
  }
  if (duel.phase === "over" && !shownResult && duel.fighters.some((f) => f.dead && f.state === "down" && f.stateT > 0.6)) {
    shownResult = true;
    resultShownAt = performance.now();
    wpmTrace.push([duel.wpmNow[0], duel.wpmNow[1]]);
    const mine = avgWpm(duel.typists[0]);
    if (mine > 0 && duel.t > 5) saveHistory(mine); // for MATCH ME
    showResult();
  }
  if (duel.phase !== "over") shownResult = false;
  renderer.draw(duel, frozen ? 0 : dt);
  if (screen === "fighter") DuelChars.drawPreview($("fighter-preview"), ROSTER[pickIndex], frozen ? 0 : dt, settings.reduceMotion);
  updateHud(dt);
  frameStats.n++; frameStats.ms += performance.now() - t0;
  requestAnimationFrame(loop);
}

applySettings();
renderTitle();
applyView();
requestAnimationFrame(loop);
