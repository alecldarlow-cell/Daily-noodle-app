import { createSaveStore } from '@noodle/core';
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as RN from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { cancel, hold } from '../../link/tests/press';
import { PIP_SLOP, qnWords, verdictLine } from '../components/ReckonPlay';
import { ReckonScreen } from '../components/ReckonScreen';
import { serial } from '../model';
import { file2, reckon2 } from './fixtures';
import { PRESSED } from '@/shared/ui';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  // players count Android's Back only while on show (usePlayerExit)
  useIsFocused: () => true,
}));
jest.setTimeout(30_000);

const NOW = Date.parse('2026-10-21T09:00:00Z');
let t = 0;
let deps = {
  perf: () => t,
  wall: () => NOW,
  saves: createSaveStore(appStorage, { now: () => NOW }),
};
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const flat = (id: string) =>
  RN.StyleSheet.flatten(screen.getByTestId(id).props.style) as Record<string, unknown>;
const width = (w: number) =>
  jest
    .spyOn(RN.Dimensions, 'get')
    .mockReturnValue({ width: w, height: 640, scale: 2, fontScale: 1 });

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  t = 0;
  deps = { ...deps, saves: createSaveStore(appStorage, { now: () => NOW }) };
  jest.useFakeTimers();
  mockSite({});
});
afterEach(async () => {
  await act(async () => {
    jest.advanceTimersByTime(100);
  });
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('GIVEN Reckon’s bar and question card', () => {
  describe('WHEN a question shows', () => {
    it('THEN the bar is the puzzles’ own (back, name, score) and the pack chip names the pack and the question in the card', async () => {
      width(320);
      await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
      await press('reckon-play-button');
      expect(
        screen.getByRole('header', { name: `Reckon ${serial(reckon2.id)}` }),
      ).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Back to Puzzles' })).toBeOnTheScreen();
      const chip = screen.getByTestId('reckon-chip');
      expect(chip).toHaveProp('accessible', true);
      expect(chip.props.accessibilityLabel).toMatch(/^.+, question 1 of 10$/);
      expect(screen.getByTestId('reckon-chip-name')).toHaveTextContent(/^.+ · 1 of 10$/);
      expect(screen.getByTestId('reckon-chip-name')).toHaveProp('maxFontSizeMultiplier', 1.2);
      expect(screen.queryByTestId('reckon-prev')).toBeNull();
      expect(screen.queryByTestId('reckon-fwd')).toBeNull();
      expect(qnWords('3/10')).toBe('3 of 10');
    });
  });

  it('THEN the score is read with its number', async () => {
    await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
    await press('reckon-play-button');
    expect(screen.getByLabelText('0 points so far')).toBeOnTheScreen();
    await press('reckon-act');
    const label = String(screen.getByTestId('puzzle-score').props.accessibilityLabel);
    expect(label).toMatch(/^\d+ points so far$/);
    expect(screen.getByTestId('puzzle-score')).toHaveTextContent(`${parseInt(label, 10)} pts`);
  });

  it('THEN the question pips reach a 44 pt touch', async () => {
    await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
    await press('reckon-play-button');
    expect(PIP_SLOP.top + PIP_SLOP.bottom + 10).toBeGreaterThanOrEqual(44);
    expect(screen.getByTestId('reckon-pip-0')).toHaveProp('hitSlop', PIP_SLOP);
  });
});

describe('GIVEN a guess locked in (on iOS)', () => {
  it('THEN VoiceOver hears the verdict, its points and its line', async () => {
    const say = jest.spyOn(RN.AccessibilityInfo, 'announceForAccessibility');
    await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
    await press('reckon-play-button');
    say.mockClear();
    await press('reckon-act');
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0]![0]).toMatch(/^\S.* \+\d+\. \S/);
    expect(verdictLine({ verdict: 'Bullseye', pts: '+100', line: 'Spot on.' })).toBe(
      'Bullseye +100. Spot on.',
    );
  });
});

describe('GIVEN Reckon’s buttons', () => {
  it('THEN each dims while pressed', async () => {
    await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
    await press('reckon-play-button');
    for (const id of ['reckon-act', 'reckon-pip-0']) {
      await hold(screen.getByTestId(id));
      expect(flat(id)).toMatchObject(PRESSED);
      await cancel(screen.getByTestId(id));
      expect(flat(id).opacity).not.toBe(PRESSED.opacity);
    }
  });
});
