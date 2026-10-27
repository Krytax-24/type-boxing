/**
 * Type view: the Monkeytype style typing box shared by Race and Arm Wrestling. Drawing only: the rules decide what
 * is right or wrong, this component shows it.
 *
 * It reads a small adapter instead of a rule object, so one view serves the race's word engine (race-rules.js) and
 * the arm wrestle's endless TypingStream (typing.js):
 *   count()  words available now (grows for an endless stream)
 *   text(i)  the target word i
 *   index()  the current word
 *   typed()  what is typed in the current word (wrong and extra letters included)
 *   final(i) what was typed in a finished word (null: typed exactly)
 *   done()   true once there is nothing left to type (hides the caret)
 *
 * Look: untyped letters dim, typed right letters bright, wrong letters red, extra letters dark red, a finished word
 * typed wrong gets a red underline, the current word gets one too while it holds a mistake. One caret that slides
 * between letters and blinks only while you are not typing. Three lines; the current word stays on the second line.
 */
CounterType.define("type-view", ["settings", "dom"], (settings, dom) => {
  "use strict";

  const TYPING_IDLE_MS = 650;
  const DEFAULT_LINE_HEIGHT = 44;

  // The mouse pointer hides while you type and comes back when the mouse moves (one listener for every view).
  let cursorHidden = false;
  function hideCursor() {
    if (cursorHidden) return;
    cursorHidden = true;
    document.body.classList.add("mt-nocursor");
  }
  window.addEventListener("mousemove", () => {
    if (!cursorHidden) return;
    cursorHidden = false;
    document.body.classList.remove("mt-nocursor");
  });

  class TypeView {
    /**
     * @param {HTMLElement} root The box the view fills.
     * @param {object} source The adapter described above.
     * @param {{cls?: string}} [options] An extra class for the view (mt-race, mt-arm).
     */
    constructor(root, source, options = {}) {
      this.root = root;
      this.src = source;
      this.opts = options;
      root.innerHTML =
        `<div class="mt${options.cls ? " " + options.cls : ""}"><div class="mt-live"></div>` +
        `<div class="mt-words"><div class="mt-inner"><i class="mt-caret"></i></div></div></div>`;
      this.box = root.firstElementChild;
      this.liveEl = this.box.querySelector(".mt-live");
      this.inner = this.box.querySelector(".mt-inner");
      this.caret = this.box.querySelector(".mt-caret");
      this.els = [];
      this.texts = [];
      this.last = 0;
      this.scroll = 0;
      this.lineH = 0;
      this.idle = null;
      this.liveHtml = "";
      this.sync();
      for (let i = 0; i < this.els.length; i++) this.word(i);
      this.update(true);
    }

    // New words at the end (endless stream), or a full rebuild if the words before changed.
    sync() {
      const n = this.src.count();
      for (let i = 0; i < Math.min(n, this.els.length); i++) {
        if (this.texts[i] !== this.src.text(i)) {
          this.rebuild();
          return;
        }
      }
      for (let i = this.els.length; i < n; i++) {
        const el = document.createElement("span");
        el.className = "mt-w";
        this.inner.insertBefore(el, this.caret);
        this.els.push(el);
        this.texts.push(this.src.text(i));
        this.word(i);
      }
    }

    rebuild() {
      this.els.forEach((el) => el.remove());
      this.els = [];
      this.texts = [];
      this.last = 0;
      this.sync();
    }

    // One word's letters and classes.
    word(i) {
      const el = this.els[i];
      const text = this.texts[i];
      const current = this.src.index();
      if (!el) return;
      const done = i < current;
      const now = i === current && !this.src.done();
      const final = done ? this.src.final(i) : null;
      let typed = "";
      if (done) typed = final === null ? text : final;
      else if (now) typed = this.src.typed();

      let html = "";
      let bad = false;
      const n = Math.max(text.length, typed.length);
      for (let j = 0; j < n; j++) {
        if (j >= text.length) {
          html += `<span class="l x">${dom.escapeHtml(typed[j])}</span>`;
          bad = true;
        } else if (j < typed.length) {
          const ok = typed[j] === text[j];
          if (!ok) bad = true;
          html += `<span class="l ${ok ? "ok" : "bad"}">${dom.escapeHtml(text[j])}</span>`;
        } else {
          html += `<span class="l">${dom.escapeHtml(text[j])}</span>`;
        }
      }
      el.innerHTML = html;
      el.className =
        "mt-w" +
        (done && final !== null && final !== text ? " wrong" : "") +
        (now && bad ? " err" : "") +
        (now ? " cur" : "");
    }

    // After every key: redraw the words that can have changed, move the caret, scroll, and stop the blink.
    update(quiet) {
      this.sync();
      const current = Math.min(this.src.index(), this.els.length - 1);
      const from = Math.max(0, Math.min(this.last, current) - 1);
      for (let i = from; i <= Math.max(this.last, current) && i < this.els.length; i++) this.word(i);
      this.last = current;
      this.place();
      if (!quiet) {
        this.box.classList.add("typing");
        clearTimeout(this.idle);
        this.idle = setTimeout(() => this.box.classList.remove("typing"), TYPING_IDLE_MS);
        hideCursor();
      }
    }

    // Caret and scroll. The caret slides (a CSS transition on transform), so fast typing reads as one smooth motion.
    place() {
      const i = Math.min(this.src.index(), this.els.length - 1);
      const el = this.els[i];
      if (!el) return;
      this.caret.style.display = this.src.done() ? "none" : "";
      const letters = el.children;
      const at = Math.min(this.src.done() ? 0 : this.src.typed().length, letters.length);
      let x;
      // Letter offsets are already measured from .mt-inner (the nearest positioned box).
      if (at < letters.length) {
        x = letters[at].offsetLeft;
      } else {
        const last = letters[letters.length - 1];
        x = last ? last.offsetLeft + last.offsetWidth : el.offsetLeft;
      }
      const y = el.offsetTop;
      this.caret.style.transform = `translate(${x - 1}px, ${y}px)`;
      if (!this.lineH) this.lineH = el.offsetHeight || DEFAULT_LINE_HEIGHT;
      const want = Math.max(0, el.offsetTop - this.lineH);
      if (want !== this.scroll) {
        this.scroll = want;
        this.inner.style.transform = `translateY(${-want}px)`;
      }
    }

    // A wrong Space (the word is not right yet) or a blocked key: a short shake on the current word.
    nudge() {
      const el = this.els[this.src.index()];
      if (!el || settings.values.reduceMotion) return;
      dom.replayClass(el, "nudge");
    }

    // The small live line above the words (progress, wpm, accuracy), in the caret color like Monkeytype.
    live(html) {
      if (html === this.liveHtml) return;
      this.liveHtml = html;
      this.liveEl.innerHTML = html;
    }

    destroy() {
      clearTimeout(this.idle);
      this.root.innerHTML = "";
    }
  }

  return TypeView;
});
