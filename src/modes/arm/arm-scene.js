/**
 * Arm Wrestling scene: two wrestlers locked over a table, drawn on the arena canvas. Visual only: it reads the match
 * (arm-rules.js) and never changes it. All motion is springs and effects layered on the rule's pull (x):
 *   - the locked hands ride an arc around the middle of the table; their angle follows x through an underdamped
 *     spring, so a surge overshoots a little and a typo jerks the typist's hand back (an impulse, not a rule)
 *   - each forearm keeps its length and its elbow stays on the table (solved every frame), the upper arm hangs from
 *     a shoulder on a torso that leans in when winning and is bent back when losing
 *   - strain (both pushing hard, close power) brings tremble, red faces, veins and sweat; the crowd bobs harder
 *   - the pin is a slam: the hands hit the table, the camera kicks, dust and a crack, then the winner raises a fist
 * Scene units: the table top is y = 0, its middle x = 0, up is negative y. The scene is scaled to fit between the
 * top HUD and the typing box.
 */
CounterType.define("arm-scene", ["arm-config", "settings"], (CONFIG, playerSettings) => {
  "use strict";

  // Read-only view of the player's settings (reduce motion).
  const settings = playerSettings.values;

  const TAU = Math.PI * 2;
  const ELBOW = 44,
    FORE = 152,
    PHI0 = Math.asin(ELBOW / FORE); // elbow pads at x = +-44, forearm (elbow to fist) 152
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  // Lighter (amt > 0) or darker (amt < 0) version of a color given as #rgb, #rrggbb or rgb(); returns #rrggbb so the
  // result can be shaded again.
  const cache = new Map();
  function shade(col, amt) {
    const key = col + "|" + amt;
    let out = cache.get(key);
    if (out) return out;
    let r = 128,
      g = 128,
      b = 128;
    const c = String(col).trim();
    if (c[0] === "#") {
      const h =
        c.length === 4
          ? c
              .slice(1)
              .split("")
              .map((x) => x + x)
              .join("")
          : c.slice(1, 7);
      const n = parseInt(h, 16);
      r = n >> 16;
      g = (n >> 8) & 255;
      b = n & 255;
    } else {
      const m = c.match(/\d+(\.\d+)?/g);
      if (m) [r, g, b] = m.map(Number);
    }
    const t = amt < 0 ? 0 : 255,
      q = Math.abs(amt),
      f = (v) =>
        Math.round(v + (t - v) * q)
          .toString(16)
          .padStart(2, "0");
    out = "#" + f(r) + f(g) + f(b);
    if (cache.size > 400) cache.clear();
    cache.set(key, out);
    return out;
  }

  // Looks for you and the six opponents (cosmetic only): skin, build (body scale), hair and extras.
  const SKINS = ["#f0c39c", "#d9a074", "#b77b52", "#8c5a3a", "#6a4129"];
  const LOOKS = {
    you: { skin: 1, build: 1.0, hair: "band", hairColor: "#1a1410" },
    GREENHORN: { skin: 0, build: 0.9, hair: "buzz", hairColor: "#c8913a" },
    CLERK: { skin: 2, build: 0.94, hair: "part", hairColor: "#2a1d14", glasses: true },
    BRUISER: { skin: 3, build: 1.1, hair: "bald", beard: "#1b120c" },
    SURGEON: { skin: 1, build: 0.97, hair: "cap", hairColor: "#3fb6c8" },
    IRONGRIP: { skin: 2, build: 1.06, hair: "mohawk", hairColor: "#ff3ea5" },
    TITAN: { skin: 4, build: 1.18, hair: "bald", beard: "#0d0907" },
  };
  function lookFor(name, seed) {
    if (LOOKS[name]) return LOOKS[name];
    const keys = Object.keys(LOOKS).filter((k) => k !== "you"),
      pick = LOOKS[keys[seed % keys.length]];
    return Object.assign({}, pick, { skin: seed % SKINS.length });
  }

  // ---------- small drawing helpers ----------
  // A closed smooth shape through points (quadratic curves through the midpoints).
  function smooth(ctx, pts) {
    const n = pts.length,
      mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    let m = mid(pts[n - 1], pts[0]);
    ctx.beginPath();
    ctx.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i],
        q = pts[(i + 1) % n];
      m = mid(p, q);
      ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    ctx.closePath();
  }
  // A muscular limb from a to b. prof: [[t, wUp, wDown], ...] half widths on the lit (upper) side and the other side.
  function limbPts(a, b, prof, flip) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l,
      ny = dx / l;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    } // n points up: the lit side
    if (flip) {
      nx = -nx;
      ny = -ny;
    }
    const P = (t, w) => [a[0] + dx * t + nx * w, a[1] + dy * t + ny * w];
    return { up: prof.map(([t, u]) => P(t, u)), down: prof.map(([t, , d]) => P(t, -d)), P };
  }
  function limb(ctx, a, b, prof, col, opts = {}) {
    const L = limbPts(a, b, prof, opts.flip);
    smooth(ctx, L.up.concat(L.down.slice().reverse()));
    ctx.fillStyle = col;
    ctx.fill();
    // light band along the upper edge, shadow band along the lower edge
    const lit = limbPts(
      a,
      b,
      prof.map(([t, u]) => [t, u * 0.92, -u * 0.35]),
      opts.flip,
    );
    smooth(ctx, lit.up.concat(lit.down.slice().reverse()));
    ctx.fillStyle = shade(col, 0.16);
    ctx.fill();
    const dk = limbPts(
      a,
      b,
      prof.map(([t, , d]) => [t, -d * 0.25, d * 0.95]),
      opts.flip,
    );
    smooth(ctx, dk.up.concat(dk.down.slice().reverse()));
    ctx.fillStyle = shade(col, -0.22);
    ctx.fill();
    smooth(ctx, L.up.concat(L.down.slice().reverse()));
    ctx.strokeStyle = "rgba(6, 8, 18, 0.55)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    return L;
  }

  // ---------- the scene ----------
  class Scene {
    constructor() {
      this.reset({});
    }
    // cfg: { you, foe (colors), foeName, foeSeed }
    reset(cfg) {
      this.cfg = cfg;
      this.L = [LOOKS.you, lookFor(cfg.foeName || "", cfg.foeSeed || 0)];
      this.x = 0;
      this.xv = 0; // displayed pull, spring
      this.th = 0;
      this.thv = 0; // displayed hand angle (radians), spring
      this.trauma = 0;
      this.kick = 0; // camera shake and zoom punch
      this.fx = [];
      this.crack = null;
      this.slammed = false;
      this.overT = 0;
      this.t = 0;
      this.flash = 0;
      this.lastWrong = [-1e9, -1e9];
    }
    // A typo by side i: that hand gives a little (visual only).
    typo(i) {
      if (!settings.reduceMotion) {
        this.thv += (i ? 1 : -1) * 1.1;
        this.trauma = Math.max(this.trauma, 0.12);
      }
    }

    update(dt, s) {
      const rm = settings.reduceMotion;
      this.t += dt;
      // Pull spring toward the rule's x, then the hand angle spring toward x (max 82 degrees at a pin).
      const k = rm ? 400 : 90,
        c = 2 * Math.sqrt(k) * (rm ? 1 : 0.62);
      this.xv += (k * (s.x - this.x) - c * this.xv) * dt;
      this.x += this.xv * dt;
      const target = clamp(this.x, -1, 1) * 1.43;
      const k2 = s.phase === "over" ? 260 : 140,
        c2 = 2 * Math.sqrt(k2) * (s.phase === "over" ? 0.35 : 0.55);
      this.thv += (k2 * (target - this.th) - c2 * this.thv) * dt;
      this.th += this.thv * dt;
      // The table stops the hands: bounce on the slam.
      if (Math.abs(this.th) > 1.47) {
        this.th = Math.sign(this.th) * 1.47;
        if (this.thv * this.th > 0) this.thv *= -0.35;
      }
      if (s.phase === "over") {
        this.overT += dt;
        if (!this.slammed && s.result && s.result.how === "pin" && Math.abs(this.th) > 1.36) this.slam(s);
        if (!this.slammed && s.result && s.result.how !== "pin" && this.overT > 0.05) {
          this.slammed = true;
          this.trauma = rm ? 0 : 0.35;
        }
      } else {
        this.overT = 0;
        this.slammed = false;
        this.crack = null;
      }
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
      this.kick = Math.max(0, this.kick - dt * 2.4);
      this.flash = Math.max(0, this.flash - dt * 3);
      // Sweat from a straining face.
      const st = this.strain(s);
      for (let i = 0; i < 2; i++) if (!rm && st.side[i] > 0.55 && Math.random() < dt * 2.2 * st.side[i]) this.drop(i);
      this.fx = this.fx.filter((p) => (p.age += dt) < p.life);
      for (const p of this.fx) {
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    slam(s) {
      this.slammed = true;
      const rm = settings.reduceMotion,
        H = this.hand(),
        w = s.result.winner;
      this.crack = { x: H[0] + (w === 0 ? 18 : -18), seed: (s.seed % 97) + 3 };
      if (rm) return;
      this.trauma = 1;
      this.kick = 1;
      this.flash = 1;
      for (let q = 0; q < 26; q++) {
        this.fx.push({
          kind: "dust",
          x: H[0] + (Math.random() - 0.5) * 40,
          y: -2,
          vx: (Math.random() - 0.5) * 260,
          vy: -40 - Math.random() * 120,
          g: 260,
          r: 2 + Math.random() * 4,
          life: 0.6 + Math.random() * 0.5,
          age: 0,
        });
      }
      for (let q = 0; q < 10; q++) {
        const a = Math.PI + Math.random() * Math.PI;
        this.fx.push({
          kind: "spark",
          x: H[0],
          y: -10,
          vx: Math.cos(a) * 320,
          vy: Math.sin(a) * 320,
          g: 500,
          r: 2,
          life: 0.35,
          age: 0,
        });
      }
    }
    drop(i) {
      const head = this.headPos[i];
      if (!head) return;
      const dir = i ? -1 : 1;
      this.fx.push({
        kind: "sweat",
        x: head[0] + dir * 8 + (Math.random() - 0.5) * 16,
        y: head[1] - 18,
        vx: dir * (10 + Math.random() * 30) * -1,
        vy: -30 - Math.random() * 30,
        g: 420,
        r: 2.2,
        life: 0.7,
        age: 0,
      });
    }
    // Strain 0..1: both pushing hard with close power; per side: how hard that side pushes.
    strain(s) {
      if (s.phase !== "fight") return { all: 0, side: [0, 0] };
      const e = [clamp(s.power[0] / 0.55, 0, 1), clamp(s.power[1] / 0.55, 0, 1)];
      const close = clamp(1 - Math.abs(s.power[0] - s.power[1]) / 0.12, 0, 1);
      const all = Math.min(e[0], e[1]) * close;
      const near = clamp((Math.abs(this.x) - 0.5) / 0.5, 0, 1); // the side about to lose fights hardest
      const lose = this.x > 0 ? 1 : 0;
      const side = [Math.max(all, e[0] * 0.5, lose === 0 ? near : 0), Math.max(all, e[1] * 0.5, lose === 1 ? near : 0)];
      return { all, side };
    }
    // The locked hands. At rest both forearms lean in and meet over the middle; as one side wins, the LOSER's forearm
    // turns on its planted elbow and goes down flat on its own side (that is what a pin looks like), and the
    // winner's arm follows over the top.
    hand() {
      const t = clamp(Math.abs(this.th) / 1.43, 0, 1.03),
        side = this.th >= 0 ? 1 : -1;
      const phi = mix(-PHI0, 1.47, t * t * (3 - 2 * Math.min(1, t)) + Math.max(0, t - 1));
      return [side * (ELBOW + FORE * Math.sin(phi)), -8 - FORE * Math.cos(phi)];
    }
    // Rotation of the locked fists: follows the loser's forearm, 0 at rest.
    handTilt() {
      const t = clamp(Math.abs(this.th) / 1.43, 0, 1.03),
        side = this.th >= 0 ? 1 : -1;
      const phi = mix(-PHI0, 1.47, t * t * (3 - 2 * Math.min(1, t)) + Math.max(0, t - 1));
      return side * (phi + PHI0) * 0.8;
    }

    // ---------- draw ----------
    // area: { top, bottom } in UI units; k: device pixels per UI unit.
    draw(ctx, W, H, k, s, area, dt) {
      const UI = CONFIG.theme.ui,
        A = CONFIG.theme.arena,
        rm = settings.reduceMotion;
      const st = this.strain(s);
      // Camera: fit the scene (heads to just under the table) between the HUDs, zoom in near a pin.
      const room = Math.max(160, area.bottom - area.top);
      const S = clamp(Math.min(room / 372, W / 820), 0.55, 1.7);
      const near = clamp((Math.abs(this.x) - 0.45) / 0.55, 0, 1);
      const Z = 1 + (rm ? 0 : 0.1 * near * near + 0.06 * this.kick);
      const cx = W / 2,
        ty = area.bottom - 34 * S;
      const shake = rm ? 0 : this.trauma * this.trauma * 16;
      const sx = shake * (Math.sin(this.t * 53.1) + Math.sin(this.t * 31.7)) * 0.5,
        sy = shake * (Math.sin(this.t * 47.3 + 1) + Math.sin(this.t * 27.9)) * 0.5;
      const Hd = this.hand(),
        fx = Hd[0] * 0.5,
        fy = -110;
      const sc = S * Z,
        ox = cx + fx * S * (1 - Z) + sx,
        oy = ty + fy * S * (1 - Z) + sy;

      this.room(ctx, W, H, k, A, UI);
      ctx.setTransform(k * sc, 0, 0, k * sc, k * ox, k * oy);
      this.crowd(ctx, s, st);
      this.spot(ctx);
      this.table(ctx, UI);
      // Body poses.
      const P = [this.pose(0, s, st), this.pose(1, s, st)];
      this.headPos = P.map((p) => p.head);
      for (const i of [1, 0]) this.body(ctx, i, P[i], s, st);
      const arms = [this.armGeo(0, P[0]), this.armGeo(1, P[1])];
      for (const i of [1, 0]) this.upperArm(ctx, i, P[i], arms[i]);
      for (const i of [1, 0]) this.forearm(ctx, i, arms[i], st);
      this.fists(ctx, arms, st);
      this.effects(ctx, UI);
      // Screen space: vignette, slam flash.
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const vg = ctx.createRadialGradient(cx, ty - 120 * S, 120 * S, cx, ty - 120 * S, Math.max(W, H) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, `rgba(2, 3, 10, ${0.55 + 0.25 * near})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255, 246, 214, ${0.22 * this.flash})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // Back wall, neon sign, floor glow (screen space).
    room(ctx, W, H, k, A, UI) {
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, A.skyTop);
      bg.addColorStop(1, A.skyBottom);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      // brick rows, very low contrast
      ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
      for (let y = 0, r = 0; y < H; y += 22, r++) {
        for (let x = (r % 2) * 40 - 40; x < W; x += 80) ctx.fillRect(x, y, 76, 18);
      }
      // neon sign
      const nx = W / 2,
        ny = Math.max(70, H * 0.17);
      ctx.save();
      ctx.font = `700 ${Math.round(Math.min(64, W / 18))}px ${CONFIG.theme.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const flick = 0.85 + 0.15 * Math.sin(this.t * 17) * Math.sin(this.t * 3.1);
      ctx.shadowColor = UI.magenta;
      ctx.shadowBlur = 24;
      ctx.globalAlpha = 0.28 * flick;
      ctx.fillStyle = UI.magenta;
      ctx.fillText("IRON GRIP CLUB", nx, ny);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.12;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = UI.text;
      ctx.strokeText("IRON GRIP CLUB", nx, ny);
      ctx.restore();
    }
    // The crowd: dark silhouettes behind the table that bob with the tension (and cheer at the end).
    crowd(ctx, s, st) {
      const hype =
        s.phase === "over" ? clamp(1.2 - this.overT * 0.3, 0.4, 1.2) : 0.2 + 0.5 * Math.abs(this.x) + 0.5 * st.all;
      for (let row = 0; row < 2; row++) {
        const n = 13,
          y0 = -150 + row * 34,
          col = row ? "#0e1532" : "#0a1028";
        for (let i = 0; i < n; i++) {
          const x = -520 + i * 82 + (row ? 40 : 0) + ((i * 37) % 23);
          if (Math.abs(x) < 120 && row === 1) continue;
          const f = 3 + ((i * 7 + row * 3) % 5),
            bob = settings.reduceMotion ? 0 : Math.abs(Math.sin(this.t * f + i * 1.7)) * 9 * hype;
          const sz = 1 + ((i * 13 + row) % 4) * 0.06;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(x, y0 + 40 - bob * 0.4, 34 * sz, 30, 0, Math.PI, 0);
          ctx.fill();
          ctx.fillRect(x - 34 * sz, y0 + 40 - bob * 0.4, 68 * sz, 80);
          ctx.beginPath();
          ctx.arc(x, y0 - bob, 15 * sz, 0, TAU);
          ctx.fill();
          if (s.phase === "over" && (i + row) % 3 === 0 && !settings.reduceMotion) {
            // raised arms
            ctx.strokeStyle = col;
            ctx.lineWidth = 9;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(x - 22, y0 + 28);
            ctx.lineTo(x - 30, y0 - 26 - bob);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + 22, y0 + 28);
            ctx.lineTo(x + 28, y0 - 24 - bob);
            ctx.stroke();
          }
        }
      }
    }
    spot(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(0, -420, 0, 40);
      g.addColorStop(0, "rgba(124, 227, 255, 0.10)");
      g.addColorStop(1, "rgba(124, 227, 255, 0.02)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-60, -460);
      ctx.lineTo(60, -460);
      ctx.lineTo(300, 10);
      ctx.lineTo(-300, 10);
      ctx.closePath();
      ctx.fill();
      const pool = ctx.createRadialGradient(0, 0, 10, 0, 0, 280);
      pool.addColorStop(0, "rgba(255, 246, 214, 0.16)");
      pool.addColorStop(1, "rgba(255, 246, 214, 0)");
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.ellipse(0, -4, 300, 40, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    table(ctx, UI) {
      const you = this.cfg.you || UI.phosphor,
        foe = this.cfg.foe || "#fb923c";
      // legs, apron, top surface (seen a little from above), front edge highlight
      ctx.fillStyle = "#070c20";
      ctx.fillRect(-190, 30, 26, 160);
      ctx.fillRect(164, 30, 26, 160);
      ctx.fillStyle = "#0d1536";
      ctx.fillRect(-220, 0, 440, 34);
      ctx.fillStyle = "#16224f";
      ctx.beginPath();
      ctx.moveTo(-206, -16);
      ctx.lineTo(206, -16);
      ctx.lineTo(220, 0);
      ctx.lineTo(-220, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = UI.line;
      ctx.fillRect(-220, 0, 440, 2.5);
      ctx.fillStyle = "rgba(232, 237, 255, 0.06)";
      ctx.fillRect(-220, 6, 440, 2);
      // center line, elbow pads in each player's color, pin pads at the ends
      ctx.fillStyle = "rgba(232, 237, 255, 0.18)";
      ctx.fillRect(-1.5, -16, 3, 16);
      for (const [x, c] of [
        [-ELBOW, you],
        [ELBOW, foe],
      ]) {
        ctx.fillStyle = shade(c, -0.55);
        ctx.beginPath();
        ctx.ellipse(x, -7, 34, 8, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = shade(c, -0.25);
        ctx.beginPath();
        ctx.ellipse(x, -9, 30, 6, 0, 0, TAU);
        ctx.fill();
      }
      for (const [x, c] of [
        [-168, you],
        [168, foe],
      ]) {
        ctx.fillStyle = shade(c, -0.6);
        ctx.beginPath();
        ctx.ellipse(x, -7, 30, 6, 0, 0, TAU);
        ctx.fill();
      }
      // the crack left by a pin
      if (this.crack) {
        ctx.strokeStyle = "rgba(2, 4, 12, 0.85)";
        ctx.lineWidth = 1.6;
        let r = this.crack.seed;
        const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
        for (let q = 0; q < 5; q++) {
          ctx.beginPath();
          let x = this.crack.x,
            y = -8;
          ctx.moveTo(x, y);
          for (let j = 0; j < 4; j++) {
            x += (rnd() - 0.5) * 30;
            y += (rnd() - 0.3) * 6;
            ctx.lineTo(x, Math.min(1, y));
          }
          ctx.stroke();
        }
      }
      // grip pegs for the free hands
      for (const x of [-150, 150]) {
        ctx.fillStyle = "#24315f";
        ctx.fillRect(x - 5, -54, 10, 46);
        ctx.fillStyle = "#34437a";
        ctx.fillRect(x - 5, -54, 4, 46);
      }
    }

    // Pose of wrestler i: pelvis, lean, shoulder, head, and the victory or defeat at the end.
    pose(i, s, st) {
      const dir = i ? -1 : 1,
        b = this.L[i].build,
        adv = i ? -this.x : this.x; // adv > 0: this side is winning
      const over = s.phase === "over" ? clamp(this.overT / 0.6, 0, 1) : 0,
        won = s.result && s.result.winner === i;
      const trem = settings.reduceMotion ? 0 : st.side[i] * 1.6 * Math.sin(this.t * 41 + i * 2);
      let lean = 0.32 + 0.24 * adv + 0.06 * st.side[i];
      if (over) lean = mix(lean, won ? 0.1 : 0.5, over);
      // The winner comes over the top (the whole body moves in), the loser is dragged a little the other way.
      const win = Math.max(0, adv),
        lose = Math.max(0, -adv);
      const px = -dir * 262 + dir * (78 * Math.pow(win, 1.4) - 14 * lose) + trem * 0.4,
        py = 70 + 10 * win;
      const up = [dir * Math.sin(lean), -Math.cos(lean)],
        fwd = [dir * Math.cos(lean), Math.sin(lean)];
      const L = (a, h) => [
        px + fwd[0] * a * b + up[0] * h * (0.9 + 0.1 * b),
        py + fwd[1] * a * b + up[1] * h * (0.9 + 0.1 * b),
      ];
      const shoulder = L(44, 182),
        back = L(-22, 186),
        neck = L(4, 202);
      const bob = won && over ? Math.sin(this.overT * 9) * 4 * (settings.reduceMotion ? 0 : 1) : 0;
      const nod = over ? (won ? -0.25 : 0.35) * over : -0.1 * adv;
      const head = L(16, 246 - (over && !won ? 10 * over : 0));
      head[1] += bob;
      return { dir, b, lean, up, fwd, L, shoulder, back, neck, head, nod, over, won, trem, px, py };
    }

    // Elbow and wrist of wrestler i's arm: the hand on its arc, the elbow solved on the table.
    armGeo(i, p) {
      const H = this.hand(),
        dir = p.dir,
        rest = [-dir * ELBOW, -8];
      const Lf = FORE,
        d0 = Math.hypot(H[0] - rest[0], H[1] - rest[1]);
      const len = clamp(d0, Lf * 0.9, Lf * 1.12),
        dy = H[1] - rest[1];
      const span = Math.sqrt(Math.max(0, len * len - dy * dy));
      const ex = Math.abs(H[0] - span - rest[0]) < Math.abs(H[0] + span - rest[0]) ? H[0] - span : H[0] + span;
      const lo = dir > 0 ? rest[0] - 30 : rest[0] - 70,
        hi = dir > 0 ? rest[0] + 70 : rest[0] + 30; // slides in more than out
      const elbow = [clamp(ex, lo, hi), rest[1] - Math.max(0, d0 - Lf * 1.12) * 0.25];
      const ux = H[0] - elbow[0],
        uy = H[1] - elbow[1],
        ul = Math.hypot(ux, uy) || 1;
      const wrist = [H[0] - (ux / ul) * 26, H[1] - (uy / ul) * 26];
      return { elbow, wrist, hand: H, u: [ux / ul, uy / ul] };
    }

    body(ctx, i, p, s, st) {
      const look = this.L[i],
        skin = SKINS[look.skin],
        col = i ? this.cfg.foe : this.cfg.you,
        dir = p.dir,
        L = p.L;
      // Free arm (behind): from the back shoulder to the peg, or a raised fist after a win.
      const peg = [-dir * 150, -50];
      if (p.won && p.over > 0) {
        const lift = p.over,
          fist = [mix(peg[0], p.back[0] - dir * 30, lift), mix(peg[1], p.head[1] - 90, lift)];
        const elb = [mix(peg[0] - dir * 20, p.back[0] - dir * 60, lift), mix(-90, p.head[1] - 10, lift)];
        limb(
          ctx,
          p.back,
          elb,
          [
            [-0.1, 13, 13],
            [0.4, 17, 13],
            [1.08, 10, 10],
          ],
          shade(skin, -0.25),
        );
        limb(
          ctx,
          elb,
          fist,
          [
            [-0.08, 11, 11],
            [0.3, 13, 11],
            [1.05, 9, 9],
          ],
          shade(skin, -0.2),
        );
        ctx.fillStyle = shade(skin, -0.12);
        ctx.beginPath();
        ctx.arc(fist[0], fist[1], 14, 0, TAU);
        ctx.fill();
      } else {
        const elb = [mix(p.back[0], peg[0], 0.35) - dir * 34, mix(p.back[1], peg[1], 0.62) + 10];
        limb(
          ctx,
          p.back,
          elb,
          [
            [-0.1, 13, 13],
            [0.4, 17, 13],
            [1.08, 10, 10],
          ],
          shade(skin, -0.3),
        );
        limb(
          ctx,
          elb,
          peg,
          [
            [-0.08, 11, 11],
            [0.3, 13, 11],
            [1.05, 8, 8],
          ],
          shade(skin, -0.28),
        );
        ctx.fillStyle = shade(skin, -0.2);
        ctx.beginPath();
        ctx.ellipse(peg[0], peg[1] + 4, 11, 13, 0, 0, TAU);
        ctx.fill();
      }
      // Pants, then a V-shaped torso in skin with a dark tank top in the player's color over it.
      ctx.fillStyle = "#0b1027";
      smooth(ctx, [L(-40, 14), L(40, 14), L(46, -70), L(-46, -70)]);
      ctx.fill();
      const torso = [
        L(-34, 0),
        L(-40, 50),
        L(-50, 110),
        L(-50, 160),
        L(-34, 192),
        L(-10, 204),
        L(18, 200),
        L(40, 190),
        L(60, 165),
        L(64, 130),
        L(52, 100),
        L(42, 60),
        L(36, 0),
      ];
      smooth(ctx, torso);
      ctx.fillStyle = skin;
      ctx.fill();
      ctx.save();
      smooth(ctx, torso);
      ctx.clip();
      smooth(ctx, [L(-60, -10), L(-60, 200), L(-30, 200), L(-16, 120), L(-14, -10)]);
      ctx.fillStyle = shade(skin, -0.22);
      ctx.fill();
      smooth(ctx, [L(28, 172), L(56, 168), L(66, 132), L(50, 104), L(24, 120)]);
      ctx.fillStyle = shade(skin, 0.12);
      ctx.fill();
      // tank top: up to the chest, an arm hole, a strap over the shoulder
      const tank = shade(col, -0.5),
        tankLit = shade(col, -0.32);
      ctx.beginPath();
      [
        L(-70, -10),
        L(70, -10),
        L(70, 112),
        L(44, 126),
        L(30, 150),
        L(22, 210),
        L(4, 210),
        L(-12, 172),
        L(-36, 150),
        L(-70, 150),
      ].forEach((q, n) => (n ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.fillStyle = tank;
      ctx.fill();
      smooth(ctx, [L(-4, -10), L(-4, 140), L(26, 150), L(60, 120), L(64, -10)]);
      ctx.fillStyle = tankLit;
      ctx.fill();
      // trim in the player's color: the arm hole edge and a side stripe
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.beginPath();
      [L(70, 112), L(44, 126), L(30, 150), L(22, 210)].forEach((q, n) =>
        n ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]),
      );
      ctx.stroke();
      ctx.beginPath();
      [L(-30, 0), L(-34, 140)].forEach((q, n) => (n ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
      smooth(ctx, torso);
      ctx.strokeStyle = "rgba(6, 8, 18, 0.6)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // belt
      ctx.strokeStyle = "#05081a";
      ctx.lineWidth = 7;
      ctx.beginPath();
      const b0 = L(-38, 10),
        b1 = L(38, 10);
      ctx.moveTo(b0[0], b0[1]);
      ctx.lineTo(b1[0], b1[1]);
      ctx.stroke();
      // Neck and head.
      const nk = p.neck,
        hd = p.head;
      limb(
        ctx,
        nk,
        [hd[0] - dir * 4, hd[1] + 14],
        [
          [-0.1, 16, 16],
          [1, 13, 13],
        ],
        shade(skin, -0.12),
      );
      this.head(ctx, i, hd, p, s, st);
    }

    head(ctx, i, hd, p, s, st) {
      const look = this.L[i],
        skin = SKINS[look.skin],
        dir = p.dir,
        strain = st.side[i];
      const won = p.won && p.over > 0,
        lost = p.over > 0 && !p.won;
      ctx.save();
      ctx.translate(hd[0], hd[1]);
      ctx.rotate(dir * p.nod + (settings.reduceMotion ? 0 : p.trem * 0.004));
      ctx.scale(dir, 1); // draw facing right, mirrored for the foe
      const face = () => {
        ctx.beginPath();
        ctx.moveTo(-6, -30);
        ctx.bezierCurveTo(14, -34, 26, -22, 27, -10); // forehead to brow
        ctx.lineTo(33, 1);
        ctx.lineTo(27, 6); // nose
        ctx.lineTo(27, 14);
        ctx.quadraticCurveTo(25, 26, 14, 29); // mouth, chin
        ctx.quadraticCurveTo(-4, 30, -14, 18); // jaw
        ctx.bezierCurveTo(-30, 12, -32, -20, -6, -30); // back of the skull
        ctx.closePath();
      };
      face();
      ctx.fillStyle = skin;
      ctx.fill();
      ctx.save();
      face();
      ctx.clip();
      ctx.fillStyle = shade(skin, -0.2);
      ctx.fillRect(-40, 4, 80, 40); // lower face shadow
      ctx.fillStyle = shade(skin, 0.12);
      ctx.fillRect(4, -40, 40, 26); // lit forehead
      if (strain > 0.05) {
        ctx.fillStyle = `rgba(255, 40, 40, ${0.28 * strain})`;
        ctx.fillRect(-40, -40, 80, 80);
      }
      ctx.restore();
      face();
      ctx.strokeStyle = "rgba(6, 8, 18, 0.6)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // ear
      ctx.fillStyle = shade(skin, -0.18);
      ctx.beginPath();
      ctx.ellipse(-6, 0, 5, 8, 0.2, 0, TAU);
      ctx.fill();
      // eye: looks at the hands; squeezed when straining, wide when losing at a pin
      const squeeze = clamp(strain * 1.2, 0, 1),
        eh = lost ? 1.5 : won ? 2 : mix(3.2, 0.8, squeeze);
      ctx.fillStyle = "#f4f1ea";
      ctx.beginPath();
      ctx.ellipse(17, -7, 5, eh, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#14100c";
      ctx.beginPath();
      ctx.arc(19.5, -6 + (lost ? 1 : 0.6), Math.min(2, eh), 0, TAU);
      ctx.fill();
      // brow: angry down toward the nose with strain
      ctx.strokeStyle = shade(look.hairColor || "#1a1410", 0.05);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      const bTilt = won ? -2 : lost ? -5 : 2 + 5 * strain;
      ctx.beginPath();
      ctx.moveTo(10, -14 - bTilt * 0.3);
      ctx.lineTo(25, -12 + bTilt * 0.5);
      ctx.stroke();
      // mouth: gritted teeth when straining, a grin on a win, a frown on a loss
      if (won) {
        ctx.fillStyle = "#2a0d0d";
        ctx.beginPath();
        ctx.moveTo(16, 15);
        ctx.quadraticCurveTo(24, 24, 28, 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#f4f1ea";
        ctx.fillRect(19, 15, 8, 2.5);
      } else if (strain > 0.35) {
        ctx.fillStyle = "#f4f1ea";
        ctx.fillRect(18, 13, 10, 5);
        ctx.strokeStyle = "#3a2420";
        ctx.lineWidth = 1;
        ctx.strokeRect(18, 13, 10, 5);
        ctx.beginPath();
        ctx.moveTo(18, 15.5);
        ctx.lineTo(28, 15.5);
        ctx.stroke();
      } else {
        ctx.strokeStyle = "#3a2420";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(18, 16);
        ctx.quadraticCurveTo(23, lost ? 13 : 17, 27, 15);
        ctx.stroke();
      }
      // vein on the temple
      if (strain > 0.5) {
        ctx.strokeStyle = `rgba(120, 20, 30, ${strain * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(4, -22);
        ctx.quadraticCurveTo(8, -16, 5, -10);
        ctx.stroke();
      }
      if (look.beard) {
        ctx.fillStyle = look.beard;
        ctx.beginPath();
        ctx.moveTo(-12, 12);
        ctx.quadraticCurveTo(0, 36, 16, 32);
        ctx.quadraticCurveTo(28, 26, 28, 18);
        ctx.lineTo(18, 20);
        ctx.quadraticCurveTo(10, 22, 2, 14);
        ctx.closePath();
        ctx.fill();
      }
      if (look.glasses) {
        ctx.strokeStyle = "#0a0a0a";
        ctx.lineWidth = 2;
        ctx.strokeRect(12, -12, 12, 9);
        ctx.beginPath();
        ctx.moveTo(12, -8);
        ctx.lineTo(-4, -6);
        ctx.stroke();
      }
      this.hair(ctx, look);
      ctx.restore();
    }
    hair(ctx, look) {
      const c = look.hairColor || "#1a1410";
      ctx.fillStyle = c;
      switch (look.hair) {
        case "buzz":
          ctx.beginPath();
          ctx.moveTo(-28, -2);
          ctx.bezierCurveTo(-30, -26, -6, -34, 14, -31);
          ctx.quadraticCurveTo(24, -28, 26, -20);
          ctx.quadraticCurveTo(4, -26, -14, -10);
          ctx.closePath();
          ctx.globalAlpha = 0.85;
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        case "part":
          ctx.beginPath();
          ctx.moveTo(-30, 2);
          ctx.bezierCurveTo(-34, -30, -4, -42, 18, -34);
          ctx.quadraticCurveTo(30, -28, 28, -16);
          ctx.quadraticCurveTo(10, -30, -2, -24);
          ctx.quadraticCurveTo(-16, -14, -18, 4);
          ctx.closePath();
          ctx.fill();
          break;
        case "mohawk":
          ctx.beginPath();
          ctx.moveTo(-26, -14);
          ctx.lineTo(-30, -40);
          ctx.lineTo(-16, -36);
          ctx.lineTo(-12, -50);
          ctx.lineTo(0, -40);
          ctx.lineTo(6, -52);
          ctx.lineTo(12, -38);
          ctx.lineTo(22, -44);
          ctx.lineTo(20, -28);
          ctx.quadraticCurveTo(0, -36, -26, -14);
          ctx.fill();
          break;
        case "cap":
          ctx.beginPath();
          ctx.moveTo(-30, -2);
          ctx.bezierCurveTo(-34, -34, 0, -42, 22, -30);
          ctx.lineTo(24, -20);
          ctx.quadraticCurveTo(-2, -26, -22, -6);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = shade(c, 0.3);
          ctx.fillRect(-20, -30, 30, 3);
          break;
        case "band":
          ctx.beginPath();
          ctx.moveTo(-30, 0);
          ctx.bezierCurveTo(-34, -30, -6, -42, 16, -36);
          ctx.lineTo(10, -42);
          ctx.lineTo(22, -36);
          ctx.lineTo(26, -24);
          ctx.quadraticCurveTo(4, -32, -16, -8);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = this.cfg.you || "#4dff9a";
          ctx.beginPath();
          ctx.moveTo(-28, -16);
          ctx.quadraticCurveTo(0, -30, 27, -18);
          ctx.lineTo(27, -12);
          ctx.quadraticCurveTo(0, -24, -29, -10);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-28, -14);
          ctx.lineTo(-44, -6 + Math.sin(this.t * 6) * 3);
          ctx.lineTo(-42, 0 + Math.sin(this.t * 6 + 1) * 3);
          ctx.lineTo(-28, -8);
          ctx.closePath();
          ctx.fill();
          break;
        default:
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.beginPath();
          ctx.ellipse(-2, -24, 10, 4, -0.3, 0, TAU);
          ctx.fill(); // bald shine
      }
    }

    upperArm(ctx, i, p, g) {
      const skin = SKINS[this.L[i].skin],
        b = p.b;
      // deltoid cap, then the upper arm with the biceps on the lit side
      limb(
        ctx,
        p.shoulder,
        g.elbow,
        [
          [-0.12, 20 * b, 20 * b],
          [0.12, 26 * b, 22 * b],
          [0.45, 27 * b, 19 * b],
          [0.8, 20 * b, 16 * b],
          [1.08, 14, 14],
        ],
        shade(skin, -0.06),
      );
    }
    forearm(ctx, i, g, st) {
      const skin = SKINS[this.L[i].skin],
        b = this.L[i].build,
        s = st.side[i];
      const tr = settings.reduceMotion ? 0 : s * 1.4;
      const w = [g.wrist[0] + Math.sin(this.t * 47 + i) * tr, g.wrist[1] + Math.cos(this.t * 43 + i) * tr];
      const L = limb(
        ctx,
        g.elbow,
        w,
        [
          [-0.1, 15, 15],
          [0.18, 22 * b, 17 * b],
          [0.55, 18 * b, 14 * b],
          [1.04, 12, 12],
        ],
        skin,
      );
      // elbow point and a vein when straining
      ctx.fillStyle = shade(skin, -0.25);
      ctx.beginPath();
      ctx.arc(g.elbow[0], g.elbow[1] - 2, 9, 0, TAU);
      ctx.fill();
      if (s > 0.4) {
        ctx.strokeStyle = `rgba(90, 30, 40, ${0.55 * s})`;
        ctx.lineWidth = 2;
        const p0 = L.P(0.2, 8),
          p1 = L.P(0.55, 4),
          p2 = L.P(0.85, 7);
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
        ctx.stroke();
      }
    }
    // The locked hands, side view of a thumbs-up grip: palm to palm, your fingers wrapped across the front of the
    // foe's hand, the foe's fingertips curling round the back of yours, thumbs crossed on top.
    fists(ctx, arms, st) {
      const H = this.hand();
      const tr = settings.reduceMotion ? 0 : st.all * 1.8;
      const jx = Math.sin(this.t * 53) * tr,
        jy = Math.cos(this.t * 61) * tr;
      const you = SKINS[this.L[0].skin],
        foe = SKINS[this.L[1].skin],
        OUT = "rgba(6, 8, 18, 0.6)";
      const rr = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };
      const fillOut = (c) => {
        ctx.fillStyle = c;
        ctx.fill();
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      };
      ctx.save();
      ctx.translate(H[0] + jx, H[1] + jy);
      ctx.rotate(this.handTilt());
      ctx.lineJoin = "round";
      // the foe's hand (behind) and its thumb
      rr(-2, -27, 27, 50, 11);
      fillOut(shade(foe, -0.06));
      rr(3, -22, 10, 40, 5);
      ctx.fillStyle = shade(foe, 0.1);
      ctx.fill();
      ctx.lineCap = "round";
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(16, -24);
      ctx.lineTo(-4, -35);
      ctx.stroke();
      ctx.strokeStyle = shade(foe, 0.02);
      ctx.lineWidth = 8.5;
      ctx.beginPath();
      ctx.moveTo(16, -24);
      ctx.lineTo(-4, -35);
      ctx.stroke();
      // your hand
      rr(-25, -25, 27, 50, 11);
      fillOut(you);
      rr(-22, -20, 9, 38, 4);
      ctx.fillStyle = shade(you, 0.12);
      ctx.fill();
      // the foe's fingertips curling round the back of your hand
      for (let q = 0; q < 4; q++) {
        ctx.beginPath();
        ctx.ellipse(-26, -15 + q * 9.5, 5.5, 4.4, 0, 0, TAU);
        fillOut(shade(foe, -0.12));
      }
      // your fingers across the front of the foe's hand (the little finger shortest)
      for (let q = 0; q < 4; q++) {
        const y = -18 + q * 9.5,
          x1 = 27 - q * 2.5;
        rr(-12, y, x1 + 12, 9, 4.5);
        fillOut(shade(you, q % 2 ? -0.05 : 0.03));
        ctx.fillStyle = shade(you, 0.25);
        ctx.beginPath();
        ctx.ellipse(x1 - 3.5, y + 4.5, 2.4, 2.8, 0, 0, TAU);
        ctx.fill(); // nail
        ctx.strokeStyle = shade(you, -0.3);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1 - 12, y + 2);
        ctx.lineTo(x1 - 12, y + 7);
        ctx.stroke(); // joint crease
      }
      // your thumb over the foe's
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(-16, -22);
      ctx.lineTo(8, -37);
      ctx.stroke();
      ctx.strokeStyle = shade(you, 0.06);
      ctx.lineWidth = 9.5;
      ctx.beginPath();
      ctx.moveTo(-16, -22);
      ctx.lineTo(8, -37);
      ctx.stroke();
      ctx.fillStyle = shade(you, 0.25);
      ctx.beginPath();
      ctx.ellipse(6, -36, 2.6, 2.2, -0.55, 0, TAU);
      ctx.fill();
      // white knuckles when straining
      if (st.all > 0.4) {
        ctx.fillStyle = `rgba(255, 240, 225, ${0.35 * st.all})`;
        for (let q = 0; q < 4; q++) {
          ctx.beginPath();
          ctx.arc(-8, -14 + q * 9.5, 2.6, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    effects(ctx, UI) {
      for (const p of this.fx) {
        const u = p.age / p.life;
        ctx.globalAlpha = 1 - u;
        if (p.kind === "dust") {
          ctx.fillStyle = "#c9d0ee";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 + u), 0, TAU);
          ctx.fill();
        } else if (p.kind === "spark") {
          ctx.strokeStyle = UI.gold;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          ctx.stroke();
        } else if (p.kind === "sweat") {
          ctx.fillStyle = "#bfe9ff";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.r * 0.8, p.r * 1.3, 0, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // a ring at the slam
      if (this.flash > 0 && this.crack) {
        ctx.strokeStyle = `rgba(255, 246, 214, ${this.flash})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(this.crack.x, -6, 30 + (1 - this.flash) * 90, 8 + (1 - this.flash) * 16, 0, 0, TAU);
        ctx.stroke();
      }
    }
  }

  return { Scene, LOOKS, SKINS };
});
