// Optional PeerJS introducer server for Type Boxing. It only helps two browsers find each other;
// no game data passes through it. Deploy it if the free PeerJS cloud server is slow or down.
const { PeerServer } = require("peer");

const port = Number(process.env.PORT) || 9000;
PeerServer({
  port,
  path: "/",
  proxied: true,          // behind Render, Railway or Fly the TLS is handled for you
  allow_discovery: false, // nobody can list the open rooms
  corsOptions: { origin: true },
});
console.log("Type Boxing PeerJS server listening on port " + port);
