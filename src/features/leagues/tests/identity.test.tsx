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
import { useBoardData, useBoardRecords } from '../hooks/useLeagues';
import { clearStore, dayBoard, FAMILY, OTHER, PID, recordsData, setBoard } from './helpers';

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
