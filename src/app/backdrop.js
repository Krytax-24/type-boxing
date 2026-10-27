/**
 * Backdrop: what the arena shows on the menus. A slow sparring loop of your fighter against the opponent the menus
 * picked (looks.js), on the live scenery. It is a world of its own in the "menu" phase, so the menus never need a
 * game mode to be loaded.
 */
CounterType.define("backdrop", ["arena", "loop"], (arena, loop) => {
  "use strict";

  const CENTER_X = 480;
  const HALF_GAP = 105;

  /** A still world: two fighters facing each other in the middle of the arena. */
  const world = {
    phase: "menu",
    arenaWidth: CENTER_X * 2,
    cameraX: CENTER_X,
    floorY: 300,
    shake: 0,
    flash: 0,
    fx: [],
    fighters: [
      { x: CENTER_X - HALF_GAP, z: 0, facing: 1 },
      { x: CENTER_X + HALF_GAP, z: 0, facing: -1 },
    ],
  };

  function draw(dt) {
    arena.renderer.draw(world, dt);
  }

  loop.setBackdrop(draw);

  return Object.freeze({ draw });
});
