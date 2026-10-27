// Headless checks for ranked play and matchmaking (ranked.js). No browser, no libraries.
// Run from the project folder:   node tests/ranked-sim.js
const { load: loadModules } = require("./support/loader");

// Profile keeps your identity in localStorage: the tests give it a plain in-memory stand-in.
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}
const load = () => loadModules(["ranked", "profile", "words"], { globals: { localStorage: memoryStorage() } }).legacy;

let failed = 0;
function check(name, ok) {
  console.log((ok ? "  ok   " : "  FAIL ") + name);
  if (!ok) failed++;
}
const g = load(),
  R = g.Ranked,
  K = g.CONFIG.ranked;

console.log("Rating");
{
  const [a, b] = R.rate([R.newRating(), R.newRating()], [1, 2]);
  check(
    "the winner gains mu and the loser loses the same amount",
    a.mu > K.mu && b.mu < K.mu && Math.abs(a.mu - K.mu + (b.mu - K.mu)) < 1e-9,
  );
  check("both become more certain (sigma shrinks)", a.sigma < K.sigma && b.sigma < K.sigma);
  const [c, d] = R.rate([R.newRating(), R.newRating()], [1, 1]);
  check("a tie between equals changes no mu", Math.abs(c.mu - K.mu) < 1e-9 && Math.abs(d.mu - K.mu) < 1e-9);
  const six = R.rate(
    [1, 2, 3, 4, 5, 6].map(() => R.newRating()),
    [1, 2, 3, 4, 5, 6],
  );
  check(
    "a 6-racer result orders the new ratings by place",
    six.every((r, i) => i === 0 || r.mu < six[i - 1].mu),
  );
  const strong = { mu: 35, sigma: 2 },
    weak = { mu: 20, sigma: 2 };
  const up = R.rate([weak, strong], [1, 2])[0].mu - weak.mu,
    down = R.rate([strong, weak], [1, 2])[0].mu - strong.mu;
  check("an upset moves the rating more than an expected win", up > down);
  check("win chance favors the stronger player", R.winChance(strong, weak) > 0.8);
  check("a new player starts at 1000 MMR", R.mmr(R.newRating()) === 1000);
}

console.log("Tiers");
{
  const t = (rp, rank) => R.tierOf(rp, rank).name;
  check("0 RP is Bronze III", t(0) === "Bronze III");
  check("299 RP is Bronze I", t(299) === "Bronze I");
  check("300 RP is Silver III", t(300) === "Silver III");
  check("1450 RP is Diamond I", t(1450) === "Diamond I");
  check("1500 RP is Master", t(1500) === "Master");
  check("Master inside the top 500 is Grandmaster", t(1700, 12) === "Grandmaster" && t(1700, 900) === "Master");
  check("a division spans rpPerDivision", R.tierOf(650).next - R.tierOf(650).floor === K.rpPerDivision);
}

console.log("Records");
{
  const ms = Date.UTC(2026, 9, 24);
  const rec = R.newRecord("duel", R.seasonOf(ms).id);
  const foe = () => ({ mu: 25, sigma: 3, place: 2 });
  for (let i = 0; i < K.placements - 1; i++) R.applyMatch(rec, 1, [foe()], ms);
  check("RP stays hidden during placements", rec.rp === 0 && rec.placementsLeft === 1);
  const out = R.applyMatch(rec, 1, [foe()], ms);
  check("the last placement match reveals a rank", out.placementDone && rec.rp > 0 && rec.placementsLeft === 0);
  const w = R.applyMatch(rec, 1, [foe()], ms),
    l = R.applyMatch(rec, 2, [Object.assign(foe(), { place: 1 })], ms);
  check(
    `a win gives at least +${K.rpGain.min} RP and a loss at least -${K.rpGain.min}`,
    w.delta >= K.rpGain.min && l.delta <= -K.rpGain.min,
  );
  // Promotion shield: sit just above a tier line, promote, then lose.
  const s = R.newRecord("duel", "x");
  s.placementsLeft = 0;
  s.rp = 595;
  s.mu = 30;
  s.sigma = 3;
  const p = R.applyMatch(s, 1, [{ mu: 30, sigma: 3, place: 2 }], ms);
  check("crossing a tier line is a promotion and arms the shield", p.promoted && s.shield === K.shieldMatches);
  s.rp = 600;
  R.applyMatch(s, 2, [{ mu: 30, sigma: 3, place: 1 }], ms);
  check("the shield stops a demotion out of the new tier", s.rp >= 600 && s.shield === K.shieldMatches - 1);
  // Decay.
  const dRec = R.newRecord("duel", "x");
  dRec.placementsLeft = 0;
  dRec.rp = 1350;
  dRec.lastPlayed = ms;
  const lost = R.decay(dRec, ms + (K.decay.afterDays + 15) * 864e5);
  check(
    `Diamond loses ${K.decay.perWeek} RP a week after ${K.decay.afterDays} idle days`,
    lost === 2 * K.decay.perWeek,
  );
  check("decay never counts the same week twice", R.decay(dRec, ms + (K.decay.afterDays + 15) * 864e5) === 0);
  const gRec = R.newRecord("duel", "x");
  gRec.placementsLeft = 0;
  gRec.rp = 700;
  gRec.lastPlayed = ms;
  check("Gold never decays", R.decay(gRec, ms + 200 * 864e5) === 0);
  // Seasons.
  check("October 2026 is season 2026-S4", R.seasonOf(ms).id === "2026-S4");
  const old = R.newRecord("duel", "2026-S3");
  old.mu = 37;
  old.games = 40;
  old.rp = 1100;
  old.peakRp = 1200;
  old.placementsLeft = 0;
  R.softReset(old, "2026-S4");
  check(
    "a new season pulls mu toward the start and asks for placements",
    Math.abs(old.mu - (37 - 12 * K.softReset)) < 1e-9 && old.placementsLeft === K.seasonPlacements && old.rp === 0,
  );
  check(
    "the old season is kept for the profile",
    old.seasons[0].season === "2026-S3" && old.seasons[0].peakRp === 1200,
  );
}

console.log("Convergence");
{
  // A player who truly sits at mu 33 plays opponents of known skill; MMR and RP should settle near the truth.
  const rand = g.mulberry32(77),
    truth = { mu: 33, sigma: 0.01 };
  const rec = R.newRecord("duel", "x");
  for (let i = 0; i < 120; i++) {
    const opp = { mu: 20 + rand() * 20, sigma: 2 + rand() * 2 };
    const p = R.winChance(truth, { mu: opp.mu, sigma: 0.01 });
    const won = rand() < p;
    R.applyMatch(rec, won ? 1 : 2, [Object.assign(opp, { place: won ? 2 : 1 })], 0);
  }
  check(`after 120 games mu is near the true 33 (got ${rec.mu.toFixed(1)})`, Math.abs(rec.mu - 33) < 3);
  const target = R.targetRp(R.mmr(rec));
  check(`RP converges toward the RP its MMR deserves (${rec.rp} vs ${target})`, Math.abs(rec.rp - target) < 220);
}

console.log("Matchmaking");
{
  check(
    "the window starts narrow and widens every few seconds",
    R.windowAfter(0) === K.queue.startWindow &&
      R.windowAfter(K.queue.widenEvery) === K.queue.startWindow + K.queue.widenBy,
  );
  check("the window stops widening at its cap", R.windowAfter(1e6) === K.queue.maxWindow);
  const run = (mode, act) => {
    const states = [];
    // A race fills a lobby (2 to 6 racers) and its queue moves faster; a duel or an arm match is 1 v 1.
    const lobby = mode === "race" ? { min: 2, max: 6 } : null;
    const q = new R.MockQueue({ mode, mmr: 1200, region: "sa", seed: 42, rate: lobby ? 0.9 : undefined });
    const mm = new R.Matchmaker({
      mode,
      me: { mmr: 1200, submit: "space" },
      seed: 9,
      queue: q,
      lobby,
      onChange: (m) => states.push(m.state),
    });
    mm.start(0);
    let t = 0;
    while (t < 120 && mm.state !== "ready" && mm.state !== "declined") {
      t += 0.25;
      mm.tick(t);
      if (mm.state === "found" && act) act(mm, t);
    }
    return { mm, states, t };
  };
  const a = run("duel", (mm, t) => mm.accept(t));
  check(
    `a 1v1 queue finds and readies a match (in ${a.t.toFixed(1)} s)`,
    a.mm.state === "ready" && a.states.includes("found"),
  );
  const foe = a.mm.match.opponents[0];
  check("the opponent is inside the window when found", Math.abs(foe.mmr - 1200) <= R.windowAfter(a.mm.match.foundAt));
  check("ranked never pairs different submit modes", foe.submit === "space");
  const b = run("duel", null);
  check(
    "letting the accept check run out is a dodge with a penalty",
    b.mm.state === "declined" && b.mm.penaltyUntil > b.t,
  );
  check("a penalised player cannot queue again until it ends", !b.mm.start(b.t + 1) && b.mm.state === "penalty");
  const c = run("race", null);
  const n = c.mm.match ? c.mm.match.opponents.length : 0;
  check(
    `a race lobby gathers 1 to 5 opponents and starts (got ${n})`,
    c.mm.state === "ready" && n >= 1 && n <= 5 && c.states.includes("lobby"),
  );
}

console.log("Identity");
{
  const P = g.Profile;
  check("names under 3 characters are refused", !P.validateName("ab").ok);
  check("names over 16 characters are refused", !P.validateName("a".repeat(17)).ok);
  check("symbols are refused", !P.validateName("<b>hi</b>").ok);
  check("reserved words are refused", !P.validateName("Admin123").ok);
  check("spaces are trimmed and collapsed", P.validateName("  Krishna   D ").name === "Krishna D");
  check(
    "look-alike names share one tag pool",
    P.normalize("Krishna") === P.normalize("KR1SHNA") && P.normalize("Krishna") === P.normalize("krish na"),
  );
  const taken = new Set(["0001", "0002"]);
  const rand = g.mulberry32(3);
  let ok = true;
  for (let i = 0; i < 200; i++) {
    const t = P.claimTag("Krishna", (n, tag) => taken.has(tag), rand);
    if (!t || taken.has(t) || !/^\d{4}$/.test(t)) ok = false;
  }
  check("a claimed tag is four digits and never one already taken", ok);
  check("a name with every tag taken gives no tag", P.claimTag("Krishna", () => true, rand) === null);
  check(
    "keeping your tag works when it is free under the new name",
    P.claimTag("Krishna", () => false, rand, "4242") === "4242",
  );
  check(
    "every country maps to a leaderboard region",
    P.COUNTRIES.every((c) => g.CONFIG.ranked.regions.some((r) => r[0] === c[2])),
  );
}

console.log(failed ? `\n${failed} ranked check(s) FAILED` : "\nAll ranked checks passed");
process.exitCode = failed ? 1 : 0;
