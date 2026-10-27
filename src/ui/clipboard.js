/**
 * Clipboard: copies text and says so in a toast. The Clipboard API needs a secure page (https or localhost); the
 * old copy command is the fallback for a page opened from a file.
 */
CounterType.define("clipboard", ["toast"], (toast) => {
  "use strict";

  /**
   * @param {string} text
   * @param {string} doneMessage Shown when the copy worked.
   */
  function copy(text, doneMessage) {
    const fallback = () => {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (error) {
        ok = false;
      }
      area.remove();
      toast.show(ok ? doneMessage : "Could not copy. Select the text and press Ctrl+C.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast.show(doneMessage), fallback);
    } else {
      fallback();
    }
  }

  return Object.freeze({ copy });
});
