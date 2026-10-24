/** A small seeded generator, so differential inputs are random but repeatable. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]): T => xs[int(0, xs.length - 1)]!;
  const chance = (p: number) => next() < p;
  /** A day in 2026-2028 as YYYY-MM-DD, or near `around` when given. */
  const day = (around?: string) => {
    const base = around ? Date.parse(`${around}T12:00:00Z`) : Date.parse('2026-01-01T12:00:00Z');
    const off = around ? int(-4, 4) : int(0, 3 * 365);
    return new Date(base + off * 864e5).toISOString().slice(0, 10);
  };
  return { next, int, pick, chance, day };
}
export type Rng = ReturnType<typeof rng>;
