import { createSaveStore } from '@noodle/core';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { cancel, hold } from '../../link/tests/press';
import { verdictOf } from '../components/BordersQuiz';
import { BordersScreen } from '../components/BordersScreen';
import { ATLAS_KEY } from '../model';
import { borders15, file15 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('react-native-webview', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { WebView: () => createElement(View, { testID: 'drawing' }) };
});
jest.setTimeout(30_000);

const NOW = Date.parse('2026-10-19T09:00:00Z');
let deps = {
  perf: () => 0,
  wall: () => NOW,
  saves: createSaveStore(appStorage, { now: () => NOW }),
};
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const pick = (i: number, right: boolean) => {
  const q = borders15.qs[i]!;
  return right ? q.o.indexOf(q.n) : q.o.findIndex((n) => n !== q.n);
};
const flat = (id: string) =>
  StyleSheet.flatten(screen.getByTestId(id).props.style) as Record<string, unknown>;

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  appStorage.setItem(ATLAS_KEY, '');
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

describe('GIVEN a Borders question at a large text size', () => {
  it('THEN the column scrolls and every line is capped, so Next can always be reached', async () => {
    await renderWithProviders(<BordersScreen file={file15} deps={deps} />);
    await press('borders-play-button');
    const scroll = screen.getByTestId('borders-scroll');
    expect(scroll.props.contentContainerStyle).toMatchObject({ flexGrow: 1 });
    expect(screen.getByText(borders15.qs[0]!.o[0]!)).toHaveProp('maxFontSizeMultiplier', 1.3);
    expect(screen.getByText('Show on map (half points)')).toHaveProp('maxFontSizeMultiplier', 1.3);
    expect(screen.getByTestId('borders-points')).toHaveProp('maxFontSizeMultiplier', 1.15);
    await press(`borders-opt-${pick(0, true)}`);
    expect(screen.getByText('Next')).toHaveProp('maxFontSizeMultiplier', 1.3);
    expect(screen.getByTestId('borders-plate')).toBeOnTheScreen();
  });
});

describe('GIVEN an answer (on iOS)', () => {
  describe('WHEN it is right, then the next is wrong', () => {
    it('THEN VoiceOver hears right or wrong with the country, each time', async () => {
      const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      await renderWithProviders(<BordersScreen file={file15} deps={deps} />);
      await press('borders-play-button');
      say.mockClear();
      await press(`borders-opt-${pick(0, true)}`);
      expect(say).toHaveBeenLastCalledWith(
        expect.stringMatching(new RegExp(`^Right: ${borders15.qs[0]!.n}\\. .*\\+100 points$`)),
      );
      await press('borders-next');
      await press(`borders-opt-${pick(1, false)}`);
      expect(say).toHaveBeenLastCalledWith(`Wrong: ${borders15.qs[1]!.n}. Not this time.`);
      expect(say).toHaveBeenCalledTimes(2);
    });
  });

  it('THEN nothing is said before the answer is in', () => {
    expect(verdictOf({ locked: false, plate: null, cur: null } as never)).toBe('');
  });
});

describe('GIVEN the quiz’s buttons', () => {
  it('THEN each dims while pressed, and an answered option does not', async () => {
    await renderWithProviders(<BordersScreen file={file15} deps={deps} />);
    await press('borders-play-button');
    const opt = screen.getByTestId('borders-opt-0');
    await hold(opt);
    expect(flat('borders-opt-0')).toMatchObject({ opacity: 0.75 });
    await cancel(opt);
    expect(flat('borders-opt-0').opacity).toBeUndefined();
    await hold(screen.getByTestId('borders-pause'));
    expect(flat('borders-pause')).toMatchObject({ opacity: 0.75 });
    await cancel(screen.getByTestId('borders-pause'));
    await press(`borders-opt-${pick(0, true)}`);
    await hold(screen.getByTestId(`borders-opt-${pick(0, true)}`));
    expect(flat(`borders-opt-${pick(0, true)}`).opacity).toBeUndefined();
    await hold(screen.getByTestId('borders-next'));
    expect(flat('borders-next')).toMatchObject({ opacity: 0.75 });
    await cancel(screen.getByTestId('borders-next'));
  });
});
