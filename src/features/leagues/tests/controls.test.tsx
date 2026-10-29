/* AF-017 and AF-007: compact board controls, and rows and chip rows that keep their margins. */
import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/shared/testing';
import { shortDate } from '@/shared/time';

import * as api from '../api/board';
import { fetchPuzzleCards } from '../api/feed';
import { CHIP_H, CHIP_SLOP, GUTTER } from '../components/BoardControls';
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
      expect(flat(picker).minHeight).toBeGreaterThanOrEqual(44);
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

  describe('WHEN the puzzle chips and the date show', () => {
    it('THEN the chips are about 32 tall in one scrolling row, each still a 44 pt target', async () => {
      await open();
      expect(CHIP_H).toBe(32);
      const row = screen.getByTestId('puzzle-chips');
      expect(row.props.horizontal).toBe(true);
      const chips = screen.getAllByTestId(/^pill-/);
      expect(chips.length).toBe(10);
      for (const c of chips) {
        const s = flat(c);
        expect(s.minHeight).toBe(32);
        // No fixed height: at large text sizes a chip grows rather than clips.
        expect(s.height).toBeUndefined();
        const slop = c.props.hitSlop as { top: number; bottom: number };
        expect(32 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
      }
      // The row has room for that slop, so a tap at its edge still lands.
      expect(flat({ props: { style: row.props.contentContainerStyle } }).paddingVertical).toBe(
        CHIP_SLOP,
      );
    });

    it('THEN the day is one slim line, “Today · <date>”, without “All eight puzzles”', async () => {
      await open();
      expect(screen.getByTestId('day-line')).toHaveTextContent(`Today · ${shortDate(today)}`);
      expect(screen.queryByText(/All eight puzzles/)).toBeNull();
      for (const name of ['Previous day', 'Next day']) {
        const b = screen.getByRole('button', { name });
        const slop = b.props.hitSlop as number;
        expect((flat(b).height as number) + 2 * slop).toBeGreaterThanOrEqual(44);
      }
    });

    it('THEN a puzzle’s board names the puzzle on the same line', async () => {
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
        expect(screen.getByTestId('day-line')).toHaveTextContent(
          `Today · ${shortDate(today)} · ✏️ Mini 105`,
        ),
      );
    });
  });
});

describe('GIVEN the margins on Leagues (AF-007)', () => {
  it('THEN the chip row runs edge to edge with the gutter as its inner padding', async () => {
    await open();
    const row = screen.getByTestId('puzzle-chips');
    expect(flat(row).marginHorizontal).toBe(-GUTTER);
    expect(flat({ props: { style: row.props.contentContainerStyle } }).paddingHorizontal).toBe(
      GUTTER,
    );
    expect(GUTTER).toBe(16);
  });

  it('THEN a highlighted board row has inner padding on the right as well as the left', async () => {
    await open();
    const mine = screen.getByLabelText('🥈 Alec (you), 1 pt, 1 of 8 done');
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
