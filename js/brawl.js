// Brawl: the rules of the fighting mode that needs no typing, played like Street Fighter. Pure: no DOM, no clock, no Math.random.
// One step is one frame (1/60 s). Both fighters give one input per frame (a bit mask), so two peers that start from the
// same state and feed the same inputs get the same fight. The host steps it online; the guest draws the host's snapshots
// (see snapshot() and applySnapshot()).
//
// Controls as bits: LEFT RIGHT UP DOWN, four attack buttons (HP high punch, LP low punch, HK high kick, LK low kick) and the
// specials: FB (Q, the fighter's projectile), DP (R, the fighter's rising move), both together or SU (the super, costs meter).
// Hold the direction away from the opponent to block (hold down as well for low attacks). The arcade motions still work too:
// down, down forward, forward + punch is a fireball; forward, down, down forward + punch the rising move. LP + LK together up
// close is a throw. Tap forward twice to dash, back twice to step back. A landed normal can be chained into a stronger (or equal)
// button, and every fighter has button strings (CONFIG.brawl.style) whose last press becomes that fighter's own finisher.
//
// Every fighter has its own timing: the frames of an attack come from the fighter's own animation (CONFIG.brawl.chars),
// so a hammer is slower than a pair of fists and what you see is what the rules count.
(function (global) {
  const B = CONFIG.brawl;
  const IN = { L: 1, R: 2, U: 4, D: 8, LP: 16, HP: 64, LK: 128, HK: 512, FB: 1024, SU: 2048, DP: 4096 };
  const BTN = ["lp", "lk", "hp", "hk"];
  const BIT = { lp: IN.LP, lk: IN.LK, hp: IN.HP, hk: IN.HK };
  const PUNCH = IN.LP | IN.HP, ATTACKS = PUNCH | IN.LK | IN.HK | IN.FB | IN.SU | IN.DP;
  const ST = ["ground", "air", "attack", "hit", "block", "down"];
  // Every move a fighter can be in. Stand, crouch (c) and jump (j) versions of the six buttons, then the specials.
  const MV = [null].concat(BTN, BTN.map((b) => "c" + b), BTN.map((b) => "j" + b), ["fire", "dp", "super", "throw", "f0", "f1", "f2"]);
  const DT = B.step;
  const SPECIALS = { fire: 1, dp: 1, super: 1, throw: 1, f0: 1, f1: 1, f2: 1 };
  const styleOf = (key) => B.style[key] || B.style.cyborg;
  const combosOf = (key) => styleOf(key).combos || [];
  const letter = (name) => name.replace(/^[cj]/, "");

  function rand(s) { // mulberry32, so the bot and anything random stays reproducible from the seed
    s.rng = (s.rng + 0x6d2b79f5) >>> 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- Frame data, read from the fighter's own animations ----------
  const cache = {};
  const charOf = (key) => B.chars[key] || B.chars.cyborg;
  // key: a move name from MV. lvl: strength 0..2 for the specials. Returns the numbers the rules use.
  function moveInfo(charKey, key, lvl) {
    const id = charKey + "|" + key + "|" + (lvl | 0);
    if (cache[id]) return cache[id];
    const c = charOf(charKey);
    let clip, spd, m;
    const base = key.replace(/^[cj]/, "");
    if (key[0] === "f" && key.length === 2) {
      const cb = combosOf(charKey)[+key[1]] || combosOf(charKey)[0];
      clip = cb.clip; spd = cb.spd;
      m = { h: "mid", dmg: cb.dmg, hitstun: 19, blockstun: 12, knock: cb.knock || 170, meter: 9, kd: !!cb.kd, rk: 0.8, rb: cb.rb || 0, fin: true, chip: 1 };
    } else if (SPECIALS[key]) {
      const st = styleOf(charKey);
      const sp = key === "fire" ? Object.assign({}, B.fire, st.fire) : key === "dp" ? Object.assign({}, B.dp, st.dp) : key === "super" ? B.sup : B.throwMove;
      clip = sp.clip; spd = sp.spd;
      m = { h: "mid", dmg: Array.isArray(sp.dmg) ? sp.dmg[lvl | 0] : sp.dmg, hitstun: sp.hit, blockstun: sp.blk, knock: sp.knock, meter: 6, chip: sp.chip || 0, kd: key !== "fire", reach: sp.reach || 0 };
      if (key === "fire") m.speed = sp.speed[lvl | 0];
      if (key === "super") { m.speed = B.sup.speed; m.meter = 0; }
      if (key === "throw") { m.h = "throw"; m.meter = 8; }
    } else if (key[0] === "j") {
      const a = B.air, bb = B.btn[base], kick = bb.kind === "k";
      clip = a.clip; spd = a.spd;
      m = { h: "mid", dmg: a.dmg[bb.tier - 1] + (kick ? 1 : 0), hitstun: a.hit, blockstun: a.blk, knock: a.knock, meter: a.meter, rk: a.rk, rb: a.rb + (kick ? 8 : 0), air: true };
    } else {
      const b = Object.assign({}, B.btn[base], (styleOf(charKey).btn || {})[base]), crouch = key[0] === "c";
      clip = b.clip; spd = b.spd;
      m = { h: b.h === "low" ? "low" : crouch ? (b.kind === "k" ? "low" : "mid") : b.h, dmg: b.dmg, hitstun: b.hit, blockstun: b.blk, knock: b.knock, meter: b.meter, rk: b.rk * (crouch ? 0.92 : 1), rb: b.rb, kd: !!b.kd, tier: b.tier, crouch };
      if (crouch && b.kind === "k" && base === "hk") { m.kd = true; m.dmg = b.dmg - 2; }
    }
    const st0 = styleOf(charKey), cl = c[clip] || c.a1;
    spd *= st0.spdK || 1;
    const secs = cl[0] * c.tempo / spd;
    let total = Math.max(10, Math.round(secs * 60)), startup = Math.max(3, Math.round(cl[1] * secs * 60));
    if (key === "fire" || key === "super") total = Math.max(total, (key === "fire" ? B.fire : B.sup).minTotal);
    if (m.fin) total = Math.max(total, 30);
    if (key === "throw") { startup = B.throwMove.startup; total = B.throwMove.total; }
    if (key === "dp") { startup = 3; }
    const impacts = cl[2];
    if (impacts > 1 && !SPECIALS[key]) m.dmg = Math.round(m.dmg * Math.min(1.8, 1 + 0.3 * (impacts - 1)));
    m.startup = startup;
    m.active = key === "dp" ? (Object.assign({}, B.dp, styleOf(charKey).dp).active) : m.air ? 40 : m.fin ? 5 : base === "hp" || base === "hk" ? 4 : 3;
    m.total = total;
    m.recover = Math.max(4, total - startup - m.active);
    m.cancel = Math.min(total - 1, Math.max(startup + 1, Math.round(cl[3] * secs * 60)));
    if (!m.reach) m.reach = Math.round(c.reach * (m.rk || 0.6) * (st0.reachK || 1) + (m.rb || 0));
    if (st0.pow && typeof m.dmg === "number") m.dmg = Math.max(1, Math.round(m.dmg * st0.pow));
    m.clip = clip; m.spd = spd; m.lvl = lvl | 0;
    return (cache[id] = m);
  }
  const dropCache = (key) => { for (const id in cache) if (id.startsWith(key + "|")) delete cache[id]; };
  const tierOf = (name) => (B.btn[name.replace(/^[cj]/, "")] || { tier: 0 }).tier;

  function makeFighter(i) {
    return { x: B.startX[i], y: 0, vx: 0, vy: 0, face: i === 0 ? 1 : -1, hp: B.hp, meter: 0,
      st: "ground", mv: null, fr: 0, hit: false, stun: 0, crouch: false, air: false, kd: false, inv: 0, flash: 0,
      dash: 0, dd: 1, lag: 0, lvl: 0, chain: 0, seq: [] };
  }

  // opts: { timer: seconds (0 = none), noDamage: [bool, bool], chars: [key, key] }
  function create(seed, opts) {
    opts = opts || {};
    const chars = opts.chars || ["cyborg", "ronin"];
    return {
      fr: 0, phase: "countdown", cd: B.countdown * 60, overFr: 0,
      timer: (opts.timer || 0) * 60, noDamage: opts.noDamage || [false, false], ch: [chars[0], chars[1]],
      f: [makeFighter(0), makeFighter(1)], pr: [], ev: [], rng: (seed >>> 0) || 1,
      in: [0, 0], prev: [0, 0], buf: [{ k: "", t: 0, lvl: 1 }, { k: "", t: 0, lvl: 1 }], combo: [0, 0], dealt: [0, 0],
      mh: [[], []],
      winner: null, byTime: false,
    };
  }

  const ev = (s, type, side, x, y, n) => s.ev.push({ type, side, x: Math.round(x), y: Math.round(y), n: n || 0 });
  const timeLeft = (s) => (s.timer ? Math.max(0, s.timer - s.fr) / 60 : null);

  // ---------- Reading the motions ----------
  // A direction as a numpad digit seen from the fighter's own side: 6 is forward, 4 back, 2 down, 8 up.
  function token(m, face) {
    const h = (m & IN.R ? 1 : 0) - (m & IN.L ? 1 : 0), v = (m & IN.U ? 1 : 0) - (m & IN.D ? 1 : 0), x = h * face;
    return String(v < 0 ? (x > 0 ? 3 : x < 0 ? 1 : 2) : v > 0 ? (x > 0 ? 9 : x < 0 ? 7 : 8) : (x > 0 ? 6 : x < 0 ? 4 : 5));
  }
  function remember(s, i, m, face) {
    const h = s.mh[i], t = token(m, face);
    if (!h.length || h[h.length - 1].c !== t) h.push({ c: t, t: s.fr });
    while (h.length > 14 || (h.length && s.fr - h[0].t > 60)) h.shift();
  }
  // The recent directions as a string, leaving out neutral and anything older than `frames`.
  const recent = (s, i, frames) => s.mh[i].filter((e) => s.fr - e.t <= frames).map((e) => e.c).join("").replace(/5/g, "");
  function motion(s, i) {
    const q = recent(s, i, B.motionFrames), big = recent(s, i, B.superMotionFrames);
    if (/2\d?3\d?6\d?2\d?3\d?6$/.test(big) || /236236?$/.test(big)) return "super";
    if (/6\d?2\d?3$/.test(q)) return "dp";
    if (/2\d?3\d?6$/.test(q) || /236[69]?$/.test(q)) return "fire";
    return null;
  }

  // ---------- Starting things ----------
  function startAttack(s, i, name, lvl) {
    const f = s.f[i];
    f.lvl = lvl | 0;
    const m = moveInfo(s.ch[i], name, f.lvl);
    f.st = "attack"; f.mv = name; f.fr = 0; f.hit = false; f.dash = 0;
    if (!m.air) { f.vx = 0; f.crouch = !!m.crouch; }
    if (name === "dp") { const d = Object.assign({}, B.dp, styleOf(s.ch[i]).dp); f.vy = d.lift; f.vx = f.face * d.drift; f.air = true; f.inv = d.inv; f.crouch = false; }
    f.seq = /^c?(lp|lk|hp|hk)$/.test(name) ? [letter(name)] : [];
    if (name === "super") f.meter -= B.superCost;
    s.buf[i].k = ""; s.buf[i].t = 0;
    ev(s, name === "super" ? "super" : name === "throw" ? "throwStart" : name === "fire" ? "cast" : name === "dp" ? "dp" : "swing", i, f.x, f.y + 80);
    if (name[0] === "f" && name.length === 2) ev(s, "fin", i, f.x, f.y + 150, +name[1]);
  }

  function hurtInto(s, d, a, m, blocked) {
    d.fr = 0; d.dash = 0; d.chain = 0;
    if (blocked) {
      d.st = "block"; d.stun = m.blockstun; d.vx = a.face * m.knock * 0.55; d.mv = null;
      return;
    }
    const knockdown = !!m.kd || d.hp <= 0 || d.y > 0;
    d.st = "hit"; d.stun = m.hitstun; d.mv = null; d.hit = false; d.flash = 6; d.lag = 0;
    d.vx = a.face * m.knock;
    d.kd = knockdown;
    if (knockdown) { d.vy = d.y > 0 ? Math.max(d.vy, 260) : 330; d.air = true; d.stun = 9999; }
  }

  // ---------- Per fighter control ----------
  function pickButton(e) {
    for (const b of ["hk", "hp", "lk", "lp"]) if (e & BIT[b]) return b;
    return null;
  }
  const strength = (e) => (e & IN.HP ? 2 : 0);

  function control(s, i) {
    const f = s.f[i], o = s.f[1 - i], m = s.in[i], p = s.prev[i], e = m & ~p, buf = s.buf[i];
    if (buf.t > 0) buf.t--; else buf.k = "";
    remember(s, i, m, f.face);
    if (f.inv > 0) f.inv--;
    if (f.flash > 0) f.flash--;
    const dir = (m & IN.R ? 1 : 0) - (m & IN.L ? 1 : 0);

    // Decide what a fresh button press means (a motion, a throw, a plain normal) at the moment it is pressed.
    if (e & ATTACKS) {
      let k = null, lvl = 1;
      if (e & IN.SU) k = "super";
      else if ((m & IN.FB) && (m & IN.DP) && (e & (IN.FB | IN.DP))) k = "super";
      else if (e & IN.FB) { k = "fire"; buf.f0 = s.fr; }
      else if (e & IN.DP) { k = "dp"; buf.f0 = s.fr; }
      else {
        if (e & PUNCH) { k = motion(s, i); lvl = strength(e); }
        if (!k) { const b = pickButton(e); if (b) { k = "n:" + b; if ((m & IN.LP) && (m & IN.LK) && (e & (IN.LP | IN.LK))) k = "throw"; } }
      }
      if (k) { buf.k = k; buf.t = B.bufferFrames; buf.lvl = lvl; if (buf.f0 === undefined || (k !== "fire" && k !== "dp")) buf.f0 = s.fr - 9; }
    }
    // Two taps the same way, with the stick back in the middle between them, make a dash (forward) or a step back.
    if (f.st === "ground" && f.dash <= 0 && f.lag <= 0 && (e & (IN.L | IN.R))) {
      const raw = s.mh[i].filter((q) => s.fr - q.t <= B.dash.window).map((q) => q.c).join("");
      const rel = /656$/.test(raw) ? 1 : /454$/.test(raw) ? -1 : 0;
      if (rel) {
        f.dash = rel > 0 ? B.dash.fwdFrames : B.dash.backFrames; f.dd = rel; f.crouch = false;
        f.vx = f.face * rel * (rel > 0 ? B.dash.fwd : B.dash.back);
        if (rel < 0) f.inv = Math.max(f.inv, B.dash.backInv);
        s.mh[i].length = 0;
        ev(s, "dash", i, f.x, 0, rel);
      }
    }
    const meterOk = f.meter >= B.superCost, ballOut = s.pr.some((q) => q.o === i);

    if (f.st === "ground") {
      if (f.lag > 0) { f.lag--; f.vx = 0; }
      else if (f.dash > 0) {
        f.dash--;
        if (f.dash === 0) f.vx = 0;
      } else {
        f.crouch = !!(m & IN.D);
        let kk = buf.k;
        // Q or R alone waits two frames: pressing the other one in that time makes the super instead.
        if ((kk === "fire" || kk === "dp") && s.fr - buf.f0 < 2) kk = "";
        if (kk === "super" && meterOk && !ballOut) { startAttack(s, i, "super"); return; }
        if (kk === "super") buf.k = "";
        else if (kk === "fire" && !ballOut) { startAttack(s, i, "fire", buf.lvl); return; }
        else if (kk === "fire") buf.k = "";
        else if (kk === "dp") { startAttack(s, i, "dp", buf.lvl); return; }
        else if (kk === "throw") { startAttack(s, i, "throw"); return; }
        else if (kk && kk[0] === "n") { startAttack(s, i, (f.crouch ? "c" : "") + kk.slice(2)); return; }
        if ((m & IN.U) && !f.crouch) {
          f.st = "air"; f.vy = B.jumpV; f.vx = dir * B.walk * 1.1; f.air = true; f.mv = null; f.fr = 0;
          ev(s, "jump", i, f.x, 0);
          return;
        }
        if (f.crouch || dir === 0) f.vx = 0;
        else f.vx = dir * (dir === f.face ? B.walk : B.back);
      }
    } else if (f.st === "air") {
      const kk = buf.k;
      if (kk && kk[0] === "n") startAttack(s, i, "j" + kk.slice(2));
    } else if (f.st === "attack") {
      const mv = moveInfo(s.ch[i], f.mv, f.lvl);
      f.fr++;
      const kk = buf.k, special = SPECIALS[f.mv];
      // A landed normal turns into a combo: cancel it into a special, or chain it into an equal or stronger button.
      if (f.hit && !special && !mv.air) {
        if (f.fr >= mv.startup && !((kk === "fire" || kk === "dp") && s.fr - buf.f0 < 2)) {
          if (kk === "super" && meterOk && !ballOut) { startAttack(s, i, "super"); return; }
          if (kk === "fire" && !ballOut) { startAttack(s, i, "fire", buf.lvl); return; }
          if (kk === "dp") { startAttack(s, i, "dp", buf.lvl); return; }
        }
        if (kk && kk[0] === "n" && f.fr >= mv.cancel && f.chain < 5) {
          const nm = (f.crouch ? "c" : "") + kk.slice(2), want = tierOf(nm), have = tierOf(f.mv);
          const nseq = f.seq.concat(letter(nm)), fin = combosOf(s.ch[i]).findIndex((c) => c.seq === nseq.join(","));
          if (fin >= 0) { const c = f.chain + 1; startAttack(s, i, "f" + fin); f.chain = c; return; }
          const prefix = nseq.join(",") + ",", inString = combosOf(s.ch[i]).some((c) => (c.seq + ",").startsWith(prefix));
          if (want > have || (want === have && nm !== f.mv) || inString) { const c = f.chain + 1; startAttack(s, i, nm); f.chain = c; f.seq = nseq; return; }
        }
      }
      // Two light buttons together just after a light attack began is a throw (the grace the arcade gives).
      if (!special && !f.hit && f.fr <= 3 && (f.mv === "lp" || f.mv === "lk") && (m & IN.LP) && (m & IN.LK) && (e & (IN.LP | IN.LK))) {
        if (Math.abs(o.x - f.x) <= B.throwMove.reach + B.halfW) { startAttack(s, i, "throw"); return; }
      }
      if (f.mv === "fire" && f.fr === mv.startup) {
        s.pr.push({ x: f.x + f.face * 60, y: 80, vx: f.face * mv.speed, o: i, lvl: f.lvl, big: 0, dmg: mv.dmg });
        ev(s, "wave", i, f.x + f.face * 60, 80);
      }
      if (f.mv === "super" && f.fr === mv.startup) {
        s.pr.push({ x: f.x + f.face * 60, y: 90, vx: f.face * mv.speed, o: i, lvl: 2, big: 1, dmg: mv.dmg });
        ev(s, "wave", i, f.x + f.face * 60, 90);
      }
      if (!mv.air && f.mv !== "dp" && f.fr >= mv.total) { f.st = "ground"; f.mv = null; f.fr = 0; f.chain = 0; }
    } else if (f.st === "hit" || f.st === "block") {
      f.fr++;
      if (f.st === "block") f.crouch = !!(m & IN.D);
      if (!f.kd && f.fr >= f.stun) { f.st = "ground"; f.fr = 0; f.vx = 0; s.combo[1 - i] = 0; }
    } else if (f.st === "down") {
      f.fr++;
      if (f.fr >= B.downFrames) { f.st = "ground"; f.fr = 0; f.inv = B.wakeInvuln; f.kd = false; s.combo[1 - i] = 0; }
    }
    // Face the opponent whenever you are not busy.
    if (f.st === "ground" || f.st === "block") f.face = o.x >= f.x ? 1 : -1;
  }

  function physics(s, i) {
    const f = s.f[i];
    const attAir = f.st === "attack" && (f.air || (f.mv && f.mv[0] === "j"));
    const flying = f.y > 0 || f.vy > 0 || f.st === "air" || attAir || (f.st === "hit" && f.air);
    if (flying) {
      f.vy -= B.gravity * DT;
      f.y += f.vy * DT;
      if (f.y <= 0 && f.vy <= 0) {
        f.y = 0; f.vy = 0; f.air = false;
        if (f.st === "air" || f.st === "attack") {
          const wasDp = f.mv === "dp";
          f.st = "ground"; f.mv = null; f.fr = 0; f.vx = 0; f.chain = 0; ev(s, "land", i, f.x, 0);
          if (wasDp) f.lag = B.dp.lag;
        } else if (f.st === "hit") { f.st = "down"; f.fr = 0; f.vx *= 0.3; ev(s, "thud", i, f.x, 0); }
      }
    }
    f.x += f.vx * DT;
    if (!flying && (f.st === "hit" || f.st === "block" || f.st === "down")) f.vx *= 0.9;
    if (!flying && f.st === "attack") f.vx *= 0.85;
  }

  // ---------- Hits ----------
  function tryHit(s, ai, m, box) {
    // box: { dx (how far in front), dxAbs (projectiles) }
    const a = s.f[ai], di = 1 - ai, d = s.f[di];
    if (d.inv > 0 || d.st === "down" || s.phase !== "fight") return null;
    if (m.proj) { if (Math.abs(box.dxAbs) > B.halfW + 22 || d.y > 100) return null; }
    else {
      if (box.dx < -10 || box.dx > m.reach + B.halfW) return null;
      if (m.air) { if (Math.abs(d.y - a.y) > 110) return null; }
      else if (d.y > 80) return null;
      if (m.h === "high" && d.crouch && d.st !== "hit" && d.y === 0) return null;
      if (m.h === "low" && d.y > 0) return null;
    }
    const back = d.face > 0 ? IN.L : IN.R;
    const inp = s.in[di];
    const standing = d.y === 0 && (d.st === "ground" || d.st === "block") && d.dash <= 0;
    let blocked = standing && !!(inp & back);
    if (blocked && m.h === "low" && !(inp & IN.D)) blocked = false;
    return { blocked };
  }

  function applyHit(s, ai, m, res, name) {
    const a = s.f[ai], di = 1 - ai, d = s.f[di];
    const corner = d.x <= B.arena.left + 40 || d.x >= B.arena.right - 40;
    if (res.blocked) {
      const chip = m.chip || 0;
      if (chip && !s.noDamage[di]) d.hp = Math.max(1, d.hp - chip);
      hurtInto(s, d, a, m, true);
      a.meter = Math.min(B.meterMax, a.meter + 2);
      d.meter = Math.min(B.meterMax, d.meter + 2);
      a.hit = true;
      if (corner && a.st === "attack") a.vx = -a.face * m.knock * 0.6; // a cornered defender pushes the attacker back instead
      ev(s, "block", di, d.x, d.y + 90);
      return;
    }
    const inCombo = d.st === "hit";
    s.combo[ai] = inCombo ? s.combo[ai] + 1 : 1;
    const scale = B.comboScale[Math.min(B.comboScale.length - 1, s.combo[ai] - 1)];
    const dmg = s.noDamage[di] ? 0 : Math.max(1, Math.round(m.dmg * scale));
    d.hp = Math.max(0, d.hp - dmg);
    s.dealt[ai] += dmg;
    a.meter = Math.min(B.meterMax, a.meter + (m.meter || 0));
    d.meter = Math.min(B.meterMax, d.meter + Math.round(m.dmg * 0.9));
    hurtInto(s, d, a, m, false);
    a.hit = true;
    if (corner && a.st === "attack") a.vx = -a.face * m.knock * 0.5;
    ev(s, name === "fire" || name === "super" ? "boom" : name === "throw" ? "thud" : "hit", di, d.x, d.y + 90, dmg);
    if (s.combo[ai] >= 2) ev(s, "combo", ai, d.x, d.y + 130, s.combo[ai]);
  }

  function resolve(s) {
    const hits = [];
    for (let ai = 0; ai < 2; ai++) {
      const a = s.f[ai], d = s.f[1 - ai];
      if (a.st !== "attack" || a.hit) continue;
      const m = moveInfo(s.ch[ai], a.mv, a.lvl);
      if (a.mv === "fire" || a.mv === "super") continue;
      if (a.fr < m.startup || a.fr >= m.startup + m.active) continue;
      if (a.mv === "throw") {
        const near = Math.abs(d.x - a.x) <= B.throwMove.reach + B.halfW && d.y === 0 && d.inv <= 0 && (d.st === "ground" || d.st === "block") && d.dash <= 0;
        if (near && s.phase === "fight") hits.push([ai, Object.assign({}, m, { kd: true }), { blocked: false }, "throw"]);
        continue;
      }
      const r = tryHit(s, ai, m, { dx: (d.x - a.x) * a.face });
      if (r) hits.push([ai, m, r, a.mv]);
    }
    for (const q of s.pr) {
      const di = 1 - q.o, d = s.f[di];
      const base = q.big ? moveInfo(s.ch[q.o], "super", 2) : moveInfo(s.ch[q.o], "fire", q.lvl);
      const m = Object.assign({}, base, { proj: true, dmg: q.dmg, kd: !!q.big });
      const r = tryHit(s, q.o, m, { dx: 0, dxAbs: d.x - q.x });
      if (r) { q.dead = true; hits.push([q.o, m, r, q.big ? "super" : "fire"]); }
    }
    for (const h of hits) applyHit(s, h[0], h[1], h[2], h[3]);
  }

  function projectiles(s) {
    for (const q of s.pr) q.x += q.vx * DT;
    // Two fireballs meeting cancel each other (a super beats a plain fireball).
    for (const q of s.pr) for (const r of s.pr) if (q.o !== r.o && !q.dead && !r.dead && Math.abs(q.x - r.x) < 40) {
      if (q.big && !r.big) r.dead = true; else if (r.big && !q.big) q.dead = true; else q.dead = r.dead = true;
      ev(s, "clash", 0, (q.x + r.x) / 2, q.y);
    }
    s.pr = s.pr.filter((q) => !q.dead && q.x > -40 && q.x < B.arena.width + 40);
  }

  function separate(s) {
    const [a, b] = s.f, W = B.halfW * 2;
    if (a.y < 60 && b.y < 60 && Math.abs(a.x - b.x) < W) {
      const push = (W - Math.abs(a.x - b.x)) / 2, dir = a.x <= b.x ? -1 : 1;
      a.x += dir * push; b.x -= dir * push;
    }
    for (const f of s.f) f.x = Math.min(B.arena.right, Math.max(B.arena.left, f.x));
    if (a.y < 60 && b.y < 60 && Math.abs(a.x - b.x) < W) { // pinned against a wall: the other one gives way
      if (a.x <= B.arena.left + 1) b.x = a.x + W; else if (b.x >= B.arena.right - 1) a.x = b.x - W;
      else if (a.x <= b.x) b.x = a.x + W; else a.x = b.x + W;
    }
  }

  function finish(s, winner, byTime) {
    s.phase = "over"; s.overFr = 0; s.winner = winner; s.byTime = !!byTime;
    ev(s, byTime ? "time" : "ko", winner === null ? 0 : 1 - winner, s.f[winner === 0 ? 1 : 0].x, 100);
  }

  // One frame. in0 and in1 are the two input masks.
  function step(s, in0, in1) {
    s.in = [in0 | 0, in1 | 0];
    if (s.phase === "over") {
      s.overFr++;
      for (let i = 0; i < 2; i++) { physics(s, i); const f = s.f[i]; if (f.st === "hit" && f.y === 0 && !f.air) { f.st = "down"; } f.fr++; }
      s.prev = s.in.slice();
      return;
    }
    if (s.phase === "countdown") {
      s.cd--;
      if (s.cd <= 0) { s.phase = "fight"; ev(s, "go", 0, 550, 150); }
      for (let i = 0; i < 2; i++) s.f[i].face = s.f[1 - i].x >= s.f[i].x ? 1 : -1;
      s.prev = s.in.slice();
      return;
    }
    s.fr++;
    for (let i = 0; i < 2; i++) control(s, i);
    for (let i = 0; i < 2; i++) physics(s, i);
    projectiles(s);
    resolve(s);
    separate(s);
    s.prev = s.in.slice();
    const [a, b] = s.f;
    if (a.hp <= 0 || b.hp <= 0) {
      const w = a.hp <= 0 && b.hp <= 0 ? (s.dealt[0] >= s.dealt[1] ? 0 : 1) : (a.hp <= 0 ? 1 : 0);
      finish(s, w, false);
    } else if (s.timer && s.fr >= s.timer) {
      const w = a.hp !== b.hp ? (a.hp > b.hp ? 0 : 1) : s.dealt[0] !== s.dealt[1] ? (s.dealt[0] > s.dealt[1] ? 0 : 1) : 0;
      finish(s, w, true);
    }
  }

  // ---------- The computer opponent ----------
  // ai: { lvl: a row of CONFIG.brawl.bots, next: frame of the next decision, mask, press: frame until which attack bits stay }
  function newAi(lvl) { return { lvl, next: 30, mask: 0, press: 0, chainAt: -1 }; }
  function botInput(s, side, ai) {
    const L = ai.lvl, me = s.f[side], op = s.f[1 - side];
    if (s.phase !== "fight") return 0;
    const reachOf = (name) => moveInfo(s.ch[side], name, 1).reach + B.halfW;
    // A landed attack: keep the combo going with a stronger button.
    if (me.st === "attack" && me.hit && !SPECIALS[me.mv] && me.mv[0] !== "j" && ai.chainAt !== me.fr && rand(s) < L.chain * 0.3) {
      ai.chainAt = me.fr;
      const t = tierOf(me.mv), mine = me.seq.join(",") + ",";
      const cb = combosOf(s.ch[side]).filter((c) => (c.seq + ",").startsWith(mine) && c.seq.length > me.seq.join(",").length);
      let pick = t >= 3 ? "hk" : t === 2 ? "hk" : (rand(s) < 0.5 ? "hp" : "hk");
      if (cb.length && rand(s) < 0.6) pick = cb[(rand(s) * cb.length) | 0].seq.split(",")[me.seq.length];
      ai.mask = BIT[pick] | (me.crouch ? IN.D : 0); ai.press = s.fr + 3; ai.next = s.fr + 6;
    }
    if (s.fr >= ai.next) {
      const dx = op.x - me.x, d = Math.abs(dx), toward = dx > 0 ? IN.R : IN.L, away = dx > 0 ? IN.L : IN.R;
      let mask = 0, hold = L.think;
      const r = rand(s);
      const opAtk = op.st === "attack" && !op.air && op.mv && op.mv[0] !== "j";
      const opInfo = opAtk ? moveInfo(s.ch[1 - side], op.mv, op.lvl) : null;
      const wavesIn = s.pr.some((q) => q.o !== side && Math.abs(q.x - me.x) < 200);
      if (me.st === "block" || me.st === "hit") mask = away | (me.crouch ? IN.D : 0);
      else if (opAtk && d < opInfo.reach + 80 && rand(s) < L.block) {
        mask = away | (opInfo.h === "low" ? IN.D : 0); hold = 12;
      } else if (wavesIn) mask = rand(s) < 0.5 ? (toward | IN.U) : away;
      else if (op.st === "air" && d < 150) mask = rand(s) < 0.6 ? IN.DP : IN.HP;
      else if (d > 260) {
        if (r < L.fire && !s.pr.some((q) => q.o === side)) mask = rand(s) < 0.3 && me.meter >= B.superCost ? IN.SU : IN.FB;
        else if (r < L.fire + L.jump) mask = toward | IN.U;
        else mask = toward;
      } else if (d > reachOf("hp") + 10) mask = toward;
      else if (r < L.aggr) {
        const pickLow = rand(s) < L.low, q = rand(s);
        const btn = d < reachOf("lp") ? (q < 0.5 ? IN.LP : IN.HP) : q < 0.3 ? IN.LK : q < 0.6 ? IN.HP : q < 0.85 ? IN.LP : IN.HK;
        mask = btn | (pickLow && (btn & (IN.LK | IN.HK)) ? IN.D : 0);
        if ((btn & IN.LP) && d < B.throwMove.reach + B.halfW && rand(s) < 0.25) mask = IN.LP | IN.LK;
      } else if (r < L.aggr + 0.22) mask = away;
      ai.mask = mask; ai.next = s.fr + hold;
      if (mask & ATTACKS) ai.press = s.fr + 3;
    }
    return s.fr < ai.press ? ai.mask : ai.mask & ~ATTACKS;
  }

  // ---------- Snapshots for online play ----------
  const r1 = (n) => Math.round(n * 10) / 10;
  function snapshot(s, events) {
    return {
      t: Math.round(s.fr / 6) / 10, phase: s.phase, hp: [s.f[0].hp, s.f[1].hp], fr: s.fr, cd: s.cd, ov: s.overFr,
      f: s.f.map((f) => [r1(f.x), r1(f.y), r1(f.vx), r1(f.vy), f.face, ST.indexOf(f.st), MV.indexOf(f.mv), f.fr, f.stun > 9000 ? 9999 : f.stun,
        Math.round(f.meter), f.hit ? 1 : 0, f.crouch ? 1 : 0, f.air ? 1 : 0, f.kd ? 1 : 0, f.inv, f.flash, f.dash * f.dd, f.lag, f.lvl, f.chain, f.seq.join(",")]),
      pr: s.pr.map((q) => [r1(q.x), q.y, r1(q.vx), q.o, q.lvl, q.big, q.dmg]),
      in: s.in, pv: s.prev, cb: s.combo, dl: s.dealt, w: s.winner === null ? -1 : s.winner, bt: s.byTime ? 1 : 0,
      ev: (events || []).slice(0, 12).map((e) => [e.type, e.side, e.x, e.y, e.n]),
    };
  }
  function applySnapshot(s, n) {
    s.fr = n.fr; s.phase = n.phase; s.cd = n.cd; s.overFr = n.ov;
    n.f.forEach((a, i) => {
      const f = s.f[i];
      f.x = a[0]; f.y = a[1]; f.vx = a[2]; f.vy = a[3]; f.face = a[4]; f.st = ST[a[5]] || "ground"; f.mv = MV[a[6]] || null; f.fr = a[7];
      f.stun = a[8]; f.meter = a[9]; f.hit = !!a[10]; f.crouch = !!a[11]; f.air = !!a[12]; f.kd = !!a[13]; f.inv = a[14]; f.flash = a[15];
      f.dash = Math.abs(a[16] || 0); f.dd = (a[16] || 0) < 0 ? -1 : 1; f.lag = a[17] || 0; f.lvl = a[18] || 0; f.chain = a[19] || 0; f.seq = a[20] ? String(a[20]).split(",") : [];
      f.hp = n.hp[i];
    });
    s.pr = n.pr.map((q) => ({ x: q[0], y: q[1], vx: q[2], o: q[3], lvl: q[4] || 0, big: q[5] || 0, dmg: q[6] || 8 }));
    s.in = n.in.slice(); s.prev = n.pv.slice(); s.combo = n.cb.slice(); s.dealt = n.dl.slice();
    s.winner = n.w < 0 ? null : n.w; s.byTime = !!n.bt;
  }
  const eventsOf = (n) => (n.ev || []).map((e) => ({ type: e[0], side: e[1], x: e[2], y: e[3], n: e[4] }));

  // A deep copy of a state (the guest extrapolates a copy of the last snapshot; tests compare states).
  const clone = (s) => JSON.parse(JSON.stringify(s));

  function drain(s) { const e = s.ev; s.ev = []; return e; }

  global.Brawl = { IN, ST, MV, BTN, BIT, ATTACKS, create, step, botInput, newAi, snapshot, applySnapshot, eventsOf, drain, clone, timeLeft, rand, moveInfo, token, charOf, combosOf, styleOf, dropCache };
})(typeof window !== "undefined" ? window : globalThis);
