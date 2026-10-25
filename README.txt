# CounterType

A typing game for desktop browsers where your keyboard is your weapon. Type faster and cleaner than your opponent to land hits, win races and pin arms to the table.

This branch holds the **production build**: one page, one minified script and one stylesheet, ready to host or to play by double click. The source code is kept separately.

---

## Play

- **In the browser:** open the hosted page (GitHub Pages: `https://krytax-24.github.io/type-boxing/` once Pages is switched on for this branch).
- **On your computer:** download this branch as a ZIP (Code > Download ZIP), unzip it, and double click `index.html`. Chrome, Edge and Firefox all work.

No install, no account and no sign in. Your settings, stats and profile are saved in your browser.

---

## Game modes

| Mode | What it is |
|---|---|
| **Duel** | A 1v1 typing fight. Two fighters face off above a stream of words; your typing speed is both your attack and your guard. Clean words build a combo, a big combo unlocks a gold ultimate word. Play against bots, in Endless, in Practice, in ranked, or in a private online room. |
| **Race** | 2 to 6 racers type the same passage. Your car or bike sits exactly as far along the track as you have typed. It types like Monkeytype: a wrong letter shows red, and Space on a wrong word skips it for a small time penalty. Places go by finish time plus penalties. |
| **Arm Wrestling** | Accuracy beats raw speed. Power is 70% accuracy and 30% speed, and accuracy only counts in full while you keep up with your opponent. Pin their hand, or be past the middle when the clock runs out. |
| **Backspace Brawl** | A fighting mode with no typing at all: punches, kicks, specials and finisher strings, against a bot or a friend online. The only mode that plays on phones. |

Also included: a **ranked preview** (tiers from Bronze to Grandmaster, placements and seasons; opponents are simulated for now), a **profile** with a Name#1234 tag, **leaderboards**, a stats page with your speed history, ten unlockable vehicles, and color themes.

---

## Controls

| Where | Keys |
|---|---|
| Home | **Enter** Duel, **R** Race, **A** Arm Wrestling, **B** Backspace Brawl, **P** Profile, **L** Leaderboards, **H** How to play, **S** Settings, **F** Fullscreen |
| Typing | Letters type, **Space** ends a word, **Backspace** fixes a letter, **Ctrl+Backspace** clears the whole word |
| Race and Arm Wrestling | **Tab** starts a new race or match (practice only) |
| Any fight | **Esc** pauses; leaving the tab pauses too |
| Backspace Brawl | Arrow keys move, **A S Z X** attack, **Q** projectile, **R** rising move, **Q + R** super (a left-hand layout is in Settings) |

Every button also works with the mouse. Clicking never steals your typing.

---

## Online play

1. Open the game from a web address (http or https). Online play does not work from a file opened by double click.
2. One player picks **Duel**, then **Online room**, then **Create room**, and shares the room code or the invite link.
3. The other player joins with the code, both press **Ready**, and the host's match rules apply.

Rooms are private and peer to peer. This build connects players directly (STUN); it does not include a relay server, so a few strict networks (some offices, schools and mobile carriers) may not be able to connect.

---

## What is in this branch

```
index.html                      the game
css/countertype.<hash>.css      every stylesheet, joined and minified
js/countertype.<hash>.js        every script, joined and minified
js/vendor/peerjs.min.js         PeerJS, for online rooms (MIT license, see peerjs.LICENSE.txt)
README.txt                      when and how this build was made
```

The file names carry a content hash, so browsers always load the newest build after an update. To publish, upload these files as they are to any static host (GitHub Pages, Cloudflare Pages, Netlify).

---

## Credits

- Made by Krishna (Krytax) as a portfolio project.
- Typing feel inspired by Monkeytype. The idea of a typing beat 'em up was inspired by "Keyboard Warrior Stickman"; no art, characters, names or music were copied from it.
- The fighters, the arena and the arm wrestlers are original, drawn in code.
- The race car and bike pictures are illustrations collected by the author for this prototype; their artists keep the rights.
- Online rooms use [PeerJS](https://peerjs.com) (MIT).
