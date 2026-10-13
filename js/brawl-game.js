// Brawl game flow: runs a fight of the fighting mode (vs a bot or online), draws it
// with the shared Renderer, and owns its HUD, result screen and round loop. The rules are in js/brawl.js, the
// devices in js/brawl-input.js. This file shares main.js's globals (renderer, online, run, settings, modals,
// Sfx, toast, showScreen, showBanner ...) and is loaded before it, so it only touches them while running.
const BrawlGame = (() => {
  const B = CONFIG.brawl, STEP = B.step, FXC = CONFIG.theme.fx;
  const G = {
    active: false, mode: "bot", s: null, ai: null, acc: 0, side: 0,        // side: the seat of the human on this screen (online guest = 1)
    chars: ["cyborg", "ronin"], prev: null, dead: [false, false], taunted: [false, false],
    fx: [], shake: 0, flash: 0, hitstop: 0, ghost: [100, 100], names: ["YOU", "BOT"],
    remoteMask: 0, lastSent: -1, sentAt: 0, snapN: 0, snapEv: [], base: null, snapAt: 0, resultShown: false, over: false, count: -1, handled: false,
    endAt: 0,
  };
  const view = { arenaWidth: B.arena.width, cameraX: B.arena.width / 2, floorY: B.floorY, enemies: [], fx: [], shake: 0, flash: 0, phase: "fight", fighters: [], puppetHits: false };
  const $b = (id) => document.getElementById(id);
    const DRAW_SOUND = { daggerLash: "whip", cyberSword: "slash", katana: "slash", bat: "bat", staff: "staff", axe: "axe", reaverAxe: "axe", warHammer: "hammer", pistols: "gun" };
  const rgb = (hex) => { const n = parseInt(String(hex).slice(1), 16); return `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`; };
  const defOf = (key) => Chars.DEFS[key] || Chars.DEFS[Chars.ORDER[0]];
  const hitSound = (side) => DRAW_SOUND[defOf(G.chars[side]).weaponDraw] || "punch";
  const trailOf = (side) => (B.chars[G.chars[side]] || B.chars.cyborg).trail;

  // ---------- The fighters: the designed 2D fighters (js/duel-chars.js), driven by the rules ----------
  // The rules decide where a fighter is and what it is doing; each fighter's own animations play to match, started at the
  // frame the rules start the move and timed to the same length (the frame data is read from those same animations).
  const stage = new DuelChars.Stage({ audible: true });
  const blank = () => ({ st: "ground", mv: null, fr: 0, dash: 0, y: 0 });
  function setupStage() {
    const cols = colors();
    stage.setPuppets(G.chars.map((k, i) => ({ key: k, x: B.startX[i], facing: i ? -1 : 1, seed: 7 + i, glow: rgb(cols[i]) })));
    stage.judge = null;
    stage.after = (p, i, ch) => {
      const f = G.s && G.s.f[i];
      if (!f) return;
      ch.x = f.x;
      if (f.y > 0.5) { ch.state = "air"; ch.jumpY = f.y; ch.vy = f.vy; }
    };
    G.prev = [blank(), blank()]; G.dead = [false, false]; G.taunted = [false, false];
  }
  // Fed to the fighters each fixed step: walking and crouching, and the jump kept in step with the rules.
  function puppetInputs() {
    return stage.p.map((p, i) => {
      const f = G.s.f[i], ch = p.ch;
      if (f.y > 0.5) {
        if (ch.state !== "air") { ch.state = "air"; ch.airT = 0; ch.cut = true; ch.xfade(0.1); }
        ch.jumpY = f.y + 12; ch.vy = f.vy;
      } else if (ch.state === "air" || ch.state === "prejump") {
        ch.state = "ground"; ch.jumpY = 0; ch.vy = 0; ch.airAttacked = false; ch.cut = false; ch.crouchV += 3;
        if (ch.action && ch.action.c.air) { ch.action = null; ch.xfade(0.1); }
      }
      const walking = f.st === "ground" && !f.dash && !f.lag && Math.abs(f.vx) > 20;
      return { move: walking ? Math.sign(f.vx) : 0, crouch: f.crouch && f.y <= 0.5 && f.st !== "attack" };
    });
  }
  function play(p, name, frames) {
    const ch = p.ch, c = ch.clips[name];
    if (!c) return false;
    ch.queue = []; ch.comboName = null; ch.buffer = null;
    if (c.air) ch.airAttacked = true;
    // action.speed = speed / tempo, and an animation lasts dur / action.speed: ask for `frames` frames.
    ch.startAction(c, frames ? c.dur * ch.St.tempo * 60 / frames : 1);
    return true;
  }
  // Called after every rules step (and for the guest every frame): starts the animation that matches what just began.
  function drive(s) {
    s.f.forEach((f, i) => {
      const p = stage.p[i], ch = p.ch, pv = G.prev[i];
      if (f.st === "attack" && (pv.st !== "attack" || pv.mv !== f.mv || f.fr < pv.fr)) {
        const info = Brawl.moveInfo(G.chars[i], f.mv, f.lvl);
        const c = ch.clips[info.clip] || ch.clips.a1;
        if (c) { ch.queue = []; ch.comboName = null; ch.buffer = null; if (c.air) ch.airAttacked = true; ch.startAction(c, info.spd); }
      } else if (f.st === "hit" && (pv.st !== "hit" || f.fr < pv.fr) && f.hp > 0) {
        if (f.kd) play(p, "knockdown", 23 + B.downFrames);
        else play(p, f.stun >= 20 && ch.clips.hitHeavy ? "hitHeavy" : "hit", Math.max(8, f.stun + 2));
      } else if (f.st === "block" && (pv.st !== "block" || f.fr < pv.fr)) {
        play(p, "parry", f.stun + 4);
      } else if (f.st === "down" && !(ch.action && ch.action.c.react) && f.hp > 0) {
        play(p, "knockdown", B.downFrames + 10);
      } else if ((f.st === "ground" || f.st === "air") && pv.st !== f.st && ch.action && !ch.dead && !ch.action.c.idleBreak && (pv.st === "attack" || pv.st === "block" || pv.st === "hit" || pv.st === "down")) {
        ch.action = null; ch.xfade(0.1);
      }
      if (f.dash > 0 && !pv.dash && !ch.action) ch.dash(f.face * f.dd);
      if (s.phase === "over" && f.hp <= 0 && !G.dead[i]) { G.dead[i] = true; const d = ch.clips.death; if (d) { ch.queue = []; ch.startAction(d, 1); } }
      if (s.phase === "over" && f.hp > 0 && s.overFr > 30 && !G.taunted[i] && !ch.action) { G.taunted[i] = true; play(p, "taunt", 0); }
      pv.st = f.st; pv.mv = f.mv; pv.fr = f.fr; pv.dash = f.dash; pv.y = f.y;
    });
  }

  // ---------- HUD ----------
  function buildHud() {
    const el = $b("bhud");
    if (el.dataset.built) return;
    el.dataset.built = "1";
    const side = (i) => `<div class="bh-side ${i ? "right" : "left"}" id="bh${i}"><div class="bh-name"></div>
      <div class="bh-bar"><i class="bh-ghost"></i><i class="bh-fill"></i><b class="bh-hp"></b></div>
      <div class="bh-meter"><i></i><span>SUPER</span></div></div>`;
    el.innerHTML = side(0) + `<div class="bh-mid"><div class="bh-clock" id="bh-clock">0</div><div class="bh-tag" id="bh-tag"></div></div>` + side(1) +
      `<button class="icon-btn bh-pause" data-act="pause" tabindex="-1" aria-label="Pause" title="Pause"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/></svg></button>`;
    // Your identity color follows your seat (the right side when you start on the right).
    if (G.side) { $b("bh0").style.setProperty("--id", "var(--foe)"); $b("bh1").style.setProperty("--id", "var(--you)"); }
  }
  const hudRefs = () => [0, 1].map((i) => { const e = $b("bh" + i); return { name: e.querySelector(".bh-name"), fill: e.querySelector(".bh-fill"), ghost: e.querySelector(".bh-ghost"), hp: e.querySelector(".bh-hp"), meter: e.querySelector(".bh-meter") }; });
  let refs = null;

  function updateHud(dt) {
    const s = G.s;
    if (!refs) refs = hudRefs();
    [0, 1].forEach((i) => {
      const f = s.f[i], r = refs[i], pct = Math.max(0, f.hp) / B.hp * 100;
      G.ghost[i] += (pct - G.ghost[i]) * Math.min(1, dt * 3);
      if (G.ghost[i] < pct) G.ghost[i] = pct;
      r.fill.style.width = pct + "%";
      r.ghost.style.width = G.ghost[i] + "%";
      r.hp.textContent = Math.ceil(Math.max(0, f.hp));
      r.meter.firstChild.style.width = f.meter + "%";
      r.meter.classList.toggle("ready", f.meter >= B.superCost);
      const label = G.names[i] + "  " + defOf(G.chars[i]).name;
      if (r.name.textContent !== label) r.name.textContent = label;
    });
    const left = Brawl.timeLeft(s);
    const clock = left === null ? "" : String(Math.ceil(left));
    if ($b("bh-clock").textContent !== clock) $b("bh-clock").textContent = clock;
    const rules = run && run.rules, tag = rules && rules.rounds > 1 ? `Round ${run.round}/${rules.rounds}, ${run.wins[0]} - ${run.wins[1]}` : "";
    if ($b("bh-tag").textContent !== tag) $b("bh-tag").textContent = tag;
    const cd = $b("countdown");
    if (s.phase === "countdown") {
      const n = Math.ceil(s.cd / 60);
      cd.textContent = n; cd.classList.remove("go");
      if (n !== G.count) { G.count = n; Sfx.play("beep"); }
    } else if (G.count !== 0) { G.count = 0; cd.textContent = "FIGHT"; cd.classList.add("go"); Sfx.play("go"); setTimeout(() => { if (G.count === 0) cd.textContent = ""; }, 700); }
  }

  // ---------- Effects ----------
  const fxPush = (o) => G.fx.push(Object.assign({ age: 0 }, o));
  const spark = (x, z, size, color, life) => fxPush({ type: "spark", x, z, life: life || 0.22, size, color });
  const text = (x, z, str, color, size, life) => fxPush({ type: "text", x, z, life: life || 0.8, text: str, color, size, rise: 40 });

  function onEvent(e) {
    switch (e.type) {
      case "hit": {
        const atk = 1 - e.side, big = e.n >= 8;
        stage.sparks(e.x, -e.y, big ? 14 : 8, trailOf(atk), big ? 1.2 : 0.9);
        text(e.x + (e.side ? 30 : -30), e.y + 40, "-" + e.n, FXC.ult, 24);
        G.shake = Math.max(G.shake, big ? 7 : 3.5); G.hitstop = Math.max(G.hitstop, big ? 4 : 2); Sfx.play(hitSound(atk), big ? 1 : 0); Sfx.play("hurt"); break;
      }
      case "boom": stage.sparks(e.x, -e.y, 16, trailOf(1 - e.side), 1.4); text(e.x + (e.side ? 30 : -30), e.y + 40, "-" + e.n, FXC.ult, 28); fxPush({ type: "ring", x: e.x, z: 0, life: 0.45, color: FXC.counter });
        G.shake = Math.max(G.shake, 9); G.hitstop = Math.max(G.hitstop, 5); Sfx.play("hammer", 1); break;
      case "block": stage.star(e.x, -e.y); text(e.x + (e.side ? 30 : -30), e.y + 30, "BLOCK", FXC.block, 16, 0.5); Sfx.play("parry"); break;
      case "combo": text(e.x, e.y, e.n + " HIT COMBO", FXC.combo, 20, 0.9); Sfx.play("combo", e.n); break;
      case "fin": { const c = Brawl.combosOf(G.chars[e.side])[e.n]; if (c) text(e.x, e.y, c.name.toUpperCase(), FXC.ult, 22, 1.0); G.shake = Math.max(G.shake, 4); break; }
      case "cast": Sfx.play("flame"); break;
      case "super": G.flash = 0.8; G.shake = Math.max(G.shake, 6); Sfx.play("flame", 1); text(e.x, 190, "SUPER", FXC.ult, 30, 0.9); break;
      case "dp": Sfx.play("whoosh", 1); break;
      case "dash": Sfx.play("whoosh", 0); stage.dust(e.x, 5, 30, -Math.sign(e.n || 1), 0.8); break;
      case "wave": break;
      case "clash": stage.sparks(e.x, -e.y, 12, "255, 255, 255", 1); Sfx.play("parry"); break;
      case "jump": Sfx.play("step"); break;
      case "land": fxPush({ type: "ring", x: e.x, z: 0, life: 0.3, color: FXC.block }); break;
      case "thud": Sfx.play("thud"); fxPush({ type: "ring", x: e.x, z: 0, life: 0.45, color: FXC.hit }); break;
      case "ko": text(B.arena.width / 2, 150, "K.O.", FXC.counter, 54, 1.4); G.flash = 1; G.shake = 14; Sfx.play("ko"); break;
      case "time": text(B.arena.width / 2, 150, "TIME", FXC.counter, 44, 1.4); Sfx.play("ko"); break;
      default: break;
    }
  }

  // ---------- Start, stop, rounds ----------
  function colors() { return [G.side === 0 ? CH.you.body : CH.foe.body, G.side === 0 ? CH.foe.body : CH.you.body]; }

  // opts: { mode: "bot" | "online", bot (index), side (online: 0 host, 1 guest), names, seed, chars: [left fighter, right fighter] }
  function begin(opts) {
    G.mode = opts.mode; G.side = opts.side || 0;
    G.botIdx = opts.bot !== undefined ? opts.bot : (G.botIdx || B.defaultBot);
    G.names = opts.names || (G.mode === "bot" ? (G.side ? [B.bots[G.botIdx].name, "YOU"] : ["YOU", B.bots[G.botIdx].name]) : ["YOU", "OPPONENT"]);
    G.seed = opts.seed >>> 0;
    G.chars = (opts.chars || ["cyborg", "ronin"]).map((k) => (Chars.DEFS[k] ? k : Chars.ORDER[0]));
    G.active = true;
    ui.classList.add("brawl"); ui.classList.remove("idle"); document.body.classList.add("brawl-on");
    ui.dataset.game = "brawl";
    buildHud();
    refs = null;
    BrawlInput.setHand(settings.hand);
    BrawlInput.showTouch(BrawlInput.isTouchDevice());
    BrawlInput.setLayout(settings.hand);
    BrawlInput.clear();
    BrawlInput.setPause(() => { if (!modals.length) act("pause"); });
    newRound(G.seed);
    showScreen(null);
    ui.classList.remove("idle");
  }
  function newRound(seed) {
    const rules = run.rules;
    G.s = Brawl.create(seed, { timer: rules.timer, chars: G.chars });
    G.ai = G.mode === "bot" ? Brawl.newAi(B.bots[G.botIdx]) : null;
    G.acc = 0; G.fx = []; G.shake = 0; G.flash = 0; G.hitstop = 0; G.ghost = [100, 100]; G.count = -1;
    G.base = null; G.snapEv = []; G.snapN = 0; G.remoteMask = 0; G.lastSent = -1; G.resultShown = false; G.over = false; G.endAt = 0; G.handled = false;
    cancelRoundTimer(); hideBanner();
    $b("countdown").textContent = ""; $b("countdown").classList.remove("go");
    renderer.wordPlates = false; renderer.chars = null;
    setupStage();
  }
  function stop() {
    if (!G.active) return;
    G.active = false;
    ui.classList.remove("brawl"); document.body.classList.remove("brawl-on");
    delete ui.dataset.game;
    BrawlInput.showTouch(false);
    BrawlInput.setPause(null);
    cancelRoundTimer(); hideBanner();
    $b("countdown").textContent = "";
    renderer.wordPlates = viewMode === "overhead";
    applyLooks();
    ui.classList.toggle("idle", true);
  }

  // The human's side wins or loses; main.js asks this for the banner text.
  function seatWon(w) { return w === G.side; }

  function roundOver() {
    const w = G.s.winner;
    run.wins[w]++; run.round++;
    const st = Modes.status(run.rules, run.wins);
    run.over = st.over;
    if (!st.over) {
      const mine = seatWon(w);
      showBanner(mine === null ? G.names[w] + " WINS THE ROUND" : mine ? "YOU WIN THE ROUND" : "YOU LOSE THE ROUND", `${run.wins[0]} - ${run.wins[1]}`);
      Sfx.play(mine === false ? "lose" : "win");
      if (G.mode === "online") { if (online.role === "host") roundTimer = setTimeout(() => { if (online.connected) hostStartOnline(true); }, MODE.roundGap * 1000); }
      else roundTimer = setTimeout(() => { newRound((Math.random() * 1e9) | 0); }, MODE.roundGap * 1000);
      return;
    }
    if (G.mode === "online" && online.role === "host") online.net.send(Protocol.result(w, G.s.fr / 60, { wins: run.wins.slice(), game: "brawl" }));
    showResult();
  }

  function showResult() {
    hideBanner();
    G.resultShown = true;
    const w = run.rules.rounds > 1 || run.over ? Modes.status(run.rules, run.wins).winner : G.s.winner;
    G.matchWinner = w === null || w === undefined ? G.s.winner : w;
    showScreen("bresult");
    renderResult();
    Sfx.play(seatWon(G.matchWinner) === false ? "lose" : "win");
  }
  function renderResult() {
    const w = G.matchWinner, mine = seatWon(w), sBox = $b("scr-bresult");
    const title = mine === null ? G.names[w] + " WINS" : mine ? "YOU WIN" : "YOU LOSE";
    const how = G.s.byTime ? "Time up" : "K.O.";
    const sub = run.rules.rounds > 1 ? `${run.wins[0]} - ${run.wins[1]} over ${run.round - 1} rounds` : `${how} after ${(G.s.fr / 60).toFixed(1)} s`;
    const stats = [0, 1].map((i) => `<div class="rcol panel" style="--id:var(${i === G.side ? "--you" : "--foe"})"><h3>${G.names[i]}</h3><dl>
      <dt>HP left</dt><dd>${Math.ceil(G.s.f[i].hp)}</dd><dt>Damage dealt</dt><dd>${G.s.dealt[i]}</dd><dt>Special meter</dt><dd>${Math.round(G.s.f[i].meter)}%</dd></dl></div>`).join("");
    const online_ = G.mode === "online";
    const rematchLabel = online_ ? (online.localRematch ? "Waiting" : "Rematch") : "Again";
    sBox.innerHTML = `<div id="bko" class="panel"><div class="ko-title ${mine === false ? "lose" : "win"}">${title}</div><div class="ko-sub">${sub}${online_ ? ", unranked online" : ""}</div></div>
      <div class="bcols">${stats}</div>
      <div class="btn-row">${btn("rematch", rematchLabel, "Enter", online_ && online.localRematch ? "" : "primary")}${btn("menu", online_ ? "Leave" : "Main menu", "Esc")}</div>` +
      (online_ ? `<p class="modal-note">${online.remoteRematch ? "Your opponent wants a rematch." : "Press Rematch when you are ready."}</p>` : "");
    keyline([keyBtn("settings", "S", "settings"), keyBtn("fullscreen", "F", "fullscreen")]);
  }

  // ---------- The frame ----------
  function viewFighters(s, cols) {
    return s.f.map((f, i) => ({
      x: f.x, z: f.y, facing: f.face, state: f.st === "down" ? "down" : "idle", move: null, moveT: 0, moveCount: 0,
      color: cols[i], weaponLook: null, flashT: f.flash > 0 ? 1 : 0, team: i === 0 ? "player" : "enemy", dead: false,
    }));
  }

  function stepHuman() {
    const s = G.s;
    const mine = BrawlInput.mask();
    let m0 = mine, m1;
    if (G.mode === "bot") {
      const bot = 1 - G.side, bm = Brawl.botInput(s, bot, G.ai);   // you sit on the left or the right (Settings > Starting side)
      if (G.side) { m0 = bm; m1 = mine; } else m1 = bm;
    } else m1 = G.remoteMask;
    Brawl.step(s, m0, m1);
    const evs = Brawl.drain(s);
    drive(s);
    evs.forEach(onEvent);
    if (G.mode === "online") {
      G.snapEv.push(...evs);
      if (++G.snapN % 2 === 0 || s.phase === "over") {
        online.net.send(Protocol.state(G.snapN, Brawl.snapshot(s, G.snapEv), online.mid));
        G.snapEv = [];
      }
    }
  }

  function frameHost(dt) {
    G.acc += dt;
    let n = 0;
    while (G.acc >= STEP && n < 4) {
      G.acc -= STEP; n++;
      if (G.hitstop > 0 && G.s.phase === "fight") { G.hitstop--; continue; }
      stepHuman();
    }
    if (G.acc > STEP * 4) G.acc = 0;
    if (G.s.phase === "over") G.over = true;
    if (G.over && !G.handled && G.s.overFr >= B.overFrames) { G.handled = true; roundOver(); }
  }

  // The guest never judges: it draws the host's last snapshot, played forward a few frames so motion stays smooth,
  // and sends its own buttons to the host.
  function frameGuest(dt) {
    const m = BrawlInput.mask(), now = performance.now();
    if (m !== G.lastSent || now - G.sentAt > 250) {
      G.lastSent = m; G.sentAt = now; G.guestSeq = (G.guestSeq || 0) + 1;
      online.net.send(Protocol.bin(G.guestSeq, m));
    }
    if (!G.base) return;
    const ahead = Math.max(0, Math.min(8, Math.floor((now - G.snapAt) / (STEP * 1000))));
    const c = Brawl.clone(G.base);
    for (let i = 0; i < ahead; i++) { if (c.phase === "over") break; Brawl.step(c, c.in[0], c.phase === "fight" ? m : 0); }
    c.ev = [];
    G.s = c;
    drive(c);
    if (G.s.phase === "over" && !G.over) { G.over = true; }
    if (G.over && !G.resultShown && !G.handled && G.s.overFr >= B.overFrames) {
      // The host decides what comes next: a new round arrives as a start message, the end of the match as a result message.
      G.handled = true;
      const mine = G.s.winner === G.side;
      showBanner(mine ? "YOU WIN THE ROUND" : "YOU LOSE THE ROUND", "next round starting");
      Sfx.play(mine ? "win" : "lose");
    }
  }

  function frame(dt) {
    if (!G.s) return;
    const frozen = paused();
    if (!frozen) {
      if (G.mode === "online" && online.role === "guest") frameGuest(dt);
      else if (!G.resultShown) frameHost(dt);
    }
    // Draw.
    const s = G.s, cols = colors();
    G.fx.forEach((o) => { o.age += frozen ? 0 : dt; });
    G.fx = G.fx.filter((o) => o.age < o.life);
    G.shake *= Math.pow(0.002, frozen ? 0 : dt);
    G.flash = Math.max(0, G.flash - (frozen ? 0 : dt * 2.5));
    view.fighters = viewFighters(s, cols);
    const orbs = s.pr.map((q) => ({ type: "orb", x: q.x, z: q.y, age: 0, life: 1, size: q.big ? 34 : 14 + 3 * q.lvl, dir: q.vx >= 0 ? 1 : -1, color: `rgb(${trailOf(q.o)})` }));
    view.fx = G.fx.concat(orbs);
    view.shake = G.shake; view.flash = G.flash;
    const stageDt = frozen || G.hitstop > 0 ? 0 : dt;
    view.puppets = (ctx, sx, floorY, d, copt) => {
      stage.advance(stageDt, puppetInputs);
      ctx.save(); ctx.translate(sx(0), floorY); stage.draw(ctx, copt); ctx.restore();
    };
    renderer.draw(view, frozen ? 0 : dt);
    updateHud(frozen ? 0 : dt);
  }

  // ---------- Online ----------
  function onSnapshot(msg) {
    if (!G.active || G.mode !== "online" || online.role !== "guest" || msg.mid !== online.mid) return;
    if (!G.base) G.base = Brawl.create(1, { chars: G.chars });
    Brawl.applySnapshot(G.base, msg.s);
    G.snapAt = performance.now();
    Brawl.eventsOf(msg.s).forEach(onEvent);
  }
  function onInput(msg) { if (G.active && G.mode === "online" && online.role === "host") G.remoteMask = msg.m & 8191; }
  // The host says the match is over: wins in seat order.
  function onResult(msg) {
    if (!G.active || online.role !== "guest") return;
    if (msg.stats && Array.isArray(msg.stats.wins)) { run.wins = msg.stats.wins.slice(); run.round = run.wins[0] + run.wins[1] + 1; }
    G.matchWinner = msg.winner;
    G.s = G.s || Brawl.create(1, { chars: G.chars });
    G.resultShown = true; hideBanner();
    showScreen("bresult"); renderResult();
    Sfx.play(G.matchWinner === G.side ? "win" : "lose");
  }

  return {
    get active() { return G.active; },
    get mode() { return G.mode; },
    inFight: () => G.active && !!G.s && !G.resultShown && (G.s.phase === "countdown" || G.s.phase === "fight"),
    begin, newRound, stop, frame, renderResult, onSnapshot, onInput, onResult,
    isOver: () => G.resultShown,
    state: () => G.s,
    names: () => G.names,
    restart(seed) { newRound(seed); },
    get botIdx() { return G.botIdx; },
  };
})();
