// 3D Lab: the test stage. Two fighters (you and a training dummy), keyboard play, the move list panel with demo
// buttons, dummy guard modes, hit-stop, sparks, camera shake, combo counter and sound. Fixed 1/120 s step.
(() => {
  const STEP = 1 / 120;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const S = T3S.create(document.getElementById("view"));
  const ORDER = T3M.ORDER;
  const lab = {
    t: 0, acc: 0, paused: false, slow: false, hitstop: 0, pc: 0, dc: 1, guard: "none", sound: true, helpOn: true, meterFull: true,
    keys: {}, press: {}, pressBuf: null, combo: { n: 0, dmg: 0, t: 0 }, info: null, script: null, pixel: true, stats: { hit: 0, block: 0, air: 0, log: [] },
  };
  const player = new T3F.Fighter(ORDER[0], 0), dummy = new T3F.Fighter(ORDER[1], 1);
  player.addTo(S.scene); dummy.addTo(S.scene);
  player.S = S; dummy.S = S;
  function place() {
    player.reset(-0.52, 0, 0); dummy.reset(0.52, 0, Math.PI);
    S.camDir = null; S.camPos = null;
    lab.combo = { n: 0, dmg: 0, t: 0 }; lab.stats = { hit: 0, block: 0, air: 0, log: [] }; lab.script = null; lab.hitstop = 0;
    S.cine = null; T3S.setMood(S, 0); lab.banner = null;
  }
  place();

  // ---------- Sound (Web Audio, synthesized) ----------
  const Sfx = (() => {
    let ac = null, master = null;
    const ctx = () => { if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); } return ac; };
    function noise(dur, f, q, vol, decay) {
      const a = ctx(), n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay || 2);
      const s = a.createBufferSource(); s.buffer = buf;
      const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
      const g = a.createGain(); g.gain.value = vol;
      s.connect(bp); bp.connect(g); g.connect(master); s.start();
    }
    function tone(f0, f1, dur, vol, type) {
      const a = ctx(), o = a.createOscillator(), g = a.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f0, a.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), a.currentTime + dur);
      g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(g); g.connect(master); o.start(); o.stop(a.currentTime + dur);
    }
    const play = (name, k) => {
      if (!lab.sound || !ac) return;
      k = k || 0;
      const p = 1 + (Math.random() - 0.5) * 0.12;
      if (name === "hit") { noise(0.12, 900 * p, 1.2, 0.9); tone(160 * p, 50, 0.14 + 0.06 * k, 0.5 + 0.2 * k); }
      if (name === "heavy") { noise(0.2, 600 * p, 0.9, 1.1); tone(110 * p, 35, 0.26, 0.8); }
      if (name === "blade") { noise(0.16, 2600 * p, 2, 0.7); tone(900 * p, 300, 0.12, 0.2, "triangle"); }
      if (name === "block") { tone(1400 * p, 700, 0.08, 0.3, "square"); noise(0.06, 3000, 3, 0.4); }
      if (name === "whoosh") noise(0.14, 700 * p, 0.7, 0.35, 1);
      if (name === "step") noise(0.05, 300 * p, 1, 0.12);
      if (name === "land") { noise(0.14, 200, 0.8, 0.6); tone(90, 40, 0.16, 0.5); }
      if (name === "thud") { noise(0.24, 150, 0.7, 1); tone(70, 30, 0.3, 0.9); }
      if (name === "launch") { tone(220 * p, 520, 0.18, 0.3, "triangle"); }
      if (name === "fire") { noise(0.3, 500 * p, 0.6, 0.6, 1.2); tone(180 * p, 90, 0.25, 0.25, "sawtooth"); }
      if (name === "cast") { noise(0.18, 1400 * p, 1.5, 0.4, 1); tone(500 * p, 900, 0.12, 0.15, "triangle"); }
      if (name === "ice") { tone(2400 * p, 1200, 0.12, 0.2, "square"); noise(0.25, 4000 * p, 4, 0.5, 2); }
      if (name === "bat") { noise(0.08, 2200 * p, 3, 1.0, 3); tone(700 * p, 180, 0.1, 0.4, "square"); }
      if (name === "blink") { tone(1200 * p, 200, 0.16, 0.25, "sine"); noise(0.12, 2500, 2, 0.3); }
      if (name === "super") { tone(110, 880, 0.5, 0.5, "sawtooth"); noise(0.5, 800, 0.5, 0.6, 1); }
      if (name === "boom") { noise(0.5, 120, 0.6, 1.4, 1.5); tone(60, 25, 0.6, 1.0); }
    };
    return { start: ctx, play };
  })();

  // ---------- Input ----------
  const KEYMAP = { u: "1", i: "2", j: "3", k: "4", 1: "1", 2: "2", 3: "3", 4: "4" };
  window.addEventListener("keydown", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Tab"].includes(e.key)) e.preventDefault();
    try { Sfx.start(); } catch (err) { /* audio unavailable */ }
    if (e.repeat) return;
    lab.keys[k] = true;
    if (KEYMAP[k]) { lab.press[KEYMAP[k]] = true; return; }
    if (k === "y") lab.meterFull = !lab.meterFull;
    if (k === "q") T3S.setQuality(S, !S.high);
    if (k === "Tab" || k === "]") { lab.pc = (lab.pc + (e.shiftKey ? ORDER.length - 1 : 1)) % ORDER.length; player.setChar(ORDER[lab.pc]); place(); buildMoves(); }
    if (k === "[") { lab.pc = (lab.pc + ORDER.length - 1) % ORDER.length; player.setChar(ORDER[lab.pc]); place(); buildMoves(); }
    if (k === "'") { lab.dc = (lab.dc + 1) % ORDER.length; dummy.setChar(ORDER[lab.dc]); place(); }
    if (k === "g") { const modes = ["none", "stand", "crouch", "random"]; lab.guard = modes[(modes.indexOf(lab.guard) + 1) % modes.length]; }
    if (k === "r") place();
    if (k === "p") lab.paused = !lab.paused;
    if (k === "o") lab.slow = !lab.slow;
    if (k === ".") { lab.paused = true; tick(STEP); }
    if (k === "m") document.getElementById("moves").classList.toggle("hidden");
    if (k === "h") document.getElementById("help").classList.toggle("hidden");
    if (k === "v") { lab.pixel = !lab.pixel; S.pixel = lab.pixel ? 2 : 1; S.resize(); }
    if (k === "n") lab.sound = !lab.sound;
  });
  window.addEventListener("keyup", (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; lab.keys[k] = false; });
  window.addEventListener("blur", () => { lab.keys = {}; });
  window.addEventListener("resize", () => S.resize());

  // Directions relative to the fighter: forward is toward the opponent on screen; up is into the screen.
  function relInput(f, opp) {
    const a = f.pos.clone(), b = opp.pos.clone(); a.project(S.camera); b.project(S.camera);
    const toRight = b.x >= a.x, K = lab.keys;
    const right = !!K.ArrowRight, left = !!K.ArrowLeft;
    return { f: toRight ? right : left, b: toRight ? left : right, u: !!K.ArrowUp, d: !!K.ArrowDown, shift: !!K.Shift };
  }
  // Which way is "toward the camera" for each fighter's right side (sidesteps and sidewalks follow the screen).
  function camSide(f) { const cd = V3().subVectors(S.camera.position, f.pos); return Math.sign(f.right.dot(cd)) || 1; }

  // ---------- Effects from fighter events ----------
  const SND = { cyborg: "blade", bluex: "bat", voss: "heavy", barbarian: "ice", flame: "fire", dancer: "hit" };
  function startSuper(f, m) {
    const c = m.cine || { dur: 1.8 };
    T3S.cinematic(S, f, c.dur, c); T3S.setMood(S, 1); lab.cineOn = true;
    lab.banner = { text: m.name.replace(/ \(super\)/, ""), t: 2.2 };
  }
  function handleEvents(f, opp) {
    const col = f.def.color || 0xffffff, kind = f.def.fx;
    for (const e of f.events) {
      if (f === player && (e.type === "hit" || e.type === "block")) { const st = lab.stats; st[e.type]++; if (e.type === "hit" && (opp.state === "juggle" || opp.state === "down" || opp.held)) st.air++; st.log.push(e.m.id + ":" + e.type + ":" + opp.state); }
      if (e.type === "hit") {
        const h = e.hit, big = ["launch", "knockdown", "crumple", "stagger", "sweep", "bound", "blast", "spin", "freeze", "cine"].includes(h.react) ? 2 : h.react === "heavy" ? 1 : 0;
        lab.hitstop = Math.max(lab.hitstop, [0.05, 0.085, 0.12][big] + (e.counter ? 0.03 : 0) + (h.react === "blast" ? 0.08 : 0));
        S.shake = Math.max(S.shake, [0.015, 0.03, 0.05][big] + (h.react === "blast" ? 0.04 : 0)); S.zoomK = Math.max(S.zoomK, 0.4 + big * 0.3);
        const fxKind = e.proj ? (f.id === "flame" ? "fire" : f.id === "barbarian" ? "ice" : kind) : (h.point === "wpn" || h.point === "butt" || h.point === "path" || h.auto ? kind : f.id === "flame" ? "fire" : f.id === "dancer" ? "gold" : "impact");
        T3S.sparks(S, e.at, col, 8 + big * 6, 1 + big * 0.3, fxKind);
        Sfx.play(e.proj && f.id === "flame" ? "fire" : (h.point === "wpn" || h.auto) && f.rig.weaponName ? SND[f.id] : big ? "heavy" : "hit", big);
        if (h.react === "launch") Sfx.play("launch");
        if (h.react === "blast") { Sfx.play("boom"); S.zoomK = 1.6; }
        if (h.react === "cine" && f.state === "act" && f.action.m.super) startSuper(f, f.action.m);
        if (f === player) { lab.combo.n = opp.juggle > 0 || lab.combo.t > 0 ? lab.combo.n + 1 : 1; lab.combo.dmg = (lab.combo.t > 0 ? lab.combo.dmg : 0) + e.dmg; lab.combo.t = 1.1; lab.combo.counter = e.counter; }
      }
      if (e.type === "block") { lab.hitstop = Math.max(lab.hitstop, 0.04); T3S.sparks(S, e.at, 0x7ce3ff, 6, 0.8, "spark"); Sfx.play("block"); }
      if (e.type === "move") { lab.info = { m: e.m, who: f }; Sfx.play(e.m.super ? "super" : "whoosh"); if (e.m.super) lab.banner = { text: "SUPER", t: 0.6 }; }
      if (e.type === "step" && f.walkVel && f.walkVel.length() > 0.6) Sfx.play("step");
      if (e.type === "dash" || e.type === "sidestep") { T3S.dust(S, f.pos, 4); Sfx.play("whoosh"); }
      if (e.type === "land") { T3S.dust(S, f.pos, 6); Sfx.play("land"); }
      if (e.type === "thud") {
        T3S.dust(S, f.pos, e.soft ? 5 : 10, !e.soft); S.shake = Math.max(S.shake, e.soft ? 0.01 : e.bound ? 0.06 : 0.03); Sfx.play(e.bound ? "boom" : "thud");
        if (e.bound) T3S.shockwave(S, f.pos, 0xffd9a0, 2.5);
      }
      if (e.type === "fx") { T3S.burst(S, e.at, e.color || col, e.power || 1, e.kind || kind); if (e.kind === "fire") Sfx.play("cast"); }
      if (e.type === "spawn") { Sfx.play(e.kind === "ball" ? "bat" : e.kind === "axe" ? "whoosh" : e.kind === "spikes" ? "ice" : "cast"); if (e.kind === "spikes" || e.kind === "pillar") T3S.shockwave(S, e.at, col, 1.2); }
      if (e.type === "projEnd") T3S.burst(S, e.at, col, 0.8, e.kind === "spikes" ? "ice" : f.id === "flame" ? "fire" : kind);
      if (e.type === "blink") { T3S.dust(S, e.from, 6); T3S.burst(S, e.to.clone().setY(1), col, 1.2, kind); Sfx.play("blink"); }
      if (e.type === "freeze") { T3S.sparks(S, f.rig.bones.chest.getWorldPosition(V3()), 0x9fe6ff, 6, 1.4, "ice"); Sfx.play("ice"); }
      if (e.type === "shatter") { T3S.sparks(S, f.rig.bones.chest.getWorldPosition(V3()), 0xe8fbff, 16, 2.2, "ice"); Sfx.play("ice"); }
      if (e.type === "cam") {
        if (e.kind === "superFlash") { flash(col); S.zoomK = 1.2; }
        if (e.kind === "superHit") { flash(0xffffff); S.shake = 0.08; S.zoomK = 2; lab.hitstop = Math.max(lab.hitstop, 0.2); }
        if (e.kind === "shake") S.shake = Math.max(S.shake, e.power || 0.04);
      }
    }
  }
  function flash(color) {
    const el = document.getElementById("flash"); if (!el) return;
    el.style.background = "#" + new THREE.Color(color).getHexString();
    el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
  }

  // ---------- Dummy ----------
  function dummyThink() {
    const g = lab.guard;
    if (g === "none") dummy.guard = null;
    else if (g === "stand") dummy.guard = "stand";
    else if (g === "crouch") dummy.guard = "crouch";
    else if (g === "random") {
      // A new guard each time the player starts an attack.
      if (player.attacking && player.action !== lab.lastAtk) { lab.lastAtk = player.action; dummy.guard = Math.random() < 0.5 ? "stand" : "crouch"; }
    }
    const crouchHold = dummy.guard === "crouch";
    dummy.handleInput({ f: false, b: false, u: false, d: crouchHold, shift: false, press: {} }, player);
    // Hold a crouch at once (no sidestep tap) by pretending the key has been down a while.
    if (crouchHold) dummy.dHeld = dummy.t - 1;
  }

  // ---------- The step ----------
  function tick(dt) {
    lab.t += dt;
    player.camSide = camSide(player); dummy.camSide = camSide(dummy);
    if (lab.script && lab.hitstop <= 0) runScript(dt);
    const inp = Object.assign(relInput(player, dummy), { press: lab.press, t: lab.t });
    if (lab.inject) { Object.assign(inp, lab.inject); lab.inject = null; }
    lab.press = {};
    if (lab.hitstop > 0) {
      // Hit-stop: both fighters freeze for a few frames; inputs still buffer into strings.
      lab.hitstop -= dt;
      if (Object.keys(inp.press).length) player.handleInput(inp, dummy);
    } else {
      player.handleInput(inp, dummy);
      dummyThink();
      player.update(dt, dummy); dummy.update(dt, player);
      handleEvents(player, dummy); handleEvents(dummy, player);
    }
    if (lab.combo.t > 0 && dummy.state !== "juggle" && dummy.state !== "down" && !dummy.held) lab.combo.t -= dt;
    if (lab.meterFull && player.state === "free") player.meter = 100;
    if (lab.cineOn && !S.cine) { lab.cineOn = false; T3S.setMood(S, 0); }
    if (lab.banner) { lab.banner.t -= dt; if (lab.banner.t <= 0) lab.banner = null; }
    player.visuals(lab.hitstop > 0 ? 0 : dt, lab.t); dummy.visuals(lab.hitstop > 0 ? 0 : dt, lab.t);
    T3S.updateCamera(S, player.pos.clone().setY(player.y), dummy.pos.clone().setY(dummy.y), dt);
    T3S.stepSparks(S, dt);
    if (dummy.state === "free" && dummy.hp < dummy.hpMax && lab.combo.t <= 0) dummy.hp = Math.min(dummy.hpMax, dummy.hp + dt * 60);
  }

  // Scripted demos (move list buttons and tests): a list of [wait seconds or "able", input] steps.
  function runScript(dt) {
    const s = lab.script;
    s.wait -= dt;
    while (s.i < s.steps.length) {
      const st = s.steps[s.i];
      if (st.when === "able" ? !player.canAct() : st.when === "move" ? !(player.action && player.action.m && player.action.m.id === st.id && player.action.t >= st.at) : s.wait > 0) break;
      lab.inject = Object.assign({ press: {} }, st.input);
      s.wait = st.after !== undefined ? st.after : 0;
      s.i++;
      break;
    }
    if (s.i >= s.steps.length && s.wait <= 0) lab.script = null;
  }
  // Turn notation into injected inputs: "df+2" holds df for one frame and presses 2; "f,f+2" taps f twice.
  function inputsFor(cmd) {
    const p = T3Moves.parse(cmd), out = [];
    const dirInp = (d) => ({ f: d.includes("f"), b: d.includes("b"), u: d.includes("u"), d: d.includes("d") });
    if (p.seq.length > 1) { for (const d of p.seq) { out.push({ input: dirInp(d), after: 0.03 }); out.push({ input: {}, after: 0.03 }); } out.pop(); }
    const last = p.seq.length ? dirInp(p.seq[p.seq.length - 1]) : {};
    const press = {}; for (const b of p.btn) press[b] = true;
    out.push({ input: Object.assign({}, last, { press }), after: 0.02 });
    return out;
  }
  function demoMove(id) {
    const m = player.list.moves[id];
    lab.script = { i: 0, wait: 0, steps: inputsFor(m.cmd).map((s, i) => (i === 0 ? Object.assign({ when: "able" }, s) : s)) };
  }
  function demoString(s) {
    const steps = [];
    s.inputs.forEach((cmd, i) => {
      const ins = inputsFor(cmd);
      // Each next button is pressed while the previous step is playing, a little before its hit lands
      // (inside the chain window), the way a player presses in rhythm.
      if (i === 0) ins[0] = Object.assign({}, ins[0], { when: "able" });
      else { const prev = player.list.moves[s.steps[i - 1]]; ins[0] = Object.assign({}, ins[0], { when: "move", id: prev.id, at: Math.max(0.07, (prev.cancel || prev.dur) - 0.1) }); }
      steps.push(...ins);
    });
    lab.script = { i: 0, wait: 0, steps };
  }
  function demoJuggle(j) {
    if (j.pre !== undefined) {
      // Open with a string (rhythm presses), then each juggle step when able.
      demoString(player.list.strings[j.pre]);
      const steps = lab.script.steps;
      j.steps.forEach((id) => { const ins = inputsFor(player.list.moves[id].cmd); ins[0] = Object.assign({}, ins[0], { when: "able" }); steps.push(...ins); });
      return;
    }
    const steps = [];
    j.steps.forEach((id, i) => {
      const m = player.list.moves[id], ins = inputsFor(m.cmd);
      ins[0] = Object.assign({}, ins[0], { when: "able" });
      steps.push(...ins);
    });
    lab.script = { i: 0, wait: 0, steps };
  }

  // ---------- HUD ----------
  const $ = (id) => document.getElementById(id);
  function hud() {
    $("n1").textContent = player.def.name; $("n2").textContent = dummy.def.name + "  (dummy)";
    $("h1").style.width = (100 * player.hp / player.hpMax) + "%"; $("g1").style.width = (100 * player.hp / player.hpMax) + "%";
    $("h2").style.width = (100 * dummy.hp / dummy.hpMax) + "%"; $("g2").style.width = (100 * dummy.hp / dummy.hpMax) + "%";
    $("m1").style.width = (player.meter || 0) + "%"; $("m2").style.width = (dummy.meter || 0) + "%";
    $("m1").classList.toggle("full", player.meter >= 100); $("m2").classList.toggle("full", dummy.meter >= 100);
    $("banner").textContent = lab.banner ? lab.banner.text : ""; $("banner").classList.toggle("on", !!lab.banner);
    const c = lab.combo;
    $("combo").innerHTML = c.t > 0 && c.n > 1 ? `${c.n} HITS<small>${c.dmg} damage${c.counter ? " · counter hit" : ""}</small>` : c.t > 0 && c.counter ? `COUNTER<small>${c.dmg} damage</small>` : "";
    if (lab.info && lab.info.who === player) {
      const m = lab.info.m, fd = m.frames;
      const lv = (m.level || "").split(",").map((l) => `<span class="lv ${l}">${l}</span>`).join("");
      $("info").innerHTML = `<b>${m.name}</b> &nbsp; ${m.cmd || "(string step)"} &nbsp; ${lv}<br>` + (fd ? `startup ${fd.startup}f · active ${fd.active}f · recovery ${fd.recovery}f · damage ${m.dmgTotal || 0}` : "");
    }
    const state = (f) => f.state + (f.action ? ":" + (f.action.m ? f.action.m.id : f.action.kind) : "") + (f.crouching ? " crouching" : "") + (f.airborne ? " airborne" : "");
    $("status").innerHTML = `dummy guard <b>${lab.guard}</b> (G) · ${lab.paused ? "PAUSED · " : ""}${lab.slow ? "slow · " : ""}${lab.pixel ? "PS1 pixels" : "full res"} (V) · ${S.high ? "high" : "low"} quality (Q)<br>you: ${state(player)} · dummy: ${state(dummy)}`;
  }
  function buildMoves() {
    const L = player.list, el = $("moves");
    const fd = (m) => (m.frames ? `i${m.frames.startup}` : "");
    const row = (id) => {
      const m = L.moves[id];
      const lv = (m.level || "").split(",").map((l) => `<span class="lv ${l}">${l}</span>`).join("");
      return `<div class="row${m.super ? " sup" : ""}"><button data-move="${id}" title="Demo">&#9654;</button><span class="cmd">${m.cmd}</span><span>${m.name}</span><span>${lv}</span><span class="fd">${fd(m)}</span></div>`;
    };
    const special = (m) => m.super || m.events && m.events.length || m.hits.some((h) => ["launch", "bound", "crumple", "spin", "freeze", "blast"].includes(h.react)) || m.hits.length > 1;
    let html = `<h2>${player.def.name}</h2><div style="color:var(--dim)">${player.def.title}</div>`;
    const sup = L.order.filter((id) => L.moves[id].super);
    if (sup.length) html += `<h3>Super (full meter)</h3>` + sup.map(row).join("");
    html += `<h3>Specials</h3>` + L.order.filter((id) => !L.moves[id].super && special(L.moves[id])).map(row).join("");
    html += `<h3>Basic strikes</h3>` + L.order.filter((id) => !special(L.moves[id])).map(row).join("");
    html += `<h3>Strings</h3>`;
    L.strings.forEach((s, i) => { html += `<div class="row str"><button data-str="${i}" title="Demo">&#9654;</button><div><span class="cmd">${s.inputs.join(", ")}</span><div class="sub">${s.name} · ${s.hits} hits · ${s.levels} · ${s.dmg} damage</div></div></div>`; });
    html += `<h3>Juggles</h3>`;
    L.juggles.forEach((j, i) => { html += `<div class="row str"><button data-jug="${i}" title="Demo">&#9654;</button><div><span class="cmd">${j.notation}</span><div class="sub">${j.name}</div></div></div>`; });
    if (L.notes.length) html += `<h3>Notes</h3><div class="sub">${L.notes.join("<br>")}</div>`;
    html += `<h3>Movement</h3><div style="color:var(--dim)">f walk · b walk back and guard · f,f dash · b,b backdash · tap u or d sidestep into or out of the screen · hold d crouch · hold db crouch guard · hold u jump (uf, ub) · Shift + arrows 8-way walk · d,df,f = quarter circle forward</div>`;
    el.innerHTML = html;
  }
  $("moves").addEventListener("mousedown", (e) => e.preventDefault());
  $("moves").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.move) demoMove(b.dataset.move);
    if (b.dataset.str) demoString(player.list.strings[+b.dataset.str]);
    if (b.dataset.jug) demoJuggle(player.list.juggles[+b.dataset.jug]);
  });
  $("help").innerHTML = `<b>3D Lab</b> (test page)<br>
    <kbd>&larr;</kbd><kbd>&rarr;</kbd> walk, tap twice to dash · <kbd>&uarr;</kbd><kbd>&darr;</kbd> tap to sidestep, hold <kbd>&darr;</kbd> to crouch, hold <kbd>&uarr;</kbd> to jump · <kbd>Shift</kbd> + arrows 8-way walk<br>
    <kbd>U</kbd><kbd>I</kbd><kbd>J</kbd><kbd>K</kbd> or <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> = left punch, right punch (weapon), left kick, right kick<br>
    <kbd>Tab</kbd> next fighter · <kbd>'</kbd> next dummy · <kbd>G</kbd> dummy guard · <kbd>M</kbd> move list · <kbd>R</kbd> reset<br>
    <kbd>P</kbd> pause · <kbd>.</kbd> step · <kbd>O</kbd> slow motion · <kbd>V</kbd> pixels · <kbd>N</kbd> sound · <kbd>H</kbd> help<br>
    Super: <kbd>df</kbd>+<kbd>1</kbd>+<kbd>2</kbd> with a full meter · <kbd>Y</kbd> keep the meter full (on) · <kbd>Q</kbd> quality (shadows and lights)`;
  buildMoves();

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!lab.paused) {
      lab.acc += dt * (lab.slow ? 0.25 : 1) * (S.cine ? 0.75 : 1);
      while (lab.acc >= STEP) { tick(STEP); lab.acc -= STEP; }
    }
    hud();
    S.renderer.render(S.scene, S.camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Test hooks.
  window.T3L = {
    lab, S, player, dummy, ORDER,
    run(n, input) { for (let i = 0; i < n; i++) { if (input) Object.assign(lab.keys, input); tick(STEP); } if (input) for (const k in input) lab.keys[k] = false; },
    press(btn) { lab.press[btn] = true; },
    setChar(i, j) { lab.pc = i; player.setChar(ORDER[i]); if (j !== undefined) { lab.dc = j; dummy.setChar(ORDER[j]); } place(); buildMoves(); },
    demoMove, demoString, demoJuggle, place, inputsFor,
    render() { S.renderer.render(S.scene, S.camera); },
  };
})();
