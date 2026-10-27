/**
 * Settings tabs "Theme" and "Custom": presets, the eleven color pickers and a share code; a background image and the
 * player's own CSS. Both tabs keep the screen behind visible (the window moves aside), so changes show at once.
 * The engine behind them is themes.js.
 */
CounterType.define(
  "settings-theme-tabs",
  ["registry", "themes", "toast", "buttons", "dom"],
  (registry, Themes, toast, buttons, dom) => {
    "use strict";

    const esc = dom.escapeHtml;

    // ----- Theme tab: presets, 11 color pickers, a share code -----

    function themeHtml() {
      const current = Themes.current;
      const presets = Themes.PRESETS.map((p) => {
        const swatches = ["bg", "surface", "accent", "focus", "gold"]
          .map((k) => `<i style="background:${p.slots[k]}"></i>`)
          .join("");
        return `<button class="preset ${current.id === p.id ? "sel" : ""}" data-act="preset:${p.id}" tabindex="-1"><span class="sw">${swatches}</span><b>${p.name}</b><span class="pn">${p.note}</span></button>`;
      }).join("");
      const slots = Themes.SLOTS.map(
        (s) =>
          `<label class="slot"><input type="color" value="${current.slots[s.key]}" data-slot="${s.key}" tabindex="-1"><span>${s.label}</span></label>`,
      ).join("");
      const custom = current.id === "custom" ? ' <span class="tag">custom colors</span>' : "";
      return `<div class="set-head">Pick a theme${custom}</div>
    <div class="presets">${presets}</div>
    <div class="set-head">Change a color</div>
    <div class="slots">${slots}</div>
    <div class="set-head">Share code</div>
    <div class="code-row"><input type="text" id="theme-code" value="${Themes.exportCode()}" spellcheck="false" autocomplete="off" aria-label="Theme share code">
      ${buttons.segment("code:copy", "Copy")}${buttons.segment("code:use", "Use code")}</div>
    <p class="set-note">Copy the code to share your colors. To use a friend's, paste it in the box and press Use code. Colors change right away behind this window.</p>`;
    }

    function themeAction(name, value, redraw) {
      if (name === "preset") {
        Themes.setPreset(value);
        redraw();
        return true;
      }
      if (name !== "code") return false;
      const box = dom.byId("theme-code");
      if (value === "copy") {
        box.select();
        try {
          navigator.clipboard.writeText(box.value).then(
            () => toast.show("Theme code copied."),
            () => toast.show("Press Ctrl+C to copy the code."),
          );
        } catch (error) {
          toast.show("Press Ctrl+C to copy the code.");
        }
      } else if (Themes.importCode(box.value)) {
        toast.show("Theme applied.");
        redraw();
      } else {
        toast.show("That is not a CounterType theme code. It looks like TB1. followed by 66 letters and digits.");
      }
      return true;
    }

    function themeInput(e) {
      const target = e.target;
      if (!target.dataset.slot) return;
      if (Themes.setSlot(target.dataset.slot, target.value)) {
        const code = dom.byId("theme-code");
        if (code) code.value = Themes.exportCode();
      }
    }

    function themeChange(e, redraw) {
      if (e.target.dataset.slot) redraw();
    }

    // ----- Custom tab: background image and your own CSS -----

    function customHtml() {
      const B = Themes.bg;
      const hasImage = B.url || B.hasFile;
      const slider = (key, label, min, max, step, unit) =>
        `<label class="bg-sl"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${B[key]}" data-bg="${key}" tabindex="-1"><output>${B[key]}${unit}</output></label>`;
      const sizes = [
        ["cover", "Cover"],
        ["contain", "Contain"],
        ["stretch", "Stretch"],
      ]
        .map(([v, l]) => buttons.segment(`bgmode:${v}`, l, { selected: B.mode === v }))
        .join("");
      let imageNote = "No image. It replaces the far scenery; the floor and fighters stay.";
      if (hasImage) imageNote = B.hasFile ? "Using a file from this computer." : "Using the address above.";
      const safeMode = Themes.cssSafeMode ? " <b>Safe mode is on now.</b>" : "";
      return `<div class="set-head">Background image</div>
    <div class="code-row"><input type="text" id="bg-url" value="${esc(B.url)}" placeholder="https://example.com/picture.jpg" spellcheck="false" autocomplete="off" aria-label="Image address">
      ${buttons.segment("bg:url", "Use address")}</div>
    <div class="code-row"><label class="seg filebtn">Choose a file<input type="file" id="bg-file" accept="image/*" tabindex="-1"></label>
      ${buttons.segment("bg:clear", "Remove image", { disabled: !hasImage })}
      <span class="set-note inline">${imageNote}</span></div>
    <div class="bg-grid"><span class="bg-label">Size</span><span class="segs">${sizes}</span>
      ${slider("blur", "Blur", 0, 20, 1, " px")}${slider("brightness", "Brightness", 20, 150, 5, "%")}
      ${slider("opacity", "Opacity", 0, 100, 5, "%")}${slider("saturate", "Saturation", 0, 200, 10, "%")}</div>
    <div class="set-head">Custom CSS</div>
    <textarea id="css-box" rows="7" spellcheck="false" maxlength="${Themes.MAX_CSS}" placeholder="/* Example */&#10;#timer { color: gold; }&#10;.hpfill { border-radius: 4px; }" aria-label="Custom CSS">${esc(Themes.css)}</textarea>
    <div class="code-row">${buttons.segment("css:clear", "Clear CSS")}
      <span class="set-note inline">Only you see this CSS, and it is never sent to anyone. If something breaks, open the game with <b>?nocss</b> at the end of the address.${safeMode}</span></div>`;
    }

    function customAction(name, value, redraw) {
      if (name === "bgmode") {
        Themes.setBg({ mode: value });
        redraw();
      } else if (name === "bg") {
        if (value === "clear") Themes.clearBg().then(redraw);
        else {
          const address = dom.byId("bg-url").value;
          Themes.setBgUrl(address)
            .then((ok) => {
              if (!ok && address.trim()) toast.show("That image could not be loaded.");
              redraw();
            })
            .catch((error) => toast.show(error.message));
        }
      } else if (name === "css" && value === "clear") {
        Themes.setCss("");
        redraw();
      } else {
        return false;
      }
      return true;
    }

    function customInput(e) {
      const target = e.target;
      if (target.dataset.bg) {
        const key = target.dataset.bg;
        const value = parseFloat(target.value);
        Themes.setBg({ [key]: value });
        target.nextElementSibling.textContent = value + (key === "blur" ? " px" : "%");
      } else if (target.id === "css-box") {
        Themes.setCss(target.value);
      }
    }

    function customChange(e, redraw) {
      const target = e.target;
      if (target.id !== "bg-file" || !target.files || !target.files[0]) return;
      Themes.setBgFile(target.files[0])
        .then((ok) => {
          if (!ok) toast.show("That image could not be drawn.");
          redraw();
        })
        .catch((error) => toast.show(error.message));
    }

    registry.add("settings-tab", {
      id: "theme",
      name: "Theme",
      order: 30,
      preview: true,
      html: themeHtml,
      onAction: themeAction,
      onInput: themeInput,
      onChange: themeChange,
    });
    registry.add("settings-tab", {
      id: "custom",
      name: "Custom",
      order: 40,
      preview: true,
      html: customHtml,
      onAction: customAction,
      onInput: customInput,
      onChange: customChange,
    });

    return Object.freeze({});
  },
);
