/**
 * AF-029: a round left part-way survives the app being fully closed, not just sent to the
 * background. Each test plays on one store, leaves (the app goes to the background, then
 * the screen goes away), and opens the puzzle again on a NEW store hydrated from what the
 * first one wrote to the phone's storage: a cold start. The reopened puzzle must show the
 * round paused behind Resume with its time, score and answers as they were.
 */
import { createSaveStore, londonDay } from '@noodle/core';
import { act, fireEvent, renderHook, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { createCachedStorage, type AsyncBackend, type CachedStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { BordersScreen } from '../borders/components/BordersScreen';
import { SAVE_KEY as BORDERS_KEY } from '../borders/model';
import { borders15, file15 } from '../borders/tests/fixtures';
import { ReckonScreen } from '../reckon/components/ReckonScreen';
import { SAVE_KEY as RECKON_KEY } from '../reckon/model';
import { file2, reckon2 } from '../reckon/tests/fixtures';
import { useTangleGame } from '../tangle/hooks/useTangleGame';
import { homeCard, KEY as TANGLE_KEY } from '../tangle/model';
import { findPath } from '../tangle/oracle';
import { file19, tangle19 } from '../tangle/tests/fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('react-native-webview', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { WebView: () => createElement(View, { testID: 'drawing' }) };
});
jest.setTimeout(30_000);

/** The phone's storage (AsyncStorage): it outlives the app, the in-memory store doesn't. */
function disk(): AsyncBackend & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getAllKeys: async () => [...data.keys()],
    multiGet: async (keys) => keys.map((k) => [k, data.get(k) ?? null] as const),
    setItem: async (k, v) => {
      data.set(k, v);
    },
  };
}

/** The app opening: a fresh store loaded from the phone's storage. */
async function launch(backend: AsyncBackend): Promise<CachedStorage> {
  const store = createCachedStorage(backend);
  await store.hydrate();
  return store;
}

let appState: ((s: AppStateStatus) => void)[] = [];
const setAppState = (s: AppStateStatus) => appState.forEach((fn) => fn(s));
beforeEach(() => {
  appState = [];
  mockSite({});
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
    appState.push(fn as (s: AppStateStatus) => void);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('GIVEN a Tangle round part-way', () => {
  const NOW = Date.parse('2026-10-25T09:00:00Z');
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  const run = (ms: number) =>
    act(async () => {
      jest.advanceTimersByTime(ms);
    });
  const open = (store: CachedStorage) =>
    renderHook(() =>
      useTangleGame(file19, {
        store,
        saves: createSaveStore(store, { now: () => Date.now() }),
        now: () => Date.now(),
        reduced: true,
      }),
    );

  async function playThenLeave(how: AppStateStatus) {
    const backend = disk();
    const store = await launch(backend);
    const first = await open(store);
    await act(async () => first.result.current.engine.playCard());
    await run(3100); // the 3-2-1
    await act(async () => void first.result.current.engine.submit(findPath(tangle19, 'air')!));
    await run(12_000);
    const left = first.result.current.engine.s.R!.left;
    await act(async () => setAppState(how));
    // The app is killed there: nothing more runs (no unmount, no pagehide).
    await store.flush();
    return { backend, left, first };
  }

  describe('WHEN the app goes to the background and is then closed', () => {
    it('THEN reopening shows the round paused, Resume, the same time left and words', async () => {
      const { backend, left, first } = await playThenLeave('background');
      await run(60_000); // time away
      const next = await launch(backend);
      await first.unmount();
      const again = await open(next);
      const e = again.result.current.engine;
      const card = homeCard(e, londonDay(NOW));
      expect(card.head).toBe('Round paused');
      expect(card.go).toBe('Resume');
      expect(e.s.D).toMatchObject({ state: 'playing', found: ['air'], score: 1, left });
      expect(card.status).toBe(`1:${Math.ceil(left) - 60} left, 1 point so far.`);
      // Resume counts in from the same time; nothing ran while the app was closed.
      await act(async () => e.playCard());
      expect(e.s.counting).toBe(true);
      expect(e.s.R!.left).toBe(left);
      await again.unmount();
    });
  });

  describe('WHEN the app is closed straight from the app switcher (inactive, no background)', () => {
    it('THEN the round is still kept where it stood when the app was left', async () => {
      const { backend, left, first } = await playThenLeave('inactive');
      const store = await launch(backend);
      await first.unmount();
      const day = JSON.parse(store.getItem(TANGLE_KEY)!).days['DP·TANG·0019'];
      expect(day).toMatchObject({ state: 'playing', found: ['air'], left });
    });
  });
});

describe('GIVEN a Borders round part-way', () => {
  const NOW = Date.parse('2026-10-19T09:00:00Z');
  let t = 0;
  const deps = (store: CachedStorage) => ({
    store,
    saves: createSaveStore(store, { now: () => NOW }),
    perf: () => t,
    wall: () => NOW,
  });
  const press = (id: string) => fireEvent.press(screen.getByTestId(id));
  const pick = (i: number, right: boolean) => {
    const q = borders15.qs[i]!;
    return right ? q.o.indexOf(q.n) : q.o.findIndex((n) => n !== q.n);
  };
  /** Let animation frames run with the play clock moving `ms`. */
  const play = async (ms: number) => {
    for (let k = 0; k < 4; k++) {
      t += ms / 4;
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40));
      });
    }
  };

  describe('WHEN the app goes to the background on a question and is then closed', () => {
    it('THEN reopening shows Resume on the start screen, and the round goes on as it was', async () => {
      t = 0;
      const backend = disk();
      const a = await launch(backend);
      const r = await renderWithProviders(<BordersScreen file={file15} deps={deps(a)} />);
      await press('borders-play-button');
      await play(2000);
      await press(`borders-opt-${pick(0, true)}`);
      await press('borders-next');
      await press(`borders-opt-${pick(1, false)}`);
      await press('borders-next');
      await play(2000);
      await act(async () => setAppState('background'));
      const kept = JSON.parse(a.getItem(BORDERS_KEY)!).cur;
      expect(kept.secs).toBeGreaterThan(0);
      // Killed there: the next launch reads only what reached the phone's storage.
      await a.flush();
      t += 60_000; // time away never counts
      const b = await launch(backend);
      await r.unmount();
      await renderWithProviders(<BordersScreen file={file15} deps={deps(b)} />);
      expect(screen.getByText('Question 3 of 10, 100 points so far.')).toBeOnTheScreen();
      expect(screen.getByTestId('borders-play-button')).toHaveTextContent('Resume');
      await press('borders-play-button');
      expect(screen.getByTestId('borders-quiz')).toBeOnTheScreen();
      expect(screen.getByTestId('borders-points')).toHaveTextContent('100 pts');
      const back = JSON.parse(b.getItem(BORDERS_KEY)!).cur;
      expect(back).toMatchObject({ id: borders15.id, ans: kept.ans, pts: 100, i: 2 });
      expect(back.secs).toBe(kept.secs);
    });
  });
});

describe('GIVEN a Reckon round part-way', () => {
  const NOW = Date.parse('2026-10-21T09:00:00Z');
  let t = 0;
  const deps = (store: CachedStorage) => ({
    store,
    saves: createSaveStore(store, { now: () => NOW }),
    perf: () => t,
    wall: () => NOW,
  });
  const press = (id: string) => fireEvent.press(screen.getByTestId(id));
  const text = (id: string) => String(screen.getByTestId(id).props.children);
  const play = async (ms: number) => {
    for (let k = 0; k < 4; k++) {
      t += ms / 4;
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40));
      });
    }
  };

  describe('WHEN the app goes to the background mid-guess and is then closed', () => {
    it('THEN reopening shows Resume on the start screen, and the round goes on as it was', async () => {
      t = 0;
      const backend = disk();
      const a = await launch(backend);
      const r = await renderWithProviders(<ReckonScreen file={file2} deps={deps(a)} />);
      await press('reckon-play-button');
      await play(2000);
      await press('reckon-act');
      t += 1000;
      await press('reckon-act');
      expect(text('reckon-qn')).toBe('2/10');
      const score = text('reckon-score');
      await press('reckon-plus');
      await play(2000);
      await act(async () => setAppState('background'));
      const kept = JSON.parse(a.getItem(RECKON_KEY)!).cur;
      expect(kept.secs).toBeGreaterThan(0);
      await a.flush();
      t += 60_000;
      const b = await launch(backend);
      await r.unmount();
      await renderWithProviders(<ReckonScreen file={file2} deps={deps(b)} />);
      expect(screen.getByText(`Question 2 of 10, ${score} points so far.`)).toBeOnTheScreen();
      expect(screen.getByTestId('reckon-play-button')).toHaveTextContent('Resume');
      await press('reckon-play-button');
      expect(text('reckon-qn')).toBe('2/10');
      expect(text('reckon-score')).toBe(score);
      const back = JSON.parse(b.getItem(RECKON_KEY)!).cur;
      expect(back).toMatchObject({ id: reckon2.id, i: 1, g: kept.g, z: kept.z, cur: kept.cur });
      expect(back.secs).toBe(kept.secs);
    });
  });
});
