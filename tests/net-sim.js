// Protocol checks for private-room multiplayer messages.
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const ctx = { console, globalThis: {}, window: undefined };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["config.js", "protocol.js"]) {
  const src = fs.readFileSync(path.join(root, "js", f), "utf8").replace(/^const (\w+) =/gm, "var $1 =");
  vm.runInContext(src, ctx, { filename: f });
}

let failed = 0;
function check(name, ok) { console.log((ok ? "  ok   " : "  FAIL ") + name); if (!ok) failed++; }
const P = ctx.Protocol, cfg = ctx.CONFIG.net;

console.log("Protocol");
check("hello validates", !!P.validate(P.hello({ name: "Krishna", fighter: "cyborg", color: "#4ade80", gameVersion: cfg.gameVersion }), cfg));
check("ready validates", !!P.validate(P.ready(true), cfg));
check("start validates", !!P.validate(P.start(123, ["cyborg", "bluex"], ["PLAYER", "FRIEND"], 3), cfg));
check("start carries match rules, round and wins", !!P.validate(P.start(5, ["a", "b"], ["P", "Q"], 3, { rounds: 3, timer: 60, endless: false, words: "on" }, 2, [1, 0]), cfg));
check("bad rules are rejected", !P.validate(P.start(5, ["a", "b"], ["P", "Q"], 3, { rounds: 9, timer: 60, endless: false, words: "on" }, 1, [0, 0]), cfg) &&
  !P.validate(P.start(5, ["a", "b"], ["P", "Q"], 3, { rounds: 1, timer: 17, endless: false, words: "on" }, 1, [0, 0]), cfg) &&
  !P.validate(P.start(5, ["a", "b"], ["P", "Q"], 3, { rounds: 1, timer: 60, endless: false, words: "x" }, 1, [0, 0]), cfg));
check("start can name the Brawl game", !!P.validate(P.start(5, ["a", "b"], ["P", "Q"], 3, { rounds: 3, timer: 60, endless: false, words: "on" }, 1, [0, 0], 4, "brawl"), cfg) && P.start(1, ["a", "b"], ["P", "Q"], 3).game === "typing");
check("an unknown game is rejected", !P.validate(Object.assign(P.start(5, ["a", "b"], ["P", "Q"], 3), { game: "chess" }), cfg));
check("brawl buttons validate", !!P.validate(P.bin(7, 85), cfg) && !P.validate({ t: "bin", v: 1, n: 1, m: 9999 }, cfg) && !P.validate({ t: "bin", v: 1, n: -1, m: 1 }, cfg));
check("keys validates", !!P.validate(P.keys(1, [{ k: "a", lt: 0.1 }, { k: "Submit", lt: 0.2 }, { k: "Backspace", lt: 0.3 }]), cfg));
check("state validates", !!P.validate(P.state(1, { t: 1, phase: "fight", hp: [100, 99] }, 3), cfg));
check("result validates", !!P.validate(P.result(0, 12.5, null), cfg));
check("oversized messages are rejected", !P.validate({ t: "error", v: 1, message: "x".repeat(cfg.maxMessageBytes) }, cfg));
check("bad key batches are rejected", !P.validate(P.keys(1, Array.from({ length: cfg.maxKeysPerMessage + 1 }, () => ({ k: "a", lt: 1 }))), cfg));
check("unknown messages are rejected", !P.validate({ t: "hack", v: 1 }, cfg));

console.log(failed ? `\n${failed} check(s) failed` : "\nAll protocol checks passed");
process.exitCode = failed ? 1 : 0;
