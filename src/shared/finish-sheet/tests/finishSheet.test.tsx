import { dayBefore, londonDay, type PuzzleType, type TodayList } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Audio from 'expo-audio';
import { router } from 'expo-router';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { AccessibilityInfo, Share, StyleSheet, Text } from 'react-native';

import { QueryProvider } from '@/shared/query';
import { DEFAULT_SETTINGS, saveSettings } from '@/shared/settings';
import { resetSound, SOUND_FILES } from '@/shared/sound';
import { appStorage } from '@/shared/storage';
import { puzzleTokensFor, tokensFor } from '@/shared/theme';
import { mockSite, renderWithProviders } from '@/shared/testing';
import { TODAY_CACHE_KEY } from '@/shared/today';

import { BoardSlotProvider, type BoardSlotComponent, type BoardSlotProps } from '../boardSlot';
import { ANNOUNCE_MS, FinishSheet, type FinishSheetProps } from '../FinishSheet';
import {
  announcement,
  clockLine,
  clockSecs,
  dayStreak,
  hm,
  JINGLE_TYPES,
  nextRow,
  personalBest,
  playsJingle,
  recapLabel,
  resultValue,
  rewardLine,
  spokenHero,
  splitHero,
  streakLine,
  toMidnight,
} from '../rules';

jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn(), push: jest.fn() } }));

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

describe('GIVEN the Next button’s rules (finish.js fillNext, design B3)', () => {
  it('THEN it names the next unplayed puzzle after this type, wrapping round', () => {
    const docs = { 'digi-mini-v1': { v: 1, done: { 'DP·MINI·0105': {} } } };
    expect(nextRow(list('2026-10-24'), 'mini', docs)).toMatchObject({
      main: 'Next: Doku 103',
      sub: '1 of 3 done today',
      all: false,
    });
    expect(nextRow(list('2026-10-24'), 'reckon', docs).main).toBe('Next: Doku 103');
    expect(nextRow(null, 'mini', {})).toEqual({
      main: 'Today’s puzzles',
      sub: '\u00a0',
      item: null,
      all: false,
    });
  });
  it('THEN once all are done it is the archive button', () => {
    const all = {
      'digi-mini-v1': { v: 1, done: { 'DP·MINI·0105': {} } },
      'digi-doku-v1': { v: 1, done: { 'DP·LEXI·0103': {} } },
      'digi-reckon-v1': { v: 1, done: { 'DP·RECK·0005': {} } },
    };
    expect(nextRow(list('2026-10-24'), 'mini', all)).toEqual({
      main: 'All 3 done',
      sub: 'Try the archive',
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
    expect(streakLine(st(5), 'Doku')).toBe('🔥 5-day Doku streak');
    expect(streakLine(st('12'), 'Doku')).toBe('🔥 12-day Doku streak');
    expect(streakLine(st(0), 'Doku')).toBe('');
    expect(streakLine([{ value: 3, label: 'best score' }], 'Doku')).toBe('');
  });
});

describe('GIVEN which finishes play the jingle (AF-013)', () => {
  it('THEN only a fresh solve of Mini, Doku, Sweep, Path, Link or Tally', () => {
    expect([...JINGLE_TYPES].sort()).toEqual(['doku', 'link', 'mini', 'path', 'sweep', 'tally']);
    for (const t of JINGLE_TYPES) expect(playsJingle(t, true, true)).toBe(true);
    for (const t of ['tangle', 'borders', 'reckon'] as PuzzleType[])
      expect(playsJingle(t, true, true)).toBe(false);
    expect(playsJingle('mini', false, true)).toBe(false);
    expect(playsJingle('link', true, false)).toBe(false);
  });
});

describe('GIVEN the reward line’s rules (design B3)', () => {
  const mini = (...secs: number[]) => ({
    v: 1,
    done: Object.fromEntries(secs.map((x, k) => [`DP·MINI·${k}`, { s: x, d: '2026-11-01' }])),
  });
  it('THEN a personal best needs this result to beat every other one, and three of them', () => {
    // This result (90 s) is saved too; three earlier finishes, the best 102 s.
    expect(personalBest('mini', 90, 'Mini', mini(90, 102, 130, 200))).toBe(
      'Your fastest Mini yet, by 12s',
    );
    // Only two earlier finishes: not yet.
    expect(personalBest('mini', 90, 'Mini', mini(90, 102, 130))).toBeNull();
    // Not faster than the best (a tie is not a best).
    expect(personalBest('mini', 102, 'Mini', mini(102, 102, 130, 200))).toBeNull();
    expect(personalBest('mini', 90, 'Mini', mini(90, 60, 130, 200))).toBeNull();
    expect(personalBest('mini', 30, 'Mini', mini(30, 100, 130, 200))).toBe(
      'Your fastest Mini yet, by 1m 10s',
    );
    expect(personalBest('mini', 90, 'Mini', null)).toBeNull();
  });
  it('THEN points types count points, Sweep leaves its losses out, and Link has none', () => {
    const tangle = { v: 1, done: { a: { s: 46 }, b: { s: 40 }, c: { s: 31 }, d: { s: 12 } } };
    expect(personalBest('tangle', 46, 'Tangle', tangle)).toBe('Your best Tangle yet, by 6 points');
    expect(
      personalBest('reckon', 41, 'Reckon', {
        done: { a: { p: 41 }, b: { p: 40 }, c: { p: 1 }, d: { p: 2 } },
      }),
    ).toBe('Your best Reckon yet, by 1 point');
    const sweep = {
      done: { a: { s: 31 }, b: { s: 5, o: 'loss' }, c: { s: 40 }, d: { s: 50 }, e: { s: 60 } },
    };
    expect(personalBest('sweep', 31, 'Sweep', sweep)).toBe('Your fastest Sweep yet, by 9s');
    const path = {
      done: { a: { t: '1:00' }, b: { t: '1:30' }, c: { t: '2:00' }, d: { t: '3:00' } },
    };
    expect(personalBest('path', 60, 'Path', path)).toBe('Your fastest Path yet, by 30s');
    expect(personalBest('link', 1, 'Link', tangle)).toBeNull();
  });
  it('THEN the result is read off the hero, or Borders’ points off its stats', () => {
    expect(resultValue('mini', '1:42', [])).toBe(102);
    expect(resultValue('tangle', '46 points', [])).toBe(46);
    expect(resultValue('reckon', '325 pts', [])).toBe(325);
    expect(resultValue('borders', '7 of 10', [{ value: 650, label: 'points' }])).toBe(650);
    expect(resultValue('borders', '7 of 10', [])).toBeNull();
    expect(resultValue('link', 'Fish, Birds', [])).toBeNull();
    expect(clockSecs('1:02:03')).toBe(3723);
    expect(clockSecs('soon')).toBeNull();
  });
  it('THEN the main line is the first of best, milestone, streak; nothing under 2 days', () => {
    expect(rewardLine('Your fastest Mini yet, by 12s', 30, 'Mini')).toEqual({
      kind: 'pb',
      text: 'Your fastest Mini yet, by 12s',
    });
    for (const n of [7, 30, 50, 100, 365])
      expect(rewardLine(null, n, 'Tangle')).toEqual({
        kind: 'milestone',
        text: `${n}-day Tangle streak: a milestone`,
      });
    expect(rewardLine(null, 26, 'Sweep')).toEqual({ kind: 'streak', text: '26-day Sweep streak' });
    expect(rewardLine(null, 2, 'Sweep')?.kind).toBe('streak');
    expect(rewardLine(null, 1, 'Sweep')).toBeNull();
    expect(dayStreak([{ value: '12', label: 'day streak' }])).toBe(12);
    expect(dayStreak([{ value: 3, label: 'best score' }])).toBe(0);
  });
  it('THEN each type’s recap has its label, and a lost round’s is THE ANSWER', () => {
    expect(recapLabel('sweep', true)).toBe('YOUR BOARD');
    expect(recapLabel('tangle', true)).toBe('YOUR WORDS');
    expect(recapLabel('mini', true)).toBe('YOUR GRID');
    expect(recapLabel('link', true)).toBe('THE GROUPS');
    expect(recapLabel('sweep', false)).toBe('THE ANSWER');
  });
  it('THEN a screen reader hears the outcome, the result, then the main line', () => {
    expect(spokenHero('0:31')).toBe('31 seconds');
    expect(spokenHero('1:01')).toBe('1 minute 1 second');
    expect(spokenHero('2:00')).toBe('2 minutes');
    expect(spokenHero('1:00:05')).toBe('1 hour 5 seconds');
    expect(spokenHero('0:00')).toBe('0 seconds');
    expect(announcement('Swept', '0:31', '26-day Sweep streak')).toBe(
      'Swept in 31 seconds. 26-day Sweep streak.',
    );
    expect(announcement('Boom.', '0:48', null)).toBe('Boom in 48 seconds.');
    expect(announcement('Time’s up', '46 points', null)).toBe('Time’s up, 46 points.');
  });
});

describe('GIVEN a finish sheet (design B3)', () => {
  const onNext = jest.fn();
  const onBack = jest.fn();
  const today = londonDay();
  let slotProps: BoardSlotProps[] = [];
  /** A stand-in for leagues' line: what the sheet passes it, and one line of text. */
  function FakeSlot(p: BoardSlotProps) {
    slotProps.push(p);
    return <Text testID="fake-league">1st in Noodlers today · See board ›</Text>;
  }
  const NoLeague = () => null;
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
    jest.clearAllMocks();
    resetSound();
    played.length = 0;
    slotProps = [];
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
      type="sweep"
      n="115"
      date={today}
      title="Swept"
      hero="0:31"
      note="All seven mines found."
      share="💣 Sweep 115 — 0:31 · 🔥26"
      path="reports/2026-11-08-logic-sweep-0115.html"
      stats={[
        { value: 26, label: 'day streak' },
        { value: 30, label: 'best streak' },
        { value: 40, label: 'Sweeps played' },
      ]}
      recap={{ title: 'The board', node: <Text>board</Text> }}
      onBack={onBack}
      onNext={onNext}
      {...p}
    />
  );
  const withSlot = (el: React.ReactElement, slot: BoardSlotComponent | null = FakeSlot) => (
    <BoardSlotProvider slot={slot}>{el}</BoardSlotProvider>
  );
  const PARTS = [
    'finish-share-button',
    'finish-kicker',
    'finish-hero',
    'finish-title',
    'finish-note',
    'finish-reward',
    'finish-reward-main',
    'finish-board-slot',
    'finish-next',
    'finish-recap',
    'finish-foot',
  ];
  const hidden = { includeHiddenElements: true };

  describe('WHEN a solved round’s sheet opens, in a league, on a streak', () => {
    it('THEN it reads Share, kicker, result, outcome, streak and league lines, Next, YOUR BOARD, footer', async () => {
      mockSite({ 'puzzles-today.json': list(today) });
      await renderWithProviders(withSlot(sheet()));
      await waitFor(() => expect(screen.getByText(/^Next: /)).toBeOnTheScreen());
      expect(screen.getByTestId('finish-kicker', hidden)).toHaveTextContent('SWEEP 115');
      expect(screen.getByTestId('finish-hero')).toHaveTextContent('0:31');
      expect(screen.getByTestId('finish-title')).toHaveTextContent('Swept');
      expect(screen.getByRole('header', { name: 'Sweep 115 · Swept' })).toBeOnTheScreen();
      expect(screen.getByTestId('finish-reward-main')).toHaveTextContent('26-day Sweep streak');
      expect(screen.getByTestId('finish-reward-icon-streak', hidden)).toBeTruthy();
      expect(screen.getByTestId('fake-league')).toHaveTextContent(
        '1st in Noodlers today · See board ›',
      );
      expect(slotProps.at(-1)).toMatchObject({
        path: 'reports/2026-11-08-logic-sweep-0115.html',
        type: 'sweep',
        date: today,
        solved: true,
        celebrate: false,
        lead: false,
      });
      expect(screen.getByText('0 of 3 done today')).toBeOnTheScreen();
      expect(screen.getByTestId('finish-next-icon').type).toBe('Image');
      expect(screen.getByTestId('finish-recap-label')).toHaveTextContent('YOUR BOARD');
      expect(screen.queryByText('The board')).toBeNull();
      expect(screen.getByTestId('finish-clock')).toHaveTextContent(
        /^(New Sweep in \d+h \d+m|New Sweep in \d+m|Today’s puzzles are out\.)$/,
      );
      expect(screen.getByRole('link', { name: 'How to play Sweep' })).toHaveTextContent(
        'How to play',
      );
      expect(order(PARTS)).toEqual([
        'finish-share-button',
        'finish-kicker',
        'finish-hero',
        'finish-title',
        'finish-reward',
        'finish-reward-main',
        'finish-board-slot',
        'finish-next',
        'finish-recap',
        'finish-foot',
      ]);
    });
    it('THEN the dropped parts are gone: the note, Share result button, stats and the old heading', async () => {
      await renderWithProviders(withSlot(sheet()));
      expect(screen.queryByText('All seven mines found.')).toBeNull();
      expect(screen.queryByText('💣 Sweep 115 — 0:31 · 🔥26')).toBeNull();
      expect(screen.queryByText('Share result')).toBeNull();
      expect(screen.queryByText('best streak')).toBeNull();
      expect(screen.queryByText(/Sweep 115, /)).toBeNull();
    });
  });

  describe('WHEN the result beats every earlier finish kept on the phone', () => {
    const saves = (...secs: number[]) =>
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({
          v: 1,
          done: Object.fromEntries(
            secs.map((x, k) => [`DP·MINI·0${k}`, { s: x, d: '2026-11-01' }]),
          ),
        }),
      );
    const mini = { type: 'mini' as const, n: '117', title: 'Solved', hero: '1:30' };
    it('THEN with three earlier finishes the main line is the gold-star best, over the streak', async () => {
      saves(90, 102, 130, 200);
      await renderWithProviders(withSlot(sheet(mini)));
      expect(screen.getByTestId('finish-reward-main')).toHaveTextContent(
        'Your fastest Mini yet, by 12s',
      );
      expect(screen.getByTestId('finish-reward-icon-pb', hidden)).toHaveTextContent('★');
      expect(screen.queryByText('26-day Mini streak')).toBeNull();
      expect(screen.getByTestId('fake-league')).toBeOnTheScreen();
    });
    it('THEN with only two earlier finishes it is still the streak', async () => {
      saves(90, 102, 130);
      await renderWithProviders(withSlot(sheet(mini)));
      expect(screen.getByTestId('finish-reward-main')).toHaveTextContent('26-day Mini streak');
    });
  });

  describe('WHEN the day streak reaches a milestone', () => {
    it('THEN the main line says so, with 🔥 on gold', async () => {
      await renderWithProviders(withSlot(sheet({ stats: [{ value: 30, label: 'day streak' }] })));
      expect(screen.getByTestId('finish-reward-main')).toHaveTextContent(
        '30-day Sweep streak: a milestone',
      );
      expect(screen.getByTestId('finish-reward-icon-milestone', hidden)).toHaveTextContent('🔥');
    });
  });

  describe('WHEN there is no streak to speak of', () => {
    it('THEN only the league line shows, and it may lead with its own disc', async () => {
      await renderWithProviders(withSlot(sheet({ stats: [{ value: 1, label: 'day streak' }] })));
      expect(screen.queryByTestId('finish-reward-main')).toBeNull();
      expect(screen.getByTestId('fake-league')).toBeOnTheScreen();
      expect(slotProps.at(-1)?.lead).toBe(true);
    });
  });

  describe('WHEN the round was lost (AF-015)', () => {
    it('THEN the outcome is coral, there is no reward, the board link is quiet, and THE ANSWER follows Next', async () => {
      await renderWithProviders(withSlot(sheet({ title: 'Boom.', solved: false, hero: '0:48' })));
      const word = screen.getByTestId('finish-title');
      expect(word).toHaveTextContent('Boom.');
      expect(StyleSheet.flatten(word.props.style).color).toBe(puzzleTokensFor('light').sheetBad);
      expect(screen.queryByTestId('finish-reward')).toBeNull();
      expect(screen.queryByTestId('finish-reward-main')).toBeNull();
      expect(slotProps.at(-1)).toMatchObject({ solved: false });
      expect(screen.getByTestId('finish-recap-label')).toHaveTextContent('THE ANSWER');
      expect(order(PARTS)).toEqual([
        'finish-share-button',
        'finish-kicker',
        'finish-hero',
        'finish-title',
        'finish-board-slot',
        'finish-next',
        'finish-recap',
        'finish-foot',
      ]);
    });
  });

  describe('WHEN the player is in no league', () => {
    it('THEN there is no second line: just the streak', async () => {
      await renderWithProviders(withSlot(sheet(), NoLeague));
      expect(screen.getByTestId('finish-reward-main')).toHaveTextContent('26-day Sweep streak');
      expect(screen.queryByText(/See board/)).toBeNull();
    });
  });

  describe('WHEN the puzzle is an earlier day’s, from the archive', () => {
    it('THEN the kicker says when, and the league line is given that day', async () => {
      const day = dayBefore(dayBefore(dayBefore(today)));
      await renderWithProviders(
        withSlot(sheet({ type: 'mini', n: '117', title: 'Solved', date: day })),
      );
      expect(screen.getByTestId('finish-kicker', hidden)).toHaveTextContent('MINI 117 · 3D AGO');
      expect(screen.getByRole('header', { name: 'Mini 117 · Solved, 3d ago' })).toBeOnTheScreen();
      expect(slotProps.at(-1)).toMatchObject({ date: day });
    });
  });

  describe('WHEN Share is tapped', () => {
    it('THEN the share sheet gets the line and the short link, with a spinner until it opens', async () => {
      let open!: () => void;
      const spy = jest.spyOn(Share, 'share').mockReturnValue(
        new Promise((r) => {
          open = () => r({ action: 'sharedAction', activityType: undefined });
        }),
      );
      await renderWithProviders(withSlot(sheet()));
      const pill = screen.getByRole('button', { name: 'Share result' });
      expect(pill).toHaveTextContent('Share');
      expect(StyleSheet.flatten(pill.props.style).minHeight).toBeGreaterThanOrEqual(44);
      await fireEvent.press(pill);
      expect(spy).toHaveBeenCalledWith({
        message: '💣 Sweep 115 — 0:31 · 🔥26\ndailynoodle.co.uk/sweep',
      });
      expect(screen.getByTestId('finish-share-button-spinner')).toBeOnTheScreen();
      await fireEvent.press(pill);
      expect(spy).toHaveBeenCalledTimes(1);
      await act(async () => open());
      expect(screen.queryByTestId('finish-share-button-spinner')).toBeNull();
    });
  });

  describe('WHEN it rises on a fresh finish', () => {
    it('THEN a screen reader hears “Swept in 31 seconds. 26-day Sweep streak.” and lands on the outcome', async () => {
      jest.useFakeTimers();
      const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation();
      const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation();
      await renderWithProviders(withSlot(sheet({ celebrate: true })));
      await act(async () => {
        jest.advanceTimersByTime(ANNOUNCE_MS);
      });
      expect(say).toHaveBeenCalledWith('Swept in 31 seconds. 26-day Sweep streak.');
      expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
      expect(slotProps.at(-1)?.celebrate).toBe(true);
      jest.useRealTimers();
    });
  });

  describe('WHEN it is a points puzzle (Tangle) with its best score', () => {
    it('THEN the unit is small after the points, the best is in points, and the longest word stays', async () => {
      appStorage.setItem(
        'digi-tangle-v1',
        JSON.stringify({ v: 1, done: { a: { s: 46 }, b: { s: 40 }, c: { s: 31 }, d: { s: 12 } } }),
      );
      await renderWithProviders(
        withSlot(
          sheet({
            type: 'tangle',
            n: '33',
            title: 'Time’s up',
            hero: '46 points',
            note: {
              before: '8 words, including the longest, ',
              bold: 'PLANTER',
              after: ', for 10 points.',
            },
            stats: [{ value: 4, label: 'day streak' }],
            recap: { title: 'Today’s words', node: <Text>words</Text> },
          }),
        ),
      );
      expect(screen.getByTestId('finish-hero')).toHaveTextContent('46 points');
      expect(screen.getByText(' points')).toBeOnTheScreen();
      expect(screen.getByTestId('finish-reward-main')).toHaveTextContent(
        'Your best Tangle yet, by 6 points',
      );
      expect(screen.getByTestId('finish-note')).toHaveTextContent(
        '8 words, including the longest, PLANTER, for 10 points.',
      );
      expect(screen.getByTestId('finish-recap-label')).toHaveTextContent('YOUR WORDS');
    });
  });

  describe('WHEN it is a Link', () => {
    it('THEN its picture stays, its note stays, there is no personal best, and Play again is last', async () => {
      await renderWithProviders(
        withSlot(
          sheet({
            type: 'link',
            n: '92',
            title: 'Linked',
            hero: 'Fish, Birds',
            heroNode: <Text testID="squares">squares</Text>,
            note: 'All four groups with one mistake. Birds caught you out.',
            stats: [{ value: 3, label: 'day streak' }],
            recap: { title: 'The groups', node: <Text>groups</Text> },
            after: <Text testID="again">Play again (not recorded)</Text>,
          }),
        ),
      );
      expect(screen.getByTestId('squares')).toBeOnTheScreen();
      expect(screen.getByTestId('finish-note')).toHaveTextContent(/Birds caught you out\.$/);
      expect(screen.getByTestId('finish-reward-main')).toHaveTextContent('3-day Link streak');
      expect(screen.getByTestId('finish-recap-label')).toHaveTextContent('THE GROUPS');
      expect(order([...PARTS, 'again'])).toEqual([
        'finish-share-button',
        'finish-kicker',
        'finish-hero',
        'finish-title',
        'finish-note',
        'finish-reward',
        'finish-reward-main',
        'finish-board-slot',
        'finish-next',
        'finish-recap',
        'again',
        'finish-foot',
      ]);
    });
  });

  describe('WHEN today’s list is kept and Next is tapped', () => {
    it('THEN it opens the next puzzle, even before the site answers', async () => {
      appStorage.setItem(TODAY_CACHE_KEY, JSON.stringify(list(today)));
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: { 'DP·MINI·0105': { s: 87 } } }),
      );
      mockSite({});
      await renderWithProviders(sheet({ type: 'mini', n: '105' }));
      const next = screen.getByRole('button', { name: 'Next: Doku 103' });
      expect(StyleSheet.flatten(next.props.style).minHeight).toBe(58);
      await fireEvent.press(next);
      expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ id: 'DP·LEXI·0103' }));
      expect(screen.getByText('1 of 3 done today')).toBeOnTheScreen();
      await fireEvent.press(screen.getByText('← Puzzles'));
      expect(onBack).toHaveBeenCalled();
    });
  });

  describe('WHEN every puzzle today is done', () => {
    it('THEN a quieter tonal “All 3 done / Try the archive” opens the Archive', async () => {
      appStorage.setItem(TODAY_CACHE_KEY, JSON.stringify(list(today)));
      appStorage.setItem('digi-mini-v1', JSON.stringify({ v: 1, done: { 'DP·MINI·0105': {} } }));
      appStorage.setItem('digi-doku-v1', JSON.stringify({ v: 1, done: { 'DP·LEXI·0103': {} } }));
      appStorage.setItem('digi-reckon-v1', JSON.stringify({ v: 1, done: { 'DP·RECK·0005': {} } }));
      mockSite({});
      await renderWithProviders(sheet());
      const btn = screen.getByRole('link', { name: 'All 3 done. Try the archive' });
      expect(btn).toHaveTextContent('All 3 doneTry the archive');
      expect(StyleSheet.flatten(btn.props.style).backgroundColor).toBe(
        tokensFor('light').accentSoft,
      );
      expect(screen.queryByTestId('finish-next-icon')).toBeNull();
      await fireEvent.press(btn);
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
      expect(screen.queryByTestId('finish-next-sub')).toBeNull();
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

// Alec, 7 Nov 2026: a played card shows its result where How to play was, so the rules sit here.
describe('GIVEN any finished puzzle', () => {
  describe('WHEN its finish sheet shows', () => {
    it('THEN its footer has How to play for that type, opening the guide at its section', async () => {
      mockSite({});
      await renderWithProviders(
        <FinishSheet
          type="mini"
          n="105"
          date="2026-10-24"
          title="Solved"
          hero="1:27"
          share="Mini 105 1:27"
          stats={[{ value: 1, label: 'day streak' }]}
          boardSlot={<Text>board</Text>}
          onBack={jest.fn()}
          onNext={jest.fn()}
        />,
      );
      const link = screen.getByRole('link', { name: 'How to play Mini' });
      expect(link).toHaveTextContent('How to play');
      await fireEvent.press(link);
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/how-to-play',
        params: { type: 'mini' },
      });
    });
  });
});
