# CounterType v2: architecture

This is the guide to how release-v2 is built: the module system, the layers, the contracts between parts, and the recipes for adding or removing a part. If you only read one section, read [Add or remove a part](#add-or-remove-a-part).

## Contents

1. [The goals](#the-goals)
2. [Folders and layers](#folders-and-layers)
3. [The module system (kernel)](#the-module-system-kernel)
4. [Naming conventions](#naming-conventions)
5. [How parts talk to each other](#how-parts-talk-to-each-other)
6. [The page and its layers](#the-page-and-its-layers)
7. [Contracts](#contracts)
8. [Add or remove a part](#add-or-remove-a-part)
9. [Styles](#styles)
10. [Tests and tools](#tests-and-tools)

---

## The goals

1. **One part changes, nothing else breaks.** Every file is one module with a written list of what it needs. A module can only reach another module by naming it in that list, so every link between two parts of the game is visible, and a change can only affect the modules that list it.
2. **Any plug-in can be added or removed at any time.** The four game modes (Duel, Race, Arm Wrestling, Backspace Brawl) and online play are plug-ins. Delete a plug-in's block from `index.html`, or open the page with `?disable=race`, and the game runs without it: menus, How to play, the Keys table, the profile and the leaderboards adapt by themselves.
3. **Same game, same feel.** v2 keeps every rule, number and screen of the October 2026 build. The test suites replay recorded fights frame for frame to prove it (see [Tests and tools](#tests-and-tools)).
4. **Still no build step.** Classic `<script>` tags, plain HTML, CSS and JavaScript. `index.html` opens with a double click. The only library is PeerJS, for online rooms.

## Folders and layers

```
index.html                 the only page: the layers the parts mount into, then one tag per file
src/
  kernel/                  layer 0  the module system, the event bus, the registry
  core/                    layer 1  numbers (config), randomness, words, storage, themes, sound
  engine/                  layer 2  the Duel rules (pure) and the fighters (rig, motion, clips, renderer)
    animation/
  services/                layer 3  settings, your fighter, stats, ratings, identity, the backend swap point
  ui/                      layer 4  the UI kit: buttons, option rows, the typing view, charts, toasts
  app/                     layer 5  the shell: router, modals, actions, session, layout, arena, keyboard, loop
  pages/                   layer 6  one folder per screen or modal (home, howto, fighter, settings, ...)
  modes/duel|race|arm|brawl          plug-ins: one folder per game mode
  net/                               plug-in: online play (private rooms over PeerJS)
  boot.js                  last     draws the first screen once every module has started
  vendor/                  PeerJS (MIT, with its license)
tests/                     node suites, no libraries (node tests/run-all.js)
tools/                     serve, build, health check, vehicle art
assets/vehicles/           the reference pictures behind the Race vehicles
```

The rule: **a module may only depend on its own layer or a lower one.** Plug-ins sit on top and may depend on any layer below, but **never on another plug-in**. The shell (layers 0 to 6) never depends on a plug-in, not even optionally. `tests/structure-sim.js` checks all of this on every run.

Why this order: the rules (engine) know nothing about the screen, the screens know nothing about any particular mode, and a mode is a self-contained package that plugs into the shell through the registry.

## The module system (kernel)

`src/kernel/kernel.js` defines the one global the game has, `CounterType`. Every other file registers exactly one module:

```js
CounterType.define("race-rules", ["config", "random"], (CONFIG, random) => {
  "use strict";
  // ... private code ...
  return Object.freeze({ create, press, step }); // the module's exports
});
```

- **Dependencies are injected.** The factory receives the exports of the listed modules, in order. Nothing else is shared: ESLint (`no-undef`, `no-implicit-globals`) rejects any other global, and the confusing browser globals (`name`, `status`, `top`, `screen`, ...) count as undefined so a typo can never silently read `window`.
- **Start order is automatic.** The kernel starts the modules in dependency order on `DOMContentLoaded` (the script order in `index.html` only matters for reading). Cycles are detected: every module on the loop fails with the loop in its reason.
- **Missing or broken modules never stop the page.** A module whose dependency is missing, failed or switched off is skipped, and so are the modules that need it. Everything else starts. A factory that throws is logged and marked failed.
- **Optional dependencies:** `"?queue-page"` passes `null` when that module is not there. Used where a plug-in offers something extra if another part of the build exists (for example the Ranked button only when the queue page is loaded).
- **Switching modules off:** `index.html?disable=race,arm`. A name switches off that module and its family (`race` matches `race-*`, never `racetrack`). The structure test proves that no plug-in family name ever matches a module the rest of the game needs.
- **After the start:** `CounterType.whenReady(fn)` runs `fn` once everything has started (boot.js draws the first screen this way). A module defined later (a script added at run time) starts at once.
- **For tools and the console only:** `CounterType.get(id)`, `has(id)` and `status()` (every module with its state: started, skipped, failed, disabled, pending). Modules themselves never use them; the structure test forbids it.

## Naming conventions

| What                      | Convention                                                                       | Examples                                                      |
| ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Files and module ids      | kebab-case, the module id is the file name                                       | `duel-session.js` defines `"duel-session"`                    |
| Plug-in files             | start with the family name                                                       | `race-rules.js`, `brawl-hud.js`, `net-peer.js`                |
| Screens and modals        | end in `-page` or `-modal`, one folder each under `src/pages/`                   | `pages/profile/profile-page.js`, `pages/pause/pause-modal.js` |
| Stylesheets               | next to their module, same base name                                             | `pages/home/home-page.css`, `modes/duel/duel-hud.css`         |
| Screen and modal elements | `#scr-<id>` and `#mod-<id>`, created by the router and modals                    | `#scr-title`, `#mod-settings`                                 |
| Plug-in actions           | `<family>-<verb>`                                                                | `race-start`, `brawl-bot:1`, `online-create`                  |
| Events                    | `<area>:<what happened>`                                                         | `settings:changed`, `duel:result`                             |
| Extension points          | kebab-case nouns                                                                 | `"mode"`, `"howto-section"`, `"profile-tile"`                 |
| Storage keys              | kept from v1 (`typeboxing.*`) so saved settings, records and profiles carry over | `typeboxing.settings`                                         |
| Rules modules             | `<mode>-rules.js`: pure, no DOM, no clock, no `Math.random`                      | `race-rules.js`, `arm-rules.js`, `brawl-rules.js`             |
| Numbers                   | `<mode>-config.js` adds the mode's section to `CONFIG` when the mode starts      | `CONFIG.race`, `CONFIG.brawl`                                 |

Every module file starts with a doc comment that says what it is, uses `"use strict"`, and returns frozen exports (or a class). Formatting is Prettier (120 columns) and the lint rules are in `eslint.config.js`.

## How parts talk to each other

Four channels, each for one kind of message. Parts never reach into each other's state.

| Channel              | Module     | Use it for                                                                  | Example                                                        |
| -------------------- | ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Dependency injection | kernel     | "I need this to work"                                                       | `race-mode` needs `race-rules`                                 |
| Registry             | `registry` | "I add something to a shared list" (the shell asks what is there)           | every mode registers a `"mode"` item; the home page lists them |
| Events               | `events`   | "something happened" (any number of listeners, the sender never knows them) | `settings:changed`, `player:changed`                           |
| Actions              | `actions`  | "the player asked for this" (a button or a menu key)                        | `data-act="race-start"` or `actions.run("menu")`               |

Two shell services complete the picture:

- **`session`** owns the run in progress (`{ mode, kind, rules, ... }`) and answers the questions every part asks: which mode owns the view (`activeMode()`), is a match on (`inMatch()`), is it paused (`paused()`). It asks the registered modes, so it never names one.
- **`online-gateway`** is the one door to online play. The net plug-in installs itself there when it starts. Without it, the gateway answers with an offline stand-in that has the same methods (never in a match, never available), so no screen ever checks whether multiplayer exists.

### Events

| Event                | Payload                     | Sent by      | Heard by                               |
| -------------------- | --------------------------- | ------------ | -------------------------------------- |
| `settings:changed`   | `{ keys, values }`          | settings     | everything that calls `settings.watch` |
| `view:changed`       | `"overhead"` or `"classic"` | settings     | layout, arena, duel-mode               |
| `layout:resized`     | sizes and scale             | layout       | arena, fighter-page, creator-page      |
| `fullscreen:changed` | `true` / `false`            | layout       | pause-modal, settings-modal            |
| `screen:changed`     | screen id                   | router       | (free for plug-ins)                    |
| `modals:closed`      | none                        | modals       | router (refreshes the screen behind)   |
| `registry:changed`   | `{ point, id }`             | registry     | (free for plug-ins)                    |
| `player:changed`     | fighter key                 | player       | looks, topbar, duel-mode, profile-page |
| `looks:changed`      | none                        | looks        | topbar, duel-session                   |
| `creator:changed`    | `{ key }`                   | creator      | player, brawl-custom                   |
| `app:menu`           | none                        | home-page    | queue-page                             |
| `duel:bot-picked`    | bot card                    | duel-bots    | duel-mode                              |
| `duel:result`        | none                        | duel-session | duel-result-page                       |
| `duel:ranked`        | none                        | duel-session | duel-result-page                       |
| `net:changed`        | none                        | net-online   | net-room-page                          |
| `net:open`           | none                        | net-online   | net-room-page                          |

A listener that throws is logged and skipped; the other listeners still run.

### Actions

A button carries `data-act="name:x:y"`; a key handler calls `actions.run("name:x:y")`. The action goes to the first part that takes it: the top modal, then the screen that is showing, then the handlers registered with `actions.on(name, handler)`, then the fallbacks (`actions.onUnknown`, used by the home page to open a mode's view by its id). A handler returns `false` to pass it on. Clicks never take focus and never type: the mousedown on a button is cancelled. While a guard (`actions.addGuard`) returns true, clicks wait (the Duel blocks them while a K.O. plays out).

## The page and its layers

`index.html` holds only the layers the parts mount into:

```
#arena          the full window canvas (arena.js owns the one Renderer)
#ui             the HUD and menus, scaled from a 1366 x 768 design size (layout.js)
  #topbar       your fighter chip, Settings and Fullscreen (topbar.js)
  #hud-layer    each mode mounts its own fight HUD here (#hud, #rhud, #ahud, #bhud)
  #countdown    the big countdown shared by the fights
  #round-banner the banner between rounds
  #overlay      one screen at a time (router.js), plus #keyline, the row of key chips
  #modal        the modal stack: pause, settings, quit confirm (modals.js)
  #toast        short messages
  #perf         the FPS overlay
```

Plug-ins create everything else they need (`dom.ensure`), so removing a plug-in leaves no markup behind. `#ui` carries the state the CSS needs: `.idle` on the menus, `data-mode="<id>"` for the mode that owns the view, `.classic` for the Classic word view, plus the settings classes (`.reduce-motion`, `.hide-wpm`, ...).

## Contracts

### Extension points (registry)

| Point               | Item                                                                                                                                               | Shown by                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `"mode"`            | a game mode (see below)                                                                                                                            | home-page, session, keyboard, loop, howto, profile, leaderboards, queue, net |
| `"howto-section"`   | `{ id, order, html(step) }`                                                                                                                        | howto-page                                                                   |
| `"key-help"`        | `{ id, order, rows() }`, rows of `[title, text]`                                                                                                   | settings-modal, Keys tab                                                     |
| `"settings-tab"`    | `{ id, name, order, rows }` (data driven rows), or `{ id, name, order, html(), preview, onAction, onInput, onChange }` for a tab that draws itself | settings-modal                                                               |
| `"profile-history"` | `{ id, mode, label, order, entries() }`, entries `{ at, mode, ranked, foe, result, win, wpm, acc, rp }`                                            | profile-page                                                                 |
| `"profile-tile"`    | `{ id, order, tile(history) }` returning `{ label, value, sub }` or null                                                                           | profile-page                                                                 |
| `"profile-extra"`   | `{ id, order, html(), draw(root), button, key, action }`                                                                                           | profile-page (the Race vehicle)                                              |
| `"profile-link"`    | `{ id, order, button, key, action }`                                                                                                               | profile-page header (Duel stats)                                             |
| `"fighter-card"`    | `{ id, html() }`                                                                                                                                   | fighter-page (+ Create)                                                      |
| `"fighter-note"`    | `{ id, order, note(key) }`                                                                                                                         | fighter-page                                                                 |
| `"clip-timing"`     | `{ id, seconds(base, clip) }`                                                                                                                      | creator-page                                                                 |

`registry.list(point)` returns the items sorted by `order` (then by when they were added), as a frozen array that is shared until the point changes. Copy it before sorting or changing it.

### A game mode

A mode registers one `"mode"` item. Required: `id`, `label`, `active`, `menu`, `start`, `restart`, `stop`, `frame` and `key` (and `startRanked` when the mode has `ranked`). The shell checks for every other field before it uses it.

| Field                                                                       | Meaning                                                                                             |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `id`, `label`, `order`                                                      | identity and its place on the home menu                                                             |
| `sub`, `homeKey`, `primary`                                                 | the menu button's second line (text or function), its key, and whether it is the big button (Enter) |
| `phone`                                                                     | playable on a phone (only Backspace Brawl is)                                                       |
| `typing`                                                                    | a typing mode (How to play groups them)                                                             |
| `pitch`, `legend`                                                           | one sentence for the How to play intro, and the note under the mode's menu                          |
| `ranked`                                                                    | `{ label, lobby: { min, max, noun }, alwaysSpace }` when the mode has a ranked ladder               |
| `active` (getter), `inMatch()`                                              | owns the view (a fight or its result), and is being played (not on the result)                      |
| `menu({ menu, side })`, `menuKey(e, key)`, `homeChips()`                    | the mode's view of the title screen and its keys                                                    |
| `opt(key, value)`                                                           | a mode option row (`opt:<key>:<value>` actions); return true when taken                             |
| `start()`, `practice()`, `restart()`, `startRanked(match, myMmr)`, `stop()` | runs                                                                                                |
| `frame(dt)`, `key(e)`, `wordDelete`                                         | the loop and the keyboard while the mode owns the view; `wordDelete` lets Ctrl+Backspace through    |
| `renderResult()`                                                            | redraws the shared mode result screen (Race, Arm Wrestling)                                         |
| `net`                                                                       | online hooks (below), only for modes that can be played online                                      |

### Online hooks

`net-online.js` plays a mode online through its `net` object, found by `net.game`:

- **Typing (the Duel, `duel-online.js`):** `game: "typing"`, `begin(match)`, `remoteKeys(events)`, `sample()`, `applySnapshot(s)`, `remoteResult(r)`, `phase`, `clock`, `snapshot()`, `result()`, `stats()`, `resultPending()`.
- **Backspace Brawl (`brawl-mode.js`):** `game: "brawl"`, `begin(match)`, `onSnapshot(s)`, `onInput(mask)`, `onResult(r)`, `active`.

The host judges and the guest mirrors (see the design notes in `net-online.js`); every message is checked by `net-protocol.js` before anything reads it.

### Screens and modals

```js
const el = router.register({ id: "profile", className: "panel", restore, refresh, onKey, onAction });
router.show("profile");
```

The router creates `<section id="scr-profile" class="screen ...">` in `#overlay`, shows one screen at a time (`.is-active`) and hands keys and actions to the showing screen first. `restore()` returns to the screen without side effects, `refresh()` redraws what depends on settings. Modals work the same way through `modals.register({ id, render, onKey, onAction })`, stacked in `#modal`.

## Add or remove a part

### Remove a plug-in

Either way works and nothing else needs editing:

- **For good:** delete its block from `index.html`, from `<!-- PLUG-IN race: ... -->` to `<!-- /PLUG-IN race -->` (the block holds its stylesheet and scripts), and delete its folder if you like.
- **For a test:** open `index.html?disable=race` (or `?disable=race,arm,net`).

`npm run health` checks every plug-in both ways in a real browser: each one switched off, each one deleted, and all of them gone at once, with zero console errors and every remaining mode still playable.

### Add a game mode

1. Make `src/modes/<name>/` with a rules module (`<name>-rules.js`, pure), its numbers (`<name>-config.js`), the screen parts (HUD, menu, result) and `<name>-mode.js`, which registers the mode:

```js
CounterType.define(
  "sprint-mode",
  ["sprint-rules", "registry", "actions", "router", "session"],
  (Sprint, registry, actions, router, session) => {
    "use strict";
    let state = null;
    registry.add("mode", {
      id: "sprint",
      label: "Sprint",
      order: 40,
      homeKey: "s",
      typing: true,
      pitch: "In a <b>Sprint</b> every word is a lap.",
      get active() {
        return !!state;
      },
      inMatch: () => !!state && state.phase === "run",
      menu({ menu, side }) {
        /* the mode's view of the title screen: buttons on the left, a panel on the right */
      },
      start() {
        /* begin a run: session.begin({ mode: "sprint", kind: "practice" }) ... */
      },
      restart() {
        /* the same run again */
      },
      stop() {
        state = null;
      },
      frame(dt) {
        /* step the rules on a fixed step, then draw */
      },
      key(e) {
        /* feed keys to the rules */
      },
    });
    actions.on("sprint-start", () => {
      /* ... */
    });
    registry.add("howto-section", { id: "sprint", order: 45, html: (step) => '<h3 class="sec">Sprint</h3>...' });
    return Object.freeze({});
  },
);
```

2. Add a block to `index.html` after the other plug-ins:

```html
<!-- PLUG-IN sprint: Mode: Sprint. Delete this block and the game runs without it. -->
<link rel="stylesheet" href="src/modes/sprint/sprint.css?v=20261028a" />
<script src="src/modes/sprint/sprint-rules.js?v=20261028a"></script>
<script src="src/modes/sprint/sprint-mode.js?v=20261028a"></script>
<!-- /PLUG-IN sprint -->
```

3. Run `npm test` (the structure suite checks the new files are loaded, named, layered and isolated) and `npm run health`.

The home menu, How to play, the Keys table, the profile and the leaderboards pick the new mode up from the registry.

### Add a screen, a settings tab or a profile tile

- **Screen:** `src/pages/<name>/<name>-page.js` registers with the router; add its stylesheet and script to the Pages block.
- **Settings tab:** `registry.add("settings-tab", { id, name, order, rows: [...] })` from any module; rows are data (see `settings-tabs.js`).
- **Profile tile, How to play section, Keys row, fighter note:** add an item to the matching extension point from the module that owns the data.

### Change a part safely

- Keep the module's exports the same, or update the modules that list it (the dependency lists tell you exactly which ones).
- Rules modules must stay pure: no DOM, no clock, no `Math.random` (the seeded generator in `random.js` is the one source of randomness for rules).
- Run `npm test`. If a replay check fails, the change made a fight play differently: if that is what you wanted, update the hash the check prints.

## Styles

- **One stylesheet per component**, next to its module, loaded in the same block (a plug-in's styles leave with it).
- **Tokens:** the palette is `CONFIG.theme.ui`, written onto `:root` as CSS variables by `themes.js` (`--bg`, `--surface`, `--line`, `--text`, ...); `theme-tokens.js` adds the ones that follow the settings (`--hud-bg`, `--scan`). Components use the variables, never raw colors.
- **State classes:** `.screen.is-active` and `.modal.is-active` (one at a time), `#ui.idle` on the menus, `#ui[data-mode="duel"]` for the mode that owns the view. Each mode's stylesheet shows its own HUD only under its own id, so no central list of modes exists in CSS.
- **Design size:** every `px` value is a design pixel at 1366 x 768; `layout.js` scales `#ui` to the window.

## Tests and tools

| Command                           | What it does                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm test`                        | every suite (`node tests/run-all.js`); `npm run test:quick` skips the balance tables                    |
| `npm run lint` / `npm run format` | ESLint with the project rules / Prettier over the project                                               |
| `npm run health`                  | the health check: inventory, tests, lint, format and the browser checks; writes `docs/health/report.md` |
| `npm start`                       | serves the folder on `http://localhost:8080` (online rooms need http)                                   |
| `npm run build`                   | the production copy in `dist/` (`node tools/build.js --without race,arm` leaves plug-ins out)           |
| `npm run bump`                    | new cache tags (`?v=`) on every file in `index.html`, so browsers load a new delivery                   |

Suites (no libraries, node only):

| Suite                                       | Checks                                                                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernel-sim.js`                             | the module system, the event bus and the registry                                                                                                                     |
| `structure-sim.js`                          | one module per file, names, the dependency graph, layers, plug-in isolation, `?disable` safety, `index.html` blocks, cache tags, no em or en dashes, no `console.log` |
| `duel-sim.js`                               | the Duel rules, bot calibration, weapons, match rules, snapshots, and replays of host and guest fights                                                                |
| `race-sim.js`, `arm-sim.js`, `brawl-sim.js` | each mode's rules, bots and balance, and replays of whole matches                                                                                                     |
| `motion-sim.js`                             | the fighters' character controller, and a replay of every designed fighter                                                                                            |
| `net-sim.js`, `ranked-sim.js`               | the online protocol, ratings, tiers, seasons and matchmaking                                                                                                          |

A **replay** check plays a whole match (or 1500 frames of a fighter) from a fixed seed and compares a hash of the result with the one recorded from the shipped rules. The recorded hashes match the October 2026 build, so they prove v2 plays exactly like v1, and they will catch any future change that alters how the game plays.
