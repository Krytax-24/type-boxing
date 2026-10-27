/**
 * Brawl touch controls: the on-screen buttons for phones and tablets, laid out like Shadow Fight 2. A 3x3 pad on the
 * left (move, jump and crouch, with corner jumps and crouches) and the attack cluster on the right (two punches, two
 * kicks, the projectile, the rising move and the super). Each button carries the input bit it presses
 * (brawl-rules.js IN); brawl-input.js reads them. The pad sits outside #ui so it keeps a real finger size at any
 * interface scale, and stays hidden unless a Brawl fight runs on a touch screen.
 */
CounterType.define("brawl-touch", ["brawl-rules", "dom"], (Brawl, dom) => {
  "use strict";

  const IN = Brawl.IN;
  const button = (bit, cls, label, inner) =>
    `<button data-bit="${bit}" class="tb ${cls}" tabindex="-1" aria-label="${label}">${inner}</button>`;

  const el = dom.ensure(document.body, "touch", "div", "hidden");
  el.setAttribute("aria-label", "Touch controls");
  el.innerHTML =
    `<div id="touch-pad">` +
    button(IN.U | IN.L, "ul", "Jump back", "&#9702;") +
    button(IN.U, "up", "Jump", "&#9650;") +
    button(IN.U | IN.R, "ur", "Jump forward", "&#9702;") +
    button(IN.L, "left", "Left", "&#9664;") +
    button(IN.R, "right", "Right", "&#9654;") +
    button(IN.D | IN.L, "dl", "Crouch left", "&#9702;") +
    button(IN.D, "down", "Crouch", "&#9660;") +
    button(IN.D | IN.R, "dr", "Crouch right", "&#9702;") +
    `</div><div id="touch-acts">` +
    button(IN.FB, "sm q", "Projectile", "<b>PROJ</b>") +
    button(IN.DP, "sm r", "Rising move", "<b>RISE</b>") +
    button(IN.SU, "sm su", "Super", "<b>SUPER</b>") +
    button(IN.HP, "act hp", "High punch", "<b>PUNCH</b><i>high</i>") +
    button(IN.HK, "act hk kick", "High kick", "<b>KICK</b><i>high</i>") +
    button(IN.LP, "act lp", "Low punch", "<b>PUNCH</b><i>low</i>") +
    button(IN.LK, "act lk kick", "Low kick", "<b>KICK</b><i>low</i>") +
    `</div>`;

  return Object.freeze({ element: () => el });
});
