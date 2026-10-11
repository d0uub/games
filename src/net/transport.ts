import { joinRoom, selfId, type Room, type MessageAction } from "trystero";

// P2P room code. Keep it short and unambiguous (no i/l, o/0).
export const ROOM = "game";
const APP = "games";
const NS = "sync";

export interface JoinMsg { t: "join"; id: string; name: string; }
export interface ReadyMsg { t: "ready"; id: string; role: "survivor" | "killer"; name: string; }
export interface StartMsg { t: "start"; players: { id: string; role: "survivor" | "killer"; name: string }[]; }
export interface SyncMsg { t: "sync"; id: string; x: number; z: number; rot: number; state: number; gen: number; }
export interface ActionMsg {
  t: "action"; id: string;
  kind: "hit" | "mend" | "unhook" | "hook" | "escape" | "down" | "revive" | "generator";
  targetId?: string; x?: number; z?: number;
}
export type NetMsg = JoinMsg | ReadyMsg | StartMsg | SyncMsg | ActionMsg;

let room: Room | null = null;
let action: MessageAction<NetMsg> | null = null;
let cb: ((m: NetMsg, from: string) => void) | null = null;

export function initNet(name: string, onMessage: (m: NetMsg, from: string) => void) {
  if (room) { cb = onMessage; return; }
  cb = onMessage;
  room = joinRoom({ appId: APP }, ROOM, {
    onJoinError: (e) => console.warn("[trystero] error", e.error),
  });
  action = room.makeAction<NetMsg>(NS);
  action.onMessage = (data, ctx) => {
    if (!data || (data as { id?: string }).id === selfId) return; // ignore own echoes
    cb?.(data, ctx.peerId);
  };
  // Announce ourselves to any peers currently in the room.
  broadcast({ t: "join", id: selfId, name });
}

export function getMyId() { return selfId; }
export function getMyName() { return ""; }

export function broadcast(m: NetMsg) {
  if (!action) return;
  action.send(m).catch(() => {});
}

export function sendTo(pid: string, m: NetMsg) {
  if (!action) return;
  action.send(m, { target: pid }).catch(() => {});
}

export function peerList(): string[] {
  if (!room) return [];
  try { return Object.keys(room.getPeers() ?? {}); } catch { return []; }
}

export function destroyNet() {
  if (room) { try { room.leave(); } catch { /* ignore */ } room = null; action = null; cb = null; }
}
