import { useEffect } from "react";
import "./leave.css";

export default function Leave() {
  const roomId = new URLSearchParams(location.search).get("room");
  let sum = null;
  try { const x = JSON.parse(sessionStorage.getItem("vm-summary")); if (x && x.room === roomId) sum = x; } catch {}
  useEffect(() => { document.title = "Vmeet | Leave"; }, []);

  const rejoin = () => {
    if (roomId) location.href = `/room/${roomId}`;
    else alert("No room to rejoin");
  };

  return (
    <div className="leave-page">
      <img className="brand-top" src="/assests/logo-mark-white.png" alt="Vmeet" />
      <div className="leave-card">
        <img src="/assests/paperplane.png" className="custom-png" />
        <h1 className="message-main">You left the room</h1>
        <p className="message-sub">Hope to see you again 👋</p>
        {sum && (
          <div className="sum">
            <div className="room">{sum.room}</div>
            <div className="stats">
              <div><b>{sum.mins} min</b><span>Time together</span></div>
              <div><b>{sum.people.length + 1}</b><span>People</span></div>
              <div><b>{sum.reactions}</b><span>Reactions</span></div>
              <div><b>{sum.top ? `${sum.top} ${sum.topCount}` : "–"}</b><span>Top reaction</span></div>
            </div>
            {sum.people.length > 0 && <div className="met">{sum.people.join(" · ")}</div>}
          </div>
        )}
        <div className="button-container">
          <button className="btn btn-rejoin" onClick={rejoin}>
            <i className="ph ph-arrow-clockwise"></i> Rejoin
          </button>
          <button className="btn btn-home" onClick={() => (location.href = "/")}>
            <i className="ph ph-house"></i> Home
          </button>
        </div>
      </div>
    </div>
  );
}
