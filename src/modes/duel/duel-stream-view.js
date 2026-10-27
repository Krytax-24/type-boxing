/**
 * Duel stream view: the Monkeytype style typing box of the Classic view, bottom center between the HUD panels.
 *
 * It shows your own word stream (three lines, the current word on the second one) with a sliding caret. It owns
 * its markup (#typing-box inside the HUD layer) and only reads the stream; typing never goes through it.
 * In the Over-head view the box is hidden by CSS and the words float over the fighters on the canvas instead.
 */
CounterType.define("duel-stream-view", ["dom"], (dom) => {
  "use strict";

  const LINE_HEIGHT = 46; // design px of one line of words (matches the CSS)
  const CARET_TOP = 6; // the caret sits this far below the top of a line
  const TYPING_MS = 600; // the caret stops blinking while you type, and blinks again after this pause

  const box = dom.ensure(dom.byId("hud-layer"), "typing-box", "div", "panel");
  box.innerHTML = `<div id="words"><div id="words-inner"><div id="caret"></div></div></div>`;
  const inner = dom.byId("words-inner");
  const caret = dom.byId("caret");

  /** The view of one stream. A new fight makes a new one (create()). */
  class StreamView {
    constructor(stream) {
      this.stream = stream;
      this.els = [];
      this.rendered = 0;
      this.scroll = 0;
      this.typingTimer = 0;
      this.rebuild();
    }

    /** Draws every word again from the start. */
    rebuild() {
      inner.querySelectorAll(".word").forEach((el) => el.remove());
      this.els = [];
      this.stream.words.forEach((word, i) => this.addWord(i));
      this.scroll = 0;
      inner.style.transform = "translateY(0)";
      this.rendered = 0;
      this.update();
    }

    addWord(i) {
      const el = document.createElement("span");
      el.className = "word";
      el.wordRef = this.stream.words[i];
      inner.insertBefore(el, caret);
      this.els.push(el);
      this.renderWord(i);
    }

    /**
     * Keeps the elements in step with the stream (new words at the end, an ultimate word inserted).
     *
     * @returns {boolean} True when something changed.
     */
    sync() {
      const words = this.stream.words;
      const same = words.length === this.els.length && this.els.every((el, i) => el.wordRef === words[i]);
      if (same) return false;
      const stale =
        this.els.some((el, i) => i < words.length && el.wordRef !== words[i]) || words.length < this.els.length;
      if (stale) {
        this.rebuild();
        return true;
      }
      for (let i = this.els.length; i < words.length; i++) this.addWord(i);
      return true;
    }

    renderWord(i) {
      const stream = this.stream;
      const word = stream.words[i];
      const el = this.els[i];
      const done = i < stream.index;
      let typed = "";
      if (done) typed = word.typedFinal || "";
      else if (i === stream.index) typed = stream.typed;

      let html = "";
      const length = Math.max(word.text.length, typed.length);
      for (let j = 0; j < length; j++) {
        const letter = dom.escapeHtml(j < word.text.length ? word.text[j] : typed[j]);
        let cls = "";
        if (j < typed.length) {
          if (j >= word.text.length) cls = "bad extra";
          else cls = typed[j] === word.text[j] ? "ok" : "bad";
        }
        html += cls ? `<span class="${cls}">${letter}</span>` : `<span>${letter}</span>`;
      }
      el.innerHTML = html;
      el.className = "word" + (word.ultimate ? " ult" : "") + (done && word.typedFinal !== word.text ? " wrong" : "");
    }

    /** Draws what changed since the last call and moves the caret. Call it after every key. */
    update() {
      this.sync();
      const stream = this.stream;
      // Re-render the words that changed: everything from the last rendered word to the current one.
      for (let i = Math.max(0, this.rendered - 1); i <= stream.index && i < this.els.length; i++) this.renderWord(i);
      this.rendered = stream.index;

      const current = this.els[stream.index];
      if (!current) return;
      const letters = current.children;
      const at = Math.min(stream.typed.length, letters.length);
      let left;
      let top;
      if (at < letters.length) {
        left = letters[at].offsetLeft;
        top = letters[at].offsetTop;
      } else {
        const last = letters[letters.length - 1];
        left = last.offsetLeft + last.offsetWidth;
        top = last.offsetTop;
      }
      caret.style.left = left - 1 + "px";
      caret.style.top = top + CARET_TOP + "px";

      // Keep the current word on the second line.
      const want = Math.max(0, current.offsetTop - LINE_HEIGHT);
      if (want !== this.scroll) {
        this.scroll = want;
        inner.style.transform = `translateY(${-want}px)`;
      }
      caret.classList.add("typing");
      clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => caret.classList.remove("typing"), TYPING_MS);
    }
  }

  /** A view of a stream (your own). */
  function create(stream) {
    return new StreamView(stream);
  }

  return Object.freeze({ create });
});
