/**
 * Differential tests: @noodle/core against the site's own code (vendored by
 * scripts/vendor-site.js), on seeded random inputs. Any difference fails.
 */
import { dayBefore, londonDay } from '../london';
import { createSaveStore, mergeProgress, mergeStreak } from '../saves';
import {
  bumpPathStreak,
  bumpSolveStreak,
  livePathStreak,
  recordResultStreak,
  seedDokuStreak,
} from '../streaks';
import { clock, playedState, resultText, shownClock } from '../played';
import { dnNum, dnStreak, dnSweepDay, dnTime, linkRow, shareLink, shareSweep } from '../share';
import { PUZZLE_TYPES, type PuzzleType } from '../ids';
import type { GridStreak, SaveDoc } from '../types';
import { fakeStorage, loadDnCore, loadSite } from './site';
import { rng, type Rng } from './gen';

const clone = <T>(x: T): T => (x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T));

/** Instants spread over 2026-2028, a third of them within an hour of London midnight
 * and a third within two days of a clock change. */
function instants(r: Rng, n: number): number[] {
  const changes = [
    '2026-03-29T01:00:00Z',
    '2026-10-25T01:00:00Z',
    '2027-03-28T01:00:00Z',
    '2027-10-31T01:00:00Z',
    '2028-03-26T01:00:00Z',
    '2028-10-29T01:00:00Z',
  ].map(Date.parse);
  const lo = Date.parse('2026-01-01T00:00:00Z');
  const hi = Date.parse('2028-12-31T23:59:59Z');
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const k = i % 3;
    if (k === 0) out.push(lo + Math.floor(r.next() * (hi - lo)));
    else if (k === 1) {
      const d = Date.parse(`${r.day()}T00:00:00Z`);
      out.push(d + r.int(-90, 90) * 60_000 + r.int(0, 59_999));
    } else out.push(r.pick(changes) + r.int(-48 * 60, 48 * 60) * 60_000);
  }
  return out;
}

const OUTCOMES = ['win', 'loss', 'gave', 'played', 'x', undefined];

function record(r: Rng, day?: string): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  if (r.chance(0.6)) rec.s = r.chance(0.9) ? r.int(0, 4000) : r.pick(['12', -3, null, 1.5]);
  if (r.chance(0.4)) rec.o = r.pick(OUTCOMES);
  if (r.chance(0.3)) rec.t = r.pick(['01:27', '1:05', '12:00', '1:02:03', 'x', '']);
  if (r.chance(0.3)) rec.m = r.pick([0, 1, 2, 3, '2', undefined]);
  if (r.chance(0.3)) rec.c = r.int(0, 10);
  if (r.chance(0.3)) rec.p = r.int(0, 1000);
  if (r.chance(0.7)) rec.d = day ?? r.day();
  if (r.chance(0.1)) rec.on = r.day();
  return rec;
}

function roundStreak(r: Rng, around: string) {
  if (r.chance(0.15)) return r.pick([undefined, null, {}, { last: 'junk', n: 3 }]);
  return { last: r.chance(0.9) ? r.day(around) : null, n: r.int(0, 30), best: r.int(0, 40) };
}

function doc(r: Rng, ids: string[], around: string): Record<string, unknown> {
  const done: Record<string, unknown> = {};
  for (const id of ids) if (r.chance(0.4)) done[id] = record(r, r.day(around));
  const d: Record<string, unknown> = { v: 1 };
  if (r.chance(0.9)) d.done = done;
  if (r.chance(0.4)) {
    const days: Record<string, unknown> = {};
    for (const id of ids)
      if (r.chance(0.5))
        days[id] = {
          state: r.pick(['ready', 'playing', 'done', 'suspended']),
          score: r.int(0, 80),
        };
    d.days = days;
  }
  if (r.chance(0.5)) d.streak = roundStreak(r, around);
  if (r.chance(0.5)) d.best = r.int(0, 900);
  if (r.chance(0.3)) d.cur = r.chance(0.7) ? { id: r.pick(ids), i: r.int(0, 9) } : null;
  if (r.chance(0.3)) d.snd = r.chance(0.5);
  return d;
}

function gridStreak(r: Rng, around: string): GridStreak | null {
  if (r.chance(0.1)) return null;
  const dates = [...new Set(Array.from({ length: r.int(0, 6) }, () => r.day(around)))].sort();
  const s: GridStreak = {
    last: r.chance(0.9) ? (dates.at(-1) ?? r.day(around)) : null,
    streak: r.int(0, 20),
    best: r.int(0, 30),
    dates,
  };
  if (r.chance(0.6)) s.tz = 'L';
  return s;
}

const IDS = ['DP·MINI·0001', 'DP·MINI·0002', 'DP·MINI·0003', 'DP·MINI·0004'];

afterEach(() => {
  jest.useRealTimers();
});

describe('GIVEN 10,000 instants across 2026-2028', () => {
  const site = loadDnCore();
  const xs = instants(rng(1), 10_000);

  describe('WHEN both compute the London day', () => {
    it('THEN every day matches dn-core.js', () => {
      const diffs = xs.filter((t) => londonDay(t) !== site.londonDay(t));
      expect(diffs).toEqual([]);
    });
  });

  describe('WHEN both step back a day', () => {
    it('THEN every result matches dn-core.js', () => {
      const days = xs.map((t) => site.londonDay(t));
      expect(days.map(dayBefore)).toEqual(days.map(site.dayBefore));
    });
  });
});

describe('GIVEN 2,000 pairs of round streaks', () => {
  const r = rng(2);
  const site = loadDnCore();
  describe('WHEN both merge them', () => {
    it('THEN every merge matches dn-core.js', () => {
      for (let i = 0; i < 2000; i++) {
        const around = r.day();
        const a = roundStreak(r, around);
        const b = roundStreak(r, around);
        // dn-core's mergeStreak is internal; it is reached through mergeProgress,
        // which calls it only when either side has a streak.
        if (!a && !b) continue;
        const theirs = site.mergeProgress({ streak: clone(a) }, { streak: clone(b) }).streak;
        expect(mergeStreak(clone(a), clone(b))).toEqual(theirs);
      }
    });
  });
});

describe('GIVEN 2,000 pairs of result documents', () => {
  const r = rng(3);
  const site = loadDnCore();
  describe('WHEN both merge a save into what storage holds', () => {
    it('THEN every merge matches dn-core.js', () => {
      for (let i = 0; i < 2000; i++) {
        const around = r.day();
        const current = doc(r, IDS, around);
        const stored = r.chance(0.9) ? doc(r, IDS, around) : null;
        const active = r.chance(0.8) ? r.pick(IDS) : undefined;
        expect(mergeProgress(clone(current), clone(stored), active)).toEqual(
          site.mergeProgress(clone(current), clone(stored), active),
        );
      }
    });
  });

  describe('WHEN both save progress through storage, sometimes failing', () => {
    it('THEN the stored documents, returns and failure counts match', () => {
      for (let i = 0; i < 2000; i++) {
        const around = r.day();
        const init = r.chance(0.8) ? { 'digi-tangle-v1': doc(r, IDS, around) } : {};
        const current = doc(r, IDS, around);
        const active = r.pick(IDS);
        const report = r.chance(0.8);
        const fail = r.chance(0.2);
        const core = loadDnCore();
        const a = fakeStorage(init);
        const b = fakeStorage(init);
        a.fail = b.fail = fail;
        const store = createSaveStore(b);
        const theirs = core.saveProgress('digi-tangle-v1', clone(current), active, a, report);
        const ours = store.saveProgress('digi-tangle-v1', clone(current), active, report);
        expect(ours).toEqual(theirs);
        expect(b.m).toEqual(a.m);
      }
    });
  });
});

describe('GIVEN 2,000 finished results put into storage', () => {
  const r = rng(4);
  describe('WHEN both record them on a given day, sometimes failing then retrying', () => {
    it('THEN the first result is kept, stamped with the London day, exactly as dn-core.js', async () => {
      for (let i = 0; i < 2000; i++) {
        const now = Date.parse(`${r.day()}T00:00:00Z`) + r.int(-120, 120) * 60_000;
        jest.useFakeTimers({ now });
        const init = r.chance(0.7) ? { 'digi-mini-v1': doc(r, IDS, londonDay(now)) } : {};
        if (r.chance(0.1)) (init as Record<string, unknown>)['digi-mini-v1'] = { v: 2, done: {} };
        const id = r.pick(IDS);
        const rec = record(r);
        delete rec.d;
        const fail = r.chance(0.25);
        const core = loadDnCore();
        const a = fakeStorage(init);
        const b = fakeStorage(init);
        a.fail = b.fail = fail;
        const store = createSaveStore(b, { now: () => now });
        const ours = store.putDone('digi-mini-v1', id, clone(rec));
        expect(ours).toEqual(core.putDone('digi-mini-v1', id, clone(rec), a));
        expect(store.getDone('digi-mini-v1', id)).toEqual(core.getDone('digi-mini-v1', id, a));
        expect(b.m).toEqual(a.m);
        if (fail) {
          a.fail = b.fail = false;
          // A failed write leaves one notice; a result already saved never fails.
          expect(store.saveIssues()).toBe(ours === null ? 1 : 0);
          await store.retrySaves();
          expect(store.saveIssues()).toBe(0);
          core.putDone('digi-mini-v1', id, clone(rec), a);
          expect(b.m).toEqual(a.m);
        }
        jest.useRealTimers();
      }
    });
  });
});

describe('GIVEN 2,000 grid streaks and days', () => {
  const r = rng(5);

  it('THEN a Mini/Doku solve updates the streak exactly as engines/mini.js bumpStreak', async () => {
    for (let i = 0; i < 2000; i++) {
      const t = r.day();
      const s = gridStreak(r, t);
      jest.useFakeTimers({ now: Date.parse(`${t}T12:00:00Z`) });
      const site = loadSite(fakeStorage());
      site.setStreak(clone(s));
      await site.mini.bumpStreak();
      expect(bumpSolveStreak(clone(s), t)).toEqual(site.getStreak() ?? s);
      jest.useRealTimers();
    }
  });

  it('THEN a Sweep/Link win or loss updates the streak exactly as recordResult', async () => {
    for (let i = 0; i < 2000; i++) {
      const t = r.day();
      const s = gridStreak(r, t);
      const win = r.chance(0.6);
      jest.useFakeTimers({ now: Date.parse(`${t}T12:00:00Z`) });
      for (const engine of ['sweep', 'link'] as const) {
        const site = loadSite(fakeStorage());
        if (engine === 'sweep' && s && !Array.isArray(s.dates)) continue;
        site.setStreak(clone(s));
        await site[engine].recordResult(win);
        expect(recordResultStreak(clone(s), t, win)).toEqual(site.getStreak() ?? s);
      }
      jest.useRealTimers();
    }
  });

  it('THEN a Path solve, and its live count, match engines/path.js', () => {
    for (let i = 0; i < 2000; i++) {
      const t = r.day();
      const s = gridStreak(r, t);
      jest.useFakeTimers({ now: Date.parse(`${t}T12:00:00Z`) });
      const storage = fakeStorage(s ? { 'digi-path-streak': s } : {});
      const g = globalThis as unknown as { localStorage?: unknown };
      const had = g.localStorage;
      g.localStorage = storage; // dn-core's saveStreak writes to the global localStorage
      try {
        const core = loadDnCore();
        const site = loadSite(storage, core);
        expect(livePathStreak(clone(s), t)).toBe(site.path.streakLive());
        site.path.streakBump();
        const after = JSON.parse(storage.getItem('digi-path-streak') ?? 'null');
        expect(bumpPathStreak(clone(s), t)).toEqual(
          after ?? s ?? { last: null, streak: 0, best: 0, dates: [] },
        );
      } finally {
        g.localStorage = had;
        jest.useRealTimers();
      }
    }
  });

  it('THEN Doku’s seeded streak matches engines/doku.js dokuStreakSeed', () => {
    for (let i = 0; i < 2000; i++) {
      const around = r.day();
      const d = r.chance(0.9) ? doc(r, IDS, around) : null;
      const storage = fakeStorage(d ? { 'digi-doku-v1': d } : {});
      const site = loadSite(storage);
      expect(seedDokuStreak(clone(d) as SaveDoc | null)).toEqual(site.doku.dokuStreakSeed());
    }
  });
});

describe('GIVEN 2,000 saved results for every puzzle type', () => {
  const r = rng(6);
  it('THEN card wording and played state match front.js', () => {
    const site = loadSite(fakeStorage());
    for (let i = 0; i < 2000; i++) {
      const type = r.pick(PUZZLE_TYPES) as PuzzleType;
      const rec = record(r);
      expect(resultText(type, clone(rec))).toBe(site.front.resultText(type, clone(rec)));
      const d = r.chance(0.9) ? doc(r, IDS, r.day()) : null;
      const id = r.pick(IDS);
      expect(playedState(type, id, clone(d) as SaveDoc | null)).toEqual(
        site.front.playedState({ type, id }, { [`digi-${type}-v1`]: clone(d) }),
      );
    }
  });

  it('THEN clocks match front.js', () => {
    const site = loadSite(fakeStorage());
    for (let i = 0; i < 2000; i++) {
      const secs = r.pick([r.int(0, 20_000), -1, r.next() * 500, 'x', null, '75']);
      expect(clock(secs)).toBe(site.front.clock(secs));
      const t = r.pick([
        `${r.int(0, 99)}:${String(r.int(0, 59)).padStart(2, '0')}`,
        `${r.int(0, 3)}:${String(r.int(0, 59)).padStart(2, '0')}:${String(r.int(0, 59)).padStart(2, '0')}`,
        '1:5',
        '',
        'x',
      ]);
      expect(shownClock(t)).toBe(site.front.shownClock(t));
    }
  });
});

describe('GIVEN 2,000 finished Sweeps and Links', () => {
  const r = rng(7);
  it('THEN every share line matches the engines', () => {
    const site = loadSite(fakeStorage());
    for (let i = 0; i < 2000; i++) {
      const time = r.pick(['00:35', '01:27', '12:05', '0:09', '', '  03:00 ']);
      const streak = r.pick(['0', '1', '2', '17', '', 'x', 5]);
      const sweepId = `DP·SWEEP·${r.day()}`;
      const outcome = r.pick(['win', 'loss', 'gave', 'revealed']);
      expect(shareSweep(outcome, time, streak, sweepId)).toBe(
        site.sweepShare.dnSweep(outcome, time, streak, sweepId),
      );
      expect(dnSweepDay(sweepId)).toBe(site.sweepShare.dnSweepDay(sweepId));
      const guesses = Array.from({ length: r.int(0, 8) }, () =>
        r.chance(0.1) ? [1, 2] : Array.from({ length: 4 }, () => (r.chance(0.6) ? 2 : r.int(1, 4))),
      );
      const id = `DP·LINK·${String(r.int(0, 999)).padStart(4, '0')}`;
      const won = r.chance(0.7);
      expect(linkRow(guesses)).toBe(site.link.dnLinkRow(guesses));
      expect(shareLink(guesses, won, time, streak, id)).toBe(
        site.link.dnLink(guesses, won, time, streak, id),
      );
      expect(dnTime(time)).toBe(site.link.dnTime(time));
      expect(dnStreak(streak)).toBe(site.link.dnStreak(streak));
      expect(dnNum(id)).toBe(site.link.dnNum(id));
    }
  });
});
