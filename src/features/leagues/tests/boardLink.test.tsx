import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { announceFinish } from '@/shared/results';
import { renderWithProviders } from '@/shared/testing';

import * as api from '../api/board';
import { BoardLink, LEAD_ICON, LINK_SLOP } from '../components/BoardLink';
import { LeagueResults } from '../components/LeagueResults';
import { addDays, momentLine } from '../hooks/boardText';
import { myRank, ordinal, placeLine } from '../hooks/rankText';
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

async function slot(
  path: string,
  p: { solved?: boolean; lead?: boolean; celebrate?: boolean } = {},
) {
  return renderWithProviders(
    <BoardLink path={path} type="mini" date={today} onTag={onTag} {...p} />,
  );
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
/** The line's text and its accessible name (design B3: "… · See board ›"). */
const SEE = 'Family board today. See board';
const name = (text: string) => `${text}. See board`;

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
  it('THEN the place is today’s, rank only; no rank (failed, revealed, no answer) is none', () => {
    expect(placeLine(myRank(day(1, 6))!, 'Noodlers')).toBe('1st in Noodlers today');
    expect(placeLine(myRank(day(3, 6))!, 'Noodlers')).toBe('3rd in Noodlers today');
    expect(myRank(day(null, 6))).toBeNull();
    expect(myRank(null)).toBeNull();
  });
});

describe('GIVEN a finished puzzle’s sheet (design B3)', () => {
  describe('WHEN the player is in no league', () => {
    it('THEN there is no line at all, and nothing is asked', async () => {
      await slot(pathOn(today));
      expect(screen.queryByTestId('board-slot')).toBeNull();
      expect(screen.queryByText(/Start a league/)).toBeNull();
      expect(m.boardMoment).not.toHaveBeenCalled();
      expect(m.boardDay).not.toHaveBeenCalled();
      expect(tags).toEqual([]);
    });
  });

  describe('WHEN the player is in leagues and has a rank today in the one last viewed', () => {
    it('THEN the line says “3rd in Work today · See board ›” once the board answers', async () => {
      setBoard({ pid: PID, leagues: [FAMILY, WORK], cur: WORK.code });
      let answer!: (d: DayBoard) => void;
      m.boardDay.mockReturnValue(new Promise<DayBoard>((r) => (answer = r)));
      await slot(pathOn(today));
      expect(screen.getByRole('link', { name: name('Work board today') })).toBeOnTheScreen();
      await waitFor(() => expect(m.boardDay).toHaveBeenCalled());
      await act(async () => answer(day(3, 6)));
      await waitFor(() =>
        expect(screen.getByRole('link', { name: name('3rd in Work today') })).toBeOnTheScreen(),
      );
      expect(screen.getByTestId('board-line')).toHaveTextContent('3rd in Work today · See board ›');
      expect(m.boardDay).toHaveBeenCalledWith(PID, WORK.code, 'mini', today);
      expect(screen.queryByText(/Alec|P1/)).toBeNull();
    });
    it('THEN first place reads “1st in Family today”, and a tap opens that league’s board', async () => {
      setBoard({ pid: PID, leagues: [FAMILY, WORK] });
      m.boardDay.mockResolvedValue(day(1, 3));
      await slot(pathOn(today));
      const line = await screen.findByRole('link', { name: name('1st in Family today') });
      // Alec, 8 Nov 2026: outside the reward block the disc shows small, inside the line.
      const disc = screen.getByTestId('board-medal', { includeHiddenElements: true });
      expect(StyleSheet.flatten(disc.props.style).width).toBe(20);
      await fireEvent.press(line);
      expect(board().cur).toBe(FAMILY.code);
      expect(router.dismissTo).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { p: 'mini', d: today, n: expect.any(String) },
      });
    });
    it('THEN in the reward block, a podium place leads with its disc at the reward icon’s size', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      m.boardDay.mockResolvedValue(day(2, 3));
      await slot(pathOn(today), { lead: true });
      await screen.findByRole('link', { name: name('2nd in Family today') });
      const disc = screen.getByTestId('board-medal', { includeHiddenElements: true });
      expect(StyleSheet.flatten(disc.props.style).width).toBe(30);
    });
    it('THEN with no rank (failed, revealed) it says “Not placed”; with no answer, the board', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      m.boardDay.mockResolvedValue(day(null, 3));
      const r = await slot(pathOn(today));
      await waitFor(() =>
        expect(
          screen.getByRole('link', { name: name('Not placed in Family today') }),
        ).toBeOnTheScreen(),
      );
      await r.unmount();
      m.boardDay.mockRejectedValue(new Error('offline'));
      await slot(pathOn(today));
      await act(async () => {
        await new Promise((res) => setTimeout(res, 20));
      });
      expect(screen.getByRole('link', { name: SEE })).toBeOnTheScreen();
    });
  });

  describe('WHEN the round was lost', () => {
    it('THEN the quiet line says “Not placed in Family today” without asking for a rank', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await slot(pathOn(today), { solved: false });
      expect(
        screen.getByRole('link', { name: name('Not placed in Family today') }),
      ).toBeOnTheScreen();
      expect(m.boardDay).not.toHaveBeenCalled();
    });
  });

  describe('WHEN the puzzle is from an earlier day', () => {
    it('THEN the line names that day’s board, and a tap opens it', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      m.boardDay.mockResolvedValue(day(1, 3));
      await slot(pathOn('2026-11-05'));
      const line = screen.getByRole('link', { name: name('Family board for Thu 5 Nov') });
      expect(m.boardDay).not.toHaveBeenCalled();
      await fireEvent.press(line);
      expect(router.dismissTo).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { p: 'mini', d: '2026-11-05', n: expect.any(String) },
      });
    });
  });

  describe('WHEN the player is in a league and the result is a league record today', () => {
    it('THEN the line says so instead of the place, and the share line gets 🏆', async () => {
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
      await waitFor(() =>
        expect(
          screen.getByRole('link', { name: name('New league record in Family, Work') }),
        ).toBeOnTheScreen(),
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
        expect(
          screen.getByRole('link', { name: name('League record in Family') }),
        ).toBeOnTheScreen(),
      );
      expect(m.boardSubmit).not.toHaveBeenCalled();
      expect(tags).toEqual(['🏆']);
    });
  });

  describe('WHEN the server calls the result a personal best but no record', () => {
    it('THEN the line keeps to the league (the sheet’s own reward line has the best), and the share line is left alone', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      m.boardMoment.mockResolvedValue({ type: 'mini', pb: true, records: [] });
      m.boardDay.mockResolvedValue(day(2, 3));
      await slot(pathOn(today));
      await screen.findByRole('link', { name: name('2nd in Family today') });
      expect(screen.queryByText(/personal best/)).toBeNull();
      expect(tags).toEqual([]);
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
      expect(screen.getByRole('link', { name: /^Not placed in Family today/ })).toBeOnTheScreen();
      expect(screen.queryByText(/record/)).toBeNull();
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
      await waitFor(() => expect(m.boardMoment).toHaveBeenCalled());
    });
  });

  describe('WHEN the league line is tapped', () => {
    it('THEN the Leagues tab opens on that puzzle and its day', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await slot(pathOn(earlier));
      await fireEvent.press(screen.getByRole('link', { name: /See board$/ }));
      expect(router.dismissTo).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { p: 'mini', d: earlier, n: expect.any(String) },
      });
    });
    it('THEN a second tap asks again with a fresh n, so Leagues opens that board again', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await slot(pathOn(earlier));
      await fireEvent.press(screen.getByRole('link', { name: /See board$/ }));
      await fireEvent.press(screen.getByRole('link', { name: /See board$/ }));
      const [a, b] = jest
        .mocked(router.dismissTo)
        .mock.calls.map((c) => (c[0] as unknown as { params: { n: string } }).params.n);
      expect(a).not.toBe(b);
    });
    it('THEN a page whose name carries no date opens that puzzle on today', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await slot('reports/digi-crossword-mini-0002.html');
      await fireEvent.press(screen.getByRole('link', { name: /See board$/ }));
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

describe('GIVEN the league line under the reward (Alec, 8 Nov 2026)', () => {
  it('THEN it is only as tall as its words, with hitSlop keeping a 44 pt tap target', async () => {
    setBoard({ pid: PID, leagues: [FAMILY] });
    m.boardDay.mockResolvedValue(day(4, 6));
    await slot(pathOn(today));
    const link = await screen.findByRole('link', { name: name('4th in Family today') });
    expect(StyleSheet.flatten(link.props.style).minHeight).toBeUndefined();
    expect(link.props.hitSlop).toEqual(LINK_SLOP);
    expect(LINK_SLOP.top + LINK_SLOP.bottom + 20).toBeGreaterThanOrEqual(44);
    expect(screen.queryByTestId('board-medal', { includeHiddenElements: true })).toBeNull();
  });
  it('THEN in the reward block without a podium place, a blank the disc’s width keeps the words lined up', async () => {
    setBoard({ pid: PID, leagues: [FAMILY] });
    m.boardDay.mockResolvedValue(day(4, 6));
    await slot(pathOn(today), { lead: true });
    await screen.findByRole('link', { name: name('4th in Family today') });
    const blank = screen.getByTestId('board-medal-blank', { includeHiddenElements: true });
    expect(StyleSheet.flatten(blank.props.style).width).toBe(LEAD_ICON);
  });
});
