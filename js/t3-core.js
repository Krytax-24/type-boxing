// 3D Lab core (lab3d.html): skeleton, poses, blending and inverse kinematics on three.js (js/vendor/three.min.js).
// Drawing and math only, no game rules. Everything lives in the T3 namespace.
//
// Units are meters. World: y up, the floor is y = 0. A character's local space: +x forward (the way it faces),
// +y up, +z its right side (so -z is its left side). Limbs hang along their bone's local -y.
//
// A pose is a flat object of numbers (degrees and meters), so poses blend by simple interpolation:
//   x z     root travel this pose asks for, forward and to the right (the controller moves the fighter by it)
//   y       hip height change from the straight standing height (negative = knees bent)
//   yaw     extra body turn around the vertical axis (spins)
//   hp hy hr / sp sy sr / cp cy cr / dp dy dr   hips, spine, chest and head: pitch (bend forward), yaw (turn to
//           the body's left; negative turns it right, bringing the left shoulder forward), roll. The hips carry
//           everything, so hip pitch tips the whole body (lying down, flips)
//   aL0..aL3 / aR0..aR3   arms: raise (swing forward), out (away from the body), twist, elbow bend
//   bL0..bL3 / bR0..bR3   the second pair of arms (four-armed bodies)
//   oL oR   open hand (0 fist, 1 open)       wL wR   wrist bend
//   fL0..fL3 / fR0..fR3   feet: target x, lift above the floor, z, and pitch (negative = heel up); used by leg IK
//   ikL ikR                1 = the leg reaches its foot target by IK, 0 = the leg uses its FK angles below
//   kL0..kL3 / kR0..kR3   FK legs: raise (thigh swing forward), out, twist, knee bend (for kicks and the air)
//   w0 w1 w2               weapon rotation in the hand          g gd   other hand on the weapon (weight, distance)
//   fx                     effect intensity (flames, glow)
//   tL0..tL3 / tR0..tR3   strike targets: the fist reaches the point (x forward, y up, z right, in the body's
//                          floor frame) by arm IK, with weight tL3 (0 = the FK arm angles above). Punches and
//                          thrusts aim with these, so they travel down the fight line whatever the torso twist.
//   uL0..uL3 / uR0..uR3   the same for the second pair of arms
//   wa0..wa3               weapon aim in the body's frame (including spins): yaw (0 forward, positive to the
//                          left, negative to the right), pitch (up), roll (the edge), and weight over the hand
//                          angles w. Swings move the hand by tR and sweep the weapon by wa, so the blade arcs
//                          through the space in front where the opponent stands.
const T3 = (() => {
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const FIELDS = ["x", "z", "y", "yaw", "hp", "hy", "hr", "sp", "sy", "sr", "cp", "cy", "cr", "dp", "dy", "dr",
    "aL0", "aL1", "aL2", "aL3", "aR0", "aR1", "aR2", "aR3", "bL0", "bL1", "bL2", "bL3", "bR0", "bR1", "bR2", "bR3",
    "oL", "oR", "wL", "wR", "fL0", "fL1", "fL2", "fL3", "fR0", "fR1", "fR2", "fR3", "ikL", "ikR",
    "kL0", "kL1", "kL2", "kL3", "kR0", "kR1", "kR2", "kR3", "w0", "w1", "w2", "g", "gd", "fx",
    "tL0", "tL1", "tL2", "tL3", "tR0", "tR1", "tR2", "tR3", "uL0", "uL1", "uL2", "uL3", "uR0", "uR1", "uR2", "uR3",
    "wa0", "wa1", "wa2", "wa3"];
  const ZERO = {};
  for (const f of FIELDS) ZERO[f] = 0;
  Object.assign(ZERO, { ikL: 1, ikR: 1, fL0: 0.15, fL2: -0.12, fR0: -0.18, fR2: 0.12, aL1: 8, aR1: 8, bL0: -10, bL1: 30, bR0: -10, bR1: 30, gd: 0.3 });

  // Pose from a base pose and a short spec. Array keys set numbered fields: aL: [raise, out, twist, elbow].
  const GROUPS = { aL: 4, aR: 4, bL: 4, bR: 4, fL: 4, fR: 4, kL: 4, kR: 4, w: 3, tL: 4, tR: 4, uL: 4, uR: 4, wa: 4 };
  const TRIPLES = { hip: ["hp", "hy", "hr"], spine: ["sp", "sy", "sr"], chest: ["cp", "cy", "cr"], head: ["dp", "dy", "dr"] };
  function P(base, spec) {
    const o = Object.assign({}, ZERO, base || {});
    if (!spec) return o;
    for (const k in spec) {
      const v = spec[k];
      if (GROUPS[k]) { for (let i = 0; i < v.length; i++) if (v[i] !== null && v[i] !== undefined) o[k + i] = v[i]; }
      else if (TRIPLES[k]) { for (let i = 0; i < v.length; i++) if (v[i] !== null && v[i] !== undefined) o[TRIPLES[k][i]] = v[i]; }
      else o[k] = v;
    }
    // Giving FK leg angles switches that leg to FK unless the spec says otherwise.
    if (spec.kL && spec.ikL === undefined) o.ikL = 0;
    if (spec.kR && spec.ikR === undefined) o.ikR = 0;
    if (spec.fL && !spec.kL && spec.ikL === undefined) o.ikL = 1;
    if (spec.fR && !spec.kR && spec.ikR === undefined) o.ikR = 1;
    return o;
  }
  function blend(a, b, k) { const o = {}; for (const f of FIELDS) o[f] = lerp(a[f], b[f], k); return o; }

  // Easing. inout: wind-ups and recoveries; snap: the strike (fast start, firm stop); hold: contact frames.
  const EASE = {
    linear: (t) => t,
    inout: (t) => t * t * (3 - 2 * t),
    in: (t) => t * t,
    out: (t) => 1 - (1 - t) * (1 - t),
    snap: (t) => 1 - Math.pow(1 - t, 4),
    hold: (t) => t, // contact frames: the two poses are close, so the move simply drifts between them
    back: (t) => { const s = 1.6; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
  };
  // Keys: [time in seconds, pose, ease toward the next key].
  function sample(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t <= b[0]) {
        const u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return blend(a[1], b[1], (EASE[a[2] || "inout"] || EASE.inout)(clamp(u, 0, 1)));
      }
    }
    return keys[keys.length - 1][1];
  }

  // ---------- Skeleton ----------
  // Body proportions (meters). hipH is the hip joint height with straight legs (th + sh + ankle).
  const BODY = { hipW: 0.1, spine: 0.13, chest: 0.27, neck: 0.08, headR: 0.115, shW: 0.2, ua: 0.29, fa: 0.27, hand: 0.1,
    th: 0.45, sh: 0.44, ankle: 0.075, foot: 0.25, arms4: false };
  function bodyOf(over) { const B = Object.assign({}, BODY, over || {}); B.hipH = B.th + B.sh + B.ankle; return B; }

  function makeSkeleton(B) {
    const bones = {};
    const root = new THREE.Group(); root.name = "root"; bones.root = root;
    const add = (name, parent, x, y, z) => { const o = new THREE.Group(); o.name = name; o.position.set(x, y, z); bones[parent].add(o); bones[name] = o; return o; };
    add("hips", "root", 0, B.hipH, 0);
    add("spine", "hips", 0, 0.02, 0);
    add("chest", "spine", 0, B.spine, 0);
    add("neck", "chest", 0, B.chest, 0);
    add("head", "neck", 0, B.neck, 0);
    for (const [s, sz] of [["L", -1], ["R", 1]]) {
      add("ua" + s, "chest", 0, B.chest - 0.035, sz * B.shW);
      add("fa" + s, "ua" + s, 0, -B.ua, 0);
      add("h" + s, "fa" + s, 0, -B.fa, 0);
      if (B.arms4) {
        add("ub" + s, "chest", 0.01, B.chest - 0.17, sz * B.shW * 0.82);
        add("fb" + s, "ub" + s, 0, -B.ua * 0.94, 0);
        add("hb" + s, "fb" + s, 0, -B.fa * 0.94, 0);
      }
      add("th" + s, "hips", 0, -0.03, sz * B.hipW);
      add("sn" + s, "th" + s, 0, -B.th, 0);
      add("ft" + s, "sn" + s, 0, -B.sh, 0);
    }
    // Weapon socket in the right hand. The base turns the socket so a weapon's +x runs along the forearm out of
    // the fist (w = [0, 0, 0] points the weapon the way the punch goes); w2 tilts it toward the back of the hand
    // (up, out of the top of the fist, when the forearm is level), w1 swings it sideways, w0 rolls the edge.
    add("wpnBase", "hR", 0, -B.hand * 0.45, 0);
    bones.wpnBase.rotation.z = -Math.PI / 2;
    add("wpn", "wpnBase", 0, 0, 0);
    return bones;
  }

  // ---------- Applying a pose ----------
  const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
  function setEuler(obj, x, y, z, order) { obj.rotation.set(x * DEG, y * DEG, z * DEG, order || "XYZ"); }
  // Trunk pieces: pitch forward is a negative turn about z (it tips +y toward +x).
  function trunk(obj, p, y, r) { _e.set(r * DEG, y * DEG, -p * DEG, "YXZ"); obj.quaternion.setFromEuler(_e); }
  // A limb: raise swings it forward (about z), out swings it away from the body (about x, mirrored by side),
  // twist turns it about its own axis. Order: raise first, then out in the raised frame, then twist.
  function limb(obj, raise, out, twist, side) { _e.set(-side * out * DEG, side * twist * DEG, raise * DEG, "ZXY"); obj.quaternion.setFromEuler(_e); }

  // Two-bone IK in world space. Returns world quaternions for the upper and lower bone.
  // a, b: bone lengths; start: joint world position; target: end world position; hint: world direction the
  // middle joint bulges toward (the knee forward, the elbow back). lowerSign: +1 if the lower bone bends
  // toward the upper bone's +x (elbow), -1 if toward -x (knee).
  function ik2(start, target, a, b, hint, upperOut, lowerOut) {
    const d = _v.subVectors(target, start); let L = d.length();
    L = clamp(L, Math.abs(a - b) + 0.01, (a + b) * 0.9995);
    const dn = d.normalize();
    const alpha = Math.acos(clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1));
    const k = _v2.copy(hint).addScaledVector(dn, -hint.dot(dn));
    if (k.lengthSq() < 1e-8) k.set(0, 0, 1).addScaledVector(dn, -dn.z);
    k.normalize();
    const up = _v3.copy(dn).multiplyScalar(Math.cos(alpha)).addScaledVector(k, Math.sin(alpha)).normalize(); // upper bone direction
    const mid = _v4.copy(start).addScaledVector(up, a);
    const lowDir = new THREE.Vector3().subVectors(start.clone().addScaledVector(dn, L), mid).normalize();
    // Upper bone frame: local -y along the bone, local +x toward the hint side's perpendicular.
    const yAx = up.clone().negate();
    const xAx = k.clone().addScaledVector(up, -k.dot(up)).normalize();
    const zAx = new THREE.Vector3().crossVectors(xAx, yAx);
    _m.makeBasis(xAx, yAx, zAx);
    upperOut.setFromRotationMatrix(_m);
    // Lower bone: a hinge about the upper bone's z.
    const beta = Math.acos(clamp(up.dot(lowDir), -1, 1));
    const sideX = lowDir.dot(xAx);
    lowerOut.setFromAxisAngle(_v.set(0, 0, 1), sideX >= 0 ? beta : -beta);
    return mid;
  }

  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qf = new THREE.Quaternion();
  const _fk1 = new THREE.Quaternion(), _fk2 = new THREE.Quaternion(), _fk3 = new THREE.Quaternion();
  // Apply pose p to the skeleton. root world position and yaw are set by the caller (the fighter).
  function apply(bones, B, p) {
    const hips = bones.hips;
    hips.position.set(0, B.hipH + p.y, 0);
    trunk(hips, p.hp, p.hy + p.yaw, p.hr);
    trunk(bones.spine, p.sp, p.sy, p.sr);
    trunk(bones.chest, p.cp, p.cy, p.cr);
    trunk(bones.head, p.dp, p.dy, p.dr);
    for (const [s, sd] of [["L", -1], ["R", 1]]) {
      limb(bones["ua" + s], p["a" + s + 0], p["a" + s + 1], p["a" + s + 2], sd);
      setEuler(bones["fa" + s], 0, 0, p["a" + s + 3]);
      setEuler(bones["h" + s], 0, 0, -p["w" + s]);
      if (B.arms4) {
        limb(bones["ub" + s], p["b" + s + 0], p["b" + s + 1], p["b" + s + 2], sd);
        setEuler(bones["fb" + s], 0, 0, p["b" + s + 3]);
      }
    }
    bones.wpn.rotation.set(p.w0 * DEG, p.w1 * DEG, p.w2 * DEG, "XYZ");
    bones.root.updateMatrixWorld(true);
    // Arm IK toward strike targets.
    for (const [s, sd] of [["L", -1], ["R", 1]]) {
      armIK(bones, B, "ua" + s, "fa" + s, p["t" + s + 0], p["t" + s + 1], p["t" + s + 2], p["t" + s + 3], sd, 1);
      if (B.arms4) armIK(bones, B, "ub" + s, "fb" + s, p["u" + s + 0], p["u" + s + 1], p["u" + s + 2], p["u" + s + 3], sd, 0.94);
    }
    // Weapon aim in the body frame.
    if (p.wa3 > 0.001) {
      const rq = bones.root.getWorldQuaternion(new THREE.Quaternion());
      _e.set(p.wa2 * DEG, (p.wa0 + p.yaw) * DEG, p.wa1 * DEG, "YZX");
      const want = rq.multiply(new THREE.Quaternion().setFromEuler(_e));
      const parentQ = bones.wpnBase.getWorldQuaternion(new THREE.Quaternion());
      bones.wpn.quaternion.slerp(parentQ.invert().multiply(want), clamp(p.wa3, 0, 1));
      bones.wpn.updateMatrixWorld(true);
    }
    // Legs: IK toward the foot targets, blended with the FK angles.
    const rootQ = bones.root.getWorldQuaternion(_qp);
    for (const [s, sd] of [["L", -1], ["R", 1]]) {
      const th = bones["th" + s], sn = bones["sn" + s], ft = bones["ft" + s];
      const w = clamp(p["ik" + s], 0, 1);
      // FK result (local quaternions).
      _e.set(-sd * p["k" + s + 1] * DEG, sd * p["k" + s + 2] * DEG, p["k" + s + 0] * DEG, "ZXY"); _fk1.setFromEuler(_e);
      // FK legs aim from the hips without their stance twist (hy), so kicks travel down the fight line; the
      // spin field (yaw), hip pitch and roll still carry them.
      _e.set(p.hr * DEG, p.yaw * DEG, -p.hp * DEG, "YXZ"); _qa.setFromEuler(_e);
      _fk1.premultiply(bones.hips.quaternion.clone().invert().multiply(_qa));
      _fk2.setFromAxisAngle(_v.set(0, 0, 1), -p["k" + s + 3] * DEG);
      _fk3.setFromAxisAngle(_v.set(0, 0, 1), p["f" + s + 3] * DEG);
      if (w > 0.001) {
        const start = th.getWorldPosition(new THREE.Vector3());
        const target = bones.root.localToWorld(new THREE.Vector3(p["f" + s + 0], p["f" + s + 1] + B.ankle, p["f" + s + 2]));
        // Knees point forward and a little outward.
        const hint = new THREE.Vector3(1, 0, sd * 0.25).applyQuaternion(rootQ).normalize();
        const qU = new THREE.Quaternion(), qL = new THREE.Quaternion();
        ik2(start, target, B.th, B.sh, hint, qU, qL);
        // To local: thigh local = inverse(hips world) * thigh world.
        const hipsQ = bones.hips.getWorldQuaternion(new THREE.Quaternion());
        const thLocal = hipsQ.clone().invert().multiply(qU);
        // The knee hinge: a negative turn (the shin swings back).
        const shLocal = qL;
        // Foot: flat toward the body's forward, pitched by fL3, toes a little out.
        const footW = rootQ.clone().multiply(_q.setFromEuler(_e.set(0, -sd * 8 * DEG, p["f" + s + 3] * DEG, "YXZ")));
        const shWorld = qU.clone().multiply(shLocal);
        const ftLocal = shWorld.clone().invert().multiply(footW);
        th.quaternion.copy(_fk1).slerp(thLocal, w);
        sn.quaternion.copy(_fk2).slerp(shLocal, w);
        ft.quaternion.copy(_fk3).slerp(ftLocal, w);
      } else {
        th.quaternion.copy(_fk1); sn.quaternion.copy(_fk2); ft.quaternion.copy(_fk3);
      }
    }
    bones.root.updateMatrixWorld(true);
  }

  // Reach a fist toward a target in the body's floor frame, blended over the FK arm by weight w.
  function armIK(bones, B, uaName, faName, tx, ty, tz, w, sd, k) {
    if (!(w > 0.001)) return;
    const ua = bones[uaName], fa = bones[faName];
    const start = ua.getWorldPosition(new THREE.Vector3());
    const target = bones.root.localToWorld(new THREE.Vector3(tx, ty, tz));
    const rootQ = bones.root.getWorldQuaternion(new THREE.Quaternion());
    const hint = new THREE.Vector3(-0.4, -1, sd * 0.8).applyQuaternion(rootQ).normalize(); // elbow down and out
    const qU = new THREE.Quaternion(), qL = new THREE.Quaternion();
    ik2(start, target, B.ua * k, (B.fa + B.hand * 0.5) * k, hint, qU, qL);
    const parentQ = ua.parent.getWorldQuaternion(new THREE.Quaternion());
    ua.quaternion.slerp(parentQ.invert().multiply(qU), clamp(w, 0, 1));
    fa.quaternion.slerp(qL, clamp(w, 0, 1));
    ua.updateMatrixWorld(true);
  }

  // Put the other hand on a two-handed weapon (after apply): IK of the left arm to a point on the weapon.
  function gripOffhand(bones, B, p) {
    if (p.g < 0.01) return;
    const ua = bones.uaL, fa = bones.faL;
    const start = ua.getWorldPosition(new THREE.Vector3());
    const target = bones.wpn.localToWorld(new THREE.Vector3(-p.gd, 0, 0));
    const handNow = bones.hL.getWorldPosition(new THREE.Vector3());
    const goal = handNow.lerp(target, clamp(p.g, 0, 1));
    const rootQ = bones.root.getWorldQuaternion(new THREE.Quaternion());
    const hint = new THREE.Vector3(-0.5, -1, -0.6).applyQuaternion(rootQ).normalize(); // elbow down, back and out
    const qU = new THREE.Quaternion(), qL = new THREE.Quaternion();
    ik2(start, goal, B.ua, B.fa + B.hand * 0.4, hint, qU, qL);
    const chestQ = bones.chest.getWorldQuaternion(new THREE.Quaternion());
    // The elbow bends the forearm toward the upper arm's -x side here; ik2 already picked the hinge sign.
    ua.quaternion.copy(chestQ.invert().multiply(qU));
    fa.quaternion.copy(qL);
    bones.root.updateMatrixWorld(true);
  }

  // Lowest point of the feet in world space (toe and heel), for the floor guard.
  function lowestFoot(bones, B) {
    let lo = Infinity;
    for (const s of ["L", "R"]) for (const u of [-0.06, B.foot - 0.06]) {
      const q = bones["ft" + s].localToWorld(_v.set(u, -B.ankle + 0.005, 0));
      lo = Math.min(lo, q.y);
    }
    return lo;
  }

  return { DEG, clamp, lerp, FIELDS, ZERO, P, blend, EASE, sample, BODY, bodyOf, makeSkeleton, apply, gripOffhand, lowestFoot, ik2 };
})();
