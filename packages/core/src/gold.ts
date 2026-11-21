/**
 * Gold stars (21 Nov 2026, Alec; project doc claude/rewards-review-2026-11-21.md): a really good
 * result, about one finish in ten, by fixed rules that are the same every day. A line-for-line
 * port of the site's dnCore.gold (dn-core.js): worked out from the saved result alone, so old
 * results earn gold too, and a result saved on the website wears the same star in the app.
 * Returns the reason shown on the finish sheet ("A perfect ten"), or '' for no gold. Lab types
 * never get gold. Minis saved before the help flag `h` (checks or reveals used) are judged on
 * time alone. Change a threshold only with the site's, on Alec's say-so.
 */
type Rec = Record<string, unknown>;

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Seconds from a record: `s` where it is a time, else the clock text `t` ("0:20", "00:20", "1:02:03"). */
function secsOf(r: Rec): number | null {
  if (num(r.s)) return r.s;
  const m = /^(\d+):(\d\d)(?::(\d\d))?$/.exec(String(r.t ?? ''));
  if (!m) return null;
  return m[3] ? +m[1]! * 3600 + +m[2]! * 60 + +m[3] : +m[1]! * 60 + +m[2]!;
}
const under = (r: Rec, max: number) => {
  const s = secsOf(r);
  return s !== null && s <= max;
};

const GOLD: Record<string, (r: Rec) => string> = {
  mini: (r) => (!r.h && under(r, 40) ? 'Under 0:40 with no checks or reveals' : ''),
  doku: (r) => (under(r, 30) ? 'Under 0:30' : ''),
  sweep: (r) => (r.o === 'win' && under(r, 30) ? 'Swept in under 0:30' : ''),
  path: (r) => (under(r, 20) ? 'Under 0:20' : ''),
  tally: (r) => (under(r, 60) ? 'Under 1:00' : ''),
  link: (r) => (r.o === 'win' && r.m === 0 && under(r, 60) ? 'No mistakes, under 1:00' : ''),
  tangle: (r) => (num(r.s) && r.s >= 40 ? '40 points or more' : ''),
  borders: (r) => (r.c === 10 && (!num(r.p) || r.p >= 1000) ? 'A perfect ten' : ''),
  reckon: (r) => (num(r.p) && r.p >= 750 ? '750 points or more' : ''),
};

/** The gold star's reason for this saved result of this type, or '' when it isn't gold. */
export function gold(type: string, r: unknown): string {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return '';
  const rule = Object.prototype.hasOwnProperty.call(GOLD, type) ? GOLD[type] : undefined;
  return rule ? rule(r as Rec) : '';
}
