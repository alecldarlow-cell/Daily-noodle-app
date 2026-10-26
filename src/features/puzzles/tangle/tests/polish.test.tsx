import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, AppState } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { hold, release } from '../../link/tests/press';
import { boardSide, tileRects } from '../components/TangleBoard';
import { TangleScreen } from '../components/TangleScreen';
import { findPath } from '../oracle';
import { file19, tangle19 } from './fixtures';
import { PRESSED } from '@/shared/ui';

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
async function open(width: number, height: number) {
  await renderWithProviders(<TangleScreen file={file19} />);
  await fireEvent.press(screen.getByTestId('play-card'));
  await fireEvent(screen.getByTestId('tangle-board-wrap'), 'layout', {
    nativeEvent: { layout: { width, height, x: 0, y: 0 } },
  });
  await run(3100);
}
async function trace(w: string, side = 400) {
  const rects = tileRects(side);
  const at = (i: number) => ({
    nativeEvent: {
      locationX: rects[i]!.left + rects[i]!.width / 2,
      locationY: rects[i]!.top + rects[i]!.height / 2,
    },
  });
  const p = findPath(tangle19, w)!;
  const grid = screen.getByTestId('tangle-grid');
  await fireEvent(grid, 'responderGrant', at(p[0]!));
  for (const i of p.slice(1)) await fireEvent(grid, 'responderMove', at(i));
  await fireEvent(grid, 'responderRelease', at(p.at(-1)!));
}
const activate = (i: number) =>
  fireEvent(screen.getByTestId(`tangle-tile-${i}`), 'accessibilityAction', {
    nativeEvent: { actionName: 'activate' },
  });

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

describe('GIVEN the board’s size', () => {
  it('THEN it is the smaller of the room’s width and height, never over 420', () => {
    expect(boardSide(375, 600)).toBe(375);
    expect(boardSide(375, 260)).toBe(260);
    expect(boardSide(800, 900)).toBe(420);
    expect(boardSide(-1, 300)).toBe(0);
  });

  describe('WHEN a short phone leaves less height than width', () => {
    it('THEN the board fits the height, so its bottom row stays on screen', async () => {
      await open(347, 260);
      expect(screen.getByTestId('tangle-grid')).toHaveStyle({ width: 260, height: 260 });
      const last = tileRects(260)[15]!;
      expect(last.top + last.height).toBeLessThanOrEqual(260);
      expect(screen.getByTestId('tangle-tile-15')).toHaveStyle({ top: last.top });
      await trace('ago', 260);
      expect(screen.getByTestId('tangle-toast')).toHaveTextContent('+1 AGO');
    });
  });
});

describe('GIVEN the longest word found', () => {
  it('THEN its chip, the pill and the toast take the recap’s gold tokens, never a bare gold', async () => {
    await open(400, 400);
    await trace('original');
    expect(screen.getByTestId('tangle-word-original')).toHaveStyle({
      backgroundColor: '#FFEFB8',
      borderColor: '#E0A100',
      color: '#5C4300',
    });
    expect(screen.getByTestId('tangle-pill')).toHaveStyle({
      backgroundColor: '#FFEFB8',
      borderColor: '#E0A100',
    });
    expect(screen.getByTestId('tangle-toast')).toHaveStyle({ color: '#5C4300' });
  });
});

describe('GIVEN a screen reader', () => {
  describe('WHEN the letters are read', () => {
    it('THEN each tile is a button with its letter, and the grid is not one lump', async () => {
      await open(400, 400);
      const tile = screen.getByTestId('tangle-tile-0');
      expect(tile).toHaveProp('accessible', true);
      expect(tile).toHaveProp('accessibilityRole', 'button');
      const t0 = tangle19.tiles[0]!;
      expect(tile).toHaveProp('accessibilityLabel', t0 === 'QU' ? 'Qu' : t0);
      expect(screen.getByTestId('tangle-grid')).not.toHaveProp('accessible', true);
    });
  });

  describe('WHEN a word is built by double-tapping its tiles and the last one again (on iOS)', () => {
    it('THEN it is entered, its tiles show as selected on the way, and the toast is announced', async () => {
      const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      await open(400, 400);
      const p = findPath(tangle19, 'ago')!;
      for (const i of p) await activate(i);
      expect(screen.getByTestId(`tangle-tile-${p[0]!}`)).toHaveProp('accessibilityState', {
        selected: true,
      });
      expect(screen.getByTestId('tangle-current')).toHaveTextContent('AGO');
      await activate(p.at(-1)!);
      expect(screen.getByTestId('tangle-toast')).toHaveTextContent('+1 AGO');
      expect(screen.getByTestId('tangle-toast')).toHaveProp('accessibilityLiveRegion', 'polite');
      expect(say).toHaveBeenCalledWith('+1 AGO');
    });
  });

  describe('WHEN the letters are hidden for the count-in', () => {
    it('THEN the tiles are hidden from the screen reader too', async () => {
      await renderWithProviders(<TangleScreen file={file19} />);
      await fireEvent.press(screen.getByTestId('play-card'));
      await fireEvent(screen.getByTestId('tangle-board-wrap'), 'layout', {
        nativeEvent: { layout: { width: 400, height: 400, x: 0, y: 0 } },
      });
      expect(screen.getByTestId('tangle-count')).toBeOnTheScreen();
      expect(screen.getByTestId('tangle-tile-0', { includeHiddenElements: true })).toHaveProp(
        'accessible',
        false,
      );
    });
  });
});

describe('GIVEN the back button', () => {
  it('THEN it dims while pressed', async () => {
    await open(400, 400);
    const b = screen.getByTestId('tangle-back');
    await hold(b);
    expect(b).toHaveStyle(PRESSED);
    await release(b);
  });
});
