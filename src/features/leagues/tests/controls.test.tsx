/* AF-017 and AF-007: compact board controls, and rows and chip rows that keep their margins. */
import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/shared/testing';
import { shortDate } from '@/shared/time';

import * as api from '../api/board';
import { fetchPuzzleCards } from '../api/feed';
import { GUTTER } from '../components/BoardControls';
import { claimsSwipe, ordinal, swipeStep } from '../components/Board';
import { LeaguesScreen } from '../components/LeaguesScreen/LeaguesScreen';
import { ROW_INSET_RIGHT } from '../components/ui';
import {
  board,
  clearStore,
  dayBoard,
  FAMILY,
  mineRow,
  overall,
  PID,
  recordsData,
  setBoard,
} from './helpers';

jest.mock('../api/board');
jest.mock('../api/feed');
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  useNavigation: () => ({ setParams: jest.fn() }),
}));

const m = jest.mocked(api);
const today = londonDay();
const WORK = { ...FAMILY, code: 'WXYZ6789', name: 'Work', members: 2 };
const flat = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

jest.setTimeout(30_000);

beforeEach(() => {
  clearStore();
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  jest.mocked(fetchPuzzleCards).mockResolvedValue([]);
  setBoard({ pid: PID, leagues: [FAMILY, WORK], cur: FAMILY.code, fill: { n: 0, aids: [] } });
  m.boardMine.mockResolvedValue([mineRow(), mineRow(WORK)]);
  m.boardOverall.mockResolvedValue(overall());
  m.boardDay.mockResolvedValue(dayBoard());
  m.boardRecords.mockResolvedValue(recordsData(today));
  m.boardBackfill.mockResolvedValue(0);
});

afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
});

async function open() {
  await renderWithProviders(<LeaguesScreen />);
  await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
}

describe('GIVEN a player in two leagues (AF-017)', () => {
  describe('WHEN Leagues opens', () => {
    it('THEN the league is a compact picker in the heading, with no LEADERBOARD label or league chips', async () => {
      await open();
      const picker = screen.getByRole('button', { name: 'League: Family' });
      expect(within(picker).getByRole('header', { name: 'Family' })).toBeOnTheScreen();
      expect(picker.props.accessibilityState).toMatchObject({ expanded: false });
      // In the masthead's kicker (Alec, 7 Nov 2026), its tap area grown to 44+ by hitSlop.
      expect(within(screen.getByTestId('masthead-kicker')).getByTestId('league-picker')).toBe(
        picker,
      );
      expect(
        (flat(picker).minHeight as number) + 2 * (picker.props.hitSlop as number),
      ).toBeGreaterThanOrEqual(44);
      expect(screen.queryByText(/^Leaderboard$/i)).toBeNull();
      // The menu (and so the other league) shows only once asked for.
      expect(screen.queryByTestId('league-menu')).toBeNull();
      expect(screen.queryByTestId(`league-${WORK.code}`)).toBeNull();
      expect(screen.queryByText(/Start a new league/)).toBeNull();
    });
  });

  describe('WHEN they open the picker', () => {
    it('THEN it lists their leagues with this one chosen, then Start a new league and Join with a code', async () => {
      await open();
      await fireEvent.press(screen.getByTestId('league-picker'));
      const menu = screen.getByTestId('league-menu');
      expect(within(menu).getByRole('radio', { name: 'Family' }).props.accessibilityState).toEqual({
        checked: true,
      });
      expect(within(menu).getByRole('radio', { name: 'Work' }).props.accessibilityState).toEqual({
        checked: false,
      });
      expect(within(menu).getByRole('button', { name: 'Start a new league' })).toBeOnTheScreen();
      expect(within(menu).getByRole('button', { name: 'Join with a code' })).toBeOnTheScreen();
      for (const item of [
        ...within(menu).getAllByRole('radio'),
        ...within(menu).getAllByRole('button'),
      ])
        expect(flat(item).minHeight).toBeGreaterThanOrEqual(44);
    });

    it('THEN picking another league switches to it and closes the menu', async () => {
      await open();
      await fireEvent.press(screen.getByTestId('league-picker'));
      await fireEvent.press(screen.getByRole('radio', { name: 'Work' }));
      await waitFor(() => expect(board().cur).toBe(WORK.code));
      expect(screen.queryByTestId('league-menu')).toBeNull();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'League: Work' })).toBeOnTheScreen(),
      );
    });

    it('THEN “Start a new league” in the menu opens the start form', async () => {
      await open();
      await fireEvent.press(screen.getByTestId('league-picker'));
      await fireEvent.press(screen.getByRole('button', { name: 'Start a new league' }));
      expect(screen.getByLabelText('League name')).toBeOnTheScreen();
    });

    it('THEN tapping the name again closes the menu', async () => {
      await open();
      await fireEvent.press(screen.getByTestId('league-picker'));
      expect(screen.getByTestId('league-picker').props.accessibilityState).toMatchObject({
        expanded: true,
      });
      await fireEvent.press(screen.getByTestId('league-picker'));
      expect(screen.queryByTestId('league-menu')).toBeNull();
    });
  });

  // Alec, 7 Nov 2026: the arrows step through the puzzles, not the days.
  describe('WHEN the puzzle pager shows', () => {
    it('THEN it opens on All puzzles, today, with a dot for All and each puzzle', async () => {
      await open();
      expect(screen.getByTestId('pager-title')).toHaveTextContent(
        `All puzzles${'Today · ' + shortDate(today)}`,
      );
      const dots = within(screen.getByTestId('puzzle-chips')).getAllByTestId(/^pill-/);
      expect(dots.map((d) => d.props.testID)).toEqual([
        'pill-all',
        'pill-mini',
        'pill-doku',
        'pill-path',
        'pill-sweep',
        'pill-link',
        'pill-tangle',
        'pill-borders',
        'pill-reckon',
        'pill-tally',
        'pill-records',
      ]);
      expect(screen.getByRole('button', { name: 'All puzzles' })).toBeSelected();
      // No day arrows until asked for; no emoji chips.
      expect(screen.queryByRole('button', { name: 'Previous day' })).toBeNull();
      expect(screen.queryByText(/✏️/)).toBeNull();
    });

    it('THEN the arrows step through the puzzles, each a 44 pt target, stopping at the ends', async () => {
      await open();
      const prev = screen.getByRole('button', { name: 'Previous puzzle' });
      const next = screen.getByRole('button', { name: 'Next puzzle' });
      expect(prev).toBeDisabled();
      expect(next.props.accessibilityHint).toBe('Mini');
      for (const b of [prev, next]) expect(flat(b).width).toBeGreaterThanOrEqual(44);
      await fireEvent.press(next);
      await waitFor(() => expect(screen.getByTestId('day-board')).toBeOnTheScreen());
      expect(screen.getByRole('button', { name: 'Mini' })).toBeSelected();
      expect(screen.getByTestId('pager-tile-mini')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Next puzzle' }));
      expect(screen.getByRole('button', { name: 'Doku' })).toBeSelected();
      await fireEvent.press(screen.getByTestId('pill-tally'));
      // Records is the last stop (Alec, 7 Nov 2026).
      expect(screen.getByRole('button', { name: 'Next puzzle' }).props.accessibilityHint).toBe(
        'Records',
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Next puzzle' }));
      await waitFor(() => expect(screen.getByTestId('records-board')).toBeOnTheScreen());
      expect(screen.getByRole('button', { name: 'Next puzzle' })).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Previous puzzle' }));
      expect(screen.getByRole('button', { name: 'Tally' })).toBeSelected();
    });

    it('THEN a sideways swipe on the board steps too; a mostly-vertical drag doesn’t', async () => {
      await open();
      expect(screen.getByTestId('board-swipe').props.onMoveShouldSetResponder).toBeDefined();
      expect(claimsSwipe(40, 10)).toBe(true);
      expect(claimsSwipe(30, 20)).toBe(true); // leans sideways: the board takes it
      expect(claimsSwipe(40, 40)).toBe(false); // a scroll that drifts sideways
      expect(claimsSwipe(10, 0)).toBe(false);
      expect(screen.getByTestId('board-swipe').props.onMoveShouldSetResponderCapture).toBeDefined();
      expect(swipeStep(-80)).toBe(1); // swipe left: next puzzle
      expect(swipeStep(80)).toBe(-1);
      expect(swipeStep(40)).toBe(0);
    });

    it('THEN a puzzle’s board names the puzzle in the pager, with the date under it', async () => {
      jest.mocked(fetchPuzzleCards).mockResolvedValue([
        {
          path: `reports/${today}-crossword-mini-0105.html`,
          type: 'mini',
          id: 'DP·MINI·0105',
          date: today,
          headline: 'Mini 105',
        },
      ]);
      await open();
      await fireEvent.press(screen.getByTestId('pill-mini'));
      await waitFor(() => expect(screen.getByTestId('day-board')).toBeOnTheScreen());
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Mini 105' })).toBeOnTheScreen(),
      );
      expect(screen.getByTestId('pager-day')).toHaveTextContent(`Today · ${shortDate(today)}`);
    });

    it('THEN a puzzle’s board says where you stand overall today and this week', async () => {
      m.boardOverall.mockResolvedValue(
        overall({
          week: [
            { rank: 1, nick: 'Ma', me: false, points: 30, played: 12, completed: 11 },
            { rank: 2, nick: 'Alec', me: true, points: 12, played: 9, completed: 9 },
          ],
        }),
      );
      await open();
      expect(screen.queryByTestId('you-line')).toBeNull(); // All puzzles is the overall board
      await fireEvent.press(screen.getByTestId('pill-mini'));
      await waitFor(() => expect(screen.getByTestId('you-line')).toBeOnTheScreen());
      expect(screen.getByTestId('you-line')).toHaveTextContent(
        'Today overall 2nd · 1 ptWeek 2nd · 12 pts',
      );
    });

    it('THEN earlier days are one tap away, and Back to today returns', async () => {
      await open();
      await fireEvent.press(screen.getByRole('button', { name: 'Earlier days' }));
      expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));
      await waitFor(() =>
        expect(screen.getByTestId('day-line')).toHaveTextContent(/^Yesterday · /),
      );
      expect(screen.getByTestId('pager-day')).toHaveTextContent(/^Yesterday · /);
      await fireEvent.press(screen.getByRole('button', { name: 'Back to today' }));
      expect(screen.getByTestId('pager-day')).toHaveTextContent(`Today · ${shortDate(today)}`);
      expect(screen.queryByRole('button', { name: 'Previous day' })).toBeNull();
    });
  });

  it('THEN places read 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '101st',
    ]);
  });
});

describe('GIVEN the margins on Leagues (AF-007)', () => {
  it('THEN the page keeps its 16 pt gutter', () => {
    expect(GUTTER).toBe(16);
  });

  it('THEN a highlighted board row has inner padding on the right as well as the left', async () => {
    await open();
    const mine = screen.getByLabelText('🥈 Alec (you), 1 pt, 1 of 9 done');
    const s = flat(mine);
    expect(s.paddingRight).toBe(ROW_INSET_RIGHT);
    expect(ROW_INSET_RIGHT).toBeGreaterThanOrEqual(8);
  });

  it('THEN a record row has the same inner padding on the right', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('pill-records'));
    await waitFor(() => expect(screen.getByTestId('records-board')).toBeOnTheScreen());
    for (const r of within(screen.getByTestId('records-board')).getAllByTestId(/^record-/))
      expect(flat(r).paddingRight).toBe(ROW_INSET_RIGHT);
  });
});
