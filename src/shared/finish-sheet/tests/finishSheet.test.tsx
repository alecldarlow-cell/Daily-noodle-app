import { londonDay, type PuzzleType, type TodayList } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Audio from 'expo-audio';
import { router } from 'expo-router';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { Share, Text } from 'react-native';

import { QueryProvider } from '@/shared/query';
import { DEFAULT_SETTINGS, saveSettings } from '@/shared/settings';
import { resetSound, SOUND_FILES } from '@/shared/sound';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';
import { TODAY_CACHE_KEY } from '@/shared/today';

import { FinishSheet, type FinishSheetProps } from '../FinishSheet';
import {
  clockLine,
  hm,
  JINGLE_TYPES,
  nextRow,
  playsJingle,
  splitHero,
  streakLine,
  toMidnight,
} from '../rules';

jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn() } }));

const played = (Audio as unknown as { __played: unknown[] }).__played;
const jingles = () => played.filter((f) => f === SOUND_FILES.jingle).length;

/** The sheet's parts in screen order, by their testIDs. */
function order(ids: string[]): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null) => {
    if (!n || typeof n === 'string') return;
    if (Array.isArray(n)) return n.forEach(walk);
    const id = n.props.testID as string | undefined;
    if (id && ids.includes(id) && !out.includes(id)) out.push(id);
    (n.children ?? []).forEach(walk);
  };
  walk(screen.toJSON() as ReactTestRendererJSON);
  return out;
}

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

describe('GIVEN the Play more row’s rules (finish.js fillNext, AF-019)', () => {
  it('THEN it names the next unplayed puzzle after this type, wrapping round', () => {
    const docs = { 'digi-mini-v1': { v: 1, done: { 'DP·MINI·0105': {} } } };
    expect(nextRow(list('2026-10-24'), 'mini', docs)).toMatchObject({
      main: 'Play Doku 103',
      sub: '1 of 3 done today',
      all: false,
    });
    expect(nextRow(list('2026-10-24'), 'reckon', docs).main).toBe('Play Doku 103');
    expect(nextRow(null, 'mini', {})).toEqual({
      main: 'Today’s puzzles',
      sub: '\u00a0',
      item: null,
      all: false,
    });
  });
  it('THEN once all are done it is a line to the archive', () => {
    const all = {
      'digi-mini-v1': { v: 1, done: { 'DP·MINI·0105': {} } },
      'digi-doku-v1': { v: 1, done: { 'DP·LEXI·0103': {} } },
      'digi-reckon-v1': { v: 1, done: { 'DP·RECK·0005': {} } },
    };
    expect(nextRow(list('2026-10-24'), 'mini', all)).toEqual({
      main: 'All 3 done today. Try the archive',
      sub: '',
      item: null,
      all: true,
    });
  });

  it('THEN the footer’s countdown reads in hours and minutes to London midnight', () => {
    expect(toMidnight(Date.parse('2026-10-24T22:00:00Z'))).toBe(3600); // 23:00 BST
    expect(toMidnight(Date.parse('2026-12-01T23:30:00Z'))).toBe(1800); // 23:30 GMT
    expect(hm(3600 * 5 + 12 * 60)).toBe('5h 12m');
    expect(hm(3599)).toBe('1h 0m');
    expect(hm(20)).toBe('1m');
    expect(clockLine('Doku', 3 * 3600 + 38 * 60)).toEqual({ lead: 'New Doku in ', bold: '3h 38m' });
    expect(clockLine('Mini', 30).lead).toBe('Today’s puzzles are out.');
  });
});

describe('GIVEN the line under the score (finish.js streakLine)', () => {
  it('THEN it is the type’s day streak, and nothing under 1', () => {
    const st = (v: number | string) => [
      { value: 9, label: 'best streak' },
      { value: v, label: 'day streak' },
    ];
    expect(streakLine(st(5))).toBe('🔥 5-day streak');
    expect(streakLine(st('12'))).toBe('🔥 12-day streak');
    expect(streakLine(st(0))).toBe('');
    expect(streakLine([{ value: 3, label: 'best score' }])).toBe('');
  });
});

describe('GIVEN which finishes play the jingle (AF-013)', () => {
  it('THEN only a fresh solve of Mini, Doku, Sweep, Path or Link', () => {
    expect([...JINGLE_TYPES].sort()).toEqual(['doku', 'link', 'mini', 'path', 'sweep']);
    for (const t of JINGLE_TYPES) expect(playsJingle(t, true, true)).toBe(true);
    for (const t of ['tangle', 'borders', 'reckon'] as PuzzleType[])
      expect(playsJingle(t, true, true)).toBe(false);
    expect(playsJingle('mini', false, true)).toBe(false);
    expect(playsJingle('link', true, false)).toBe(false);
  });
});

describe('GIVEN a finish sheet', () => {
  const onNext = jest.fn();
  const onBack = jest.fn();
  const today = londonDay();
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
    jest.clearAllMocks();
    resetSound();
    played.length = 0;
  });
  afterEach(async () => {
    saveSettings(DEFAULT_SETTINGS);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    jest.restoreAllMocks();
  });

  const sheet = (p: Partial<FinishSheetProps> = {}) => (
    <FinishSheet
      type="doku"
      n="107"
      date="2026-10-24"
      title="Solved"
      hero="1:14"
      note="No checks, no reveals."
      share="🔤 Doku #107 — 1:14 · 🔥5"
      stats={[
        { value: 5, label: 'day streak' },
        { value: 9, label: 'best streak' },
        { value: 40, label: 'Dokus played' },
      ]}
      recap={{ title: 'The grid', node: <Text>grid</Text> }}
      boardSlot={<Text>Currently 1st in Noodlers</Text>}
      onBack={onBack}
      onNext={onNext}
      {...p}
    />
  );
  const PARTS = [
    'finish-title',
    'finish-hero',
    'finish-streak',
    'finish-note',
    'finish-recap',
    'finish-share-button',
    'finish-board-slot',
    'finish-next',
    'finish-foot',
  ];

  describe('WHEN a solved round’s sheet opens', () => {
    it('THEN it reads result, Share result, league line, Play more, answer, footer, in that order', async () => {
      mockSite({ 'puzzles-today.json': list(today) });
      await renderWithProviders(sheet());
      await waitFor(() => expect(screen.getByText('Play Reckon 5')).toBeOnTheScreen());
      expect(screen.getByRole('header', { name: 'Doku 107 · Solved' })).toBeOnTheScreen();
      expect(screen.getByText('1:14')).toBeOnTheScreen();
      expect(screen.getByText('🔥 5-day streak')).toBeOnTheScreen();
      expect(screen.getByText('No checks, no reveals.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Share result' })).toBeOnTheScreen();
      expect(screen.getByText('Currently 1st in Noodlers')).toBeOnTheScreen();
      expect(screen.getByText('0 of 3 done today')).toBeOnTheScreen();
      expect(screen.getByText('The grid')).toBeOnTheScreen();
      expect(screen.getByTestId('finish-clock')).toHaveTextContent(
        /^(New Doku in \d+h \d+m|New Doku in \d+m|Today’s puzzles are out\.)$/,
      );
      expect(screen.getByText('Doku 107, Saturday 24 October')).toBeOnTheScreen();
      expect(order(PARTS)).toEqual([
        'finish-title',
        'finish-hero',
        'finish-streak',
        'finish-note',
        'finish-share-button',
        'finish-board-slot',
        'finish-next',
        'finish-recap',
        'finish-foot',
      ]);
    });
    it('THEN the dropped parts are gone: the share line, the three stats and the run sentence', async () => {
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: {}, streak: { cur: 15, best: 15 } }),
      );
      await renderWithProviders(sheet());
      expect(screen.queryByText('🔤 Doku #107 — 1:14 · 🔥5')).toBeNull();
      expect(screen.queryByText('dailynoodle.co.uk/doku')).toBeNull();
      expect(screen.queryByText('best streak')).toBeNull();
      expect(screen.queryByText('Dokus played')).toBeNull();
      expect(screen.queryByText(/played every day/)).toBeNull();
    });
  });

  describe('WHEN the round wasn’t solved (AF-015)', () => {
    it('THEN the answer comes straight after the result', async () => {
      await renderWithProviders(
        sheet({ type: 'link', title: 'Out of mistakes', solved: false, note: undefined }),
      );
      expect(screen.getByRole('header', { name: 'Link 107 · Out of mistakes' })).toBeOnTheScreen();
      expect(order(PARTS)).toEqual([
        'finish-title',
        'finish-hero',
        'finish-streak',
        'finish-recap',
        'finish-share-button',
        'finish-board-slot',
        'finish-next',
        'finish-foot',
      ]);
    });
  });

  describe('WHEN Share result is tapped', () => {
    it('THEN the share sheet gets the line and the short link, with a spinner until it opens', async () => {
      let open!: () => void;
      const spy = jest.spyOn(Share, 'share').mockReturnValue(
        new Promise((r) => {
          open = () => r({ action: 'sharedAction', activityType: undefined });
        }),
      );
      await renderWithProviders(sheet());
      await fireEvent.press(screen.getByRole('button', { name: 'Share result' }));
      expect(spy).toHaveBeenCalledWith({
        message: '🔤 Doku #107 — 1:14 · 🔥5\ndailynoodle.co.uk/doku',
      });
      expect(screen.getByTestId('finish-share-button-spinner')).toBeOnTheScreen();
      await act(async () => open());
      expect(screen.queryByTestId('finish-share-button-spinner')).toBeNull();
    });
  });

  describe('WHEN today’s list is kept and Play more is tapped', () => {
    it('THEN it opens the next puzzle, even before the site answers', async () => {
      appStorage.setItem(TODAY_CACHE_KEY, JSON.stringify(list(today)));
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: { 'DP·MINI·0105': { s: 87 } } }),
      );
      mockSite({});
      await renderWithProviders(sheet({ type: 'mini', n: '105' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Play Doku 103' }));
      expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ id: 'DP·LEXI·0103' }));
      expect(screen.getByText('1 of 3 done today')).toBeOnTheScreen();
      await fireEvent.press(screen.getByText('← Puzzles'));
      expect(onBack).toHaveBeenCalled();
    });
  });

  describe('WHEN every puzzle today is done', () => {
    it('THEN a quiet line “All 3 done today. Try the archive ›” opens the Archive', async () => {
      appStorage.setItem(TODAY_CACHE_KEY, JSON.stringify(list(today)));
      appStorage.setItem('digi-mini-v1', JSON.stringify({ v: 1, done: { 'DP·MINI·0105': {} } }));
      appStorage.setItem('digi-doku-v1', JSON.stringify({ v: 1, done: { 'DP·LEXI·0103': {} } }));
      appStorage.setItem('digi-reckon-v1', JSON.stringify({ v: 1, done: { 'DP·RECK·0005': {} } }));
      mockSite({});
      await renderWithProviders(sheet());
      const line = screen.getByRole('link', { name: 'All 3 done today. Try the archive' });
      expect(screen.queryByRole('button', { name: /^Play / })).toBeNull();
      await fireEvent.press(line);
      expect(router.dismissTo).toHaveBeenCalledWith('/archive');
      expect(onNext).not.toHaveBeenCalled();
    });
  });

  describe('WHEN there is no list for today', () => {
    it('THEN the button leads to today’s puzzles', async () => {
      mockSite({ 'puzzles-today.json': list('2001-01-01') });
      await renderWithProviders(sheet());
      await fireEvent.press(screen.getByRole('button', { name: 'Today’s puzzles' }));
      expect(onNext).toHaveBeenCalledWith(null);
    });
  });

  describe('WHEN a grid puzzle is freshly solved (AF-013)', () => {
    it.each(['mini', 'doku', 'sweep', 'path', 'link'] as PuzzleType[])(
      'THEN %s plays the jingle once, even as the sheet re-renders',
      async (type) => {
        const r = await renderWithProviders(sheet({ type, celebrate: true }));
        expect(jingles()).toBe(1);
        await r.rerender(
          <QueryProvider client={r.client}>
            {sheet({ type, celebrate: true, note: 'again' })}
          </QueryProvider>,
        );
        expect(jingles()).toBe(1);
      },
    );
  });

  describe('WHEN there is nothing to celebrate', () => {
    it('THEN a reopened puzzle, a loss, Tangle/Borders/Reckon and Sound off are silent', async () => {
      const r = await renderWithProviders(sheet({ celebrate: false }));
      await r.unmount();
      const r2 = await renderWithProviders(sheet({ type: 'link', celebrate: true, solved: false }));
      await r2.unmount();
      for (const type of ['tangle', 'borders', 'reckon'] as PuzzleType[]) {
        const r3 = await renderWithProviders(sheet({ type, celebrate: true }));
        await r3.unmount();
      }
      saveSettings({ sound: false });
      await renderWithProviders(sheet({ celebrate: true }));
      expect(jingles()).toBe(0);
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
