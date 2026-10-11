// 3D Lab fighter: input, Tekken 3 style movement (walk, dash, backdash, crouch, sidestep, 8-way walk, jump),
// attacks with strings and cancels, hit levels and guarding, hit reactions with launches, bounds and juggles,
// projectiles and spells, blinks, freezes, and supers (a held victim and scripted hits).
// Logic state (free, act, air, juggle, down) is kept apart from the pose it produces.
const T3F = (() => {
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const { clamp, lerp, P, blend, sample, EASE } = T3;
  const G = 19; // gravity, m/s2 (a little heavier than life: snappy arcs)

  // Per-character movement feel (heavier fighters walk slower and dash shorter).
  const LOCO = { walkF: 1.35, walkB: 1.05, side: 1.35, dash: 4.6, backdash: 4.4, sidestep: 4.2, run: 3.6, jumpV: 5.6, crouchWalk: 0.8, weight: 1 };

  const DIRS = ["n", "f", "b", "u", "d", "uf", "ub", "df", "db"];
  function dirOf(i) {
    const v = i.u ? "u" : i.d ? "d" : "", h = i.f ? "f" : i.b ? "b" : "";
    return (v + h) || "n";
  }

  // A projectile or a spell placed in the world (fireballs, a batted ball, a thrown axe, a flame pillar, ice
  // spikes). It carries its own hit; it is a sphere of radius r, or a column from y0 to y1 above its position.
  // e (the move event): kind, speed, vy, grav, r, y0, y1, life, delay, hit, returnAt (boomerang), pierce.
  class Projectile {
    constructor(owner, e, pos, vel, m) {
      this.owner = owner; this.e = e; this.m = m; this.kind = e.kind;
      this.pos = pos; this.vel = vel; this.dir = vel.clone().setY(0).normalize();
      if (this.dir.lengthSq() < 0.5) this.dir = owner.fwd;
      this.age = 0; this.done = false; this.hitDone = false; this.r = e.r || 0.2;
      this.hit = e.hit ? Object.assign({ dmg: 10, level: "M", react: "light", push: 0.8 }, e.hit) : null;
      this.act = owner.action; // spells with the same `once` key from one action hit only once between them
      if (owner.S) {
        this.mesh = T3S.projMesh(owner.S, e.kind, { life: e.life, color: e.color, weapon: e.kind === "axe" ? owner.rig.weaponGroup : null });
        this.mesh.group.visible = !(e.delay > 0);
        if (e.trail) this.trail = new T3S.Trail(owner.S, e.trail, 10);
        if (e.light) this.light = T3S.holdLight(owner.S, this, e.light, e.lightK || 1.6);
      }
    }
    get fwd() { return this.dir; }
    step(dt, opp) {
      if (this.done) return;
      this.age += dt;
      const e = this.e, delay = e.delay || 0;
      if (this.age < delay) return;
      const t = this.age - delay;
      // Boomerang: after returnAt it flies back to the owner's hand and is caught.
      if (e.returnAt && t >= e.returnAt) {
        if (!this.returning) { this.returning = true; this.hitDone = false; }
        const hand = this.owner.rig.bones.hR.getWorldPosition(V3());
        const d = hand.sub(this.pos); const L = d.length();
        if (L < 0.35 || t > e.returnAt * 3) { this.done = true; this.caught = true; return; }
        this.vel.copy(d.multiplyScalar((e.speed || 6) / L));
        this.dir = this.vel.clone().setY(0).normalize().negate();
      }
      this.vel.y -= (e.grav || 0) * dt;
      this.pos.addScaledVector(this.vel, dt);
      if (!e.column && !e.ground && this.pos.y < 0.05 && (e.grav || 0) > 0) { this.done = true; return; }
      if (e.life && t >= e.life && !e.returnAt) { this.done = true; return; }
      if (Math.hypot(this.pos.x, this.pos.z) > 12) { this.done = true; return; }
      // Hit check: active from e.active (seconds after it appears), once (or once each way for a boomerang).
      if (!this.hit || this.hitDone || t < (e.active || 0) || (e.activeUntil && t > e.activeUntil)) return;
      if (e.once && this.act && this.act.onceHit && this.act.onceHit[e.once]) return;
      const y0 = e.y0 || 0, y1 = e.y1 || 0, n = y1 > y0 ? 4 : 0;
      for (let i = 0; i <= n; i++) {
        const p = this.pos.clone(); p.y += n ? y0 + (y1 - y0) * (i / n) : 0;
        if (!opp.hitTest(p, this.r)) continue;
        this.hitDone = true;
        if (e.once && this.act) (this.act.onceHit = this.act.onceHit || {})[e.once] = true;
        const res = opp.receive(this.hit, this);
        if (res !== "whiff") this.owner.emit(res, { hit: this.hit, at: p, m: this.m || { id: "proj", name: e.kind }, counter: opp.lastCounter, dmg: opp.lastDmg, proj: true });
        if (!e.pierce && !e.returnAt) this.done = true;
        break;
      }
    }
    draw(dt, t) {
      if (!this.mesh) return;
      const vis = this.age >= (this.e.delay || 0) && !this.done;
      this.mesh.group.visible = vis;
      this.mesh.group.position.copy(this.pos);
      this.mesh.group.rotation.y = Math.atan2(-this.dir.z, this.dir.x);
      if (vis) this.mesh.step(dt, t, this.age - (this.e.delay || 0));
      if (this.trail && vis && dt > 0) { const up = V3(0, 0.07, 0); this.trail.push(this.pos.clone().sub(up), this.pos.clone().add(up), 1); }
      if (this.light) this.light.l.position.copy(this.pos);
    }
    finish(silent) {
      const S = this.owner.S;
      if (this.e.kind === "axe" || this.e.returnAt) this.owner.rig.weaponGroup.visible = true;
      if (!S) return;
      if (!silent && !this.caught) this.owner.emit("projEnd", { at: this.pos.clone(), kind: this.kind });
      T3S.removeMesh(S, this.mesh); if (this.trail) this.trail.dispose(S); T3S.release(this.light);
    }
  }

  class Fighter {
    constructor(id, side) {
      this.side = side; // 0 player, 1 dummy
      this.hpMax = 170;
      this.projectiles = []; this.trails = {};
      this.setChar(id);
    }
    setChar(id) {
      if (this.rig) { this.clearProjectiles(); this.clearTrails(true); }
      if (this.rig && this.rig.bones.root.parent) { this.rig.bones.root.parent.remove(this.rig.bones.root); this.rig.strandGroup.parent.remove(this.rig.strandGroup); this.rig.shadow.parent.remove(this.rig.shadow); }
      this.id = id; this.rig = (Fighter.models || T3M).build(id); this.def = this.rig.def; this.B = this.rig.B;
      this.list = T3Moves.get(id);
      this.st = this.list.stance;
      this.loco = Object.assign({}, LOCO, this.list.loco);
      this.react = T3Moves.reactions(this.st);
      if (this.scene) this.addTo(this.scene);
      this.reset(this.pos ? this.pos.x : 0, this.pos ? this.pos.z : 0);
    }
    addTo(scene) { this.scene = scene; scene.add(this.rig.bones.root); scene.add(this.rig.strandGroup); scene.add(this.rig.shadow); }
    reset(x, z, yaw) {
      this.pos = V3(x || 0, 0, z || 0); this.y = 0; this.vy = 0; this.vel = V3(0, 0, 0);
      this.yaw = yaw || 0; this.hp = this.hpMax;
      this.state = "free"; this.action = null; this.queue = null;
      this.crouch = 0; this.crouchV = 0; this.lean = 0; this.leanV = 0; this.roll = 0;
      this.lock = 0; this.moveKind = null; this.moveT = 0;
      this.hist = []; this.pending = null; this.prevDir = "n"; this.uHeld = -1; this.dHeld = -1; this.lastTap = { f: -9, b: -9 }; this.lastPress = null;
      this.feet = null; this.t = 0; this.stun = 0; this.juggle = 0; this.downT = 0; this.counterable = false;
      this.blendFrom = null; this.blendT = 0; this.blendDur = 0;
      this.pose = P(this.st); this.events = [];
      this.combo = { hits: 0, dmg: 0, t: 0 };
      this.bounded = false; this.boundPending = false; this.frozen = false; this.held = false; this.heldBy = null;
      this.meter = this.meter === undefined ? 100 : this.meter;
      this.clearProjectiles();
      this.rig.weaponGroup.visible = true;
      this.solve(0);
      (Fighter.models || T3M).resetStrands(this.rig);
      this.clearTrails();
    }
    // ---------- Helpers ----------
    get isFighter() { return true; }
    get fwd() { return V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
    get right() { return V3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
    toLocal(wx, wz, yaw, ox, oz) { const c = Math.cos(yaw), s = Math.sin(yaw), dx = wx - ox, dz = wz - oz; return [dx * c - dz * s, dx * s + dz * c]; }
    toWorld(lx, lz, yaw, ox, oz) { const c = Math.cos(yaw), s = Math.sin(yaw); return [ox + lx * c + lz * s, oz - lx * s + lz * c]; }
    faceYaw(opp) { return Math.atan2(-(opp.pos.z - this.pos.z), opp.pos.x - this.pos.x); }
    startBlend(dur) {
      this.blendFrom = Object.assign({}, this.pose); this.blendT = 0; this.blendDur = dur;
      // Spins end on whole turns: bring turn angles back into -180..180 so the blend never unwinds a spin.
      for (const f of ["yaw", "hy"]) this.blendFrom[f] = ((this.blendFrom[f] % 360) + 540) % 360 - 180;
    }
    emit(type, data) { this.events.push(Object.assign({ type, who: this }, data || {})); }

    get crouching() {
      if (this.state === "act" && this.action && this.action.m && this.action.m.crouch) { const c = this.action.m.crouch, t = this.action.t; return t >= c[0] && t <= c[1]; }
      if (this.state === "act" && this.action && this.action.kind === "crouchBlock") return true;
      return this.state === "free" && this.crouch > 0.5;
    }
    get airborne() {
      if (this.state === "air") return this.y > 0.12;
      if (this.state === "act" && this.action && this.action.m && this.action.m.air) { const a = this.action.m.air, t = this.action.t; return t >= a[0] && t <= a[1]; }
      return false;
    }
    get attacking() { return this.state === "act" && this.action && this.action.kind === "move"; }

    // ---------- Input ----------
    // inp: { f b u d (held, relative to facing), shift, press: { "1".."4": true }, t (lab time) }
    handleInput(inp, opp) {
      const t = this.t, dir = dirOf(inp);
      if (dir !== this.prevDir) { this.hist.push({ d: dir, t }); if (this.hist.length > 12) this.hist.shift(); }
      // Taps for dashes.
      const newF = inp.f && !this.prevF, newB = inp.b && !this.prevB;
      const tapU = this.uHeld >= 0 && !inp.u && t - this.uHeld < 0.14, tapD = this.dHeld >= 0 && !inp.d && t - this.dHeld < 0.14;
      if (inp.u && this.uHeld < 0) this.uHeld = t; if (!inp.u) this.uHeld = -1;
      if (inp.d && this.dHeld < 0) this.dHeld = t; if (!inp.d) this.dHeld = -1;
      this.prevF = inp.f; this.prevB = inp.b; this.prevDir = dir;
      this.inp = inp;

      let buttons = Object.keys(inp.press || {}).filter((k) => inp.press[k]);
      // Input leniency: a second button within 50 ms of the first counts as pressed together (1+2, df+1+2). If the
      // first already started a move, that move is swapped for the combined one.
      if (buttons.length && this.lastPress && t - this.lastPress.t <= 0.05 && buttons.some((b) => !this.lastPress.buttons.includes(b))) {
        const both = Array.from(new Set(this.lastPress.buttons.concat(buttons)));
        const a = this.action, started = this.state === "act" && a && a.kind === "move" && a.t <= 0.06 && a.m === this.lastPress.move;
        const mv = this.matchMove(both, this.lastPress.dir === "n" ? dir : this.lastPress.dir);
        if (mv && mv.parsed.btn.length === both.length && (started || this.canAct())) {
          if (started) { this.pos.set(a.ox, 0, a.oz); this.yaw = a.oyaw; }
          this.lastPress = null; this.startMove(mv, opp); return;
        }
      }
      if (buttons.length) this.lastPress = { buttons, t, dir, move: null };
      // Strings: a button inside the current move's chain window continues the string.
      if (buttons.length && this.attacking) {
        const m = this.action.m, w = m.window || [0.06, m.dur];
        // Already queued the next step: keep this press for the step after it.
        if (this.queue) { this.pending = { buttons, t, dir }; return; }
        if (this.chainFrom(m, buttons, w, dir)) return;
      }
      if (buttons.length && this.canAct()) {
        const mv = this.matchMove(buttons, dir);
        if (mv) { this.startMove(mv, opp); if (this.lastPress) this.lastPress.move = mv; return; }
      }
      if (this.state !== "free" || this.lock > 0) return;
      if (inp.shift) return; // 8-way walk is handled in the free state
      if (newF) { if (t - this.lastTap.f < 0.26) { this.startDash(1); this.lastTap.f = -9; return; } this.lastTap.f = t; }
      if (newB) { if (t - this.lastTap.b < 0.26) { this.startDash(-1); this.lastTap.b = -9; return; } this.lastTap.b = t; }
      if (tapU) { this.startSidestep(-1, opp); return; }
      if (tapD) { this.startSidestep(1, opp); return; }
      if (inp.u && this.uHeld >= 0 && t - this.uHeld >= 0.14) { this.startJump(inp.f ? 1 : inp.b ? -1 : 0); return; }
    }
    // The most specific chain key that matches: all its buttons pressed and its direction held ("d+2" before "2",
    // "1+2" before "1"). A one-letter direction also matches its diagonals (d matches df and db).
    chainFrom(m, buttons, w, dir) {
      if (!m.chain || this.action.t < w[0] || this.action.t > w[1]) return false;
      dir = dir || "n";
      const keys = Object.keys(m.chain).filter((k) => {
        const p = T3Moves.parse(k);
        if (!p.btn.every((b) => buttons.includes(b)) || p.btn.length !== buttons.length) return false;
        if (p.hold) return p.hold.length === 1 ? dir.includes(p.hold) : dir === p.hold;
        return dir === "n"; // a held direction asks for a different move (f+1 is not the string 1)
      }).sort((a, b) => b.length - a.length);
      if (keys.length) { this.queue = m.chain[keys[0]]; return true; }
      return false;
    }
    canAct() {
      if (this.state === "free") return true;
      if (this.state === "air") return false;
      // A new move may start during the recovery of the last one (after its hits), blending over it.
      if (this.state === "act" && this.action.kind === "move") { const m = this.action.m; return this.action.t >= Math.min(m.dur * 0.98, (m.cancel !== undefined ? m.cancel : m.dur) + 0.1); }
      return false;
    }
    // Pick the move for the pressed buttons: longest matching motion first, then a held direction, then neutral.
    matchMove(buttons, dir) {
      const moves = this.list.moves, recent = this.hist.filter((h) => this.t - h.t < 0.4).map((h) => h.d);
      let best = null, bestScore = -1;
      for (const id in moves) {
        const m = moves[id], p = m.parsed;
        if (!p || m.hidden) continue;
        if (m.super && this.meter < 100) continue;
        if (p.btn.length !== buttons.filter((b) => p.btn.includes(b)).length || p.btn.length > buttons.length) continue;
        if (p.btn.some((b) => !buttons.includes(b))) continue;
        let score = p.btn.length * 10;
        if (p.seq.length > 1) {
          // Motion: the directions appear in order in the last 0.4 s, the last one held now (or just before).
          let j = 0; for (const d of recent) if (d === p.seq[j]) j++;
          if (j < p.seq.length || (dir !== p.seq[p.seq.length - 1] && recent[recent.length - 1] !== p.seq[p.seq.length - 1])) continue;
          score += 100 + p.seq.length;
        } else if (p.seq.length === 1) {
          if (p.seq[0] !== dir) continue;
          score += 50;
        } else if (dir !== "n" && dir !== "f" && dir !== "b") score -= 5; // plain button while holding up or down: fallback
        if (score > bestScore) { best = m; bestScore = score; }
      }
      return best;
    }

    // ---------- Starting things ----------
    startMove(m, opp) {
      this.state = "act";
      this.action = { kind: "move", m, t: 0, ox: this.pos.x, oz: this.pos.z, oyaw: this.yaw, lastX: 0, lastZ: 0, hitDone: {}, evDone: {}, tracked: 0 };
      if (m.super) this.meter = 0;
      this.queue = null; this.lock = 0;
      // Momentum: an attack out of a dash keeps some of the slide.
      if (!m.dash) this.vel.multiplyScalar(0.35);
      this.action.extra = this.reachAssist(m, opp);
      this.startBlend(m.blendIn !== undefined ? m.blendIn : 0.05);
      this.emit("move", { m });
      // A press buffered during the previous step continues the string from this one.
      if (this.pending && this.t - this.pending.t < 0.5) this.chainFrom(m, this.pending.buttons, [0, m.dur], this.pending.dir);
      this.pending = null;
    }
    // Distance assist: a move stretches its forward travel (up to 0.22 m, never back) so its first hit meets an
    // opponent standing just out of reach. Measured once at the start by posing the rig at the first hit.
    reachAssist(m, opp) {
      if (!opp || !m.hits.length || m.noAssist || m.hits[0].point === "path" || m.hits[0].auto) return 0;
      const h = m.hits[0], p = Object.assign({}, sample(m.keys, h.at));
      const travel = p.x; p.x = 0; p.z = 0;
      this.rig.bones.root.position.set(this.pos.x, this.y, this.pos.z); this.rig.bones.root.rotation.set(0, this.yaw, 0);
      T3.apply(this.rig.bones, this.B, p); T3.gripOffhand(this.rig.bones, this.B, p);
      const [a, b] = this.strikeSeg(h);
      let reach = 0;
      for (const q of [a, b]) reach = Math.max(reach, this.toLocal(q.x, q.z, this.yaw, this.pos.x, this.pos.z)[0]);
      reach += travel;
      const dist = Math.hypot(opp.pos.x - this.pos.x, opp.pos.z - this.pos.z) - 0.27 - (h.r || 0.14) * 0.5;
      this.solve(0);
      return clamp(dist - reach, 0, 0.22);
    }
    startClip(kind, clip, o) {
      this.state = "act";
      this.action = Object.assign({ kind, m: null, clip, t: 0, ox: this.pos.x, oz: this.pos.z, oyaw: this.yaw, lastX: 0, lastZ: 0 }, o || {});
      this.queue = null;
      this.startBlend(o && o.blend !== undefined ? o.blend : 0.03);
    }
    startDash(sign) {
      const L = this.loco;
      this.vel.addScaledVector(this.fwd, sign > 0 ? L.dash : -L.backdash);
      this.lock = sign > 0 ? 0.24 : 0.32; this.moveKind = sign > 0 ? "dash" : "backdash"; this.moveT = 0;
      this.emit("dash", { sign });
    }
    // Sidestep: a quick step around the opponent (into the background: -1, the foreground: +1, as seen by the
    // camera; the lab passes the camera side so up always means away from the camera).
    startSidestep(sign, opp) {
      const s = sign * (this.camSide || 1);
      this.vel.addScaledVector(this.right, s * this.loco.sidestep);
      this.lock = 0.26; this.moveKind = "sidestep"; this.moveT = 0; this.sideSign = s;
      this.emit("sidestep", { sign });
    }
    startJump(dir) {
      this.state = "air"; this.vy = this.loco.jumpV; this.y = 0.001;
      this.vel.copy(this.fwd).multiplyScalar(dir * 1.8);
      this.jumpDir = dir; this.startBlend(0.06);
      this.emit("jump", {});
    }

    // ---------- Taking hits ----------
    // Returns "hit", "block", "whiff".
    guardFor(level) {
      if (!(this.state === "free" || (this.state === "act" && (this.action.kind === "block" || this.action.kind === "crouchBlock")))) return false;
      const g = this.guard; // "stand", "crouch" or null
      if (!g) return false;
      if (level === "L") return g === "crouch";
      if (level === "H") return g === "stand";
      return g === "stand"; // mids beat a crouching guard
    }
    receive(hit, from) {
      const lvl = hit.level || "M";
      // A held body (a super's victim) takes every scripted hit; the last one sends it flying.
      if (this.held) return this.receiveHeld(hit, from);
      const inJuggle = this.state === "juggle", isDown = this.state === "down";
      if (isDown && !(hit.ground || lvl === "L")) return "whiff";
      if (!inJuggle && !isDown) {
        if (lvl === "H" && this.crouching) return "whiff";
        if (lvl === "L" && this.airborne) return "whiff";
      }
      if (!inJuggle && !isDown && !this.frozen && !hit.unblockable && this.guardFor(lvl)) {
        const crouchG = this.guard === "crouch";
        this.startClip(crouchG ? "crouchBlock" : "block", crouchG ? this.react.crouchBlock : this.react.block);
        this.stun = 0.18 + hit.dmg * 0.006;
        this.vel.addScaledVector(from.fwd, (hit.push || 0.8) * 1.4);
        return "block";
      }
      // A frozen body shatters out of the ice on the next hit (and takes it).
      if (this.frozen) { this.frozen = false; this.emit("shatter", {}); }
      // Counter hit: struck during the startup or active frames of an attack.
      const counter = this.attacking && this.action.t < (this.action.m.cancel || 0);
      let dmg = hit.dmg * (counter ? 1.25 : 1);
      if (inJuggle || isDown) dmg *= Math.pow(0.82, this.juggle);
      dmg = Math.max(1, Math.round(dmg));
      this.hp = Math.max(0, this.hp - dmg);
      this.lastDmg = dmg; this.lastCounter = counter;
      this.meter = Math.min(100, (this.meter || 0) + dmg * 0.5);
      if (from.isFighter) from.meter = Math.min(100, (from.meter || 0) + dmg * 0.35);
      let react = hit.react || "light";
      if (counter && react === "light") react = "heavy";
      if (this.hp <= 0 && react !== "launch") react = "knockdown";
      const away = from.fwd;
      if (inJuggle) {
        // Juggle: pop the airborne body again, a little less each time. A bound slams it into the floor, where it
        // bounces back up slowly (once per combo), so the combo can go on.
        this.juggle++;
        if (react === "bound" && !this.bounded) { this.bounded = true; this.boundPending = true; this.vy = -7.5; this.vel.copy(away).multiplyScalar(0.3); this.spin = (this.spin || 0) + 0.8; return "hit"; }
        this.vy = Math.max(this.vy, (hit.pop || 3.2) * Math.pow(0.86, this.juggle));
        this.vel.copy(away).multiplyScalar((hit.push || 0.8) * 0.9);
        if (react === "launch") this.vy = Math.max(this.vy, 5.2 * Math.pow(0.85, this.juggle));
        if (react === "knockdown" || react === "blast") { this.vy = Math.min(this.vy, 2.2); this.vel.copy(away).multiplyScalar((hit.push || 2) * 1.6); }
        this.spin = (this.spin || 0) + 0.6;
        return "hit";
      }
      if (isDown) {
        this.juggle++; this.state = "juggle"; this.y = 0.02; this.vel.copy(away).multiplyScalar(0.6);
        if (react === "bound" && !this.bounded) { this.bounded = true; this.vy = 4.4; } else this.vy = 1.6;
        return "hit";
      }
      if (react === "cine") {
        // A super connects: the victim is held for the scripted hits.
        this.held = true; this.heldBy = from; this.juggle = 0;
        this.startClip("held", this.react.held); this.stun = 99;
        this.vel.set(0, 0, 0);
        return "hit";
      }
      if (react === "freeze") {
        // Encased in ice: frozen in place for a moment, open to any follow-up.
        const p = Object.assign({}, this.pose); p.x = 0; p.z = 0;
        this.startClip("freeze", { dur: 0.95, keys: [[0, p, "inout"]] }, { blend: 0.01 }); this.stun = 0.95;
        this.frozen = true; this.emit("freeze", {});
        return "hit";
      }
      if (react === "bound") react = "knockdown";
      if (react === "launch" || react === "knockdown" || react === "sweep" || react === "blast") {
        this.state = "juggle"; this.action = null; this.juggle = 0; this.spin = 0;
        this.vy = react === "launch" ? (hit.pop || 6.2) : react === "sweep" ? 2.6 : react === "blast" ? 3.0 : 3.4;
        this.y = 0.02; this.vel.copy(away).multiplyScalar(react === "launch" ? 1.0 : (hit.push || 1.6) * (react === "blast" ? 2.4 : 1.4));
        this.fallKind = react; this.startBlend(0.05);
        return "hit";
      }
      const clip = react === "crumple" ? this.react.crumple : react === "spin" ? this.react.spin : react === "stagger" ? this.react.stagger : react === "heavy" ? this.react.heavy : this.react.light;
      this.startClip(react, clip);
      this.stun = react === "light" ? 0.3 : react === "heavy" ? 0.46 : react === "crumple" ? clip.dur : react === "spin" ? 0.7 : 0.7;
      this.vel.addScaledVector(away, (hit.push || 0.8) * (react === "light" ? 0.5 : react === "heavy" ? 0.8 : react === "crumple" ? 0.3 : 1.2));
      return "hit";
    }
    // Hits while held by a super: damage without scaling down to nothing, a flinch each time, the final hit's
    // reaction lets go.
    receiveHeld(hit, from) {
      const dmg = Math.max(1, Math.round(hit.dmg));
      this.hp = Math.max(0, this.hp - dmg); this.lastDmg = dmg; this.lastCounter = false;
      const react = hit.react || "light";
      if (react === "light" || react === "heavy" || react === "cine" || react === "stagger") {
        this.startClip("held", hit.react === "heavy" || hit.react === "stagger" ? this.react.heldHeavy : this.react.held, { blend: 0.02 }); this.stun = 99;
        this.vel.addScaledVector(from.fwd, (hit.push || 0.3) * 0.4);
        if (this.hp > 0) return "hit";
      }
      this.held = false; this.heldBy = null; this.state = "free"; this.action = null; this.stun = 0;
      return this.receive(Object.assign({}, hit, { level: "M", unblockable: true }), from);
    }

    // ---------- The step ----------
    update(dt, opp) {
      this.events.length = 0;
      this.t += dt;
      if (this.lock > 0) this.lock -= dt;
      this.moveT += dt;
      // Guard: the player guards by holding back (standing) or down-back (crouching); the lab sets dummy guards.
      if (this.side === 0 && this.inp) this.guard = this.inp.b ? (this.inp.d ? "crouch" : "stand") : null;
      // Facing: always toward the opponent when free; attacks only track as much as the move allows.
      const want = this.faceYaw(opp);
      const turn = (rate) => { let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += clamp(d, -rate * dt, rate * dt); };
      if (this.state === "free" || this.state === "air") turn(9);
      else if (this.state === "act" && this.action.kind === "move") {
        const m = this.action.m, firstHit = m.hits.length ? m.hits[0].at : 0;
        if (this.action.t < firstHit && m.track) { const before = this.yaw; turn(10); this.action.tracked += Math.abs(this.yaw - before); if (this.action.tracked > (m.track * Math.PI / 180)) this.yaw = before; }
      } else if (this.state === "act" && this.action.kind !== "move") turn(4);

      // A super's victim is let go if the attacker stops performing it.
      if (this.held && !(this.heldBy && this.heldBy.state === "act" && this.heldBy.action && this.heldBy.action.m && this.heldBy.action.m.super)) { this.held = false; this.heldBy = null; this.frozen = false; if (this.state === "act") this.endAction(0.1); }
      if (this.state === "free") this.stepFree(dt, opp);
      else if (this.state === "act") this.stepAct(dt, opp);
      else if (this.state === "air") this.stepAir(dt);
      else if (this.state === "juggle") this.stepJuggle(dt);
      else if (this.state === "down") this.stepDown(dt);

      // Ground slide and friction.
      this.pos.addScaledVector(this.vel, dt);
      if (this.state !== "air" && this.state !== "juggle") this.vel.multiplyScalar(Math.exp(-dt * (this.moveKind === "sidestep" && this.lock > 0 ? 6 : 9)));
      // Keep the two bodies apart (push boxes).
      const dx = this.pos.x - opp.pos.x, dz = this.pos.z - opp.pos.z, d = Math.hypot(dx, dz), minD = 0.62;
      if (d < minD && this.state !== "juggle" && opp.state !== "juggle" && d > 1e-4) { const k = (minD - d) / 2 / d; this.pos.x += dx * k; this.pos.z += dz * k; }
      // A juggled body drifts out in front of the attacker instead of passing over or behind them.
      if (opp.state === "juggle" && this.state !== "juggle" && d < 0.5 && d > 1e-4) { const k = (0.5 - d) / d * Math.min(1, dt * 20); opp.pos.x -= dx * k; opp.pos.z -= dz * k; }
      // Inside the ring.
      const r = Math.hypot(this.pos.x, this.pos.z); if (r > 6.2) this.pos.multiplyScalar(6.2 / r);
      this.solve(dt);
      for (const pr of this.projectiles) pr.step(dt, opp);
      for (let i = this.projectiles.length - 1; i >= 0; i--) if (this.projectiles[i].done) { this.projectiles[i].finish(); this.projectiles.splice(i, 1); }
    }

    stepFree(dt, opp) {
      const i = this.inp || {}, L = this.loco;
      // Crouch spring.
      const wantC = i.d && !i.shift && (this.dHeld < 0 || this.t - this.dHeld > 0.05) ? 1 : 0;
      this.crouchV += ((wantC - this.crouch) * 260 - this.crouchV * 26) * dt; this.crouch = clamp(this.crouch + this.crouchV * dt, -0.1, 1.05);
      // Walking: forward and back, 8-way with Shift (sidewalk around the opponent), crouch walk.
      let vf = 0, vs = 0;
      if (this.lock <= 0) {
        if (i.shift) { vf = (i.f ? 1 : i.b ? -1 : 0) * L.walkF * 0.85; vs = (i.u ? -1 : i.d ? 1 : 0) * L.side * (this.camSide || 1); const n = Math.hypot(vf, vs); if (n > L.side) { vf *= L.side / n; vs *= L.side / n; } }
        else if (this.crouch > 0.5) vf = i.f ? L.crouchWalk : 0;
        else vf = i.f ? L.walkF : i.b ? -L.walkB : 0;
      }
      const target = this.fwd.multiplyScalar(vf).addScaledVector(this.right, vs);
      // Walk speed eases in and out (weight).
      const k = 1 - Math.exp(-dt * 12 / L.weight);
      this.walkVel = (this.walkVel || V3(0, 0, 0)).lerp(target, k);
      this.pos.addScaledVector(this.walkVel, dt);
      // Lean into the motion, against the stop.
      const fv = this.walkVel.dot(this.fwd) + this.vel.dot(this.fwd), sv = this.walkVel.dot(this.right) + this.vel.dot(this.right);
      const leanT = clamp(fv * 4, -10, 16), rollT = clamp(sv * 4, -14, 14);
      this.leanV += ((leanT - this.lean) * 200 - this.leanV * 22) * dt; this.lean += this.leanV * dt;
      this.roll = lerp(this.roll, rollT, 1 - Math.exp(-dt * 10));
    }

    stepAct(dt, opp) {
      const a = this.action;
      a.t += dt;
      if (a.kind === "move") {
        const m = a.m;
        // Scripted events: projectiles, blinks, the weapon leaving or coming back to the hand, effects.
        if (m.events) for (let i = 0; i < m.events.length; i++) { const e = m.events[i]; if (a.evDone[i] || a.t < e.at) continue; a.evDone[i] = true; this.moveEvent(e, opp); }
        // Hits. Auto hits (a super's scripted hits) land on the held victim wherever the blade is.
        for (let hi = 0; hi < m.hits.length; hi++) {
          const h = m.hits[hi];
          if (a.hitDone[hi] || a.t < h.at || a.t > h.until + dt) continue;
          if (h.auto && !(opp.held && opp.heldBy === this)) continue;
          const pt = h.auto ? opp.rig.bones.chest.getWorldPosition(V3()) : this.touches(h, opp);
          if (pt) {
            a.hitDone[hi] = true;
            const res = opp.receive(h, this);
            if (res !== "whiff") this.emit(res, { hit: h, at: pt.clone(), m, counter: opp.lastCounter, dmg: opp.lastDmg });
          }
        }
        // String: the queued next move starts at the cancel point.
        if (this.queue && a.t >= m.cancel) { const next = this.list.moves[this.queue]; this.queue = null; if (next) { this.startMove(next, opp); return; } }
        if (a.t >= m.dur) { this.endAction(0.12); return; }
      } else {
        const done = a.t >= a.clip.dur && (a.kind === "getup" || a.t >= (this.stun || 0));
        if (done) {
          if (a.kind === "freeze") { this.frozen = false; this.emit("thaw", {}); }
          // A crumple ends lying on the floor.
          if (a.clip.then === "down") { this.state = "down"; this.action = null; this.downT = 0.25; this.stun = 0; this.startBlend(0.2); this.emit("thud", { soft: true }); return; }
          this.endAction(0.1); return;
        }
      }
      // Root motion from the clip's x and z (in the action's starting frame).
      const p = this.actionPose();
      if (a.extra && a.m && a.m.hits.length) p.x += a.extra * EASE.inout(clamp(a.t / a.m.hits[0].at, 0, 1));
      const ddx = p.x - a.lastX, ddz = p.z - a.lastZ; a.lastX = p.x; a.lastZ = p.z;
      const c = Math.cos(a.oyaw), s = Math.sin(a.oyaw);
      this.pos.x += ddx * c + ddz * s; this.pos.z += -ddx * s + ddz * c;
    }
    endAction(blend) {
      if (this.action && this.action.kind === "freeze" && this.frozen) { this.frozen = false; this.emit("thaw", {}); }
      this.state = "free"; this.action = null; this.stun = 0; this.bounded = false;
      this.feet = null; // re-plant from where the feet are now
      this.startBlend(blend);
    }
    stepAir(dt) {
      this.vy -= G * dt; this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.state = "free"; this.vel.multiplyScalar(0.3); this.crouch = 0.6; this.crouchV = -2; this.feet = null; this.startBlend(0.06); this.emit("land", {}); }
    }
    stepJuggle(dt) {
      this.vy -= G * dt; this.y += this.vy * dt;
      this.spin = (this.spin || 0) + dt * 2;
      if (this.y <= 0 && this.vy < 0) {
        this.y = 0;
        if (this.boundPending) { this.boundPending = false; this.vy = 6.0; this.y = 0.02; this.vel.multiplyScalar(0.4); this.emit("thud", { bound: true }); return; }
        if (this.vy < -3.5 && !this.bounced) { this.vy = -this.vy * 0.28; this.bounced = true; this.emit("thud", {}); return; }
        this.state = "down"; this.downT = 0; this.vy = 0; this.bounced = false; this.vel.multiplyScalar(0.2); this.emit("thud", { soft: true });
      }
    }
    stepDown(dt) {
      this.downT += dt;
      if (this.downT > 0.75 && this.hp > 0) { this.juggle = 0; this.bounded = false; this.startClip("getup", this.getupClip(), { blend: 0.08 }); }
    }
    getupClip() {
      const st = this.st, lie = this.lyingPose();
      return { dur: 0.5, keys: [[0, lie, "inout"], [0.22, P(st, { y: -0.6, hp: 30, sp: 20, kL: [80, 10, 0, 120], kR: [40, 10, 0, 140], ikL: 0.3, ikR: 0.3, aL: [-20, 30, 0, 20], aR: [-20, 30, 0, 20] }), "inout"], [0.5, P(st, {}), "inout"]] };
    }
    lyingPose() {
      return P(this.st, { y: 0.14 - this.B.hipH, hp: -90, sp: -6, cp: 0, dp: 10, ikL: 0, ikR: 0, kL: [10, 8, 0, 20], kR: [-4, 10, 0, 34], aL: [140, 60, 0, 20], aR: [150, 50, 0, 30], oL: 1, oR: 1 });
    }

    // ---------- Hit geometry ----------
    // The striking part as a segment [a, b] in world space: forearm and fist, shin and foot, the blade.
    strikeSeg(h) {
      const b = this.rig.bones, B = this.B, W = (bone, x, y, z) => bone.localToWorld(V3(x, y, z));
      switch (h.point) {
        case "wpn": case "wpnMid": {
          // From the hand to the tip: long weapons also hit at close range.
          const g = this.rig.weaponGroup, tip = g.userData.tip || V3(0.8, 0, 0);
          return [g.localToWorld(V3(0.05, 0, 0)), g.localToWorld(tip.clone())];
        }
        case "butt": {
          const g = this.rig.weaponGroup, butt = g.userData.butt || V3(-0.3, 0, 0);
          return [g.localToWorld(V3(0, 0, 0)), g.localToWorld(butt.clone())];
        }
        case "hL": case "hR": { const s = h.point[1]; return [W(b["fa" + s], 0, -B.fa * 0.6, 0), W(b["h" + s], 0, -B.hand * 0.6, 0)]; }
        case "hbL": case "hbR": { const s = h.point[2]; return [W(b["fb" + s], 0, -B.fa * 0.55, 0), W(b["hb" + s], 0, -B.hand * 0.6, 0)]; }
        case "ftL": case "ftR": { const s = h.point[2]; return [W(b["sn" + s], 0, -B.sh * 0.5, 0), W(b["ft" + s], B.foot * 0.6, -B.ankle * 0.4, 0)]; }
        case "knL": case "knR": { const s = h.point[2]; return [W(b["th" + s], 0, -B.th * 0.6, 0), W(b["sn" + s], 0.05, 0, 0)]; }
        case "elL": case "elR": { const s = h.point[2]; return [W(b["ua" + s], 0, -B.ua * 0.7, 0), W(b["fa" + s], -0.04, 0, 0)]; }
        case "path": { const k = this.action && this.action.blink; if (k) return [V3(k.from.x, 1.1, k.from.z), V3(k.to.x, 1.1, k.to.z)]; break; }
      }
      const p = W(b.hR, 0, -B.hand * 0.5, 0); return [p, p];
    }
    strikePoint(h) { return this.strikeSeg(h)[1]; }
    // Does the strike reach the opponent's body? The segment is sampled; the body is a vertical capsule standing,
    // lower when crouching, a big sphere around the hips when airborne in a juggle, a low slab when down.
    // Returns the contact point or null.
    touches(h, opp) {
      const [a, b] = this.strikeSeg(h), r = h.r || 0.14;
      const n = h.point === "path" ? 12 : 6;
      for (let i = n; i >= 0; i--) { const p = a.clone().lerp(b, i / n); if (opp.hitTest(p, r)) return p; }
      return null;
    }
    // Is point p (with radius r) inside this body? Standing: a vertical capsule (lower when crouching); in a
    // juggle: a big sphere around the hips; lying down: a low slab.
    hitTest(p, r) {
      if (this.state === "juggle") return p.distanceTo(this.rig.bones.hips.getWorldPosition(V3())) < 0.55 + r;
      const horiz = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
      if (this.state === "down") return horiz < 0.75 + r && p.y < 0.55;
      const top = this.crouching ? 1.08 : 1.86, vy = clamp(p.y, this.y, this.y + top);
      return Math.hypot(horiz, p.y - vy) < 0.23 + r;
    }

    // ---------- Move events: projectiles, blinks, the weapon, effects ----------
    moveEvent(e, opp) {
      const a = this.action;
      if (e.type === "spawn") this.spawn(e, opp);
      else if (e.type === "blink") {
        const from = this.pos.clone(), p = this.actionPose();
        let to;
        if (e.behind) { const d = V3().subVectors(opp.pos, this.pos).setY(0).normalize(); to = opp.pos.clone().addScaledVector(d, e.past || 0.85); }
        else to = this.pos.clone().addScaledVector(this.fwd, e.dx || 0).addScaledVector(this.right, e.dz || 0);
        to.y = 0; const rr = Math.hypot(to.x, to.z); if (rr > 6.2) to.multiplyScalar(6.2 / rr);
        this.pos.copy(to);
        if (e.face) this.yaw = this.faceYaw(opp);
        // Move the action's origin so the clip's travel and planted feet carry on from the new spot.
        const o = this.toWorld(-p.x, -p.z, this.yaw, to.x, to.z);
        a.ox = o[0]; a.oz = o[1]; a.oyaw = this.yaw; a.lastX = p.x; a.lastZ = p.z;
        a.blink = { from, to };
        this.emit("blink", { from, to });
      } else if (e.type === "weapon") this.rig.weaponGroup.visible = !!e.show;
      else if (e.type === "freezeOpp") { if (opp.held && opp.heldBy === this) { opp.frozen = true; opp.emit("freeze", {}); } }
      else if (e.type === "fx") {
        const at = e.from === "opp" ? opp.rig.bones.chest.getWorldPosition(V3()) : this.pointOf(e.from || "chest", e.off);
        this.emit("fx", { at, kind: e.kind, color: e.color, power: e.power || 1, wave: e.wave });
      } else if (e.type === "cam") this.emit("cam", e);
    }
    // A world point on the body: a bone name (hands give the fist), "wpn" (the weapon tip), "front" (off in the
    // fighter's frame: forward, up, right from the feet).
    pointOf(from, off) {
      const b = this.rig.bones, B = this.B;
      off = off || [0, 0, 0];
      if (from === "wpn") return this.rig.weaponGroup.localToWorld((this.rig.weaponGroup.userData.tip || V3(0.8, 0, 0)).clone());
      if (from === "hL" || from === "hR" || from === "hbL" || from === "hbR") return b[from].localToWorld(V3(0, -B.hand * 0.6, 0));
      if (from === "front") return this.pos.clone().addScaledVector(this.fwd, off[0]).add(V3(0, off[1], 0)).addScaledVector(this.right, off[2]);
      return (b[from] || b.chest).getWorldPosition(V3());
    }
    spawn(e, opp) {
      const fwd = this.fwd;
      let pos = this.pointOf(e.from || "front", e.off);
      if (e.from === "front" || !e.from) pos = this.pos.clone().addScaledVector(fwd, (e.off || [0.6])[0]).add(V3(0, (e.off || [0, 1.2])[1], 0)).addScaledVector(this.right, (e.off || [0, 0, 0])[2] || 0);
      if (e.ground) pos.y = 0;
      // At a spot ahead (pillars, spikes): e.dist meters ahead of the feet, or under the opponent if e.track.
      if (e.dist !== undefined) { pos = this.pos.clone().addScaledVector(fwd, e.dist); pos.y = e.y || 0; }
      if (e.track && opp) { const d = Math.hypot(opp.pos.x - this.pos.x, opp.pos.z - this.pos.z); if (d < (e.trackMax || 3.2)) { pos.x = opp.pos.x; pos.z = opp.pos.z; } }
      const vel = fwd.clone().multiplyScalar(e.speed || 0); vel.y = e.vy || 0;
      this.projectiles.push(new Projectile(this, e, pos, vel, this.action && this.action.m));
      this.emit("spawn", { at: pos.clone(), kind: e.kind });
    }
    clearProjectiles() { for (const p of this.projectiles || []) p.finish(true); this.projectiles = []; }
    clearTrails(dispose) { for (const k in this.trails || {}) { if (dispose && this.S) this.trails[k].dispose(this.S); else this.trails[k].clear(); } if (dispose) this.trails = {}; }

    // ---------- Poses ----------
    actionPose() {
      const a = this.action;
      if (a.kind === "move") return sample(a.m.keys, a.t);
      return sample(a.clip.keys, a.t);
    }
    // Target pose for this frame (before blending), with feet converted into the current root space.
    targetPose(dt) {
      const st = this.st;
      if (this.state === "act") {
        const p = Object.assign({}, this.actionPose());
        this.feetFromOrigin(p, this.action);
        return p;
      }
      if (this.state === "air") {
        const up = this.vy > 0, k = clamp(this.y / 0.9, 0, 1);
        return P(st, { y: 0, ikL: 0, ikR: 0, kL: [up ? 70 : 40, 6, 0, up ? 110 : 60], kR: [up ? 20 : 10, 8, 0, up ? 120 : 40], sp: 6, aL: [80, 20, 0, 90], aR: [60, 30, 0, 100], fL: [0, 0, 0, -30], fR: [0, 0, 0, -30], hp: up ? 6 * k : 0 });
      }
      if (this.state === "juggle") {
        const s = this.spin || 0, k = clamp(this.vy / 6, -1, 1);
        return P(st, { y: -0.4, hp: -70 - 20 * Math.sin(s) - (this.fallKind === "sweep" ? 20 : 0), sp: -10, dp: 20, ikL: 0, ikR: 0, kL: [40 + 30 * k, 10, 0, 60], kR: [10, 14, 0, 30 + 30 * k], aL: [150, 50, 0, 30], aR: [130, 60, 0, 40], oL: 1, oR: 1 });
      }
      if (this.state === "down") return this.lyingPose();
      return this.locoPose(dt);
    }
    // Feet given in the action's starting frame -> current root space.
    feetFromOrigin(p, a) {
      for (const s of ["L", "R"]) {
        if (p["ik" + s] < 0.001) continue;
        const w = this.toWorld(p["f" + s + 0], p["f" + s + 2], a.oyaw, a.ox, a.oz);
        const l = this.toLocal(w[0], w[1], this.yaw, this.pos.x, this.pos.z);
        p["f" + s + 0] = l[0]; p["f" + s + 2] = l[1];
      }
      // The pose's own x / z were consumed as travel.
      p.x = 0; p.z = 0;
    }
    // Free locomotion: the stance with crouch, lean, breathing and stepping feet (planted in the world).
    locoPose(dt) {
      const st = this.st, c = clamp(this.crouch, 0, 1.05), t = this.t;
      const p = P(st, {});
      p.y = lerp(st.y, -0.42, c) - 0.01 * Math.sin(t * 2.6);
      p.sp = st.sp + 14 * c + this.lean * 0.6; p.hp = st.hp + this.lean * 0.4; p.hr = st.hr + this.roll * 0.4; p.cr = st.cr + this.roll * 0.3;
      p.dp = st.dp - this.lean * 0.6 - 10 * c;
      p.cp = st.cp + 1.5 * Math.sin(t * 2.6 + 1);
      // Arms tighten in the crouch, guard rises when holding back.
      if (this.guard && this.side === 0) { p.aL0 += 12; p.aR0 += 12; p.aL3 += 6; }
      for (const f of ["aL0", "aR0"]) p[f] += 2 * Math.sin(t * 2.6 + (f === "aL0" ? 0 : 1.3));
      if (this.moveKind && this.lock > 0) {
        const k = clamp(this.lock / 0.3, 0, 1);
        if (this.moveKind === "dash") { p.sp += 14 * k; p.hp += 8 * k; p.y -= 0.06 * k; }
        if (this.moveKind === "backdash") { p.sp -= 6 * k; p.hp -= 8 * k; p.y -= 0.04 * k; }
        if (this.moveKind === "sidestep") { p.y -= 0.08 * k; p.hr += 8 * k * this.sideSign; p.sp += 6 * k; }
      }
      this.stepFeet(p, dt, c);
      return p;
    }
    // Feet planted in the world; a foot steps when it drifts too far from where the stance wants it.
    stepFeet(p, dt, c) {
      const st = this.st, wide = 0.05 * c;
      const want = { L: [st.fL0 - 0.02 * c, st.fL2 - wide], R: [st.fR0 + 0.02 * c, st.fR2 + wide] };
      if (!this.feet) {
        // Plant both feet where the pose currently has them.
        this.feet = {};
        for (const s of ["L", "R"]) {
          const lx = this.pose && this.pose["ik" + s] > 0.5 ? this.pose["f" + s + 0] : want[s][0], lz = this.pose && this.pose["ik" + s] > 0.5 ? this.pose["f" + s + 2] : want[s][1];
          const w = this.toWorld(lx, lz, this.yaw, this.pos.x, this.pos.z);
          this.feet[s] = { x: w[0], z: w[1], step: null };
        }
      }
      const vel = (this.walkVel || V3()).clone().add(this.vel);
      const speed = Math.hypot(vel.x, vel.z);
      for (const s of ["L", "R"]) {
        const F = this.feet[s], o = this.feet[s === "L" ? "R" : "L"];
        const w = this.toWorld(want[s][0], want[s][1], this.yaw, this.pos.x, this.pos.z);
        if (F.step) {
          F.step.t += dt / F.step.dur;
          // Re-aim the landing spot while the body keeps moving.
          F.step.x1 = w[0] + vel.x * 0.06; F.step.z1 = w[1] + vel.z * 0.06;
          if (F.step.t >= 1) { F.x = F.step.x1; F.z = F.step.z1; F.step = null; this.emit("step", { s }); }
        } else {
          const d = Math.hypot(F.x - w[0], F.z - w[1]);
          if (d > 0.09 && !o.step) {
            const dur = clamp(0.19 - speed * 0.02, 0.1, 0.19);
            F.step = { t: 0, dur, x0: F.x, z0: F.z, x1: w[0], z1: w[1] };
          }
        }
        let fx = F.x, fz = F.z, lift = 0, pitch = 0;
        if (F.step) {
          const u = EASE.inout(clamp(F.step.t, 0, 1));
          fx = lerp(F.step.x0, F.step.x1, u); fz = lerp(F.step.z0, F.step.z1, u);
          lift = Math.sin(Math.PI * clamp(F.step.t, 0, 1)) * (0.05 + 0.02 * Math.min(1, speed));
          pitch = -10 * Math.sin(Math.PI * clamp(F.step.t, 0, 1));
        }
        const l = this.toLocal(fx, fz, this.yaw, this.pos.x, this.pos.z);
        p["f" + s + 0] = l[0]; p["f" + s + 1] = lift; p["f" + s + 2] = l[1]; p["f" + s + 3] = (s === "R" ? st.fR3 : st.fL3) + pitch;
        p["ik" + s] = 1;
      }
      // The body dips a little while a foot is in the air.
      if (this.feet.L.step || this.feet.R.step) p.y -= 0.015;
    }

    // Blend, apply to the skeleton, floor guard, visuals.
    solve(dt) {
      let p = this.targetPose(dt);
      if (this.blendFrom && this.blendT < this.blendDur) {
        this.blendT += dt;
        p = blend(this.blendFrom, p, EASE.inout(clamp(this.blendT / this.blendDur, 0, 1)));
      }
      this.pose = p;
      const root = this.rig.bones.root;
      root.position.set(this.pos.x, this.y, this.pos.z);
      root.rotation.set(0, this.yaw, 0);
      T3.apply(this.rig.bones, this.B, p);
      T3.gripOffhand(this.rig.bones, this.B, p);
      // Floor guard: no foot below the floor while grounded.
      if (this.state !== "juggle" && this.state !== "down") {
        const lo = T3.lowestFoot(this.rig.bones, this.B);
        if (lo < 0) { root.position.y -= lo; root.updateMatrixWorld(true); }
      } else if (this.state === "down" || this.state === "juggle") {
        // A lying or tumbling body never sinks below the floor either: lift by its lowest joint.
        let lo = Infinity; for (const k of ["head", "hips", "chest", "hL", "hR", "snL", "snR", "ftL", "ftR"]) lo = Math.min(lo, this.rig.bones[k].getWorldPosition(V3()).y);
        if (lo < 0.06) { root.position.y += 0.06 - lo; root.updateMatrixWorld(true); }
      }
      this.rig.shadow.position.set(this.pos.x, 0.004, this.pos.z);
      this.rig.shadow.scale.setScalar(clamp(1 - root.position.y * 0.3, 0.5, 1));
    }
    visuals(dt, t) {
      (Fighter.models || T3M).update(this.rig, this.pose, dt, t, V3(-this.fwd.x * 2, 0, -this.fwd.z * 2));
      if (!this.S) return;
      // Trails: the striking part of a move draws a ribbon from a little before its hit until just after.
      if (dt > 0) {
        const live = {};
        const a = this.state === "act" && this.action && this.action.kind === "move" ? this.action : null;
        if (a) for (const h of a.m.hits) {
          if (h.point === "path" || h.auto) continue;
          const lead = h.trailLead !== undefined ? h.trailLead : 0.08;
          if (a.t < h.at - lead || a.t > h.until + 0.05) continue;
          const key = h.point === "wpnMid" ? "wpn" : h.point;
          if (live[key]) continue;
          const [p0, p1] = this.strikeSeg(h);
          const k = a.t < h.at ? 0.4 + 0.6 * (1 - (h.at - a.t) / lead) : a.t > h.until ? Math.max(0, 1 - (a.t - h.until) / 0.05) : 1;
          live[key] = [p0, p1, k];
        }
        for (const key in live) {
          if (!this.trails[key]) this.trails[key] = new T3S.Trail(this.S, key === "wpn" || key === "butt" ? (this.rig.weaponGroup.userData.trail || 0xffffff) : (this.def.color || 0xffffff), key === "wpn" ? 12 : 8);
          let [p0, p1, k] = live[key];
          // Limb trails are a narrow ribbon along the last part of the limb.
          if (key !== "wpn" && key !== "butt") p0 = p0.clone().lerp(p1, 0.55);
          this.trails[key].push(p0, p1, k);
        }
        for (const key in this.trails) if (!live[key]) { const tr = this.trails[key]; if (tr.mesh.visible) { const last = tr.pts[0]; tr.push(last.a, last.b, 0); } }
      }
      for (const pr of this.projectiles) pr.draw(dt, t);
      // The ice shell while frozen.
      if (this.frozen && !this.shell) { this.shell = T3S.projMesh(this.S, "shell"); }
      if (this.shell) { if (!this.frozen) { T3S.removeMesh(this.S, this.shell); this.shell = null; } else { this.shell.group.position.set(this.pos.x, this.y, this.pos.z); this.shell.group.rotation.y = this.yaw; } }
    }
  }
  // The model set the fighters are built from: T3M (the 3D Lab) unless a page sets another (roster3d.html sets R3M).
  Fighter.models = null;
  return { Fighter, Projectile, LOCO, dirOf };
})();
