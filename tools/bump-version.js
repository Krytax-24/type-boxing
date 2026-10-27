// Gives every file in index.html a new cache tag (?v=YYYYMMDDx), so browsers load the new files after a delivery
// instead of keeping old copies. The letter counts up when the date is already today's: 20261028a, 20261028b, ...
//
//   node tools/bump-version.js            (the same as: npm run bump)
//
// The vendor file (PeerJS) has no tag: it only changes with a new PeerJS version.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(FILE, "utf8");

const now = new Date();
const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("");
const current = (html.match(/\?v=(\d{8})([a-z])/) || []).slice(1);
const letter = current[0] === today ? String.fromCharCode(current[1].charCodeAt(0) + 1) : "a";
if (letter > "z") {
  console.error("26 deliveries today already: wait for tomorrow or edit the tag by hand.");
  process.exit(1);
}
const tag = today + letter;
let count = 0;
const next = html.replace(/\?v=\d{8}[a-z]/g, () => {
  count++;
  return "?v=" + tag;
});
fs.writeFileSync(FILE, next);
console.log(
  `index.html: ${count} files now load with ?v=${tag}${current.length ? ` (was ?v=${current.join("")})` : ""}`,
);
