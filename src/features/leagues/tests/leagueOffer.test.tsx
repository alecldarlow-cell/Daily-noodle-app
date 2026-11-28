/* The league offer (28 Nov 2026; SITE.md › League offer, the site's dn-board.js section 4). */
import { londonDay } from '@noodle/core';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { appStorage } from '@/shared/storage';
import { renderWithProviders } from '@/shared/testing';

import { BoardLink } from '../components/BoardLink';
import { LeagueOffer } from '../components/LeagueOffer';
import {
  MONTH_MS,
  OFFER_KEY,
  offerCopy,
  offerDue,
  playDays,
  readOffer,
  recordAsk,
  recordTap,
} from '../hooks/leagueOffer';
import { clearStore, FAMILY, PID, setBoard } from './helpers';

jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn(), navigate: jest.fn() } }));
jest.mock('../api/board');

const NOW = Date.parse('2026-11-28T15:00:00Z');
const today = londonDay();
const PATH = `reports/${today}-crossword-mini-0140.html`;

/** Finished Sweeps on `n` different days (the saves carry their ISO dates). */
function played(n: number) {
  const done: Record<string, { o: string; s: number; d: string }> = {};
  for (let i = 0; i < n; i++) {
    const d = new Date(NOW - i * 86_400_000).toISOString().slice(0, 10);
    done[`DP·SWEEP·${d}`] = { o: 'win', s: 80, d };
  }
  appStorage.setItem('digi-sweep-v1', JSON.stringify({ v: 1, done }));
}
const events: [string, unknown][] = [];
const record = (ev: string, props: unknown) => {
  events.push([ev, props]);
};
const offer = async (p: { celebrate?: boolean; now?: number } = {}) =>
  await renderWithProviders(
    <LeagueOffer
      path={PATH}
      celebrate={p.celebrate ?? true}
      now={() => p.now ?? NOW}
      record={record}
    />,
  );
const state = () => JSON.parse(appStorage.getItem(OFFER_KEY) ?? 'null');

beforeEach(() => {
  clearStore();
  jest.clearAllMocks();
  events.length = 0;
});

describe('GIVEN the offer’s rules', () => {
  it('THEN days count distinct dates across every puzzle save, and only puzzle saves', () => {
    played(3);
    appStorage.setItem(
      'digi-mini-v1',
      JSON.stringify({ done: { a: { d: '2026-11-28' }, b: { d: '2026-11-01' } } }),
    );
    appStorage.setItem('noodle-app-today', JSON.stringify({ today: '2020-01-01' }));
    expect(playDays(appStorage)).toBe(4);
  });
  it('THEN it is due from 3 days, once, then once more after 30 days, never after a tap or in a league', () => {
    expect(offerDue({}, 2, NOW, false)).toBe(false);
    expect(offerDue({}, 3, NOW, false)).toBe(true);
    expect(offerDue({}, 3, NOW, true)).toBe(false);
    expect(offerDue({ a: [NOW - MONTH_MS + 1] }, 9, NOW, false)).toBe(false);
    expect(offerDue({ a: [NOW - MONTH_MS] }, 9, NOW, false)).toBe(true);
    expect(offerDue({ a: [NOW - 3 * MONTH_MS, NOW - 2 * MONTH_MS] }, 9, NOW, false)).toBe(false);
    expect(offerDue({ a: [NOW - 2 * MONTH_MS], t: NOW - 2 * MONTH_MS }, 9, NOW, false)).toBe(false);
  });
  it('THEN asks and taps are kept in the site’s shape, and junk reads as never asked', () => {
    expect(recordAsk(appStorage, 4, NOW)).toEqual({ days: '3-6', n: 1 });
    expect(recordAsk(appStorage, 7, NOW + 1)).toEqual({ days: '7+', n: 2 });
    recordTap(appStorage, NOW + 2);
    expect(state()).toEqual({ a: [NOW, NOW + 1], t: NOW + 2 });
    appStorage.setItem(OFFER_KEY, '{oops');
    expect(readOffer(appStorage)).toEqual({});
    appStorage.setItem(OFFER_KEY, JSON.stringify({ a: 'x', t: 'y' }));
    expect(readOffer(appStorage)).toEqual({ a: [] });
  });
  it('THEN the words follow the days played', () => {
    expect(offerCopy(3).title).toBe('Play with your family?');
    expect(offerCopy(24).title).toBe('24 days of puzzles. Bring your people in?');
    expect(offerCopy(24).body).toContain('Your past results go on the board too.');
  });
});

describe('GIVEN a fresh finish by a player in no league with 3 days played', () => {
  it('THEN the card asks once, and Start a league opens Leagues on Start (from the offer)', async () => {
    played(3);
    await offer();
    await act(async () => {});
    expect(screen.getByTestId('league-offer-title')).toHaveTextContent('Play with your family?');
    expect(screen.queryByTestId('board-slot')).toBeNull();
    expect(state().a).toEqual([NOW]);
    expect(events).toEqual([['league_offer_view', { days: '3-6', n: 1 }]]);
    await fireEvent.press(screen.getByTestId('league-offer-start'));
    expect(state().t).toBe(NOW);
    expect(events[1]).toEqual(['league_offer_tap', { act: 'start', days: '3-6', n: 1 }]);
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/leagues',
      params: expect.objectContaining({ go: 'start', from: 'offer' }),
    });
  });
  it('THEN Not now puts the quiet line back and Join instead opens the code form', async () => {
    played(8);
    await offer();
    await act(async () => {});
    expect(screen.getByTestId('league-offer-title')).toHaveTextContent(
      '8 days of puzzles. Bring your people in?',
    );
    await fireEvent.press(screen.getByTestId('league-offer-no'));
    expect(screen.queryByTestId('league-offer')).toBeNull();
    expect(screen.getByTestId('board-line')).toHaveTextContent('Start a league with friends ›');
    expect(events).toEqual([
      ['league_offer_view', { days: '7+', n: 1 }],
      ['league_offer_dismiss', { days: '7+', n: 1 }],
    ]);
    clearStore();
    events.length = 0;
    played(3);
    await offer();
    await act(async () => {});
    await fireEvent.press(screen.getAllByTestId('league-offer-join')[0]!);
    expect(events[1]).toEqual(['league_offer_tap', { act: 'join', days: '3-6', n: 1 }]);
    expect(router.dismissTo).toHaveBeenLastCalledWith({
      pathname: '/leagues',
      params: expect.objectContaining({ go: 'code' }),
    });
  });
});

describe('GIVEN no ask due', () => {
  const quiet = async (celebrate = true) => {
    await offer({ celebrate });
    await act(async () => {});
    expect(screen.queryByTestId('league-offer')).toBeNull();
    expect(screen.getByTestId('board-line')).toHaveTextContent('Start a league with friends ›');
    expect(events).toEqual([]);
  };
  it('THEN 2 days played shows only the quiet line and records nothing', async () => {
    played(2);
    await quiet();
    expect(state()).toBeNull();
  });
  it('THEN a reopened sheet (no fresh finish) shows only the quiet line', async () => {
    played(5);
    await quiet(false);
    expect(state()).toBeNull();
  });
  it('THEN an ask 5 days ago shows only the quiet line and keeps the asks as they were', async () => {
    played(5);
    appStorage.setItem(OFFER_KEY, JSON.stringify({ a: [NOW - 5 * 86_400_000] }));
    await quiet();
    expect(state()).toEqual({ a: [NOW - 5 * 86_400_000] });
  });
  it('THEN a league member’s sheet never shows the card', async () => {
    played(9);
    setBoard({ pid: PID, leagues: [FAMILY], cur: FAMILY.code });
    await renderWithProviders(
      <BoardLink path={PATH} type="mini" date={today} onTag={() => {}} celebrate />,
    );
    await act(async () => {});
    expect(screen.queryByTestId('league-offer')).toBeNull();
    expect(state()).toBeNull();
  });
});
