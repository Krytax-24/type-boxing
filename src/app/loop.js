/**
 * Loop: the main loop, one requestAnimationFrame per display frame.
 *
 * The mode that owns the view steps and draws itself (each mode keeps its own fixed timestep, so a fight plays the
 * same at any frame rate). On the menus the backdrop draws the sparring loop. Screens with a live preview add a
 * frame hook. A mode that throws is logged and the loop keeps going, so one broken module never freezes the game.
 */
CounterType.define("loop", ["session", "online-gateway", "settings", "dom"], (session, net, settings, dom) => {
  "use strict";

  const MAX_STEP = 0.05; // a long frame (a pause, a slow device) never steps more than this at once
  const FPS_EVERY_MS = 500;

  const hooks = [];
  let backdrop = null;
  let last = performance.now();
  let nextDraw = 0; // frame rate limit: when the next frame may be drawn
  let running = false;
  const reported = new Set();

  /** Average cost of a frame's work (for the FPS overlay and the performance tests). */
  const stats = { frames: 0, ms: 0 };
  const fps = { frames: 0, ms: 0, since: performance.now() };

  /** Adds a per-frame hook: hook(dt). Returns a function that removes it. */
  function onFrame(hook) {
    hooks.push(hook);
    return () => hooks.splice(hooks.indexOf(hook), 1);
  }

  /** What draws the arena when no mode owns the view (the menus). */
  function setBackdrop(draw) {
    backdrop = draw;
  }

  function report(where, error) {
    const key = where + ":" + (error && error.message);
    if (reported.has(key)) return;
    reported.add(key);
    console.error(`loop: ${where} failed.`, error);
  }

  function frame(now) {
    // Frame rate limit (Graphics tab): skip a display frame instead of drawing it. The simulation keeps its own
    // fixed step, so skipping frames never changes how a fight plays.
    const cap = settings.values.frameCap;
    if (cap) {
      const every = 1000 / cap;
      if (now < nextDraw - 1) {
        requestAnimationFrame(frame);
        return;
      }
      nextDraw += every;
      if (nextDraw < now - every) nextDraw = now; // fell behind: do not catch up in a burst
    }
    const dt = Math.min((now - last) / 1000, MAX_STEP);
    last = now;
    const begin = performance.now();

    const owner = session.activeMode();
    try {
      if (owner) owner.frame(dt);
      else if (backdrop) backdrop(dt);
    } catch (error) {
      report(owner ? `the "${owner.id}" mode` : "the backdrop", error);
    }
    try {
      net.tick();
    } catch (error) {
      report("the online layer", error);
    }
    const hookDt = session.paused() ? 0 : dt;
    for (const hook of hooks.slice()) {
      try {
        hook(hookDt);
      } catch (error) {
        report("a frame hook", error);
      }
    }

    const cost = performance.now() - begin;
    stats.frames++;
    stats.ms += cost;
    showFps(now, cost);
    requestAnimationFrame(frame);
  }

  // Graphics > Show FPS: frames per second and the time each frame takes.
  function showFps(now, cost) {
    if (!settings.values.showFps) {
      fps.frames = 0;
      fps.ms = 0;
      fps.since = now;
      return;
    }
    fps.frames++;
    fps.ms += cost;
    if (now - fps.since < FPS_EVERY_MS) return;
    const perSecond = Math.round((fps.frames * 1000) / (now - fps.since));
    dom.byId("perf").textContent = `${perSecond} FPS  ${(fps.ms / fps.frames).toFixed(1)} ms`;
    fps.frames = 0;
    fps.ms = 0;
    fps.since = now;
  }

  settings.watch((values) => dom.byId("perf").classList.toggle("hidden", !values.showFps));

  /** Starts the loop (once). */
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  return Object.freeze({ start, onFrame, setBackdrop, stats });
});
