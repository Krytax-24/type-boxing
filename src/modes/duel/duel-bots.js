/**
 * Duel bots: the seven levels (each a typing speed from 15 to 120 wpm) plus MATCH ME, and which one is picked.
 *
 * The number on a card is the average wpm the bot really types; Bot.cfgFor (typing.js) turns it into a raw key
 * rate. MATCH ME aims at your average over your last few finished matches (speed-history.js), so it stays locked
 * until you have finished one: a new player never gets an opponent built from data they do not have.
 */
CounterType.define(
  "duel-bots",
  ["config", "typing", "fighter-stage", "player", "speed-history", "toast", "events"],
  (CONFIG, typing, DuelChars, player, speedHistory, toast, events) => {
    "use strict";

    const { Bot } = typing;
    const DEFAULT_PICK = 4; // DUELIST

    /** Every card: the seven levels, then MATCH ME. */
    const BOTS = CONFIG.duel.bots.concat([Object.assign({ match: true }, CONFIG.duel.matchMe)]);
    const MATCH_ME = BOTS.length - 1;

    let picked = DEFAULT_PICK;

    /** MATCH ME copies YOUR recent speed, so it unlocks after your first finished match. */
    function matchUnlocked() {
      return speedHistory.has();
    }

    // ---------- Cards ----------

    /** The Bot settings for card i; `beatAt` is the card's number (the speed to beat it about half the time). */
    function configFor(i) {
      const card = BOTS[i];
      // A locked MATCH ME shows its start value; it is never used in a fight.
      const live = card.match && matchUnlocked() ? Object.assign({}, card, { wpm: speedHistory.average() }) : card;
      return Object.assign(Bot.cfgFor(live), { beatAt: live.wpm });
    }

    /** The fighter card i plays as against yours (its own, or the next one when it is yours). */
    function fighterFor(i) {
      return DuelChars.botKey(BOTS[i].char, player.fighter());
    }

    function isLocked(i) {
      return !!BOTS[i].match && !matchUnlocked();
    }

    // ---------- The pick ----------

    function pickedIndex() {
      return picked;
    }

    /** Picks a card (wraps around). A locked MATCH ME explains itself instead. Returns true when the pick changed. */
    function pick(i) {
      const index = (i + BOTS.length) % BOTS.length;
      if (isLocked(index)) {
        toast.show("MATCH ME unlocks after your first finished match: it copies your own speed.");
        return false;
      }
      picked = index;
      events.emit("duel:bot-picked", picked);
      return true;
    }

    /** The next card (skipping a locked MATCH ME). */
    function pickNext() {
      const next = picked + 1 === MATCH_ME && !matchUnlocked() ? 0 : picked + 1;
      return pick(next);
    }

    /** Picks MATCH ME when it is unlocked (practice while waiting in the ranked queue). */
    function pickMatchMe() {
      if (matchUnlocked()) picked = MATCH_ME;
    }

    return Object.freeze({
      BOTS,
      matchUnlocked,
      configFor,
      fighterFor,
      isLocked,
      picked: pickedIndex,
      pick,
      pickNext,
      pickMatchMe,
    });
  },
);
