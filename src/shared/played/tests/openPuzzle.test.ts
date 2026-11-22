import { router } from 'expo-router';
import { Alert } from 'react-native';

import { DOUBLE_TAP_MS, openPuzzle, pushPuzzle } from '../openPuzzle';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const MINI = {
  type: 'mini' as const,
  name: 'Mini 106',
  path: 'reports/2026-10-25-crossword-mini-0106.html',
};
const route = (file: string) => ({
  pathname: '/play/[type]/[file]',
  params: { type: 'mini', file },
});

let alert: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => alert.mockRestore());

describe('GIVEN a card tapped (every puzzle keeps its own round, 22 Nov 2026)', () => {
  it('THEN the puzzle opens straight away, with no "isn’t finished" question', () => {
    jest.useFakeTimers({ now: 500_000 });
    openPuzzle(MINI);
    expect(alert).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(route('2026-10-25-crossword-mini-0106'));
    jest.useRealTimers();
  });
});

describe('GIVEN a player opens the puzzle with its own opener', () => {
  it('THEN that opener is used and push is not', () => {
    const open = jest.fn();
    openPuzzle(MINI, open);
    expect(open).toHaveBeenCalledWith(route('2026-10-25-crossword-mini-0106'));
    expect(alert).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('GIVEN a card tapped twice in quick succession', () => {
  afterEach(() => jest.useRealTimers());

  describe('WHEN both taps open the same puzzle', () => {
    it('THEN only one copy is opened', () => {
      jest.useFakeTimers({ now: 1_000_000 });
      openPuzzle(MINI);
      jest.setSystemTime(1_000_000 + DOUBLE_TAP_MS - 1);
      openPuzzle(MINI);
      expect(router.push).toHaveBeenCalledTimes(1);
    });
  });

  describe('WHEN the second tap comes after the guard has passed', () => {
    it('THEN it opens again (the player came back and tapped once more)', () => {
      jest.useFakeTimers({ now: 2_000_000 });
      openPuzzle(MINI);
      jest.setSystemTime(2_000_000 + DOUBLE_TAP_MS);
      openPuzzle(MINI);
      expect(router.push).toHaveBeenCalledTimes(2);
    });
  });

  describe('WHEN the taps open two different puzzles', () => {
    it('THEN both open', () => {
      jest.useFakeTimers({ now: 3_000_000 });
      openPuzzle(MINI);
      openPuzzle({ ...MINI, path: 'reports/2026-10-24-crossword-mini-0105.html' });
      expect(router.push).toHaveBeenCalledTimes(2);
    });
  });

  describe('WHEN a league board’s Play link is tapped twice', () => {
    it('THEN only one copy is opened', () => {
      jest.useFakeTimers({ now: 4_000_000 });
      const href = route('2026-11-10-sweep-117') as Parameters<typeof pushPuzzle>[0];
      pushPuzzle(href);
      pushPuzzle(href);
      expect(router.push).toHaveBeenCalledTimes(1);
    });
  });
});
