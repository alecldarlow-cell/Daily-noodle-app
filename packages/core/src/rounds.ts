/**
 * One unfinished round per puzzle (22 Nov 2026, Alec: "Only one Tally can be part-played at a
 * time" came up too often). As the site's dn-core.js `roundFor`/`keepRound`/`dropRound`/
 * `mergeRounds`: a type's save (`digi-<type>-v1`) keeps `rounds` = {id: round}, each stamped
 * `at` (ms), beside `done`. The old single `cur` slot is still written with the latest round,
 * so older pages and app builds resume it; a puzzle's own round is read first, then `cur` if
 * it is that puzzle's (saves from before).
 */
type Obj = Record<string, unknown>;
const object = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);

/** How many unfinished rounds a type keeps (the newest; the one in play always). */
export const ROUNDS_KEPT = 10;

/** Puzzle `id`'s unfinished round in save `s`, or null (none, or the puzzle is finished). */
export function roundFor(s: unknown, id: string | undefined): Obj | null {
  if (!object(s) || !id || (object(s.done) && s.done[id])) return null;
  const r = object(s.rounds) ? s.rounds[id] : null;
  if (object(r)) return r;
  return object(s.cur) && s.cur.id === id ? s.cur : null;
}

function pruneRounds(rounds: unknown, done: unknown, keep?: string): Obj {
  const out: Obj = {};
  for (const [id, r] of Object.entries(object(rounds) ? rounds : {}))
    if (object(r) && !(object(done) && done[id])) out[id] = r;
  const at = (id: string) => Number((out[id] as Obj).at) || 0;
  const ids = Object.keys(out).sort((a, b) => at(b) - at(a));
  for (const id of ids.slice(ROUNDS_KEPT)) if (id !== keep) delete out[id];
  return out;
}

/** Keeps `round` (it has its puzzle's `id`) in `s.rounds` and `s.cur`, stamped `at` = `now`. */
export function keepRound<T extends Obj>(s: T, round: Obj, now: number): T {
  if (!object(s) || !object(round) || !round.id) return s;
  round.at = now;
  const id = String(round.id);
  const all = Object.assign({}, object(s.rounds) ? s.rounds : {}, { [id]: round });
  (s as Obj).rounds = pruneRounds(all, s.done, id);
  (s as Obj).cur = round;
  return s;
}

/**
 * Takes puzzle `id`'s round out of `s.rounds` (the key goes when none are left). `cur` is
 * the caller's to clear, as before, so a finished save reads exactly as it did.
 */
export function dropRound<T>(s: T, id: string): T {
  if (!object(s) || !id) return s;
  const doc: Obj = s;
  if (!object(doc.rounds) || !(id in doc.rounds)) return s;
  const r: Obj = Object.assign({}, doc.rounds);
  delete r[id];
  if (Object.keys(r).length) doc.rounds = r;
  else delete doc.rounds;
  return s;
}

/**
 * Two copies of `rounds`: every puzzle's round survives, the newer `at` winning (the one in
 * play, `activeId`, always from `a`); finished puzzles' rounds go; the newest ten are kept.
 */
export function mergeRounds(a: unknown, b: unknown, done: unknown, activeId?: string): Obj {
  const out: Obj = Object.assign({}, object(b) ? b : {});
  for (const [id, r] of Object.entries(object(a) ? a : {})) {
    if (!object(r)) continue;
    const o = out[id];
    if (id === activeId || !object(o) || (Number(r.at) || 0) >= (Number(o.at) || 0)) out[id] = r;
  }
  return pruneRounds(out, done, activeId);
}

/** True when save `s` holds a round for puzzle `id`: in `rounds`, or the old `cur` slot. */
export function holdsRound(s: unknown, id: string): boolean {
  if (!object(s)) return false;
  return (object(s.cur) && s.cur.id === id) || (object(s.rounds) && object(s.rounds[id]));
}

/** Takes puzzle `id`'s round out of `rounds` and `cur`, as the engines' clearCur does. */
export function forgetRound<T>(s: T, id: string): T {
  dropRound(s, id);
  if (object(s) && object(s.cur) && s.cur.id === id) delete s.cur;
  return s;
}
