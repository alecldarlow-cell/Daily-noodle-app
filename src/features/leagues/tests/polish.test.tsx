/* Polish C: League settings per league, pull to refresh, a failed board, repeat taps, type. */
import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Alert, RefreshControl, type RefreshControlProps } from 'react-native';

import { QueryProvider } from '@/shared/query';
import { renderWithProviders } from '@/shared/testing';

import * as api from '../api/board';
import { BoardError } from '../api/errors';
import { fetchPuzzleCards } from '../api/feed';
import { LeaguesScreen } from '../components/LeaguesScreen/LeaguesScreen';
import { leaguesParams } from '../hooks/useLeaguesFlow';
import { board, clearStore, FAMILY, mineRow, OTHER, overall, PID, setBoard } from './helpers';

jest.mock('../api/board');
jest.mock('../api/feed');
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  useNavigation: () => mockNavigation,
}));
const mockNavigation = { setParams: jest.fn() };

const m = jest.mocked(api);
const params = jest.mocked(useLocalSearchParams);
const today = londonDay();
const WORK = { ...FAMILY, code: 'WXYZ6789', name: 'Work', members: 2 };

jest.setTimeout(30_000);

beforeEach(() => {
  clearStore();
  jest.clearAllMocks();
  params.mockReturnValue({});
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  jest.mocked(fetchPuzzleCards).mockResolvedValue([]);
  m.boardMine.mockResolvedValue([]);
  m.boardOverall.mockReset();
  m.boardOverall.mockResolvedValue(overall());
  m.boardBackfill.mockResolvedValue(0);
});

afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
});

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

function inBoth() {
  setBoard({
    pid: PID,
    leagues: [FAMILY, WORK],
    cur: FAMILY.code,
    fill: { n: 0, aids: [] },
  });
  m.boardMine.mockResolvedValue([mineRow(), mineRow(WORK)]);
}

/** Leagues are picked from the menu under the league's name in the heading (AF-017). */
async function switchTo(code: string) {
  await fireEvent.press(screen.getByTestId('league-picker'));
  await fireEvent.press(screen.getByTestId(`league-${code}`));
}

async function rerender(r: Awaited<ReturnType<typeof renderWithProviders>>) {
  await r.rerender(
    <QueryProvider client={r.client}>
      <LeaguesScreen />
    </QueryProvider>,
  );
}

describe('GIVEN the owner of two leagues with League settings open', () => {
  describe('WHEN they switch to the other league', () => {
    it('THEN the rename box shows that league’s own name, and Save renames it to that, not the first’s', async () => {
      inBoth();
      m.boardRename.mockResolvedValue(true);
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      // Both boards seen once, so a switch shows the other at once and Settings stays put.
      await switchTo(WORK.code);
      await waitFor(() => expect(m.boardOverall).toHaveBeenCalledWith(PID, WORK.code, today));
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      await switchTo(FAMILY.code);
      await waitFor(() => expect(board().cur).toBe(FAMILY.code));
      await press('⚙︎ League settings');
      expect(screen.getByLabelText('League name')).toHaveDisplayValue('Family');
      await switchTo(WORK.code);
      await waitFor(() => expect(board().cur).toBe(WORK.code));
      // Still open: the same Settings, now for Work.
      await waitFor(() => expect(screen.getByLabelText('League name')).toHaveDisplayValue('Work'));
      await press('Save');
      await waitFor(() => expect(m.boardRename).toHaveBeenCalledWith(PID, WORK.code, 'Work'));
      expect(m.boardRename).not.toHaveBeenCalledWith(PID, WORK.code, 'Family');
      await waitFor(() => expect(screen.getByText('Saved.')).toBeOnTheScreen());
    });
  });
});

describe('GIVEN a player in a league', () => {
  const inFamily = () => {
    setBoard({ pid: PID, leagues: [FAMILY], cur: FAMILY.code, fill: { n: 0, aids: [] } });
    m.boardMine.mockResolvedValue([mineRow()]);
  };

  describe('WHEN they pull to refresh', () => {
    it('THEN the board is asked for again as well as the leagues, with the spinner held till it’s back', async () => {
      inFamily();
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      const boards = m.boardOverall.mock.calls.length;
      const lists = m.boardMine.mock.calls.length;
      let release!: () => void;
      m.boardOverall.mockImplementationOnce(
        () => new Promise((r) => (release = () => r(overall()))),
      );
      // React Native's test stand-in for RefreshControl keeps the one on screen.
      const pull = () =>
        (RefreshControl as unknown as { latestRef: { props: RefreshControlProps } }).latestRef;
      expect(pull().props.refreshing).toBe(false);
      await act(async () => pull().props.onRefresh!());
      expect(pull().props.refreshing).toBe(true);
      await waitFor(() => expect(m.boardOverall.mock.calls.length).toBe(boards + 1));
      expect(m.boardMine.mock.calls.length).toBeGreaterThan(lists);
      await act(async () => release());
      await waitFor(() => expect(pull().props.refreshing).toBe(false));
      expect(screen.getByTestId('overall-board')).toBeOnTheScreen();
    });
  });

  describe('WHEN the board can’t be reached (no signal)', () => {
    it('THEN it says they’re offline, and Try again loads it', async () => {
      inFamily();
      m.boardOverall.mockRejectedValueOnce(new BoardError('offline'));
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('board-error')).toBeOnTheScreen());
      expect(screen.getByRole('header', { name: 'You’re offline' })).toBeOnTheScreen();
      expect(screen.getByTestId('board-error')).toHaveTextContent(/Check your connection/);
      await press('Try again');
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
    });
  });

  describe('WHEN the server fails in a way it has no words for', () => {
    it('THEN the player sees the site’s “Something went wrong”, never the raw text', async () => {
      inFamily();
      // rpcOver keeps the server's raw text as the reason; the player never sees it.
      m.boardOverall.mockRejectedValue(new BoardError('PGRST301: JWT expired at relation board_x'));
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('board-error')).toBeOnTheScreen());
      expect(screen.getByRole('header', { name: 'Couldn’t load the board' })).toBeOnTheScreen();
      expect(screen.getByTestId('board-error')).toHaveTextContent(
        /Something went wrong\. Please try again\./,
      );
      expect(screen.queryByText(/PGRST301|JWT|relation/)).toBeNull();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    });

    it('THEN a failed settings action says so in the site’s words too', async () => {
      inFamily();
      m.boardLeave.mockRejectedValue(new TypeError('Network request failed at fetch'));
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      await press('⚙︎ League settings');
      await press('Leave league');
      await waitFor(() =>
        expect(screen.getByText('Something went wrong. Please try again.')).toBeOnTheScreen(),
      );
      expect(screen.queryByText(/Network request failed/)).toBeNull();
    });
  });
});

describe('GIVEN Leagues opened with an ask in its route', () => {
  describe('WHEN the screen has read it', () => {
    it('THEN the ask is cleared from the route, so the same ask again is new', async () => {
      params.mockReturnValue({ go: 'claim' });
      await renderWithProviders(<LeaguesScreen />);
      expect(screen.getByRole('header', { name: 'Already in a league?' })).toBeOnTheScreen();
      expect(mockNavigation.setParams).toHaveBeenCalledWith({
        join: undefined,
        go: undefined,
        p: undefined,
        d: undefined,
        n: undefined,
      });
    });

    it('THEN nothing is cleared when nothing was asked', async () => {
      await renderWithProviders(<LeaguesScreen />);
      expect(mockNavigation.setParams).not.toHaveBeenCalled();
    });
  });

  describe('WHEN “Bring my leagues here” is tapped again after Back', () => {
    it('THEN the claim form opens again', async () => {
      params.mockReturnValue({ go: 'claim', n: 'a' });
      const r = await renderWithProviders(<LeaguesScreen />);
      expect(screen.getByRole('header', { name: 'Already in a league?' })).toBeOnTheScreen();
      await press('Back');
      expect(screen.queryByRole('header', { name: 'Already in a league?' })).toBeNull();
      // The same ask, as a second tap sends it: a fresh n.
      params.mockReturnValue({ go: 'claim', n: 'b' });
      await rerender(r);
      expect(screen.getByRole('header', { name: 'Already in a league?' })).toBeOnTheScreen();
    });

    it('THEN it opens again after the route was cleared, even with the very same params', async () => {
      params.mockReturnValue({ go: 'claim' });
      const r = await renderWithProviders(<LeaguesScreen />);
      await press('Back');
      params.mockReturnValue({});
      await rerender(r);
      expect(screen.queryByRole('header', { name: 'Already in a league?' })).toBeNull();
      params.mockReturnValue({ go: 'claim' });
      await rerender(r);
      expect(screen.getByRole('header', { name: 'Already in a league?' })).toBeOnTheScreen();
    });
  });

  describe('WHEN the board’s link is tapped again after another pill was picked', () => {
    it('THEN that puzzle’s board shows again; the cleared route keeps what’s showing', async () => {
      setBoard({ pid: PID, leagues: [FAMILY], cur: FAMILY.code, fill: { n: 0, aids: [] } });
      m.boardMine.mockResolvedValue([mineRow()]);
      m.boardDay.mockResolvedValue({
        ranked: [],
        unranked: [],
        not_yet: [],
        players: ['Alec'],
        members: 1,
        first: today,
      });
      params.mockReturnValue({ p: 'mini', n: '1' });
      const r = await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('day-board')).toBeOnTheScreen());
      // The route is cleared: the Mini board stays.
      params.mockReturnValue({});
      await rerender(r);
      expect(screen.getByRole('button', { name: 'Mini' })).toBeSelected();
      await fireEvent.press(screen.getByTestId('pill-all'));
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      params.mockReturnValue({ p: 'mini', n: '2' });
      await rerender(r);
      await waitFor(() => expect(screen.getByTestId('day-board')).toBeOnTheScreen());
      expect(screen.getByRole('button', { name: 'Mini' })).toBeSelected();
    });
  });

  describe('WHEN Account points to a choice waiting here (?go=home)', () => {
    it('THEN the choice shows, even if a form was open', async () => {
      setBoard({
        pid: PID,
        leagues: [FAMILY],
        cur: FAMILY.code,
        fill: { n: 0, aids: [] },
        pend: { pid: OTHER, leagues: [WORK], cur: WORK.code },
      });
      m.boardMine.mockResolvedValue([mineRow()]);
      params.mockReturnValue({ go: 'code' });
      const r = await renderWithProviders(<LeaguesScreen />);
      expect(screen.getByRole('header', { name: 'Join a league' })).toBeOnTheScreen();
      params.mockReturnValue({ go: 'home', n: 'x' });
      await rerender(r);
      expect(
        screen.getByRole('header', { name: 'Which leagues should this app use?' }),
      ).toBeOnTheScreen();
    });
  });
});

describe('GIVEN a tap into Leagues made by the app', () => {
  it('THEN its params carry the ask and an n that differs every time', () => {
    const a = leaguesParams({ p: 'mini', d: '2026-10-20', go: undefined });
    const b = leaguesParams({ p: 'mini', d: '2026-10-20' });
    expect(a).toMatchObject({ p: 'mini', d: '2026-10-20' });
    expect(a).not.toHaveProperty('go');
    expect(a.n).not.toBe(b.n);
  });
});
