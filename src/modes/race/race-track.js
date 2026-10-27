/**
 * Race track: the race drawn on the arena canvas. A lane per racer on a parallax skyline, each vehicle exactly as
 * far along as its racer has typed (race-rules.js), with wheel spin and speed lines from live WPM, a wobble and
 * smoke on a typo, nitro on a clean streak and sparks at the line. Visual only: it reads the race, never changes it.
 *
 * The static parts are drawn once per size into offscreen canvases (like the duel's scenery layers): the lane
 * board (fills, start line, names, finish gate) and two seamless skyline strips that only slide. A frame copies
 * them and draws only what moves.
 */
CounterType.define(
  "race-track",
  ["race-config", "race-rules", "race-vehicles", "settings", "arena", "layout", "format", "dom"],
  (CONFIG, Race, Vehicles, settings, arena, layout, format, dom) => {
    "use strict";

    const PAD_TOP = 112; // design px above the lanes (the HUD strip)
    const NAME_W = 196; // design px for the names on the left
    const BOX_GAP = 16; // the passage box sits this far from the bottom
    const MAX_LANE = 88;
    const ord = (n) => format.ordinal(n, true);

    const vis = { looks: [], fx: [], scroll: 0 };
    const cache = { key: "", board: null, strips: [], sky: null, skyH: 0 };

    /** A new race: fresh looks for every racer, no particles, the skyline back at the start. */
    function reset(state) {
      vis.looks = state.racers.map(() => ({ shown: 0, wheel: 0, lean: 0, body: 0, vel: 0, lastWpm: 0, wobble: 0 }));
      vis.fx = [];
      vis.scroll = 0;
    }

    /** The race left the screen: forget the cached pictures (the duel's scenery is rebuilt too). */
    function clear() {
      cache.key = "";
      cache.sky = null;
      arena.renderer.layers = null;
    }

    function laneLayout(state, W, H) {
      const box = dom.byId("race-box");
      const boxHeight = box && box.offsetHeight ? box.offsetHeight : 200;
      const boxTop = H - BOX_GAP - boxHeight; // the passage box (live line and 3 lines of text)
      const room = Math.max(140, boxTop - 24 - PAD_TOP);
      const n = state.racers.length;
      const laneH = Math.min(MAX_LANE, room / n);
      const top = PAD_TOP + Math.max(0, (room - laneH * n) / 2);
      return { top, laneH, bottom: top + laneH * n, x0: NAME_W + 16, x1: W - 96 };
    }

    function offscreen(w, h, k) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(w * k);
      canvas.height = Math.ceil(h * k);
      const g = canvas.getContext("2d");
      g.setTransform(k, 0, 0, k, 0, 0);
      return [canvas, g];
    }

    function buildBoard(state, W, k, L) {
      const UI = CONFIG.theme.ui;
      const A = CONFIG.theme.arena;
      const top = L.top - 6;
      const h = L.bottom - L.top + 12;
      const [canvas, g] = offscreen(W, h, k);
      g.translate(0, -top);
      g.fillStyle = A.floor;
      g.fillRect(0, top, W, h);
      state.racers.forEach((r, i) => {
        const y0 = L.top + i * L.laneH;
        const me = i === 0;
        if (me || i % 2) {
          g.fillStyle = me ? "rgba(77, 255, 154, 0.06)" : "rgba(255, 255, 255, 0.015)";
          g.fillRect(0, y0, W, L.laneH);
        }
        if (me) {
          g.fillStyle = UI.phosphor;
          g.fillRect(0, y0, 4, L.laneH);
        }
        g.fillStyle = "rgba(232, 237, 255, 0.25)";
        g.fillRect(L.x0, y0 + 4, 2, L.laneH - 8);
        const nameY = y0 + L.laneH / 2;
        g.textBaseline = "middle";
        g.textAlign = "left";
        g.font = `700 ${Math.min(16, L.laneH * 0.24)}px ${CONFIG.theme.font}`;
        g.fillStyle = me ? UI.phosphor : r.color;
        g.fillText(r.name, 16, nameY - (r.tag ? 7 : 0));
        if (r.tag) {
          g.font = `400 12px ${CONFIG.theme.font}`;
          g.fillStyle = UI.dim;
          g.fillText("#" + r.tag, 16, nameY + 10);
        }
      });
      // The finish gate: a two-square checker column.
      const sq = 8;
      for (let y = L.top, row = 0; y < L.bottom; y += sq, row++) {
        for (let c = 0; c < 2; c++) {
          g.fillStyle = (row + c) % 2 ? "#e8edff" : "#060a18";
          g.fillRect(L.x1 + c * sq, y, sq, Math.min(sq, L.bottom - y));
        }
      }
      g.strokeStyle = UI.line;
      g.lineWidth = 1;
      g.strokeRect(0.5, top + 0.5, W - 1, h - 1);
      return { canvas, top, h };
    }

    // Skyline strips: a whole number of buildings wider than the screen, so a strip tiles without a seam.
    function buildStrips(W, k, L) {
      const A = CONFIG.theme.arena;
      return [
        [0.55, L.top, 0.12],
        [1, L.top + 18, 0.3],
      ].map(([depth, base, speed]) => {
        const step = 64 * depth;
        const n = Math.ceil(W / step) + 1;
        const sw = n * step;
        const [canvas, g] = offscreen(sw, base, k);
        const body = depth < 1 ? A.far : A.mid;
        for (let i = 0; i < n; i++) {
          const x = i * step;
          const rnd = Math.abs(Math.sin(i * 12.9898 + depth * 78.233)) % 1;
          const bh = 50 * depth + rnd * 46 * depth;
          g.fillStyle = body;
          g.fillRect(x, base - bh, step - 6 * depth, bh);
          if (rnd > 0.35) {
            g.fillStyle = A.farWindow;
            for (let wy = base - bh + 8; wy < base - 8; wy += 12) g.fillRect(x + 8 * depth, wy, 4 * depth, 4 * depth);
          }
        }
        return { canvas, w: sw, h: base, speed };
      });
    }

    function buildCache(state, W, H, k, L) {
      const UI = CONFIG.theme.ui;
      const A = CONFIG.theme.arena;
      const names = state.racers.map((r) => r.name + r.tag).join();
      const key = [W, H, k, state.racers.length, names, A.floor, A.far, A.mid, UI.phosphor, UI.text].join("|");
      if (cache.key === key) return;
      cache.key = key;
      cache.board = buildBoard(state, W, k, L);
      cache.strips = buildStrips(W, k, L);
    }

    /** Draws the race. */
    function draw(state, dt) {
      const renderer = arena.renderer;
      const canvas = renderer.canvas;
      const ctx = renderer.ctx;
      const { width: W, height: H } = arena.designSize(layout.scale());
      const k = canvas.width / W;
      const still = settings.values.reduceMotion;
      const L = laneLayout(state, W, H);
      const A = CONFIG.theme.arena;
      buildCache(state, W, H, k, L);
      ctx.setTransform(k, 0, 0, k, 0, 0);

      // Sky and skyline: the scroll follows your own speed, so the scene moves faster when you do.
      const myWpm = Race.wpm(state, state.racers[0]);
      if (!still) vis.scroll += dt * (state.phase === "race" ? 40 + myWpm * 3.2 : 12);
      if (!cache.sky || cache.skyH !== L.bottom) {
        cache.sky = ctx.createLinearGradient(0, 0, 0, L.bottom);
        cache.skyH = L.bottom;
        cache.sky.addColorStop(0, A.skyTop);
        cache.sky.addColorStop(1, A.skyBottom);
      }
      ctx.fillStyle = cache.sky;
      ctx.fillRect(0, 0, W, H);
      const snap = (v) => Math.round(v * k) / k; // whole device pixels: copies stay sharp
      for (const strip of cache.strips) {
        const off = snap(-((vis.scroll * strip.speed) % strip.w));
        ctx.drawImage(strip.canvas, off, 0, strip.w, strip.h);
        ctx.drawImage(strip.canvas, off + strip.w, 0, strip.w, strip.h);
      }
      ctx.drawImage(cache.board.canvas, 0, cache.board.top, W, cache.board.h);

      // Dashed dividers slide with the scroll so the road moves.
      ctx.strokeStyle = "rgba(255, 197, 61, 0.35)";
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = still ? 0 : vis.scroll % 24;
      ctx.beginPath();
      for (let i = 1; i < state.racers.length; i++) {
        const y = L.top + i * L.laneH;
        ctx.moveTo(L.x0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      state.racers.forEach((r, i) => drawLane(ctx, state, r, i, L, dt, k));
      drawParticles(ctx, dt);
    }

    function drawParticles(ctx, dt) {
      vis.fx = vis.fx.filter((p) => (p.age += dt) < p.life);
      for (const p of vis.fx) {
        const u = p.age / p.life;
        ctx.globalAlpha = (1 - u) * p.a;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x + p.vx * p.age, p.y + p.vy * p.age, p.r * (1 + u * 1.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawPlace(ctx, state, r, y0, L) {
      if (!r.place || (r.finishT === null && state.phase !== "over")) return;
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      ctx.font = `700 14px ${CONFIG.theme.font}`;
      ctx.fillStyle = r.place === 1 ? CONFIG.theme.ui.gold : CONFIG.theme.ui.dim;
      ctx.fillText(ord(r.place), NAME_W, y0 + L.laneH / 2);
      ctx.textAlign = "left";
    }

    function drawSpeedLines(ctx, x, len, groundY, scale, wpm) {
      ctx.strokeStyle = `rgba(232, 237, 255, ${Math.min(0.35, (wpm - 30) / 240)})`;
      ctx.lineWidth = 1.5;
      for (let n = 0; n < 3; n++) {
        const ly = groundY - 10 - n * 9 * scale;
        const ll = 16 + wpm * 0.35 + n * 6;
        const lx = x - len / 2 - 6 - ((vis.scroll * (1 + n * 0.3)) % 18);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx - ll, ly);
        ctx.stroke();
      }
    }

    function drawLane(ctx, state, r, i, L, dt, k) {
      const y0 = L.top + i * L.laneH;
      const still = settings.values.reduceMotion;
      drawPlace(ctx, state, r, y0, L);

      // The vehicle: x is exactly progress (eased a little for smooth motion).
      const def = Vehicles.byId(r.vehicle);
      const look = vis.looks[i];
      const scale = Math.min(0.9, L.laneH / 82);
      const len = Vehicles.lengthOf(def) * scale;
      look.shown += (Race.progress(state, r) - look.shown) * Math.min(1, dt * 14);
      const x = L.x0 + len / 2 + 6 + look.shown * (L.x1 - L.x0 - len - 6);
      const groundY = y0 + L.laneH - 8;
      const wpm = Race.wpm(state, r);
      const moving = state.phase === "race" && r.finishT === null;
      look.wheel += dt * (moving ? 2 + wpm * 0.28 : r.finishT !== null ? 1.2 : 0);
      const accel = (wpm - look.lastWpm) / Math.max(dt, 1e-3);
      look.lastWpm = wpm;
      look.vel += ((still ? 0 : Math.max(-6, Math.min(6, accel * 0.04))) - look.vel) * Math.min(1, dt * 6);
      const boost = state.t - r.lastBoostAt < 1.3 && moving;
      const wobble = !still && state.t - r.lastWrongAt < 0.16 ? Math.sin((state.t - r.lastWrongAt) * 70) * 3 : 0;
      const wheelie =
        def.kind === "bike" && boost && !still
          ? 12 * Math.sin(Math.min(1, (state.t - r.lastBoostAt) / 1.3) * Math.PI)
          : 0;
      const bob = still || !moving ? 0 : Math.sin(state.t * (8 + wpm * 0.08) + i) * Math.min(1.2, wpm / 80);

      if (moving && wpm > 30 && !still) drawSpeedLines(ctx, x, len, groundY, scale, wpm);
      // Exhaust puffs at a rate that follows speed; smoke on a typo.
      if (moving && !still && Math.random() < dt * (2 + wpm / 12)) {
        vis.fx.push({
          x: x - len / 2,
          y: groundY - 10 * scale,
          vx: -30 - wpm * 0.6,
          vy: -6,
          r: 2.5,
          life: 0.5,
          age: 0,
          a: 0.35,
          c: "#8d9ac8",
        });
      }
      if (!still && state.t - r.lastWrongAt < dt * 1.5 && moving) {
        for (let n = 0; n < 4; n++) {
          vis.fx.push({
            x: x - len * 0.3,
            y: groundY - 3,
            vx: -20 - Math.random() * 30,
            vy: -12 - Math.random() * 16,
            r: 3 + Math.random() * 3,
            life: 0.6,
            age: 0,
            a: 0.5,
            c: "#c9d0ee",
          });
        }
      }
      const flame = boost ? 1 : moving && wpm > 70 && !still ? 0.25 : 0;
      Vehicles.drawFast(
        ctx,
        def,
        x,
        groundY,
        scale,
        { color: r.color, wheel: look.wheel, lean: wheelie + wobble + look.vel * 0.25, body: bob, flame },
        k,
      );
      // Time penalty from skipped words, next to the vehicle (it decides places at the line).
      if (r.penalty > 0) {
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.font = `700 12px ${CONFIG.theme.font}`;
        ctx.fillStyle = CONFIG.theme.ui.danger;
        ctx.fillText(`+${r.penalty.toFixed(1)}s`, x + len / 2 + 8, groundY - 14 * scale);
      }
      // Finish sparks, once.
      if (r.finishT !== null && !look.sparked) {
        look.sparked = true;
        if (!still) {
          for (let n = 0; n < 18; n++) {
            vis.fx.push({
              x: L.x1,
              y: groundY - 20,
              vx: -40 + Math.random() * 80,
              vy: -60 - Math.random() * 80,
              r: 2,
              life: 0.8,
              age: 0,
              a: 0.9,
              c: n % 2 ? CONFIG.theme.ui.gold : r.color,
            });
          }
        }
      }
    }

    return Object.freeze({ reset, clear, draw });
  },
);
