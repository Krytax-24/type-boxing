# Putting Type Boxing online (play across cities)

The online mode is finished and tested with two real browsers (create room, join, ready, a full fight with mirrored screens). What it needs to work between two different networks is three things: a public web address, a matchmaking server, and a TURN relay.

## 1. Host the game (free, about 5 minutes)

GitHub Pages is the easiest option.

1. Create a GitHub repository and push the project folder. Leave out `Claude outputs/`, `.claude/` and `claude-skills/` (add them to `.gitignore`).
2. In the repository open Settings, then Pages. Set the source to the `main` branch and the `/ (root)` folder, then save.
3. After a minute your game is at `https://YOUR-NAME.github.io/REPO-NAME/`. Both players must open this link. Do not double click `index.html`, because online play is switched off on `file://` pages.

Netlify Drop (drag the folder onto app.netlify.com/drop) or Cloudflare Pages work the same way.

## 2. Add a TURN relay (needed for most phone and home networks in India)

Without TURN, many pairs of players cannot connect, especially on Jio or Airtel.

1. Create a free account at metered.ca and open the TURN credentials for Open Relay.
2. In `js/config.js`, inside `net.iceServers`, uncomment the two `turn:` lines and paste your host, username and password.
3. Commit and push again.

## 3. Matchmaking server (usually you can skip this)

By default the game uses the free PeerJS cloud server. If it is slow or down ("Cannot reach the matchmaking server"), run your own:

1. Put the `server/` folder in its own GitHub repository.
2. On render.com create a new Web Service from that repository. Build command `npm install`, start command `npm start`.
3. In `js/config.js` set:

```js
server: { host: "YOUR-APP.onrender.com", port: 443, path: "/", secure: true },
```

Render's free plan sleeps when idle, so the first room after a quiet period can take up to a minute to start.

You can try a server without editing anything by adding `?server=YOUR-APP.onrender.com:443` to the game address.

## Playing

1. Host: Title, Online (O), Create room (C). Send the room code or the invite link to your friend.
2. Guest: open the same game address, Online, type the code, Join (J). Or open the invite link, which joins automatically.
3. Both press Ready (Enter). The fight starts after the countdown.

## If it does not connect

Add `?netdebug` to the address on both computers and open the browser console (F12). The lobby message tells you the cause:

| Message | Meaning | Fix |
|---|---|---|
| Cannot reach the matchmaking server | PeerJS cloud server unreachable | Deploy your own (step 3) |
| Room not found | Wrong code, different server, or the host closed the page | Check the code; the host must keep the page open |
| Could not connect directly / No answer from the room | Networks cannot reach each other | Add TURN (step 2) |
| Online play needs the page served over http or https | You opened the file directly | Use the hosted link (step 1) |
