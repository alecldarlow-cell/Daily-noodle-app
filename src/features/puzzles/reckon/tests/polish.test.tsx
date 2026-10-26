import { createSaveStore } from '@noodle/core';
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as RN from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { cancel, hold } from '../../link/tests/press';
import { PIP_SLOP, verdictLine } from '../components/ReckonPlay';
import { ReckonScreen } from '../components/ReckonScreen';
import { file2 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
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

describe('GIVEN Reckon’s top row', () => {
  describe('WHEN the phone is narrow (320 pt)', () => {
    it('THEN the pack chip keeps its colour and gives its name only to screen readers', async () => {
      width(320);
      await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
      await press('reckon-play-button');
      const chip = screen.getByTestId('reckon-chip');
      expect(chip).toHaveProp('accessible', true);
      expect(chip.props.accessibilityLabel).toBeTruthy();
      expect(screen.queryByText(chip.props.accessibilityLabel as string)).toBeNull();
      expect(screen.getByTestId('reckon-score')).toHaveStyle({ fontSize: 28 });
    });
  });

  describe('WHEN the phone is 375 pt wide', () => {
    it('THEN the chip shows its name, and the row’s text is capped at 1.2× the text size', async () => {
      width(375);
      await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
      await press('reckon-play-button');
      const name = screen.getByTestId('reckon-chip-name');
      expect(name).toHaveProp('maxFontSizeMultiplier', 1.2);
      expect(screen.getByTestId('reckon-score')).toHaveProp('maxFontSizeMultiplier', 1.2);
      expect(screen.getByTestId('reckon-qn')).toHaveProp('maxFontSizeMultiplier', 1.2);
      expect(flat('reckon-prev')).toMatchObject({ marginHorizontal: -6 });
    });
  });

  it('THEN the score is read with its number', async () => {
    await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
    await press('reckon-play-button');
    expect(screen.getByLabelText('0 points so far')).toBeOnTheScreen();
    await press('reckon-act');
    const score = String(screen.getByTestId('reckon-score').props.children);
    expect(screen.getByTestId('reckon-score')).toHaveProp(
      'accessibilityLabel',
      `${score} points so far`,
    );
  });

  it('THEN the question pips reach a 44 pt touch, and a hidden pause is hidden from screen readers', async () => {
    await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
    await press('reckon-play-button');
    expect(PIP_SLOP.top + PIP_SLOP.bottom + 10).toBeGreaterThanOrEqual(44);
    expect(screen.getByTestId('reckon-pip-0')).toHaveProp('hitSlop', PIP_SLOP);
    const pause = screen.getByTestId('reckon-pause');
    expect(pause).toHaveProp('accessibilityElementsHidden', false);
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
    for (const id of ['reckon-act', 'reckon-pause', 'reckon-pip-0']) {
      await hold(screen.getByTestId(id));
      expect(flat(id)).toMatchObject({ opacity: 0.75 });
      await cancel(screen.getByTestId(id));
      expect(flat(id).opacity).not.toBe(0.75);
    }
  });
});
