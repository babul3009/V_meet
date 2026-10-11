require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const dist = path.join(__dirname, "../client/dist");

// ICE config lives in env vars, never in the repo or the client bundle.
app.get("/api/ice", (req, res) => {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  const urls = (process.env.TURN_URLS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (urls.length) {
    iceServers.push({ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  res.json({ iceServers });
});

app.use(express.static(dist));
app.get("/{*splat}", (req, res) => res.sendFile(path.join(dist, "index.html")));

const rmcs = require("./rmcs");
const games = new Map();                                   // roomId -> { game, timer }
const ACTIVE = ["role", "discuss", "accuse", "reveal"];    // phases where a game is running

// Tell every player in the game what THEY are allowed to see (never the same message for all).
function sendGame(roomId) {
  const e = games.get(roomId);
  if (!e) return;
  const msLeft = e.game.deadline ? Math.max(0, e.game.deadline - Date.now()) : null;
  for (const p of e.game.players) io.to(p.id).emit("game:state", { ...rmcs.viewFor(e.game, p.id), you: p.id, msLeft });
}
// One timer per game: when the phase deadline passes, move the game on and tell everyone.
function schedule(roomId) {
  const e = games.get(roomId);
  if (!e) return;
  clearTimeout(e.timer);
  if (e.game.deadline) e.timer = setTimeout(() => { rmcs.advance(e.game); sendGame(roomId); schedule(roomId); }, Math.max(0, e.game.deadline - Date.now()));
}
function stopGame(roomId, byId, reason) {
  const e = games.get(roomId);
  if (!e || !ACTIVE.includes(e.game.phase)) return;
  clearTimeout(e.timer);
  reason === "ended_by" ? rmcs.endGame(e.game, byId) : rmcs.playerLeft(e.game, byId, reason);
  sendGame(roomId);
}

const REACTIONS = new Set(["👍", "❤️", "✌️", "✋", "🤟", "☝️"]);

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = String(name || "Guest").slice(0, 30);
    stopGame(roomId, socket.id, "player_joined");           // a 5th person joining breaks the 4-player rule

    const users = [];
    for (const id of io.sockets.adapter.rooms.get(roomId) || []) {
      if (id !== socket.id) users.push({ userId: id, name: io.sockets.sockets.get(id)?.data?.name || "Guest", muted: !!io.sockets.sockets.get(id)?.data?.muted, camOff: !!io.sockets.sockets.get(id)?.data?.camOff });
    }
    socket.emit("existing-users", users);
    socket.to(roomId).emit("user-joined", { userId: socket.id, name: socket.data.name });
  });

  for (const ev of ["offer", "answer"]) {
    socket.on(ev, (payload) => {
      const { to, ...rest } = payload;
      socket.to(to).emit(ev, { ...rest, from: socket.id, name: socket.data.name });
    });
  }
  socket.on("ice-candidate", ({ candidate, to }) => socket.to(to).emit("ice-candidate", { candidate, from: socket.id }));

  socket.on("reaction", ({ type }) => {
    if (socket.data.roomId && REACTIONS.has(type)) {
      socket.to(socket.data.roomId).emit("reaction", { userId: socket.id, type });
    }
  });

  socket.on("game:start", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const old = games.get(roomId);
    if (old && ACTIVE.includes(old.game.phase)) return;     // already running
    const ids = [...(io.sockets.adapter.rooms.get(roomId) || [])];
    if (ids.length !== 4) return socket.emit("game:error", `Needs exactly 4 players (${ids.length} here)`);
    if (old) clearTimeout(old.timer);
    const players = ids.map((id) => ({ id, name: io.sockets.sockets.get(id)?.data?.name || "Guest" }));
    games.set(roomId, { game: rmcs.createGame(players), timer: null });
    sendGame(roomId);
    schedule(roomId);
  });

  socket.on("game:accuse", ({ targetId }) => {
    const e = games.get(socket.data.roomId);
    if (!e) return;
    try { rmcs.accuse(e.game, socket.id, targetId); }       // the rulebook checks who may accuse whom
    catch (err) { return socket.emit("game:error", err.message); }
    sendGame(socket.data.roomId);
    schedule(socket.data.roomId);
  });

  socket.on("game:end", () => {
    const e = games.get(socket.data.roomId);
    if (e && e.game.players.some((p) => p.id === socket.id)) stopGame(socket.data.roomId, socket.id, "ended_by");
  });

  socket.on("snapshot", () => {
    if (socket.data.roomId) io.to(socket.data.roomId).emit("snapshot");
  });

  socket.on("media-state", ({ muted, camOff }) => {
    socket.data.muted = !!muted;
    socket.data.camOff = !!camOff;
    if (socket.data.roomId) socket.to(socket.data.roomId).emit("media-state", { userId: socket.id, muted: !!muted, camOff: !!camOff });
  });

  socket.on("disconnect", () => {
    const rid = socket.data.roomId, e = games.get(rid);
    if (e && !io.sockets.adapter.rooms.get(rid)) { clearTimeout(e.timer); games.delete(rid); }   // room is empty: forget the game
  });

  socket.on("disconnecting", () => {
    const e = games.get(socket.data.roomId);
    if (e && e.game.players.some((p) => p.id === socket.id)) stopGame(socket.data.roomId, socket.id, "player_left");
    for (const room of socket.rooms) if (room !== socket.id) socket.to(room).emit("user-left", socket.id);
  });
});

server.listen(process.env.PORT || 3000, () => console.log("Server running"));
