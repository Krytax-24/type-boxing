---
name: everything
description: Master orchestrator for the Type Boxing game. Use when the user types /everything or gives any request about the game that could involve more than one specialist (polish, beautify, make it feel better, HUD or menu design, balance numbers, testing, playtesting, review, bug hunt, next steps). It reads the request, checks which skills are installed, picks the relevant ones, runs them in a sensible order with project specific adjustments, verifies the result, and reports.
---

# everything: the Type Boxing orchestrator

You are the router and project lead for Type Boxing. The user gives one request. You decide which installed skills help, run them in the right order, adapt them to this project, verify the result, and report briefly. You do not duplicate what the specialist skills already know: invoke them (use the Skill tool, or the slash command where one exists) and follow their instructions.

## Step 0: Ground yourself (always, quickly)

1. Read `CLAUDE.md` in the project root. It holds the rules, the architecture and the build order. Its rules win over any skill's advice.
2. List `.claude/skills` and `.claude/commands` to see what is actually installed. If a skill named below is missing, say so in one line, apply its main idea yourself, and carry on.
3. Know the layout: `index.html` is the Duel (main game), `sandbox.html` is the old combo sandbox. Rules live in `js/duel.js` and `js/duel-typing.js`, drawing in `js/render.js`, keyboard, HUD and menus in `js/main.js`, all numbers in `js/config.js`, styles in `css/duel.css`.

## Step 1: Classify the request

A request can match several rows. Pick every row that applies, then order them with the recipes in Step 3.

| The user wants... | Use | Notes |
|---|---|---|
| Better look of the menu, HUD, typing box, colors, fonts, spacing | `frontend-design` | DOM and CSS only. Keep the plain, clean, dark look unless the user asks for a new style. Stickmen stay simple canvas drawings. |
| HUD or menu layout, scaling, readability, accessibility, pause or result screens | `game-ui-ux` to build, `game-ux-review` to evaluate | Evaluate first when the user says it "looks bad" without saying why. |
| Hits that feel weak, juice, shake, hit-stop, easing, knockback, ultimate effects, animation polish | `game-feel` to build | If the user says "something feels off" and does not know what, run `feel-pass` first to diagnose. |
| Why a mechanic feels flat or dead, responsiveness, feedback gaps | `feel-pass` | Needs a playable build: use `webapp-testing` to capture screenshots and state. |
| Damage, regen, combo, ultimate charge, bot difficulty, pacing of a fight | `balance-review` | Use only the combat, difficulty-curve and progression ideas. Skip economy, currency, gacha and monetization sections. |
| Verify something works, reproduce a bug, take screenshots, check the console | `webapp-testing` | See the testing notes below. |
| A plan for testing with real people, metrics, questions to ask | `playtest` | Output is a protocol, not code. |
| Review of code or of a pull request | `/code-review` | Works only on GitHub pull requests (needs `gh`). For local changes, review the diff yourself against `CLAUDE.md`. |
| Design audit, critique, typography, color, motion, empty states | `impeccable` if `.claude/skills/impeccable` exists | Not installed by default. If missing, tell the user to run `npx impeccable skills install` and use `frontend-design` meanwhile. |
| Multiplayer, networking, hosting, leaderboards | No specialist installed | Follow `CLAUDE.md` (PeerJS, peer to peer). Plan first, then build in small steps. |
| "What next?" | No skill | Read the build order in `CLAUDE.md`, check what is done, recommend one next step with a reason. |
| Anything else about the game | No skill | Do it directly, following `CLAUDE.md`. |

## Step 2: Announce the route in three lines or fewer

Say which skills you will use, in what order, and why. Then start. Do not ask permission for the routing. Ask a question only if the request is truly ambiguous and the answer changes the work. Ask at most one.

## Step 3: Recipes for common multi-skill requests

- **Polish everything / beautify:** `game-ux-review` on the HUD and menu (findings only), `frontend-design` for the DOM look, `game-ui-ux` for layout fixes, `game-feel` for fight feedback, `webapp-testing` to screenshot and check, `feel-pass` as a final check.
- **Make fights feel better:** `feel-pass` (diagnose), `game-feel` (implement), `webapp-testing` (verify nothing broke and effects fire), `balance-review` only if timing changes affect pacing.
- **Tune the numbers:** `balance-review` with measured data. Use `webapp-testing` to run a bot match and read `duel.typists` state so advice is based on real values, not guesses. Change only `js/config.js` unless a rule is wrong.
- **Is it ready to show people:** `webapp-testing` smoke test, `game-ux-review`, `feel-pass`, then `playtest` for the plan.
- **Bug hunt:** `webapp-testing` to reproduce, fix, re-run the same check.
- **New feature:** plan briefly (ask the user to approve if it changes a rule), implement in small steps, `webapp-testing` to verify, update `CLAUDE.md` if rules or structure changed.

## Step 4: Project specific adjustments (read before running a specialist)

These come from checking each skill against this codebase.

- **`game-feel` and `game-ui-ux` show Godot and Unity examples.** Treat them as engine neutral advice and translate to plain JavaScript:
  - screen shake: the renderer already offsets the canvas by `shake` (see `render.js`); feed it a trauma value that decays
  - hit-stop: pause rule updates for a few frames while visual effects keep aging; never stall the keyboard or the bot's timers
  - easing and squash: tween fighter offsets and HUD elements with `requestAnimationFrame` and easing functions in plain JS
  - HUD updates: keep them event driven where practical; the HUD is DOM, the arena is canvas
  Ignore their "related skills" lists (camera-systems, audio-design, godot-animation and similar). Those are not installed.
- **The four gstack skills (`feel-pass`, `balance-review`, `playtest`, `game-ux-review`) are long, interactive workflows.** They run a setup script that writes small local logs under `~/.gstack` and they ask the user questions. To keep it smooth:
  - give them a game brief up front (use the block below) so they ask less
  - ignore their "Next Step" suggestions that point to skills that are not installed (game-review, player-experience, prototype-slice-plan, implementation-handoff and others), and give the user the next step from this orchestrator instead
  - skip shop, monetization, gacha and economy sections; Type Boxing has none
  - they are scoring and review tools: they find problems, they do not edit the game; you make the edits afterward
- **`webapp-testing` uses Python Playwright.** The game is static HTML, so open it with a file URL, for example `Path("index.html").resolve().as_uri()`; no server is needed. Press a digit to pick the bot and Enter to start, wait for the countdown, then drive the game by sending keys. Read state with `page.evaluate`: the globals `duel`, `CONFIG` and `renderer` exist on the page. Save screenshots and look at them. If Python or Playwright is missing, tell the user the one command to install it (`pip install playwright` then `playwright install chromium`) instead of guessing.
- **`frontend-design`** is general web guidance. Apply it to the HUD, menu, result screen and typing box. Keep text readable and the typing box calm, since players stare at it.

## Game brief (hand this to any skill that asks about the game)

Type Boxing is a real time 1v1 typing fighting game for desktop browsers. Two typists type an endless Monkeytype style word stream under a fighting arena with stick figure fighters. Typing speed is both attack and guard: damage per second is damageScale times the difference in power (power is wpm times one plus ten percent per combo level), blocked damage heals both players up to 100 HP, five clean words make a combo level, and a charged ultimate (combo level 3 plus a full meter) is a hard word that deals unblockable damage and stuns. Today the opponent is a bot with four speeds; real multiplayer comes later. Single player, no economy, no monetization. Plain HTML, CSS and JavaScript with no build step. Audience: the creator and friends, as a portfolio piece.

## Step 5: Verify and report

Before you say you are done:

1. Run a real check with `webapp-testing` (start a match, type, confirm no console errors, take a screenshot and look at it). For pure planning or review requests, skip this.
2. Make sure `index.html` still works when double clicked (no ES modules, no new libraries) and that rules were not mixed into drawing code.
3. If you changed structure or rules, update `CLAUDE.md`.
4. Report in a few sentences: what ran, what changed, how to test it by hand, and one recommended next step. Write in plain prose and avoid em dashes.

## Guardrails

- Never install or run third party installers on the user's behalf. Tell them the command instead.
- Do not add libraries without asking, except PeerJS for multiplayer.
- Do not change game rules or balance numbers unless the request asks for it.
- Prefer the smallest set of skills that does the job. Do not run every skill just because it is installed.
- If two skills disagree, `CLAUDE.md` wins, then the user's latest instruction, then the specialist skill.
