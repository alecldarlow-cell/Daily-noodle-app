import type { TodayItem } from '@noodle/core';
import { act, renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { fileOf, usePlayerExit } from '../playerBack';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
const mockRouter = (jest.requireMock('expo-router') as { router: Record<string, jest.Mock> })
  .router;

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
      expect(handlers[0]()).toBe(false);
      expect(handlers[0]()).toBe(true);
    });
  });

  describe('WHEN its own Back was tapped and then Android’s Back arrives', () => {
    it('THEN Android’s Back is swallowed rather than reaching the tabs', async () => {
      const { result } = await renderHook(() => usePlayerExit());
      await act(() => result.current.back());
      expect(handlers[0]()).toBe(true);
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

describe('GIVEN a feed path', () => {
  it('THEN its file name drops the folder and the extension', async () => {
    expect(fileOf('reports/mini-100.html')).toBe('mini-100');
    expect(fileOf('mini-100')).toBe('mini-100');
  });
});
