import Landing from "./Landing.jsx";
import Leave from "./Leave.jsx";
import RoomGate from "./Room.jsx";

export default function App() {
  const path = location.pathname;
  if (path.startsWith("/room/")) return <RoomGate roomId={decodeURIComponent(path.slice(6))} />;
  if (path === "/leave") return <Leave />;
  return <Landing />;
}
