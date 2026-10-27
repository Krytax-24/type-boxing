/**
 * Private-room online play (net-peer.js and net-online.js). PeerJS only introduces the two browsers; match
 * data goes peer to peer. Added to CONFIG when the online module starts; online modules receive CONFIG from here.
 */
CounterType.define("net-config", ["config"], (CONFIG) => {
  "use strict";

  // Private-room online play. PeerJS only introduces the two browsers; match data goes peer to peer.
  CONFIG.net = {
    enabled: true,
    server: { host: null, port: null, path: null, secure: null },
    // Relay (TURN) settings. The real key and passwords are NOT kept here: they live in src/net/net-keys.js, which is
    // left out of git (copy src/net/net-keys.example.js to make it). Without that file online play still works on
    // networks that can connect directly (STUN only).
    turnApiUrl: "",
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.relay.metered.ca:80" }],
    roomCodeLength: 5,
    roomCodeAlphabet: "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
    peerIdPrefix: "typeboxing-",
    snapshotHz: 30, // periodic snapshots per second (host to guest), on the real clock
    snapshotMinMs: 33, // an early snapshot after a key is allowed once this many ms passed since the last one
    pingEverySec: 2,
    connectTimeoutSec: 12,
    reconnectGraceSec: 15,
    maxMessageBytes: 4096,
    maxKeysPerMessage: 64,
    keyBatchMs: 25,
    readyTimeoutSec: 60,
    gameVersion: "phase6-brawl",
  };

  return CONFIG;
});
