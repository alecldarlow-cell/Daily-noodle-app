import { dayBefore } from '@noodle/core';

import {
  apply,
  ATLAS_KEY,
  atlasAdd,
  atlasCount,
  colourOf,
  frame,
  gate,
  homeView,
  init,
  loadSave,
  defaults,
  mmss,
  noteFor,
  quizView,
  recapTiles,
  slug,
  validate,
  type BordersSave,
  type BordersState,
  type Host,
  type Move,
} from '../model';
import { borders15, clone } from './fixtures';

function kv(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

function testHost(store = kv()) {
  const h = { t: 1000, saved: [] as BordersSave[] };
  const host: Host = {
    now: () => h.t,
    today: () => '2026-10-19',
    persist: (s) => {
      h.saved.push(JSON.parse(JSON.stringify(s)));
      return s;
    },
    atlasAdd: (n) => atlasAdd(store, n),
  };
  return { h, host, store };
}

const right = (s: BordersState) => s.P.qs[s.cur!.i]!.o.indexOf(s.P.qs[s.cur!.i]!.n);
const wrong = (s: BordersState) => s.P.qs[s.cur!.i]!.o.findIndex((n) => n !== s.P.qs[s.cur!.i]!.n);

describe('GIVEN Borders’ ship gate', () => {
  it('THEN the published day passes and broken ones fail as the engine says', () => {
    expect(gate(borders15, '2026-10-19')).toEqual([]);
    expect(validate(borders15).ok).toBe(true);
    expect(gate(undefined)).toEqual(['no puzzle object']);
    expect(gate({ ...borders15, qs: [] })).toEqual(['expected 10 questions']);
    const bad = clone(borders15);
    bad.id = 'x';
    bad.qs[0]!.t = 3;
    bad.qs[1]!.n = bad.qs[2]!.n;
    bad.qs[3]!.i = 500;
    bad.qs[4]!.K = Number.NaN;
    bad.qs[5]!.d = 'M0 0';
    bad.qs[6]!.o = ['a', 'b', 'c', 'd'];
    (bad.qs[7] as unknown as { n: string }).n = '';
    expect(gate(bad, '2026-10-20')).toEqual([
      'id x',
      'dn:date 2026-10-20 != 2026-10-19',
      'q1 tier 3, plan wants 1',
      'q2 options', // its answer was renamed, so it isn't among its names
      'q3 repeats ' + bad.qs[2]!.n,
      'q4 atlas index',
      'q5 K',
      'q6 outline',
      'q7 options',
      'q8 no name',
    ]);
  });
});

describe('GIVEN Borderline’s atlas', () => {
  it('THEN a country is new once, counted every time, and other fields are kept', () => {
    const store = kv({ [ATLAS_KEY]: JSON.stringify({ v: 1, found: { peru: 1 }, best: 3 }) });
    expect(atlasAdd(store, 'Côte d’Ivoire')).toBe(true);
    expect(atlasAdd(store, 'Côte d’Ivoire')).toBe(false);
    expect(atlasAdd(store, 'Peru')).toBe(false);
    expect(JSON.parse(store.getItem(ATLAS_KEY)!)).toEqual({
      v: 1,
      found: { peru: 2, 'cote-d-ivoire': 2 },
      best: 3,
    });
    expect(atlasCount(store.getItem(ATLAS_KEY))).toBe(2);
  });

  it('THEN no atlas yet starts one, and a save that isn’t an atlas is left alone', () => {
    const fresh = kv();
    expect(atlasAdd(fresh, 'Cuba')).toBe(true);
    expect(JSON.parse(fresh.getItem(ATLAS_KEY)!)).toEqual({ v: 1, found: { cuba: 1 } });
    const other = kv({ [ATLAS_KEY]: '{"v":2}' });
    expect(atlasAdd(other, 'Cuba')).toBe(false);
    expect(other.getItem(ATLAS_KEY)).toBe('{"v":2}');
    expect(atlasCount('{broken')).toBe(0);
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(atlasAdd(failing, 'Cuba')).toBe(false);
    expect(slug('São Tomé and Príncipe')).toBe('sao-tome-and-principe');
  });
});

describe('GIVEN the save', () => {
  it('THEN a v1 document lays over the defaults, anything else is the defaults', () => {
    expect(loadSave(null)).toEqual(defaults());
    expect(loadSave({ v: 1, seenCoach: true })).toMatchObject({
      seenCoach: true,
      done: {},
      fs: true,
    });
    expect(loadSave({ v: 9 })).toEqual(defaults());
    expect(mmss(61)).toBe('1:01');
    expect(mmss(3661)).toBe('1:01:01');
    expect(colourOf({ i: 0 })).toBe('#D6C8E8');
  });
});

describe('GIVEN a round being played', () => {
  it('THEN a right answer scores 100, 50 after a hint, a miss nothing, with no bonus for answers in a row', () => {
    const { h, host, store } = testHost();
    let s = apply(init(borders15, null, 0), { t: 'play' }, host);
    expect(quizView(s)).toMatchObject({
      ticks: ['cur', '', '', '', '', '', '', '', '', ''],
      hintHidden: false,
      nextHidden: true,
      coachOff: false,
    });
    const gains: number[] = [];
    for (let i = 0; i < 10; i++) {
      const before = s.cur!.pts;
      if (i === 2) {
        s = apply(s, { t: 'hint' }, host);
        expect(quizView(s)).toMatchObject({ inset: true, hintDisabled: true });
        s = apply(s, { t: 'hint' }, host);
        expect(s.hints).toBe(1);
      }
      s = apply(s, { t: 'answer', k: i === 7 ? wrong(s) : right(s) }, host);
      s = apply(s, { t: 'answer', k: 0 }, host); // locked: a second tap does nothing
      gains.push(s.cur!.pts - before);
      h.t += 1000;
      if (i < 9) s = apply(s, { t: 'next' }, host);
    }
    // Alec, 26 Oct 2026 (site first, dailynoodle#35): the run bonus is gone.
    expect(gains).toEqual([100, 100, 50, 100, 100, 100, 100, 0, 100, 100]);
    expect(s.cur!.ans[2]).toMatchObject({ ok: true, h: true, nw: true });
    expect(s.save.seenCoach).toBe(true);
    const v = quizView(s);
    expect(v.nextLabel).toBe('See result');
    expect(v.plate).toEqual({ name: borders15.qs[9]!.n, line: 'New in your atlas. +100 points' });
    expect(v.options.filter((o) => o.mark === 'right')).toHaveLength(1);
    expect(atlasCount(store.getItem(ATLAS_KEY))).toBe(9);
    s = apply(s, { t: 'next' }, host);
    expect(s.finishing).toBe(true);
  });

  it('THEN a wrong name is marked, the right one shown, the others dimmed', () => {
    const { host } = testHost();
    let s = apply(init(borders15, null, 0), { t: 'play' }, host);
    const k = wrong(s);
    s = apply(s, { t: 'answer', k }, host);
    const v = quizView(s);
    expect(v.options[k]!.mark).toBe('wrong');
    expect(v.options.map((o) => o.mark).sort()).toEqual(['dim', 'dim', 'right', 'wrong']);
    expect(v.plate!.line).toBe('Not this time.');
    expect(v.ticks[0]).toBe('bad');
    expect(v).toMatchObject({ hintHidden: true, nextHidden: false, revealed: true, inset: true });
  });

  it('THEN paused time doesn’t count; Back to start leaves the round; Resume picks it up', () => {
    const { h, host } = testHost();
    let s = apply(init(borders15, null, 0), { t: 'play' }, host);
    frame(s, 1016);
    s = apply(s, { t: 'answer', k: right(s) }, host);
    s = apply(s, { t: 'pause' }, host);
    s = apply(s, { t: 'pause' }, host);
    s = apply(s, { t: 'next' }, host);
    expect(s.cur!.i).toBe(0);
    frame(s, 9000);
    expect(s.cur!.secs).toBeCloseTo(0.016, 9);
    h.t = 9500;
    s = apply(s, { t: 'quit' }, host);
    expect(s.view).toBe('home');
    expect(homeView(s, '2026-10-19', dayBefore)).toEqual({
      stats: ['0', '0', '0'],
      status: 'Question 2 of 10, 100 points so far.',
      button: 'Resume',
    });
    s = apply(s, { t: 'play' }, host);
    expect(s.cur!.i).toBe(1);
    expect(s.cur!.run).toBe(1);
    s = apply(s, { t: 'pause' }, host);
    s = apply(s, { t: 'resume' }, host);
    expect(s.paused).toBe(false);
  });

  it('THEN a round whose tenth was answered goes straight to its result on Resume', () => {
    const { host } = testHost();
    const ans = Array.from({ length: 10 }, () => ({ k: 0, ok: false, h: false, nw: false }));
    const s = apply(
      init(borders15, { v: 1, cur: { id: borders15.id, i: 9, ans, pts: 0, run: 0, secs: 4 } }, 0),
      { t: 'play' },
      host,
    );
    expect(s.finishing).toBe(true);
    expect(() => apply(s, { t: 'reload' } as Move, host)).toThrow();
  });
});

describe('GIVEN a finished round', () => {
  const rec = (ok: boolean[], nw = 0) => ({
    c: ok.filter(Boolean).length,
    p: 0,
    secs: 1,
    ans: ok.map((o, i) => ({ k: 0, ok: o, h: i === 0, nw: i < nw })),
    on: '2026-10-19',
  });
  it('THEN the note names the misses and counts what’s new in the atlas', () => {
    const all = Array(10).fill(true) as boolean[];
    expect(noteFor(borders15, rec(all))).toBe('All ten named.');
    expect(
      noteFor(
        borders15,
        rec(
          all.map((x, i) => i !== 2),
          1,
        ),
      ),
    ).toBe(`You missed ${borders15.qs[2]!.n}. One new country in your atlas.`);
    expect(
      noteFor(
        borders15,
        rec(
          all.map((x, i) => i > 2),
          3,
        ),
      ),
    ).toBe(
      `You missed ${borders15.qs[0]!.n}, ${borders15.qs[1]!.n} and ${borders15.qs[2]!.n}. Three new countries in your atlas.`,
    );
    const tiles = recapTiles(borders15, rec(all.map((x, i) => i !== 1)));
    expect(tiles[0]).toMatchObject({ ok: true, caption: `${borders15.qs[0]!.n} (map)` });
    expect(tiles[1]).toMatchObject({ ok: false, caption: borders15.qs[1]!.n });
  });

  it('THEN a page opened on it shows the sheet', () => {
    const s = init(borders15, { v: 1, done: { [borders15.id]: rec([true]) } }, 0);
    expect(s.view).toBe('winModal');
  });
});
