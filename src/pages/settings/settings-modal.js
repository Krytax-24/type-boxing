/**
 * Settings window (#mod-settings): tabs of rows over whatever is showing.
 *
 * Tabs come from the registry ("settings-tab"): { id, name, order, rows } for data driven rows (settings-tabs.js),
 * or { id, name, order, html(), preview, onAction(name, x), onInput(e), onChange(e) } for a tab that draws itself
 * (the Theme and Custom tabs). This window adds the Keys tab, built from the "key-help" rows of every loaded module.
 * Keys: 1 to 5 or Tab pick a tab, Up and Down a row, Left, Right or Enter change it, Esc closes.
 */
CounterType.define(
  "settings-modal",
  ["modals", "registry", "actions", "events", "buttons", "dom"],
  (modals, registry, actions, events, buttons, dom) => {
    "use strict";

    const KEYS_ORDER = 90;
    const SCROLL_STEP = 80;
    let tabIndex = 0;
    let rowIndex = 0;

    const el = modals.register({ id: "settings", render, onKey, onAction, preview: true });

    // ---------- The Keys tab ----------

    // Each loaded module adds its own rows ("key-help": { id, order, rows() }); these two close the table.
    function keyRows() {
      const contributed = registry.list("key-help").flatMap((help) => help.rows());
      return contributed.concat([
        ["Any fight", "Escape pauses, and leaving the tab pauses too. The pause menu has restart, settings and quit."],
        ["Mouse and touch", "Every button works by click or tap. Typing stays on the keyboard."],
      ]);
    }

    const keysTab = { id: "keys", name: "Keys", order: KEYS_ORDER, rows: [] };

    function tabs() {
      return registry
        .list("settings-tab")
        .concat([keysTab])
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    const tab = () => tabs()[tabIndex] || tabs()[0];

    // ---------- Rows ----------

    const isRow = (r) => !r.type || r.type === "range" || r.type === "button"; // rows the keyboard can focus
    const firstRow = (t) => (t.rows ? Math.max(0, t.rows.findIndex(isRow)) : 0);
    const rowKeys = (t) => (t.rows || []).map((r, i) => (isRow(r) ? i : -1)).filter((i) => i >= 0);
    const hintOf = (r) => (typeof r.hint === "function" ? r.hint() : r.hint);

    function rowHtml(r, ri) {
      if (r.type === "head") return `<div class="set-head">${r.label}</div>`;
      if (r.type === "note") return `<p class="set-note">${r.html}</p>`;
      const label = `<span class="lbl">${r.label}<span class="hint">${hintOf(r)}</span></span>`;
      let control;
      if (r.type === "range") {
        const v = r.get();
        control = `<span class="rng"><input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}" data-range="${ri}" tabindex="-1" aria-label="${r.label}"><output>${r.fmt(v)}</output></span>`;
      } else if (r.type === "button") {
        control = `<span class="segs">${buttons.segment(`run:${ri}`, r.button)}</span>`;
      } else {
        const current = r.get();
        const choices = r.opts
          .map(([value, text], oi) => buttons.segment(`set:${ri}:${oi}`, text, { selected: value === current }))
          .join("");
        control = `<span class="segs">${choices}</span>`;
      }
      return `<div class="set-row ${ri === rowIndex ? "focus" : ""}" data-row="${ri}">${label}${control}</div>`;
    }

    function render() {
      const t = tab();
      if (t.rows && !isRow(t.rows[rowIndex] || {})) rowIndex = firstRow(t);
      const tabButtons = tabs()
        .map(
          (x, i) =>
            `<button class="tab ${i === tabIndex ? "sel" : ""}" data-act="tab:${i}" tabindex="-1">${x.name}</button>`,
        )
        .join("");
      let body;
      if (t.html) body = t.html();
      else if (t.rows.length) body = t.rows.map(rowHtml).join("");
      else {
        body = `<table class="keys-table">${keyRows()
          .map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`)
          .join("")}</table>`;
      }
      const old = el.querySelector(".set-rows");
      const scroll = old ? old.scrollTop : 0;
      el.innerHTML =
        `<h2 class="screen-title">Settings</h2><div class="tabs">${tabButtons}</div>` +
        `<div class="set-rows">${body}</div><div class="btn-row">${buttons.button("back", "Back", { primary: true })}</div>`;
      el.querySelector(".set-rows").scrollTop = scroll;
      dom.byId("modal").classList.toggle("preview", !!t.preview); // Theme and Custom: the screen behind stays visible
    }

    /** A choice from a row: the row stores and applies it, then the window redraws. */
    function choose(ri, oi) {
      const r = tab().rows[ri];
      if (!r || !isRow(r) || r.type) return;
      rowIndex = ri;
      r.set(r.opts[oi][0]);
      render();
    }

    function runRow(ri) {
      const r = tab().rows[ri];
      if (!r || r.type !== "button") return;
      rowIndex = ri;
      r.run();
      render();
    }

    // Sliders skip the redraw, so the thumb is not replaced mid-drag.
    function slide(ri, raw, redrawOutput = true) {
      const r = tab().rows[ri];
      if (!r || r.type !== "range") return;
      const unit = r.step;
      const value = Math.round(Math.max(r.min, Math.min(r.max, raw)) / unit) * unit;
      r.set(+value.toFixed(3));
      const row = el.querySelector(`[data-row="${ri}"]`);
      if (row) {
        if (redrawOutput) row.querySelector("output").textContent = r.fmt(r.get());
        row.querySelector(".hint").textContent = hintOf(r);
      }
    }

    function focusRow(ri) {
      rowIndex = ri;
      el.querySelectorAll(".set-row").forEach((rowEl) => rowEl.classList.toggle("focus", +rowEl.dataset.row === ri));
      const rowEl = el.querySelector(`[data-row="${ri}"]`);
      if (rowEl && rowEl.scrollIntoView) rowEl.scrollIntoView({ block: "nearest" });
    }

    function step(by) {
      const r = tab().rows && tab().rows[rowIndex];
      if (!r || !isRow(r)) return;
      if (r.type === "range") {
        slide(rowIndex, r.get() + by * r.step);
        const input = el.querySelector(`[data-range="${rowIndex}"]`);
        if (input) input.value = r.get();
      } else if (r.type === "button") {
        if (by > 0) runRow(rowIndex);
      } else {
        const at = r.opts.findIndex(([v]) => v === r.get());
        choose(rowIndex, (Math.max(0, at) + by + r.opts.length) % r.opts.length);
      }
    }

    function moveRow(direction) {
      const keys = rowKeys(tab());
      if (!keys.length) {
        const box = el.querySelector(".set-rows");
        if (box) box.scrollBy({ top: direction * SCROLL_STEP });
        return;
      }
      const at = Math.max(0, keys.indexOf(rowIndex));
      focusRow(keys[(at + direction + keys.length) % keys.length]);
    }

    function selectTab(i) {
      const count = tabs().length;
      tabIndex = (i + count) % count;
      rowIndex = firstRow(tab());
      render();
    }

    // ---------- Opening ----------

    function open() {
      if (modals.top() === "settings") return;
      rowIndex = firstRow(tab());
      modals.open("settings");
    }

    // ---------- Input ----------

    function onKey(e, key) {
      const k = e.key;
      const count = tabs().length;
      if (k === "Escape") actions.run("back");
      else if (k >= "1" && k <= String(count)) selectTab(+k - 1);
      else if (key === " ") step(1);
      else if (k === "Tab") selectTab(tabIndex + (e.shiftKey ? -1 : 1));
      else if (k === "ArrowUp" || k === "ArrowDown") moveRow(k === "ArrowUp" ? -1 : 1);
      else if (k === "ArrowLeft") step(-1);
      else if (k === "ArrowRight" || k === "Enter") step(1);
      return true;
    }

    function onAction(name, x, y) {
      switch (name) {
        case "back":
          modals.close();
          return true;
        case "tab":
          selectTab(+x);
          return true;
        case "set":
          choose(+x, +y);
          return true;
        case "run":
          runRow(+x);
          return true;
        default: {
          const t = tab();
          return !!(t.onAction && t.onAction(name, x, render));
        }
      }
    }

    // Inputs inside the window (sliders, color pickers, text boxes) have their own events.
    el.addEventListener("input", (e) => {
      const target = e.target;
      if (target.dataset.range !== undefined) {
        focusRow(+target.dataset.range);
        slide(+target.dataset.range, parseFloat(target.value));
      } else {
        const t = tab();
        if (t.onInput) t.onInput(e, render);
      }
    });
    el.addEventListener("change", (e) => {
      const target = e.target;
      if (target.dataset.range !== undefined) {
        target.blur(); // hand the keyboard back to the game's own keys
        return;
      }
      const t = tab();
      if (t.onChange) t.onChange(e, render);
    });
    el.addEventListener("pointerup", (e) => {
      if (e.target.type === "range") setTimeout(() => e.target.blur(), 0);
    });

    actions.on("settings", () => open());
    events.on("fullscreen:changed", () => {
      if (modals.top() === "settings") render();
    });

    return Object.freeze({ open, render });
  },
);
