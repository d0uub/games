import { useState } from "react";
import Joystick from "./Joystick";

export interface GameDef {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  desc: string;
  available: boolean;
  accent: string;
}

export const GAMES: GameDef[] = [
  {
    id: "dbd",
    title: "Dead by Daylight",
    emoji: "🔪",
    tagline: "Asymmetric 4v1 multiplayer",
    desc: "Survivors power up generators and escape. The Killer hunts and hooks. Play over P2P (trystero) on any phone or tablet.",
    available: true,
    accent: "#b91c1c",
  },
  {
    id: "coming-soon",
    title: "More Games",
    emoji: "🎮",
    tagline: "Coming soon",
    desc: "Built on the same shared kit (react-three, nipplejs, trystero).",
    available: false,
    accent: "#1e293b",
  },
];

export default function GameMenu({
  onPick, name, setName,
}: {
  onPick: (id: string) => void;
  name: string;
  setName: (n: string) => void;
}) {
  const [showJoystick, setShowJoystick] = useState(false);
  return (
    <div style={wrap}>
      <div style={head}>
        <h1 style={title}>🕹️ games</h1>
        <p style={sub}>Mobile-first multiplayer web games</p>
      </div>

      <div style={nameRow}>
        <label style={label} htmlFor="playername">Player name</label>
        <input
          id="playername"
          style={input}
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div style={grid}>
        {GAMES.map((g) => (
          <button
            key={g.id}
            style={{ ...card, border: `2px solid ${g.available ? g.accent : "#334155"}`, opacity: g.available ? 1 : 0.55 }}
            onClick={() => g.available && onPick(g.id)}
            disabled={!g.available}
          >
            <span style={{ fontSize: 40 }}>{g.emoji}</span>
            <span style={cardTitle}>{g.title}</span>
            <span style={cardTag} >{g.tagline}</span>
            <span style={cardDesc}>{g.desc}</span>
          </button>
        ))}
      </div>

      <div style={kitRow}>
        <button style={kitBtn} onClick={() => setShowJoystick((v) => !v)}>
          {showJoystick ? "Hide" : "Test"} shared joystick
        </button>
        <span style={kitHint}>Uses nipplejs + react-three + trystero</span>
      </div>
      {showJoystick && (
        <div style={{ justifyContent: "center", padding: 12 }}>
          <Joystick onChange={() => {}} size={120} />
        </div>
      )}

      <div style={foot}>
        <a style={link} href="https://github.com/d0uub/games" target="_blank" rel="noreferrer">GitHub</a>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: "fixed", inset: 0, background: "radial-gradient(circle at 50% 0%, #1e293b, #020617 70%)",
  color: "#e2e8f0", fontFamily: "system-ui, sans-serif", padding: 20, overflowY: "auto",
  display: "flex", flexDirection: "column", gap: 16,
};
const head: React.CSSProperties = { textAlign: "center" };
const title: React.CSSProperties = { margin: 0, fontSize: 34, fontWeight: 900 };
const sub: React.CSSProperties = { color: "#94a3b8", margin: "6px 0 0", fontSize: 14 };
const nameRow: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", justifyContent: "center", flexWrap: "wrap" };
const label: React.CSSProperties = { fontWeight: 700, fontSize: 14 };
const input: React.CSSProperties = {
  background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 10,
  padding: "10px 12px", fontSize: 15, width: 200, outline: "none",
};
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, maxWidth: 720, width: "100%", margin: "0 auto" };
const card: React.CSSProperties = {
  background: "#0f172a", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column",
  alignItems: "flex-start", gap: 6, cursor: "pointer", textAlign: "left", minHeight: 150,
};
const cardTitle: React.CSSProperties = { fontSize: 19, fontWeight: 800, color: "#f8fafc" };
const cardTag: React.CSSProperties = { fontSize: 12, color: "#38bdf8", fontWeight: 700 };
const cardDesc: React.CSSProperties = { fontSize: 12.5, color: "#94a3b8", lineHeight: 1.5 };
const kitRow: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center", justifyContent: "center", flexWrap: "wrap" };
const kitBtn: React.CSSProperties = { background: "#1e293b", color: "#cbd5e1", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" };
const kitHint: React.CSSProperties = { color: "#475569", fontSize: 12 };
const foot: React.CSSProperties = { display: "flex", justifyContent: "center", paddingTop: 8 };
const link: React.CSSProperties = { color: "#38bdf8", fontSize: 13, textDecoration: "none" };
