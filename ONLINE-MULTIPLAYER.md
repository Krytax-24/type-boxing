# Type Boxing: Online Multiplayer (Phase 4) Setup and Documentation

Companion to CLAUDE.md (its rules win), ROADMAP.md and HANDOFF.md. Covers PeerJS online play, how players find each other, and LAN play with a local server.

## Contents

1. Goals and scope
2. How it works in one page
3. Setup
4. Files and CONFIG.net
5. Connection lifecycle
6. Message protocol
7. Match flow, timing and snapshots
8. Matchmaking
9. Local server and LAN play
10. Errors, disconnects and security
11. Testing
12. Build order
13. Decisions and open questions

---

## 1. Goals and scope

- Two players fight a real 1v1 duel over the internet or a local network, browser to browser.
- No game server. A small PeerJS "introducer" server only helps two browsers find each other, then steps aside.
- Plain HTML, CSS and JS, classic script tags, no build step. `index.html` must still work offline on double click. Online features switch on only when the page is served over http or https (or when a `?server=` override is given, see section 9).
- Matches in this phase are unranked. A P2P host can lie about the result, so scores and ranked play wait for server replay (Phase 7).
- Out of scope here: accounts, cloud save, leaderboards (Firebase, Phases 5 to 7).

Firebase is not needed for Phase 4. It enters at Phase 5 for sign-in and later for a quick match queue (section 8).

## 2. How it works in one page

| Part | Job |
|---|---|
| PeerJS server (cloud or local) | Swaps connection details between two peers. Carries no game data |
| Host browser | Runs the one real `Duel` (the judge). Types locally. Sends state snapshots about 20 times a second |
| Guest browser | Types locally with no lag. Sends its key events to the host. Draws the host's snapshots |
| WebRTC data channel | Direct browser to browser link. Keys one way, state the other |

- The host is side 0, the guest is side 1. The guest's screen swaps the sides so every player sees themselves as "you" on the left.
- `Duel.start(seed, fighters)` is deterministic, so the host sends the seed and both browsers build identical word streams. The guest renders from a mirror `Duel` that snapshots overwrite (state only, no rules run on the guest).
- The remote peer takes the place of the bot at one seam: `main.js` already steps the bot before each `duel.update(STEP)`.

## 3. Setup

### 3.1 Add PeerJS (vendored, not from a CDN)

PeerJS 1.5.5 is pre-approved in CLAUDE.md.

1. Download `peerjs.min.js` for version 1.5.5 from the official release (npm package `peerjs`, file `dist/peerjs.min.js`), for example:
   ```
   npm pack peerjs@1.5.5
   ```
   then extract `package/dist/peerjs.min.js` from the tarball.
2. Save it as `js/vendor/peerjs.min.js` and keep its license file next to it (`js/vendor/peerjs.LICENSE.txt`).
3. In `index.html`, add classic script tags after `config.js` and before `main.js`:
   ```html
   <script src="js/vendor/peerjs.min.js"></script>
   <script src="js/protocol.js"></script>
   <script src="js/net.js"></script>
   ```
   Loading it as a classic script exposes a global `Peer`.
4. Guard every use: `if (typeof Peer === 'undefined') { /* online off */ }`, so a missing file never breaks offline play.

### 3.2 Host the game (Gate A)

Sign-in and WebRTC work best from a real address. Use GitHub Pages: create the repo, upload a code-only copy (add a `.gitignore` first), turn on Pages. Phase 4 can be developed and tested on `http://localhost` before this.

### 3.3 Dev tools (optional, not part of the game)

- Node.js LTS for `node tests/duel-sim.js` and the local PeerServer.
- Playwright for the two-page tests.

## 4. Files and CONFIG.net

New files:

```
js/protocol.js   message types, builders, validators (pure, no DOM, runs in Node too)
js/net.js        PeerJS wrapper: rooms, connection, ping, reconnect, rematch
js/vendor/peerjs.min.js
tests/net-sim.js  Node tests for protocol.js and the loopback match
```

`js/config.js` gets one block (all numbers live here):

```js
CONFIG.net = {
  enabled: true,              // online buttons shown only on http(s) or ?server=
  server: {                   // null values mean "use the PeerJS cloud server"
    host: null, port: null, path: null, secure: null
  },
  iceServers: [               // STUN only by default; add a TURN entry if needed
    { urls: 'stun:stun.l.google.com:19302' }
  ],
  roomCodeLength: 5,
  roomCodeAlphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', // no I, L, O, 0, 1
  peerIdPrefix: 'typeboxing-',
  snapshotHz: 20,
  pingEverySec: 2,
  reconnectGraceSec: 15,
  maxMessageBytes: 4096,
  maxKeysPerMessage: 64,
  keyBatchMs: 25,             // guest batches key events this often
  readyTimeoutSec: 60
};
```

Rules: `duel.js` and `duel-typing.js` never import or call anything in `net.js`. Networking sends and receives events and snapshots only.

## 5. Connection lifecycle

States in `Net`: `idle`, `creating`, `waiting` (host has a code), `joining`, `connected`, `ready`, `countdown`, `playing`, `result`, `closed`.

### Host (create room)

1. Generate a room code. Create `new Peer(prefix + code, options)`.
2. On `open`, show the code and the invite link `https://<site>/?room=ABCD` with Copy buttons. State: `waiting`.
3. On `error` with type `unavailable-id`, the code is taken: generate a new code and retry (up to 5 times).
4. On `connection` from a guest, accept only one. A second connection gets a `busy` message and is closed.

### Guest (join)

1. Read the code from the input or from `?room=` in the URL. Validate it against the alphabet and length.
2. Create `new Peer(undefined, options)` (random id), then `peer.connect(prefix + code, { reliable: true, serialization: 'json' })`.
3. On `error` with type `peer-unavailable`, show "Room not found. Check the code."
4. On the connection `open`, send `hello`. State: `connected`.

### Both

Ready check, then `start`, countdown, play, result, rematch (section 7). Closing the page, `conn.on('close')` and `peer.on('disconnected')` all go through one `onLink(lost)` handler (section 10).

## 6. Message protocol

All messages are small JSON objects: `{ t: type, v: 1, ... }`. `protocol.js` has one builder and one validator per type. The receiver drops anything with an unknown type, a wrong field type, a number out of range or a size over `maxMessageBytes`. A bad message is counted; 5 in a row closes the link.

| Type | From | Fields | Notes |
|---|---|---|---|
| `hello` | guest | `name`, `fighter`, `color`, `gameVersion` | Host checks `gameVersion`; mismatch gives a clear "update the game" error |
| `welcome` | host | `name`, `fighter`, `color`, `gameVersion` | Reply to `hello` |
| `ready` | both | `ready` (bool) | Both true starts the match |
| `start` | host | `seed` (uint32), `fighters` [host key, guest key], `colors`, `countdown` (sec) | Fighter keys are cosmetic and must be from the known 11, else a stock fighter |
| `keys` | guest | `seq`, `events` [ {k, ok, lt} ] | Typing events, batched; `lt` is the guest's local time since the match start |
| `state` | host | `n`, `t`, `hp`, `combo`, `charge`, `wpm`, `phase`, `stun`, `counter`, `fighters` | Snapshot, section 7.3 |
| `result` | host | `winner` (0 or 1), `t`, `stats` | Ends the match |
| `ping` / `pong` | both | `id`, `ts` | Round trip time shown on the HUD |
| `rematch` | both | `want` (bool) | Both true restarts with a new seed |
| `leave` | both | none | Polite exit, so the other side does not wait for the grace period |
| `busy` | host | none | Room already full |

Character files (Phase 8) later travel inside `hello` and `start`, size capped and validated before drawing. Not part of Phase 4.

Never send or accept CSS, HTML or code. Names are plain text, trimmed to 16 characters, and only ever drawn with `textContent` or on canvas.

## 7. Match flow, timing and snapshots

### 7.1 Flow

1. Both connected: lobby panel shows both names and fighters and a READY button each.
2. Both ready: host picks `seed` (from a counter or `crypto.getRandomValues`, never `Math.random` inside `duel.js`), sends `start`.
3. Both run `Duel.start(seed, fighters)` and the same countdown. The host starts counting on send; the guest on receipt. The few tens of milliseconds of difference is fine for friends.
4. Playing: see 7.2 and 7.3.
5. K.O.: host sends `result`. Both show the result screen. A one key REMATCH sends `rematch`; both true gives a new seed and a new `start`.

### 7.2 Guest keys, host judge

- The guest runs its own `TypingStream` for instant letter feedback (carets, colors, plates), exactly like offline.
- Each keystroke is also queued as an event. Every `keyBatchMs` the batch is sent as a `keys` message.
- The host feeds each event into `Duel.handleEvents(1, [event], duel.time)`, applying it at the host's current duel time. The guest is about half a round trip behind, which is fine here.
- The host clamps nothing in the rules; it only checks plausibility (events per message, key gaps below a human minimum are dropped). The duel stays deterministic given the event list and times, which is what Phase 7 needs: the host also records the seed and the timed key log of both sides.

### 7.3 Snapshots (host to guest)

About `snapshotHz` per second, and immediately on big events (hit, counter, ultimate, K.O.).

- Contents: duel time, both HPs, combo level and streak, charge, wpm, power, stun and counter timers, phase, each fighter's visual state (position, animation key, frame, facing), and the floating texts and sparks that were created since the last snapshot.
- The guest has `Duel.applySnapshot(s)`: state only, no rule runs. Between snapshots the guest eases fighter positions and animations toward the latest values so motion stays smooth at 20 Hz.
- The guest's own typing display uses local state, but HP, combo and charge numbers come only from snapshots, so both screens agree.
- Sides are swapped when the guest applies a snapshot, so the guest is always "you" on the left.

### 7.4 Pause

Online matches cannot be paused. Esc opens a menu with Settings and Leave only, and the duel keeps running. Losing tab focus does not pause; the player simply types nothing. (Offline pause is unchanged.)

## 8. Matchmaking

PeerJS has no matchmaking. It only connects a peer that knows another peer's id. So "finding a player" means getting two people the same code. There are three methods, built in this order.

### 8.1 Private room (Phase 4, no backend)

The core feature and the only one needed to ship Phase 4.

- Host: PLAY ONLINE, then CREATE ROOM. Gets a 5 character code and an invite link.
- Guest: PLAY ONLINE, then JOIN, type the code (or open the link, which auto-joins).
- Share the code through Discord, WhatsApp, anything.
- Code safety: 31 character alphabet without look-alikes; 5 characters gives about 28 million codes. Codes live only while the host's page is open; they cannot be listed or guessed in bulk because the PeerJS cloud server does not list peers.

### 8.2 Quick match without a backend (optional, experimental)

A serverless trick using fixed peer ids as "waiting slots". Useful before Firebase exists, but it is racy and should be labeled Beta.

1. Skill bands by recent average wpm: for example `lt40`, `40-60`, `60-80`, `80plus`. Slot ids look like `typeboxing-q-<band>-<n>` with `n` from 0 to 7.
2. A player pressing QUICK MATCH tries to register slot 0 of their band as their peer id.
   - Success: they are now the host, waiting. They show "Searching".
   - `unavailable-id`: someone is waiting there. Try to connect to it as a guest.
3. The waiting host answers a connection with `welcome`; if it is already taken it sends `busy` and the guest moves to the next slot.
4. `peer-unavailable` means the slot emptied during the race: try to register it instead.
5. After 20 seconds with no match, offer to widen the band or create a private room.

Weaknesses: slots can go stale if a tab crashes (the server frees the id after its timeout), two players can race on one slot (handled by the `busy` reply), and it only works with one server for everyone (the cloud server, not the LAN one). Treat it as a stopgap.

### 8.3 Quick match queue with Firebase (Phase 5 onward)

The proper version once Firebase Auth exists.

- Sign-in: Firebase Anonymous Auth is enough for matchmaking (a guest still gets a uid). Google and email link come with Phase 5.
- Queue: a Realtime Database path `queue/<band>/<uid>` holding `{ peerId, wpm, ts }`. Realtime Database is a better fit than Firestore here because `onDisconnect().remove()` clears a leaving player automatically.
- Matching: a player enters the queue and listens. The first entry older than themselves in their band (or the nearest band after a few seconds) is claimed with a transaction that deletes it. The claimer connects by PeerJS to the claimed `peerId` as guest; the claimed player is the host.
- Rules (Firebase Security Rules): a user may write only `queue/<band>/<own uid>`; reads limited to the queue; no direct writes to scores or ratings from the browser.
- Skill matching: start with bands of about 15 wpm and widen every 5 seconds waiting. MATCH ME bot remains the fallback when nobody is found in 30 seconds.
- Later (Phase 7): ranked matches use the same queue, but the match is replayed on the server before a rating changes.

Firebase notes to verify before building: free (Spark) plan limits for Realtime Database, and that anything needing Cloud Functions (score replay) requires the pay-as-you-go plan with a card on file. Check the current Firebase pricing page.

### 8.4 Friends and rematch

- REMATCH after a result keeps the same link: no new code needed.
- Later with accounts: a friends list with "invite to match" that sends the room code through Firebase.

## 9. Local server and LAN play

Goal: play with someone on the same Wi-Fi or router with no internet and no cloud server.

### 9.1 What you run on the host PC

Two small things, both only for development and LAN, neither part of the game files:

1. A static web server for the game folder.
2. A local PeerServer (the introducer).

### 9.2 Steps (Windows)

1. Find the host PC's LAN address: open PowerShell and run `ipconfig`. Use the IPv4 address of your Wi-Fi or Ethernet adapter, for example `192.168.1.20`.
2. In the game folder, serve the files (pick one):
   ```
   npx serve -l 8000
   ```
   or
   ```
   python -m http.server 8000
   ```
3. In a second PowerShell window, start the local PeerServer. The package is `peer` on npm (the PeerJS server); its command line is `peerjs`:
   ```
   npm install -g peer
   peerjs --port 9000 --path /
   ```
   Run `peerjs --help` to confirm the flags for your installed version. A health check is `http://localhost:9000/` in a browser.
4. Allow both ports through Windows Defender Firewall when prompted (private networks), or add inbound rules for TCP 8000 and 9000.
5. On the host PC open `http://192.168.1.20:8000/?server=lan` (using your real IP). Press PLAY ONLINE, CREATE ROOM, read out the code.
6. On the friend's device (same network) open the same address `http://192.168.1.20:8000/?server=lan`, PLAY ONLINE, JOIN, type the code.

### 9.3 How the game picks the server

- No `server` param: PeerJS cloud (default).
- `?server=lan`: use the page's own hostname with the local PeerServer, so no IP is typed twice:
  ```js
  { host: location.hostname, port: 9000, path: '/', secure: false }
  ```
- `?server=host:port` (for example `?server=192.168.1.20:9000`): use exactly that. This also allows the double click `file://` page to join a LAN game, because the page then has an explicit server. Without any `?server=`, a `file://` page keeps online off, as the roadmap requires.
- `CONFIG.net.server` can hold a fixed server for your own hosted PeerServer later.

### 9.4 What works on a LAN and what does not

- WebRTC data channels do not need HTTPS, so plain http on the LAN is fine. (Camera and microphone would need a secure context, but the game uses neither.)
- On a LAN no STUN or TURN is needed. The two browsers find each other by local addresses. Chrome hides local addresses behind mDNS names; this works on most home networks.
- If `https` is used for the page (for example GitHub Pages), the PeerServer must also be `secure: true` (wss). A page loaded from https cannot connect to a plain `ws://` local server (mixed content). For LAN play use the http page from the host PC, not the https one.
- Some school, office and guest Wi-Fi networks isolate devices from each other ("client isolation") or block mDNS. Then LAN play fails; use a phone hotspot or the internet route instead.
- A local PeerServer cannot be reached from the internet unless you forward ports. That is not recommended; use the cloud PeerServer or a hosted one for internet play.

### 9.5 Same PC, two tabs (fastest dev loop)

Open the game twice in two tabs (or one normal and one private window), create a room in one and join from the other. Works with the PeerJS cloud (needs internet) or the local PeerServer (no internet).

## 10. Errors, disconnects and security

### 10.1 Error messages shown to the player

| Situation | Message |
|---|---|
| `peer-unavailable` | Room not found. Check the code or ask the host to create a new room |
| `unavailable-id` | (silent retry with a new code, then "Could not create a room, try again") |
| `network`, `server-error`, `socket-error` | Cannot reach the matchmaking server. Check your connection |
| `webrtc` or connection fails to open in 10 s | Could not connect directly. A strict network may need a relay (TURN) |
| `busy` | This room already has two players |
| version mismatch | The other player has a different version. Refresh the page |
| ping above about 250 ms | Shown in the HUD as a yellow ping number |

### 10.2 Disconnects

- Link lost mid match: show "Opponent lost connection, waiting 15 s". The duel keeps running on the host. If the guest reconnects (same room code, same peer) within `reconnectGraceSec`, the host sends a full `state` and play continues. Otherwise the absent player forfeits.
- Host leaves: the guest cannot continue (the host is the judge). Show "Host left" and return to the menu.
- Polite `leave` skips the wait.

### 10.3 Security

- Validate every received message for type, size and range. Ignore the rest.
- Never apply CSS, HTML or script from a peer. Names are drawn as text only. Fighter keys are checked against the known list.
- The host cannot be trusted for results, so online matches are unranked until the server replay exists.
- The guest cannot make the duel misbehave: it only ever sends typing events, which the host rate-checks.
- Do not expose IP addresses in the UI. (WebRTC does reveal IPs to the peer; mention this in a short privacy note on the online screen. A TURN relay hides it.)
- Never put API keys or secrets in the repo. The PeerJS cloud server needs none. Firebase web config is public by design but must be protected with Security Rules.

## 11. Testing

1. `node tests/duel-sim.js` after any change that touches rules (none should in Phase 4).
2. `node tests/net-sim.js` (new): validates every message type (good and bad), runs a loopback match with a fake in-memory link, and checks host and guest end states match (winner, HP, time) over many seeds, including simulated latency and dropped batches.
3. Playwright with two pages (two browser contexts) served from `http://localhost:8000`: host creates a room, guest joins by code, both ready, play a scripted match with real key presses, check K.O., result, rematch, and zero console errors on both pages.
4. Failure cases: wrong code, room full, host closes the tab, guest closes the tab, 15 s grace and forfeit, oversized and malformed messages, version mismatch.
5. LAN check: run both servers, open the page from a second device (or a second machine) using the LAN address.
6. Offline check: `index.html` by double click still works, online buttons hidden, zero console errors. `sandbox.html` unchanged.
7. Frame time stays under 1 ms on average on the host and the guest.

## 12. Build order (small steps, each tested)

1. **4a, protocol and loopback.** `protocol.js`, fake in-memory link, `Duel.applySnapshot`, guest view side swap. Tested in Node and in one page with two views.
2. **4b, lobby.** Vendor PeerJS, `net.js`, room code, invite link, ready check, `CONFIG.net`.
3. **4c, live match.** Guest key batches, host snapshots, result, rematch, ping on the HUD. Two page Playwright test.
4. **4d, robustness.** Disconnect, grace period, forfeit, bad messages, version check.
5. **4e, local server and hosting.** `?server=lan` and `?server=host:port`, LAN instructions tested on a second device, GitHub Pages hosting (Gate A).
6. **4f (optional), serverless quick match** (section 8.2), labeled Beta.
7. **Phase 5 onward:** Firebase Auth, then the Firebase queue (section 8.3).

## 13. Decisions and open questions

| Decision | Recommendation |
|---|---|
| Signaling server | Start on the PeerJS cloud server, move to your own if it is slow or down. Its public server has no uptime promise |
| TURN relay | Add only if friends cannot connect. Costs money or a limited free tier |
| Quick match before Firebase | Ship private rooms first. Add the serverless quick match only if wanted, as Beta |
| Quick match with Firebase | Realtime Database queue with anonymous auth, then upgrade to real accounts |
| Online pause | None, to keep the host judge simple and fair |
| Ranked | Only after server replay (Phase 7). Needs Firebase Cloud Functions (check pricing and the card requirement) |
| Discord sign-in | Not built into Firebase Auth. Needs an OIDC or custom token setup. Decide whether it is worth it |
| LAN play from `file://` | Allowed only with an explicit `?server=host:port` |

Docs and in-game text follow the project style: plain, concise prose, no em dashes or en dashes.
