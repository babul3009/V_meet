import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export function useRoom(roomId, name, onSnapshot) {
  const [local, setLocal] = useState(null);
  const [peers, setPeers] = useState({});
  const [reactions, setReactions] = useState({});
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const startRef = useRef(Date.now());
  const seenRef = useRef(new Set());
  const countsRef = useRef({});
  const snapRef = useRef();
  snapRef.current = onSnapshot;

  const react = useCallback((id, type) => setReactions((r) => ({ ...r, [id]: { type, key: Date.now() } })), []);

  useEffect(() => {
    let dead = false;
    const pcs = {};
    const queue = {};
    const socket = io();
    socketRef.current = socket;

    (async () => {
      let stream, iceServers;
      try {
        ({ iceServers } = await (await fetch("/api/ice")).json());
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (e) {
        if (!dead) setError("Couldn't access your camera or microphone. Allow access and reload.");
        return;
      }
      if (dead) return stream.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      setLocal(stream);

      const make = (id, peerName, isMuted) => {
        if (pcs[id]) return pcs[id];
        const pc = new RTCPeerConnection({ iceServers });
        pcs[id] = pc;
        queue[id] = [];
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.ontrack = (e) => setPeers((p) => ({ ...p, [id]: { ...p[id], stream: e.streams[0] } }));
        pc.onicecandidate = (e) => e.candidate && socket.emit("ice-candidate", { candidate: e.candidate, to: id });
        seenRef.current.add(peerName);
        setPeers((p) => ({ ...p, [id]: { ...p[id], name: peerName, muted: !!isMuted } }));
        return pc;
      };

      socket.on("existing-users", async (users) => {
        for (const u of users) {
          const pc = make(u.userId, u.name, u.muted);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", { offer, to: u.userId });
        }
      });
      socket.on("user-joined", ({ userId, name }) => make(userId, name));
      socket.on("offer", async ({ offer, from, name }) => {
        const pc = make(from, name);
        await pc.setRemoteDescription(offer);
        for (const c of queue[from]) await pc.addIceCandidate(c);
        queue[from] = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { answer, to: from });
      });
      socket.on("answer", ({ answer, from }) => pcs[from]?.setRemoteDescription(answer));
      socket.on("ice-candidate", async ({ candidate, from }) => {
        const pc = pcs[from];
        if (!pc) return;
        if (!pc.remoteDescription) queue[from].push(candidate);
        else await pc.addIceCandidate(candidate).catch(() => {});
      });
      socket.on("user-left", (id) => {
        pcs[id]?.close();
        delete pcs[id];
        setPeers((p) => { const n = { ...p }; delete n[id]; return n; });
      });
      socket.on("media-state", ({ userId, muted }) => setPeers((p) => (p[userId] ? { ...p, [userId]: { ...p[userId], muted } } : p)));
      socket.on("snapshot", () => snapRef.current?.());
      socket.on("reaction", ({ userId, type }) => react(userId, type));

      socket.emit("join-room", { roomId, name });
    })();

    return () => {
      dead = true;
      socket.disconnect();
      Object.values(pcs).forEach((pc) => pc.close());
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId, name, react]);

  const toggle = (kind, set) => () => {
    const tracks = kind === "audio" ? streamRef.current?.getAudioTracks() : streamRef.current?.getVideoTracks();
    tracks?.forEach((t) => (t.enabled = !t.enabled));
    set((v) => !v);
  };

  const sendReaction = useCallback((type) => {
    socketRef.current?.emit("reaction", { type });
    countsRef.current[type] = (countsRef.current[type] || 0) + 1;
    react("me", type);
  }, [react]);

  return {
    local, peers, reactions, muted, camOff, error, sendReaction,
    requestSnapshot: () => socketRef.current?.emit("snapshot"),
    getSummary: () => {
      const c = countsRef.current, top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
      return { room: roomId, mins: Math.max(1, Math.round((Date.now() - startRef.current) / 60000)), people: [...seenRef.current],
        reactions: Object.values(c).reduce((a, b) => a + b, 0), top: top ? top[0] : "", topCount: top ? top[1] : 0 };
    },
    toggleMic: () => {
      const tracks = streamRef.current?.getAudioTracks() || [];
      tracks.forEach((t) => (t.enabled = !t.enabled));
      const m = tracks.length ? !tracks[0].enabled : false;
      setMuted(m);
      socketRef.current?.emit("media-state", { muted: m });
    },
    toggleCam: toggle("video", setCamOff)
  };
}
