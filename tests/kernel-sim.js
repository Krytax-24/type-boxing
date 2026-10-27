// Checks for the module system (src/kernel): the kernel, the event bus and the registry. These are what make the
// game plug and play, so they get their own suite: start order, missing and broken modules, optional
// dependencies, cycles, switching modules off, late modules, and the two shared services every module uses.
// Run from the project folder:   node tests/kernel-sim.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { load } = require("./support/loader");

const KERNEL = fs.readFileSync(path.join(__dirname, "..", "src", "kernel", "kernel.js"), "utf8");

let failed = 0;
function check(name, ok) {
  console.log((ok ? "  ok   " : "  FAIL ") + name);
  if (!ok) failed++;
}

/** A kernel of its own (a fresh global scope, like a new page) and a logger that keeps what it was told. */
function freshKernel() {
  const logs = [];
  const logger = {
    error: (...args) => logs.push(["error", args.map(String).join(" ")]),
    warn: (...args) => logs.push(["warn", args.map(String).join(" ")]),
  };
  const sandbox = { console: logger, performance };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(KERNEL, sandbox, { filename: "kernel.js" });
  return { CT: sandbox.CounterType, logs, logger };
}

const throws = (fn) => {
  try {
    fn();
    return false;
  } catch (error) {
    return true;
  }
};

const stateOf = (CT, id) => {
  const row = CT.status().find((s) => s.id === id);
  return row ? row.state : "absent";
};

console.log("Defining modules");
{
  const { CT } = freshKernel();
  check(
    "a module id must be lower case letters, digits and dashes",
    throws(() => CT.define("Race", [], () => 1)),
  );
  check(
    "the dependencies must be an array",
    throws(() => CT.define("a", "b", () => 1)),
  );
  check(
    "the factory must be a function",
    throws(() => CT.define("a", [], 1)),
  );
  CT.define("a", [], () => 1);
  check(
    "an id can only be defined once",
    throws(() => CT.define("a", [], () => 2)),
  );
  check("nothing starts before start()", stateOf(CT, "a") === "pending" && CT.get("a") === null);
  const define = CT.define;
  try {
    CT.define = null;
  } catch (error) {
    // strict code throws here; either way the kernel keeps its own define
  }
  check("the kernel object cannot be changed", Object.isFrozen(CT) && CT.define === define);
}

console.log("Start order and dependency injection");
{
  const { CT } = freshKernel();
  const order = [];
  CT.define("page", ["kit", "words"], (kit, words) => {
    order.push("page");
    return { text: kit.wrap(words.first) };
  });
  CT.define("kit", ["words"], (words) => {
    order.push("kit");
    return { wrap: (w) => `[${w}]`, seen: words.first };
  });
  CT.define("words", [], () => {
    order.push("words");
    return { first: "type" };
  });
  CT.start({ logger: null });
  check("dependencies start before the modules that need them", order.join() === "words,kit,page");
  check("each factory gets its dependencies' exports, in order", CT.get("page").text === "[type]");
  check(
    "every module is started",
    CT.status().every((s) => s.state === "started"),
  );
  check("has() and get() find started modules", CT.has("kit") && CT.get("kit").seen === "type");
  check("an unknown id is null, never an error", CT.get("nothing") === null && CT.has("nothing") === false);
  const again = CT.start();
  check("start() runs once: a second call only reports", again.length === 3 && order.length === 3);
}

console.log("Missing and broken modules never stop the page");
{
  const { CT, logs } = freshKernel();
  CT.define("core", [], () => ({ ok: true }));
  CT.define("race-mode", ["core", "race-rules"], () => ({})); // race-rules was never loaded
  CT.define("race-result", ["race-mode"], () => ({}));
  CT.define("arm-mode", ["core"], () => {
    throw new Error("arm broke");
  });
  CT.define("arm-hud", ["arm-mode"], () => ({}));
  CT.define("duel-mode", ["core"], () => ({ ok: true }));
  CT.define("home", ["core", "?race-mode", "?arm-mode", "?duel-mode"], (core, race, arm, duel) => ({
    race,
    arm,
    duel,
  }));
  CT.start({ logger: null });
  check("a module whose dependency is not loaded is skipped", stateOf(CT, "race-mode") === "skipped");
  check(
    "the reason names the missing module",
    /race-rules" is not loaded/.test(CT.status().find((s) => s.id === "race-mode").reason),
  );
  check("a skip passes down to the modules that need it", stateOf(CT, "race-result") === "skipped");
  check("a factory that throws is marked failed", stateOf(CT, "arm-mode") === "failed");
  check("modules that need a failed one are skipped", stateOf(CT, "arm-hud") === "skipped");
  check("everything else still starts", stateOf(CT, "duel-mode") === "started" && stateOf(CT, "home") === "started");
  const home = CT.get("home");
  check(
    "optional dependencies arrive as null when they are missing or broken",
    home.race === null && home.arm === null && home.duel.ok === true,
  );
  check("with logger: null the kernel logs nothing", logs.length === 0);
}
{
  const { CT, logs } = freshKernel();
  CT.define("broken", [], () => {
    throw new Error("boom");
  });
  CT.define("needs-it", ["broken"], () => ({}));
  CT.start();
  check(
    "a failure is logged as an error and a skip as a warning",
    logs.some(([level, text]) => level === "error" && /"broken" failed/.test(text)) &&
      logs.some(([level, text]) => level === "warn" && /"needs-it" was skipped/.test(text)),
  );
}

console.log("Cycles");
{
  const { CT } = freshKernel();
  CT.define("a", ["b"], () => ({}));
  CT.define("b", ["c"], () => ({}));
  CT.define("c", ["a"], () => ({}));
  CT.define("d", ["?a"], (a) => ({ a }));
  CT.define("e", [], () => ({}));
  CT.start({ logger: null });
  const reason = CT.status().find((s) => s.id === "a").reason;
  check(
    "every module on a dependency loop fails",
    ["a", "b", "c"].every((id) => stateOf(CT, id) === "failed"),
  );
  check("the reason shows the loop", /dependency cycle: a -> b -> c -> a/.test(reason));
  check("an optional link into the loop gets null, and the rest starts", CT.get("d").a === null && CT.has("e"));
}

console.log("Switching modules off (?disable=)");
{
  const { CT } = freshKernel();
  for (const id of ["race-rules", "race-mode", "racetrack", "arm-mode", "duel-mode"]) CT.define(id, [], () => ({ id }));
  CT.define("home", ["?race-mode", "?arm-mode", "?duel-mode"], (race, arm, duel) => ({ race, arm, duel }));
  CT.define("needs-arm", ["arm-mode"], () => ({}));
  CT.start({ disable: ["race", " arm-mode "], logger: null });
  check(
    "a family name switches off every module of the family",
    stateOf(CT, "race-rules") === "disabled" && stateOf(CT, "race-mode") === "disabled",
  );
  check("a family name never matches a longer word (racetrack)", stateOf(CT, "racetrack") === "started");
  check("an exact id switches off that module (spaces are trimmed)", stateOf(CT, "arm-mode") === "disabled");
  check("a module that needs a switched off one is skipped", stateOf(CT, "needs-arm") === "skipped");
  check("optional links to switched off modules are null", CT.get("home").race === null && CT.get("home").arm === null);
  check("isDisabled() answers for families and ids", CT.isDisabled("race-hud") && !CT.isDisabled("duel-mode"));
}

console.log("whenReady and late modules");
{
  const { CT, logs } = freshKernel();
  const seen = [];
  CT.define("first", [], () => ({}));
  CT.whenReady(() => seen.push("ready 1:" + CT.has("first")));
  CT.whenReady(() => {
    throw new Error("a bad callback");
  });
  CT.whenReady(() => seen.push("ready 2"));
  check("ready callbacks wait for start()", seen.length === 0);
  CT.start();
  check("ready callbacks run after every module started, in order", seen.join() === "ready 1:true,ready 2");
  check(
    "a failing callback is logged and the others still run",
    logs.some(([l, t]) => l === "error" && /whenReady/.test(t)),
  );
  CT.whenReady(() => seen.push("late callback"));
  check("a callback added after the start runs at once", seen[seen.length - 1] === "late callback");
  CT.define("late", ["first"], () => ({ late: true }));
  check("a module defined after the start starts at once", CT.get("late").late === true);
  CT.define("late-broken", ["missing"], () => ({}));
  check("a late module with a missing dependency is skipped", stateOf(CT, "late-broken") === "skipped");
}

console.log("status()");
{
  const { CT } = freshKernel();
  CT.define("x", [], () => undefined);
  CT.define("y", ["x", "?z"], () => ({}));
  const rows = CT.start({ logger: null });
  check("status lists modules in the order they were defined", rows.map((r) => r.id).join() === "x,y");
  check("status keeps each module's dependencies", rows[1].deps.join() === "x,?z");
  check("a factory that returns nothing still counts as started", rows[0].state === "started" && CT.has("x"));
  check(
    "start time is measured in ms",
    rows.every((r) => typeof r.ms === "number" && r.ms >= 0),
  );
}

console.log("Event bus (events)");
{
  const { get } = load(["events"], { logger: null });
  const events = get("events");
  const got = [];
  const stop = events.on("settings:changed", (p) => got.push("a" + p));
  events.on("settings:changed", () => {
    throw new Error("a broken listener");
  });
  events.on("settings:changed", (p) => got.push("b" + p));
  events.once("settings:changed", (p) => got.push("once" + p));
  const quiet = console.error;
  console.error = () => {};
  events.emit("settings:changed", 1);
  stop();
  events.emit("settings:changed", 2);
  console.error = quiet;
  check("listeners run in the order they started listening", got.slice(0, 3).join() === "a1,b1,once1");
  check("a listener that throws never stops the others", got.includes("b1") && got.includes("b2"));
  check("the stop function and once() remove a listener", got.join() === "a1,b1,once1,b2");
  check("an event nobody listens to is fine", throws(() => events.emit("nobody:listens")) === false);
  check(
    "a listener must be a function",
    throws(() => events.on("x", 5)),
  );
}

console.log("Registry (extension points)");
{
  const { get } = load(["registry"], { logger: null });
  const registry = get("registry");
  const events = get("events");
  const changes = [];
  events.on("registry:changed", (c) => changes.push(`${c.point}/${c.id}`));
  registry.add("mode", { id: "race", order: 20 });
  registry.add("mode", { id: "duel", order: 10 });
  registry.add("mode", { id: "brawl", order: 50 });
  registry.add("mode", { id: "arm", order: 20 });
  check(
    "items are listed by order, then by when they were added",
    registry
      .list("mode")
      .map((m) => m.id)
      .join() === "duel,race,arm,brawl",
  );
  check("one item can be found by id", registry.get("mode", "arm").order === 20 && registry.get("mode", "x") === null);
  check(
    "an id can only be added once per point",
    throws(() => registry.add("mode", { id: "race" })),
  );
  check(
    "every item needs a string id",
    throws(() => registry.add("mode", { order: 1 })),
  );
  check(
    "removing an item takes it out of the list",
    registry.remove("mode", "race") && registry.list("mode").length === 3,
  );
  check("removing an unknown item is a no-op", registry.remove("mode", "race") === false);
  check("an empty point lists nothing", registry.list("nothing-here").length === 0);
  const first = registry.list("mode");
  check(
    "a list is shared and frozen until its point changes",
    registry.list("mode") === first && Object.isFrozen(first) && throws(() => first.push({ id: "x" })),
  );
  registry.add("mode", { id: "net", order: 60 });
  check("a change gives a fresh list", registry.list("mode") !== first && registry.list("mode").length === 4);
  registry.remove("mode", "net");
  check(
    "every change is announced on the event bus",
    changes.join() === "mode/race,mode/duel,mode/brawl,mode/arm,mode/race,mode/net,mode/net",
  );
}

console.log(failed ? `\n${failed} kernel check(s) FAILED` : "\nAll kernel checks passed");
process.exitCode = failed ? 1 : 0;
