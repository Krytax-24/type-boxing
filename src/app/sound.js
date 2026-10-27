/**
 * Sound: the player's sound settings (Settings > Game: Sound effects on or off, and the volume) applied to the
 * audio module, now and on every change.
 */
CounterType.define("sound", ["audio", "settings"], (audio, settings) => {
  "use strict";

  settings.watch((values) => {
    audio.setEnabled(values.sound);
    audio.setVolume(values.volume);
  });

  return Object.freeze({});
});
