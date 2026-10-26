import { act, fireEvent, screen } from '@testing-library/react-native';
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';

import { appStorage } from '@/shared/storage';
import { heldStyle, mockSite, renderWithProviders } from '@/shared/testing';
import { PRESSED } from '@/shared/ui';

import { SweepScreen } from '../components/SweepScreen';
import { file94 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

const START = 22;
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

describe('GIVEN a Sweep on the board', () => {
  describe('WHEN Dig, Flag and Hint are held', () => {
    it('THEN each shows the pressed look', async () => {
      await renderWithProviders(<SweepScreen file={file94} />);
      await play();
      for (const name of ['⛏ Dig', '⚑ Flag', 'Hint'])
        expect(await heldStyle(screen.getByRole('button', { name }))).toMatchObject(PRESSED);
    });
  });

  describe('WHEN the app goes to the background mid-round', () => {
    it('THEN the clock stops while away and picks up on return', async () => {
      jest.useFakeTimers();
      await renderWithProviders(<SweepScreen file={file94} />);
      await play();
      await fireEvent.press(screen.getByTestId(`sq-${START}`));
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });
      await act(async () => setAppState('background'));
      await act(async () => {
        jest.advanceTimersByTime(45_000);
      });
      await act(async () => setAppState('active'));
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('puzzle-clock')).toHaveTextContent('0:05');
    });
  });

  describe('WHEN the board’s slot is short', () => {
    it('THEN the board fits the room it has', async () => {
      await renderWithProviders(<SweepScreen file={file94} />);
      await play();
      await fireEvent(screen.getByTestId('board-slot'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 366, height: 226 } },
      });
      expect(StyleSheet.flatten(screen.getByTestId('sweep-board').props.style)).toMatchObject({
        width: 226,
        height: 226,
      });
    });
  });
});
