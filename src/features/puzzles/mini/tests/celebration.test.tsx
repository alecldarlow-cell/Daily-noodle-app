import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { forgetReduceMotion, onBurst } from '@/shared/motion';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { MiniScreen } from '../components/MiniScreen';
import { SAVE_KEY } from '../model';
import { file105, mini105 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
let thrown: number[] = [];
let off = () => {};
beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  forgetReduceMotion();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  mockSite({});
  thrown = [];
  off = onBurst((n) => thrown.push(n));
});
afterEach(async () => {
  off();
  jest.restoreAllMocks();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN a Mini played to the end on this phone', () => {
  describe('WHEN the last letter goes in', () => {
    it('THEN the board waves, confetti flies twice, and the sheet rises', async () => {
      await renderWithProviders(<MiniScreen file={file105} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 5; c++) {
          const ch = mini105.grid[r]![c]!;
          if (ch === '#') continue;
          await press(`cell-${r}-${c}`);
          await press(`key-${ch}`);
        }
      await waitFor(() => expect(screen.getAllByTestId('wave-cell').length).toBeGreaterThan(0));
      await waitFor(() => expect(thrown).toEqual([150]), { timeout: 1000 });
      await waitFor(() => expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen(), {
        timeout: 3000,
      });
      await waitFor(() => expect(thrown).toEqual([150, 60]), { timeout: 1000 });
    });
  });
});

describe('GIVEN a Mini already finished, opened again', () => {
  it('THEN it opens quietly on its sheet: no wave, no confetti', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, done: { 'DP·MINI·0105': { s: 87, d: '2026-10-24' } } }),
    );
    await renderWithProviders(<MiniScreen file={file105} />);
    expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1600));
    });
    expect(thrown).toEqual([]);
    expect(screen.queryAllByTestId('wave-cell')).toHaveLength(0);
  });
});
