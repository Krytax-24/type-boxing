// Checks that the code stays plug and play: one module per file named after it, a clean dependency graph, layers
// that only point down, plug-ins (each game mode and the online layer) that never touch each other, and an
// index.html that loads every file once, in layer order, with each plug-in in its own removable block.
// Run from the project folder:   node tests/structure-sim.js
const fs = require("fs");
const path = require("path");
const { ROOT, SRC } = require("./support/loader");

let failed = 0;
function check(name, ok, details = []) {
  const shown = details.length ? ` (${details.slice(0, 5).join(", ")}${details.length > 5 ? ", ..." : ""})` : "";
  console.log((ok ? "  ok   " : "  FAIL ") + name + shown);
  if (!ok) failed++;
}

const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");
const read = (file) => fs.readFileSync(file, "utf8");

// Layers, lowest first. A module may only depend on its own layer or a lower one. Plug-ins share the top layer
// and may never depend on another plug-in family.
const LAYERS = ["kernel", "core", "engine", "services", "ui", "app", "pages", "plugin", "boot"];

/** Which layer a file belongs to, and for plug-ins which family (duel, race, arm, brawl, net). */
function placeOf(relPath) {
  const parts = relPath.split("/"); // src/<layer>/...
  if (parts.length === 2) return { layer: "boot", family: null }; // src/boot.js
  if (parts[1] === "modes") return { layer: "plugin", family: parts[2] };
  if (parts[1] === "net") return { layer: "plugin", family: "net" };
  return { layer: parts[1], family: null };
}

// Comments and strings removed, for checks on what the code itself does.
const codeOnly = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1")
    .replace(/`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');

// ---------- Every file ----------

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
})(SRC);

const scripts = files.filter((f) => f.endsWith(".js") && !rel(f).startsWith("src/vendor/"));
const styles = files.filter((f) => f.endsWith(".css"));
const modules = new Map();
const problems = { noDefine: [], twoDefines: [], wrongName: [], duplicate: [] };

for (const file of scripts) {
  const r = rel(file);
  if (r === "src/kernel/kernel.js" || r.endsWith(".example.js")) continue;
  const source = read(file);
  const defines = [...source.matchAll(/CounterType\.define\(\s*"([a-z0-9-]+)"\s*,\s*\[([\s\S]*?)\]\s*,/g)];
  if (defines.length === 0) problems.noDefine.push(r);
  if (defines.length > 1) problems.twoDefines.push(r);
  if (!defines.length) continue;
  const id = defines[0][1];
  const deps = [...defines[0][2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (path.basename(file, ".js") !== id) problems.wrongName.push(`${r} defines "${id}"`);
  if (modules.has(id)) problems.duplicate.push(id);
  modules.set(id, { id, file: r, deps, source, ...placeOf(r) });
}

console.log("Modules");
check(`every script defines a module (${modules.size} modules)`, problems.noDefine.length === 0, problems.noDefine);
check("no file defines two modules", problems.twoDefines.length === 0, problems.twoDefines);
check("every module is named after its file", problems.wrongName.length === 0, problems.wrongName);
check("no two modules share an id", problems.duplicate.length === 0, problems.duplicate);
{
  const bad = [...modules.values()].filter((m) => !/^\s*\/\*\*/.test(m.source)).map((m) => m.file);
  check("every module file opens with a comment that says what it is", bad.length === 0, bad);
  const noStrict = [...modules.values()].filter((m) => !/"use strict";/.test(m.source)).map((m) => m.file);
  check("every module runs in strict mode", noStrict.length === 0, noStrict);
  const peeks = [...modules.values()]
    .filter((m) => /CounterType\.(get|has|status)\(/.test(codeOnly(m.source)))
    .map((m) => m.file);
  check(
    "no module looks another one up by name: everything comes through the dependency list",
    peeks.length === 0,
    peeks,
  );
  const globals = [...modules.values()]
    .filter((m) => /\b(window|globalThis|self)\.[A-Za-z_$][\w$]*\s*=(?!=)/.test(codeOnly(m.source)))
    .map((m) => m.file);
  check("no module adds globals to the page", globals.length === 0, globals);
}

console.log("Dependency graph");
{
  const missing = [];
  const optionalMissing = [];
  for (const m of modules.values()) {
    for (const raw of m.deps) {
      const id = raw.replace(/^\?/, "");
      if (modules.has(id)) continue;
      // An optional module may exist only as a template: net-keys.js is left out of git, net-keys.example.js is not.
      if (raw.startsWith("?") && scripts.some((f) => path.basename(f) === `${id}.example.js`)) continue;
      (raw.startsWith("?") ? optionalMissing : missing).push(`${m.id} -> ${id}`);
    }
  }
  check("every required dependency exists", missing.length === 0, missing);
  check("optional dependencies point at real modules", optionalMissing.length === 0, optionalMissing);

  const cycles = [];
  const color = new Map();
  const visit = (id, trail) => {
    color.set(id, 1);
    for (const raw of modules.get(id).deps) {
      const dep = raw.replace(/^\?/, "");
      if (!modules.has(dep)) continue;
      if (color.get(dep) === 1) cycles.push(trail.concat(id, dep).slice(trail.indexOf(dep)).join(" -> "));
      else if (!color.has(dep)) visit(dep, trail.concat(id));
    }
    color.set(id, 2);
  };
  for (const id of modules.keys()) if (!color.has(id)) visit(id, []);
  check("there are no dependency cycles", cycles.length === 0, cycles);

  const upward = [];
  const crossPlugin = [];
  const shellOnPlugin = [];
  for (const m of modules.values()) {
    for (const raw of m.deps) {
      const dep = modules.get(raw.replace(/^\?/, ""));
      if (!dep) continue;
      if (LAYERS.indexOf(dep.layer) > LAYERS.indexOf(m.layer)) {
        upward.push(`${m.id} (${m.layer}) -> ${dep.id} (${dep.layer})`);
      }
      if (m.layer === "plugin" && dep.layer === "plugin" && m.family !== dep.family) {
        crossPlugin.push(`${m.id} -> ${dep.id}`);
      }
      if (m.layer !== "plugin" && dep.layer === "plugin") shellOnPlugin.push(`${m.id} -> ${dep.id}`);
    }
  }
  check(`dependencies only point down the layers (${LAYERS.join(", ")})`, upward.length === 0, upward);
  check("no plug-in depends on another plug-in (duel, race, arm, brawl, net)", crossPlugin.length === 0, crossPlugin);
  check("the shell never depends on a plug-in, not even optionally", shellOnPlugin.length === 0, shellOnPlugin);

  const pluginIds = [...modules.values()].filter((m) => m.layer === "plugin").map((m) => m.id);
  const named = [];
  for (const m of modules.values()) {
    if (m.layer === "plugin") continue;
    const strings = [...m.source.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]);
    for (const s of strings) if (pluginIds.includes(s)) named.push(`${m.file}: "${s}"`);
  }
  check("the shell never names a plug-in module in its code", named.length === 0, named);

  const families = {};
  for (const m of modules.values()) if (m.layer === "plugin") (families[m.family] = families[m.family] || []).push(m);
  for (const [family, members] of Object.entries(families)) {
    const others = Object.keys(families).filter((f) => f !== family);
    const leaks = [];
    for (const m of members) {
      const strings = [...m.source.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]);
      for (const s of strings) {
        const owner = modules.get(s);
        if (owner && owner.layer === "plugin" && others.includes(owner.family)) leaks.push(`${m.id}: "${s}"`);
      }
    }
    check(
      `plug-in "${family}" (${members.length} modules) never names another plug-in's modules`,
      leaks.length === 0,
      leaks,
    );
  }
  // ?disable=<family> switches off every module named <family> or <family>-*. That must never take out a module
  // that something outside the family needs, or switching a plug-in off would break the rest of the game.
  const sideEffects = [];
  for (const family of Object.keys(families)) {
    const off = new Set([...modules.keys()].filter((id) => id === family || id.startsWith(family + "-")));
    for (const m of modules.values()) {
      if (off.has(m.id)) continue;
      for (const dep of m.deps) if (off.has(dep)) sideEffects.push(`?disable=${family} takes "${dep}" from ${m.id}`);
    }
  }
  check(
    "?disable=<plug-in> never switches off a module the rest of the game needs",
    sideEffects.length === 0,
    sideEffects,
  );

  const registersMode = Object.entries(families)
    .filter(([family]) => family !== "net")
    .filter(([, members]) => !members.some((m) => /registry\.add\("mode"/.test(m.source)))
    .map(([family]) => family);
  check('every game mode registers itself as a "mode"', registersMode.length === 0, registersMode);
  check(
    "the online layer installs itself through the online gateway",
    (families.net || []).some((m) => m.deps.includes("online-gateway") && /\.install\(/.test(m.source)),
  );
}

console.log("index.html");
{
  const html = read(path.join(ROOT, "index.html"));
  const tags = [...html.matchAll(/<script src="([^"]+)"><\/script>|<link rel="stylesheet" href="([^"]+)"\s*\/?>/g)].map(
    (m) => ({
      src: (m[1] || m[2]).split("?")[0],
      query: (m[1] || m[2]).split("?")[1] || "",
      script: !!m[1],
      at: m.index,
    }),
  );
  const loaded = tags.map((t) => t.src);
  const optional = ["src/net/net-keys.js"]; // your relay keys: left out of git, so a fresh copy has none

  const missing = loaded.filter((f) => !fs.existsSync(path.join(ROOT, f)) && !optional.includes(f));
  check("every script and stylesheet on the page exists", missing.length === 0, missing);
  const twice = loaded.filter((f, i) => loaded.indexOf(f) !== i);
  check("no file is loaded twice", twice.length === 0, twice);

  const orphanScripts = [...modules.values()].map((m) => m.file).filter((f) => !loaded.includes(f));
  check("every module is loaded by the page (no orphan scripts)", orphanScripts.length === 0, orphanScripts);
  const orphanStyles = styles.map(rel).filter((f) => !loaded.includes(f));
  check("every stylesheet is linked (no orphan styles)", orphanStyles.length === 0, orphanStyles);
  check("the example keys file is never loaded", !loaded.some((f) => f.endsWith(".example.js")));

  const scriptTags = tags.filter((t) => t.script).map((t) => t.src);
  check(
    "the kernel loads first and boot loads last",
    scriptTags[0] === "src/kernel/kernel.js" && scriptTags.at(-1) === "src/boot.js",
  );
  const rank = (f) => {
    const m = [...modules.values()].find((x) => x.file === f);
    if (!m) return null;
    return LAYERS.indexOf(m.layer);
  };
  const outOfOrder = [];
  let highest = 0;
  for (const f of scriptTags) {
    const r = rank(f);
    if (r === null) continue;
    if (r < highest) outOfOrder.push(f);
    highest = Math.max(highest, r);
  }
  check("scripts load in layer order", outOfOrder.length === 0, outOfOrder);
  const position = new Map(scriptTags.map((f, i) => [f, i]));
  const late = [];
  for (const m of modules.values()) {
    for (const raw of m.deps) {
      const dep = modules.get(raw.replace(/^\?/, ""));
      if (dep && position.get(dep.file) > position.get(m.file)) late.push(`${m.id} before ${dep.id}`);
    }
  }
  check(
    "every module loads after the modules it needs (easy to read, though the kernel would cope)",
    late.length === 0,
    late,
  );

  const blocks = [...html.matchAll(/<!-- PLUG-IN ([a-z]+):[\s\S]*?-->([\s\S]*?)<!-- \/PLUG-IN \1 -->/g)];
  const blockNames = blocks.map((b) => b[1]);
  const familiesOnDisk = [...new Set([...modules.values()].filter((m) => m.layer === "plugin").map((m) => m.family))];
  check(
    `each plug-in has one removable block (${blockNames.join(", ")})`,
    familiesOnDisk.every((f) => blockNames.filter((b) => b === f).length === 1),
    familiesOnDisk.filter((f) => !blockNames.includes(f)),
  );
  const strays = [];
  for (const [, family, body] of blocks) {
    const inside = [...body.matchAll(/(?:src|href)="([^"?]+)/g)].map((m) => m[1]);
    for (const f of inside) {
      const m = [...modules.values()].find((x) => x.file === f);
      const owner = m ? m.family : f.startsWith("src/vendor/") ? "net" : f.split("/")[2];
      if (owner !== family && !(family === "net" && f.startsWith("src/net/"))) strays.push(`${f} in ${family}`);
    }
    const pluginFiles = [...modules.values()].filter((m) => m.family === family).map((m) => m.file);
    for (const f of pluginFiles) if (!inside.includes(f)) strays.push(`${f} outside its block`);
  }
  check("each plug-in block holds exactly its own files", strays.length === 0, strays);

  const own = tags.filter((t) => !t.src.startsWith("src/vendor/"));
  const versions = [...new Set(own.map((t) => t.query))];
  check(
    `every file carries the same cache tag (?${versions.join(", ?")})`,
    versions.length === 1 && /^v=\d{8}[a-z]$/.test(versions[0]),
  );
}

console.log("Text");
{
  const docs = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(ROOT, f));
  const dashFiles = files
    .concat([path.join(ROOT, "index.html")], docs)
    .filter((f) => /\.(js|css|html|md)$/.test(f) && !rel(f).startsWith("src/vendor/"))
    .filter((f) => /[\u2013\u2014]/.test(read(f)))
    .map(rel);
  check("no em or en dashes in the game's text, code or docs", dashFiles.length === 0, dashFiles);
  const logs = [...modules.values()].filter((m) => /\bconsole\.log\(/.test(codeOnly(m.source))).map((m) => m.file);
  check("no console.log left in the game", logs.length === 0, logs);
  const debuggers = [...modules.values()].filter((m) => /\bdebugger\b/.test(codeOnly(m.source))).map((m) => m.file);
  check("no debugger statements", debuggers.length === 0, debuggers);
}

console.log(failed ? `\n${failed} structure check(s) FAILED` : "\nAll structure checks passed");
process.exitCode = failed ? 1 : 0;
