import { londonDay } from '@noodle/core';
import { act, waitFor } from '@testing-library/react-native';

import { announceFinish } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { renderWithProviders } from '@/shared/testing';

import * as api from '../api/board';
import { LeagueResults } from '../components/LeagueResults';
import { runBackfill } from '../hooks/useResults';
import { board, clearStore, FAMILY, OTHER, PID, setBoard } from './helpers';

jest.mock('../api/board');
const m = jest.mocked(api);
const today = londonDay();
const path = `reports/${today}-crossword-mini-0105.html`;

beforeEach(() => {
  clearStore();
  jest.clearAllMocks();
  m.boardSubmit.mockResolvedValue(true);
});

describe('GIVEN the app is running with results listened for', () => {
  describe('WHEN a puzzle finishes and the player is in a league', () => {
    it('THEN its result goes to board_submit exactly as the site maps it', async () => {
      setBoard({ pid: PID, leagues: [FAMILY], cur: FAMILY.code });
      await renderWithProviders(<LeagueResults />);
      await act(async () =>
        announceFinish({
          path,
          type: 'mini',
          detail: {
            type: 'crossword-mini',
            tv: 3,
            outcome: 'solved',
            secs: 87,
            checks: 0,
            reveals: 0,
            hints: 0,
          },
        }),
      );
      await waitFor(() => expect(m.boardSubmit).toHaveBeenCalledTimes(1));
      expect(m.boardSubmit.mock.calls[0]![0]).toEqual({
        p_player: PID,
        p_path: path,
        p_outcome: 'solved',
        p_secs: 87,
        p_score: null,
        p_mistakes: null,
      });
    });

    it('THEN a result for another type than its page’s is not sent', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      await renderWithProviders(<LeagueResults />);
      await act(async () =>
        announceFinish({ path, type: 'mini', detail: { type: 'word-link', outcome: 'solved' } }),
      );
      expect(m.boardSubmit).not.toHaveBeenCalled();
    });

    it('THEN a failed send is let go quietly', async () => {
      setBoard({ pid: PID, leagues: [FAMILY] });
      m.boardSubmit.mockRejectedValue(new Error('offline'));
      await renderWithProviders(<LeagueResults />);
      await act(async () =>
        announceFinish({
          path,
          type: 'mini',
          detail: { type: 'crossword-mini', outcome: 'solved', secs: 9 },
        }),
      );
      await waitFor(() => expect(m.boardSubmit).toHaveBeenCalled());
    });
  });

  describe('WHEN a puzzle finishes and the player is in no league', () => {
    it('THEN nothing is sent, and no board id is made', async () => {
      await renderWithProviders(<LeagueResults />);
      await act(async () =>
        announceFinish({
          path,
          type: 'mini',
          detail: { type: 'crossword-mini', outcome: 'solved', secs: 9 },
        }),
      );
      expect(m.boardSubmit).not.toHaveBeenCalled();
      expect(board().pid).toBeUndefined();
    });
  });
});

describe('GIVEN a history copy with tracker ids from a personal link', () => {
  it('THEN each id is read in turn, the saved rows go with the first, and the fill records both', async () => {
    setBoard({ pid: PID, leagues: [FAMILY], fill: { n: 0, aids: [] } });
    const a = '00000000-0000-4000-8000-0000000000a1';
    const b = '00000000-0000-4000-8000-0000000000b2';
    appStorage.setItem('digi.aid', a);
    appStorage.setItem('digi.aid.prev', JSON.stringify([b]));
    m.boardBackfill.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    const rows = [{ outcome: 'solved', secs: 9, path }];
    await expect(runBackfill({ rows, aids: [a, b], n: 1, done: [] })).resolves.toBe(5);
    expect(m.boardBackfill.mock.calls).toEqual([
      [PID, a, rows],
      [PID, b, []],
    ]);
    expect(board().fill).toEqual({ n: 1, aids: [a, b] });
  });
});

describe('GIVEN a backfill running for one player', () => {
  describe('WHEN the install adopts another player before it finishes', () => {
    it('THEN the old player’s fill is not written onto the new player', async () => {
      setBoard({ pid: PID, leagues: [FAMILY], fill: { n: 0, aids: [] } });
      const a = '00000000-0000-4000-8000-0000000000a1';
      let answer!: (n: number) => void;
      m.boardBackfill.mockReturnValueOnce(
        new Promise((r) => (answer = r)) as ReturnType<typeof api.boardBackfill>,
      );
      const rows = [{ outcome: 'solved', secs: 9, path }];
      const run = runBackfill({ rows, aids: [a], n: 1, done: [] });
      await waitFor(() => expect(m.boardBackfill).toHaveBeenCalledWith(PID, a, rows));

      setBoard({ pid: OTHER, leagues: [FAMILY], fill: { n: 4, aids: [] } });
      answer(2);
      await expect(run).resolves.toBe(2);
      expect(board().pid).toBe(OTHER);
      expect(board().fill).toEqual({ n: 4, aids: [] });
    });
  });
});
