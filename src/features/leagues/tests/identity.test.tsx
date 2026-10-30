/* Hardening R8: league answers are tied to the player who asked for them. */
import { londonDay } from '@noodle/core';
import { act, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { QueryProvider } from '@/shared/query';
import { renderWithProviders, testQueryClient } from '@/shared/testing';

import * as api from '../api/board';
import { BoardLink } from '../components/BoardLink';
import { LeagueResults } from '../components/LeagueResults';
import { addDays } from '../hooks/boardText';
import { clearSubmissions } from '../hooks/submissions';
import { useBoardData, useBoardRecords, useJoinLeague, useMine } from '../hooks/useLeagues';
import {
  board,
  clearStore,
  dayBoard,
  FAMILY,
  mineRow,
  OTHER,
  PID,
  recordsData,
  setBoard,
} from './helpers';

jest.mock('../api/board');
jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn(), navigate: jest.fn() } }));
const m = jest.mocked(api);

const today = londonDay();
const earlier = addDays(today, -3);
const PATH = `reports/${earlier}-crossword-mini-0105.html`;

beforeEach(() => {
  clearStore();
  clearSubmissions();
  jest.clearAllMocks();
  m.boardSubmit.mockResolvedValue(true);
  // PID holds Family's Mini record on that puzzle; OTHER doesn't.
  m.boardMoment.mockImplementation(async (pid) =>
    pid === PID
      ? { type: 'mini', pb: true, records: [{ code: FAMILY.code, name: 'Family' }] }
      : { type: 'mini', pb: false, records: [] },
  );
  m.boardDay.mockImplementation(async (pid) =>
    dayBoard({
      ranked: [
        {
          rank: 1,
          nick: pid === PID ? 'Alec' : 'Ma',
          me: true,
          outcome: 'solved',
          secs: 61,
          mistakes: null,
          streak: 1,
        },
      ],
    }),
  );
  m.boardRecords.mockImplementation(async (pid) =>
    recordsData(today, { crown: [pid === PID ? 'Alec' : 'Ma'] }),
  );
});

afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN a player in Family who adopts another player in the same league', () => {
  describe('WHEN a finished puzzle is reopened', () => {
    it('THEN its sheet asks again as the new player: no trophy that was the old player’s', async () => {
      const client = testQueryClient();
      setBoard({ pid: PID, leagues: [FAMILY], cur: FAMILY.code });
      let tags: string[] = [];
      const onTag = (t: string) => void tags.push(t);
      const sheet = await renderWithProviders(
        <>
          <LeagueResults />
          <BoardLink path={PATH} type="mini" date={today} onTag={onTag} />
        </>,
        client,
      );
      await waitFor(() =>
        expect(screen.getByTestId('board-moment')).toHaveTextContent('🏆 League record in Family!'),
      );
      expect(tags).toEqual(['🏆']);
      await sheet.unmount();

      // "Already in this league?": the install now plays as OTHER.
      setBoard({ pid: OTHER, leagues: [FAMILY], cur: FAMILY.code });
      tags = [];
      await renderWithProviders(
        <>
          <LeagueResults />
          <BoardLink path={PATH} type="mini" date={today} onTag={onTag} />
        </>,
        client,
      );
      await waitFor(() => expect(m.boardMoment).toHaveBeenCalledWith(OTHER, PATH));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(screen.queryByTestId('board-moment')).toBeNull();
      expect(tags).toEqual([]);
    });
  });

  describe('WHEN the board and records are open as the identity changes', () => {
    it('THEN they are fetched for the new player, and the old player’s answers are dropped', async () => {
      const client = testQueryClient();
      setBoard({ pid: PID, leagues: [FAMILY], cur: FAMILY.code });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryProvider client={client}>
          <LeagueResults />
          {children}
        </QueryProvider>
      );
      const { result } = await renderHook(
        () => ({
          day: useBoardData(FAMILY.code, 'mini', earlier),
          rec: useBoardRecords(FAMILY.code),
        }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.day.data).toBeDefined());
      await waitFor(() => expect(result.current.rec.data).toBeDefined());
      expect((result.current.day.data as ReturnType<typeof dayBoard>).ranked[0]!.nick).toBe('Alec');
      expect(result.current.rec.data!.crown).toEqual(['Alec']);

      await act(async () => setBoard({ pid: OTHER, leagues: [FAMILY], cur: FAMILY.code }));
      await waitFor(() =>
        expect((result.current.day.data as ReturnType<typeof dayBoard>).ranked[0]!.nick).toBe('Ma'),
      );
      await waitFor(() => expect(result.current.rec.data!.crown).toEqual(['Ma']));
      expect(m.boardDay).toHaveBeenLastCalledWith(OTHER, FAMILY.code, 'mini', earlier);
      const keys = client
        .getQueryCache()
        .getAll()
        .map((q) => q.queryKey);
      expect(keys.some((k) => k.includes(PID))).toBe(false);
      expect(keys.some((k) => k.includes(OTHER))).toBe(true);
    });
  });
});

/** A promise the test settles by hand, standing in for a slow server answer. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const WORK = { code: 'WXYZ6789', name: 'Work', nick: 'Ma', owner: false, members: 5, pin: false };

describe('GIVEN a league answer for one player still on its way when the install adopts another', () => {
  describe('WHEN player A’s board_mine resolves after the install has adopted player B', () => {
    it('THEN the stored leagues and current league stay B’s', async () => {
      const client = testQueryClient();
      setBoard({ pid: PID, leagues: [FAMILY], cur: FAMILY.code });
      const slow = deferred<ReturnType<typeof mineRow>[]>();
      m.boardMine.mockImplementation((pid) =>
        pid === PID ? slow.promise : Promise.resolve([mineRow(WORK)]),
      );
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryProvider client={client}>{children}</QueryProvider>
      );
      const { result } = await renderHook(() => useMine(true), { wrapper });
      await waitFor(() => expect(m.boardMine).toHaveBeenCalledWith(PID));

      await act(async () => setBoard({ pid: OTHER, leagues: [WORK], cur: WORK.code }));
      await waitFor(() => expect(m.boardMine).toHaveBeenCalledWith(OTHER));
      await waitFor(() => expect(result.current.data).toBeDefined());

      await act(async () => {
        slow.resolve([mineRow(FAMILY)]);
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(board().pid).toBe(OTHER);
      expect(board().leagues!.map((l) => l.code)).toEqual([WORK.code]);
      expect(board().cur).toBe(WORK.code);
    });
  });

  describe('WHEN a join started as player A resolves after the install has adopted player B', () => {
    it('THEN A’s league is not made B’s current league, nor A’s leagues saved for B', async () => {
      const client = testQueryClient();
      setBoard({ pid: PID, leagues: [], cur: '' });
      const join = deferred<{ code: string; name: string }>();
      m.boardJoin.mockReturnValue(join.promise as ReturnType<typeof api.boardJoin>);
      m.boardMine.mockImplementation(async (pid) =>
        pid === PID ? [mineRow(FAMILY)] : [mineRow(WORK)],
      );
      m.boardPinSet.mockResolvedValue(true as never);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryProvider client={client}>{children}</QueryProvider>
      );
      const { result } = await renderHook(() => useJoinLeague(), { wrapper });
      let done!: Promise<unknown>;
      await act(async () => {
        done = result.current.mutateAsync({ code: FAMILY.code, nick: 'Alec', pin: '1234' });
      });
      await waitFor(() => expect(m.boardJoin).toHaveBeenCalledWith(PID, FAMILY.code, 'Alec'));

      setBoard({ pid: OTHER, leagues: [WORK], cur: WORK.code });
      await act(async () => {
        join.resolve({ code: FAMILY.code, name: 'Family' });
        await done;
      });
      expect(board().pid).toBe(OTHER);
      expect(board().cur).toBe(WORK.code);
      expect(board().leagues!.map((l) => l.code)).toEqual([WORK.code]);
      // The PIN is set for the player who joined, never for the one adopted since.
      expect(m.boardPinSet).not.toHaveBeenCalledWith(OTHER, '1234');
    });
  });
});
