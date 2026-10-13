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

  // Private-room online play. PeerJS only introduces the two browsers; match data goes peer to peer.
  net: {
    enabled: true,
    server: { host: null, port: null, path: null, secure: null },
    // Optional TURN REST endpoint. Example:
    // "https://YOUR_APP.metered.live/api/v1/turn/credentials?apiKey=YOUR_KEY"
    turnApiUrl: "https://typeboxing.metered.live/api/v1/turn/credentials?apiKey=a0b0207d3f018380e8e8000cf7a8c3d9b80e",
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.relay.metered.ca:80" },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "53a78e8c289530c70856ce95",
        credential: "75d8t/aIZUqn66Yu",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "53a78e8c289530c70856ce95",
        credential: "75d8t/aIZUqn66Yu",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "53a78e8c289530c70856ce95",
        credential: "75d8t/aIZUqn66Yu",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "53a78e8c289530c70856ce95",
        credential: "75d8t/aIZUqn66Yu",
      },
    ],
    roomCodeLength: 5,
    roomCodeAlphabet: "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
    peerIdPrefix: "typeboxing-",
    snapshotHz: 30,        // periodic snapshots per second (host to guest), on the real clock
    snapshotMinMs: 33,     // an early snapshot after a key is allowed once this many ms passed since the last one
    pingEverySec: 2,
    connectTimeoutSec: 12,
    reconnectGraceSec: 15,
    maxMessageBytes: 4096,
    maxKeysPerMessage: 64,
    keyBatchMs: 25,
    readyTimeoutSec: 60,
    gameVersion: "phase6-brawl",
  },

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
    // A wrong key skips the word at once (no backspace fixing): the stream moves to the next word and the combo
    // loses `comboLoss` of a level (0.5 = half a level, 2.5 words at 5 words per level). `ultimateOnly: true`
    // (the default) applies this to the ULTIMATE word only; every other word keeps the old Monkeytype rule (the
    // caret keeps going, Backspace fixes it, any mistake resets the streak). `skipWord: false` turns the new rule off.
    typo: { skipWord: true, ultimateOnly: true, comboLoss: 0.5 },
    clashBand: 3,           // power difference (wpm-like) under which a strike is a clash: nobody wins the exchange
    tugRange: 40,           // wpm of difference that pushes the fighters all the way back
    // What power is made of. "accuracy" (the default): power = your keystroke accuracy in percent over your last
    // `keys` keystrokes (a few virtual right keys, `prior`, soften the first seconds), times a small combo bonus:
    // every clean word in a row adds `comboStep` (0.0025 = +0.25%) up to `comboCap` words. Speed no longer
    // makes power, but a typist who stops typing for `idleAfter` seconds has none (so nobody can stall), and
    // speed still fills the ultimate bar. "wpm" brings back the old rule (power = wpm x combo level bonus). The
    // numbers in `accuracy` replace the same-named numbers above while the basis is "accuracy" (see duelTune()).
    basis: "speed",   // "speed" (default): power = your wpm. "accuracy": power = key accuracy. "wpm": the oldest rule (combo levels)
    relDamage: 20, relFloor: 30, tugRel: 0.3, // speed basis: damage per second = relDamage x (speed gap / the faster speed, at least relFloor), never more than maxDps; the edge rope is full at a tugRel (30%) gap
    maxDps: 8,        // hard cap on damage per second from the speed gap. Without it a typist facing an idle opponent dealt the full relDamage x 100% (30 HP in the first second)
    healPerWpm: 0.02, // HP per second healed for each wpm you type (speed and accuracy bases)
    comboStep: 0.0025,
    comboCap: 200,
    mistakeFactor: 0.5,     // a mistake multiplies the combo by this (0.5 halves it); once per word
    healFadeStart: 50, healFadeEnd: 110, // healing fades out between these duel seconds, so a stalemate always ends
    accuracy: { keys: 40, prior: 4, idleAfter: 3, damageScale: 1.2, tugRange: 12, clashBand: 1.5, counterBonus: 0.04 },
    countdown: 3,
    ultimate: {
      comboRequired: 2,     // combo level needed before the ultimate can be used (10 clean words in a row)
      chargePerWpmSec: 0.16,// charge (of 100) per second for each wpm: about 10 s at 60 wpm
      mistakeCharge: 6,     // charge lost per mistake
      damage: 30,           // unblockable damage for a clean ultimate word
      sloppyDamage: 12,     // damage if the ultimate word had a mistake
      stun: 2.0,            // seconds the victim's power is zero after a clean ultimate
    },
    // Counter: a mistake that drops you a combo level (from level 1 or higher) gives the OTHER typist a short power boost.
    counter: { powerBonus: 0.10, duration: 1.0, damagePerWord: 0.5, maxDamage: 15 }, // x1.20 power for 1.0 s; a new counter restarts the timer, never stacks
    anim: { jab: 0.18, heavy: 0.34, counterHitstop: 0.06, gap: 210, push: 110 }, // visual only: hit-stop, and the spacing of the two fighters (the 2D fighters are wider than the stickmen)
    // Bots: seven levels, each a typing speed. `wpm` is the number on the card: the average wpm the bot really types
    // (right keys / 5 per minute, counted like your result screen). The Bot class turns it into a raw key rate
    // (Bot.rawWpmFor, because typos and the pause to fix them cost time). Every bot types about as accurately as a
    // decent typist, so the card is honest: type that fast, with about 95% accuracy, and you win about half the time
    // (tests/duel-sim.js calibrates it).
    //   accuracy: the chance each letter it types is right (small personality, 92 to 97%)
    //   recovery: [pause, random extra] seconds after a typo, before it fixes it   drift: speed swing (0.15 = +-15%)
    //   char: the 2D fighter the bot plays as (a key of Chars.DEFS, cosmetic only; if it is yours, the next one)
    bots: [
      { name: "TRAINEE",    style: "Just learning",         wpm: 15,  accuracy: 0.95,   recovery: [0.50, 0.40], drift: 0.10, char: "flame" },
      { name: "ROOKIE",     style: "Careful and slow",      wpm: 30,  accuracy: 0.95,   recovery: [0.30, 0.25], drift: 0.10, char: "bluex" },
      { name: "SCRAPPER",   style: "Sloppy brawler",        wpm: 45,  accuracy: 0.95,   recovery: [0.10, 0.10], drift: 0.25, char: "grin" },
      { name: "TECHNICIAN", style: "Steady combo builder",  wpm: 60,  accuracy: 0.95,  recovery: [0.25, 0.15], drift: 0.05, char: "voss" },
      { name: "DUELIST",    style: "Balanced all-rounder",  wpm: 80,  accuracy: 0.95,   recovery: [0.18, 0.15], drift: 0.15, char: "ronin" },
      { name: "BERSERKER",  style: "Fast, wild bursts",     wpm: 100, accuracy: 0.95,   recovery: [0.08, 0.08], drift: 0.30, char: "reaver" },
      { name: "WARLORD",    style: "Heavy-hitting boss",    wpm: 120, accuracy: 0.95,   recovery: [0.18, 0.12], drift: 0.12, char: "varun" },
    ],
    // MATCH ME: aims at your average wpm over your last `history` matches (stored in localStorage), `start`
    // before you have any. It types with 95% accuracy and the default recovery, with its key rate set by
    // Bot.rawWpmFor so its measured average lands on the target: an even fight.
    matchMe: { name: "MATCH ME", style: "Your last 3 matches", storageKey: "typeboxing.history.wpm", history: 3, start: 60, wpm: 60,
      accuracy: 0.95, recovery: [0.18, 0.15], drift: 0.15, char: "veil" },
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

  // Player settings, saved in localStorage. The view keeps its own key (wordPlate.storageKey). All of them are
  // visual or about input: none changes a rule. Themes, the background and custom CSS have their own keys (js/themes.js).
  // Brawl: the fighting mode that needs no typing (js/brawl.js). Everything is counted in frames at 60 per second.
  // Moves: startup, active and recover are frames; dmg is HP; reach is how far in front of the body the hit reaches;
  // h is where it hits (high: a crouching fighter ducks it, mid: hits anyone on the ground, low: must be blocked crouching);
  // hitstun and blockstun are the frames the other fighter is stuck; knock is the push in units per second; meter is gained on a hit.
  brawl: {
    step: 1 / 60, countdown: 3, hp: 100,
    arena: { width: 1100, left: 90, right: 1010 }, floorY: 300, startX: [430, 670], halfW: 32,
    walk: 190, back: 150, jumpV: 600, gravity: 1700, downFrames: 62, wakeInvuln: 14, overFrames: 100,
    bufferFrames: 7, comboScale: [1, 1, 0.85, 0.7, 0.55, 0.4], meterMax: 100, superCost: 50,
    dash: { fwd: 430, back: 360, fwdFrames: 13, backFrames: 15, window: 12, backInv: 6 },   // double tap forward or back
    motionFrames: 20, superMotionFrames: 34,                                                   // how long a quarter circle (or two) may take
    // The four attack buttons: A high punch, S low punch, Z high kick, X low kick. clip: the fighter's own attack animation that plays;
    // spd: how fast it plays (frames come from the animation itself, so a heavy weapon is slower); rb: reach bonus; tier: a chain may only
    // go up (or stay) in tier; kind: p punch, k kick; h: where it hits (a low attack must be blocked crouching, a high one can be ducked).
    btn: {
      lp: { clip: "a1", spd: 1.3,  dmg: 4,  rk: 0.55, rb: 0,  hit: 13, blk: 8,  knock: 50,  meter: 5,  tier: 1, kind: "p", h: "low" },
      lk: { clip: "a3", spd: 1.2,  dmg: 6,  rk: 0.62, rb: 16, hit: 15, blk: 10, knock: 90,  meter: 6,  tier: 1, kind: "k", h: "low" },
      hp: { clip: "a2", spd: 1.1,  dmg: 8,  rk: 0.7,  rb: 4,  hit: 17, blk: 11, knock: 110, meter: 8,  tier: 2, kind: "p", h: "high" },
      hk: { clip: "a4", spd: 1.0,  dmg: 13, rk: 0.8,  rb: 16, hit: 0,  blk: 15, knock: 230, meter: 11, tier: 3, kind: "k", h: "mid", kd: true },
    },
    air: { clip: "air", spd: 1.2, dmg: [5, 7, 9], hit: 17, blk: 10, knock: 120, meter: 6, rk: 0.55, rb: 14 },        // a jumping attack by button strength
    fire: { clip: "a2", spd: 0.85, dmg: [6, 8, 10], speed: [210, 310, 430], hit: 22, blk: 14, knock: 120, chip: 2, minTotal: 36 }, // down, down forward, forward + punch
    dp: { clip: "air", spd: 1.15, dmg: [9, 11, 13], hit: 0, blk: 18, knock: 200, lift: 520, drift: 90, inv: 8, active: 12, reach: 80, lag: 18 }, // forward, down, down forward + punch
    sup: { clip: "a4", spd: 1.0, dmg: 26, speed: 500, hit: 0, blk: 20, knock: 260, chip: 5, minTotal: 40 },            // down, down forward, forward twice + punch (costs superCost)
    throwMove: { clip: "a2", spd: 1.0, dmg: 10, reach: 64, startup: 5, total: 26, knock: 200 },                           // light punch + light kick together, close
    // What makes each fighter different on top of its own animations. fire (Q) and dp (R) override numbers of the shared moves.
    // combos: button strings. Land a hit, then chain the next buttons in order and the last press becomes the finisher: a stronger
    // move with its own animation clip (spd: clip speed, dmg, kd: knocks down, rb: reach bonus, knock: push). Q and R together are the super.
    style: {
      cyborg:    { fire: { dmg: [6, 9, 12], speed: [240, 340, 460] }, dp: { dmg: [10, 12, 14] },
        combos: [{ seq: "lp,hp,hk", name: "Vanguard Cut", clip: "a4", spd: 1.1, dmg: 16, kd: true, rb: 20 }, { seq: "lk,lp,hp", name: "Arc Chain", clip: "a3", spd: 1.2, dmg: 12, rb: 10 }, { seq: "hp,hp,lk", name: "Hilt Break", clip: "a2", spd: 0.9, dmg: 14, kd: true, rb: 6 }] },
      bluex:     { fire: { dmg: [5, 7, 9], speed: [200, 290, 400] }, dp: { dmg: [11, 13, 15], lift: 560 },
        combos: [{ seq: "lp,lp,hk", name: "Grand Slam", clip: "a4", spd: 1.0, dmg: 18, kd: true, rb: 24 }, { seq: "lk,hp,hp", name: "Double Play", clip: "a3", spd: 1.1, dmg: 13, rb: 14 }, { seq: "hp,lk,hk", name: "Steal Home", clip: "a2", spd: 1.0, dmg: 15, kd: true, rb: 10 }] },
      voss:      { fire: { dmg: [5, 7, 9], speed: [260, 360, 470] }, dp: { dmg: [9, 11, 13], reach: 95 },
        combos: [{ seq: "lp,lp,hp", name: "Pole Flurry", clip: "a2", spd: 1.2, dmg: 12, rb: 24 }, { seq: "lk,hp,hk", name: "Sweep Vault", clip: "a4", spd: 1.0, dmg: 17, kd: true, rb: 30 }, { seq: "hp,hk,lk", name: "Ribbon Crush", clip: "a3", spd: 1.0, dmg: 15, kd: true, rb: 20 }] },
      barbarian: { fire: { dmg: [7, 10, 13], speed: [190, 270, 360] }, dp: { dmg: [12, 14, 16] },
        combos: [{ seq: "hp,hp,hk", name: "Glacier Fall", clip: "a4", spd: 0.95, dmg: 20, kd: true, rb: 18 }, { seq: "lp,lk,hp", name: "Frost Rend", clip: "a3", spd: 1.05, dmg: 14, rb: 12 }, { seq: "lk,lk,hk", name: "Avalanche", clip: "a4", spd: 1.0, dmg: 17, kd: true, rb: 14 }] },
      flame:     { fire: { dmg: [7, 9, 12], speed: [230, 330, 450] }, dp: { dmg: [10, 12, 14], lift: 540 },
        combos: [{ seq: "lp,lp,lp", name: "Orb Barrage", clip: "a2", spd: 1.0, dmg: 14, rb: 40 }, { seq: "hp,lk,hp", name: "Comet Drop", clip: "a4", spd: 1.0, dmg: 17, kd: true, rb: 30 }, { seq: "lk,hp,hk", name: "Pillar Burst", clip: "a3", spd: 1.0, dmg: 16, kd: true, rb: 26 }] },
      dancer:    { fire: { dmg: [5, 7, 9], speed: [220, 310, 420] }, dp: { dmg: [9, 11, 13], inv: 12 },
        combos: [{ seq: "lp,hp,lp", name: "Four Palms", clip: "a1", spd: 1.0, dmg: 14, rb: 14 }, { seq: "lk,lk,hk", name: "Crane Fall", clip: "a4", spd: 1.0, dmg: 15, kd: true, rb: 10 }, { seq: "hp,hp,hk", name: "Lotus Whirl", clip: "a2", spd: 1.0, dmg: 16, kd: true, rb: 12 }] },
      veil:      { fire: { dmg: [5, 8, 10], speed: [260, 360, 480] }, dp: { dmg: [9, 11, 13], reach: 90 },
        combos: [{ seq: "lp,hp,hp", name: "Twin Lash", clip: "a3", spd: 1.1, dmg: 14, rb: 24 }, { seq: "lk,lp,hk", name: "Rope Whirl", clip: "a4", spd: 1.0, dmg: 18, kd: true, rb: 28 }, { seq: "hp,lk,lp", name: "Dagger Snap", clip: "a3", spd: 1.2, dmg: 12, rb: 18 }] },
      ronin:     { fire: { dmg: [6, 8, 11], speed: [250, 350, 470] }, dp: { dmg: [10, 12, 14] },
        combos: [{ seq: "lp,lp,hk", name: "Iaido", clip: "a4", spd: 1.15, dmg: 17, kd: true, rb: 22 }, { seq: "hp,lp,hp", name: "Shadow Step", clip: "a2", spd: 1.15, dmg: 13, rb: 12 }, { seq: "lk,hp,hk", name: "Moon Arc", clip: "a4", spd: 1.0, dmg: 16, kd: true, rb: 18 }] },
      reaver:    { fire: { dmg: [7, 9, 12], speed: [200, 280, 380] }, dp: { dmg: [11, 13, 15] },
        combos: [{ seq: "hp,hp,hk", name: "Blood Cleave", clip: "a4", spd: 1.0, dmg: 19, kd: true, rb: 16 }, { seq: "lp,hp,lk", name: "Red Spin", clip: "a3", spd: 1.05, dmg: 14, rb: 14 }, { seq: "lk,lp,hk", name: "Scarlet Rush", clip: "a4", spd: 1.1, dmg: 15, kd: true, rb: 12 }] },
      varun:     { fire: { dmg: [8, 11, 14], speed: [180, 250, 340] }, dp: { dmg: [13, 15, 17] },
        combos: [{ seq: "hp,lk,hk", name: "Hammerfall", clip: "a4", spd: 0.95, dmg: 21, kd: true, rb: 16 }, { seq: "lp,hp,hp", name: "Skull Knock", clip: "a3", spd: 1.0, dmg: 15, rb: 10 }, { seq: "hp,hp,lp", name: "Quake Swing", clip: "a2", spd: 0.95, dmg: 15, kd: true, rb: 12 }] },
      grin:      { fire: { dmg: [4, 6, 8], speed: [320, 440, 560] }, dp: { dmg: [8, 10, 12] },
        combos: [{ seq: "lp,lp,lp", name: "Rapid Fire", clip: "a1", spd: 1.3, dmg: 11, rb: 50 }, { seq: "lk,hp,lp", name: "Quick Draw", clip: "a2", spd: 1.2, dmg: 12, rb: 44 }, { seq: "hp,lk,hk", name: "Trick Shot", clip: "a4", spd: 1.1, dmg: 15, kd: true, rb: 38 }] },
    },
    // Frame facts of every fighter's own animations: [duration in seconds, impact (fraction of the clip), impacts, cancel (fraction)].
    // They are read from js/anim-clips.js (npm run: see tests/brawl-sim.js, which checks they still match). tempo: the fighter's animation speed factor.
    chars: {
      cyborg: { name: "IRON VANGUARD", reach: 150, tempo: 1.02, trail: "255, 160, 80", a1: [0.42, 0.46, 1, 0.51], a2: [0.44, 0.46, 1, 0.51], a3: [0.54, 0.5, 1, 0.55], a4: [0.55, 0.48, 1, 0.53], air: [0.44, 0.48, 1, 0.53] },
      bluex: { name: "BLUE X", reach: 150, tempo: 1, trail: "120, 170, 255", a1: [0.42, 0.46, 1, 0.51], a2: [0.46, 0.5, 1, 0.55], a3: [0.66, 0.5, 1, 0.55], a4: [0.7, 0.58, 1, 0.63], air: [0.44, 0.48, 1, 0.53] },
      voss: { name: "COMMANDER VOSS", reach: 200, tempo: 0.92, trail: "130, 175, 255", a1: [0.42, 0.44, 1, 0.49], a2: [0.5, 0.48, 1, 0.53], a3: [0.74, 0.68, 1, 0.73], a4: [0.76, 0.44, 1, 0.49], air: [0.5, 0.58, 1, 0.63] },
      barbarian: { name: "FROSTJAW", reach: 175, tempo: 1.12, trail: "140, 215, 255", a1: [0.6, 0.54, 1, 0.59], a2: [0.6, 0.54, 1, 0.59], a3: [0.86, 0.6, 1, 0.65], a4: [0.96, 0.62, 1, 0.67], air: [0.5, 0.52, 1, 0.57] },
      flame: { name: "NOVA", reach: 190, tempo: 0.88, trail: "110, 160, 255", a1: [0.42, 0.4, 1, 0.45], a2: [0.7, 0.4, 1, 0.45], a3: [0.8, 0.54, 1, 0.59], a4: [0.96, 0.6, 1, 0.65], air: [0.5, 0.32, 1, 0.37] },
      dancer: { name: "SUVARNA", reach: 110, tempo: 0.85, trail: "255, 200, 90", a1: [0.82, 0.22, 4, 0.75], a2: [0.64, 0.44, 2, 0.79], a3: [0.62, 0.46, 1, 0.51], a4: [0.82, 0.56, 1, 0.61], air: [0.46, 0.32, 1, 0.37] },
      veil: { name: "CRIMSON VEIL", reach: 150, tempo: 0.9, trail: "230, 60, 80", a1: [0.44, 0.36, 1, 0.41], a2: [0.44, 0.36, 1, 0.41], a3: [0.7, 0.3, 2, 0.63], a4: [0.8, 0.42, 2, 0.81], air: [0.48, 0.3, 1, 0.35] },
      ronin: { name: "RONIN UNIT", reach: 150, tempo: 0.96, trail: "255, 150, 70", a1: [0.42, 0.46, 1, 0.51], a2: [0.44, 0.46, 1, 0.51], a3: [0.54, 0.5, 1, 0.55], a4: [0.55, 0.48, 1, 0.53], air: [0.44, 0.48, 1, 0.53] },
      reaver: { name: "SCARLET REAVER", reach: 175, tempo: 1, trail: "255, 90, 60", a1: [0.6, 0.54, 1, 0.59], a2: [0.6, 0.54, 1, 0.59], a3: [0.86, 0.6, 1, 0.65], a4: [0.96, 0.62, 1, 0.67], air: [0.5, 0.52, 1, 0.57] },
      varun: { name: "VARUN BLOODMANE", reach: 175, tempo: 1.1, trail: "255, 210, 120", a1: [0.6, 0.54, 1, 0.59], a2: [0.6, 0.54, 1, 0.59], a3: [0.86, 0.6, 1, 0.65], a4: [0.96, 0.62, 1, 0.67], air: [0.5, 0.52, 1, 0.57] },
      grin: { name: "GRIN", reach: 95, tempo: 0.96, trail: "255, 200, 60", a1: [0.3, 0.42, 1, 0.47], a2: [0.38, 0.44, 1, 0.49], a3: [0.46, 0.5, 1, 0.55], a4: [0.62, 0.44, 1, 0.49], air: [0.46, 0.32, 1, 0.37] },
    },
    // Offline opponents. think: frames between decisions (lower is sharper), block/aggr/jump/fire/chain: chances.
    bots: [
      { name: "ROOKIE",   char: "bluex",   style: "Slow, blocks a little",     think: 28, block: 0.20, aggr: 0.35, jump: 0.04, fire: 0.05, chain: 0.10, low: 0 },
      { name: "FIGHTER",  char: "ronin",   style: "Mixes high and low",        think: 16, block: 0.50, aggr: 0.55, jump: 0.10, fire: 0.14, chain: 0.45, low: 0.25 },
      { name: "CHAMPION", char: "reaver",  style: "Fast, blocks, chains",      think: 9,  block: 0.80, aggr: 0.75, jump: 0.14, fire: 0.24, chain: 0.80, low: 0.40 },
    ],
    defaultBot: 1,
    storageKey: "typeboxing.brawl",
    touchOpacity: 0.55,
  },

  // Game modes (js/modes.js). Rules for a match (offline bots and online): rounds, round timer, endless, word submit mode.
  modes: {
    roundSteps: [1, 2, 3, 4, 5],                 // rounds in a match (default 1, max 5)
    timerSteps: [30, 45, 60, 120, 0],            // round timer in seconds, 0 = no timer
    wordModes: ["on", "off", "mix"],             // Space ends a word: on for both, off (auto-end) for both, mix = each player's own setting
    roundGap: 2.4,                               // seconds between two rounds
    // Endless (offline): one bot, no timer. Every knock out starts the next round and the score keeps counting until you quit.
    // eHurt (a setting) turns HP loss off, so nobody can be knocked out and you just type.
    // Practice: a dummy you set up yourself. wpm 0 = a dummy that only stands there.
    practice: { storageKey: "typeboxing.practice", wpmSteps: [0, 15, 30, 45, 60, 80, 100, 120], accuracySteps: [80, 90, 95, 100],
      defaults: { wpm: 40, accuracy: 95, dummyHurt: false, youHurt: false } },
  },

  settings: {
    storageKey: "typeboxing.settings",
    defaults: {
      mRounds: 1, mTimer: 120, mEndless: false, mWords: "mix", eHurt: true, mGame: "typing", hand: "right", side: "left",
      reduceMotion: false, shake: 1, damageNumbers: true, sound: true, volume: 0.7, wordSubmit: true,
      renderScale: 0, sceneryLevel: "full", uiScale: 1, hudOpacity: 0.9,
      showWpm: true, showPower: true, showEdge: true,
      fxSparks: true, fxSmears: true, fxAfterimages: true, fxDust: true, fxGlow: true, fxBudget: 400,
      scanlines: true, sweep: true, flash: true, hitstop: true,
      showFps: false, frameCap: 0,
    },
    shake: { min: 0, max: 2, step: 0.1 },               // screen shake intensity slider (0 = none, 1 = normal, 2 = double)
    hudOpacity: { min: 0.4, max: 1, step: 0.05 },
    volumeSteps: [[0.3, "Low"], [0.5, "Medium"], [0.7, "High"], [1, "Max"]],
    renderScaleSteps: [[0.5, "50%"], [0.75, "75%"], [1, "100%"], [0, "Native"]], // 0 = every pixel the display has
    scenerySteps: [["full", "Full"], ["simple", "Simple"], ["off", "Off"]],
    uiScaleSteps: [[0.85, "85%"], [1, "100%"], [1.15, "115%"], [1.3, "130%"]],
    budgetSteps: [[100, "Low"], [200, "Medium"], [400, "High"], [800, "Max"]],
    frameCapSteps: [[0, "None"], [60, "60"], [120, "120"], [144, "144"]],
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
    breakTime: 0.4,         // combo break: red border and a crack (a skipped word: the red border)
    skipTime: 0.7,          // a skipped word floats up struck out for this long
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
