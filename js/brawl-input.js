// Brawl input: the keyboard, game controllers and on-screen touch buttons, each turned into the same input mask
// that js/brawl.js reads (LEFT RIGHT UP DOWN PUNCH KICK SPECIAL BLOCK). Reads devices, never changes a rule.
const BrawlInput = (() => {
  const IN = Brawl.IN;
  const down = new Set();          // keyboard: KeyboardEvent.code of the keys held now
  let touchBits = 0;               // touch: bits held now
  const touchPtr = new Map();      // pointerId -> bit
  let startEdge = false, lastStart = [false, false, false, false];
  let onPause = null;

  // Key maps by physical key (e.code), so they work on any keyboard layout. Right hand (the default): the arrow keys move and the
  // left hand plays A high punch, S low punch, Z high kick, X low kick, with Q the fighter's projectile and R its rising move (Q and R
  // together are the super). Left hand mirrors it: WASD moves and the right hand plays ; L / . with P and O.
  const MAPS = {
    right: {
      [IN.L]: ["ArrowLeft"], [IN.R]: ["ArrowRight"], [IN.U]: ["ArrowUp", "Space"], [IN.D]: ["ArrowDown"],
      [IN.HP]: ["KeyA"], [IN.LP]: ["KeyS"], [IN.HK]: ["KeyZ"], [IN.LK]: ["KeyX"], [IN.FB]: ["KeyQ"], [IN.DP]: ["KeyR"], [IN.SU]: ["KeyE"],
    },
    left: {
      [IN.L]: ["KeyA"], [IN.R]: ["KeyD"], [IN.U]: ["KeyW", "Space"], [IN.D]: ["KeyS"],
      [IN.HP]: ["Semicolon"], [IN.LP]: ["KeyL"], [IN.HK]: ["Slash"], [IN.LK]: ["Period"], [IN.FB]: ["KeyP"], [IN.DP]: ["KeyO"], [IN.SU]: ["BracketLeft"],
    },
  };
  // What the keys are called on screen, for the controls card.
  const LABELS = {
    right: { keys: { hp: "A", lp: "S", hk: "Z", lk: "X" }, move: "Arrow keys", high: "A punch, Z kick", low: "S punch, X kick", specials: "Q projectile, R rising move, Q + R super" },
    left: { keys: { hp: ";", lp: "L", hk: "/", lk: "." }, move: "W A S D", high: "; punch, / kick", low: "L punch, . kick", specials: "P projectile, O rising move, P + O super" },
  };
  let hand = "right";
  const setHand = (h) => { hand = h === "left" ? "left" : "right"; down.clear(); };
  const labels = () => LABELS[hand];

  function keyMask(name) {
    let m = 0;
    const map = MAPS[name || hand];
    for (const bit in map) if (map[bit].some((c) => down.has(c))) m |= +bit;
    return m;
  }

  // Controllers (standard layout): stick or d-pad moves, X is the high punch, A the low kick, Y the high kick, B the low punch,
  // RB the projectile, RT the rising move, LB + LT together or Back the super, Start pauses.
  function padMask(pad) {
    if (!pad) return 0;
    const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed), ax = pad.axes || [];
    let m = 0;
    if (b(14) || ax[0] < -0.45) m |= IN.L;
    if (b(15) || ax[0] > 0.45) m |= IN.R;
    if (b(12) || ax[1] < -0.65) m |= IN.U;
    if (b(13) || ax[1] > 0.65) m |= IN.D;
    if (b(2)) m |= IN.HP;
    if (b(1)) m |= IN.LP;
    if (b(3)) m |= IN.HK;
    if (b(0)) m |= IN.LK;
    if (b(5)) m |= IN.FB;
    if (b(7)) m |= IN.DP;
    if (b(4) || b(8)) m |= IN.SU;
    return m;
  }
  function pads() {
    const list = (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).filter((p) => p && p.connected);
    return list;
  }

  // The input mask of the human player: keyboard (for the chosen hand), touch and any controller.
  function mask() {
    const list = pads();
    const m = keyMask() | touchBits | list.reduce((acc, p) => acc | padMask(p), 0);
    // A start press on any controller pauses (edge detected here because the game never sees controller events).
    list.forEach((p, i) => {
      const now = !!(p.buttons[9] && p.buttons[9].pressed);
      if (now && !lastStart[i]) startEdge = true;
      lastStart[i] = now;
    });
    if (startEdge) { startEdge = false; if (onPause) onPause(); }
    return m;
  }

  window.addEventListener("keydown", (e) => { down.add(e.code); });
  window.addEventListener("keyup", (e) => { down.delete(e.code); });
  window.addEventListener("blur", () => { down.clear(); touchBits = 0; touchPtr.clear(); syncTouchUi(); });
  const isGameKey = (code) => Object.values(MAPS).some((m) => Object.values(m).some((l) => l.includes(code)));

  // ---------- Touch ----------
  const touchEl = () => document.getElementById("touch");
  function syncTouchUi() {
    const el = touchEl();
    if (!el) return;
    el.querySelectorAll("[data-bit]").forEach((b) => b.classList.toggle("on", !!(touchBits & +b.dataset.bit)));
  }
  function recompute() { touchBits = 0; touchPtr.forEach((bit) => { touchBits |= bit; }); syncTouchUi(); }
  function wireTouch() {
    const el = touchEl();
    if (!el || el.dataset.wired) return;
    el.dataset.wired = "1";
    const bitOf = (t) => { const b = t && t.closest ? t.closest("[data-bit]") : null; return b ? +b.dataset.bit : 0; };
    // A finger can slide from one button to another, so the pad follows the pointer instead of a single button.
    const hit = (x, y) => bitOf(document.elementFromPoint(x, y));
    el.addEventListener("pointerdown", (e) => {
      const bit = hit(e.clientX, e.clientY);
      if (!bit) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* not capturable: still works */ }
      touchPtr.set(e.pointerId, bit); recompute();
    });
    el.addEventListener("pointermove", (e) => {
      if (!touchPtr.has(e.pointerId)) return;
      const bit = hit(e.clientX, e.clientY);
      if (bit) touchPtr.set(e.pointerId, bit); else touchPtr.delete(e.pointerId);
      recompute();
    });
    const up = (e) => { if (touchPtr.delete(e.pointerId)) recompute(); };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  const isTouchDevice = () => {
    try { return matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0 || new URLSearchParams(location.search).has("touch"); } catch (e) { return false; }
  };
  function showTouch(on) {
    const el = touchEl();
    if (!el) return;
    wireTouch();
    el.classList.toggle("hidden", !on);
    if (!on) { touchPtr.clear(); recompute(); }
  }

  const setLayout = (h) => { const el = touchEl(); if (el) el.classList.toggle("lefty", h === "left"); };
  return { mask, MAPS, LABELS, labels, setHand, setLayout, isGameKey, showTouch, isTouchDevice, setPause: (fn) => { onPause = fn; }, clear: () => { down.clear(); touchPtr.clear(); recompute(); } };
})();
