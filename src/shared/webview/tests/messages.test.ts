import { createSaveStore } from '@noodle/core';

import { createCachedStorage } from '@/shared/storage';

import { applySave, parseMessage, seedFrom } from '../messages';

function memoryStore(init: Record<string, unknown> = {}) {
  const backend = {
    data: new Map<string, string>(),
    getAllKeys: async () => [...backend.data.keys()],
    multiGet: async (keys: readonly string[]) =>
      keys.map((k) => [k, backend.data.get(k) ?? null] as const),
    setItem: async (k: string, v: string) => void backend.data.set(k, v),
  };
  const store = createCachedStorage(backend);
  for (const [k, v] of Object.entries(init))
    store.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  return { store, saves: createSaveStore(store) };
}
const read = (s: { getItem(k: string): string | null }, k: string) =>
  JSON.parse(s.getItem(k) ?? 'null');

describe('GIVEN a message from the page', () => {
  it('THEN well-formed save, share and end messages are read', () => {
    expect(
      parseMessage('{"t":"save","key":"digi-mini-v1","value":"{}","id":"DP·MINI·0105"}'),
    ).toEqual({ t: 'save', key: 'digi-mini-v1', value: '{}', id: 'DP·MINI·0105' });
    expect(parseMessage('{"t":"save","key":"digi-mini-v1","value":"{}"}')).toEqual({
      t: 'save',
      key: 'digi-mini-v1',
      value: '{}',
      id: '',
    });
    expect(parseMessage('{"t":"share","text":"x"}')).toEqual({ t: 'share', text: 'x', url: '' });
    expect(parseMessage('{"t":"end","detail":{"outcome":"solved"}}')).toEqual({
      t: 'end',
      detail: { outcome: 'solved' },
    });
  });
  it.each([
    'not json',
    'null',
    '{"t":"save","key":"noodle-board-v1","value":"{}"}',
    '{"t":"save","key":"digi-mini-v1","value":3}',
    '{"t":"share"}',
    '{"t":"end","detail":[1]}',
    '{"t":"other"}',
  ])('THEN %s is ignored', (raw) => {
    expect(parseMessage(raw)).toBeNull();
  });
});

describe('GIVEN the app already holds saves', () => {
  describe('WHEN the page saves a result document', () => {
    it('THEN results the app holds are kept and new ones come in', () => {
      const { store, saves } = memoryStore({
        'digi-mini-v1': { v: 1, done: { A: { s: 60, d: '2026-10-23' } } },
      });
      applySave(
        'digi-mini-v1',
        JSON.stringify({
          v: 1,
          done: { A: { s: 999, d: '2026-10-24' }, B: { s: 70, d: '2026-10-24' } },
        }),
        store,
        saves,
      );
      expect(read(store, 'digi-mini-v1').done).toEqual({
        A: { s: 60, d: '2026-10-23' },
        B: { s: 70, d: '2026-10-24' },
      });
    });

    it('THEN an unfinished round of the open puzzle takes the page’s newer state', () => {
      const id = 'DP·TANG·0018';
      const { store, saves } = memoryStore({
        'digi-tangle-v1': { v: 1, done: {}, days: { [id]: { state: 'playing', found: ['a'] } } },
      });
      applySave(
        'digi-tangle-v1',
        JSON.stringify({ v: 1, done: {}, days: { [id]: { state: 'playing', found: ['a', 'b'] } } }),
        store,
        saves,
        id,
      );
      expect(read(store, 'digi-tangle-v1').days[id].found).toEqual(['a', 'b']);
    });
  });

  describe('WHEN the page saves a streak', () => {
    it('THEN the page’s streak replaces the app’s', () => {
      const { store, saves } = memoryStore({ 'digi-mini-streak': { streak: 1 } });
      applySave('digi-mini-streak', JSON.stringify({ streak: 2 }), store, saves);
      expect(read(store, 'digi-mini-streak')).toEqual({ streak: 2 });
    });
  });

  describe('WHEN the page sends something unusable', () => {
    it.each([
      ['digi-mini-v1', 'not json'],
      ['digi-mini-v1', '{"v":2}'],
      ['digi-mini-streak', '3'],
      ['digi-yarn-v1', '{"v":1}'],
    ])('THEN %s = %s changes nothing', (key, value) => {
      const { store, saves } = memoryStore({
        'digi-mini-v1': { v: 1, done: { A: 1 } },
        'digi-mini-streak': { streak: 1 },
      });
      const before = store.keys().map((k) => store.getItem(k));
      applySave(key, value, store, saves);
      expect(store.keys().map((k) => store.getItem(k))).toEqual(before);
    });
  });

  describe('WHEN a page is seeded', () => {
    it('THEN only puzzle saves go in', () => {
      const { store } = memoryStore({
        'digi-mini-v1': { v: 1 },
        'digi-doku-streak': {},
        'noodle-board-v1': {},
        'noodle-app-today': {},
      });
      expect(Object.keys(seedFrom(store)).sort()).toEqual(['digi-doku-streak', 'digi-mini-v1']);
    });
  });
});
