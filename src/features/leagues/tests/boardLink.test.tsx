import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { announceFinish } from '@/shared/results';
import { renderWithProviders } from '@/shared/testing';

import * as api from '../api/board';
import { BoardLink } from '../components/BoardLink';
import { LeagueResults } from '../components/LeagueResults';
import { addDays, momentLine } from '../hooks/boardText';
import { ordinal, rankLine } from '../hooks/rankText';
import type { DayBoard } from '../types';
import { clearSubmissions } from '../hooks/submissions';
import { board, clearStore, FAMILY, PID, setBoard } from './helpers';

jest.mock('../api/board');
jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn(), navigate: jest.fn() } }));
const m = jest.mocked(api);

const today = londonDay();
const earlier = addDays(today, -3);
const pathOn = (d: string) => `reports/${d}-crossword-mini-0105.html`;
const WORK = { code: 'WXYZ2345', name: 'Work', nick: 'A', owner: false };

let tags: string[] = [];
const onTag = (t: string) => {
  tags.push(t);
};

async function slot(path: string) {
  return renderWithProviders(<BoardLink path={path} type="mini" date={today} onTag={onTag} />);
}

beforeEach(() => {
  clearStore();
  clearSubmissions();
  jest.clearAllMocks();
  tags = [];
  m.boardSubmit.mockResolvedValue(true);
  m.boardMoment.mockResolvedValue({ type: 'mini', pb: false, records: [] });
  m.boardDay.mockResolvedValue(day(null, 3));
});

/** A board_day answer: this player at `rank` among `n` members (null: not ranked). */
function day(rank: number | null, n: number): DayBoard {
  const players = Array.from({ length: n }, (_, i) => (i === 0 ? 'Alec' : `P${i}`));
  return {
    ranked:
      rank === null
        ? [{ rank: 1, nick: 'P1', me: false, outcome: 'solved', secs: 60, mistakes: 0, streak: 1 }]
        : [{ rank, nick: 'Alec', me: true, outcome: 'solved', secs: 60, mistakes: 0, streak: 1 }],
    unranked:
      rank === null
        ? [{ nick: 'Alec', me: true, outcome: 'failed', secs: 60, mistakes: 4, streak: 0 }]
        : [],
    not_yet: [],
    players,
    members: n,
    first: null,
  };
}
const SEE = 'See today’s board in Family';

afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN the record line’s wording (dn-board.js showMoment)', () => {
  it('THEN a league record names the leagues; “New” only on the puzzle’s own day', () => {
    const recs = [{ name: 'Family' }, { name: 'Work' }];
    expect(momentLine({ pb: true, records: recs }, 'Mini', true)).toEqual({
      text: '🏆 New league record in Family, Work!',
      record: true,
    });
    expect(momentLine({ pb: false, records: recs }, 'Mini', false)?.text).toBe(
      '🏆 League record in Family, Work!',
    );
  });
  it('THEN otherwise a personal best names the puzzle type', () => {
    expect(momentLine({ pb: true, records: [] }, 'Doku', true)).toEqual({
      text: '⭐ New personal best at Doku!',
      record: false,
    });
    expect(momentLine({ pb: true, records: null }, 'Doku', false)?.text).toBe(
      '⭐ Your personal best at Doku!',
    );
  });
  it('THEN neither, or no answer, says nothing', () => {
    expect(momentLine({ pb: false, records: [] }, 'Mini', true)).toBeNull();
    expect(momentLine(null, 'Mini', true)).toBeNull();
  });
});

describe('GIVEN the league line’s wording (dn-board.js rankText, AF-019)', () => {
  it('THEN ordinals read as English does', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
      '111th',
    ]);
  });
  it('THEN first says only the place; lower says “of” the members; no rank says nothing', () => {
    expect(rankLine(day(1, 6), 'Noodlers')).toBe('Currently 1st in Noodlers');
    expect(rankLine(day(3, 6), 'Noodlers')).toBe('Currently 3rd of 6 in Noodlers');
    expect(rankLine(day(2, 1), 'Noodlers')).toBe('Currently 2nd in Noodlers');
    expect(rankLine(day(null, 6), 'Noodlers')).toBeNull();
    expect(rankLine(null, 'Noodlers')).toBeNull();
  });
});

describe('GIVEN a finished puzzle’s sheet', () => {
  describe('WHEN the player is in no league (AF-022)', () => {
    it('THEN the line invites them to start one, with the trophy and no emoji, and asks nothing', async () => {
      await slot(pathOn(today));
      const line = screen.getByRole('link', { name: 'Start a league with friends' });
      expect(line).toHaveTextContent('Start a league with friends');
      expect(screen.getByTestId('board-trophy')).toBeOnTheScreen();
      expect(screen.queryByText(/🏆/)).toBeNull();
      expect(m.boardMoment).not.toHaveBeenCalled();
      expect(m.boardDay).not.toHaveBeenCalled();
      expect(tags).toEqual([]);
    });
    it('THEN a tap opens Leagues on the start form', async () => {
      await slot(pathOn(today));
      await fireEvent.press(screen.getByRole('link', { name: 'Start a league with friends' }));
      expect(router.dismissTo).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { go: 'start', n: expect.any(String) },
      });
    });
  });

  describe('WHEN the player is in leagues and has a rank in the one last viewed', () => {
    it('THEN the line says “Currently 3rd of 6 in Work” once the board answers', async () => {
      setBoard({ pid: PID, leagues: [FAMILY, WORK], cur: WORK.code });
      let answer!: (d: DayBoard) => void;
      m.boardDay.mockReturnValue(new Promise<DayBoard>((r) => (answer = r)));
      await slot(pathOn(today));
      expect(screen.getByRole('link', { name: 'See today’s board in Work' })).toBeOnTheScreen();
      await waitFor(() => expect(m.boardDay).toHaveBeenCalled());
      await act(async () => answer(day(3, 6)));
      await waitFor(() =>
        expect(screen.getByRole('link', { name: 'Currently 3rd of 6 in Work' })).toBeOnTheScreen(),
      );
      expect(m.boardDay).toHaveBeenCalledWith(PID, WORK.code, 'mini', today);
      expect(screen.queryByText(/Alec|P1/)).toBeNull();
    });
    it('THEN first place reads “Currently 1st in Family”, and a tap opens that league’s board', async () => {
      setBoard({ pid: PID, leagues: [FAMILY, WORK] });
      m.boardDay.mockResolvedValue(day(1, 3));
      await slot(pathOn(earlier));
      const line = await screen.findByRole('link', { name: 'Currently 1st in Family' });
      await fireEvent.press(line);
      expect(board().cur).toBe(FAMILY.code);
      expect(router.dismissTo).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { p: 'mini', d: earlier, n: expect.any(String) },
      });
    });
    it('THEN with no rank (failed, revealed) or no answer, it stays “See today’s board in …”', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      m.boardDay.mockResolvedValue(day(null, 3));
      const r = await slot(pathOn(today));
      await waitFor(() => expect(m.boardDay).toHaveBeenCalled());
      await act(async () => {
        await new Promise((res) => setTimeout(res, 20));
      });
      expect(screen.getByRole('link', { name: SEE })).toBeOnTheScreen();
      await r.unmount();
      m.boardDay.mockRejectedValue(new Error('offline'));
      await slot(pathOn(today));
      await act(async () => {
        await new Promise((res) => setTimeout(res, 20));
      });
      expect(screen.getByRole('link', { name: SEE })).toBeOnTheScreen();
    });
  });

  describe('WHEN the player is in a league and the result is a league record today', () => {
    it('THEN the line says so above the link, and the share line gets 🏆', async () => {
      setBoard({ pid: PID, leagues: [FAMILY, WORK], cur: FAMILY.code });
      m.boardMoment.mockResolvedValue({
        type: 'mini',
        pb: true,
        records: [
          { code: FAMILY.code, name: 'Family' },
          { code: WORK.code, name: 'Work' },
        ],
      });
      await slot(pathOn(today));
      expect(screen.getByRole('link', { name: SEE })).toBeOnTheScreen();
      await waitFor(() =>
        expect(screen.getByTestId('board-moment')).toHaveTextContent(
          '🏆 New league record in Family, Work!',
        ),
      );
      expect(m.boardMoment).toHaveBeenCalledWith(PID, pathOn(today));
      expect(tags).toEqual(['🏆']);
    });
  });

  describe('WHEN the sheet held a league record and the record no longer stands (code review)', () => {
    const recordToday = () =>
      m.boardMoment.mockResolvedValue({
        type: 'mini',
        pb: true,
        records: [{ code: FAMILY.code, name: 'Family' }],
      });

    it('THEN a record beaten since takes 🏆 off the share line when it is asked again', async () => {
      setBoard({ pid: PID, leagues: [FAMILY], cur: FAMILY.code });
      recordToday();
      const { client } = await slot(pathOn(today));
      await waitFor(() => expect(tags).toEqual(['🏆']));
      m.boardMoment.mockResolvedValue({ type: 'mini', pb: true, records: [] });
      await act(async () => {
        await client.invalidateQueries();
      });
      await waitFor(() => expect(tags[tags.length - 1]).toBe(''));
      expect(screen.queryByText(/league record/)).toBeNull();
    });

    it('THEN leaving the league takes 🏆 off too', async () => {
      setBoard({ pid: PID, leagues: [FAMILY], cur: FAMILY.code });
      recordToday();
      await slot(pathOn(today));
      await waitFor(() => expect(tags).toEqual(['🏆']));
      await act(async () => setBoard({ pid: PID, leagues: [], cur: '' }));
      await waitFor(() => expect(tags).toEqual(['🏆', '']));
    });
  });

  describe('WHEN a reopened puzzle from an earlier day holds a league record', () => {
    it('THEN it reads “League record”, asked straight away (nothing was sent)', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      m.boardMoment.mockResolvedValue({
        type: 'mini',
        pb: false,
        records: [{ code: FAMILY.code, name: 'Family' }],
      });
      await slot(pathOn(earlier));
      await waitFor(() =>
        expect(screen.getByTestId('board-moment')).toHaveTextContent('🏆 League record in Family!'),
      );
      expect(m.boardSubmit).not.toHaveBeenCalled();
      expect(tags).toEqual(['🏆']);
    });
  });

  describe('WHEN the result is a personal best but no record', () => {
    it('THEN the line names the type, and the share line is left alone', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      m.boardMoment.mockResolvedValue({ type: 'mini', pb: true, records: [] });
      await slot(pathOn(today));
      await waitFor(() =>
        expect(screen.getByTestId('board-moment')).toHaveTextContent(
          '⭐ New personal best at Mini!',
        ),
      );
      expect(tags).toEqual([]);
    });
    it('THEN on an earlier day it reads “Your personal best”', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      m.boardMoment.mockResolvedValue({ type: 'mini', pb: true, records: [] });
      await slot(pathOn(earlier));
      await waitFor(() =>
        expect(screen.getByTestId('board-moment')).toHaveTextContent(
          '⭐ Your personal best at Mini!',
        ),
      );
    });
  });

  describe('WHEN it is neither, or not a completed result, or the call fails', () => {
    it.each([
      ['neither', () => m.boardMoment.mockResolvedValue({ type: 'mini', pb: false, records: [] })],
      ['not completed', () => m.boardMoment.mockResolvedValue(null)],
      ['a failure', () => m.boardMoment.mockRejectedValue(new Error('offline'))],
    ])('THEN for %s only the link shows', async (_name, arrange) => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      arrange();
      await slot(pathOn(today));
      await waitFor(() => expect(m.boardMoment).toHaveBeenCalled());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(
        screen.getByRole('link', { name: /^(See today’s board|Currently) / }),
      ).toBeOnTheScreen();
      expect(screen.queryByTestId('board-moment')).toBeNull();
      expect(tags).toEqual([]);
    });
  });

  describe('WHEN the puzzle has just finished and its result is still on its way', () => {
    it('THEN board_moment waits for board_submit to settle', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      let land!: (v: boolean) => void;
      m.boardSubmit.mockReturnValue(new Promise<boolean>((r) => (land = r)));
      m.boardMoment.mockResolvedValue({ type: 'mini', pb: true, records: [] });
      await renderWithProviders(
        <>
          <LeagueResults />
          <BoardLink path={pathOn(today)} type="mini" date={today} onTag={onTag} />
        </>,
      );
      // The sheet opened before the finish was announced (the site's late-submit case).
      await waitFor(() => expect(m.boardMoment).toHaveBeenCalledTimes(1));
      await act(async () =>
        announceFinish({
          path: pathOn(today),
          type: 'mini',
          detail: { type: 'crossword-mini', outcome: 'solved', secs: 50 },
        }),
      );
      await waitFor(() => expect(m.boardSubmit).toHaveBeenCalledTimes(1));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(m.boardMoment).toHaveBeenCalledTimes(1);
      await act(async () => land(true));
      await waitFor(() => expect(m.boardMoment).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(screen.getByTestId('board-moment')).toHaveTextContent(
          '⭐ New personal best at Mini!',
        ),
      );
    });

    it('THEN a send that fails still asks, as the site does', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await renderWithProviders(<LeagueResults />);
      m.boardSubmit.mockRejectedValue(new Error('offline'));
      m.boardMoment.mockResolvedValue({ type: 'mini', pb: true, records: [] });
      await act(async () =>
        announceFinish({
          path: pathOn(today),
          type: 'mini',
          detail: { type: 'crossword-mini', outcome: 'solved', secs: 50 },
        }),
      );
      await slot(pathOn(today));
      await waitFor(() => expect(screen.getByTestId('board-moment')).toBeOnTheScreen());
    });
  });

  describe('WHEN the league line is tapped', () => {
    it('THEN the Leagues tab opens on that puzzle and its day', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await slot(pathOn(earlier));
      await fireEvent.press(screen.getByRole('link', { name: SEE }));
      expect(router.dismissTo).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { p: 'mini', d: earlier, n: expect.any(String) },
      });
    });
    it('THEN a second tap asks again with a fresh n, so Leagues opens that board again', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await slot(pathOn(earlier));
      await fireEvent.press(screen.getByRole('link', { name: SEE }));
      await fireEvent.press(screen.getByRole('link', { name: SEE }));
      const [a, b] = jest
        .mocked(router.dismissTo)
        .mock.calls.map((c) => (c[0] as unknown as { params: { n: string } }).params.n);
      expect(a).not.toBe(b);
    });
    it('THEN a page whose name carries no date opens that puzzle on today', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await slot('reports/digi-crossword-mini-0002.html');
      await fireEvent.press(screen.getByRole('link', { name: SEE }));
      expect(router.dismissTo).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { p: 'mini', n: expect.any(String) },
      });
    });
  });

  describe('WHEN the page isn’t a board puzzle', () => {
    it('THEN there is no line, as on the site, member or not', async () => {
      const r = await slot('reports/DP-SWEEP-2026-07-17.html');
      expect(screen.queryByTestId('board-slot')).toBeNull();
      await r.unmount();
      setBoard({ pid: PID, leagues: [FAMILY] });
      await slot('reports/DP-SWEEP-2026-07-17.html');
      expect(screen.queryByTestId('board-slot')).toBeNull();
    });
  });
});
