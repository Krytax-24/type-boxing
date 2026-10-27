/**
 * PeerJS wrapper for private rooms. It owns connection state; net-online.js owns the match.
 */
CounterType.define("net-peer", ["net-protocol"], (Protocol) => {
  "use strict";

  function roomCode(cfg) {
    const a = cfg.roomCodeAlphabet,
      bytes = new Uint8Array(cfg.roomCodeLength);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, (b) => a[b % a.length]).join("");
  }
  function codeOk(code, cfg) {
    code = String(code || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (code.length !== cfg.roomCodeLength) return "";
    for (const ch of code) if (!cfg.roomCodeAlphabet.includes(ch)) return "";
    return code;
  }
  async function loadIceServers(cfg, qs) {
    const apiUrl = qs.get("turn") || cfg.turnApiUrl;
    const fallback = cfg.iceServers || [];
    if (!apiUrl || !window.fetch) return fallback;
    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("TURN credentials request failed");
      const data = await res.json();
      const servers = Array.isArray(data) ? data : data.iceServers;
      if (Array.isArray(servers) && servers.length) return servers.concat(fallback);
    } catch (e) {
      console.warn("Could not load TURN credentials", e);
    }
    return fallback;
  }
  async function serverOptions(cfg) {
    const qs = new URLSearchParams(window.location ? location.search : "");
    const override = qs.get("server");
    let server = cfg.server || {};
    if (override === "lan") server = { host: location.hostname, port: 9000, path: "/", secure: false };
    else if (override) {
      const parts = override.split(":");
      server = { host: parts[0], port: +(parts[1] || 9000), path: "/", secure: location.protocol === "https:" };
    }
    const opt = { debug: 0, config: { iceServers: await loadIceServers(cfg, qs) } };
    if (qs.get("relay") === "1") opt.config.iceTransportPolicy = "relay";
    if (server.host) {
      opt.host = server.host;
      if (server.port) opt.port = server.port;
      if (server.path) opt.path = server.path;
      if (server.secure !== null && server.secure !== undefined) opt.secure = !!server.secure;
    }
    return opt;
  }
  function available(cfg) {
    if (!cfg || !cfg.enabled || typeof window.Peer === "undefined" || !window.location) return false;
    return /^https?:$/.test(location.protocol) || new URLSearchParams(location.search).has("server");
  }

  class NetPlay {
    constructor(cfg, handlers) {
      this.cfg = cfg;
      this.handlers = handlers || {};
      this.peer = null;
      this.conn = null;
      this.role = null;
      this.code = "";
      this.state = "idle";
      this.bad = 0;
      this.connectTimer = null;
    }
    emit(name, value) {
      const fn = this.handlers[name];
      if (fn) fn(value);
    }
    setState(state, extra) {
      this.state = state;
      this.emit("status", Object.assign({ state, code: this.code, role: this.role }, extra || {}));
    }
    createRoom() {
      this.role = "host";
      this.setState("creating");
      this.tryHost(0);
    }
    async tryHost(attempt) {
      this.code = roomCode(this.cfg);
      this.peer = new Peer(this.cfg.peerIdPrefix + this.code, await serverOptions(this.cfg));
      this.peer.on("open", () => this.setState("waiting"));
      this.peer.on("connection", (conn) => this.accept(conn));
      this.peer.on("error", (err) => {
        if (err && err.type === "unavailable-id" && attempt < 5) {
          this.closePeerOnly();
          this.tryHost(attempt + 1);
          return;
        }
        this.setState("error", { message: this.errorText(err) });
      });
      this.peer.on("disconnected", () => this.setState("closed", { message: "Matchmaking server disconnected" }));
    }
    async joinRoom(code) {
      code = codeOk(code, this.cfg);
      if (!code) {
        this.setState("error", { message: "Enter a valid room code" });
        return false;
      }
      this.role = "guest";
      this.code = code;
      this.setState("joining", { message: "Joining room..." });
      this.peer = new Peer(undefined, await serverOptions(this.cfg));
      this.peer.on("open", () => {
        const relayOnly = new URLSearchParams(window.location ? location.search : "").get("relay") === "1";
        this.setState("joining", { message: relayOnly ? "Connecting through relay..." : "Connecting directly..." });
        this.bind(this.peer.connect(this.cfg.peerIdPrefix + code, { reliable: true, serialization: "json" }));
      });
      this.peer.on("error", (err) => this.setState("error", { message: this.errorText(err) }));
      return true;
    }
    accept(conn) {
      if (this.conn) {
        try {
          conn.on("open", () => conn.send(Protocol.busy()));
        } catch (e) {}
        setTimeout(() => {
          try {
            conn.close();
          } catch (e) {}
        }, 200);
        return;
      }
      this.bind(conn);
    }
    bind(conn) {
      this.conn = conn;
      this.startConnectTimer();
      conn.on("open", () => {
        this.clearConnectTimer();
        this.setState("connected");
      });
      conn.on("data", (data) => {
        const msg = Protocol.validate(data, this.cfg);
        if (!msg) {
          this.bad++;
          if (this.bad >= 5) this.close("Too many bad network messages");
          return;
        }
        this.bad = 0;
        this.emit("message", msg);
      });
      conn.on("close", () => {
        this.clearConnectTimer();
        this.setState("closed", { message: "The other player left" });
      });
      conn.on("error", (err) => {
        this.clearConnectTimer();
        this.setState("error", { message: this.errorText(err) });
      });
    }
    startConnectTimer() {
      this.clearConnectTimer();
      const ms = (this.cfg.connectTimeoutSec || 12) * 1000;
      this.connectTimer = setTimeout(() => {
        if (this.conn && !this.conn.open) {
          const relayOnly = new URLSearchParams(window.location ? location.search : "").get("relay") === "1";
          this.setState("error", {
            message: relayOnly
              ? "TURN relay did not connect. Check the TURN credentials"
              : "Could not connect directly. Add a TURN relay or test with ?relay=1",
          });
          try {
            this.conn.close();
          } catch (e) {}
        }
      }, ms);
    }
    clearConnectTimer() {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    send(msg) {
      if (this.conn && this.conn.open) {
        try {
          this.conn.send(msg);
          return true;
        } catch (e) {}
      }
      return false;
    }
    close(message) {
      this.send(Protocol.leave());
      try {
        if (this.conn) this.conn.close();
      } catch (e) {}
      this.closePeerOnly();
      this.setState("closed", { message });
    }
    closePeerOnly() {
      this.clearConnectTimer();
      try {
        if (this.peer) this.peer.destroy();
      } catch (e) {}
      this.peer = null;
      this.conn = null;
    }
    errorText(err) {
      const type = err && err.type;
      if (type === "peer-unavailable") return "Room not found. Check the code";
      if (type === "network" || type === "server-error" || type === "socket-error") {
        return "Cannot reach the matchmaking server";
      }
      if (type === "webrtc") return "Could not connect directly";
      return (err && err.message) || "Network error";
    }
  }
  NetPlay.available = available;
  NetPlay.codeOk = codeOk;
  return NetPlay;
});
