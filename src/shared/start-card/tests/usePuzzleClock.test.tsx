import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { usePuzzleClock } from '../usePuzzleClock';

let listeners: ((s: AppStateStatus) => void)[] = [];
const setAppState = (s: AppStateStatus) => listeners.forEach((fn) => fn(s));
const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

type Props = { running: boolean; reset?: number; initial?: number };
let hook: {
  result: { current: ReturnType<typeof usePuzzleClock> };
  rerender: (p: Props) => Promise<void> | void;
};
const useClock = (q: Props) => usePuzzleClock(q.running, { reset: q.reset, initial: q.initial });
const mount = async (p: Props) => {
  hook = (await renderHook(useClock, {
    initialProps: p,
  })) as unknown as typeof hook;
  return {
    rerender: async (q: Props) =>
      act(async () => {
        await hook.rerender(q);
      }),
  };
};
const shown = () => String(hook.result.current.secs);
const read = () => hook.result.current.read();

beforeEach(() => {
  jest.useFakeTimers();
  listeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
    listeners.push(fn as (s: AppStateStatus) => void);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('GIVEN a grid player’s clock', () => {
  describe('WHEN it is not running yet', () => {
    it('THEN it stays at zero', async () => {
      await mount({ running: false });
      await wait(5000);
      expect(shown()).toBe('0');
      expect(read()).toBe(0);
    });
  });

  describe('WHEN it runs with the app in front', () => {
    it('THEN it moves once a second, and read() gives the exact whole seconds', async () => {
      await mount({ running: true });
      await wait(3000);
      expect(shown()).toBe('3');
      await wait(600);
      expect(shown()).toBe('3');
      expect(read()).toBe(3);
      await wait(400);
      expect(read()).toBe(4);
    });
  });

  describe('WHEN the app goes to the background for a minute and comes back', () => {
    it('THEN the time away never counts', async () => {
      await mount({ running: true });
      await wait(2000);
      await act(async () => setAppState('background'));
      await wait(60_000);
      expect(shown()).toBe('2');
      expect(read()).toBe(2);
      await act(async () => setAppState('active'));
      await wait(3000);
      expect(shown()).toBe('5');
    });
    it('THEN an iOS “inactive” spell (the app switcher) doesn’t count either', async () => {
      await mount({ running: true });
      await wait(1000);
      await act(async () => setAppState('inactive'));
      await wait(10_000);
      await act(async () => setAppState('active'));
      await wait(1000);
      expect(shown()).toBe('2');
    });
  });

  describe('WHEN it stops (the puzzle is solved) and a new round starts', () => {
    it('THEN it holds its last value, then goes back to zero for the new round', async () => {
      const r = await mount({ running: true, reset: 1 });
      await wait(4000);
      await r.rerender({ running: false, reset: 1 });
      await wait(5000);
      expect(shown()).toBe('4');
      expect(read()).toBe(4);
      await r.rerender({ running: false, reset: 2 });
      expect(shown()).toBe('0');
      expect(read()).toBe(0);
      await r.rerender({ running: true, reset: 2 });
      await wait(2000);
      expect(shown()).toBe('2');
    });
  });

  describe('WHEN an unfinished round is resumed with 75 seconds already on it', () => {
    it('THEN it shows 75 at once and carries on from there', async () => {
      const m = await mount({ running: false, initial: 75 });
      expect(shown()).toBe('75');
      expect(read()).toBe(75);
      await m.rerender({ running: true, initial: 75 });
      await wait(3000);
      expect(shown()).toBe('78');
      expect(read()).toBe(78);
    });
  });
});
