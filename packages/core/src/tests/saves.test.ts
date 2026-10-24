import { createSaveStore, progressOnly, same } from '../saves';
import { fakeStorage } from './site';

describe('GIVEN a save store', () => {
  describe('WHEN a write fails and is retried', () => {
    it('THEN listeners hear the notice appear and clear', async () => {
      const kv = fakeStorage();
      const store = createSaveStore(kv, { now: () => Date.parse('2026-10-24T09:00:00Z') });
      const heard: number[] = [];
      const off = store.onSaveChange(() => heard.push(store.saveIssues()));
      kv.fail = true;
      expect(store.putDone('digi-mini-v1', 'a', { s: 60 })).toBeNull();
      expect(store.getDone('digi-mini-v1', 'a')).toEqual({ s: 60, d: '2026-10-24' });
      kv.fail = false;
      await expect(store.retrySaves()).resolves.toBe(true);
      expect(heard).toEqual([1, 0]);
      off();
      kv.fail = true;
      store.saveStreak('digi-mini-streak', { streak: 1 });
      expect(heard).toEqual([1, 0]);
      expect(store.saveIssues()).toBe(1);
      kv.fail = false;
      await store.retrySaves();
      expect(JSON.parse(kv.getItem('digi-mini-streak')!)).toEqual({ streak: 1 });
    });
  });

  describe('WHEN a listener throws', () => {
    it('THEN the save still goes through', () => {
      const kv = fakeStorage();
      const store = createSaveStore(kv);
      store.onSaveChange(() => {
        throw new Error('listener');
      });
      kv.fail = true;
      expect(() => store.saveStreak('k', 1)).not.toThrow();
    });
  });

  describe('WHEN storage holds something unreadable', () => {
    it('THEN it reads as nothing', () => {
      const kv = fakeStorage();
      kv.m['digi-mini-v1'] = '{not json';
      expect(createSaveStore(kv).read('digi-mini-v1')).toBeNull();
    });
  });
});

describe('GIVEN plain data', () => {
  it('THEN same ignores key order and tells arrays from objects', () => {
    expect(same({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(same([], {})).toBe(false);
    expect(same({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
  it('THEN progressOnly keeps progress and drops settings', () => {
    expect(
      progressOnly({
        done: { a: 1 },
        days: { x: { state: 'ready' }, y: { state: 'done' } },
        snd: true,
      }),
    ).toEqual({
      done: { a: 1 },
      days: { y: { state: 'done' } },
      cur: null,
      streak: null,
      best: 0,
    });
    expect(progressOnly(null)).toEqual({ done: {}, days: {}, cur: null, streak: null, best: 0 });
  });
});
