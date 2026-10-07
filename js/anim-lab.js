// Animation Lab: a playable stage for the movement system (anim-move.js) and the action clips (anim-clips.js).
// A test tool only: it does not touch the game. Open animations.html by double clicking it.
(() => {
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const VIEW_H = 430;            // drawing units from the top to the bottom of the window
  const FLOOR = VIEW_H * 0.8;    // the floor line, in drawing units from the top
  const STEP = 1 / 120;          // fixed simulation step
  // The roster: the six designed characters (js/anim-chars.js), keys 1 to 6.
  const ROSTER = Chars.ORDER;
  const DEF = (k) => Chars.DEFS[k];

  const lab = {
    char: "cyborg", speeds: [1, 0.5, 0.25, 0.1], speedIdx: 0, paused: false, stepOnce: false,
    onion: false, dummyOn: true, bg: "studio", panel: true, repeat: false, sheet: 0, compare: false, mode: "lock",
    hitstop: 0, shake: 0, camX: 0, time: 0, res: 1, W: 1366, keys: {}, acc: 0, script: null, testInput: null,
    zoom: 1, zoomV: 0, impact: null, sound: true,
  };

  // ---------- Sound: synthesized with Web Audio (no files). Starts on the first key press (browsers require it). ----------
  const Sfx = (() => {
    let ac = null, master = null, noiseBuf = null;
    const last = {};
    function init() {
      if (ac) { if (ac.state === "suspended") ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const vary = (v, k) => v * (1 + (Math.random() * 2 - 1) * k);
    function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    function noise(t, dur, type, f0, f1, q, peak) {
      const src = ac.createBufferSource(); src.buffer = noiseBuf;
      const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q || 1;
      f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ac.createGain(); env(g, t, 0.005, peak, dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    }
    function tone(t, dur, type, f0, f1, peak) {
      const o = ac.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ac.createGain(); env(g, t, 0.003, peak, dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    // Each sound: a transient, a body and a short tail; pitch and level vary a little so repeats do not tire.
    const SOUNDS = {
      step: (t) => noise(t, 0.07, "lowpass", vary(500, 0.15), 200, 0.7, 0.12),
      whoosh: (t, k) => noise(t, 0.16 + 0.1 * k, "bandpass", vary(500, 0.1), vary(2400, 0.1), 1.4, 0.18 + 0.1 * k),
      punch: (t, k) => { tone(t, 0.16, "sine", vary(140, 0.08), 45, 0.55 + 0.2 * k); noise(t, 0.05, "highpass", 1800, 0, 0.7, 0.35); },
      slash: (t, k) => { noise(t, 0.09, "highpass", 2500, 0, 0.7, 0.4); tone(t, 0.32, "triangle", vary(1180, 0.05), 1100, 0.12); tone(t, 0.45, "sine", vary(1770, 0.05), 0, 0.07); tone(t, 0.12, "sine", 160, 60, 0.35 + 0.2 * k); },
      parry: (t) => { tone(t, 0.5, "triangle", 1500, 1450, 0.2); tone(t, 0.6, "sine", 2250, 0, 0.1); noise(t, 0.06, "highpass", 3000, 0, 0.7, 0.35); },
      land: (t, k) => { tone(t, 0.18, "sine", 110, 40, 0.35 + 0.3 * k); noise(t, 0.12, "lowpass", 700, 150, 0.7, 0.2 + 0.2 * k); },
      thud: (t) => { tone(t, 0.3, "sine", 90, 35, 0.7); noise(t, 0.25, "lowpass", 600, 120, 0.7, 0.35); },
      dash: (t) => noise(t, 0.22, "bandpass", 300, 1800, 0.9, 0.22),
      hurt: (t) => tone(t, 0.12, "square", vary(220, 0.1), 140, 0.05),
      bat: (t, k) => { tone(t, 0.3, "triangle", vary(1650, 0.04), 1500, 0.22); tone(t, 0.14, "sine", 150, 55, 0.45 + 0.2 * k); noise(t, 0.05, "highpass", 2500, 0, 0.7, 0.3); },
      staff: (t, k) => { tone(t, 0.1, "square", vary(420, 0.06), 180, 0.14); noise(t, 0.08, "bandpass", 900, 400, 1.2, 0.4 + 0.2 * k); },
      axe: (t, k) => { tone(t, 0.32, "sine", 95, 38, 0.7); noise(t, 0.18, "lowpass", 1400, 200, 0.7, 0.45 + 0.2 * k); tone(t, 0.4, "triangle", vary(900, 0.05), 860, 0.08); },
      frost: (t) => { noise(t, 0.35, "highpass", 4000, 6000, 0.6, 0.25); tone(t, 0.5, "sine", vary(2600, 0.05), 3100, 0.05); },
      flame: (t) => noise(t, 0.3, "bandpass", 700, 300, 0.8, 0.3),
    };
    function play(name, k) {
      if (!lab.sound || !ac || ac.state !== "running") return;
      const now = ac.currentTime;
      if (last[name] && now - last[name] < 0.03) return; // no stacking of the same sound in one frame
      last[name] = now;
      try { SOUNDS[name](now, k || 0); } catch (e) { /* audio is best-effort */ }
    }
    return { init, play, get ctx() { return ac; } };
  })();
  window.labSfx = Sfx;

  // ---------- Fighters ----------
  // A Move.Character plus the lab's drawing state (look, cloth, smears, afterimages, flash).
  // def: a designed character; the practice dummy (def null) stays a plain grey stick figure.
  function makeFighter(def, x, facing, isDummy) {
    const ch = isDummy ? new Move.Character("fists", "M", x, facing) : new Move.Character(def.weapon, def.gender, x, facing, def.prof);
    ch.def = isDummy ? null : def;
    ch.isDummy = isDummy;
    dress(ch);
    return ch;
  }
  function dress(ch) {
    if (ch.def) { ch.look = { trail: ch.def.trail }; ch.cloth = Chars.makeCloth(ch.def); }
    else {
      ch.look = Object.assign(Anim.look("fists", "M"), { accent: "#8a909b", body: "#2b2f37", back: "#3a3f49", cloth: [{ kind: "sash", color: "#6d737d" }], wraps: "#9aa0aa" });
      ch.look.rim = BG[lab.bg].rim;
      ch.cloth = Rig.makeCloth(ch.look);
    }
    ch.clothReady = false; ch.heat = 0;
    ch.trails = [[], [], [], []]; ch.ghosts = []; ch.flash = 0; ch.ghostT = 0;
  }
  function setCharacter(ch, def) {
    ch.def = def;
    ch.setLook(def.weapon, def.gender, def.prof);
    ch.reset();
    dress(ch);
  }
  // Cloth and drawing for either kind of fighter.
  function clothReset(a, S) { (a.def ? Chars : Rig).resetCloth(a.cloth, S); }
  function clothStep(a, S, dt, floor, t, vel) { (a.def ? Chars : Rig).stepCloth(a.cloth, S, dt, floor, t, vel); }
  function drawFig(a, S, cloth, opt) {
    if (a.def) Chars.draw(ctx, S, a.def, cloth, Object.assign({ t: lab.time, heat: a.heat }, opt));
    else Rig.drawFighter(ctx, S, opt.flash ? Object.assign({}, a.look, { body: "#f4f6fb", back: "#c9cdd6" }) : a.look, a.weapon, cloth, opt);
  }
  const nextChar = (k) => ROSTER[(ROSTER.indexOf(k) + 1) % ROSTER.length];

  let player, dummy, twin, particles = [];
  function reset() {
    player = makeFighter(DEF(lab.char), -90, 1, false);
    dummy = makeFighter(null, 120, -1, true);
    dummy.homeX = 120;
    twin = makeFighter(DEF(nextChar(lab.char)), -90, 1, false);
    player.target = dummy; dummy.target = player; twin.target = dummy;
    if (!lab.dummyOn) player.target = twin.target = null;
    applyMode();
    particles = []; lab.script = null;
  }
  function applyMode() {
    player.mode = lab.mode; twin.mode = lab.mode;
    // Compare mode: the twin (the other body) stands 170 units behind and copies every input.
    if (lab.compare) { twin.x = player.x - 170; twin.facing = player.facing; twin.reset(); }
  }
  const fighters = () => [player].concat(lab.compare ? [twin] : []).concat(lab.dummyOn ? [dummy] : []);
  const actors = () => [player].concat(lab.compare ? [twin] : []);

  // ---------- Effects ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  function dust(x, y, n, spread, dir, color, size) {
    for (let i = 0; i < n; i++) particles.push({ k: "dust", x: x + rnd(-6, 6), y: y - rnd(0, 4), vx: (dir || 0) * rnd(20, 90) + rnd(-spread, spread), vy: -rnd(10, 50),
      r: rnd(4, 8) * (size || 1), vr: rnd(14, 30) * (size || 1), life: rnd(0.35, 0.6), age: 0, color: color || "rgba(214, 200, 176, " });
  }
  function sparks(x, y, n, color, size) {
    for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2); particles.push({ k: "spark", x, y, a, sp: rnd(160, 420) * (size || 1), len: rnd(8, 18) * (size || 1), life: rnd(0.16, 0.3), age: 0, color }); }
    particles.push({ k: "flash", x, y, r: 26 * (size || 1), life: 0.12, age: 0, color });
  }
  function ring(x, y, w, life) { particles.push({ k: "ring", x, y, w, life: life || 0.45, age: 0 }); }
  const HIT_SOUND = { fists: "punch", flame: "punch", dance: "punch", sword: "slash", bat: "bat", staff: "staff", axe: "axe" };
  // Blue fire burst (flame brawler): rising, fading flame puffs, pushed forward by dir.
  function flameBurst(x, y, n, dir, size) {
    for (let i = 0; i < n; i++) particles.push({ k: "fire", x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: dir * rnd(80, 260) + rnd(-40, 40), vy: -rnd(30, 140), r: rnd(5, 11) * (size || 1), life: rnd(0.25, 0.5), age: 0 });
  }
  // Ice shards and mist (ice barbarian).
  function frost(x, y, n) {
    for (let i = 0; i < n; i++) { const a = rnd(Math.PI * 1.05, Math.PI * 1.95); particles.push({ k: "ice", x, y, vx: Math.cos(a) * rnd(60, 260), vy: Math.sin(a) * rnd(60, 260), r: rnd(2, 5), rot: rnd(0, 6), life: rnd(0.4, 0.8), age: 0 }); }
    particles.push({ k: "flash", x, y, r: 30, life: 0.14, age: 0, color: "143, 220, 255" });
  }
  function star(x, y) { particles.push({ k: "star", x, y, life: 0.3, age: 0 }); sparks(x, y, 10, "255, 245, 210", 0.8); }

  // Where a strike lands: the tip of the active blade, the fist, or the knee or foot for bare hand attack 4.
  function strikePoint(a, S) {
    const c = a.action ? a.action.c : null, u = a.action ? a.action.u : 0;
    if (c && c.id === "a4" && a.gender === "M" && (a.weapon === "fists")) return S.J.fk;
    if (c && c.orb) return S.J.orb; // Nova's spell orb strikes, not her hands
    if (c && !c.trails.length) return S.J.ft; // kicks and knees: no smear, the foot strikes
    const tr = c ? c.trails.find(([t0, t1]) => u >= t0 - 0.05 && u <= t1 + 0.05) || c.trails[0] : null;
    const pts = Rig.trailPoints(S, a.weapon);
    return (pts[tr ? tr[2] : 0] || pts[0])[0];
  }

  function fire(a, name) {
    if (a.sim || !a.pose) return; // sheet view simulations make no effects; nothing to place before the first pose
    const S = a.solve(FLOOR), W = Anim.W[a.weapon];
    const low = S.J.ff[1] > S.J.bf[1] ? S.J.ff : S.J.bf;
    switch (name) {
      case "step": if (!a.isDummy) Sfx.play("step"); if (a.spd > 60) dust(low[0], FLOOR, a.spd > 200 ? 3 : 1, 16, -Math.sign(a.vx), null, a.spd > 200 ? 1 : 0.6); break;
      case "dust": dust(low[0], FLOOR, 6, 40, -a.facing); if (a.dashT > 0) Sfx.play("dash"); break;
      case "skid": dust(S.J.ff[0], FLOOR, 6, 30, Math.sign(a.vx)); break;
      case "skidDust": dust(S.J.ff[0], FLOOR, 1, 20, Math.sign(a.vx), null, 0.8); break;
      case "landSoft": dust(S.J.hip[0], FLOOR, 4, 50, 0, null, 0.8); Sfx.play("land", 0); break;
      case "land": dust(S.J.hip[0], FLOOR, 10, 90, 0); ring(S.J.hip[0], FLOOR, 60); lab.shake = Math.max(lab.shake, 2.5); Sfx.play("land", 1); break;
      case "thud": dust(S.J.hip[0], FLOOR, 12, 110, 0); lab.shake = Math.max(lab.shake, 5); Sfx.play("thud"); break;
      case "slam": {
        const p = strikePoint(a, S);
        dust(p[0], FLOOR, 12, 120, 0); ring(p[0], FLOOR, 90, 0.5);
        lab.shake = Math.max(lab.shake, 5);
        break;
      }
      case "impact": {
        const p = strikePoint(a, S);
        const reachOk = !a.isDummy && lab.dummyOn && (dummy.x - a.x) * a.facing > 0 && Math.abs(dummy.x - a.x) < W.reach + 60;
        if (reachOk && !dummy.dead) {
          // The reaction depends on the attack: light hit, heavy stagger or knockdown.
          const type = (a.action && a.action.c.hitType) || "hit", big = type === "hit" ? 0 : type === "hitHeavy" ? 1 : 2;
          if (!(dummy.action && dummy.action.c.id === "knockdown" && dummy.action.u < 0.8)) dummy.play(type);
          dummy.flash = 0.1;
          // A thrown orb that flew past the dummy bursts on the dummy, not behind it.
          const px = a.action && a.action.c.orb ? (a.facing > 0 ? Math.min(p[0], dummy.x) : Math.max(p[0], dummy.x)) : p[0];
          const hx = Rig.lerp(px, dummy.x, 0.4), hy = Math.min(p[1], FLOOR - 50);
          sparks(hx, hy, 12 + 6 * big, a.look.trail, 1 + 0.3 * big);
          // Held impact frame: a short freeze with the contact drawn bright, plus a camera punch-in.
          lab.hitstop = 0.06 + 0.035 * big;
          lab.impact = { t: 0.05 + 0.02 * big, life: 0.05 + 0.02 * big, x: hx, y: hy, color: a.look.trail };
          lab.zoomV += 0.9 + 0.6 * big;
          lab.shake = Math.max(lab.shake, 3 + 3 * big);
          Sfx.play(HIT_SOUND[a.weapon] || "punch", big / 2);
          if (a.weapon === "flame") { flameBurst(hx, hy, 14 + 6 * big, a.facing); a.heat = 1; }
          if (a.weapon === "axe") frost(hx, hy, 10 + 6 * big);
          Sfx.play("hurt");
        } else sparks(p[0], p[1], 4, a.look.trail, 0.6);
        break;
      }
      case "parry": { const p = strikePoint(a, S); star(p[0] + a.facing * 6, p[1]); lab.hitstop = 0.05; lab.shake = Math.max(lab.shake, 2); Sfx.play("parry"); break; }
      case "hurt": a.flash = 0.1; break;
      case "tap": dust(strikePoint(a, S)[0], FLOOR, 3, 20, 0, null, 0.6); Sfx.play("step"); break;
      case "whirl": Sfx.play("whoosh", 1); break;
      case "roar": lab.shake = Math.max(lab.shake, 4); lab.zoomV += 0.6; Sfx.play("thud"); break;
      case "frost": { const p = strikePoint(a, S); frost(p[0], Math.min(p[1], FLOOR - 4), 18); ring(p[0], FLOOR, 110, 0.55); Sfx.play("frost"); break; }
      case "blast": { const h = S.J.orb; flameBurst(h[0], h[1], 18, a.facing, 1.5); a.heat = 1; Sfx.play("flame"); break; }
      case "pillar": { const p = strikePoint(a, S); for (let i = 0; i < 4; i++) flameBurst(p[0], FLOOR - 10 - i * 26, 6, 0, 0.8); a.heat = 1; Sfx.play("flame"); break; }
      case "flare": { const h = a.weapon === "flame" ? S.J.orb : S.J.fh; flameBurst(h[0], h[1] - 6, 10, 0, 0.7); a.heat = 1; Sfx.play("flame"); break; }
    }
  }

  // ---------- Input (testing only) ----------
  const ACTIONS = { a: "a1", s: "a2", d: "a3", f: "a4", q: "combo", e: "parry", h: "hit", t: "taunt", k: "death" };
  const tap = { dir: 0, at: -1, released: true };
  let jumpEdge = false, lastAction = null;

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Shift"].includes(e.key)) e.preventDefault();
    if (lab.keys[k] && e.repeat) return;
    lab.keys[k] = true;
    Sfx.init();
    if (k === "u") { lab.sound = !lab.sound; return; }
    if (k >= "1" && k <= "6") { lab.char = ROSTER[+k - 1]; swapCharacter(); return; }
    if (k === "z") { lab.speedIdx = (lab.speedIdx + 1) % lab.speeds.length; return; }
    if (k === "p") { lab.paused = !lab.paused; return; }
    if (k === ".") { lab.paused = true; lab.stepOnce = true; return; }
    if (k === "o") { lab.onion = !lab.onion; return; }
    if (k === "v") { lab.sheet = (lab.sheet + 1) % 4; sheetCache = null; document.body.classList.toggle("sheet", lab.sheet > 0); return; }
    if (k === "n") { lab.dummyOn = !lab.dummyOn; for (const c of [player, twin]) c.target = lab.dummyOn ? dummy : null; return; }
    if (k === "b") { lab.bg = lab.bg === "studio" ? "arena" : "studio"; applyBg(); return; }
    if (k === "x") { lab.mode = lab.mode === "lock" ? "free" : "lock"; applyMode(); return; }
    if (k === "c") { lab.compare = !lab.compare; applyMode(); updatePanel(); return; }
    if (k === "m") { if (lab.mode === "free") for (const c of actors()) if (!c.action) c.startTurn(); return; }
    if (k === "l") { lab.repeat = !lab.repeat; return; }
    if (k === "`") { lab.panel = !lab.panel; $("panel").classList.toggle("hidden", !lab.panel); return; }
    if (k === "Enter") { lab.script = lab.script ? null : demoScript(); return; }
    if (k === "r") { reset(); return; }
    if (k === " " || k === "ArrowUp" || k === "w") { jumpEdge = true; return; }
    if (k === "ArrowLeft" || k === "ArrowRight") {
      const dir = k === "ArrowRight" ? 1 : -1;
      if (tap.dir === dir && tap.released && lab.time - tap.at < 0.24) { for (const c of actors()) c.dash(dir, fire); tap.dir = 0; }
      else { tap.dir = dir; tap.at = lab.time; tap.released = false; }
      return;
    }
    if (ACTIONS[k]) { for (const c of actors()) c.play(ACTIONS[k], fire); lastAction = ACTIONS[k]; return; }
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    lab.keys[k] = false;
    if (k === "ArrowLeft" || k === "ArrowRight") tap.released = true;
  });
  window.addEventListener("blur", () => { lab.keys = {}; });

  function readInput() {
    if (lab.testInput) { const t = Object.assign({}, lab.testInput); lab.testInput.jumpPressed = false; return t; }
    const K = lab.keys;
    const inp = {
      move: (K.ArrowRight ? 1 : 0) - (K.ArrowLeft ? 1 : 0), run: !!K.Shift, crouch: !!K.ArrowDown,
      jump: !!(K[" "] || K.ArrowUp || K.w), jumpPressed: jumpEdge,
    };
    jumpEdge = false;
    return inp;
  }

  function swapCharacter() {
    setCharacter(player, DEF(lab.char));
    setCharacter(twin, DEF(nextChar(lab.char)));
    sheetCache = null;
    updatePanel();
  }

  // Demo reel (Enter): a scripted run through every movement and action. Each step lasts t seconds.
  function demoScript() {
    lab.mode = "lock"; applyMode();
    player.x = dummy.x - 260; player.facing = 1;
    const S = [];
    const hold = (t, inp) => S.push({ t, inp });
    const act = (name, t) => S.push({ t: t || 0.8, act: name });
    hold(1.2, {}); hold(1.4, { move: 1 }); hold(0.5, {}); hold(1.4, { move: -1 }); hold(0.4, {});
    hold(0.6, { crouch: true }); hold(1.2, { crouch: true, move: 1 }); hold(0.5, {});
    S.push({ t: 1.0, inp: { jump: true }, jump: true }); S.push({ t: 1.2, inp: { move: -1 } });
    S.push({ t: 1.1, inp: { move: 1, run: true, jump: true }, jump: true }); hold(0.8, {});
    S.push({ t: 0.6, inp: {}, dash: -1 }); hold(0.4, {});
    for (const a of ["a1", "a2", "a3", "a4"]) act(a, 0.9);
    act("combo", 2.6); act("parry", 0.8); act("taunt", 1.6); act("death", 2.4);
    return { steps: S, i: 0, t: 0 };
  }
  function scriptInput() {
    const sc = lab.script, st = sc.steps[sc.i];
    if (!st) { lab.script = null; reset(); return {}; }
    const first = sc.t === 0;
    if (first) {
      if (st.act && dummy.x - player.x < 70) player.x = dummy.x - 150;
      if (st.act) for (const c of actors()) c.play(st.act, fire);
      if (st.dash) for (const c of actors()) c.dash(st.dash, fire);
    }
    sc.t += STEP;
    if (sc.t >= st.t) { sc.t = 0; sc.i++; if (st.act === "death") { lab.script = null; setTimeout(reset, 300); } }
    return Object.assign({ jumpPressed: first && !!st.jump }, st.inp || {});
  }

  // ---------- Update (fixed steps) ----------
  function update(dt) {
    lab.time += dt;
    const slow = lab.speeds[lab.speedIdx];
    let adt = dt * slow;
    if (lab.paused) adt = lab.stepOnce ? STEP : 0;
    lab.stepOnce = false;
    if (lab.hitstop > 0) { lab.hitstop -= adt > 0 ? dt * slow : 0; adt = 0; }
    lab.acc += adt;
    let n = 0;
    while (lab.acc >= STEP - 1e-9 && n < 12) { lab.acc -= STEP; step(STEP); n++; }

    // Effects age (slower during hit-stop, frozen when paused).
    const edt = lab.paused && !adt ? 0 : (lab.hitstop > 0 ? dt * slow * 0.25 : adt);
    for (const p of particles) {
      p.age += edt;
      if (p.k === "dust") { p.x += p.vx * edt; p.y += p.vy * edt; p.vx *= Math.pow(0.1, edt); p.vy *= Math.pow(0.2, edt); p.r += p.vr * edt; }
      if (p.k === "spark") { p.x += Math.cos(p.a) * p.sp * edt; p.y += Math.sin(p.a) * p.sp * edt; p.sp *= Math.pow(0.02, edt); }
      if (p.k === "line") p.x += p.vx * edt;
      if (p.k === "fire") { p.x += p.vx * edt; p.y += p.vy * edt; p.vx *= Math.pow(0.05, edt); p.vy -= 60 * edt; }
      if (p.k === "ice") { p.x += p.vx * edt; p.y += p.vy * edt; p.vy += 600 * edt; p.rot += 8 * edt; if (p.y > FLOOR) { p.y = FLOOR; p.vy *= -0.3; p.vx *= 0.6; } }
    }
    particles = particles.filter((p) => p.age < p.life);
    lab.shake = Math.max(0, lab.shake - dt * 28);
    // Camera punch: a quick zoom-in on a hit that springs back.
    lab.zoomV += (-(lab.zoom - 1) * 260 - lab.zoomV * 22) * dt;
    lab.zoom = Math.max(0.98, Math.min(1.08, lab.zoom + lab.zoomV * dt));
    if (lab.impact && (lab.impact.t -= dt) <= 0) lab.impact = null;
    const ours = lab.compare ? (player.x + twin.x) / 2 : player.x + player.facing * 50;
    const focus = lab.dummyOn && Math.abs(dummy.x - player.x) < 520 ? (ours + dummy.x) / 2 : ours;
    lab.camX += (focus - lab.camX) * Math.min(1, dt * 3.5);
  }

  function step(dt) {
    const inp = lab.script ? scriptInput() : readInput();
    separate();
    for (const a of fighters()) {
      const prevX = a.x;
      const prevU = a.action ? a.action.u : 0, prevClip = a.action ? a.action.c : null;
      a.update(dt, a.isDummy ? {} : inp, fire);
      // Repeat mode (L): replay the last action when it ends.
      if (!a.isDummy && lab.repeat && !a.action && prevClip && lastAction && !lab.script) a.play(lastAction, fire);
      // The dummy drifts back to its spot after being knocked back.
      if (a.isDummy && !a.action && Math.abs(a.x - a.homeX) > 1) a.x += (a.homeX - a.x) * Math.min(1, dt * 1.5);
      a.flash = Math.max(0, a.flash - dt);
      const S = a.solve(FLOOR);
      a.S = S;
      const vel = (a.x - prevX) / dt;
      if (!a.clothReady) { clothReset(a, S); a.clothReady = true; for (let i = 0; i < 60; i++) clothStep(a, S, 1 / 120, FLOOR, i / 120, 0); }
      clothStep(a, S, dt / 2, FLOOR, lab.time, vel);
      clothStep(a, S, dt / 2, FLOOR, lab.time, vel);
      a.heat = Math.max(0, (a.heat || 0) - dt * 2.5);
      if (a.def && a.def.weapon === "axe" && Math.random() < 0.25) { const q = Rig.trailPoints(S, "axe")[0][0]; particles.push({ k: "ice", x: q[0] + rnd(-8, 8), y: q[1] + rnd(-8, 8), vx: rnd(-20, 20), vy: rnd(-30, 10), r: rnd(1, 2.4), rot: 0, life: rnd(0.3, 0.6), age: 0 }); }
      updateTrails(a, dt, prevClip, prevU);
      updateGhosts(a, dt, S);
      if (a === player && a.dashT > 0 && !a.dashBack && Math.random() < 0.6)
        particles.push({ k: "line", x: a.x - a.facing * rnd(20, 120), y: FLOOR - rnd(20, 150), vx: -a.facing * 700, len: rnd(30, 80), life: 0.22, age: 0 });
    }
  }

  // Bodies do not overlap: a fighter on the ground is pushed out to a minimum distance from the dummy.
  function separate() {
    if (!lab.dummyOn) return;
    for (const a of actors()) {
      if (a.state === "air" || dummy.dead) continue;
      const d = a.x - dummy.x, min = 44;
      if (Math.abs(d) < min) { const s = Math.sign(d) || -a.facing; a.x = dummy.x + s * min; if (Math.sign(a.vx) === -s) a.vx *= 0.3; }
    }
  }

  // Weapon smears: sample the clip several times between steps, so fast swings draw a smooth arc.
  function updateTrails(a, dt, prevClip, prevU) {
    for (const h of a.trails) for (const e of h) e.life -= dt * 4.5;
    a.trails = a.trails.map((h) => h.filter((e) => e.life > 0).slice(-40));
    if (!a.action) return;
    const c = a.action.c;
    if (!c.trails.length) return;
    const u0 = prevClip === c ? prevU : 0, u1 = a.action.u;
    for (const [t0] of c.trails) if (t0 > u0 && t0 <= u1 && !a.isDummy) Sfx.play("whoosh", c.hitType === "hit" ? 0 : 1);
    for (let i = 1; i <= 3; i++) {
      const u = u0 + ((u1 - u0) * i) / 3;
      const active = c.trails.filter(([t0, t1]) => u >= t0 && u <= t1);
      if (!active.length) continue;
      const S = Rig.solve(a.clipPoseAt(u), a.x, FLOOR, a.facing, a.B);
      const pts = Rig.trailPoints(S, a.weapon);
      for (const [, , b] of active) if (pts[b]) a.trails[b].push({ tip: pts[b][0], base: pts[b][1], life: 1 });
    }
  }
  function updateGhosts(a, dt, S) {
    for (const g of a.ghosts) g.life -= dt * 4.2;
    a.ghosts = a.ghosts.filter((g) => g.life > 0);
    const gw = a.action && a.action.c.ghosts;
    const on = (gw && a.action.u >= gw[0] && a.action.u <= gw[1]) || (a.dashT > a.dashDur * 0.25);
    a.ghostT -= dt;
    if (on && a.ghostT <= 0) { a.ghostT = 0.035; a.ghosts.push({ S, life: 1 }); }
  }

  // ---------- Drawing ----------
  const BG = {
    studio: { top: "#6b6e74", bottom: "#55585e", floor: "#46494e", line: "#7b7f86", grid: "rgba(255,255,255,0.06)", wall: "rgba(0,0,0,0.06)", rim: null, shadow: "rgba(0,0,0,0.28)" },
    arena: { top: "#060a18", bottom: "#0d1736", floor: "#0a1128", line: "#2a3a73", grid: "rgba(42,58,115,0.55)", wall: "rgba(124,227,255,0.04)", rim: "#5d6a96", shadow: "rgba(0,0,0,0.45)" },
  };
  function applyBg() {
    document.body.dataset.bg = lab.bg;
    for (const a of [player, dummy, twin]) a.look.rim = BG[lab.bg].rim;
    sheetCache = null;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = innerWidth + "px"; canvas.style.height = innerHeight + "px";
    lab.res = canvas.height / VIEW_H;
    lab.W = canvas.width / lab.res;
    sheetCache = null;
  }
  window.addEventListener("resize", resize);

  function drawBackground(B) {
    const W = lab.W;
    const g = ctx.createLinearGradient(0, 0, 0, FLOOR);
    g.addColorStop(0, B.top); g.addColorStop(1, B.bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, FLOOR);
    ctx.fillStyle = B.wall;
    const off = -lab.camX * 0.3;
    for (let x = ((off % 160) + 160) % 160 - 160; x < W; x += 160) ctx.fillRect(x, 40, 70, FLOOR - 40);
    ctx.fillStyle = B.floor; ctx.fillRect(0, FLOOR, W, VIEW_H - FLOOR);
    ctx.strokeStyle = B.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, FLOOR + 1); ctx.lineTo(W, FLOOR + 1); ctx.stroke();
    ctx.strokeStyle = B.grid; ctx.lineWidth = 1;
    const vx = W / 2, fh = VIEW_H - FLOOR, gOff = -lab.camX;
    for (let gx = ((gOff % 80) + 80) % 80 - W; gx <= 2 * W; gx += 80) {
      ctx.beginPath(); ctx.moveTo(vx + (gx - vx) * 0.45, FLOOR); ctx.lineTo(gx, VIEW_H); ctx.stroke();
    }
    for (let d = 1; d < 6; d++) {
      const y = FLOOR + fh * (1 - 160 / (160 + d * d * 12));
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function drawShadow(S, B, floor) {
    const h = floor - S.J.hip[1];
    const w = Math.max(12, 38 - Math.max(0, h - 60) / 5);
    ctx.fillStyle = B.shadow;
    ctx.beginPath(); ctx.ellipse(S.J.hip[0], floor + 2, w, 6, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawActor(a, B) {
    const S = a.S;
    if (!S) return;
    drawShadow(S, B, FLOOR);
    for (const g of a.ghosts) drawFig(a, g.S, [], { ghost: `rgba(${a.look.trail}, 1)`, alpha: g.life * 0.2 });
    if (lab.onion && a === player && a.action) {
      for (let k = 3; k >= 1; k--) {
        const S2 = Rig.solve(a.clipPoseAt(Math.max(0, a.action.u - k * 0.06)), a.x, FLOOR, a.facing, a.B);
        drawFig(a, S2, [], { ghost: "rgba(124, 227, 255, 1)", alpha: 0.12 + 0.05 * (3 - k) });
      }
    }
    drawFig(a, S, a.cloth, { flash: a.flash > 0 });
  }

  function drawTrails(a) {
    ctx.save();
    ctx.globalCompositeOperation = lab.bg === "arena" ? "lighter" : "source-over";
    for (const h of a.trails) Rig.drawTrail(ctx, h, `rgba(${a.look.trail}, 1)`);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const k = p.age / p.life;
      ctx.save();
      if (p.k === "dust") { ctx.fillStyle = p.color + (0.55 * (1 - k)).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
      if (p.k === "spark") {
        ctx.strokeStyle = `rgba(${p.color}, ${1 - k})`; ctx.lineWidth = 2.5 * (1 - k) + 0.5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(p.a) * p.len, p.y - Math.sin(p.a) * p.len); ctx.stroke();
      }
      if (p.k === "flash") { ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - k)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + k), 0, Math.PI * 2); ctx.fill(); }
      if (p.k === "ring") { ctx.strokeStyle = `rgba(230, 220, 200, ${0.7 * (1 - k)})`; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 10 + p.w * k * 1.6, 3 + 10 * k, 0, 0, Math.PI * 2); ctx.stroke(); }
      if (p.k === "star") {
        ctx.translate(p.x, p.y); ctx.rotate(k * 1.2); ctx.fillStyle = `rgba(255, 250, 225, ${1 - k})`;
        const r = 26 * (0.5 + k);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.18 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
      }
      if (p.k === "fire") {
        ctx.globalCompositeOperation = "lighter";
        const r = p.r * (1 - 0.5 * k), g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(200, 235, 255, ${0.9 * (1 - k)})`); g.addColorStop(0.5, `rgba(90, 139, 255, ${0.6 * (1 - k)})`); g.addColorStop(1, "rgba(60, 80, 255, 0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
      if (p.k === "ice") {
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = `rgba(190, 240, 255, ${1 - k})`; ctx.strokeStyle = `rgba(80, 170, 230, ${1 - k})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -p.r * 1.6); ctx.lineTo(p.r * 0.7, 0); ctx.lineTo(0, p.r * 1.6); ctx.lineTo(-p.r * 0.7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (p.k === "line") { ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - k)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.sign(p.vx) * p.len, p.y); ctx.stroke(); }
      ctx.restore();
    }
  }

  // Impact frame: for a few frames a bright burst of lines from the contact point, over a dimmed scene.
  function drawImpact(im) {
    const k = 1 - im.t / im.life;
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.22 * (1 - k)})`;
    ctx.fillRect(lab.camX - lab.W, -50, lab.W * 2, VIEW_H + 100);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(${im.color}, ${0.9 * (1 - k)})`; ctx.lineCap = "round";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.3, r0 = 10 + 30 * k, r1 = r0 + 26 + (i % 3) * 10;
      ctx.lineWidth = 3 - (i % 3);
      ctx.beginPath(); ctx.moveTo(im.x + Math.cos(a) * r0, im.y + Math.sin(a) * r0); ctx.lineTo(im.x + Math.cos(a) * r1, im.y + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * (1 - k)})`;
    ctx.beginPath(); ctx.arc(im.x, im.y, 9 + 10 * k, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // A small marker over the player: which way it faces (magenta in lock-on, cyan in free facing).
  function drawMarker(a) {
    const h = a.S.J.head;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = lab.mode === "lock" ? "#ff3ea5" : "#7ce3ff";
    const x = h[0], y = h[1] - 34, f = a.turnT >= 0 ? 0 : a.facing;
    ctx.beginPath();
    if (f) { ctx.moveTo(x + f * 7, y); ctx.lineTo(x - f * 4, y - 5); ctx.lineTo(x - f * 4, y + 5); }
    else ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function draw() {
    const B = BG[lab.bg];
    ctx.setTransform(lab.res, 0, 0, lab.res, 0, 0);
    drawBackground(B);
    const sx = lab.shake ? rnd(-1, 1) * lab.shake : 0, sy = lab.shake ? rnd(-1, 1) * lab.shake * 0.6 : 0;
    ctx.translate(lab.W / 2, FLOOR * 0.62); ctx.scale(lab.zoom, lab.zoom); ctx.translate(-lab.W / 2, -FLOOR * 0.62);
    ctx.translate(lab.W / 2 - lab.camX + sx, sy);
    if (lab.dummyOn) drawActor(dummy, B);
    if (lab.compare) { drawActor(twin, B); drawTrails(twin); }
    drawActor(player, B);
    drawTrails(player);
    if (player.S) drawMarker(player);
    drawParticles();
    if (lab.impact) drawImpact(lab.impact);
    if (lab.sheet) drawSheet();
  }

  // ---------- Sheet view (V): every animation as frame rows, simulated through the real controller ----------
  // Page 1: movement. Page 2: actions. A movement row is a short input script: warm-up, then capture.
  const SHEET = {
    1: [
      { id: "idle", label: "Idle (breathing, weight shift)", warm: 0, cap: 1.6, n: 6, inp: {} },
      { id: "walk", label: "Walk (one cycle)", warm: 1.2, cap: "walk", n: 8, inp: { move: 1 } },
      { id: "backwalk", label: "Walk backward, facing kept", warm: 1.2, cap: "back", n: 8, inp: { move: -1 } },
      { id: "run", label: "Run (one cycle)", warm: 1.4, cap: "run", n: 8, inp: { move: 1, run: true } },
      { id: "crouch", label: "Crouch down", warm: 0, cap: 0.45, n: 6, inp: { crouch: true } },
      { id: "crouchwalk", label: "Crouch walk", warm: 1.2, cap: "crouch", n: 8, inp: { crouch: true, move: 1 } },
      { id: "jump", label: "Jump, held for height", warm: 0, cap: 0.95, n: 8, inp: { jump: true }, jumpAt: 0 },
      { id: "runjump", label: "Running jump", warm: 1.2, cap: 0.85, n: 8, inp: { jump: true, move: 1, run: true }, jumpAt: 1.2 },
      { id: "turn", label: "Turn around", warm: 0.2, cap: 0.3, n: 6, inp: {}, turnAt: 0.2 },
      { id: "skid", label: "Run, skid and turn (free facing)", warm: 1.3, cap: 0.6, n: 7, inp: { move: 1, run: true }, after: { move: -1, run: true }, free: true },
      { id: "dash", label: "Dash (double tap)", warm: 0.2, cap: 0.32, n: 6, inp: {}, dashAt: [0.2, 1] },
      { id: "backdash", label: "Back dash", warm: 0.2, cap: 0.32, n: 6, inp: {}, dashAt: [0.2, -1] },
    ],
    2: [
      { act: "a1" }, { act: "a2" }, { act: "a3" }, { act: "a4" }, { act: "combo" },
      { act: "air", jumpAt: 0, warm: 0.2, inp: { jump: true } }, { act: "parry" }, { act: "taunt" },
    ],
    3: [
      { act: "hit" }, { act: "hitHeavy" }, { act: "knockdown" }, { act: "death" },
      { act: "idle1" }, { act: "idle2" }, { id: "guard", label: "Guard (idle, breathing)", warm: 0.3, cap: 1.2, n: 4, inp: {} },
      { id: "turnwalk", label: "Pivot turn (feet stay planted)", warm: 0.1, cap: 0.24, n: 6, inp: {}, turnAt: 0.1 },
    ],
  };
  const PAGE_NAMES = { 1: "movement", 2: "attacks", 3: "reactions and idle breaks" };
  let sheetCache = null;
  function simRow(row, def) {
    const ch = makeFighter(def, 0, 1, false);
    ch.sim = true; ch.noBreaks = true; ch.t = 0; ch.look.rim = BG[lab.bg].rim;
    ch.mode = row.free ? "free" : "lock";
    ch.target = row.free ? null : { x: 100000 };
    const fx = () => {};
    let n = row.n || 6, warm = row.warm || 0, cap = row.cap, label = row.label;
    if (row.act) {
      const c = ch.clips[row.act];
      label = c.label;
      n = c.seq ? c.seq.length : c.frames;
      cap = c.seq ? c.seq.reduce((s, k) => s + (ch.clips[k].dur * ch.St.tempo) / 1.2, 0) : c.dur * ch.St.tempo;
      warm = row.warm !== undefined ? row.warm : 0.2;
    }
    const St = ch.St, SP = Move.SPEED;
    if (cap === "walk") cap = St.walkCycle / SP.walk;
    if (cap === "back") cap = St.walkCycle / SP.back;
    if (cap === "run") cap = St.runCycle / SP.run;
    if (cap === "crouch") cap = St.crouchCycle / SP.crouch;
    const frames = [], steps = Math.round((warm + cap) / STEP);
    let next = 0, jumped = false, turned = false, dashed = false, acted = false;
    for (let i = 0; i <= steps; i++) {
      const t = i * STEP;
      const inp = Object.assign({}, t >= warm && row.after ? row.after : row.inp || {});
      if (row.jumpAt !== undefined && !jumped && t >= row.jumpAt) { inp.jumpPressed = true; jumped = true; }
      if (row.turnAt !== undefined && !turned && t >= row.turnAt) { ch.startTurn(); turned = true; }
      if (row.dashAt && !dashed && t >= row.dashAt[0]) { ch.dash(row.dashAt[1], fx); dashed = true; }
      if (row.act && !acted && t >= warm) { ch.play(row.act === "air" ? "a1" : row.act, fx); acted = true; }
      const x0 = ch.x;
      ch.update(STEP, inp, fx);
      const S = Rig.solve(ch.pose, 0, 0, ch.facing, ch.B);
      if (!ch.clothReady) { clothReset(ch, S); ch.clothReady = true; for (let j = 0; j < 90; j++) clothStep(ch, S, STEP, 0, j * STEP, 0); }
      clothStep(ch, S, STEP, 0, t, (ch.x - x0) / STEP);
      // Frames for a seq (combo) sit at each strike's impact; others are spread evenly over the capture.
      let take = false;
      if (row.act && ch.clips[row.act].seq) take = ch.action && ch.action.c.events.some((e) => e[1] === "impact" && e[0] > (ch.action.prevU || 0) && e[0] <= ch.action.u) && next < n;
      else take = t >= warm && next < n && t - warm >= (next * cap) / (row.act === "death" ? n - 1 : n) - 1e-9;
      if (take) { frames.push({ S, cloth: ch.cloth.map((it) => Object.assign({}, it, { ch: { p: it.ch.p.map((q) => q.slice()) } })) }); next++; }
    }
    return { label: label || row.id, frames, look: ch.look, ch };
  }

  function drawSheet() {
    const key = lab.char + lab.bg + lab.sheet;
    if (!sheetCache || sheetCache.key !== key) sheetCache = { key, rows: SHEET[lab.sheet].map((r) => simRow(r, DEF(lab.char))) };
    const rows = sheetCache.rows, B = BG[lab.bg];
    ctx.setTransform(lab.res, 0, 0, lab.res, 0, 0);
    ctx.fillStyle = lab.bg === "studio" ? "rgba(52, 55, 60, 0.97)" : "rgba(6, 10, 24, 0.97)";
    ctx.fillRect(0, 0, lab.W, VIEW_H);
    const perCol = Math.ceil(rows.length / 2);
    const top = 26, gap = 4, colW = (lab.W - 12) / 2, rowH = (VIEW_H - top - 6) / perCol;
    ctx.fillStyle = "#e8edff"; ctx.font = "bold 13px Consolas, monospace";
    ctx.fillText(`${DEF(lab.char).name}  |  ${PAGE_NAMES[lab.sheet]}, page ${lab.sheet} of 3 (V: next page)`, 8, 17);
    rows.forEach((d, idx) => {
      const ci = Math.floor(idx / perCol), ri = idx % perCol;
      const x0 = 6 + ci * colW, y0 = top + ri * rowH;
      ctx.fillStyle = lab.bg === "studio" ? "#5a5d63" : "#0b1129";
      ctx.fillRect(x0, y0, colW - gap, rowH - gap);
      ctx.fillStyle = "#1d1f24"; ctx.fillRect(x0, y0, colW - gap, 11);
      ctx.fillStyle = "#e8edff"; ctx.font = "bold 8px Consolas, monospace";
      ctx.fillText(`${d.label.toUpperCase()} (${d.frames.length} FRAMES)`, x0 + 4, y0 + 8);
      const n = d.frames.length, cw = (colW - gap) / Math.max(n, 4), scale = (rowH - 16) / 195;
      d.frames.forEach((f, i) => {
        ctx.save();
        ctx.beginPath(); ctx.rect(x0 + i * cw, y0 + 11, cw, rowH - gap - 11); ctx.clip();
        ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.font = "7px Consolas, monospace"; ctx.fillText(String(i + 1), x0 + i * cw + 3, y0 + 20);
        ctx.translate(x0 + i * cw + cw / 2, y0 + rowH - gap - 5);
        ctx.scale(scale, scale);
        ctx.fillStyle = B.shadow; ctx.beginPath(); ctx.ellipse(f.S.J.hip[0], 2, 30, 5, 0, 0, Math.PI * 2); ctx.fill();
        Chars.draw(ctx, f.S, d.ch.def, f.cloth, { t: 0 });
        ctx.restore();
      });
    });
  }

  // ---------- Panel and status ----------
  function updatePanel() {
    const d = DEF(lab.char), w = Anim.W[d.weapon];
    $("char-name").textContent = d.name;
    $("char-sub").textContent = `${d.title}, ${w.name}` + (lab.compare ? `  |  ${DEF(nextChar(lab.char)).name} copies you behind` : "");
    $("roster").innerHTML = ROSTER.map((id, i) => `<span class="chip ${id === lab.char ? "on" : ""}"><kbd>${i + 1}</kbd>${DEF(id).name}</span>`).join("");
  }
  const NAMES = { idle: "Idle", walk: "Walk", backwalk: "Walk backward", run: "Run", crouch: "Crouch", crouchwalk: "Crouch walk", jump: "Jump", fall: "Fall",
    turn: "Turn around", dash: "Dash", backdash: "Back dash", skid: "Skid" };
  function updateStatus() {
    const a = player;
    if (a.action) {
      const c = a.action.c, frames = c.frames || 1;
      $("st-clip").textContent = a.comboName ? `Combo sequence: ${c.label}` : c.label;
      $("st-frame").textContent = `frame ${Math.min(frames, Math.floor(a.action.u * frames) + 1)} of ${frames}`;
      $("st-bar").style.width = (a.action.u * 100).toFixed(1) + "%";
      $("st-ticks").innerHTML = c.events.filter((e) => e[1] === "impact").map((e) => `<i style="left:${e[0] * 100}%"></i>`).join("");
    } else {
      $("st-clip").textContent = NAMES[a.label] || a.label;
      $("st-frame").textContent = `${Math.round(Math.abs(a.vx))} units/s  |  facing ${a.facing > 0 ? "right" : "left"}`;
      $("st-bar").style.width = (Math.min(1, Math.abs(a.vx) / Move.SPEED.run) * 100).toFixed(1) + "%";
      $("st-ticks").innerHTML = "";
    }
    $("st-flags").textContent = [lab.mode === "lock" ? "lock-on facing" : "free facing", `speed x${lab.speeds[lab.speedIdx]}`, lab.paused ? "PAUSED" : "",
      lab.repeat ? "repeat" : "", lab.onion ? "onion" : "", lab.compare ? "compare" : "", lab.dummyOn ? "dummy" : "", lab.script ? "demo reel" : "", lab.bg].filter(Boolean).join("  |  ");
  }

  // ---------- Loop ----------
  let last = performance.now();
  const frameStats = { n: 0, ms: 0 };
  window.labStats = frameStats;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t0 = performance.now();
    try {
      update(dt);
      draw();
      updateStatus();
    } catch (err) { console.error(err); } // keep the lab running if one frame fails
    frameStats.n++; frameStats.ms += performance.now() - t0;
    requestAnimationFrame(loop);
  }

  // For tests: the lab state, the fighters, and a way to run fixed steps with a scripted input.
  window.lab = lab;
  window.labActors = () => ({ player, dummy, twin });
  window.labRun = (n, inp) => { lab.testInput = inp || {}; for (let i = 0; i < n; i++) step(STEP); lab.testInput = null; draw(); };
  window.labReset = reset;

  reset();
  resize();
  applyBg();
  updatePanel();
  requestAnimationFrame(loop);
})();
