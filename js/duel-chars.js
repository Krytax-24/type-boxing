// The 2D fighters in the main game (namespace DuelChars). Visual only: this file reads the duel (fighter
// states, typists, power) and never writes to it, so the rules in duel.js stay the same with or without it.
// Each typist gets a puppet: a Move.Character from the Animation Lab (anim-move.js) dressed as one of the
// designed fighters (anim-chars.js). The duel's visual state drives the puppet:
//   a finished word (fighter.moveCount goes up) -> the next attack from that typist's random combo stream
//   (Combo2D.stream); a long word prefers the heavy attack; a new combo level ends the combo on the knockdown
//   the puppet's own impact frame -> the other puppet reacts: hit or stagger when the attacker has more power
//   (the hit really lands), a parry when the defender's power holds (the blocked part of the rule)
//   the ultimate (move "special") -> Combo2D.ultimate at speed, afterimages, then the launch (state "air")
//   plays the knockdown; the K.O. plays the death; the winner taunts
// Three stages use it: the duel, the title screen sparring loop and the Fighter screen preview.
const DuelChars = (() => {
  const STEP = 1 / 120;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const snd = (stage, name, k) => { if (stage.audible && typeof Sfx !== "undefined") Sfx.play(name, k); };

  // The sound of a hit comes from the drawn weapon (a whip on sword moves, pistols on bare-hand moves).
  const DRAW_SOUND = { cyberSword: "slash", katana: "slash", whip: "whip", bat: "bat", staff: "staff", axe: "axe", reaverAxe: "axe", warHammer: "hammer", pistols: "gun" };
  const hitSound = (def) => DRAW_SOUND[def.weaponDraw] || "punch";
  const defOf = (key) => Chars.DEFS[key] || Chars.DEFS[Chars.ORDER[0]];

  // Effect switches from the Graphics tab (visual only; set by main.js with setFx). Every one defaults to on.
  const FXO = { sparks: true, smears: true, afterimages: true, dust: true, glow: true, budget: 400 };
  function setFx(o) { Object.assign(FXO, o); }

  // ---------- One fighter ----------
  class Puppet {
    constructor(key, x, facing, seed) {
      const def = defOf(key);
      this.def = def;
      this.key = def.key;
      this.ch = new Move.Character(def.weapon, def.gender, x, facing, def.prof);
      this.ch.pup = this;
      this.cloth = Chars.makeCloth(def);
      this.clothReady = false;
      this.stream = Combo2D.stream(def.weapon, seed >>> 0);
      this.seed = seed >>> 0;
      this.trails = [[], [], [], []];
      this.ghosts = [];
      this.ghostT = 0;
      this.flash = 0;
      this.heat = 0;
      this.z = 0;
      this.S = null;
      this.want = [];      // attacks waiting for the current one to reach its cancel window
      this.fin = false;    // the attack playing is a combo finisher (its knockdown really knocks down)
      this.ult = false;    // playing the ultimate
      this.opp = null;
      this.glow = null;    // identity color, "r, g, b"
    }
    get trail() { return this.def.trail || "255, 255, 255"; }
  }

  // Can this puppet start a new attack now?
  function canAct(ch) {
    if (ch.dead || ch.state !== "ground" || ch.turnT >= 0) return false;
    const a = ch.action;
    if (!a) return true;
    const c = a.c;
    if (c.idleBreak) return true;
    if (c.react) return c.lockUntil !== undefined && c.id !== "death" && a.u >= c.lockUntil;
    if (c.cancelAt !== undefined) return a.u >= c.cancelAt;
    return a.u >= 0.85;
  }
  function startClip(p, name, speed) {
    const ch = p.ch, c = ch.clips[name];
    if (!c) return false;
    if (ch.action && ch.action.c.idleBreak) ch.action = null;
    ch.queue = []; ch.comboName = null; ch.buffer = null;
    ch.startAction(c, speed);
    return true;
  }

  // ---------- A stage: puppets, their effects and their drawing ----------
  class Stage {
    constructor(opt) {
      opt = opt || {};
      this.p = [];
      this.parts = [];
      this.acc = 0;
      this.time = 0;
      this.freeze = 0;     // a short hit-stop on the puppets only
      this.shake = 0;
      this.audible = !!opt.audible;
      this.judge = null;   // (attacker) -> "hit" | "block" | null; null: no reaction
    }

    setPuppets(specs) {
      this.p = specs.map((s) => new Puppet(s.key, s.x, s.facing, s.seed || 1));
      this.p.forEach((p, i) => { p.side = i; p.glow = specs[i].glow || null; p.home = specs[i].x; });
      if (this.p.length === 2) {
        this.p[0].opp = this.p[1]; this.p[1].opp = this.p[0];
        this.p[0].ch.target = this.p[1].ch; this.p[1].ch.target = this.p[0].ch;
      }
      this.parts = [];
      this.freeze = 0;
    }
    keys() { return this.p.map((p) => p.key).join(); }

    // ----- effects -----
    sparks(x, y, n, color, size) {
      if (!FXO.sparks) return;
      for (let i = 0; i < n; i++) {
        const a = rnd(0, Math.PI * 2);
        this.parts.push({ k: "spark", x, y, a, sp: rnd(160, 520) * (size || 1), len: rnd(8, 20) * (size || 1), life: rnd(0.16, 0.3), age: 0, color });
      }
      this.parts.push({ k: "flash", x, y, r: 22 * (size || 1), life: 0.1, age: 0 });
    }
    dust(x, n, spread, dir, size) {
      if (!FXO.dust) return;
      for (let i = 0; i < n; i++) this.parts.push({ k: "dust", x: x + rnd(-spread, spread) * 0.3, y: -rnd(0, 6), vx: dir * rnd(20, 90) + rnd(-spread, spread), vy: -rnd(10, 50), r: rnd(3, 7) * (size || 1), vr: rnd(10, 26), life: rnd(0.35, 0.6), age: 0 });
    }
    ring(x, w, life) { if (FXO.dust) this.parts.push({ k: "ring", x, y: 0, w, life: life || 0.45, age: 0 }); }
    fire(x, y, n, dir, size) {
      if (!FXO.sparks) return;
      for (let i = 0; i < n; i++) this.parts.push({ k: "fire", x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: dir * rnd(80, 260) + rnd(-40, 40), vy: -rnd(30, 140), r: rnd(5, 11) * (size || 1), life: rnd(0.25, 0.5), age: 0 });
    }
    ice(x, y, n) {
      if (!FXO.sparks) return;
      for (let i = 0; i < n; i++) { const a = rnd(Math.PI * 1.05, Math.PI * 1.95); this.parts.push({ k: "ice", x, y, vx: Math.cos(a) * rnd(60, 260), vy: Math.sin(a) * rnd(60, 260), r: rnd(2, 5), rot: rnd(0, 6), life: rnd(0.4, 0.8), age: 0 }); }
    }
    star(x, y) { if (!FXO.sparks) return; this.parts.push({ k: "star", x, y, life: 0.3, age: 0 }); this.sparks(x, y, 8, "255, 245, 210", 0.7); }
    muzzle(p) {
      const h = p.S.J.fh, x = h[0] + p.ch.facing * 26, y = h[1] - 4;
      if (FXO.sparks) this.parts.push({ k: "flash", x, y, r: 16, life: 0.07, age: 0 });
      this.sparks(x, y, 4, "255, 214, 90", 0.5);
    }

    // Where a strike lands: the tip of the active blade, the fist, the knee or foot, or the spell orb.
    strikePoint(p) {
      const ch = p.ch, S = p.S, c = ch.action ? ch.action.c : null, u = ch.action ? ch.action.u : 0;
      if (c && c.id === "a4" && ch.gender === "M" && ch.weapon === "fists") return S.J.fk;
      if (c && c.orb) return S.J.orb;
      if (c && !c.trails.length) return S.J.ft;
      const tr = c ? c.trails.find(([t0, t1]) => u >= t0 - 0.05 && u <= t1 + 0.05) || c.trails[0] : null;
      const pts = Rig.trailPoints(S, ch.weapon);
      return (pts[tr ? tr[2] : 0] || pts[0])[0];
    }

    // Animation events from a puppet (anim-clips.js event names).
    event(p, name) {
      if (!p.S) return;
      const S = p.S, ch = p.ch, draw = p.def.weaponDraw;
      const low = S.J.ff[1] > S.J.bf[1] ? S.J.ff : S.J.bf;
      switch (name) {
        case "step": if (ch.spd > 60) this.dust(low[0], 1, 16, -Math.sign(ch.vx), 0.6); break;
        case "dust": this.dust(low[0], 5, 40, -ch.facing); break;
        case "landSoft": this.dust(S.J.hip[0], 3, 50, 0, 0.8); snd(this, "land", 0); break;
        case "land": this.dust(S.J.hip[0], 8, 90, 0); this.ring(S.J.hip[0], 60); this.shake = Math.max(this.shake, 2.5); snd(this, "land", 1); break;
        case "thud": this.dust(S.J.hip[0], 10, 110, 0); this.shake = Math.max(this.shake, 4); snd(this, "thud"); break;
        case "slam": { const q = this.strikePoint(p); this.dust(q[0], 10, 120, 0); this.ring(q[0], 90, 0.5); this.shake = Math.max(this.shake, 4); break; }
        case "impact": this.impact(p); break;
        case "parry": { const q = this.strikePoint(p); this.star(q[0] + ch.facing * 6, q[1]); snd(this, "parry"); break; }
        case "hurt": p.flash = 0.1; break;
        case "tap": this.dust(this.strikePoint(p)[0], 2, 20, 0, 0.6); break;
        case "whirl": snd(this, "whoosh", 1); break;
        case "roar": this.shake = Math.max(this.shake, 3); snd(this, "thud"); break;
        case "frost": {
          const q = this.strikePoint(p);
          if (draw === "axe") { this.ice(q[0], Math.min(q[1], -4), 16); this.ring(q[0], 110, 0.55); snd(this, "frost"); }
          else { this.dust(q[0], 10, 120, 0); this.ring(q[0], 110, 0.55); this.sparks(q[0], -6, 10, p.trail, 1.1); this.shake = Math.max(this.shake, 4); snd(this, draw === "warHammer" ? "hammer" : "thud"); }
          break;
        }
        case "blast": { const h = S.J.orb; this.fire(h[0], h[1], 16, ch.facing, 1.4); p.heat = 1; snd(this, "flame"); break; }
        case "pillar": { const q = this.strikePoint(p); for (let i = 0; i < 4; i++) this.fire(q[0], -10 - i * 26, 5, 0, 0.8); p.heat = 1; snd(this, "flame"); break; }
        case "flare": { const h = ch.weapon === "flame" ? S.J.orb : S.J.fh; this.fire(h[0], h[1] - 6, 8, 0, 0.7); p.heat = 1; break; }
      }
    }

    // A strike reaches the other puppet: it lands (hit or stagger, or the knockdown for a finisher) or is parried.
    impact(p) {
      const q = this.strikePoint(p), o = p.opp, c = p.ch.action ? p.ch.action.c : null;
      const draw = p.def.weaponDraw;
      if (draw === "pistols") this.muzzle(p);
      const reach = (Anim.W[p.ch.weapon] || {}).reach || 120;
      const verdict = o && !o.ch.dead && Math.abs(o.ch.x - p.ch.x) < reach + 140 && this.judge ? this.judge(p) : null;
      if (!verdict) { this.sparks(q[0], q[1], 3, p.trail, 0.5); snd(this, "whoosh", 0); return; }
      const ox = o.ch.x, px = c && c.orb ? (p.ch.facing > 0 ? Math.min(q[0], ox) : Math.max(q[0], ox)) : q[0];
      const hx = lerp(px, ox, 0.4), hy = Math.min(q[1], -50);
      if (verdict === "block") {
        // The defender's power holds: a parry, unless it is in the middle of its own attack (then a clash).
        if (!o.ult && canAct(o.ch) && !(o.ch.action && o.ch.action.c.react)) startClip(o, "parry", 1.4);
        this.star(lerp(hx, ox, 0.3), hy);
        this.freeze = Math.max(this.freeze, 0.03);
        snd(this, "parry");
        return;
      }
      let type = (c && c.hitType) || "hit";
      if (type === "knockdown" && !p.fin && !p.ult) type = "hitHeavy";
      const big = type === "hit" ? 0 : type === "hitHeavy" ? 1 : 2;
      const oc = o.ch.action && o.ch.action.c;
      const down = oc && (oc.id === "knockdown" || oc.id === "death") && o.ch.action.u < 0.85;
      if (!o.ult && !down) o.ch.play(type);
      o.flash = 0.1;
      this.sparks(hx, hy, 10 + 5 * big, p.trail, 1 + 0.3 * big);
      if (p.ch.weapon === "flame") { this.fire(hx, hy, 12 + 6 * big, p.ch.facing); p.heat = 1; }
      if (draw === "axe") this.ice(hx, hy, 8 + 6 * big);
      if (draw === "warHammer") { this.ring(hx, 70 + 30 * big, 0.45); this.dust(hx, 5 + 4 * big, 60, 0); }
      this.freeze = Math.max(this.freeze, 0.04 + 0.03 * big);
      this.shake = Math.max(this.shake, 2 + 2.5 * big);
      snd(this, hitSound(p.def), big / 2);
      if (draw !== "pistols") snd(this, "hurt");
    }

    // ----- fixed steps -----
    step(dt, inputs) {
      this.time += dt;
      for (const [i, p] of this.p.entries()) {
        const ch = p.ch, prevClip = ch.action ? ch.action.c : null, prevU = ch.action ? ch.action.u : 0, prevX = ch.x;
        ch.update(dt, inputs ? inputs[i] : {}, (c, name) => this.event(c.pup, name));
        if (p.ult && !ch.action) p.ult = false;
        if (!ch.action) p.fin = false;
        p.flash = Math.max(0, p.flash - dt);
        p.heat = Math.max(0, p.heat - dt * 2.5);
        const S = ch.solve(0);
        p.S = S;
        const vel = (ch.x - prevX) / dt;
        if (!p.clothReady) { Chars.resetCloth(p.cloth, S); p.clothReady = true; for (let k = 0; k < 60; k++) Chars.stepCloth(p.cloth, S, 1 / 120, 0, k / 120, 0); }
        Chars.stepCloth(p.cloth, S, dt, 0, this.time, vel);
        if (FXO.sparks && p.def.weaponDraw === "axe" && Math.random() < 0.2) { const q = Rig.trailPoints(S, "axe")[0][0]; this.parts.push({ k: "ice", x: q[0] + rnd(-8, 8), y: q[1] + rnd(-8, 8), vx: rnd(-20, 20), vy: rnd(-30, 10), r: rnd(1, 2.2), rot: 0, life: rnd(0.3, 0.6), age: 0 }); }
        this.trailStep(p, dt, prevClip, prevU);
        // Afterimages during the ultimate and a dash.
        for (const g of p.ghosts) g.life -= dt * 4.2;
        p.ghosts = p.ghosts.filter((g) => g.life > 0);
        p.ghostT -= dt;
        const gw = ch.action && ch.action.c.ghosts;
        if (FXO.afterimages && ((p.ult && ch.action) || (gw && ch.action.u >= gw[0] && ch.action.u <= gw[1]))) {
          if (p.ghostT <= 0) { p.ghostT = 0.035; p.ghosts.push({ S, life: 1 }); }
        }
      }
      // Bodies do not overlap.
      if (this.p.length === 2) {
        const [a, b] = this.p, d = b.ch.x - a.ch.x, min = 64;
        if (Math.abs(d) < min && a.ch.state !== "air" && b.ch.state !== "air") {
          const s = Math.sign(d) || 1, fix = (min - Math.abs(d)) / 2;
          a.ch.x -= s * fix; b.ch.x += s * fix;
        }
      }
    }
    trailStep(p, dt, prevClip, prevU) {
      for (const h of p.trails) for (const e of h) e.life -= dt * 4.5;
      p.trails = p.trails.map((h) => h.filter((e) => e.life > 0).slice(-40));
      const ch = p.ch;
      if (!ch.action) return;
      const c = ch.action.c;
      if (!c.trails.length) return;
      const u0 = prevClip === c ? prevU : 0, u1 = ch.action.u;
      for (const [t0] of c.trails) if (t0 > u0 && t0 <= u1) snd(this, "whoosh", c.hitType === "hit" ? 0 : 1);
      for (let i = 1; i <= 3; i++) {
        const u = u0 + ((u1 - u0) * i) / 3;
        const active = c.trails.filter(([t0, t1]) => u >= t0 && u <= t1);
        if (!active.length) continue;
        const S = Rig.solve(ch.clipPoseAt(u), ch.x, 0, ch.facing, ch.B);
        const pts = Rig.trailPoints(S, ch.weapon);
        for (const [, , b] of active) if (pts[b]) p.trails[b].push({ tip: pts[b][0], base: pts[b][1], life: 1 });
      }
    }

    // Advance by a frame's dt (0 when paused): fixed steps, a puppet-only hit-stop, effects aging.
    advance(dt, inputsFn) {
      let adt = dt;
      if (this.freeze > 0) { this.freeze -= dt; adt = 0; }
      this.acc = Math.min(this.acc + adt, 0.1);
      while (this.acc >= STEP) { this.acc -= STEP; this.step(STEP, inputsFn ? inputsFn() : null); }
      const edt = this.freeze > 0 ? dt * 0.25 : dt;
      for (const q of this.parts) {
        q.age += edt;
        if (q.k === "dust") { q.x += q.vx * edt; q.y += q.vy * edt; q.vx *= Math.pow(0.1, edt); q.vy *= Math.pow(0.2, edt); q.r += q.vr * edt; }
        if (q.k === "spark") { q.x += Math.cos(q.a) * q.sp * edt; q.y += Math.sin(q.a) * q.sp * edt; q.sp *= Math.pow(0.02, edt); }
        if (q.k === "fire") { q.x += q.vx * edt; q.y += q.vy * edt; q.vx *= Math.pow(0.05, edt); q.vy -= 60 * edt; }
        if (q.k === "ice") { q.x += q.vx * edt; q.y += q.vy * edt; q.vy += 600 * edt; q.rot += 8 * edt; if (q.y > 0) { q.y = 0; q.vy *= -0.3; q.vx *= 0.6; } }
      }
      this.parts = this.parts.filter((q) => q.age < q.life);
      if (this.parts.length > FXO.budget) this.parts.splice(0, this.parts.length - FXO.budget);
      this.shake = Math.max(0, this.shake - dt * 24);
    }

    // ----- drawing (world x, the floor at y 0; the caller translates) -----
    draw(ctx, opt) {
      opt = opt || {};
      const shadow = opt.shadow || "rgba(0, 0, 0, 0.45)";
      ctx.save();
      const sk = this.shake * (opt.shakeScale === undefined ? 1 : opt.shakeScale); // the player's shake intensity
      if (sk && !opt.noShake) ctx.translate(rnd(-1, 1) * sk, rnd(-1, 1) * sk * 0.6);
      // The attacker is drawn last, so its strike reads in front.
      const order = this.p.slice().sort((a, b) => (a.ch.action && !a.ch.action.c.react ? 1 : 0) - (b.ch.action && !b.ch.action.c.react ? 1 : 0));
      for (const p of order) {
        const S = p.S;
        if (!S) continue;
        const z = p.z || 0;
        ctx.fillStyle = shadow;
        ctx.globalAlpha = Math.max(0.15, 1 - z / 260);
        const h = -S.J.hip[1] + z, w = Math.max(12, 38 - Math.max(0, h - 60) / 5);
        ctx.beginPath(); ctx.ellipse(S.J.hip[0], 2, w, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(0, -z);
        if (FXO.afterimages) for (const g of p.ghosts) Chars.draw(ctx, g.S, p.def, [], { ghost: `rgba(${p.ult ? "255, 197, 61" : p.trail}, 1)`, alpha: g.life * 0.22 });
        if (p.glow && !opt.noGlow && FXO.glow) {
          // Identity glow: a soft halo in the typist's color, so both read on the dark arena.
          ctx.save();
          ctx.shadowColor = `rgba(${p.glow}, 0.6)`;
          ctx.shadowBlur = 9 * (opt.res || 1);
          Chars.draw(ctx, S, p.def, [], { ghost: `rgba(${p.glow}, 1)`, alpha: 0.4 });
          ctx.restore();
        }
        Chars.draw(ctx, S, p.def, p.cloth, { t: this.time, heat: p.heat, flash: p.flash > 0 });
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        if (FXO.smears) for (const h2 of p.trails) Rig.drawTrail(ctx, h2, `rgba(${p.trail}, 1)`);
        ctx.restore();
        ctx.restore();
      }
      this.drawParts(ctx);
      ctx.restore();
    }
    drawParts(ctx) {
      for (const q of this.parts) {
        const k = q.age / q.life;
        ctx.save();
        if (q.k === "dust") { ctx.fillStyle = `rgba(150, 160, 190, ${(0.45 * (1 - k)).toFixed(3)})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill(); }
        if (q.k === "spark") {
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = `rgba(${q.color}, ${1 - k})`; ctx.lineWidth = 2.5 * (1 - k) + 0.5; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - Math.cos(q.a) * q.len, q.y - Math.sin(q.a) * q.len); ctx.stroke();
        }
        if (q.k === "flash") { ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - k)})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (0.6 + k), 0, Math.PI * 2); ctx.fill(); }
        if (q.k === "ring") { ctx.strokeStyle = `rgba(200, 210, 240, ${0.6 * (1 - k)})`; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(q.x, 2, 10 + q.w * k * 1.6, 3 + 10 * k, 0, 0, Math.PI * 2); ctx.stroke(); }
        if (q.k === "star") {
          ctx.translate(q.x, q.y); ctx.rotate(k * 1.2); ctx.fillStyle = `rgba(255, 250, 225, ${1 - k})`;
          const r = 24 * (0.5 + k);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.18 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          ctx.closePath(); ctx.fill();
        }
        if (q.k === "fire") {
          ctx.globalCompositeOperation = "lighter";
          const r = q.r * (1 - 0.5 * k), g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
          g.addColorStop(0, `rgba(200, 235, 255, ${0.9 * (1 - k)})`); g.addColorStop(0.5, `rgba(90, 139, 255, ${0.6 * (1 - k)})`); g.addColorStop(1, "rgba(60, 80, 255, 0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
        }
        if (q.k === "ice") {
          ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = `rgba(190, 240, 255, ${1 - k})`; ctx.strokeStyle = `rgba(80, 170, 230, ${1 - k})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0, -q.r * 1.6); ctx.lineTo(q.r * 0.7, 0); ctx.lineTo(0, q.r * 1.6); ctx.lineTo(-q.r * 0.7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`; };

  // ---------- The duel stage ----------
  // keys: [your fighter, the bot's fighter]; glows: [your color, the bot's color] as #rrggbb.
  const duelStage = new Stage({ audible: true });
  let duelSrc = null, duelKeys = "", koAt = -1;
  function syncDuel(duel, keys, glows) {
    const fs = duel.fighters;
    if (duelSrc === fs[0] && duelKeys === keys.join()) return;
    duelSrc = fs[0]; duelKeys = keys.join(); koAt = -1;
    const seed = (duel.seed || 1) >>> 0;
    duelStage.setPuppets(fs.map((f, i) => ({ key: keys[i], x: f.x, facing: f.facing, seed: seed + 101 * i, glow: glows && glows[i] ? hexRgb(glows[i]) : null })));
    duelStage.p.forEach((p, i) => { p.mc = fs[i].moveCount; p.lastCombo = 0; p.wasAir = false; p.wasDead = false; p.taunted = false; });
    // Judge a strike by the rule's own numbers at that moment: the attacker's power beats the defender's,
    // the hit lands; otherwise the defender's guard holds. Visual only.
    duelStage.judge = (p) => {
      if (!duel.typists || duel.phase === "menu" || duel.phase === "countdown") return null;
      if (p.ult) return "hit";
      const i = p.side;
      if (duel.fighters[1 - i].dead) return "hit";
      return duel.power[i] - duel.power[1 - i] > 0.5 ? "hit" : "block";
    };
  }

  function driveDuel(duel, now) {
    const fs = duel.fighters;
    duelStage.p.forEach((p, i) => {
      const f = fs[i], t = duel.typists[i], ch = p.ch;
      if (t.comboLevel < p.lastCombo) p.lastCombo = t.comboLevel;
      if (f.moveCount !== p.mc) {
        p.mc = f.moveCount;
        if (f.move === "special") {
          // The ultimate: a fast run through every attack, with afterimages.
          p.want = [];
          if (ch.action && !ch.dead) ch.action = null;
          ch.playSeq(Combo2D.ultimate(p.def.weapon, p.seed + p.mc), null, 1.3);
          p.ult = true;
          if (FXO.sparks) duelStage.parts.push({ k: "flash", x: ch.x, y: -90, r: 70, life: 0.25, age: 0 });
        } else if (f.move) {
          let kind = null;
          if (t.comboLevel > p.lastCombo) { kind = "finisher"; p.lastCombo = t.comboLevel; }
          else if (f.move === "heavy") kind = "heavy";
          p.want.push({ mv: p.stream.next(kind), fin: kind === "finisher", at: now });
          if (p.want.length > 2) p.want.shift();
        }
      }
      // Launch, K.O. and getting up follow the duel's fighter state.
      const air = f.state === "air";
      if (f.dead && !p.wasDead) { p.wasDead = true; p.want = []; p.ult = false; ch.play("death"); if (koAt < 0) koAt = now; }
      else if (air && !p.wasAir && !f.dead) { p.want = []; ch.play("knockdown"); }
      p.wasAir = air;
      p.z = f.state === "air" ? f.z : 0;
      // Waiting attacks start as soon as the current one has landed (its cancel window); a backlog speeds up.
      p.want = p.want.filter((w) => now - w.at < 1.2);
      if (p.want.length && !p.ult && canAct(ch)) {
        const w = p.want.shift();
        if (startClip(p, w.mv, Math.min(2, 1.2 + 0.35 * p.want.length))) p.fin = w.fin;
      }
      // The winner taunts after the K.O.
      if (duel.phase === "over" && duel.result && duel.result.winner === i && !p.taunted && koAt >= 0 && now - koAt > 1.1 && !ch.action) {
        p.taunted = true; ch.play("taunt");
      }
    });
  }
  // Walk toward the duel's position (the tug pushes the fighters); snap when far (a new match, a launch).
  function duelInputs(duel) {
    return duelStage.p.map((p, i) => {
      const f = duel.fighters[i], ch = p.ch, d = f.x - ch.x;
      if (f.state === "air" || f.state === "down" || f.dead) { ch.x += d * 0.08; return {}; }
      if (Math.abs(d) > 220) { ch.x = f.x; return {}; }
      if (ch.action || Math.abs(d) < 10) return {};
      return { move: Math.sign(d), run: Math.abs(d) > 90 };
    });
  }

  function drawDuel(ctx, duel, offX, floorY, dt, keys, glows, opt) {
    syncDuel(duel, keys, glows);
    const now = duelStage.time;
    driveDuel(duel, now);
    // The duel's hit-stop freezes the puppets too, except a fighter in the middle of an ultimate.
    const frozen = duel.hitstop > 0 && !duelStage.p.some((p) => p.ult);
    duelStage.advance(frozen ? 0 : dt, () => duelInputs(duel));
    ctx.save();
    ctx.translate(offX, floorY);
    duelStage.draw(ctx, opt);
    ctx.restore();
  }

  // ---------- The title screen: two fighters spar, slow and harmless ----------
  const sparStage = new Stage({ audible: false });
  let sparKeys = "", sparT = 0, sparTurn = 0, sparSeed = 7;
  function drawSpar(ctx, keys, cx, floorY, dt, glows, opt) {
    if (sparKeys !== keys.join()) {
      sparKeys = keys.join(); sparT = 1.2;
      sparStage.setPuppets([
        { key: keys[0], x: -70, facing: 1, seed: 11, glow: glows && glows[0] ? hexRgb(glows[0]) : null },
        { key: keys[1], x: 70, facing: -1, seed: 23, glow: glows && glows[1] ? hexRgb(glows[1]) : null },
      ]);
      sparStage.judge = () => (Math.random() < 0.55 ? "block" : "hit");
    }
    sparT -= dt;
    if (sparT <= 0) {
      const a = sparStage.p[sparTurn % 2];
      sparTurn++; sparSeed++;
      if (canAct(a.ch)) a.ch.playSeq(Combo2D.random(a.def.weapon, sparSeed, { len: 3 }), null, 0.95);
      sparT = 2.6;
    }
    sparStage.advance(dt, () => sparStage.p.map((p) => {
      const d = p.home - p.ch.x;
      return p.ch.action || Math.abs(d) < 8 ? {} : { move: Math.sign(d) };
    }));
    ctx.save();
    ctx.translate(cx, floorY);
    sparStage.draw(ctx, opt);
    ctx.restore();
  }

  // ---------- The Fighter screen: one fighter shows off its random combos ----------
  const previewStage = new Stage({ audible: false });
  let previewKey = "", previewT = 0, previewN = 0;
  function drawPreview(canvas, key, dt, reduceMotion) {
    if (previewKey !== key) {
      previewKey = key; previewT = 0.9; previewN = 0;
      previewStage.setPuppets([{ key, x: 0, facing: 1, seed: 5 }]);
    }
    previewT -= dt;
    const p = previewStage.p[0];
    if (previewT <= 0 && !reduceMotion) {
      previewN++;
      if (previewN % 3 === 0) p.ch.play("taunt");
      else p.ch.playSeq(Combo2D.random(p.def.weapon, 300 + previewN, { len: 3 + (previewN % 2) }), null, 1);
      previewT = 3.2;
    }
    previewStage.advance(dt, () => [p.ch.action || Math.abs(p.ch.x) < 6 ? {} : { move: -Math.sign(p.ch.x) }]);
    const ctx = canvas.getContext("2d"), H = 320, k = canvas.height / H, W = canvas.width / k;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const floorY = H - 54, x = W * 0.4;
    const A = CONFIG.theme.arena;
    ctx.strokeStyle = A.floorLine; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, floorY); ctx.lineTo(W - 20, floorY); ctx.stroke();
    ctx.save();
    ctx.translate(x, floorY);
    ctx.scale(1.25, 1.25);
    previewStage.draw(ctx, { noShake: true, shadow: A.shadow });
    ctx.restore();
  }

  // The fighter a bot plays as: its own, or the next in the roster when it is yours.
  function botKey(want, mine) {
    const O = Chars.ORDER;
    let k = O.includes(want) ? want : O[0];
    if (k === mine) k = O[(O.indexOf(k) + 1) % O.length];
    return k;
  }

  return { Stage, Puppet, drawDuel, drawSpar, drawPreview, botKey, defOf, duelStage, sparStage, previewStage, setFx, FXO };
})();
