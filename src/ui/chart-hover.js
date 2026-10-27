/**
 * Chart hover: a vertical line and a tooltip that follow the mouse over a chart.
 *
 * Works on any element with the class "hover-wrap" whose data-pts attribute holds [[x from 0 to 1, text], ...]
 * and that contains a ".cross" and a ".tip" element. Used by the stats charts and the typing result chart.
 */
CounterType.define("chart-hover", [], () => {
  "use strict";

  /**
   * Wires every matching chart inside `root`.
   *
   * @param {ParentNode} root
   * @param {{selector?: string, tipMax?: number}} [options] tipMax: the furthest left the tooltip may sit, in percent.
   */
  function bind(root, options = {}) {
    const selector = options.selector || ".hover-wrap";
    const tipMax = options.tipMax !== undefined ? options.tipMax : 70;
    root.querySelectorAll(selector).forEach((wrap) => {
      let points;
      try {
        points = JSON.parse(wrap.dataset.pts || "[]");
      } catch (error) {
        points = [];
      }
      if (!points.length) return;
      const cross = wrap.querySelector(".cross");
      const tip = wrap.querySelector(".tip");
      wrap.addEventListener("mousemove", (e) => {
        const box = wrap.getBoundingClientRect();
        const at = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
        let best = points[0];
        for (const p of points) if (Math.abs(p[0] - at) < Math.abs(best[0] - at)) best = p;
        cross.style.left = best[0] * 100 + "%";
        cross.style.display = "block";
        tip.textContent = best[1];
        tip.style.display = "block";
        tip.style.left = Math.min(tipMax, Math.max(0, best[0] * 100 - 8)) + "%";
      });
      wrap.addEventListener("mouseleave", () => {
        cross.style.display = "none";
        tip.style.display = "none";
      });
    });
  }

  return Object.freeze({ bind });
});
