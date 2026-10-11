// Everything the player SEES for Raja Mantri Chor Sipahi.
// The server decides what each player may know; this file only draws what it is given.
import { useEffect, useState } from "react";

export const EMOJI = { Raja: "👑", Mantri: "🎩", Sipahi: "🛡️", Chor: "🕵️" };
const INFO = {
  Raja: "Everyone knows it. Sit tall and stay calm.",
  Mantri: "Watch the faces, then name the Chor.",
  Sipahi: "You are innocent, so look it. Help the Mantri.",
  Chor: "Bluff. Keep a straight face and don't get caught.",
};
export const PLAYING = ["role", "discuss", "accuse", "reveal"];

// Counts down to the moment the server said the phase ends.
function useSeconds(endAt) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!endAt) return setS(0);
    const tick = () => setS(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    tick();
    const i = setInterval(tick, 250);
    return () => clearInterval(i);
  }, [endAt]);
  return s;
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Extra things drawn on one video tile during a game: role badge, score, glowing ring, +points.
export function tileGame(game, pid, onPick) {
  if (!game || !PLAYING.includes(game.phase)) return null;
  const role = game.roles[pid], own = pid === game.you;
  const pub = role === "Raja" || role === "Mantri";
  const showOwn = game.phase !== "role" && (pub || game.phase === "reveal");   // your private role stays off your own tile
  const iAmMantri = game.roles[game.you] === "Mantri";
  return {
    badge: role && (own ? showOwn : true) ? `${EMOJI[role]} ${role}` : null,
    score: game.scores[pid],
    ring: game.phase === "accuse" && game.suspects.includes(pid),              // only the Mantri has suspects
    pulse: game.phase === "accuse" && !iAmMantri && !pub,                      // everyone else sees the two suspects pulse
    plus: game.phase === "reveal" ? game.result?.gained[pid] : null,
    onPick: () => onPick(pid),
  };
}

export function GameBar({ game, onEnd }) {
  const s = useSeconds(game.endAt);
  const me = game.roles[game.you], iAmMantri = me === "Mantri";
  const label = {
    role: "Your role", discuss: `Discussion · ${fmt(s)}`, reveal: "Reveal",
    accuse: iAmMantri ? `Pick the Chor · ${fmt(s)}` : `Mantri is choosing · ${fmt(s)}`,
  }[game.phase];
  return (
    <div className="gbar">
      <div className="l">
        <span className="chip glass">Round {game.round}/{game.rounds}</span>
        <span className="chip glass hot">{label}</span>
        <span className="chip glass">You: {EMOJI[me]} {me}</span>
      </div>
      <button className="endbtn" onClick={onEnd}>✕ End game</button>
    </div>
  );
}

export function ResultBanner({ game }) {
  if (game.phase !== "reveal" || !game.result) return null;
  const text = {
    correct: "The Mantri found the Chor! Everyone keeps their points.",
    wrong: "Wrong guess! The Chor fooled the Mantri and takes their 800.",
    timeout: "The Mantri ran out of time. The Mantri gets 0 and the Chor gets nothing.",
  }[game.result.outcome];
  return <div className="result glass">{text}</div>;
}

// All the pop-up cards: games panel, role card, confirm, end-game ask, final scores, game ended.
export function GameOverlays({ game, n, panel, closePanel, error, start, confirm, setConfirm, accuse, endAsk, setEndAsk, end, clear }) {
  const [seen, setSeen] = useState(0);                         // which round's role card you already dismissed
  // Escape closes the games panel
  useEffect(() => {
    if (!panel) return;
    const onKey = (e) => e.key === "Escape" && closePanel();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [panel, closePanel]);
  const nm = (id) => game?.players.find((p) => p.id === id)?.name || "Someone";
  let box = null, sheet = false, isPanel = false;

  if (endAsk) {
    box = (<><h2>End the game for everyone?</h2><p>Everyone will see that you ended it.</p>
      <div className="row2"><button className="b2" onClick={() => setEndAsk(false)}>Keep playing</button>
        <button className="b1" onClick={() => { end(); setEndAsk(false); }}>End game</button></div></>);
  } else if (confirm && game?.phase === "accuse") {
    sheet = true;
    box = (<><div className="big">🕵️</div><h2>Is {nm(confirm)} the Chor?</h2><p>You can't undo this.</p>
      <div className="row2"><button className="b2" onClick={() => setConfirm(null)}>Cancel</button>
        <button className="b1" onClick={() => { accuse(confirm); setConfirm(null); }}>Yes, accuse</button></div></>);
  } else if (game?.phase === "role" && seen !== game.round) {
    sheet = true;
    const me = game.roles[game.you];
    box = (<><div className="big">{EMOJI[me]}</div><h2>You are the {me}</h2><p>{INFO[me]}</p>
      <p className="fine">Only you can see this card.</p><button className="b1" onClick={() => setSeen(game.round)}>Got it</button></>);
  } else if (game?.phase === "final") {
    const rank = [...game.players].sort((a, b) => game.scores[b.id] - game.scores[a.id]);
    box = (<><div className="big">🏆</div><h2>{game.winners.map(nm).join(" & ")} win{game.winners.length > 1 ? "" : "s"}!</h2>
      <div className="rank">{rank.map((p, i) => <div key={p.id}><span>{i + 1}. {p.name}{p.id === game.you ? " (you)" : ""}</span><b>{game.scores[p.id]}</b></div>)}</div>
      <div className="row2"><button className="b2" onClick={clear}>Back to room</button>
        <button className="b1" disabled={n !== 4} onClick={start}>{n === 4 ? "Play again" : `Needs 4 (${n} here)`}</button></div></>);
  } else if (game?.phase === "ended") {
    const why = game.endReason === "ended_by" ? `${game.endedBy} ended the game` : game.endReason === "player_joined" ? "Someone joined, so the game ended" : `${game.endedBy} left, so the game ended`;
    box = (<><div className="big">🛑</div><h2>{why}</h2>
      <p>{game.endReason === "ended_by" ? "Everyone in the room can see who ended it." : "Raja Mantri Chor Sipahi needs exactly 4 players."}</p>
      <button className="b2" onClick={clear}>Back to room</button></>);
  } else if (panel && !PLAYING.includes(game?.phase)) {
    isPanel = true;
    box = (<><div className="big">👑</div><h2>Raja Mantri Chor Sipahi</h2>
      <p>Roles are dealt in secret. The Raja (1000) and Mantri (800) are shown to all. The Mantri must find the Chor out of two suspects, and a wrong guess gives the Chor the Mantri's 800. Sipahi earns 500, Chor 0. Five rounds.</p>
      {error && <p className="err">{error}</p>}
      <button className="b1" disabled={n !== 4} onClick={start}>{n === 4 ? "Start game" : `Needs 4 players (${n} here)`}</button>
      <button className="b2" onClick={closePanel}>Close</button></>);
  }
  if (!box) return null;
  // tapping the dark background closes the games panel (the other cards need an explicit choice)
  return <div className={`ov${sheet ? " sheet" : ""}`} onClick={isPanel ? closePanel : undefined}><div className="c2" onClick={(e) => e.stopPropagation()}>{box}</div></div>;
}
