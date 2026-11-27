/* #200 (review of 27 Nov 2026): the pager says where you are, its dots are 44 pt to the touch,
   and the space under a board offers today's next unplayed puzzle. */
import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { appStorage } from '@/shared/storage';
import { renderWithProviders } from '@/shared/testing';

import * as api from '../api/board';
import { fetchPuzzleCards } from '../api/feed';
import { pagerCount } from '../components/BoardControls';
import { todaysCards } from '../components/BoardNext';
import { LeaguesScreen } from '../components/LeaguesScreen/LeaguesScreen';
import type { PuzzleCard } from '../types';
import {
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
const flat = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

const card = (type: string, n: number, date = today): PuzzleCard => ({
  path: `reports/${date}-${type}-${n}.html`,
  type,
  id: `DP·${type.toUpperCase()}·${n}`,
  date,
  headline: `${type[0]!.toUpperCase()}${type.slice(1)} ${n}`,
});

jest.setTimeout(30_000);

beforeEach(() => {
  clearStore();
  jest.clearAllMocks();
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  jest.mocked(fetchPuzzleCards).mockResolvedValue([]);
  setBoard({ pid: PID, leagues: [FAMILY], cur: FAMILY.code, fill: { n: 0, aids: [] } });
  m.boardMine.mockResolvedValue([mineRow()]);
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

describe('GIVEN the puzzle pager (#200)', () => {
  describe('WHEN it shows', () => {
    it('THEN a line under the dots says where you are, and follows the arrows', async () => {
      await open();
      expect(screen.getByTestId('pager-count')).toHaveTextContent('All puzzles · 1 of 11');
      await fireEvent.press(screen.getByRole('button', { name: 'Next puzzle' }));
      await waitFor(() =>
        expect(screen.getByTestId('pager-count')).toHaveTextContent('Mini · 2 of 11'),
      );
    });

    it('THEN every dot is at least 32 pt wide and 44 pt tall to the touch', async () => {
      await open();
      const dots = within(screen.getByTestId('puzzle-chips')).getAllByTestId(/^pill-/);
      expect(dots).toHaveLength(11);
      for (const d of dots) {
        const s = flat(d);
        const slop = d.props.hitSlop as { top: number; bottom: number };
        expect(s.width).toBeGreaterThanOrEqual(32);
        expect((s.height as number) + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
      }
    });
  });

  it('THEN pagerCount reads the last stop too', () => {
    expect(pagerCount(['all', 'mini', 'records'], 'records')).toBe('Records · 3 of 3');
  });
});

describe('GIVEN today’s puzzles under a league board (#200)', () => {
  it('THEN todaysCards keeps today’s, one per type, in the daily order', () => {
    const cards = [card('doku', 9), card('mini', 5, '2020-01-01'), card('mini', 6)];
    expect(todaysCards(cards, today).map((c) => c.id)).toEqual(['DP·MINI·6', 'DP·DOKU·9']);
    expect(todaysCards(undefined, today)).toEqual([]);
  });

  describe('WHEN some are unplayed', () => {
    it('THEN Play next offers the first unplayed one and opens it', async () => {
      jest.mocked(fetchPuzzleCards).mockResolvedValue([card('mini', 6), card('doku', 9)]);
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: { 'DP·MINI·6': { t: '01:00', d: today } } }),
      );
      await open();
      const next = await screen.findByRole('button', { name: 'Play next: Doku 9' });
      await fireEvent.press(next);
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/play/[type]/[file]',
        params: { type: 'doku', file: `${today}-doku-9` },
      });
    });

    it('THEN on a puzzle’s own board it skips that puzzle, which has its own prompt', async () => {
      jest.mocked(fetchPuzzleCards).mockResolvedValue([card('mini', 6), card('doku', 9)]);
      await open();
      await fireEvent.press(screen.getByTestId('pill-mini'));
      await waitFor(() => expect(screen.getByTestId('day-board')).toBeOnTheScreen());
      expect(await screen.findByRole('button', { name: 'Play next: Doku 9' })).toBeOnTheScreen();
    });
  });

  describe('WHEN all of today’s are done, or the board shows Records', () => {
    it('THEN there is no Play next', async () => {
      jest.mocked(fetchPuzzleCards).mockResolvedValue([card('mini', 6)]);
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: { 'DP·MINI·6': { t: '01:00', d: today } } }),
      );
      await open();
      await waitFor(() => expect(fetchPuzzleCards).toHaveBeenCalled());
      expect(screen.queryByTestId('play-next')).toBeNull();
    });

    it('THEN Records has none either', async () => {
      jest.mocked(fetchPuzzleCards).mockResolvedValue([card('doku', 9)]);
      await open();
      await screen.findByTestId('play-next');
      await fireEvent.press(screen.getByTestId('pill-records'));
      await waitFor(() => expect(screen.queryByTestId('play-next')).toBeNull());
    });
  });
});
