/**
 * Animation rig for the 2D fighters: the skeleton, the two body profiles, pose solving (leg and arm reach), cloth
 * and the drawing of a posed fighter. Drawing and math only, no game rules.
 *
 * A pose is a flat object of numbers (degrees and drawing units). Angles are absolute, measured like
 * render.js: 0 = forward (the way the fighter faces), 90 = up, -90 = down, 180 = back.
 *   x      forward root motion (the controller moves the fighter by the change in x)
 *   y      extra hip height (positive = up)       air   0 = feet planted (hip height from the legs), 1 = airborne
 *   lean   torso tilt forward from vertical       head  extra head tilt
 *   rot    whole body rotation around the hip (positive = backward)
 *   turn   fake 3D turn: the body is squeezed by cos(turn), so 0 -> 180 -> 360 reads as a spin
 *   sq     squash (+) and stretch (-) around the floor
 *   fa0 fa1 / ba0 ba1   front and back arm: upper arm and forearm angles
 *   fl0 fl1 / bl0 bl1   front and back leg: thigh and shin angles
 *   w      weapon angle in the front hand          w2  weapon angle in the back hand (dual blades)
 *   grip   two-handed weapons: the back hand holds the shaft this far behind the front hand (IK)
 *   ffa bfa  front and back foot angle (0 = flat, toes forward; negative = toes down, heel up)
 *   pel    pelvis twist: the front hip joint sits this far forward of the back one (fake 3D)
 *   chest  shoulder twist: the front shoulder sits this far forward of the back one
 *   spine  upper torso bend relative to the lower torso (positive = chest curls forward)
 *   fo bo  front and back hand open (0 = fist or grip, 1 = open hand)
 *   g2     one-handed weapons: 0..1 how far the back hand joins the front hand on the hilt (two-handed grip)
 *   fc0 fc1 / bc0 bc1   second pair of arms (four-armed bodies only, B.arms4): front and back, from lower on the chest
 *   ox oy os   a floating prop (the spell orb): position forward of the root and height above the floor, and size
 */
CounterType.define("rig", [], () => {
  "use strict";

  const DEG = Math.PI / 180;
  // Body profiles. limb: widths of upper arm, forearm, thigh, shin. front / back: torso half widths toward the
  // chest and toward the back at the hip, waist, chest and shoulder (the side view silhouette).
  const BODY = {
    M: {
      torso: 54,
      neck: 7,
      headR: 14.5,
      upper: 26,
      fore: 25,
      thigh: 35,
      shin: 35,
      foot: 11,
      hipBase: 66,
      limb: [10, 8.4, 10.6, 8.4],
      front: [4.6, 4.2, 8.6, 6.2],
      back: [5.6, 5, 7, 7.2],
      neckW: 8,
    },
    F: {
      torso: 50,
      neck: 8,
      headR: 13.4,
      upper: 24,
      fore: 23,
      thigh: 37,
      shin: 36,
      foot: 9.5,
      hipBase: 68,
      limb: [6.4, 5.4, 8.8, 6.2],
      front: [4, 2.2, 5.2, 2.6],
      back: [7.4, 2.6, 3.2, 3.4],
      neckW: 5,
    },
  };
  const FIELDS = [
    "x",
    "y",
    "air",
    "lean",
    "head",
    "rot",
    "turn",
    "sq",
    "fa0",
    "fa1",
    "ba0",
    "ba1",
    "fl0",
    "fl1",
    "bl0",
    "bl1",
    "w",
    "w2",
    "grip",
    "ffa",
    "bfa",
    "pel",
    "chest",
    "spine",
    "fo",
    "bo",
    "g2",
    "fc0",
    "fc1",
    "bc0",
    "bc1",
    "ox",
    "oy",
    "os",
  ];
  const BASE = {
    x: 0,
    y: 0,
    air: 0,
    lean: 10,
    head: 0,
    rot: 0,
    turn: 0,
    sq: 0,
    fa0: 10,
    fa1: 80,
    ba0: -30,
    ba1: 70,
    fl0: -62,
    fl1: -95,
    bl0: -118,
    bl1: -85,
    w: 0,
    w2: 0,
    grip: 0,
    ffa: 0,
    bfa: 0,
    pel: 0,
    chest: 0,
    spine: 0,
    fo: 0,
    bo: 0,
    g2: 0,
    fc0: -70,
    fc1: 10,
    bc0: -95,
    bc1: -5,
    ox: 30,
    oy: 105,
    os: 1,
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  // ---------- Poses ----------
  // P(base, spec): a flat pose from a base and a short spec. Spec keys: any field, or fa/ba/fl/bl as
  // [upper, lower], or legs: [thigh, shin] for a mirrored stance (both feet reach the floor equally),
  // or o: [forward, height, size] for the spell orb.
  function P(base, spec) {
    const o = Object.assign({}, BASE, base || {});
    if (!spec) return o;
    for (const k in spec) {
      const v = spec[k];
      if (k === "legs") {
        o.fl0 = v[0];
        o.fl1 = v[1];
        o.bl0 = -180 - v[0];
        o.bl1 = -180 - v[1];
      } else if (k === "fa" || k === "ba" || k === "fl" || k === "bl" || k === "fc" || k === "bc") {
        o[k + "0"] = v[0];
        o[k + "1"] = v[1];
      } else if (k === "o") {
        o.ox = v[0];
        o.oy = v[1];
        o.os = v[2] === undefined ? 1 : v[2];
      } else o[k] = v;
    }
    return o;
  }

  function blend(a, b, k) {
    const o = {};
    for (const f of FIELDS) o[f] = lerp(a[f], b[f], k);
    return o;
  }

  // Sample a clip's keys at u (0..1) with a cubic Hermite (Catmull-Rom) spline through the keys, so
  // every joint moves with continuous speed: no snaps at keys. Ends of a one-shot clip ease in and out
  // (zero speed); loops wrap around. Keys: [[t, pose], ...] with t from 0 to 1, sorted.
  function sample(keys, u, loop) {
    const n = keys.length;
    if (n === 1) return keys[0][1];
    if (loop) u = ((u % 1) + 1) % 1;
    else if (u <= keys[0][0]) return keys[0][1];
    else if (u >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (i < n - 1 && u >= keys[i + 1][0]) i++;
    // Neighbours (with wrapped times for loops).
    const at = (j) => {
      if (loop) {
        const m = ((j % n) + n) % n,
          laps = Math.floor(j / n);
        return [keys[m][0] + laps, keys[m][1]];
      }
      const m = clamp(j, 0, n - 1);
      return [keys[m][0], keys[m][1]];
    };
    const [t1, p1] = at(i);
    let [t2, p2] = at(i + 1);
    if (loop && i === n - 1) {
      [t2, p2] = at(n);
    }
    const [t0, p0] = at(i - 1),
      [t3, p3] = at(i + 2);
    const span = t2 - t1 || 1e-6,
      s = (u - t1) / span;
    const s2 = s * s,
      s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1,
      h10 = s3 - 2 * s2 + s,
      h01 = -2 * s3 + 3 * s2,
      h11 = s3 - s2;
    const edgeA = !loop && i === 0,
      edgeB = !loop && i + 1 === n - 1;
    const o = {};
    for (const f of FIELDS) {
      const v0 = p0[f],
        v1 = p1[f],
        v2 = p2[f],
        v3 = p3[f];
      const m1 = edgeA ? 0 : ((v2 - v0) / Math.max(1e-6, t2 - t0)) * span;
      const m2 = edgeB ? 0 : ((v3 - v1) / Math.max(1e-6, t3 - t1)) * span;
      o[f] = h00 * v1 + h10 * m1 + h01 * v2 + h11 * m2;
    }
    return o;
  }

  // Eased keys: [t, pose, ease], where `ease` shapes the move FROM this key to the next. This is how attacks
  // get anticipation (inout), a snap (outExpo), a held contact frame (hold) and an overshoot (back),
  // which a smooth spline cannot do: a spline rounds every key off.
  const EASE = {
    linear: (t) => t,
    in: (t) => t * t * t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    snap: (t) => 1 - Math.pow(1 - t, 3.5),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inout: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    hold: () => 0,
    back: (t) => {
      const c = 1.6;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
  };

  // ---------- Skeleton ----------
  const pt = (p, len, deg) => [p[0] + len * Math.cos(deg * DEG), p[1] - len * Math.sin(deg * DEG)];

  // Two-bone IK: elbow and hand reaching from `s` toward `t`, the elbow bent downward.
  function ik(s, t, a, b) {
    const dx = t[0] - s[0],
      dy = t[1] - s[1];
    const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 0.01, a + b - 0.01);
    const base = Math.atan2(dy, dx);
    const alpha = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const e1 = [s[0] + a * Math.cos(base + alpha), s[1] + a * Math.sin(base + alpha)];
    const e2 = [s[0] + a * Math.cos(base - alpha), s[1] + a * Math.sin(base - alpha)];
    const e = e1[1] > e2[1] ? e1 : e2;
    const h = [s[0] + Math.cos(base) * d, s[1] + Math.sin(base) * d];
    return [e, h];
  }

  // Pose -> joints in world space. `root` is the floor point under the hip. B: body profile (default male).
  // Turning (`turn`): the upper body squeezes through side-on (fake 3D) while its two sides spread apart, as if
  // seen from the front at 90 degrees; the legs do not squeeze: the feet stay where they are on the floor and
  // only the knees swing round, so a 180 turn is a pivot on planted feet.
  // Returns { J: world joints, xf(localPoint, side) -> world, xfL (legs), wpt(hand, angle, u, v), ... }.
  function solve(p, rootX, floorY, facing, B) {
    B = B || BODY.M;
    const reach = (a, b) => -B.thigh * Math.sin(a * DEG) - B.shin * Math.sin(b * DEG);
    const hipH = lerp(Math.max(reach(p.fl0, p.fl1), reach(p.bl0, p.bl1)), B.hipBase, clamp(p.air, 0, 1)) + p.y;
    const hip = [0, -hipH];
    const tdir = 90 - p.lean,
      tdir2 = tdir - (p.spine || 0),
      half = B.torso / 2;
    const mid = pt(hip, half, tdir);
    const sh = pt(mid, half, tdir2);
    const neck = pt(sh, B.neck, tdir2 + p.head * 0.5);
    const head = pt(sh, B.neck + B.headR, tdir2 + p.head);
    const pel = p.pel || 0,
      chs = p.chest || 0;
    const sf = [sh[0] + chs, sh[1]],
      sb = [sh[0] - 2 - chs, sh[1] + 1];
    const hf = [hip[0] + pel, hip[1]],
      hb = [hip[0] - pel, hip[1]];
    const fe = pt(sf, B.upper, p.fa0),
      fh = pt(fe, B.fore, p.fa1);
    let be, bh;
    if (p.grip > 0.5) {
      const tgt = pt(fh, p.grip, p.w + 180);
      [be, bh] = ik(sb, tgt, B.upper, B.fore);
    } else {
      be = pt(sb, B.upper, p.ba0);
      bh = pt(be, B.fore, p.ba1);
      const g2 = clamp(p.g2 || 0, 0, 1);
      if (g2 > 0.001) {
        const [ie, ih] = ik(sb, pt(fh, 11, p.w + 180), B.upper, B.fore);
        be = [lerp(be[0], ie[0], g2), lerp(be[1], ie[1], g2)];
        bh = [lerp(bh[0], ih[0], g2), lerp(bh[1], ih[1], g2)];
      }
    }
    // A four-armed body: the second pair grows from the chest a little below the shoulders.
    let lf = null,
      lb = null,
      fce = null,
      fch = null,
      bce = null,
      bch = null;
    if (B.arms4) {
      const root = pt(mid, half * 0.62, tdir2);
      lf = [root[0] + chs * 0.7, root[1]];
      lb = [root[0] - 2 - chs * 0.7, root[1] + 1];
      fce = pt(lf, B.upper * 0.94, p.fc0);
      fch = pt(fce, B.fore * 0.94, p.fc1);
      bce = pt(lb, B.upper * 0.94, p.bc0);
      bch = pt(bce, B.fore * 0.94, p.bc1);
    }
    const fk = pt(hf, B.thigh, p.fl0),
      ff = pt(fk, B.shin, p.fl1);
    const bk = pt(hb, B.thigh, p.bl0),
      bf = pt(bk, B.shin, p.bl1);
    const ft = pt(ff, B.foot, p.ffa || 0),
      bt = pt(bf, B.foot, p.bfa || 0);
    const waist = pt(hip, 8, tdir);
    const chest = pt(mid, half - 10, tdir2);

    const r = p.rot * DEG,
      cr = Math.cos(r),
      sr = Math.sin(r);
    const tc = Math.cos(p.turn * DEG),
      ts = Math.sin(p.turn * DEG);
    const sqx = 1 - p.sq * 0.5,
      sx = facing * tc * sqx,
      sxL = facing * sqx,
      sy = 1 + p.sq;
    const ox = rootX,
      oy = floorY;
    const rotd = (q) => {
      const dx = q[0] - hip[0],
        dy = q[1] - hip[1];
      return [hip[0] + dx * cr + dy * sr, hip[1] - dx * sr + dy * cr];
    };
    // side: +1 for the front arm and leg, -1 for the back ones; they spread apart mid-turn.
    const xf = (q, side) => {
      const w = rotd(q);
      return [ox + w[0] * sx + (side || 0) * facing * ts * 7, oy + w[1] * sy];
    };
    const xfL = (q, side) => {
      const w = rotd(q);
      return [ox + w[0] * sxL + (side || 0) * facing * ts * 5, oy + w[1] * sy];
    };
    // Mid-turn the knees swing through the camera: the knee's bulge off the hip-ankle line scales by cos(turn).
    const bend = (h, k, a) => {
      if (tc > 0.9999) return k;
      const dx = a[0] - h[0],
        dy = a[1] - h[1],
        l2 = dx * dx + dy * dy || 1,
        t = ((k[0] - h[0]) * dx + (k[1] - h[1]) * dy) / l2;
      const px = h[0] + t * dx,
        py = h[1] + t * dy;
      return [px + (k[0] - px) * tc, py + (k[1] - py) * tc];
    };
    // A point on a weapon held in hand `h` (local) at angle `deg`: u along the weapon, v across it.
    const wpt = (h, deg, u, v) => {
      const a = deg * DEG,
        side = h === fh ? 1 : h === bh ? -1 : 0;
      return xf(
        [
          h[0] + u * Math.cos(a) + v * Math.cos(a + Math.PI / 2),
          h[1] - u * Math.sin(a) - v * Math.sin(a + Math.PI / 2),
        ],
        side,
      );
    };
    const L = {
      hip,
      mid,
      sh,
      sf,
      sb,
      hf,
      hb,
      neck,
      head,
      fe,
      fh,
      be,
      bh,
      fk,
      ff,
      bk,
      bf,
      ft,
      bt,
      waist,
      chest,
      lf,
      lb,
      fce,
      fch,
      bce,
      bch,
    };
    const J = {
      hip: xf(hip),
      mid: xf(mid),
      sh: xf(sh),
      neck: xf(neck),
      head: xf(head),
      waist: xf(waist),
      chest: xf(chest),
      sf: xf(sf, 1),
      fe: xf(fe, 1),
      fh: xf(fh, 1),
      sb: xf(sb, -1),
      be: xf(be, -1),
      bh: xf(bh, -1),
      hf: xfL(hf, 1),
      fk: xfL(bend(hf, fk, ff), 1),
      ff: xfL(ff, 1),
      hb: xfL(hb, -1),
      bk: xfL(bend(hb, bk, bf), -1),
      bf: xfL(bf, -1),
    };
    L.orb = [p.ox, -p.oy];
    J.orb = xf(L.orb);
    if (B.arms4) {
      J.lf = xf(lf, 1);
      J.fce = xf(fce, 1);
      J.fch = xf(fch, 1);
      J.lb = xf(lb, -1);
      J.bce = xf(bce, -1);
      J.bch = xf(bch, -1);
    }
    J.headR = B.headR * Math.abs(sy);
    const S = { J, L, xf, xfL, wpt, p, facing, sx, B, tdir, tdir2, tc };
    J.ft = footPt(S, ff, p.ffa || 0, B.foot, 0, 1);
    J.bt = footPt(S, bf, p.bfa || 0, B.foot, 0, -1);
    return S;
  }
  // A point on a foot (u along the sole from the ankle toward the toe, v up from the sole) in world space.
  // The toe direction turns with the body: its x part scales by cos(turn).
  function footPt(S, ankle, deg, u, v, side) {
    const a = deg * DEG,
      ux = Math.cos(a),
      uy = -Math.sin(a),
      nx = uy,
      ny = -ux;
    const dx = (ux * u + nx * v) * S.tc,
      dy = uy * u + ny * v;
    return S.xfL([ankle[0] + dx, ankle[1] + dy], side);
  }

  // ---------- Cloth: simple verlet chains ----------
  class Chain {
    constructor(n, segLength, opt) {
      this.n = n;
      this.seg = segLength;
      this.opt = opt || {};
      this.p = [];
      this.q = [];
      this.ready = false;
    }
    reset(a, dirX) {
      for (let i = 0; i < this.n; i++) {
        const x = a[0] - dirX * i * this.seg * 0.3,
          y = a[1] + i * this.seg * 0.95;
        this.p[i] = [x, y];
        this.q[i] = [x, y];
      }
      this.ready = true;
    }
    // anchor: world point; wind: [x, y] acceleration; dt in seconds.
    step(anchor, dt, wind, floorY, t) {
      if (!this.ready) this.reset(anchor, 0);
      const g = this.opt.gravity !== undefined ? this.opt.gravity : 900;
      const damp = this.opt.damp !== undefined ? this.opt.damp : 0.965;
      const flut = this.opt.flutter || 0;
      for (let i = 1; i < this.n; i++) {
        const P0 = this.p[i],
          Q = this.q[i];
        const vx = (P0[0] - Q[0]) * damp,
          vy = (P0[1] - Q[1]) * damp;
        Q[0] = P0[0];
        Q[1] = P0[1];
        const f = flut * Math.sin(t * 9 + i * 1.7 + (this.opt.phase || 0)) * (i / this.n);
        P0[0] += vx + wind[0] * dt * dt;
        P0[1] += vy + (g + wind[1] + f) * dt * dt;
      }
      this.p[0][0] = anchor[0];
      this.p[0][1] = anchor[1];
      this.q[0][0] = anchor[0];
      this.q[0][1] = anchor[1];
      for (let it = 0; it < 4; it++) {
        for (let i = 1; i < this.n; i++) {
          const A = this.p[i - 1],
            B = this.p[i];
          const dx = B[0] - A[0],
            dy = B[1] - A[1],
            d = Math.hypot(dx, dy) || 1e-6;
          const diff = (d - this.seg) / d;
          if (i === 1) {
            B[0] -= dx * diff;
            B[1] -= dy * diff;
          } else {
            A[0] += dx * diff * 0.5;
            A[1] += dy * diff * 0.5;
            B[0] -= dx * diff * 0.5;
            B[1] -= dy * diff * 0.5;
          }
        }
        this.p[0][0] = anchor[0];
        this.p[0][1] = anchor[1];
        for (let i = 1; i < this.n; i++) if (this.p[i][1] > floorY - 1) this.p[i][1] = floorY - 1;
      }
    }
  }

  // A tapered ribbon along a chain of points. w0 at the root, w1 at the tip; ragged = cut tips.
  function ribbon(ctx, pts, w0, w1, color, ragged) {
    const n = pts.length;
    if (n < 2) return;
    const L = [],
      R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)],
        b = pts[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]),
        ny = b[0] - a[0];
      const d = Math.hypot(nx, ny) || 1;
      nx /= d;
      ny /= d;
      const w = lerp(w0, w1, i / (n - 1)) / 2;
      L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
      R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
    if (ragged) {
      const t = pts[n - 1],
        u = pts[n - 2];
      ctx.lineTo(t[0] + (t[0] - u[0]) * 0.6, t[1] + (t[1] - u[1]) * 0.6);
    }
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- Weapons: shapes in (u along, v across) from the hand ----------
  const STEEL = "#dfe3ea",
    STEEL_D = "#4e535c",
    GOLD = "#c9a24a",
    WOOD = "#5a3b20",
    IRON = "#7d828b",
    IRON_D = "#4a4e55";
  function poly(ctx, S, h, deg, pts, fill, stroke, lw) {
    ctx.beginPath();
    pts.forEach(([u, v], i) => {
      const q = S.wpt(h, deg, u, v);
      i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
    });
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw || 1.5;
      ctx.stroke();
    }
  }
  function seg(ctx, S, h, deg, u0, u1, w, color, v = 0) {
    const a = S.wpt(h, deg, u0, v),
      b = S.wpt(h, deg, u1, v);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  function bands(ctx, S, h, deg, from, to, step, color, w) {
    for (let u = from; u <= to; u += step) seg(ctx, S, h, deg, u, u + 1.5, w, color);
  }
  function dot(ctx, q, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw || 2;
      ctx.stroke();
    }
  }

  const WEAPON_DRAW = {
    sword(ctx, S, h, deg, acc) {
      seg(ctx, S, h, deg, -14, 0, 6, "#1d1f24");
      bands(ctx, S, h, deg, -13, -1, 4, acc, 6.5);
      dot(ctx, S.wpt(h, deg, -17, 0), 3.6, GOLD);
      seg(ctx, S, h, deg, 6, 6, 6, GOLD, 0);
      const g1 = S.wpt(h, deg, 5, -11),
        g2 = S.wpt(h, deg, 5, 11);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(g1[0], g1[1]);
      ctx.lineTo(g2[0], g2[1]);
      ctx.stroke();
      poly(
        ctx,
        S,
        h,
        deg,
        [
          [8, -4.6],
          [90, -3.6],
          [106, 0],
          [90, 3.6],
          [8, 4.6],
        ],
        STEEL,
        STEEL_D,
        1.6,
      );
      seg(ctx, S, h, deg, 12, 84, 1.3, "#9aa1ab");
    },
    dagger(ctx, S, h, deg, acc) {
      seg(ctx, S, h, deg, -12, 0, 5.5, "#1d1f24");
      bands(ctx, S, h, deg, -11, -1, 3.5, acc, 6);
      dot(ctx, S.wpt(h, deg, -17, 0), 4.5, null, GOLD, 2.2);
      const g1 = S.wpt(h, deg, 4, -7),
        g2 = S.wpt(h, deg, 4, 7);
      ctx.strokeStyle = acc;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(g1[0], g1[1]);
      ctx.lineTo(g2[0], g2[1]);
      ctx.stroke();
      poly(
        ctx,
        S,
        h,
        deg,
        [
          [6, -4],
          [40, -6],
          [62, 1],
          [44, 3.5],
          [6, 4],
        ],
        STEEL,
        STEEL_D,
        1.5,
      );
    },
    spear(ctx, S, h, deg, acc) {
      seg(ctx, S, h, deg, -80, 100, 5, WOOD);
      bands(ctx, S, h, deg, -6, 6, 3, acc, 6);
      bands(ctx, S, h, deg, 88, 96, 3, acc, 6);
      dot(ctx, S.wpt(h, deg, -82, 0), 3.2, IRON_D);
      poly(
        ctx,
        S,
        h,
        deg,
        [
          [98, -3],
          [111, -9],
          [140, 0],
          [111, 9],
          [98, 3],
        ],
        STEEL,
        STEEL_D,
        1.6,
      );
      seg(ctx, S, h, deg, 102, 132, 1.2, "#9aa1ab");
    },
    hammer(ctx, S, h, deg, acc) {
      seg(ctx, S, h, deg, -46, 70, 6.5, WOOD);
      bands(ctx, S, h, deg, -10, 8, 3.2, acc, 7.5);
      dot(ctx, S.wpt(h, deg, -50, 0), 4.4, null, IRON, 2.2);
      poly(
        ctx,
        S,
        h,
        deg,
        [
          [66, -25],
          [98, -25],
          [98, 25],
          [66, 25],
        ],
        IRON,
        IRON_D,
        2,
      );
      poly(
        ctx,
        S,
        h,
        deg,
        [
          [69, -25],
          [75, -25],
          [75, 25],
          [69, 25],
        ],
        "#a8743a",
      );
      poly(
        ctx,
        S,
        h,
        deg,
        [
          [89, -25],
          [95, -25],
          [95, 25],
          [89, 25],
        ],
        "#a8743a",
      );
      poly(
        ctx,
        S,
        h,
        deg,
        [
          [77, -11],
          [87, -11],
          [87, 11],
          [77, 11],
        ],
        null,
        IRON_D,
        1.4,
      );
    },
    scythe(ctx, S, h, deg, acc) {
      seg(ctx, S, h, deg, -72, 116, 5, "#2a2230");
      bands(ctx, S, h, deg, -8, 8, 3.2, acc, 6);
      bands(ctx, S, h, deg, 100, 112, 3.2, acc, 6);
      dot(ctx, S.wpt(h, deg, -75, 0), 3.4, acc);
      // The blade leaves the top of the shaft forward (negative v) and curves back down toward the hands.
      poly(
        ctx,
        S,
        h,
        deg,
        [
          [110, 3],
          [120, -6],
          [121, -34],
          [112, -64],
          [94, -90],
          [76, -104],
          [86, -84],
          [100, -58],
          [106, -32],
          [104, -5],
        ],
        STEEL,
        STEEL_D,
        1.8,
      );
      poly(
        ctx,
        S,
        h,
        deg,
        [
          [106, 4],
          [118, 4],
          [118, -6],
          [106, -6],
        ],
        "#2a2230",
      );
    },
  };

  // Designed characters' weapons. pal: colors from the character sheet.
  WEAPON_DRAW.cyberSword = (ctx, S, h, deg, acc, pal) => {
    seg(ctx, S, h, deg, -18, 2, 6.5, "#15161a");
    seg(ctx, S, h, deg, -12, -8, 7.5, pal.glow);
    dot(ctx, S.wpt(h, deg, -20, 0), 4, "#3a3d44");
    const g1 = S.wpt(h, deg, 4, -8),
      g2 = S.wpt(h, deg, 4, 8);
    ctx.strokeStyle = "#3a3d44";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(g1[0], g1[1]);
    ctx.lineTo(g2[0], g2[1]);
    ctx.stroke();
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [7, -4.4],
        [100, -4.2],
        [118, 0.5],
        [100, 4.4],
        [7, 4.4],
      ],
      "#c8ced8",
      "#3c4048",
      1.6,
    );
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [9, 0.8],
        [98, 1.2],
        [114, 0.6],
        [98, 4.2],
        [9, 4.2],
      ],
      "#9aa3b0",
    );
    seg(ctx, S, h, deg, 10, 14, 3, pal.glow);
  };
  WEAPON_DRAW.bat = (ctx, S, h, deg, acc, pal) => {
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [-16, -4.6],
        [-12, -3],
        [30, -3.6],
        [70, -6.4],
        [100, -6.6],
        [102, 0],
        [100, 6.6],
        [70, 6.4],
        [30, 3.6],
        [-12, 3],
        [-16, 4.6],
      ],
      "#c9ccd3",
      "#2a2c31",
      1.8,
    );
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [40, 1.6],
        [70, 3.2],
        [100, 3.4],
        [100, 6.4],
        [70, 6.2],
        [40, 3.6],
      ],
      "#9a9ea6",
    );
    seg(ctx, S, h, deg, -12, 26, 7.2, "#16171a");
    bands(ctx, S, h, deg, -10, 24, 5, "#2c2e33", 7.4);
    // The blue X on the barrel.
    const x0 = S.wpt(h, deg, 78, -5),
      x1 = S.wpt(h, deg, 92, 5),
      x2 = S.wpt(h, deg, 78, 5),
      x3 = S.wpt(h, deg, 92, -5);
    ctx.lineCap = "butt";
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(x0[0], x0[1]);
    ctx.lineTo(x1[0], x1[1]);
    ctx.moveTo(x2[0], x2[1]);
    ctx.lineTo(x3[0], x3[1]);
    ctx.stroke();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x0[0], x0[1]);
    ctx.lineTo(x1[0], x1[1]);
    ctx.moveTo(x2[0], x2[1]);
    ctx.lineTo(x3[0], x3[1]);
    ctx.stroke();
    ctx.lineCap = "round";
  };
  WEAPON_DRAW.staff = (ctx, S, h, deg, acc, pal) => {
    seg(ctx, S, h, deg, -96, 104, 6.4, "#1b1512");
    seg(ctx, S, h, deg, -95, 103, 4.4, "#5a3a26");
    seg(ctx, S, h, deg, -96, -82, 7.4, "#6f747c");
    dot(ctx, S.wpt(h, deg, -100, 0), 4.6, "#8a9099", "#2a2c31", 1.4);
    seg(ctx, S, h, deg, 86, 104, 7.4, "#6f747c");
    dot(ctx, S.wpt(h, deg, 108, 0), 5.2, "#9aa1aa", "#2a2c31", 1.4);
    seg(ctx, S, h, deg, 92, 94, 9, "#3a3d44");
    for (const [a, b] of [
      [64, 82],
      [-80, -64],
    ]) {
      seg(ctx, S, h, deg, a, b, 6.6, "#202a44");
      for (let u = a + 2; u < b; u += 5) {
        const p0 = S.wpt(h, deg, u, -3.2),
          p1 = S.wpt(h, deg, u + 4, 3.2),
          p2 = S.wpt(h, deg, u, 3.2),
          p3 = S.wpt(h, deg, u + 4, -3.2);
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.moveTo(p2[0], p2[1]);
        ctx.lineTo(p3[0], p3[1]);
        ctx.stroke();
      }
    }
    // The white pompom near the top (its ribbons are cloth, drawn by the character).
    dot(ctx, S.wpt(h, deg, 84, 5), 6.2, "#f4f5f7", "#9aa0aa", 1.2);
  };
  WEAPON_DRAW.axe = (ctx, S, h, deg, acc, pal) => {
    seg(ctx, S, h, deg, -34, 104, 7.4, "#14110f");
    seg(ctx, S, h, deg, -33, 103, 5.2, "#3a2c22");
    for (const u of [-24, 70, 80]) seg(ctx, S, h, deg, u, u + 4, 8.6, "#22262c");
    dot(ctx, S.wpt(h, deg, -38, 0), 4.6, "#22262c");
    // Crescent blade forward (negative v), back spike behind, a spike on top.
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [78, -4],
        [70, -18],
        [64, -40],
        [76, -36],
        [92, -34],
        [112, -40],
        [120, -30],
        [110, -18],
        [102, -4],
      ],
      "#2f3640",
      "#0f1216",
      1.8,
    );
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [70, -32],
        [64, -40],
        [76, -38],
        [92, -36],
        [112, -42],
        [118, -34],
        [104, -30],
        [88, -30],
      ],
      pal.edge,
      null,
    );
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [84, 4],
        [96, 16],
        [92, 4],
      ],
      "#2f3640",
      "#0f1216",
      1.4,
    );
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [100, -3],
        [118, 0],
        [100, 3],
      ],
      "#2f3640",
      "#0f1216",
      1.4,
    );
  };

  // Ronin Unit's katana: a long, slim, slightly curved blade, a round guard and a wrapped black grip.
  WEAPON_DRAW.katana = (ctx, S, h, deg, acc, pal) => {
    seg(ctx, S, h, deg, -26, 2, 6, "#121216");
    for (let u = -24; u < 0; u += 5) {
      const a = S.wpt(h, deg, u, -3),
        b = S.wpt(h, deg, u + 4, 3);
      ctx.strokeStyle = "#3a3f48";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    dot(ctx, S.wpt(h, deg, -28, 0), 3.2, "#3a3f48");
    dot(ctx, S.wpt(h, deg, 4, 0), 6.4, "#2a2d33", "#0d0e10", 1.2);
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [7, -3],
        [60, -3.4],
        [104, -6],
        [122, -9.5],
        [112, -2.6],
        [60, 2.6],
        [7, 3],
      ],
      "#d9dee6",
      "#3c4048",
      1.4,
    );
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [9, 0.6],
        [60, 0.8],
        [106, -2.4],
        [112, -3.4],
        [60, 2.6],
        [9, 3],
      ],
      "#a7aeb9",
    );
    seg(ctx, S, h, deg, 8, 14, 2.4, pal.glow || acc);
  };
  // Crimson Veil's dagger lash: one long braided whip held by its middle, with a dagger tied to each end.
  // The front hand pays out the front lash and the back hand the back one (angles p.w and p.w2); between the two
  // hands the spare cord hangs in a loop. A cord sags under its own weight, so a lash that points down lets its
  // dagger dangle and one thrown out level pulls nearly straight. which: "front" draws the front lash, the loop
  // between the hands and the front dagger; "back" draws the back lash and dagger (behind the body).
  const LASH = { reach: 96, blade: 46 };
  function lashBlade(ctx, x, y, ang, pal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const fill = (pts, c, edge, w) => {
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      if (c) {
        ctx.fillStyle = c;
        ctx.fill();
      }
      if (edge) {
        ctx.strokeStyle = edge;
        ctx.lineWidth = w || 1.2;
        ctx.stroke();
      }
    };
    ctx.beginPath();
    ctx.arc(-3, 0, 3.4, 0, Math.PI * 2);
    ctx.strokeStyle = pal.gold;
    ctx.lineWidth = 1.8;
    ctx.stroke(); // the ring the cord is tied to
    fill(
      [
        [0, -2.6],
        [9, -2.6],
        [9, 2.6],
        [0, 2.6],
      ],
      pal.redD || "#760b1b",
      "#120a0c",
      1,
    ); // wrapped grip
    fill(
      [
        [9, -7],
        [12.5, -7],
        [12.5, 7],
        [9, 7],
      ],
      pal.gold,
      "#5a4318",
      1.1,
    ); // crossguard
    fill(
      [
        [12.5, -3.4],
        [LASH.blade - 10, -3.8],
        [LASH.blade, 0],
        [LASH.blade - 10, 3.8],
        [12.5, 3.4],
      ],
      "#d9dee6",
      "#3c4048",
      1.3,
    ); // blade
    fill(
      [
        [14, 0.4],
        [LASH.blade - 10, 0.5],
        [LASH.blade - 2, 0],
        [LASH.blade - 10, 3.8],
        [14, 3.2],
      ],
      "#a7aeb9",
    ); // shaded half
    ctx.beginPath();
    ctx.arc(10.8, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = pal.teal;
    ctx.fill(); // teal gem
    ctx.restore();
  }
  function lashCord(ctx, a, c, b, width) {
    for (const [w, col] of [
      [width + 2, "#0a0709"],
      [width, "#3a2a2e"],
    ]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]);
      ctx.stroke();
    }
    ctx.strokeStyle = "#8a1c2c";
    ctx.lineWidth = 0.9;
    ctx.setLineDash([2.5, 3.5]); // the crimson thread wound round the braid
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // The lash is one real rope: a chain of points that hangs, swings and whips under gravity. Both hands hold it
  // (each pins one point), a dagger is tied to each end, and the animation's lash angles (p.w and p.w2) pull the
  // rope straight when a lash is thrown out level and let it fall slack when it points down or is cocked back.
  const ROPE = { seg: 8, front: 12, spare: 9, back: 12, gravity: 1500, damp: 0.986, iter: 7, step: 1 / 120 };
  function newRope() {
    return {
      pts: null,
      hands: [0, 0],
      n: ROPE.front + ROPE.spare + ROPE.back + 1,
      iF: ROPE.front,
      iB: ROPE.front + ROPE.spare,
    };
  }
  function ropeReset(r, hF, hB) {
    r.pts = [];
    for (let i = 0; i < r.n; i++) {
      const k = i <= r.iF ? r.iF - i : i >= r.iB ? i - r.iB : 0,
        h = i <= r.iB && i >= r.iF ? null : i < r.iF ? hF : hB;
      let x, y;
      if (h) {
        x = h[0];
        y = h[1] + k * ROPE.seg;
      } else {
        const t = (i - r.iF) / (r.iB - r.iF);
        x = hF[0] + (hB[0] - hF[0]) * t;
        y = hF[1] + (hB[1] - hF[1]) * t + 14 * Math.sin(Math.PI * t);
      }
      r.pts.push({ x, y, px: x, py: y });
    }
  }
  const smooth01 = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // How straight the animation wants a lash: 1 when it points level (out in front or behind), near 0 when it points
  // down or up.
  const lashPull = (deg) => 0.04 + 0.62 * smooth01(0.9, 0.4, Math.abs(Math.sin((deg * Math.PI) / 180)));
  function stepRope(r, S, dt) {
    const hF = S.J.fh,
      hB = S.J.bh,
      p = S.p,
      wB = p.w2 !== undefined ? p.w2 : p.w;
    if (!r.pts || r.pts.some((q) => Math.abs(q.x - hF[0]) > 320 || Math.abs(q.y - hF[1]) > 320)) ropeReset(r, hF, hB);
    const n = Math.max(1, Math.min(8, Math.round(dt / ROPE.step))),
      h = dt / n,
      pts = r.pts;
    const tF = lashPull(p.w),
      tB = lashPull(wB);
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < r.n; i++) {
        const q = pts[i],
          vx = (q.x - q.px) * ROPE.damp,
          vy = (q.y - q.py) * ROPE.damp;
        q.px = q.x;
        q.py = q.y;
        q.x += vx;
        q.y += vy + ROPE.gravity * h * h * (i < 2 || i > r.n - 3 ? 1.5 : 1);
      }
      // The animation's own lash angles straighten a lash that is thrown out.
      for (let k = 1; k <= ROPE.front; k++) {
        const q = pts[r.iF - k],
          t = S.wpt(S.L.fh, p.w, k * ROPE.seg, 0),
          w = tF * (0.3 + (0.7 * k) / ROPE.front);
        q.x += (t[0] - q.x) * w;
        q.y += (t[1] - q.y) * w;
      }
      for (let k = 1; k <= ROPE.back; k++) {
        const q = pts[r.iB + k],
          t = S.wpt(S.L.bh, wB, k * ROPE.seg, 0),
          w = tB * (0.3 + (0.7 * k) / ROPE.back);
        q.x += (t[0] - q.x) * w;
        q.y += (t[1] - q.y) * w;
      }
      for (let it = 0; it < ROPE.iter; it++) {
        pts[r.iF].x = hF[0];
        pts[r.iF].y = hF[1];
        pts[r.iB].x = hB[0];
        pts[r.iB].y = hB[1];
        for (let i = 0; i < r.n - 1; i++) {
          const a = pts[i],
            b = pts[i + 1];
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1e-3,
            f = (d - ROPE.seg) / d;
          const aPin = i === r.iF || i === r.iB,
            bPin = i + 1 === r.iF || i + 1 === r.iB;
          if (aPin && bPin) continue;
          if (aPin) {
            b.x -= dx * f;
            b.y -= dy * f;
          } else if (bPin) {
            a.x += dx * f;
            a.y += dy * f;
          } else {
            a.x += dx * f * 0.5;
            a.y += dy * f * 0.5;
            b.x -= dx * f * 0.5;
            b.y -= dy * f * 0.5;
          }
        }
      }
      for (const q of pts) {
        if (q.y > 4) {
          q.y = 4;
          q.py = q.y + (q.py - q.y) * 0.2;
          q.px = q.x - (q.x - q.px) * 0.5;
        }
      } // the floor: the rope lies on it
    }
  }
  function ropePath(ctx, pts, i0, i1) {
    ctx.beginPath();
    ctx.moveTo(pts[i0].x, pts[i0].y);
    for (let i = i0 + 1; i < i1; i++) {
      const m = [(pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2];
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, m[0], m[1]);
    }
    ctx.lineTo(pts[i1].x, pts[i1].y);
  }
  function ropeCord(ctx, pts, i0, i1) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [w, col] of [
      [4.6, "#0a0709"],
      [2.7, "#3a2a2e"],
    ]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ropePath(ctx, pts, i0, i1);
      ctx.stroke();
    }
    ctx.strokeStyle = "#8a1c2c";
    ctx.lineWidth = 0.9;
    ctx.setLineDash([2.5, 3.5]);
    ropePath(ctx, pts, i0, i1);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function ropeBlade(ctx, pts, tip, prev, pal) {
    const a = pts[tip],
      b = pts[prev];
    lashBlade(ctx, a.x, a.y, Math.atan2(a.y - b.y, a.x - b.x), pal);
  }
  function lashDraw(ctx, S, pal, which) {
    const r = S.rope,
      pts = r.pts;
    if (which === "back") {
      ropeCord(ctx, pts, r.iB, r.n - 1);
      ropeBlade(ctx, pts, r.n - 1, r.n - 2, pal);
      return;
    }
    ropeCord(ctx, pts, 0, r.iB);
    ropeBlade(ctx, pts, 0, 1, pal);
    for (const hd of [S.J.fh, S.J.bh]) dot(ctx, hd, 3.4, pal.gold, "#5a4318", 1.1);
  }
  // Without a live rope (afterimages, previews that do not step cloth) the lash is drawn as two sagging cords.
  function lashArm(ctx, S, hand, deg, pal) {
    const a = S.wpt(hand, deg, 2, 0),
      b = S.wpt(hand, deg, LASH.reach, 0),
      m = S.wpt(hand, deg, LASH.reach / 2, 0);
    const sag = 30 * Math.abs(Math.cos((deg * Math.PI) / 180)) + 6;
    const c = [m[0], m[1] + sag * 1.6];
    lashCord(ctx, a, c, b, 2.6);
    const ang = Math.atan2(b[1] - c[1], b[0] - c[0]);
    lashBlade(ctx, b[0], b[1], ang, pal);
  }
  WEAPON_DRAW.daggerLash = (ctx, S, h, deg, acc, pal, which) => {
    pal = pal || { gold: "#c9a24a", teal: "#2fd0c0", redD: "#760b1b" };
    if (S.rope && S.rope.pts) {
      lashDraw(ctx, S, pal, which);
      return;
    }
    const p = S.p;
    if (which !== "front") lashArm(ctx, S, S.L.bh, p.w2 !== undefined ? p.w2 : deg, pal);
    if (which === "back") return;
    const g1 = S.wpt(S.L.fh, deg, -2, 0),
      g2 = S.wpt(S.L.bh, p.w2 !== undefined ? p.w2 : deg, -2, 0);
    const d = Math.hypot(g1[0] - g2[0], g1[1] - g2[1]),
      slack = Math.sqrt(Math.max(0, 64 * 64 - d * d));
    lashCord(ctx, g1, [(g1[0] + g2[0]) / 2, (g1[1] + g2[1]) / 2 + slack * 1.1 + 4], g2, 2.6);
    for (const [hd, an] of [
      [S.L.fh, deg],
      [S.L.bh, p.w2 !== undefined ? p.w2 : deg],
    ]) {
      dot(ctx, S.wpt(hd, an, 0, 0), 3.4, pal.gold, "#5a4318", 1.1);
    }
    lashArm(ctx, S, S.L.fh, deg, pal);
  };
  // Scarlet Reaver's axe: one huge grey crescent with blood streaks and a pale edge, a demon skull crowning
  // the head, red wraps on the shaft.
  WEAPON_DRAW.reaverAxe = (ctx, S, h, deg, acc, pal) => {
    seg(ctx, S, h, deg, -40, 110, 7.6, "#120d0d");
    seg(ctx, S, h, deg, -39, 109, 5.4, "#3a2620");
    for (const u of [-30, -6, 60, 72]) seg(ctx, S, h, deg, u, u + 5, 8.6, pal.redD);
    dot(ctx, S.wpt(h, deg, -44, 0), 5, "#2a2224");
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [74, -4],
        [62, -22],
        [52, -52],
        [68, -50],
        [92, -48],
        [118, -56],
        [130, -40],
        [116, -20],
        [106, -4],
      ],
      "#6f747c",
      "#1c1e22",
      2,
    );
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [56, -48],
        [52, -52],
        [68, -52],
        [92, -50],
        [118, -58],
        [128, -44],
        [112, -46],
        [92, -44],
        [68, -46],
      ],
      "#e9e6df",
    );
    for (const [u, v] of [
      [84, -30],
      [96, -24],
      [74, -38],
    ]) {
      poly(
        ctx,
        S,
        h,
        deg,
        [
          [u, v],
          [u + 4, v - 10],
          [u + 2, v + 2],
        ],
        "rgba(140, 10, 20, 0.85)",
      );
    }
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [100, -6],
        [116, -6],
        [124, 0],
        [116, 8],
        [102, 8],
      ],
      pal.red,
      "#2a0a0e",
      1.4,
    );
    dot(ctx, S.wpt(h, deg, 112, -1), 1.8, "#ffcc33");
    dot(ctx, S.wpt(h, deg, 112, 4), 1.8, "#ffcc33");
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [118, -6],
        [128, -12],
        [122, -2],
      ],
      "#e9e6df",
    );
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [118, 8],
        [128, 14],
        [122, 4],
      ],
      "#e9e6df",
    );
  };
  // Varun's war hammer: a long dark shaft, a heavy block head with gold-bordered faces, a spear spike at the butt.
  WEAPON_DRAW.warHammer = (ctx, S, h, deg, acc, pal) => {
    seg(ctx, S, h, deg, -60, 92, 7, "#141114");
    seg(ctx, S, h, deg, -59, 91, 4.8, "#4a3a2c");
    for (const u of [-10, 6, 70]) seg(ctx, S, h, deg, u, u + 5, 8, pal.gold);
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [-58, -3.4],
        [-64, -6],
        [-90, 0],
        [-64, 6],
        [-58, 3.4],
      ],
      "#c9ccd3",
      "#2a2c31",
      1.4,
    );
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [80, -24],
        [114, -24],
        [114, 24],
        [80, 24],
      ],
      "#5b5f66",
      "#1c1e22",
      2,
    );
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [83, -21],
        [111, -21],
        [111, 21],
        [83, 21],
      ],
      null,
      pal.gold,
      2.2,
    );
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [90, -10],
        [104, -10],
        [104, 10],
        [90, 10],
      ],
      "#3e4248",
      pal.goldD,
      1.2,
    );
    poly(
      ctx,
      S,
      h,
      deg,
      [
        [114, -6],
        [124, 0],
        [114, 6],
      ],
      "#5b5f66",
      "#1c1e22",
      1.4,
    );
  };
  // Grin's pistols: one in each hand, along the forearm (a fist weapon, so the barrel follows elbow to hand).
  function pistolAt(ctx, S, elbow, hand, pal) {
    const dx = hand[0] - elbow[0],
      dy = hand[1] - elbow[1],
      d = Math.hypot(dx, dy) || 1,
      ux = dx / d,
      uy = dy / d,
      nx = -uy,
      ny = ux;
    const toHand = (u, v) => [hand[0] + ux * u + nx * v, hand[1] + uy * u + ny * v];
    const pl = (pts, fill, stroke) => {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const q = toHand(p[0], p[1]);
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      });
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    };
    const side = S.facing;
    pl(
      [
        [-2, 2 * side],
        [5, 2 * side],
        [5, 9 * side],
        [-2, 9 * side],
      ],
      "#1c1c20",
      "#060608",
    );
    pl(
      [
        [-4, -3 * side],
        [24, -3 * side],
        [24, 3 * side],
        [-4, 3 * side],
      ],
      "#2a2a30",
      "#060608",
    );
    pl(
      [
        [16, -3 * side],
        [24, -3 * side],
        [24, 0],
        [16, 0],
      ],
      pal.yellow,
    );
  }
  WEAPON_DRAW.pistols = (ctx, S, h, deg, acc, pal, which) => {
    const J = S.J;
    if (which !== "front") pistolAt(ctx, S, J.be, J.bh, pal);
    if (which !== "back") pistolAt(ctx, S, J.fe, J.fh, pal);
  };

  // Weapon models: how each one is held, drawn and where its trail runs (u, v points along the weapon).
  const WEAPONS = {
    sword: {
      draw: "sword",
      hands: 1,
      trail: [
        [106, 0],
        [36, 0],
      ],
    },
    dual: {
      draw: "dagger",
      hands: 2,
      trail: [
        [60, 0],
        [16, 0],
      ],
      dual: true,
    },
    lash: {
      draw: "daggerLash",
      hands: 2,
      trail: [
        [142, 0],
        [96, 0],
      ],
      dual: true,
    }, // Crimson Veil: a whip with a dagger on each end
    spear: {
      draw: "spear",
      hands: 2,
      trail: [
        [140, 0],
        [92, 0],
      ],
    },
    hammer: {
      draw: "hammer",
      hands: 2,
      trail: [
        [98, 0],
        [66, 0],
      ],
      heavy: true,
    },
    scythe: {
      draw: "scythe",
      hands: 2,
      trail: [
        [78, -102],
        [114, -30],
      ],
    },
    fists: { draw: null, hands: 2, trail: null, fists: true },
    // Weapons of the designed characters.
    bat: {
      draw: "bat",
      hands: 2,
      trail: [
        [100, 0],
        [52, 0],
      ],
    },
    staff: {
      draw: "staff",
      hands: 2,
      trail: [
        [108, 0],
        [64, 0],
      ],
    },
    axe: {
      draw: "axe",
      hands: 2,
      trail: [
        [104, -30],
        [92, -6],
      ],
      heavy: true,
    },
    flame: { draw: null, hands: 2, trail: null, fists: true, orb: true },
    dance: { draw: null, hands: 2, trail: null, fists: true },
  };

  // Trail points (tip, base) in world space for the front weapon, and the back one for dual blades.
  function trailPoints(S, weaponId) {
    const W = WEAPONS[weaponId],
      p = S.p,
      out = [];
    if (W.fists) {
      out.push([S.J.fh, S.xf(pt(S.L.fh, -14, p.fa1), 1)]);
      out.push([S.J.bh, S.xf(pt(S.L.bh, -14, p.ba1), -1)]);
      if (W.orb) out.push([S.J.orb, S.xf([S.L.orb[0] - 7 * (S.p.os || 1), S.L.orb[1]])]);
      if (S.L.fch) {
        out.push([S.J.fch, S.xf(pt(S.L.fch, -14, p.fc1), 1)]);
        out.push([S.J.bch, S.xf(pt(S.L.bch, -14, p.bc1), -1)]);
      }
      return out;
    }
    out.push([S.wpt(S.L.fh, p.w, W.trail[0][0], W.trail[0][1]), S.wpt(S.L.fh, p.w, W.trail[1][0], W.trail[1][1])]);
    if (W.dual) {
      out.push([S.wpt(S.L.bh, p.w2, W.trail[0][0], W.trail[0][1]), S.wpt(S.L.bh, p.w2, W.trail[1][0], W.trail[1][1])]);
    }
    return out;
  }

  // An open hand: a palm with the fingers extended past it along the forearm (parries, taunts, waves).
  function openHand(ctx, hand, wrist, color, wrapped) {
    const dx = hand[0] - wrist[0],
      dy = hand[1] - wrist[1],
      d = Math.hypot(dx, dy) || 1,
      ux = dx / d,
      uy = dy / d;
    if (wrapped) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(wrist[0], wrist[1]);
      ctx.lineTo(hand[0], hand[1]);
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(hand[0], hand[1]);
    ctx.lineTo(hand[0] + ux * 6, hand[1] + uy * 6);
    ctx.stroke();
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(hand[0] + ux * 4, hand[1] + uy * 4);
    ctx.lineTo(hand[0] + ux * 11, hand[1] + uy * 11);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hand[0], hand[1]);
    ctx.lineTo(hand[0] + ux * 3 - uy * 5, hand[1] + uy * 3 + ux * 5);
    ctx.stroke();
    if (wrapped) {
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(hand[0] - ux * 5, hand[1] - uy * 5, 4.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // A weapon trail (smear): a fading ribbon through recent tip and base positions.
  function drawTrail(ctx, hist, color) {
    const n = hist.length;
    if (n < 2) return;
    for (let i = 1; i < n; i++) {
      const a = hist[i - 1],
        b = hist[i],
        k = i / n;
      ctx.globalAlpha = Math.max(0, k * k * 0.75 * Math.min(a.life, b.life));
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.tip[0], a.tip[1]);
      ctx.lineTo(b.tip[0], b.tip[1]);
      ctx.lineTo(b.base[0], b.base[1]);
      ctx.lineTo(a.base[0], a.base[1]);
      ctx.closePath();
      ctx.fill();
    }
    // A bright edge along the tip path.
    ctx.globalAlpha = 1;
    ctx.lineCap = "round";
    for (let i = 1; i < n; i++) {
      const a = hist[i - 1],
        b = hist[i],
        k = i / n;
      ctx.strokeStyle = `rgba(255,255,255,${(k * 0.9 * Math.min(a.life, b.life)).toFixed(3)})`;
      ctx.lineWidth = 1 + k * 3;
      ctx.beginPath();
      ctx.moveTo(a.tip[0], a.tip[1]);
      ctx.lineTo(b.tip[0], b.tip[1]);
      ctx.stroke();
    }
  }

  return {
    pt,
    ik,
    dot,
    ribbon,
    seg,
    poly,
    footPt,
    Chain,
    WEAPON_DRAW,
    openHand,
    BODY,
    EASE,
    FIELDS,
    BASE,
    P,
    blend,
    sample,
    solve,
    drawTrail,
    trailPoints,
    WEAPONS,
    clamp,
    lerp,
    smooth,
    newRope,
    stepRope,
  };
});
