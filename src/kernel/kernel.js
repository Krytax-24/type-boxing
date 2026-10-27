/**
 * CounterType kernel: the one global the game defines, and the module system every other file uses.
 *
 * Every file under src/ registers exactly one module:
 *
 *     CounterType.define("race-rules", ["config", "random"], (CONFIG, random) => { ... return api; });
 *
 * The kernel starts the modules in dependency order once the page has loaded every script, and hands each
 * factory the exports of the modules it asked for. Nothing else is shared: a module can only reach another
 * module by naming it in its dependency list, so every link between two parts of the game is written down.
 *
 * Plug and play:
 *   - A missing module (its script tag removed) skips only the modules that require it. Everything else starts.
 *   - A module whose factory throws is marked as failed, logged, and skipped the same way. One broken module
 *     never stops the page.
 *   - A dependency written as "?id" is optional: the factory receives null when that module is not there.
 *   - Modules can be switched off without editing any file: open the page with ?disable=race-mode,arm-mode
 *     (a name also matches every module that starts with "name-", so ?disable=race turns off all of Race).
 *   - A module defined after the start (a script added later) starts at once if its dependencies are there.
 *
 * Works the same in the browser (classic scripts, so index.html still opens with a double click) and in node
 * (the tests load the same files into a sandbox and call CounterType.start() themselves).
 */
(function createKernel(root) {
  "use strict";

  const VERSION = "2.0.0";
  const OPTIONAL_PREFIX = "?";

  /** @type {Map<string, {id: string, deps: string[], factory: Function, order: number}>} */
  const definitions = new Map();

  /** @type {Map<string, {state: string, reason: string, exports: *, ms: number}>} */
  const records = new Map();

  const readyCallbacks = [];
  const disabled = new Set();
  let phase = "loading"; // loading -> starting -> ready
  let logger = root.console || null;

  // ---------- Registration ----------

  /**
   * Registers a module. Call it once per file, at the top level of the script.
   *
   * @param {string} id Unique module id: the file name without ".js" (for example "settings-modal").
   * @param {string[]} deps Ids of the modules the factory needs, in the order of its parameters.
   *   Prefix an id with "?" to make it optional (the parameter is null when the module is not there).
   * @param {Function} factory Builds the module. Receives the dependencies, returns the module's exports.
   */
  function define(id, deps, factory) {
    if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      throw new TypeError(`CounterType.define: "${id}" is not a valid module id (lower case, digits and dashes).`);
    }
    if (!Array.isArray(deps)) throw new TypeError(`CounterType.define("${id}"): the dependencies must be an array.`);
    if (typeof factory !== "function") {
      throw new TypeError(`CounterType.define("${id}"): the factory must be a function.`);
    }
    if (definitions.has(id)) throw new Error(`CounterType.define: the module "${id}" is defined twice.`);

    definitions.set(id, { id, deps: deps.slice(), factory, order: definitions.size });

    // A module added after the start (a script loaded later) joins at once.
    if (phase === "ready") {
      startModule(id);
      flushReadyCallbacks();
    }
  }

  // ---------- Starting ----------

  /**
   * Starts every defined module in dependency order. Called automatically when the page has loaded (browser);
   * tests call it themselves.
   *
   * @param {{disable?: string[], logger?: object}} [options]
   * @returns {object[]} The status of every module (see status()).
   */
  function start(options = {}) {
    if (phase !== "loading") return status();
    phase = "starting";
    if (options.logger !== undefined) logger = options.logger;
    for (const name of options.disable || []) disabled.add(String(name).trim());

    const ids = Array.from(definitions.values())
      .sort((a, b) => a.order - b.order)
      .map((definition) => definition.id);
    markCycles(ids);
    for (const id of ids) startModule(id);

    phase = "ready";
    flushReadyCallbacks();
    return status();
  }

  /** A dependency cycle is a programming error: every module on the loop fails, with the loop in the reason. */
  function markCycles(ids) {
    const color = new Map(); // undefined: not visited, 1: on the current path, 2: done
    const path = [];

    function visit(id) {
      color.set(id, 1);
      path.push(id);
      for (const raw of definitions.get(id).deps) {
        const depId = raw.startsWith(OPTIONAL_PREFIX) ? raw.slice(OPTIONAL_PREFIX.length) : raw;
        if (!definitions.has(depId)) continue;
        if (color.get(depId) === 1) {
          const loop = path.slice(path.indexOf(depId)).concat(depId);
          for (const member of loop) {
            if (!records.has(member)) finish(member, "failed", `dependency cycle: ${loop.join(" -> ")}`, undefined, 0);
          }
        } else if (!color.has(depId)) {
          visit(depId);
        }
      }
      path.pop();
      color.set(id, 2);
    }

    for (const id of ids) if (!color.has(id)) visit(id);
  }

  function startModule(id) {
    if (records.has(id)) return records.get(id);

    const definition = definitions.get(id);
    if (!definition) return null;

    if (isDisabled(id)) return finish(id, "disabled", "switched off with ?disable", undefined, 0);

    const args = [];
    for (const raw of definition.deps) {
      const optional = raw.startsWith(OPTIONAL_PREFIX);
      const depId = optional ? raw.slice(OPTIONAL_PREFIX.length) : raw;
      const dep = definitions.has(depId) ? startModule(depId) : null;

      if (dep && dep.state === "started") {
        args.push(dep.exports);
      } else if (optional) {
        args.push(null);
      } else {
        const why = dep ? `"${depId}" is ${dep.state}` : `"${depId}" is not loaded`;
        return finish(id, "skipped", `needs ${why}`, undefined, 0);
      }
    }

    const begin = now();
    try {
      const exports = definition.factory(...args);
      return finish(id, "started", "", exports === undefined ? Object.freeze({}) : exports, now() - begin);
    } catch (error) {
      log("error", `CounterType: the module "${id}" failed to start.`, error);
      return finish(id, "failed", error && error.message ? error.message : String(error), undefined, now() - begin);
    }
  }

  function finish(id, state, reason, exports, ms) {
    const record = { state, reason, exports, ms };
    records.set(id, record);
    if (state === "skipped") log("warn", `CounterType: "${id}" was skipped (${reason}).`);
    return record;
  }

  // ---------- Lifecycle ----------

  /**
   * Runs a callback once every module has started (at once if that already happened). Use it for work that
   * needs the whole game assembled, like drawing the first screen after every mode has registered.
   *
   * @param {Function} callback
   */
  function whenReady(callback) {
    if (typeof callback !== "function") throw new TypeError("CounterType.whenReady needs a function.");
    readyCallbacks.push(callback);
    if (phase === "ready") flushReadyCallbacks();
  }

  function flushReadyCallbacks() {
    while (readyCallbacks.length) {
      const callback = readyCallbacks.shift();
      try {
        callback();
      } catch (error) {
        log("error", "CounterType: a whenReady callback failed.", error);
      }
    }
  }

  // ---------- Queries (tests, the health check and the browser console) ----------

  /** Returns the exports of a started module, or null. Modules use their dependency list instead. */
  function get(id) {
    const record = records.get(id);
    return record && record.state === "started" ? record.exports : null;
  }

  /** True when the module is defined and started. */
  function has(id) {
    return get(id) !== null;
  }

  /** Every defined module with its state ("started", "skipped", "failed", "disabled" or "pending"). */
  function status() {
    return Array.from(definitions.values())
      .sort((a, b) => a.order - b.order)
      .map(({ id, deps }) => {
        const record = records.get(id);
        return {
          id,
          deps: deps.slice(),
          state: record ? record.state : "pending",
          reason: record ? record.reason : "",
          ms: record ? Math.round(record.ms * 100) / 100 : 0,
        };
      });
  }

  /** True when the module id was switched off (exactly, or as part of a family: "race" turns off "race-*"). */
  function isDisabled(id) {
    for (const name of disabled) {
      if (name && (id === name || id.startsWith(name + "-"))) return true;
    }
    return false;
  }

  // ---------- Helpers ----------

  function now() {
    return root.performance && typeof root.performance.now === "function" ? root.performance.now() : Date.now();
  }

  function log(level, message, error) {
    if (!logger || typeof logger[level] !== "function") return;
    if (error) logger[level](message, error);
    else logger[level](message);
  }

  function readDisabledFromAddress() {
    try {
      const value = new URLSearchParams(root.location.search).get("disable");
      return value ? value.split(",") : [];
    } catch (error) {
      return [];
    }
  }

  root.CounterType = Object.freeze({ VERSION, define, start, whenReady, get, has, status, isDisabled });

  // In the browser every classic script has run by DOMContentLoaded, so the whole game is defined by then.
  if (root.document && typeof root.document.addEventListener === "function") {
    root.document.addEventListener("DOMContentLoaded", () => start({ disable: readDisabledFromAddress() }));
  }
})(typeof window !== "undefined" ? window : globalThis);
