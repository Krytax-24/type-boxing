/**
 * Boot: the first screen. Runs once every module has started (CounterType.whenReady), so the title already lists
 * every loaded mode and knows whether the online layer is there. The theme comes first, so the very first frame
 * has its colors.
 */
CounterType.define(
  "boot",
  ["profile", "themes", "layout", "looks", "home-page", "loop"],
  (Profile, Themes, layout, looks, home, loop) => {
    "use strict";

    CounterType.whenReady(() => {
      Profile.load(); // your identity (Name#tag), created on the first visit
      Themes.init(); // colors, background image and custom CSS
      layout.resize(); // the frame, now that every module listens for it
      looks.apply();
      home.show();
      loop.start();
    });

    return Object.freeze({});
  },
);
