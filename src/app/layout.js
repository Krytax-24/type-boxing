/**
 * Layout: the full screen frame of the game, phones and fullscreen.
 *
 * The DOM interface (#ui) is designed at CONFIG.view.uiSize (1366 x 768) and scaled to the window, anchored to the
 * edges, so every px value in the CSS is a design px. A narrow window (a phone held upright) lays the menus out in
 * one column about 440 design px wide. After every change of size, scale or view this module announces
 * "layout:resized" with the numbers; the arena sizes its canvas from them and screens size their previews.
 */
CounterType.define(
  "layout",
  ["config", "settings", "events", "actions", "dom", "toast"],
  (CONFIG, settings, events, actions, dom, toast) => {
    "use strict";

    const V = CONFIG.view;
    const NARROW_WIDTH = 700; // below this window width the menus take one column
    const NARROW_DESIGN_WIDTH = 440;
    const PHONE_SHORT_SIDE = 600;
    const HUD_SIDE_PANEL = 16 + 432 + 16; // design px the HUD's side panels cover, for the camera's clear area

    let uiScale = 1;
    let scaleKey = "";

    const query = () => new URLSearchParams(window.location.search);

    /** A touch screen (or ?touch). */
    function isTouch() {
      try {
        return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0 || query().has("touch");
      } catch (error) {
        return false;
      }
    }

    /** A phone: a touch screen whose short side is under 600 px (or ?phone). Phones play Backspace Brawl only. */
    function isPhone() {
      try {
        const short = Math.min(window.innerWidth, window.innerHeight);
        return (isTouch() || query().has("phone")) && short < PHONE_SHORT_SIDE;
      } catch (error) {
        return false;
      }
    }

    /** The canvas pixel ratio: the display's, capped by Graphics > Render scale. */
    function canvasRatio() {
      const native = dom.pixelRatio(3);
      const cap = settings.values.renderScale;
      return cap ? Math.min(native, cap) : native;
    }

    /** Recomputes the frame and announces it. */
    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const userScale = settings.values.uiScale;
      uiScale = Math.max(V.uiMinScale, Math.min(V.uiMaxScale, width / V.uiSize[0], height / V.uiSize[1])) * userScale;
      const narrow = width < NARROW_WIDTH;
      if (narrow) uiScale = Math.max(0.6, width / NARROW_DESIGN_WIDTH) * userScale;

      const ui = dom.byId("ui");
      ui.classList.toggle("narrow", narrow);
      ui.style.width = width / uiScale + "px";
      ui.style.height = height / uiScale + "px";
      ui.style.transform = `scale(${uiScale})`;

      // How much of the half width the HUD side panels leave clear (the camera zooms out to keep the fighters there).
      const clearHalf = Math.max(0.25, (width / 2 - HUD_SIDE_PANEL * uiScale) / (width / 2));
      events.emit("layout:resized", {
        width,
        height,
        ratio: canvasRatio(),
        uiScale,
        narrow,
        clearHalf,
        uprightPhone: isPhone() && height > width,
      });
    }

    /** Design px to screen px. */
    function scale() {
      return uiScale;
    }

    // ---------- Fullscreen: F on the menus, a button in the top bar, a setting ----------

    function isFullscreen() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }

    // The arena already fills the window, so the browser's own full screen key does the rest.
    function fullscreenRefused() {
      toast.show("The browser refused fullscreen here. Press F11 (or Ctrl+Cmd+F on a Mac) instead.");
    }

    function setFullscreen(on) {
      const el = document.documentElement;
      try {
        if (on && !isFullscreen()) {
          const request = el.requestFullscreen || el.webkitRequestFullscreen;
          if (!request) {
            fullscreenRefused();
            return;
          }
          const promise = request.call(el);
          if (promise && promise.catch) promise.catch(fullscreenRefused);
        } else if (!on && isFullscreen()) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        }
      } catch (error) {
        fullscreenRefused();
      }
    }

    function toggleFullscreen() {
      setFullscreen(!isFullscreen());
    }

    function onFullscreenChange() {
      // In fullscreen, ask to keep Esc for the game (Chrome: hold Esc to leave), so Esc can still pause.
      try {
        if (isFullscreen() && navigator.keyboard && navigator.keyboard.lock) {
          navigator.keyboard.lock(["Escape"]).catch(() => {});
        }
      } catch (error) {
        // not supported
      }
      document.querySelectorAll('[data-act="fullscreen"]').forEach((b) => b.classList.toggle("on", isFullscreen()));
      resize();
      events.emit("fullscreen:changed", isFullscreen());
    }

    window.addEventListener("resize", resize);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);

    // The frame follows the view (the Classic view uses a wider shot) and two Graphics settings.
    events.on("view:changed", resize);
    settings.watch((values) => {
      dom.byId("ui").classList.toggle("reduce-motion", values.reduceMotion);
      const key = values.renderScale + "|" + values.uiScale;
      if (key !== scaleKey) {
        scaleKey = key;
        resize();
      }
    });

    actions.on("fullscreen", () => toggleFullscreen());

    return Object.freeze({ resize, scale, isTouch, isPhone, isFullscreen, setFullscreen, toggleFullscreen });
  },
);
