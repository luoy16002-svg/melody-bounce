// The confetti burst at the end of a card. Pure and seeded, so the picture and the soundtrack agree on when each
// coin hits the floor.

export const W = 1080, H = 1920, FLOOR = H - 150, GRAVITY = 2100;
export const BURST_DELAY = 0.55;

export type Piece = {x0: number; y0: number; vx: number; vy: number; spin: number; size: number; hue: number; coin: boolean; seed: number};

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pieces(originX: number, originY: number, hues: number[]): Piece[] {
  const rand = mulberry32(20261002);
  return Array.from({length: 210}, (_, i) => {
    const coin = i % 10 === 0;
    const angle = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.15;
    const speed = (coin ? 1050 : 800) + rand() * 900;
    return {
      x0: originX + (rand() - 0.5) * 40, y0: originY + (rand() - 0.5) * 30,
      vx: Math.cos(angle) * speed * 0.8, vy: Math.sin(angle) * speed,
      spin: (rand() - 0.5) * 14, size: coin ? 17 : 12 + rand() * 14,
      hue: hues[Math.floor(rand() * hues.length)], coin, seed: i,
    };
  });
}

/** Position of a piece `dt` seconds after the burst. Coins bounce on the floor, paper settles with drag. */
export function place(p: Piece, dt: number): {x: number; y: number; angle: number; landed: number[]} {
  const landed: number[] = [];
  if (!p.coin) {
    const drag = 1.6, k = (1 - Math.exp(-drag * dt)) / drag;
    const terminal = 260, fall = Math.min(dt, 6);
    const x = p.x0 + p.vx * k + Math.sin(dt * 3 + p.seed) * 18;
    const y = Math.min(FLOOR, p.y0 + p.vy * k + terminal * (fall - k) + Math.sin(dt * 2.3 + p.seed) * 8);
    return {x, y, angle: p.spin * dt, landed};
  }
  // Coins: ballistic arcs with a few bounces, each landing is a note.
  let t = dt, x = p.x0, y = p.y0, vy = p.vy, vx = p.vx, clock = 0;
  for (let bounce = 0; bounce < 6; bounce++) {
    const a = GRAVITY / 2, b = vy, c = y - FLOOR;
    const hit = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
    if (t < hit) return {x: x + vx * t, y: y + vy * t + a * t * t, angle: p.spin * dt, landed};
    landed.push(clock + hit);
    x += vx * hit; y = FLOOR; vy = -(vy + GRAVITY * hit) * 0.52; vx *= 0.8; t -= hit; clock += hit;
    if (Math.abs(vy) < 120) return {x, y: FLOOR, angle: p.spin * (clock), landed};
  }
  return {x, y: FLOOR, angle: 0, landed};
}

/** Seconds after the burst at which coins hit the floor. */
export function coinLandings(all: Piece[]): number[] {
  return all.filter(p => p.coin).flatMap(p => place(p, 60).landed).sort((a, b) => a - b);
}
