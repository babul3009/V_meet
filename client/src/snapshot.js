// Draws every tile on the page into one picture (runs fully in the browser).
export function takeSnapshot(roomId) {
  const tiles = [...document.querySelectorAll(".stage .tile")];
  const n = tiles.length, cols = n <= 1 ? 1 : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
  const cw = 480, ch = 360, g = 16, pad = 28, head = 70, foot = 24;
  const c = document.createElement("canvas");
  c.width = pad * 2 + cols * cw + (cols - 1) * g;
  c.height = head + rows * ch + (rows - 1) * g + pad + foot;
  const x = c.getContext("2d");
  const bg = x.createLinearGradient(0, 0, c.width, c.height);
  bg.addColorStop(0, "#3b2a7a"); bg.addColorStop(0.55, "#170f30"); bg.addColorStop(1, "#9f3a6a");
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#fff"; x.font = "600 26px sans-serif"; x.textBaseline = "middle";
  x.fillText(roomId, pad, head / 2 + 4);
  x.fillStyle = "rgba(255,255,255,.65)"; x.font = "16px sans-serif"; x.textAlign = "right";
  x.fillText(new Date().toLocaleString(), c.width - pad, head / 2 + 4); x.textAlign = "left";

  tiles.forEach((t, i) => {
    const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols);
    const px = pad + (i % cols) * (cw + g) + ((cols - inRow) * (cw + g)) / 2, py = head + r * (ch + g);
    const v = t.querySelector("video"), nm = t.querySelector(".name")?.textContent || "";
    x.save(); x.beginPath(); x.roundRect(px, py, cw, ch, 22); x.clip();
    x.fillStyle = "#241a45"; x.fillRect(px, py, cw, ch);
    if (v && v.videoWidth && !t.querySelector(".ph")) {
      const s = Math.max(cw / v.videoWidth, ch / v.videoHeight), sw = cw / s, sh = ch / s;
      const sx = (v.videoWidth - sw) / 2, sy = (v.videoHeight - sh) / 2;
      if (t.classList.contains("me")) { x.translate(px + cw, py); x.scale(-1, 1); x.drawImage(v, sx, sy, sw, sh, 0, 0, cw, ch); }
      else x.drawImage(v, sx, sy, sw, sh, px, py, cw, ch);
    } else {
      x.fillStyle = "rgba(255,255,255,.16)"; x.beginPath(); x.arc(px + cw / 2, py + ch / 2, 48, 0, 7); x.fill();
      x.fillStyle = "#fff"; x.font = "700 40px sans-serif"; x.textAlign = "center"; x.fillText(nm[0]?.toUpperCase() || "", px + cw / 2, py + ch / 2 + 2); x.textAlign = "left";
    }
    x.restore();
    x.font = "600 15px sans-serif"; const w = x.measureText(nm).width + 24;
    x.fillStyle = "rgba(18,10,40,.65)"; x.beginPath(); x.roundRect(px + 12, py + ch - 40, w, 28, 14); x.fill();
    x.fillStyle = "#fff"; x.fillText(nm, px + 24, py + ch - 25);
  });
  return c.toDataURL("image/jpeg", 0.92);
}
