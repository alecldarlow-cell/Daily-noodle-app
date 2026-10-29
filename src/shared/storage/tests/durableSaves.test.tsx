/*
 * Fault injection for hardening H1 (R1, R2): a phone storage that fails writes or reads on
 * demand, under the real save rules (@noodle/core's createSaveStore) and the app's notices.
 */
import { createSaveStore } from '@noodle/core';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';

import { isDisposableKey } from '../appStorage';
import {
  createCachedStorage,
  RETRY_MS,
  type AsyncBackend,
  type CachedStorage,
} from '../cachedStorage';
import { SaveNotice, SavesLoadFailed } from '../SaveNotices';
import { useStoreLoad } from '../useStoreLoad';

const MINI = 'digi-mini-v1';
const STREAK = 'digi-mini-streak';
const ID = 'DP·MINI·0100';
const DAY1 = Date.parse('2026-10-24T09:00:00Z');
const DAY2 = Date.parse('2026-10-25T09:00:00Z');

/** A phone's storage that survives "relaunches" (new stores over the same data). */
function disk(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  const faults = { write: new Set<string>(), read: false as false | 'throw' | 'partial' };
  const b: AsyncBackend & { data: Map<string, string>; faults: typeof faults } = {
    data,
    faults,
    getAllKeys: async () => [...data.keys()],
    multiGet: async (keys) => {
      if (faults.read === 'throw') throw new Error('database locked');
      const got = keys.map((k) => [k, data.get(k) ?? null] as const);
      return faults.read === 'partial' ? got.slice(0, 1) : got;
    },
    setItem: async (k, v) => {
      if (faults.write.has(k)) throw new Error('disk full');
      data.set(k, v);
    },
  };
  return b;
}

const launch = (b: AsyncBackend) => createCachedStorage(b, { isDisposable: isDisposableKey });

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('GIVEN a phone whose storage fails the result and streak writes', () => {
  describe('WHEN a Mini is finished', () => {
    it('THEN the notice shows, and once storage is back the retry saves it and a relaunch keeps the original result and date', async () => {
      jest.useFakeTimers();
      const b = disk();
      const store = launch(b);
      await store.hydrate();
      await render(<SaveNotice store={store} />);
      expect(screen.queryByText('Couldn’t save, retrying')).toBeNull();

      b.faults.write.add(MINI).add(STREAK);
      const saves = createSaveStore(store, { now: () => DAY1 });
      await act(async () => {
        saves.putDone(MINI, ID, { s: 61 });
        saves.saveStreak(STREAK, { streak: 1, best: 1, last: '2026-10-24' });
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText('Couldn’t save, retrying')).toBeOnTheScreen();
      expect(store.unsaved().sort()).toEqual([STREAK, MINI].sort());
      expect(b.data.has(MINI)).toBe(false);
      // A cache failing as well changes nothing about the notice.
      b.faults.write.add('noodle-app-today');
      store.setItem('noodle-app-today', '[]');

      b.faults.write.clear(); // storage restored
      await act(async () => {
        await jest.advanceTimersByTimeAsync(RETRY_MS[0]);
      });
      expect(screen.queryByText('Couldn’t save, retrying')).toBeNull();
      expect(store.unsaved()).toEqual([]);

      // Relaunch, a day later: the first result and its date stand.
      const again = launch(b);
      await again.hydrate();
      const later = createSaveStore(again, { now: () => DAY2 });
      expect(later.getDone(MINI, ID)).toEqual({ s: 61, d: '2026-10-24' });
      expect(later.putDone(MINI, ID, { s: 30 })).toEqual({ s: 61, d: '2026-10-24' });
      expect(JSON.parse(again.getItem(STREAK)!)).toEqual({
        streak: 1,
        best: 1,
        last: '2026-10-24',
      });
    });

    it('THEN leaving the app tries the queued writes again at once', async () => {
      const listeners: ((s: string) => void)[] = [];
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
        listeners.push(fn as (s: string) => void);
        return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
      });
      const b = disk();
      const store = launch(b);
      await store.hydrate();
      await render(<SaveNotice store={store} />);
      b.faults.write.add(MINI);
      await act(async () => {
        createSaveStore(store, { now: () => DAY1 }).putDone(MINI, ID, { s: 61 });
        await Promise.resolve();
      });
      expect(screen.getByTestId('save-notice')).toBeOnTheScreen();
      b.faults.write.clear();
      await act(async () => {
        listeners.forEach((fn) => fn('background'));
        await store.flush().catch(() => undefined);
      });
      expect(JSON.parse(b.data.get(MINI)!).done[ID]).toEqual({ s: 61, d: '2026-10-24' });
      expect(screen.queryByTestId('save-notice')).toBeNull();
    });
  });
});

/** Old history: results, a streak, the league identity. */
const history = () =>
  disk({
    [MINI]: JSON.stringify({ v: 1, done: { 'DP·MINI·0090': { s: 75, d: '2026-10-10' } } }),
    [STREAK]: JSON.stringify({ streak: 9, best: 12, last: '2026-10-23' }),
    'digi.aid': 'aid-123',
    'noodle-board-v1': JSON.stringify({ v: 1, leagues: [{ code: 'ABCD', name: 'Alec' }] }),
  });

function expectHistoryKept(store: CachedStorage) {
  expect(JSON.parse(store.getItem(MINI)!).done['DP·MINI·0090']).toEqual({ s: 75, d: '2026-10-10' });
  expect(JSON.parse(store.getItem(STREAK)!)).toMatchObject({ best: 12 });
  expect(store.getItem('digi.aid')).toBe('aid-123');
  expect(JSON.parse(store.getItem('noodle-board-v1')!).leagues[0].code).toBe('ABCD');
}

describe.each([
  ['fails', 'throw'],
  ['comes back partial', 'partial'],
] as const)('GIVEN a phone with history whose launch read %s', (_name, fault) => {
  describe('WHEN a finish happens before and after a good read', () => {
    it('THEN old results, league identity and streaks survive', async () => {
      const b = history();
      const before = new Map(b.data);
      b.faults.read = fault;
      const store = launch(b);
      await expect(store.hydrate()).rejects.toThrow();
      expect(store.hydrated).toBe(false);
      expect(store.getItem('digi.aid')).toBeNull(); // nothing half-read is used

      // A stray finish on the unread store (the app shows no puzzles then) never reaches the disk.
      createSaveStore(store, { now: () => DAY1 }).putDone(MINI, ID, { s: 61 });
      await store.flush();
      expect(b.data).toEqual(before);

      b.faults.read = false; // Try again
      await store.hydrate();
      expectHistoryKept(store);

      // A finish after the good read joins the history.
      const saves = createSaveStore(store, { now: () => DAY1 });
      saves.putDone(MINI, ID, { s: 50 });
      await store.flush();
      const relaunched = launch(b);
      await relaunched.hydrate();
      expectHistoryKept(relaunched);
      expect(JSON.parse(relaunched.getItem(MINI)!).done[ID]).toEqual({ s: 50, d: '2026-10-24' });
    });
  });
});

function Gate({ store }: { store: CachedStorage }) {
  const { state, retry } = useStoreLoad(store);
  if (state === 'loading') return null;
  if (state !== 'ready') return <SavesLoadFailed retrying={state === 'retrying'} onRetry={retry} />;
  return <Text>{`aid ${store.getItem('digi.aid')}`}</Text>;
}

describe('GIVEN the launch read fails', () => {
  describe('WHEN the app opens and Try again is pressed once the phone recovers', () => {
    it('THEN it says the saves couldn’t be loaded, then opens with them', async () => {
      const b = history();
      b.faults.read = 'throw';
      const store = launch(b);
      await render(<Gate store={store} />);
      await act(async () => {
        await store.hydrate().catch(() => undefined);
      });
      expect(screen.getByText('Couldn’t load your saves')).toBeOnTheScreen();
      expect(screen.queryByText(/^aid/)).toBeNull();

      // Still failing: the state stays.
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      await act(async () => {
        await store.hydrate().catch(() => undefined);
      });
      expect(screen.getByText('Couldn’t load your saves')).toBeOnTheScreen();

      // Reading again: the button says so, and a second press does nothing.
      b.faults.read = false;
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      const real = b.getAllKeys;
      const reads = jest.fn();
      b.getAllKeys = async () => {
        reads();
        await held;
        return real();
      };
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(screen.getByRole('button', { name: 'Trying again…' })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Trying again…' }));
      expect(reads).toHaveBeenCalledTimes(1);
      await act(async () => {
        release();
        await store.hydrate();
      });
      expect(screen.getByText('aid aid-123')).toBeOnTheScreen();
    });
  });

  describe('WHEN the store was already read', () => {
    it('THEN the app opens at once', async () => {
      const store = launch(history());
      await store.hydrate();
      await render(<Gate store={store} />);
      expect(screen.getByText('aid aid-123')).toBeOnTheScreen();
    });
  });
});
