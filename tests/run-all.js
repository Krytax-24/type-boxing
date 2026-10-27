// Runs every test suite in this folder (the *-sim.js files) one after another and sums them up.
//
//   node tests/run-all.js            every suite in full (the Duel balance tables take a few minutes)
//   node tests/run-all.js --quick    rule checks only, a few seconds (what you run after every change)
//
// Exit code 0 when every suite passed, 1 otherwise. No libraries: node only.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const quick = process.argv.includes("--quick");

// Suites that take numbers: in quick mode they skip their long balance tables.
const QUICK_ARGS = {
  "duel-sim.js": ["0", "0", "0"],
  "arm-sim.js": ["0"],
};

// The module system and the structure first: if those fail, everything else is suspect.
const FIRST = ["kernel-sim.js", "structure-sim.js"];
const suites = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith("-sim.js"))
  .sort((a, b) => (FIRST.indexOf(a) + 1 || 99) - (FIRST.indexOf(b) + 1 || 99) || a.localeCompare(b));

const results = [];
for (const suite of suites) {
  const args = quick ? QUICK_ARGS[suite] || [] : [];
  const started = Date.now();
  const run = spawnSync(process.execPath, [path.join(__dirname, suite), ...args], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = (run.stdout || "") + (run.stderr || "");
  const passed = (output.match(/^ {2}ok {3}/gm) || []).length;
  const failures = output.split("\n").filter((line) => line.startsWith("  FAIL "));
  const ok = run.status === 0 && failures.length === 0;
  results.push({ suite, ok, passed, failures, seconds: (Date.now() - started) / 1000, output });
  console.log(
    `${ok ? "pass" : "FAIL"}  ${suite.padEnd(18)} ${String(passed).padStart(4)} checks  ${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
  for (const line of failures) console.log("      " + line.trim());
  if (!ok && !failures.length) console.log(output.split("\n").slice(-15).join("\n"));
}

const total = results.reduce((sum, r) => sum + r.passed, 0);
const bad = results.filter((r) => !r.ok);
console.log(
  `\n${results.length} suites, ${total} checks, ${bad.length ? bad.length + " suite(s) FAILED" : "all passed"}` +
    (quick ? " (quick: the balance tables were skipped)" : ""),
);
process.exitCode = bad.length ? 1 : 0;
