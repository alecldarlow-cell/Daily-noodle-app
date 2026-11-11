/** The Lab panel under Today's dailies (Alec, 11 Nov 2026; project doc claude/lab-in-app-brief.md). */
import { dayBefore, londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { LAB_LINE } from '../components/LabPanel/LabPanel';
import { TodayScreen } from '../components/TodayScreen/TodayScreen';
import { todayList } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.setTimeout(30_000);

const today = londonDay();
const yesterday = dayBefore(today);
const old = dayBefore(dayBefore(yesterday));

const card = (type: string, slug: string, id: string, date: string, n: number) => ({
  path: `reports/${date}-${slug}-${String(n).padStart(4, '0')}.html`,
  type,
  id,
  date,
  headline: `${type} ${n}`,
  standfirst: `${type} line`,
});
const feed = (lab: object[]) => ({
  built: 'b',
  today,
  count: 1,
  items: [
    {
      path: 'reports/2026-10-24-crossword-mini-0105.html',
      type: 'mini',
      id: 'DP·MINI·0105',
      date: today,
      headline: 'Mini 105',
    },
    ...lab,
  ],
});

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('GIVEN three trials running and one retired', () => {
  const lab = [
    card('tilt', 'logic-tilt', 'DP·TILT·0025', today, 25),
    card('redact', 'word-redact', 'DP·REDA·0035', today, 35),
    card('redact', 'word-redact', 'DP·REDA·0034', yesterday, 34),
    card('tumbler', 'word-tumbler', 'DP·TUMB·0035', yesterday, 35),
  ];
  describe('WHEN Today opens with one rated and one played', () => {
    it('THEN the panel lists the newest of each in the Lab’s order, with the right callouts', async () => {
      appStorage.setItem(
        'noodle-lab-votes-v1',
        JSON.stringify({ tilt: { v: 'yes', at: 1 }, mini: { v: 'yes' } }),
      );
      appStorage.setItem(
        'digi-redact-v1',
        JSON.stringify({ v: 1, done: { 'DP·REDA·0035': { t: '1:40', s: 100 } } }),
      );
      mockSite({ 'puzzles-today.json': todayList(), 'feed-lite.json': feed(lab) });
      await renderWithProviders(<TodayScreen />);
      const panel = await screen.findByTestId('lab-panel');
      expect(within(panel).getByText('From the Lab')).toBeOnTheScreen();
      expect(within(panel).getByText(LAB_LINE)).toBeOnTheScreen();
      expect(screen.getByTestId('lab-rated')).toHaveTextContent('1 OF 3 RATED');
      expect(within(screen.getByTestId('lab-row-tilt')).getByText('✓ Rated')).toBeOnTheScreen();
      expect(within(screen.getByTestId('lab-row-redact')).getByText('Rate it')).toBeOnTheScreen();
      expect(within(screen.getByTestId('lab-row-tumbler')).getByText('Try it')).toBeOnTheScreen();
      // the dailies' count is untouched by the Lab
      expect(screen.getByTestId('today-count')).toHaveTextContent('8 puzzles');
    });
  });
  describe('WHEN a row is tapped', () => {
    it('THEN its puzzle opens on the play route', async () => {
      mockSite({ 'puzzles-today.json': todayList(), 'feed-lite.json': feed(lab) });
      await renderWithProviders(<TodayScreen />);
      fireEvent.press(await screen.findByTestId('lab-row-tumbler'));
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/play/[type]/[file]',
        params: { type: 'tumbler', file: `${yesterday}-word-tumbler-0035` },
      });
    });
  });
});

describe('GIVEN no trial running (all retired)', () => {
  it('THEN there is no panel', async () => {
    mockSite({
      'puzzles-today.json': todayList(),
      'feed-lite.json': feed([card('tilt', 'logic-tilt', 'DP·TILT·0001', old, 1)]),
    });
    await renderWithProviders(<TodayScreen />);
    await waitFor(() => expect(screen.getByTestId('today-mini')).toBeOnTheScreen());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(screen.queryByTestId('lab-panel')).toBeNull();
  });
});
