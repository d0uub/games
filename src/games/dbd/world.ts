// Shared world definition for the Dead by Daylight match.
export const ARENA = { w: 100, h: 100 }; // square arena half-extents are w/2, h/2
export const WALL = ARENA.w / 2;

export interface Obstacle { x: number; z: number; sx: number; sz: number; h: number; }
export const OBSTACLES: Obstacle[] = [
  { x: -28, z: -20, sx: 10, sz: 10, h: 6 },
  { x: 24, z: -30, sx: 14, sz: 8, h: 7 },
  { x: 0, z: 26, sx: 12, sz: 12, h: 6 },
  { x: -34, z: 30, sx: 8, sz: 16, h: 7 },
  { x: 36, z: 24, sx: 10, sz: 10, h: 6 },
  { x: -6, z: -38, sx: 16, sz: 8, h: 6 },
  { x: 14, z: 6, sx: 8, sz: 8, h: 5 },
];

export interface GenSpot { x: number; z: number; }
export const GENERATORS: GenSpot[] = [
  { x: -40, z: 0 }, { x: 40, z: 0 }, { x: 0, z: -44 }, { x: 0, z: 44 },
  { x: -44, z: 44 }, { x: 44, z: -44 },
];

export interface ExitDoor { x: number; z: number; }
export const EXIT_DOORS: ExitDoor[] = [
  { x: 0, z: -50 }, { x: -50, z: 0 }, { x: 50, z: 0 },
];

// Tunables
export const SURV_SPEED = 7.2;
export const KILLER_SPEED = 6.0;
export const SURV_RADIUS = 0.8;
export const KILLER_RADIUS = 1.0;
export const MEND_TIME = 8;       // seconds at a generator to finish (alone)
export const HOOK_DURATION = 25;  // seconds pinned to a hook
export const HIT_STUN = 2.2;      // seconds after a hit before you can act again
export const CHARGE_TIME = 4;     // seconds killer must hold near a survivor
export const REVIVE_TIME = 3;     // seconds to revive a downed survivor
export const INTERACT_RANGE = 4.5;
export const HIT_RANGE = 5.5;
export const DOWN_AFTER_HITS = 2; // hits until downed
