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
  "acquiesce", "bourgeois", "cemetery", "chauffeur", "conscientious", "convenience", "definitely", "discipline",
  "embarrass", "environment", "especially", "fluorescent", "foreign", "government", "guarantee", "harass",
  "independent", "jewelry", "knowledge", "leisure", "license", "millennium", "mnemonic", "noticeable",
  "ophthalmology", "perseverance", "playwright", "privilege", "quarantine", "reconnaissance", "rendezvous",
  "restaurant", "schedule", "separate", "supersede", "surveillance", "threshold", "tournament", "twelfth",
  "vacuum", "weird", "worcestershire", "yacht", "zucchini", "xylophone", "labyrinth", "mayonnaise",
  "onomatopoeia", "pterodactyl", "rhubarb", "sarcophagus", "temperature", "vengeance", "wednesday",
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
  "quick brave sharp heavy swift round strong clean focus speed block guard dodge punch strike fight steel storm flame stone river light dream bridge thunder " +
  // A much longer list, so a match does not keep showing the same words (about 1100 different words in all).
  "above across action active actor adult advice affect agree ahead alarm album alive almost alone along already always amount ancient anger angle animal answer anyone apart apple argue armor arrive arrow aside asleep attack attend aunt autumn avoid awake award aware baby balance ball band bank barn base basic basket battle beach bear beauty bed before behind belong below bench beside better beyond bike bird birth bit black blame blank blind blood blow blue board boat bone bonus boot border borrow boss bottle bottom bowl brain branch brave bread break breath brick brief bright broad broken brother brown brush bubble bucket budget bunch burn bus butter button cabin cable cake calm camera camp canal candle candy canvas captain card care carry cart castle catch cause cave ceiling cell center chain chair chalk chance charge chart chase cheap check cheek cheese chest chief choice choose circle claim class clear clever click cliff climb clock close cloth cloud coach coast coat coffee coin cold collect color comfort common copper corner cost cotton couch count country couple cover craft crash crazy cream crew crowd crown cruel crush cry cup curtain curve cycle daily damage dance danger dark date dawn dead deal dear debate decide deep deer delay deliver desert design desk detail dial diary dinner direct dirty disk distance doctor dog doll dollar double doubt down dozen draft drag drama draw dress drift drink drive drop drum dry duck dust duty eager eagle earn earth east easy edge effort eight either elbow elder electric elephant else empty enemy energy engine enjoy enough enter entire equal escape evening event every exact example excuse exit extra fabric fair faith fake family famous fancy farm fashion fast fate fear feather feed feel fence fever field fifty fill film final find fine finger finish fire firm fish fit five fix flag flat flight floor flour flower fly fog fold folk food fool forest forget fork form forth fortune forward frame free fresh fried front frost fruit full fun funny future gain galaxy garage garden gas gate gather gear gentle giant gift glad glass glove goal goat gold golf grace grade grain grand grape grass gray green greet grid grip ground guess guest guide guitar habit hair half hall hammer handle happy harbor hard harm hat hate hawk heart heat heaven heel height hello helmet hero hide hill hint hobby hockey hole holiday home honest honey hood hook hope horn horse host hot hotel hundred hungry hunt hurry hurt husband ice icon image inch inside insect iron island item ivory jacket jar jelly jewel job join joke journey joy judge juice jump jungle junior just keen keep kettle key kick kind king kiss kite knee knife knock knot label ladder lady lake lamp land lane lap laser last late laugh lawn layer lazy leaf leather lecture left leg lemon lend lens lesson letter level library lid lift limit link lion lip liquid list listen local lock log lonely loop loose lord loud lovely lower luck lunch machine magic magnet maid mail major mango many map marble march mark marry mask master match material matter maybe meal mean meat medal medium melon melt memory mental menu merry metal method middle might mile milk mill mind mine mirror miss mist mix model modern moist monkey moon moral motor mount mountain mouse mouth movie mud muscle music mystery nail narrow nature navy near neat neck needle neither nest net never news nice night noble noise noon north nose note novel nurse nut oak ocean offer often oil olive once onion only opera orange order organ other otter outer oven owl owner oxygen pace pack page pain paint pair palace palm panel paper parade parent park parrot party pass past paste path patience pattern pause peace peach pearl pen pencil penny pepper perfect period phone photo piano pick picnic picture piece pig pile pill pilot pine pink pipe pitch pizza plain planet plant plastic plate platform plenty plot plug plus pocket poem poet polar pole police polite pond pony pool poor popular port pose post pot potato pound powder praise pray prepare present press pretty price pride prince print prison prize proof proud pull pump pupil puppy purple purse puzzle queen quiet quilt quote rabbit race radio rail rain raise range rare rate raven reach ready real reason record red reed reflect region relax remind repair repeat reply report rescue rest rhyme rice rich ride ridge rifle ring rise risk road roar robin robot rock rocket roll roof root rope rose rough route royal rubber rude rug rule rush rust sad saddle safe sail salad salt sand satin sauce save scale scarf scene school science score scout screen screw sea seat second secret seed seek select sell senior serious shade shadow shake shape share shark sheep sheet shelf shell shield shift shine ship shirt shock shoe shoot shop shore short shoulder shout shower shut sick sign silent silk silly silver simple sing single sink sister size skate sketch ski skill skin skirt sky sleep slide slim slip slope slow smart smell smile smoke smooth snake snow soap soccer soft soil soldier solid song soon sorry sort soul sound soup south space spare spell spice spider spin spirit split sponge spoon sport spot spray spread spring square stable staff stage stair stamp star start state station steam steel stem step stick still stir stomach stool store storm strange straw stream street stretch string strip stripe student study stuff style sugar suit summer sun supper supply sure surface surprise swallow swamp swan sweat sweep sweet swim swing switch sword symbol system table tail tale talk tall tank tape target task taste tax tea team tear tell ten tennis tent term test text thank theme thick thin thing third thorn thread three throat throw thumb ticket tide tie tiger tight tile timber tin tiny tip tire title toast today toe together toilet tomato tone tongue tool tooth top topic torch total touch tough tour towel tower town toy trace track trade trail train trap travel tray treat tree trend trial tribe trick trip truck true trunk trust truth tube tune tunnel turkey turn turtle twin twist type ugly umbrella uncle under union unit until upper upset urban urge usual vacation valley value van vase vast vegetable velvet verb very vest video view village vine violin visit voice volume vote voyage wage wagon waist wall wander warm warn wash waste watch wave wax weak wealth weapon wear weather web wedding weed weigh weird whale wheat wheel while whip whisper whistle white whole wide wife wild willow wind window wine wing winter wipe wire wise wish witch wolf wonder wood wool worry worth wrap wrist wrong yard yarn year yellow yes yesterday yoga yolk young youth zero zone zoo adventure anchor battery blanket bottle brilliant calendar capital cartoon century champion chapter chicken chimney cinema circuit citizen climate clothes coconut comedy compass concert courage crystal curious custom dragon dolphin eclipse elegant emerald evidence explore factory fantasy feather finger fossil freedom future gallery garlic genius ginger glacier harmony helmet horizon hunter journal kingdom lantern leader legend lightning lizard magnet marathon meadow melody method miracle monster mosaic mystery nectar network orchard oyster pattern pencil phantom pioneer planet pocket puzzle quartz rainbow rhythm saddle sapphire scholar shadow signal silver soldier spirit sunrise talent temple theory thunder tornado trophy tunnel velvet victory village volcano warrior whisper wizard wonder zephyr"
).split(" ").filter((w, i, all) => w && all.indexOf(w) === i);

const RECENT_WORDS = 120; // how many of the latest words a stream will not repeat

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
    this.recent = [];   // the last words handed out: none of them comes back until it has left this list
  }
  // A word that is not among the last `RECENT_WORDS` ones (or half the pool, for a short pool). Seeded, so both
  // players of an online match still get the same stream.
  next() {
    const keep = Math.min(RECENT_WORDS, Math.floor(this.pool.length / 2));
    let w;
    do { w = this.pool[Math.floor(this.rand() * this.pool.length)]; } while (w === this.last || this.recent.includes(w));
    this.last = w;
    this.recent.push(w);
    if (this.recent.length > keep) this.recent.shift();
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
