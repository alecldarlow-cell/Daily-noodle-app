import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { announceFinish } from '@/shared/results';
import { renderWithProviders } from '@/shared/testing';

import * as api from '../api/board';
import { BoardLink } from '../components/BoardLink';
import { LeagueResults } from '../components/LeagueResults';
import { addDays, momentLine } from '../hooks/boardText';
import { clearSubmissions } from '../hooks/submissions';
import { clearStore, FAMILY, PID, setBoard } from './helpers';

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
});

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

describe('GIVEN a finished puzzle’s sheet', () => {
  describe('WHEN the player is in no league', () => {
    it('THEN the slot shows nothing and asks nothing', async () => {
      await slot(pathOn(today));
      expect(screen.queryByText('🏆 See today’s board')).toBeNull();
      expect(screen.queryByTestId('board-slot')).toBeNull();
      expect(m.boardMoment).not.toHaveBeenCalled();
      expect(tags).toEqual([]);
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
      expect(screen.getByText('🏆 See today’s board')).toBeOnTheScreen();
      await waitFor(() =>
        expect(screen.getByTestId('board-moment')).toHaveTextContent(
          '🏆 New league record in Family, Work!',
        ),
      );
      expect(m.boardMoment).toHaveBeenCalledWith(PID, pathOn(today));
      expect(tags).toEqual(['🏆']);
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
      expect(screen.getByText('🏆 See today’s board')).toBeOnTheScreen();
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

  describe('WHEN “See today’s board” is tapped', () => {
    it('THEN the Leagues tab opens on that puzzle and its day', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await slot(pathOn(earlier));
      await fireEvent.press(screen.getByRole('link', { name: '🏆 See today’s board' }));
      expect(router.dismissTo).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { p: 'mini', d: earlier, n: expect.any(String) },
      });
    });
    it('THEN a second tap asks again with a fresh n, so Leagues opens that board again', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await slot(pathOn(earlier));
      await fireEvent.press(screen.getByRole('link', { name: '🏆 See today’s board' }));
      await fireEvent.press(screen.getByRole('link', { name: '🏆 See today’s board' }));
      const [a, b] = jest
        .mocked(router.dismissTo)
        .mock.calls.map((c) => (c[0] as unknown as { params: { n: string } }).params.n);
      expect(a).not.toBe(b);
    });
    it('THEN a page whose name carries no date opens that puzzle on today', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await slot('reports/digi-crossword-mini-0002.html');
      await fireEvent.press(screen.getByRole('link', { name: '🏆 See today’s board' }));
      expect(router.dismissTo).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { p: 'mini', n: expect.any(String) },
      });
    });
  });

  describe('WHEN the page isn’t a board puzzle', () => {
    it('THEN there is no link, as on the site', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await slot('reports/DP-SWEEP-2026-07-17.html');
      expect(screen.queryByTestId('board-slot')).toBeNull();
    });
  });
});
