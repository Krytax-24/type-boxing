/**
 * Arena: the full window canvas and the one Renderer every mode draws with.
 *
 * It keeps the renderer in step with the window (layout.js), the Duel's word view, the player's graphics settings
 * and the theme. Modes take `arena.renderer` and draw their world each frame; none of them sizes the canvas.
 */
CounterType.define(
  "arena",
  ["config", "renderer", "fighter-stage", "settings", "themes", "events", "dom"],
  (CONFIG, Renderer, DuelChars, settings, Themes, events, dom) => {
    "use strict";

    const V = CONFIG.view;
    const UPRIGHT_PHONE_LIFT = 60; // units: an upright phone lifts the floor clear of the touch controls

    const canvas = dom.byId("arena");
    const renderer = new Renderer(canvas);
    let frame = null;

    function overhead() {
      return settings.getView() === "overhead";
    }

    // The canvas backing store is the window times the pixel ratio, so it stays sharp. The view is a fixed number
    // of drawing units tall, so the fighters fill the same share of the screen at any aspect ratio; a wider window
    // simply shows more of the arena's sides.
    function fit() {
      if (!frame) return;
      const { width, height, ratio } = frame;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      renderer.res = canvas.height / (overhead() ? V.height : V.classicHeight);
      renderer.floorFromBottom = overhead() ? V.floorFromBottom : V.classicFloorFromBottom;
      if (frame.uprightPhone) renderer.floorFromBottom += UPRIGHT_PHONE_LIFT;
      renderer.clearHalf = frame.clearHalf;
    }

    events.on("layout:resized", (next) => {
      frame = next;
      fit();
    });

    events.on("view:changed", () => {
      renderer.wordPlates = overhead();
    });
    renderer.wordPlates = overhead();

    // Graphics settings: visual only, never a rule.
    settings.watch((v) => {
      const still = v.reduceMotion;
      renderer.shakeScale = still ? 0 : v.shake;
      renderer.noFlash = still || !v.flash;
      renderer.reduceMotion = still;
      renderer.damageNumbers = v.damageNumbers;
      renderer.sceneryLevel = v.sceneryLevel;
      renderer.scanlines = v.scanlines;
      renderer.sweep = v.sweep;
      DuelChars.setFx({
        sparks: v.fxSparks,
        smears: v.fxSmears,
        afterimages: v.fxAfterimages,
        dust: v.fxDust,
        glow: v.fxGlow,
        budget: v.fxBudget,
      });
    });

    // A new theme or background image: the scenery layers are rebuilt in the new colors on the next frame.
    Themes.onChange(() => {
      renderer.layers = null;
      renderer.setBackground(Themes.bgImage, Themes.bg, Themes.bgVersion);
    });

    /** The canvas size in design units of the DOM interface (what the mode screens lay out against). */
    function designSize(uiScale) {
      return { width: window.innerWidth / uiScale, height: window.innerHeight / uiScale };
    }

    return Object.freeze({ canvas, renderer, designSize });
  },
);
