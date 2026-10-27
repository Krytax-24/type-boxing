// Lint rules for CounterType. `npm run lint` (after `npm install`).
//
// The rules that keep modules isolated:
//   no-undef + no-implicit-globals: a module can only use what its dependency list hands it, plus the browser.
//   no-restricted-globals: browser globals with easily confused names (screen, top, name, status, open, ...) count
//   as undefined, so a forgotten local variable can never silently read a property of `window` instead.
const js = require("@eslint/js");
const globals = require("globals");

const CONFUSING_BROWSER_GLOBALS = [
  "addEventListener",
  "blur",
  "close",
  "closed",
  "confirm",
  "defaultStatus",
  "event",
  "external",
  "find",
  "focus",
  "frameElement",
  "frames",
  "history",
  "innerHeight",
  "innerWidth",
  "length",
  "locationbar",
  "menubar",
  "moveBy",
  "moveTo",
  "name",
  "onblur",
  "onerror",
  "onfocus",
  "onload",
  "onresize",
  "onunload",
  "open",
  "opener",
  "outerHeight",
  "outerWidth",
  "pageXOffset",
  "pageYOffset",
  "parent",
  "print",
  "removeEventListener",
  "resizeBy",
  "resizeTo",
  "screen",
  "screenLeft",
  "screenTop",
  "screenX",
  "screenY",
  "scroll",
  "scrollbars",
  "scrollBy",
  "scrollTo",
  "scrollX",
  "scrollY",
  "self",
  "status",
  "statusbar",
  "stop",
  "toolbar",
  "top",
];

const quality = {
  "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
  "no-implicit-globals": "error",
  "no-restricted-globals": ["error", ...CONFUSING_BROWSER_GLOBALS],
  "prefer-const": "error",
  "no-var": "error",
  eqeqeq: ["error", "smart"],
  curly: ["error", "multi-line"],
  "max-statements-per-line": ["error", { max: 1 }],
  "no-shadow": ["warn", { builtinGlobals: false }],
  "no-param-reassign": "off",
  "no-empty": ["error", { allowEmptyCatch: true }],
  complexity: ["warn", 30],
  "max-depth": ["warn", 5],
};

module.exports = [
  { ignores: ["src/vendor/**", "dist/**", "node_modules/**", "docs/health/**"] },
  js.configs.recommended,
  {
    // The game: classic scripts in the browser. One global of our own: CounterType (src/kernel/kernel.js).
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, CounterType: "readonly" },
    },
    rules: quality,
  },
  {
    // PeerJS is the one library, and only the peer wrapper may touch it.
    files: ["src/net/net-peer.js"],
    languageOptions: { globals: { Peer: "readonly" } },
  },
  {
    // The kernel defines CounterType itself.
    files: ["src/kernel/kernel.js"],
    languageOptions: { globals: { CounterType: "off" } },
  },
  {
    // Node: tests and tools.
    files: ["tests/**/*.js", "tools/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node } },
    rules: { ...quality, "no-restricted-globals": "off" },
  },
];
