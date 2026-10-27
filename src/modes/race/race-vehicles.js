/**
 * Race vehicles. The roster in CONFIG.vehicles uses the pictures in race-vehicle-art.js (Krishna's shared car and bike
 * designs): each is drawn from a cached, pre-shrunk copy with its rims spinning. The older code-drawn shapes (a
 * fastback GT, a wedge, a ducktail coupe, a widebody sedan, two bikes) stay as a fallback for any entry with a `shape`
 * instead of `art`. Drawing only: nothing here reads or changes a rule. Vehicles face right and stand on y = 0, with
 * x = 0 at their middle (code-drawn ones are about 124 units long). `look` carries the animation: { wheel (angle),
 * lean (degrees, positive = nose up), body (bob offset), flame (0 to 1 nitro), color }.
 */
CounterType.define("race-vehicles", ["race-config", "race-vehicle-art"], (CONFIG, VEHICLE_ART) => {
  "use strict";

  // Lighter or darker version of a hex color: amt -1 (black) to 1 (white).
  function shade(hex, amt) {
    const n = parseInt(String(hex).replace("#", ""), 16);
    let r = n >> 16,
      g = (n >> 8) & 255,
      b = n & 255;
    const t = amt < 0 ? 0 : 255,
      p = Math.abs(amt);
    r = Math.round(r + (t - r) * p);
    g = Math.round(g + (t - g) * p);
    b = Math.round(b + (t - b) * p);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const TIRE = "#070b18",
    RIM = "#8d9ac8",
    GLASS = "#0d1838",
    GLASS_HI = "rgba(124, 227, 255, 0.35)",
    OUTLINE = "rgba(2, 4, 12, 0.85)";

  function wheel(ctx, x, y, r, angle) {
    ctx.fillStyle = TIRE;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(141, 154, 200, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r - 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#1a2550";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.64, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 5; k++) {
      const a = angle + (k * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.16, y + Math.sin(a) * r * 0.16);
      ctx.lineTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
      ctx.stroke();
    }
    ctx.fillStyle = RIM;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  // A closed body outline with wheel arches cut out of its bottom edge. pts: the upper outline from the rear
  // bottom corner, over the roof, to the front bottom corner. wheels: [[x, r], ...] from rear to front.
  function bodyPath(ctx, pts, wheels, wy, arch, floorY) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (p.length === 4) ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
      else ctx.lineTo(p[0], p[1]);
    }
    const end = pts[pts.length - 1];
    let x = end.length === 4 ? end[2] : end[0];
    ctx.lineTo(x, floorY);
    for (let i = wheels.length - 1; i >= 0; i--) {
      const [cx, r] = wheels[i],
        ar = r + arch;
      ctx.lineTo(cx + ar, floorY);
      ctx.arc(cx, wy, ar, 0, Math.PI, true);
      ctx.lineTo(cx - ar, floorY);
      x = cx - ar;
    }
    ctx.lineTo(pts[0][0], floorY);
    ctx.closePath();
  }

  function paintBody(ctx, color, top, bottom) {
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, shade(color, 0.28));
    g.addColorStop(0.45, color);
    g.addColorStop(1, shade(color, -0.45));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  function glass(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = GLASS;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = GLASS_HI;
    ctx.lineWidth = 3;
    const x0 = pts[0][0],
      y0 = Math.min(...pts.map((p) => p[1]));
    ctx.beginPath();
    ctx.moveTo(x0 + 6, y0 + 14);
    ctx.lineTo(x0 + 18, y0 - 2);
    ctx.stroke();
    ctx.restore();
  }
  function flameAt(ctx, x, y, len, power) {
    if (power <= 0) return;
    const l = len * (0.7 + 0.3 * power);
    const g = ctx.createLinearGradient(x, y, x - l, y);
    g.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    g.addColorStop(0.25, "rgba(124, 227, 255, 0.9)");
    g.addColorStop(1, "rgba(255, 62, 165, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.quadraticCurveTo(x - l * 0.5, y - 6, x - l, y);
    ctx.quadraticCurveTo(x - l * 0.5, y + 6, x, y + 4);
    ctx.closePath();
    ctx.fill();
  }
  const light = (ctx, x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  // ---------- Cars ----------
  const CARS = {
    gt: {
      wheels: [
        [-38, 13],
        [40, 13],
      ],
      body: [
        [-60, -10],
        [-62, -24],
        [-56, -30],
        [-36, -41, -12, -44],
        [8, -44],
        [26, -31],
        [54, -27],
        [63, -22, 62, -12],
      ],
      glass: [
        [-30, -36],
        [-10, -41],
        [6, -41],
        [22, -32],
        [-30, -32],
      ],
      stripe: [-58, -21, 60, -20],
      tail: [-63, -26, 4, 5],
      head: [56, -24, 6, 3],
      exhaust: [-60, -12],
    },
    wedge: {
      wheels: [
        [-40, 13],
        [42, 13],
      ],
      body: [
        [-62, -12],
        [-63, -27],
        [-52, -31],
        [-18, -40],
        [8, -41],
        [34, -30],
        [63, -21],
        [64, -12],
      ],
      glass: [
        [-14, -37],
        [7, -38],
        [27, -31],
        [-14, -31],
      ],
      stripe: [-60, -19, 62, -17],
      tail: [-64, -28, 4, 3],
      head: [52, -24, 10, 2],
      exhaust: [-62, -14],
      vent: [
        [-34, -26],
        [-16, -30],
        [-16, -22],
      ],
    },
    classic: {
      wheels: [
        [-36, 13],
        [36, 13],
      ],
      body: [
        [-58, -11],
        [-60, -24],
        [-58, -30, -52, -33],
        [-40, -33],
        [-25, -48, -2, -48],
        [14, -47, 24, -33],
        [50, -28],
        [62, -26, 61, -14],
      ],
      glass: [
        [-22, -42],
        [-3, -45],
        [12, -44],
        [20, -34],
        [-27, -34],
      ],
      stripe: [-56, -18, 58, -18],
      tail: [-60, -24, 3, 5],
      head: [56, -24, 5, 5],
      exhaust: [-58, -12],
      round: true,
    },
    sedan: {
      wheels: [
        [-40, 14],
        [40, 14],
      ],
      body: [
        [-63, -11],
        [-64, -27],
        [-55, -31],
        [-38, -33],
        [-26, -46],
        [14, -47],
        [30, -33],
        [58, -29],
        [64, -22],
        [64, -11],
      ],
      glass: [
        [-22, -42],
        [10, -43],
        [24, -34],
        [-34, -34],
      ],
      stripe: [-60, -20, 62, -20],
      tail: [-65, -28, 4, 5],
      head: [58, -26, 6, 3],
      exhaust: [-62, -12],
      pillar: -6,
      flare: true,
    },
  };

  function drawCar(ctx, shape, look, part = "all") {
    const d = CARS[shape] || CARS.gt,
      color = look.color || "#7ce3ff";
    const wy = -d.wheels[0][1];
    if (part === "wheels") {
      for (const [cx, r] of d.wheels) wheel(ctx, cx, -r, r, look.wheel || 0);
      return;
    }
    ctx.save();
    ctx.translate(0, look.body || 0);
    if (part === "all") flameAt(ctx, d.exhaust[0], d.exhaust[1], 34, look.flame || 0);
    bodyPath(ctx, d.body, d.wheels, wy, 3, -6);
    paintBody(ctx, color, -48, -6);
    for (const [cx, r] of d.wheels) {
      ctx.fillStyle = "rgba(2, 4, 12, 0.55)";
      ctx.beginPath();
      ctx.arc(cx, wy, r + 2.5, Math.PI, 0);
      ctx.fill();
    }
    glass(ctx, d.glass);
    if (d.pillar !== undefined) {
      ctx.strokeStyle = shade(color, -0.3);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(d.pillar, -44);
      ctx.lineTo(d.pillar, -33);
      ctx.stroke();
    }
    if (d.vent) {
      ctx.beginPath();
      d.vent.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fillStyle = "rgba(2, 4, 12, 0.6)";
      ctx.fill();
    }
    if (d.flare) {
      for (const [cx] of d.wheels) {
        ctx.strokeStyle = shade(color, -0.35);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, wy, 19, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      }
    }
    const [sx0, sy0, sx1, sy1] = d.stripe;
    ctx.strokeStyle = shade(color, 0.55);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    ctx.lineTo(sx1, sy1);
    ctx.stroke();
    light(ctx, d.tail[0], d.tail[1], d.tail[2], d.tail[3], "#ff4d5e");
    if (d.round) {
      ctx.fillStyle = "#fff6d6";
      ctx.beginPath();
      ctx.arc(d.head[0] + 2, d.head[1] + 2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else light(ctx, d.head[0], d.head[1], d.head[2], d.head[3], "#fff6d6");
    ctx.restore();
    if (part === "all") for (const [cx, r] of d.wheels) wheel(ctx, cx, -r, r, look.wheel || 0);
  }

  // ---------- Bikes ----------
  const BIKES = {
    super: {
      wheels: [
        [-36, 13],
        [38, 13],
      ],
      fairing: [
        [-46, -41],
        [-30, -38],
        [-8, -37],
        [6, -43],
        [20, -49],
        [32, -51],
        [38, -59],
        [44, -55],
        [48, -42],
        [44, -30],
        [30, -22],
        [8, -18],
        [-12, -22],
        [-28, -31],
      ],
      hip: [-6, -43],
      knee: [10, -32],
      foot: [-2, -24],
      shoulder: [14, -56],
      head: [22, -62],
      hand: [34, -51],
      tuck: true,
    },
    track: {
      wheels: [
        [-36, 13],
        [38, 13],
      ],
      fairing: [
        [-44, -42],
        [-28, -40],
        [-6, -39],
        [8, -45],
        [24, -49],
        [36, -48],
        [42, -42],
        [42, -33],
        [30, -30],
        [10, -27],
        [-14, -29],
        [-30, -34],
      ],
      hip: [-8, -45],
      knee: [8, -32],
      foot: [-2, -24],
      shoulder: [6, -64],
      head: [11, -71],
      hand: [32, -50],
      frame: true,
    },
  };

  function limb(ctx, a, b, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }

  function drawBike(ctx, shape, look, part = "all") {
    const d = BIKES[shape] || BIKES.super,
      color = look.color || "#7ce3ff";
    const [rear, front] = d.wheels;
    if (part === "wheels") {
      for (const [cx, r] of d.wheels) wheel(ctx, cx, -r, r, look.wheel || 0);
      return;
    }
    ctx.save();
    ctx.translate(0, look.body || 0);
    if (part === "all") flameAt(ctx, -44, -34, 28, look.flame || 0);
    // Swingarm, fork and (track bike) the exposed frame.
    limb(ctx, [-6, -26], [rear[0], -rear[1]], 3, "#3a4a80");
    limb(ctx, [d.hand[0] - 2, d.hand[1] + 4], [front[0], -front[1]], 3.5, "#8d9ac8");
    if (d.frame) {
      ctx.strokeStyle = shade(color, 0.4);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-10, -30);
      ctx.lineTo(4, -42);
      ctx.lineTo(18, -30);
      ctx.lineTo(30, -44);
      ctx.lineTo(-10, -30);
      ctx.stroke();
    }
    // Engine block and exhaust under the fairing, so the body sits on the wheels.
    ctx.fillStyle = "#11183a";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-18, -30);
    ctx.lineTo(20, -30);
    ctx.lineTo(16, -11);
    ctx.lineTo(-10, -11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#3a4a80";
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(-12 + k * 10, -27);
      ctx.lineTo(-10 + k * 10, -14);
      ctx.stroke();
    }
    limb(ctx, [8, -12], [-30, -16], 3.5, "#5a6aa8");
    // Fairing.
    ctx.beginPath();
    d.fairing.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    paintBody(ctx, color, -56, -20);
    ctx.fillStyle = GLASS;
    ctx.beginPath();
    ctx.moveTo(31, -50);
    ctx.lineTo(38, -58);
    ctx.lineTo(43, -54);
    ctx.closePath();
    ctx.fill();
    light(ctx, 45, -44, 4, 3, "#fff6d6");
    light(ctx, -46, -42, 3, 3, "#ff4d5e");
    // Rider: a dark suit with one accent line in the vehicle color, and a helmet with a visor.
    const suit = "#141c3a",
      trim = shade(color, 0.2);
    limb(ctx, d.hip, d.knee, 6, suit);
    limb(ctx, d.knee, d.foot, 5, suit);
    limb(ctx, d.hip, d.shoulder, 8, suit);
    limb(ctx, d.shoulder, d.hand, 4, suit);
    limb(ctx, [(d.hip[0] + d.shoulder[0]) / 2 - 1, (d.hip[1] + d.shoulder[1]) / 2], d.shoulder, 2, trim);
    ctx.fillStyle = shade(color, -0.25);
    ctx.beginPath();
    ctx.arc(d.head[0], d.head[1], 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = GLASS;
    ctx.beginPath();
    ctx.ellipse(d.head[0] + 4, d.head[1] + 1, 4.5, 3, d.tuck ? 0.3 : 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GLASS_HI;
    ctx.fillRect(d.head[0] + 2, d.head[1] - 1, 4, 1.2);
    ctx.restore();
    if (part === "all") for (const [cx, r] of d.wheels) wheel(ctx, cx, -r, r, look.wheel || 0);
  }

  // ---------- Art vehicles (VEHICLE_ART in race-vehicle-art.js) ----------
  // One picture per vehicle. On load the rims are cut out into their own small canvases and cleared from the body,
  // so a frame draws the body and spins each rim around its hub. Pictures are scaled once per on-screen size
  // (halving steps, so a large picture shrinks without shimmer) and cached.
  const ART_SIZE = { car: 150, bike: 60 }; // cars: drawing units from back to front; bikes: units from tyre to helmet
  const arts = new Map(),
    waiting = [];
  function artOf(def) {
    if (!def || !def.art || !VEHICLE_ART[def.art]) return null;
    let a = arts.get(def.art);
    if (!a) {
      const m = VEHICLE_ART[def.art];
      a = { m, ready: false, base: null, rims: [], cache: new Map() };
      a.u = def.kind === "bike" ? ART_SIZE.bike / m.ground : ART_SIZE.car / m.w; // drawing units per picture pixel
      arts.set(def.art, a);
      const img = new Image();
      img.onload = () => {
        buildArt(a, img);
        a.ready = true;
        flushWaiting();
      };
      img.src = m.src;
    }
    return a.ready ? a : null;
  }
  function buildArt(a, img) {
    const m = a.m,
      base = document.createElement("canvas");
    base.width = m.w;
    base.height = m.h;
    const g = base.getContext("2d");
    g.drawImage(img, 0, 0);
    for (const [x, y, , rr] of m.wheels) {
      const s = Math.ceil(rr * 2) + 2,
        c = document.createElement("canvas");
      c.width = c.height = s;
      const h = c.getContext("2d");
      h.beginPath();
      h.arc(s / 2, s / 2, rr, 0, Math.PI * 2);
      h.clip();
      h.drawImage(img, x - s / 2, y - s / 2, s, s, 0, 0, s, s);
      a.rims.push({ c, x, y, s });
      g.save();
      g.globalCompositeOperation = "destination-out";
      g.beginPath();
      g.arc(x, y, rr - 0.6, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    a.base = base;
  }
  // A copy of `src` at w x h device pixels, shrunk in halving steps.
  function shrink(src, w, h) {
    let cur = src,
      cw = src.width,
      ch = src.height;
    while (cw / 2 >= w && ch / 2 >= h) {
      const n = document.createElement("canvas");
      n.width = Math.max(1, Math.round(cw / 2));
      n.height = Math.max(1, Math.round(ch / 2));
      const g = n.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(cur, 0, 0, n.width, n.height);
      cur = n;
      cw = n.width;
      ch = n.height;
    }
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(w));
    out.height = Math.max(1, Math.round(h));
    const g = out.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(cur, 0, 0, out.width, out.height);
    return out;
  }
  // f: device pixels per picture pixel. Cached by rounded size.
  function artScaled(a, f) {
    const key = Math.round(f * 400);
    let c = a.cache.get(key);
    if (!c) {
      const ff = key / 400;
      c = { base: shrink(a.base, a.m.w * ff, a.m.h * ff), rims: a.rims.map((r) => shrink(r.c, r.s * ff, r.s * ff)) };
      if (a.cache.size > 12) a.cache.clear();
      a.cache.set(key, c);
    }
    return c;
  }
  function flushWaiting() {
    for (let i = waiting.length - 1; i >= 0; i--) {
      const [canvas, def, color] = waiting[i];
      if (artOf(def)) {
        waiting.splice(i, 1);
        if (canvas.isConnected) preview(canvas, def, color);
      }
    }
  }
  // Ground point of the art vehicle at (0, 0) in `ctx` units after the caller's scale (`k`: device px per unit).
  function drawArt(ctx, a, look, k) {
    const m = a.m,
      u = a.u,
      sc = artScaled(a, u * k);
    const x0 = -(m.w / 2) * u,
      y0 = -m.ground * u + (look.body || 0);
    ctx.drawImage(sc.base, x0, y0, m.w * u, m.h * u);
    const ang = look.wheel || 0;
    a.rims.forEach((r, i) => {
      ctx.save();
      ctx.translate(x0 + r.x * u, y0 + r.y * u);
      ctx.rotate(ang * (m.wheels[0][2] / m.wheels[i][2]));
      ctx.drawImage(sc.rims[i], (-r.s * u) / 2, (-r.s * u) / 2, r.s * u, r.s * u);
      ctx.restore();
    });
  }
  // Rear wheel contact point (lean pivot) and the exhaust, in units, for an art vehicle.
  function artPoints(a) {
    const m = a.m,
      rear = m.wheels.reduce((p, w) => (w[0] < p[0] ? w : p));
    const X = (px) => (px - m.w / 2) * a.u,
      Y = (py) => (py - m.ground) * a.u;
    return {
      pivot: X(rear[0]),
      exhaust: [X(Math.max(4, rear[0] - rear[2] * 1.15)), Y(rear[1] + rear[2] * 0.25)],
      half: (m.w / 2) * a.u,
    };
  }

  // Draw one vehicle at (x, y) (ground point), `scale` units per pixel, `look` as above.
  function draw(ctx, def, x, y, scale, look) {
    const a = artOf(def);
    if (a) return drawFast(ctx, def, x, y, scale, look, Math.abs(ctx.getTransform().a) || 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    // Shadow on the road.
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 1, 66, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lean (a wheelie or a squat) pivots on the rear wheel's contact point.
    const lean = ((look.lean || 0) * Math.PI) / 180,
      pivot = def.kind === "bike" ? -34 : -38;
    ctx.translate(pivot, 0);
    ctx.rotate(-lean);
    ctx.translate(-pivot, 0);
    if (def.kind === "bike") drawBike(ctx, def.shape, look);
    else drawCar(ctx, def.shape, look);
    ctx.restore();
  }

  // The race draws many vehicles every frame, so the body (paint, glass, rider) is painted once into an offscreen
  // sprite per vehicle, color, scale and pixel density; a frame copies the sprite and draws only the turning wheels
  // and the nitro flame. Same picture as draw(), a fraction of the cost.
  const sprites = new Map();
  const PAD_L = 72,
    PAD_R = 72,
    PAD_T = 84,
    PAD_B = 6; // the sprite box around the vehicle, in vehicle units
  function sprite(def, color, scale, k) {
    const key = `${def.id}|${color}|${scale.toFixed(3)}|${k.toFixed(3)}`;
    let sp = sprites.get(key);
    if (sp) return sp;
    const c = document.createElement("canvas"),
      f = scale * k;
    c.width = Math.ceil((PAD_L + PAD_R) * f);
    c.height = Math.ceil((PAD_T + PAD_B) * f);
    const g = c.getContext("2d");
    g.setTransform(f, 0, 0, f, PAD_L * f, PAD_T * f);
    if (def.kind === "bike") drawBike(g, def.shape, { color }, "body");
    else drawCar(g, def.shape, { color }, "body");
    sp = { c, w: (PAD_L + PAD_R) * scale, h: (PAD_T + PAD_B) * scale };
    if (sprites.size > 64) sprites.clear();
    sprites.set(key, sp);
    return sp;
  }
  // k: device pixels per drawing unit of `ctx` (so the sprite matches the screen 1:1).
  function drawFast(ctx, def, x, y, scale, look, k) {
    const a = artOf(def);
    if (a) {
      const P = artPoints(a);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.ellipse(0, 1, P.half * 0.95, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      const lean = ((look.lean || 0) * Math.PI) / 180;
      if (lean) {
        ctx.translate(P.pivot, 0);
        ctx.rotate(-lean);
        ctx.translate(-P.pivot, 0);
      }
      if (look.flame > 0) {
        ctx.save();
        ctx.translate(0, look.body || 0);
        flameAt(ctx, P.exhaust[0], P.exhaust[1], def.kind === "bike" ? 26 : 34, look.flame);
        ctx.restore();
      }
      drawArt(ctx, a, look, k * scale);
      ctx.restore();
      return;
    }
    if (!def.shape) return;
    const sp = sprite(def, look.color || "#7ce3ff", scale, k);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 1, 66 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    const lean = ((look.lean || 0) * Math.PI) / 180,
      pivot = (def.kind === "bike" ? -34 : -38) * scale;
    if (lean) {
      ctx.translate(pivot, 0);
      ctx.rotate(-lean);
      ctx.translate(-pivot, 0);
    }
    const bob = (look.body || 0) * scale;
    if (look.flame > 0) {
      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(0, look.body || 0);
      if (def.kind === "bike") flameAt(ctx, -44, -34, 28, look.flame);
      else {
        const d = CARS[def.shape] || CARS.gt;
        flameAt(ctx, d.exhaust[0], d.exhaust[1], 34, look.flame);
      }
      ctx.restore();
    }
    ctx.drawImage(sp.c, -PAD_L * scale, -PAD_T * scale + bob, sp.w, sp.h);
    ctx.scale(scale, scale);
    if (def.kind === "bike") drawBike(ctx, def.shape, look, "wheels");
    else drawCar(ctx, def.shape, look, "wheels");
    ctx.restore();
  }

  // A still preview for menus (a small canvas): the vehicle centred with a short shadow line under it.
  function preview(canvas, def, color) {
    const ctx = canvas.getContext("2d"),
      w = canvas.width,
      h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const a = artOf(def);
    if (a) {
      // Fit the picture: cars by length, bikes by height.
      const m = a.m,
        s = Math.min((w * 0.9) / (m.w * a.u), (h * 0.84) / (m.ground * a.u));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawFast(ctx, def, w / 2, h * 0.9, s, { wheel: 0 }, 1);
      return;
    }
    if (def.art) {
      if (!waiting.some((x) => x[0] === canvas)) waiting.push([canvas, def, color]);
      return;
    }
    const s = Math.min(w / 150, h / 90);
    draw(ctx, def, w / 2, h * 0.86, s, { color, wheel: 0.3 });
  }

  const byId = (id) => CONFIG.vehicles.find((v) => v.id === id) || CONFIG.vehicles[0];
  // Start decoding every picture now, so the menus and the first race do not wait.
  CONFIG.vehicles.forEach(artOf);
  const ready = (def) => !def.art || !!artOf(def);
  // Length from back to front in drawing units (cars 150, bikes from their picture), for placing on a track.
  const lengthOf = (def) => {
    const a = artOf(def);
    return a ? a.m.w * a.u : 124;
  };
  return { draw, drawFast, preview, shade, byId, ready, lengthOf };
});
