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

    // Alec, 7 Nov 2026: no standing line on puzzle boards; All puzzles has the totals.
    it('THEN a puzzle’s board has no overall standing line, and asks only for its own board', async () => {
      await open();
      const overalls = m.boardOverall.mock.calls.length;
      await fireEvent.press(screen.getByTestId('pill-mini'));
      await waitFor(() => expect(screen.getByTestId('day-board')).toBeOnTheScreen());
      expect(screen.queryByTestId('you-line')).toBeNull();
      expect(screen.queryByText(/Today overall/)).toBeNull();
      expect(m.boardOverall.mock.calls.length).toBe(overalls);
    });

    it('THEN earlier days are one tap away, and Back to today returns', async () => {
      await open();
      await fireEvent.press(screen.getByTestId('pager-day-btn'));
      expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));
      await waitFor(() =>
        expect(screen.getByTestId('day-line')).toHaveTextContent(/^Yesterday · /),
      );
      expect(screen.getByTestId('pager-day')).toHaveTextContent(/^Yesterday · /);
      await fireEvent.press(screen.getByTestId('pager-day-btn'));
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

// Alec, 7 Nov 2026: a less crowded board.
describe('GIVEN a board in the decluttered layout', () => {
  it('THEN the league menu holds the leagues, then Invite, League settings, Start and Join', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('league-picker'));
    const menu = screen.getByTestId('league-menu');
    const items = within(menu)
      .getAllByRole(/button|radio/)
      .map((b) => b.props.accessibilityLabel as string);
    expect(items).toEqual([
      'Family',
      'Work',
      'Invite people',
      'League settings',
      'Start a new league',
      'Join with a code',
    ]);
    await fireEvent.press(screen.getByTestId('menu-settings'));
    expect(screen.queryByTestId('league-menu')).toBeNull();
    expect(screen.getByTestId('league-settings')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('settings-done'));
    expect(screen.queryByTestId('league-settings')).toBeNull();
  });

  it('THEN Share is the only action under the board: no Invite button, no Earlier days link, no footer', async () => {
    await open();
    expect(screen.getByRole('button', { name: 'Share leaderboard' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Invite people' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Earlier days' })).toBeNull();
    expect(screen.queryByRole('button', { name: /League settings/ })).toBeNull();
    expect(screen.queryByTestId('leagues-foot')).toBeNull();
    expect(screen.queryByText(/Private leagues for friends and family/)).toBeNull();
  });

  it('THEN the date is a 44 pt button that opens the earlier days', async () => {
    await open();
    const day = screen.getByTestId('pager-day-btn');
    expect(day.props.accessibilityLabel).toBe(`Today · ${shortDate(today)}, choose an earlier day`);
    const slop = day.props.hitSlop as { top: number; bottom: number };
    expect(17 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
    await fireEvent.press(day);
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeOnTheScreen();
    expect(screen.getByTestId('pager-day-btn').props.accessibilityLabel).toMatch(/back to today$/);
  });
});

describe('GIVEN the margins on Leagues (AF-007)', () => {
  it('THEN the page keeps its 16 pt gutter', () => {
    expect(GUTTER).toBe(16);
  });

  // Alec, 7 Nov 2026: one rule under the pager, the table close to the dots, room round Share.
  it('THEN only one rule sits between the masthead and the table, and Share has room', async () => {
    await open();
    const pager = screen.getByTestId('type-pager').children[0] as unknown as {
      props: { style?: unknown };
    };
    expect(flat(pager).borderTopWidth).toBeUndefined();
    expect(flat(pager).borderBottomWidth).toBeGreaterThan(0);
    const share = screen.getByTestId('share-board');
    expect(flat(share)).toMatchObject({ marginTop: 24, marginBottom: 32 });
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

/** A one-finger drag from (0, 0) to (x, y), as the responder system reports it. */
function drag(el: { props: Record<string, (e: unknown) => unknown> }, x: number, y: number) {
  let ts = 1;
  const ev = (px: number, py: number) => {
    ts += 10;
    const touch = {
      touchActive: true,
      startPageX: 0,
      startPageY: 0,
      startTimeStamp: 1,
      currentPageX: px,
      currentPageY: py,
      currentTimeStamp: ts,
      previousPageX: 0,
      previousPageY: 0,
      previousTimeStamp: 1,
    };
    return {
      nativeEvent: { touches: [{}], changedTouches: [{}], timestamp: ts },
      touchHistory: {
        numberActiveTouches: 1,
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: ts,
        touchBank: [touch],
      },
    };
  };
  const claimed = el.props.onMoveShouldSetResponderCapture!(ev(x, y));
  if (claimed) {
    el.props.onResponderGrant!(ev(0, 0));
    el.props.onResponderMove!(ev(x, y));
    el.props.onResponderRelease!(ev(x, y));
  }
  return claimed;
}

// Alec, 8 Nov 2026: the swipe works on an empty board, and the pager stays put.
describe('GIVEN a board nobody has played yet', () => {
  it('THEN the swipe area fills the page, and a swipe moves to the next stop', async () => {
    m.boardOverall.mockResolvedValue(overall({ day: [], week: [], not_yet: [] }));
    await open();
    const area = screen.getByTestId('board-swipe');
    expect(flat(area).flex).toBe(1);
    expect(flat(screen.getByTestId('league-board')).flex).toBe(1);
    expect(flat(screen.getByTestId('board-scroll')).flex).toBe(1);
    await act(async () => {
      expect(drag(area as never, -90, 4)).toBe(true);
    });
    await waitFor(() => expect(board().ptype).toBe('mini'));
  });

  it('THEN a mostly-vertical drag is left to the scroll', async () => {
    m.boardOverall.mockResolvedValue(overall({ day: [], week: [], not_yet: [] }));
    await open();
    expect(drag(screen.getByTestId('board-swipe') as never, 10, 80)).toBe(false);
  });
});

describe('GIVEN a long board', () => {
  it('THEN the masthead and the puzzle pager sit outside the board’s scroll; Share and the notes scroll', async () => {
    m.boardOverall.mockResolvedValue(
      overall({
        not_yet: [{ nick: 'Piers', me: false }],
        day: Array.from({ length: 30 }, (_, i) => ({
          rank: i + 1,
          nick: `P${i}`,
          me: false,
          points: 30 - i,
          played: 1,
          completed: 1,
        })),
      }),
    );
    await open();
    const scroll = screen.getByTestId('board-scroll');
    expect(within(scroll).queryByTestId('type-pager')).toBeNull();
    expect(within(scroll).queryByTestId('masthead')).toBeNull();
    expect(screen.getByTestId('type-pager')).toBeOnTheScreen();
    expect(within(scroll).getByTestId('board-notes')).toBeOnTheScreen();
    expect(within(scroll).getByTestId('share-board')).toBeOnTheScreen();
    expect(within(scroll).getByText(/This week/)).toBeOnTheScreen();
    expect(screen.queryByTestId('leagues-screen-scroll')).toBeNull();
  });

  it('THEN the settings card scrolls with the board and isn’t swiped away', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('league-picker'));
    const settings = await screen.findByRole('button', { name: /League settings/ });
    await fireEvent.press(settings);
    const scroll = screen.getByTestId('board-scroll');
    await waitFor(() => expect(within(scroll).getByText(/Settings|settings/)).toBeOnTheScreen());
    expect(drag(screen.getByTestId('board-swipe') as never, -90, 4)).toBe(false);
  });
});
