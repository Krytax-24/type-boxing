/**
 * Online room (#scr-online): create a private room or join a friend's code, share the code or an invite link,
 * pick the match rules (the host's rules count), and ready up. The match itself starts from net-online.js.
 *
 * Keys: C create, J join, O play offline, F fighter, Enter ready (when connected), Esc leave or back, F2 view.
 * Opening the page with ?room=CODE joins that room at once.
 */
CounterType.define(
  "net-room-page",
  [
    "net-online",
    "router",
    "actions",
    "events",
    "settings",
    "layout",
    "home-page",
    "online-gateway",
    "toast",
    "clipboard",
    "buttons",
    "keyline",
    "option-row",
    "match-rules-rows",
    "dom",
  ],
  (
    online,
    router,
    actions,
    events,
    settings,
    layout,
    home,
    net,
    toast,
    clipboard,
    buttons,
    keyline,
    optionRow,
    rulesRows,
    dom,
  ) => {
    "use strict";

    const S = online.state;
    const CODE_MAX = 7;
    const esc = dom.escapeHtml;
    const GAME_HINT = "Typing: type words to fight. Backspace Brawl: fight with keys, a controller or touch.";

    const el = router.register({ id: "online", className: "panel", restore, refresh: render, onKey, onAction });
    el.innerHTML = `
      <h2 class="screen-title">Online</h2>
      <div id="online-status"></div>
      <div id="online-room"></div>
      <div id="online-rules"></div>
      <div class="online-join">
        <input id="room-code" type="text" maxlength="${CODE_MAX}" autocomplete="off" spellcheck="false" placeholder="ROOM CODE" aria-label="Room code">
        <button class="seg" id="room-paste" data-act="online-paste" tabindex="-1">Paste</button>
      </div>
      <div class="btn-row" id="online-btns"></div>`;
    const part = {
      status: dom.byId("online-status"),
      room: dom.byId("online-room"),
      rules: dom.byId("online-rules"),
      input: dom.byId("room-code"),
      paste: dom.byId("room-paste"),
      buttons: dom.byId("online-btns"),
    };

    const playing = () => S.screenState === "playing" || S.screenState === "result";

    function inviteLink() {
      const url = new URL(window.location.href);
      url.searchParams.set("room", S.code);
      return url.href;
    }

    // ---------- The room code box ----------

    /** A bare code, a code with spaces or dashes, or a whole invite link (the code is its ?room= part). */
    function roomFromText(text) {
      let value = String(text || "").trim();
      const link = value.match(/[?&]room=([^&#\s]+)/i);
      if (link) value = link[1];
      return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    }

    function setRoomInput(text) {
      if (part.input.disabled) return false;
      part.input.value = roomFromText(text).slice(0, CODE_MAX);
      return !!part.input.value;
    }

    function pasteRoomCode() {
      if (part.input.disabled) return;
      const manual = () => {
        part.input.focus();
        toast.show("Click the box and press Ctrl+V to paste.");
      };
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        manual();
        return;
      }
      navigator.clipboard.readText().then((text) => {
        if (setRoomInput(text)) toast.show("Code pasted. Press Join.");
        else toast.show("The clipboard has no room code.");
      }, manual);
    }

    // Ctrl+V into the box: pull the code out of whatever was copied. Enter joins.
    part.input.addEventListener("paste", (e) => {
      const text = e.clipboardData && e.clipboardData.getData("text");
      if (text === null || text === undefined) return;
      e.preventDefault();
      setRoomInput(text);
    });
    part.input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.target.blur();
      online.joinRoom(part.input.value);
    });

    // ---------- Drawing ----------

    function gameRow(disabled) {
      if (online.gameIds().length < 2 || layout.isPhone()) return "";
      const choices = [
        ["typing", "Typing"],
        ["brawl", "Backspace Brawl"],
      ];
      return optionRow.optionRow("Game", GAME_HINT, "mGame", choices, settings.values.mGame, disabled);
    }

    function rulesHtml() {
      if (playing()) return "";
      const guest = S.connected && S.role === "guest";
      const brawl = settings.values.mGame === "brawl" && online.gameIds().includes("brawl");
      const rows = rulesRows.html({
        disabled: guest,
        compact: true,
        endless: !brawl,
        words: !brawl,
        before: gameRow(guest),
      });
      return `<div class="card-label"><span>Match rules</span><span>${guest ? "the host chooses" : "you choose as host"}</span></div>${rows}`;
    }

    function roomHtml() {
      let room = "Room codes exist only while the host keeps this page open.";
      if (S.code) {
        room =
          `<span>Room code</span><b class="selectable">${esc(S.code)}</b><code class="selectable">${esc(inviteLink())}</code>` +
          `<div class="copy-row">${buttons.segment("online-copy", "Copy code")}${buttons.segment("online-copylink", "Copy invite link")}</div>`;
      }
      if (S.peerProfile) room += `<span>Opponent: ${esc(S.peerProfile.name)}</span>`;
      if (S.connected && !playing()) {
        room += `<span>${S.localReady ? "You are ready" : "You are not ready"} / ${S.remoteReady ? "Opponent ready" : "Opponent not ready"}</span>`;
      }
      return room;
    }

    function buttonsHtml(on) {
      const lan = on ? "" : `<span class="modal-note">For LAN, serve the folder and open with ?server=lan.</span>`;
      if (S.connected) {
        const ready = playing()
          ? ""
          : buttons.button("online-ready", S.localReady ? "Unready" : "Ready", { primary: !S.localReady });
        return ready + buttons.button("online-leave", "Leave") + lan;
      }
      return (
        buttons.button("online-create", "Create room", { primary: true }) +
        buttons.button("online-join", "Join") +
        (layout.isPhone() ? "" : buttons.button("offline", "Play offline")) +
        buttons.button("back", "Back") +
        lan
      );
    }

    function render() {
      if (router.current() !== "online") return;
      const on = online.available();
      part.status.textContent = on
        ? S.status || "Create a private room or join a friend's code."
        : "Online play needs the page served over http or https, or a LAN server override.";
      part.room.innerHTML = roomHtml();
      part.rules.innerHTML = rulesHtml();
      part.input.disabled = !on || S.connected || S.screenState === "waiting" || S.screenState === "playing";
      part.paste.disabled = part.input.disabled;
      part.buttons.innerHTML = buttonsHtml(on);
      const brawl = settings.values.mGame === "brawl";
      keyline.set(S.connected || brawl ? [] : [buttons.keyChip("view", "words: " + settings.viewName())]);
    }

    /** Shows the room screen (Online room on the menus, or the Brawl menu's Online). */
    function open() {
      if (layout.isPhone() && settings.values.mGame !== "brawl") settings.set("mGame", "brawl");
      router.show("online");
      render();
      const room = new URLSearchParams(window.location.search).get("room");
      if (room && online.available() && !S.net) {
        part.input.value = room.toUpperCase();
        online.joinRoom(part.input.value);
      }
    }

    // Back from the Fighter screen: the room learns your new fighter.
    function restore() {
      net.refreshProfile();
      router.show("online");
      render();
    }

    // ---------- Input ----------

    function onAction(name) {
      switch (name) {
        case "online-create":
          online.createRoom();
          return true;
        case "online-join":
          online.joinRoom(part.input.value);
          return true;
        case "online-copy":
          if (S.code) clipboard.copy(S.code, "Room code copied.");
          return true;
        case "online-copylink":
          if (S.code) clipboard.copy(inviteLink(), "Invite link copied.");
          return true;
        case "online-paste":
          pasteRoomCode();
          return true;
        case "online-ready":
          online.toggleReady();
          return true;
        case "online-leave":
        case "back":
          home.goMenu();
          return true;
        case "offline":
          home.goMenu();
          actions.run("duel"); // the Duel's own menu, when the Duel is part of the build
          return true;
        default:
          return false;
      }
    }

    function onKey(e, key) {
      if (key === "o" && !S.connected) actions.run("offline");
      else if (e.key === "Escape") actions.run(S.connected ? "online-leave" : "back");
      else if (key === "c" && !S.connected) actions.run("online-create");
      else if (key === "j" && !S.connected) actions.run("online-join");
      else if (key === "f" && !S.connected) actions.run("fighter");
      else if (e.key === "Enter" && S.connected) actions.run("online-ready");
      else if (e.key === "F2") {
        e.preventDefault();
        actions.run("view");
      }
      return true;
    }

    // "play": the Duel menu's Online room (O), or How to play; never on a phone (phones open it from the Brawl menu).
    actions.on("play", (x, y, top) => {
      if (layout.isPhone() || top || !["title", "howto"].includes(router.current())) return false;
      net.open();
      return true;
    });
    events.on("net:open", open);
    events.on("net:changed", () => {
      if (S.active) part.input.value = ""; // a match started: the code box empties
      render();
    });

    return Object.freeze({ open });
  },
);
