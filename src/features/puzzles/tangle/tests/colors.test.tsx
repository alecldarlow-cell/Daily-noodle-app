import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AppState, StyleSheet } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { tangleColorsFor } from '../components/colors';
import { tileRects } from '../components/TangleBoard';
import { TangleScreen } from '../components/TangleScreen';
import { findPath } from '../oracle';
import { file19, tangle19 } from './fixtures';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockScheme,
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

async function run(ms: number) {
  for (let t = 0; t < ms; t += 500)
    await act(async () => {
      jest.advanceTimersByTime(Math.min(500, ms - t));
    });
}

/** Open the board and hold a trace part-way along a real word (no release). */
async function holdTrace(word: string) {
  await renderWithProviders(<TangleScreen file={file19} />);
  await fireEvent.press(screen.getByTestId('play-card'));
  await fireEvent(screen.getByTestId('tangle-board-wrap'), 'layout', {
    nativeEvent: { layout: { width: 400, height: 400, x: 0, y: 0 } },
  });
  await run(3100);
  const rects = tileRects(400);
  const at = (i: number) => ({
    nativeEvent: {
      locationX: rects[i]!.left + rects[i]!.width / 2,
      locationY: rects[i]!.top + rects[i]!.height / 2,
    },
  });
  const p = findPath(tangle19, word)!;
  const grid = screen.getByTestId('tangle-grid');
  await fireEvent(grid, 'responderGrant', at(p[0]!));
  for (const i of p.slice(1)) await fireEvent(grid, 'responderMove', at(i));
  return p;
}
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.useFakeTimers();
  mockSite({});
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(
      () => ({ remove: () => undefined }) as ReturnType<typeof AppState.addEventListener>,
    );
});
afterEach(async () => {
  await run(500);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('GIVEN Tangle’s colours', () => {
  it('THEN they are the page’s blue thread, light and dark (engines/tangle.css)', () => {
    expect(tangleColorsFor('light')).toMatchObject({
      thread: '#2E5BFF',
      threadT: '#D9E2FF',
      onThread: '#FFFFFF',
    });
    expect(tangleColorsFor('dark')).toMatchObject({
      thread: '#6E8BFF',
      threadT: '#25305C',
      onThread: '#FFFFFF',
    });
  });
  it('THEN a word’s flash takes tangle.css’s .tile.good, .tile.gold and .tile.meh (AF-027)', () => {
    expect(tangleColorsFor('light').flash).toEqual({
      good: { bg: '#D3F0E3', edge: '#1F9E6B' },
      gold: { bg: '#FFF0B8', edge: '#FFC21A' },
      meh: { bg: '#E1E4EC', edge: '#D3D6E0' },
    });
    expect(tangleColorsFor('dark').flash.good).toEqual({ bg: '#173A2C', edge: '#4CC793' });
  });

  describe.each(['light', 'dark'] as const)('WHEN a word is being traced in %s mode', (s) => {
    it('THEN the traced tiles are blue-tinted with a blue edge, the last one solid blue with a white letter, and no marigold', async () => {
      mockScheme = s;
      const c = tangleColorsFor(s);
      const p = await holdTrace('original');
      const last = p.at(-1)!;
      for (const i of p.slice(0, -1)) {
        expect(flat(`tangle-tile-${i}`)).toMatchObject({
          backgroundColor: c.threadT,
          borderColor: c.thread,
        });
      }
      expect(flat(`tangle-tile-${last}`)).toMatchObject({
        backgroundColor: c.thread,
        borderColor: c.thread,
      });
      const letter = within(screen.getByTestId(`tangle-tile-${last}`)).getByText(
        tangle19.tiles[last]!,
      );
      expect(letter).toHaveStyle({ color: c.onThread });
      for (let i = 0; i < 16; i++) {
        const st = flat(`tangle-tile-${i}`);
        expect([st.backgroundColor, st.borderColor]).not.toContain('#FFD54A');
      }
    });
  });
});

describe('GIVEN a word entered on the native board (AF-027)', () => {
  describe.each(['light', 'dark'] as const)('WHEN it is accepted, in %s mode', (s) => {
    it('THEN its tiles flash green for about 420 ms, then go back', async () => {
      mockScheme = s;
      const c = tangleColorsFor(s);
      const p = await holdTrace('ago');
      await fireEvent(screen.getByTestId('tangle-grid'), 'responderRelease', {});
      for (const i of p)
        expect(flat(`tangle-tile-${i}`)).toMatchObject({
          backgroundColor: c.flash.good.bg,
          borderColor: c.flash.good.edge,
        });
      await run(500);
      expect(flat(`tangle-tile-${p[0]}`).backgroundColor).not.toBe(c.flash.good.bg);
    });
  });

  describe('WHEN it is the star word', () => {
    it('THEN its tiles flash gold', async () => {
      const c = tangleColorsFor('light');
      mockScheme = 'light';
      await holdTrace('original');
      await fireEvent(screen.getByTestId('tangle-grid'), 'responderRelease', {});
      expect(flat(`tangle-tile-${tangle19.starPath[0]}`)).toMatchObject({
        backgroundColor: c.flash.gold.bg,
      });
    });
  });

  describe('WHEN it isn’t in today’s list', () => {
    it('THEN the tiles flash grey and the message names it, in red', async () => {
      mockScheme = 'light';
      const c = tangleColorsFor('light');
      await renderWithProviders(<TangleScreen file={file19} />);
      await fireEvent.press(screen.getByTestId('play-card'));
      await fireEvent(screen.getByTestId('tangle-board-wrap'), 'layout', {
        nativeEvent: { layout: { width: 400, height: 400, x: 0, y: 0 } },
      });
      await run(3100);
      const rects = tileRects(400);
      const at = (i: number) => ({
        nativeEvent: {
          locationX: rects[i]!.left + rects[i]!.width / 2,
          locationY: rects[i]!.top + rects[i]!.height / 2,
        },
      });
      const grid = screen.getByTestId('tangle-grid');
      await fireEvent(grid, 'responderGrant', at(0));
      await fireEvent(grid, 'responderMove', at(1));
      await fireEvent(grid, 'responderMove', at(2));
      await fireEvent(grid, 'responderRelease', {});
      const word = [0, 1, 2].map((i) => tangle19.tiles[i]!).join('');
      expect(screen.getByTestId('tangle-toast')).toHaveTextContent(`${word} isn’t in today’s list`);
      expect(flat('tangle-toast').color).toBe('#E4483B');
      expect(flat('tangle-tile-1')).toMatchObject({ backgroundColor: c.flash.meh.bg });
    });
  });
});
