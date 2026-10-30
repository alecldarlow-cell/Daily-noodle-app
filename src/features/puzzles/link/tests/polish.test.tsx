import { londonDay } from '@noodle/core';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import * as RN from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { boardFont } from '../components/LinkBoard';
import { useBoardColors } from '../components/LinkParts';
import { LinkScreen } from '../components/LinkScreen';
import { useAnnounce } from '../hooks/announce';
import {
  allTiles,
  apply,
  init,
  PAST_NOTE,
  REPLAY_NOTE,
  shownLabel,
  shownMsg,
  STREAK_KEY,
} from '../model';
import { clone, file78, link78 } from './fixtures';
import { hold, release } from './press';
import { PRESSED } from '@/shared/ui';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

/** Noon on 26 Oct 2026: Link 78 (25 Oct) is yesterday's, an archive puzzle. */
const NOW = new Date('2026-10-26T12:00:00Z');
const TODAY = '2026-10-26';
const G = link78.groups.map((g) => g.members);

const clear = () => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
};
async function run(ms: number) {
  for (let t = 0; t < ms; t += 100)
    await act(async () => {
      jest.advanceTimersByTime(Math.min(100, ms - t));
    });
}
const press = async (name: string) => {
  await fireEvent.press(screen.getByRole('button', { name }));
};
/** Today's streak entry is in: another Link has been played today. */
const playedToday = (streak = 2) =>
  appStorage.setItem(
    STREAK_KEY,
    JSON.stringify({ last: TODAY, streak, best: 5, dates: [TODAY], tz: 'L' }),
  );

beforeEach(() => {
  clear();
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  mockSite({});
});
afterEach(async () => {
  await run(100);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('GIVEN the board’s display-only wording', () => {
  const fresh = (ranked: boolean) => init(link78, allTiles(link78), { ranked, rec: null });

  describe('WHEN a past Link is opened for the first time after today’s result is in', () => {
    it('THEN it is not called a replay and its note says it won’t change the streak; the state is the page’s', () => {
      const s = fresh(false);
      expect(s.label).toBe(true);
      expect(s.msg.text).toBe(REPLAY_NOTE);
      expect(shownLabel(s, true)).toBe(false);
      expect(shownMsg(s, true)).toEqual({ text: PAST_NOTE, tone: '' });
    });
  });

  describe('WHEN it is today’s Link, or a past one that will still count', () => {
    it('THEN the page’s words are kept', () => {
      expect(shownLabel(fresh(false), false)).toBe(true);
      expect(shownMsg(fresh(false), false).text).toBe(REPLAY_NOTE);
      expect(shownLabel(fresh(true), true)).toBe(false);
      // AF-028: a first go waits with the hint until the clock starts (was '').
      expect(shownMsg(fresh(true), true)).toEqual({
        text: 'Starts when you tap a word',
        tone: 'wait',
      });
    });
  });

  describe('WHEN a past Link is played again after a loss', () => {
    it('THEN that second go is a replay', () => {
      const lost = { ...fresh(false), over: true, won: false, replayStarted: false };
      const again = apply(lost, { t: 'again', order: allTiles(link78) });
      expect(shownLabel(again, true)).toBe(true);
    });
  });
});

describe('GIVEN an archive Link never played, with today’s Link result already in', () => {
  describe('WHEN its board opens', () => {
    it('THEN the bar says no replay and the line says it won’t change the streak', async () => {
      playedToday();
      await renderWithProviders(<LinkScreen file={file78} />);
      await press('Play');
      expect(screen.getByText('medium')).toBeOnTheScreen();
      expect(screen.queryByText('medium · replay')).toBeNull();
      expect(screen.getByTestId('link-msg')).toHaveTextContent(PAST_NOTE);
      expect(screen.queryByText(REPLAY_NOTE)).toBeNull();
    });
  });
});

describe('GIVEN today’s Link, with today’s result already in', () => {
  it('THEN it still reads as the page has it: a replay with the page’s note', async () => {
    playedToday();
    const today = { ...clone(file78), date: londonDay(NOW) };
    await renderWithProviders(<LinkScreen file={today} />);
    await press('Play');
    expect(screen.getByText('medium · replay')).toBeOnTheScreen();
    expect(screen.getByTestId('link-msg')).toHaveTextContent(REPLAY_NOTE);
  });
});

describe('GIVEN Link’s streak', () => {
  describe('WHEN it is alive (last played today)', () => {
    it('THEN the bar’s flame shows it, as the start card does', async () => {
      playedToday(3);
      await renderWithProviders(<LinkScreen file={file78} />);
      expect(screen.getByText('3-day streak')).toBeOnTheScreen();
      await press('Play');
      expect(screen.getByLabelText('3-day streak')).toHaveTextContent('🔥3');
    });
  });

  describe('WHEN it has lapsed (last played a week ago)', () => {
    it('THEN the bar shows no flame, as the start card shows none', async () => {
      appStorage.setItem(
        STREAK_KEY,
        JSON.stringify({ last: '2026-10-19', streak: 6, best: 6, dates: ['2026-10-19'] }),
      );
      await renderWithProviders(<LinkScreen file={file78} />);
      expect(screen.queryByText('6-day streak')).toBeNull();
      await press('Play');
      expect(screen.queryByLabelText(/day streak/)).toBeNull();
    });
  });
});

describe('GIVEN Link’s board in play', () => {
  describe('WHEN a wrong four is entered (on iOS)', () => {
    it('THEN the line is announced to VoiceOver and the mistakes left are read with their count', async () => {
      const say = jest.spyOn(RN.AccessibilityInfo, 'announceForAccessibility');
      await renderWithProviders(<LinkScreen file={file78} />);
      await press('Play');
      expect(screen.getByTestId('link-lives')).toHaveProp('accessible', true);
      expect(screen.getByLabelText('4 mistakes left')).toBeOnTheScreen();
      for (const w of [G[0]![0]!, G[0]![1]!, G[1]![0]!, G[2]![0]!])
        await fireEvent.press(screen.getByTestId(`tile-${w}`));
      await press('Submit');
      await run(300);
      expect(say).toHaveBeenCalledWith('Not a group');
      expect(screen.getByTestId('link-msg')).toHaveProp('accessibilityLiveRegion', 'polite');
      expect(screen.getByLabelText('3 mistakes left')).toBeOnTheScreen();
    });
  });

  describe('WHEN a button or tile is held down', () => {
    it('THEN it dims while pressed and comes back on release', async () => {
      await renderWithProviders(<LinkScreen file={file78} />);
      await press('Play');
      const shuffle = screen.getByTestId('link-shuffle');
      await hold(shuffle);
      expect(shuffle).toHaveStyle(PRESSED);
      await release(shuffle);
      expect(shuffle).not.toHaveStyle(PRESSED);
      const tile = screen.getByTestId(`tile-${G[0]![0]!}`);
      await hold(tile);
      expect(tile).toHaveStyle(PRESSED);
      await release(tile);
    });
  });

  describe('WHEN the tiles are drawn', () => {
    it('THEN every tile shares one font size, never each its own', async () => {
      await renderWithProviders(<LinkScreen file={file78} />);
      await press('Play');
      const sizes = new Set(
        G.flat().map((w) => {
          const style = RN.StyleSheet.flatten(screen.getByText(w).props.style) as {
            fontSize: number;
          };
          return style.fontSize;
        }),
      );
      expect(sizes.size).toBe(1);
    });
  });
});

describe('GIVEN the one tile font size (link.js fitFont)', () => {
  it('THEN it is set by the longest word, between 12 and 18 pt, and the same for every tile', () => {
    // A 375 pt phone's tile is about 80 pt wide.
    expect(boardFont(['AXE', 'BOW', 'SWORD'], 80)).toBe(18);
    const long = boardFont(['MARROW', 'KOHLRABI', 'LEEK'], 80);
    expect(long).toBeLessThan(15);
    expect(long).toBeGreaterThanOrEqual(12);
    expect(boardFont(['SPINNAKER', 'MARROW'], 80)).toBe(boardFont(['SPINNAKER'], 80));
    expect(boardFont(['ICE CREAM'], 80)).toBe(boardFont(['CREAM'], 80));
    expect(boardFont(['SPINNAKERS'], 40)).toBe(12);
  });
  it('THEN before the board is measured it is 15 pt, and at a large text size it leaves room for it', () => {
    expect(boardFont(['AXE'], 0)).toBe(15);
    expect(boardFont([], 80)).toBe(15);
    expect(boardFont(['AXE'], 80, 2)).toBeCloseTo(18);
    expect(boardFont(['MARROW', 'KOHLRABI'], 80, 1.3) * 1.3).toBeCloseTo(
      boardFont(['MARROW', 'KOHLRABI'], 80),
    );
  });
});

describe('GIVEN the board’s colours', () => {
  describe('WHEN the phone is in dark mode', () => {
    it('THEN the hardest group is light with paper text, and a wrong four is a soft red tint', async () => {
      jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
      const { result } = await renderHook(() => useBoardColors());
      expect(result.current.fill[4]).toBe('#ECEEF4');
      expect(result.current.on[4]).toBe('#11131A');
      expect(result.current.missBg).toBe('rgba(255,122,110,0.16)');
    });
  });
  describe('WHEN it is in light mode', () => {
    it('THEN the hardest group is ink and a wrong four the pale red slab', async () => {
      jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
      const { result } = await renderHook(() => useBoardColors());
      expect(result.current.fill[4]).toBe('#141726');
      expect(result.current.missBg).toBe('#FBE3E0');
    });
  });
});

describe('GIVEN a line of feedback to announce', () => {
  function Line({ text, k }: { text: string; k?: string }) {
    useAnnounce(text, k);
    return null;
  }
  it('THEN it is said on iOS when it changes, never on first show, for an empty line or on Android', async () => {
    const say = jest.spyOn(RN.AccessibilityInfo, 'announceForAccessibility');
    say.mockClear();
    const r = await render(<Line text="Hello" />);
    expect(say).not.toHaveBeenCalled();
    await r.rerender(<Line text="One away" />);
    expect(say).toHaveBeenLastCalledWith('One away');
    await r.rerender(<Line text="One away" k="2" />);
    expect(say).toHaveBeenCalledTimes(2);
    await r.rerender(<Line text="" />);
    expect(say).toHaveBeenCalledTimes(2);
    const os = RN.Platform.OS;
    Object.defineProperty(RN.Platform, 'OS', { value: 'android', configurable: true });
    await r.rerender(<Line text="Not a group" />);
    Object.defineProperty(RN.Platform, 'OS', { value: os, configurable: true });
    expect(say).toHaveBeenCalledTimes(2);
  });
});
