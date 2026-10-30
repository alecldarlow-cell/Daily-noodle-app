import { createSaveStore } from '@noodle/core';
import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { BIG_MAP_MS } from '../components/BordersQuiz';
import { BordersScreen } from '../components/BordersScreen';
import { bigMapHtml } from '../components/drawing';
import { ATLAS_KEY, SAVE_KEY } from '../model';
import { borders15, file15 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
// The drawings' WebView, as a plain view carrying its HTML.
jest.mock('react-native-webview', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    WebView: (p: { source: { html: string } }) =>
      createElement(View, { testID: 'drawing', accessibilityHint: p.source.html }),
  };
});
jest.setTimeout(30_000);

const NOW = Date.parse('2026-10-19T09:00:00Z');
const deps = {
  perf: () => 0,
  wall: () => NOW,
  saves: createSaveStore(appStorage, { now: () => NOW }),
};
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const q0 = borders15.qs[0]!;
const right = q0.o.indexOf(q0.n);
const wrong = q0.o.findIndex((n) => n !== q0.n);
const run = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  appStorage.setItem(ATLAS_KEY, '');
  mockSite({});
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

async function quiz() {
  await renderWithProviders(<BordersScreen file={file15} deps={deps} />);
  await press('borders-play-button');
}

describe('GIVEN the big map’s drawing (engines/borders.js bigMap)', () => {
  it('THEN it carries the outline onto the world, zoomed to the region, named only when asked', () => {
    const c = {
      sea: '#CFE6E8',
      ink: '#1F3A4A',
      paper: '#FAFBF7',
      pin: '#C2453D',
    } as Parameters<typeof bigMapHtml>[2];
    const named = bigMapHtml(q0, true, c);
    expect(named).toContain("bigMap(document.getElementById('bm'),C,true)");
    expect(named).toContain('function onWorld(c)');
    expect(named).toContain(JSON.stringify(q0.n));
    expect(bigMapHtml(q0, false, c)).toContain(',C,false)');
  });
});

describe('GIVEN a Borders question (AF-016)', () => {
  describe('WHEN it is answered wrong', () => {
    it('THEN after 700 ms the map opens large, named, and a tap goes on to the next question', async () => {
      await quiz();
      await press(`borders-opt-${wrong}`);
      expect(screen.queryByTestId('borders-bigmap')).toBeNull();
      await run(BIG_MAP_MS);
      const big = screen.getByTestId('borders-bigmap');
      expect(within(big).getByText(`Where ${q0.n} is`)).toBeOnTheScreen();
      expect(within(big).getByText('Next')).toBeOnTheScreen();
      expect(within(big).getByTestId('drawing').props.accessibilityHint as string).toContain(
        ',C,true)',
      );
      await fireEvent.press(big);
      expect(screen.queryByTestId('borders-bigmap')).toBeNull();
      expect(JSON.parse(appStorage.getItem(SAVE_KEY)!).cur.i).toBe(1);
    });
  });

  describe('WHEN it is answered right', () => {
    it('THEN the map stays small, and tapping it opens it large with Close, staying on the question', async () => {
      await quiz();
      await press(`borders-opt-${right}`);
      await run(2000);
      expect(screen.queryByTestId('borders-bigmap')).toBeNull();
      await press('borders-inset');
      const big = screen.getByTestId('borders-bigmap');
      expect(within(big).getByText('Close')).toBeOnTheScreen();
      expect(within(big).getByText(`Where ${q0.n} is`)).toBeOnTheScreen();
      await fireEvent.press(big);
      expect(screen.queryByTestId('borders-bigmap')).toBeNull();
      expect(screen.getByTestId('borders-plate')).toBeOnTheScreen();
    });
  });

  describe('WHEN the small map shows before the answer (Show on map)', () => {
    it('THEN it opens large without naming the country, and nothing before the hint is tappable', async () => {
      await quiz();
      expect(screen.queryByTestId('borders-inset')).toBeNull();
      await press('borders-hint');
      await press('borders-inset');
      const big = screen.getByTestId('borders-bigmap');
      expect(within(big).getByText('Where today’s country is')).toBeOnTheScreen();
      expect(within(big).queryByText(q0.n)).toBeNull();
      expect(within(big).getByTestId('drawing').props.accessibilityHint as string).toContain(
        ',C,false)',
      );
    });
  });

  describe('WHEN the app is set to reduced motion', () => {
    it('THEN a wrong answer opens the map at once', async () => {
      appStorage.setItem('noodle-app-settings', JSON.stringify({ motion: 'reduced' }));
      await quiz();
      await press(`borders-opt-${wrong}`);
      await run(0);
      expect(screen.getByTestId('borders-bigmap')).toBeOnTheScreen();
    });
  });
});
