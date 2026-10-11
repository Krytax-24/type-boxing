// ---------- Theme: Terminal Arcade (visual only, no rule reads it) ----------
// The one palette. css/duel.css repeats THEME.ui as CSS variables (main.js also writes them onto
// :root at start, so this file wins if the two ever drift). render.js and main.js take every color
// from here. Meanings: danger red = typos and danger, gold = the ultimate only, each player's
// identity color (their Fighter color) everywhere for that player, magenta = focus and the counter.
const THEME = {
  resultKeyDelay: 700,         // ms: keys are ignored this long after the result screen appears (you may still be typing)
  font: '"Cascadia Mono", Consolas, "SF Mono", Menlo, "DejaVu Sans Mono", "Courier New", monospace',
  ui: {                        // CSS variables: --bg, --surface, ... (same names)
    bg: "#060a18",             // page and arena sky top
    surface: "#0b1129",        // panels, cards, typing box
    raised: "#121a3a",         // selected card, word plate
    line: "#2a3a73",           // the one border color (1 px)
    text: "#e8edff",           // main text            15.9:1 on surface
    dim: "#8d9ac8",            // labels and secondary  6.7:1 on surface
    phosphor: "#4dff9a",       // logo, win, your lead, healthy HP  14.3:1
    magenta: "#ff3ea5",        // focus, selection, counter          5.8:1
    gold: "#ffc53d",           // the ultimate only                  11.8:1
    danger: "#ff4d5e",         // typos, critical HP, stun, lose     5.8:1
    warn: "#ff8a3d",           // low HP                             8.0:1
    info: "#7ce3ff",           // combo text, blocked hits           12.7:1
    track: "#18224a",          // empty bar tracks (not text)
  },
  arena: {                     // canvas scenery: darker and lower in contrast than fighters and plates
    skyTop: "#060a18", skyBottom: "#0d1736",
    glow: "rgba(77, 255, 154, 0.07)",       // far screen glow on the horizon
    far: "#0b1430", farEdge: "#13204a", farWindow: "rgba(124, 227, 255, 0.10)",
    mid: "#0e1838", midEdge: "#1a2a5c", screen: "#0f2a2a", screenText: "rgba(77, 255, 154, 0.22)",
    floor: "#0a1128", floorLine: "#2a3a73", grid: "rgba(42, 58, 115, 0.55)", cable: "#141f45",
    scan: "rgba(0, 0, 0, 0.16)",           // baked scanlines
    sweep: "rgba(124, 227, 255, 0.035)",   // the slow scanline sweep
    leds: ["#4dff9a", "#ff3ea5", "#7ce3ff"],
    shadow: "rgba(0, 0, 0, 0.45)",
    flash: "255, 197, 61",                 // ultimate flash (gold), as r, g, b
  },
  fx: {                        // floating texts and sparks from duel.js
    combo: "#7ce3ff", broken: "#8d9ac8", counter: "#ff3ea5", ult: "#ffc53d", sloppy: "#8d9ac8",
    ko: "#ff4d5e", hit: "#ffffff", block: "#7ce3ff", ring: "#8d9ac8",
  },
  // The combo sandbox (sandbox.html) keeps its original look: render.js uses these when no theme is set.
  sandbox: {
    bg: "#171a21", floor: "#1d212b", floorLine: "#3a4050", ticks: "#2b303c",
    player: "#f1f3f8", enemy: "#e8737d", bar: "#2a2e3a", barFill: "#e8737d", barLine: "#555b6e",
    flash: "251, 191, 36", special: "#fbbf24", specialCore: "#fde68a", shadow: "rgba(0, 0, 0, 0.35)",
  },
};

// All balance numbers live here. Tweak freely.
const CONFIG = {
  theme: THEME, // visual only, see above
  canvas: { w: 960, h: 540 },
  arena: { width: 3200, floorY: 410 },

  player: { maxHp: 100, dashSpeed: 2600, startX: 500 },
  dummy: { maxHp: 400, respawnDelay: 1.4, spawnDistance: 320 },

  physics: {
    gravity: 2600,
    groundFriction: 2400,
    airFriction: 260,
    downTime: 0.75,       // seconds an enemy lies on the floor before getting up
    slamBounce: 540,      // upward speed after a slam hits the floor
    juggleHang: 0.22,     // seconds of floating after an air hit
  },

  // How typing quality turns into damage.
  typing: {
    refCharsPerSec: 4.5,  // about 54 wpm counts as normal speed
    minSpeedMult: 0.7,
    maxSpeedMult: 1.6,
    dirtyMult: 0.6,       // damage kept when the chunk had a mistake
  },
  chain: { step: 0.1, max: 2.0 }, // damage bonus per clean chunk in a row

  // Every move is data: duration in seconds and a list of hits.
  // at = fraction of the move when the hit lands.
  moves: {
    jab:      { dur: 0.22, range: 80, style: 6,  shake: 2,  hitstop: 0.03,
                hits: [{ at: 0.35, dmg: 4, knock: 150, stun: 0.30 }] },
    heavy:    { dur: 0.46, range: 90, style: 14, shake: 7,  hitstop: 0.08,
                hits: [{ at: 0.55, dmg: 11, knock: 520, stun: 0.55 }] },
    launcher: { dur: 0.44, range: 80, style: 12, shake: 6,  hitstop: 0.07,
                hits: [{ at: 0.45, dmg: 7, launch: 1000, knock: 90 }] },
    airKick:  { dur: 0.26, range: 80, style: 8,  shake: 3,  hitstop: 0.04, air: true,
                hits: [{ at: 0.40, dmg: 5, juggle: 400, knock: 70 }] },
    slam:     { dur: 0.52, range: 70, style: 22, shake: 13, hitstop: 0.11, air: true,
                hits: [{ at: 0.62, dmg: 16, slam: 1700, knock: 50 }] },
    special:  { dur: 1.70, range: 80, style: 60, shake: 10, hitstop: 0.05, air: true, special: true,
                hits: [
                  { at: 0.10, dmg: 6, juggle: 300, knock: 40 },
                  { at: 0.22, dmg: 6, juggle: 300, knock: 40 },
                  { at: 0.34, dmg: 6, juggle: 300, knock: 40 },
                  { at: 0.46, dmg: 6, juggle: 300, knock: 40 },
                  { at: 0.58, dmg: 6, juggle: 300, knock: 40 },
                  { at: 0.70, dmg: 6, juggle: 300, knock: 40 },
                  { at: 0.90, dmg: 24, launch: 1150, knock: 700, finisher: true },
                ] },
  },

  // Style rank, like a beat em up combo grade.
  style: {
    holdSeconds: 1.3,     // meter holds this long after your last move
    decayPerSec: 16,
    mistakePenalty: 14,
    repeatPenalty: 0.5,   // same move spammed
    varietyBonus: 1.4,    // a move you have not used in the last two
    ranks: [
      { at: 0,  name: "D" },
      { at: 20, name: "C" },
      { at: 38, name: "B" },
      { at: 58, name: "A" },
      { at: 78, name: "S" },
      { at: 92, name: "SS" },
    ],
  },

  comboTimeout: 2.4,      // seconds without a hit before the hit counter resets

  // The special: a hard gold word that unleashes a flurry.
  special: {
    chainRequired: 5,     // clean chunks in a row before it can appear
    cooldownSeconds: 12,  // minimum time between specials (also counted from the start)
  },

  prompt: {
    lookahead: 3,         // how many upcoming chunks are shown
    launcherEvery: [5, 7],
    heavyChance: 0.38,
    phraseChance: 0.5,    // chance a heavy chunk is a two word phrase
  },

  // Duel: two typists, speed is both attack and guard.
  //   power  = wpm * (1 + comboBonus * comboLevel)
  //   damage to B per second = damageScale * max(0, powerA - powerB)   (and the same the other way)
  //   blocked per second     = min(powerA, powerB)
  //   heal per second        = regenScale * blocked   (both players, capped at maxHp)
  duel: {
    maxHp: 100,
    damageScale: 0.35,      // HP per second for each wpm of difference. Was 0.5: fights ended in about 12 s, before any ultimate.
    regenScale: 0.04,       // HP per second for each wpm blocked
    rateWindow: 4,          // seconds of typing used to measure wpm
    wordsPerCombo: 5,       // clean words in a row per combo level
    maxComboLevel: 5,
    comboBonus: 0.10,       // +10% power per combo level
    tugRange: 40,           // wpm of difference that pushes the fighters all the way back
    countdown: 3,
    ultimate: {
      comboRequired: 2,     // combo level needed before the ultimate can be used (10 clean words in a row)
      chargePerWpmSec: 0.16,// charge (of 100) per second for each wpm: about 10 s at 60 wpm
      mistakeCharge: 6,     // charge lost per mistake
      damage: 30,           // unblockable damage for a clean ultimate word
      sloppyDamage: 12,     // damage if the ultimate word had a mistake
      stun: 2.0,            // seconds the victim's power is zero after a clean ultimate
    },
    // Counter: a mistake while your combo is 1 or higher gives the OTHER typist a short power boost.
    counter: { powerBonus: 0.20, duration: 1.0 }, // x1.20 power for 1.0 s; a new counter restarts the timer, never stacks
    anim: { jab: 0.18, heavy: 0.34, counterHitstop: 0.06, gap: 210, push: 110 }, // visual only: hit-stop, and the spacing of the two fighters (the 2D fighters are wider than the stickmen)
    // Bots: six levels, evenly spaced, each with a small personality. `beatAt` is the honest number on the
    // card: a player whose measured average (correct keystrokes only, like the result screen) is about this
    // many wpm, at 96% accuracy with the Bo staff, wins about half the time (tests/duel-sim.js calibrates it).
    //   wpm: the bot's raw key rate (it includes its typos)   accuracy: chance each key is right
    //   recovery: [pause, random extra] seconds after a typo, before it fixes it   drift: speed swing (0.15 = +-15%)
    //   char: the 2D fighter the bot plays as (a key of Chars.DEFS, cosmetic only; if it is yours, the next one)
    bots: [
      { name: "ROOKIE",    style: "Careful and slow",       beatAt: 30,  wpm: 31,   accuracy: 0.97, recovery: [0.30, 0.25], drift: 0.10, char: "bluex" },
      { name: "SCRAPPER",  style: "Sloppy brawler",         beatAt: 45,  wpm: 56.5, accuracy: 0.90, recovery: [0.10, 0.10], drift: 0.25, char: "grin" },
      { name: "TECHNICIAN",style: "Steady combo builder",   beatAt: 60,  wpm: 52,   accuracy: 0.99, recovery: [0.25, 0.15], drift: 0.05, char: "voss" },
      { name: "DUELIST",   style: "Balanced all-rounder",   beatAt: 75,  wpm: 82,   accuracy: 0.96, recovery: [0.18, 0.15], drift: 0.15, char: "ronin" },
      { name: "BERSERKER", style: "Fast, wild bursts",      beatAt: 90,  wpm: 117,  accuracy: 0.92, recovery: [0.08, 0.08], drift: 0.30, char: "reaver" },
      { name: "WARLORD",   style: "Heavy-hitting boss",     beatAt: 110, wpm: 112,  accuracy: 0.97, recovery: [0.18, 0.12], drift: 0.12, char: "varun" },
    ],
    // MATCH ME: aims at your average wpm over your last `history` matches (stored in localStorage), `start`
    // before you have any. It types like the calibration player (96%, Bo staff, the default recovery), with
    // its key rate set by Bot.rawWpmFor so its measured average lands on the target: an even fight.
    matchMe: { name: "MATCH ME", style: "Your last 3 matches", storageKey: "typeboxing.history", history: 3, start: 50,
      accuracy: 0.96, recovery: [0.18, 0.15], drift: 0.15, char: "veil" },
  },

  // One rule set for every typist. The weapon tiers (Light and Heavy) were removed: the only difficulty
  // choice is the bot's speed. The "medium" entry stays as the rule set every typist uses (common words,
  // hard ultimate words, the globals in CONFIG.duel), so duel-typing.js keeps one code path. Fighters are
  // cosmetic (CONFIG.chars) and never change a number.
  weapons: {
    defaultWeapon: "medium",
    botWeapon: "medium",
    list: [
      { id: "medium", tier: "STANDARD", name: "Standard", words: "common words", pool: "common", ultPool: "hard", power: 1.0 },
    ],
  },

  // The 2D fighters (js/anim-chars.js draws them, js/duel-chars.js animates them in the duel). Cosmetic only:
  // no rule reads them. Each typist keeps one identity color for the HUD, plate letters and sparks.
  chars: {
    storageKey: "typeboxing.char",
    defaultChar: "cyborg",
    you: { body: "#4ade80", letters: "#4ade80" },
    foe: { body: "#fb923c", letters: "#fdba74" },
  },

  // Full screen framing (visual only). The arena canvas fills the window; these are drawing units.
  // A standing stickman is about 161 units tall, so height 385 makes him about 42% of the screen.
  view: {
    height: 385,              // units from the top to the bottom of the window (Over-head view)
    floorFromBottom: 60,      // units of floor under the fighters
    classicHeight: 520,       // Classic view: a wider shot, with room for the typing box under the floor
    classicFloorFromBottom: 200,
    cameraSpeed: 4,           // how fast the camera follows the fighters and zooms
    bodyReach: 96,            // half a fighter's width (with its weapon) plus a margin, for the zoom
    maxZoom: 1.6,             // when the fighters fly apart the camera zooms out, at most this much
    uiSize: [1366, 768],      // the DOM UI is designed at this size and scaled to the window
    uiMinScale: 0.7, uiMaxScale: 2.5,
  },

  // Player settings, saved in localStorage. The view keeps its own key (wordPlate.storageKey).
  settings: {
    storageKey: "typeboxing.settings",
    defaults: { reduceMotion: false, shake: 1, damageNumbers: true, sound: true, volume: 0.7, wordSubmit: true },
    shakeSteps: [[0, "Off"], [0.5, "Low"], [1, "Normal"], [1.5, "Strong"]],
    volumeSteps: [[0.3, "Low"], [0.5, "Medium"], [0.7, "High"], [1, "Max"]],
  },

  // Word plates: each typist's current word floats over their own fighter.
  // Visual only, no rules. Sizes in canvas units (the canvas is 960 wide).
  wordPlate: {
    headTop: 160,           // height of a standing fighter's head above the floor
    headGap: 14,            // space between the head and the lowest plate
    rowGap: 6,              // space between the two plates when they are stacked
    minTop: 66,             // plates never go above this (the HP bars, clock and edge panel sit higher)
    margin: 12,             // keep plates this far from the arena edges
    font: 24,               // current word, bold monospace
    ultFont: 28,            // ultimate word
    nextFont: 15,           // next word, to the right
    padX: 12, padY: 8, radius: 4,   // radius: the one panel radius (THEME)
    follow: 8,              // how fast a plate eases toward its fighter (higher = snappier)
    caretSpeed: 30,         // how fast the caret slides to the next letter
    colors: {
      plate: "rgba(11, 17, 41, 0.92)", border: THEME.ui.line,
      untyped: "#c9d0ee", next: THEME.ui.dim, extra: "#a8323e", wrong: THEME.ui.danger, caret: THEME.ui.magenta, caretAlt: "#ffffff", // magenta = focus; white when your letters are close to magenta
      wrongMark: THEME.ui.danger, extraMark: "#a8323e", // the bar under a wrong or extra letter (a cue that is not only color)
      you: "#4ade80", bot: "#fdba74",   // fallbacks only: main.js always sets each fighter's letter color
      ultPlate: "rgba(46, 34, 8, 0.94)", ultBorder: THEME.ui.gold, ultGlow: "rgba(255, 197, 61, 0.55)", ultTag: THEME.ui.gold,
      ultUntyped: "#eadcb0", ultNext: "#a8862a",
    },
    popTime: 0.12,          // a correct letter pops in this long
    popScale: 1.25,
    wrongTime: 0.12,        // a wrong key flashes the letter and shakes the plate
    shake: 5,               // shake amplitude in px
    typoBar: 3,             // height of the red bar under a wrong or extra letter
    caretHueGap: 40,        // letters within this many degrees of the caret's hue get the white caret
    breakTime: 0.4,         // combo break: red border and a crack
    storageKey: "typeboxing.view",
  },

  // Floating text beside each fighter, in two lanes on the fighter's outer side. Visual only.
  // Heights are baselines above the floor; every lane stays under the word plates
  // (the lowest plate starts wordPlate.headTop + wordPlate.headGap = 182 above the floor).
  floatText: {
    statusSide: 66,         // status lane (COMBO, BROKEN, COUNTER, ULTIMATE, K.O.): this far out from the fighter
    statusSlots: [136, 96], // two slots, so at most 2 status texts per fighter; a new one replaces the oldest
    statusRise: 10,
    statusMaxSize: 24,      // K.O. may use koSize
    koSize: 34,
    numberSide: 100,        // number lane: further out, and lower than the status lane
    numberZ: 46,
    numberRise: 16,
    numberEvery: 0.5,       // one net HP number (damage and healing together) per half second
    numberLife: 0.6,
    numberSize: 22,
    bigNumberSize: 30,      // the net number right after an ultimate lands
    outline: "rgba(2, 4, 12, 0.92)", // dark outline under every floating text, so it reads over the scenery
    lose: THEME.ui.warn, gain: THEME.ui.phosphor,
    margin: 12,             // texts are nudged to stay this far inside the arena
  },
};
