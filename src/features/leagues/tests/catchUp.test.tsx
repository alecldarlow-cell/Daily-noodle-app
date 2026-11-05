import { act, render, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { testQueryClient } from '@/shared/testing';
import { appStorage } from '@/shared/storage';

import { boardBackfill } from '../api/board';
import { fetchPuzzleCards } from '../api/feed';
import { CATCH_UP_EVERY_MS, recentOnly, useCatchUp } from '../hooks/useResults';

jest.mock('../api/board');
jest.mock('../api/feed');

const NOW = Date.parse('2026-11-05T12:00:00Z');
const PATH = 'reports/2026-11-04-crossword-mini-0116.html';
const ID = 'DP·MINI·0116';

function Host({ now }: { now: () => number }) {
  useCatchUp(now);
  return null;
}
const inLeague = () =>
  appStorage.setItem(
    'noodle-board-v1',
    JSON.stringify({
      pid: 'p1',
      leagues: [{ code: 'ABCDEFGH', name: 'L', nick: 'Al', owner: false }],
    }),
  );

describe('GIVEN a result that could not be sent when its puzzle ended', () => {
  let active: (s: string) => void = () => {};
  beforeEach(async () => {
    await appStorage.hydrate();
    jest.mocked(boardBackfill).mockReset().mockResolvedValue(1);
    jest
      .mocked(fetchPuzzleCards)
      .mockReset()
      .mockResolvedValue([{ id: ID, path: PATH, type: 'mini', date: '2026-11-04' } as never]);
    appStorage.setItem('digi-mini-v1', JSON.stringify({ v: 1, done: { [ID]: { s: 80 } } }));
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      fn: (s: string) => void,
    ) => {
      active = fn;
      return { remove: jest.fn() };
    }) as never);
  });
  afterEach(() => {
    appStorage.removeItem('digi-mini-v1');
    appStorage.removeItem('noodle-board-v1');
    jest.restoreAllMocks();
  });

  it('WHEN the app opens, away from Leagues THEN it goes up', async () => {
    inLeague();
    await render(
      <QueryClientProvider client={testQueryClient()}>
        <Host now={() => NOW} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(boardBackfill).toHaveBeenCalledTimes(1));
    expect(jest.mocked(boardBackfill).mock.calls[0]![2]).toEqual([
      expect.objectContaining({ path: PATH, secs: 80 }),
    ]);
  });

  it('WHEN the first try fails THEN coming back later tries again, and sooner does not', async () => {
    inLeague();
    jest.mocked(boardBackfill).mockRejectedValueOnce(new Error('no signal'));
    let t = NOW;
    await render(
      <QueryClientProvider client={testQueryClient()}>
        <Host now={() => t} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(boardBackfill).toHaveBeenCalledTimes(1));
    await act(async () => active('active'));
    expect(boardBackfill).toHaveBeenCalledTimes(1);
    t += CATCH_UP_EVERY_MS;
    await act(async () => active('active'));
    await waitFor(() => expect(boardBackfill).toHaveBeenCalledTimes(2));
  });

  it('WHEN the player is in no league THEN nothing is sent', async () => {
    await render(
      <QueryClientProvider client={testQueryClient()}>
        <Host now={() => NOW} />
      </QueryClientProvider>,
    );
    await act(async () => undefined);
    expect(fetchPuzzleCards).not.toHaveBeenCalled();
  });
});

describe('GIVEN a long history', () => {
  it('WHEN a catch-up is planned THEN only the last fortnight goes', () => {
    const rows = [
      { path: 'reports/2026-11-04-crossword-mini-0116.html', outcome: 'solved' },
      { path: 'reports/2026-08-01-crossword-mini-0010.html', outcome: 'solved' },
    ];
    const plan = recentOnly({ rows, aids: [], n: 2, done: [] }, NOW);
    expect(plan.rows).toEqual([rows[0]]);
    expect(plan.n).toBe(2);
  });
});
