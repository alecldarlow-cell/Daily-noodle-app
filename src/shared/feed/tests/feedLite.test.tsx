import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { QueryProvider } from '@/shared/query';
import { createCachedStorage } from '@/shared/storage';
import { mockSite, testQueryClient } from '@/shared/testing';

import {
  BadFeedError,
  LAST_FEED_KEY,
  parseFeedLite,
  useFeedLite,
  type FeedItem,
} from '../feedLite';

const good: FeedItem = {
  path: 'reports/2026-10-24-crossword-mini-0105.html',
  type: 'mini',
  id: 'DP·MINI·0105',
  date: '2026-10-24',
  headline: 'Mini 105',
  standfirst: 'A Bramley or a Cox.',
  read: '~3 min',
  mask: '.....',
  json: 'reports/2026-10-24-crossword-mini-0105.json',
};
const sweep = {
  path: 'reports/2026-10-24-logic-sweep.html',
  type: 'sweep',
  id: 'DP·SWEEP·2026-10-24',
  date: '2026-10-24',
  headline: 'Sweep 100',
};

/** Every way a card can be unusable. */
const JUNK: unknown[] = [
  null,
  'Mini 104',
  { ...good, path: undefined },
  { ...good, path: 'https://elsewhere.example/x.html' },
  { ...good, type: 'crossword' },
  { ...good, path: 'reports/a.html', type: 'sweep' }, // id says Mini
  { ...good, path: 'reports/b.html', id: 42 },
  { ...good, path: 'reports/c.html', date: '24 Oct' },
  { ...good, path: 'reports/d.html', headline: null },
  { ...good }, // the same page twice
];

const store = () =>
  createCachedStorage({
    getAllKeys: async () => [],
    multiGet: async () => [],
    setItem: async () => {},
  });

describe('GIVEN the site’s card list', () => {
  describe('WHEN some cards are malformed or mismatched', () => {
    it('THEN they are dropped and the rest kept, with missing text filled in empty', () => {
      const lite = parseFeedLite({
        built: 'b',
        today: '2026-10-24',
        count: 99,
        items: [good, ...JUNK, sweep],
      });
      expect(lite.items).toEqual([
        good,
        { ...sweep, standfirst: '', read: '', mask: '', json: null },
      ]);
      expect(lite).toMatchObject({ built: 'b', today: '2026-10-24', count: 2 });
      expect(parseFeedLite({ items: [] })).toEqual({ built: '', today: '', count: 0, items: [] });
    });
  });

  describe('WHEN the answer is not a card list at all', () => {
    it.each([null, 'x', [], { items: 'none' }, {}])('THEN %p is refused', (x) => {
      expect(() => parseFeedLite(x)).toThrow(BadFeedError);
    });
  });
});

describe('GIVEN a last good copy of the list on the phone', () => {
  const wrap = () => {
    const client = testQueryClient();
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryProvider client={client}>{children}</QueryProvider>;
    };
  };

  describe('WHEN the site sends something that isn’t a list', () => {
    it('THEN the good copy is still shown and still kept', async () => {
      const s = store();
      const kept = JSON.stringify({ built: 'b', today: '2026-10-23', count: 1, items: [good] });
      s.setItem(LAST_FEED_KEY, kept);
      const site = mockSite({ 'feed-lite.json': { error: 'oops' } });
      const { result } = await renderHook(() => useFeedLite(s), { wrapper: wrap() });
      await waitFor(() => expect(site).toHaveBeenCalled());
      await waitFor(() => expect(result.current.isFetching).toBe(false));
      expect(result.current.data?.items).toEqual([good]);
      expect(s.getItem(LAST_FEED_KEY)).toBe(kept);
    });
  });

  describe('WHEN the site sends a list with bad cards', () => {
    it('THEN only the good cards are shown and kept', async () => {
      const s = store();
      mockSite({
        'feed-lite.json': { built: 'c', today: '2026-10-24', count: 3, items: [good, ...JUNK] },
      });
      const { result } = await renderHook(() => useFeedLite(s), { wrapper: wrap() });
      await waitFor(() => expect(result.current.data?.built).toBe('c'));
      expect(result.current.data?.items).toEqual([good]);
      expect(JSON.parse(s.getItem(LAST_FEED_KEY)!).items).toEqual([good]);
      await act(async () => undefined);
    });
  });

  describe('WHEN the kept copy itself is malformed (an older app kept it)', () => {
    it('THEN its bad cards are dropped before it is shown', async () => {
      const s = store();
      s.setItem(LAST_FEED_KEY, JSON.stringify({ items: [good, ...JUNK] }));
      mockSite({ 'feed-lite.json': new TypeError('Network request failed') });
      const { result } = await renderHook(() => useFeedLite(s), { wrapper: wrap() });
      expect(result.current.data?.items).toEqual([good]);
      await act(async () => undefined);
    });
  });
});
