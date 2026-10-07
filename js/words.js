// Word pools. All lowercase letters (phrases also use a single space).
const LIGHT_WORDS = [
  "hit", "jab", "tap", "fast", "quick", "swift", "snap", "spin", "kick", "push",
  "punch", "fist", "edge", "spark", "pulse", "rush", "dash", "bolt", "flick", "chop",
  "cut", "slap", "poke", "bump", "step", "flow", "beat", "zap", "fury", "rage",
  "wave", "burn", "glow", "iron", "ring", "bold", "calm", "dust", "echo", "flame",
  "grit", "hawk", "jolt", "lock", "move", "nerve", "pace", "rapid", "sting", "tide",
];

const HEAVY_WORDS = [
  "thunder", "crusher", "hammer", "impact", "shatter", "breaker", "crimson", "brutal",
  "rampage", "ironclad", "knuckle", "barrage", "payback", "tempest", "vanquish", "typhoon",
  "wrecking", "fortress", "mayhem", "cyclone", "bulldozer", "avalanche", "stampede",
];

const HEAVY_PHRASES = [
  "right hook", "low sweep", "iron fist", "thunder clap", "quick step", "hard knock",
  "steel wind", "final round", "heavy hand", "bone breaker", "fast fingers", "cold steel",
  "knock out", "full force", "tight guard", "rising storm",
];

const LAUNCHER_WORDS = [
  "rise", "lift", "soar", "skyward", "uplift", "rocket", "ascend", "hoist", "boost",
  "float", "launch", "elevate", "lofty", "sky high",
];

// Hard words for the special. Awkward letter patterns.
const HARD_WORDS = [
  "rhythm", "sphinx", "bureaucracy", "pneumonia", "quizzical", "accommodate", "mischievous",
  "committee", "questionnaire", "necessary", "colonel", "silhouette", "parallel", "exaggerate",
  "squirrel", "pharaoh", "hierarchy", "conscience", "occurrence", "lieutenant", "psychology",
  "phenomenon", "rhinoceros", "unnecessary", "pronunciation", "chrysanthemum", "idiosyncrasy",
  "maintenance", "miscellaneous", "entrepreneur", "sovereignty", "acquaintance", "camouflage",
];

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Random entry of `list` that is not `avoid`.
function pickFrom(list, avoid) {
  const options = list.filter((w) => w !== avoid);
  return options[Math.floor(Math.random() * options.length)];
}

// Common English words for the endless Monkeytype style stream.
const COMMON_WORDS = (
  "the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us " +
  "great small large young old long little own right big high different next early important few public bad same able leave begin seem help show hear play run move live believe hold bring happen write provide sit stand lose pay meet include continue set learn change lead understand watch follow stop create speak read allow add spend grow open walk win offer remember love consider appear buy wait serve die send expect build stay fall cut reach kill remain " +
  "world life hand part child eye woman place week case point number group problem fact water room mother area money story month book word business issue side kind head house service friend father power hour game line end member law car city name team minute idea body face level office door health person art war history party result morning reason research girl guy moment air teacher force education foot boy age policy music market sense nation plan college interest death course " +
  "quick brave sharp heavy swift round strong clean focus speed block guard dodge punch strike fight steel storm flame stone river light dream bridge thunder"
).split(" ");

// Small seeded random generator so both players can get the same text.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Endless stream of random words, never the same word twice in a row.
// `pool` and `hardPool` default to the common words and HARD_WORDS (the Medium weapon, the original game).
class WordSource {
  constructor(seed, pool, hardPool) {
    this.rand = mulberry32(seed);
    this.pool = pool || COMMON_WORDS;
    this.hardPool = hardPool || HARD_WORDS;
    this.last = null;
  }
  next() {
    let w;
    do { w = this.pool[Math.floor(this.rand() * this.pool.length)]; } while (w === this.last);
    this.last = w;
    return w;
  }
  // A hard word for the ultimate, from the same seeded generator.
  hardWord() {
    return this.hardPool[Math.floor(this.rand() * this.hardPool.length)];
  }
}

// ---------- Weapon word pools ----------
// Light (hand wraps): truly easy words. The common words (most common first) that are 2 to 4 letters long,
// with no rare letters (q, x, z, j) and no awkward letter pairs: two different keys typed by the same finger
// in a row on a QWERTY keyboard (like "ed", "my", "ki"), which is what slows touch typists down.
const FINGERS = ["qaz", "wsx", "edc", "rfvtgb", "yhnujm", "ik", "ol", "p"]; // left pinky ... right pinky
const FINGER_OF = {};
FINGERS.forEach((keys, f) => { for (const c of keys) FINGER_OF[c] = f; });
function easyWord(w) {
  if (w.length < 2 || w.length > 4 || /[qxzj]/.test(w)) return false;
  for (let i = 1; i < w.length; i++) if (w[i] !== w[i - 1] && FINGER_OF[w[i]] === FINGER_OF[w[i - 1]]) return false;
  return true;
}
const LIGHT_POOL = COMMON_WORDS.filter(easyWord);

// Heavy (greatsword): long words with awkward letter patterns, 7 to 12 letters.
const GREATSWORD_WORDS = (
  "knowledge rhythmic symphony xylophone labyrinth physical physician psychic syllable synonym mystery " +
  "hypnosis hygiene dynasty tyranny cylinder gymnastic crystal lyrical pyramid sympathy symptom cryptic " +
  "quarrel quantity quality question quietly squeeze squabble squander squadron aquarium acquire acquaint " +
  "equation equipment frequency requisite technique antique mosquito conquer earthquake liquidity " +
  "picturesque grotesque boutique quizzes bouquet croquet anxiety anxious exhaust exhibit exquisite excerpt " +
  "executive exercise existence oxidize complexity toxicity paradox fixture mixture textile vexation " +
  "saxophone juxtapose zealous bizarre blizzard buzzword dazzling puzzling sizzling wizardry zucchini " +
  "zigzagging horizon photograph phosphorus pharmacy telephone catastrophe triumph emphasis alphabet amphibian " +
  "sophomore graphite laughter thorough through drought daughter naughty neighbor weighty borough straight " +
  "thoughtful breakthrough playwright freight knuckle wrinkle wrestle wreckage pseudonym pneumatic gnarled " +
  "mnemonic rhubarb rhapsody rhetoric sequoia beautiful gorgeous courteous outrageous nauseous conscious " +
  "delicious ingenious ambiguous strenuous continuum ukulele occasion occurred embarrass millennium " +
  "possession assessment address aggressive balloon broccoli cappuccino raccoon succeed dilemma " +
  "fluorescent guarantee guerrilla jewelry leisure foreign receive deceive believe science ancient license " +
  "villain mischief schedule orchestra chemistry character choreograph chlorine architect mechanic " +
  "technical archive stomach awkward awkwardly jukebox plateau apostrophe asthmatic yachting"
).split(" ");

// Ultimate words per weapon. Medium keeps HARD_WORDS.
// Light: medium difficulty, 6 to 8 letters.
const LIGHT_ULT_WORDS = [
  "journey", "whistle", "rhythm", "sphinx", "colonel", "pharaoh", "parallel", "squirrel", "biscuit", "cushion",
  "dolphin", "glimpse", "harvest", "jealous", "kitchen", "lantern", "mystery", "nervous", "orchard", "penguin",
  "quarter", "rescue", "shuffle", "thunder", "unknown", "volcano", "weather", "zigzag", "buzzing", "climbing",
  "fiction", "gravity", "hurdle", "juggle", "knight", "plywood", "quiver", "scratch", "twelfth", "wrapped",
];
// Heavy: the hardest words, 11 letters or more.
const GREATSWORD_ULT_WORDS = HARD_WORDS.filter((w) => w.length >= 11).concat([
  "conscientious", "onomatopoeia", "surveillance", "parliamentary", "liquefaction", "connoisseur",
  "rhododendron", "psychiatrist", "acknowledgment", "embarrassment", "perseverance", "reconnaissance",
  "quintessential", "extraordinary", "particularly", "inconceivable", "cryptography", "hypothetical",
]);

// Pool names used by CONFIG.weapons (config.js loads before this file, so it can only name them).
const WORD_POOLS = { light: LIGHT_POOL, common: COMMON_WORDS, heavy: GREATSWORD_WORDS };
const ULT_POOLS = { light: LIGHT_ULT_WORDS, hard: HARD_WORDS, hardest: GREATSWORD_ULT_WORDS };
