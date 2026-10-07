// Movement for the Animation Lab: a character controller plus procedural locomotion.
// The controller (state, speed, jump physics, turning) is separate from the look (the pose it produces).
// Locomotion is not a canned clip: every frame the feet are placed from a gait cycle driven by distance
// travelled, the legs reach them by two-bone IK, and the hip height, lean and arm swing follow from speed,
// acceleration and the body's style. So feet stay planted, walk blends into run with no seam, walking
// backward plays the cycle in reverse, and a male and a female fighter move differently.
// Attacks and other actions are eased key clips (anim-clips.js) blended over the locomotion.
const Move = (() => {
  const { clamp, lerp } = Rig;
  const DEG = Math.PI / 180, TAU = Math.PI * 2;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const frac = (v) => v - Math.floor(v);
  const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

  // Speeds in drawing units per second (a standing fighter is about 165 units tall).
  const SPEED = { walk: 120, back: 92, run: 340, crouch: 66, air: 430, dash: 640, backDash: 470 };

  // Movement style per body. Cycle = distance for one full gait cycle (two steps). d = share of the cycle a
  // foot is on the ground (walk > 0.5: double support; run < 0.5: a flight phase). H = hip height as a share
  // of the leg length. M: heavier, wider, slower breathing, drives with the shoulders. F: lighter and quicker,
  // narrower stance, longer stride for her height, hips lead (pelvis twist, weight shift), higher heel kick.
  const STYLE = {
    M: { walkCycle: 126, runCycle: 256, crouchCycle: 84, walkLift: 8, runLift: 28, dWalk: 0.6, dRun: 0.37,
      walkH: 0.93, runH: 0.91, crouchH: 0.58, runBob: 5, walkLean: 4, runLean: 14, backLean: -4,
      stance: [23, -22], breathRate: 0.26, breath: 1.9, sway: 1.4, swayRate: 0.21, bounce: 3.2, bounceRate: 1.75,
      pelvis: 1.4, chest: 3.4, armSwing: 1.0, leanK: 1.15, accel: 1250, decel: 1650, skid: 1500,
      jumpV: 530, landK: 1.15, turnDur: 0.18, tempo: 1.0, lead: 0 },
    F: { walkCycle: 120, runCycle: 248, crouchCycle: 80, walkLift: 7.5, runLift: 36, dWalk: 0.62, dRun: 0.35,
      walkH: 0.94, runH: 0.92, crouchH: 0.6, runBob: 4.5, walkLean: 1.5, runLean: 10, backLean: -6,
      stance: [16, -15], breathRate: 0.32, breath: 1.4, sway: 3.4, swayRate: 0.26, bounce: 4.2, bounceRate: 2.2,
      pelvis: 3.6, chest: 1.3, armSwing: 0.78, leanK: 0.85, accel: 1550, decel: 1950, skid: 1800,
      jumpV: 560, landK: 0.85, turnDur: 0.14, tempo: 0.88, lead: 1 },
  };

  // Stance per weapon: hip height in the guard, base lean, and whether the idle is a boxer's bounce.
  const STANCE = {
    fists: { hk: 0.86, lean: 12, bounce: 1 },
    sword: { hk: 0.85, lean: 9, bounce: 0 },
    bat: { hk: 0.88, lean: 7, bounce: 0 },
    staff: { hk: 0.86, lean: 8, bounce: 0 },
    axe: { hk: 0.8, lean: 14, bounce: 0 },
    flame: { hk: 0.87, lean: 9, bounce: 1 },
    dance: { hk: 0.9, lean: 2, bounce: 0 },
  };

  // Arm sets per weapon (absolute angles): guard, relaxed walk (free facing), run with the front arm
  // forward (runF) and back (runB), crouch, air (rise, tuck, fall), dash, skid.
  const AF = ["fa0", "fa1", "ba0", "ba1", "w", "w2", "grip", "fc0", "fc1", "bc0", "bc1", "ox", "oy", "os"];
  // fc / bc: the second pair of arms (four-armed bodies); other bodies ignore them.
  const arm = (s) => ({ fa0: s.fa[0], fa1: s.fa[1], ba0: s.ba ? s.ba[0] : -100, ba1: s.ba ? s.ba[1] : -60, w: s.w || 0, w2: s.w2 || 0, grip: s.grip || 0,
    fc0: s.fc ? s.fc[0] : -70, fc1: s.fc ? s.fc[1] : 10, bc0: s.bc ? s.bc[0] : -95, bc1: s.bc ? s.bc[1] : -5,
    ox: s.o ? s.o[0] : 30, oy: s.o ? s.o[1] : 105, os: s.o ? s.o[2] || 1 : 1 });
  const ARMS = {
    fists: {
      guard: arm({ fa: [-35, 72], ba: [-58, 84] }),
      relax: arm({ fa: [-78, -18], ba: [-96, -30] }),
      runF: arm({ fa: [-30, 52], ba: [-150, -70] }), runB: arm({ fa: [-140, -62], ba: [-42, 44] }),
      crouch: arm({ fa: [-18, 80], ba: [-42, 90] }),
      rise: arm({ fa: [62, 102], ba: [44, 92] }), tuck: arm({ fa: [6, 84], ba: [-6, 76] }), fall: arm({ fa: [42, 18], ba: [104, 66] }),
      dash: arm({ fa: [-24, 66], ba: [-52, 78] }), skid: arm({ fa: [10, 40], ba: [40, 90] }),
    },
    sword: {
      guard: arm({ fa: [-52, 6], w: 42, ba: [-118, -66] }),
      relax: arm({ fa: [-84, -64], w: 202, ba: [-96, -46] }),
      runF: arm({ fa: [-118, -140], w: 192, ba: [-34, 40] }), runB: arm({ fa: [-104, -124], w: 200, ba: [-140, -74] }),
      crouch: arm({ fa: [-36, 14], w: 22, ba: [-126, -70] }),
      rise: arm({ fa: [40, 70], w: 62, ba: [-40, 40] }), tuck: arm({ fa: [0, 30], w: 40, ba: [-60, 20] }), fall: arm({ fa: [20, 0], w: -18, ba: [-20, 30] }),
      dash: arm({ fa: [-150, -168], w: 184, ba: [-150, -150] }), skid: arm({ fa: [-20, 30], w: 170, ba: [60, 110] }),
    },
    // Two-handed weapons hold the back hand on the shaft by IK (grip = distance behind the front hand).
    bat: {
      guard: arm({ fa: [-124, 76], w: 112, grip: 12 }),
      relax: arm({ fa: [-118, 74], w: 150, grip: 12 }),
      runF: arm({ fa: [-112, 78], w: 148, grip: 12 }), runB: arm({ fa: [-122, 70], w: 154, grip: 12 }),
      crouch: arm({ fa: [-118, 72], w: 108, grip: 12 }),
      rise: arm({ fa: [20, 92], w: 128, grip: 12 }), tuck: arm({ fa: [0, 72], w: 120, grip: 12 }), fall: arm({ fa: [-20, 44], w: 100, grip: 12 }),
      dash: arm({ fa: [-84, -48], w: 182, grip: 12 }), skid: arm({ fa: [-10, 62], w: 140, grip: 12 }),
    },
    staff: {
      guard: arm({ fa: [-30, 8], w: 18, grip: 46 }),
      relax: arm({ fa: [-76, -22], w: 92, grip: 26 }),
      runF: arm({ fa: [-50, -30], w: 8, grip: 44 }), runB: arm({ fa: [-44, -24], w: 13, grip: 44 }),
      crouch: arm({ fa: [-20, 0], w: 6, grip: 46 }),
      rise: arm({ fa: [40, 60], w: 40, grip: 46 }), tuck: arm({ fa: [0, 20], w: 20, grip: 46 }), fall: arm({ fa: [-10, -20], w: -10, grip: 46 }),
      dash: arm({ fa: [-60, -10], w: 0, grip: 44 }), skid: arm({ fa: [-10, 20], w: 30, grip: 46 }),
    },
    axe: {
      guard: arm({ fa: [-50, 30], w: 62, grip: 40 }),
      relax: arm({ fa: [-60, 72], w: 150, grip: 30 }),
      runF: arm({ fa: [-60, -8], w: 40, grip: 40 }), runB: arm({ fa: [-55, -3], w: 45, grip: 40 }),
      crouch: arm({ fa: [-30, 40], w: 52, grip: 40 }),
      rise: arm({ fa: [60, 90], w: 110, grip: 40 }), tuck: arm({ fa: [20, 60], w: 80, grip: 40 }), fall: arm({ fa: [0, -20], w: 20, grip: 40 }),
      dash: arm({ fa: [-70, -30], w: 0, grip: 40 }), skid: arm({ fa: [0, 40], w: 90, grip: 40 }),
    },
    // Nova: the spell orb (o: [forward, height, size]) hovers over her front palm and trails her when she runs.
    flame: {
      guard: arm({ fa: [-36, 30], ba: [-70, 58], o: [40, 102, 1] }),
      relax: arm({ fa: [-60, 10], ba: [-96, -30], o: [32, 104, 0.9] }),
      runF: arm({ fa: [-30, 52], ba: [-150, -70], o: [-26, 126, 0.9] }), runB: arm({ fa: [-140, -62], ba: [-42, 44], o: [-28, 122, 0.9] }),
      crouch: arm({ fa: [-22, 40], ba: [-48, 70], o: [42, 74, 1] }),
      rise: arm({ fa: [62, 102], ba: [44, 92], o: [24, 128, 1] }), tuck: arm({ fa: [6, 84], ba: [-6, 76], o: [30, 108, 1] }), fall: arm({ fa: [42, 18], ba: [104, 66], o: [34, 96, 1] }),
      dash: arm({ fa: [-24, 40], ba: [-60, 60], o: [-30, 100, 0.9] }), skid: arm({ fa: [10, 40], ba: [40, 90], o: [50, 120, 1] }),
    },
    // Four arms: the upper pair high (as in the design), the lower pair out low.
    dance: {
      guard: arm({ fa: [50, 128], ba: [104, 46], fc: [-26, 6], bc: [-150, -176] }),
      relax: arm({ fa: [40, 120], ba: [110, 52], fc: [-60, -20], bc: [-120, -150] }),
      runF: arm({ fa: [30, 110], ba: [120, 60], fc: [-20, 10], bc: [-150, -170] }), runB: arm({ fa: [60, 136], ba: [96, 40], fc: [-50, -10], bc: [-130, -160] }),
      crouch: arm({ fa: [30, 116], ba: [96, 40], fc: [-16, 14], bc: [-156, -178] }),
      rise: arm({ fa: [80, 120], ba: [100, 60], fc: [10, 40], bc: [170, 150] }), tuck: arm({ fa: [40, 110], ba: [110, 60], fc: [-20, 20], bc: [-160, -170] }),
      fall: arm({ fa: [60, 30], ba: [120, 150], fc: [-40, -60], bc: [-140, -120] }),
      dash: arm({ fa: [20, 100], ba: [140, 100], fc: [-30, 0], bc: [-170, -180] }), skid: arm({ fa: [70, 130], ba: [100, 60], fc: [0, 40], bc: [-130, -150] }),
    },
  };
  // Secondary motion stiffness per field (higher = tighter follow). Upper arms tighter than forearms and weapon.
  // The second arm pair is a little looser than the first, so the four arms settle at different moments.
  // The orb (ox, oy) floats on a soft spring: it drifts after her hand.
  const SEC = { fa0: 900, ba0: 700, fa1: 520, ba1: 420, w: 480, w2: 420, head: 260, spine: 300, fc0: 620, fc1: 340, bc0: 540, bc1: 300, ox: 160, oy: 160 };
  const mixA = (a, b, k) => { const o = {}; for (const f of AF) o[f] = lerp(a[f], b[f], k); return o; };
  const addA = (a, d) => { const o = Object.assign({}, a); for (const f in d) o[f] += d[f]; return o; };

  // Leg IK in body space (y up, x forward): angles for a thigh and shin reaching from `hip` to `ankle`, knee forward.
  function legIK(B, hip, ankle) {
    const a = B.thigh, b = B.shin;
    let dx = ankle[0] - hip[0], dy = ankle[1] - hip[1], d = Math.hypot(dx, dy);
    // Soft reach cap: past 94.5% of the leg length the reach is compressed toward 98%, so the knee never locks
    // straight (near full extension the knee angle changes very fast, which reads as a pop).
    const r = d / (a + b), r0 = 0.945, span = 0.035;
    if (r > r0) { const rr = r0 + span * Math.tanh((r - r0) / span); dx *= rr / r; dy *= rr / r; d = rr * (a + b); }
    d = Math.max(d, Math.abs(a - b) + 1);
    const base = Math.atan2(dy, dx), al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const k = Math.cos(base + al) > Math.cos(base - al) ? base + al : base - al;
    const kn = [hip[0] + a * Math.cos(k), hip[1] + a * Math.sin(k)];
    return [k / DEG, Math.atan2(hip[1] + dy - kn[1], hip[0] + dx - kn[0]) / DEG];
  }
  // How far the lowest point of the sole drops below the ankle at foot pitch p (toe for p < 0, heel for p > 0).
  const sole = (B, p) => (p < 0 ? B.foot * Math.sin(-p * DEG) : 3.5 * Math.sin(p * DEG));
  // Floor guard: if any sole would go below the floor, lift the hip by that much (any pose, any blend).
  function floorGuard(B, p) {
    if (Math.abs(p.rot) > 1 || Math.abs(p.sq) > 0.001) return;
    const sin = (d) => Math.sin(d * DEG);
    const reach = (a, b) => -B.thigh * sin(a) - B.shin * sin(b);
    const hipH = lerp(Math.max(reach(p.fl0, p.fl1), reach(p.bl0, p.bl1)), B.hipBase, clamp(p.air, 0, 1)) + p.y;
    const low = Math.min(hipH + B.thigh * sin(p.fl0) + B.shin * sin(p.fl1) - sole(B, p.ffa || 0),
      hipH + B.thigh * sin(p.bl0) + B.shin * sin(p.bl1) - sole(B, p.bfa || 0));
    if (low < 0) p.y -= low;
  }
  // A smooth minimum: the hip drops gently as a planted foot nears the end of its reach (the walk's bob).
  const softmin = (a, b, k) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));

  // Leg fields for given foot positions: f, b = [x, height] of each ankle relative to the floor point under
  // the hip; H = hip height. Sets air = 1 and y so Rig.solve puts the hip exactly at H.
  function legs(B, H, f, b, pel, fp, bp) {
    pel = pel || 0;
    const L = legIK(B, [pel, H], f), R = legIK(B, [-pel, H], b);
    return { air: 1, y: H - B.hipBase, fl0: L[0], fl1: L[1], bl0: R[0], bl1: R[1], ffa: fp || 0, bfa: bp || 0, pel };
  }

  // ---------- The character ----------
  class Character {
    // prof (optional): a designed character's profile { key, body: overrides of Rig.BODY, style: overrides of STYLE }.
    constructor(weapon, gender, x, facing, prof) {
      this.x = x; this.facing = facing;
      this.mode = "lock"; this.target = null;
      this.setLook(weapon, gender, prof);
      this.reset();
    }
    setLook(weapon, gender, prof) {
      this.weapon = weapon; this.gender = gender; this.prof = prof || null;
      this.B = bodyOf(gender, prof); this.St = styleOf(gender, prof);
      this.Sn = STANCE[weapon] || STANCE.sword; this.A = ARMS[weapon] || ARMS.sword;
      this.clips = Anim.clips(weapon, gender, prof);
      this.legL = this.B.thigh + this.B.shin;
    }
    reset() {
      this.vx = 0; this.ax = 0; this.state = "ground"; this.action = null; this.queue = [];
      this.crouch = 0; this.crouchV = 0; this.lean = this.baseLean(); this.leanV = 0;
      this.phase = 0; this.spd = 0; this.jumpY = 0; this.vy = 0; this.t = Math.random() * 3;
      this.turnT = -1; this.dashT = 0; this.dashDur = 0.3; this.dashBack = false; this.skid = 0; this.skidding = false;
      this.runJump = 0; this.airT = 0; this.preT = 0; this.buffer = null;
      this.pose = null; this.from = null; this.blendT = 0; this.blendDur = 0;
      this.label = "idle"; this.locoName = "Idle";
      this.sec = null; this.secOff = {}; this.pending = []; this.prevRaw = null; this.idleT = 0; this.nextBreak = 6 + Math.random() * 3; this.breakIdx = 0; this.airAttacked = false;
    }
    baseLean() { return this.Sn.lean * this.St.leanK; }
    get grounded() { return this.state === "ground" || this.state === "prejump"; }
    get busy() { return !!this.action; }
    get dead() { return !!(this.action && this.action.c.id === "death"); }

    // Snapshot the current pose and blend from it over `dur` seconds (any change of pose source).
    xfade(dur) { if (this.pose) { this.from = Object.assign({}, this.pose); this.fromNorm = false; this.blendT = 0; this.blendDur = dur; } }

    // ----- Commands -----
    play(name, fx) {
      const c = this.clips[name];
      if (!c || (this.dead && name !== "death")) return false;
      // A fighter who is staggered or knocked down cannot act until it has recovered (lockUntil), and death
      // holds until a reset. Reactions can still follow reactions.
      const cur = this.action && this.action.c;
      if (cur && cur.lockUntil !== undefined && !c.react && this.action.u < cur.lockUntil) { this.buffer = { name, t: 0.3 }; return false; }
      // Cancel window: a new attack waits until the current one has landed its hit, then starts at once and
      // blends over the recovery (the moves overlap instead of queueing to the very end).
      if (cur && !c.react && !cur.react && !cur.idleBreak && cur.cancelAt !== undefined && this.action.u < cur.cancelAt) { this.buffer = { name, t: 0.7 }; return false; }
      // Reactions (hit, knockdown, death) happen at once: they cancel a turn in progress (no facing flip).
      if (c.react) { this.turnT = -1; this.buffer = null; }
      else if (this.state === "air") {
        // An attack in the air becomes the weapon's air attack (one per jump).
        const air = this.clips.air;
        if (air && /^a[1-4]$|^combo$/.test(name) && !this.airAttacked && !this.action) { this.airAttacked = true; this.queue = []; this.comboName = null; this.startAction(air, 1); return true; }
        if (!this.airAttacked) this.buffer = { name, t: 0.25 };
        return false;
      } else if (this.state === "prejump" || this.turnT >= 0) { this.buffer = { name, t: 0.3 }; return false; }
      if (this.action && this.action.c.idleBreak) this.action = null;
      if (c.seq) { this.queue = c.seq.slice(1); this.comboName = name; this.startAction(this.clips[c.seq[0]], 1.2); return true; }
      this.queue = []; this.comboName = null;
      this.startAction(c, 1);
      return true;
    }
    startAction(c, speed) {
      this.turnT = -1; this.skidding = false;
      // Momentum: an attack out of a run or a dash keeps sliding forward and loses speed gradually.
      const carry = this.state === "ground" && !c.react && (Math.abs(this.vx) > 150 || this.dashT > 0) ? this.vx : 0;
      this.dashT = 0;
      this.xfade(c.blendIn !== undefined ? c.blendIn : carry ? 0.1 : 0.06);
      this.action = { c, t: 0, u: 0, lastX: c.keys[0][1].x, speed: speed / (c.tempo === false ? 1 : this.St.tempo), carry, extra: this.reachAdjust(c) };
      this.idleT = 0;
    }
    // Distance: in lock-on, an attack stretches or shortens its forward travel (before the hit) so the strike
    // meets the target instead of hitting air or overlapping it. Up to 40 units more, never backward.
    reachAdjust(c) {
      if (this.mode !== "lock" || !this.target || c.react || c.air || c.ranged || !c.events.some((e) => e[1] === "impact")) return 0;
      const ui = c.events.find((e) => e[1] === "impact")[0];
      if (c._reach === undefined) {
        const S = Rig.solve(this.clipPose(c, ui), 0, 0, 1, this.B), J = S.J;
        let far = Math.max(J.fh[0], J.bh[0], J.ft[0], J.fk[0]);
        const W = Rig.WEAPONS[this.weapon];
        if (W && !W.fists) far = Math.max(far, Rig.trailPoints(S, this.weapon)[0][0][0] - 12);
        if (c.orb) far = J.orb[0] - 6;
        c._reach = far; c._ui = ui;
      }
      const dist = (this.target.x - this.x) * this.facing;
      if (dist <= 0 || dist > c._reach + 160) return 0;
      return clamp(dist - 24 - c._reach, -Math.max(0, this.clipPose(c, ui).x), 40);
    }
    dash(dir, fx) {
      if (!this.grounded || this.action || this.dead) return;
      if (this.turnT >= 0) { this.buffer = { dash: dir, t: 0.3 }; return; }
      this.dashBack = dir !== this.facing;
      this.dashDur = this.dashBack ? 0.3 : 0.28;
      this.dashT = this.dashDur;
      this.vx = dir * (this.dashBack ? SPEED.backDash : SPEED.dash) * (this.St.speedK || 1);
      this.crouchV += this.dashBack ? -2 : 4;
      this.state = "ground";
      this.xfade(0.08);
      if (fx) fx(this, "dust");
    }
    startTurn() { if (this.turnT < 0) this.turnT = 0; }

    // ----- One step. inp: { move: -1/0/1, run, crouch, jump (held), jumpPressed } -----
    update(dt, inp, fx) {
      if (dt <= 0) return;
      const St = this.St, prevVx = this.vx;
      inp = inp || {};
      this.t += dt;
      if (this.buffer && (this.buffer.t -= dt) <= 0) this.buffer = null;

      // Facing: lock-on looks at the target; free facing looks where you move (a run reversal skids first).
      if (this.turnT >= 0) {
        this.turnT += dt / (this.state === "air" ? 0.11 : St.turnDur);
        if (this.turnT >= 1) { this.facing *= -1; this.turnT = -1; this.phase += 0.5; }
      }
      if (this.mode === "free" && this.state === "ground" && !this.action && inp.move && Math.sign(this.vx) === -inp.move && Math.abs(this.vx) > 210) {
        if (!this.skidding && fx) fx(this, "skid");
        this.skidding = true;
      }
      if (this.skidding && (Math.abs(this.vx) < 70 || this.state !== "ground" || this.action)) this.skidding = false;
      let want = 0;
      if (this.mode === "lock" && this.target) { const d = this.target.x - this.x; if (Math.abs(d) > 14) want = Math.sign(d); }
      else if (this.mode === "free" && !this.skidding) want = inp.move || 0;
      const facingNow = this.turnT >= 0 ? -this.facing : this.facing;
      if (want && want !== facingNow && !this.action && this.dashT <= 0 && this.turnT < 0) this.startTurn();

      // Horizontal speed.
      const g = this.grounded;
      const fwdDir = this.turnT >= 0 ? -this.facing : this.facing;
      if (this.action && this.action.c.air) { /* air attack: keep the jump's momentum */ }
      else if (this.action) this.vx = this.action.carry ? approach(this.vx, 0, 650 * dt) : approach(this.vx, 0, 2600 * dt);
      else if (this.dashT > 0) {
        this.dashT -= dt;
        this.vx = approach(this.vx, 0, (this.dashBack ? 1100 : 1500) * dt);
        if (this.dashT <= 0) this.xfade(0.12);
      } else if (g) {
        const m = inp.move || 0;
        let tgt = 0;
        if (m && !this.skidding) {
          const fwd = m === fwdDir;
          const sp = this.crouch > 0.5 ? SPEED.crouch : fwd ? (inp.run ? SPEED.run : SPEED.walk) : SPEED.back;
          tgt = m * sp * (this.St.speedK || 1);
        }
        const speedingUp = Math.abs(tgt) > Math.abs(this.vx) && Math.sign(tgt) !== -Math.sign(this.vx);
        const rate = this.skidding ? St.skid : speedingUp ? St.accel : St.decel;
        this.vx = approach(this.vx, tgt, rate * dt);
      } else if (inp.move) {
        const tgt = inp.move * SPEED.air;
        if (Math.sign(tgt) !== Math.sign(this.vx) || Math.abs(this.vx) < Math.abs(tgt) * 0.7)
          this.vx = approach(this.vx, inp.move * Math.max(Math.abs(this.vx), SPEED.walk), 520 * dt);
      }
      this.x += this.vx * dt;
      const ax = (this.vx - prevVx) / dt;
      this.ax += (ax - this.ax) * Math.min(1, dt * 14);

      // Jump: a short crouch (anticipation), then physics. Holding the key keeps gravity low on the way up
      // (a higher jump); falling is faster than rising, which reads as weight.
      if (inp.jumpPressed && this.state === "ground" && !this.action && this.dashT <= 0) { this.state = "prejump"; this.preT = 0; this.skidding = false; }
      if (this.state === "prejump") {
        this.preT += dt;
        if (this.preT >= 0.075) {
          this.state = "air"; this.airT = 0;
          this.runJump = Math.abs(this.vx) > 200 ? 1 : 0;
          this.vy = St.jumpV * (this.runJump ? 1.04 : 1) * (inp.jump === false ? 0.75 : 1);
          this.jumpY = 0.01;
          this.xfade(0.12);
          if (fx) fx(this, "dust");
        }
      } else if (this.state === "air") {
        this.airT += dt;
        const grav = this.vy > 0 && inp.jump ? 1350 : 2500;
        if (this.vy > 0 && !inp.jump && !this.cut) { this.vy *= 0.55; this.cut = true; }
        this.vy -= grav * dt;
        this.jumpY += this.vy * dt;
        if (this.jumpY <= 0 && this.vy < 0) {
          const impact = -this.vy;
          this.jumpY = 0; this.vy = 0; this.state = "ground"; this.cut = false;
          this.crouchV += impact * 0.016 * St.landK;
          this.phase = Math.round(this.phase * 2) / 2 + 0.02;
          this.xfade(0.1);
          if (fx) fx(this, impact > 620 ? "land" : "landSoft");
          this.airAttacked = false;
          if (this.action && this.action.c.air) { this.action = null; this.xfade(0.1); }
        }
      }
      if (this.state !== "air") this.cut = false;

      // Crouch spring (slightly underdamped: a landing dips and recovers with a little overshoot).
      let ct = inp.crouch && g && !this.action ? 1 : 0;
      if (this.state === "prejump") ct = 0.42;
      if (this.dashT > 0) ct = Math.max(ct, this.dashBack ? 0.1 : 0.3);
      const k = 330, damp = 2 * Math.sqrt(k) * 0.72;
      this.crouchV += (k * (ct - this.crouch) - damp * this.crouchV) * dt;
      this.crouch = clamp(this.crouch + this.crouchV * dt, -0.25, 1.15);

      // Gait phase advances with distance along the facing (backward = the cycle runs in reverse).
      const vloc = this.vx * this.facing;
      this.spd += (Math.abs(vloc) - this.spd) * Math.min(1, dt * 10);
      if (this.state === "ground" && !this.action) {
        const c = clamp(this.crouch, 0, 1), runK = this.runK(c);
        const Lc = lerp(lerp(St.walkCycle, St.runCycle, runK), St.crouchCycle, c);
        const before = this.phase;
        this.phase += (vloc * dt) / Lc * (this.dashT > 0 ? 0.25 : 1);
        if (this.spd > 30 && fx && Math.floor(before * 2) !== Math.floor(this.phase * 2)) fx(this, "step");
      }

      // Lean spring: base lean, plus speed (forward runs lean in, backing away leans back), plus acceleration
      // (lean into a start, back on a stop), crouch and skid. A little overshoot gives follow-through.
      const c1 = clamp(this.crouch, 0, 1), runK = this.runK(c1), walkK = sstep(0, SPEED.walk * 0.7, this.spd);
      let lt = this.baseLean();
      if (this.state === "air") lt += (this.vy > 0 ? -4 : 6) + this.runJump * 10;
      else {
        lt += vloc >= 0 ? walkK * St.walkLean * (1 - runK) + runK * St.runLean : walkK * St.backLean;
        lt += clamp(this.ax * this.facing * 0.004, -7, 7) + c1 * 11;
        if (this.skidding) lt -= 24;
        if (this.dashT > 0) lt += this.dashBack ? -10 : 16;
      }
      const kl = 150, dl = 2 * Math.sqrt(kl) * 0.75;
      this.leanV += (kl * (lt - this.lean) - dl * this.leanV) * dt;
      this.lean += this.leanV * dt;
      this.skid += ((this.skidding ? 1 : 0) - this.skid) * Math.min(1, dt * 16);
      if (this.skidding && fx && Math.random() < 0.5) fx(this, "skidDust");

      // Any input cancels an idle break; a buffered action or dash runs once the fighter is free.
      if (this.action && this.action.c.idleBreak && (inp.move || inp.jumpPressed || inp.crouch || this.state !== "ground")) { this.action = null; this.xfade(0.18); }
      // An attack pressed during the jump's crouch becomes the air attack once airborne.
      if (this.buffer && this.buffer.name && this.state === "air" && !this.action && !this.airAttacked && /^a[1-4]$|^combo$/.test(this.buffer.name)) {
        const b = this.buffer; this.buffer = null; this.play(b.name, fx);
      }
      if (this.buffer && this.buffer.name && this.action && !this.action.c.react && this.action.c.cancelAt !== undefined && this.action.u >= this.action.c.cancelAt && this.state === "ground") {
        const b = this.buffer; this.buffer = null; this.play(b.name, fx);
      }
      if (this.buffer && this.state === "ground" && this.turnT < 0 && !this.action) {
        const b = this.buffer; this.buffer = null;
        if (b.dash) this.dash(b.dash, fx); else this.play(b.name, fx);
      }
      // Idle breaks: after standing still for a while, a short fidget (shake out the arms, check the blade).
      const still = this.state === "ground" && !this.action && this.spd < 5 && this.crouch < 0.2 && !inp.move && !inp.crouch && this.turnT < 0;
      this.idleT = still ? this.idleT + dt : 0;
      if (this.idleT > this.nextBreak && this.clips.idle1 && !this.noBreaks) {
        const name = this.breakIdx++ % 2 ? "idle2" : "idle1";
        this.idleT = 0; this.nextBreak = 6 + Math.random() * 4;
        if (this.clips[name]) { this.queue = []; this.comboName = null; this.startAction(this.clips[name], 1); }
      }

      // Pose: an action clip, the air pose or the ground pose, blended from the last snapshot.
      let pose;
      if (this.action) pose = this.actionPose(dt, fx);
      else pose = this.state === "air" ? this.airPose() : this.groundPose();
      // Keep every target angle continuous from frame to frame (leg IK reports angles in -180..180, so a shin
      // passing straight back would jump by a whole turn and spoil any blend running at that moment).
      if (this.prevRaw) pose = normalizeTo(pose, this.prevRaw);
      this.prevRaw = pose;
      if (this.from && this.blendT < this.blendDur) {
        // Pick the short way round once, on the blend's first frame, and keep it (re-picking every frame
        // could flip an angle by a whole turn mid-blend when the target moves).
        if (!this.fromNorm) { this.from = normalizeTo(this.from, pose); this.fromNorm = true; }
        this.blendT += dt;
        pose = Rig.blend(this.from, pose, Rig.smooth(Math.min(1, this.blendT / this.blendDur)));
      }
      // Turning: a fake 3D turn (the body squeezes through side-on) with a small dip.
      if (this.turnT >= 0) {
        const e = Rig.smooth(this.turnT);
        pose.turn += 180 * e;
        pose.y -= 3 * Math.sin(Math.PI * e);
      }
      this.flow = (this.flow || 0) + dt * (0.42 + Math.min(1, this.spd / 240) * 0.5);
      this.overlays(pose);
      floorGuard(this.B, pose);
      this.secondary(pose, dt);
      this.pose = pose;
      if (this.pending.length) { const ev = this.pending; this.pending = []; if (fx) for (const [name, e] of ev) fx(this, name, e); }
      this.label = this.action ? (this.comboName ? "combo" : this.action.c.id) : this.locoLabel();
    }

    runK(c) { const k = this.St.speedK || 1; return sstep(SPEED.walk * 1.1 * k, SPEED.run * 0.92 * k, this.spd) * (1 - c); }
    locoLabel() {
      if (this.state === "air") return this.vy > 0 ? "jump" : "fall";
      if (this.state === "prejump") return "jump";
      if (this.turnT >= 0) return "turn";
      if (this.dashT > 0) return this.dashBack ? "backdash" : "dash";
      if (this.skidding) return "skid";
      const c = this.crouch > 0.5, v = this.vx * this.facing;
      if (this.spd < 12) return c ? "crouch" : "idle";
      if (c) return "crouchwalk";
      if (v < 0) return "backwalk";
      return this.spd > SPEED.walk * 1.3 ? "run" : "walk";
    }

    // ----- Ground pose: idle, walk, back walk, run, crouch, crouch walk, dash, skid, all one continuous blend -----
    groundPose() {
      const B = this.B, St = this.St, Sn = this.Sn, A = this.A, legL = this.legL, t = this.t;
      const lock = this.mode === "lock";
      const c = clamp(this.crouch, -0.25, 1.15), c1 = clamp(c, 0, 1);
      const spd = this.spd, runK = this.runK(c1), walkK = sstep(0, SPEED.walk * 0.7, spd), moveK = sstep(3, 45, spd);
      const dashK = this.dashT > 0 ? Math.sin((Math.PI * this.dashT) / this.dashDur) : 0;
      const skid = this.skid, still = (1 - moveK) * (1 - skid);

      // Idle life: breathing, a slow weight shift between the feet, and for bare hands a boxer's bounce.
      const br = Math.sin(TAU * St.breathRate * t);
      const sway = St.sway * Math.sin(TAU * St.swayRate * t) * still;
      const bnc = Sn.bounce * St.bounce * (0.5 - 0.5 * Math.cos(TAU * St.bounceRate * t)) * still * (1 - c1);

      // Gait: each foot is on the ground for a share d of the cycle, moving back under the hip at exactly the
      // body's speed (no sliding), then swings forward on an arc.
      const Lc = lerp(lerp(St.walkCycle, St.runCycle, runK), St.crouchCycle, c1);
      const d = lerp(St.dWalk, St.dRun, runK), half = (d * Lc) / 2;
      const lift = lerp(lerp(St.walkLift, St.runLift, runK), St.walkLift * 0.55, c1);
      const keep = lock ? (1 - runK) * 0.75 : (1 - walkK) * 0.9;
      const sF = St.stance[0] + 7 * c1, sB = St.stance[1] - 5 * c1;
      const gm = moveK * (1 - dashK) * (1 - skid);
      const feet = [0, 1].map((i) => {
        const s = frac(this.phase + i * 0.5);
        let gx, gy, pitch, stance;
        if (s < d) { const k = s / d; gx = half * (1 - 2 * k); gy = 0; stance = true; pitch = k > 0.62 ? -42 * Math.pow((k - 0.62) / 0.38, 2) * lerp(0.6, 1, runK) : 0; }
        else {
          const k = (s - d) / (1 - d);
          gx = -half + 2 * half * k * k * (3 - 2 * k);
          gy = lift * Math.pow(Math.sin(Math.PI * Math.pow(k, lerp(1, 0.6, runK))), 1.2);
          pitch = lerp(-42, 14, Math.pow(k, 1.4)) * lerp(0.6, 1, runK); stance = false;
        }
        const base = (i ? sB : sF) * lerp(1, keep, moveK) - sway * 0.6;
        return { x: base + gm * gx, y: gm * gy, p: gm * pitch, stance: stance || gm < 0.3 };
      });
      // Dash: a long low lunge. Skid: the front foot braced ahead, toes up.
      if (dashK > 0) {
        const f = this.dashBack ? [10, 12, -20, 4] : [40, 0, -44, 0];
        feet[0].x = lerp(feet[0].x, f[0], dashK); feet[0].y = lerp(feet[0].y, f[1], dashK);
        feet[1].x = lerp(feet[1].x, f[2], dashK); feet[1].y = lerp(feet[1].y, f[3], dashK);
        feet[1].p = lerp(feet[1].p, this.dashBack ? -20 : -35, dashK);
      }
      if (skid > 0) {
        feet[0].x = lerp(feet[0].x, 34, skid); feet[0].y *= 1 - skid; feet[0].p = lerp(feet[0].p, 18, skid);
        feet[1].x = lerp(feet[1].x, -12, skid); feet[1].y *= 1 - skid; feet[1].p = lerp(feet[1].p, -25, skid);
      }
      // Heels rise with the bounce (toes stay on the floor).
      if (bnc > 0) for (const f of feet) f.p = Math.min(f.p, -Math.asin(clamp((bnc * 0.9) / B.foot, 0, 0.9)) / DEG);

      // Hip height: stance, walk and run heights, crouch, breathing and bounce; the run bobs (lowest at
      // mid-stance); the walk bob comes from the planted foot's reach.
      const hk = lerp(lerp(lerp(Sn.hk, St.walkH, walkK), St.runH, runK), St.crouchH, c1) - Math.min(0, c) * 0.06;
      let H = legL * hk + br * St.breath * 0.35 * still + bnc;
      H -= runK * St.runBob * Math.cos(TAU * 2 * (this.phase - d / 2)) * moveK;
      H += this.dashBack ? 12 * dashK : -6 * dashK;
      const pel = (St.pelvis * Math.sin(TAU * this.phase) * moveK + sway * 0.35 * St.lead) * (1 - skid);
      for (let i = 0; i < 2; i++) {
        const f = feet[i];
        // The ankle sits high enough that neither the toe (toes down) nor the heel (toes up) goes below the floor.
        f.ay = Math.max(f.y, sole(B, f.p));
        // Every foot limits the hip by its reach, swing feet too: the limit relaxes smoothly as a foot lifts,
        // instead of switching off at toe-off (which made the hip jump).
        const dx = f.x - (i ? -pel : pel), reach = legL * 0.935;
        H = softmin(H, Math.sqrt(Math.max(1, reach * reach - dx * dx)) + f.ay, 3);
      }
      const pose = legs(B, H, [feet[0].x, feet[0].ay], [feet[1].x, feet[1].ay], pel, feet[0].p, feet[1].p);

      // Torso, head (kept steady against the lean and bob), shoulders countering the hips.
      pose.lean = this.lean + br * 1.2 * still;
      // Spine: the chest curls a little in the run and the crouch, breathes, and lags behind fast lean changes.
      pose.spine = 5 * runK + 7 * c1 + br * 0.8 * still + clamp(-this.leanV * 0.05, -6, 6);
      pose.head = -(this.lean + pose.spine - this.baseLean()) * 0.55 + Math.sin(TAU * St.breathRate * t + 1) * 1.5 * still;
      pose.chest = -St.chest * Math.sin(TAU * this.phase) * moveK * lerp(0.5, 1, runK) - sway * 0.15;
      pose.x = 0; pose.rot = 0; pose.turn = 0; pose.sq = 0;

      // Arms: guard that breathes; a guarded walk (lock-on) or a relaxed swing (free); a pumping run.
      const ph = TAU * this.phase;
      let arms = addA(A.guard, { fa0: br * 2 * St.breath, ba0: br * 2 * St.breath, fa1: br * 1.5, w: br * 2.5 });
      if (bnc > 0) arms = addA(arms, { fa0: bnc * 0.8, ba0: bnc * 0.8 });
      const sw = 22 * St.armSwing * -Math.cos(ph);
      const walkA = lock
        ? addA(A.guard, { fa0: 3 * Math.sin(2 * ph), ba0: 3 * Math.sin(2 * ph + 1), w: 3 * Math.sin(2 * ph) })
        : addA(A.relax, { fa0: sw, fa1: sw * 0.7, w: sw * 0.8, ba0: -sw, ba1: -sw * 0.7 });
      const runA = mixA(A.runB, A.runF, 0.5 - 0.5 * Math.cos(ph));
      arms = mixA(arms, mixA(walkA, runA, runK), walkK);
      arms = mixA(arms, A.crouch, c1);
      if (dashK > 0) arms = mixA(arms, A.dash, dashK);
      if (skid > 0) arms = mixA(arms, A.skid, skid);
      return Object.assign(pose, { fo: 0, bo: 0, g2: 0 }, arms);
    }

    // ----- Air pose: rise, tuck at the apex, reach for the floor when falling; a running jump is a leap -----
    airPose() {
      const B = this.B, A = this.A, k = clamp(this.vy / this.St.jumpV, -1.4, 1);
      const rise = Math.max(0, k), fall = clamp(-k, 0, 1);
      const L = this.runJump
        ? { rise: [-12, -82, -138, -150, -40, -55], tuck: [-18, -96, -118, -142, -30, -40], fall: [-50, -96, -118, -108, -5, -20] }
        : { rise: [-74, -104, -102, -114, -62, -70], tuck: [-4, -100, -52, -140, -30, -45], fall: [-58, -96, -108, -100, -10, -20] };
      const mix = (a, b, w) => a.map((v, i) => lerp(v, b[i], w));
      const l = rise > 0 ? mix(L.tuck, L.rise, Rig.smooth(rise)) : mix(L.tuck, L.fall, Rig.smooth(fall));
      const H = this.legL * 0.93 + this.jumpY;
      const arms = rise > 0 ? mixA(A.tuck, A.rise, rise) : mixA(A.tuck, A.fall, fall);
      arms.oy += this.jumpY;
      return Object.assign({ spine: this.runJump ? 6 : -3 * rise + 4 * fall, fo: 0, bo: 0, g2: 0 }, { x: 0, air: 1, y: H - B.hipBase, lean: this.lean, head: -(this.lean - this.baseLean()) * 0.4, rot: 0, turn: 0,
        sq: 0, fl0: l[0], fl1: l[1], bl0: l[2], bl1: l[3], ffa: l[4], bfa: l[5], pel: 0, chest: 0 }, arms);
    }

    // ----- Action clips (attacks, hit, parry, taunt, death) -----
    actionPose(dt, fx) {
      const a = this.action, c = a.c, uPrev = a.u;
      a.t += dt * a.speed;
      a.u = Math.min(1, a.t / c.dur);
      let pose = this.clipPose(c, a.u);
      if (a.extra && c._ui) pose.x += a.extra * Rig.smooth(clamp(a.u / c._ui, 0, 1));
      const dx = pose.x - a.lastX; a.lastX = pose.x; this.x += this.facing * dx;
      if (c.air) { pose.y += this.jumpY; pose.oy += this.jumpY; }
      pose.x = 0;
      a.prevU = uPrev;
      // Events fire after this frame's pose is set (effects read the pose).
      for (const [e, name] of c.events) if (e > uPrev && e <= a.u) this.pending.push([name, e]);
      if (a.t >= c.dur) {
        if (this.queue.length) { this.startAction(this.clips[this.queue.shift()], 1.2); }
        else if (c.next === null) { a.t = c.dur; }
        else { this.action = null; this.comboName = null; this.xfade(c.blendOut || 0.16); }
      }
      return pose;
    }
    // Overlays on any pose. Four arms: all four flow on one shared rhythm, each with its own phase, so they move
    // in sync yet individually (strongest at rest, a quarter of it during actions). The spell orb bobs and drifts.
    overlays(pose) {
      if (this.B.arms4) {
        const k = this.action ? (this.action.c.idleBreak ? 0.7 : 0.25) : 1, ph = TAU * this.flow;
        const wave = (o, a0, a1) => [a0 * Math.sin(ph + o), a1 * Math.sin(ph + o + 0.9)];
        const f = wave(0, 7, 12), b = wave(TAU / 4, 7, 12), lf = wave(TAU / 2, 9, 16), lb = wave((3 * TAU) / 4, 9, 16);
        pose.fa0 += k * f[0]; pose.fa1 += k * f[1]; pose.ba0 += k * b[0]; pose.ba1 += k * b[1];
        pose.fc0 += k * lf[0]; pose.fc1 += k * lf[1]; pose.bc0 += k * lb[0]; pose.bc1 += k * lb[1];
      }
      if (this.weapon === "flame") {
        const k = this.action ? 0.3 : 1;
        pose.oy += k * 3.2 * Math.sin(this.t * 2.4); pose.ox += k * 2.2 * Math.sin(this.t * 1.7 + 1);
        pose.os *= 1 + 0.05 * Math.sin(this.t * 7);
      }
    }
    // Follow-through and overlap: arms, weapon, head and spine follow the pose through slightly underdamped
    // springs, so they drag behind fast changes and settle with a small overshoot. Legs are left alone (feet
    // stay planted). Stiffer during actions so strikes stay sharp (the orb much stiffer, so it lands on the hit).
    secondary(pose, dt) {
      const act = !!this.action, F = SEC;
      if (!this.sec) { this.sec = {}; for (const f in F) this.sec[f] = { x: pose[f], v: 0, t: pose[f] }; }
      for (const f in F) {
        const s = this.sec[f], k = F[f] * (act ? (f === "ox" || f === "oy" ? 10 : 3.2) : 1), d = 2 * Math.sqrt(k) * (act ? 0.62 : 0.5);
        const tgt = pose[f];
        // Follow the target's own path. If the raw angle jumps by whole turns (a twirl's 402 becoming 42),
        // shift the spring by the same turns so it does not spin round.
        const turns = Math.round((tgt - s.t) / 360);
        if (turns) s.x += 360 * turns;
        s.t = tgt;
        s.v += (k * (tgt - s.x) - d * s.v) * dt;
        s.x += s.v * dt;
        if (Math.abs(tgt - s.x) > 70) s.x = tgt - Math.sign(tgt - s.x) * 70; // never lag far behind
        this.secOff[f] = s.x - tgt;
        pose[f] = pose[f] + this.secOff[f];
      }
    }
    // The action pose at clip position u (for weapon smears between frames), with the same follow-through
    // offsets as the drawn pose, so the smear stays on the blade.
    clipPoseAt(u) {
      const p = Object.assign(this.clipPose(this.action.c, u), { x: 0 });
      for (const f in this.secOff) p[f] += this.secOff[f];
      return p;
    }
    // Sample a clip. For eased clips whose keys both place the feet (`_ft`), the feet are interpolated in the
    // world and reached by IK, and a foot that moves between the keys is lifted on an arc: a real step, not a
    // slide along the floor.
    clipPose(c, u) {
      if (!c.ease) return Object.assign({}, Rig.sample(c.keys, u, false));
      const K = c.keys, n = K.length;
      if (u <= K[0][0]) return Object.assign({}, K[0][1]);
      if (u >= K[n - 1][0]) return Object.assign({}, K[n - 1][1]);
      let i = 0;
      while (i < n - 1 && u >= K[i + 1][0]) i++;
      const [t1, p1, e] = K[i], [t2, p2] = K[i + 1];
      const s = clamp((u - t1) / Math.max(1e-6, t2 - t1), 0, 1), k = (Rig.EASE[e] || Rig.EASE.inout)(s);
      const pose = Rig.blend(p1, p2, k);
      const a = p1._ft, b = p2._ft;
      if (a && b) {
        const B = this.B, arc = Math.sin(Math.PI * clamp(k, 0, 1));
        const foot = (x1, x2, l1, l2, q1, q2) => {
          const move = Math.abs(x2 - x1), lift = lerp(l1, l2, k) + (move > 2 ? Math.min(9, 0.45 * move) * arc : 0);
          const p = lerp(q1, q2, k) + (move > 2 ? -18 * arc : 0);
          return { x: lerp(x1, x2, k) - pose.x, y: Math.max(lift, sole(B, p)), p };
        };
        const F = foot(a.fx, b.fx, a.fl, b.fl, a.fp, b.fp), Bk = foot(a.bx, b.bx, a.bl, b.bl, a.bp, b.bp);
        Object.assign(pose, legs(B, lerp(a.H, b.H, k), [F.x, F.y], [Bk.x, Bk.y], pose.pel, F.p, Bk.p));
      }
      return pose;
    }

    solve(floorY) { return Rig.solve(this.pose, this.x, floorY, this.facing, this.B); }
  }

  // The resting guard pose for a weapon and body (attack clips start and end here, so they line up with
  // the idle and the feet do not jump).
  const restCache = {};
  const bodyOf = (gender, prof) => Object.assign({}, Rig.BODY[gender], prof && prof.body);
  const styleOf = (gender, prof) => Object.assign({}, STYLE[gender], prof && prof.style);
  function restPose(weapon, gender, prof) {
    const key = weapon + gender + (prof ? prof.key : "");
    if (restCache[key]) return restCache[key];
    const B = bodyOf(gender, prof), St = styleOf(gender, prof), Sn = STANCE[weapon] || STANCE.sword, A = ARMS[weapon] || ARMS.sword;
    const H = (B.thigh + B.shin) * Sn.hk;
    const p = Object.assign(legs(B, H, [St.stance[0], 0], [St.stance[1], 0], 0), A.guard,
      { x: 0, lean: Sn.lean * St.leanK, head: 0, rot: 0, turn: 0, sq: 0, chest: 0 });
    return (restCache[key] = Object.assign({}, Rig.BASE, p));
  }

  const ANGLES = ["lean", "head", "rot", "turn", "fa0", "fa1", "ba0", "ba1", "fl0", "fl1", "bl0", "bl1", "w", "w2", "ffa", "bfa"];
  // Rotate every angle of `from` by whole turns so it sits within 180 degrees of `to` (a blend never
  // spins the long way after a twirl or a spin attack).
  function normalizeTo(from, to) {
    const o = Object.assign({}, from);
    for (const f of ANGLES) { while (o[f] - to[f] > 180) o[f] -= 360; while (o[f] - to[f] < -180) o[f] += 360; }
    return o;
  }

  return { SPEED, STYLE, STANCE, ARMS, Character, legIK, legs, sole, restPose, normalizeTo, bodyOf, styleOf };
})();
