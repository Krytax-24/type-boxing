/everything Run a full audit-and-improve cycle on the current version of Type Boxing (code and game). Work in the five phases below, in order. Do not skip ahead, and do not edit any file until Phase 3.

CONTEXT
Read CLAUDE.md first. Its rules win. The game is a real-time typing duel against a bot (index.html), plain HTML/CSS/JS, no build step, no ES modules, no new libraries. Multiplayer (PeerJS) comes later, so rules must stay separate from rendering, keyboard and networking. Do not change game rules or balance numbers in js/config.js unless a gap in Phase 1 proves they are wrong, and if so, list them for my approval instead of changing them silently.

PHASE 1: ANALYZE EVERYTHING (read only, no edits)
Before writing any conclusion, inspect all of the following:
1. Code: every file in js/ and css/, plus index.html. Check architecture against CLAUDE.md, dead code (js/game.js stub, unused sandbox files), duplicated logic, naming, comments, error handling, performance in the render loop, and anything that would block multiplayer later (hidden clock or keyboard reads inside rules, non-deterministic randomness, state the renderer mutates).
2. Game running: use webapp-testing to open index.html by file URL, play a full match against each of the four bots (EASY, NORMAL, HARD, BRUTAL), trigger an ultimate, a stun, a KO, a rematch, and the menu. Take screenshots at menu, countdown, mid-fight, ultimate, and result screen. Read the console for errors and warnings. Read duel state with page.evaluate (duel, CONFIG, renderer).
3. Look and layout: HUD, typing box, menu, result overlay, readability, contrast, scaling at 1280x720, 1920x1080 and a small laptop window, empty and edge states.
4. Feel: hit feedback, knockback, shake, hit-stop, combo and ultimate effects, sound absence, responsiveness of the caret and keystrokes.
5. Balance: measure real values from bot matches (match length, average wpm, damage per second, how often ultimates fire, whether each difficulty is beatable and distinct). Use measured numbers, not guesses.
6. Fairness and clarity: can a new player understand wpm, power, block, combo and ultimate within 30 seconds?
Use the relevant specialist skills for their part (game-ux-review, feel-pass, balance-review, frontend-design guidance, impeccable if installed). Use only the ones that apply.

PHASE 2: GAP REPORT AND FIX PLAN (still no edits)
Produce one table of gaps with these columns: ID, area (code, UI, feel, balance, clarity, tests, multiplayer-readiness), what is wrong, evidence (file and line, screenshot, or measured number), severity (blocker, high, medium, low), proposed fix, effort (S, M, L), risk. Order by severity, then by value per effort. End with a proposed fix batch: which gaps you will fix now, which you will leave and why, and which need my approval because they change rules or balance. Keep it concise. Then continue unless a gap needs my decision, in which case stop and ask one question.

PHASE 3: FIX
Fix the approved batch in small steps, highest severity first. For each fix: make the smallest change that closes the gap, keep rules separate from rendering and input, keep index.html working on double click, and keep code simple and readable. Do not refactor unrelated code. Update CLAUDE.md if structure or rules change.

PHASE 4: VERIFY
Re-run the same checks as Phase 1 item 2 (full matches vs all four bots, ultimate, stun, KO, rematch, menu) and take the same screenshots. Confirm: zero console errors, every gap marked fixed is actually fixed with new evidence (before vs after screenshot or number), nothing that worked before is broken, sandbox.html still loads, and index.html works from file://. If any fix fails verification, fix it again before moving on.

PHASE 5: RE-ANALYZE AND FINAL REPORT
Run a second, fresh analysis of the whole game and code as if seeing it for the first time, looking especially for regressions and for new gaps the fixes exposed. Then give the final output:
1. Scorecard: before vs after for code quality, look, feel, balance, clarity (1 to 10 each, with one line of evidence each).
2. What was fixed (by gap ID), what remains open, and why.
3. Anything I must decide (rules or balance changes).
4. How to test it by hand in the browser in under two minutes.
5. The single best next step, with a reason.
If the re-analysis finds new high or blocker gaps, loop back to Phase 2 once, then report.

RULES FOR THE WHOLE RUN
Be evidence based: no claim without a file, screenshot or measured number. Do not install third-party tools yourself; tell me the command instead. Write plain prose, no em dashes. Keep the final report short and skimmable.
