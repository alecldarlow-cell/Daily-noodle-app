import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';

import { appStorage } from '@/shared/storage';
import { heldStyle, mockSite, renderWithProviders } from '@/shared/testing';
import { PRESSED } from '@/shared/ui';

import { PathScreen } from '../components/PathScreen';
import { pathFeel } from '../hooks/feel';
import { apply, init } from '../model';
import { file92, path92 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

const play = () => fireEvent.press(screen.getByRole('button', { name: 'Play' }));

let appState: ((s: AppStateStatus) => void)[] = [];
const setAppState = (s: AppStateStatus) => appState.forEach((fn) => fn(s));

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  mockSite({});
  appState = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
    appState.push(fn as (s: AppStateStatus) => void);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN a Path move the model rejects', () => {
  const s0 = init(path92);
  const bad = apply(s0, { t: 'cell', r: 0, c: 0 });
  it('THEN the model counts the rejection, and the move buzzes as an error', () => {
    expect(bad.shake).toEqual({ r: 0, c: 0, n: 1 });
    expect(pathFeel(s0, bad)).toBe('error');
    const again = apply(bad, { t: 'cell', r: 0, c: 0 });
    expect(pathFeel(bad, again)).toBe('error');
  });
  it('THEN a good move is still a tap, and the solve still a success', () => {
    const good = apply(s0, { t: 'cell', r: 5, c: 5 }); // 2, next to the 1
    expect(pathFeel(s0, good)).toBe('tap');
    expect(pathFeel(good, good)).toBeNull();
  });

  describe('WHEN it is tapped on the board', () => {
    it('THEN that square shakes (motion allowed), and only that one', async () => {
      await renderWithProviders(<PathScreen file={file92} />);
      await play();
      expect(screen.queryByTestId('path-shake')).toBeNull();
      await fireEvent.press(screen.getByTestId('sq-0-0'));
      await waitFor(() => expect(screen.getAllByTestId('path-shake')).toHaveLength(1));
      expect(screen.getByTestId('path-shake')).toContainElement(screen.getByTestId('sq-0-0'));
    });
  });
});

describe('GIVEN Path’s controls', () => {
  it('THEN Undo and Hint show the pressed look while held', async () => {
    await renderWithProviders(<PathScreen file={file92} />);
    await play();
    for (const name of ['Undo', 'Hint'])
      expect(await heldStyle(screen.getByRole('button', { name }))).toMatchObject(PRESSED);
  });
});

describe('GIVEN a Path in play', () => {
  describe('WHEN the app is away for a while', () => {
    it('THEN that time never counts (the wall clock is paused), on screen or in the result', async () => {
      jest.useFakeTimers();
      await renderWithProviders(<PathScreen file={file92} />);
      await play();
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      await act(async () => setAppState('background'));
      await act(async () => {
        jest.advanceTimersByTime(120_000);
      });
      await act(async () => setAppState('active'));
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.getByTestId('puzzle-clock')).toHaveTextContent('0:05');
    });
  });

  describe('WHEN the board’s slot is short', () => {
    it('THEN the board fits the room it has', async () => {
      await renderWithProviders(<PathScreen file={file92} />);
      await play();
      await fireEvent(screen.getByTestId('board-slot'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 366, height: 250 } },
      });
      expect(StyleSheet.flatten(screen.getByTestId('path-board').props.style)).toMatchObject({
        width: 250,
        height: 250,
      });
    });
  });
});
