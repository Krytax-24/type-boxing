# Type Boxing: handoff for a new chat

Paste this whole file into a new chat (or point the chat at it) and say: "Continue Type Boxing from this handoff."
Status as of 2026-10-05.

## 1. The project

- Type Boxing: a real time 1v1 typing fighting game for desktop browsers. Two stick figure fighters; typing speed is both attack and guard. Portfolio piece and a stepping stone toward Krishna's larger 3D multiplayer weapon fighting game.
- Inspiration: "Keyboard Warrior Stickman: Typing Beat Em Up" (Steam). Take mechanics and techniques only, never its art, characters, name, stages or music. UI layout inspiration: Krunker.io (patterns only).
- Tech: plain HTML, CSS, JavaScript. Classic script tags, no ES modules, no build step, no libraries (PeerJS allowed later for online play). index.html must work on double click. Canvas for the arena, DOM for HUD and menus.
- Folder on Krishna's PC: `C:\Users\krish\Downloads\Type Boxing`. CLAUDE.md in that folder holds the rules, architecture, design system and build order; its rules win.
- Files: `index.html` (the duel), `sandbox.html` (old combo sandbox, must keep working), `js/config.js` (all numbers, theme), `js/words.js` (word pools, seeded WordSource), `js/duel-typing.js` (TypingStream, Typist, Bot, weaponFor), `js/duel.js` (rules, no DOM, no clock, no Math.random), `js/fighter.js`, `js/render.js` (canvas only, reads state), `js/main.js` (keyboard, bot, HUD, screens, scaling), `css/duel.css`, `tests/duel-sim.js` (headless rule checks plus balance tables: `node tests/duel-sim.js`). `js/game.js` is a dead stub to delete.
- Plan doc (Claude Docs): "Type Boxing: Animation, UI and Modes Plan", https://claude.ai/code/artifact/d1c31e48-aa9f-4a75-970e-0388ca69b250

## 2. How we work

1. Krishna asks for the next step. Claude (this chat) writes a well defined prompt for Claude Code, usually starting with `/everything` (Krishna's orchestrator skill that routes to webapp-testing, game-feel, game-ux-review, balance-review, frontend-design and others).
2. Krishna runs it in Claude Code; it edits the folder and reports.
3. Krishna pastes the report here; Claude independently re-tests the current folder: stage the files, diff against the previous version, run `node tests/duel-sim.js`, play full matches against every bot in headless Chromium with Playwright (file:// URL, real key presses, read `duel`, `CONFIG`, `renderer` with page.evaluate), trigger ultimate, stun, counter, K.O., rematch, menus, check console errors, screenshots at several resolutions, frame time, sandbox. Then reports discrepancies and whether to proceed.
- Krishna's style preferences: plain prose, no em dashes or en dashes, concise, evidence based (numbers, screenshots), small summarized plans rather than huge ones. Prompts end with a VERIFY and a short REPORT section.

## 3. Current game rules (CONFIG.duel)

- WPM: correct keystrokes over the last 4 s (5 chars = 1 word).
- Power = wpm x weapon power x (1 + weapon comboBonus x comboLevel), x1.20 during a counter window; a stun makes it 0. Power is attack and guard.
- Damage to the slower typist per second = 0.35 x power difference. Blocked part (min of both powers) heals both at 0.04 per wpm per second, max 100 HP.
- Combo: clean words in a row (no wrong keystroke, even if fixed). Every N clean words (weapon) = +1 level, max 5. Any mistake resets.
- Counter: a mistake while your combo is x1 or higher gives the OTHER typist +20% power for 1.0 s (restarts, never stacks). Visual: "COUNTER!", jab, 0.06 s hit-stop, HUD badge.
- Ultimate: charge 0.16 per wpm per second (about 10 s at 60 wpm), mistakes cost charge (weapon). At full charge and the weapon's combo requirement, a gold hard word is inserted. Clean: 30 unblockable damage and 2 s stun. Sloppy: 12, no stun.
- Duel is deterministic: `Duel.start(seed, [weapon ids])`, fixed 1/120 s step, events via `Duel.handleEvents(side, events, t)`. The bot lives in main.js and feeds the same events (ready to be replaced by a network peer).

## 4. What is built (all verified by re-testing)

1. First full audit (16 gaps fixed): window scaling, hit-stop, HP ghost bar, combo break feedback, floating text without overlap, bot moved out of rules, seeded words, Fighter class split out, headless tests. Balance option C approved (charge x2, ultimate at combo x2, damage 0.5 to 0.35).
2. Step 1, words over the fighters: each typist's word floats in a plate over THEIR OWN fighter (intentional, Krishna's choice). Letter tracking in the typist's color, typos flash and shake, combo break cracks the plate, gold ultimate plate. F2 toggles Over-head and Classic (Monkeytype box) view, saved in localStorage.
3. Step 2, counter rule (above).
4. Step 3, stickman color: 10 presets (no reds), Fighter screen (C), bot switches color when too close. Krishna confirmed this works well. Follow-up fixes: red bar under wrong letters (not color only), caret contrast, COMBO BROKEN replaces COMBO xN, two-lane floating text, one net HP number per half second.
5. Step 4, weapons: Hand wraps (light), Bo staff (medium, identical to the original game), Greatsword (heavy, x1.21, +15% per combo, 3 words per level, ultimate at combo x2 = 6 words, mistake charge 10). Bots use the Bo staff. Words: Light = common words of 2 to 5 letters, Greatsword = 176 words of 7 to 12 letters, separate ultimate pools.
6. Step 5, Terminal Arcade theme: palette in CONFIG.theme mirrored as CSS variables (navy, phosphor green, magenta focus, gold only for the ultimate, red for danger), parallax arena (skyline, lab desks and cabinets, grid floor), fighting game HUD with slanted bars and a tug-of-war edge meter, title screen with sparring loop, How to play (H), Fighter screen (C), result screen with WPM chart. Last test: 30 rule checks pass, zero console errors, wins vs EASY, NORMAL, HARD and a loss vs BRUTAL, frame about 0.2 ms.

## 5. Problems found in the latest test (not fixed yet)

- Not full screen: the game is a framed box capped at 1.6x scale. Fills 90% of the window at 1366x768, 65% at 1920x1080, 49% at 2560x1080, 37% at 2560x1440. No fullscreen API.
- Fighters small, top third of the arena empty.
- Esc in a fight quits instantly (no pause, no confirm). No settings screen.
- Weapons invisible on the fighters. No sound. Animation still basic (snapping poses).
- Mouse: only bot cards, title fighter card, swatches and weapon cards are clickable. No Play, Back, Confirm, Rematch, Menu buttons, key chips not clickable, no pause button.
- Difficulty levels are cliffs and BRUTAL is stronger than its label. Win rate for a 96% accurate player (60 matches per cell):
  - EASY (35): 45% at 30 wpm, 100% from 40 wpm.
  - NORMAL (55): 0% at 40, 47% at 50, 95% at 60.
  - HARD (75): 8% at 60, 22% at 70, 53% at 80, 90% at 90.
  - BRUTAL (100): 8% at 80, 32% at 100, 57% at 120.
- Weapons do not match Krishna's intent:
  - Intent: easy weapon = easy words, LESS damage, longer combo to the ultimate; hard weapon = long hard words, more damage, short combo (2 to 3 words) to the ultimate, worth it for good typists.
  - Now: Hand wraps words average 4.0 letters vs 4.2 for Bo staff (practically the same) and same x1.00 damage, so it is just a worse Bo staff. Greatsword needs 6 words, not 2 to 3, and its win rate vs Bo staff FALLS with skill (sim: 56% at 60 wpm 96% down to 19% at 100 wpm 99%). The sim's typing penalties (light +3% speed, heavy -8% speed and -1.5 accuracy points) are guesses and swing results by 35 to 40 points.

## 6. The next prompt (written, not yet run)

Krishna should run this in Claude Code next. Then paste the report back here for a re-test.

```
/everything Big UI and difficulty pass: full screen with a Krunker.io style layout, full mouse support, pause and settings, visible weapons, and difficulty levels and weapons rebuilt to work the way I intended.

CONTEXT
Read CLAUDE.md first; its rules win, except where this prompt changes a rule (I approve those changes below). Plain HTML/CSS/JS, classic script tags, no new libraries, no image files, index.html must work on double click. Keep rules (duel.js, duel-typing.js, words.js) separate from drawing (render.js) and input/HUD (main.js). Keep the Terminal Arcade palette and the color customization exactly as they are (they work). Word plates stay over each typist's own fighter. Sound, new fighter animations and online play are out of scope. Take inspiration from Krunker.io's UI patterns only (layout and interaction), never its art, logo or assets. Work in the parts below, verify each before the next.

PART 1: FULL SCREEN, KRUNKER STYLE LAYOUT
- The arena canvas fills the whole window edge to edge at any size and aspect ratio (16:9, ultrawide, 4:3). No outer frame or box. Keep the canvas sharp (device pixel ratio). The fight is framed closer: fighters about 40 to 45% of the screen height, less empty sky.
- A fullscreen toggle: F key and a button in the top bar, using the browser fullscreen API, with a fallback if it is refused.
- Menus float over the live arena as panels (the sparring loop keeps playing behind them):
  - Title: a left column of big stacked buttons (PLAY, FIGHTER, HOW TO PLAY, SETTINGS), with PLAY the largest and in the accent color. The opponent picker as cards on the right. A top bar with your fighter name, color and weapon, plus small icon buttons for settings and fullscreen.
  - Fighter screen as a loadout screen: your stickman large on one side, holding the selected weapon, color and weapon pickers on the other.
- In fight, the HUD moves to the edges so the center stays clear for the fighters and words: your panel (HP, WPM, power, combo, ultimate) bottom-left, the bot's bottom-right (mirrored), the edge meter and timer top-center, made larger and easier to read. Damage numbers larger and brighter.
- Bold, readable type with a dark outline or shadow so text reads over the scenery. Measure contrast again.

PART 2: MOUSE SUPPORT EVERYWHERE (typing stays keyboard only)
- Every key action shown on screen is also a clickable button with hover and pressed states: PLAY, bot cards, FIGHTER, HOW TO PLAY, SETTINGS, fullscreen, Back, Confirm, Rematch, Change bot, Menu, view toggle, every key chip in the key line.
- Fighter screen: click swatches and weapon cards (as now), plus Confirm and Back buttons.
- A pause button (top corner) during the fight.
- Clicking must never steal typing focus or type a character. Keyboard behavior stays exactly as now.

PART 3: PAUSE AND SETTINGS
- Esc in a fight opens a pause menu instead of quitting: Resume, Restart, Settings, Quit to menu (with a confirm). Pausing freezes the duel clock and the bot (the duel stays deterministic; no rule reads real time). Leaving the browser tab also pauses.
- Settings panel with tabs (Game, Video, Controls): view (Over-head or Classic), reduce motion (turns off shake, flash and hit-stop), screen shake strength, show damage numbers, fullscreen, a keys reference. Saved in localStorage inside try/catch.

PART 4: VISIBLE WEAPONS
- Draw the selected weapon on the stickman (simple canvas shapes, in the fighter's color): hand wraps on the fists, a staff, a greatsword. Shown in fights, on the title sparring loop and in the loadout preview. Visual only.

PART 5: WEAPONS AS I INTENDED (rule change, approved by me)
- Hand wraps (easy): truly easy words, 2 to 4 letters, the most common words with no awkward letter pairs. LESS damage: power about x0.85. Longest road to the ultimate: 5 clean words per combo level, ultimate at combo x3 (15 clean words).
- Bo staff (medium): unchanged.
- Greatsword (hard): long, hard words (as now). MORE damage: power about x1.25. Short combos: 3 clean words per combo level, ultimate at combo x1 (3 clean words). The gold bar still has to be full.
- Use tests/duel-sim.js to tune only the two power multipliers within 0.80 to 0.95 and 1.10 to 1.35 so every equal-skill weapon pair lands within 40 to 60%. Keep the sim's typing assumptions clearly marked as guesses. If the identities above cannot be balanced in those ranges, stop and tell me; do not change the identities.

PART 6: DIFFICULTY LEVELS THAT RAMP SMOOTHLY (approved)
- Calibrate each bot so a player typing at the bot's listed speed with 96% accuracy wins 45 to 55% against it (today BRUTAL needs about 120 wpm for that). Adjust bot speed, accuracy and the bot's mistake recovery in CONFIG, and show the honest "beat it at about N wpm" on each bot card.
- Six levels instead of four, evenly spaced: about 30, 45, 60, 75, 90 and 110 wpm, so there is a close match for every player.
- Give each level a small personality in CONFIG (for example a sloppy fast brawler, a steady combo builder, a boss that uses the Greatsword), so they differ in more than speed.
- Add a MATCH ME bot that targets your average wpm from your last 3 matches (stored locally), starting at 50 wpm.
- Print a calibration table in tests/duel-sim.js (player wpm vs each bot) and show it in the report.

VERIFY
- Screenshots at 1366x768, 1920x1080, 2560x1440 and 2560x1080 of: title, loadout, how to play, settings, pause, countdown, mid fight, ultimate, result. Report how much of the window the arena fills (target 100%).
- Click through every screen with the mouse only (except typing), then with the keyboard only.
- Full play check against every bot with every weapon, ultimate, stun, counter, K.O., rematch, pause, settings, fullscreen, Classic view. Zero console errors. node tests/duel-sim.js passes. sandbox.html loads and looks the same. Frame time stays under 1 ms on average.
- Update CLAUDE.md: layout, screens and buttons, settings, pause, the new weapon and bot rules, and the build order.

REPORT
Short: files changed, the weapon pair table and the bot calibration table with final numbers, screenshots, anything not done, and a one minute hand test. Plain prose, no em dashes.
```

## 7. Decisions on record

- Word plates over each typist's own fighter (not over the enemy).
- Breaking a combo rewards the opponent (counter rule).
- Balance option C; weapon balance option 3 (ship, then test the Greatsword "mistake drops one combo level" idea later behind a CONFIG flag, default off; open question whether that drop gives a counter).
- Theme: Terminal Arcade. Layout: full screen, Krunker.io inspired.
- Color customization: done and approved.
- Order: sound, animation and online play come later.

## 8. Open items after the next prompt

1. Re-test the next prompt's result (same method as above).
2. Krishna plays 2 or 3 matches per weapon vs a mid bot and notes average wpm and accuracy from the result screen; use them to replace TYPING_MODEL guesses in tests/duel-sim.js and retune.
3. Greatsword "mistake drops one combo level" option, test with real numbers.
4. Sound (Web Audio, no files): key clicks, hit thumps, ultimate hit.
5. Animation: pose blending, anticipation and follow-through, smears, impact frames, launch, juggle and slam, reactive camera (techniques from Krishna's two inspiration clips: wide low stances, close range, snappy stepped strikes, forward-leaning runs).
6. Modes: Training, then Story Ladder; later Survival, Daily Seed, Word Packs.
7. Online duel with PeerJS (shared seed and weapon ids, events both ways).
8. Delete js/game.js. Equal-skill fights last 40 to 60 s (consider before online play).
