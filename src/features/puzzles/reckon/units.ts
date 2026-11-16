/**
 * Reckon's imperial switch (16 Nov 2026, Alec's call after a tester asked for miles).
 *
 * A line-for-line port of the site's `units` block in `engines/reckon.js` (`dnUnits`), checked
 * against a fixture written from it (tests/units.test.ts). Display only: every guess is kept and
 * scored in the fact's own metric unit, so a guess scores the same either way. Change both together.
 */

export type Kind = 'dist' | 'len' | 'area' | 'speed' | 'mass' | 'vol';
interface Big {
  at: number;
  iw: string;
  du: string;
  f: number;
}
interface Unit {
  k: Kind;
  w: string;
  iw: string;
  du: string;
  f: number;
  big?: Big;
}

// metric unit → kind (one remembered setting per kind), the question's word, its imperial word,
// the readout unit and factor (imperial = metric × f); litres switch to gallons from 20 l up
export const U: Record<string, Unit> = {
  km: { k: 'dist', w: 'kilometres', iw: 'miles', du: 'miles', f: 0.621371192237334 },
  m: { k: 'len', w: 'metres', iw: 'feet', du: 'ft', f: 3.280839895013123 },
  cm: { k: 'len', w: 'centimetres', iw: 'inches', du: 'in', f: 0.393700787401575 },
  'km²': {
    k: 'area',
    w: 'square kilometres',
    iw: 'square miles',
    du: 'sq miles',
    f: 0.386102158542446,
  },
  'm²': { k: 'area', w: 'square metres', iw: 'square feet', du: 'sq ft', f: 10.76391041670972 },
  hectares: { k: 'area', w: 'hectares', iw: 'acres', du: 'acres', f: 2.471053814671653 },
  'km/h': { k: 'speed', w: 'km per hour', iw: 'miles per hour', du: 'mph', f: 0.621371192237334 },
  kg: { k: 'mass', w: 'kilograms', iw: 'pounds', du: 'lb', f: 2.204622621848776 },
  g: {
    k: 'mass',
    w: 'grams',
    iw: 'ounces',
    du: 'oz',
    f: 0.03527396194958,
    big: { at: 453.59237, iw: 'pounds', du: 'lb', f: 0.002204622621849 },
  },
  tonnes: { k: 'mass', w: 'tonnes', iw: 'tons', du: 'tons', f: 0.984206527611061 },
  litres: {
    k: 'vol',
    w: 'litres',
    iw: 'pints',
    du: 'pints',
    f: 1.759753986392702,
    big: { at: 20, iw: 'gallons', du: 'gallons', f: 0.219969248299088 },
  },
  ml: { k: 'vol', w: 'millilitres', iw: 'fluid ounces', du: 'fl oz', f: 0.035195079727854 },
};
// the tip after the first switch, per kind
const KIND: Record<Kind, string> = {
  dist: 'Distances stay in miles until you switch back.',
  len: 'Lengths stay in feet and inches until you switch back.',
  area: 'Areas stay in imperial units until you switch back.',
  speed: 'Speeds stay in mph until you switch back.',
  mass: 'Weights stay in pounds, ounces and tons until you switch back.',
  vol: 'Volumes stay in pints and gallons until you switch back.',
};
// the switch's imperial label
const SW: Record<string, string> = {
  miles: 'miles',
  ft: 'feet',
  in: 'inches',
  'sq miles': 'sq miles',
  'sq ft': 'sq ft',
  acres: 'acres',
  mph: 'mph',
  lb: 'lb',
  oz: 'oz',
  tons: 'tons',
  pints: 'pints',
  gallons: 'gallons',
  'fl oz': 'fl oz',
};
// a question that already names an imperial unit (km in a mile, grams in an ounce) keeps metric only
const IMP =
  /\b(miles?|inch|inches|foot|feet|ft|yards?|(?:in|per) a stone|\d+ stones?|pounds?|lbs?|ounces?|oz|pints?|gallons?|mph|acres?)\b/i;
const NUM = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
const NU =
  'km²|m²|km/h|km|cm|m|kg|g|tonnes|tonne|litres|litre|ml|hectares|kilometres|kilometre|centimetres|centimetre|metres|metre|kilograms|kilogram|grams|gram';
const NRX = () =>
  new RegExp(
    NUM + '(?:( to | and |–)' + NUM + ')?( million| billion)? (' + NU + ')(?![\\w²/-])',
    'g',
  );
const NAMES: Record<string, string> = {
  kilometres: 'km',
  kilometre: 'km',
  centimetres: 'cm',
  centimetre: 'cm',
  metres: 'm',
  metre: 'm',
  kilograms: 'kg',
  kilogram: 'kg',
  grams: 'g',
  gram: 'g',
  tonne: 'tonnes',
  litre: 'litres',
};
const ONE: Record<string, string> = {
  miles: 'mile',
  pints: 'pint',
  gallons: 'gallon',
  acres: 'acre',
  tons: 'ton',
};
const NOUNLESS =
  /^ (of|from|up|down|long|wide|high|tall|deep|thick|across|away|by|in|on|and|or|to|at|per|into|under|over|above|below|before|after|through|lower|higher|taller|longer|shorter|off|including|between|more|less|a|an|the)\b/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function group(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function sig(v: number, s: number): number {
  return v === 0 ? 0 : +v.toPrecision(s);
}
/** A number to s significant figures, worded as the game words its numbers. */
function num(v: number, s: number): string {
  v = sig(v, s);
  if (v >= 1e9) return String(+(v / 1e9).toPrecision(3)) + ' billion';
  if (v >= 1e6) return String(+(v / 1e6).toPrecision(3)) + ' million';
  if (v >= 1000) return group(v);
  return String(v);
}
export type Parts = [string, string][];
/** Inches as feet and inches: [['5','ft'],['6','in']]. */
function ftin(inches: number): Parts {
  const r = Math.round(inches);
  const ft = Math.floor(r / 12);
  const i = r % 12;
  if (!ft) return [[String(i), 'in']];
  return i
    ? [
        [String(ft), 'ft'],
        [String(i), 'in'],
      ]
    : [[String(ft), 'ft']];
}
function inFtin(v: number, du: string): boolean {
  return (du === 'ft' && v < 10 - 1 / 24) || (du === 'in' && v >= 12 - 0.5 && v < 120);
}
/** A display value as readout parts, [[number, unit], …]; s = significant figures (3 on the scale). */
export function parts(v: number, du: string, s?: number): Parts {
  if (inFtin(v, du)) return ftin(du === 'ft' ? v * 12 : v);
  return [[num(v, s || 3), du]];
}
export function text(v: number, du: string, s?: number): string {
  return parts(v, du, s)
    .map((p) => p[0] + ' ' + p[1])
    .join(' ');
}

export interface Spec {
  k: Kind;
  f: number;
  du: string;
  mu: string;
  iu: string;
  q: string;
  n: string;
  tip: string;
}

/** The fact's imperial view, or null when it keeps metric only. */
export function spec(
  q: { q: string; u: string; a: number; n?: string } | null | undefined,
): Spec | null {
  const m = q && U[q.u];
  if (!q || !m || IMP.test(q.q)) return null;
  const b = m.big && q.a >= m.big.at - 1e-9 ? m.big : null;
  let iw = b ? b.iw : m.iw;
  const du = b ? b.du : m.du;
  const f = b ? b.f : m.f;
  if (inFtin(q.a * f, du)) iw = 'feet and inches';
  const qi = q.q.replace(new RegExp('\\b(in|many) ' + esc(m.w) + '\\b'), '$1 ' + iw);
  return { k: m.k, f, du, mu: q.u, iu: SW[du]!, q: qi, n: note(q.n || ''), tip: KIND[m.k] };
}

/** The note's metric figures, converted; a note that already gives imperial is left as written. */
export function note(n: string): string {
  if (!n || IMP.test(n)) return n;
  return n.replace(
    NRX(),
    (
      all: string,
      a: string,
      sep: string | undefined,
      b: string | undefined,
      mult: string | undefined,
      unit: string,
      at: number,
      src: string,
    ) => {
      const key = NAMES[unit] || unit;
      const m = U[key];
      if (!m) return all;
      const x = mult === ' billion' ? 1e9 : mult === ' million' ? 1e6 : 1;
      const va = parseFloat(a.replace(/,/g, '')) * x;
      const vb = b ? parseFloat(b.replace(/,/g, '')) * x : null;
      const top = vb == null ? va : vb;
      const use: { f: number; du: string } = m.big && top >= m.big.at ? m.big : m;
      // as many figures as the note gives (2 or 3), one more for an exact figure, so "93 m" reads 305 ft as the
      // answer does while "about 76 m" stays a round "about 250 ft"
      const rough =
        /\b(about|around|roughly|nearly|almost|some|over|under|more than|less than|up to|than) $/i.test(
          src.slice(0, at),
        )
          ? 0
          : 1;
      const s = (t: string) =>
        Math.max(
          2,
          Math.min(3, t.replace(/[,.]/g, '').replace(/^0+/, '').replace(/0+$/, '').length + rough),
        );
      let sa = s(a);
      let sb = b ? s(b) : sa;
      if (b) sa = sb = Math.min(sa, sb);
      if (vb == null) {
        let t = text(va * use.f, use.du, sa);
        const one1 = ONE[use.du];
        // "a 3.8 km swim" → "a 2.36-mile swim": a figure used as an adjective takes the singular
        if (
          one1 &&
          /\b(a|an|two|three|four|five|six|seven|eight|nine|ten)\s$/i.test(src.slice(0, at)) &&
          /^ [a-z]+/.test(src.slice(at + all.length)) &&
          !NOUNLESS.test(src.slice(at + all.length))
        )
          t = t.replace(/ \S+$/, '-' + one1);
        return t;
      }
      const pa = parts(va * use.f, use.du, sa);
      const pb = parts(vb * use.f, use.du, sb);
      // "62 to 68 mph": the unit once, unless a side is in feet and inches
      const one = pa.length === 1 && pb.length === 1 && pa[0]![1] === pb[0]![1];
      const left = one ? pa[0]![0] : pa.map((p) => p[0] + ' ' + p[1]).join(' ');
      return left + (sep === '–' ? '–' : sep) + pb.map((p) => p[0] + ' ' + p[1]).join(' ');
    },
  );
}

/** The imperial scale's rungs, in display units; feet and inches round to whole inches. */
export function rungs(
  lo: number,
  sp: Spec,
  ladder: (lo: number, isInt: boolean) => number[],
): number[] {
  const dlo = lo + Math.log10(sp.f);
  const min = Math.pow(10, dlo) * 0.9999;
  const max = Math.pow(10, dlo + 2) * 1.0001;
  const out: number[] = [];
  for (let v of ladder(dlo, false)) {
    if (inFtin(v, sp.du)) v = sp.du === 'ft' ? Math.round(v * 12) / 12 : Math.round(v);
    if (v >= min && v <= max && (!out.length || Math.abs(out[out.length - 1]! - v) > 1e-9))
      out.push(v);
  }
  return out;
}
