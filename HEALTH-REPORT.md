# Health report: CounterType release v2

Date: 28 October 2026. Scope: the October 2026 build (`index.html` and the 51 scripts and 7 stylesheets it loads, called v1 below) and this folder (v2).

## Verdict

**Healthy.** v2 plays exactly like v1, every module can be changed or removed without breaking the others, and every automated check passes.

| Check                | Result                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test suites          | 9 suites, all pass: 445 checks quick, 451 with the balance tables (`npm test`, about 4 minutes)                                                                                            |
| Same game as v1      | seeded output of every suite byte for byte identical to v1, including the full Duel calibration tables (163 lines)                                                                         |
| Replays              | 25 recorded matches and fighter runs replay to the same hashes as v1                                                                                                                       |
| Lint (project rules) | 0 errors, 7 warnings (complexity in drawing code, listed below)                                                                                                                            |
| Format               | 164 files (code and docs), all in the project style (Prettier)                                                                                                                             |
| Plug and play        | 14 builds of the page in a real browser (whole game; each of the 5 plug-ins switched off; each deleted; all deleted): every module starts, zero console errors, every remaining mode plays |
| Screens              | 34 scenes at 1024 x 768, 1366 x 768 and 1920 x 1080, plus phones in both orientations: same screens and states as v1, zero console errors                                                  |
| Buttons              | all 313 buttons on 16 screens and modals clicked one by one on both builds: each does the same thing in v2 as in v1 (none lost its handler)                                                |
| Online               | host and guest connect, fight (Duel and Backspace Brawl), keys flow and the ping badge works (with a stand-in for the PeerJS server, which this sandbox cannot reach)                      |
| Performance          | no measurable difference (frame rates within run to run noise)                                                                                                                             |

Run it yourself: `npm install`, then `npm run health` (add `npm install --no-save playwright` and `npx playwright install chromium` for the browser checks). The report lands in `docs/health/report.md`.

---

## 1. Audit of v1: gaps in how the code was written

| #   | Gap                                                                   | Evidence in v1                                                                                                                                                                                                                                                                                                                                                                                              | Risk                                                                                                                            |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Global scope as the wiring.** Every script shared one global scope. | 274 globals shared between scripts; the shell's 10 files shared about 75 top-level mutable variables (`screen`, `modals`, `bot`, `run`, `view`, ...). Mode files used the shell's globals directly (their headers list `ui, run, settings, showScreen, btn, keyline, modals, uiScale`, ...).                                                                                                                | Any file could read or change another file's state; a rename or a new variable could break a distant file; load order mattered. |
| 2   | **God functions.**                                                    | `act()` complexity 128 and `menuKey()` 122 (every key and button of every screen in two functions), the movement controller's `update()` 148 and 152 statements, Brawl `control()` 110, online `onlineMessage()` 53, protocol `validate()` 64. 21 functions over complexity 30.                                                                                                                             | Hard to read, to test and to change safely.                                                                                     |
| 3   | **Dense, unformatted code.**                                          | 1,360 lines holding several statements, 435 lines of code over 120 columns, 130 nested ternaries, no formatter.                                                                                                                                                                                                                                                                                             | Hard to review and to diff.                                                                                                     |
| 4   | **Dead and duplicate code.**                                          | 19 stale copies of scripts at the `js/` root and 2 stylesheets that `index.html` never loads (about 8,000 lines, with the same names as live files, such as `js/duel.js` and `js/engine/duel.js`); 117 unused variables and functions; Animation Lab leftovers in the rig (a generic fighter drawing, cloth helpers, constants); a stickman drawing path the game no longer reaches; unused fighter fields. | Editing the wrong file; more to read than to run.                                                                               |
| 5   | **Central lists.**                                                    | 32 CSS selectors listing every screen and modal (`#overlay[data-screen="title"] #scr-title`, ...); HUD markup for modes in `index.html`.                                                                                                                                                                                                                                                                    | Adding or removing a screen or mode meant editing shared files.                                                                 |
| 6   | **Plug-ins with hidden links.**                                       | Modes reached the shell through globals; removing one meant editing `index.html` by hand, with no way to switch one off for a test.                                                                                                                                                                                                                                                                         | "Remove a module" was possible but fragile and unverified.                                                                      |
| 7   | **Comments and docs that drifted.**                                   | Comments naming `main.js` and files that no longer exist; "accuracy (the default)" next to `basis: "speed"`; "x1.20 power" for a 0.1 bonus; the rig's header saying "The game does not load this file yet".                                                                                                                                                                                                 | Wrong mental model for the next change.                                                                                         |
| 8   | **A flaky test.**                                                     | The bot speed check (one random 600 s run per bot) failed in 4 of 150 runs.                                                                                                                                                                                                                                                                                                                                 | A red test that is not a bug teaches people to ignore red tests.                                                                |
| 9   | **Security: HTML from another player.**                               | The online room put the opponent's name into the page as HTML (`Opponent: ${name}`); names are only trimmed to 16 characters.                                                                                                                                                                                                                                                                               | A peer could inject markup into your page.                                                                                      |
| 10  | **UI bug.**                                                           | The Creator screen kept the Fighter screen's PREVIOUS, NEXT and ROW chips, which acted on the hidden Fighter screen.                                                                                                                                                                                                                                                                                        | Confusing, and could change your fighter pick unseen.                                                                           |
| 11  | **Lint issues.**                                                      | 4 errors (useless escapes), 27 `let` that never change, 16 shadowed names.                                                                                                                                                                                                                                                                                                                                  | Noise that hides real problems.                                                                                                 |
| 12  | **Inconsistent names.**                                               | `armwrestle.js` beside `arm-game.js`; `net.js`, `online.js` and `protocol.js`; globals named `Move`, `Anim`, `Rig`, `Chars`, `DuelChars`, `Combo2D` in files named `anim-move.js`, `anim-clips.js`, `duel-chars.js`, ...                                                                                                                                                                                    | Hard to find things.                                                                                                            |

## 2. What v2 does about each gap

| #   | In v2                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | One global (`CounterType`). Every file is one module with an explicit dependency list; ESLint rejects any other global. A module can only be affected by the modules it lists.                                                                                                                                                 |
| 2   | The shell is split into router, modals, actions, session, layout, arena, keyboard, loop and one module per page; each mode owns its keys. The largest rules and animation functions were split into named steps (complexity 148 to under 30, 110 to under 30, 64 to under 10, ...), each verified frame for frame (section 3). |
| 3   | Prettier (120 columns), one statement per line, comments reflowed to 120 columns.                                                                                                                                                                                                                                              |
| 4   | No orphan files (a test fails if a script or stylesheet is not loaded); 0 unused variables; the lab leftovers (about 360 lines in the rig), the stickman path and the unused fields removed.                                                                                                                                   |
| 5   | Screens and modals use `.is-active`; each mode styles its own HUD under `#ui[data-mode]`; plug-ins create their own markup.                                                                                                                                                                                                    |
| 6   | Each plug-in is one block in `index.html`; `?disable=` switches any plug-in off; `tools/build.js --without` leaves it out of a build; the health check proves all three in a browser. A structure rule guarantees `?disable=<plug-in>` never takes out a module the rest needs.                                                |
| 7   | Comments rewritten where they had drifted; `ARCHITECTURE.md` documents the contracts.                                                                                                                                                                                                                                          |
| 8   | The check averages three seeded runs: same answer every time (0 failures in 140 random seed sets).                                                                                                                                                                                                                             |
| 9   | Every name from another player is escaped.                                                                                                                                                                                                                                                                                     |
| 10  | Every screen sets its own key line.                                                                                                                                                                                                                                                                                            |
| 11  | 0 errors under the same rules.                                                                                                                                                                                                                                                                                                 |
| 12  | Module id = file name; plug-in files start with their family (`race-rules.js`, `arm-scene.js`, `net-peer.js`); see the naming table in `ARCHITECTURE.md`.                                                                                                                                                                      |

### The numbers, same rules on both

The audit rules used on v1 (ESLint recommended plus statements per line, line length, complexity over 20, function length, depth, shadowing, nested ternaries), run on v1's 51 loaded scripts and v2's 117 scripts:

| Rule                                                    | v1    | v2  |
| ------------------------------------------------------- | ----- | --- |
| Errors                                                  | 4     | 0   |
| Several statements on one line                          | 1,360 | 0   |
| Code lines over 120 columns                             | 435   | 0   |
| Unused variables and functions                          | 117   | 0   |
| `let` that never changes                                | 27    | 0   |
| Shadowed names                                          | 16    | 0   |
| Nested ternaries                                        | 130   | 68  |
| Functions over complexity 20                            | 43    | 34  |
| Functions over complexity 30                            | 21    | 7   |
| Highest complexity                                      | 148   | 43  |
| Functions over 50 statements (module wrappers left out) | 24    | 17  |
| Largest function, in statements                         | 152   | 102 |
| Total warnings                                          | 2,208 | 227 |

One rule reads worse on v2, for a formatting reason rather than a code reason: functions over 80 lines (8 in v1, 41 in v2). v1's functions were short in lines because they packed several statements onto each line; counted in statements, which formatting does not change, v2 is smaller. Every module factory is also one long function by construction; those 46 are left out. Unused `catch (e)` parameters (65 in v1, 32 in v2) are left out of the unused count in both columns.

## 3. How "same game" was verified

Behavior was not checked by eye alone. Every claim below was measured.

1. **Seeded suite output.** With `Math.random` replaced by a seeded generator, every suite was run on v1 and v2 and the outputs compared byte for byte: Duel (the full run with the calibration table and the beat-at check, 163 lines), Race, Arm Wrestling with its balance table, Brawl, the protocol and ranked suites. All identical.
2. **Differential tests for every refactored function**, v1 and v2 side by side on the same inputs:
   - Brawl rules (control, bot, move table, snapshots): 480 fights, 952,683 frames, 25,984 snapshots and every move of every fighter at every strength. Identical state on every frame.
   - The fighters' movement controller: all 11 designed fighters, 121,000 frames of random input (walks, runs, jumps, dashes, turns, attacks, reactions, idle breaks). Identical state, pose and effects on every frame.
   - The Duel's snapshots: 18 host fights, 12,792 snapshots applied by a plain and a mirrored guest. Identical guests.
   - The online protocol check: 200,000 mutated messages. The same accept or reject on every one.
   - The theme builder: 3,096 palettes (every preset, every preset with one color changed, random ones). Identical themes.
   - The vehicle art tool: the same pictures give byte for byte the same data, now in the v2 module format.
3. **Replays kept as tests.** 25 whole matches and fighter runs (3 Duel host and guest fights, 3 races, 3 arm wrestling matches, 5 Brawl fights, all 11 fighters' controllers) replay to hashes recorded from v1. Any future change that alters how the game plays fails a test and says so.
4. **Screens.** A script visited 34 scenes on both builds (title, every mode's menu, countdowns, fights, pause, settings tabs, confirm, results, How to play, Fighter, Creator, Profile, Stats, Leaderboards, ranked queue, online room, the Classic view) and compared the screen, mode and idle state at every step, plus screenshots with the arena hidden: same states, zero console errors at 1024 x 768, 1366 x 768 and 1920 x 1080; pixel identical on phones (390 x 844 and 844 x 390, touch). The remaining pixel differences were inspected one by one: random words and bot timing, animated previews, and the two intended changes (the Creator key line and the Race line in How to play).
5. **Every button.** A script opened 16 screens and modals (the home menu, each mode's menu, How to play, Fighter, Profile, Stats, Leaderboards, the online room, the ranked queue, pause, and three Settings tabs) and clicked each of their 313 buttons on a fresh page, recording any change to the screen, the modals, the page markup, the toast, the settings, the theme or the saved data. Both builds give the same result for every button. The only buttons with no visible effect are the same in both: options that are already selected, buttons behind an open modal, and two that wait on a timer.
6. **Settings reach their targets.** All 33 player settings are read by the parts they control, as often as in v1.

## 4. Problems found by the health check during the work (all fixed)

| Problem                                                                                                                                           | Found by                              | Fix                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| `?disable=net` took the whole page down: the shell's `net-gateway` matched the `net` family.                                                      | the browser matrix                    | renamed to `online-gateway`; a structure rule now forbids any such clash |
| The Sound effects and Volume settings did nothing (the wiring was lost in the split).                                                             | the settings audit                    | `app/sound.js` applies them; checked in a browser                        |
| Race and Arm Wrestling results crashed on a missing field; a hook name mismatch in the Duel HUD; a leftover v1 function name in the online layer. | the screen comparison and page errors | fixed while building                                                     |

## 5. Performance

Headless Chromium, software rendering, 1920 x 1080, uncapped frame rate, six rounds alternating the builds (frames per second, mean):

| Scene                 | v1   | v2   |
| --------------------- | ---- | ---- |
| Title (sparring loop) | 28.0 | 28.2 |
| Duel fight            | 34.8 | 36.8 |
| Race, 4 racers        | 72.9 | 71.9 |
| Arm Wrestling         | 37.3 | 39.1 |

The differences are inside the run to run noise. A trace shows the same time per frame in style, layout and painting for both builds; the game's own script time per frame is under 3 ms in both. The registry keeps its sorted lists between changes, so the loop's per-frame questions cost nothing.

## 6. Known items and recommendations

1. **Seven drawing functions over complexity 30** (lint warnings): `drawPlate` 43 and `draw` 34 (renderer), the Brawl effects frame 41, `impact` 38 (fighter stage), `drawHead` 36 and `draw` 34 (characters), `drawLane` 33 (race track). They draw many optional parts; splitting them safely needs a canvas recording test like the ones above. Suggested next step.
2. **Rotate the relay (TURN) key.** It is no longer in the source, but it is in the git history, and anything in a web page is public anyway.
3. **The project's main `CLAUDE.md` describes the old layout** (`main.js`, `js/...`). release-v2 has its own short `CLAUDE.md` that points at `ARCHITECTURE.md`; update the main one when you switch over to v2.
4. **Long strings** (HTML templates, passages, word lists) run past 120 columns: Prettier leaves strings whole. Not a problem, noted for completeness.
5. **Online play against the real PeerJS server** could not be tested from this sandbox (its network blocks the server). The game's side was tested end to end with a stand-in; one real two-browser test on your machine is worth doing before a release (`npm start`, two windows, Create room and Join).

## 7. Re-running the checks

| What                      | Command                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| Everything                | `npm run health`                                                  |
| All suites                | `npm test` (full, a few minutes) or `npm run test:quick`          |
| One suite                 | `node tests/structure-sim.js` (any file in `tests/`)              |
| Lint and format           | `npm run lint`, `npm run format:check`                            |
| A build without a plug-in | `node tools/build.js --without race`, then open `dist/index.html` |
