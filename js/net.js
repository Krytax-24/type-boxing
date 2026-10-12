// PeerJS wrapper for private rooms. It owns connection state; main.js owns the match.
(function (global) {
  function roomCode(cfg) {
    const a = cfg.roomCodeAlphabet, bytes = new Uint8Array(cfg.roomCodeLength);
    if (global.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, (b) => a[b % a.length]).join("");
  }
  function codeOk(code, cfg) {
    code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== cfg.roomCodeLength) return "";
    for (const ch of code) if (!cfg.roomCodeAlphabet.includes(ch)) return "";
    return code;
  }
  function serverOptions(cfg) {
    const qs = new URLSearchParams(global.location ? location.search : "");
    const override = qs.get("server");
    let server = cfg.server || {};
    if (override === "lan") server = { host: location.hostname, port: 9000, path: "/", secure: false };
    else if (override) {
      const parts = override.split(":");
      server = { host: parts[0], port: +(parts[1] || 9000), path: "/", secure: location.protocol === "https:" };
    }
    const opt = { debug: 0, config: { iceServers: cfg.iceServers || [] } };
    if (server.host) {
      opt.host = server.host;
      if (server.port) opt.port = server.port;
      if (server.path) opt.path = server.path;
      if (server.secure !== null && server.secure !== undefined) opt.secure = !!server.secure;
    }
    return opt;
  }
  function available(cfg) {
    if (!cfg || !cfg.enabled || typeof global.Peer === "undefined" || !global.Protocol || !global.location) return false;
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
    tryHost(attempt) {
      this.code = roomCode(this.cfg);
      this.peer = new Peer(this.cfg.peerIdPrefix + this.code, serverOptions(this.cfg));
      this.peer.on("open", () => this.setState("waiting"));
      this.peer.on("connection", (conn) => this.accept(conn));
      this.peer.on("error", (err) => {
        if (err && err.type === "unavailable-id" && attempt < 5) { this.closePeerOnly(); this.tryHost(attempt + 1); return; }
        this.setState("error", { message: this.errorText(err) });
      });
      this.peer.on("disconnected", () => this.setState("closed", { message: "Matchmaking server disconnected" }));
    }
    joinRoom(code) {
      code = codeOk(code, this.cfg);
      if (!code) { this.setState("error", { message: "Enter a valid room code" }); return false; }
      this.role = "guest";
      this.code = code;
      this.setState("joining");
      this.peer = new Peer(undefined, serverOptions(this.cfg));
      this.peer.on("open", () => this.bind(this.peer.connect(this.cfg.peerIdPrefix + code, { reliable: true, serialization: "json" })));
      this.peer.on("error", (err) => this.setState("error", { message: this.errorText(err) }));
      return true;
    }
    accept(conn) {
      if (this.conn) {
        try { conn.on("open", () => conn.send(Protocol.busy())); } catch (e) {}
        setTimeout(() => { try { conn.close(); } catch (e) {} }, 200);
        return;
      }
      this.bind(conn);
    }
    bind(conn) {
      this.conn = conn;
      conn.on("open", () => this.setState("connected"));
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
      conn.on("close", () => this.setState("closed", { message: "The other player left" }));
      conn.on("error", (err) => this.setState("error", { message: this.errorText(err) }));
    }
    send(msg) {
      if (this.conn && this.conn.open) {
        try { this.conn.send(msg); return true; } catch (e) {}
      }
      return false;
    }
    close(message) {
      this.send(Protocol.leave());
      try { if (this.conn) this.conn.close(); } catch (e) {}
      this.closePeerOnly();
      this.setState("closed", { message });
    }
    closePeerOnly() {
      try { if (this.peer) this.peer.destroy(); } catch (e) {}
      this.peer = null;
      this.conn = null;
    }
    errorText(err) {
      const type = err && err.type;
      if (type === "peer-unavailable") return "Room not found. Check the code";
      if (type === "network" || type === "server-error" || type === "socket-error") return "Cannot reach the matchmaking server";
      if (type === "webrtc") return "Could not connect directly";
      return (err && err.message) || "Network error";
    }
  }
  NetPlay.available = available;
  NetPlay.codeOk = codeOk;
  global.NetPlay = NetPlay;
})(window);
