// Canvas drawing only. Reads the world (the duel or the sandbox Sim), never changes it.

const DEG = Math.PI / 180;
const MONO = CONFIG.theme.font;
const THIGH = 34, SHIN = 34, UPPER = 26, FORE = 26, TORSO = 56;

// Point at distance `len` from (x, y) in direction `deg`. 0 = forward, 90 = up, -90 = down.
function pt(x, y, len, deg) {
  return [x + len * Math.cos(deg * DEG), y - len * Math.sin(deg * DEG)];
}

// A pose is joint angles in degrees.
//   lean: torso tilt forward   rot: tilt of the whole body
//   fa/ba: front/back arm [upper, fore]   fl/bl: front/back leg [thigh, shin]
function P(o) { return Object.assign({}, GUARD, o); }
const GUARD = { lean: 8, rot: 0, fa: [12, 85], ba: [-25, 75], fl: [-60, -95], bl: [-120, -85] };
const AIR   = P({ lean: 6, fa: [40, 70], ba: [20, 60], fl: [-40, -100], bl: [-80, -120] });
const HURT  = P({ lean: -26, fa: [140, 150], ba: [165, 140], fl: [-70, -90], bl: [-115, -80] });
const DOWN  = P({ lean: 0, fa: [100, 100], ba: [110, 110], fl: [-100, -100], bl: [-80, -80] });
const SPIN  = P({ lean: 0, fa: [0, 0], ba: [180, 180], fl: [-30, -40], bl: [-150, -140] });

// Move animations: keyframes of [time 0..1, pose].
const ANIMS = {
  jab: [[0, GUARD], [0.35, P({ lean: 18, fa: [4, 2] })], [0.6, P({ lean: 18, fa: [4, 2] })], [1, GUARD]],
  heavy: [
    [0, GUARD],
    [0.3, P({ lean: -14, fa: [150, 110], ba: [-30, 60], fl: [-70, -100], bl: [-135, -80] })],
    [0.55, P({ lean: 36, fa: [-12, -6], ba: [-40, 50], fl: [-45, -90], bl: [-140, -70] })],
    [0.8, P({ lean: 30, fa: [-12, -6], ba: [-40, 50], fl: [-45, -90], bl: [-140, -70] })],
    [1, GUARD],
  ],
  launcher: [
    [0, GUARD],
    [0.3, P({ lean: 24, fa: [-70, -80], ba: [-40, 60], fl: [-35, -100], bl: [-145, -95] })],
    [0.55, P({ lean: -6, fa: [80, 88], ba: [40, 70], fl: [-75, -95], bl: [-110, -100] })],
    [0.8, P({ lean: -6, fa: [80, 88], ba: [40, 70], fl: [-75, -95], bl: [-110, -100] })],
    [1, GUARD],
  ],
  airKick: [[0, AIR], [0.4, P({ lean: -20, fa: [70, 35], ba: [140, 170], fl: [6, 2], bl: [-95, -125] })], [0.75, P({ lean: -20, fa: [70, 35], ba: [140, 170], fl: [6, 2], bl: [-95, -125] })], [1, AIR]],
  slam: [
    [0, P({ lean: -22, fa: [105, 120], ba: [100, 115], fl: [-20, -110], bl: [-70, -120] })],
    [0.6, P({ lean: 48, fa: [-75, -85], ba: [-65, -80], fl: [-30, -85], bl: [-95, -105] })],
    [1, P({ lean: 48, fa: [-75, -85], ba: [-65, -80], fl: [-30, -85], bl: [-95, -105] })],
  ],
  special: [
    [0, GUARD],
    [0.08, P({ ...SPIN, rot: 0 })],
    [0.85, P({ ...SPIN, rot: 1080 })],
    [0.92, P({ rot: 1080, lean: 36, fa: [-12, -6], ba: [-40, 50], fl: [-45, -90], bl: [-140, -70] })],
    [1, P({ rot: 1080, lean: 36, fa: [-12, -6], ba: [-40, 50], fl: [-45, -90], bl: [-140, -70] })],
  ],
};

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

function lerpPose(a, b, t) {
  const o = { lean: lerp(a.lean, b.lean, t), rot: lerp(a.rot, b.rot, t) };
  for (const k of ["fa", "ba", "fl", "bl"]) o[k] = [lerp(a[k][0], b[k][0], t), lerp(a[k][1], b[k][1], t)];
  return o;
}

function sample(frames, t) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (t <= frames[i][0]) {
      const [t0, p0] = frames[i - 1], [t1, p1] = frames[i];
      return lerpPose(p0, p1, ease((t - t0) / (t1 - t0)));
    }
  }
  return frames[frames.length - 1][1];
}

// How far the lowest foot reaches below the hip for a pose.
function legReach(p) {
  const r = (l) => -THIGH * Math.sin(l[0] * DEG) - SHIN * Math.sin(l[1] * DEG);
  return Math.max(r(p.fl), r(p.bl));
}

// The plate caret is the usual Monkeytype yellow, unless the typist's letters are close to that
// hue (yellow, amber, orange): then it is white, so the caret never blends into the letters.
function caretColor(letters) {
  const C = CONFIG.wordPlate.colors;
  const hs = (hex) => {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    let h = 0;
    if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s: max ? d / max : 0 };
  };
  const a = hs(letters), b = hs(C.caret), gap = Math.abs(a.h - b.h);
  return a.s >= 0.25 && Math.min(gap, 360 - gap) < CONFIG.wordPlate.caretHueGap ? C.caretAlt : C.caret;
}

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.camX = CONFIG.player.startX + 120;
    this.clock = 0;
    this.res = 1; // canvas pixels per drawing unit; raise it to keep a scaled up canvas sharp
    this.floorShift = 0;     // view setting: moves the floor down when the arena is taller (Over-head view)
    this.wordPlates = false; // view setting: draw each typist's word over their own fighter
    this.plates = [null, null]; // eased plate positions, purely visual
    // Look. The sandbox keeps the old flat look (THEME.sandbox); main.js turns on the duel's scenery.
    this.pal = CONFIG.theme.sandbox;
    this.scenery = false;    // view setting: draw the Terminal Arcade parallax background
    this.layers = null;      // pre-rendered scenery layers, rebuilt on resize (see buildLayers)
    this.par = 0;            // eased parallax offset (follows the fighters' midpoint)
    this.menuSpar = null;    // [your color, bot color, your weapon, bot weapon]: on the title screen, draw a sparring loop
    // The 2D fighters (js/duel-chars.js), set by main.js: { keys: [yours, the bot's], glows: [#rrggbb, #rrggbb] }.
    // When set, the duel and the title sparring draw the designed fighters instead of the stickmen, and the
    // duel's own sparks are left to the fighters' effects. The sandbox leaves it null.
    this.chars = null;
    // Full screen duel camera (set by main.js; the sandbox leaves them off, so it looks the same):
    this.follow = false;     // follow the fighters' midpoint and zoom out when they fly apart
    this.zoom = 1;           // eased; 1 = the normal framing
    this.clearHalf = 1;      // fraction of the half width that the HUD panels leave clear at floor level
    this.floorFromBottom = 0;// with follow: units of floor under the fighters at zoom 1
    // Player settings (visual only):
    this.shakeScale = 1;     // screen shake strength, 0 = off
    this.noFlash = false;    // reduce motion: no full screen flash
    this.reduceMotion = false; // reduce motion: no plate shake on a typo
    this.damageNumbers = true; // draw the net HP numbers
    // Graphics settings (visual only, set by main.js from the Graphics tab):
    this.sceneryLevel = "full"; // "full" | "simple" (sky and floor only) | "off" (a flat color, or your background image)
    this.scanlines = true;   // the baked scanlines in the scenery
    this.sweep = true;       // the slow band of light that slides down the scenery
    this.bgImage = null;     // custom background image (Themes), drawn in place of the far and mid layers
    this.bgOpts = null;      // { mode, blur, brightness, opacity, saturate }
    this.bgVersion = 0;      // bumped when the image or its filters change, so the layers rebuild
    this.kickAmt = 0;        // an extra shake for the "Test shake" button; decays on its own
  }

  // A test shake for the settings screen (scaled by the shake setting like any other shake).
  kick(amount) { this.kickAmt = Math.max(this.kickAmt, amount); }

  // Custom background: an image (or null) and its filters. The scenery layers rebuild on the next frame.
  setBackground(img, opts, version) {
    this.bgImage = img || null;
    this.bgOpts = opts ? Object.assign({}, opts) : null;
    this.bgVersion = version || 0;
  }

  // Pick the pose for a fighter from its state.
  poseFor(f) {
    if (f.state === "attack" && f.move) {
      const mv = CONFIG.moves[f.move];
      const pose = sample(ANIMS[f.move], Math.min(f.moveT / mv.dur, 1));
      // Alternate arms on jabs so it looks like one two punches.
      if (f.move === "jab" && f.moveCount % 2 === 0) {
        return { ...pose, fa: pose.ba, ba: pose.fa };
      }
      return pose;
    }
    if (f.state === "hurt") return HURT;
    if (f.state === "down") return { ...DOWN, rot: -90 };
    if (f.state === "air") {
      const tilt = -25 + (f.vz < 0 ? -35 * Math.min(1, -f.vz / 900) : 0);
      return { ...HURT, rot: tilt };
    }
    if (f.z > 5) return AIR;
    const bob = Math.sin(this.clock * 4 + (f.team === "enemy" ? 1.5 : 0)) * 2;
    return { ...GUARD, lean: GUARD.lean + bob, fa: [GUARD.fa[0] + bob, GUARD.fa[1]] };
  }

  draw(sim, dt) {
    // `sim` is any world with fighters, fx, shake and flash. Optional: floorY, arenaWidth, cameraX.
    const ctx = this.ctx, k0 = this.res, W0 = this.canvas.width / k0, H0 = this.canvas.height / k0;
    const arenaWidth = sim.arenaWidth !== undefined ? sim.arenaWidth : CONFIG.arena.width;
    this.clock += dt;

    // Duel camera (follow): ease toward the fighters' midpoint and zoom out when they fly apart, so
    // both stay clear of the HUD panels. Purely visual; the duel's own cameraX stays fixed.
    let zoom = 1;
    if (this.follow && sim.fighters && sim.fighters.length === 2) {
      const V = CONFIG.view, [a, b] = sim.fighters;
      const live = !(this.menuSpar && sim.phase === "menu");
      const mid = live ? (a.x + b.x) / 2 : sim.cameraX;
      const need = live ? Math.abs(a.x - b.x) / 2 + V.bodyReach : 0;
      const room = Math.max(60, this.clearHalf * W0 / 2);
      const zt = Math.min(V.maxZoom, Math.max(1, need / room));
      const e = Math.min(1, dt * V.cameraSpeed);
      this.zoom += (zt - this.zoom) * e;
      zoom = this.zoom;
      this.camX += (mid - this.camX) * e;
    }
    const k = k0 / zoom, W = W0 * zoom, H = H0 * zoom;
    const floorY = this.follow
      ? H - this.floorFromBottom * zoom // the floor stays on the same screen row at any zoom
      : (sim.floorY !== undefined ? sim.floorY : CONFIG.arena.floorY) + this.floorShift;

    // Camera follows the action, unless the world pins it.
    if (this.follow) {
      // set above
    } else if (sim.cameraX !== undefined) {
      this.camX = sim.cameraX;
    } else {
      const target = sim.nearestEnemy(sim.player);
      const focus = target ? (sim.player.x + target.x) / 2 : sim.player.x;
      this.camX += (focus - this.camX) * Math.min(1, dt * 5);
    }
    // Keep the view inside the arena; a view wider than the arena stays centred on it.
    this.camX = W >= arenaWidth ? arenaWidth / 2 : Math.min(Math.max(this.camX, W / 2), arenaWidth - W / 2);
    const sx = (wx) => wx - this.camX + W / 2;

    ctx.save();
    ctx.setTransform(k0, 0, 0, k0, 0, 0);
    ctx.clearRect(0, 0, W0, H0);
    if (this.kickAmt > 0.2) this.kickAmt *= Math.pow(0.002, dt); else this.kickAmt = 0;
    const shake = (sim.shake + this.kickAmt) * this.shakeScale;
    const jx = shake > 0 ? (Math.random() - 0.5) * shake : 0, jy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    if (this.scenery) {
      // The scenery is drawn at the normal framing (it never zooms, so its layers are built once per size).
      ctx.translate(jx, jy);
      const baseFloor = this.follow ? H0 - this.floorFromBottom : floorY;
      this.drawScenery(ctx, W0, H0, baseFloor, sim, dt);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.translate(jx, jy);
    } else {
      ctx.translate(jx, jy);
      ctx.fillStyle = this.pal.bg;
      ctx.fillRect(0, 0, W, H);
      this.drawFloor(ctx, W, H, floorY, sx);
    }

    // Fighters, farther ones first. On the title screen: a slow sparring loop instead.
    const C = this.chars && typeof DuelChars !== "undefined" ? this.chars : null;
    const copt = { res: k, noShake: this.shakeScale === 0 || this.reduceMotion, shakeScale: this.shakeScale, shadow: CONFIG.theme.arena.shadow };
    if (this.menuSpar && sim.phase === "menu") {
      const cx = sx(sim.cameraX !== undefined ? sim.cameraX : W / 2);
      if (C) DuelChars.drawSpar(ctx, C.keys, cx, floorY, this.reduceMotion ? 0 : dt, C.glows, copt);
      else this.drawSpar(ctx, cx, floorY);
    } else if (C && sim.streams) DuelChars.drawDuel(ctx, sim, sx(0), floorY, dt, C.keys, C.glows, copt);
    else for (const f of sim.fighters.slice().sort((a, b) => a.z - b.z)) this.drawFighter(ctx, f, sx(f.x), floorY);
    this.drawFx(ctx, sim, sx, floorY, W);
    for (const e of sim.enemies) if (!e.dead) this.drawEnemyBar(ctx, e, sx(e.x), floorY);

    if (sim.flash > 0 && !this.noFlash) {
      ctx.setTransform(k0, 0, 0, k0, 0, 0);
      ctx.fillStyle = `rgba(${this.scenery ? CONFIG.theme.arena.flash : this.pal.flash}, ${0.35 * sim.flash})`;
      ctx.fillRect(0, 0, W0, H0);
    }
    ctx.restore();

    // Word plates are drawn after the shake is undone, so the text never jitters.
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const live = sim.streams && (sim.phase === "countdown" || sim.phase === "fight");
    if (this.wordPlates && live) this.drawPlates(ctx, sim, sx, floorY, W, dt, zoom);
    else this.plates = [null, null];
  }

  // ---------- Word plates (Over-head view) ----------
  // Plate i shows typist i's current word above that typist's own fighter.
  // Your word sits just above your head; the bot's word sits one row higher, above the bot,
  // so the two plates never cover each other. Everything here only reads the duel.
  drawPlates(ctx, duel, sx, floorY, W, dt, zoom = 1) {
    const P = CONFIG.wordPlate;
    const minTop = P.minTop * zoom; // the top HUD sits on a fixed screen row
    const lowBottom = floorY - P.headTop - P.headGap;
    const L = [0, 1].map((i) => this.plateLayout(ctx, duel, i, sx(duel.fighters[i].x), W));
    L[0].ty = lowBottom - L[0].h;
    L[1].ty = Math.max(minTop, L[0].ty - P.rowGap - L[1].h);
    L[0].ty = Math.max(minTop, L[0].ty);

    const k = Math.min(1, dt * P.follow), kc = Math.min(1, dt * P.caretSpeed);
    for (let i = 0; i < 2; i++) {
      const l = L[i], s = duel.streams[i];
      let st = this.plates[i];
      if (!st) st = this.plates[i] = { x: l.tx, y: l.ty, caret: l.caretTarget, index: s.index };
      if (st.index !== s.index) { st.index = s.index; st.caret = l.caretTarget; } // new word: caret starts fresh
      st.x += (l.tx - st.x) * k;
      st.y += (l.ty - st.y) * k;
      st.caret += (l.caretTarget - st.caret) * kc;
      st.w = l.width; st.h = l.h; // for tests and debugging
      this.drawPlate(ctx, duel, i, l, st);
    }
  }

  plateLayout(ctx, duel, i, anchorX, W) {
    const P = CONFIG.wordPlate;
    const s = duel.streams[i], w = s.current(), next = s.words[s.index + 1];
    const font = w.ultimate ? P.ultFont : P.font;
    ctx.font = `bold ${font}px ${MONO}`;
    const cw = ctx.measureText("M").width;
    const n = Math.max(w.text.length, s.typed.length);
    const wordW = n * cw;
    ctx.font = `${P.nextFont}px ${MONO}`;
    const nextW = next ? ctx.measureText(next.text).width : 0;
    const tagW = w.ultimate ? 38 : 0;
    const width = P.padX + tagW + wordW + (next ? 18 + nextW : 0) + P.padX;
    const h = font + P.padY * 2;
    // Centre the current word over the head, then keep the whole plate inside the arena.
    let tx = anchorX - (P.padX + tagW + wordW / 2);
    tx = Math.min(Math.max(tx, P.margin), W - P.margin - width);
    return { w, s, next, font, cw, n, wordW, tagW, width, h, tx, anchorX, caretTarget: Math.min(s.typed.length, n) * cw };
  }

  drawPlate(ctx, duel, i, l, st) {
    const P = CONFIG.wordPlate, C = P.colors;
    const me = duel.typists[i], s = l.s, w = l.w, now = duel.t;
    const ult = w.ultimate;
    const mine = duel.fighters[i].letterColor || (i === 0 ? C.you : C.bot);

    const wrongAge = now - me.lastWrongAt;
    const flashing = wrongAge >= 0 && wrongAge < P.wrongTime;
    const breakAge = now - me.lastComboBreakAt;
    const breaking = breakAge >= 0 && breakAge < P.breakTime;
    const shakeX = flashing && !this.reduceMotion ? Math.sin(wrongAge * 95) * P.shake * Math.min(1.5, this.shakeScale) * (1 - wrongAge / P.wrongTime) : 0;

    const x = Math.round(st.x + shakeX), y = Math.round(st.y);
    ctx.save();

    // Plate body, with a soft pulsing glow for the ultimate word.
    if (ult) {
      ctx.shadowColor = C.ultGlow;
      ctx.shadowBlur = 16 + 6 * Math.sin(this.clock * 6);
    }
    ctx.fillStyle = ult ? C.ultPlate : C.plate;
    roundRect(ctx, x, y, l.width, l.h, P.radius);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Pointer down toward the fighter's head.
    const px = Math.min(Math.max(l.anchorX, x + P.radius + 6), x + l.width - P.radius - 6);
    ctx.beginPath();
    ctx.moveTo(px - 6, y + l.h); ctx.lineTo(px + 6, y + l.h); ctx.lineTo(px, y + l.h + 6);
    ctx.closePath();
    ctx.fill();

    // Border: red flash on a combo break, gold for the ultimate.
    const bt = breaking ? 1 - breakAge / P.breakTime : 0;
    ctx.lineWidth = breaking ? 2 + bt : 1.5;
    ctx.strokeStyle = breaking ? C.wrong : ult ? C.ultBorder : C.border;
    if (breaking) ctx.globalAlpha = 0.35 + 0.65 * bt;
    roundRect(ctx, x, y, l.width, l.h, P.radius);
    ctx.stroke();
    if (breaking) {
      // A short crack from the top edge.
      const cx = x + l.width * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx, y); ctx.lineTo(cx + 5, y + l.h * 0.3); ctx.lineTo(cx - 3, y + l.h * 0.55); ctx.lineTo(cx + 4, y + l.h * 0.8);
      ctx.moveTo(cx + 5, y + l.h * 0.3); ctx.lineTo(cx + 13, y + l.h * 0.42);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ULT tag.
    let wx = x + P.padX;
    const midY = y + l.h / 2;
    ctx.textBaseline = "middle";
    if (ult) {
      ctx.fillStyle = C.ultTag;
      ctx.font = `bold 12px ${MONO}`;
      ctx.textAlign = "left";
      ctx.fillText("ULT", wx, midY);
      wx += l.tagW;
    }

    // Letters.
    ctx.textAlign = "center";
    const typed = s.typed, text = w.text;
    for (let j = 0; j < l.n; j++) {
      const extra = j >= text.length;
      const ch = extra ? typed[j] : text[j];
      let color = ult ? C.ultUntyped : C.untyped, scale = 1;
      if (j < typed.length) {
        if (extra) color = C.extra;
        else if (typed[j] === text[j]) {
          color = mine;
          const age = now - me.lastCorrectAt;
          if (j === me.lastCorrectIndex && age >= 0 && age < P.popTime) scale = 1 + (P.popScale - 1) * (1 - age / P.popTime);
        } else color = C.wrong;
      }
      if (flashing && j === me.lastWrongIndex && me.lastWrongWord === s.index) { color = C.wrong; scale = 1.18; }
      ctx.font = `bold ${l.font}px ${MONO}`;
      const cx = wx + j * l.cw + l.cw / 2;
      // A second cue for typos that does not rely on color: a red bar under every wrong or extra letter.
      if (j < typed.length && (extra || typed[j] !== text[j])) {
        ctx.fillStyle = extra ? C.extraMark : C.wrongMark;
        ctx.fillRect(Math.round(cx - l.cw / 2 + 2), Math.round(midY + l.font * 0.46), Math.round(l.cw - 4), P.typoBar);
      }
      ctx.fillStyle = color;
      if (scale !== 1) {
        ctx.save(); ctx.translate(cx, midY); ctx.scale(scale, scale); ctx.fillText(ch, 0, 0); ctx.restore();
      } else ctx.fillText(ch, cx, midY);
    }

    // Caret slides through the word.
    ctx.fillStyle = caretColor(mine);
    ctx.fillRect(Math.round(wx + st.caret - 1), Math.round(midY - l.font * 0.5), 3, l.font);

    // Next word, smaller and dimmer.
    if (l.next) {
      ctx.textAlign = "left";
      ctx.font = `${P.nextFont}px ${MONO}`;
      ctx.fillStyle = l.next.ultimate ? C.ultNext : C.next;
      ctx.fillText(l.next.text, wx + l.wordW + 18, midY + 2);
    }
    ctx.restore();
  }

  // Loadout preview: your stickman large, holding the selected weapon, showing it off now and then
  // with the same jab and heavy swing the fight uses. The canvas is 320 drawing units tall (a standing
  // stickman is about 160); its pixel size sets the sharpness. Drawing only.
  drawPreview(canvas, color, weapon) {
    const ctx = canvas.getContext("2d"), H = 320, k = canvas.height / H, W = canvas.width / k;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const floorY = H - 64, x = W * 0.36, A = CONFIG.theme.arena;
    ctx.strokeStyle = A.floorLine;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(24, floorY); ctx.lineTo(W - 24, floorY); ctx.stroke();
    ctx.fillStyle = A.shadow;
    ctx.beginPath(); ctx.ellipse(x, floorY + 2, 34, 6, 0, 0, Math.PI * 2); ctx.fill();
    const t = (this.clock % 3.6) / 3.6;
    const show = this.reduceMotion ? null
      : t >= 0.5 && t < 0.62 ? sample(ANIMS.jab, (t - 0.5) / 0.12)
      : t >= 0.7 && t < 0.92 ? sample(ANIMS.heavy, (t - 0.7) / 0.22) : null;
    const pose = show || this.poseFor({ state: "idle", z: 0, team: "player" });
    this.drawStickman(ctx, x, floorY - legReach(pose), 1, pose, color, 1, weapon);
  }

  // ---------- Terminal Arcade scenery (duel only) ----------
  // Three layers, each pre-rendered once per size into an offscreen canvas a little wider than
  // the arena, then slid sideways at its own speed:
  //   far  (0.15): sky, horizon screen glow and a skyline of arcade towers with lit windows
  //   mid  (0.4):  a row of computer-lab desks with CRT monitors and arcade cabinets
  //   near (1.0):  the floor with a perspective grid and cable runs
  // Per frame: three drawImage calls, a few blinking LEDs and one slow scanline sweep.
  buildLayers(W, H, floorY) {
    const A = CONFIG.theme.arena, M = Renderer.PAR_MARGIN, LW = W + 2 * M;
    const level = this.sceneryLevel, full = level === "full" && !this.bgImage;
    // Layer pixels per unit: the screen's, capped so one layer stays under LAYER_MAX_PIXELS. Very large
    // offscreen canvases can drop off the fast drawing path (measured: 4.2 M pixels cost 13 ms a frame,
    // 3 M pixels cost 0.5 ms). On big screens the far layers are then a touch softer, which they can afford.
    const k = Math.min(this.res, Math.sqrt(Renderer.LAYER_MAX_PIXELS / (LW * floorY)));
    const make = (h) => {
      const c = document.createElement("canvas");
      c.width = Math.ceil(LW * k); c.height = Math.ceil(h * k);
      const g = c.getContext("2d");
      g.setTransform(k, 0, 0, k, 0, 0);
      return [c, g];
    };
    let seed = 7; // fixed layout: a tiny seeded generator, so the scene is the same every time
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const scan = (g, h) => { if (!this.scanlines) return; g.fillStyle = A.scan; for (let y = 0; y < h; y += 3) g.fillRect(0, y, LW, 1); };

    // Far: sky, glow, skyline.
    const [far, fg] = make(floorY);
    if (level === "off") {
      fg.fillStyle = A.skyTop; fg.fillRect(0, 0, LW, floorY); // a flat color
    } else {
      const sky = fg.createLinearGradient(0, 0, 0, floorY);
      sky.addColorStop(0, A.skyTop); sky.addColorStop(1, A.skyBottom);
      fg.fillStyle = sky; fg.fillRect(0, 0, LW, floorY);
    }
    if (this.bgImage) this.paintBackground(fg, LW, floorY, k);
    if (full) {
      const glow = fg.createLinearGradient(0, floorY - 150, 0, floorY);
      glow.addColorStop(0, "rgba(0, 0, 0, 0)"); glow.addColorStop(1, A.glow);
      fg.fillStyle = glow; fg.fillRect(0, floorY - 150, LW, 150);
    }
    for (let x = -10; full && x < LW; ) {
      const w = 40 + rnd() * 70, h = 60 + rnd() * Math.min(150, floorY * 0.4), top = floorY - 50 - h;
      fg.fillStyle = A.far; fg.fillRect(x, top, w, h + 50);
      fg.fillStyle = A.farEdge; fg.fillRect(x, top, w, 2);
      fg.fillStyle = A.farWindow;
      for (let wy = top + 10; wy < floorY - 60; wy += 12)
        for (let wx = x + 6; wx < x + w - 8; wx += 10) if (rnd() < 0.35) fg.fillRect(wx, wy, 4, 3);
      x += w + 6 + rnd() * 30;
    }
    scan(fg, floorY);

    // Mid: desks with CRT monitors, and arcade cabinets. LEDs are remembered and blink live.
    // Only in the full scenery without a custom background.
    const [mid, mg] = full ? make(floorY) : [null, null];
    const leds = [];
    for (let x = 20, i = 0; full && x < LW - 60; i++) {
      if (i % 3 === 2) {
        // Arcade cabinet: body, marquee strip, slanted screen, control deck.
        const cw = 64, ch = 150, top = floorY - ch;
        mg.fillStyle = A.mid; mg.fillRect(x, top, cw, ch);
        mg.fillStyle = A.midEdge; mg.fillRect(x, top, cw, 2); mg.fillRect(x, top + 22, cw, 2);
        mg.fillStyle = A.screen; mg.fillRect(x + 8, top + 32, cw - 16, 40);
        mg.fillStyle = A.screenText;
        for (let ly = top + 38; ly < top + 66; ly += 6) mg.fillRect(x + 12, ly, 8 + rnd() * (cw - 32), 2);
        mg.fillStyle = A.midEdge; mg.fillRect(x - 4, top + 84, cw + 8, 6);
        leds.push({ x: x + 14, y: top + 12, c: i % A.leds.length, p: rnd() * 6 });
        leds.push({ x: x + cw - 14, y: top + 12, c: (i + 1) % A.leds.length, p: rnd() * 6 });
        x += cw + 34;
      } else {
        // Desk with a CRT monitor and a keyboard.
        const dw = 120, deskY = floorY - 58;
        mg.fillStyle = A.mid; mg.fillRect(x, deskY, dw, 6); mg.fillRect(x + 6, deskY, 6, 58); mg.fillRect(x + dw - 12, deskY, 6, 58);
        const mx = x + 26, my = deskY - 50;
        mg.fillStyle = A.mid; mg.fillRect(mx, my, 64, 48); mg.fillRect(mx + 26, deskY - 4, 12, 4);
        mg.fillStyle = A.midEdge; mg.fillRect(mx, my, 64, 2);
        mg.fillStyle = A.screen; mg.fillRect(mx + 6, my + 6, 52, 34);
        mg.fillStyle = A.screenText;
        for (let ly = my + 10; ly < my + 36; ly += 5) mg.fillRect(mx + 9, ly, 6 + rnd() * 36, 2);
        mg.fillStyle = A.midEdge; mg.fillRect(x + 22, deskY - 4, 56, 3);
        leds.push({ x: mx + 58, y: my + 44, c: 0, p: rnd() * 6 });
        x += dw + 26;
      }
    }
    if (full) scan(mg, floorY);

    // Near: floor, perspective grid, cables.
    const fh = H - floorY;
    const [near, ng] = make(fh);
    ng.fillStyle = A.floor; ng.fillRect(0, 0, LW, fh);
    ng.strokeStyle = A.grid; ng.lineWidth = 1;
    const vx = LW / 2, depth = 260;
    if (level !== "off") {
      for (let gx = -LW; gx <= 2 * LW; gx += 80) {
        ng.beginPath(); ng.moveTo(vx + (gx - vx) * 0.35, 0); ng.lineTo(gx, fh); ng.stroke();
      }
      for (let d = 1; d < 10; d++) {
        const y = fh * (1 - depth / (depth + d * d * 9));
        ng.beginPath(); ng.moveTo(0, y); ng.lineTo(LW, y); ng.stroke();
      }
    }
    if (full) { ng.fillStyle = A.cable; ng.fillRect(0, Math.min(fh - 6, 34), LW, 3); }
    ng.strokeStyle = A.floorLine; ng.lineWidth = 2;
    ng.beginPath(); ng.moveTo(0, 1); ng.lineTo(LW, 1); ng.stroke();

    this.layers = { W, H, floorY, res: this.res, k, far, mid, near, leds, key: this.layerKey() };
  }

  // What the layers were built from; a change rebuilds them on the next frame.
  layerKey() { return [this.sceneryLevel, this.scanlines ? 1 : 0, this.bgImage ? this.bgVersion : 0, CONFIG.theme.arena.skyTop, CONFIG.theme.arena.floor].join("|"); }

  // The custom background, drawn onto the far layer over the sky: cover, contain or stretch, with the four
  // filters (blur, brightness, saturation and opacity). Done once per rebuild, so it costs nothing per frame.
  paintBackground(g, LW, h, k) {
    const img = this.bgImage, o = this.bgOpts || {};
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const blur = (o.blur || 0) * k;            // the slider is in drawing units; the filter works in canvas pixels
    const pad = Math.ceil((blur * 2) / k);     // overscan so a blurred edge never fades to transparent
    const bw = LW + 2 * pad, bh = h + 2 * pad;
    let w = bw, hh = bh;
    if (o.mode !== "stretch") {
      const sc = o.mode === "contain" ? Math.min(LW / iw, h / ih) : Math.max(bw / iw, bh / ih);
      w = iw * sc; hh = ih * sc;
    }
    const x = (LW - w) / 2, y = (h - hh) / 2;
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, (o.opacity === undefined ? 100 : o.opacity) / 100));
    if ("filter" in g) {
      const f = [];
      if (blur > 0) f.push(`blur(${blur.toFixed(1)}px)`);
      if (o.brightness !== undefined && o.brightness !== 100) f.push(`brightness(${o.brightness}%)`);
      if (o.saturate !== undefined && o.saturate !== 100) f.push(`saturate(${o.saturate}%)`);
      if (f.length) g.filter = f.join(" ");
    }
    g.beginPath(); g.rect(0, 0, LW, h); g.clip(); // keep the image above the floor
    g.drawImage(img, x, y, w, hh);
    g.restore();
  }

  drawScenery(ctx, W, H, floorY, sim, dt) {
    const L = this.layers, M = Renderer.PAR_MARGIN, A = CONFIG.theme.arena;
    if (!L || L.W !== W || L.H !== H || L.floorY !== floorY || L.res !== this.res || L.key !== this.layerKey()) this.buildLayers(W, H, floorY);
    const { far, mid, near, leds } = this.layers, k = this.res, lk = this.layers.k;
    // Parallax follows the midpoint of the fighters (the duel's camera itself is fixed).
    const f = sim.fighters, centre = (sim.arenaWidth !== undefined ? sim.arenaWidth : W) / 2;
    const target = f && f.length === 2 ? (this.follow ? this.camX : (f[0].x + f[1].x) / 2) - centre : 0;
    this.par += (Math.max(-M, Math.min(M, target)) - this.par) * Math.min(1, dt * 3);
    // Whole device pixels, so each layer is copied 1:1 without resampling.
    const snap = (v) => Math.round(v * k) / k;
    const lay = (c, speed, y) => ctx.drawImage(c, snap(-M - this.par * speed), y, c.width / lk, c.height / lk);
    lay(far, 0.15, 0);
    if (mid) {
      lay(mid, 0.4, 0);
      // Blinking LEDs on the mid layer: small, slow, out of phase.
      const midX = snap(-M - this.par * 0.4);
      for (const d of leds) {
        if (!this.reduceMotion && Math.sin(this.clock * 1.3 + d.p) < 0.2) continue;
        ctx.fillStyle = A.leds[d.c];
        ctx.fillRect(midX + d.x, d.y, 3, 3);
      }
    }
    lay(near, 1, floorY);
    // One soft band of light slides down the screen every 9 seconds.
    if (this.sweep && this.sceneryLevel === "full" && !this.reduceMotion) {
      const sy = ((this.clock % 9) / 9) * (H + 60) - 30;
      ctx.fillStyle = A.sweep;
      ctx.fillRect(0, sy, W, 30);
      ctx.fillRect(0, sy + 8, W, 14);
    }
  }

  // Title screen: two stickmen trade slow, harmless punches. Drawing only, no world state.
  // menuSpar = [your color, bot color, your weapon id, bot weapon id].
  drawSpar(ctx, cx, floorY) {
    const [cy, cb, wy, wb] = this.menuSpar, T = 3.2, t = (this.clock % T) / T;
    const sway = this.reduceMotion ? 0 : Math.sin(this.clock * 1.1) * 10;
    const move = (anim, from, to) => (t >= from && t < to ? sample(ANIMS[anim], (t - from) / (to - from)) : null);
    const bob = (ph) => { const b = Math.sin(this.clock * 3 + ph) * 2; return { ...GUARD, lean: GUARD.lean + b, fa: [GUARD.fa[0] + b, GUARD.fa[1]] }; };
    const flinch = P({ lean: -12, fa: [60, 120], ba: [40, 110] });
    const inT = (lo, hi) => t >= lo && t < hi;
    // A throws a one-two, B flinches; then B swings back and A flinches.
    const a = move("jab", 0.05, 0.2) || move("jab", 0.25, 0.4) || (inT(0.67, 0.76) ? flinch : bob(0));
    const b = move("heavy", 0.55, 0.8) || (inT(0.12, 0.19) || inT(0.32, 0.39) ? flinch : bob(1.5));
    const xa = cx - 64 + sway - (inT(0.67, 0.8) ? 8 : 0), xb = cx + 64 + sway + (b === flinch ? 6 : 0);
    for (const [x, pose, facing, color, weapon] of [[xa, a, 1, cy, wy], [xb, b, -1, cb, wb]]) {
      ctx.fillStyle = CONFIG.theme.arena.shadow;
      ctx.beginPath(); ctx.ellipse(x, floorY + 2, 34, 6, 0, 0, Math.PI * 2); ctx.fill();
      this.drawStickman(ctx, x, floorY - legReach(pose), facing, pose, color, 1, weapon);
    }
  }

  drawFloor(ctx, W, H, floorY, sx) {
    ctx.fillStyle = this.pal.floor;
    ctx.fillRect(0, floorY, W, H - floorY);
    ctx.strokeStyle = this.pal.floorLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(W, floorY);
    ctx.stroke();
    // Tick marks so you can see the camera moving.
    ctx.strokeStyle = this.pal.ticks;
    ctx.lineWidth = 2;
    const start = Math.floor((this.camX - W / 2) / 100) * 100;
    for (let wx = start; wx < this.camX + W / 2 + 100; wx += 100) {
      const x = sx(wx);
      ctx.beginPath();
      ctx.moveTo(x, floorY + 6);
      ctx.lineTo(x, floorY + 22);
      ctx.stroke();
    }
  }

  drawFighter(ctx, f, x, floorY) {
    const pose = this.poseFor(f);
    const lying = f.state === "down";
    const grounded = f.z <= 0.5;
    const hipH = lying ? 9 : grounded ? legReach(pose) : 63;
    const y = floorY - f.z - hipH;

    // Shadow.
    ctx.fillStyle = this.scenery ? CONFIG.theme.arena.shadow : this.pal.shadow;
    ctx.globalAlpha = Math.max(0.05, 0.28 - f.z / 900) / 0.28;
    ctx.beginPath();
    ctx.ellipse(x, floorY + 2, Math.max(14, 34 - f.z / 14), 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const sb = CONFIG.theme.sandbox;
    const base = f.color || (f.team === "player" ? sb.player : sb.enemy); // f.color is cosmetic, set by main.js
    const color = f.flashT > 0 ? CONFIG.theme.fx.hit : base;

    // Spin afterimages for the special.
    if (f.state === "attack" && f.move === "special") {
      for (let i = 3; i >= 1; i--) {
        const past = sample(ANIMS.special, Math.max(0, f.moveT / CONFIG.moves.special.dur - i * 0.02));
        this.drawStickman(ctx, x, y, f.facing, past, sb.special, 0.14 * (4 - i), f.weaponLook);
      }
      this.drawStickman(ctx, x, y, f.facing, pose, sb.specialCore, 1, f.weaponLook);
    } else {
      this.drawStickman(ctx, x, y, f.facing, pose, color, 1, f.weaponLook);
    }
  }

  // `weapon` (optional, cosmetic): "light" hand wraps, "medium" bo staff, "heavy" greatsword, drawn in the
  // stickman's own color. The sandbox never passes one.
  drawStickman(ctx, x, y, facing, pose, color, alpha, weapon) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.rotate((pose.rot % 360) * DEG);
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    const body = 90 - pose.lean;
    const [shx, shy] = pt(0, 0, TORSO, body);

    // Returns the hand position and the forearm angle (the weapon follows the forearm).
    const limb = (ox, oy, l1, l2, a) => {
      const [mx, my] = pt(ox, oy, l1, a[0]);
      const [ex, ey] = pt(mx, my, l2, a[1]);
      ctx.beginPath();
      ctx.moveTo(ox, oy); ctx.lineTo(mx, my); ctx.lineTo(ex, ey);
      ctx.stroke();
      return [ex, ey, a[1]];
    };
    const fist = ([fx, fy, deg]) => {
      ctx.beginPath(); ctx.arc(fx, fy, 6, 0, Math.PI * 2); ctx.fill();
      if (weapon === "light") this.drawWraps(ctx, fx, fy, deg);
    };

    // Back limbs a little dimmer for depth.
    ctx.globalAlpha = alpha * 0.65;
    limb(0, 0, THIGH, SHIN, pose.bl);
    fist(limb(shx, shy, UPPER, FORE, pose.ba));
    ctx.globalAlpha = alpha;

    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(shx, shy); ctx.stroke();
    limb(0, 0, THIGH, SHIN, pose.fl);
    const [hx, hy] = pt(shx, shy, 24, body);
    ctx.beginPath(); ctx.arc(hx, hy, 16, 0, Math.PI * 2); ctx.stroke();
    const hand = limb(shx, shy, UPPER, FORE, pose.fa);
    if (weapon === "medium") this.drawStaff(ctx, hand);
    else if (weapon === "heavy") this.drawSword(ctx, hand, color);
    fist(hand);
    ctx.restore();
  }

  // ---------- Weapons: simple shapes in the fighter's color (visual only) ----------
  // Hand wraps: a thick cuff and two wrap bands across the wrist.
  drawWraps(ctx, fx, fy, deg) {
    const [bx, by] = pt(fx, fy, 9, deg + 180); // back along the forearm
    ctx.save();
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(bx, by); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = CONFIG.theme.ui.bg;
    for (const d of [3, 7]) {
      const [cx, cy] = pt(fx, fy, d, deg + 180);
      const [ax, ay] = pt(cx, cy, 5, deg + 90), [zx, zy] = pt(cx, cy, 5, deg - 90);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(zx, zy); ctx.stroke();
    }
    ctx.restore();
  }

  // Bo staff: a long pole through the front hand, along the forearm, with capped ends.
  drawStaff(ctx, [fx, fy, deg]) {
    const [ax, ay] = pt(fx, fy, 70, deg), [bx, by] = pt(fx, fy, 62, deg + 180);
    ctx.save();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.lineWidth = 8;
    for (const [px, py, d] of [[ax, ay, deg + 180], [bx, by, deg]]) {
      const [qx, qy] = pt(px, py, 8, d);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
    }
    ctx.restore();
  }

  // Greatsword: a grip, a crossguard and a broad blade out of the front hand, along the forearm.
  drawSword(ctx, [fx, fy, deg], color) {
    ctx.save();
    ctx.lineWidth = 5;
    const [px, py] = pt(fx, fy, 12, deg + 180); // pommel
    const [gx, gy] = pt(fx, fy, 10, deg);       // crossguard
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(gx, gy); ctx.stroke();
    const [c1x, c1y] = pt(gx, gy, 13, deg + 90), [c2x, c2y] = pt(gx, gy, 13, deg - 90);
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(c1x, c1y); ctx.lineTo(c2x, c2y); ctx.stroke();
    // Blade: wide at the guard, a point at the tip; filled at a lower alpha with a solid edge.
    const len = 96, half = 7;
    const [b1x, b1y] = pt(gx, gy, half, deg + 90), [b2x, b2y] = pt(gx, gy, half, deg - 90);
    const [tx, ty] = pt(gx, gy, len, deg);
    const [s1x, s1y] = pt(tx, ty, 16, deg + 180);
    const [e1x, e1y] = pt(s1x, s1y, half - 1, deg + 90), [e2x, e2y] = pt(s1x, s1y, half - 1, deg - 90);
    ctx.beginPath();
    ctx.moveTo(b1x, b1y); ctx.lineTo(e1x, e1y); ctx.lineTo(tx, ty); ctx.lineTo(e2x, e2y); ctx.lineTo(b2x, b2y); ctx.closePath();
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.45; ctx.fill();
    ctx.globalAlpha = a; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(s1x, s1y); ctx.lineWidth = 1.5; ctx.stroke(); // fuller
    ctx.restore();
  }

  drawFx(ctx, sim, sx, floorY, W) {
    const boxes = [];
    for (const fx of sim.fx) {
      if (fx.lane === "number" && !this.damageNumbers) continue; // player setting
      if (fx.type === "spark" && this.chars && sim.streams) continue; // the 2D fighters draw their own hit effects
      const t = fx.age / fx.life;
      const x = sx(fx.x), y = floorY - fx.z;
      ctx.save();
      // Duel texts stay fully bright for most of their life, then fade; sparks fade from the start.
      ctx.globalAlpha = fx.lane ? Math.min(1, (1 - t) / 0.35) : 1 - t;
      if (fx.type === "spark") {
        const by = fx.by !== undefined && sim.fighters[fx.by];
        ctx.strokeStyle = (by && by.sparkColor) || fx.color; ctx.lineWidth = 3; ctx.lineCap = "round";
        const r0 = fx.size * 0.3 * t + 6, r1 = fx.size * (0.4 + t);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.3;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
          ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
          ctx.stroke();
        }
      } else if (fx.type === "text") {
        ctx.fillStyle = fx.color;
        ctx.font = `bold ${fx.size}px ${MONO}`;
        const align = fx.align || "center";
        const ty = y - t * (fx.rise !== undefined ? fx.rise : 46);
        let tx = x;
        if (fx.lane) {
          // Duel lanes: keep the whole text inside the arena, and record its box (for tests and debugging).
          const m = ctx.measureText(fx.text), w = m.width, M = CONFIG.floatText.margin;
          let x0 = align === "right" ? tx - w : align === "left" ? tx : tx - w / 2;
          const shift = Math.min(Math.max(x0, M), W - M - w) - x0;
          tx += shift; x0 += shift;
          boxes.push({ text: fx.text, lane: fx.lane, owner: fx.owner, x0, x1: x0 + w, y0: ty - m.actualBoundingBoxAscent, y1: ty + m.actualBoundingBoxDescent });
        }
        ctx.textAlign = align;
        if (fx.lane) {
          // A dark outline so the text reads over the scenery.
          ctx.lineJoin = "round";
          ctx.lineWidth = Math.max(4, fx.size * 0.22);
          ctx.strokeStyle = CONFIG.floatText.outline;
          ctx.strokeText(fx.text, tx, ty);
        }
        ctx.fillText(fx.text, tx, ty);
      } else if (fx.type === "ring") {
        ctx.strokeStyle = fx.color; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(x, floorY + 2, 20 + t * 130, 4 + t * 20, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    this.textBoxes = boxes;
  }

  drawEnemyBar(ctx, e, x, floorY) {
    const w = 80, h = 8, y = floorY - e.z - 63 - 118;
    const sb = this.pal;
    ctx.fillStyle = sb.bar;
    ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = sb.barFill;
    ctx.fillRect(x - w / 2, y, w * (e.hp / e.maxHp), h);
    ctx.strokeStyle = sb.barLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2, y, w, h);
  }
}

Renderer.PAR_MARGIN = 120; // extra width on each side of a scenery layer, so it can slide
Renderer.LAYER_MAX_PIXELS = 3.2e6; // pixel budget of one pre-rendered scenery layer (see buildLayers)

// Rounded rectangle path (ctx.roundRect is missing in some older browsers).
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
