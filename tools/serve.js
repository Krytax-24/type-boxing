// A tiny web server for playing over http on your own computer. Online rooms need it: browsers do not allow the
// peer to peer connection from a page opened by double click (file://).
//
//   node tools/serve.js            then open http://localhost:8080
//   node tools/serve.js 3000       another port
//
// Serves this folder only (never anything above it), read only. No libraries: node's http module.
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

// Folders a player never needs, kept off the server.
const PRIVATE = ["node_modules", ".git"];

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch (error) {
    response.writeHead(400).end("Bad address");
    return;
  }
  const file = path.normalize(path.join(ROOT, pathname === "/" ? "index.html" : pathname));
  const inside = file === ROOT || file.startsWith(ROOT + path.sep);
  const hidden = path
    .relative(ROOT, file)
    .split(path.sep)
    .some((part) => PRIVATE.includes(part));
  if (!inside || hidden) {
    response.writeHead(403).end("Not here");
    return;
  }
  fs.stat(file, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": TYPES[".txt"] }).end("Not found: " + pathname);
      return;
    }
    response.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": stats.size,
      "Cache-Control": "no-cache",
    });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(file).pipe(response);
  });
});

server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE" ? `Port ${PORT} is busy: try node tools/serve.js ${PORT + 1}` : error.message,
  );
  process.exitCode = 1;
});

server.listen(PORT, () => {
  console.log(`CounterType: http://localhost:${PORT}  (Ctrl+C stops the server)`);
});
