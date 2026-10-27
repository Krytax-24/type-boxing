/**
 * Theme tokens: the CSS variables that follow the theme and the player's settings, on :root.
 *
 *   --font     the one monospace family (CONFIG.theme.font)
 *   --hud-bg   the HUD panels' background, at the player's HUD opacity
 *   --scan     the scanline stripes on the menus (Graphics > Scanlines; off with reduce motion)
 * The palette itself (--bg, --surface, ...) is written by themes.js.
 */
CounterType.define("theme-tokens", ["config", "themes", "settings", "toast"], (CONFIG, Themes, settings, toast) => {
  "use strict";

  const root = document.documentElement.style;
  root.setProperty("--font", CONFIG.theme.font);

  function apply() {
    const v = settings.values;
    root.setProperty("--hud-bg", Themes.rgba(CONFIG.theme.ui.surface, v.hudOpacity));
    const stripes = Themes.light ? "rgba(0, 0, 0, 0.05)" : "rgba(0, 0, 0, 0.18)";
    root.setProperty("--scan", v.scanlines && !v.reduceMotion ? stripes : "transparent");
  }

  settings.watch(apply);
  Themes.onChange((error) => {
    if (error instanceof Error) toast.show(error.message);
    apply();
  });

  return Object.freeze({ apply });
});
