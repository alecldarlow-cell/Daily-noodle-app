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
    expect(tangleColorsFor('light')).toEqual({
      thread: '#2E5BFF',
      threadT: '#D9E2FF',
      onThread: '#FFFFFF',
    });
    expect(tangleColorsFor('dark')).toEqual({
      thread: '#6E8BFF',
      threadT: '#25305C',
      onThread: '#FFFFFF',
    });
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
