/** Kleiner, reproduzierbarer Zufallsgenerator (mulberry32). Liefert Zahlen in [0, 1). */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (rnd: Rng, min: number, max: number): number => min + Math.floor(rnd() * (max - min + 1));
export const randRange = (rnd: Rng, min: number, max: number): number => min + rnd() * (max - min);
export const pick = <T>(rnd: Rng, items: readonly T[]): T => items[Math.floor(rnd() * items.length)];
export const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);
