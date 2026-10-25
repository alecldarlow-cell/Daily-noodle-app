import { createSaveStore } from '@noodle/core';

import { sheetInfo, noteText } from '../finishing';
import {
  boardTop,
  createTangle,
  current,
  endDetail,
  foundList,
  gate,
  groups,
  homeCard,
  KEY,
  longDate,
  mmss,
  num,
  plural,
  recap,
  result,
  shareLine,
  validate,
  type Rect,
} from '../model';
import { findPath } from '../oracle';
import { FakeClock, memoryKV } from '../simulate';
import { clone, tangle19 } from './fixtures';

const DATE = '2026-10-25';
const MORNING = Date.parse(`${DATE}T08:15:00Z`);
const SIDE = 80;
const RECTS: Rect[] = Array.from({ length: 16 }, (_, i) => ({
  left: (i % 4) * 100,
  top: Math.floor(i / 4) * 100,
  width: SIDE,
  height: SIDE,
}));
const c = (i: number): [number, number] => [RECTS[i]!.left + 40, RECTS[i]!.top + 40];

function open(seed: Record<string, unknown> = {}, at = MORNING) {
  const kv = memoryKV(seed);
  const clock = new FakeClock(at);
  const saves = createSaveStore(kv, { now: () => clock.now });
  const ended: unknown[] = [];
  const e = createTangle(tangle19, {
    saves,
    read: () => kv.getItem(KEY),
    now: () => clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    rects: () => RECTS,
    ended: () => ended.push(1),
  });
  const tick = clock.setInterval(() => e.tick(), 100);
  const doc = () => JSON.parse(kv.getItem(KEY) || 'null');
  const wait = (ms: number) => clock.runTo(clock.now + ms);
  const trace = (tiles: number[]) => {
    e.down(...c(tiles[0]!));
    for (const t of tiles.slice(1)) e.move([c(t)]);
    e.up();
  };
  const tap = (i: number) => {
    e.down(...c(i));
    e.move([[c(i)[0] + 1.5, c(i)[1] - 1]]);
    e.up();
  };
  const word = (w: string) => trace(findPath(tangle19, w)!);
  return { e, kv, clock, doc, wait, trace, tap, word, ended, tick };
}

/** Play and sit through the 3-2-1 (offset 50 ms from the tick, as the replay does). */
function playing(seed?: Record<string, unknown>, at?: number) {
  const g = open(seed, at);
  g.wait(1250);
  g.e.playCard();
  g.wait(3050);
  return g;
}

describe('GIVEN the Tangle ship gate', () => {
  it('THEN a published board passes, with its own date', () => {
    expect(gate(tangle19, DATE)).toEqual([]);
    expect(validate(tangle19, DATE)).toEqual({ ok: true, fails: [] });
  });

  it.each([
    ['a bad id', (d: typeof tangle19) => (d.id = 'DP·TANG·19'), /^id /],
    ['a bad tile', (d: typeof tangle19) => (d.tiles[0] = 'Q'), /tiles/],
    ['two Qu tiles', (d: typeof tangle19) => (d.tiles[0] = d.tiles[1] = 'QU'), /Qu/],
    ['two of J/X/Z', (d: typeof tangle19) => (d.tiles[0] = d.tiles[1] = 'Z'), /J\/X\/Z/],
    ['a grid that is not dots', (d: typeof tangle19) => (d.grid[0]![0] = 'A'), /grid/],
    ['a word off the board', (d: typeof tangle19) => d.main.push('zzz'), /not traceable zzz/],
    ['a repeated word', (d: typeof tangle19) => d.bonus.push('ago'), /repeat ago/],
    ['a bad word', (d: typeof tangle19) => d.bonus.push('Ab'), /bad word/],
    ['a short star', (d: typeof tangle19) => (d.star = 'ago'), /^star$/],
    [
      'a star path that spells something else',
      (d: typeof tangle19) => d.starPath.reverse(),
      /star path/,
    ],
    [
      'a star that is not the longest',
      (d: typeof tangle19) => d.bonus.push('originals'),
      /unique longest/,
    ],
    ['too few common words', (d: typeof tangle19) => (d.main = d.main.slice(0, 30)), /main count/],
    ['no word lists', (d: typeof tangle19) => ((d as { main: unknown }).main = null), /word lists/],
  ])('THEN %s fails it', (_label, change, re) => {
    const d = clone(tangle19);
    change(d);
    expect(gate(d, null).join('; ')).toMatch(re);
  });

  it('THEN a page dated other than its puzzle, a missing number, or no puzzle at all fails', () => {
    expect(gate(tangle19, '2026-10-26')).toEqual(['dn:date 2026-10-26 != 2026-10-25']);
    expect(validate({ ...tangle19, n: undefined }).fails).toContain('n');
    expect(gate(null, null)).toEqual(['no puzzle object']);
  });
});

describe('GIVEN the engine’s helpers', () => {
  it('THEN they write as the page does', () => {
    expect([mmss(90), mmss(4.6), mmss(3725)]).toEqual(['1:30', '0:05', '1:02:05']);
    expect(longDate(DATE)).toBe('Sunday, 25 October 2026');
    expect(longDate('nonsense')).toBe('nonsense');
    expect([num(8), num(40)]).toEqual(['eight', '40']);
    expect(plural(1, 'point', 'points')).toBe('1 point');
    expect(Object.keys(groups(['ago', 'atop', 'air']))).toEqual(['3', '4']);
  });
});

describe('GIVEN a Tangle not yet played', () => {
  describe('WHEN it opens', () => {
    it('THEN the home card offers today’s round and nothing is saved yet', () => {
      const g = open();
      expect(g.e.s.view).toBe('home');
      expect(homeCard(g.e, DATE)).toEqual({
        num: 'No. 19',
        date: 'No. 19, Sunday, 25 October',
        head: 'Today’s Tangle',
        status: '90 seconds. Longer words score more; the eight-letter word scores double.',
        go: 'Play',
        streak: 0,
        best: 0,
        played: 0,
      });
      expect(g.doc()).toBeNull();
    });
  });

  describe('WHEN it is opened from the Archive on a later day', () => {
    it('THEN the home card is headed by its number, not “Today’s”', () => {
      const g = open();
      expect(homeCard(g.e, '2026-10-27').head).toBe('Tangle 19');
    });
  });

  describe('WHEN Play is pressed', () => {
    it('THEN the round is saved as playing, counts 3-2-1 with the letters hidden, then goes live', () => {
      const g = open();
      g.wait(1250);
      g.e.playCard();
      expect(g.doc()).toMatchObject({
        v: 1,
        days: { 'DP·TANG·0019': { state: 'playing', left: 90 } },
        fs: true,
        snd: true,
        rm: null,
      });
      expect(g.e.s).toMatchObject({ view: 'play', counting: true, count: '3' });
      expect(g.e.live()).toBe(false);
      expect(current(g.e)).toEqual({ text: '', idle: true });
      g.wait(1000);
      expect(g.e.s.count).toBe('2');
      g.wait(2050);
      expect(g.e.s.counting).toBe(false);
      expect(current(g.e)).toEqual({ text: 'Drag across letters, or tap them', idle: true });
      expect(boardTop(g.e)).toMatchObject({
        clock: '1:30',
        score: 0,
        words: '0 words',
        low: false,
      });
    });
  });
});

describe('GIVEN a round in play', () => {
  describe('WHEN words are traced', () => {
    it('THEN a word scores its length less two, the star double, and the found list grows', () => {
      const g = playing();
      g.word('ago');
      expect(g.e.s.toast).toEqual({ text: '+1 AGO', cls: 'on good' });
      g.trace(tangle19.starPath);
      expect(g.e.s.toast).toEqual({ text: '★ Longest word! +12', cls: 'on gold' });
      g.word('agio'); // a rarer word scores too
      expect(boardTop(g.e)).toMatchObject({
        score: 15,
        words: '3 words',
        star: '★ ORIGINAL +12',
        starGot: true,
      });
      expect(g.doc().days['DP·TANG·0019']).toMatchObject({
        found: ['ago', 'original', 'agio'],
        score: 15,
      });
      const list = foundList(g.e);
      expect(list[0]).toMatchObject({ len: 8, label: '8 letters · 6 pts each', count: '1 of 1' });
      expect(list.find((x) => x.len === 4)!.words).toEqual([
        { w: 'agio', star: false, bonus: true, fresh: true },
      ]);
      g.wait(1200);
      expect(g.e.s.toast.cls).toBe('');
    });

    it('THEN a repeat, a short trace and a path that is no word each say so and score nothing', () => {
      const g = playing();
      g.word('ago');
      g.word('ago');
      expect(g.e.s.toast.text).toBe('Already found');
      g.trace([0, 1]);
      expect(g.e.s.toast.text).toBe('Too short');
      g.trace([0, 1, 2]);
      expect(g.e.s.toast.text).toBe("Not in today's list");
      expect(boardTop(g.e).score).toBe(1);
    });

    it('THEN taps build a word, an earlier tap steps back, a far tap starts afresh, and the last letter again enters it', () => {
      const g = playing();
      const p = findPath(tangle19, 'atop')!;
      for (const i of p) g.tap(i);
      expect(current(g.e).text).toBe('atop');
      g.tap(p[1]!);
      expect(g.e.s.path).toEqual(p.slice(0, 2));
      g.tap(15);
      expect(g.e.s.path).toEqual([15]);
      for (const i of p) g.tap(i);
      g.tap(p[3]!);
      expect(g.e.s.toast.text).toBe('+2 ATOP');
    });

    it('THEN sliding back over the last tile undoes it, and a second finger or a cancel never adds', () => {
      const g = playing();
      const p = findPath(tangle19, 'two')!;
      const extra = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].find(
        (j) =>
          !p.includes(j) &&
          Math.abs((j % 4) - (p[2]! % 4)) <= 1 &&
          Math.abs(Math.floor(j / 4) - Math.floor(p[2]! / 4)) <= 1,
      )!;
      g.trace([...p, extra, p[2]!]);
      expect(g.e.s.toast.text).toBe('+1 TWO');
      g.e.down(...c(0));
      g.e.down(...c(5), 2); // a second finger
      g.e.move([c(1)], 2);
      g.e.move([c(1)]);
      g.e.cancel(2);
      g.e.cancel();
      expect(g.e.s.path).toEqual([]);
      g.e.down(...c(0), 1, 2); // a right button
      g.e.up();
      g.e.down(-50, -50); // off the board
      g.e.up();
      expect(g.e.s.path).toEqual([]);
    });
  });

  describe('WHEN the clock runs', () => {
    it('THEN it saves every five seconds, turns low at ten, and at zero files the round', () => {
      const g = playing({}, MORNING);
      g.word('ago');
      g.wait(5000);
      const left = g.doc().days['DP·TANG·0019'].left;
      expect(left).toBeLessThanOrEqual(85.05);
      expect(left).toBeGreaterThan(84);
      g.wait(75_000);
      expect(boardTop(g.e)).toMatchObject({ low: true });
      g.wait(11_000);
      const doc = g.doc();
      expect(doc.done['DP·TANG·0019']).toEqual({ o: 'played', s: 1, w: 1, st: false, d: DATE });
      expect(doc.days['DP·TANG·0019']).toMatchObject({ state: 'done', left: 0 });
      expect(doc.streak).toEqual({ last: DATE, n: 1, best: 1 });
      expect(doc.best).toBe(1);
      expect(g.e.s.view).toBe('winModal');
      expect(g.ended).toHaveLength(1);
      const r = result(g.e, DATE);
      expect(r).toMatchObject({ title: 'Time’s up', time: '1:30', score: 1, words: 1, streak: 1 });
      expect(endDetail(r)).toEqual({
        type: 'word-tangle',
        tv: 3,
        outcome: 'scored',
        secs: 90,
        checks: 0,
        reveals: 0,
        hints: 0,
        score: 1,
        words: 1,
      });
      const f = sheetInfo(g.e, DATE);
      expect(f.kick).toBe('Tangle 19, Sunday 25 October');
      expect(noteText(f.note)).toBe('1 word. The longest was ORIGINAL, worth 12.');
      expect(f.share).toBe('🧶 Tangle #19 — 1 point, 1 word');
      // a tap after the end does nothing
      g.e.down(...c(0));
      g.e.up();
      expect(g.e.submit([0, 1, 2])).toEqual({ r: 'locked' });
    });

    it('THEN a round played on another day files under that day and leaves the streak alone', () => {
      const streak = { last: '2026-10-27', n: 9, best: 9 };
      const g = playing(
        { [KEY]: { v: 1, days: {}, done: {}, streak, best: 40, snd: false, rm: true, fs: false } },
        Date.parse('2026-10-28T08:15:00Z'),
      );
      g.trace(tangle19.starPath);
      g.wait(95_000);
      const doc = g.doc();
      expect(doc.done['DP·TANG·0019']).toMatchObject({ d: '2026-10-28', st: true });
      expect(doc.streak).toEqual(streak);
      expect(doc).toMatchObject({ best: 40, snd: false, rm: true, fs: false });
      expect(shareLine(tangle19, g.e.s.D)).toBe('🧶 Tangle #19 — 12 points, 1 word ★');
      expect(result(g.e, '2026-10-28').star).toBe(
        'You found the longest word, ORIGINAL, for 12 points.',
      );
      expect(noteText(sheetInfo(g.e, '2026-10-28').note)).toBe(
        '1 word, including the longest, ORIGINAL, for 12 points.',
      );
    });
  });

  describe('WHEN the player goes back to the home card', () => {
    it('THEN the clock holds, the card says Round paused, and Resume counts in again from the same time', () => {
      const g = playing();
      g.word('ago');
      g.wait(2000);
      g.e.home();
      const left = g.e.s.D.left;
      expect(g.doc().days['DP·TANG·0019'].left).toBe(left);
      g.wait(20_000);
      expect(g.e.s.D.left).toBe(left);
      expect(homeCard(g.e, DATE)).toMatchObject({
        head: 'Round paused',
        status: `${mmss(left)} left, 1 point so far.`,
        go: 'Resume',
      });
      g.e.playCard();
      expect(g.e.s).toMatchObject({ view: 'play', counting: true, paused: false });
      g.wait(3000);
      expect(g.e.s.D.left).toBe(left);
      g.wait(1000);
      expect(g.e.s.D.left).toBeLessThan(left);
    });
  });

  describe('WHEN the app goes to the background and comes back', () => {
    it('THEN the round pauses behind the veil until Resume, and is saved', () => {
      const g = playing();
      g.e.hidden();
      expect(g.e.s).toMatchObject({ paused: true });
      const left = g.e.s.D.left;
      g.wait(10_000);
      g.e.visible();
      g.wait(500);
      expect(g.e.s.D.left).toBe(left);
      g.e.resume();
      expect(g.e.s.counting).toBe(true);
      g.e.leave();
      expect(g.doc().days['DP·TANG·0019'].state).toBe('playing');
    });
  });
});

describe('GIVEN a Tangle whose round is done', () => {
  it('THEN reopening shows its score, not “Time’s up”, and announces nothing', () => {
    const g = playing();
    g.word('ago');
    g.wait(95_000);
    const again = open(JSON.parse(JSON.stringify({ [KEY]: g.doc() })));
    expect(again.e.s.view).toBe('winModal');
    expect(again.ended).toHaveLength(0);
    expect(result(again.e, DATE).title).toBe('Your score');
    expect(homeCard(again.e, DATE)).toMatchObject({ head: '1 point', go: 'View', played: 1 });
    again.e.playCard();
    expect(again.e.s.view).toBe('winModal');
  });

  it('THEN a broken save starts afresh, as the page does', () => {
    const kv = memoryKV();
    kv.setItem(KEY, '{broken');
    const clock = new FakeClock(MORNING);
    const e = createTangle(tangle19, {
      saves: createSaveStore(kv),
      read: () => kv.getItem(KEY),
      now: () => clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      rects: () => [],
    });
    expect(e.s.view).toBe('home');
    expect(e.s.D).toEqual({ state: 'ready', found: [], left: 90, score: 0 });
  });
});

describe('GIVEN the sheet’s recap', () => {
  it('THEN every common word shows by length, found ones first, with the rarer words counted', () => {
    const r = recap(tangle19, ['original', 'ago', 'agio']);
    expect(r.meter).toBe('You found 2 of 55');
    expect(r.points).toMatch(/^13 of \d+ points$/);
    expect(r.lists[0]).toMatchObject({
      len: 8,
      label: '8 letters, 6 points each',
      count: '1 of 1',
    });
    expect(r.lists.at(-1)!.words[0]).toEqual({ w: 'ago', got: true, star: false, pts: 1 });
    expect(r.rare).toBe(`Rarer words: 1 of ${tangle19.bonus.length} found`);
    expect(r.rareList).toContain('agio ✓');
  });
});
