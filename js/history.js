// Match history, saved in the browser's localStorage (the "cache" for now).
// Plain data only: no DOM, no rules, no clock reads inside the duel. main.js calls MatchHistory.add() when a
// match finishes. Every storage call is inside try/catch, so a blocked or full storage never breaks the game.
// Separate from MATCH ME's key (CONFIG.duel.matchMe.storageKey), which only keeps average wpm numbers.
// Online later: the same record shape can be sent to a server instead.
const MatchHistory = (() => {
  const KEY = "typeboxing.matches";
  const MAX = 50;          // keep the newest 50 matches
  const VERSION = 1;       // bump if the record shape changes

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && raw.v === VERSION && Array.isArray(raw.matches)) return raw.matches;
    } catch (e) { /* blocked or corrupt: start empty */ }
    return [];
  }

  function write(matches) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, matches })); return true; }
    catch (e) { return false; } // storage full or blocked: the game still works
  }

  // rec: { won, seconds, bot, botBeatAt, you: {...}, foe: {...} }. Adds the date and an id.
  function add(rec) {
    const matches = read();
    const date = new Date().toISOString();
    matches.push(Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date, at: date }, rec));
    while (matches.length > MAX) matches.shift();
    return write(matches);
  }

  const all = () => read().slice().reverse();          // newest first
  const last = (n) => all().slice(0, n);
  const clear = () => { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };

  // Totals for a stats screen: record, win rate, best and average wpm, best combo, accuracy.
  function stats() {
    const m = read();
    if (!m.length) return { played: 0, wins: 0, losses: 0, winRate: 0, avgWpm: 0, bestWpm: 0, avgAccuracy: 0, bestCombo: 0, ultimates: 0 };
    const wins = m.filter((x) => x.won).length;
    const sum = (f) => m.reduce((a, x) => a + (f(x) || 0), 0);
    return {
      played: m.length, wins, losses: m.length - wins, winRate: Math.round((100 * wins) / m.length),
      avgWpm: Math.round(sum((x) => x.you.wpm) / m.length),
      bestWpm: Math.max(...m.map((x) => x.you.wpm || 0)),
      avgAccuracy: Math.round(sum((x) => x.you.accuracy) / m.length),
      bestCombo: Math.max(...m.map((x) => x.you.bestCombo || 0)),
      ultimates: sum((x) => x.you.ultimates),
    };
  }

  return { add, all, last, clear, stats, KEY, MAX };
})();
