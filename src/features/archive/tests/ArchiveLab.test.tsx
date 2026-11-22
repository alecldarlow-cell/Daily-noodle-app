/** The Archive's Lab choice (Alec, 11 Nov 2026): every Lab puzzle before today, retired trials marked. */
import { dayBefore, londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { ArchiveScreen, labWhen } from '../components/ArchiveScreen/ArchiveScreen';
import { FEED_LITE } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const today = londonDay();
const yesterday = dayBefore(today);
const longAgo = '2026-10-29';
const lab = [
  {
    path: `reports/${today}-word-redact-0035.html`,
    type: 'redact',
    id: 'DP·REDA·0035',
    date: today,
    headline: 'Redact 0035',
    standfirst: 'r',
  },
  {
    path: `reports/${yesterday}-word-redact-0034.html`,
    type: 'redact',
    id: 'DP·REDA·0034',
    date: yesterday,
    headline: 'Redact 0034',
    standfirst: 'r',
  },
  {
    path: `reports/${longAgo}-logic-tilt-0002.html`,
    type: 'tilt',
    id: 'DP·TILT·0002',
    date: longAgo,
    headline: 'Tilt 0002',
    standfirst: 't',
  },
];

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
  mockSite({ 'feed-lite.json': { ...FEED_LITE, items: [...FEED_LITE.items, ...lab] } });
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('GIVEN Lab puzzles in the list', () => {
  it('WHEN All is shown and no Lab puzzle was played THEN none is among the dailies', async () => {
    await renderWithProviders(<ArchiveScreen />);
    await waitFor(() => expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen());
    expect(screen.queryByTestId('archive-DP·REDA·0034')).toBeNull();
  });

  it('WHEN Lab is picked THEN its puzzles before today show, played ones say so, retired ones are marked', async () => {
    appStorage.setItem(
      'digi-redact-v1',
      JSON.stringify({ v: 1, done: { 'DP·REDA·0034': { t: '2:05', s: 125 } } }),
    );
    await renderWithProviders(<ArchiveScreen />);
    await waitFor(() => expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('archive-type'));
    await fireEvent.press(screen.getByTestId('chip-lab'));
    expect(screen.getByTestId('archive-type')).toHaveTextContent('Lab');
    expect(screen.queryByTestId('archive-DP·MINI·0105')).toBeNull();
    expect(screen.queryByTestId('archive-DP·REDA·0035')).toBeNull(); // today's: on Today
    const redact = screen.getByTestId('archive-DP·REDA·0034');
    expect(within(redact).getByText('Redact 34')).toBeOnTheScreen();
    expect(within(redact).getByText(/Solved in 2:05/)).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('archive-DP·TILT·0002')).getByText(/Retired/),
    ).toBeOnTheScreen();
    // the calendar isn't offered for the Lab
    expect(screen.queryByTestId('view-calendar')?.props.accessibilityState?.selected ?? false).toBe(
      false,
    );
    await fireEvent.press(screen.getByTestId('archive-DP·TILT·0002'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/play/[type]/[file]',
      params: { type: 'tilt', file: `${longAgo}-logic-tilt-0002` },
    });
  });

  it('WHEN All is shown and Lab puzzles were played THEN those, finished or part-played, are among the dailies with their Lab label; Hide done hides the finished one', async () => {
    // Alec, 20 Nov 2026: "add the played lab puzzles to the archive … their normal puzzle icon
    // with a little pink lab label"
    appStorage.setItem(
      'digi-redact-v1',
      JSON.stringify({ v: 1, done: { 'DP·REDA·0034': { t: '2:05', s: 125 } } }),
    );
    appStorage.setItem(
      'digi-tilt-v1',
      JSON.stringify({ v: 1, cur: { id: 'DP·TILT·0002', n: 3, s: 20 } }),
    );
    await renderWithProviders(<ArchiveScreen />);
    await waitFor(() => expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen());
    const redact = await screen.findByTestId('archive-DP·REDA·0034');
    expect(within(redact).getByText(/Solved in 2:05/)).toBeOnTheScreen();
    expect(screen.getByTestId('archive-DP·REDA·0034-lab')).toHaveTextContent('LAB TRIAL');
    expect(redact.props.accessibilityLabel).toMatch(/^Redact 34, Lab trial, /);
    expect(screen.getByTestId('archive-DP·TILT·0002-lab')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('archive-DP·TILT·0002')).getByText('Continue'),
    ).toBeOnTheScreen();
    // a daily has no Lab label; today's Lab puzzle stays on Today
    expect(screen.queryByTestId('archive-DP·MINI·0105-lab')).toBeNull();
    expect(screen.queryByTestId('archive-DP·REDA·0035')).toBeNull();
    await fireEvent.press(screen.getByTestId('archive-hide-done'));
    expect(screen.queryByTestId('archive-DP·REDA·0034')).toBeNull();
    expect(screen.getByTestId('archive-DP·TILT·0002')).toBeOnTheScreen();
  });

  it('WHEN a daily type is picked THEN no Lab puzzle shows, played or not', async () => {
    appStorage.setItem(
      'digi-redact-v1',
      JSON.stringify({ v: 1, done: { 'DP·REDA·0034': { t: '2:05', s: 125 } } }),
    );
    await renderWithProviders(<ArchiveScreen />);
    await waitFor(() => expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('archive-type'));
    await fireEvent.press(screen.getByTestId('chip-mini'));
    expect(screen.queryByTestId('archive-DP·REDA·0034')).toBeNull();
  });

  it('WHEN Lab is picked THEN every row carries the Lab label', async () => {
    await renderWithProviders(<ArchiveScreen />);
    await waitFor(() => expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('archive-type'));
    await fireEvent.press(screen.getByTestId('chip-lab'));
    expect(screen.getByTestId('archive-DP·REDA·0034-lab')).toBeOnTheScreen();
    expect(screen.getByTestId('archive-DP·TILT·0002-lab')).toBeOnTheScreen();
  });

  it('THEN the left side reads when, then Retired', () => {
    expect(labWhen('3 Nov', true)).toBe('3 Nov · Retired');
    expect(labWhen('Yesterday', false)).toBe('Yesterday');
  });
});
