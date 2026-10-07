// Wires typing, the sim, the renderer and the HUD together.

const $ = (id) => document.getElementById(id);
const dom = {
  hitsBox: $("hits"), hits: $("hits-count"), rank: $("rank"), styleFill: $("style-fill"),
  wpm: $("stat-wpm"), chain: $("stat-chain"), damage: $("stat-damage"), best: $("stat-best"),
  tag: $("prompt-tag"), text: $("prompt-text"), next: $("prompt-next"),
  overlay: $("overlay"),
};

const sim = new Sim();
const prompt = new Prompt();
const renderer = new Renderer($("arena"));

const game = { running: false, chain: 0, lastSpecialAt: 0, wpm: 0, lastHits: 0 };

// Game modes. Each one sets up the sim and reacts to events.
// Sandbox is first; survival and stages come next.
const MODES = {
  sandbox: {
    name: "COMBO SANDBOX",
    setup(s) { s.spawnEnemy(CONFIG.dummy.maxHp, CONFIG.dummy.respawnDelay); },
  },
};
const mode = MODES.sandbox;

function startGame() {
  sim.reset();
  prompt.reset();
  mode.setup(sim);
  game.running = true;
  game.chain = 0;
  game.wpm = 0;
  game.lastHits = 0;
  game.lastSpecialAt = sim.time;
  dom.overlay.classList.add("hidden");
  renderPrompt();
}

function stopGame() {
  game.running = false;
  dom.overlay.classList.remove("hidden");
}

const TAGS = { jab: "JAB", heavy: "HEAVY", launcher: "LAUNCHER", airKick: "AIR KICK", slam: "SLAM", special: "SPECIAL" };
const tagFor = (chunk) => TAGS[sim.previewMove(chunk.type)];

function onChar(ch) {
  const res = prompt.input(ch);
  if (res.result === "mistake") {
    game.chain = 0;
    sim.penalize();
    dom.text.classList.remove("err");
    void dom.text.offsetWidth; // restart the shake animation
    dom.text.classList.add("err");
    renderPrompt();
    return;
  }
  if (res.result === "ok") { renderPrompt(); return; }

  // A chunk was completed.
  const { chunk, clean, cps } = res;
  game.wpm = game.wpm ? game.wpm * 0.6 + cps * 12 * 0.4 : cps * 12;

  let type = chunk.type;
  if (type === "special") {
    // Sloppy specials fizzle into a weak heavy hit.
    if (!clean) type = "heavy";
    game.chain = 0;
    game.lastSpecialAt = sim.time;
  } else if (clean) {
    game.chain++;
  }
  const mult = damageMultiplier(cps, clean, game.chain);
  sim.perform(type, { mult });

  // Earned a special? Slot a hard word in right after the current chunk.
  const S = CONFIG.special;
  if (game.chain >= S.chainRequired && sim.time - game.lastSpecialAt >= S.cooldownSeconds) {
    prompt.insertSpecial();
  }
  renderPrompt();
}

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!game.running) {
    if (e.key === "Enter") startGame();
    return;
  }
  if (e.key === "Escape") { stopGame(); return; }
  if (e.key === "Backspace" || e.key === " ") e.preventDefault();
  if (e.key.length === 1) {
    e.preventDefault();
    onChar(e.key.toLowerCase());
  }
});

function renderPrompt() {
  const c = prompt.current();
  dom.tag.textContent = tagFor(c);
  dom.tag.className = "t-" + c.type;
  dom.text.className = (c.text.length > 11 ? "long " : "") + "t-" + c.type + (dom.text.classList.contains("err") ? " err" : "");
  dom.text.innerHTML = c.text.split("").map((ch, i) => {
    const cls = i < c.index ? "done" : i === c.index ? "cur" : "todo";
    return `<span class="${cls}">${ch}</span>`;
  }).join("");
  dom.next.innerHTML = prompt.upcoming(CONFIG.prompt.lookahead)
    .map((n) => `<span class="chip t-${n.type}">${n.text}</span>`).join("");
}

function updateHud() {
  dom.hits.textContent = sim.combo.hits;
  if (sim.combo.hits !== game.lastHits) {
    if (sim.combo.hits > game.lastHits) {
      dom.hitsBox.classList.remove("pop");
      void dom.hitsBox.offsetWidth;
      dom.hitsBox.classList.add("pop");
    }
    game.lastHits = sim.combo.hits;
  }
  const rank = sim.style.value > 0 ? sim.rank() : "D";
  dom.rank.textContent = rank;
  dom.rank.className = "r-" + rank;
  dom.styleFill.style.width = sim.style.value + "%";
  dom.wpm.textContent = Math.round(game.wpm);
  dom.chain.textContent = game.chain;
  dom.damage.textContent = sim.stats.damage;
  dom.best.textContent = sim.stats.maxCombo;
}

// Fixed timestep so the fight plays the same at any frame rate.
const STEP = 1 / 120;
let last = performance.now(), acc = 0;
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (game.running) {
    acc += dt;
    while (acc >= STEP) { sim.update(STEP); acc -= STEP; }
    // Keep the labels honest as the target goes up and down.
    const c = prompt.current();
    const t = tagFor(c);
    if (dom.tag.textContent !== t) dom.tag.textContent = t;
  }
  renderer.draw(sim, dt);
  updateHud();
  requestAnimationFrame(loop);
}

sim.spawnEnemy(CONFIG.dummy.maxHp, CONFIG.dummy.respawnDelay); // something to look at behind the menu
renderPrompt();
requestAnimationFrame(loop);
