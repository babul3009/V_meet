// Raja Mantri Chor Sipahi: the RULES of the game.
// This file is pure logic. It knows nothing about sockets, timers or the browser,
// so it can be tested on its own. server.js will call it in step 2.

const ROLES = ["Raja", "Mantri", "Chor", "Sipahi"];
const POINTS = { Raja: 1000, Mantri: 800, Sipahi: 500, Chor: 0 };
const ROUNDS = 5;
// How long each phase lasts. When a phase's time is up, advance() moves the game on.
// RMCS_TIME_SCALE is only used by automated tests to run a whole game in a second.
const T = Number(process.env.RMCS_TIME_SCALE) || 1;
const ROLE_MS = 6000 * T, DISCUSS_MS = 20000 * T, ACCUSE_MS = 30000 * T, REVEAL_MS = 8000 * T;

// Fisher-Yates shuffle. `rand` can be replaced in tests so results are predictable.
function shuffle(list, rand = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const holderOf = (game, role) => game.players.find((p) => game.roles[p.id] === role);

// Start a new game. Throws unless there are exactly 4 players.
function createGame(players, rand = Math.random, now = Date.now()) {
  if (players.length !== 4) throw new Error("Needs exactly 4 players");
  const game = {
    phase: "lobby", round: 0, rounds: ROUNDS, rand,
    players: players.map((p) => ({ id: p.id, name: p.name })),
    roles: {}, scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    deadline: null, result: null, endedBy: null, endReason: null,
  };
  return startRound(game, now);
}

// Deal the four roles at random and show everyone their private role card.
function startRound(game, now = Date.now()) {
  const deal = shuffle(ROLES, game.rand);
  game.players.forEach((p, i) => (game.roles[p.id] = deal[i]));
  game.round += 1;
  game.phase = "role";
  game.deadline = now + ROLE_MS;
  game.result = null;
  return game;
}

// Called when the current phase's time is up: role -> discuss -> accuse -> reveal -> next round / final.
function advance(game, now = Date.now()) {
  if (game.phase === "role") { game.phase = "discuss"; game.deadline = now + DISCUSS_MS; }
  else if (game.phase === "discuss") { game.phase = "accuse"; game.deadline = now + ACCUSE_MS; }
  else if (game.phase === "accuse") finishRound(game, "timeout", null, now); // Mantri never chose
  else if (game.phase === "reveal") {
    if (game.round >= game.rounds) { game.phase = "final"; game.deadline = null; }
    else startRound(game, now);
  }
  return game;
}

// The Mantri names the person they think is the Chor.
function accuse(game, id, targetId, now = Date.now()) {
  if (game.phase !== "accuse") throw new Error("Not the accusing phase");
  if (holderOf(game, "Mantri").id !== id) throw new Error("Only the Mantri can accuse");
  if (!["Sipahi", "Chor"].includes(game.roles[targetId])) throw new Error("Pick one of the two suspects");
  return finishRound(game, game.roles[targetId] === "Chor" ? "correct" : "wrong", targetId, now);
}

// Scoring. outcome is "correct", "wrong" or "timeout".
function finishRound(game, outcome, accusedId, now = Date.now()) {
  const gained = {};
  game.players.forEach((p) => (gained[p.id] = POINTS[game.roles[p.id]]));
  const mantri = holderOf(game, "Mantri").id, chor = holderOf(game, "Chor").id;
  if (outcome === "wrong") { gained[mantri] = 0; gained[chor] = POINTS.Mantri; } // Chor fooled the Mantri and takes the 800
  if (outcome === "timeout") gained[mantri] = 0;                                  // Mantri gets 0, Chor does NOT take the 800
  game.players.forEach((p) => (game.scores[p.id] += gained[p.id]));
  game.result = { outcome, accusedId, gained };
  game.phase = "reveal";
  game.deadline = now + REVEAL_MS;
  return game;
}

// Anyone can end the game. We remember who, so the room can be told.
function endGame(game, id) {
  game.phase = "ended";
  game.endedBy = game.players.find((p) => p.id === id)?.name || "Someone";
  game.endReason = "ended_by";
  game.deadline = null;
  return game;
}

// If a player leaves (or joins), 4 players is no longer true, so the game stops.
function playerLeft(game, id, reason = "player_left") {
  game.phase = "ended";
  game.endedBy = game.players.find((p) => p.id === id)?.name || "A player";
  game.endReason = reason;
  game.deadline = null;
  return game;
}

const winners = (game) => {
  const top = Math.max(...Object.values(game.scores));
  return game.players.filter((p) => game.scores[p.id] === top).map((p) => p.id);
};

// What ONE player is allowed to see. The server sends each person only their own view,
// so nobody can find the Chor by looking at the page.
function viewFor(game, id) {
  const showAll = game.phase === "reveal" || game.phase === "final";
  const raja_mantri_public = !["lobby", "role"].includes(game.phase);
  const roles = {};
  game.players.forEach((p) => {
    const role = game.roles[p.id];
    if (p.id === id || showAll || (raja_mantri_public && (role === "Raja" || role === "Mantri"))) roles[p.id] = role;
  });
  const suspects = game.phase === "accuse" && holderOf(game, "Mantri").id === id
    ? game.players.filter((p) => ["Sipahi", "Chor"].includes(game.roles[p.id])).map((p) => p.id) : [];
  return {
    phase: game.phase, round: game.round, rounds: game.rounds, deadline: game.deadline,
    players: game.players, scores: game.scores, roles, suspects,
    result: showAll ? game.result : null,
    winners: game.phase === "final" ? winners(game) : null,
    endedBy: game.endedBy, endReason: game.endReason,
  };
}

module.exports = { createGame, startRound, advance, accuse, endGame, playerLeft, viewFor, holderOf, POINTS, ROLES };
