/**
 * The game's numbers: every balance value, timing, size and color the core of the game reads.
 *
 * Tweak freely. Modes and the online layer keep their own sections next to their code (race-config.js,
 * arm-config.js, brawl-config.js, net-config.js) and add them to this object when they start, so removing a
 * mode removes its numbers too.
 */
CounterType.define("config", [], () => {
  "use strict";

  // ---------- Theme: Terminal Arcade (visual only, no rule reads it) ----------
  // The one palette. The CSS repeats THEME.ui as variables (themes.js also writes them onto :root at start, so this
  // file wins if the two ever drift). The renderer and the HUD take every color from here. Meanings: danger red =
  // typos and danger, gold = the ultimate only, each player's identity color everywhere for that player, magenta =
  // focus and the counter.
  const THEME = {
    resultKeyDelay: 700,
    font: '"Cascadia Mono", Consolas, "SF Mono", Menlo, "DejaVu Sans Mono", "Courier New", monospace',
    ui: {
      // CSS variables: --bg, --surface, ... (same names)
      bg: "#060a18", // page and arena sky top
      surface: "#0b1129", // panels, cards, typing box
      raised: "#121a3a", // selected card, word plate
      line: "#2a3a73", // the one border color (1 px)
      text: "#e8edff", // main text            15.9:1 on surface
      dim: "#8d9ac8", // labels and secondary  6.7:1 on surface
      phosphor: "#4dff9a", // logo, win, your lead, healthy HP  14.3:1
      magenta: "#ff3ea5", // focus, selection, counter          5.8:1
      gold: "#ffc53d", // the ultimate only                  11.8:1
      danger: "#ff4d5e", // typos, critical HP, stun, lose     5.8:1
      warn: "#ff8a3d", // low HP                             8.0:1
      info: "#7ce3ff", // combo text, blocked hits           12.7:1
      track: "#18224a", // empty bar tracks (not text)
    },
    arena: {
      // canvas scenery: darker and lower in contrast than fighters and plates
      skyTop: "#060a18",
      skyBottom: "#0d1736",
      glow: "rgba(77, 255, 154, 0.07)", // far screen glow on the horizon
      far: "#0b1430",
      farEdge: "#13204a",
      farWindow: "rgba(124, 227, 255, 0.10)",
      mid: "#0e1838",
      midEdge: "#1a2a5c",
      screen: "#0f2a2a",
      screenText: "rgba(77, 255, 154, 0.22)",
      floor: "#0a1128",
      floorLine: "#2a3a73",
      grid: "rgba(42, 58, 115, 0.55)",
      cable: "#141f45",
      scan: "rgba(0, 0, 0, 0.16)", // baked scanlines
      sweep: "rgba(124, 227, 255, 0.035)", // the slow scanline sweep
      leds: ["#4dff9a", "#ff3ea5", "#7ce3ff"],
      shadow: "rgba(0, 0, 0, 0.45)",
      flash: "255, 197, 61", // ultimate flash (gold), as r, g, b
    },
    fx: {
      // floating texts and sparks from duel.js
      combo: "#7ce3ff",
      broken: "#8d9ac8",
      counter: "#ff3ea5",
      ult: "#ffc53d",
      sloppy: "#8d9ac8",
      ko: "#ff4d5e",
      hit: "#ffffff",
      block: "#7ce3ff",
      ring: "#8d9ac8",
    },
  };

  // All balance numbers live here. Tweak freely.
  const CONFIG = {
    theme: THEME, // visual only, see above
    arena: { width: 3200, floorY: 410 },

    // Gravity for fighters thrown into the air by an ultimate.
    physics: { gravity: 2600 },

    // The fighters' strikes in a Duel: how long each one lasts (seconds) and when its hit lands (a fraction of the
    // move). A word of 6 letters or more is a heavy strike; the ultimate is the special.
    moves: {
      jab: { dur: 0.22, hits: [{ at: 0.35 }] },
      heavy: { dur: 0.46, hits: [{ at: 0.55 }] },
      special: { dur: 1.7 },
    },

    // Duel: two typists, power is both attack and guard. `basis` picks what power is made of:
    //   "speed" (the default): power = wpm x weapon power x (1 + comboStep x clean words in a row, up to comboCap),
    //     x (1 + counter.powerBonus) in a counter window. The faster typist deals relDamage x (speed gap / the faster
    //     speed, at least relFloor) HP per second, never more than maxDps. Each typist heals healPerWpm HP per second
    //     for each wpm typed; healing fades out between healFadeStart and healFadeEnd seconds of fight.
    //   "accuracy": power = keystroke accuracy in percent over the last `accuracy.keys` keys, with the same combo
    //     bonus and healing. The numbers in `accuracy` replace the same-named numbers here (duelTune() in typing.js).
    //   "wpm" (the oldest rule): power = wpm x (1 + comboBonus x combo level), damage = damageScale x the power gap
    //     per second, and both typists heal regenScale x min(power A, power B) per second.
    duel: {
      maxHp: 100,
      // "wpm" basis: HP per second for each wpm of difference (0.5 ended fights in about 12 s, before any ultimate).
      damageScale: 0.35,
      regenScale: 0.04, // "wpm" basis: HP per second for each wpm blocked
      rateWindow: 4, // seconds of typing used to measure wpm
      wordsPerCombo: 5, // clean words in a row per combo level
      maxComboLevel: 5,
      comboBonus: 0.1, // +10% power per combo level
      // A wrong key skips the word at once (no backspace fixing): the stream moves to the next word and the combo loses
      // `comboLoss` of a level (0.5 = half a level, 2.5 words at 5 words per level). `ultimateOnly: true` (the default)
      // applies this to the ULTIMATE word only; every other word keeps the old Monkeytype rule (the caret keeps going,
      // Backspace fixes it, any mistake resets the streak). `skipWord: false` turns the new rule off.
      typo: { skipWord: true, ultimateOnly: true, comboLoss: 0.5 },
      clashBand: 3, // power difference (wpm-like) under which a strike is a clash: nobody wins the exchange
      tugRange: 40, // wpm of difference that pushes the fighters all the way back
      // What power is made of: "speed", "accuracy" or "wpm" (see the top of this section). In the accuracy basis a few
      // virtual right keys (`accuracy.prior`) soften the first seconds, and a typist who stops typing for
      // `accuracy.idleAfter` seconds has no power at all (so nobody can stall); speed still fills the ultimate bar.
      basis: "speed",
      relDamage: 20, // speed basis: HP per second at a 100% speed gap (before the maxDps cap)
      relFloor: 30, // speed basis: the gap is measured against at least this speed, so two slow typists hurt less
      tugRel: 0.3, // speed basis: the edge rope is at full stretch at relDamage x tugRel HP per second (a 30% gap)
      // Hard cap on damage per second from the speed gap. Without it a typist facing an idle opponent dealt the full
      // relDamage x 100% (30 HP in the first second).
      maxDps: 8,
      healPerWpm: 0.02, // HP per second healed for each wpm you type (speed and accuracy bases)
      comboStep: 0.0025,
      comboCap: 200,
      mistakeFactor: 0.5, // a mistake multiplies the combo by this (0.5 halves it); once per word
      healFadeStart: 50,
      healFadeEnd: 110, // healing fades out between these duel seconds, so a stalemate always ends
      accuracy: {
        keys: 40,
        prior: 4,
        idleAfter: 3,
        damageScale: 1.2,
        tugRange: 12,
        clashBand: 1.5,
        counterBonus: 0.04,
      },
      countdown: 3,
      ultimate: {
        comboRequired: 2, // combo level needed before the ultimate can be used (10 clean words in a row)
        chargePerWpmSec: 0.16, // charge (of 100) per second for each wpm: about 10 s at 60 wpm
        mistakeCharge: 6, // charge lost per mistake
        damage: 30, // unblockable damage for a clean ultimate word
        sloppyDamage: 12, // damage if the ultimate word had a mistake
        stun: 2.0, // seconds the victim's power is zero after a clean ultimate
      },
      // Counter: a mistake that drops you a combo level (from level 1 or higher) gives the OTHER typist a short power
      // boost.
      // The victim also takes damagePerWord HP per combo word just lost (at most maxDamage), and the other typist gets
      // x1.10 power for 1.0 s. A new counter restarts the timer, it never stacks.
      counter: { powerBonus: 0.1, duration: 1.0, damagePerWord: 0.5, maxDamage: 15 },
      // Visual only: hit-stop, and the spacing of the two fighters (the 2D fighters are wider than the stickmen).
      anim: { jab: 0.18, heavy: 0.34, counterHitstop: 0.06, gap: 210, push: 110 },
      // Bots: seven levels, each a typing speed. `wpm` is the number on the card: the average wpm the bot really types
      // (right keys / 5 per minute, counted like your result screen). The Bot class turns it into a raw key rate
      // (Bot.rawWpmFor, because typos and the pause to fix them cost time). Every bot types about as accurately as a
      // decent typist, so the card is honest: type that fast, with about 95% accuracy, and you win about half the time
      // (tests/duel-sim.js calibrates it).
      //   accuracy: the chance each letter it types is right (small personality, 92 to 97%)
      //   recovery: [pause, random extra] seconds after a typo, before it fixes it   drift: speed swing (0.15 = +-15%)
      //   char: the 2D fighter the bot plays as (a key of Chars.DEFS, cosmetic only; if it is yours, the next one)
      bots: [
        {
          name: "TRAINEE",
          style: "Just learning",
          wpm: 15,
          accuracy: 0.95,
          recovery: [0.5, 0.4],
          drift: 0.1,
          char: "flame",
        },
        {
          name: "ROOKIE",
          style: "Careful and slow",
          wpm: 30,
          accuracy: 0.95,
          recovery: [0.3, 0.25],
          drift: 0.1,
          char: "bluex",
        },
        {
          name: "SCRAPPER",
          style: "Sloppy brawler",
          wpm: 45,
          accuracy: 0.95,
          recovery: [0.1, 0.1],
          drift: 0.25,
          char: "grin",
        },
        {
          name: "TECHNICIAN",
          style: "Steady combo builder",
          wpm: 60,
          accuracy: 0.95,
          recovery: [0.25, 0.15],
          drift: 0.05,
          char: "voss",
        },
        {
          name: "DUELIST",
          style: "Balanced all-rounder",
          wpm: 80,
          accuracy: 0.95,
          recovery: [0.18, 0.15],
          drift: 0.15,
          char: "ronin",
        },
        {
          name: "BERSERKER",
          style: "Fast, wild bursts",
          wpm: 100,
          accuracy: 0.95,
          recovery: [0.08, 0.08],
          drift: 0.3,
          char: "reaver",
        },
        {
          name: "WARLORD",
          style: "Heavy-hitting boss",
          wpm: 120,
          accuracy: 0.95,
          recovery: [0.18, 0.12],
          drift: 0.12,
          char: "varun",
        },
      ],
      // MATCH ME: aims at your average wpm over your last `history` matches (stored in localStorage), `start`
      // before you have any. It types with 95% accuracy and the default recovery, with its key rate set by
      // Bot.rawWpmFor so its measured average lands on the target: an even fight.
      matchMe: {
        name: "MATCH ME",
        style: "Your last 3 matches",
        storageKey: "typeboxing.history.wpm",
        history: 3,
        start: 60,
        wpm: 60,
        accuracy: 0.95,
        recovery: [0.18, 0.15],
        drift: 0.15,
        char: "veil",
      },
    },

    // One rule set for every typist. The weapon tiers (Light and Heavy) were removed: the only difficulty
    // choice is the bot's speed. The "medium" entry stays as the rule set every typist uses (common words,
    // hard ultimate words, the globals in CONFIG.duel), so duel-typing.js keeps one code path. Fighters are
    // cosmetic (CONFIG.chars) and never change a number.
    weapons: {
      defaultWeapon: "medium",
      botWeapon: "medium",
      list: [
        {
          id: "medium",
          tier: "STANDARD",
          name: "Standard",
          words: "common words",
          pool: "common",
          ultPool: "hard",
          power: 1.0,
        },
      ],
    },

    // The 2D fighters (characters.js draws them, fighter-stage.js animates them in a fight). Cosmetic only:
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
      height: 385, // units from the top to the bottom of the window (Over-head view)
      floorFromBottom: 60, // units of floor under the fighters
      classicHeight: 520, // Classic view: a wider shot, with room for the typing box under the floor
      classicFloorFromBottom: 200,
      cameraSpeed: 4, // how fast the camera follows the fighters and zooms
      bodyReach: 96, // half a fighter's width (with its weapon) plus a margin, for the zoom
      maxZoom: 1.6, // when the fighters fly apart the camera zooms out, at most this much
      uiSize: [1366, 768], // the DOM UI is designed at this size and scaled to the window
      uiMinScale: 0.7,
      uiMaxScale: 2.5,
    },

    // Match rules (match-rules.js). Rules for a match (offline bots and online): rounds, round timer, endless, word
    // submit mode.
    modes: {
      roundSteps: [1, 2, 3, 4, 5], // rounds in a match (default 1, max 5)
      timerSteps: [30, 45, 60, 120, 0], // round timer in seconds, 0 = no timer
      // Space ends a word: on for both, off (auto-end) for both, mix = each player's own setting.
      wordModes: ["on", "off", "mix"],
      roundGap: 2.4, // seconds between two rounds
      // Endless (offline): one bot, no timer. Every knock out starts the next round and the score keeps counting until
      // you quit. eHurt (a setting) turns HP loss off, so nobody can be knocked out and you just type.
      // Practice: a dummy you set up yourself. wpm 0 = a dummy that only stands there.
      practice: {
        storageKey: "typeboxing.practice",
        wpmSteps: [0, 15, 30, 45, 60, 80, 100, 120],
        accuracySteps: [80, 90, 95, 100],
        defaults: { wpm: 40, accuracy: 95, dummyHurt: false, youHurt: false },
      },
    },

    // Ranked play and matchmaking (ranked.js). Everything here runs on mocked data until the backend exists
    // (backend.js). One hidden skill rating per mode (Weng-Lin, Bradley-Terry), visible points (RP) and tiers.
    ranked: {
      modes: [
        ["duel", "Duel"],
        ["race", "Race"],
        ["arm", "Arm Wrestling"],
      ],
      mu: 25,
      sigma: 25 / 3,
      beta: 25 / 6,
      kappa: 0.0001,
      mmrBase: 1000,
      mmrScale: 40, // shown MMR = base + scale x (mu - 3 sigma)
      placements: 5,
      seasonPlacements: 3,
      rpPerDivision: 100,
      tiers: [
        // rp: where the tier starts; divisions III, II, I of rpPerDivision each
        { id: "bronze", name: "Bronze", rp: 0, color: "#c98a5a" },
        { id: "silver", name: "Silver", rp: 300, color: "#b8c2d9" },
        { id: "gold", name: "Gold", rp: 600, color: "#ffc53d" },
        { id: "platinum", name: "Platinum", rp: 900, color: "#7ce3ff" },
        { id: "diamond", name: "Diamond", rp: 1200, color: "#9aa8ff" },
        { id: "master", name: "Master", rp: 1500, color: "#ff3ea5" },
        { id: "grandmaster", name: "Grandmaster", rp: 1500, color: "#4dff9a", top: 500 },
      ],
      rpGain: { scale: 1.6, pull: 0.12, min: 8, max: 45 }, // RP change = MMR change x scale + pull toward the MMR's RP
      shieldMatches: 3, // no demotion out of a tier for this many matches after a promotion
      decay: { fromTier: "diamond", afterDays: 14, perWeek: 25 },
      seasonMonths: 3,
      softReset: 0.25, // a new season pulls mu 25% toward the start value
      queue: {
        startWindow: 50,
        widenBy: 25,
        widenEvery: 5,
        maxWindow: 400,
        acceptSec: 10,
        dodgeSec: 120,
        fallbackSec: 30,
        raceFillSec: 15,
        raceLateSec: 5,
      },
      regions: [
        ["sa", "South Asia"],
        ["sea", "Southeast Asia"],
        ["ea", "East Asia"],
        ["oc", "Oceania"],
        ["eu", "Europe"],
        ["mea", "Middle East and Africa"],
        ["na", "North America"],
        ["lat", "South America"],
      ],
      storageKey: "typeboxing.ranked", // the mock backend keeps your ratings and match list here
      profileKey: "typeboxing.profile", // your identity: id, name, tag, country, region
    },

    // Player settings, saved in localStorage. The view keeps its own key (wordPlate.storageKey). All of them are visual
    // or about input: none changes a rule. Themes, the background and custom CSS have their own keys (themes.js).
    settings: {
      storageKey: "typeboxing.settings",
      defaults: {
        mRounds: 1,
        mTimer: 120,
        mEndless: false,
        mWords: "mix",
        eHurt: true,
        mGame: "typing",
        hand: "right",
        side: "left",
        reduceMotion: false,
        shake: 1,
        damageNumbers: true,
        sound: true,
        volume: 0.7,
        wordSubmit: true,
        renderScale: 0,
        sceneryLevel: "full",
        uiScale: 1,
        hudOpacity: 0.9,
        showWpm: true,
        showPower: true,
        showEdge: true,
        fxSparks: true,
        fxSmears: true,
        fxAfterimages: true,
        fxDust: true,
        fxGlow: true,
        fxBudget: 400,
        scanlines: true,
        sweep: true,
        flash: true,
        hitstop: true,
        showFps: false,
        frameCap: 0,
      },
      shake: { min: 0, max: 2, step: 0.1 }, // screen shake intensity slider (0 = none, 1 = normal, 2 = double)
      hudOpacity: { min: 0.4, max: 1, step: 0.05 },
      volumeSteps: [
        [0.3, "Low"],
        [0.5, "Medium"],
        [0.7, "High"],
        [1, "Max"],
      ],
      renderScaleSteps: [
        [0.5, "50%"],
        [0.75, "75%"],
        [1, "100%"],
        [0, "Native"],
      ], // 0 = every pixel the display has
      scenerySteps: [
        ["full", "Full"],
        ["simple", "Simple"],
        ["off", "Off"],
      ],
      uiScaleSteps: [
        [0.85, "85%"],
        [1, "100%"],
        [1.15, "115%"],
        [1.3, "130%"],
      ],
      budgetSteps: [
        [100, "Low"],
        [200, "Medium"],
        [400, "High"],
        [800, "Max"],
      ],
      frameCapSteps: [
        [0, "None"],
        [60, "60"],
        [120, "120"],
        [144, "144"],
      ],
    },

    // Word plates: each typist's current word floats over their own fighter.
    // Visual only, no rules. Sizes in canvas units (the canvas is 960 wide).
    wordPlate: {
      headTop: 160, // height of a standing fighter's head above the floor
      headGap: 14, // space between the head and the lowest plate
      rowGap: 6, // space between the two plates when they are stacked
      minTop: 66, // plates never go above this (the HP bars, clock and edge panel sit higher)
      margin: 12, // keep plates this far from the arena edges
      font: 24, // current word, bold monospace
      ultFont: 28, // ultimate word
      nextFont: 15, // next word, to the right
      padX: 12,
      padY: 8,
      radius: 4, // radius: the one panel radius (THEME)
      follow: 8, // how fast a plate eases toward its fighter (higher = snappier)
      caretSpeed: 30, // how fast the caret slides to the next letter
      colors: {
        plate: "rgba(11, 17, 41, 0.92)",
        border: THEME.ui.line,
        untyped: "#c9d0ee",
        next: THEME.ui.dim,
        extra: "#a8323e",
        wrong: THEME.ui.danger,
        caret: THEME.ui.magenta,
        caretAlt: "#ffffff", // magenta = focus; white when your letters are close to magenta
        wrongMark: THEME.ui.danger,
        extraMark: "#a8323e", // the bar under a wrong or extra letter (a cue that is not only color)
        you: "#4ade80",
        bot: "#fdba74", // fallbacks only: duel-session.js always sets each fighter's letter color
        ultPlate: "rgba(46, 34, 8, 0.94)",
        ultBorder: THEME.ui.gold,
        ultGlow: "rgba(255, 197, 61, 0.55)",
        ultTag: THEME.ui.gold,
        ultUntyped: "#eadcb0",
        ultNext: "#a8862a",
      },
      popTime: 0.12, // a correct letter pops in this long
      popScale: 1.25,
      wrongTime: 0.12, // a wrong key flashes the letter and shakes the plate
      shake: 5, // shake amplitude in px
      typoBar: 3, // height of the red bar under a wrong or extra letter
      caretHueGap: 40, // letters within this many degrees of the caret's hue get the white caret
      breakTime: 0.4, // combo break: red border and a crack (a skipped word: the red border)
      skipTime: 0.7, // a skipped word floats up struck out for this long
      storageKey: "typeboxing.view",
    },

    // Floating text beside each fighter, in two lanes on the fighter's outer side. Visual only.
    // Heights are baselines above the floor; every lane stays under the word plates
    // (the lowest plate starts wordPlate.headTop + wordPlate.headGap = 182 above the floor).
    floatText: {
      statusSide: 66, // status lane (COMBO, BROKEN, COUNTER, ULTIMATE, K.O.): this far out from the fighter
      statusSlots: [136, 96], // two slots, so at most 2 status texts per fighter; a new one replaces the oldest
      statusRise: 10,
      statusMaxSize: 24, // K.O. may use koSize
      koSize: 34,
      numberSide: 100, // number lane: further out, and lower than the status lane
      numberZ: 46,
      numberRise: 16,
      numberEvery: 0.5, // one net HP number (damage and healing together) per half second
      numberLife: 0.6,
      numberSize: 22,
      bigNumberSize: 30, // the net number right after an ultimate lands
      outline: "rgba(2, 4, 12, 0.92)", // dark outline under every floating text, so it reads over the scenery
      lose: THEME.ui.warn,
      gain: THEME.ui.phosphor,
      margin: 12, // texts are nudged to stay this far inside the arena
    },
  };

  return CONFIG;
});
