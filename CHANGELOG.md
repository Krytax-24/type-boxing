# Changelog

## 2.0.0 (October 2026): release v2

The October 2026 game, rebuilt for clean code, isolated components and plug-and-play modules. Rules, balance, numbers, screens and saved data are unchanged: the seeded test output of every suite is byte for byte the same as before, and new replay checks lock that in.

### Structure

- One global (`CounterType`) instead of about 270 shared globals. Every file is one module with an explicit dependency list (`CounterType.define(id, deps, factory)`); the kernel starts modules in dependency order, skips only what depends on a missing or broken module, detects cycles, and supports optional dependencies and `?disable=` switches.
- Layers with one-way dependencies: kernel, core, engine, services, UI kit, shell, pages, then the plug-ins (Duel, Race, Arm Wrestling, Backspace Brawl, online play), which never depend on each other.
- The shell that used to live in 10 files sharing about 75 global variables is now separate modules: router, modals, actions, session, layout, arena, looks, keyboard, loop, backdrop, top bar, theme tokens, sound and the online gateway, plus one module per page.
- The Duel is a plug-in like the other modes (`src/modes/duel/`): session, HUD, input, menu, bots, practice, result page, stream view and its online part.
- Extension points in a registry (modes, How to play sections, Keys rows, settings tabs, profile tiles and history, fighter cards and notes, clip timing), so no shell file names a mode.
- One stylesheet per component, next to its module; screens and modals use `.is-active`, and each mode styles its own HUD under `#ui[data-mode="..."]` instead of a central list.
- `index.html` keeps only the layers the parts mount into; each plug-in is one removable block holding its stylesheet and scripts.
- Clear names: module id = file name, plug-in files start with their family (`race-rules.js`, `brawl-hud.js`, `net-peer.js`), pages end in `-page` or `-modal`, plug-in actions are `<family>-<verb>`, events are `<area>:<what>`.

### Code quality

- Prettier formatting (120 columns) and ESLint rules that enforce isolation (`no-undef`, `no-implicit-globals`, confusing browser globals banned).
- Split the largest functions into named steps, each verified frame for frame against the original: the Brawl fighter control (complexity 110), the Brawl bot (54) and move table (49), the fighters' movement controller (148), the Duel's snapshot apply (39), the online protocol check (64, now a table of checks) and the theme builder (34).
- Removed dead code: 19 stale duplicate scripts and 2 stylesheets that were never loaded (about 8,000 lines), the Animation Lab leftovers in the rig (the generic fighter drawing, its cloth helpers and constants, about 360 lines), the stickman fallback in the renderer, unused fighter fields and an unused mode hook.
- Comments rewritten where they had drifted: old file names, the default power basis, the counter bonus, the rig's description.
- Every comment fits 120 columns (only long strings and HTML templates run past it, as Prettier leaves strings whole); no em or en dashes anywhere.

### Fixes

- **Security:** an opponent's name was put into the online room screen as HTML. Names from other players are now always escaped.
- **Creator screen:** it showed the Fighter screen's PREVIOUS, NEXT and ROW key chips, which acted on the hidden Fighter screen. Each screen now sets its own key line.
- **Tests:** the bot speed check failed about once in 40 runs (one random 600 s run per bot). It now averages three seeded runs and gives the same answer every time.
- **How to play:** the Race line reads "your speed drives your vehicle" so it still makes sense when the Duel is not part of the build.

### Tests and tools

- New suites `kernel-sim.js` (module system, events, registry) and `motion-sim.js` (the fighters' controller); `structure-sim.js` rewritten for the module system (files, names, graph, layers, plug-in isolation, `?disable` safety, `index.html` blocks, cache tags, text rules).
- Replay checks in the Duel, Race, Arm Wrestling, Brawl and motion suites: whole matches from fixed seeds must hash to the values recorded from the shipped rules.
- `tests/run-all.js` runs every suite (`--quick` skips the balance tables).
- `tools/health-check.js`: inventory, tests, lint, format, and a browser matrix (every plug-in switched off and deleted, every screen and mode played).
- `tools/serve.js` (local http for online rooms), `tools/build.js` (production copy, `--without` to leave plug-ins out), `tools/bump-version.js` (new cache tags for a delivery), `tools/make-vehicle-art.py` (now writes the v2 module).
- Documentation: `README.md`, `ARCHITECTURE.md`, `HEALTH-REPORT.md`, this changelog.
