const test = require("node:test");
const assert = require("node:assert");
const g = require("./rmcs");

const four = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
const toAccuse = (game) => { g.advance(game); g.advance(game); return game; }; // role -> discuss -> accuse
const setup = () => { const game = g.createGame(four); const m = g.holderOf(game, "Mantri").id; return { game, m }; };

test("needs exactly 4 players", () => {
  assert.throws(() => g.createGame(four.slice(0, 3)));
  assert.throws(() => g.createGame([...four, { id: "e", name: "E" }]));
});

test("each role is dealt exactly once", () => {
  const { game } = setup();
  assert.deepStrictEqual(Object.values(game.roles).sort(), ["Chor", "Mantri", "Raja", "Sipahi"]);
});

test("players only see what they are allowed to", () => {
  const { game } = setup();
  assert.strictEqual(Object.keys(g.viewFor(game, "a").roles).length, 1);            // role card: own role only
  g.advance(game);                                                                  // discussion: Raja + Mantri become public
  const v = g.viewFor(game, "a").roles;
  Object.entries(v).forEach(([id, r]) => { if (id !== "a") assert.ok(["Raja", "Mantri"].includes(r)); });
  g.advance(game);                                                                  // discussion -> accusing: only the Mantri is given suspects
  const m = g.holderOf(game, "Mantri").id;
  assert.strictEqual(g.viewFor(game, m).suspects.length, 2);
  assert.deepStrictEqual(g.viewFor(game, g.holderOf(game, "Chor").id).suspects, []);
});

test("only the Mantri can accuse, only in the accuse phase, only a suspect", () => {
  const { game, m } = setup();
  const chor = g.holderOf(game, "Chor").id, raja = g.holderOf(game, "Raja").id;
  assert.throws(() => g.accuse(game, m, chor));            // too early
  toAccuse(game);
  assert.throws(() => g.accuse(game, raja, chor));         // not the Mantri
  assert.throws(() => g.accuse(game, m, raja));            // Raja is not a suspect
  assert.throws(() => g.accuse(game, m, m));               // cannot accuse yourself
  assert.deepStrictEqual(g.viewFor(game, m).suspects.sort(), [chor, g.holderOf(game, "Sipahi").id].sort());
});

test("scoring: correct, wrong, timeout", () => {
  let { game, m } = setup(); toAccuse(game);
  const chor = g.holderOf(game, "Chor").id, sip = g.holderOf(game, "Sipahi").id, raja = g.holderOf(game, "Raja").id;
  g.accuse(game, m, chor);                                  // correct
  assert.deepStrictEqual([game.scores[raja], game.scores[m], game.scores[sip], game.scores[chor]], [1000, 800, 500, 0]);

  ({ game, m } = setup()); toAccuse(game);
  const c2 = g.holderOf(game, "Chor").id, s2 = g.holderOf(game, "Sipahi").id;
  g.accuse(game, m, s2);                                    // wrong: Mantri 0, Chor takes 800
  assert.strictEqual(game.scores[m], 0); assert.strictEqual(game.scores[c2], 800);

  ({ game, m } = setup()); toAccuse(game);
  g.advance(game);                                          // timeout: Mantri 0, Chor still 0
  assert.strictEqual(game.result.outcome, "timeout");
  assert.strictEqual(game.scores[m], 0); assert.strictEqual(game.scores[g.holderOf(game, "Chor").id], 0);
  assert.strictEqual(game.phase, "reveal");
});

test("all roles are revealed after the round", () => {
  const { game, m } = setup(); toAccuse(game);
  g.accuse(game, m, g.holderOf(game, "Chor").id);
  assert.strictEqual(Object.keys(g.viewFor(game, "a").roles).length, 4);
});

test("5 rounds, then a final with winners", () => {
  const { game } = setup();
  for (let r = 1; r <= 5; r++) {
    assert.strictEqual(game.round, r);
    toAccuse(game); g.accuse(game, g.holderOf(game, "Mantri").id, g.holderOf(game, "Chor").id);
    g.advance(game);                                        // reveal -> next round or final
  }
  assert.strictEqual(game.phase, "final");
  assert.strictEqual(game.round, 5);
  assert.ok(g.viewFor(game, "a").winners.length >= 1);
});

test("anyone can end the game, and the name is kept", () => {
  const { game } = setup(); toAccuse(game);
  g.endGame(game, "c");
  assert.strictEqual(game.phase, "ended"); assert.strictEqual(game.endedBy, "C"); assert.strictEqual(game.endReason, "ended_by");
});

test("a player leaving ends the game", () => {
  const { game } = setup(); g.playerLeft(game, "b");
  assert.strictEqual(game.phase, "ended"); assert.strictEqual(game.endReason, "player_left");
});
