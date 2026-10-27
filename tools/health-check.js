// CounterType health check: one command that tells you whether the code is in good shape.
//
//   npm run health                            (the same as: node tools/health-check.js)
//   node tools/health-check.js --full         the test suites in full, with the balance tables (a few minutes)
//   node tools/health-check.js --no-browser   skip the browser checks
//
// What it checks:
//   1. Inventory: modules per layer and plug-in, lines of code, the biggest files, the most shared modules.
//   2. Tests: every suite in tests/ (the module system, the structure, the rules of every mode, the protocol).
//   3. Lint: ESLint with the project rules (errors fail the check, warnings are listed).
//   4. Format: Prettier, every file in the project's own style.
//   5. Browser: the page starts every module with no console errors, every screen opens, every mode plays, and the
//      game keeps working with each plug-in switched off (?disable=) or deleted from the page.
// Steps 3 to 5 need the dev tools (npm install; the browser step also needs Playwright:
// npm install --no-save playwright && npx playwright install chromium). A missing tool skips its step.
//
// The report is printed and written to docs/health/report.md and docs/health/report.json (left out of git).
// Exit code 0 when nothing failed.
/* global document, CounterType -- the page.evaluate() callbacks run inside the game page */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "health");
const FULL = process.argv.includes("--full");
const BROWSER = !process.argv.includes("--no-browser");
const HAS_KEYS = fs.existsSync(path.join(ROOT, "src", "net", "net-keys.js"));
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "vendor"]);

const sections = [];
function section(name, status, summary, details = []) {
  sections.push({ name, status, summary, details });
  const mark = { pass: "pass", warn: "warn", fail: "FAIL", skip: "skip" }[status];
  console.log(`${mark.padEnd(5)} ${name}: ${summary}`);
  for (const line of details.slice(0, 12)) console.log(`        ${line}`);
  if (details.length > 12) console.log(`        ... ${details.length - 12} more in docs/health/report.md`);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && path.relative(ROOT, full) !== path.join("docs", "health")) walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}
const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");

// ---------- 1. Inventory ----------

function readModules() {
  const modules = [];
  for (const file of walk(path.join(ROOT, "src"))) {
    if (!file.endsWith(".js") || file.endsWith(".example.js") || file.endsWith("kernel.js")) continue;
    const source = fs.readFileSync(file, "utf8");
    const match = source.match(/CounterType\.define\(\s*"([a-z0-9-]+)"\s*,\s*\[([\s\S]*?)\]\s*,/);
    if (!match) continue;
    const parts = rel(file).split("/");
    const place = parts.length === 2 ? "boot" : parts[1] === "modes" ? `mode: ${parts[2]}` : parts[1];
    const deps = [...match[2].matchAll(/"\??([a-z0-9-]+)"/g)].map((m) => m[1]);
    modules.push({ id: match[1], file: rel(file), place, deps, lines: source.split("\n").length });
  }
  return modules;
}

function inventory() {
  const modules = readModules();
  const files = walk(ROOT);
  const count = (ext) => files.filter((f) => f.endsWith(ext) && rel(f).startsWith("src/"));
  const lines = (list) => list.reduce((sum, f) => sum + fs.readFileSync(f, "utf8").split("\n").length, 0);
  const js = count(".js");
  const css = count(".css");
  const byPlace = {};
  for (const m of modules) byPlace[m.place] = (byPlace[m.place] || 0) + 1;
  const fanIn = {};
  for (const m of modules) for (const d of m.deps) fanIn[d] = (fanIn[d] || 0) + 1;
  const shared = Object.entries(fanIn)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, n]) => `${id} (${n})`);
  const biggest = modules
    .slice()
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 6)
    .map((m) => `${m.file} (${m.lines} lines)`);
  const average = modules.reduce((sum, m) => sum + m.deps.length, 0) / modules.length;
  section(
    "Inventory",
    "pass",
    `${modules.length} modules in ${js.length} scripts (${lines(js)} lines) and ${css.length} stylesheets (${lines(css)} lines)`,
    [
      "Modules by place: " +
        Object.entries(byPlace)
          .map(([place, n]) => `${place} ${n}`)
          .join(", "),
      `Dependencies per module: ${average.toFixed(1)} on average`,
      "Most shared: " + shared.join(", "),
      "Biggest: " + biggest.join(", "),
    ],
  );
  return modules;
}

// ---------- 2. Tests ----------

function tests() {
  const run = spawnSync(process.execPath, [path.join(ROOT, "tests", "run-all.js"), ...(FULL ? [] : ["--quick"])], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = run.stdout + run.stderr;
  const rows = output.split("\n").filter((line) => /^(pass|FAIL) {2}/.test(line) || /^ {6}FAIL/.test(line));
  const total = (output.match(/(\d+) suites, (\d+) checks/) || []).slice(1);
  section(
    "Tests",
    run.status === 0 ? "pass" : "fail",
    total.length
      ? `${total[0]} suites, ${total[1]} checks${FULL ? "" : " (quick: --full adds the balance tables)"}`
      : "the test runner did not finish",
    rows.map((line) => line.trim()),
  );
}

// ---------- 3. Lint ----------

async function lint() {
  let ESLint;
  try {
    ({ ESLint } = require(require.resolve("eslint", { paths: [ROOT] })));
  } catch (error) {
    section("Lint", "skip", "ESLint is not installed (run npm install)");
    return;
  }
  const eslint = new ESLint({ cwd: ROOT });
  const results = await eslint.lintFiles(["src", "tests", "tools"]);
  const errors = results.reduce((sum, r) => sum + r.errorCount, 0);
  const warnings = results.reduce((sum, r) => sum + r.warningCount, 0);
  const details = [];
  for (const r of results) {
    for (const m of r.messages) details.push(`${rel(r.filePath)}:${m.line} ${m.ruleId || "parse"}: ${m.message}`);
  }
  details.sort((a, b) => (a.includes("complexity") ? 1 : 0) - (b.includes("complexity") ? 1 : 0));
  section(
    "Lint",
    errors ? "fail" : warnings ? "warn" : "pass",
    `${results.length} files, ${errors} errors, ${warnings} warnings`,
    details,
  );
}

// ---------- 4. Format ----------

async function format() {
  let prettier;
  try {
    prettier = require(require.resolve("prettier", { paths: [ROOT] }));
  } catch (error) {
    section("Format", "skip", "Prettier is not installed (run npm install)");
    return;
  }
  const files = walk(ROOT).filter((f) => /\.(js|css|html|json|md)$/.test(f));
  const unformatted = [];
  let checked = 0;
  for (const file of files) {
    const info = await prettier.getFileInfo(file, { ignorePath: path.join(ROOT, ".prettierignore") });
    if (info.ignored || !info.inferredParser) continue;
    const options = await prettier.resolveConfig(file);
    checked++;
    if (!(await prettier.check(fs.readFileSync(file, "utf8"), { ...options, filepath: file }))) {
      unformatted.push(rel(file));
    }
  }
  section(
    "Format",
    unformatted.length ? "fail" : "pass",
    `${checked} files checked, ${unformatted.length} not in the project style${unformatted.length ? " (npm run format fixes them)" : ""}`,
    unformatted,
  );
}

// ---------- 5. Browser ----------

const FAMILIES = ["duel", "race", "arm", "brawl", "net"];

/** A copy of index.html with some plug-in blocks deleted, next to it (so the relative paths still work). */
function pageWithout(families) {
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for (const family of families) {
    html = html.replace(new RegExp(`[ \\t]*<!-- PLUG-IN ${family}:[\\s\\S]*?<!-- \\/PLUG-IN ${family} -->\\n?`), "");
  }
  const file = path.join(ROOT, `.health-without-${families.join("-")}.html`);
  fs.writeFileSync(file, html);
  return file;
}

async function visit(instance, url, expectedOff) {
  const page = await instance.newPage({ viewport: { width: 1366, height: 768 } });
  const problems = [];
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    // Your relay keys file is optional and left out of git: a fresh copy cannot load it, and that is expected.
    if (!HAS_KEYS && /src\/net\/net-keys\.js/.test(m.location().url || "")) return;
    problems.push(`console ${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  await page.goto(url);
  await page.waitForTimeout(700);

  const status = await page.evaluate(() => CounterType.status());
  const off = (id) => expectedOff.some((family) => id === family || id.startsWith(family + "-"));
  for (const s of status) {
    if (s.state === "started" || (off(s.id) && s.state === "disabled")) continue;
    if (s.id === "net-keys" && s.state === "pending") continue; // optional file
    problems.push(`${s.id} is ${s.state}${s.reason ? ` (${s.reason})` : ""}`);
  }
  const modes = await page.evaluate(() =>
    CounterType.get("registry")
      .list("mode")
      .map((m) => ({ id: m.id, homeKey: m.homeKey || (m.primary ? "Enter" : "") })),
  );
  const ui = () =>
    page.evaluate(() => {
      const el = document.getElementById("ui");
      return { screen: el.dataset.screen || "", mode: el.dataset.mode || "", idle: el.classList.contains("idle") };
    });
  const menuButtons = await page.evaluate(() =>
    [...document.querySelectorAll("#overlay [data-act]")].filter((b) => b.offsetParent).map((b) => b.dataset.act),
  );
  for (const m of modes) if (!menuButtons.includes(m.id)) problems.push(`the home menu has no button for ${m.id}`);
  for (const family of expectedOff) {
    if (menuButtons.includes(family)) problems.push(`the home menu still offers ${family}`);
  }

  // Every info screen opens and closes.
  const screens = [
    ["h", "howto"],
    ["p", "profile"],
    ["l", "leaders"],
  ];
  for (const [key, screen] of screens) {
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
    const now = await ui();
    if (now.screen !== screen) problems.push(`key ${key} opened "${now.screen}" instead of "${screen}"`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  // Every loaded mode starts a fight that takes keys, pauses and quits back to the menu.
  const played = [];
  for (const m of modes) {
    await page.keyboard.press(m.homeKey === "Enter" ? "Enter" : m.homeKey);
    await page.waitForTimeout(250);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3700);
    await page.keyboard.type("the", { delay: 30 });
    const fight = await ui();
    if (fight.mode !== m.id || fight.idle) problems.push(`${m.id}: no fight after Enter (${JSON.stringify(fight)})`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    await page.keyboard.press("q");
    await page.waitForTimeout(150);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const back = await ui();
    if (!back.idle) problems.push(`${m.id}: quit from the pause menu did not return to the menu`);
    played.push(m.id);
    // back on the home view for the next mode
    await page.goto(url);
    await page.waitForTimeout(600);
  }
  await page.close();
  return { problems, modes: modes.map((m) => m.id), played };
}

async function browser() {
  if (!BROWSER) {
    section("Browser", "skip", "skipped (--no-browser)");
    return;
  }
  let chromium;
  try {
    ({ chromium } = require(require.resolve("playwright", { paths: [ROOT, process.cwd()] })));
  } catch (error) {
    section("Browser", "skip", "Playwright is not installed (npm install --no-save playwright)");
    return;
  }
  const index = pathToFileURL(path.join(ROOT, "index.html")).href;
  const scenarios = [{ name: "the whole game", url: index, off: [] }];
  for (const family of FAMILIES) {
    scenarios.push({ name: `?disable=${family}`, url: `${index}?disable=${family}`, off: [family] });
  }
  scenarios.push({
    name: "?disable=race,arm,brawl,net (Duel only)",
    url: `${index}?disable=race,arm,brawl,net`,
    off: ["race", "arm", "brawl", "net"],
  });
  scenarios.push({
    name: "?disable=duel,race,arm,brawl,net (no modes)",
    url: `${index}?disable=duel,race,arm,brawl,net`,
    off: FAMILIES,
  });
  const temporary = [];
  for (const family of FAMILIES) {
    const file = pageWithout([family]);
    temporary.push(file);
    scenarios.push({
      name: `${family} block deleted from the page`,
      url: pathToFileURL(file).href,
      off: [],
      deleted: family,
    });
  }
  const file = pageWithout(FAMILIES);
  temporary.push(file);
  scenarios.push({
    name: "every plug-in block deleted",
    url: pathToFileURL(file).href,
    off: [],
    deleted: FAMILIES.join(","),
  });

  const instance = await chromium.launch();
  const details = [];
  let failures = 0;
  try {
    for (const scenario of scenarios) {
      const result = await visit(instance, scenario.url, scenario.off);
      const deleted = scenario.deleted ? scenario.deleted.split(",") : [];
      const leftovers = result.modes.filter((id) => deleted.includes(id) || scenario.off.includes(id));
      if (leftovers.length) result.problems.push(`still registered: ${leftovers.join(", ")}`);
      if (result.problems.length) failures++;
      details.push(
        `${result.problems.length ? "FAIL" : "ok  "} ${scenario.name}: modes ${result.modes.join(", ") || "none"}; played ${result.played.join(", ") || "none"}` +
          (result.problems.length ? `; ${result.problems.slice(0, 3).join("; ")}` : ""),
      );
    }
  } finally {
    await instance.close();
    for (const f of temporary) fs.rmSync(f, { force: true });
  }
  section(
    "Browser",
    failures ? "fail" : "pass",
    `${scenarios.length} builds of the page, ${failures} with problems (console errors, modules not started, screens or fights that did not open)`,
    details,
  );
}

// ---------- Report ----------

function writeReport() {
  fs.mkdirSync(OUT, { recursive: true });
  const verdict = sections.some((s) => s.status === "fail") ? "FAIL" : "PASS";
  const md = [
    "# CounterType health report",
    "",
    `Made by \`node tools/health-check.js${FULL ? " --full" : ""}\` on ${new Date().toISOString()}. Verdict: **${verdict}**.`,
    "",
    "| Check | Result | Summary |",
    "| --- | --- | --- |",
    ...sections.map((s) => `| ${s.name} | ${s.status} | ${s.summary.replace(/\|/g, "/")} |`),
    "",
    ...sections.flatMap((s) => (s.details.length ? [`## ${s.name}`, "", ...s.details.map((d) => `- ${d}`), ""] : [])),
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "report.md"), md);
  fs.writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify({ at: new Date().toISOString(), verdict, sections }, null, 2),
  );
  console.log(`\nVerdict: ${verdict}  (docs/health/report.md)`);
  process.exitCode = verdict === "PASS" ? 0 : 1;
}

(async () => {
  inventory();
  tests();
  await lint();
  await format();
  await browser();
  writeReport();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
