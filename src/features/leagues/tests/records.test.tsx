import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Share } from 'react-native';

import { renderWithProviders } from '@/shared/testing';

import * as api from '../api/board';
import { BoardError } from '../api/errors';
import { fetchPuzzleCards } from '../api/feed';
import { LeaguesScreen } from '../components/LeaguesScreen/LeaguesScreen';
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
}));

const m = jest.mocked(api);
const params = jest.mocked(useLocalSearchParams);
const today = londonDay();
let shared: string[] = [];

beforeEach(() => {
  clearStore();
  jest.clearAllMocks();
  params.mockReturnValue({});
  shared = [];
  jest.spyOn(Share, 'share').mockImplementation(async (c) => {
    shared.push((c as { message: string }).message);
    return { action: 'sharedAction', activityType: undefined };
  });
  jest.mocked(fetchPuzzleCards).mockResolvedValue([]);
  setBoard({ pid: PID, leagues: [FAMILY], cur: FAMILY.code, fill: { n: 0, aids: [] } });
  m.boardMine.mockResolvedValue([mineRow()]);
  m.boardDay.mockResolvedValue(dayBoard());
  m.boardOverall.mockResolvedValue(overall());
  m.boardBackfill.mockResolvedValue(0);
  m.boardRecords.mockResolvedValue(recordsData(today));
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
});

const openRecords = async () => {
  await renderWithProviders(<LeaguesScreen />);
  await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
  await fireEvent.press(screen.getByTestId('pill-records'));
  await waitFor(() => expect(screen.getByTestId('records-board')).toBeOnTheScreen());
};

describe('GIVEN a player in a league', () => {
  describe('WHEN they pick the Records pill', () => {
    it('THEN it sits after All puzzles, fetches board_records only, and is remembered', async () => {
      await openRecords();
      const pills = screen.getAllByTestId(/^pill-/).map((p) => p.props.testID as string);
      expect(pills.slice(0, 3)).toEqual(['pill-all', 'pill-records', 'pill-mini']);
      expect(screen.getByRole('button', { name: 'Records' })).toBeSelected();
      expect(m.boardRecords).toHaveBeenCalledWith(PID, 'ABCD2345');
      expect(m.boardOverall).toHaveBeenCalledTimes(1); // the opening All puzzles view only
      expect(board().ptype).toBe('records');
    });

    it('THEN each puzzle’s record shows its holder, day and result, today’s marked 🏆', async () => {
      await openRecords();
      const ids = within(screen.getByTestId('records-board'))
        .getAllByTestId(/^record-/)
        .map((r) => r.props.testID as string);
      expect(ids).toEqual(['record-mini', 'record-link', 'record-tangle']);
      expect(screen.getByTestId('record-mini')).toHaveTextContent(/Mini.*Ma · 18 Oct.*0:30/);
      expect(screen.getByTestId('record-link')).toHaveTextContent(/1:35.*1 mistake/);
      expect(screen.getByTestId('record-tangle')).toHaveTextContent(/🏆 today.*57 pts.*4:00/);
    });

    it('THEN the honours name their leaders, and the players run most-finished first', async () => {
      await openRecords();
      expect(screen.getByTestId('honour-longest')).toHaveTextContent(/Alec, Ma.*5 days/);
      expect(screen.getByTestId('honour-wins')).toHaveTextContent(/Ma.*9/);
      expect(screen.getByTestId('honour-titles')).toHaveTextContent(/Ma.*1/);
      expect(screen.getByTestId('honour-perfect')).toHaveTextContent(/Ma.*2/);
      const players = screen.getAllByTestId(/^player-/).map((r) => r.props.testID as string);
      expect(players).toEqual(['player-Ma', 'player-Alec', 'player-Jo']);
      expect(screen.getByTestId('player-Ma')).toHaveTextContent(
        /Ma 👑.*9 wins · 1 title · best streak 5.*30.*finished/,
      );
      expect(screen.getByTestId('player-Alec')).toHaveTextContent(/YOU/);
      expect(screen.getByText(/Tap a name to see their card\./)).toBeOnTheScreen();
      await fireEvent.press(screen.getByText('⚙︎ League settings'));
      expect(screen.getByTestId('league-settings')).toHaveTextContent(/3 players/);
    });

    it('THEN Invite shares the league’s link', async () => {
      await openRecords();
      await fireEvent.press(screen.getByRole('button', { name: 'Invite people' }));
      expect(shared[0]).toContain('board.html?join=ABCD2345');
    });
  });

  describe('WHEN a name is tapped', () => {
    it('THEN that player’s card shows their honours and bests, with 🏅 where they hold the record, and Back returns', async () => {
      await openRecords();
      await fireEvent.press(screen.getByTestId('player-Ma'));
      const card = screen.getByTestId('player-card');
      expect(within(card).getByRole('header')).toHaveTextContent('Ma 👑');
      expect(within(card).getByText('Last week’s champion.')).toBeOnTheScreen();
      expect(screen.getByTestId('card-wins')).toHaveTextContent(/9.*Daily wins/);
      expect(screen.getByTestId('card-longest')).toHaveTextContent(/5.*Longest streak \(days\)/);
      expect(screen.getByTestId('best-mini')).toHaveTextContent(/18 Oct · 🏅 league record.*0:30/);
      expect(screen.getByTestId('best-doku')).toHaveTextContent(/Not finished yet.*–/);
      await fireEvent.press(screen.getByTestId('card-back'));
      expect(screen.getByTestId('records-board')).toBeOnTheScreen();

      // a record row opens its holder; a joint leader's name in Honours opens theirs
      await fireEvent.press(screen.getByTestId('record-tangle'));
      expect(screen.getByTestId('best-mini')).toHaveTextContent(/19 Oct · best streak 4.*0:41/);
      expect(screen.getByTestId('best-tangle')).toHaveTextContent(/🏅 league record.*57 pts/);
      await fireEvent.press(screen.getByTestId('card-back'));
      await fireEvent.press(within(screen.getByTestId('honour-longest')).getByText('Alec'));
      expect(within(screen.getByTestId('player-card')).getByRole('header')).toHaveTextContent(
        /Alec.*YOU/,
      );
    });
  });

  describe('WHEN the league has no records yet', () => {
    it('THEN it says how to set the first, and every honour is nobody yet', async () => {
      m.boardRecords.mockResolvedValue(
        recordsData(today, {
          records: {},
          players: recordsData(today).players.map((p) => ({
            ...p,
            completed: 0,
            wins: 0,
            titles: 0,
            perfect: 0,
            sweeps: 0,
            longest: 0,
            current: 0,
            bests: {},
          })),
          crown: [],
        }),
      );
      await openRecords();
      expect(screen.getByTestId('records-empty')).toHaveTextContent(
        'No records yet: finish a puzzle to set the first.',
      );
      expect(screen.getByTestId('honour-wins')).toHaveTextContent(/Nobody yet.*–/);
    });
  });

  describe('WHEN the app opens on ?p=records, or the records can’t load', () => {
    it('THEN it opens straight on Records; a failure says so, as the boards do', async () => {
      params.mockReturnValue({ p: 'records' });
      m.boardRecords.mockRejectedValue(new BoardError('busy'));
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('board-error')).toBeOnTheScreen());
      expect(screen.getByTestId('board-error')).toHaveTextContent(/Couldn’t load the board/);
      expect(m.boardOverall).not.toHaveBeenCalled();
      expect(m.boardDay).not.toHaveBeenCalled();
    });

    it('THEN a player taken off the league has their leagues refreshed', async () => {
      params.mockReturnValue({ p: 'records' });
      m.boardRecords.mockRejectedValue(new BoardError('not_member'));
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(m.boardMine).toHaveBeenCalled());
    });
  });
});
