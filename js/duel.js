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
    this.puppetHits = false;       // set by the 2D renderer: the puppet's impact frame is then the one hit moment (see hitLanded)
    this.hitstopOn = true;         // player setting (reduce motion turns it off); visual only, no rule reads it
    this.result = null;
    this.opts = { timer: 0, noDamage: [false, false], hp: null };
    this.fightT = 0;
    this.placeFighters(1);
  }

  makeFighter(i) {
    const f = new Fighter(i === 0 ? "you" : "bot", i === 0 ? "player" : "enemy", 0, DU.maxHp);
    f.facing = (i === 0) !== !!this.mirror ? 1 : -1;   // mirror: you stand on the right (a screen setting, no rule reads it)
    f.kx = 0;
    return f;
  }

  // `seed` picks both word streams and `weapons` ([your id, their id], default Medium) picks each
  // typist's weapon, so two peers with the same seed and weapons see the same words.
  //   `opts` (all optional): timer (round length in seconds, 0 = none), noDamage ([bool, bool]: that side never loses HP,
  //   used by Practice and Endless), hp ([a, b]: starting HP, unused now, kept for tests).
  start(seed, weapons, opts) {
    this.seed = seed;
    this.opts = Object.assign({ timer: 0, noDamage: [false, false], hp: null }, opts || {});
    this.fightT = 0;
    this.overT = 0;                // seconds since the round ended (the result screen waits for the K.O. or TIME to play out)
    this.weapons = [0, 1].map((i) => weaponFor(weapons && weapons[i]).id);
    this.typists.forEach((t, i) => { t.weapon = weaponFor(this.weapons[i]); t.reset(); if (this.opts.hp) t.hp = this.opts.hp[i]; });
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
    this.acc = [0, 1].map((i) => ({ shownHp: this.typists[i].hp, last: 0 })); // for the floating HP numbers only
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
        const levelBefore = me.comboLevel, streakBefore = me.streak;
        me.wrong(t, e.skip, e.wi);
        me.lastWrongAt = t;
        me.lastWrongIndex = stream.typed.length - 1; // -1 when the word was skipped or ended early with space
        me.lastWrongWord = stream.index;
        const lostNow = streakBefore - me.streak;
        // A whole level gone, or (accuracy basis, where the streak runs far past the top level) at least a level's worth of words.
        if (me.comboLevel < levelBefore || (DU.basis !== "wpm" && lostNow >= me.weapon.wordsPerCombo)) {
          // A whole combo level is gone: the other typist gets the counter window.
          me.lastComboBreakAt = t;
          this.comboBreak(side);
          this.counter(1 - side, t, lostNow);
        } else if (me.streak < streakBefore) {
          // Part of a level is gone (the typo rule takes half a level): a small text, no counter.
          this.comboDip(side, streakBefore - me.streak, me.weapon.wordsPerCombo);
        }
      } else if (e.type === "word") {
        if (e.skipped) {
          // The word ended as a miss under the typo rule. The plate shows it struck out for a moment, and no
          // punch is thrown for it (a miss is a stumble, not an attack). A skipped ultimate word is a sloppy ultimate.
          me.lastSkipAt = t;
          me.lastSkipText = e.word.text;
          me.stats.skipped++;
          if (e.ultimate) this.launchUltimate(side, false);
          continue;
        }
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
      x: f.x + (side === 0 ? -1 : 1) * (this.mirror ? -1 : 1) * F.numberSide, z: F.numberZ, rise: F.numberRise,
      age: 0, life: F.numberLife, text: (n > 0 ? "+" : "") + n, color: n < 0 ? F.lose : F.gain,
      size: big ? F.bigNumberSize : F.numberSize, align: (side === 0) !== !!this.mirror ? "right" : "left",
    });
  }

  comboUp(side) {
    const f = this.fighters[side];
    this.text(side, f.x, 100, "COMBO x" + this.typists[side].comboLevel, FX.combo, 26, 0.9);
  }

  // The typo rule took part of a combo level (`lost` words of the streak), but the level held.
  comboDip(side, lost, perLevel) {
    const f = this.fighters[side];
    const part = Math.round((lost / perLevel) * 10) / 10;
    this.text(side, f.x, 100, "MISS -" + part + "x", FX.broken, 18, 0.7);
  }

  comboBreak(side) {
    const f = this.fighters[side];
    // Takes the place of this fighter's "COMBO xN" text if it is still showing.
    this.text(side, f.x, 100, "COMBO BROKEN", FX.broken, 20, 0.8, (o) => o.text.startsWith("COMBO x"));
  }

  // The other typist broke a combo: `side` gets a counter window. Driven only by typing
  // events and duel time, so it is deterministic for online play. A new counter restarts
  // the timer; it never stacks.
  counter(side, t, lost) {
    this.typists[side].counterUntil = t + DU.counter.duration;
    // Counter strike: the combo words the other typist just lost become a flat burst of damage on them.
    // Driven by the lost streak only, so the host and the replaying tests agree exactly.
    const dmg = Math.min(DU.counter.maxDamage, Math.round((lost || 0) * DU.counter.damagePerWord * 10) / 10);
    if (dmg > 0) {
      const victim = this.fighters[1 - side];
      this.text(1 - side, victim.x, 150, "-" + dmg + " HP", FX.counter, 22, 0.9);
      this.damage(1 - side, dmg);
    }
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

  // The visible hit of a normal word: damage is continuous, this is only the show. With the 2D puppets
  // (puppetHits) the puppet's own impact frame is the one moment of spark, shake and hit-stop (hitLanded),
  // so this keeps only the state change; without them (the old stickmen) it does the whole show itself.
  landStrike(side) {
    const a = this.fighters[side], d = this.fighters[1 - side];
    const net = this.power[side] - this.power[1 - side];
    const dir = a.facing;
    if (a.counterHit && !this.puppetHits) {
      a.counterHit = false;
      this.hitstop = Math.max(this.hitstop, DU.anim.counterHitstop);
      this.fx.push({ type: "spark", x: d.x - dir * 8, z: 80, age: 0, life: 0.22, size: 30, color: FX.counter });
    }
    if (net > duelTune("clashBand")) {
      if (d.state === "idle") { d.state = "hurt"; d.stateT = 0; d.stun = 0.14; }
      d.flashT = 0.1;
      d.kx += dir * 10;
      if (this.puppetHits) return;
      this.shake = Math.max(this.shake, a.move === "heavy" ? 4 : 2);
      if (a.move === "heavy") this.hitstop = Math.max(this.hitstop, 0.05);
      this.fx.push({ type: "spark", x: d.x - dir * 8, z: 75, age: 0, life: 0.2, size: a.move === "heavy" ? 32 : 24, color: FX.hit, by: side }); // by: the renderer may tint it
    } else {
      d.kx += dir * 3;
      if (this.puppetHits) return;
      this.fx.push({ type: "spark", x: d.x - dir * 22, z: 75, age: 0, life: 0.2, size: 20, color: FX.block });
    }
  }

  // Visual only (no rule reads it): a puppet's strike reached the other puppet. `verdict` is "hit", "block" or
  // "clash", `strength` 0 to 1 is how far apart the two powers are. Harder hits shake and freeze more; a
  // counter hit freezes longest and flashes. The guest runs this too, from its own puppets, so both screens agree.
  hitLanded(side, verdict, strength) {
    const a = this.fighters[side], d = this.fighters[1 - side];
    const k = Math.max(0, Math.min(1, strength || 0)), heavy = a.move === "heavy" ? 1 : 0;
    if (verdict === "hit") {
      let stop = 0.025 + 0.045 * k + 0.02 * heavy;
      if (a.counterHit) {
        a.counterHit = false;
        stop = Math.max(stop, DU.anim.counterHitstop);
        this.fx.push({ type: "spark", x: d.x - a.facing * 8, z: 80, age: 0, life: 0.22, size: 30, color: FX.counter });
      }
      this.hitstop = Math.max(this.hitstop, stop);
      this.shake = Math.max(this.shake, 2 + 3 * k + 2 * heavy);
      d.flashT = 0.1;
    } else if (verdict === "block") {
      this.hitstop = Math.max(this.hitstop, 0.03);
      this.shake = Math.max(this.shake, 1);
    } else {
      this.hitstop = Math.max(this.hitstop, 0.04);
      this.shake = Math.max(this.shake, 1.5);
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

  // Seconds left in the round, or null when the round has no timer.
  timeLeft() {
    return this.opts && this.opts.timer > 0 ? Math.max(0, this.opts.timer - this.fightT) : null;
  }

  // The round timer ran out: the typist with more HP wins; level HP goes to whoever typed more right keys, then to the host side.
  timeUp() {
    const [a, b] = this.typists;
    let winner;
    if (Math.abs(a.hp - b.hp) > 0.5) winner = a.hp > b.hp ? 0 : 1;
    else if (a.stats.correct !== b.stats.correct) winner = a.stats.correct > b.stats.correct ? 0 : 1;
    else winner = 0;
    this.phase = "over";
    this.result = { winner, byTime: true };
    this.fighters.forEach((f) => { f.counterHit = false; });
    this.text(winner, this.fighters[winner].x, 120, "TIME", FX.ko, 40, 1.4);
    this.shake = Math.max(this.shake, 6);
  }

  damage(side, amount) {
    if (this.opts && this.opts.noDamage[side]) return;
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
    const target = Math.max(-1, Math.min(1, (this.power[0] - this.power[1]) / duelTune("tugRange")));
    this.tug += (target - this.tug) * Math.min(1, dt * 3);
    const cx = 480, gap = DU.anim.gap, push = DU.anim.push; // visual spacing only
    const m = this.mirror ? -1 : 1;   // mirror: your fighter is on the right
    this.fighters.forEach((f, i) => {
      let x = cx + m * (i === 0 ? -gap / 2 : gap / 2) + m * push * this.tug + f.kx;
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

    if (this.phase === "over") this.overT += dt;
    if (this.phase === "fight") {
      this.t += dt;
      this.fightT += dt;
      this.fightMath(dt);
      if (this.phase === "fight" && this.opts.timer > 0 && this.fightT >= this.opts.timer) this.timeUp();
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
  // Late in a long fight healing fades out (full until `healFadeStart`, gone at `healFadeEnd` seconds of duel time),
  // so two evenly matched typists cannot heal each other forever: the fight always ends.
  healFactor() {
    const a = DU.healFadeStart, b = DU.healFadeEnd, ft = this.t;
    return Math.max(0, Math.min(1, (b - ft) / (b - a)));
  }

  fightMath(dt) {
    const t = this.t;
    for (let i = 0; i < 2; i++) {
      this.wpmNow[i] = this.typists[i].wpm(t);
      this.power[i] = this.typists[i].power(t);
    }
    const blocked = Math.min(this.power[0], this.power[1]);
    // Healing follows speed. Speed and accuracy bases: each typist heals `healPerWpm` HP per second for each wpm they type.
    // Old wpm basis: both heal by the speed that was blocked.
    const fade = this.healFactor();
    const heal = (i) => fade * (DU.basis !== "wpm" ? DU.healPerWpm * this.wpmNow[i] * dt : duelTune("regenScale") * blocked * dt);

    for (let i = 0; i < 2; i++) {
      const me = this.typists[i];
      const dmg = this.opts.noDamage[i] ? 0 : damageRate(this.power[1 - i], this.power[i]) * dt;
      const afterDamage = Math.max(0, me.hp - dmg);
      const newHp = afterDamage <= 0 ? 0 : Math.min(DU.maxHp, afterDamage + heal(i)); // no healing from the grave
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

  // The state the host sends to the guest. `full` adds the slow-changing stats block (the host sends it every
  // few snapshots and at the end); only the host's word stream is sent, because the guest already has its own.
  // Numbers are rounded so the message stays small (the data channel is reliable and ordered, so a big message
  // delays the next one).
  snapshot(full) {
    const r = (v) => Math.round(v * 100) / 100;
    const stream = (s) => ({
      index: s.index, typed: s.typed, wordErrors: s.wordErrors,
      words: s.words.slice(s.index, s.index + 4).map((w) => ({
        text: w.text, ultimate: !!w.ultimate, clean: w.clean, typedFinal: w.typedFinal || "",
      })),
    });
    const fighter = (f) => ({
      x: r(f.x), z: r(f.z), vx: r(f.vx), vz: r(f.vz), facing: f.facing, kx: r(f.kx || 0),
      state: f.state, stateT: r(f.stateT), stun: r(f.stun), move: f.move, moveT: r(f.moveT),
      hitsDone: f.hitsDone, moveCount: f.moveCount, flashT: r(f.flashT), dead: !!f.dead,
      counterHit: !!f.counterHit, ult: f.ult ? { clean: !!f.ult.clean, fired: !!f.ult.fired, sparks: f.ult.sparks || 0 } : null,
    });
    const snap = {
      t: r(this.t), ft: r(this.fightT), phase: this.phase, countdown: r(this.countdown), goFlash: r(this.goFlash),
      hp: this.typists.map((x) => r(x.hp)), streak: this.typists.map((x) => r(x.streak)),
      combo: this.typists.map((x) => x.comboLevel), charge: this.typists.map((x) => r(x.charge)),
      stunUntil: this.typists.map((x) => r(x.stunUntil)), counterUntil: this.typists.map((x) => r(x.counterUntil)),
      wpm: this.wpmNow.map(r), power: this.power.map(r),
      fighters: this.fighters.map(fighter), streams: [stream(this.streams[0]), null],
      fx: this.fx.slice(-12).map((x) => Object.assign({}, x, { age: r(x.age) })),
      shake: r(this.shake), flash: r(this.flash), result: this.result ? Object.assign({}, this.result) : null,
    };
    if (full || this.phase === "over") snap.stats = this.typists.map((x) => Object.assign({}, x.stats));
    return snap;
  }

  // Guest only: between two snapshots keep the clocks, effects and fighters moving, so the picture does not
  // step at the snapshot rate. The host stays the judge: this only fills the gaps, the next snapshot corrects it.
  advanceRemote(dt) {
    if (this.phase === "menu") return;
    this.t += dt;
    if (this.phase === "countdown") this.countdown = Math.max(0, this.countdown - dt);
    if (this.phase === "fight") this.fightT += dt;
    this.goFlash = Math.max(0, this.goFlash - dt);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.shake *= Math.pow(0.0008, dt);
    if (this.shake < 0.2) this.shake = 0;
    for (const fx of this.fx) fx.age += dt;
    this.fx = this.fx.filter((fx) => fx.age < fx.life);
    for (const f of this.fighters) {
      f.flashT = Math.max(0, f.flashT - dt);
      f.kx *= Math.pow(0.002, dt);
      f.stateT += dt;
      if (f.state === "attack" && f.move && CONFIG.moves[f.move]) {
        const mv = CONFIG.moves[f.move], dur = f.move === "special" ? mv.dur : DU.anim[f.move];
        f.moveT = Math.min(mv.dur, f.moveT + dt * (mv.dur / dur));
      } else if (f.state === "air") {
        f.vz -= CONFIG.physics.gravity * dt;
        f.z = Math.max(0, f.z + f.vz * dt);
        f.vx *= Math.pow(0.3, dt);
      }
      if (typeof f.tx === "number") {
        const gap = f.tx - f.x;
        f.x = Math.abs(gap) > 250 ? f.tx : f.x + gap * Math.min(1, dt * 18); // ease toward the host's position
      }
    }
  }

  applySnapshot(s, mirror) {
    const map = mirror ? [1, 0] : [0, 1];
    this.t = s.t;
    this.fightT = s.ft || 0;
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
        const keepX = f.x;
        Object.assign(f, rf);
        if (mirror) {
          f.x = this.arenaWidth - rf.x;
          f.vx = -rf.vx;
          f.kx = -(rf.kx || 0);
          f.facing = -rf.facing;
        }
        f.tx = f.x;                                  // the host's position is the target ...
        if (typeof keepX === "number" && Math.abs(f.tx - keepX) < 250 && this.phase !== "over") f.x = keepX; // ... eased by advanceRemote
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
