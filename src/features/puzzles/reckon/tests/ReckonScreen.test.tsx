import { createSaveStore } from '@noodle/core';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { onFinish, type PuzzleFinish } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders, sharedLine } from '@/shared/testing';

import { ReckonScreen } from '../components/ReckonScreen';
import { SAVE_KEY } from '../model';
import { file2, reckon2 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

let t = 0;
const NOW = Date.parse('2026-10-21T09:00:00Z');
const deps = {
  perf: () => t,
  wall: () => NOW,
  saves: createSaveStore(appStorage, { now: () => NOW }),
};
const index = () => screen.getByTestId('reckon-slider').props.accessibilityValue.now as number;
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const text = (id: string) => String(screen.getByTestId(id).props.children);
const saved = () => JSON.parse(appStorage.getItem(SAVE_KEY) ?? 'null');

let finishes: PuzzleFinish[] = [];
let off = () => {};
beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
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

async function lockAndNext() {
  await press('reckon-act');
  t += 1000;
  await press('reckon-act');
}

describe('GIVEN a Reckon not yet played', () => {
  describe('WHEN it opens', () => {
    it('THEN the start screen says what the page says', async () => {
      await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
      expect(screen.getByText('No. 2, Wednesday 21 October')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Ten numbers to guess, each from a different topic. The closer you get, the more you score.',
        ),
      ).toBeOnTheScreen();
      await fireEvent.press(screen.getByText('How to play'));
      expect(screen.getByText(/Within 15% of the answer scores 100/)).toBeOnTheScreen();
    });
  });

  describe('WHEN the ten are played to the end', () => {
    it('THEN the sheet shows the points, the share line and the ten, announced once', async () => {
      await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
      await press('reckon-play-button');
      expect(screen.getByTestId('reckon-tip')).toBeOnTheScreen();
      expect(text('reckon-qn')).toBe('1/10');
      for (let i = 0; i < 10; i++) await lockAndNext();
      expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
      expect(screen.getByTestId('finish-title')).toHaveTextContent(/ · Reckoned$/);
      expect(await sharedLine()).toMatch(/^🎯 Reckon #2 — /);
      expect(finishes).toHaveLength(1);
      expect(finishes[0]).toMatchObject({
        path: file2.path,
        type: 'reckon',
        detail: { type: 'quiz-reckon', outcome: 'scored' },
      });
      const save = saved();
      expect(save.done[reckon2.id]).toMatchObject({ d: '2026-10-21' });
      expect(save.cur).toBeNull();
      // a row of the recap reopens that question; Back to results returns, with nothing announced
      await press('reckon-row-2');
      expect(text('reckon-qn')).toBe('3/10');
      expect(screen.getByText('Reviewing your round')).toBeOnTheScreen();
      await press('reckon-fwd');
      expect(text('reckon-qn')).toBe('4/10');
      await press('reckon-act');
      expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
      expect(screen.getByTestId('finish-title')).toHaveTextContent(/ · Reckoned$/);
      expect(finishes).toHaveLength(1);
    });
  });

  describe('WHEN the scale is dragged and − / + pressed', () => {
    it('THEN the guess follows, and a Next straight after Lock in waits', async () => {
      await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
      await press('reckon-play-button');
      const slider = screen.getByTestId('reckon-slider');
      const first = index();
      // no layout in tests: the track is 1 wide from the scale's padding (26)
      await fireEvent(slider, 'responderGrant', { nativeEvent: { locationX: 26.5 } });
      await fireEvent(slider, 'responderMove', { nativeEvent: { locationX: 26.2 } });
      expect(index()).toBe(first); // only letting go places the guess; the marker follows meanwhile
      await fireEvent(slider, 'responderRelease', { nativeEvent: { locationX: 26 } });
      expect(index()).toBe(0);
      await press('reckon-plus');
      expect(index()).toBe(1);
      await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
      expect(index()).toBe(0);
      await press('reckon-act');
      expect(screen.getByTestId('reckon-feedback')).toBeOnTheScreen();
      t += 100;
      await press('reckon-act');
      expect(text('reckon-qn')).toBe('1/10');
      t += 1000;
      await press('reckon-act');
      expect(text('reckon-qn')).toBe('2/10');
      expect(text('reckon-score')).not.toBe('0');
    });

    it('THEN a held − repeats after a moment and the press after it does nothing', async () => {
      jest.useFakeTimers();
      try {
        await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
        await press('reckon-play-button');
        const before = index();
        const minus = screen.getByTestId('reckon-minus');
        await fireEvent(minus, 'pressIn');
        await act(async () => {
          jest.advanceTimersByTime(380 + 75 * 3 + 10);
        });
        await fireEvent(minus, 'pressOut');
        await fireEvent.press(minus);
        expect(index()).toBe(before - 3);
        expect(saved().cur.cur).not.toBeNull(); // letting go saves it
        await fireEvent(minus, 'pressIn');
        await fireEvent(minus, 'pressOut');
        await fireEvent.press(minus);
        expect(index()).toBe(before - 4);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('WHEN it is paused and left', () => {
    it('THEN Back to start keeps the round and Resume returns to it', async () => {
      await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
      await press('reckon-play-button');
      await lockAndNext();
      await press('reckon-pause');
      expect(screen.getByTestId('reckon-paused')).toBeOnTheScreen();
      await press('reckon-resume');
      expect(screen.queryByTestId('reckon-paused')).toBeNull();
      await press('reckon-pause');
      await press('reckon-quit');
      expect(screen.getByText(/^Question 2 of 10, \d+ points so far\.$/)).toBeOnTheScreen();
      expect(screen.getByText('Resume')).toBeOnTheScreen();
      await press('reckon-play-button');
      expect(text('reckon-qn')).toBe('2/10');
      await press('reckon-prev');
      expect(screen.getByText('Back to question 2')).toBeOnTheScreen();
      await press('reckon-pip-1');
      expect(text('reckon-qn')).toBe('2/10');
    });

    it('THEN closing the screen saves the round where it stands', async () => {
      const r = await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
      await press('reckon-play-button');
      await press('reckon-plus');
      const cur = saved().cur;
      await r.unmount();
      expect(saved().cur).toMatchObject({ id: reckon2.id, i: 0, ph: 'g' });
      expect(saved().cur.cur).not.toBe(cur.cur);
    });
  });
});

describe('GIVEN a Reckon already finished', () => {
  it('THEN it opens on its sheet with the first result, and announces nothing', async () => {
    const z = [0, 0, 0, 0, 0, 1, 2, 3, 4, 4];
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        v: 1,
        done: {
          [reckon2.id]: {
            p: 725,
            b: 5,
            z,
            g: reckon2.qs.map((q) => q.a),
            secs: 95,
            d: '2026-10-21',
          },
        },
        streak: { last: '2026-10-21', n: 2, best: 2 },
      }),
    );
    await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
    expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
    expect(screen.getByText('725 pts')).toBeOnTheScreen();
    expect(screen.getByTestId('finish-streak')).toHaveTextContent('🔥 2-day streak');
    expect(await sharedLine()).toBe('🎯 Reckon #2 — 🎯🎯🎯🎯🎯🟩🟨🟧⬜⬜ · 725 pts · 🔥2');
    expect(finishes).toHaveLength(0);
  });
});
