/**
 * Settings tabs "Game" and "Graphics": data driven rows for the settings window (settings-modal.js).
 *
 * A row is one of:
 *   { id, label, hint, opts: [[value, label], ...], get(), set(value) }      a set of choices
 *   { id, type: "range", label, hint, min, max, step, get(), set(), fmt() } a slider
 *   { type: "button", label, hint, button, run() }                          a button
 *   { type: "head", label } a heading, { type: "note", html } a note
 * `hint` may be a function (for hints that follow another setting). Every row here is visual or about input; none
 * changes a rule. Match rules are not personal settings: they live where they apply (the mode menus, the room).
 */
CounterType.define(
  "settings-tabs",
  ["config", "registry", "settings", "layout", "arena", "audio", "format"],
  (CONFIG, registry, settings, layout, arena, Sfx, format) => {
    "use strict";

    const SET = CONFIG.settings;
    const values = settings.values;
    const ON_OFF = [
      [true, "On"],
      [false, "Off"],
    ];
    const OFF_ON = [
      [false, "Off"],
      [true, "On"],
    ];
    const SHAKE_TEST = 18;

    /** A plain on/off row bound to one setting. */
    const toggleRow = (id, label, hint) => ({
      id,
      label,
      hint,
      opts: ON_OFF,
      get: () => values[id],
      set: (v) => settings.set(id, v),
    });

    /** A row of choices bound to one setting. */
    const choiceRow = (id, label, hint, opts) => ({
      id,
      label,
      hint,
      opts,
      get: () => values[id],
      set: (v) => settings.set(id, v),
    });

    /** A slider bound to one setting. */
    const rangeRow = (id, label, hint, limits) => ({
      id,
      type: "range",
      label,
      hint,
      min: limits.min,
      max: limits.max,
      step: limits.step,
      get: () => values[id],
      set: (v) => settings.set(id, v),
      fmt: format.percent,
    });

    // Graphics quality presets: one row that sets every effect and speed switch at once (the rows below stay for
    // fine tuning, and the row then reads Custom).
    const QUALITY = {
      low: {
        renderScale: 0.75,
        sceneryLevel: "simple",
        fxSparks: true,
        fxSmears: false,
        fxAfterimages: false,
        fxDust: false,
        fxGlow: false,
        fxBudget: 100,
        sweep: false,
      },
      medium: {
        renderScale: 1,
        sceneryLevel: "full",
        fxSparks: true,
        fxSmears: true,
        fxAfterimages: false,
        fxDust: true,
        fxGlow: true,
        fxBudget: 200,
        sweep: true,
      },
      high: {
        renderScale: 0,
        sceneryLevel: "full",
        fxSparks: true,
        fxSmears: true,
        fxAfterimages: true,
        fxDust: true,
        fxGlow: true,
        fxBudget: 400,
        sweep: true,
      },
    };
    const qualityNow = () =>
      Object.keys(QUALITY).find((q) => Object.entries(QUALITY[q]).every(([k, v]) => values[k] === v)) || "custom";

    registry.add("settings-tab", {
      id: "game",
      name: "Game",
      order: 10,
      rows: [
        { type: "head", label: "Typing" },
        {
          id: "view",
          label: "Where words appear",
          hint: "Duel only. Over-head: the word floats above each fighter. Classic: a typing box at the bottom.",
          opts: [
            ["overhead", "Over-head"],
            ["classic", "Classic"],
          ],
          get: () => settings.getView(),
          set: (v) => settings.setView(v),
        },
        toggleRow(
          "wordSubmit",
          "Word submit",
          "On: press Space after each word. Off: a word ends by itself when it is exactly right (Duel and Arm Wrestling; a race always needs Space). Ranked pairs you with players who use the same choice.",
        ),
        toggleRow("damageNumbers", "Damage numbers", "Duel: show the HP gained or lost next to each fighter."),
        { type: "head", label: "Fights" },
        choiceRow(
          "side",
          "Starting side",
          "Against a bot, in Duels and Backspace Brawl: stand on the left (like player 1) or the right (like player 2). Online, the host is on the left.",
          [
            ["left", "Left"],
            ["right", "Right"],
          ],
        ),
        choiceRow(
          "hand",
          "Playing hand",
          "Backspace Brawl. Right hand: arrow keys move, A S Z X attack. Left hand: W A S D move, ; L / . attack. The touch buttons swap sides too.",
          [
            ["right", "Right"],
            ["left", "Left"],
          ],
        ),
        { type: "head", label: "Sound" },
        toggleRow("sound", "Sound effects", "Hits, typing clicks, combos, the countdown and the finish."),
        {
          id: "volume",
          label: "Volume",
          hint: "How loud the sound effects play.",
          opts: SET.volumeSteps,
          get: () => values.volume,
          set: (v) => {
            settings.set("volume", v);
            Sfx.unlock();
          },
        },
      ],
    });

    registry.add("settings-tab", {
      id: "graphics",
      name: "Graphics",
      order: 20,
      rows: [
        {
          id: "quality",
          label: "Graphics quality",
          hint: "Sets every switch below at once. Low is for weak laptops; change any row after to fine tune (it then shows Custom).",
          opts: [
            ["low", "Low"],
            ["medium", "Medium"],
            ["high", "High"],
          ],
          get: qualityNow,
          set: (v) => settings.assign(QUALITY[v]),
        },
        { type: "head", label: "Speed" },
        choiceRow(
          "renderScale",
          "Render scale",
          "Lower is faster on a weak laptop. 100% is one canvas pixel per screen pixel; Native uses every pixel your display has.",
          SET.renderScaleSteps,
        ),
        choiceRow(
          "sceneryLevel",
          "Background scenery",
          "Full: skyline, desks and arcade cabinets. Simple: sky and floor. Off: a flat color or your own image.",
          SET.scenerySteps,
        ),
        choiceRow(
          "frameCap",
          "Frame rate limit",
          "Stops the game from drawing faster than this, which saves battery. None follows your screen.",
          SET.frameCapSteps,
        ),
        toggleRow(
          "showFps",
          "Show FPS",
          "A small counter in the top right corner with frames per second and the time each frame takes.",
        ),
        { type: "head", label: "Effects" },
        toggleRow("fxSparks", "Sparks and flames", "Hit sparks, flashes, fire and ice chips."),
        toggleRow("fxSmears", "Weapon trails", "The streak behind a swinging weapon."),
        toggleRow("fxAfterimages", "Afterimages", "The ghost copies behind a fast fighter."),
        toggleRow("fxDust", "Dust and rings", "Dust from steps and landings, and the rings on the floor."),
        toggleRow("fxGlow", "Fighter glow", "The soft halo in each player's color."),
        choiceRow("fxBudget", "Effect limit", "The most effect particles on screen at once.", SET.budgetSteps),
        { type: "head", label: "Screen" },
        choiceRow(
          "reduceMotion",
          "Reduce motion",
          "One switch that turns off shake, flashes, hit-stop and animations.",
          OFF_ON,
        ),
        Object.assign(rangeRow("shake", "Screen shake", "", SET.shake), {
          hint: () =>
            values.reduceMotion
              ? "Off while Reduce motion is on."
              : "How hard the screen shakes on big hits. 0% is none, 100% is normal.",
        }),
        {
          type: "button",
          label: "Try the shake",
          hint: "Shakes the screen once at the strength above.",
          button: "Shake now",
          run: () => arena.renderer.kick(SHAKE_TEST),
        },
        toggleRow("flash", "Ultimate flash", "The bright flash when an ultimate lands."),
        toggleRow("hitstop", "Hit-stop", "A tiny freeze on big hits. It only pauses the pictures, never the typing."),
        toggleRow("scanlines", "Scanlines", "The fine horizontal lines over the scenery and menus."),
        toggleRow("sweep", "Light sweep", "The slow band of light that slides down the background."),
        {
          id: "fullscreen",
          label: "Fullscreen",
          hint: "Also the F key on the menus and the button in the top bar.",
          opts: OFF_ON,
          get: () => layout.isFullscreen(),
          set: (v) => layout.setFullscreen(v),
        },
        { type: "head", label: "Fight display" },
        choiceRow("uiScale", "Interface size", "Makes the HUD and menus bigger or smaller.", SET.uiScaleSteps),
        rangeRow(
          "hudOpacity",
          "HUD panel opacity",
          "Lower lets you see more of the arena through the panels.",
          SET.hudOpacity,
        ),
        toggleRow("showWpm", "Show WPM", "Your speed and the opponent's, in the bottom corners."),
        toggleRow(
          "showPower",
          "Show power",
          "Power is your typing speed plus a small bonus for every clean word in a row.",
        ),
        toggleRow("showEdge", "Show the edge bar", "The tug of war at the top that shows who is winning the exchange."),
      ],
    });

    return Object.freeze({ QUALITY, qualityNow });
  },
);
