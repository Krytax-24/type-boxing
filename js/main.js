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

// The palette is defined once in CONFIG.theme and applied by Themes.init() (js/themes.js), which writes it onto
// :root so CSS and canvas always agree and also handles the player's theme, background and custom CSS.
document.documentElement.style.setProperty("--font", CONFIG.theme.font);

// The fighter's name under the player's name, and one combo pip per clean word of a combo level.
function setPanelChar(i, key, w) {
  const p = panels[i];
  p.weaponEl.textContent = Chars.DEFS[key].name;
  p.pipBox.innerHTML = '<span class="pip"></span>'.repeat(w.wordsPerCombo);
  p.pips = [...p.pipBox.querySelectorAll(".pip")];
}

// ---------- Settings, saved in localStorage inside try/catch ----------
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
// The HUD panels get their own opacity; the scanline stripes on the menus follow the Scanlines setting.
function applyHud() {
  const root = document.documentElement.style;
  root.setProperty("--hud-bg", Themes.rgba(UI.surface, settings.hudOpacity));
  root.setProperty("--scan", settings.scanlines && !settings.reduceMotion ? (Themes.light ? "rgba(0, 0, 0, 0.05)" : "rgba(0, 0, 0, 0.18)") : "transparent");
}
let scaleKey = "";
function applySettings() {
  const rm = settings.reduceMotion;
  renderer.shakeScale = rm ? 0 : settings.shake;
  renderer.noFlash = rm || !settings.flash;
  renderer.reduceMotion = rm;
  renderer.damageNumbers = settings.damageNumbers;
  renderer.sceneryLevel = settings.sceneryLevel;
  renderer.scanlines = settings.scanlines;
  renderer.sweep = settings.sweep;
  duel.hitstopOn = !rm && settings.hitstop; // visual only: hit-stop freezes poses, never rules
  DuelChars.setFx({ sparks: settings.fxSparks, smears: settings.fxSmears, afterimages: settings.fxAfterimages,
    dust: settings.fxDust, glow: settings.fxGlow, budget: settings.fxBudget });
  ui.classList.toggle("reduce-motion", rm);
  ui.classList.toggle("hide-wpm", !settings.showWpm);
  ui.classList.toggle("hide-power", !settings.showPower);
  ui.classList.toggle("hide-edge", !settings.showEdge);
  $("perf").classList.toggle("hidden", !settings.showFps);
  Sfx.setEnabled(settings.sound);
  Sfx.setVolume(settings.volume);
  applyHud();
  const key = settings.renderScale + "|" + settings.uiScale;
  if (key !== scaleKey) { scaleKey = key; resize(); }
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
  const native = Math.min(window.devicePixelRatio || 1, 3);
  const dpr = settings.renderScale ? Math.min(native, settings.renderScale) : native; // Graphics > Render scale caps it
  const canvas = $("arena");
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const over = viewMode === "overhead";
  renderer.res = canvas.height / (over ? V.height : V.classicHeight);
  renderer.floorFromBottom = over ? V.floorFromBottom : V.classicFloorFromBottom;

  uiScale = Math.max(V.uiMinScale, Math.min(V.uiMaxScale, w / V.uiSize[0], h / V.uiSize[1])) * settings.uiScale; // x Graphics > Interface size
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
let rec = null;          // Stats.Recorder of the match in progress (js/stats.js): watches your typing, never changes it
let traceNext = 0;       // next half second to sample for the speed graph
let matchSpace = true;   // "Space ends a word" for this fight, fixed when the fight starts
let lastRecord = null;   // the record of the match on the result screen
const online = {
  net: null, screenState: "idle", status: "", code: "", role: null, connected: false,
  localReady: false, remoteReady: false, localRematch: false, remoteRematch: false,
  profile: null, peerProfile: null, seed: 0, seq: 0, snapN: 0, snapNext: 0,
  keyQueue: [], keyFlushAt: 0, hostSentResult: false, active: false, waitingResult: null,
  trace: [],
};

function inMatch() { return duel.phase === "countdown" || duel.phase === "fight"; }
function topModal() { return modals[modals.length - 1] || null; }
function isOnlineMatch() { return online.active || online.screenState === "result"; }
function paused() { return inMatch() && modals.length > 0 && !isOnlineMatch(); }

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
    `<span class="beat">win at about<b>${Math.round(cfg.beatAt)} wpm</b></span></button>`;
}

function renderTitle() {
  showScreen("title");
  const cfg = botCfgFor(botIndex);
  $("title-menu").innerHTML =
    mbtn("play", "Play", "Enter", "primary", `vs ${BOTS[botIndex].name}, win at about ${Math.round(cfg.beatAt)} WPM`) +
    mbtn("online", "Online", "O", "", onlineAvailable() ? "private room 1v1" : "serve over http or use ?server=") +
    mbtn("fighter", "Choose fighter", "C") + mbtn("howto", "How to play", "H") + mbtn("stats", "My stats", "T") + mbtn("settings", "Settings", "S");
  $("title-bots").innerHTML = `<div class="card-label"><span>Choose your opponent</span><span>${botKeys()}</span></div>` + BOTS.map(botCard).join("");
  keyline([keyBtn("nextbot", botKeys(), "opponent"), keyBtn("view", "F2", "words: " + viewName()), keyBtn("fullscreen", "F", "fullscreen")]);
  applyLooks();
}

function onlineAvailable() {
  return typeof NetPlay !== "undefined" && NetPlay.available(CONFIG.net);
}

function onlineProfile() {
  return { name: "PLAYER", fighter: charKey, color: CH.you.body, gameVersion: CONFIG.net.gameVersion };
}

function inviteLink() {
  const url = new URL(location.href);
  url.searchParams.set("room", online.code);
  return url.href;
}

function clearRoomInput() {
  const input = $("room-code");
  if (input) input.value = "";
}

function renderOnline() {
  showScreen("online");
  const on = onlineAvailable(), state = online.screenState;
  $("online-status").textContent = on ? (online.status || "Create a private room or join a friend's code.") :
    "Online play needs the page served over http or https, or a LAN server override.";
  let room = "Room codes exist only while the host keeps this page open.";
  if (online.code) room = `<span>Room code</span><b>${online.code}</b><code>${inviteLink()}</code>`;
  if (online.peerProfile) room += `<span>Opponent: ${online.peerProfile.name}</span>`;
  if (online.connected && state !== "playing" && state !== "result") {
    room += `<span>${online.localReady ? "You are ready" : "You are not ready"} / ${online.remoteReady ? "Opponent ready" : "Opponent not ready"}</span>`;
  }
  $("online-room").innerHTML = room;
  $("room-code").disabled = !on || online.connected || state === "waiting" || state === "playing";
  const readyLabel = online.localReady ? "Unready" : "Ready";
  const readyBtn = online.connected && state !== "playing" && state !== "result" ? btn("online-ready", readyLabel, "Enter", online.localReady ? "" : "primary") : "";
  $("online-btns").innerHTML =
    (online.connected ? readyBtn + btn("online-leave", "Leave", "Esc") :
      btn("online-create", "Create room", "C", "primary") + btn("online-join", "Join", "J") + btn("back", "Back", "Esc")) +
    (on ? "" : `<span class="modal-note">For LAN, serve the folder and open with ?server=lan.</span>`);
  keyline(online.connected ? [] : [keyBtn("fighter", "F", "fighter"), keyBtn("view", "F2", "words: " + viewName())]);
}

// How to play, built from CONFIG so the numbers always match the rules. Plain words first, numbers second.
function renderHowto() {
  showScreen("howto");
  const D = CONFIG.duel, U = D.ultimate, w = weaponFor("medium");
  const pct = (v) => Math.round(v * 100);
  $("scr-howto").innerHTML = `
    <h2 class="screen-title">How to play</h2>
    <p class="lead">Two typists fight at the same time. <b>Type faster and cleaner than your opponent</b> and your fighter does the hitting. Empty their HP bar to win.</p>
    <div class="cols">
      <div class="group"><h3>1. Type the words</h3>
        <p>The word above your fighter is yours. Type it, then press <kbd>Space</kbd>. <kbd>Backspace</kbd> fixes a letter. A red bar under a letter means a mistake.</p></div>
      <div class="group"><h3>2. Speed is attack and guard</h3>
        <p><b>WPM</b> means words per minute. Whoever types faster hits for the <b>difference</b>. The part that gets blocked heals you both, up to ${D.maxHp} HP.</p></div>
      <div class="group"><h3>3. Build a combo</h3>
        <p>Type ${w.wordsPerCombo} words in a row with no mistakes to fill the pips. That is <b>one combo level</b>: +${pct(w.comboBonus)}% power each. One wrong key resets it.</p></div>
      <div class="group"><h3>4. Break theirs, steal a counter</h3>
        <p>When a mistake breaks a combo, the other typist gets a <b>counter</b>: +${pct(D.counter.powerBonus)}% power for ${D.counter.duration} second.</p></div>
      <div class="group ult"><h3>5. Land your ultimate</h3>
        <p>Type fast to fill the gold bar. At 100% and combo x${w.comboRequired}, a <b>gold word</b> appears. Type it clean for ${U.damage} damage and a ${U.stun} second stun. A messy one only does ${U.sloppyDamage}.</p></div>
      <div class="group"><h3>Choosing an opponent</h3>
        <p>Every opponent shows the WPM you need to win about half the time. Start low. <b>Match me</b> copies your own recent speed.</p></div>
    </div>
    <div class="legend"><h3>Reading the screen</h3>
      <dl>
        <dt>Top corners</dt><dd>HP. Yours on the left, theirs on the right.</dd>
        <dt>EDGE</dt><dd>Who is winning right now. The marker slides toward the leader; the number is HP per second.</dd>
        <dt>WPM and POWER</dt><dd>Your speed, and your speed plus combo and counter bonuses.</dd>
        <dt>Pips and ULT</dt><dd>Words toward the next combo level, and the ultimate charge.</dd>
        <dt>Keys</dt><dd><kbd>Esc</kbd> pause, <kbd>Enter</kbd> start, <kbd>S</kbd> settings, <kbd>T</kbd> your stats.</dd>
      </dl></div>
    <div class="btn-row">${btn("back", "Back", "Esc")}${btn("fighter", "Choose fighter", "C")}${btn("play", "Fight", "Enter", "primary")}</div>`;
  keyline([]);
}

// The bot of the selected level, and the weapons, colors and HUD for a new match.
function begin() {
  online.active = false;
  online.screenState = "idle";
  modals = [];
  renderModal();
  botCfg = botCfgFor(botIndex);
  const seed = (Math.random() * 1e9) | 0;
  duel.start(seed);
  matchSpace = settings.wordSubmit; // changing it in the pause menu applies from the next fight
  rec = new Stats.Recorder({ mode: matchSpace ? "space" : "auto", seed, bot: botCfg.name, botIdx: botIndex, beatAt: botCfg.beatAt,
    char: charKey, foeChar: botCharFor(botIndex) });
  setPanelChar(0, charKey, duel.typists[0].weapon);
  setPanelChar(1, botCharFor(botIndex), duel.typists[1].weapon);
  panels[1].name.textContent = botCfg.name;
  applyLooks(); // cosmetic; online, the color will travel with the seed
  bot = new Bot(botCfg, duel.streams[1], (events, t) => duel.handleEvents(1, events, t));
  bot.nextKeyAt = 0.6; // a human like pause before the bot starts
  view = new StreamView(duel.streams[0]);
  traceNext = 0;
  showScreen(null);
}

function resetOnlineState(keepNet) {
  if (!keepNet && online.net) online.net.close();
  clearRoomInput();
  online.screenState = "idle";
  online.status = "";
  online.code = "";
  online.role = null;
  online.connected = false;
  online.localReady = false;
  online.remoteReady = false;
  online.localRematch = false;
  online.remoteRematch = false;
  online.peerProfile = null;
  online.keyQueue = [];
  online.trace = [];
  online.active = false;
  online.waitingResult = null;
  online.hostSentResult = false;
  if (!keepNet) online.net = null;
}

function openOnline() {
  online.profile = onlineProfile();
  const room = new URLSearchParams(location.search).get("room");
  renderOnline();
  if (room && onlineAvailable() && !online.net) {
    $("room-code").value = room.toUpperCase();
    joinOnlineRoom();
  }
}

function makeNet() {
  if (online.net) online.net.close();
  online.net = new NetPlay(CONFIG.net, { status: onlineStatus, message: onlineMessage });
  online.profile = onlineProfile();
  return online.net;
}

function createOnlineRoom() {
  if (!onlineAvailable()) { toast("Serve the game over http, or use ?server=lan for LAN play."); return; }
  resetOnlineState();
  online.profile = onlineProfile();
  online.screenState = "creating";
  makeNet().createRoom();
  renderOnline();
}

function joinOnlineRoom() {
  if (!onlineAvailable()) { toast("Serve the game over http, or use ?server=lan for LAN play."); return; }
  const code = NetPlay.codeOk($("room-code").value, CONFIG.net);
  if (!code) { toast("Enter a valid room code."); return; }
  resetOnlineState();
  online.profile = onlineProfile();
  online.screenState = "joining";
  makeNet().joinRoom(code);
  renderOnline();
}

function onlineStatus(e) {
  online.screenState = e.state;
  online.code = e.code || online.code;
  online.role = e.role || online.role;
  if (e.state === "waiting") online.status = "Share the code with your opponent.";
  else if (e.state === "joining") online.status = "Joining room...";
  else if (e.state === "connected") {
    online.connected = true;
    online.status = "Connected. Ready up when both players are here.";
    if (online.role === "guest") online.net.send(Protocol.hello(online.profile));
  } else if (e.state === "error") {
    online.status = e.message || "Network error";
    toast(online.status);
  } else if (e.state === "closed") {
    if (online.active) toast(e.message || "The other player left.");
    resetOnlineState(true);
    online.status = e.message || "Connection closed.";
  }
  if (screen === "online") renderOnline();
}

function safeChar(key) {
  return Chars.DEFS[key] ? key : CH.defaultChar;
}

function onlineMessage(msg) {
  if (msg.t === "busy") { toast("This room already has two players."); return; }
  if (msg.t === "leave") { toast("The other player left."); goMenu(); return; }
  if (msg.t === "error") { toast(msg.message); return; }
  if (msg.t === "hello" && online.role === "host") {
    if (msg.gameVersion !== CONFIG.net.gameVersion) { online.net.send(Protocol.error("The other player has a different version. Refresh the page.")); return; }
    online.peerProfile = { name: Protocol.cleanName(msg.name), fighter: safeChar(msg.fighter), color: msg.color };
    online.net.send(Protocol.welcome(online.profile));
    online.status = "Opponent joined. Ready up.";
    if (screen === "online") renderOnline();
  } else if (msg.t === "welcome" && online.role === "guest") {
    if (msg.gameVersion !== CONFIG.net.gameVersion) { toast("The other player has a different version. Refresh the page."); return; }
    online.peerProfile = { name: Protocol.cleanName(msg.name), fighter: safeChar(msg.fighter), color: msg.color };
    online.status = "Joined. Ready up.";
    if (screen === "online") renderOnline();
  } else if (msg.t === "ready") {
    online.remoteReady = msg.ready;
    if (screen === "online") renderOnline();
    if (online.role === "host" && online.localReady && online.remoteReady) hostStartOnline();
  } else if (msg.t === "start") {
    guestStartOnline(msg);
  } else if (msg.t === "keys" && online.role === "host") {
    for (const ev of msg.events) {
      const events = applyInputToSide(1, ev.k);
      if (events.length) duel.handleEvents(1, events, duel.t);
    }
  } else if (msg.t === "state" && online.role === "guest") {
    duel.applySnapshot(msg.s, true);
    if (duel.phase === "fight" && duel.t >= traceNext) { online.trace.push([duel.wpmNow[0], duel.wpmNow[1], duel.typists[0].hp, duel.typists[1].hp]); traceNext += 0.5; }
    if (duel.phase === "over" && !shownResult) online.waitingResult = msg.s.result || { winner: 0 };
  } else if (msg.t === "result" && online.role === "guest") {
    duel.result = { winner: 1 - msg.winner };
    duel.phase = "over";
    online.waitingResult = duel.result;
  } else if (msg.t === "rematch") {
    online.remoteRematch = msg.want;
    if (online.role === "host" && online.localRematch && online.remoteRematch) hostStartOnline();
    resultBots();
  } else if (msg.t === "ping") online.net.send(Protocol.pong(msg.id, msg.ts));
}

function cryptoSeed() {
  const a = new Uint32Array(1);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
  else a[0] = (Math.random() * 1e9) | 0;
  return a[0] >>> 0;
}

function applyOnlineLooks(fighters) {
  const you = CH.you, foe = CH.foe;
  duel.fighters[0].color = you.body; duel.fighters[0].letterColor = you.letters; duel.fighters[0].sparkColor = you.body;
  duel.fighters[1].color = foe.body; duel.fighters[1].letterColor = foe.letters;
  const root = document.documentElement.style;
  root.setProperty("--you", you.body);
  root.setProperty("--you-letters", you.letters);
  root.setProperty("--foe", foe.body);
  renderer.chars = { keys: fighters, glows: [you.body, foe.body] };
  renderer.menuSpar = fighters;
}

function startOnlineDuel(seed, hostFighter, guestFighter, hostName, guestName) {
  clearRoomInput();
  online.active = true;
  online.screenState = "playing";
  online.seed = seed >>> 0;
  online.seq = 0;
  online.snapN = 0;
  online.snapNext = 0;
  online.keyQueue = [];
  online.trace = [];
  online.localRematch = false;
  online.remoteRematch = false;
  online.hostSentResult = false;
  online.waitingResult = null;
  shownResult = false;
  rec = null;
  lastRecord = null;
  traceNext = 0;
  matchSpace = settings.wordSubmit;
  bot = null;
  botCfg = { name: online.role === "guest" ? hostName : guestName, beatAt: 0 };
  duel.start(seed, ["medium", "medium"]);
  if (online.role === "guest") duel.streams = [duel.streams[1], duel.streams[0]];
  const localFighters = online.role === "guest" ? [guestFighter, hostFighter] : [hostFighter, guestFighter];
  setPanelChar(0, localFighters[0], duel.typists[0].weapon);
  setPanelChar(1, localFighters[1], duel.typists[1].weapon);
  panels[0].name.textContent = "YOU";
  panels[1].name.textContent = online.role === "guest" ? hostName : guestName;
  applyOnlineLooks(localFighters);
  view = new StreamView(duel.streams[0]);
  modals = [];
  renderModal();
  showScreen(null);
}

function hostStartOnline() {
  const peer = online.peerProfile || { name: "OPPONENT", fighter: CH.defaultChar };
  const seed = cryptoSeed();
  const hostFighter = safeChar(online.profile.fighter), guestFighter = safeChar(peer.fighter);
  online.net.send(Protocol.start(seed, [hostFighter, guestFighter], ["PLAYER", peer.name], CONFIG.duel.countdown));
  startOnlineDuel(seed, hostFighter, guestFighter, "PLAYER", peer.name);
}

function guestStartOnline(msg) {
  startOnlineDuel(msg.seed, safeChar(msg.fighters[0]), safeChar(msg.fighters[1]), msg.names[0], msg.names[1]);
}

function toggleOnlineReady() {
  online.localReady = !online.localReady;
  if (online.net) online.net.send(Protocol.ready(online.localReady));
  if (online.role === "host" && online.localReady && online.remoteReady) { hostStartOnline(); return; }
  renderOnline();
}

function goMenu() {
  if (online.net) online.net.close();
  online.net = null;
  resetOnlineState(true);
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

function onlineChart(you, foe) {
  const W = 600, H = 64, data = online.trace;
  if (data.length < 2) return `<div class="chart-head"><span>Online WPM over time</span><span>unranked</span></div><svg class="speed" viewBox="0 0 ${W} ${H}"></svg>`;
  const top = Math.max(40, ...data.map((p) => Math.max(p[0], p[1])));
  const max = Math.ceil(top / 20) * 20;
  const line = (i) => data.map((p, k) => `${((k / (data.length - 1)) * W).toFixed(1)},${(H - (p[i] / max) * H).toFixed(1)}`).join(" ");
  return `<div class="chart-head"><span>Online WPM over time, ${duel.t.toFixed(0)} s</span><span>` +
    `<span class="key-i"><i style="background:${you}"></i>YOU</span><span class="key-i"><i style="background:${foe}"></i>${botCfg.name}</span></span></div>` +
    `<svg class="speed" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="${UI.line}" stroke-width="1"/>` +
    `<polyline points="${line(1)}" fill="none" stroke="${foe}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>` +
    `<polyline points="${line(0)}" fill="none" stroke="${you}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}

function showResult() {
  showScreen("result");
  const youWon = duel.result.winner === 0;
  $("ko-title").className = youWon ? "win" : "lose";
  $("ko-title").textContent = youWon ? "YOU WIN" : "YOU LOSE";
  Sfx.play(youWon ? "win" : "lose");
  $("ko-sub").textContent = isOnlineMatch()
    ? `K.O. after ${duel.t.toFixed(1)} s against ${botCfg.name}, unranked online`
    : `K.O. after ${duel.t.toFixed(1)} s against ${botCfg.name} (win at about ${Math.round(botCfg.beatAt)} WPM)`;
  const col = (t, i, name) => `<div class="rcol panel" style="--id:var(${i ? "--foe" : "--you"})"><h3>${name}</h3><dl>
    <dt>Average WPM</dt><dd>${avgWpm(t)}</dd><dt>Accuracy</dt><dd>${accuracy(t)}</dd>
    <dt>Best combo</dt><dd>x${t.stats.bestCombo}</dd><dt>Ultimates landed</dt><dd>${t.stats.ultimates}</dd></dl></div>`;
  $("result-cols").innerHTML = col(duel.typists[0], 0, "YOU") + col(duel.typists[1], 1, botCfg.name);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  $("wpm-chart").innerHTML = isOnlineMatch() ? onlineChart(css("--you"), css("--foe")) : StatsPage.resultChart(lastRecord, css("--you"), css("--foe"));
  $("result-extra").innerHTML = isOnlineMatch() ? `<div class="card-label"><span>Online</span><span>Private room</span></div><p class="modal-note">Online matches are unranked and are not saved to My stats.</p>` : StatsPage.resultExtra(lastRecord);
  resultBots();
}

function resultBots() {
  if (isOnlineMatch()) {
    $("result-bots").innerHTML = `<div class="card-label"><span>Online room</span><span>${online.localRematch ? "Waiting" : "Ready for rematch"}</span></div>` +
      `<button class="bot-chip pick ${online.remoteRematch ? "sel" : ""}" tabindex="-1"><b>${botCfg.name}</b>${online.remoteRematch ? "wants rematch" : "not ready"}</button>`;
    $("result-btns").innerHTML = btn("rematch", online.localRematch ? "Waiting" : "Rematch", "Enter", online.localRematch ? "" : "primary") + btn("menu", "Leave", "Esc");
    keyline([keyBtn("settings", "S", "settings"), keyBtn("view", "F2", "words: " + viewName()), keyBtn("fullscreen", "F", "fullscreen")]);
  } else {
    $("result-bots").innerHTML = `<div class="card-label"><span>Pick another opponent</span><span>${botKeys()}</span></div>` +
      BOTS.map((b, i) => `<button class="bot-chip pick ${i === botIndex ? "sel" : ""}" data-act="bot:${i}" tabindex="-1"><b>${b.name}</b>${Math.round(botCfgFor(i).beatAt)} wpm</button>`).join("");
    $("result-btns").innerHTML = btn("rematch", "Rematch", "Enter", "primary") + btn("nextbot", "Next opponent", botKeys()) + btn("stats", "My stats", "T") + btn("menu", "Main menu", "Esc");
    keyline([keyBtn("fighter", "C", "fighter"), keyBtn("howto", "H", "how to play"), keyBtn("settings", "S", "settings"),
      keyBtn("view", "F2", "words: " + viewName()), keyBtn("fullscreen", "F", "fullscreen")]);
  }
}

// ---------- Stats screen (js/stats-page.js draws it from the saved match records) ----------
function openStats(id) {
  if (screen === "title" || screen === "result") back = screen;
  showScreen("stats");
  StatsPage.open($("scr-stats"), id);
  keyline([keyBtn("back", "Esc", "back")]);
}
function closeStats() {
  StatsPage.close();
  if (back === "result" && lastRecord) { showScreen("result"); resultBots(); } else renderTitle();
}

// ---------- Fighter screen: pick one of the 11 fighters ----------
function sizePreview() {
  const cv = $("fighter-preview"), dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = Math.round(446 * uiScale * dpr);
  cv.height = Math.round(520 * uiScale * dpr);
}

function openFighter() {
  back = screen === "result" ? "result" : screen === "online" ? "online" : "title";
  pickIndex = Math.max(0, ROSTER.indexOf(charKey));
  showScreen("fighter");
  $("chars").innerHTML = ROSTER.map((k, i) => { const d = charDef(k); return `<button class="char pick" data-act="char:${i}" tabindex="-1"><b>${d.name}</b><span>${d.title}</span></button>`; }).join("");
  $("fighter-btns").innerHTML = btn("back", "Back", "Esc") + btn("confirm", "Use this fighter", "Enter", "primary");
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
  if (back === "result") { showScreen("result"); resultBots(); }
  else if (back === "online") { online.profile = onlineProfile(); renderOnline(); }
  else renderTitle();
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
  if (top !== "settings") m.classList.remove("preview");
  if (top === "pause") {
    $("mod-pause").innerHTML = isOnlineMatch()
      ? `<h2 class="screen-title">Online</h2>` + mbtn("resume", "Close", "Esc", "primary") + mbtn("settings", "Settings", "S") + mbtn("quit-yes", "Leave room", "Q") +
        `<p class="modal-note">Online fights keep running while this menu is open.</p>`
      : `<h2 class="screen-title">Paused</h2>` +
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

// ---------- Settings screen ----------
// Seven tabs. Most rows are built from the data below: a row is a set of choices (seg), a slider (range), a button,
// a heading or a note. The Theme and Custom tabs are built by hand (themeHtml, customHtml). Every setting here is
// visual or about input; none changes a rule.
const ON_OFF = [[true, "On"], [false, "Off"]];
const toggleRow = (id, label, hint) => ({ id, label, hint, opts: ON_OFF, get: () => settings[id], set: (v) => { settings[id] = v; } });
const pct = (v) => Math.round(v * 100) + "%";
const SETTINGS_TABS = [
  { name: "Game", rows: [
    { id: "view", label: "Where words appear", hint: "Over-head: the word floats above each fighter. Classic: a typing box at the bottom.",
      opts: [["overhead", "Over-head"], ["classic", "Classic"]], get: () => viewMode, set: (v) => setView(v) },
    toggleRow("damageNumbers", "Damage numbers", "Show the HP gained or lost next to each fighter."),
  ] },
  { name: "Typing", rows: [
    { id: "wordSubmit", label: "Space ends a word", hint: "On: press Space (or Enter) after each word. Off: a word ends by itself when it is exactly right.",
      opts: ON_OFF, get: () => settings.wordSubmit, set: (v) => { settings.wordSubmit = v; } },
    { type: "note", html: "<b>On</b> works like Monkeytype. <b>Off</b> saves a key per word: the moment a word is typed exactly right, the caret jumps to the next one. " +
      "A word with a wrong letter still needs <kbd>Space</kbd>, or <kbd>Backspace</kbd> and a fix. Your speed is counted the same either way " +
      "(the Space you skip is not counted), but the two modes are different races, so your stats keep them apart." },
  ] },
  { name: "Graphics", rows: [
    { type: "head", label: "Speed" },
    { id: "renderScale", label: "Render scale", hint: "Lower is faster on a weak laptop. 100% is one canvas pixel per screen pixel; Native uses every pixel your display has.",
      opts: SET.renderScaleSteps, get: () => settings.renderScale, set: (v) => { settings.renderScale = v; } },
    { id: "sceneryLevel", label: "Background scenery", hint: "Full: skyline, desks and arcade cabinets. Simple: sky and floor. Off: a flat color or your own image.",
      opts: SET.scenerySteps, get: () => settings.sceneryLevel, set: (v) => { settings.sceneryLevel = v; } },
    { id: "frameCap", label: "Frame rate limit", hint: "Stops the game from drawing faster than this, which saves battery. None follows your screen.",
      opts: SET.frameCapSteps, get: () => settings.frameCap, set: (v) => { settings.frameCap = v; } },
    toggleRow("showFps", "Show FPS", "A small counter in the top right corner with frames per second and the time each frame takes."),
    { type: "head", label: "Effects" },
    toggleRow("fxSparks", "Sparks and flames", "Hit sparks, flashes, fire and ice chips."),
    toggleRow("fxSmears", "Weapon trails", "The streak behind a swinging weapon."),
    toggleRow("fxAfterimages", "Afterimages", "The ghost copies behind a fast fighter."),
    toggleRow("fxDust", "Dust and rings", "Dust from steps and landings, and the rings on the floor."),
    toggleRow("fxGlow", "Fighter glow", "The soft halo in each player's color."),
    { id: "fxBudget", label: "Effect limit", hint: "The most effect particles on screen at once.",
      opts: SET.budgetSteps, get: () => settings.fxBudget, set: (v) => { settings.fxBudget = v; } },
    { type: "head", label: "Screen" },
    { id: "reduceMotion", label: "Reduce motion", hint: "One switch that turns off shake, flashes, hit-stop and animations.",
      opts: [[false, "Off"], [true, "On"]], get: () => settings.reduceMotion, set: (v) => { settings.reduceMotion = v; } },
    { id: "shake", type: "range", label: "Screen shake", min: SET.shake.min, max: SET.shake.max, step: SET.shake.step,
      hint: () => (settings.reduceMotion ? "Off while Reduce motion is on." : "How hard the screen shakes on big hits. 0% is none, 100% is normal."),
      get: () => settings.shake, set: (v) => { settings.shake = v; }, fmt: pct },
    { type: "button", label: "Try the shake", hint: "Shakes the screen once at the strength above.", button: "Shake now", run: () => renderer.kick(18) },
    toggleRow("flash", "Ultimate flash", "The bright flash when an ultimate lands."),
    toggleRow("hitstop", "Hit-stop", "A tiny freeze on big hits. It only pauses the pictures, never the typing."),
    toggleRow("scanlines", "Scanlines", "The fine horizontal lines over the scenery and menus."),
    toggleRow("sweep", "Light sweep", "The slow band of light that slides down the background."),
    { id: "fullscreen", label: "Fullscreen", hint: "Also the F key on the menus and the button in the top bar.",
      opts: [[false, "Off"], [true, "On"]], get: () => isFullscreen(), set: (v) => setFullscreen(v) },
    { type: "head", label: "Fight display" },
    { id: "uiScale", label: "Interface size", hint: "Makes the HUD and menus bigger or smaller.",
      opts: SET.uiScaleSteps, get: () => settings.uiScale, set: (v) => { settings.uiScale = v; } },
    { id: "hudOpacity", type: "range", label: "HUD panel opacity", min: SET.hudOpacity.min, max: SET.hudOpacity.max, step: SET.hudOpacity.step,
      hint: "Lower lets you see more of the arena through the panels.", get: () => settings.hudOpacity, set: (v) => { settings.hudOpacity = v; }, fmt: pct },
    toggleRow("showWpm", "Show WPM", "Your speed and the opponent's, in the bottom corners."),
    toggleRow("showPower", "Show power", "Power is your WPM plus your combo bonus."),
    toggleRow("showEdge", "Show the edge bar", "The tug of war at the top that shows who is winning the exchange."),
  ] },
  { name: "Sound", rows: [
    toggleRow("sound", "Sound effects", "Hits, typing clicks, combos, the countdown and the K.O."),
    { id: "volume", label: "Volume", hint: "How loud the sound effects play.",
      opts: SET.volumeSteps, get: () => settings.volume, set: (v) => { settings.volume = v; Sfx.unlock(); } },
  ] },
  { name: "Theme", html: () => themeHtml(), preview: true },
  { name: "Custom", html: () => customHtml(), preview: true },
  { name: "Keys", rows: [] },
];
const isRow = (r) => !r.type || r.type === "range" || r.type === "button";   // rows the keyboard can focus
function keyRows() { return [
  ["Typing", settings.wordSubmit ? "Letters type, <kbd>Space</kbd> or <kbd>Enter</kbd> ends a word, <kbd>Backspace</kbd> fixes a letter" :
    "Letters type, a word ends when it is exactly right (or press <kbd>Space</kbd>), <kbd>Backspace</kbd> fixes a letter"],
  ["Pause", "<kbd>Esc</kbd> in a fight (leaving the tab pauses too)"],
  ["Pause menu", "<kbd>Esc</kbd> resume, <kbd>R</kbd> restart, <kbd>S</kbd> settings, <kbd>Q</kbd> quit"],
  ["Title and result", "<kbd>Enter</kbd> fight, <kbd>1</kbd> to <kbd>7</kbd> opponent, <kbd>C</kbd> fighter, <kbd>H</kbd> how to play"],
  ["", "<kbd>T</kbd> stats, <kbd>S</kbd> settings, <kbd>F2</kbd> view, <kbd>F</kbd> fullscreen, <kbd>Esc</kbd> menu (result)"],
  ["Fighter", "<kbd>Left</kbd> <kbd>Right</kbd> pick, <kbd>Up</kbd> <kbd>Down</kbd> row, <kbd>Enter</kbd> confirm, <kbd>Esc</kbd> back"],
  ["Settings", "<kbd>1</kbd> to <kbd>7</kbd> or <kbd>Tab</kbd> tab, <kbd>Up</kbd> <kbd>Down</kbd> row, <kbd>Left</kbd> <kbd>Right</kbd> change"],
  ["Stats", "<kbd>Up</kbd> <kbd>Down</kbd> scroll, <kbd>Esc</kbd> or <kbd>T</kbd> back"],
  ["Mouse", "Click any button or key chip. Typing stays on the keyboard."],
]; }

function openSettings() {
  if (topModal() === "settings") return;
  modals.push("settings");
  setRow = firstRow(SETTINGS_TABS[setTab]);
  renderModal();
}
const firstRow = (tab) => (tab.rows ? Math.max(0, tab.rows.findIndex(isRow)) : 0);
const rowKeys = (tab) => (tab.rows || []).map((r, i) => (isRow(r) ? i : -1)).filter((i) => i >= 0);

function rowHtml(r, ri) {
  if (r.type === "head") return `<div class="set-head">${r.label}</div>`;
  if (r.type === "note") return `<p class="set-note">${r.html}</p>`;
  const hint = typeof r.hint === "function" ? r.hint() : r.hint;
  const lbl = `<span class="lbl">${r.label}<span class="hint">${hint}</span></span>`;
  let ctl;
  if (r.type === "range") {
    const v = r.get();
    ctl = `<span class="rng"><input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}" data-range="${ri}" tabindex="-1" aria-label="${r.label}"><output>${r.fmt(v)}</output></span>`;
  } else if (r.type === "button") {
    ctl = `<span class="segs"><button class="seg" data-act="run:${ri}" tabindex="-1">${r.button}</button></span>`;
  } else {
    const cur = r.get();
    ctl = `<span class="segs">${r.opts.map(([v, label], oi) => `<button class="seg ${v === cur ? "sel" : ""}" data-act="set:${ri}:${oi}" tabindex="-1">${label}</button>`).join("")}</span>`;
  }
  return `<div class="set-row ${ri === setRow ? "focus" : ""}" data-row="${ri}">${lbl}${ctl}</div>`;
}

function renderSettings() {
  const tab = SETTINGS_TABS[setTab];
  if (tab.rows && !isRow(tab.rows[setRow] || {})) setRow = firstRow(tab);
  const tabs = SETTINGS_TABS.map((t, i) => `<button class="tab ${i === setTab ? "sel" : ""}" data-act="tab:${i}" tabindex="-1">${t.name}${kb(i + 1)}</button>`).join("");
  let body;
  if (tab.html) body = tab.html();
  else if (tab.rows.length) body = tab.rows.map(rowHtml).join("");
  else body = `<table class="keys-table">${keyRows().map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</table>`;
  const old = $("mod-settings").querySelector(".set-rows");
  const scroll = old ? old.scrollTop : 0;
  $("mod-settings").innerHTML = `<h2 class="screen-title">Settings</h2><div class="tabs">${tabs}</div>` +
    `<div class="set-rows">${body}</div><div class="btn-row">${btn("back", "Back", "Esc", "primary")}</div>`;
  const box = $("mod-settings").querySelector(".set-rows");
  box.scrollTop = scroll;
  $("modal").classList.toggle("preview", !!tab.preview); // Theme and Custom: the screen behind stays visible
}

// A change from a row: store, apply, redraw. Sliders skip the redraw so the thumb is not replaced mid-drag.
function setValue(ri, oi) {
  const r = SETTINGS_TABS[setTab].rows[ri];
  if (!r || !isRow(r) || r.type) return;
  setRow = ri;
  r.set(r.opts[oi][0]);
  saveSettings();
  applySettings();
  renderSettings();
}
function runRow(ri) {
  const r = SETTINGS_TABS[setTab].rows[ri];
  if (!r || r.type !== "button") return;
  setRow = ri;
  r.run();
  renderSettings();
}
function rangeValue(ri, v, redrawOutput = true) {
  const r = SETTINGS_TABS[setTab].rows[ri];
  if (!r || r.type !== "range") return;
  const step = r.step, val = Math.round(Math.max(r.min, Math.min(r.max, v)) / step) * step;
  r.set(+val.toFixed(3));
  saveSettings();
  applySettings();
  const row = $("mod-settings").querySelector(`[data-row="${ri}"]`);
  if (row) {
    if (redrawOutput) row.querySelector("output").textContent = r.fmt(r.get());
    row.querySelector(".hint").textContent = typeof r.hint === "function" ? r.hint() : r.hint;
  }
}
function focusRow(ri) {
  setRow = ri;
  $("mod-settings").querySelectorAll(".set-row").forEach((el) => el.classList.toggle("focus", +el.dataset.row === ri));
  const el = $("mod-settings").querySelector(`[data-row="${ri}"]`);
  if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
}
function stepValue(step) {
  const r = SETTINGS_TABS[setTab].rows[setRow];
  if (!r || !isRow(r)) return;
  if (r.type === "range") {
    const ri = setRow;
    rangeValue(ri, r.get() + step * r.step);
    const inp = $("mod-settings").querySelector(`[data-range="${ri}"]`);
    if (inp) inp.value = r.get();
  } else if (r.type === "button") { if (step > 0) runRow(setRow); }
  else {
    const cur = r.opts.findIndex(([v]) => v === r.get());
    setValue(setRow, (Math.max(0, cur) + step + r.opts.length) % r.opts.length);
  }
}
function moveRow(dir) {
  const keys = rowKeys(SETTINGS_TABS[setTab]);
  if (!keys.length) { const box = $("mod-settings").querySelector(".set-rows"); if (box) box.scrollBy({ top: dir * 80 }); return; }
  const at = Math.max(0, keys.indexOf(setRow));
  focusRow(keys[(at + dir + keys.length) % keys.length]);
}
function setTabTo(i) {
  setTab = (i + SETTINGS_TABS.length) % SETTINGS_TABS.length;
  setRow = firstRow(SETTINGS_TABS[setTab]);
  renderSettings();
}

// ----- Theme tab: presets, 11 color pickers, a share code -----
function themeHtml() {
  const cur = Themes.current;
  const presets = Themes.PRESETS.map((p) => {
    const sw = ["bg", "surface", "accent", "focus", "gold"].map((k) => `<i style="background:${p.slots[k]}"></i>`).join("");
    return `<button class="preset ${cur.id === p.id ? "sel" : ""}" data-act="preset:${p.id}" tabindex="-1"><span class="sw">${sw}</span><b>${p.name}</b><span class="pn">${p.note}</span></button>`;
  }).join("");
  const slots = Themes.SLOTS.map((s) => `<label class="slot"><input type="color" value="${cur.slots[s.key]}" data-slot="${s.key}" tabindex="-1"><span>${s.label}</span></label>`).join("");
  return `<div class="set-head">Pick a theme${cur.id === "custom" ? " <span class=\"tag\">custom colors</span>" : ""}</div>
    <div class="presets">${presets}</div>
    <div class="set-head">Change a color</div>
    <div class="slots">${slots}</div>
    <div class="set-head">Share code</div>
    <div class="code-row"><input type="text" id="theme-code" value="${Themes.exportCode()}" spellcheck="false" autocomplete="off" aria-label="Theme share code">
      <button class="seg" data-act="code:copy" tabindex="-1">Copy</button><button class="seg" data-act="code:use" tabindex="-1">Use code</button></div>
    <p class="set-note">Copy the code to share your colors. To use a friend's, paste it in the box and press Use code. Colors change right away behind this window.</p>`;
}

// ----- Custom tab: background image and your own CSS -----
function customHtml() {
  const B = Themes.bg;
  const has = B.url || B.hasFile;
  const sl = (key, label, min, max, step, unit) =>
    `<label class="bg-sl"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${B[key]}" data-bg="${key}" tabindex="-1"><output>${B[key]}${unit}</output></label>`;
  const modes = [["cover", "Cover"], ["contain", "Contain"], ["stretch", "Stretch"]]
    .map(([v, l]) => `<button class="seg ${B.mode === v ? "sel" : ""}" data-act="bgmode:${v}" tabindex="-1">${l}</button>`).join("");
  return `<div class="set-head">Background image</div>
    <div class="code-row"><input type="text" id="bg-url" value="${B.url.replace(/"/g, "&quot;")}" placeholder="https://example.com/picture.jpg" spellcheck="false" autocomplete="off" aria-label="Image address">
      <button class="seg" data-act="bg:url" tabindex="-1">Use address</button></div>
    <div class="code-row"><label class="seg filebtn">Choose a file<input type="file" id="bg-file" accept="image/*" tabindex="-1"></label>
      <button class="seg" data-act="bg:clear" tabindex="-1" ${has ? "" : "disabled"}>Remove image</button>
      <span class="set-note inline">${has ? (B.hasFile ? "Using a file from this computer." : "Using the address above.") : "No image. It replaces the far scenery; the floor and fighters stay."}</span></div>
    <div class="bg-grid"><span class="bg-label">Size</span><span class="segs">${modes}</span>
      ${sl("blur", "Blur", 0, 20, 1, " px")}${sl("brightness", "Brightness", 20, 150, 5, "%")}
      ${sl("opacity", "Opacity", 0, 100, 5, "%")}${sl("saturate", "Saturation", 0, 200, 10, "%")}</div>
    <div class="set-head">Custom CSS</div>
    <textarea id="css-box" rows="7" spellcheck="false" maxlength="${Themes.MAX_CSS}" placeholder="/* Example */&#10;#timer { color: gold; }&#10;.hpfill { border-radius: 4px; }" aria-label="Custom CSS">${Themes.css.replace(/</g, "&lt;")}</textarea>
    <div class="code-row"><button class="seg" data-act="css:clear" tabindex="-1">Clear CSS</button>
      <span class="set-note inline">Only you see this CSS, and it is never sent to anyone. If something breaks, open the game with <b>?nocss</b> at the end of the address.${Themes.cssSafeMode ? " <b>Safe mode is on now.</b>" : ""}</span></div>`;
}

// Inputs inside the settings window (sliders, color pickers, text boxes) are handled by their own events.
const modSettings = $("mod-settings");
modSettings.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.range !== undefined) { focusRow(+el.dataset.range); rangeValue(+el.dataset.range, parseFloat(el.value)); }
  else if (el.dataset.slot) {
    if (Themes.setSlot(el.dataset.slot, el.value)) { const c = $("theme-code"); if (c) c.value = Themes.exportCode(); }
  } else if (el.dataset.bg) {
    const key = el.dataset.bg, v = parseFloat(el.value);
    Themes.setBg({ [key]: v });
    el.nextElementSibling.textContent = v + (key === "blur" ? " px" : "%");
  } else if (el.id === "css-box") Themes.setCss(el.value);
});
modSettings.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.range !== undefined) el.blur(); // hand the keyboard back to the game's own keys
  else if (el.dataset.slot) renderSettings();
  else if (el.id === "bg-file" && el.files && el.files[0]) {
    Themes.setBgFile(el.files[0]).then((ok) => { if (!ok) toast("That image could not be drawn."); renderSettings(); }).catch((err) => toast(err.message));
  }
});
modSettings.addEventListener("pointerup", (e) => { if (e.target.type === "range") setTimeout(() => e.target.blur(), 0); });

function themeAct(a, x) {
  if (a === "preset") { Themes.setPreset(x); renderSettings(); }
  else if (a === "code") {
    const box = $("theme-code");
    if (x === "copy") {
      box.select();
      try { navigator.clipboard.writeText(box.value).then(() => toast("Theme code copied."), () => toast("Press Ctrl+C to copy the code.")); } catch (err) { toast("Press Ctrl+C to copy the code."); }
    } else if (Themes.importCode(box.value)) { toast("Theme applied."); renderSettings(); }
    else toast("That is not a Type Boxing theme code. It looks like TB1. followed by 66 letters and digits.");
  } else if (a === "bgmode") { Themes.setBg({ mode: x }); renderSettings(); }
  else if (a === "bg") {
    if (x === "clear") Themes.clearBg().then(renderSettings);
    else Themes.setBgUrl($("bg-url").value).then((ok) => { if (!ok && $("bg-url").value.trim()) toast("That image could not be loaded."); renderSettings(); }).catch((err) => toast(err.message));
  } else if (a === "css" && x === "clear") { Themes.setCss(""); renderSettings(); }
}

// ---------- Actions: the one place the keyboard and the mouse both go through ----------
function act(name) {
  const [a, x, y] = name.split(":");
  Sfx.play("ui");
  const top = topModal();
  switch (a) {
    case "play": begin(); break;
    case "rematch":
      if (isOnlineMatch()) {
        online.localRematch = true;
        if (online.net) online.net.send(Protocol.rematch(true));
        if (online.role === "host" && online.remoteRematch) hostStartOnline();
        resultBots();
      } else begin();
      break;
    case "online": if (!top && screen === "title") openOnline(); break;
    case "online-create": createOnlineRoom(); break;
    case "online-join": joinOnlineRoom(); break;
    case "online-ready": toggleOnlineReady(); break;
    case "online-leave": goMenu(); break;
    case "fighter": if (!top && (screen === "title" || screen === "result" || screen === "howto" || screen === "online")) openFighter(); break;
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
      else if (screen === "stats") { if (!StatsPage.back()) closeStats(); }
      else if (screen === "fighter") closeFighter(false);
      else if (screen === "online") goMenu();
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
    case "run": runRow(+x); break;
    case "preset": case "code": case "bgmode": case "bg": case "css": themeAct(a, x); break;
    case "stats": if (!top && (screen === "title" || screen === "result")) openStats(screen === "result" && lastRecord ? lastRecord.id : undefined); break;
    case "st": StatsPage.act(x, y, name.split(":").slice(3).join(":")); break;
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
  if (screen === "stats") {
    if (k === "Escape" || lower === "t") act("back");
    else if (k === "ArrowUp" || k === "ArrowDown") { e.preventDefault(); $("scr-stats").scrollBy({ top: k === "ArrowUp" ? -90 : 90 }); }
    return;
  }
  if (screen === "howto") {
    if (k === "Escape" || lower === "h") act("back");
    else if (lower === "c") act("fighter");
    else if (k === "Enter") act("play");
    return;
  }
  if (screen === "online") {
    if (k === "Escape") act(online.connected ? "online-leave" : "back");
    else if (lower === "c" && !online.connected) act("online-create");
    else if (lower === "j" && !online.connected) act("online-join");
    else if (lower === "f" && !online.connected) act("fighter");
    else if (k === "Enter" && online.connected) act("online-ready");
    else if (k === "F2") { e.preventDefault(); act("view"); }
    return;
  }
  if (screen === "title" || screen === "result") {
    if (lower === "c") act("fighter");
    else if (lower === "h") act("howto");
    else if (lower === "t") act("stats");
    else if (lower === "o" && screen === "title") act("online");
    else if (lower === "s") act("settings");
    else if (lower === "f") act("fullscreen");
    else if (k === "F2") { e.preventDefault(); act("view"); }
    else if (k >= "1" && k <= String(BOTS.length)) act("bot:" + (+k - 1));
    else if (k === "Enter") act(screen === "result" ? "rematch" : "play");
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
    else if (lower === " ") stepValue(1);
    else if (k === "Tab") setTabTo(setTab + (e.shiftKey ? -1 : 1));
    else if (k === "ArrowUp" || k === "ArrowDown") moveRow(k === "ArrowUp" ? -1 : 1);
    else if (k === "ArrowLeft") stepValue(-1);
    else if (k === "ArrowRight" || k === "Enter") stepValue(1);
  }
}

function applyInputToSide(side, key) {
  const s = duel.streams && duel.streams[side];
  if (!s) return [];
  if (key === "Backspace") { s.backspace(); return []; }
  if (key === "Submit") return s.submit(true);
  if (key === "AutoSubmit") return s.submit(false);
  if (key && key.length === 1) return s.press(key);
  return [];
}

function queueOnlineKey(key) {
  if (!online.active || online.role !== "guest") return;
  online.keyQueue.push({ k: key, lt: duel.t });
  if (online.keyQueue.length >= CONFIG.net.maxKeysPerMessage) flushOnlineKeys();
}

function flushOnlineKeys() {
  if (!online.net || online.role !== "guest" || !online.keyQueue.length) return;
  const batch = online.keyQueue.splice(0, CONFIG.net.maxKeysPerMessage);
  online.net.send(Protocol.keys(online.seq++, batch));
}

function handlePlayerTyping(evs) {
  duel.handleEvents(0, evs, duel.t);
  // Typing sounds: a soft click per right key, a dull knock per typo (the word strikes sound from the fighters).
  if (evs.some((v) => v.type === "wrong")) Sfx.play("typo");
  else if (evs.some((v) => v.type === "correct" || v.type === "word")) Sfx.play("key");
  view.update();
}

window.addEventListener("keydown", (e) => {
  Sfx.unlock(); // browsers allow audio only after a key or a click
  // A text box (theme code, image address, custom CSS) keeps its own keys; Esc leaves it.
  const tg = e.target;
  if (tg && (tg.tagName === "TEXTAREA" || (tg.tagName === "INPUT" && tg.type !== "range"))) {
    if (e.key === "Escape") { e.preventDefault(); tg.blur(); }
    return;
  }
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
  if (e.key === "Backspace" || e.key === " " || e.key === "Enter" || e.key === "Tab" || e.key.length === 1) e.preventDefault();
  if (duel.phase !== "fight") return; // countdown: keys are ignored

  if (e.key === "Backspace") { applyInputToSide(0, "Backspace"); queueOnlineKey("Backspace"); view.update(); return; }
  // What the player does is also noted by the recorder (stats only; it reads the stream, never changes it).
  if (e.key === " " || e.key === "Enter") {
    const s = duel.streams[0];
    if (rec) rec.space(duel.t, s.typed, s.current().text);
    const evs = applyInputToSide(0, "Submit");
    queueOnlineKey("Submit");
    if (rec) rec.events(evs);
    handlePlayerTyping(evs);
    return;
  }
  if (e.key.length === 1) {
    const s = duel.streams[0], w = s.current(), ch = e.key.toLowerCase();
    if (rec && s.typed.length < w.text.length + 5) rec.press(duel.t, w.text[s.typed.length], ch);
    const evs = applyInputToSide(0, ch);
    queueOnlineKey(ch);
    // "Space ends a word" off: an exactly typed word ends by itself, with no key counted for the missing Space.
    if (!matchSpace && s.autoEnds()) { evs.push(...applyInputToSide(0, "AutoSubmit")); queueOnlineKey("AutoSubmit"); }
    if (rec) rec.events(evs);
    handlePlayerTyping(evs);
  }
});

// Leaving the browser tab (or the window) pauses the fight.
document.addEventListener("visibilitychange", () => { if (document.hidden && !isOnlineMatch()) openPause(); });
window.addEventListener("blur", () => { if (!isOnlineMatch()) openPause(); });

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
const perf = { frames: 0, ms: 0, since: performance.now() }; // for the FPS counter (Graphics > Show FPS)
let nextDraw = 0;                                              // frame rate limit: when the next frame may be drawn
function onlineTick() {
  if (!online.active) return;
  if (online.role === "guest" && online.keyQueue.length && duel.t >= online.keyFlushAt) {
    flushOnlineKeys();
    online.keyFlushAt = duel.t + CONFIG.net.keyBatchMs / 1000;
  }
  if (online.role === "host" && online.net && duel.phase !== "menu" && duel.t >= online.snapNext) {
    online.net.send(Protocol.state(online.snapN++, duel.snapshot()));
    online.snapNext = duel.t + 1 / CONFIG.net.snapshotHz;
  }
  if (online.role === "host" && duel.phase === "fight" && duel.t >= traceNext) {
    online.trace.push([duel.wpmNow[0], duel.wpmNow[1], duel.typists[0].hp, duel.typists[1].hp]);
    traceNext += 0.5;
  }
  if (online.role === "host" && duel.phase === "over" && duel.result && !online.hostSentResult) {
    online.hostSentResult = true;
    online.net.send(Protocol.result(duel.result.winner, duel.t, duel.typists.map((t) => t.stats)));
  }
}

function loop(now) {
  // Frame rate limit (Graphics tab): skip a display frame instead of drawing it. The simulation keeps its own fixed
  // step, so skipping frames never changes how a fight plays.
  if (settings.frameCap) {
    const every = 1000 / settings.frameCap;
    if (now < nextDraw - 1) { requestAnimationFrame(loop); return; }
    nextDraw += every;
    if (nextDraw < now - every) nextDraw = now; // fell behind (a pause, a slow frame): do not catch up in a burst
  }
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t0 = performance.now();
  const frozen = paused();
  const remoteView = online.active && online.role === "guest";
  if (duel.phase !== "menu" && !frozen && !remoteView) {
    acc += dt;
    while (acc >= STEP) {
      if (bot && duel.phase === "fight") bot.update(duel.t);
      duel.update(STEP);
      acc -= STEP;
      if (rec && duel.phase === "fight") {
        rec.step(duel, STEP);
        // Sample both typists twice a second for the speed graph (stats only).
        if (duel.t >= traceNext) { rec.sample(duel); traceNext += 0.5; }
      }
    }
    if (view) view.sync();
  } else {
    acc = 0;
    if (remoteView && view) view.sync();
  }
  onlineTick();
  if (duel.phase === "over" && !shownResult && duel.fighters.some((f) => f.dead && f.state === "down" && f.stateT > 0.6)) {
    shownResult = true;
    resultShownAt = performance.now();
    if (rec) {
      rec.sample(duel);
      lastRecord = rec.finish(duel);
      if (!Stats.add(lastRecord)) toast("This match could not be saved to your stats: the browser's storage is full or blocked.");
      const mine = avgWpm(duel.typists[0]);
      if (mine > 0 && duel.t > 5) saveHistory(mine); // for MATCH ME
    }
    if (isOnlineMatch()) online.screenState = "result";
    showResult();
  }
  if (online.waitingResult && !shownResult && duel.phase === "over") {
    shownResult = true;
    resultShownAt = performance.now();
    online.screenState = "result";
    showResult();
  }
  if (duel.phase !== "over") shownResult = false;
  renderer.draw(duel, frozen ? 0 : dt);
  if (screen === "fighter") DuelChars.drawPreview($("fighter-preview"), ROSTER[pickIndex], frozen ? 0 : dt, settings.reduceMotion);
  updateHud(dt);
  const cost = performance.now() - t0;
  frameStats.n++; frameStats.ms += cost;
  perf.frames++; perf.ms += cost;
  if (settings.showFps && now - perf.since >= 500) {
    $("perf").textContent = `${Math.round((perf.frames * 1000) / (now - perf.since))} FPS  ${(perf.ms / perf.frames).toFixed(1)} ms`;
    perf.frames = 0; perf.ms = 0; perf.since = now;
  } else if (!settings.showFps) { perf.frames = 0; perf.ms = 0; perf.since = now; }
  requestAnimationFrame(loop);
}

// The theme (colors, background image, custom CSS) comes first so the very first frame already has it.
Themes.onChange((err) => {
  if (err instanceof Error) toast(err.message);
  renderer.layers = null;                                           // rebuild the scenery in the new colors
  renderer.setBackground(Themes.bgImage, Themes.bg, Themes.bgVersion);
  applyHud();
  applyLooks();
});
Themes.init();
applySettings();
renderTitle();
applyView();
requestAnimationFrame(loop);
