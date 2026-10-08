import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Phone, Link2, Check, Smile, Users, Camera } from "lucide-react";
import { useRoom } from "./hooks/useRoom.js";
import { useGestures } from "./hooks/useGestures.js";
import { takeSnapshot } from "./snapshot.js";
import "./room.css";

const EMOJIS = ["👍", "❤️", "✌️", "✋", "🤟", "☝️"];
const HEART = "M16 28S2 19.5 2 9.8C2 5 5.6 2 9.5 2c2.8 0 5.2 1.5 6.5 3.8C17.3 3.5 19.7 2 22.5 2 26.4 2 30 5 30 9.8 30 19.5 16 28 16 28z";

// Largest equal-sized tile (4:3, or portrait on tall screens) that fits everyone in the stage.
function useFit(ref, n) {
  const [size, setSize] = useState({ w: 320, h: 240 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calc = () => {
      const cs = getComputedStyle(el), g = parseFloat(cs.columnGap) || 12;
      const W = el.clientWidth - parseFloat(cs.paddingLeft) * 2, H = el.clientHeight - parseFloat(cs.paddingTop) * 2;
      const a = W >= H ? 4 / 3 : 3 / 4;
      let best = 0;
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        best = Math.max(best, Math.min((W - (c - 1) * g) / c, ((H - (r - 1) * g) / r) * a));
      }
      const w = Math.max(80, Math.floor(Math.min(best, 720)));
      setSize({ w, h: Math.floor(w / a) });
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, n]);
  return size;
}

function Fx({ type, who }) {
  if (type !== "❤️") return <div className="fx"><span className="emoji">{type}</span></div>;
  return (
    <div className="fx">
      <svg className="heart" viewBox="0 0 32 29"><path d={HEART} /></svg>
      {[[-28, 0, -10], [24, 0.3, 12], [-4, 0.6, -4]].map(([x, d, s], i) => (
        <svg key={i} className="mini" viewBox="0 0 32 29" style={{ "--x": `${x}px`, "--d": `${d}s`, "--s": `${s}px` }}><path d={HEART} /></svg>
      ))}
      <span className="tag glass">{who}</span>
    </div>
  );
}

function Tile({ stream, name, me, off, muted, reaction, vref, size }) {
  const own = useRef();
  const ref = vref || own;
  useEffect(() => { if (ref.current) ref.current.srcObject = stream || null; }, [stream, ref]);
  return (
    <div className={`tile${me ? " me" : ""}`} style={{ width: size.w, height: size.h }}>
      <video ref={ref} autoPlay playsInline muted={!!me} />
      {off && <div className="ph"><span>{name[0]?.toUpperCase()}</span></div>}
      <span className="name glass">{name}</span>
      {muted && <span className="mic-off glass"><MicOff size={14} /></span>}
      {reaction && <Fx key={reaction.key} type={reaction.type} who={name} />}
    </div>
  );
}

function Meeting({ roomId, name }) {
  const [tray, setTray] = useState(false);
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState(0);
  const [shot, setShot] = useState(null);
  const busy = useRef(false);
  const vref = useRef();
  const stageRef = useRef();

  const startSnap = () => {
    if (busy.current) return;
    busy.current = true;
    let c = 3;
    setCount(c);
    const t = setInterval(() => {
      c -= 1;
      if (c > 0) return setCount(c);
      clearInterval(t);
      setCount(0);
      setTimeout(() => { setShot(takeSnapshot(roomId)); busy.current = false; }, 80);
    }, 1000);
  };

  const r = useRoom(roomId, name, startSnap);
  const peers = Object.entries(r.peers);
  const n = peers.length + 1;
  const size = useFit(stageRef, n);
  const gesture = useGestures(vref, !!r.local && !r.camOff, r.sendReaction);

  const copy = async () => {
    try { await navigator.clipboard.writeText(`${location.origin}/room/${roomId}`); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const leave = () => {
    try { sessionStorage.setItem("vm-summary", JSON.stringify(r.getSummary())); } catch {}
    location.href = `/leave?room=${encodeURIComponent(roomId)}`;
  };

  return (
    <div className="shell">
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff7aa2" /><stop offset="1" stopColor="#f43f6e" /></linearGradient></defs>
      </svg>
      <header className="bar">
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img className="brand-icon" src="/assests/logo-icon-white.png" alt="Vmeet" />
        <button className="chip glass" onClick={copy} title="Copy invite link" style={{ cursor: "pointer" }}>
          <i />{copied ? <><Check size={14} /> Link copied</> : <>{roomId} <Link2 size={14} /></>}
        </button>
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <span className="chip glass" title="Hand gesture detection">✋ {gesture === "on" ? "on" : gesture === "error" ? "unavailable" : "loading…"}</span>
          <span className="chip glass"><Users size={14} /> {n}</span>
        </span>
      </header>
      {r.error && <div className="notice">{r.error}</div>}

      <section className="stage" ref={stageRef}>
        <Tile me name="You" size={size} off={r.camOff} muted={r.muted} stream={r.local} vref={vref} reaction={r.reactions.me} />
        {peers.map(([id, p]) => (
          <Tile key={id} name={p.name || "Guest"} size={size} muted={p.muted} stream={p.stream} reaction={r.reactions[id]} />
        ))}
      </section>

      <footer className="dock-wrap">
        {tray && (
          <div className="tray glass">
            {EMOJIS.map((e) => <button key={e} onClick={() => { r.sendReaction(e); setTray(false); }}>{e}</button>)}
          </div>
        )}
        <nav className="dock glass">
          <button className={r.muted ? "on" : ""} onClick={r.toggleMic} title={r.muted ? "Unmute" : "Mute"}>{r.muted ? <MicOff size={20} /> : <Mic size={20} />}</button>
          <button className={r.camOff ? "on" : ""} onClick={r.toggleCam} title={r.camOff ? "Camera on" : "Camera off"}>{r.camOff ? <VideoOff size={20} /> : <Video size={20} />}</button>
          <button onClick={() => setTray((v) => !v)} title="Reactions"><Smile size={20} /></button>
          <button onClick={r.requestSnapshot} title="Group snapshot"><Camera size={20} /></button>
          <button className="leave" onClick={leave} title="Leave"><Phone size={22} style={{ transform: "rotate(135deg)" }} /></button>
        </nav>
      </footer>

      {count > 0 && <div className="count"><span key={count}>{count}</span></div>}
      {shot && (
        <div className="modal" onClick={() => setShot(null)}>
          <div className="box glass" onClick={(e) => e.stopPropagation()}>
            <img src={shot} alt="Group snapshot" />
            <div className="row">
              <button className="gbtn" onClick={() => setShot(null)}>Close</button>
              <a className="pbtn" href={shot} download={`${roomId}.jpg`}>Download</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoomGate({ roomId }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem("vm-name") || ""; } catch { return ""; } });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.body.classList.add("in-room");
    document.title = "Vmeet Room";
    return () => document.body.classList.remove("in-room");
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { localStorage.setItem("vm-name", name.trim()); } catch {}
    setReady(true);
  };

  return (
    <div className={`room-page page${ready ? "" : " center"}`}>
      {ready ? <Meeting roomId={roomId} name={name.trim()} /> : (
        <form className="gate glass" onSubmit={submit}>
          <img className="gate-logo" src="/assests/logo-mark-white.png" alt="Vmeet" />
          <h2>Ready to join?</h2>
          <p>Others will see this name. Your browser will ask to use your camera and microphone.</p>
          <input autoFocus placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
          <button type="submit" disabled={!name.trim()}>Join meeting</button>
        </form>
      )}
    </div>
  );
}
