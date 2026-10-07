// One stick figure fighter: position, state and animation timers.
// Shared by the duel (duel.js) and the combo sandbox (sim.js). Plain data, no drawing.

class Fighter {
  constructor(id, team, x, maxHp) {
    this.id = id;
    this.team = team;            // "player" or "enemy"
    this.x = x;
    this.z = 0;                  // height above the floor
    this.vx = 0;
    this.vz = 0;
    this.facing = team === "player" ? 1 : -1;
    this.hp = maxHp;
    this.maxHp = maxHp;
    this.state = "idle";         // idle | attack | hurt | air | down
    this.stateT = 0;
    this.stun = 0;
    this.move = null;
    this.moveT = 0;
    this.hitsDone = 0;
    this.mult = 1;
    this.queue = [];
    this.moveCount = 0;
    this.hang = 0;
    this.slamming = false;
    this.bounced = false;
    this.flashT = 0;
    this.dead = false;
    this.respawnAt = 0;
    // Cosmetic only, set by main.js; no rule reads them. null = the renderer's default look.
    this.color = null;           // stickman
    this.letterColor = null;     // correct letters in this fighter's word plate
    this.sparkColor = null;      // sparks when this fighter lands a hit
    this.weaponLook = null;      // weapon drawn in the hands: "light", "medium", "heavy" (the sandbox draws none)
  }
}
