// Rule checks for the Brawl fighting mode (brawl-rules.js). Run: node tests/brawl-sim.js
const crypto = require("crypto");
const { load: loadModules } = require("./support/loader");
const ctx = loadModules(["brawl-rules", "clips"]).legacy;
const Br = ctx.Brawl,
  B = ctx.CONFIG.brawl,
  IN = Br.IN;
let failed = 0;
function check(name, ok) {
  console.log((ok ? "  ok   " : "  FAIL ") + name);
  if (!ok) failed++;
}

// Run n frames, feeding the masks returned by fn(s, frame).
function run(s, n, fn) {
  for (let i = 0; i < n; i++) {
    const m = fn ? fn(s, i) : [0, 0];
    Br.step(s, m[0], m[1]);
  }
  return s;
}
function ready(opts, seed) {
  const s = Br.create(seed || 1, Object.assign({ chars: ["cyborg", "ronin"] }, opts));
  run(s, B.countdown * 60);
  return s;
}
function near(s, gap) {
  s.f[0].x = 400;
  s.f[1].x = 400 + gap;
  return s;
}
// Press a button (or buttons) for one frame by player 0, then release.
const tap = (bit) => (s, i) => [i === 0 ? bit : 0, 0];
// Feed a list of masks for player 0, one frame each, with player 1 doing `other`.
const feed = (list, other) => (s, i) => [list[i] || 0, other || 0];
const F = IN.R,
  DF = IN.D | IN.R; // forward and down forward for a fighter facing right
const qcf = (btn) => [IN.D, IN.D, DF, DF, F, F | btn]; // down, down forward, forward + button
const dpm = (btn) => [F, F, IN.D, IN.D, DF | btn]; // forward, down, down forward + button
const mv = (name, lvl) => Br.moveInfo("cyborg", name, lvl || 0);

console.log("Basics");
{
  const s = Br.create(5);
  check("starts in a countdown of three seconds", s.phase === "countdown" && s.cd === 180);
  run(s, 179);
  check("still counting after 179 frames", s.phase === "countdown");
  run(s, 1);
  check("the fight starts after 180 frames", s.phase === "fight");
  const w = ready();
  const x0 = w.f[0].x;
  run(w, 30, () => [IN.R, 0]);
  check("holding right walks right", w.f[0].x > x0 + 50);
  const j = ready();
  run(j, 2, () => [IN.U, 0]);
  check("up jumps", j.f[0].y > 0 && j.f[0].st === "air");
  run(j, 60, () => [0, 0]);
  check("and you land again", j.f[0].y === 0 && j.f[0].st === "ground");
  const c = ready();
  run(c, 3, () => [IN.D, 0]);
  check("down crouches", c.f[0].crouch === true);
  const e = ready();
  e.f[0].x = B.arena.left + 1;
  run(e, 60, () => [IN.L, 0]);
  check("the arena has walls", e.f[0].x >= B.arena.left);
  const t = ready();
  near(t, 30);
  run(t, 30, () => [IN.R, IN.L]);
  check("fighters cannot walk through each other", Math.abs(t.f[0].x - t.f[1].x) >= B.halfW * 2 - 0.5);
}

console.log("Frame data comes from the fighters' own animations");
{
  const keys = Object.keys(B.chars);
  check("all eleven fighters have data", keys.length === 11);
  check(
    "every move has sane frames for every fighter",
    keys.every((k) =>
      Br.MV.filter((n) => n).every((n) => {
        const m = Br.moveInfo(k, n, 1);
        return m.startup >= 3 && m.total > m.startup && m.cancel >= m.startup && m.reach > 20;
      }),
    ),
  );
  check(
    "a heavy weapon is slower than bare fists",
    Br.moveInfo("barbarian", "hp").total > Br.moveInfo("grin", "hp").total,
  );
  check("the low punch is faster than the high kick", mv("lp").total < mv("hk").total);
  check(
    "damage grows with the button strength",
    mv("lp").dmg < mv("hp").dmg && mv("lk").dmg < mv("hk").dmg && mv("hp").dmg < mv("hk").dmg,
  );
  check(
    "kicks reach farther than punches of the same height",
    mv("lk").reach > mv("lp").reach && mv("hk").reach > mv("hp").reach,
  );
  check(
    "low buttons hit low, high buttons do not",
    mv("lp").h === "low" && mv("lk").h === "low" && mv("hp").h === "high" && mv("hk").h === "mid",
  );
  check(
    "every fighter has three finishers with their own names",
    Object.keys(B.chars).every(
      (k) => Br.combosOf(k).length === 3 && new Set(Br.combosOf(k).map((c) => c.name)).size === 3,
    ),
  );
  check(
    "fighters differ: no two share the same finisher strings",
    new Set(
      Object.keys(B.chars).map((k) =>
        Br.combosOf(k)
          .map((c) => c.seq)
          .join("|"),
      ),
    ).size >= 9,
  );
  check(
    "the long weapon outreaches the short one",
    Br.moveInfo("voss", "hp").reach > Br.moveInfo("dancer", "hp").reach,
  );
}

console.log("The four buttons");
{
  for (const [btn, bit] of [
    ["lp", IN.LP],
    ["hp", IN.HP],
    ["lk", IN.LK],
    ["hk", IN.HK],
  ]) {
    const s = near(ready(), 70);
    run(s, 90, tap(bit));
    check(`${btn.toUpperCase()} hits for its own damage`, s.f[1].hp === B.hp - mv(btn).dmg);
  }
  const far = near(ready(), 260);
  run(far, 60, tap(IN.HP));
  check("an attack out of range whiffs", far.f[1].hp === B.hp);
  const sl = near(ready(), 100);
  run(sl, 5, () => [IN.D, 0]);
  run(sl, 60, (st, i) => [IN.D | (i === 0 ? IN.HK : 0), 0]);
  check(
    "crouch + heavy kick sweeps the other fighter down",
    sl.f[1].hp < B.hp && (sl.f[1].st === "hit" || sl.f[1].st === "down"),
  );
  const dk = near(ready(), 70);
  run(dk, 3, () => [0, IN.D]);
  run(dk, 30, (st, i) => [i === 0 ? IN.HP : 0, IN.D]);
  check("a high punch misses a crouching fighter", dk.f[1].hp === B.hp);
  const lw = near(ready(), 70);
  run(lw, 3, () => [0, IN.D]);
  run(lw, 30, (st, i) => [i === 0 ? IN.LP : 0, IN.D]);
  check("a low punch hits a crouching fighter", lw.f[1].hp < B.hp);
  const ja = near(ready(), 60);
  run(ja, 4, () => [IN.U, 0]);
  let kicked = false;
  run(ja, 30, (st) => {
    const m0 = !kicked && st.f[0].y > 40 ? IN.HK : 0;
    if (m0) kicked = true;
    return [m0, 0];
  });
  check("a jump kick can hit", ja.f[1].hp < B.hp);
}

console.log("Blocking");
{
  const b3 = near(ready(), 70);
  run(b3, 60, (s, i) => [i === 0 && s.fr < 3 ? IN.HP : 0, IN.R]);
  check("holding back blocks a punch", b3.f[1].hp === B.hp && b3.f[0].hit === true);
  const lo = near(ready(), 70);
  run(lo, 4, () => [IN.D, IN.R]);
  run(lo, 60, (s, i) => [s.fr < 8 ? IN.D | IN.LK : IN.D, IN.R]);
  check("a low kick goes through a standing block", lo.f[1].hp < B.hp);
  const lo2 = near(ready(), 70);
  run(lo2, 4, () => [IN.D, IN.R | IN.D]);
  run(lo2, 60, (s) => [s.fr < 8 ? IN.D | IN.LK : IN.D, IN.R | IN.D]);
  check("but a crouching block stops it", lo2.f[1].hp === B.hp && lo2.f[0].hit === true);
}

console.log("Combos");
{
  // A low punch that lands, then a high punch pressed once the animation allows the cancel.
  const s = near(ready(), 70);
  const lp = mv("lp");
  let peak = 0;
  run(s, 60, (st) => {
    peak = Math.max(peak, st.combo[0]);
    return [st.fr === 0 ? IN.LP : st.fr === lp.cancel ? IN.HP : 0, 0];
  });
  check("a landed low punch chains into a high punch", peak >= 2 && s.f[1].hp < B.hp - mv("lp").dmg);
  check("the second hit of a combo is scaled", s.dealt[0] <= mv("lp").dmg + mv("hp").dmg * B.comboScale[1]);
  const w = near(ready(), 70);
  let peak2 = 0;
  run(w, 80, (st) => {
    peak2 = Math.max(peak2, st.combo[0]);
    return [st.fr === 0 ? IN.HP : st.fr === mv("hp").cancel ? IN.LP : 0, 0];
  });
  check("you cannot chain back down to a weaker button", peak2 === 1);
  const m = near(ready(), 70);
  run(m, 60, (st) => [st.fr === 0 ? IN.LP : st.fr === 2 ? IN.HP : 0, 0]);
  check("a chain button pressed too early waits for the cancel window", m.combo[0] >= 2 || m.f[1].hp < B.hp);
  const sp = ready();
  // Light punch lands, then the fireball motion is pressed during its recovery: the special cancel.
  const lp2 = mv("lp");
  const seq = {};
  seq[0] = IN.LP;
  const q = qcf(IN.LP);
  q.forEach((m0, k) => {
    seq[lp2.startup + 2 + k] = m0;
  });
  sp.f[1].x = sp.f[0].x + 70;
  run(sp, 80, (st) => [seq[st.fr] || 0, 0]);
  check(
    "a fireball motion cancels a landed normal",
    (sp.pr.length >= 0 && sp.f[0].mv === "fire") || sp.pr.length > 0 || sp.f[1].hp < B.hp - mv("lp").dmg,
  );
}

console.log("Motions and specials");
{
  const s = ready();
  near(s, 600);
  run(s, 30, feed(qcf(IN.HP)));
  check("down, down forward, forward + punch throws a fireball", s.pr.length === 1 && s.pr[0].vx > 0);
  const sw = ready();
  near(sw, 700);
  run(sw, 30, feed(qcf(IN.LP)));
  const slow = sw.pr[0] && sw.pr[0].vx;
  const hv = ready();
  near(hv, 700);
  run(hv, 30, feed(qcf(IN.HP)));
  const fast = hv.pr[0] && hv.pr[0].vx;
  check("a heavy punch fireball is faster than a light one", slow > 0 && fast > slow);
  const one = ready();
  near(one, 600);
  run(one, 30, feed(qcf(IN.LP)));
  const before = one.pr.length;
  run(one, 8, feed(qcf(IN.LP)));
  check("only one fireball per fighter on screen", before === 1 && one.pr.length <= 1);
  const h = ready();
  near(h, 380);
  run(h, 200, feed(qcf(IN.HP)));
  check("the fireball travels and hits", h.f[1].hp < B.hp);
  const no = ready();
  near(no, 400);
  run(no, 40, feed([IN.D, IN.D, DF, DF, IN.HP]));
  check("a wrong motion is just a punch", no.pr.length === 0);
  const sh = ready();
  near(sh, 400);
  run(sh, 20, tap(IN.FB));
  check("Q throws the fighter's projectile without a motion", sh.pr.length === 1);
  const rr = ready();
  near(rr, 70);
  run(rr, 40, tap(IN.DP));
  check("R is the rising move and it launches", rr.f[1].hp < B.hp && rr.f[1].kd === true);
  const both = ready();
  both.f[0].meter = 100;
  near(both, 500);
  run(both, 30, feed([IN.FB, IN.FB | IN.DP]));
  check("Q and R together are the super", both.f[0].meter === 100 - B.superCost && both.pr.some((q) => q.big === 1));
  const lag = ready();
  lag.f[0].meter = 100;
  near(lag, 500);
  run(lag, 30, feed([IN.FB, 0, IN.FB | IN.DP]));
  check("R a frame or two after Q still makes the super", lag.f[0].meter === 100 - B.superCost);
  const cyb = Br.moveInfo("cyborg", "fire", 1),
    grn = Br.moveInfo("grin", "fire", 1);
  check("each fighter's Q is different", cyb.speed !== grn.speed && cyb.dmg !== grn.dmg);
  const dp = ready();
  near(dp, 70);
  run(dp, 3, () => [0, 0]);
  run(dp, 40, feed(dpm(IN.HP)));
  check("forward, down, down forward + punch is an uppercut that launches", dp.f[1].hp < B.hp && dp.f[1].kd === true);
  const dp2 = ready();
  near(dp2, 400);
  run(dp2, 40, feed(dpm(IN.LP)));
  check("the uppercut leaves the ground", dp2.f[0].mv === "dp" || dp2.f[0].lag > 0 || dp2.f[0].y > 0);
  const su = ready();
  su.f[0].meter = 100;
  near(su, 500);
  run(su, 40, feed([IN.D, IN.D, DF, F, IN.D, DF, F, IN.D, IN.D, DF, F, F | IN.HP].slice(0, 0)));
  const sup = ready();
  sup.f[0].meter = 100;
  near(sup, 500);
  run(sup, 30, feed([IN.D, DF, F, IN.D, DF, F | IN.HP]));
  check(
    "the fireball motion twice + punch is a super that costs meter",
    sup.f[0].meter === 100 - B.superCost && sup.pr.some((q) => q.big === 1),
  );
  const nm = ready();
  near(nm, 500);
  run(nm, 70, feed([IN.D, DF, F, IN.D, DF, F | IN.HP]));
  check(
    "with no meter the super motion only throws a fireball",
    nm.pr.every((q) => !q.big),
  );
  const sk = ready();
  sk.f[0].meter = 100;
  near(sk, 450);
  run(sk, 3, tap(IN.SU));
  check("the super shortcut button works", sk.f[0].meter === 100 - B.superCost);
}

console.log("Fighter finishers");
{
  // Play each fighter's first finisher string with perfect timing: land a hit, press the next button at the cancel
  // frame.
  let ok = 0;
  for (const k of Object.keys(B.chars)) {
    const cb = Br.combosOf(k)[0],
      btns = cb.seq.split(",");
    const s = Br.create(4, { chars: [k, "ronin"] });
    run(s, 181);
    near(s, 60);
    let step = 0,
      nextAt = 0,
      seen = false;
    run(s, 400, (st) => {
      const f = st.f[0];
      if (f.mv === "f0") seen = true;
      if (step < btns.length && st.fr >= nextAt) {
        const nm = btns[step],
          bit = Br.BIT[nm];
        if (step === 0 || (f.st === "attack" && f.hit && f.fr >= Br.moveInfo(k, f.mv, 1).cancel)) {
          step++;
          nextAt = st.fr + 2;
          st.f[1].x = st.f[0].x + 60;
          return [bit, 0];
        }
      }
      return [0, 0];
    });
    if (seen) ok++;
    else console.log("       no finisher for " + k + " " + cb.seq);
  }
  check("every fighter can land its first finisher string", ok === Object.keys(B.chars).length);
  const z = Br.create(4, { chars: ["cyborg", "ronin"] });
  run(z, 181);
  near(z, 60);
  z.f[0].st = "attack";
  z.f[0].mv = "lp";
  z.f[0].seq = ["lp"];
  const m = Br.moveInfo("cyborg", "f0", 0);
  check("a finisher hits harder than any single button", m.dmg > Br.moveInfo("cyborg", "hk").dmg && m.kd === true);
}

console.log("Throw and dash");
{
  const t = near(ready(), 70);
  run(t, 40, tap(IN.LP | IN.LK));
  check("light punch + light kick together throws", t.f[1].hp === B.hp - B.throwMove.dmg && t.f[1].st !== "ground");
  const tb = near(ready(), 70);
  run(tb, 40, (s, i) => [i === 0 && s.fr < 3 ? IN.LP | IN.LK : 0, IN.R]);
  check("a throw cannot be blocked", tb.f[1].hp < B.hp);
  const tf = near(ready(), 200);
  run(tf, 40, tap(IN.LP | IN.LK));
  check("a throw from far away whiffs", tf.f[1].hp === B.hp);
  const d = ready();
  run(d, 40, (s, i) => [[1, 0, 1].includes(i) ? 0 : i === 3 ? 0 : 0, 0]);
  const dd = ready();
  const xs = dd.f[0].x;
  const pattern = [];
  pattern[1] = IN.R;
  pattern[2] = 0;
  pattern[3] = IN.R;
  for (let k = 4; k < 8; k++) pattern[k] = 0;
  run(dd, 8, feed(pattern));
  const dashed = dd.f[0].x - xs;
  const wk = ready();
  const xw = wk.f[0].x;
  run(wk, 8, feed([IN.R, IN.R, IN.R, IN.R, IN.R, IN.R, IN.R, IN.R]));
  check("tapping forward twice dashes farther than walking", dashed > wk.f[0].x - xw + 10);
  const bs = ready();
  const xb = bs.f[0].x;
  const bp = [];
  bp[1] = IN.L;
  bp[3] = IN.L;
  run(bs, 25, feed(bp));
  check("tapping back twice steps backward", bs.f[0].x < xb - 40);
  const iv = ready();
  near(iv, 70);
  const bp2 = [];
  bp2[1] = IN.L;
  bp2[3] = IN.L;
  run(iv, 6, (s) => [bp2[s.fr] || 0, 0]);
  check("the back step is briefly untouchable", iv.f[0].inv > 0 || iv.f[0].dash > 0);
}

console.log("Knockdown and wake up");
{
  const s = near(ready(), 70);
  s.f[0].meter = 0;
  run(s, 80, feed([IN.D, IN.D, IN.D, IN.D, IN.D | IN.HK]));
  check(
    "a heavy sweep knocks down and the fighter wakes with a moment of safety",
    s.f[1].st === "down" || s.f[1].kd || s.f[1].inv > 0,
  );
}

console.log("Rounds");
{
  const s = near(ready({ timer: 30 }), 70);
  run(s, 30 * 60, () => [0, 0]);
  check("the round timer ends the round", s.phase === "over" && s.byTime === true);
  const k = near(ready(), 70);
  k.f[1].hp = 3;
  run(k, 60, tap(IN.LP));
  check("a knock out ends the round with the right winner", k.phase === "over" && k.winner === 0 && k.byTime === false);
  const nd = near(ready({ noDamage: [false, true] }), 70);
  run(nd, 90, tap(IN.LP));
  check("a fighter with damage off cannot lose HP", nd.f[1].hp === B.hp);
  const tm = near(ready({ timer: 30 }), 70);
  tm.f[0].hp = 50;
  run(tm, 30 * 60, () => [0, 0]);
  check("on time, higher HP wins", tm.winner === 1);
}

console.log("Meter");
{
  const s = near(ready(), 60);
  run(s, 40, tap(IN.HP));
  check("landing a hit builds meter for both sides", s.f[0].meter > 0 && s.f[1].meter > 0);
  check("damage scales down inside a combo", B.comboScale[2] < B.comboScale[1] && B.comboScale[5] < B.comboScale[2]);
}

console.log("Every fighter can play");
{
  let bad = 0;
  for (const k of Object.keys(B.chars)) {
    const s = Br.create(3, { chars: [k, "ronin"] });
    run(s, 181);
    near(s, 90);
    for (let i = 0; i < 400; i++) {
      Br.step(s, [IN.LP, IN.HP, IN.LK, IN.HK, 0, 0][(i >> 3) % 6] | (i % 50 < 10 ? IN.R : 0), 0);
    }
    if (!Number.isFinite(s.f[0].x + s.f[1].hp) || s.f[1].hp >= B.hp) bad++;
  }
  check("all eleven fighters land hits with the four buttons", bad === 0);
}

console.log("Bot and determinism");
{
  function match(seed, lvlA, lvlB) {
    const s = Br.create(seed, { timer: 60, chars: ["cyborg", "ronin"] });
    const A = [Br.newAi(B.bots[lvlA]), Br.newAi(B.bots[lvlB])];
    let guard = 0;
    while (s.phase !== "over" && guard++ < 60 * 60 * 3) Br.step(s, Br.botInput(s, 0, A[0]), Br.botInput(s, 1, A[1]));
    return s;
  }
  const a = match(11, 1, 1),
    b = match(11, 1, 1);
  check("the same seed plays the same fight", JSON.stringify(a.f) === JSON.stringify(b.f) && a.fr === b.fr);
  const wins = [0, 0, 0];
  let ended = 0,
    nan = 0,
    dealt = 0;
  for (let i = 0; i < 60; i++) {
    const s = match(100 + i, 2, 0);
    if (s.phase === "over") ended++;
    if (s.f.some((f) => !Number.isFinite(f.x + f.y + f.hp))) nan++;
    wins[s.winner]++;
    dealt += s.dealt[0] + s.dealt[1];
  }
  check("bot matches always end and never produce bad numbers", ended === 60 && nan === 0);
  check("a champion beats a rookie most of the time", wins[0] >= 40);
  check("the bots really fight (damage is dealt)", dealt / 60 > 40);
  const asBot = (lvl) => {
    let w = 0;
    for (let i = 0; i < 40; i++) {
      const s = match(500 + i, lvl, 1);
      if (s.winner === 0) w++;
    }
    return w;
  };
  console.log(
    `       win rate against a fighter-level bot: rookie ${asBot(0)}/40, fighter ${asBot(1)}/40, champion ${asBot(2)}/40`,
  );
}

console.log("Snapshots");
{
  const s = near(ready(), 70);
  run(s, 8, tap(IN.HP));
  const snap = JSON.parse(JSON.stringify(Br.snapshot(s, [{ type: "hit", side: 1, x: 400, y: 90, n: 5 }])));
  const g = Br.create(1, { chars: ["cyborg", "ronin"] });
  Br.applySnapshot(g, snap);
  check(
    "a snapshot rebuilds the fight",
    Math.abs(g.f[1].x - s.f[1].x) < 0.1 &&
      g.f[1].hp === s.f[1].hp &&
      g.f[0].st === s.f[0].st &&
      g.f[0].mv === s.f[0].mv &&
      g.phase === s.phase,
  );
  check("a snapshot is small", JSON.stringify(snap).length < 1400);
  check("events travel with it", Br.eventsOf(snap)[0].type === "hit");
  const ext = Br.clone(g);
  Br.step(ext, g.in[0], 0);
  check("a copy of a snapshot can be stepped forward", ext.fr === g.fr + 1);
}

console.log("Replays (a change here means the rules play differently: on purpose, update the hash)");
{
  // Bot against bot from a fixed seed, to the end of the fight: the whole final state must match, frame for frame.
  // The hashes were recorded from the rules as they shipped (and match the October 2026 build before v2).
  const replays = [
    [11, ["cyborg", "ronin"], [2, 2], 2496, "c06b653b1abea3a6"],
    [22, ["bluex", "barbarian"], [1, 2], 1437, "fa92a83205df204d"],
    [33, ["dancer", "grin"], [2, 0], 930, "68101402df4d08ec"],
    [44, ["veil", "varun"], [1, 1], 2022, "b1c679e70896e45f"],
    [55, ["flame", "reaver"], [2, 1], 1874, "19b0f4c4caadba50"],
  ];
  for (const [seed, chars, levels, frames, hash] of replays) {
    const s = Br.create(seed, { chars });
    const ai = levels.map((l) => Br.newAi(B.bots[l]));
    let n = 0;
    while (s.phase !== "over" && n < 60 * 200) {
      Br.step(s, Br.botInput(s, 0, ai[0]), Br.botInput(s, 1, ai[1]));
      n++;
    }
    const got = crypto.createHash("sha1").update(JSON.stringify(s)).digest("hex").slice(0, 16);
    check(
      `${chars.join(" vs ")} (seed ${seed}) replays the same ${frames} frames (${got})`,
      n === frames && got === hash,
    );
  }
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll brawl checks passed");
process.exitCode = failed ? 1 : 0;
