/**
 * Player identity: an id that never changes, a display name anyone may share, and a 4-digit tag that makes the
 * pair unique (Name#1234). No DOM. Storage is inside try/catch. Today the profile lives in this browser; when
 * accounts arrive (Google sign-in) the backend owns it and claimTag runs on the server, so the uniqueness check
 * is real. Nothing in the game is keyed on the name or the tag: records use `id`.
 */
CounterType.define("profile", ["config", "storage"], (CONFIG, storage) => {
  "use strict";

  const K = () => CONFIG.ranked;
  const NAME_MIN = 3,
    NAME_MAX = 16,
    RENAME_DAYS = 30;
  // A short block list. The server will use a full list; this one only stops the obvious.
  const BLOCKED = ["admin", "moderator", "countertype", "official", "support"];
  // Countries offered in the profile, with the leaderboard region each one belongs to.
  const COUNTRIES = [
    ["IN", "India", "sa"],
    ["PK", "Pakistan", "sa"],
    ["BD", "Bangladesh", "sa"],
    ["LK", "Sri Lanka", "sa"],
    ["NP", "Nepal", "sa"],
    ["SG", "Singapore", "sea"],
    ["ID", "Indonesia", "sea"],
    ["PH", "Philippines", "sea"],
    ["MY", "Malaysia", "sea"],
    ["VN", "Vietnam", "sea"],
    ["TH", "Thailand", "sea"],
    ["JP", "Japan", "ea"],
    ["KR", "South Korea", "ea"],
    ["CN", "China", "ea"],
    ["TW", "Taiwan", "ea"],
    ["AU", "Australia", "oc"],
    ["NZ", "New Zealand", "oc"],
    ["GB", "United Kingdom", "eu"],
    ["DE", "Germany", "eu"],
    ["FR", "France", "eu"],
    ["ES", "Spain", "eu"],
    ["IT", "Italy", "eu"],
    ["NL", "Netherlands", "eu"],
    ["PL", "Poland", "eu"],
    ["SE", "Sweden", "eu"],
    ["AE", "United Arab Emirates", "mea"],
    ["SA", "Saudi Arabia", "mea"],
    ["EG", "Egypt", "mea"],
    ["NG", "Nigeria", "mea"],
    ["ZA", "South Africa", "mea"],
    ["KE", "Kenya", "mea"],
    ["US", "United States", "na"],
    ["CA", "Canada", "na"],
    ["MX", "Mexico", "na"],
    ["BR", "Brazil", "lat"],
    ["AR", "Argentina", "lat"],
    ["CL", "Chile", "lat"],
    ["CO", "Colombia", "lat"],
  ];
  const regionOf = (cc) => {
    const c = COUNTRIES.find((x) => x[0] === cc);
    return c ? c[2] : "sa";
  };
  const countryName = (cc) => {
    const c = COUNTRIES.find((x) => x[0] === cc);
    return c ? c[1] : cc;
  };
  const regionName = (id) => {
    const r = K().regions.find((x) => x[0] === id);
    return r ? r[1] : id;
  };

  // The comparison form of a name: Unicode NFKC, lower case, look-alike characters folded, spaces removed.
  // "KRISHNA", "Krishna" and "Kr1shna" share one tag pool, so nobody can pose as someone by swapping a letter.
  function normalize(name) {
    const fold = { 0: "o", 1: "l", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", "@": "a", $: "s", "|": "l", "!": "i" };
    return String(name || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s_]+/g, "")
      .split("")
      .map((c) => fold[c] || c)
      .join("")
      .replace(/i/g, "l");
  }

  // { ok, name, error }. Letters, digits, single spaces and underscores, 3 to 16 characters.
  function validateName(raw) {
    const name = String(raw || "")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ");
    if (name.length < NAME_MIN) return { ok: false, error: `At least ${NAME_MIN} characters.` };
    if (name.length > NAME_MAX) return { ok: false, error: `At most ${NAME_MAX} characters.` };
    if (!/^[A-Za-z0-9 _]+$/.test(name)) {
      return { ok: false, error: "Use letters, digits, spaces and underscores only." };
    }
    const n = normalize(name);
    if (BLOCKED.some((b) => n.includes(normalize(b)))) {
      return { ok: false, error: "That name is reserved. Pick another." };
    }
    return { ok: true, name };
  }

  // A random free tag for a name. `taken(normName, tag)` says whether that pair exists (the mock backend checks the
  // mock players; the server will check its table). Random, not sequential, so tags do not reveal account age.
  function claimTag(name, taken, rand = Math.random, keep = null) {
    const n = normalize(name);
    if (keep && !taken(n, keep)) return keep;
    for (let i = 0; i < 200; i++) {
      const tag = String(1 + Math.floor(rand() * 9999)).padStart(4, "0");
      if (!taken(n, tag)) return tag;
    }
    return null; // the name is full: ask for another
  }

  function newId() {
    try {
      if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {
      /* older browser */
    }
    return "p-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
  }
  // A first guess at the country from the browser language ("en-IN" gives IN). The player can change it.
  function guessCountry() {
    try {
      const langs = (navigator.languages || [navigator.language || ""]).join(",");
      const m = langs.match(/-([A-Z]{2})/);
      if (m && COUNTRIES.some((c) => c[0] === m[1])) return m[1];
    } catch (e) {
      /* no navigator in tests */
    }
    return "IN";
  }

  function fresh() {
    const country = guessCountry();
    return {
      v: 1,
      id: newId(),
      name: "PLAYER",
      tag: String(1 + Math.floor(Math.random() * 9999)).padStart(4, "0"),
      country,
      region: regionOf(country),
      createdAt: Date.now(),
      renamedAt: 0,
      vehicle: null,
      signedIn: false,
      provider: null,
    };
  }

  let me = null;
  function load() {
    const raw = storage.readJson(K().profileKey); // storage blocked: a profile for this visit only
    if (raw && raw.v === 1 && raw.id) {
      me = Object.assign(fresh(), raw);
      return me;
    }
    me = fresh();
    save();
    return me;
  }
  function save() {
    return storage.writeJson(K().profileKey, me);
  }
  const get = () => me || load();
  const label = (p = get()) => `${p.name}#${p.tag}`;

  // Change the display name. The first change from the default is free; after that once every 30 days.
  // `taken` as in claimTag. Returns { ok, error, profile }.
  function rename(raw, taken, now = Date.now()) {
    const p = get(),
      v = validateName(raw);
    if (!v.ok) return v;
    if (normalize(v.name) === normalize(p.name)) {
      p.name = v.name;
      save();
      return { ok: true, profile: p };
    }
    const wait = p.renamedAt && p.name !== "PLAYER" ? p.renamedAt + RENAME_DAYS * 864e5 - now : 0;
    if (wait > 0) return { ok: false, error: `You can change your name again in ${Math.ceil(wait / 864e5)} days.` };
    const tag = claimTag(v.name, taken, Math.random, p.tag);
    if (!tag) return { ok: false, error: "Too many players use that name. Pick another." };
    p.name = v.name;
    p.tag = tag;
    p.renamedAt = now;
    save();
    return { ok: true, profile: p };
  }
  function setCountry(cc) {
    const p = get();
    if (!COUNTRIES.some((c) => c[0] === cc)) return false;
    p.country = cc;
    p.region = regionOf(cc);
    save();
    return true;
  }
  function set(patch) {
    Object.assign(get(), patch);
    save();
  }

  return {
    load,
    get,
    save,
    set,
    label,
    rename,
    setCountry,
    validateName,
    normalize,
    claimTag,
    regionOf,
    countryName,
    regionName,
    COUNTRIES,
    NAME_MAX,
  };
});
