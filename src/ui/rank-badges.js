/**
 * Ranked pieces shared by several screens: the tier chip, the RP bar inside a division, and the ranked panel of a
 * result screen (RP change, promotion, hidden rating). Drawing only; the numbers come from ranked.js and backend.js.
 */
CounterType.define("rank-badges", ["config"], (CONFIG) => {
  "use strict";

  const RANKED = CONFIG.ranked;
  const modeLabel = (mode) => (RANKED.modes.find(([id]) => id === mode) || [mode, mode])[1];

  /**
   * A small tier chip with the tier's own color. `tier` is Ranked.tierOf(...), or null during placements.
   *
   * @param {object|null} tier
   * @param {number} [placementsLeft]
   */
  function badge(tier, placementsLeft) {
    if (!tier) {
      const text = placementsLeft
        ? `Placements ${RANKED.placements - placementsLeft}/${RANKED.placements}`
        : "Unranked";
      return `<span class="tier-chip none">${text}</span>`;
    }
    return `<span class="tier-chip" style="--tc:${tier.color}">${tier.name}</span>`;
  }

  /** The RP bar inside a division: its floor to the next division. */
  function rpBar(rp, tier) {
    if (!tier || !tier.next) return `<div class="rp-bar"><i style="width:100%"></i></div>`;
    const pct = Math.max(0, Math.min(100, ((rp - tier.floor) / (tier.next - tier.floor)) * 100));
    return (
      `<div class="rp-bar"><i style="width:${pct}%"></i></div>` +
      `<div class="rp-ends"><span>${tier.floor}</span><span>${tier.next}</span></div>`
    );
  }

  /**
   * The ranked panel of a result screen.
   *
   * @param {{out?: object, err?: boolean, mode: string}|null} result Backend.submitRanked's answer (out), an error,
   *   or neither yet (a loading panel).
   * @param {boolean} [bare] No panel of its own (it sits inside another panel, like the Duel result's extras box).
   */
  function rankedPanel(result, bare = false) {
    if (!result) return "";
    const panel = bare ? "" : " panel";
    if (result.err) {
      return (
        `<div class="mr-ranked${panel}"><div class="card-label"><span>Ranked</span><span>preview</span></div>` +
        `<p class="opt-note">Your rating could not be updated. The match is saved; it will count when you play again.</p></div>`
      );
    }
    if (!result.out) {
      return (
        `<div class="mr-ranked${panel} loading"><div class="card-label"><span>Ranked</span><span>updating</span></div>` +
        `<div class="skel w60"></div><div class="skel w90"></div></div>`
      );
    }
    const out = result.out;
    const tier = out.tierAfterFull;
    let head;
    if (out.placementDone) head = `Placed in <b>${tier ? tier.name : out.tierAfter}</b>`;
    else if (out.placementsLeft > 0) {
      head = `Placement match ${RANKED.placements - out.placementsLeft} of ${RANKED.placements}`;
    } else head = `<b class="${out.delta >= 0 ? "up" : "down"}">${out.delta >= 0 ? "+" : ""}${out.delta} RP</b>`;

    let note = "";
    if (out.promoted) note = `<span class="promo">Promoted to ${out.tierAfter}</span>`;
    else if (out.demoted) note = `<span class="demo">Down to ${out.tierAfter}</span>`;
    else if (out.shield > 0 && out.delta < 0) {
      note = `<span class="shield">Promotion shield held (${out.shield} left)</span>`;
    }

    const rank = out.rank ? `<span class="rk">#${out.rank} global</span>` : "";
    const rp =
      out.placementsLeft > 0
        ? ""
        : `<div class="mr-rp">${badge(tier)}<b>${out.rpAfter} RP</b>${rank}</div>${rpBar(out.rpAfter, tier)}`;
    return `<div class="mr-ranked${panel}"><div class="card-label"><span>Ranked ${modeLabel(result.mode)}</span><span>preview, simulated opponents</span></div>
      <div class="mr-delta">${head}${note}</div>${rp}
      <div class="mr-mmr">Hidden rating ${out.mmrBefore} to ${out.mmrAfter}</div></div>`;
  }

  return Object.freeze({ badge, rpBar, rankedPanel, modeLabel });
});
