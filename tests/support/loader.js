// Loads game modules into a sandbox the way the browser does (classic scripts that share one global scope),
// then starts the kernel. Tests name the modules they need; their dependencies are found automatically.
//
//   const { load } = require("./support/loader");
//   const game = load(["duel", "match-rules"]);       // starts those modules and everything they need
//   const Duel = game.get("duel");
//   const g = game.legacy;                             // the old global names (CONFIG, Duel, Typist ...)
//
// No browser and no libraries: node's vm module only.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");

// Every module file under src/, by id (the id is read from its CounterType.define call).
function indexModules() {
  const index = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "vendor") walk(full);
      } else if (entry.name.endsWith(".js") && entry.name !== "kernel.js" && !entry.name.endsWith(".example.js")) {
        const source = fs.readFileSync(full, "utf8");
        const match = source.match(/CounterType\.define\(\s*"([a-z0-9-]+)"\s*,\s*\[([^\]]*)\]/);
        if (!match) continue;
        const deps = [...match[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
        index.set(match[1], { id: match[1], file: full, deps, source });
      }
    }
  };
  walk(SRC);
  return index;
}

let cachedIndex = null;
function moduleIndex() {
  if (!cachedIndex) cachedIndex = indexModules();
  return cachedIndex;
}

// The ids to load: the requested ones plus every required (not optional) dependency, dependencies first.
function closure(ids, index) {
  const order = [];
  const seen = new Set();
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const mod = index.get(id);
    if (!mod) throw new Error(`loader: no module "${id}" under src/`);
    for (const dep of mod.deps) if (!dep.startsWith("?")) visit(dep);
    order.push(id);
  };
  ids.forEach(visit);
  return order;
}

// Old global names, for the suites written before the module system.
const LEGACY = {
  config: (m) => ({ CONFIG: m }),
  words: (m) => m,
  random: (m) => ({ mulberry32: m.mulberry32 }),
  typing: (m) => m,
  "match-rules": (m) => ({ Modes: m }),
  fighter: (m) => ({ Fighter: m }),
  duel: (m) => ({ Duel: m }),
  stats: (m) => ({ Stats: m }),
  ranked: (m) => ({ Ranked: m }),
  profile: (m) => ({ Profile: m }),
  backend: (m) => ({ Backend: m }),
  "race-passages": (m) => ({ PASSAGES: m }),
  "race-rules": (m) => ({ Race: m }),
  "arm-rules": (m) => ({ Arm: m }),
  "brawl-rules": (m) => ({ Brawl: m }),
  "net-protocol": (m) => ({ Protocol: m }),
  clips: (m) => ({ Anim: m }),
  characters: (m) => ({ Chars: m }),
};

/**
 * Loads and starts modules.
 *
 * @param {string[]} ids Module ids.
 * @param {object} [options] { globals: extra sandbox globals (a fake document, localStorage ...), disable: ids }
 */
function load(ids, options = {}) {
  const index = moduleIndex();
  const sandbox = Object.assign({ console, Math, Date, performance }, options.globals || {});
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(SRC, "kernel", "kernel.js"), "utf8"), sandbox, { filename: "kernel.js" });
  const order = closure(ids, index);
  for (const id of order) {
    const mod = index.get(id);
    vm.runInContext(mod.source, sandbox, { filename: path.relative(ROOT, mod.file) });
  }
  const status = sandbox.CounterType.start({ disable: options.disable || [], logger: options.logger || console });
  const broken = status.filter((s) => s.state === "failed");
  if (broken.length) {
    throw new Error("loader: modules failed to start: " + broken.map((s) => `${s.id} (${s.reason})`).join(", "));
  }

  const get = (id) => sandbox.CounterType.get(id);
  const legacy = {};
  for (const id of order) {
    const exported = get(id);
    if (exported && LEGACY[id]) Object.assign(legacy, LEGACY[id](exported));
  }
  return { get, legacy, status, sandbox, order };
}

module.exports = { load, moduleIndex, ROOT, SRC };
