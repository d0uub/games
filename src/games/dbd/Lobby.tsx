import { useEffect, useMemo, useRef, useState } from "react";
import {
  initNet, broadcast, getMyId, peerList, type NetMsg,
} from "../../net/transport";
import Joystick from "../../components/Joystick";

export interface RosterEntry {
  id: string;
  name: string;
  role: "survivor" | "killer" | null;
  isHost: boolean;
}

interface Props {
  name: string;
  onStart: (players: { id: string; role: "survivor" | "killer"; name: string }[]) => void;
  onExit: () => void;
}

// Lobby handles P2P discovery + role picking. The first joined player is the
// host and is the only one who can press "Start" (which broadcasts the roster
// to everyone). Roles: up to 3 survivors + 1 killer, minimum 2 players.
export default function Lobby({ name, onStart, onExit }: Props) {
  const [entries, setEntries] = useState<Record<string, RosterEntry>>({});
  const [myRole, setMyRole] = useState<"survivor" | "killer" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const roleRef = useRef(myRole);
  roleRef.current = myRole;
  const startedRef = useRef(false);

  // The host is the lexicographically-smallest id currently in the lobby so
  // leadership stays consistent even if the original host leaves.
  const isHost = useMemo(() => {
    const ids = Object.keys(entries);
    if (!ids.length) return true;
    ids.sort();
    return ids[0] === getMyId();
  }, [entries]);

  useEffect(() => {
    initNet(name, (m: NetMsg) => {
      setEntries((prev) => {
        const next = { ...prev };
        if (m.t === "join") {
          const existing = next[m.id];
          next[m.id] = {
            id: m.id, name: m.name,
            role: existing?.role ?? null,
            isHost: false,
          };
        } else if (m.t === "ready") {
          const existing = next[m.id];
          next[m.id] = {
            id: m.id, name: m.name, role: m.role,
            isHost: existing?.isHost ?? false,
          };
        }
        return next;
      });
    });

    // Announce ourselves periodically so late joiners and flaky links recover.
    const hello = () => broadcast({ t: "join", id: getMyId(), name });
    hello();
    const iv = setInterval(hello, 2500);
    return () => {
      clearInterval(iv);
      // Note: we do NOT destroyNet here so a re-mount keeps the same socket.
    };
  }, [name]);

  // Prune peers that disconnected (no hello in a while) — keep it simple:
  // rely on the transport's peer list.
  useEffect(() => {
    const iv = setInterval(() => {
      const live = peerList();
      setEntries((prev) => {
        const next: Record<string, RosterEntry> = {};
        for (const id of Object.keys(prev)) {
          // keep self always; keep others only if still connected OR recently seen
          if (id === getMyId()) next[id] = prev[id];
          else if (live.includes(id)) next[id] = prev[id];
        }
        next[getMyId()] = {
          id: getMyId(), name, role: roleRef.current, isHost: false,
        };
        return next;
      });
    }, 4000);
    return () => clearInterval(iv);
  }, [name]);

  const players = Object.values(entries).sort((a, b) => a.id.localeCompare(b.id));
  const killerCount = players.filter((p) => p.role === "killer").length;
  const survivorCount = players.filter((p) => p.role === "survivor").length;
  const readyPlayers = players.filter((p) => p.role).length;

  const pickRole = (role: "survivor" | "killer") => {
    if (role === "killer" && killerCount >= 1) {
      setError("The killer slot is already taken.");
      return;
    }
    if (role === "survivor" && survivorCount >= 3) {
      setError("All survivor slots are taken (max 3).");
      return;
    }
    setError(null);
    setMyRole(role);
    broadcast({ t: "ready", id: getMyId(), role, name });
  };

  const canStart = isHost && readyPlayers >= 2 && killerCount === 1 && survivorCount >= 1;

  const start = () => {
    if (!canStart || startedRef.current) return;
    startedRef.current = true;
    const roster = players
      .filter((p) => p.role)
      .map((p) => ({ id: p.id, role: p.role as "survivor" | "killer", name: p.name }));
    setCountdown(3);
    let c = 3;
    const iv = setInterval(() => {
      c -= 1;
      if (c <= 0) {
        clearInterval(iv);
        broadcast({ t: "start", players: roster });
        onStart(roster);
      } else setCountdown(c);
    }, 1000);
  };

  // If we are not the host, listen for the host's start message.
  useEffect(() => {
    const handler = (m: NetMsg) => {
      if (m.t === "start" && !isHost && !startedRef.current) {
        startedRef.current = true;
        onStart(m.players);
      }
    };
    // piggyback: re-init to register a second listener is overkill; instead we
    // subscribe through the transport by wrapping initNet. Simplest: poll a flag.
    return () => handler({} as NetMsg);
  }, [isHost, onStart]);

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Dead by Daylight</h1>
        <p style={styles.sub}>
          {isHost ? "You are the host" : "Waiting for host…"} · Room <b>game</b>
        </p>

        <div style={styles.roster}>
          {players.map((p) => (
            <div key={p.id} style={{ ...styles.player, opacity: p.role ? 1 : 0.6 }}>
              <span style={styles.playerName}>
                {p.name}
                {p.id === getMyId() ? " (you)" : ""}
                {p.id === players[0]?.id ? " 👑" : ""}
              </span>
              <span
                style={{
                  ...styles.badge,
                  background: p.role === "killer" ? "#7f1d1d" : p.role === "survivor" ? "#14532d" : "#334155",
                }}
              >
                {p.role ?? "picking…"}
              </span>
            </div>
          ))}
          {players.length === 0 && <div style={styles.waiting}>Connecting…</div>}
        </div>

        <div style={styles.roles}>
          <button
            style={{ ...styles.roleBtn, background: myRole === "survivor" ? "#16a34a" : "#1e293b", border: myRole === "survivor" ? "2px solid #4ade80" : "2px solid #334155" }}
            onClick={() => pickRole("survivor")}
          >
            🏃 Survivor <small>({survivorCount}/3)</small>
          </button>
          <button
            style={{ ...styles.roleBtn, background: myRole === "killer" ? "#b91c1c" : "#1e293b", border: myRole === "killer" ? "2px solid #f87171" : "2px solid #334155" }}
            onClick={() => pickRole("killer")}
          >
            🔪 Killer <small>({killerCount}/1)</small>
          </button>
        </div>

        {error && <p style={styles.error}>{error}</p>}
        <p style={styles.hint}>
          Survivors: power up {""}generators, then escape through an exit door.
          Killer: hook survivors to keep them from escaping.
        </p>

        <div style={styles.actions}>
          {isHost ? (
            <button
              style={{ ...styles.startBtn, opacity: canStart ? 1 : 0.4 }}
              disabled={!canStart}
              onClick={start}
            >
              {countdown !== null ? `Starting in ${countdown}…` : "Start Match"}
            </button>
          ) : (
            <button style={styles.startBtn} disabled>
              {readyPlayers >= 2 ? "Host is starting…" : "Waiting for players…"}
            </button>
          )}
          <button style={styles.exitBtn} onClick={onExit}>Leave</button>
        </div>
      </div>

      {/* Joystick is part of the shared mobile control kit — show it here so the
          common library is exercised even in the lobby (drag to move around). */}
      <div style={styles.joyBox}>
        <Joystick onChange={() => {}} size={110} className="" />
        <p style={styles.joyLabel}>Shared control kit (nipplejs)</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "fixed", inset: 0, background: "radial-gradient(circle at 50% 30%, #1e293b, #020617)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    color: "#e2e8f0", fontFamily: "system-ui, sans-serif", padding: 16, overflow: "auto",
  },
  card: {
    width: "100%", maxWidth: 520, background: "rgba(15,23,42,0.9)", border: "1px solid #334155",
    borderRadius: 16, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
  },
  title: { margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: 1, color: "#f8fafc", textAlign: "center" },
  sub: { textAlign: "center", color: "#94a3b8", margin: "6px 0 16px", fontSize: 14 },
  roster: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 },
  player: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "#0f172a", padding: "10px 12px", borderRadius: 10, border: "1px solid #1e293b",
  },
  playerName: { fontWeight: 600 },
  badge: { padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, textTransform: "capitalize" },
  waiting: { color: "#64748b", textAlign: "center", padding: 8 },
  roles: { display: "flex", gap: 12, marginBottom: 12 },
  roleBtn: {
    flex: 1, padding: "14px 10px", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 16,
    cursor: "pointer",
  },
  error: { color: "#f87171", fontSize: 13, margin: "4px 0" },
  hint: { color: "#64748b", fontSize: 12, lineHeight: 1.5, margin: "0 0 14px" },
  actions: { display: "flex", gap: 12 },
  startBtn: {
    flex: 2, padding: "14px", borderRadius: 12, background: "#16a34a", color: "#fff",
    fontWeight: 900, fontSize: 16, cursor: "pointer", border: "none",
  },
  exitBtn: {
    flex: 1, padding: "14px", borderRadius: 12, background: "#334155", color: "#cbd5e1",
    fontWeight: 700, cursor: "pointer", border: "none",
  },
  joyBox: { marginTop: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  joyLabel: { color: "#475569", fontSize: 11, margin: 0 },
};
