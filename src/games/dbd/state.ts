// Player states
export const ST_OK = 0;
export const ST_INJURED = 1;
export const ST_DOWNED = 2;
export const ST_HOOKED = 3;
export const ST_ESCAPE = 4;

export interface PlayerState {
  id: string;
  name: string;
  role: "survivor" | "killer";
  x: number; z: number;
  rot: number;
  state: number;
  hits: number;
  gen: number;         // generator id being mended (-1 none)
  genProgress: number; // 0..1 local progress toward finishing that generator
  actionT: number;     // remaining seconds of an in-progress interaction
  stunT: number;       // remaining hit-stun
}

export interface WorldState {
  players: Record<string, PlayerState>;
  gens: number[];   // 0..1 progress per generator (0..100 => /100)
  doors: boolean[]; // unlocked
  over: "win" | "loss" | null;
  t: number;
}

export function spawnFor(role: "survivor" | "killer", slot: number): { x: number; z: number } {
  if (role === "killer") return { x: 0, z: 0 };
  const spots = [
    { x: -40, z: 0 }, { x: 40, z: 0 }, { x: 0, z: 44 },
  ];
  const s = spots[slot % spots.length];
  return { x: s.x + (slot * 3 % 6), z: s.z + (slot * 5 % 6) };
}

export function createWorld(roster: { id: string; role: "survivor" | "killer"; name: string }[]): WorldState {
  const players: Record<string, PlayerState> = {};
  let survSlot = 0;
  for (const p of roster) {
    const s = p.role === "survivor" ? spawnFor("survivor", survSlot++) : spawnFor("killer", 0);
    players[p.id] = {
      id: p.id, name: p.name, role: p.role,
      x: s.x, z: s.z, rot: 0, state: ST_OK, hits: 0,
      gen: -1, genProgress: 0, actionT: 0, stunT: 0,
    };
  }
  return { players, gens: [0, 0, 0, 0, 0, 0], doors: [false, false, false], over: null, t: 0 };
}
