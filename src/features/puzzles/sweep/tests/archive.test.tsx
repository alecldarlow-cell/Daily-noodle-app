import { dayBefore, londonDay } from '@noodle/core';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';
import { puzzleTokensFor } from '@/shared/theme';

import { SweepScreen } from '../components/SweepScreen';
import { PAST_MSG, shownCopy } from '../copy';
import {
  init,
  LOSS_MSG,
  LOSS_REPLAY_MSG,
  REPLAY_MSG,
  START_MSG,
  STREAK_KEY,
  WRONG_FLAG,
} from '../model';
import { file94, sweep94 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

const START = 22;
const sq = (i: number) => screen.getByTestId(`sq-${i}`);
const playBtn = () => fireEvent.press(screen.getByRole('button', { name: 'Play' }));
const today = () => londonDay();

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  mockSite({});
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN the words the screen shows for the model’s replay words', () => {
  const base = init(sweep94, { ranked: false });
  describe('WHEN the puzzle is a past day’s, never replayed, and today’s result is in', () => {
    it('THEN it says the puzzle won’t change the streak, and drops “· replay”', () => {
      expect(base.msg).toBe(REPLAY_MSG);
      expect(base.rank).toBe('· replay');
      expect(shownCopy(base, true)).toEqual({ msg: PAST_MSG, rank: '' });
      expect(shownCopy({ ...base, msg: LOSS_REPLAY_MSG }, true).msg).toBe(
        `That was a mine. ${PAST_MSG}`,
      );
      expect(
        shownCopy({ ...base, msg: 'Swept in <b>01:27</b>. Replay — nothing recorded.' }, true).msg,
      ).toBe(`Swept in <b>01:27</b>. ${PAST_MSG}`);
      expect(shownCopy({ ...base, msg: WRONG_FLAG }, true).msg).toBe(WRONG_FLAG);
    });
  });
  describe('WHEN it is today’s puzzle, a counted go, or a real Play again', () => {
    it('THEN the page’s words stand', () => {
      expect(shownCopy(base, false)).toEqual({ msg: REPLAY_MSG, rank: '· replay' });
      const ranked = init(sweep94, { ranked: true });
      expect(shownCopy({ ...ranked, msg: LOSS_MSG }, true)).toEqual({ msg: LOSS_MSG, rank: '' });
      const again = { ...base, replayStarted: true };
      expect(shownCopy(again, true)).toEqual({ msg: REPLAY_MSG, rank: '· replay' });
    });
  });
});

describe('GIVEN an old Sweep, never played, opened after today’s Sweep was played', () => {
  beforeEach(() => {
    appStorage.setItem(
      STREAK_KEY,
      JSON.stringify({ last: today(), streak: 4, best: 6, dates: [today()], tz: 'L' }),
    );
  });

  describe('WHEN Play shows the board', () => {
    it('THEN the bar and message don’t call it a replay or say today’s result is in', async () => {
      await renderWithProviders(<SweepScreen file={file94} />);
      await playBtn();
      expect(screen.getByText('medium')).toBeOnTheScreen();
      expect(screen.queryByText(/replay/i)).toBeNull();
      expect(screen.getByTestId('sweep-msg')).toHaveTextContent(PAST_MSG);
      // the flame is Sweep's own live streak, as the start card showed it
      expect(screen.getByText('🔥4')).toBeOnTheScreen();
    });
  });

  describe('WHEN a flag sits on a provably safe square and Hint is pressed', () => {
    it('THEN that flag is ringed dark and pulses, so it stands out from the marigold of the rest', async () => {
      await renderWithProviders(<SweepScreen file={file94} />);
      await playBtn();
      await fireEvent.press(sq(START));
      await fireEvent(sq(3), 'longPress');
      expect(screen.queryByTestId('sweep-hint-pulse')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Hint' }));
      expect(screen.getByTestId('sweep-msg')).toHaveTextContent(WRONG_FLAG);
      expect(screen.getAllByTestId('sweep-hint-pulse')).toHaveLength(1);
      const style = StyleSheet.flatten(sq(3).props.style);
      expect(style).toMatchObject({
        borderWidth: 3,
        borderColor: puzzleTokensFor('light').onActive,
      });
    });
  });
});

describe('GIVEN a Sweep streak that has lapsed (last played long ago, 13 days long)', () => {
  describe('WHEN the board shows', () => {
    it('THEN the bar shows no flame, matching the start card’s 0, not the stale 13', async () => {
      appStorage.setItem(
        STREAK_KEY,
        JSON.stringify({ last: '2026-01-01', streak: 13, best: 13, dates: ['2026-01-01'] }),
      );
      await renderWithProviders(<SweepScreen file={file94} />);
      expect(screen.queryByText('13-day streak')).toBeNull();
      await playBtn();
      expect(screen.queryByText(/🔥/)).toBeNull();
      expect(screen.getByTestId('sweep-msg')).toHaveTextContent(START_MSG);
    });
    it('THEN a streak last played yesterday still shows, as on the start card', async () => {
      appStorage.setItem(
        STREAK_KEY,
        JSON.stringify({ last: dayBefore(today()), streak: 13, best: 13, dates: [] }),
      );
      await renderWithProviders(<SweepScreen file={file94} />);
      expect(screen.getByText('13-day streak')).toBeOnTheScreen();
      await playBtn();
      expect(screen.getByText('🔥13')).toBeOnTheScreen();
    });
  });
});
