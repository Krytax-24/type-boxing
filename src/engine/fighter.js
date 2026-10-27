/**
 * One fighter of a Duel: position, state and animation timers. Plain data, no drawing.
 * The rules (duel.js) move it; the 2D puppets (fighter-stage.js) act out what it is doing.
 */
CounterType.define("fighter", [], () => {
  "use strict";

  class Fighter {
    /**
     * @param {string} id "you" or "bot".
     * @param {string} team "player" (faces right) or "enemy" (faces left).
     * @param {number} x Position on the arena floor, in drawing units.
     * @param {number} maxHp
     */
    constructor(id, team, x, maxHp) {
      this.id = id;
      this.team = team;
      this.x = x;
      this.z = 0; // height above the floor
      this.vx = 0;
      this.vz = 0;
      this.facing = team === "player" ? 1 : -1;
      this.hp = maxHp;
      this.maxHp = maxHp;
      this.state = "idle"; // idle | attack | hurt | air | down
      this.stateT = 0;
      this.stun = 0;
      this.move = null; // jab | heavy | special
      this.moveT = 0;
      this.hitsDone = 0;
      this.moveCount = 0;
      this.flashT = 0;
      this.dead = false;
      // Cosmetic only, set by the Duel session; no rule reads them. null = the default look.
      this.letterColor = null; // correct letters in this fighter's word plate
      this.sparkColor = null; // sparks when this fighter lands a hit
    }
  }

  return Fighter;
});
