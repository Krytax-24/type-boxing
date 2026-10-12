// The duel: rules, fighters and the world the renderer draws.
// Both typists feed the same events into handleEvents(), so a second human
// over the network can replace the bot later. The duel never creates or drives
// a typist itself: main.js owns the human's keyboard and the bot.

const DU = CONFIG.duel;
const FX = CONFIG.theme.fx; // colors of texts and sparks: visual only

class Duel {
  constructor() {
    // The renderer reads these.
    this.arenaWidth = 960;
    this.cameraX = 480;
    this.floorY = 300;
    this.enemies = [];
    this.fx = [];
    this.shake = 0;
    this.flash = 0;
    this.phase = "menu";           // menu | countdown | fight | over
    this.typists = [new Typist("YOU"), new Typist("BOT")];
    this.fighters = [this.makeFighter(0), this.makeFighter(1)];
    this.power = [0, 0];
    this.wpmNow = [0, 0];
    this.t = 0;
    this.tug = 0;
    this.countdown = 0;
    this.goFlash = 0;
    this.hitstop = 0;              // seconds the poses freeze on a big hit (visual only)
    this.hitstopOn = true;         // player setting (reduce motion turns it off); visual only, no rule reads it
    this.result = null;
    this.placeFighters(1);
  }

  makeFighter(i) {
    const f = new Fighter(i === 0 ? "you" : "bot", i === 0 ? "player" : "enemy", 0, DU.maxHp);
    f.facing = i === 0 ? 1 : -1;
    f.kx = 0;
    return f;
  }

  // `seed` picks both word streams and `weapons` ([your id, their id], default Medium) picks each
  // typist's weapon, so two peers with the same seed and weapons see the same words.
  start(seed, weapons) {
    this.seed = seed;
    this.weapons = [0, 1].map((i) => weaponFor(weapons && weapons[i]).id);
    this.typists.forEach((t, i) => { t.weapon = weaponFor(this.weapons[i]); t.reset(); });
    this.streams = this.typists.map((t, i) => new TypingStream(new WordSource(seed + 7 * i,
      WORD_POOLS[t.weapon.pool], ULT_POOLS[t.weapon.ultPool])));
    this.fighters = [this.makeFighter(0), this.makeFighter(1)];
    this.fx = [];
    this.shake = 0;
    this.flash = 0;
    this.t = 0;
    this.tug = 0;
    this.power = [0, 0];
    this.wpmNow = [0, 0];
    this.acc = [{ shownHp: DU.maxHp, last: 0 }, { shownHp: DU.maxHp, last: 0 }]; // for the floating HP numbers only
    this.countdown = DU.countdown;
    this.goFlash = 0;
    this.hitstop = 0;
    this.result = null;
    this.phase = "countdown";
    this.placeFighters(0);
  }

  // ---- input from either typist ----

  handleEvents(side, events, t) {
    if (this.phase !== "fight") return;
    const me = this.typists[side];
    const stream = this.streams[side];
    for (const e of events) {
      if (e.type === "correct") {
        me.correct(t);
        // Read-only visual state for the word plates. No rule reads these.
        me.lastCorrectAt = t;
        me.lastCorrectIndex = stream.typed.length - 1;
      } else if (e.type === "wrong") {
        const hadCombo = me.comboLevel > 0;
        me.wrong(t);
        me.lastWrongAt = t;
        me.lastWrongIndex = stream.typed.length - 1; // -1 when a wrong word was ended with space
        me.lastWrongWord = stream.index;
        if (hadCombo) { me.lastComboBreakAt = t; this.comboBreak(side); this.counter(1 - side, t); }
      } else if (e.type === "word") {
        if (me.wordDone(e.clean)) this.comboUp(side);
        if (e.ultimate) this.launchUltimate(side, e.clean);
        else this.strike(side, e.word.text.length);
      }
    }
    this.checkUltimateReady(side);
  }

  // Status text beside a fighter (COMBO, BROKEN, COUNTER, ULTIMATE, K.O.), in the status lane on
  // the fighter's outer side, so it never covers a word plate. Two slots per fighter: a new text takes
  // a free slot or replaces the oldest one. Visual only: no rule reads fx.
  // `replace` (optional) picks a text of this fighter to take over in place, keeping its slot.
  text(side, x, z, text, color, size, life, replace) {
    const F = CONFIG.floatText;
    const ko = text === "K.O.";
    const mine = this.fx.filter((o) => o.type === "text" && o.owner === side && o.lane === "status");
    if (ko) this.fx = this.fx.filter((o) => !mine.includes(o)); // the K.O. clears the lane
    let slot = 0;
    const old = replace && !ko ? mine.find(replace) : null;
    if (old) {
      slot = old.slot;
      this.fx.splice(this.fx.indexOf(old), 1);
    } else if (!ko) {
      const used = mine.map((o) => o.slot);
      slot = F.statusSlots.findIndex((_, k) => !used.includes(k));
      if (slot < 0) {
        const oldest = mine.reduce((m, o) => (o.age > m.age ? o : m));
        slot = oldest.slot;
        this.fx.splice(this.fx.indexOf(oldest), 1);
      }
    }
    this.fx.push({
      type: "text", owner: side, lane: "status", slot,
      x: x + (side === 0 ? -1 : 1) * F.statusSide, z: F.statusSlots[slot], rise: F.statusRise,
      age: 0, life, text, color, size: ko ? F.koSize : Math.min(size, F.statusMaxSize), align: side === 0 ? "right" : "left",
    });
  }

  // Number lane: one net HP change (damage and healing together) at a time, further out and lower.
  number(side, n, big) {
    const F = CONFIG.floatText, f = this.fighters[side];
    this.fx = this.fx.filter((o) => !(o.type === "text" && o.owner === side && o.lane === "number"));
    this.fx.push({
      type: "text", owner: side, lane: "number",
      x: f.x + (side === 0 ? -1 : 1) * F.numberSide, z: F.numberZ, rise: F.numberRise,
      age: 0, life: F.numberLife, text: (n > 0 ? "+" : "") + n, color: n < 0 ? F.lose : F.gain,
      size: big ? F.bigNumberSize : F.numberSize, align: side === 0 ? "right" : "left",
    });
  }

  comboUp(side) {
    const f = this.fighters[side];
    this.text(side, f.x, 100, "COMBO x" + this.typists[side].comboLevel, FX.combo, 26, 0.9);
  }

  comboBreak(side) {
    const f = this.fighters[side];
    // Takes the place of this fighter's "COMBO xN" text if it is still showing.
    this.text(side, f.x, 100, "COMBO BROKEN", FX.broken, 20, 0.8, (o) => o.text.startsWith("COMBO x"));
  }

  // The other typist broke a combo: `side` gets a counter window. Driven only by typing
  // events and duel time, so it is deterministic for online play. A new counter restarts
  // the timer; it never stacks.
  counter(side, t) {
    this.typists[side].counterUntil = t + DU.counter.duration;
    const f = this.fighters[side];
    this.text(side, f.x, 130, "COUNTER!", FX.counter, 26, 0.8);
    // Show: a fast punch that lands with a short hit-stop (visual only).
    if (f.dead || f.state === "air" || f.state === "down") return;
    if (f.state === "attack" && f.move === "special") return;
    f.state = "attack";
    f.move = "jab";
    f.moveT = 0;
    f.hitsDone = 0;
    f.moveCount++;
    f.counterHit = true;
  }

  // Slot a hard word into the stream once the ultimate is charged and the combo is high enough.
  checkUltimateReady(side) {
    const me = this.typists[side], stream = this.streams[side];
    if (me.ultReady() && !stream.ultimateAhead()) {
      stream.insertNext(stream.source.hardWord());
      const f = this.fighters[side];
      this.text(side, f.x, 110, "ULTIMATE READY", FX.ult, 24, 1.0);
    }
  }

  // ---- fighter animation ----

  strike(side, wordLength) {
    const f = this.fighters[side];
    if (f.dead || f.state === "air" || f.state === "down") return;
    if (f.state === "attack" && f.move === "special") return;
    f.state = "attack";
    f.counterHit = false;
    f.move = wordLength >= 6 ? "heavy" : "jab";
    f.moveT = 0;
    f.hitsDone = 0;
    f.moveCount++;
  }

  // The visible hit of a normal word: damage is continuous, this is only the show.
  landStrike(side) {
    const a = this.fighters[side], d = this.fighters[1 - side];
    const net = this.power[side] - this.power[1 - side];
    const dir = a.facing;
    if (a.counterHit) {
      a.counterHit = false;
      this.hitstop = Math.max(this.hitstop, DU.anim.counterHitstop);
      this.fx.push({ type: "spark", x: d.x - dir * 8, z: 80, age: 0, life: 0.22, size: 30, color: FX.counter });
    }
    if (net > 0.5) {
      if (d.state === "idle") { d.state = "hurt"; d.stateT = 0; d.stun = 0.14; }
      d.flashT = 0.1;
      d.kx += dir * 10;
      this.shake = Math.max(this.shake, a.move === "heavy" ? 4 : 2);
      if (a.move === "heavy") this.hitstop = Math.max(this.hitstop, 0.05);
      this.fx.push({ type: "spark", x: d.x - dir * 8, z: 75, age: 0, life: 0.2, size: a.move === "heavy" ? 32 : 24, color: FX.hit, by: side }); // by: the renderer may tint it
    } else {
      d.kx += dir * 3;
      this.fx.push({ type: "spark", x: d.x - dir * 22, z: 75, age: 0, life: 0.2, size: 20, color: FX.block });
    }
  }

  launchUltimate(side, clean) {
    const f = this.fighters[side];
    if (f.dead) return;
    f.state = "attack";
    f.move = "special";
    f.moveT = 0;
    f.moveCount++;
    f.ult = { clean, fired: false, sparks: 0 };
    const me = this.typists[side];
    me.charge = 0;
    if (clean) me.stats.ultimates++;
    this.text(side, f.x, 120, clean ? "ULTIMATE!" : "SLOPPY ULTIMATE", clean ? FX.ult : FX.sloppy, 34, 1.1);
  }

  updateUltimate(f, side, prog) {
    const u = f.ult, d = this.fighters[1 - side];
    while (u.sparks < 6 && prog >= 0.1 + u.sparks * 0.13) {
      u.sparks++;
      d.flashT = 0.08;
      this.shake = Math.max(this.shake, 4);
      this.fx.push({ type: "spark", x: d.x - f.facing * 6, z: 60 + (u.sparks % 3) * 25, age: 0, life: 0.22, size: 30, color: FX.ult });
    }
    if (!u.fired && prog >= 0.9) {
      u.fired = true;
      const dmg = u.clean ? DU.ultimate.damage : DU.ultimate.sloppyDamage;
      if (u.clean) this.typists[1 - side].stunUntil = this.t + DU.ultimate.stun;
      this.damage(1 - side, dmg);
      this.launch(d, f.facing);
      this.flash = 1;
      this.shake = 22;
      this.hitstop = Math.max(this.hitstop, 0.14);
      this.floaters(1 - side, true); // show the big hit right away in the number lane
    }
  }

  launch(d, dir) {
    d.state = "air";
    d.stateT = 0;
    d.z = 1;
    d.vz = 1000;
    d.vx = dir * 650;
  }

  damage(side, amount) {
    const t = this.typists[side];
    t.hp = Math.max(0, t.hp - amount);
    if (t.hp <= 0 && this.phase === "fight") this.knockOut(side);
  }

  knockOut(loser) {
    this.phase = "over";
    const d = this.fighters[loser], w = this.fighters[1 - loser];
    d.dead = true;
    if (d.state !== "air") this.launch(d, w.facing);
    this.text(loser, d.x, 120, "K.O.", FX.ko, 50, 1.4);
    this.shake = Math.max(this.shake, 14);
    this.hitstop = Math.max(this.hitstop, 0.2);
    this.result = { winner: 1 - loser };
  }

  animate(f, side, dt) {
    f.flashT = Math.max(0, f.flashT - dt);
    f.kx *= Math.pow(0.002, dt);
    f.stateT += dt;

    if (f.state === "attack") {
      const mv = CONFIG.moves[f.move];
      const dur = f.move === "special" ? mv.dur : DU.anim[f.move];
      f.moveT += dt * (mv.dur / dur);
      const prog = f.moveT / mv.dur;
      if (f.move === "special") this.updateUltimate(f, side, prog);
      else if (!f.hitsDone && prog >= mv.hits[0].at) { f.hitsDone = 1; this.landStrike(side); }
      if (prog >= 1) { f.state = "idle"; f.move = null; }
    } else if (f.state === "hurt") {
      if (f.stateT >= f.stun) { f.state = "idle"; f.stateT = 0; }
    } else if (f.state === "air") {
      f.vz -= CONFIG.physics.gravity * dt;
      f.z += f.vz * dt;
      f.kx += f.vx * dt;
      f.vx *= Math.pow(0.3, dt);
      if (f.z <= 0) {
        f.z = 0; f.vz = 0; f.state = "down"; f.stateT = 0;
        this.shake = Math.max(this.shake, 8);
        this.fx.push({ type: "ring", x: f.x, z: 0, age: 0, life: 0.4, color: FX.ring });
      }
    } else if (f.state === "down" && !f.dead && f.stateT >= 0.9) {
      f.state = "idle"; f.stateT = 0;
    }
  }

  placeFighters(dt) {
    const target = Math.max(-1, Math.min(1, (this.power[0] - this.power[1]) / DU.tugRange));
    this.tug += (target - this.tug) * Math.min(1, dt * 3);
    const cx = 480, gap = DU.anim.gap, push = DU.anim.push; // visual spacing only
    this.fighters.forEach((f, i) => {
      let x = cx + (i === 0 ? -gap / 2 : gap / 2) + push * this.tug + f.kx;
      if (f.state === "attack" && f.move) {
        const prog = Math.min(f.moveT / CONFIG.moves[f.move].dur, 1);
        const reach = f.move === "special" ? 45 * Math.min(1, prog * 6) : 16;
        x += f.facing * reach * (f.move === "special" ? 1 : Math.sin(prog * Math.PI));
      }
      f.x = Math.min(Math.max(x, 80), this.arenaWidth - 80);
    });
  }

  // ---- the fixed timestep ----

  update(dt) {
    for (const fx of this.fx) fx.age += dt;
    this.fx = this.fx.filter((fx) => fx.age < fx.life);
    this.shake *= Math.pow(0.0008, dt);
    if (this.shake < 0.2) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.goFlash = Math.max(0, this.goFlash - dt);

    if (this.phase === "countdown") {
      this.countdown -= dt;
      if (this.countdown <= 0) { this.phase = "fight"; this.goFlash = 0.8; }
    }

    if (this.phase === "fight") {
      this.t += dt;
      this.fightMath(dt);
    }

    // Hit-stop freezes the poses only. Rules, typing and the bot keep running,
    // and a fighter in the middle of an ultimate keeps spinning so its hit lands on time.
    if (!this.hitstopOn) this.hitstop = 0;
    const frozen = this.hitstop > 0;
    this.hitstop = Math.max(0, this.hitstop - dt);
    this.fighters.forEach((f, i) => {
      if (!frozen || (f.state === "attack" && f.move === "special")) this.animate(f, i, dt);
    });
    this.placeFighters(dt);
  }

  // The core rules: speed is attack and guard.
  fightMath(dt) {
    const t = this.t;
    for (let i = 0; i < 2; i++) {
      this.wpmNow[i] = this.typists[i].wpm(t);
      this.power[i] = this.typists[i].power(t);
    }
    const blocked = Math.min(this.power[0], this.power[1]);
    const heal = DU.regenScale * blocked * dt;

    for (let i = 0; i < 2; i++) {
      const me = this.typists[i];
      const dmg = DU.damageScale * Math.max(0, this.power[1 - i] - this.power[i]) * dt;
      const afterDamage = Math.max(0, me.hp - dmg);
      const newHp = afterDamage <= 0 ? 0 : Math.min(DU.maxHp, afterDamage + heal); // no healing from the grave
      me.hp = newHp;
      // Ultimate charge grows with speed.
      me.charge = Math.min(100, me.charge + DU.ultimate.chargePerWpmSec * this.wpmNow[i] * dt);
      this.checkUltimateReady(i);
      this.floaters(i);
    }
    for (let i = 0; i < 2; i++) {
      if (this.typists[i].hp <= 0 && this.phase === "fight") { this.knockOut(i); break; }
    }
  }

  // One net HP number per half second: the change after damage and healing.
  // `now` shows it at once (after an ultimate). Whole numbers only; the rest carries over.
  floaters(i, now) {
    const a = this.acc[i];
    if (!now && this.t - a.last < CONFIG.floatText.numberEvery) return;
    const n = Math.trunc(this.typists[i].hp - a.shownHp);
    if (n === 0) { if (!now) a.last = this.t; return; }
    a.last = this.t;
    a.shownHp += n;
    this.number(i, n, now);
  }

  snapshot() {
    const stream = (s) => ({
      index: s.index, typed: s.typed, wordErrors: s.wordErrors,
      words: s.words.slice(s.index, s.index + 8).map((w) => ({
        text: w.text, ultimate: !!w.ultimate, clean: w.clean, typedFinal: w.typedFinal || "",
      })),
    });
    const fighter = (f) => ({
      x: f.x, z: f.z, vx: f.vx, vz: f.vz, facing: f.facing, kx: f.kx || 0,
      state: f.state, stateT: f.stateT, stun: f.stun, move: f.move, moveT: f.moveT,
      hitsDone: f.hitsDone, moveCount: f.moveCount, flashT: f.flashT, dead: !!f.dead,
      counterHit: !!f.counterHit, ult: f.ult ? { clean: !!f.ult.clean, fired: !!f.ult.fired, sparks: f.ult.sparks || 0 } : null,
    });
    return {
      t: this.t, phase: this.phase, countdown: this.countdown, goFlash: this.goFlash,
      hp: this.typists.map((x) => x.hp), streak: this.typists.map((x) => x.streak),
      combo: this.typists.map((x) => x.comboLevel), charge: this.typists.map((x) => x.charge),
      stunUntil: this.typists.map((x) => x.stunUntil), counterUntil: this.typists.map((x) => x.counterUntil),
      wpm: this.wpmNow.slice(), power: this.power.slice(),
      stats: this.typists.map((x) => Object.assign({}, x.stats)),
      fighters: this.fighters.map(fighter), streams: this.streams.map(stream),
      fx: this.fx.slice(-12).map((x) => Object.assign({}, x)),
      shake: this.shake, flash: this.flash, result: this.result ? Object.assign({}, this.result) : null,
    };
  }

  applySnapshot(s, mirror) {
    const map = mirror ? [1, 0] : [0, 1];
    this.t = s.t;
    this.phase = s.phase;
    this.countdown = s.countdown || 0;
    this.goFlash = s.goFlash || 0;
    this.shake = s.shake || 0;
    this.flash = s.flash || 0;
    this.result = s.result ? Object.assign({}, s.result) : null;
    if (mirror && this.result && typeof this.result.winner === "number") this.result.winner = 1 - this.result.winner;
    for (let local = 0; local < 2; local++) {
      const remote = map[local], typ = this.typists[local], src = s.streams && s.streams[remote];
      typ.hp = s.hp[remote];
      typ.streak = s.streak ? s.streak[remote] : typ.streak;
      typ.comboLevel = s.combo ? s.combo[remote] : typ.comboLevel;
      typ.charge = s.charge ? s.charge[remote] : typ.charge;
      typ.stunUntil = s.stunUntil ? s.stunUntil[remote] : typ.stunUntil;
      typ.counterUntil = s.counterUntil ? s.counterUntil[remote] : typ.counterUntil;
      if (s.stats && s.stats[remote]) typ.stats = Object.assign(typ.stats, s.stats[remote]);
      this.wpmNow[local] = s.wpm ? s.wpm[remote] : 0;
      this.power[local] = s.power ? s.power[remote] : 0;
      if (src && this.streams[local] && !(mirror && local === 0)) {
        const st = this.streams[local];
        st.index = src.index;
        st.typed = src.typed || "";
        st.wordErrors = src.wordErrors || 0;
        for (let k = 0; k < src.words.length; k++) st.words[src.index + k] = Object.assign({}, src.words[k]);
        if (st.words.length - st.index < 20) st.extend();
      }
      const rf = s.fighters && s.fighters[remote], f = this.fighters[local];
      if (rf && f) {
        Object.assign(f, rf);
        if (mirror) {
          f.x = this.arenaWidth - rf.x;
          f.vx = -rf.vx;
          f.kx = -(rf.kx || 0);
          f.facing = -rf.facing;
        }
      }
    }
    this.fx = (s.fx || []).map((fx) => {
      const o = Object.assign({}, fx);
      if (mirror && typeof o.owner === "number") {
        o.owner = 1 - o.owner;
        if (typeof o.x === "number") o.x = this.arenaWidth - o.x;
        if (o.align === "left") o.align = "right";
        else if (o.align === "right") o.align = "left";
      }
      return o;
    });
  }
}
