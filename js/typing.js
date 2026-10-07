// Typing logic only. No DOM, no canvas, no combat rules.

// One piece of text to type. Its type decides which move it triggers:
// light, heavy, launcher or special.
class Chunk {
  constructor(text, type) {
    this.text = text;
    this.type = type;
    this.index = 0;
    this.errors = 0;
    this.startTime = null;
  }
  get done() { return this.index >= this.text.length; }
}

// The flowing line of upcoming chunks.
class Prompt {
  constructor() { this.reset(); }

  reset() {
    this.queue = [];
    this.sinceLauncher = 0;
    this.launcherAt = randInt(...CONFIG.prompt.launcherEvery);
    this.lastText = null;
    this.fill();
  }

  fill() {
    while (this.queue.length < CONFIG.prompt.lookahead + 1) this.queue.push(this.generate());
  }

  generate() {
    const p = CONFIG.prompt;
    const avoid = this.queue.length ? this.queue[this.queue.length - 1].text : this.lastText;
    this.sinceLauncher++;
    let chunk;
    if (this.sinceLauncher >= this.launcherAt) {
      this.sinceLauncher = 0;
      this.launcherAt = randInt(...p.launcherEvery);
      chunk = new Chunk(pickFrom(LAUNCHER_WORDS, avoid), "launcher");
    } else if (Math.random() < p.heavyChance) {
      const list = Math.random() < p.phraseChance ? HEAVY_PHRASES : HEAVY_WORDS;
      chunk = new Chunk(pickFrom(list, avoid), "heavy");
    } else {
      chunk = new Chunk(pickFrom(LIGHT_WORDS, avoid), "light");
    }
    return chunk;
  }

  current() { return this.queue[0]; }
  upcoming(n) { return this.queue.slice(1, 1 + n); }
  hasSpecial() { return this.queue.some((c) => c.type === "special"); }

  // Put a hard special word right after the current chunk.
  insertSpecial() {
    if (this.hasSpecial()) return false;
    this.queue.splice(1, 0, new Chunk(pickFrom(HARD_WORDS, this.queue[0].text), "special"));
    return true;
  }

  // Feed one typed character. Returns what happened.
  input(ch) {
    const c = this.queue[0];
    if (c.startTime === null) c.startTime = performance.now();
    if (ch !== c.text[c.index]) {
      c.errors++;
      return { result: "mistake", chunk: c };
    }
    c.index++;
    if (!c.done) return { result: "ok", chunk: c };

    this.queue.shift();
    this.lastText = c.text;
    this.fill();
    const seconds = Math.max((performance.now() - c.startTime) / 1000, 0.15);
    return { result: "complete", chunk: c, clean: c.errors === 0, cps: (c.text.length - 1) / seconds };
  }
}

// Damage multiplier from typing speed, cleanliness and the clean chain.
function damageMultiplier(cps, clean, chain) {
  const t = CONFIG.typing;
  const speed = Math.min(Math.max(cps / t.refCharsPerSec, t.minSpeedMult), t.maxSpeedMult);
  const chainMult = Math.min(1 + chain * CONFIG.chain.step, CONFIG.chain.max);
  return speed * (clean ? chainMult : t.dirtyMult);
}
