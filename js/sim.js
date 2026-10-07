// The fight simulation. No DOM, no canvas, no keyboard.
// Everything that changes the fight goes through Sim.perform(), so a network
// layer can send and receive those calls for multiplayer later.

class Sim {
  constructor() { this.reset(); }

  reset() {
    this.time = 0;
    this.player = new Fighter("player", "player", CONFIG.player.startX, CONFIG.player.maxHp);
    this.enemies = [];
    this.fx = [];
    this.shake = 0;
    this.hitstop = 0;
    this.flash = 0;
    this.combo = { hits: 0, lastHitAt: -99 };
    this.style = { value: 0, lastAt: -99, recent: [] };
    this.stats = { damage: 0, maxCombo: 0, kos: 0 };
    this.events = [];
  }

  spawnEnemy(maxHp, respawnDelay = 0) {
    const e = new Fighter("enemy" + this.enemies.length, "enemy", this.player.x + CONFIG.dummy.spawnDistance, maxHp);
    e.respawnDelay = respawnDelay;
    this.enemies.push(e);
    return e;
  }

  get fighters() { return [this.player, ...this.enemies]; }

  // Closest enemy that is still in the fight.
  nearestEnemy(from) {
    let best = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!best || Math.abs(e.x - from.x) < Math.abs(best.x - from.x)) best = e;
    }
    return best;
  }

  isAirborne(f) { return f.z > 30; }

  // Typed chunk type -> real move, depending on whether the target is in the air.
  resolveMove(type, target) {
    const air = target && this.isAirborne(target);
    if (type === "light") return air ? "airKick" : "jab";
    if (type === "heavy") return air ? "slam" : "heavy";
    return type; // launcher, special
  }

  previewMove(type) {
    return this.resolveMove(type, this.nearestEnemy(this.player));
  }

  rank() {
    let name = CONFIG.style.ranks[0].name;
    for (const r of CONFIG.style.ranks) if (this.style.value >= r.at) name = r.name;
    return name;
  }

  penalize() {
    this.style.value = Math.max(0, this.style.value - CONFIG.style.mistakePenalty);
  }

  addStyle(name) {
    const s = this.style, c = CONFIG.style;
    const last2 = s.recent.slice(-2);
    let mult = 1;
    if (last2.length === 2 && last2[0] === name && last2[1] === name) mult = c.repeatPenalty;
    else if (!last2.includes(name)) mult = c.varietyBonus;
    s.value = Math.min(100, s.value + CONFIG.moves[name].style * mult);
    s.lastAt = this.time;
    s.recent.push(name);
    if (s.recent.length > 6) s.recent.shift();
  }

  // The one entry point for the player's attacks.
  // type: light | heavy | launcher | special.  mods.mult: damage multiplier.
  perform(type, mods = {}) {
    const p = this.player;
    const target = this.nearestEnemy(p);
    if (!target) return null;
    const name = this.resolveMove(type, target);
    this.addStyle(name);
    const busy = p.state === "attack" && p.hitsDone < CONFIG.moves[p.move].hits.length;
    if (busy) {
      p.queue.push({ type, mult: mods.mult || 1 });
      if (p.queue.length > 2) p.queue.shift();
    } else {
      this.startMove(p, type, mods.mult || 1);
    }
    return name;
  }

  startMove(f, type, mult) {
    const target = this.nearestEnemy(f);
    f.move = this.resolveMove(type, target);
    f.state = "attack";
    f.moveT = 0;
    f.stateT = 0;
    f.hitsDone = 0;
    f.mult = mult;
    f.moveCount++;
  }

  update(dt) {
    for (const fx of this.fx) fx.age += dt;
    this.fx = this.fx.filter((fx) => fx.age < fx.life);
    this.shake *= Math.pow(0.0008, dt);
    if (this.shake < 0.2) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 2.2);

    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.time += dt;

    for (const f of this.fighters) this.updateFighter(f, dt);

    if (this.combo.hits > 0 && this.time - this.combo.lastHitAt > CONFIG.comboTimeout) this.combo.hits = 0;
    const s = this.style;
    if (this.time - s.lastAt > CONFIG.style.holdSeconds) s.value = Math.max(0, s.value - CONFIG.style.decayPerSec * dt);

    for (const e of this.enemies) {
      if (e.dead && e.respawnDelay && this.time >= e.respawnAt) this.respawn(e);
    }
  }

  respawn(e) {
    Object.assign(e, new Fighter(e.id, "enemy", this.player.x + CONFIG.dummy.spawnDistance, e.maxHp), { respawnDelay: e.respawnDelay });
    this.fx.push({ type: "ring", x: e.x, z: 0, age: 0, life: 0.5, color: "#7dd3fc" });
  }

  updateFighter(f, dt) {
    f.flashT = Math.max(0, f.flashT - dt);
    f.stateT += dt;

    if (f.state === "attack") this.updateAttack(f, dt);
    else if (f.state === "hurt" && f.stateT >= f.stun) { f.state = "idle"; f.stateT = 0; }
    else if (f.state === "down" && !f.dead && f.stateT >= CONFIG.physics.downTime) { f.state = "idle"; f.stateT = 0; }

    this.updatePhysics(f, dt);

    // Idle fighters face their opponent.
    if (f.state === "idle") {
      const other = f.team === "player" ? this.nearestEnemy(f) : this.player;
      if (other) f.facing = other.x >= f.x ? 1 : -1;
    }
  }

  updateAttack(f, dt) {
    const mv = CONFIG.moves[f.move];
    f.moveT += dt;
    const t = f.moveT / mv.dur;
    const target = f.team === "player" ? this.nearestEnemy(f) : this.player;

    if (target) {
      f.facing = target.x >= f.x ? 1 : -1;
      // Dash to striking range.
      const dx = target.x - f.facing * mv.range - f.x;
      f.x += Math.sign(dx) * Math.min(Math.abs(dx), CONFIG.player.dashSpeed * dt);
      // Air moves follow the target's height.
      if (mv.air) {
        const want = this.isAirborne(target) ? target.z : 0;
        f.z += (want - f.z) * Math.min(1, dt * 16);
        f.vz = 0;
        f.hang = 0.05;
      }
    }

    while (f.hitsDone < mv.hits.length && t >= mv.hits[f.hitsDone].at) {
      if (target) this.applyHit(f, target, mv.hits[f.hitsDone], mv, f.mult);
      f.hitsDone++;
    }

    // Cancel into the next queued move as soon as the last hit has landed.
    if (f.hitsDone >= mv.hits.length && f.queue.length) {
      const q = f.queue.shift();
      this.startMove(f, q.type, q.mult);
      return;
    }
    if (t >= 1) { f.state = "idle"; f.move = null; f.stateT = 0; }
  }

  applyHit(attacker, target, hit, mv, mult) {
    const dir = attacker.facing;
    const dmg = Math.max(1, Math.round(hit.dmg * mult));
    target.hp = Math.max(0, target.hp - dmg);
    target.flashT = 0.12;
    this.stats.damage += dmg;
    this.combo.hits++;
    this.combo.lastHitAt = this.time;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo.hits);

    // Reaction.
    target.slamming = false;
    if (hit.launch) {
      target.state = "air"; target.stateT = 0;
      target.z = Math.max(target.z, 1);
      target.vz = hit.launch; target.hang = 0;
      target.vx = dir * (hit.knock || 0);
    } else if (hit.juggle) {
      target.state = "air"; target.stateT = 0;
      target.z = Math.max(target.z, 1);
      target.vz = hit.juggle; target.hang = CONFIG.physics.juggleHang;
      target.vx = dir * (hit.knock || 0);
    } else if (hit.slam) {
      target.state = "air"; target.stateT = 0;
      target.z = Math.max(target.z, 1);
      target.vz = -hit.slam; target.hang = 0; target.slamming = true; target.bounced = false;
      target.vx = dir * (hit.knock || 0);
    } else if (this.isAirborne(target)) {
      target.vz = Math.max(target.vz, 300); target.hang = CONFIG.physics.juggleHang;
      target.vx = dir * (hit.knock || 0);
    } else {
      target.state = "hurt"; target.stateT = 0; target.stun = hit.stun || 0.3;
      target.vx = dir * (hit.knock || 0);
    }

    // Feedback.
    const big = hit.finisher || hit.slam || hit.launch;
    this.fx.push({ type: "spark", x: target.x - dir * 10, z: target.z + 70, age: 0, life: 0.22, size: big ? 46 : 28, color: mv.special ? "#fbbf24" : "#ffffff" });
    this.fx.push({ type: "text", x: target.x, z: target.z + 120, age: 0, life: 0.8, text: String(dmg), color: mv.special ? "#fbbf24" : big ? "#fb923c" : "#f4f4f8", size: big ? 34 : 26 });
    this.shake = Math.max(this.shake, hit.finisher ? 22 : mv.shake);
    this.hitstop = Math.max(this.hitstop, hit.finisher ? 0.14 : mv.hitstop);
    if (hit.finisher) this.flash = 1;

    if (target.hp <= 0 && !target.dead) this.knockOut(target, dir);
  }

  knockOut(target, dir) {
    target.dead = true;
    target.state = "air"; target.stateT = 0;
    target.z = Math.max(target.z, 1);
    target.vz = Math.max(target.vz, 850); target.hang = 0;
    target.vx = dir * 650;
    target.respawnAt = this.time + (target.respawnDelay || 0);
    this.stats.kos++;
    this.events.push({ type: "ko", id: target.id });
    this.fx.push({ type: "text", x: target.x, z: target.z + 170, age: 0, life: 1.1, text: "K.O.", color: "#f87171", size: 42 });
  }

  updatePhysics(f, dt) {
    const ph = CONFIG.physics;
    if (f.hang > 0) f.hang -= dt;
    const airborne = f.z > 0 || f.vz > 0;
    if (airborne) {
      if (f.hang <= 0 && f.state !== "attack") f.vz -= ph.gravity * dt;
      f.z += f.vz * dt;
      if (f.z <= 0) {
        f.z = 0;
        this.land(f);
      }
    }
    f.x += f.vx * dt;
    const fric = (f.z > 0 ? ph.airFriction : ph.groundFriction) * dt;
    f.vx -= Math.sign(f.vx) * Math.min(Math.abs(f.vx), fric);
    f.x = Math.min(Math.max(f.x, 60), CONFIG.arena.width - 60);
  }

  land(f) {
    if (f.slamming && !f.bounced) {
      f.vz = CONFIG.physics.slamBounce; f.z = 1; f.bounced = true; f.slamming = false;
      this.shake = Math.max(this.shake, 16);
      this.fx.push({ type: "ring", x: f.x, z: 0, age: 0, life: 0.45, color: "#fb923c" });
      return;
    }
    f.vz = 0;
    f.slamming = false;
    f.bounced = false;
    if (f.state === "air") {
      f.state = "down"; f.stateT = 0;
      f.vx *= 0.4;
      if (f.team === "enemy") this.fx.push({ type: "ring", x: f.x, z: 0, age: 0, life: 0.35, color: "#94a3b8" });
    }
  }
}
