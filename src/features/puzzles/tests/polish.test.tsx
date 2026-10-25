/**
 * WP12 at the screens: haptics fire from the screens' hooks at the moments that matter,
 * the finish sheet arrives with its entrance only on a fresh finish, and the boards fit
 * a 320 × 568 phone.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Animated, Dimensions, StyleSheet } from 'react-native';

import { forgetReduceMotion } from '@/shared/motion';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { DokuScreen } from '../doku/components/DokuScreen';
import { file97 } from '../doku/tests/fixtures';
import { LinkScreen } from '../link/components/LinkScreen';
import { file78, link78 } from '../link/tests/fixtures';
import { MiniScreen } from '../mini/components/MiniScreen';
import { file105, mini105 } from '../mini/tests/fixtures';
import { PathScreen } from '../path/components/PathScreen';
import { file92 } from '../path/tests/fixtures';
import { SweepScreen } from '../sweep/components/SweepScreen';
import { file94 } from '../sweep/tests/fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
}));
jest.setTimeout(30_000);

const H = jest.mocked(Haptics);
const { Success, Error: Wrong } = Haptics.NotificationFeedbackType;
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const play = () => fireEvent.press(screen.getByRole('button', { name: 'Play' }));
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });

async function solveMini() {
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      const ch = mini105.grid[r]![c]!;
      if (ch === '#') continue;
      await press(`cell-${r}-${c}`);
      await press(`key-${ch}`);
    }
}

let timing: jest.SpyInstance;
beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
  forgetReduceMotion();
  timing = jest.spyOn(Animated, 'timing');
  mockSite({});
});
afterEach(async () => {
  timing.mockRestore();
  await settle();
});

describe('GIVEN a Mini being played', () => {
  describe('WHEN a letter goes in, a check finds it wrong, and the grid is solved', () => {
    it('THEN a light tap, an error buzz, a success; and the sheet makes its entrance', async () => {
      await renderWithProviders(<MiniScreen file={file105} />);
      await play();
      await press('cell-0-0');
      await press('key-X');
      expect(H.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
      await fireEvent.press(screen.getByRole('button', { name: 'Check all' }));
      expect(H.notificationAsync).toHaveBeenLastCalledWith(Wrong);
      await solveMini();
      expect(H.notificationAsync).toHaveBeenLastCalledWith(Success);
      expect(H.notificationAsync.mock.calls.filter(([k]) => k === Success)).toHaveLength(1);
      await waitFor(() => expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen(), {
        timeout: 3000,
      });
      await waitFor(() => expect(timing).toHaveBeenCalled());
    });
  });

  describe('WHEN the phone asks for reduced motion', () => {
    it('THEN the solve still buzzes, but the sheet arrives still', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await renderWithProviders(<MiniScreen file={file105} />);
      await play();
      await solveMini();
      expect(H.notificationAsync).toHaveBeenLastCalledWith(Success);
      await waitFor(() => expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen(), {
        timeout: 3000,
      });
      await settle();
      expect(timing).not.toHaveBeenCalled();
      expect(screen.getByRole('header', { name: 'Solved' })).toBeOnTheScreen();
    });
  });
});

describe('GIVEN a Mini already finished', () => {
  describe('WHEN it is reopened', () => {
    it('THEN its sheet shows still, and nothing buzzes', async () => {
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: { 'DP·MINI·0105': { s: 87, d: '2026-10-24' } } }),
      );
      await renderWithProviders(<MiniScreen file={file105} />);
      expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
      await settle();
      expect(timing).not.toHaveBeenCalled();
      expect(H.notificationAsync).not.toHaveBeenCalled();
      expect(H.impactAsync).not.toHaveBeenCalled();
    });
  });
});

describe('GIVEN a Sweep', () => {
  describe('WHEN the start is dug, then a mine', () => {
    it('THEN a light tap, then an error buzz', async () => {
      await renderWithProviders(<SweepScreen file={file94} />);
      await play();
      await press('sq-22');
      expect(H.impactAsync).toHaveBeenCalledTimes(1);
      await press('sq-2');
      expect(H.notificationAsync).toHaveBeenCalledWith(Wrong);
      expect(H.notificationAsync).not.toHaveBeenCalledWith(Success);
      await waitFor(() => expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen());
    });
  });
});

describe('GIVEN a Link', () => {
  describe('WHEN a wrong four is submitted', () => {
    it('THEN each tile picked is a tap and the miss is an error buzz', async () => {
      const G = link78.groups.map((g) => g.members);
      await renderWithProviders(<LinkScreen file={file78} />);
      await play();
      for (const w of [G[0]![0]!, G[0]![1]!, G[0]![2]!, G[1]![0]!])
        await press(`tile-${w.toUpperCase()}`);
      expect(H.impactAsync).toHaveBeenCalledTimes(4);
      await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
      expect(H.notificationAsync).toHaveBeenCalledWith(Wrong);
    });
  });
});

describe('GIVEN a screen reader or large text on the boards', () => {
  it('THEN Mini squares name their row, column and letter, with type capped to the square', async () => {
    await renderWithProviders(<MiniScreen file={file105} />);
    await play();
    await press('cell-0-0');
    await press('key-M');
    const cell = screen.getByTestId('cell-0-0');
    expect(cell).toHaveAccessibleName('1, row 1, column 1, M');
    expect(cell.props.accessibilityRole).toBe('button');
    expect(within(cell).getByText('M').props.maxFontSizeMultiplier).toBe(1.2);
    expect(within(screen.getByTestId('key-M')).getByText('M').props.maxFontSizeMultiplier).toBe(
      1.3,
    );
    expect(screen.getByRole('button', { name: 'Check all' })).toBeOnTheScreen();
  });

  it('THEN a found Link group reads as its name and members', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const g = link78.groups[0]!;
    await renderWithProviders(<LinkScreen file={file78} />);
    await play();
    await settle();
    for (const w of g.members) await press(`tile-${w.toUpperCase()}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(screen.getByTestId(`band-${g.rank}`)).toBeOnTheScreen());
    expect(screen.getByTestId(`band-${g.rank}`)).toHaveAccessibleName(
      `${g.name}: ${g.members.join(', ')}`,
    );
  });
});

describe('GIVEN a 320 × 568 phone (iPhone SE, first generation)', () => {
  const real = Dimensions.get('window');
  const set = (width: number, height: number) =>
    act(() => {
      const d = { width, height, scale: 2, fontScale: 1 };
      Dimensions.set({ window: d, screen: d });
    });
  beforeEach(() => set(320, 568));
  afterEach(() => set(real.width, real.height));
  const widthOf = (id: string) =>
    Number(StyleSheet.flatten(screen.getByTestId(id).props.style).width);

  describe('WHEN each square board opens', () => {
    it.each([
      ['Mini', () => <MiniScreen file={file105} />, 'mini-board'],
      ['Doku', () => <DokuScreen file={file97} />, 'doku-board'],
      ['Sweep', () => <SweepScreen file={file94} />, 'sweep-board'],
      ['Path', () => <PathScreen file={file92} />, 'path-board'],
    ])('THEN the %s board fits inside the screen and its gutters', async (_n, ui, id) => {
      await renderWithProviders(ui());
      await play();
      const w = widthOf(id);
      expect(w).toBeGreaterThanOrEqual(200);
      // 12-point screen padding each side: no sideways scroll.
      expect(w).toBeLessThanOrEqual(320 - 24);
    });
  });

  describe('WHEN the window is narrower than any board’s usual minimum', () => {
    it('THEN the board shrinks with it rather than spilling off the side', async () => {
      await set(220, 568);
      await renderWithProviders(<MiniScreen file={file105} />);
      await play();
      expect(widthOf('mini-board')).toBeLessThanOrEqual(220 - 24);
    });
  });
});
