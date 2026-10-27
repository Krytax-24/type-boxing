/**
 * Race numbers (race-rules.js and race-mode.js) and the vehicle roster (race-vehicles.js).
 * Added to CONFIG when the Race module starts, so the core never depends on them. Race modules depend on
 * "race-config" and receive CONFIG with these sections in it.
 */
CounterType.define("race-config", ["config"], (CONFIG) => {
  "use strict";

  // Race (race-rules.js rules, race-mode.js screen). Everyone types the same passage; a vehicle's place on the track
  // is exactly its share of the passage typed correctly. Vehicles are cosmetic: no vehicle changes a number.
  CONFIG.race = {
    countdown: 3, // seconds of lights before the green
    lateSec: 30, // the race closes this long after the first finisher
    timeLimit: { short: 90, medium: 150, long: 240 }, // a race never runs longer than this (seconds)
    rateWindow: 3, // seconds of correct keys behind the live WPM readout
    maxExtra: 10, // extra letters past the end of a word (more are ignored, like Monkeytype)
    // Space on a wrong word skips it (like Monkeytype). A skip costs time so mashing never wins: the racer's official
    // time gets base + perError seconds per wrong, missing or extra letter. on: false brings back "fix it first".
    skip: { on: true, base: 1.0, perError: 0.25 },
    streakForBoost: 10, // clean words in a row that light the nitro (cosmetic)
    maxRacers: 6,
    minRacers: 2,
    lengths: [
      ["short", "Short"],
      ["medium", "Medium"],
      ["long", "Long"],
    ],
    defaultLength: "medium",
    botCounts: [1, 2, 3, 4, 5], // practice races: how many bots join you
    defaultBots: 3,
    // Practice opponents are built around a target speed: each bot is target x one of these spreads.
    spread: [0.82, 0.94, 1.0, 1.08, 1.2],
    botAccuracy: [0.95, 0.97], // per-letter accuracy range of race bots
    speeds: [
      ["match", "Near my speed"],
      [30, "30 wpm"],
      [50, "50 wpm"],
      [70, "70 wpm"],
      [90, "90 wpm"],
      [110, "110 wpm"],
    ],
    defaultSpeed: "match",
    storageKey: "typeboxing.race", // { vehicle, length, bots, speed }
    records: "typeboxing.race.records", // newest 200 finished races (local until the backend exists)
  };

  // Vehicles for Race. Drawn by race-vehicles.js. `kind` (car or bike) picks the size and pose.
  // Cosmetic only. Unlocks are by races finished (never by payment).
  CONFIG.vehicles = [
    // Pictures from Krishna's shared car and bike designs (race-vehicle-art.js). Looks only: every vehicle is equally
    // fast.
    { id: "lime", name: "Lime Arrow", kind: "car", art: "lime", unlock: 0 },
    { id: "ninety6", name: "Ninety-Six", kind: "car", art: "ninety6", unlock: 0 },
    { id: "shadow", name: "Shadow 1000", kind: "bike", art: "shadow", unlock: 0 },
    { id: "snow", name: "Snowline 600", kind: "bike", art: "snow", unlock: 0 },
    { id: "ice", name: "Ice Coupe", kind: "car", art: "ice", unlock: 3 },
    { id: "corsa", name: "Teal Corsa", kind: "bike", art: "corsa", unlock: 6 },
    { id: "fang", name: "White Fang", kind: "car", art: "fang", unlock: 10 },
    { id: "ruby", name: "Ruby 400", kind: "car", art: "ruby", unlock: 15 },
    { id: "blaze", name: "Orange Blaze", kind: "bike", art: "blaze", unlock: 20 },
    { id: "stealth", name: "Stealth V12", kind: "car", art: "stealth", unlock: 30 },
  ];

  return CONFIG;
});
