/**
 * The arena renderer: canvas drawing only. Reads a world (the duel, the Brawl view or the menu backdrop) and never
 * changes it.
 */
CounterType.define("renderer", ["config", "fighter-stage"], (CONFIG, DuelChars) => {
  "use strict";

  const MONO = CONFIG.theme.font;

  // The plate caret is the usual Monkeytype yellow, unless the typist's letters are close to that
  // hue (yellow, amber, orange): then it is white, so the caret never blends into the letters.
  function caretColor(letters) {
    const C = CONFIG.wordPlate.colors;
    const hs = (hex) => {
      const n = parseInt(hex.slice(1), 16),
        r = (n >> 16) / 255,
        g = ((n >> 8) & 255) / 255,
        b = (n & 255) / 255;
      const max = Math.max(r, g, b),
        d = max - Math.min(r, g, b);
      let h = 0;
      if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return { h: (h * 60 + 360) % 360, s: max ? d / max : 0 };
    };
    const a = hs(letters),
      b = hs(C.caret),
      gap = Math.abs(a.h - b.h);
    return a.s >= 0.25 && Math.min(gap, 360 - gap) < CONFIG.wordPlate.caretHueGap ? C.caretAlt : C.caret;
  }

  // Where the camera starts before it eases to the first world it draws.
  const INITIAL_CAMERA_X = 620;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.camX = INITIAL_CAMERA_X;
      this.clock = 0;
      this.res = 1; // canvas pixels per drawing unit; raise it to keep a scaled up canvas sharp
      this.wordPlates = false; // view setting: draw each typist's word over their own fighter
      this.plates = [null, null]; // eased plate positions, purely visual
      this.layers = null; // pre-rendered scenery layers, rebuilt on resize (see buildLayers)
      this.par = 0; // eased parallax offset (follows the fighters' midpoint)
      // [your fighter, the opponent's]: on the menus, a world in the "menu" phase is a sparring loop.
      this.menuSpar = null;
      // The 2D fighters (fighter-stage.js): { keys: [yours, the opponent's], glows: [#rrggbb, #rrggbb] }. The duel and
      // the menu sparring draw these designed fighters; the duel's own sparks are then left to the fighters' effects.
      this.chars = null;
      // Full screen camera:
      this.follow = true; // follow the fighters' midpoint and zoom out when they fly apart; false pins it to cameraX
      this.zoom = 1; // eased; 1 = the normal framing
      this.clearHalf = 1; // fraction of the half width that the HUD panels leave clear at floor level
      this.floorFromBottom = 0; // with follow: units of floor under the fighters at zoom 1
      // Player settings (visual only):
      this.shakeScale = 1; // screen shake strength, 0 = off
      this.noFlash = false; // reduce motion: no full screen flash
      this.reduceMotion = false; // reduce motion: no plate shake on a typo
      this.damageNumbers = true; // draw the net HP numbers
      // Graphics settings (visual only, from the Graphics tab):
      // "full" | "simple" (sky and floor only) | "off" (a flat color, or your background image)
      this.sceneryLevel = "full";
      this.scanlines = true; // the baked scanlines in the scenery
      this.sweep = true; // the slow band of light that slides down the scenery
      this.bgImage = null; // custom background image (Themes), drawn in place of the far and mid layers
      this.bgOpts = null; // { mode, blur, brightness, opacity, saturate }
      this.bgVersion = 0; // bumped when the image or its filters change, so the layers rebuild
      this.kickAmt = 0; // an extra shake for the "Test shake" button; decays on its own
    }

    // A test shake for the settings screen (scaled by the shake setting like any other shake).
    kick(amount) {
      this.kickAmt = Math.max(this.kickAmt, amount);
    }

    // Custom background: an image (or null) and its filters. The scenery layers rebuild on the next frame.
    setBackground(img, opts, version) {
      this.bgImage = img || null;
      this.bgOpts = opts ? Object.assign({}, opts) : null;
      this.bgVersion = version || 0;
    }

    draw(sim, dt) {
      // `sim` is any world with fighters, fx, shake and flash. Optional: floorY, arenaWidth, cameraX.
      const ctx = this.ctx,
        k0 = this.res,
        W0 = this.canvas.width / k0,
        H0 = this.canvas.height / k0;
      const arenaWidth = sim.arenaWidth !== undefined ? sim.arenaWidth : CONFIG.arena.width;
      this.clock += dt;

      // Duel camera (follow): ease toward the fighters' midpoint and zoom out when they fly apart, so
      // both stay clear of the HUD panels. Purely visual; the duel's own cameraX stays fixed.
      let zoom = 1;
      if (this.follow && sim.fighters && sim.fighters.length === 2) {
        const V = CONFIG.view,
          [a, b] = sim.fighters;
        const live = !(this.menuSpar && sim.phase === "menu");
        const mid = live ? (a.x + b.x) / 2 : sim.cameraX;
        const need = live ? Math.abs(a.x - b.x) / 2 + V.bodyReach : 0;
        const room = Math.max(60, (this.clearHalf * W0) / 2);
        const zt = Math.min(V.maxZoom, Math.max(1, need / room));
        const e = Math.min(1, dt * V.cameraSpeed);
        this.zoom += (zt - this.zoom) * e;
        zoom = this.zoom;
        this.camX += (mid - this.camX) * e;
      }
      const k = k0 / zoom,
        W = W0 * zoom,
        H = H0 * zoom;
      const floorY = this.follow
        ? H - this.floorFromBottom * zoom // the floor stays on the same screen row at any zoom
        : sim.floorY !== undefined
          ? sim.floorY
          : CONFIG.arena.floorY;

      // Without follow, the world pins the camera.
      if (!this.follow && sim.cameraX !== undefined) this.camX = sim.cameraX;
      // Keep the view inside the arena; a view wider than the arena stays centred on it.
      this.camX = W >= arenaWidth ? arenaWidth / 2 : Math.min(Math.max(this.camX, W / 2), arenaWidth - W / 2);
      const sx = (wx) => wx - this.camX + W / 2;

      ctx.save();
      ctx.setTransform(k0, 0, 0, k0, 0, 0);
      ctx.clearRect(0, 0, W0, H0);
      if (this.kickAmt > 0.2) this.kickAmt *= Math.pow(0.002, dt);
      else this.kickAmt = 0;
      const shake = (sim.shake + this.kickAmt) * this.shakeScale;
      const jx = shake > 0 ? (Math.random() - 0.5) * shake : 0,
        jy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      // The scenery is drawn at the normal framing (it never zooms, so its layers are built once per size).
      ctx.translate(jx, jy);
      const baseFloor = this.follow ? H0 - this.floorFromBottom : floorY;
      this.drawScenery(ctx, W0, H0, baseFloor, sim, dt);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.translate(jx, jy);

      // The fighters. On the menus: a slow sparring loop.
      const C = this.chars;
      const copt = {
        res: k,
        noShake: this.shakeScale === 0 || this.reduceMotion,
        shakeScale: this.shakeScale,
        shadow: CONFIG.theme.arena.shadow,
      };
      // The 2D puppets' impact frames drive the hit show (Duel.hitLanded)
      if (sim.streams) sim.puppetHits = !!C && sim.phase !== "menu";
      if (this.menuSpar && sim.phase === "menu") {
        const cx = sx(sim.cameraX !== undefined ? sim.cameraX : W / 2);
        if (C) DuelChars.drawSpar(ctx, C.keys, cx, floorY, this.reduceMotion ? 0 : dt, C.glows, copt);
      } else if (sim.puppets) {
        sim.puppets(ctx, sx, floorY, dt, copt); // Backspace Brawl draws its own fighters (brawl-mode.js)
      } else if (C && sim.streams) {
        DuelChars.drawDuel(ctx, sim, sx(0), floorY, dt, C.keys, C.glows, copt);
      }
      this.drawFx(ctx, sim, sx, floorY, W);

      if (sim.flash > 0 && !this.noFlash) {
        ctx.setTransform(k0, 0, 0, k0, 0, 0);
        ctx.fillStyle = `rgba(${CONFIG.theme.arena.flash}, ${0.35 * sim.flash})`;
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

      const k = Math.min(1, dt * P.follow),
        kc = Math.min(1, dt * P.caretSpeed);
      for (let i = 0; i < 2; i++) {
        const l = L[i],
          s = duel.streams[i];
        let st = this.plates[i];
        if (!st) st = this.plates[i] = { x: l.tx, y: l.ty, caret: l.caretTarget, index: s.index };
        if (st.index !== s.index) {
          st.index = s.index;
          st.caret = l.caretTarget;
        } // new word: caret starts fresh
        st.x += (l.tx - st.x) * k;
        st.y += (l.ty - st.y) * k;
        st.caret += (l.caretTarget - st.caret) * kc;
        st.w = l.width;
        st.h = l.h; // for tests and debugging
        this.drawPlate(ctx, duel, i, l, st);
      }
    }

    plateLayout(ctx, duel, i, anchorX, W) {
      const P = CONFIG.wordPlate;
      const s = duel.streams[i],
        w = s.current(),
        next = s.words[s.index + 1];
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
      return {
        w,
        s,
        next,
        font,
        cw,
        n,
        wordW,
        tagW,
        width,
        h,
        tx,
        anchorX,
        caretTarget: Math.min(s.typed.length, n) * cw,
      };
    }

    drawPlate(ctx, duel, i, l, st) {
      const P = CONFIG.wordPlate,
        C = P.colors;
      const me = duel.typists[i],
        s = l.s,
        w = l.w,
        now = duel.t;
      const ult = w.ultimate;
      const mine = duel.fighters[i].letterColor || (i === 0 ? C.you : C.bot);

      const wrongAge = now - me.lastWrongAt;
      const flashing = wrongAge >= 0 && wrongAge < P.wrongTime;
      const breakAge = now - me.lastComboBreakAt;
      const breaking = breakAge >= 0 && breakAge < P.breakTime;
      // A word skipped under the typo rule: the border flashes red (no crack unless a whole combo level went too)
      // and the skipped word floats up struck out.
      const skipAge = now - me.lastSkipAt;
      const skipping = skipAge >= 0 && skipAge < P.breakTime;
      const hot = breaking || skipping;
      const shakeX =
        flashing && !this.reduceMotion
          ? Math.sin(wrongAge * 95) * P.shake * Math.min(1.5, this.shakeScale) * (1 - wrongAge / P.wrongTime)
          : 0;

      const x = Math.round(st.x + shakeX),
        y = Math.round(st.y);
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
      ctx.moveTo(px - 6, y + l.h);
      ctx.lineTo(px + 6, y + l.h);
      ctx.lineTo(px, y + l.h + 6);
      ctx.closePath();
      ctx.fill();

      // Border: red flash on a combo break, gold for the ultimate.
      const bt = hot ? 1 - Math.min(breaking ? breakAge : 1e9, skipping ? skipAge : 1e9) / P.breakTime : 0;
      ctx.lineWidth = hot ? 2 + bt : 1.5;
      ctx.strokeStyle = hot ? C.wrong : ult ? C.ultBorder : C.border;
      if (hot) ctx.globalAlpha = 0.35 + 0.65 * bt;
      roundRect(ctx, x, y, l.width, l.h, P.radius);
      ctx.stroke();
      if (breaking) {
        // A short crack from the top edge.
        const cx = x + l.width * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(cx + 5, y + l.h * 0.3);
        ctx.lineTo(cx - 3, y + l.h * 0.55);
        ctx.lineTo(cx + 4, y + l.h * 0.8);
        ctx.moveTo(cx + 5, y + l.h * 0.3);
        ctx.lineTo(cx + 13, y + l.h * 0.42);
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
      const typed = s.typed,
        text = w.text;
      for (let j = 0; j < l.n; j++) {
        const extra = j >= text.length;
        const ch = extra ? typed[j] : text[j];
        let color = ult ? C.ultUntyped : C.untyped,
          scale = 1;
        if (j < typed.length) {
          if (extra) color = C.extra;
          else if (typed[j] === text[j]) {
            color = mine;
            const age = now - me.lastCorrectAt;
            if (j === me.lastCorrectIndex && age >= 0 && age < P.popTime) {
              scale = 1 + (P.popScale - 1) * (1 - age / P.popTime);
            }
          } else color = C.wrong;
        }
        if (flashing && j === me.lastWrongIndex && me.lastWrongWord === s.index) {
          color = C.wrong;
          scale = 1.18;
        }
        ctx.font = `bold ${l.font}px ${MONO}`;
        const cx = wx + j * l.cw + l.cw / 2;
        // A second cue for typos that does not rely on color: a red bar under every wrong or extra letter.
        if (j < typed.length && (extra || typed[j] !== text[j])) {
          ctx.fillStyle = extra ? C.extraMark : C.wrongMark;
          ctx.fillRect(
            Math.round(cx - l.cw / 2 + 2),
            Math.round(midY + l.font * 0.46),
            Math.round(l.cw - 4),
            P.typoBar,
          );
        }
        ctx.fillStyle = color;
        if (scale !== 1) {
          ctx.save();
          ctx.translate(cx, midY);
          ctx.scale(scale, scale);
          ctx.fillText(ch, 0, 0);
          ctx.restore();
        } else ctx.fillText(ch, cx, midY);
      }

      // Caret slides through the word.
      ctx.fillStyle = caretColor(mine);
      ctx.fillRect(Math.round(wx + st.caret - 1), Math.round(midY - l.font * 0.5), 3, l.font);

      // The word that was just skipped, struck out, drifting up and fading.
      if (me.lastSkipText && skipAge >= 0 && skipAge < P.skipTime && !this.reduceMotion) {
        const k = skipAge / P.skipTime;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.font = `bold ${P.nextFont + 2}px ${MONO}`;
        ctx.textAlign = "left";
        ctx.fillStyle = C.wrong;
        const sy = y - 8 - k * 16,
          struck = ctx.measureText(me.lastSkipText).width;
        ctx.fillText(me.lastSkipText, x + P.padX, sy);
        ctx.fillRect(Math.round(x + P.padX), Math.round(sy), Math.round(struck), 2);
        ctx.restore();
      }

      // Next word, smaller and dimmer.
      if (l.next) {
        ctx.textAlign = "left";
        ctx.font = `${P.nextFont}px ${MONO}`;
        ctx.fillStyle = l.next.ultimate ? C.ultNext : C.next;
        ctx.fillText(l.next.text, wx + l.wordW + 18, midY + 2);
      }
      ctx.restore();
    }

    // ---------- Terminal Arcade scenery (duel only) ----------
    // Three layers, each pre-rendered once per size into an offscreen canvas a little wider than
    // the arena, then slid sideways at its own speed:
    //   far  (0.15): sky, horizon screen glow and a skyline of arcade towers with lit windows
    //   mid  (0.4):  a row of computer-lab desks with CRT monitors and arcade cabinets
    //   near (1.0):  the floor with a perspective grid and cable runs
    // Per frame: three drawImage calls, a few blinking LEDs and one slow scanline sweep.
    buildLayers(W, H, floorY) {
      const A = CONFIG.theme.arena,
        M = Renderer.PAR_MARGIN,
        LW = W + 2 * M;
      const level = this.sceneryLevel,
        full = level === "full" && !this.bgImage;
      // Layer pixels per unit: the screen's, capped so one layer stays under LAYER_MAX_PIXELS. Very large
      // offscreen canvases can drop off the fast drawing path (measured: 4.2 M pixels cost 13 ms a frame,
      // 3 M pixels cost 0.5 ms). On big screens the far layers are then a touch softer, which they can afford.
      const k = Math.min(this.res, Math.sqrt(Renderer.LAYER_MAX_PIXELS / (LW * floorY)));
      const make = (h) => {
        const c = document.createElement("canvas");
        c.width = Math.ceil(LW * k);
        c.height = Math.ceil(h * k);
        const g = c.getContext("2d");
        g.setTransform(k, 0, 0, k, 0, 0);
        return [c, g];
      };
      let seed = 7; // fixed layout: a tiny seeded generator, so the scene is the same every time
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const scan = (g, h) => {
        if (!this.scanlines) return;
        g.fillStyle = A.scan;
        for (let y = 0; y < h; y += 3) g.fillRect(0, y, LW, 1);
      };

      // Far: sky, glow, skyline.
      const [far, fg] = make(floorY);
      if (level === "off") {
        fg.fillStyle = A.skyTop;
        fg.fillRect(0, 0, LW, floorY); // a flat color
      } else {
        const sky = fg.createLinearGradient(0, 0, 0, floorY);
        sky.addColorStop(0, A.skyTop);
        sky.addColorStop(1, A.skyBottom);
        fg.fillStyle = sky;
        fg.fillRect(0, 0, LW, floorY);
      }
      if (this.bgImage) this.paintBackground(fg, LW, floorY, k);
      if (full) {
        const glow = fg.createLinearGradient(0, floorY - 150, 0, floorY);
        glow.addColorStop(0, "rgba(0, 0, 0, 0)");
        glow.addColorStop(1, A.glow);
        fg.fillStyle = glow;
        fg.fillRect(0, floorY - 150, LW, 150);
      }
      for (let x = -10; full && x < LW;) {
        const w = 40 + rnd() * 70,
          h = 60 + rnd() * Math.min(150, floorY * 0.4),
          top = floorY - 50 - h;
        fg.fillStyle = A.far;
        fg.fillRect(x, top, w, h + 50);
        fg.fillStyle = A.farEdge;
        fg.fillRect(x, top, w, 2);
        fg.fillStyle = A.farWindow;
        for (let wy = top + 10; wy < floorY - 60; wy += 12) {
          for (let wx = x + 6; wx < x + w - 8; wx += 10) if (rnd() < 0.35) fg.fillRect(wx, wy, 4, 3);
        }
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
          const cw = 64,
            ch = 150,
            top = floorY - ch;
          mg.fillStyle = A.mid;
          mg.fillRect(x, top, cw, ch);
          mg.fillStyle = A.midEdge;
          mg.fillRect(x, top, cw, 2);
          mg.fillRect(x, top + 22, cw, 2);
          mg.fillStyle = A.screen;
          mg.fillRect(x + 8, top + 32, cw - 16, 40);
          mg.fillStyle = A.screenText;
          for (let ly = top + 38; ly < top + 66; ly += 6) mg.fillRect(x + 12, ly, 8 + rnd() * (cw - 32), 2);
          mg.fillStyle = A.midEdge;
          mg.fillRect(x - 4, top + 84, cw + 8, 6);
          leds.push({ x: x + 14, y: top + 12, c: i % A.leds.length, p: rnd() * 6 });
          leds.push({ x: x + cw - 14, y: top + 12, c: (i + 1) % A.leds.length, p: rnd() * 6 });
          x += cw + 34;
        } else {
          // Desk with a CRT monitor and a keyboard.
          const dw = 120,
            deskY = floorY - 58;
          mg.fillStyle = A.mid;
          mg.fillRect(x, deskY, dw, 6);
          mg.fillRect(x + 6, deskY, 6, 58);
          mg.fillRect(x + dw - 12, deskY, 6, 58);
          const mx = x + 26,
            my = deskY - 50;
          mg.fillStyle = A.mid;
          mg.fillRect(mx, my, 64, 48);
          mg.fillRect(mx + 26, deskY - 4, 12, 4);
          mg.fillStyle = A.midEdge;
          mg.fillRect(mx, my, 64, 2);
          mg.fillStyle = A.screen;
          mg.fillRect(mx + 6, my + 6, 52, 34);
          mg.fillStyle = A.screenText;
          for (let ly = my + 10; ly < my + 36; ly += 5) mg.fillRect(mx + 9, ly, 6 + rnd() * 36, 2);
          mg.fillStyle = A.midEdge;
          mg.fillRect(x + 22, deskY - 4, 56, 3);
          leds.push({ x: mx + 58, y: my + 44, c: 0, p: rnd() * 6 });
          x += dw + 26;
        }
      }
      if (full) scan(mg, floorY);

      // Near: floor, perspective grid, cables.
      const fh = H - floorY;
      const [near, ng] = make(fh);
      ng.fillStyle = A.floor;
      ng.fillRect(0, 0, LW, fh);
      ng.strokeStyle = A.grid;
      ng.lineWidth = 1;
      const vx = LW / 2,
        depth = 260;
      if (level !== "off") {
        for (let gx = -LW; gx <= 2 * LW; gx += 80) {
          ng.beginPath();
          ng.moveTo(vx + (gx - vx) * 0.35, 0);
          ng.lineTo(gx, fh);
          ng.stroke();
        }
        for (let d = 1; d < 10; d++) {
          const y = fh * (1 - depth / (depth + d * d * 9));
          ng.beginPath();
          ng.moveTo(0, y);
          ng.lineTo(LW, y);
          ng.stroke();
        }
      }
      if (full) {
        ng.fillStyle = A.cable;
        ng.fillRect(0, Math.min(fh - 6, 34), LW, 3);
      }
      ng.strokeStyle = A.floorLine;
      ng.lineWidth = 2;
      ng.beginPath();
      ng.moveTo(0, 1);
      ng.lineTo(LW, 1);
      ng.stroke();

      this.layers = { W, H, floorY, res: this.res, k, far, mid, near, leds, key: this.layerKey() };
    }

    // What the layers were built from; a change rebuilds them on the next frame.
    layerKey() {
      return [
        this.sceneryLevel,
        this.scanlines ? 1 : 0,
        this.bgImage ? this.bgVersion : 0,
        CONFIG.theme.arena.skyTop,
        CONFIG.theme.arena.floor,
      ].join("|");
    }

    // The custom background, drawn onto the far layer over the sky: cover, contain or stretch, with the four
    // filters (blur, brightness, saturation and opacity). Done once per rebuild, so it costs nothing per frame.
    paintBackground(g, LW, h, k) {
      const img = this.bgImage,
        o = this.bgOpts || {};
      const iw = img.naturalWidth || img.width,
        ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;
      const blur = (o.blur || 0) * k; // the slider is in drawing units; the filter works in canvas pixels
      const pad = Math.ceil((blur * 2) / k); // overscan so a blurred edge never fades to transparent
      const bw = LW + 2 * pad,
        bh = h + 2 * pad;
      let w = bw,
        hh = bh;
      if (o.mode !== "stretch") {
        const sc = o.mode === "contain" ? Math.min(LW / iw, h / ih) : Math.max(bw / iw, bh / ih);
        w = iw * sc;
        hh = ih * sc;
      }
      const x = (LW - w) / 2,
        y = (h - hh) / 2;
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, (o.opacity === undefined ? 100 : o.opacity) / 100));
      if ("filter" in g) {
        const f = [];
        if (blur > 0) f.push(`blur(${blur.toFixed(1)}px)`);
        if (o.brightness !== undefined && o.brightness !== 100) f.push(`brightness(${o.brightness}%)`);
        if (o.saturate !== undefined && o.saturate !== 100) f.push(`saturate(${o.saturate}%)`);
        if (f.length) g.filter = f.join(" ");
      }
      g.beginPath();
      g.rect(0, 0, LW, h);
      g.clip(); // keep the image above the floor
      g.drawImage(img, x, y, w, hh);
      g.restore();
    }

    drawScenery(ctx, W, H, floorY, sim, dt) {
      const L = this.layers,
        M = Renderer.PAR_MARGIN,
        A = CONFIG.theme.arena;
      if (!L || L.W !== W || L.H !== H || L.floorY !== floorY || L.res !== this.res || L.key !== this.layerKey()) {
        this.buildLayers(W, H, floorY);
      }
      const { far, mid, near, leds } = this.layers,
        k = this.res,
        lk = this.layers.k;
      // Parallax follows the midpoint of the fighters (the duel's camera itself is fixed).
      const f = sim.fighters,
        centre = (sim.arenaWidth !== undefined ? sim.arenaWidth : W) / 2;
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

    drawFx(ctx, sim, sx, floorY, W) {
      const boxes = [];
      for (const fx of sim.fx) {
        if (fx.lane === "number" && !this.damageNumbers) continue; // player setting
        if (fx.type === "spark" && this.chars && sim.streams) continue; // the 2D fighters draw their own hit effects
        const t = fx.age / fx.life;
        const x = sx(fx.x),
          y = floorY - fx.z;
        ctx.save();
        // Duel texts stay fully bright for most of their life, then fade; sparks fade from the start.
        ctx.globalAlpha = fx.lane ? Math.min(1, (1 - t) / 0.35) : 1 - t;
        if (fx.type === "spark") {
          const by = fx.by !== undefined && sim.fighters[fx.by];
          ctx.strokeStyle = (by && by.sparkColor) || fx.color;
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          const r0 = fx.size * 0.3 * t + 6,
            r1 = fx.size * (0.4 + t);
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
            const m = ctx.measureText(fx.text),
              w = m.width,
              M = CONFIG.floatText.margin;
            let x0 = align === "right" ? tx - w : align === "left" ? tx : tx - w / 2;
            const shift = Math.min(Math.max(x0, M), W - M - w) - x0;
            tx += shift;
            x0 += shift;
            boxes.push({
              text: fx.text,
              lane: fx.lane,
              owner: fx.owner,
              x0,
              x1: x0 + w,
              y0: ty - m.actualBoundingBoxAscent,
              y1: ty + m.actualBoundingBoxDescent,
            });
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
        } else if (fx.type === "orb") {
          // the Brawl fireball: a glowing ball with a short tail
          const dir = fx.dir || 1;
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = fx.color;
          ctx.beginPath();
          ctx.arc(x, y, fx.size * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.ellipse(x - dir * fx.size * 0.9, y, fx.size * 1.1, fx.size * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(x, y, fx.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(x, y, fx.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (fx.type === "ring") {
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(x, floorY + 2, 20 + t * 130, 4 + t * 20, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
      this.textBoxes = boxes;
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

  return Renderer;
});
