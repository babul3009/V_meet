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

const REACTIONS = new Set(["👍", "❤️", "✌️", "✋", "🤟", "☝️"]);

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = String(name || "Guest").slice(0, 30);

    const users = [];
    for (const id of io.sockets.adapter.rooms.get(roomId) || []) {
      if (id !== socket.id) users.push({ userId: id, name: io.sockets.sockets.get(id)?.data?.name || "Guest", muted: !!io.sockets.sockets.get(id)?.data?.muted });
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

  socket.on("snapshot", () => {
    if (socket.data.roomId) io.to(socket.data.roomId).emit("snapshot");
  });

  socket.on("media-state", ({ muted }) => {
    socket.data.muted = !!muted;
    if (socket.data.roomId) socket.to(socket.data.roomId).emit("media-state", { userId: socket.id, muted: !!muted });
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) if (room !== socket.id) socket.to(room).emit("user-left", socket.id);
  });
});

server.listen(process.env.PORT || 3000, () => console.log("Server running"));
