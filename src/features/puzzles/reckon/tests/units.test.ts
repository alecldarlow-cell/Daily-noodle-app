/* Reckon's imperial switch (16 Nov 2026): units.ts against the site's own units block (the fixture is
   written by scripts/reckon-units-fixture.js from dailynoodle engines/reckon.js), and the model's switch. */
import {
  apply,
  init,
  ladder,
  ladderOf,
  playView,
  recapRows,
  zone,
  type Host,
  type Move,
  type ReckonSave,
  type ReckonState,
} from '../model';
import * as units from '../units';
import { reckon2 } from './fixtures';
import fixture from './units-fixture.json';

interface Row {
  q: { q: string; u: string; a: number; n: string; lo: number };
  spec: units.Spec | null;
  rungs?: { n: number; first: number; last: number; hash: number };
  answer?: string;
}
const rows = fixture as Row[];

function hash(r: number[]): number {
  let h = 0x811c9dc5;
  for (const ch of r.map((v) => String(+v.toPrecision(12))).join(',')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

describe('GIVEN every Reckon fact with a metric unit, as the site converts it', () => {
  it('THEN the app converts each one exactly as the site does', () => {
    expect(rows.length).toBeGreaterThan(500);
    for (const r of rows) {
      const s = units.spec(r.q);
      expect([r.q.q, s]).toEqual([r.q.q, r.spec]);
      if (!s) continue;
      const rg = units.rungs(r.q.lo, s, ladder);
      expect([
        r.q.q,
        { n: rg.length, first: rg[0], last: rg[rg.length - 1], hash: hash(rg) },
      ]).toEqual([r.q.q, r.rungs]);
      expect(units.text(r.q.a * s.f, s.du)).toBe(r.answer);
    }
  });

  it('THEN every imperial rung scores exactly as the metric guess it is kept as', () => {
    for (const r of rows) {
      const s = units.spec(r.q);
      if (!s) continue;
      for (const v of units.rungs(r.q.lo, s, ladder))
        expect(zone(v / s.f, r.q.a)).toBe(zone(v, r.q.a * s.f));
    }
  });
});

describe('GIVEN numbers in feet and inches', () => {
  it('THEN they read as Brits write them', () => {
    expect(units.text(2 * units.U.m!.f, 'ft')).toBe('6 ft 7 in');
    expect(units.text(175 * units.U.cm!.f, 'in')).toBe('5 ft 9 in');
    expect(units.parts(66, 'in')).toEqual([
      ['5', 'ft'],
      ['6', 'in'],
    ]);
    expect(units.text(431 * units.U.km!.f, 'miles')).toBe('268 miles');
    expect(units.note('Around 100 to 110 km/h, but only in short bursts.')).toBe(
      'Around 62 to 68 mph, but only in short bursts.',
    );
    expect(units.note('About 188 km (117 miles).')).toBe('About 188 km (117 miles).');
  });
});

/* ---------- the switch in the model ---------- */

function testHost() {
  const h = { t: 1000, saved: [] as ReckonSave[] };
  const host: Host = {
    now: () => h.t,
    today: () => '2026-10-21',
    persist: (s) => {
      h.saved.push(JSON.parse(JSON.stringify(s)));
      return s;
    },
  };
  return { h, host };
}
function run(moves: Move[], s0: ReckonState = init(reckon2, null, 0)) {
  const { h, host } = testHost();
  let s = s0;
  for (const m of moves) {
    s = apply(s, m, host);
    h.t += 500;
  }
  return { s, h, host };
}
/** Where the answer sits on the question on screen's scale (0–1). */
const at = (q: { a: number; lo: number }) => (Math.log10(q.a) - q.lo) / 2;
const onAnswer = (k: number): Move => ({ t: 'drag', fr: at(reckon2.qs[k]!) });

describe('GIVEN Reckon 2’s second question (Veryovkina, in metres)', () => {
  const toQ2: Move[] = [{ t: 'play' }, onAnswer(0), { t: 'act' }, { t: 'act' }];

  it('WHEN the player has not switched THEN it reads metres, with m | feet offered, metric pressed', () => {
    const v = playView(run(toQ2).s);
    expect(v.question).toBe('How deep is Veryovkina, the deepest known cave, in metres?');
    expect(v.units).toEqual({ metric: 'm', imperial: 'feet', on: false });
    expect(v.unit).toBe('m');
  });

  it('WHEN the player switches to feet THEN the question, reading and scale convert, the guess stays put, and the setting and tip are saved once', () => {
    const { s: s0 } = run([...toQ2, onAnswer(1)]);
    const before = playView(s0);
    const { s, h } = run([{ t: 'units', imp: true }], s0);
    const v = playView(s);
    expect(v.question).toBe('How deep is Veryovkina, the deepest known cave, in feet?');
    expect(v.units).toEqual({ metric: 'm', imperial: 'feet', on: true });
    expect(v.unit).toBe('ft');
    expect(Math.abs(v.thumbAt - before.thumbAt)).toBeLessThan(1);
    expect(+v.guess.replace(/,/g, '') / +before.guess.replace(/,/g, '')).toBeCloseTo(3.2808, 1);
    expect(v.unitTip).toBe('Lengths stay in feet and inches until you switch back.');
    expect(s.save.un).toEqual({ len: 'i' });
    expect(s.save.unT).toEqual({ len: 1 });
    expect(h.saved.at(-1)!.un).toEqual({ len: 'i' });
    // the guess is kept in metres
    expect(Math.abs(Math.log10(s.R!.cur! / reckon2.qs[1]!.a))).toBeLessThan(0.02);
    // switching back and forth again shows no second tip
    const again = run(
      [
        { t: 'units', imp: false },
        { t: 'units', imp: true },
      ],
      s,
    ).s;
    expect(playView(again).unitTip).toBeNull();
  });

  it('WHEN a bullseye is locked in feet THEN it scores as in metres, the answer and recap read in feet, and distances stay metric', () => {
    const toLock: Move[] = [...toQ2, { t: 'units', imp: true }, onAnswer(1), { t: 'act' }];
    const s2 = run(toLock).s;
    const v = playView(s2);
    expect(v.feedback!.verdict).toBe('Bullseye');
    expect(v.feedback!.answerParts).toEqual([['7,260', 'ft']]);
    expect(s2.R!.g[1]! / reckon2.qs[1]!.a).toBeGreaterThan(0.95);
    expect(s2.R!.g[1]! / reckon2.qs[1]!.a).toBeLessThan(1.05);
    // switching on the reveal changes only how it reads
    const back = playView(run([{ t: 'units', imp: false }], s2).s);
    expect(back.feedback!.answerParts).toEqual([['2,212', 'm']]);
    expect(back.feedback!.verdict).toBe('Bullseye');
    // q4 is in kilometres: a different kind, still metric
    const s4 = run([...toLock, { t: 'act' }, onAnswer(2), { t: 'act' }, { t: 'act' }]).s;
    expect(playView(s4).question).toMatch(/in kilometres\?$/);
    expect(playView(s4).units!.on).toBe(false);
    const rows2 = recapRows(reckon2, { p: 0, b: 0, z: s4.R!.z, g: s4.R!.g, secs: 0 }, s4.save.un);
    expect(rows2[1]!.line).toMatch(/ft · answer 7,260 ft$/);
  });

  it('WHEN a question has no convertible unit THEN there is no switch and the move does nothing', () => {
    const s = run([{ t: 'play' }]).s;
    expect(playView(s).units).toBeNull();
    const after = run([{ t: 'units', imp: true }], s).s;
    expect(after.save.un).toBeUndefined();
    expect(ladderOf(after)).toEqual(ladderOf(s));
  });

  it('WHEN paused THEN the switch does nothing', () => {
    const s = run([...toQ2, { t: 'pause' }, { t: 'units', imp: true }]).s;
    expect(s.save.un).toBeUndefined();
  });
});

describe('GIVEN a wingspan of 2 m', () => {
  it('THEN the question asks in feet and inches and the reading is two parts', () => {
    const sp = units.spec({
      q: 'What is the wingspan of a golden eagle, in metres?',
      u: 'm',
      a: 2,
    })!;
    expect(sp.q).toBe('What is the wingspan of a golden eagle, in feet and inches?');
    const r = units.rungs(-0.593, sp, ladder);
    expect(r.every((v) => Math.abs(v * 12 - Math.round(v * 12)) < 1e-9 || v >= 10)).toBe(true);
  });
});
