import { londonDay, type TodayList } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Share, Text } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';
import { TODAY_CACHE_KEY } from '@/shared/today';

import { FinishSheet } from '../FinishSheet';
import { clockLine, hm, nextRow, splitHero, toMidnight } from '../rules';

const list = (today: string): TodayList => ({
  today,
  items: [
    {
      type: 'mini',
      id: 'DP·MINI·0105',
      name: 'Mini 105',
      path: 'reports/2026-10-24-crossword-mini-0105.html',
    },
    {
      type: 'doku',
      id: 'DP·LEXI·0103',
      name: 'Doku 103',
      path: 'reports/2026-10-24-logic-doku-0103.html',
    },
    {
      type: 'reckon',
      id: 'DP·RECK·0005',
      name: 'Reckon 5',
      path: 'reports/2026-10-24-quiz-reckon-0005.html',
    },
  ],
});

describe('GIVEN the Next row’s rules', () => {
  it('THEN it names the next unplayed puzzle after this type, wrapping round', () => {
    const docs = { 'digi-mini-v1': { v: 1, done: { 'DP·MINI·0105': {} } } };
    expect(nextRow(list('2026-10-24'), 'mini', docs)).toMatchObject({
      main: 'Next: Doku 103',
      sub: '1 of 3 played today',
    });
    expect(nextRow(list('2026-10-24'), 'reckon', docs).main).toBe('Next: Doku 103');
    const all = {
      ...docs,
      'digi-doku-v1': { v: 1, done: { 'DP·LEXI·0103': {} } },
      'digi-reckon-v1': { v: 1, done: { 'DP·RECK·0005': {} } },
    };
    expect(nextRow(list('2026-10-24'), 'mini', all)).toEqual({
      main: 'All today’s puzzles done',
      sub: '3 of 3 played today',
      item: null,
    });
    expect(nextRow(null, 'mini', {})).toEqual({ main: 'Today’s puzzles', sub: ' ', item: null });
  });

  it('THEN the countdown reads in hours and minutes to London midnight', () => {
    expect(toMidnight(Date.parse('2026-10-24T22:00:00Z'))).toBe(3600); // 23:00 BST
    expect(toMidnight(Date.parse('2026-12-01T23:30:00Z'))).toBe(1800); // 23:30 GMT
    expect(hm(3600 * 5 + 12 * 60)).toBe('5h 12m');
    expect(hm(3599)).toBe('1h 0m');
    expect(hm(20)).toBe('1m');
    expect(clockLine('Mini', 3000, 0)).toEqual({
      lead: 'A new Mini in ',
      bold: '50m',
      after: '.',
      run: 0,
    });
    expect(clockLine('Mini', 30, 4).lead).toBe('Today’s puzzles are out.');
  });
});

describe('GIVEN a finish sheet', () => {
  const onNext = jest.fn();
  const onBack = jest.fn();
  const today = londonDay();
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
    jest.clearAllMocks();
  });
  afterEach(async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
  });

  const sheet = (
    <FinishSheet
      type="mini"
      n="105"
      date="2026-10-24"
      title="Solved"
      hero="1:27"
      note="No checks, no reveals."
      share="✏️ Mini #105 — 1:27 · 🔥5"
      stats={[
        { value: 5, label: 'day streak' },
        { value: 9, label: 'best streak' },
        { value: 40, label: 'Minis played' },
      ]}
      recap={{ title: 'The grid', node: <Text>grid</Text> }}
      boardSlot={<Text>See today’s board</Text>}
      onBack={onBack}
      onNext={onNext}
    />
  );

  it('THEN it shows the kicker, result, note, share line and short link, stats and recap', async () => {
    mockSite({ 'puzzles-today.json': list(today) });
    await renderWithProviders(sheet);
    expect(screen.getByText('Mini 105, Saturday 24 October')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Solved' })).toBeOnTheScreen();
    expect(screen.getByText('1:27')).toBeOnTheScreen();
    expect(screen.getByText('No checks, no reveals.')).toBeOnTheScreen();
    expect(screen.getByText('✏️ Mini #105 — 1:27 · 🔥5')).toBeOnTheScreen();
    expect(screen.getByText('dailynoodle.co.uk/mini')).toBeOnTheScreen();
    expect(screen.getByText('Minis played')).toBeOnTheScreen();
    expect(screen.getByText('The grid')).toBeOnTheScreen();
    expect(screen.getByText('See today’s board')).toBeOnTheScreen();
    expect(screen.getByTestId('finish-clock')).toHaveTextContent(
      /^(A new Mini in \d|Today’s puzzles are out)/,
    );
    await waitFor(() => expect(screen.getByText('Next: Doku 103')).toBeOnTheScreen());
  });

  describe('WHEN Share is tapped', () => {
    it('THEN the phone’s share sheet gets the line and the short link', async () => {
      const spy = jest
        .spyOn(Share, 'share')
        .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
      await renderWithProviders(sheet);
      await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
      expect(spy).toHaveBeenCalledWith({
        message: '✏️ Mini #105 — 1:27 · 🔥5\ndailynoodle.co.uk/mini',
      });
    });
  });

  describe('WHEN today’s list is kept and the Next row is tapped', () => {
    it('THEN it opens the next puzzle, even before the site answers', async () => {
      appStorage.setItem(TODAY_CACHE_KEY, JSON.stringify(list(today)));
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: { 'DP·MINI·0105': { s: 87 } } }),
      );
      mockSite({});
      await renderWithProviders(sheet);
      await fireEvent.press(screen.getByRole('button', { name: 'Next: Doku 103' }));
      expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ id: 'DP·LEXI·0103' }));
      await fireEvent.press(screen.getByText('← Puzzles'));
      expect(onBack).toHaveBeenCalled();
    });
  });

  describe('WHEN there is no list for today', () => {
    it('THEN the row leads to today’s puzzles', async () => {
      mockSite({ 'puzzles-today.json': list('2001-01-01') });
      await renderWithProviders(sheet);
      await fireEvent.press(screen.getByRole('button', { name: 'Today’s puzzles' }));
      expect(onNext).toHaveBeenCalledWith(null);
    });
  });
});

describe('GIVEN a result with a unit (splitHero)', () => {
  describe('WHEN the sheet draws it', () => {
    it('THEN the unit is set apart, as finish.js draws it, and a time stays whole', () => {
      expect(splitHero('325 pts')).toEqual(['325', 'pts']);
      expect(splitHero('39 points')).toEqual(['39', 'points']);
      expect(splitHero('1 point')).toEqual(['1', 'point']);
      expect(splitHero('1:27')).toEqual(['1:27', '']);
      expect(splitHero('7 of 10')).toEqual(['7 of 10', '']);
    });
  });
});
