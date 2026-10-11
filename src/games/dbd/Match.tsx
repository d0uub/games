import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Joystick, { type Stick } from "../../components/Joystick";
import ActionButton from "../../components/ActionButton";
import {
  broadcast, getMyId, initNet, type NetMsg,
} from "../../net/transport";
import {
  createWorld, ST_OK, ST_INJURED, ST_DOWNED, ST_HOOKED, ST_ESCAPE,
  type WorldState, type PlayerState,
} from "./state";
import {
  ARENA, WALL, OBSTACLES, GENERATORS, EXIT_DOORS,
  SURV_SPEED, KILLER_SPEED, SURV_RADIUS, KILLER_RADIUS,
  MEND_TIME, HOOK_DURATION, HIT_STUN,
  INTERACT_RANGE, HIT_RANGE, DOWN_AFTER_HITS,
} from "./world";

interface Props {
  roster: { id: string; role: "survivor" | "killer"; name: string }[];
  onExit: () => void;
}

const dist = (ax: number, az: number, bx: number, bz: number) =>
  Math.hypot(ax - bx, az - bz);

function collides(x: number, z: number, r: number): boolean {
  if (Math.abs(x) + r > WALL || Math.abs(z) + r > WALL) return true;
  for (const o of OBSTACLES) {
    if (Math.abs(x - o.x) < o.sx / 2 + r && Math.abs(z - o.z) < o.sz / 2 + r) return true;
  }
  return false;
}

function nearestGen(x: number, z: number): number {
  let best = -1, bd = 1e9;
  GENERATORS.forEach((g, i) => {
    const d = dist(x, z, g.x, g.z);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

export default function Match({ roster, onExit }: Props) {
  const worldRef = useRef<WorldState>(createWorld(roster));
  const myId = getMyId();
  const myRole = roster.find((r) => r.id === myId)?.role ?? "survivor";
  const me = () => worldRef.current.players[myId];

  const stick = useRef<Stick>({ x: 0, y: 0, force: 0, active: false });
  const interacting = useRef(false);
  const [ui, setUi] = useState({
    gens: worldRef.current.gens.slice(),
    doors: worldRef.current.doors.slice(),
    over: worldRef.current.over,
    me: { state: ST_OK, hits: 0, actionT: 0, stunT: 0, gen: -1 },
    nearest: -1,
    canMend: false,
    canUnhook: false,
    canRevive: false,
    targetName: "",
  });

  // ---- network: apply remote players + actions ----
  useEffect(() => {
    initNet(roster.find((r) => r.id === myId)?.name ?? "", (m: NetMsg) => {
      const w = worldRef.current;
      if (m.t === "sync") {
        const p = w.players[m.id];
        if (!p) return;
        p.x = m.x; p.z = m.z; p.rot = m.rot; p.state = m.state;
        if (m.gen !== undefined) p.gen = m.gen;
        // remote generator progress contributes
        if (p.gen >= 0 && p.genProgress > w.gens[p.gen]) w.gens[p.gen] = p.genProgress;
      } else if (m.t === "action") {
        handleRemoteAction(m);
      }
    });
    return () => {};
  }, [myId]);

  function handleRemoteAction(m: NetMsg & { t: "action" }) {
    const w = worldRef.current;
    const t = m.targetId ? w.players[m.targetId] : undefined;
    if (!t) return;
    switch (m.kind) {
      case "hit":
        t.hits += 1; t.stunT = HIT_STUN;
        t.state = t.hits >= DOWN_AFTER_HITS ? ST_DOWNED : ST_INJURED;
        break;
      case "hook":
        t.state = ST_HOOKED; t.actionT = HOOK_DURATION;
        break;
      case "unhook":
        t.state = ST_INJURED; t.hits = 1;
        break;
      case "revive":
        t.state = ST_INJURED; t.hits = 1;
        break;
      case "escape":
        t.state = ST_ESCAPE;
        break;
    }
  }

  // local step for the controlling player
  function stepMe(w: WorldState, p: PlayerState, dt: number) {
    const s = stick.current;
    const canMove = p.stunT <= 0 && p.state !== ST_HOOKED && p.state !== ST_DOWNED && p.state !== ST_ESCAPE;
    const speed = p.state === ST_INJURED ? SURV_SPEED * 0.7 : (myRole === "killer" ? KILLER_SPEED : SURV_SPEED);
    if (canMove && s.active && s.force > 0.15) {
      const len = Math.hypot(s.x, s.y) || 1;
      const dx = (s.x / len) * speed * s.force * dt;
      const dz = (s.y / len) * speed * s.force * dt;
      const r = myRole === "killer" ? KILLER_RADIUS : SURV_RADIUS;
      const nx = p.x + dx;
      const nz = p.z + dz;
      if (!collides(nx, p.z, r)) p.x = nx;
      if (!collides(p.x, nz, r)) p.z = nz;
      p.rot = Math.atan2(dx, dz);
    }
    // survival interaction progress
    if (myRole === "survivor" && interacting.current && canMove) {
      if (p.gen >= 0) {
        const rate = 1 / MEND_TIME * dt;
        p.genProgress = Math.min(1, p.genProgress + rate);
        if (p.genProgress >= 1) {
          w.gens[p.gen] = 1;
          p.gen = -1; p.genProgress = 0;
        }
      }
    }
    // timers
    if (p.stunT > 0) p.stunT = Math.max(0, p.stunT - dt);
  }

  function tickAll(w: WorldState, dt: number) {
    for (const id of Object.keys(w.players)) {
      const p = w.players[id];
      if (p.state === ST_HOOKED) {
        p.actionT -= dt;
        if (p.actionT <= 0) { p.state = ST_INJURED; p.hits = 1; }
      }
    }
    // unlock doors when 5 generators done
    if (w.gens.filter((g) => g >= 1).length >= 5) {
      w.doors = [true, true, true];
    }
  }

  function checkEnd(w: WorldState) {
    if (w.over) return;
    const survivors = Object.values(w.players).filter((p) => p.role === "survivor");
    const escaped = survivors.filter((p) => p.state === ST_ESCAPE).length;
    if (escaped >= 1) w.over = "win";
    const activeSurv = survivors.filter((p) => p.state !== ST_ESCAPE);
    if (activeSurv.length > 0 && activeSurv.every((p) => p.state === ST_HOOKED)) w.over = "loss";
  }

  function refreshUi(w: WorldState, p: PlayerState | undefined) {
    if (!p) return;
    const g = nearestGen(p.x, p.z);
    const nearGenOk = g >= 0 && w.gens[g] < 1 && dist(p.x, p.z, GENERATORS[g].x, GENERATORS[g].z) < INTERACT_RANGE;
    let canUnhook = false, canRevive = false, targetName = "";
    for (const id of Object.keys(w.players)) {
      const t = w.players[id];
      if (t.role !== "survivor" && myRole === "survivor") continue;
      if (myRole === "survivor" && t.state === ST_HOOKED && id !== myId && dist(p.x, p.z, t.x, t.z) < INTERACT_RANGE) {
        canUnhook = true; targetName = t.name;
      }
      if (myRole === "survivor" && t.state === ST_DOWNED && id !== myId && dist(p.x, p.z, t.x, t.z) < INTERACT_RANGE) {
        canRevive = true; targetName = t.name;
      }
    }
    setUi({
      gens: w.gens.slice(),
      doors: w.doors.slice(),
      over: w.over,
      me: { state: p.state, hits: p.hits, actionT: p.actionT, stunT: p.stunT, gen: p.gen },
      nearest: nearGenOk ? g : -1,
      canMend: nearGenOk,
      canUnhook,
      canRevive,
      targetName,
    });
  }

  // ---- local loop: move, interact, tick timers, win/loss, UI ----
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = worldRef.current;
      w.t += dt;
      const p = worldRef.current.players[myId];
      if (p && !w.over) stepMe(w, p, dt);
      tickAll(w, dt);
      checkEnd(w);
      // UI snapshot (throttled by React batching)
      refreshUi(w, p);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [myId]);

  // ---- input actions ----
  const doKillerHit = () => {
    const w = worldRef.current;
    const p = me();
    if (!p || myRole !== "killer" || w.over) return;
    const targetId = Object.keys(w.players).find((id) => {

      const t = w.players[id];
      return t.role === "survivor" && t.state !== ST_ESCAPE && dist(p.x, p.z, t.x, t.z) < HIT_RANGE;
    
    });
    const target = targetId ? w.players[targetId] : undefined;
    if (target) {
      target.hits += 1;
      target.stunT = HIT_STUN;
      target.state = target.hits >= DOWN_AFTER_HITS ? ST_DOWNED : ST_INJURED;
      target.x += (target.x - p.x) * 0.2; // small knockback
      target.z += (target.z - p.z) * 0.2;
      broadcast({ t: "action", id: myId, kind: "hit", targetId: target.id });
    }
  };

  const doHook = () => {
    const w = worldRef.current;
    const p = me();
    if (!p || myRole !== "killer" || w.over) return;
    const targetId = Object.keys(w.players).find((id) => {

      const t = w.players[id];
      return t.role === "survivor" && t.state === ST_DOWNED && dist(p.x, p.z, t.x, t.z) < INTERACT_RANGE;
    
    });
    const target = targetId ? w.players[targetId] : undefined;
    if (target) {
      target.state = ST_HOOKED;
      target.actionT = HOOK_DURATION;
      broadcast({ t: "action", id: myId, kind: "hook", targetId: target.id, x: target.x, z: target.z });
    }
  };

  const doUnhook = () => {
    const w = worldRef.current;
    const p = me();
    if (!p || myRole !== "survivor" || w.over) return;
    const targetId = Object.keys(w.players).find((id) => {

      const t = w.players[id];
      return t.state === ST_HOOKED && dist(p.x, p.z, t.x, t.z) < INTERACT_RANGE;
    
    });
    const target = targetId ? w.players[targetId] : undefined;
    if (target) {
      target.state = ST_INJURED;
      target.hits = 1;
      broadcast({ t: "action", id: myId, kind: "unhook", targetId: target.id });
    }
  };

  const doRevive = () => {
    const w = worldRef.current;
    const p = me();
    if (!p || myRole !== "survivor" || w.over) return;
    const targetId = Object.keys(w.players).find((id) => {

      const t = w.players[id];
      return t.role === "survivor" && t.state === ST_DOWNED && dist(p.x, p.z, t.x, t.z) < INTERACT_RANGE;
    
    });
    const target = targetId ? w.players[targetId] : undefined;
    if (target) {
      target.state = ST_INJURED;
      target.hits = 1;
      broadcast({ t: "action", id: myId, kind: "revive", targetId: target.id });
    }
  };

  const mendDown = () => {
    const w = worldRef.current;
    const p = me();
    if (!p || myRole !== "survivor" || w.over) return;
    if (p.gen >= 0 && w.gens[p.gen] >= 1) { p.gen = -1; return; }
    interacting.current = true;
  };
  const mendUp = () => { interacting.current = false; };

  const doEscape = () => {
    const w = worldRef.current;
    const p = me();
    if (!p || myRole !== "survivor" || w.over) return;
    const di = EXIT_DOORS.findIndex((d) => dist(p.x, p.z, d.x, d.z) < INTERACT_RANGE + 2);
    if (di >= 0) {
      if (w.doors[di] || w.gens.filter((g) => g >= 1).length >= 5) {
        p.state = ST_ESCAPE;
        p.x = EXIT_DOORS[di].x + (EXIT_DOORS[di].x > 0 ? 8 : -8);
        p.z = EXIT_DOORS[di].z + (EXIT_DOORS[di].z > 0 ? 8 : -8);
        broadcast({ t: "action", id: myId, kind: "escape", targetId: myId });
      }
    }
  };


  return (
    <div style={{ position: "fixed", inset: 0, background: "#020617" }}>
      <Canvas camera={{ position: [0, 34, 34], fov: 50 }} dpr={[1, 2]}>
        <Scene worldRef={worldRef} myId={myId} />
        <OrbitControls enablePan={false} minDistance={12} maxDistance={90} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
      <Hud ui={ui} myRole={myRole} />
      <Controls
        myRole={myRole}
        stickRef={stick}
        onHit={doKillerHit}
        onHook={doHook}
        onUnhook={doUnhook}
        onRevive={doRevive}
        onMendDown={mendDown} onMendUp={mendUp}
        onEscape={doEscape}
        canMend={ui.canMend}
        canUnhook={ui.canUnhook}
        canRevive={ui.canRevive}
      />
      <div style={{ position: "absolute", top: 8, right: 8, zIndex: 20 }}>
        <button style={exitStyle} onClick={onExit}>Exit</button>
      </div>
      {ui.over && (
        <div style={overlay}>
          <div style={overlayCard}>
            <h2 style={{ margin: 0, fontSize: 34, color: ui.over === "win" ? "#4ade80" : "#f87171" }}>
              {ui.over === "win" ? "You Escaped!" : "Match Over"}
            </h2>
            <p style={{ color: "#94a3b8" }}>
              {ui.over === "win" ? "A survivor got out the door." : "The hunters took them all down."}
            </p>
            <button style={exitStyle} onClick={onExit}>Back to Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- 3D scene ----
function Scene({ worldRef, myId }: {
  worldRef: React.MutableRefObject<WorldState>; myId: string;
}) {
  return (
    <group>
      <fog attach="fog" args={["#0b1220", 40, 120]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[40, 60, 20]} intensity={1.1} castShadow />
      <Ground />
      {OBSTACLES.map((o, i) => (
        <mesh key={i} position={[o.x, o.h / 2, o.z]} castShadow receiveShadow>
          <boxGeometry args={[o.sx, o.h, o.sz]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      ))}
      {GENERATORS.map((g, i) => (
        <group key={i} position={[g.x, 0, g.z]}>
          <mesh position={[0, 0.8, 0]} castShadow>
            <boxGeometry args={[2.2, 1.6, 1.4]} />
            <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.3} />
          </mesh>
          <GenBar worldRef={worldRef} index={i} />
        </group>
      ))}
      {EXIT_DOORS.map((d, i) => (
        <group key={i} position={[d.x, 0, d.z]}>
          <mesh position={[0, 2.5, 0]} castShadow>
            <boxGeometry args={[6, 5, 1]} />
            <DoorMat worldRef={worldRef} index={i} />
          </mesh>
        </group>
      ))}
      <Players worldRef={worldRef} myId={myId} />
    </group>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[ARENA.w, ARENA.h]} />
      <meshStandardMaterial color="#1e293b" />
    </mesh>
  );
}

// GenBar: a thin bar above each generator showing progress, updated each frame.
function GenBar({ worldRef, index }: { worldRef: React.MutableRefObject<WorldState>; index: number }) {
  const ref = useRef<any>(null);
  useFrame(() => {
    if (!ref.current) return;
    const v = worldRef.current.gens[index] ?? 0;
    ref.current.scale.x = Math.max(0.001, v);
    ref.current.position.x = (v - 1) * 1.1;
  });
  return (
    <mesh ref={ref} position={[0, 2.2, 0]}>
      <boxGeometry args={[2.2, 0.25, 0.25]} />
      <meshBasicMaterial color="#facc15" />
    </mesh>
  );
}

function DoorMat({ worldRef, index }: { worldRef: React.MutableRefObject<WorldState>; index: number }) {
  const ref = useRef<any>(null);
  useFrame(() => {
    if (!ref.current) return;
    const open = worldRef.current.doors[index];
    ref.current.color.set(open ? "#22c55e" : "#7f1d1d");
  });
  return <meshStandardMaterial ref={ref} color="#7f1d1d" />;
}

function Players({ worldRef, myId }: {
  worldRef: React.MutableRefObject<WorldState>; myId: string;
}) {
  const w = worldRef.current;
  return (
    <>
      {Object.keys(w.players).map((id) => (
        <PlayerMesh key={id} id={id} worldRef={worldRef} isMe={id === myId} role={w.players[id].role} />
      ))}
    </>
  );
}

function PlayerMesh({ id, worldRef, isMe, role }: {
  id: string; worldRef: React.MutableRefObject<WorldState>; isMe: boolean; role: "survivor" | "killer";
}) {
  const ref = useRef<any>(null);
  const mat = useRef<any>(null);
  useFrame(() => {
    const p = worldRef.current.players[id];
    if (!p || !ref.current) return;
    ref.current.position.set(p.x, 1, p.z);
    ref.current.rotation.y = p.rot;
    if (mat.current) {
      let c = "#22c55e";
      if (p.role === "killer") c = "#ef4444";
      else if (p.state === ST_INJURED) c = "#f97316";
      else if (p.state === ST_DOWNED) c = "#fbbf24";
      else if (p.state === ST_HOOKED) c = "#9333ea";
      else if (p.state === ST_ESCAPE) c = "#38bdf8";
      mat.current.color.set(c);
      mat.current.emissive.set(c);
      mat.current.emissiveIntensity = isMe ? 0.6 : 0.15;
    }
  });
  const r = role === "killer" ? 1.05 : 0.85;
  return (
    <group ref={ref}>
      <mesh castShadow>
        <capsuleGeometry args={[r, 1.4, 4, 12]} />
        <meshStandardMaterial ref={mat} color="#22c55e" />
      </mesh>
      {isMe && (
        <mesh position={[0, 0.4, 0]}>
          <torusGeometry args={[r + 0.3, 0.08, 8, 24]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  );
}

// ---- HUD ----
function Hud({ ui, myRole }: { ui: any; myRole: "survivor" | "killer" }) {
  const done = ui.gens.filter((g: number) => g >= 1).length;
  return (
    <div style={hudStyle}>
      <div style={hudRow}>
        <span style={hudChip}>⚡ {done}/6 gens</span>
        <span style={{ ...hudChip, background: ui.doors.filter(Boolean).length ? "#166534" : "#7f1d1d" }}>
          🚪 {ui.doors.filter(Boolean).length}/3 doors
        </span>
        <span style={hudChip}>{myRole === "killer" ? "🔪 Killer" : "🏃 Survivor"}</span>
        {ui.me.stunT > 0 && <span style={{ ...hudChip, background: "#7c2d12" }}>STUNNED</span>}
        {ui.me.state === ST_DOWNED && <span style={{ ...hudChip, background: "#78350f" }}>DOWNED</span>}
        {ui.me.state === ST_HOOKED && <span style={{ ...hudChip, background: "#581c87" }}>HOOKED</span>}
      </div>
      <div style={hudRow}>
        {ui.canMend && <span style={{ ...hudChip, background: "#1e3a8a" }}>near generator — hold INTERACT</span>}
        {ui.canUnhook && <span style={{ ...hudChip, background: "#14532d" }}>{ui.targetName} is hooked — press UNHOOK</span>}
        {ui.canRevive && <span style={{ ...hudChip, background: "#14532d" }}>{ui.targetName} is downed — press REVIVE</span>}
      </div>
    </div>
  );
}

// ---- Controls overlay (nipplejs joystick + action buttons) ----
function Controls({ myRole, stickRef, onHit, onHook, onUnhook, onRevive, onMendDown, onMendUp, onEscape, canMend, canUnhook, canRevive }: any) {
  return (
    <div style={ctlWrap}>
      <Joystick onChange={(s: Stick) => { stickRef.current = s; }} size={130} />
      <div style={btnCol}>
        {myRole === "survivor" ? (
          <>
            <ActionButton label="MEND" sub="hold" color="#2563eb" onDown={onMendDown} onUp={onMendUp} disabled={!canMend} />
            <ActionButton label="ESC" sub="door" color="#0891b2" onClick={onEscape} />
            <ActionButton label="UNHOOK" color="#16a34a" onClick={onUnhook} disabled={!canUnhook} />
            <ActionButton label="REVIVE" color="#65a30d" onClick={onRevive} disabled={!canRevive} />
          </>
        ) : (
          <>
            <ActionButton label="HIT" sub="swing" color="#dc2626" onClick={onHit} size={100} />
            <ActionButton label="HOOK" sub="downed" color="#7c3aed" onClick={onHook} />
          </>
        )}
      </div>
    </div>
  );
}

const exitStyle: React.CSSProperties = {
  background: "#334155", color: "#e2e8f0", border: "none", borderRadius: 8,
  padding: "8px 14px", fontWeight: 700, cursor: "pointer",
};
const hudStyle: React.CSSProperties = {
  position: "absolute", top: 8, left: 8, zIndex: 15, display: "flex", flexDirection: "column", gap: 6,
  pointerEvents: "none", maxWidth: "70%",
};
const hudRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6 };
const hudChip: React.CSSProperties = {
  background: "#0f172acc", color: "#e2e8f0", padding: "6px 10px", borderRadius: 8,
  fontSize: 12, fontWeight: 700, border: "1px solid #334155",
};
const ctlWrap: React.CSSProperties = {
  position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 18,
  display: "flex", justifyContent: "space-between", alignItems: "flex-end",
  padding: 16, pointerEvents: "none",
};
const btnCol: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 12, pointerEvents: "auto",
};
const overlay: React.CSSProperties = {
  position: "absolute", inset: 0, zIndex: 30, background: "rgba(2,6,23,0.8)",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const overlayCard: React.CSSProperties = {
  background: "#0f172a", border: "1px solid #334155", borderRadius: 16,
  padding: 28, textAlign: "center", display: "flex", flexDirection: "column", gap: 14,
};
