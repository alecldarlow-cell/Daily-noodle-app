/**
 * AF-013: Tangle, Borders and Reckon play the website's tones where their pages do, the
 * app's one Sound switch rules them (AF-012), a finished puzzle reopened is silent, and
 * sound never changes what is saved (the models are untouched, so replays stay identical).
 */
import { createSaveStore } from '@noodle/core';
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Audio from 'expo-audio';
import { AppState } from 'react-native';

import { saveSettings, DEFAULT_SETTINGS } from '@/shared/settings';
import { resetSound } from '@/shared/sound';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { BordersScreen } from '../borders/components/BordersScreen';
import { SAVE_KEY as BORDERS_KEY } from '../borders/model';
import { borders15, file15 } from '../borders/tests/fixtures';
import { ReckonScreen } from '../reckon/components/ReckonScreen';
import { SAVE_KEY as RECKON_KEY } from '../reckon/model';
import { file2 } from '../reckon/tests/fixtures';
import { tileRects } from '../tangle/components/TangleBoard';
import { TangleScreen } from '../tangle/components/TangleScreen';
import { KEY as TANGLE_KEY } from '../tangle/model';
import { findPath } from '../tangle/oracle';
import { file19, tangle19 } from '../tangle/tests/fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('react-native-webview', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { WebView: () => createElement(View, { testID: 'drawing' }) };
});
jest.setTimeout(60_000);

/** The cues played so far, in order (the Jest stand-in names each file after its cue). */
const played = (Audio as unknown as { __played: string[] }).__played;
const heard = () => played.slice();
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
let t = 0;
const depsAt = (iso: string) => {
  const now = Date.parse(iso);
  return {
    perf: () => t,
    wall: () => now,
    saves: createSaveStore(appStorage, { now: () => now }),
  };
};

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  saveSettings(DEFAULT_SETTINGS);
  resetSound();
  played.length = 0;
  t = 0;
  mockSite({});
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

/* ---------- Reckon ---------- */

async function playReckon(nudge = false) {
  await renderWithProviders(<ReckonScreen file={file2} deps={depsAt('2026-10-21T09:00:00Z')} />);
  await press('reckon-play-button');
  for (let i = 0; i < 10; i++) {
    if (nudge && i === 0) {
      t += 100;
      await press('reckon-plus');
      t += 100;
      await press('reckon-minus');
    }
    await press('reckon-act');
    t += 1000;
    await press('reckon-act');
  }
}
const reckonZones = () =>
  (JSON.parse(appStorage.getItem(RECKON_KEY)!).done['DP·RECK·0002'] as { z: number[] }).z;

describe('GIVEN a Reckon with Sound on', () => {
  // The helper keeps slider ticks 45 ms apart on the phone's clock; here that is the test's.
  beforeEach(() => {
    jest.spyOn(globalThis.performance, 'now').mockImplementation(() => t);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  describe('WHEN the slider is nudged and the ten are locked in', () => {
    it('THEN a tick per step, each Lock in with its zone’s chime, and the finish chime once', async () => {
      await playReckon(true);
      const z = reckonZones();
      expect(heard()).toEqual([
        'reckon-tick',
        'reckon-tick',
        ...z.map((n) => `reckon-lock-${n}`),
        'reckon-done',
      ]);
      expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
    });
  });

  describe('WHEN the finished Reckon is opened again', () => {
    it('THEN it is silent', async () => {
      await playReckon();
      await screen.unmount();
      played.length = 0;
      await renderWithProviders(
        <ReckonScreen file={file2} deps={depsAt('2026-10-21T09:00:00Z')} />,
      );
      expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
      expect(heard()).toEqual([]);
    });
  });
});

describe('GIVEN the app’s Sound switch off', () => {
  describe('WHEN a Reckon is played to the end', () => {
    it('THEN nothing plays, and the result saved is the same as with Sound on', async () => {
      await playReckon(true);
      const withSound = appStorage.getItem(RECKON_KEY);
      await screen.unmount();
      for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
      saveSettings({ sound: false });
      played.length = 0;
      t = 0;
      await playReckon(true);
      expect(heard()).toEqual([]);
      expect(appStorage.getItem(RECKON_KEY)).toBe(withSound);
    });
  });
});

/* ---------- Borders ---------- */

const pick = (i: number, right: boolean) => {
  const q = borders15.qs[i]!;
  return right ? q.o.indexOf(q.n) : q.o.findIndex((n) => n !== q.n);
};
async function playBorders() {
  await renderWithProviders(<BordersScreen file={file15} deps={depsAt('2026-10-19T09:00:00Z')} />);
  await press('borders-play-button');
  await press('borders-hint');
  await press(`borders-opt-${pick(0, true)}`);
  await press('borders-next');
  await press(`borders-opt-${pick(1, false)}`);
  await press('borders-next');
  for (let i = 2; i < 10; i++) {
    await press(`borders-opt-${pick(i, true)}`);
    await press('borders-next');
  }
}

describe('GIVEN a Borders with Sound on', () => {
  describe('WHEN Show on map, a right name, a wrong one, then the rest right', () => {
    it('THEN the hint note, right, wrong, eight rights, and the finish chime once', async () => {
      await playBorders();
      expect(heard()).toEqual([
        'borders-hint',
        'borders-right',
        'borders-wrong',
        ...Array(8).fill('borders-right'),
        'borders-pass',
      ]);
      expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
    });
  });

  describe('WHEN the finished Borders is opened again', () => {
    it('THEN it is silent', async () => {
      await playBorders();
      await screen.unmount();
      played.length = 0;
      await renderWithProviders(
        <BordersScreen file={file15} deps={depsAt('2026-10-19T09:00:00Z')} />,
      );
      expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
      expect(heard()).toEqual([]);
    });
  });

  describe('WHEN Sound is off', () => {
    it('THEN nothing plays, and the result saved is the same as with Sound on', async () => {
      await playBorders();
      const withSound = appStorage.getItem(BORDERS_KEY);
      await screen.unmount();
      for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
      saveSettings({ sound: false });
      played.length = 0;
      await playBorders();
      expect(heard()).toEqual([]);
      expect(appStorage.getItem(BORDERS_KEY)).toBe(withSound);
    });
  });
});

/* ---------- Tangle ---------- */

describe('GIVEN a Tangle', () => {
  const NOW = Date.parse('2026-10-19T09:00:00Z');
  async function run(ms: number) {
    for (let x = 0; x < ms; x += 100)
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
  }
  async function open() {
    await renderWithProviders(<TangleScreen file={file19} />);
    await fireEvent.press(screen.getByTestId('play-card'));
    await fireEvent(screen.getByTestId('tangle-board-wrap'), 'layout', {
      nativeEvent: { layout: { width: 400, height: 400, x: 0, y: 0 } },
    });
  }
  const rects = tileRects(400);
  const at = (i: number) => ({
    nativeEvent: {
      locationX: rects[i]!.left + rects[i]!.width / 2,
      locationY: rects[i]!.top + rects[i]!.height / 2,
    },
  });
  async function trace(p: number[]) {
    const grid = screen.getByTestId('tangle-grid');
    await fireEvent(grid, 'responderGrant', at(p[0]!));
    for (const i of p.slice(1)) await fireEvent(grid, 'responderMove', at(i));
    await fireEvent(grid, 'responderRelease', at(p.at(-1)!));
  }
  const word = tangle19.main.find((w) => w.length === 4 && w !== tangle19.star)!;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(
        () => ({ remove: () => undefined }) as ReturnType<typeof AppState.addEventListener>,
      );
  });
  afterEach(async () => {
    await run(500);
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('WHEN the count-in runs, a word, a two-letter path and the star are traced', () => {
    it('THEN ticks, rising steps, the word’s chime, meh, and the star’s run', async () => {
      await open();
      await run(3100);
      expect(heard()).toEqual(['tangle-tick', 'tangle-tick', 'tangle-tick']);
      played.length = 0;

      await trace(findPath(tangle19, word)!);
      expect(heard()).toEqual([
        'tangle-step-1',
        'tangle-step-2',
        'tangle-step-3',
        'tangle-step-4',
        `tangle-word-4`,
      ]);
      played.length = 0;

      await trace(findPath(tangle19, word)!.slice(0, 2));
      expect(heard()).toEqual(['tangle-step-1', 'tangle-step-2', 'tangle-meh']);
      played.length = 0;

      await trace(tangle19.starPath);
      expect(heard().at(-1)).toBe('tangle-star');
      expect(heard().slice(0, -1)).toEqual(
        tangle19.starPath.map((_, i) => `tangle-step-${Math.min(12, i + 1)}`),
      );
    });
  });

  describe('WHEN the round runs out', () => {
    it('THEN a tick on each of the last five seconds, then the finish fanfare once', async () => {
      await open();
      await run(3100);
      played.length = 0;
      await run(90_000);
      expect(heard()).toEqual([...Array(5).fill('tangle-tick'), 'tangle-done']);
      expect(JSON.parse(appStorage.getItem(TANGLE_KEY)!).done['DP·TANG·0019']).toBeTruthy();
    });
  });

  describe('WHEN Sound is off', () => {
    it('THEN the count-in and a word are silent', async () => {
      saveSettings({ sound: false });
      await open();
      await run(3100);
      await trace(findPath(tangle19, word)!);
      expect(heard()).toEqual([]);
    });
  });
});
