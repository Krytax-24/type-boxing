/**
 * Duel input: your keys during a fight.
 *
 * Letters, Space (or Enter) and Backspace go to your own word stream, and the stream's events go to the rules
 * (Duel.handleEvents), exactly like the bot's keys and like a remote player's keys online. Esc pauses. The stats
 * recorder notes what you typed (it reads the stream, never changes it), and an online guest forwards every key
 * to the host. Clicks never type: only the keyboard reaches this module.
 */
CounterType.define(
  "duel-input",
  ["duel-session", "online-gateway", "actions", "audio"],
  (duelSession, net, actions, Sfx) => {
    "use strict";

    const duel = duelSession.duel;
    const MAX_EXTRA_NOTED = 5; // extra letters past a word's end that the recorder still notes

    /** Hands your stream's events to the rules, plays the typing sound and redraws your words. */
    function typed(evs) {
      duel.handleEvents(0, evs, duel.t);
      net.dirty(); // online host: the guest should see this now, not at the next periodic snapshot
      // A soft click for a right key, a dull knock for a typo (the strikes sound from the fighters).
      if (evs.some((e) => e.type === "wrong")) Sfx.play("typo");
      else if (evs.some((e) => e.type === "correct" || e.type === "word")) Sfx.play("key");
      const view = duelSession.typingView();
      if (view) view.update();
    }

    function backspace() {
      duelSession.applyKey(0, "Backspace");
      net.queueKey("Backspace");
      const view = duelSession.typingView();
      if (view) view.update();
    }

    function submit() {
      const record = duelSession.recorder();
      const stream = duel.streams[0];
      if (record) record.space(duel.t, stream.typed, stream.current().text);
      const evs = duelSession.applyKey(0, "Submit");
      net.queueKey("Submit");
      if (record) record.events(evs);
      typed(evs);
    }

    function letter(typedKey) {
      const record = duelSession.recorder();
      const stream = duel.streams[0];
      const word = stream.current();
      const ch = typedKey.toLowerCase();
      if (record && stream.typed.length < word.text.length + MAX_EXTRA_NOTED && !stream.absorbs(ch)) {
        record.press(duel.t, word.text[stream.typed.length], ch);
      }
      const evs = duelSession.applyKey(0, ch);
      net.queueKey(ch);
      // "Space ends a word" off: an exactly typed word ends by itself, with no key counted for the missing Space.
      if (!duelSession.matchSpace() && stream.autoEnds()) {
        evs.push(...duelSession.applyKey(0, "AutoSubmit"));
        net.queueKey("AutoSubmit");
      }
      if (record) record.events(evs);
      typed(evs);
    }

    /** A key while the Duel owns the view and no screen or modal is showing. */
    function key(e) {
      if (duelSession.koPlaying()) return; // the K.O. is playing out: wait for the result screen
      if (e.key === "Escape") {
        e.preventDefault();
        actions.run("pause");
        return;
      }
      if (e.key === "Backspace" || e.key === " " || e.key === "Enter" || e.key === "Tab" || e.key.length === 1) {
        e.preventDefault();
      }
      if (duel.phase !== "fight") return; // the countdown ignores keys
      if (e.key === "Backspace") backspace();
      else if (e.key === " " || e.key === "Enter") submit();
      else if (e.key.length === 1) letter(e.key);
    }

    return Object.freeze({ key });
  },
);
