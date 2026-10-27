/**
 * Relay (TURN) keys for online play: an EXAMPLE. Copy this file to net-keys.js in the same folder and fill in your
 * own keys, then load net-keys.js in index.html (the online block). net-keys.js is kept out of git (.gitignore) so
 * the keys are not published with the source. Anything in a web page can still be read by its visitors, so treat
 * these as low-value keys: rotate them in the Metered dashboard if they leak, and move to short-lived keys from a
 * server later. Without this module online play uses STUN only (direct connections).
 */
CounterType.define("net-keys", ["net-config"], (CONFIG) => {
  "use strict";

  CONFIG.net.turnApiUrl = "https://YOUR_APP.metered.live/api/v1/turn/credentials?apiKey=YOUR_KEY";
  const auth = { username: "YOUR_USERNAME", credential: "YOUR_PASSWORD" };
  CONFIG.net.iceServers = CONFIG.net.iceServers.concat([
    Object.assign({ urls: "turn:global.relay.metered.ca:80" }, auth),
    Object.assign({ urls: "turn:global.relay.metered.ca:80?transport=tcp" }, auth),
    Object.assign({ urls: "turn:global.relay.metered.ca:443" }, auth),
    Object.assign({ urls: "turns:global.relay.metered.ca:443?transport=tcp" }, auth),
  ]);

  return Object.freeze({ relay: true });
});
