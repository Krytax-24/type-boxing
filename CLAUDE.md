# Type Boxing

A real-time typing fighting game for the browser. Two typists type an endless Monkeytype style text stream under a fighting arena. Typing speed is both attack and guard. Stick figure fighters, combos, an ultimate. Today the opponent is a bot; real multiplayer (PeerJS, peer to peer) comes later, so keep the code ready for it.

Genre inspiration: "Keyboard Warrior Stickman: Typing Beat Em Up". Take inspiration from mechanics only. Do not copy its art, characters, name, stages or music.

This is a portfolio project and a stepping stone toward a larger 3D multiplayer weapon fighting game. Keep the code clean and readable.

## Tech decisions

- Plain HTML, CSS and JavaScript. No framework, no build step.
- Classic `<script>` tags, not ES modules, so `index.html` works by double clicking it.
- Canvas for the arena, DOM for the HUD and the typing box.
- Look: the Terminal Arcade theme (see Design system below). Image files are allowed (sprite sheets, concept art, references); today everything in the game and the lab is still drawn in code or CSS.

## Pages

- `index.html`: the DUEL (main game). Uses `css/duel.css`, `js/main.js`, `js/duel.js`, `js/duel-typing.js`, `js/fighter.js`.
- `sandbox.html`: the older combo sandbox (training dummy, move based combat). Uses `css/style.css`, `js/sandbox.js`, `js/sim.js`, `js/typing.js`.
- `animations.html`: the Animation Lab, a test page (not the game) with the six designed characters and all their animations, played with the keyboard. Uses `css/anim-lab.css`, `js/anim-rig.js`, `js/anim-clips.js`, `js/anim-move.js`, `js/anim-chars.js`, `js/anim-lab.js`. See Animation Lab below.
- `js/game.js` is an empty stub that no page loads, safe to delete.
- `tests/duel-sim.js`: headless rule checks, the bot calibration table and beat-at check, and a weapon-pair table at equal skill. Run `node tests/duel-sim.js` from the project folder (about 5 minutes). Optional numbers: matches per cell for the calibration table, per bot for the beat-at check, per weapon pair (default `40 300 300`; `node tests/duel-sim.js 0 0 0` runs only the rule checks in a second; `0 1000 1000` gives the precise numbers quoted below, about 10 minutes). Run it after any rule or balance change.

Shared: `js/config.js`, `js/words.js`, `js/render.js`, `js/fighter.js` (the Fighter data class).

## Duel layout (full screen)

- The arena canvas fills the whole window edge to edge at any size and aspect ratio, with no frame. Its backing store is the window times the device pixel ratio (`resize()` in main.js), so it stays sharp. The view is a fixed number of drawing units tall (`CONFIG.view.height`, 385, with `floorFromBottom` 60 units of floor), so a standing stickman (about 161 units) is about 42% of the screen height at any aspect ratio; a wider window simply shows more of the arena's sides (16:9, 21:9 and 4:3 all work).
- Camera (`renderer.follow`, visual only): it eases toward the fighters' midpoint and zooms out (up to `maxZoom` 1.6) when they fly apart, so both fighters stay clear of the HUD panels (`renderer.clearHalf`, measured from the panel width in `resize()`). The scenery layers never zoom (they are built once per size). The duel's own `cameraX` and world are unchanged.
- Scenery layers are capped at `Renderer.LAYER_MAX_PIXELS` (3.2 M pixels each): bigger offscreen canvases fell off the fast drawing path (measured 13 ms a frame at 2560x1440 before the cap, 0.5 ms after). On very large screens the far layers are a touch softer.
- `#ui` floats over the canvas. It is designed at 1366 x 768 (`CONFIG.view.uiSize`) and scaled to the window (`uiScale`, between 0.7 and 2.5), anchored to the edges. Every px value in duel.css is a design px.
- In a fight the HUD is versus style, like Tekken: across the top, your plate on the left (name in your identity color, weapon, HP number at the inner end, a long slanted HP bar with the ghost bar), the clock and edge panel in the middle (fight clock m:ss at 32 px, the edge rope "EDGE +x.x HP/S" whose knot slides toward whoever is winning, full stretch at `tugRange` wpm of difference, and the pause button at the right end of the edge row), and the bot's plate on the right, mirrored. Each top plate runs from its screen edge to the clock panel and has a 4 px top stripe in that player's identity color. Each player's other numbers sit in a small panel in their bottom corner: WPM at 32 px, POWER, STUNNED, the COUNTER badge on the panel's top edge, combo pips with the level and the ultimate bar. The center of the screen stays clear for the fighters and words. The HUD is hidden on the menus. Markup: `#hp1`/`#hp2` (top plates, `hpHtml()`) and `#p1`/`#p2` (corner panels, `statsHtml()`), joined per player by `panelRefs(top, corner)` in main.js.
- Text over the scenery has a dark outline: CSS `--outline` (text-shadow) on the DOM, and a stroked outline (`CONFIG.floatText.outline`) under every floating canvas text.
- Over-head view (default): each typist's current word floats in a dark plate over their own fighter. Your word sits just above your head (next word smaller to its right); the bot's word sits one row higher, so you see each attack coming. The two plates are always stacked in these two rows so they never cover each other, and they stay under the top HUD (`CONFIG.wordPlate.minTop`, 66 units). A thin line at the bottom center shows your progress through the current word. The countdown sits over the floor, bottom center.
- Classic view: the Monkeytype style typing box (a panel) sits bottom center between the two HUD panels (3 visible lines, caret, endless words); the camera uses a wider shot (`classicHeight` 520, floor `classicFloorFromBottom` 200 units up) so the box never covers the fighters. No plates. The box is hidden on the menus.
- The view is picked in Settings or with F2 on the title or result screen, saved in localStorage (`typeboxing.view`, inside try/catch).
- Plate details (per weapon, the words in the plate come from that typist's weapon pool): untyped letters light grey, correct letters in the typist's color (your Fighter color, green letters for the default white; orange for the bot, so bot letters never look like typos) with a small scale pop, wrong letters red, extra letters dark red, and every wrong or extra letter also gets a red bar under it (a cue that does not rely on color, `typoBar`), a caret that slides (magenta, the focus color; white when the typist's letters are within `caretHueGap` degrees of magenta; `caretColor()` in render.js). A wrong key flashes its letter and shakes the plate for 120 ms (no shake with reduce motion); a wrong key that breaks a combo also flashes the border red with a short crack. The ultimate word gets a gold glowing plate, larger text and an "ULT" tag.
- Floating text sits on the outer side of each fighter in two lanes (`CONFIG.floatText`), under the plates:
  - status lane (COMBO, BROKEN, COUNTER, ULTIMATE READY, ULTIMATE, K.O.): two fixed slots, so at most 2 per fighter; a new one replaces the oldest; COMBO BROKEN takes the place of that fighter's COMBO xN if it is still showing; K.O. clears the lane. `Duel.text()`.
  - number lane, further out and lower: ONE net HP number per half second (damage and healing together; orange if negative, green if positive), bigger right after an ultimate, fully bright for most of its life, then a short fade. `Duel.floaters()` and `Duel.number()`. Can be turned off in Settings.
  - The renderer nudges lane texts inside the view and records their boxes in `renderer.textBoxes` (for tests).

## Screens, buttons and keys

main.js shows one screen at a time in `#overlay` (`showScreen(name)`; `#overlay[data-screen]` picks it in CSS). Menus are panels floating over the live arena; on the title the sparring loop keeps playing in the middle. Pause, Settings and the quit confirm are modals in a small stack (`modals`, `topModal()`), shown in `#modal`.

Every action has a key AND a button. Keys and clicks go through the same `act(name)` in main.js. Buttons use `data-act`, `tabindex="-1"`, and a mousedown that is cancelled, so a click never takes focus, never steals the typing and never types a character. Typing stays keyboard only. All buttons share one shape (`.btn`, `.mbtn`, `.key`, `.seg`, `.icon-btn`) with hover (lighter border and raised color) and pressed (1 px down, 98%) states; the primary action is phosphor green with dark text.

- Top bar (menus only): your fighter chip on the left (color swatch, YOU, color name, weapon; click opens the Fighter screen), and icon buttons for Settings and Fullscreen on the right.
- Title: the TYPE BOXING logo over a left column of big stacked buttons: PLAY (the largest, phosphor, with "vs BOT, about N wpm" under it, Enter), FIGHTER (C), HOW TO PLAY (H), SETTINGS (S). The opponent cards on the right (7: the six levels and MATCH ME), each with its key, name, weapon, personality and "beat it at about N wpm"; keys 1 to 7 or a click pick one. The sparring loop (your color and weapon, the selected bot's color and weapon) plays in the middle. Key line (all clickable): 1 to 7 bot (cycles), F2 view, F fullscreen.
- How to play (H, from the title or result): four groups built from CONFIG (Basics, Combos and counter, Ultimate, Weapons) and Back (Esc or H), Fighter (C), Fight (Enter) buttons.
- Fighter, a loadout screen (C, the fighter chip, or the FIGHTER button): your stickman large on the left, holding the selected weapon and showing it off with a jab and a heavy swing every few seconds (`Renderer.drawPreview`); color grid (10 swatches, 5 by 2) and weapon cards on the right, with Back (Esc) and Confirm (Enter). Up and Down pick the row (magenta bar on its label), Left and Right pick in the row; the key line chips do the same by click. Saved in localStorage (`typeboxing.color`, `typeboxing.weapon`).
- Result: the K.O. card (YOU WIN or YOU LOSE, the time, the bot and its beat-at number), the stats in two columns, the WPM-over-time line (`wpmTrace`, sampled twice a second of duel time), a "Change bot" strip with all 7 bots (click, or 1 to 7), and Rematch (Enter), Change bot (cycles to the next), Menu (Esc). Key line: C fighter, H how to play, S settings, F2 view, F fullscreen. Keys are ignored for `CONFIG.theme.resultKeyDelay` (700 ms) after the result appears, so letters you are still typing do not fire menu keys (clicks work at once). Each finished match saves your average wpm for MATCH ME.
- Fullscreen: F on the menus and the pause menu, the top bar button, or the Settings row. It uses the browser fullscreen API; in fullscreen it asks to keep Esc (`navigator.keyboard.lock`, Chrome: hold Esc to leave). If the browser refuses, a short message says to press F11; the arena already fills the window. Leaving fullscreen during a fight pauses it. In a fight F types an f.

Pause (Esc in a fight or the countdown, or the pause button): Resume (Esc or Enter), Restart (R), Settings (S), Quit to menu (Q, then a confirm: Enter or Y quits, Esc or N keeps fighting). While paused the main loop does not step anything: the duel clock, the countdown and the bot (it reads the duel clock) all wait, and typing is ignored, so the duel stays deterministic (no rule reads real time). Leaving the browser tab or the window (`visibilitychange`, `blur`) also pauses.

Settings (S on the title, result or pause menu, or the gear button), three tabs (1 to 3 or Tab; Up and Down pick a row; Left, Right or Enter change it; Esc back):

- Game: View (Over-head or Classic), Damage numbers (on or off).
- Video: Reduce motion (turns off screen shake, the full screen flash, hit-stop, the plate shake on typos and CSS animations; on by default when the system asks for reduced motion), Screen shake (Off, Low, Normal, Strong = 0, 0.5, 1, 1.5), Fullscreen.
- Controls: a keys reference.

Settings are visual only and saved in localStorage (`typeboxing.settings`, inside try/catch). main.js applies them to the renderer (`shakeScale`, `noFlash`, `reduceMotion`, `damageNumbers`) and to `duel.hitstopOn` (visual only: hit-stop freezes poses, never rules).

## Design system: Terminal Arcade

A retro computer-lab and arcade-cabinet world: deep navy, phosphor green, hot magenta, amber gold kept for the ultimate, subtle scanlines. Original work, nothing copied from the genre inspiration.

- Palette, defined once in `THEME` at the top of `js/config.js` (`CONFIG.theme`). `THEME.ui` is mirrored as CSS variables in `css/duel.css` (`--bg`, `--surface`, ...), and main.js writes `THEME.ui` onto `:root` at start, so config.js wins if they ever drift. render.js, main.js and duel.js (text and spark colors via `CONFIG.theme.fx`) take every color from the theme. `THEME.sandbox` keeps the sandbox's old flat look: the renderer uses it unless main.js sets `renderer.pal` and `renderer.scenery`.

| Token | Hex | Use | Contrast on the panel color |
|---|---|---|---|
| bg | #060a18 | page, arena sky top | |
| surface | #0b1129 | panels, cards, typing box | |
| raised | #121a3a | selected card, kbd chips | |
| line | #2a3a73 | the one border color | |
| text | #e8edff | main text | 16.0:1 |
| dim | #8d9ac8 | labels, secondary text, untyped Classic words | 6.7:1 |
| phosphor | #4dff9a | logo, YOU WIN, healthy HP (you), HP gained | 14.3:1 |
| magenta | #ff3ea5 | focus and selection, caret, counter | 5.8:1 |
| gold | #ffc53d | the ultimate only (bar, gold word, flash) | 11.8:1 |
| danger | #ff4d5e | typos, critical HP, STUNNED, YOU LOSE, K.O. | 5.7:1 |
| warn | #ff8a3d | low HP, HP lost numbers | 7.4:1 on the arena |
| info | #7ce3ff | COMBO text, blocked hits | 11.8:1 on the arena |

- Meanings: red = typos and danger; gold = the ultimate only; magenta = focus, selection and the counter; each player's identity color (your Fighter color, the bot's look for the match, set by `applyColors()` as `--you`, `--you-letters`, `--foe`) for everything that belongs to that player: name plate, combo pips and level, tug knot, result column, chart line. HP fills keep their meaning: green (you) or the bot's color when healthy, warn below 40, danger below 20.
- Every text color is at least 4.5:1 on its background, measured (the lowest: ultimate next word 4.6:1 on the gold plate, magenta 5.4:1 on the arena).
- Type: one monospace family (`THEME.font`: Cascadia Mono, Consolas, SF Mono, Menlo, DejaVu Sans Mono). DOM scale (design px): 12, 16, 24, 32 and 64 (`--t12` to `--t64`), weights 400 and 700. 32 is for the HUD numbers (HP, WPM) and the pause menu's Resume; 64 for the logo, PLAY, the K.O. title and the countdown. Canvas word plates keep their own sizes in `CONFIG.wordPlate` (in drawing units).
- Contrast, measured again for the full screen layout (HUD panels at 90% over the brightest scenery block): text 15.8:1, dim 6.7:1, phosphor 14.1:1, gold 11.7:1, danger 5.7:1, magenta 5.7:1, the bot's red name 6.3:1; dark text on the PLAY button 15.1:1 and on magenta 6.1:1; floating texts on the sky: warn numbers 7.5:1, gain numbers 13.5:1, COUNTER 5.4:1, COMBO BROKEN 6.4:1 (5.0:1 over a lit cabinet), each with the dark outline on top.
- Spacing on an 8 px grid (4 px only inside bars and chips). One panel style: `.panel` (surface at 90%, `--panel-bg`, `1px solid --line`, radius `--r` = 4 px); word plates use the same 4 px radius. Selectable cards (`.pick`) get a magenta border, the raised color and a 4 px magenta bar on the left.
- Arena (`Renderer.buildLayers` and `drawScenery`): three layers, each pre-rendered once (and again only when the size or the view changes) into an offscreen canvas 120 px wider on each side, then slid by the parallax offset (the fighters' midpoint, eased): far 0.15 (sky, horizon glow, a skyline of arcade towers with lit windows), mid 0.4 (computer-lab desks with CRT monitors and arcade cabinets), near 1.0 (the floor with a perspective grid). Scanlines are baked in. Live ambient motion: a few blinking LEDs and one soft sweep band every 9 seconds. The scenery stays darker and lower in contrast than the fighters and plates. A layer rebuild happens only on resize; a frame costs about 0.5 to 0.7 ms (measured, see the build order).
- Motion: only where it means something (combo pop and break, the ultimate pulse, the counter badge). `prefers-reduced-motion` turns CSS animations and transitions off.

## Duel rules (all numbers in `CONFIG.duel`)

- WPM counts only correct keystrokes over the last 4 seconds (5 characters = 1 word).
- Power = wpm x weapon power x (1 + weapon comboBonus x comboLevel), x 1.20 during a counter window (below). A stun still means 0. Power is both attack and guard.
- Damage to B per second = damageScale x max(0, powerA - powerB). Only the faster typist deals damage, the difference. `damageScale` is 0.35 (was 0.5; at 0.5 the median fight lasted 12 s and ultimates almost never fired).
- Blocked per second = min(powerA, powerB). Both players heal regenScale x blocked per second, capped at 100 HP.
- Combo: a clean word has no wrong keystroke (even if fixed with backspace). Every `wordsPerCombo` clean words in a row (from your weapon: 5, Greatsword 3) is a combo level (max 5). Any mistake resets the streak.
- Counter (`CONFIG.duel.counter`): a mistake while your combo level is 1 or higher gives the OTHER typist a counter window: their power is x1.20 (attack and guard) for 1.0 s. A new counter during the window restarts the timer, it never stacks. A mistake with no combo running gives nothing. A stun still means power 0. Set in `Duel.handleEvents` (`typist.counterUntil`, duel time) and read in `Typist.power()`, so it is deterministic. Feedback: "COUNTER!" text, a fast jab with a 0.06 s visual hit-stop, and a COUNTER badge above POWER in the HUD.
- Ultimate: charge fills with wpm (about 10 s at 60 wpm, each mistake costs the weapon's `mistakeCharge`). At full charge AND the weapon's `comboRequired` combo level, a hard gold word from the weapon's ultimate pool is inserted next in the stream. Typing it clean deals 30 unblockable damage and stuns the opponent (power 0) for 2 s. A sloppy attempt deals 12 and no stun. The hard word comes from the stream's seeded `WordSource`.
- Typing works like Monkeytype: space ends a word, a wrong letter still moves the caret, backspace fixes letters in the current word.
- First to 0 HP loses.

## Bots (`CONFIG.duel.bots`, `CONFIG.duel.matchMe`)

Six levels, evenly spaced, so there is a close match for every player, plus MATCH ME. Each has a personality in CONFIG: `wpm` (the raw key rate, typos included), `accuracy` (chance each letter is right), `recovery` ([pause, random extra] seconds after a typo before fixing it; default [0.18, 0.15], the old behavior), `drift` (speed swing; default 0.15), `weapon` (default `CONFIG.weapons.botWeapon`, Medium). The Bot class reads them; a bot without them types exactly as before.

| # | Bot | Personality | Weapon | Raw wpm | Accuracy | Recovery | Drift | Beat it at about |
|---|---|---|---|---|---|---|---|---|
| 1 | ROOKIE | careful and slow | Hand wraps | 34.5 | 97% | 0.30 + 0.25 | 0.10 | 30 wpm |
| 2 | SCRAPPER | sloppy brawler | Bo staff | 56.5 | 90% | 0.10 + 0.10 | 0.25 | 45 wpm |
| 3 | TECHNICIAN | steady combo builder | Bo staff | 52 | 99% | 0.25 + 0.15 | 0.05 | 60 wpm |
| 4 | DUELIST | balanced all-rounder | Bo staff | 82 | 96% | 0.18 + 0.15 | 0.15 | 75 wpm |
| 5 | BERSERKER | fast, wild bursts | Hand wraps | 138 | 92% | 0.08 + 0.08 | 0.30 | 90 wpm |
| 6 | WARLORD | heavy-hitting boss | Greatsword | 92 | 97% | 0.18 + 0.12 | 0.12 | 110 wpm |
| 7 | MATCH ME | your last 3 matches | Bo staff | from the target | 96% | default | default | your average |

- `beatAt` is the honest number on each card: a player whose MEASURED average wpm (correct keystrokes only, the way the result screen counts) is about that number, at 96% accuracy with the Bo staff, wins about half the time. tests/duel-sim.js checks it (1000 matches per bot: ROOKIE 50%, SCRAPPER 54%, TECHNICIAN 53%, DUELIST 49%, BERSERKER 54%, WARLORD 49%, MATCH ME at 50: 48%, at 90: 51%; target 45 to 55%).
- The simulated player is a Bot whose key rate comes from `Bot.rawWpmFor(target, cfg)` (duel-typing.js): it turns a measured average into a raw key rate from the bot's own timing (a typo is a wasted key plus the recovery pause, typos only on letters). Checked: the measured average lands within 1% of the target from 30 to 120 wpm.
- MATCH ME aims at your average wpm over your last 3 finished matches (`typeboxing.history` in localStorage, inside try/catch; 50 wpm before you have any). It types like the calibration player, with its key rate from `Bot.rawWpmFor`, so it is an even fight by construction.

## Weapons (`CONFIG.weapons`, a rule input)

A weapon trades typing difficulty for power. `weaponFor(id)` in duel-typing.js returns a weapon with every field filled in: a field the weapon leaves out comes from the globals in `CONFIG.duel`, so Medium (no overrides) is exactly the original game. Bots use their own `weapon` or `CONFIG.weapons.botWeapon` (Medium). The selected weapon is drawn in the fighter's hands (see Visible weapons).

| Tier | Name | Words | Power | Combo bonus | Clean words per level | Ultimate at | Charge per mistake | Ultimate word |
|---|---|---|---|---|---|---|---|---|
| Light | Hand wraps | `LIGHT_POOL`: truly easy words (below) | x0.845 | +10% | 5 | x3 (15 clean words) | 6 | `LIGHT_ULT_WORDS`, 6 to 8 letters |
| Medium | Bo staff | `COMMON_WORDS` | x1.00 | +10% | 5 | x2 (10) | 6 | `HARD_WORDS` |
| Heavy | Greatsword | `GREATSWORD_WORDS`: 176 words of 7 to 12 letters | x1.185 | +15% | 3 | x1 (3 clean words, and the gold bar must still be full) | 10 | `GREATSWORD_ULT_WORDS`, 11+ letters |

- Light pool: the common words, most common first, that are 2 to 4 letters long, with no rare letters (q, x, z, j) and no awkward letter pairs: two different keys typed by the same finger in a row on QWERTY ("ed", "my", "ki"). `easyWord()` and `FINGER_OF` in words.js; 139 words.
- Pools live in words.js (`WORD_POOLS`, `ULT_POOLS`); config only names them. `WordSource(seed, pool, hardPool)` uses the seeded generator for both, so the same seed and weapons give the same words.
- The two power multipliers were tuned with tests/duel-sim.js inside the allowed ranges (Light 0.80 to 0.95, Heavy 1.10 to 1.35; a rule check keeps them there). Equal-skill weapon pairs, 1000 matches per pair, seats alternated, win% of the first weapon:

| Skill | Hand wraps vs Bo staff | Greatsword vs Bo staff | Hand wraps vs Greatsword |
|---|---|---|---|
| 60 wpm, 96% | 46% | 58% | 42% |
| 80 wpm, 97% | 60% | 48% | 59% |
| 40 wpm, 95% (information only) | 36% | 69% | 24% |

- At 60 and 80 wpm (the sim's equal-skill points) every pair is inside 40 to 60%. At 40 wpm 95% the Greatsword is too strong: slow typists fill the gold bar slowly, so the ultimate is limited by the bar, and the Greatsword (ultimate at combo x1) fires almost every time it fills while the others rarely hold a long enough combo. No power pair in the allowed ranges fixes 40, 60 and 80 wpm together (the Light vs Greatsword result swings about 30 points across those skills). This comes from the weapon identities, which stay as designed.
- The sim models easier words as easier to type: Light 6% faster and 1 accuracy point higher, Heavy 8% slower and 1.5 points lower. These are GUESSES in `TYPING_MODEL` (tests/duel-sim.js only, never in the game), to be replaced with measured numbers.
- Planned (not built): an option, OFF by default, where a mistake drops a Heavy typist one combo level instead of resetting the streak.

## Visible weapons (cosmetic only)

`fighter.weaponLook` ("light", "medium", "heavy"; set by main.js from each typist's weapon, never read by a rule) makes `Renderer.drawStickman` draw the weapon in the stickman's own color, following the front forearm: hand wraps (a thick cuff with two wrap bands on each fist), a bo staff (a long capped pole through the front hand), a greatsword (grip, crossguard and a broad blade at 45% fill with a solid edge). Shown in fights (gold during the ultimate spin, like the body), on the title sparring loop (`renderer.menuSpar[2..3]`) and in the loadout preview. The sandbox never sets it, so it draws no weapon.

## Architecture (keep this separation)

```
js/duel-typing.js  TypingStream (Monkeytype engine), Typist (wpm, combo, charge), Bot
js/duel.js         Duel: the rules and the world the renderer draws. No keyboard, no DOM.
js/render.js       Renderer: canvas drawing and stickman poses, never changes game state
js/fighter.js      Fighter: position and animation state of one stick figure (shared with the sandbox)
js/main.js         keyboard and mouse (act()), the Bot, typing box view, HUD, screens, pause and settings modals, full screen layout (resize())
```

Rules for multiplayer readiness:

- Both typists feed the same events into `Duel.handleEvents(side, events, time)`. The Duel never creates or steps a typist: main.js owns the keyboard and the Bot and steps the Bot before each `duel.update(STEP)`. A network layer should replace the Bot by sending and receiving those events.
- The duel runs on a fixed timestep (1/120 s) and never reads the keyboard or the clock directly.
- `Duel.start(seed, weapons)`: `weapons` is `[your id, their id]` (default Medium). Each player gets their own text stream from a seeded `WordSource` with their weapon's pools, so a shared seed and the two weapon ids give both peers the same words. Online, the weapon ids travel with the seed. `duel.js` has no `Math.random` (the test checks this).
- Hit-stop (`duel.hitstop`) freezes fighter poses only. Rules, typing and the bot keep running. `duel.hitstopOn` (a player setting) turns it off; it never changes a rule.
- Pause is a main.js matter: the loop simply does not step the bot or the duel. Nothing in the rules reads real time.

Word plates (Over-head view):

- All plate sizes, colors and timings live in `CONFIG.wordPlate`. No balance numbers there.
- `Duel.handleEvents` stamps read-only visual state on the typist: `lastCorrectAt/lastCorrectIndex`, `lastWrongAt/lastWrongIndex/lastWrongWord`, `lastComboBreakAt` (all in duel time). No rule reads them; the renderer uses them for the pop, the typo flash and the combo break border.
- `Renderer.drawPlates` only reads the duel. Its own state (`renderer.plates`: eased x, y and caret per plate) is purely visual. Plates are drawn after the shake transform is undone and follow the fighters' x with easing (y is fixed to standing head height), so screen shake, hit-stop and launches never make the text jitter.
- View settings on the renderer, set by main.js: `renderer.wordPlates` (draw plates or not), `renderer.follow`, `renderer.floorFromBottom`, `renderer.clearHalf` (the full screen camera), `renderer.res` (pixels per unit), `renderer.pal` and `renderer.scenery` (the duel's look), `renderer.menuSpar` (colors and weapons of the title sparring loop), and the player settings (`shakeScale`, `noFlash`, `reduceMotion`, `damageNumbers`). The sandbox sets none of them and draws as before (`renderer.floorShift` is still used there). The duel's `floorY` is unchanged.

Stickman color (cosmetic only):

- Presets live in `CONFIG.cosmetics` (no red family: red means typos and the bot). Each has `body` (stickman, your hit sparks, the YOU name) and `letters` (correct letters in your plate). HP bars keep their green, amber and red meaning.
- main.js sets `fighter.color`, `fighter.letterColor` and `fighter.sparkColor` at match start (`applyColors()`); render.js reads them with a fallback to the old defaults, so the sandbox is unchanged. No rule reads them.
- Contrast: if your color's hue is within `minHueGap` degrees of the bot's body or letters, the bot uses the first backup in `botBackups` that is far enough (pink gives an orange bot, amber and yellow a blue bot). Greyish colors never clash.
- Online play: the color will be sent with the match seed so each peer draws the other in the right color.

## Animation Lab (animations.html, test only)

A separate page for designing and testing fighter movement and animations before they go into the game. Nothing in the game loads these files yet. Animations are finalized here first.

The roster is Krishna's six designed characters (concept art in `C:\Users\krish\Downloads\Character Designs`), rebuilt as side-view vector puppets that keep each design: proportions, palette, costume pieces, hair or headgear, weapon and effects. They are defined in `js/anim-chars.js` (namespace `Chars`, loaded after anim-move.js):

| Key | Name (working) | Design | Body | Move set (weapon) |
|---|---|---|---|---|
| 1 | IRON VANGUARD | cyborg swordsman, purple and red armor, silver cyber arm with orange glow lines | M | `sword` (male sword moves), cyber sword |
| 2 | BLUE X | baseball brawler, blue X jersey, pinstripe pants, blue socks, sneakers, beard, wallet chain | M | `bat` (two-handed metal bat) |
| 3 | COMMANDER VOSS | silver ponytail, black scale armor with blue and white camo plates | F | `staff` (long staff, pompom, blue ribbons) |
| 4 | FROSTJAW | ice barbarian, horned helmet, fur mantle, glowing blue cape, bare arms with bracers | M, heavy (slower, tempo 1.12) | `axe` (greataxe, icy edge, frost effects) |
| 5 | NOVA | blue flame brawler, braid, cropped jacket, glowing tattoos, purple eyes | F | `flame` (a floating spell orb of blue fire: orb jab, orb blast, orb pillar, comet, orb drop) |
| 6 | SUVARNA | faceless golden four-arm dancer, yellow outfit, red sash, teal panel, gold bangles, barefoot | F, four arms (`B.arms4`) | `dance` (four palms, whirl, crane kick, lotus whirl kick) |

- The names of characters 1, 4, 5 and 6 are working names; change them in `Chars.DEFS`.
- Each character has a profile (`prof`: body overrides of `Rig.BODY`, style overrides of `Move.STYLE`, including `speedK`), so proportions and movement differ per character. Clips are built per character (`Anim.clips(weapon, gender, prof)`).
- Drawing: a Tekken 3 inspired look (art references from Krishna still to come): realistic proportions (head radius about 10 to 11), no comic outlines (a thin translucent dark edge only), flat costume colors with faceted shading from one light at the upper left (hard bands of light, flat, shadow and core shadow across every limb, the torso, head, hands and feet; `facetAxis`, `facetDir` in anim-chars.js). Limbs are layered tapered capsules, the torso is clipped and painted in bands and shapes along the bent spine. Gender in the silhouette (`torsoProfile`): women have a bust, a narrow waist, fuller hips and upper thighs, slimmer arms and necks, and a profile face with a small nose, lashes and full lips; men a broad, squarer chest, a heavier brow, a bigger nose and a square jaw. Hair has a lit streak. Back limbs are shaded darker. A two-handed weapon held back over the shoulder is drawn behind the head.
- Nova's spell orb: pose fields `ox oy os` (forward, height above the floor, size; key spec `o: [x, y, size]`), joint `J.orb`, smear index 2. It hovers over her front palm, trails her when she runs, bobs at rest, and rides a soft spring (very stiff during attacks so it lands on the hit). Clips with `orb: true` strike with the orb; `ranged: true` (blast, comet) skips the lock-on distance stretch. Drawn as blue fire with a white core, licking tongues and a glow.
- Four arms (Suvarna): every arm also rides a shared flow cycle with its own phase (`overlays()` in anim-move.js), full at rest and a quarter during attacks, so the four move in sync yet individually; the second pair has looser follow-through springs. Attack 1 is a four-palm cascade (upper front, lower front, upper back, lower back, one beat each).
- The four-armed body: pose fields `fc0 fc1` and `bc0 bc1` (second pair from lower on the chest), included in arm sets, blends, follow-through springs and smears.
- Attacks chain: each attack has a cancel window just after its last hit (`cancelAt`); an attack pressed earlier is buffered and starts the moment the hit lands, blending over the recovery, so moves overlap instead of waiting for the end.
- The old stick figure clips (bare hands and sword M and F, and the four parked weapons) are still in anim-clips.js; the practice dummy is the grey bare-hands stickman.

- `js/anim-rig.js` (namespace `Rig`): skeleton and drawing. A pose is a flat object of absolute angles (0 forward, 90 up) plus root fields (`x`, `y`, `air`, `rot`, `turn` for fake 3D turns, `sq`), foot angles (`ffa`, `bfa`) and twist (`pel` moves the front hip forward of the back one, `chest` the same for the shoulders). Two body profiles in `Rig.BODY`: M (broad chest, wider stance, thicker tapered limbs, bigger head) and F (narrower shoulders, defined waist, longer legs for her height, slimmer limbs, ponytail). The torso is a smooth side-view outline; limbs taper; feet are drawn and pitch (toe-off, heel strike). `Rig.sample` (spline, for the parked weapons and death) and `Rig.sampleEase` (eased keys `[t, pose, ease]`: inout, snap, outExpo, hold, back) sample clips. Cloth is verlet chains; the ponytail hangs with gravity.
- `js/anim-move.js` (namespace `Move`): the character controller and procedural locomotion. Logic state (ground, prejump, air, actions, dash, skid, turn) is separate from the pose it produces. Speeds in `Move.SPEED` (walk 120, back 92, run 340, crouch 66, dash 640, back dash 470). Every frame the feet are placed from a gait cycle driven by distance travelled (planted feet never slide, walking backward runs the cycle in reverse), the legs reach them by two-bone IK, the hip bobs from the planted foot's reach (walk) or a run bob, and walk blends into run by speed with no seam. Lean is a spring driven by speed and acceleration (lean into a start, back on a stop); the head stays level against the lean. Jump: a short crouch, then physics (hold for a higher jump, faster fall than rise), a landing dip scaled by impact; a running jump is a leap. Crouch is a spring (landings overshoot a little). Turning is an animated fake 3D turn. Two facing modes: lock-on (face the dummy, walking away is a guarded back walk) and free (face where you move; reversing a run skids first). Movement style per body in `Move.STYLE` (M heavier, wider, slower breathing, shoulder drive, heavier landings; F lighter and quicker, narrower stance, hip-led weight shift, higher heel kick, faster turns and attacks). Arm sets per weapon in `Move.ARMS`. `Move.restPose()` is the guard every attack starts and ends on.
- `js/anim-clips.js` (namespace `Anim`): action clips. Bare hands and Sword use eased keys built on each body's own guard, with planted feet placed by IK (`ft`): wind-up (inout), strike (snap), held contact frames (hold), recovery. Bare hands: jab, cross (hips and back shoulder drive through), uppercut; attack 4 is a flying knee (M) or a high kick (F). Sword: light slash, up slash, thrust; attack 3 is a down slash (M) or a spin slash (F). Different taunts per body. Shared hit, parry and death. Clips carry events (impact, dust, land, slam, parry, hurt, thud), trail windows and afterimage windows.
- `js/anim-lab.js`: the stage, on a fixed 1/120 s step. Actions blend over locomotion; weapon smears are sampled between steps; impacts on the dummy give sparks, hit-stop and shake; steps, skids, dashes and landings kick up dust. Bodies do not overlap (pushed to 44 units from the dummy).
- Keys (testing only): 1 to 6 character (C compares with the next character, copying your inputs); Left and Right walk (hold), with Shift run; tap twice to dash (away from the dummy: back dash); Down crouch (with Left and Right: crouch walk); Space or Up jump (hold for higher); X lock-on or free facing; M turn (free facing); A S D F attacks 1 to 4, Q combo, E parry, H get hit, T taunt, K death, R reset; C compare (the other body copies your inputs behind you); Z slow motion, P pause, . step, L repeat, O onion skin, V sheet pages (movement, then actions, simulated through the real controller), Enter demo reel, N dummy, B background, ` panel.
- Tests: `window.labRun(steps, input)` runs fixed steps with a scripted input (for frame captures); `window.labActors()` gives the fighters.
- Checked: both weapons, both bodies, every key, both sheet pages, compare mode and the demo reel; zero console errors; about 0.4 ms a frame (0.66 ms with two fighters running) at 1366x768.
- Quality rules (measured with a frame-by-frame script after the bug-fix pass): planted feet do not slide in walk, run, back walk or crouch walk (0 units median); no sole ever goes below the floor (a floor guard in `Move` lifts the hip if one would); legs never lock straight (leg IK compresses reach past 94.5% toward 98%); every foot, lifted or planted, limits the hip height, so the hip never jumps at toe-off; steps inside eased attack clips interpolate the feet in the world and lift a moving foot on an arc; strikes use a softer snap (power 3.5); take-off, landing and dash blends are 0.12, 0.1 and 0.08 s.
- Polish pass (all in the lab):
  - Follow-through: arms, weapon, head and spine follow the pose through slightly underdamped springs (`Move` SEC table, stiffer during actions). Legs are not sprung, so feet stay planted. Smears use the same offsets so they stay on the blade.
  - Spine: pose field `spine` bends the chest against the lower torso. Attack keys get 0.45 of their lean change as spine automatically; locomotion curls the chest in the run and crouch and lags it behind fast lean changes. The torso outline follows the bend.
  - Hands: `fo`/`bo` open the front or back hand (parry, hits, taunts, idle breaks). `g2` brings the back hand onto the sword hilt (the male down slash is now two-handed).
  - Pivot turn: mid-turn the upper body squeezes and its two sides spread as if seen from the front, while the feet stay planted and only the knees swing round (`turn` in `Rig.solve`).
  - Momentum and distance: an attack out of a run or dash keeps sliding; in lock-on an attack stretches its forward travel by up to 40 units (never backward) so the strike meets the target. Attacks pressed during the jump crouch or in the air become the weapon's air attack (one per jump: flying kick, aerial slash).
  - Reactions: light hit, heavy stagger (held a moment) and knockdown with a get-up; each attack names its `hitType` (attack 1 and 2 light, 3 heavy, 4 knockdown, air heavy). Staggered or knocked-down fighters cannot act until `lockUntil`.
  - Idle breaks after 6 to 10 s standing still (any input cancels): shake out and neck roll (M bare hands), fix hair and bounce (F bare hands), blade on shoulder and edge check (M sword), blade twirl and stretch (F sword).
  - More male and female differences: F bare hands attack 1 is a double jab, F sword attack 1 a double slash (plus the earlier attack 3 and 4 and taunt variants).
  - Impact: a held impact frame (dimmed scene, burst of lines from the contact), hit-stop by hit type, a camera punch-in that springs back, and synthesized Web Audio sound (steps, whooshes on every smear, punch and blade hits, parry clang, landings, thuds, dash), started on the first key press; U toggles it. Back limbs are a lighter tone for readability.
  - Blending fixes found while testing: a blend picks the short way round once, on its first frame; target angles are kept continuous frame to frame (leg IK wraps at 180); the follow-through springs follow the target's own path; clip events fire after the frame's pose is set.
- Checked after the polish pass (scripted runs of locomotion, jumps, turns, dashes, every attack and combo, reactions, air attacks, running attacks, idle breaks and death on all four characters): no NaN pose values, no sole below the floor, largest joint jump 33 units a step (inside intended sword strikes), planted feet 0 units median slide, attack foot slide under 0.5 units a step, legs under 95% stretch, zero console errors, every key in the live page, audio running after the first key, about 0.6 ms a frame.
- Keys added: U sound on or off; any attack key in the air does the air attack; V now has three pages (movement, attacks, reactions and idle breaks).
- Checked with the designed characters (all six): scripted runs of every scenario (locomotion, jumps, turns, dashes, attacks and combos, reactions, air and running attacks, idle breaks, death): no NaN, no sole below the floor, largest joint jump 37 units a step inside strikes, zero console errors; every key in the live page; chaining verified (a buffered attack starts at the first one's cancel window, about halfway through); lineup renders compared with the concept art; about 0.95 ms a frame.
- Checked after the Tekken 3 restyle, the orb and the four-arm pass (all six): every scenario, no NaN, no sole below the floor, largest joint jump 37 units a step inside strikes, zero console errors; the orb never goes below the floor and stays finite in every clip and in locomotion; chaining verified on all six (a press during a long multi-hit attack is now buffered 0.7 s); every key in the live page; about 1.5 ms a frame (the faceted shading costs about 0.5 ms).

## Build order

1. Combo sandbox. DONE (sandbox.html).
2. Duel against a bot. DONE (index.html).
3. Words over the fighters (Over-head view, Classic view on F2). DONE.
4. Stickman color (Fighter screen). DONE.
5. Weapon tiers (Fighter screen weapon row, per-weapon pools and numbers). DONE, balance open items above.
6. Look: the Terminal Arcade design system, parallax arena, fighting game HUD with the tug-of-war edge, title, How to play, Fighter and result screens. DONE. Checked: all four bots, all three weapons, ultimate, stun, counter, K.O., rematch, menu, F2, C, H and colors, zero console errors; with a fixed random seed `node tests/duel-sim.js` gives the same output before and after (no rule or balance change); sandbox.html looks the same; frame time about 0.3 to 0.4 ms per frame at 800x600, 1280x720 and 1920x1080 (0.36 to 0.45 ms before).
7. Full screen and difficulty pass: the arena fills the window (Krunker style layout, HUD at the edges, menus as panels over the live arena), fullscreen toggle, mouse support for every action, pause menu and settings, visible weapons, the weapon identities (Hand wraps easy and weaker with the longest road to the ultimate, Greatsword stronger with the ultimate at combo x1) tuned with the sim, six calibrated bots with personalities plus MATCH ME. DONE. Checked: screenshots of title, loadout, how to play, settings, pause, countdown, mid fight, ultimate and result at 1366x768, 1920x1080, 2560x1440 and 2560x1080 (the arena fills 100% of the window at every size); a mouse-only and a keyboard-only click-through of every screen; a K.O. against every bot with every weapon (21 matches through the real game objects: ultimates, stuns, counters and K.O.s all seen); pause freezes the clock; clicks type nothing and take no focus; Classic view; zero console errors; `node tests/duel-sim.js` passes; sandbox.html looks the same; frame time 0.46 to 0.73 ms per frame at all four sizes.
8. Animation Lab (animations.html): every move from the reference sheets for six weapons, M and F, designed in code with spline keyframes, blending, IK, cloth physics, smears, hit-stop and effects; keyboard test controls. DONE (test page only).
8c. Designed characters (anim-chars.js): the six characters from the concept art with their own move sets, effects and sounds. DONE (test page only, animations being finalized before the game).
8b. Movement pass (anim-move.js): a character controller with procedural idle, walk, back walk, run, crouch, crouch walk, jump, turn, dash and skid; lock-on and free facing; separate male and female bodies and movement; eased attacks for Bare hands and Sword. DONE (test page only). Next for the lab: bring dual blades, spear, hammer and scythe onto the same system.
9. Next: bring the lab's rig into the duel (render.js) behind a setting; measure real speed and accuracy per weapon and replace `TYPING_MODEL` (then re-check the weapon table, especially at 40 wpm); try the Heavy one-level drop option; character types (2 to 4, typing based), then multiplayer with PeerJS.

## Working rules

- Work in small steps. After each step, tell me how to test it in the browser.
- Keep rules separate from rendering and networking.
- Do not add libraries without asking, except PeerJS for multiplayer.
- Explain any command I need to run.
- Prefer simple code over clever code.
