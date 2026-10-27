/**
 * Arm Wrestling numbers (arm-rules.js and arm-mode.js).
 * Power = 0.7 x accuracy term x activity gate + 0.3 x speed share, tuned with tests/arm-sim.js.
 * Added to CONFIG when the Arm Wrestling module starts; Arm Wrestling modules receive CONFIG from here.
 */
CounterType.define("arm-config", ["config"], (CONFIG) => {
  "use strict";

  // Arm Wrestling (arm-rules.js rules, arm-mode.js screen). Power = 0.7 x accuracy term x activity gate
  // + 0.3 x speed share. Tuned with tests/arm-sim.js.
  CONFIG.arm = {
    countdown: 3,
    timer: 60, // seconds; at time up the side past the middle wins
    suddenDeath: 10, // a dead even match plays this long with the pull doubled
    tieBand: 0.02, // |x| under this at time up counts as dead even
    accWeight: 0.7,
    speedWeight: 0.3,
    accKeys: 40, // accuracy over the last this many keys (a key window, so speed does not change it)
    accFloor: 0.8,
    accCurve: 2, // A = ((acc - floor) / (1 - floor)) ^ curve, clamped to 0..1
    accPrior: 3, // virtual right keys that soften the first seconds
    gate: 0.65, // accuracy counts in full only while you type at least this share of the foe's speed
    minWpm: 25, // ...and at least this fast
    idleAfter: 2.5, // no key for this long: power 0
    rateWindow: 4, // seconds of correct keys behind the speed term
    pull: 0.22, // x moves by pull x (P_you - P_foe) per second
    typoJerk: 0.035, // a typo jerks your hand this much toward the foe (visual only)
    // gate 0.65 was tuned with tests/arm-sim.js: equal skill 50%, a 70 wpm 96% typist beats 110 wpm 93% about 63% and
    // 35 wpm perfect about 84% of the time; median match about 50 s.
    // Opponents: accuracy is the per-letter chance a key is right, so the card shows who is precise and who is fast.
    bots: [
      { name: "GREENHORN", style: "Slow and shaky", wpm: 25, accuracy: 0.93, recovery: [0.4, 0.3], drift: 0.1 },
      { name: "CLERK", style: "Careful, never rushes", wpm: 40, accuracy: 0.985, recovery: [0.3, 0.2], drift: 0.05 },
      { name: "BRUISER", style: "Fast but sloppy", wpm: 75, accuracy: 0.91, recovery: [0.08, 0.08], drift: 0.25 },
      { name: "SURGEON", style: "Slow hands, no slips", wpm: 55, accuracy: 0.995, recovery: [0.25, 0.15], drift: 0.05 },
      { name: "IRONGRIP", style: "Quick and clean", wpm: 80, accuracy: 0.97, recovery: [0.18, 0.12], drift: 0.12 },
      { name: "TITAN", style: "The final boss", wpm: 105, accuracy: 0.985, recovery: [0.15, 0.1], drift: 0.1 },
    ],
    defaultBot: 1,
    storageKey: "typeboxing.arm", // { bot }
    records: "typeboxing.arm.records", // newest 200 finished matches
  };

  return CONFIG;
});
