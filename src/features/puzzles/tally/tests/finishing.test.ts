import { createSaveStore, londonDay } from '@noodle/core';

import {
  commitFinish,
  liveStreak,
  recordTime,
  reopenInfo,
  restoreCur,
  saveCur,
} from '../finishing';
import { apply, init, restoreDone, SAVE_KEY, STREAK_KEY } from '../model';
import { memoryKV } from '../simulate';
import { tally1 } from './fixtures';

const NOW = Date.parse('2026-11-05T10:00:00Z');
const setup = (seed: Record<string, unknown> = {}) => {
  const kv = memoryKV(seed);
  return { kv, saves: createSaveStore(kv, { now: () => NOW }) };
};
const typed = () => apply(apply(init(tally1), { t: 'cell', i: 0 }), { t: 'digit', d: 2 });

describe('GIVEN an unfinished round', () => {
  it('WHEN kept THEN it comes back with its numbers, notes and time', () => {
    const { kv, saves } = setup();
    saveCur(kv, typed(), 41.6, saves, NOW);
    const doc = JSON.parse(kv.getItem(SAVE_KEY)!) as { cur: Record<string, unknown> };
    expect(doc.cur).toMatchObject({ id: tally1.id, s: 42, at: NOW });
    const back = restoreCur(kv, tally1)!;
    expect(back.secs).toBe(42);
    expect(back.state.g[0]).toBe(2);
    expect(back.state.msg).toBe('Carrying on where you left off.');
  });
  it('WHEN the board is emptied again THEN the slot is given up', () => {
    const { kv, saves } = setup();
    saveCur(kv, typed(), 5, saves, NOW);
    saveCur(kv, init(tally1), 6, saves, NOW);
    expect(JSON.parse(kv.getItem(SAVE_KEY)!)).toEqual({ v: 1 });
  });
  it('WHEN an empty board is kept with nothing saved THEN nothing is written', () => {
    const { kv, saves } = setup();
    saveCur(kv, init(tally1), 6, saves, NOW);
    expect(kv.getItem(SAVE_KEY)).toBeNull();
  });
  it('THEN another puzzle’s round, or a bad one, is not restored', () => {
    expect(restoreCur(setup({ [SAVE_KEY]: { cur: { id: 'X', g: [] } } }).kv, tally1)).toBeNull();
    expect(
      restoreCur(setup({ [SAVE_KEY]: { cur: { id: tally1.id, g: [1] } } }).kv, tally1),
    ).toBeNull();
    const noNotes = { id: tally1.id, g: new Array(16).fill(0), s: 'x' };
    const r = restoreCur(setup({ [SAVE_KEY]: { cur: noNotes } }).kv, tally1)!;
    expect(r.secs).toBe(0);
    expect(r.state.notes).toEqual(new Array(16).fill(0));
  });
  it('THEN a finished puzzle keeps no round', () => {
    const { kv, saves } = setup();
    saves.putDone(SAVE_KEY, tally1.id, { t: '1:00', s: 60 });
    saveCur(kv, typed(), 5, saves, NOW);
    expect((JSON.parse(kv.getItem(SAVE_KEY)!) as { cur?: unknown }).cur).toBeUndefined();
  });
});

describe('GIVEN a solved board', () => {
  it('THEN the result is saved, the round cleared, the streak bumped and the share written', () => {
    const { kv, saves } = setup();
    saveCur(kv, typed(), 5, saves, NOW);
    const f = commitFinish(restoreDone(tally1), 102.4, true, saves, kv, NOW);
    expect(JSON.parse(kv.getItem(SAVE_KEY)!)).toEqual({
      v: 1,
      done: { [tally1.id]: { t: '1:42', s: 102, d: londonDay(NOW) } },
    });
    expect(JSON.parse(kv.getItem(STREAK_KEY)!)).toMatchObject({ streak: 1, best: 1, tz: 'L' });
    expect(f).toMatchObject({
      first: true,
      hero: '1:42',
      note: 'Picked up where you left off.',
      share: '🧮 Tally #1 — 1:42',
      played: 1,
      detail: { type: 'logic-tally', outcome: 'solved', secs: 102 },
    });
  });
  it('WHEN reopened THEN it shows its saved time and the live streak', () => {
    const { kv, saves } = setup({
      [STREAK_KEY]: { last: londonDay(NOW), streak: 3, best: 4, dates: [londonDay(NOW)], tz: 'L' },
    });
    commitFinish(restoreDone(tally1), 60, false, saves, kv, NOW);
    const r = reopenInfo(tally1.id, saves.getDone(SAVE_KEY, tally1.id)!, kv, NOW);
    expect(r).toMatchObject({ hero: '1:00', note: '', streak: 3, best: 4 });
    expect(r.share).toBe('🧮 Tally #1 — 1:00 · 🔥3');
    expect(liveStreak(kv, NOW + 5 * 86_400_000)).toBe(0);
    expect(recordTime({ t: 'x' })).toBe('0:00');
  });
  it('THEN unreadable saves count as none', () => {
    const kv = memoryKV();
    kv.setItem(SAVE_KEY, '{bad');
    kv.setItem(STREAK_KEY, '{bad');
    expect(restoreCur(kv, tally1)).toBeNull();
    expect(liveStreak(kv, NOW)).toBe(0);
  });
});
