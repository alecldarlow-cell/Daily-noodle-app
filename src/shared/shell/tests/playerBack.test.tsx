import type { TodayItem } from '@noodle/core';
import { act, renderHook } from '@testing-library/react-native';
import { Alert, BackHandler, type AlertButton } from 'react-native';

import { progressKey } from '@/shared/played';
import { appStorage } from '@/shared/storage';

import { fileOf, usePlayerExit } from '../playerBack';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
const mockRouter = (
  jest.requireMock('expo-router') as { router: Record<'back' | 'replace' | 'canGoBack', jest.Mock> }
).router;

type Handler = () => boolean | null | undefined;
let handlers: Handler[] = [];
const removed = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
  handlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, fn) => {
    handlers.push(fn as Handler);
    return { remove: removed };
  });
});

afterEach(() => jest.restoreAllMocks());

const item = { type: 'doku', path: 'reports/2026-10-20-doku-12.html' } as TodayItem;

describe('GIVEN a player on screen', () => {
  describe('WHEN its Back is pressed twice', () => {
    it('THEN the screen closes once', async () => {
      const { result } = await renderHook(() => usePlayerExit());
      await act(() => {
        result.current.back();
        result.current.back();
      });
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });
  });

  describe('WHEN it was opened cold, with nothing under it, and Back is pressed', () => {
    it('THEN it goes to Today', async () => {
      mockRouter.canGoBack.mockReturnValue(false);
      const { result } = await renderHook(() => usePlayerExit());
      await act(() => result.current.back());
      expect(mockRouter.replace).toHaveBeenCalledWith('/');
      expect(mockRouter.back).not.toHaveBeenCalled();
    });
  });

  describe('WHEN Android’s Back is pressed, then again before the screen has gone', () => {
    it('THEN the first is left to the navigator and the second is swallowed', async () => {
      await renderHook(() => usePlayerExit());
      expect(handlers).toHaveLength(1);
      expect(handlers[0]!()).toBe(false);
      expect(handlers[0]!()).toBe(true);
    });
  });

  describe('WHEN its own Back was tapped and then Android’s Back arrives', () => {
    it('THEN Android’s Back is swallowed rather than reaching the tabs', async () => {
      const { result } = await renderHook(() => usePlayerExit());
      await act(() => result.current.back());
      expect(handlers[0]!()).toBe(true);
    });
  });

  describe('WHEN the screen has gone', () => {
    it('THEN it stops listening, so Back is the tabs’ own again', async () => {
      const { unmount } = await renderHook(() => usePlayerExit());
      await unmount();
      expect(removed).toHaveBeenCalledTimes(1);
    });
  });

  describe('WHEN Next is pressed twice', () => {
    it('THEN the next puzzle opens once, in its place, by its file name', async () => {
      const { result } = await renderHook(() => usePlayerExit());
      await act(() => {
        result.current.next(item);
        result.current.next(item);
      });
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);
      expect(mockRouter.replace).toHaveBeenCalledWith({
        pathname: '/play/[type]/[file]',
        params: { type: 'doku', file: '2026-10-20-doku-12' },
      });
    });
  });

  describe('WHEN Next is pressed with nothing left to play', () => {
    it('THEN it leaves, as Back does', async () => {
      const { result } = await renderHook(() => usePlayerExit());
      await act(() => result.current.next(null));
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });
  });

  describe('WHEN it has left and Next is pressed', () => {
    it('THEN nothing more happens', async () => {
      const { result } = await renderHook(() => usePlayerExit());
      await act(() => {
        result.current.back();
        result.current.next(item);
      });
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });
});

describe('GIVEN another Doku’s round is kept in the Doku slot', () => {
  const dokuItem = {
    type: 'doku',
    id: 'DP·LEXI·0108',
    name: 'Doku 108',
    path: 'reports/2026-10-29-doku-108.html',
  } as TodayItem;
  const route = {
    pathname: '/play/[type]/[file]',
    params: { type: 'doku', file: '2026-10-29-doku-108' },
  };
  let alert: jest.SpyInstance;
  const buttons = () => alert.mock.calls[0]![2] as AlertButton[];

  beforeEach(() => {
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    appStorage.setItem(
      progressKey('doku'),
      JSON.stringify({ id: 'DP·LEXI·0107', moves: [[0, 'A']], secs: 30 }),
    );
  });
  afterEach(() => appStorage.setItem(progressKey('doku'), 'null'));

  describe('WHEN Play more opens the next Doku', () => {
    it('THEN it asks first, and opens the Doku in its place only when Start is pressed', async () => {
      const { result } = await renderHook(() => usePlayerExit());
      await act(() => result.current.next(dokuItem));
      expect(alert).toHaveBeenCalledTimes(1);
      expect(alert.mock.calls[0]![0]).toBe('Replace your Doku in progress?');
      expect(mockRouter.replace).not.toHaveBeenCalled();
      const start = buttons().find((b) => b.text === 'Start Doku 108')!;
      await act(() => start.onPress!());
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);
      expect(mockRouter.replace).toHaveBeenCalledWith(route);
      expect(handlers[0]!()).toBe(true);
    });
  });

  describe('WHEN the question is cancelled', () => {
    it('THEN the player stays, and Back still closes it', async () => {
      const { result } = await renderHook(() => usePlayerExit());
      await act(() => result.current.next(dokuItem));
      expect(buttons()[0]!.style).toBe('cancel');
      expect(buttons()[0]!.onPress).toBeUndefined();
      await act(() => result.current.back());
      expect(mockRouter.replace).not.toHaveBeenCalled();
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });
  });

  describe('WHEN Play more opens the Doku the slot already holds', () => {
    it('THEN it opens straight away, as before', async () => {
      const { result } = await renderHook(() => usePlayerExit());
      await act(() => result.current.next({ ...dokuItem, id: 'DP·LEXI·0107' }));
      expect(alert).not.toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith(route);
    });
  });
});

describe('GIVEN a feed path', () => {
  it('THEN its file name drops the folder and the extension', async () => {
    expect(fileOf('reports/mini-100.html')).toBe('mini-100');
    expect(fileOf('mini-100')).toBe('mini-100');
  });
});
