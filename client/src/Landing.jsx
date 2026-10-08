import { useEffect, useState } from "react";
import "./landing.css";
import { newRoom } from "./roomName.js";

export default function Landing() {
  const [code, setCode] = useState("");
  useEffect(() => { document.title = "Vmeet | Stay connected, refreshingly"; }, []);

  const startCall = () => { location.href = `/room/${newRoom()}`; };
  const joinCall = () => {
    const c = code.trim().toLowerCase().replace(/\s+/g, "-");
    if (c === "") { alert("Please enter a room code!"); return; }
    location.href = `/room/${c}`;
  };

  return (
    <div className="landing-page">
      <div className="container">
        <div className="header">
          <div className="logo"><img src="/assests/logo.png" alt="Vmeet" /></div>
          <button className="share-btn">Share This App</button>
        </div>

        <div className="main">
          <div className="left">
            <h1>Simple, Instant <br /> Video Calls for Friends.</h1>
            <p>No accounts. No downloads. Just click and connect in seconds.</p>
            <button className="start-btn" onClick={startCall}>Start a Video Call</button>
            <div className="join-section">
              <input type="text" placeholder="Enter Code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button onClick={joinCall}>Join</button>
            </div>
          </div>
          <div className="right">
            <img src="/assests/homepage.png" alt="video preview" />
          </div>
        </div>

        <div className="features">
          <div className="feature">
            <i className="fa-solid fa-user-lock icon"></i>
            <h3>No Sign-Up Required</h3>
            <p>Start instantly without account.</p>
          </div>
          <div className="feature">
            <i className="fa-solid fa-shield-halved icon"></i>
            <h3>Secure & Private</h3>
            <p>Encrypted peer-to-peer calls.</p>
          </div>
          <div className="feature">
            <i className="fa-solid fa-download icon"></i>
            <h3>Zero Downloads</h3>
            <p>Works directly in browser.</p>
          </div>
        </div>

        <div className="footer">
          <div className="footer-content">
            <span className="brand">Vmeet</span>
            <a href="#" className="footer-link">About</a>
            <a href="#" className="footer-link">Privacy</a>
            <div className="socials">
              <a href="#"><i className="fa-brands fa-instagram"></i></a>
              <a href="#"><i className="fa-brands fa-x-twitter"></i></a>
              <a href="#"><i className="fa-brands fa-linkedin"></i></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
