import { useEffect, useRef, useState } from "react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";

// Tunables: raise HOLD_FRAMES / MIN_SCORE if you get false triggers, lower them if it feels slow.
const HOLD_FRAMES = 5;      // ~0.4s of the same gesture before it fires
const MIN_SCORE = 0.7;
const COOLDOWN_MS = 2500;   // per gesture
const MAP = { Thumb_Up: "👍", Victory: "✌️", Open_Palm: "✋", ILoveYou: "🤟", Pointing_Up: "☝️" };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Two-hand heart, using the thresholds from the original app.
function isHeart([a, b]) {
  return dist(a[8], b[8]) < 0.12 && dist(a[4], b[4]) < 0.14 && dist(a[0], b[0]) > 0.18;
}

function classify(r) {
  if (!r.landmarks.length) return null;
  if (r.landmarks.length === 2 && isHeart(r.landmarks)) return "❤️";
  const g = r.gestures[0]?.[0];
  return g && g.score > MIN_SCORE ? MAP[g.categoryName] || null : null;
}

export function useGestures(videoRef, enabled, onGesture) {
  const [status, setStatus] = useState("off");
  const cb = useRef(onGesture);
  cb.current = onGesture;

  useEffect(() => {
    if (!enabled) return;
    setStatus("loading");
    let stopped = false, raf, rec, lastRun = 0, cand = null, count = 0;
    const cooldown = {};

    (async () => {
      const files = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
      const make = (delegate) => GestureRecognizer.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
          delegate
        },
        runningMode: "VIDEO",
        numHands: 2
      });
      rec = await make("GPU").catch(() => make("CPU"));
      if (stopped) return rec.close();
      setStatus("on");

      const tick = (t) => {
        if (stopped) return;
        const v = videoRef.current;
        if (v && v.readyState >= 2 && t - lastRun > 80) {
          lastRun = t;
          const g = classify(rec.recognizeForVideo(v, t));
          count = g && g === cand ? count + 1 : g ? 1 : 0;
          cand = g;
          if (g && count === HOLD_FRAMES && t - (cooldown[g] || -Infinity) > COOLDOWN_MS) {
            cooldown[g] = t;
            cb.current(g);
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })().catch((e) => { console.warn("Gesture detection unavailable:", e); setStatus("error"); });

    return () => { stopped = true; cancelAnimationFrame(raf); rec?.close(); };
  }, [enabled, videoRef]);
  return status;
}
