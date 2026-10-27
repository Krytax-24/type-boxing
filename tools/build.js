// Builds the production copy of CounterType into dist/: the files index.html loads, joined into one script and one
// stylesheet in page order (and minified when esbuild is installed), with content-hashed names so browsers never
// keep an old copy. src/ stays the place you work in; dist/ is what you upload to a host.
//
//   node tools/build.js                        everything index.html loads
//   node tools/build.js --without race,arm     the same build with those plug-ins left out
//
// Minified output needs esbuild:   npm install --no-save esbuild   (without it the build is joined, not minified)
//
// What goes in: index.html, the scripts and stylesheets it loads (a plug-in removed from index.html is left out of
// the build too), the PeerJS vendor file and its license, and src/net/net-keys.js when it exists. What stays out:
// tests, tools, docs, assets and the dev tooling. The joined script behaves exactly like the separate files: they
// are classic scripts that share one global scope, and the kernel starts the modules on DOMContentLoaded either way.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "dist");

let esbuild = null;
try {
  esbuild = require(process.env.ESBUILD_PATH || "esbuild");
} catch (error) {
  // optional: the build is joined without it
}

const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const hash = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 10);
const withoutQuery = (src) => src.split("?")[0];

function parseWithout() {
  const at = process.argv.indexOf("--without");
  if (at < 0) return [];
  return (process.argv[at + 1] || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

/** index.html with the named plug-in blocks cut out. Fails loudly for a name that has no block. */
function pageWithout(html, families) {
  let page = html;
  for (const family of families) {
    const block = new RegExp(`[ \\t]*<!-- PLUG-IN ${family}:[\\s\\S]*?<!-- \\/PLUG-IN ${family} -->\\n?`);
    if (!block.test(page)) throw new Error(`build: index.html has no plug-in block "${family}"`);
    page = page.replace(block, "");
  }
  return page;
}

function main() {
  const without = parseWithout();
  const html = pageWithout(read("index.html"), without);
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => withoutQuery(m[1]));
  const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g)].map((m) => withoutQuery(m[1]));
  const vendor = scripts.filter((src) => src.startsWith("src/vendor/"));
  const own = scripts.filter((src) => !src.startsWith("src/vendor/") && fs.existsSync(path.join(ROOT, src)));
  const missing = scripts.filter((src) => !fs.existsSync(path.join(ROOT, src)));

  // One script and one stylesheet, in page order.
  let js = own.map((file) => `/* ${file} */\n${read(file)}\n`).join("\n");
  let css = styles.map((file) => `/* ${file} */\n${read(file)}\n`).join("\n");
  if (esbuild) {
    js = esbuild.transformSync(js, { loader: "js", minify: true, target: "es2020", legalComments: "none" }).code;
    css = esbuild.transformSync(css, { loader: "css", minify: true }).code;
  }
  const jsName = `js/countertype.${hash(js)}.js`;
  const cssName = `css/countertype.${hash(css)}.css`;

  fs.rmSync(OUT, { recursive: true, force: true });
  for (const dir of ["js", "css", "src/vendor"]) fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  fs.writeFileSync(path.join(OUT, jsName), js);
  fs.writeFileSync(path.join(OUT, cssName), css);
  for (const file of vendor) {
    fs.copyFileSync(path.join(ROOT, file), path.join(OUT, file));
    const license = file.replace(/\.min\.js$/, ".LICENSE.txt");
    if (fs.existsSync(path.join(ROOT, license))) fs.copyFileSync(path.join(ROOT, license), path.join(OUT, license));
  }

  // The page: the same markup, pointing at the joined files: the stylesheet in the head, the scripts at the end of
  // the body (PeerJS first, because the game code checks for it). Comments are for the source, so they go.
  const tags = vendor
    .map((file) => `    <script src="${file}"></script>`)
    .concat([`    <script src="${jsName}"></script>`])
    .join("\n");
  const page = html
    .replace(/[ \t]*<!--[\s\S]*?-->\n?/g, "")
    .replace(/[ \t]*<script src="[^"]+"><\/script>\n?/g, "")
    .replace(/[ \t]*<link rel="stylesheet" href="[^"]+"\s*\/?>\n?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace("  </head>", `    <link rel="stylesheet" href="${cssName}" />\n  </head>`)
    .replace(/\n* {2}<\/body>/, `\n\n${tags}\n  </body>`);
  fs.writeFileSync(path.join(OUT, "index.html"), page);

  const keys = own.includes("src/net/net-keys.js");
  fs.writeFileSync(
    path.join(OUT, "BUILD.txt"),
    [
      "CounterType production build. Made by: node tools/build.js" +
        (without.length ? ` --without ${without.join(",")}` : ""),
      "",
      "Upload this whole folder to any static host (Cloudflare Pages, GitHub Pages, Netlify). index.html is the game.",
      "Opening index.html by double click also works; online play needs the page served over http or https.",
      "",
      `Built: ${new Date().toISOString()}  Minified: ${esbuild ? "yes (esbuild " + esbuild.version + ")" : "no (install esbuild for a smaller build)"}`,
      `Plug-ins left out: ${without.length ? without.join(", ") : "none"}`,
      `Relay keys (src/net/net-keys.js): ${keys ? "included. Anything in a web page is public: rotate the keys if they leak." : "not included, online play uses STUN only."}`,
      "",
    ].join("\n"),
  );

  const size = (file) => (fs.statSync(path.join(OUT, file)).size / 1024).toFixed(1) + " KB";
  const sourceKb = own.reduce((sum, file) => sum + fs.statSync(path.join(ROOT, file)).size, 0) / 1024;
  console.log(`dist/ written${esbuild ? " (minified)" : " (joined, not minified: esbuild not found)"}`);
  console.log(`  ${jsName}  ${size(jsName)}  from ${own.length} files, ${sourceKb.toFixed(1)} KB`);
  console.log(`  ${cssName}  ${size(cssName)}  from ${styles.length} files`);
  for (const file of vendor) console.log(`  ${file}  ${size(file)}`);
  if (without.length) console.log(`  left out: ${without.join(", ")}`);
  if (missing.length) console.log(`  skipped (not found): ${missing.join(", ")}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
