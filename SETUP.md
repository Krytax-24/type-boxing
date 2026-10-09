# Setting up Type Boxing in Claude Code (Windows)

## 1. Install the tools

1. Install Node.js (LTS) from nodejs.org. Check with `node -v`.
2. Install Git for Windows from git-scm.com.
3. Install Claude Code. Follow the current install steps at docs.claude.com (search "Claude Code quickstart"), then check with `claude --version`.
4. Log in with your Claude Pro account the first time you run `claude`.

## 2. Start the project

Open PowerShell and run:

```
cd "C:\Users\krish\Downloads\Type Boxing"
git init
claude
```

`CLAUDE.md` in this folder is read automatically, so Claude Code already knows the full game design.

## 3. First prompt to paste

```
Read CLAUDE.md. Build Phase 1: a single player prototype in plain HTML, CSS and JS
using the suggested file structure. Show a word, let me type it, deal damage to a
dummy opponent based on speed, track a no-backspace combo multiplier, show health
bars and a simple stick figure punch animation. Keep balance numbers in js/config.js.
Tell me how to test it.
```

Then open `index.html` in your browser and iterate: "make the combo feel bigger", "add a second character", and so on.

## 4. Habits that help

- Commit after each working step: ask Claude Code to "commit this".
- Use Plan Mode (Shift+Tab) before big changes such as multiplayer.
- If it drifts, say "re-read CLAUDE.md".
- Start a fresh session per phase.

## 5. Phase 2 prompt (when Phase 1 works)

```
Add multiplayer using PeerJS. One player creates a room and gets a short code,
the other enters it to join. Sync health, current word, and typing progress.
Add a character select screen before the match. Keep game logic separate from
networking in js/net.js. Plan first, then build.
```

To test, open two browser tabs (or two browsers) and join one from the other.
