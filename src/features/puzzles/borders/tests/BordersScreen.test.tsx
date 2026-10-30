import { createSaveStore } from '@noodle/core';
import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { onFinish, type PuzzleFinish } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders, sharedLine } from '@/shared/testing';

import { BordersScreen } from '../components/BordersScreen';
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
    WebView: (p: {
      source: { html: string };
      onShouldStartLoadWithRequest: (r: { url: string }) => boolean;
    }) =>
      createElement(View, {
        testID: 'drawing',
        accessibilityHint: p.source.html,
        accessibilityValue: {
          text: String(p.onShouldStartLoadWithRequest({ url: 'https://example.com' })),
        },
      }),
  };
});
jest.setTimeout(30_000);

let t = 0;
const NOW = Date.parse('2026-10-19T09:00:00Z');
const deps = {
  perf: () => t,
  wall: () => NOW,
  saves: createSaveStore(appStorage, { now: () => NOW }),
};
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const saved = () => JSON.parse(appStorage.getItem(SAVE_KEY) ?? 'null');

let finishes: PuzzleFinish[] = [];
let off = () => {};
beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  appStorage.setItem(ATLAS_KEY, '');
  t = 0;
  finishes = [];
  off = onFinish((f) => finishes.push(f));
  mockSite({});
});
afterEach(async () => {
  off();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

const pick = (i: number, right: boolean) => {
  const q = borders15.qs[i]!;
  return right ? q.o.indexOf(q.n) : q.o.findIndex((n) => n !== q.n);
};

describe('GIVEN a Borders not yet played', () => {
  it('THEN the start screen says what the page says', async () => {
    await renderWithProviders(<BordersScreen file={file15} deps={deps} />);
    expect(screen.getByText('No. 15, Monday, 19 October')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Ten country outlines, easiest first. Name them from four; 100 points each.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('How to play'));
    expect(screen.getByText(/Show on map puts the outline/)).toBeOnTheScreen();
    expect(screen.getAllByTestId('drawing')[0]!.props.accessibilityValue.text).toBe('false');
  });

  it('THEN ten names to the end show the sheet, fill the atlas and announce once', async () => {
    await renderWithProviders(<BordersScreen file={file15} deps={deps} />);
    await press('borders-play-button');
    expect(screen.getByText(/Which country is this\?/)).toBeOnTheScreen();
    for (let i = 0; i < 10; i++) {
      if (i === 5) {
        await press('borders-hint');
        expect(
          within(screen.getByTestId('borders-map')).getByTestId('drawing').props.accessibilityHint,
        ).toContain('id="inset"');
      }
      await press(`borders-opt-${pick(i, ![3, 6, 8].includes(i))}`);
      expect(screen.getByTestId('borders-plate')).toBeOnTheScreen();
      await press('borders-next');
    }
    expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
    expect(screen.getByTestId('finish-title')).toHaveTextContent(/ · Spotted$/);
    expect(screen.getByText('7 of 10')).toBeOnTheScreen();
    expect(await sharedLine()).toMatch(/^🌍 Borders #15 — 7\/10 · \d+ pts$/);
    expect(finishes).toHaveLength(1);
    expect(finishes[0]!.detail).toMatchObject({ type: 'geo-borders', got: 7, of: 10, hints: 1 });
    expect(saved().done[borders15.id]).toMatchObject({ c: 7, on: '2026-10-19' });
    expect(Object.keys(JSON.parse(appStorage.getItem(ATLAS_KEY)!).found)).toHaveLength(7);
    expect(screen.getByTestId('borders-recap').props.accessibilityLabel).toContain(
      `${borders15.qs[5]!.n} (map)`,
    );
  });

  it('THEN Pause, Back to start and Resume keep the round', async () => {
    await renderWithProviders(<BordersScreen file={file15} deps={deps} />);
    await press('borders-play-button');
    await press(`borders-opt-${pick(0, true)}`);
    await press('borders-pause');
    expect(screen.getByTestId('borders-paused')).toBeOnTheScreen();
    await press('borders-resume');
    await press('borders-pause');
    await press('borders-quit');
    expect(screen.getByText('Question 2 of 10, 100 points so far.')).toBeOnTheScreen();
    await press('borders-play-button');
    expect(screen.getByTestId('borders-quiz')).toBeOnTheScreen();
    expect(screen.queryByTestId('borders-plate')).toBeNull();
  });

  it('THEN closing the screen keeps the round', async () => {
    const r = await renderWithProviders(<BordersScreen file={file15} deps={deps} />);
    await press('borders-play-button');
    await press('borders-hint');
    await r.unmount();
    expect(saved().cur).toMatchObject({ id: borders15.id, i: 0, hint: true });
  });
});

describe('GIVEN a Borders already finished', () => {
  it('THEN it opens on its sheet and announces nothing', async () => {
    const ans = borders15.qs.map(() => ({ k: 0, ok: true, h: false, nw: false }));
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        v: 1,
        done: { [borders15.id]: { c: 10, p: 1250, secs: 70, ans, on: '2026-10-19' } },
      }),
    );
    await renderWithProviders(<BordersScreen file={file15} deps={deps} />);
    expect(screen.getByText('10 of 10')).toBeOnTheScreen();
    expect(screen.getByText('All ten named.')).toBeOnTheScreen();
    expect(finishes).toHaveLength(0);
  });
});
