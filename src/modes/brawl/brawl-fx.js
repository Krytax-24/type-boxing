/**
 * Brawl fx: what a Backspace Brawl fight looks and sounds like. The designed 2D fighters (fighter-stage.js) are
 * puppets driven by the rules: the rules decide where a fighter is and what it does, and each fighter's own
 * animation plays to match, started on the frame the rules start the move and timed to the same length (the frame
 * data is read from those same animations). On top: sparks, rings, floating texts, shake, flash and hit-stop.
 * Visual only, except hit-stop, which the host also uses to hold the rules for a few frames on a big hit.
 */
CounterType.define(
  "brawl-fx",
  ["brawl-config", "brawl-rules", "fighter-stage", "characters", "audio"],
  (CONFIG, Brawl, DuelChars, Chars, Sfx) => {
    "use strict";

    const B = CONFIG.brawl;
    const FXC = CONFIG.theme.fx;
    const DRAW_SOUND = {
      daggerLash: "whip",
      cyberSword: "slash",
      katana: "slash",
      bat: "bat",
      staff: "staff",
      axe: "axe",
      reaverAxe: "axe",
      warHammer: "hammer",
      pistols: "gun",
    };
    const TAUNT_AFTER = 30; // frames after the end before the winner taunts

    const rgb = (hex) => {
      const n = parseInt(String(hex).slice(1), 16);
      return `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`;
    };
    const defOf = (key) => Chars.DEFS[key] || Chars.DEFS[Chars.ORDER[0]];

    const stage = new DuelChars.Stage({ audible: true });
    const fx = { list: [], shake: 0, flash: 0, hitstop: 0 };
    let chars = ["cyborg", "ronin"];
    let prev = [];
    let dead = [false, false];
    let taunted = [false, false];

    const hitSound = (side) => DRAW_SOUND[defOf(chars[side]).weaponDraw] || "punch";
    const trailOf = (side) => (B.chars[chars[side]] || B.chars.cyborg).trail;
    const blank = () => ({ st: "ground", mv: null, fr: 0, dash: 0, y: 0 });

    /** New puppets for a fight between `fighterKeys` in these glow colors. */
    function setup(fighterKeys, glowColors, state) {
      chars = fighterKeys.slice();
      stage.setPuppets(
        chars.map((key, i) => ({ key, x: B.startX[i], facing: i ? -1 : 1, seed: 7 + i, glow: rgb(glowColors[i]) })),
      );
      stage.judge = null;
      stage.after = (p, i, ch) => {
        const f = state() && state().f[i];
        if (!f) return;
        ch.x = f.x;
        if (f.y > 0.5) {
          ch.state = "air";
          ch.jumpY = f.y;
          ch.vy = f.vy;
        }
      };
      prev = [blank(), blank()];
      dead = [false, false];
      taunted = [false, false];
    }

    /** Clears the effects for a new round. */
    function reset() {
      fx.list = [];
      fx.shake = 0;
      fx.flash = 0;
      fx.hitstop = 0;
    }

    // Fed to the fighters each step: walking and crouching, and the jump kept in step with the rules.
    function puppetInputs(state) {
      return stage.p.map((p, i) => {
        const f = state.f[i];
        const ch = p.ch;
        if (f.y > 0.5) {
          if (ch.state !== "air") {
            ch.state = "air";
            ch.airT = 0;
            ch.cut = true;
            ch.xfade(0.1);
          }
          ch.jumpY = f.y + 12;
          ch.vy = f.vy;
        } else if (ch.state === "air" || ch.state === "prejump") {
          ch.state = "ground";
          ch.jumpY = 0;
          ch.vy = 0;
          ch.airAttacked = false;
          ch.cut = false;
          ch.crouchV += 3;
          if (ch.action && ch.action.c.air) {
            ch.action = null;
            ch.xfade(0.1);
          }
        }
        const walking = f.st === "ground" && !f.dash && !f.lag && Math.abs(f.vx) > 20;
        return { move: walking ? Math.sign(f.vx) : 0, crouch: f.crouch && f.y <= 0.5 && f.st !== "attack" };
      });
    }

    function play(p, name, frames) {
      const ch = p.ch;
      const clip = ch.clips[name];
      if (!clip) return false;
      ch.queue = [];
      ch.comboName = null;
      ch.buffer = null;
      if (clip.air) ch.airAttacked = true;
      // action.speed = speed / tempo, and an animation lasts dur / action.speed: ask for `frames` frames.
      ch.startAction(clip, frames ? (clip.dur * ch.St.tempo * 60) / frames : 1);
      return true;
    }

    function startAttack(ch, f, i) {
      const info = Brawl.moveInfo(chars[i], f.mv, f.lvl);
      const clip = ch.clips[info.clip] || ch.clips.a1;
      if (!clip) return;
      ch.queue = [];
      ch.comboName = null;
      ch.buffer = null;
      if (clip.air) ch.airAttacked = true;
      ch.startAction(clip, info.spd);
    }

    /** After every rules step (and for the guest every frame): starts the animation that matches what just began. */
    function drive(state) {
      state.f.forEach((f, i) => {
        const p = stage.p[i];
        const ch = p.ch;
        const pv = prev[i];
        const restarted = f.fr < pv.fr;
        if (f.st === "attack" && (pv.st !== "attack" || pv.mv !== f.mv || restarted)) {
          startAttack(ch, f, i);
        } else if (f.st === "hit" && (pv.st !== "hit" || restarted) && f.hp > 0) {
          if (f.kd) play(p, "knockdown", 23 + B.downFrames);
          else play(p, f.stun >= 20 && ch.clips.hitHeavy ? "hitHeavy" : "hit", Math.max(8, f.stun + 2));
        } else if (f.st === "block" && (pv.st !== "block" || restarted)) {
          play(p, "parry", f.stun + 4);
        } else if (f.st === "down" && !(ch.action && ch.action.c.react) && f.hp > 0) {
          play(p, "knockdown", B.downFrames + 10);
        } else if (
          (f.st === "ground" || f.st === "air") &&
          pv.st !== f.st &&
          ch.action &&
          !ch.dead &&
          !ch.action.c.idleBreak &&
          (pv.st === "attack" || pv.st === "block" || pv.st === "hit" || pv.st === "down")
        ) {
          ch.action = null;
          ch.xfade(0.1);
        }
        if (f.dash > 0 && !pv.dash && !ch.action) ch.dash(f.face * f.dd);
        if (state.phase === "over" && f.hp <= 0 && !dead[i]) {
          dead[i] = true;
          const death = ch.clips.death;
          if (death) {
            ch.queue = [];
            ch.startAction(death, 1);
          }
        }
        if (state.phase === "over" && f.hp > 0 && state.overFr > TAUNT_AFTER && !taunted[i] && !ch.action) {
          taunted[i] = true;
          play(p, "taunt", 0);
        }
        pv.st = f.st;
        pv.mv = f.mv;
        pv.fr = f.fr;
        pv.dash = f.dash;
        pv.y = f.y;
      });
    }

    // ---------- Effects ----------

    const push = (o) => fx.list.push(Object.assign({ age: 0 }, o));
    const text = (x, z, str, color, size, life) =>
      push({ type: "text", x, z, life: life || 0.8, text: str, color, size, rise: 40 });
    const side = (e, near) => e.x + (e.side ? near : -near);

    /** One rule event: sparks, texts, shake and sound. */
    function onEvent(e) {
      switch (e.type) {
        case "hit": {
          const attacker = 1 - e.side;
          const big = e.n >= 8;
          stage.sparks(e.x, -e.y, big ? 14 : 8, trailOf(attacker), big ? 1.2 : 0.9);
          text(side(e, 30), e.y + 40, "-" + e.n, FXC.ult, 24);
          fx.shake = Math.max(fx.shake, big ? 7 : 3.5);
          fx.hitstop = Math.max(fx.hitstop, big ? 4 : 2);
          Sfx.play(hitSound(attacker), big ? 1 : 0);
          Sfx.play("hurt");
          break;
        }
        case "boom":
          stage.sparks(e.x, -e.y, 16, trailOf(1 - e.side), 1.4);
          text(side(e, 30), e.y + 40, "-" + e.n, FXC.ult, 28);
          push({ type: "ring", x: e.x, z: 0, life: 0.45, color: FXC.counter });
          fx.shake = Math.max(fx.shake, 9);
          fx.hitstop = Math.max(fx.hitstop, 5);
          Sfx.play("hammer", 1);
          break;
        case "block":
          stage.star(e.x, -e.y);
          text(side(e, 30), e.y + 30, "BLOCK", FXC.block, 16, 0.5);
          Sfx.play("parry");
          break;
        case "combo":
          text(e.x, e.y, e.n + " HIT COMBO", FXC.combo, 20, 0.9);
          Sfx.play("combo", e.n);
          break;
        case "fin": {
          const finisher = Brawl.combosOf(chars[e.side])[e.n];
          if (finisher) text(e.x, e.y, finisher.name.toUpperCase(), FXC.ult, 22, 1.0);
          fx.shake = Math.max(fx.shake, 4);
          break;
        }
        case "cast":
          Sfx.play("flame");
          break;
        case "super":
          fx.flash = 0.8;
          fx.shake = Math.max(fx.shake, 6);
          Sfx.play("flame", 1);
          text(e.x, 190, "SUPER", FXC.ult, 30, 0.9);
          break;
        case "dp":
          Sfx.play("whoosh", 1);
          break;
        case "dash":
          Sfx.play("whoosh", 0);
          stage.dust(e.x, 5, 30, -Math.sign(e.n || 1), 0.8);
          break;
        case "clash":
          stage.sparks(e.x, -e.y, 12, "255, 255, 255", 1);
          Sfx.play("parry");
          break;
        case "jump":
          Sfx.play("step");
          break;
        case "land":
          push({ type: "ring", x: e.x, z: 0, life: 0.3, color: FXC.block });
          break;
        case "thud":
          Sfx.play("thud");
          push({ type: "ring", x: e.x, z: 0, life: 0.45, color: FXC.hit });
          break;
        case "ko":
          text(B.arena.width / 2, 150, "K.O.", FXC.counter, 54, 1.4);
          fx.flash = 1;
          fx.shake = 14;
          Sfx.play("ko");
          break;
        case "time":
          text(B.arena.width / 2, 150, "TIME", FXC.counter, 44, 1.4);
          Sfx.play("ko");
          break;
        default:
          break; // "wave" and anything new: no effect
      }
    }

    // ---------- Drawing ----------

    // The renderer's world for a Brawl fight: the shared arena, no duel fighters (the puppets draw themselves).
    const view = {
      arenaWidth: B.arena.width,
      cameraX: B.arena.width / 2,
      floorY: B.floorY,
      enemies: [],
      fx: [],
      shake: 0,
      flash: 0,
      phase: "fight",
      fighters: [],
      puppetHits: false,
    };

    function viewFighters(state, colors) {
      return state.f.map((f, i) => ({
        x: f.x,
        z: f.y,
        facing: f.face,
        state: f.st === "down" ? "down" : "idle",
        move: null,
        moveT: 0,
        moveCount: 0,
        color: colors[i],
        weaponLook: null,
        flashT: f.flash > 0 ? 1 : 0,
        team: i === 0 ? "player" : "enemy",
        dead: false,
      }));
    }

    /** Ages the effects and draws the fight. */
    function draw(renderer, state, colors, dt, frozen) {
      const step = frozen ? 0 : dt;
      fx.list.forEach((o) => {
        o.age += step;
      });
      fx.list = fx.list.filter((o) => o.age < o.life);
      fx.shake *= Math.pow(0.002, step);
      fx.flash = Math.max(0, fx.flash - step * 2.5);
      view.fighters = viewFighters(state, colors);
      const orbs = state.pr.map((q) => ({
        type: "orb",
        x: q.x,
        z: q.y,
        age: 0,
        life: 1,
        size: q.big ? 34 : 14 + 3 * q.lvl,
        dir: q.vx >= 0 ? 1 : -1,
        color: `rgb(${trailOf(q.o)})`,
      }));
      view.fx = fx.list.concat(orbs);
      view.shake = fx.shake;
      view.flash = fx.flash;
      const stageDt = frozen || fx.hitstop > 0 ? 0 : dt;
      view.puppets = (ctx, sx, floorY, d, copt) => {
        stage.advance(stageDt, () => puppetInputs(state));
        ctx.save();
        ctx.translate(sx(0), floorY);
        stage.draw(ctx, copt);
        ctx.restore();
      };
      renderer.draw(view, step);
    }

    return Object.freeze({ fx, setup, reset, drive, onEvent, draw, defOf });
  },
);
