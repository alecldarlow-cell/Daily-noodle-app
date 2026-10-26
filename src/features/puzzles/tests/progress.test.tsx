import { createSaveStore } from '@noodle/core';
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { createCachedStorage, type CachedStorage } from '@/shared/storage';

import { useDokuGame } from '../doku/hooks/useDokuGame';
import type { Move as DokuMove } from '../doku/model';
import { clone as cloneDoku, doku97, file97, openSquares } from '../doku/tests/fixtures';
import { useMiniGame } from '../mini/hooks/useMiniGame';
import type { Move as MiniMove } from '../mini/model';
import { file105, mini105 } from '../mini/tests/fixtures';
import { usePathGame } from '../path/hooks/usePathGame';
import type { Move as PathMove } from '../path/model';
import { file92, path92 } from '../path/tests/fixtures';
import {
  clearProgress,
  isMoveOf,
  MAX_MOVES,
  progressKey,
  readProgress,
  resumeRound,
  type ProgressType,
} from '../progress';
import { useSweepGame } from '../sweep/hooks/useSweepGame';
import type { Move as SweepMove } from '../sweep/model';
import { file94 } from '../sweep/tests/fixtures';
import type { PuzzleFile } from '../types';

const NOW = Date.parse('2026-10-26T08:30:00Z');

const memoryStore = (): CachedStorage =>
  createCachedStorage({
    getAllKeys: async () => [],
    multiGet: async () => [],
    setItem: async () => undefined,
  });

let store: CachedStorage;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  store = memoryStore();
});
afterEach(() => {
  jest.useRealTimers();
});

const deps = () => ({ store, saves: createSaveStore(store, { now: () => Date.now() }) });
const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

/** Each game hook as the progress tests drive it: dispatch, the board, the clock. */
interface Game {
  phase: string;
  info: unknown;
  clock: string;
  state: object;
  dispatch: (m: never) => void;
  play: () => void;
}

interface Case {
  type: ProgressType;
  file: PuzzleFile<{ id: string }>;
  use: (file: PuzzleFile<never>, d: ReturnType<typeof deps>) => Game;
  /** A few moves: the round started, not finished. */
  some: (g: () => Game) => unknown[];
  /** Moves that finish it from a fresh board. */
  finish: (g: () => Game) => unknown[];
  /** The part of the state a resumed board must match. */
  board: (s: object) => unknown;
}

const pathAt: [number, number][] = [];
path92.solution.forEach((row, r) => row.forEach((v, c) => (pathAt[v] = [r, c])));
const SWEEP_START = 22;
const SWEEP_MINES = [2, 4, 13, 19, 26, 33, 35];

const cases: Case[] = [
  {
    type: 'mini',
    file: file105,
    use: (f, d) => useMiniGame(f as never, d) as unknown as Game,
    some: () => [
      { t: 'cell', r: 0, c: 0 },
      { t: 'key', ch: 'M' },
      { t: 'key', ch: 'O' },
    ],
    finish: () => {
      const out: MiniMove[] = [];
      mini105.grid.forEach((row, r) =>
        row.forEach((ch, c) => {
          if (ch !== '#') out.push({ t: 'cell', r, c }, { t: 'key', ch });
        }),
      );
      return out;
    },
    board: (s) => (s as { entries: unknown; sel: unknown }).entries,
  },
  {
    type: 'doku',
    file: file97,
    use: (f, d) => useDokuGame(f as never, d) as unknown as Game,
    some: (g) => {
      const tiles = (g().state as { tiles: { id: string; ch: string; at: unknown }[] }).tiles;
      const [r, c] = openSquares(doku97)[0]!;
      const t = tiles.find((x) => !x.at && x.ch === doku97.grid[r]![c])!;
      return [
        { t: 'tile', id: t.id },
        { t: 'cell', r, c },
      ] satisfies DokuMove[];
    },
    finish: (g) => {
      const tiles = cloneDoku(
        (g().state as { tiles: { id: string; ch: string; at: unknown }[] }).tiles,
      );
      const out: DokuMove[] = [];
      for (const [r, c] of openSquares(doku97)) {
        const t = tiles.find((x) => !x.at && x.ch === doku97.grid[r]![c])!;
        t.at = [r, c];
        out.push({ t: 'tile', id: t.id }, { t: 'cell', r, c });
      }
      return out;
    },
    board: (s) => (s as { entries: unknown }).entries,
  },
  {
    type: 'sweep',
    file: file94,
    use: (f, d) => useSweepGame(f as never, d) as unknown as Game,
    some: () =>
      [
        { t: 'tap', i: SWEEP_START },
        { t: 'press', i: 2 },
      ] satisfies SweepMove[],
    finish: () => [
      { t: 'tap', i: SWEEP_START },
      ...Array.from({ length: 36 }, (_, i) => i)
        .filter((i) => !SWEEP_MINES.includes(i) && i !== SWEEP_START)
        .map((i): SweepMove => ({ t: 'tap', i })),
    ],
    board: (s) => {
      const o = s as { revealed: Set<number>; flagged: Set<number> };
      return { revealed: [...o.revealed].sort(), flagged: [...o.flagged].sort() };
    },
  },
  {
    type: 'path',
    file: file92,
    use: (f, d) => usePathGame(f as never, d) as unknown as Game,
    some: () => [1, 2, 3].map((v): PathMove => ({ t: 'cell', r: pathAt[v]![0], c: pathAt[v]![1] })),
    finish: () =>
      Array.from({ length: 35 }, (_, k) => k + 1).map(
        (v): PathMove => ({ t: 'cell', r: pathAt[v]![0], c: pathAt[v]![1] }),
      ),
    board: (s) => (s as { cellValue: unknown }).cellValue,
  },
];

async function open(c: Case) {
  const d = deps();
  const h = await renderHook(() => c.use(c.file as PuzzleFile<never>, d));
  return { ...h, g: () => h.result.current };
}

async function playMoves(g: () => Game, moves: unknown[]) {
  for (const m of moves) {
    // Sweep skips squares the flood has already opened, as a player would.
    const st = g().state as { revealed?: Set<number> };
    const mm = m as { t: string; i?: number };
    if (mm.t === 'tap' && st.revealed?.has(mm.i!)) continue;
    await act(async () => g().dispatch(m as never));
  }
}

describe.each(cases)('GIVEN a $type round', (c) => {
  describe('WHEN it is left partway, with time on the clock, and opened again', () => {
    it('THEN the board and the time come back, on the board rather than the start card', async () => {
      const first = await open(c);
      expect(first.g().phase).toBe('start');
      await act(async () => first.g().play());
      await playMoves(first.g, c.some(first.g));
      await wait(5000);
      const board = c.board(first.g().state);
      const clock = first.g().clock;
      expect(clock).toMatch(/0:0[45]/);
      await first.unmount();
      expect(store.getItem(progressKey(c.type))).toContain(c.file.data.id);

      const again = await open(c);
      expect(again.g().phase).toBe('play');
      expect(c.board(again.g().state)).toEqual(board);
      expect(again.g().clock).toBe(clock);
      // And the clock carries on from there.
      await wait(3000);
      expect(again.g().clock).not.toBe(clock);
    });
  });

  describe('WHEN a move is made', () => {
    it('THEN the round is kept at once, under its puzzle', async () => {
      const { g } = await open(c);
      await act(async () => g().play());
      const moves = c.some(g);
      await playMoves(g, moves);
      const p = readProgress(store, c.type, c.file.data.id, (x): x is unknown => !!x);
      expect(p?.moves).toEqual(c.type === 'sweep' ? moves.map((m) => ({ m, s: 0 })) : moves);
    });
  });

  describe('WHEN the app goes to the background partway, after time has passed', () => {
    it('THEN the round is written with the time at that moment', async () => {
      const listeners: ((s: string) => void)[] = [];
      const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
        listeners.push(fn as (s: string) => void);
        return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
      });
      const { g } = await open(c);
      await act(async () => g().play());
      await playMoves(g, c.some(g));
      await wait(7000);
      await act(async () => listeners.forEach((fn) => fn('background')));
      const p = readProgress(store, c.type, c.file.data.id, (x): x is unknown => !!x);
      expect(p?.secs).toBeGreaterThanOrEqual(7);
      spy.mockRestore();
    });
  });

  describe('WHEN it is finished', () => {
    it('THEN the kept round is cleared', async () => {
      const { g } = await open(c);
      await act(async () => g().play());
      const moves = c.finish(g);
      await playMoves(g, moves.slice(0, 2));
      expect(store.getItem(progressKey(c.type))).toContain(c.file.data.id);
      await playMoves(g, moves.slice(2));
      expect(g().info).toBeTruthy();
      expect(store.getItem(progressKey(c.type))).toBe('');
    });
  });

  describe('WHEN its kept round is not something we can read', () => {
    it.each([
      ['not JSON', '{not json'],
      ['the wrong shape', JSON.stringify({ v: 1, id: c.file.data.id, secs: 'x', moves: [] })],
      [
        'an unknown move',
        JSON.stringify({ v: 1, id: c.file.data.id, secs: 3, moves: [{ t: 'zap' }] }),
      ],
      ['a newer format', JSON.stringify({ v: 2, id: c.file.data.id, secs: 3, moves: [] })],
    ])('THEN (%s) it opens fresh on its start card', async (_why, raw) => {
      store.setItem(progressKey(c.type), raw);
      const { g } = await open(c);
      expect(g().phase).toBe('start');
      expect(g().clock).toMatch(/^0?0:00$/);
    });
  });

  describe('WHEN another puzzle’s round is kept and this one opens', () => {
    it('THEN this one starts fresh and the other round is left alone', async () => {
      const other = JSON.stringify({ v: 1, id: 'DP·OTHER·0001', secs: 40, moves: [] });
      store.setItem(progressKey(c.type), other);
      const { g } = await open(c);
      expect(g().phase).toBe('start');
      expect(store.getItem(progressKey(c.type))).toBe(other);
    });
  });
});

describe('GIVEN a kept round read back', () => {
  const isAny = (x: unknown): x is unknown => x !== undefined;

  it('THEN one longer than any real round is refused', () => {
    store.setItem(
      progressKey('mini'),
      JSON.stringify({ v: 1, id: 'a', secs: 1, moves: Array(MAX_MOVES + 1).fill({}) }),
    );
    expect(readProgress(store, 'mini', 'a', isAny)).toBeNull();
  });

  it('THEN a negative time or a non-object is refused, and seconds are whole', () => {
    store.setItem(progressKey('mini'), JSON.stringify({ v: 1, id: 'a', secs: -1, moves: [] }));
    expect(readProgress(store, 'mini', 'a', isAny)).toBeNull();
    store.setItem(progressKey('mini'), '7');
    expect(readProgress(store, 'mini', 'a', isAny)).toBeNull();
    store.setItem(progressKey('mini'), JSON.stringify({ v: 1, id: 'a', secs: 4.7, moves: [] }));
    expect(readProgress(store, 'mini', 'a', isAny)?.secs).toBe(4);
  });

  it('THEN a round the model can’t play back is dropped, not half-applied', () => {
    store.setItem(progressKey('path'), JSON.stringify({ v: 1, id: 'a', secs: 1, moves: [1] }));
    const boom = () => {
      throw new Error('bad move');
    };
    expect(resumeRound(store, 'path', 'a', {}, boom, isAny)).toBeNull();
    expect(store.getItem(progressKey('path'))).toBe('');
  });

  it('THEN clearing leaves another puzzle’s round, and clears an unreadable one', () => {
    store.setItem(progressKey('doku'), JSON.stringify({ v: 1, id: 'b', secs: 1, moves: [] }));
    clearProgress(store, 'doku', 'a');
    expect(store.getItem(progressKey('doku'))).toContain('"b"');
    store.setItem(progressKey('doku'), '{oops');
    clearProgress(store, 'doku', 'a');
    expect(store.getItem(progressKey('doku'))).toBe('');
    clearProgress(store, 'doku', 'a');
    expect(store.getItem(progressKey('doku'))).toBe('');
  });

  it('THEN a move must be a known one with every field it needs', () => {
    const spec = { cell: { r: 'number', c: 'number' }, del: {} } as const;
    expect(isMoveOf(spec, { t: 'cell', r: 1, c: 2 })).toBe(true);
    expect(isMoveOf(spec, { t: 'del' })).toBe(true);
    expect(isMoveOf(spec, { t: 'cell', r: 1 })).toBe(false);
    expect(isMoveOf(spec, { t: 'cell', r: NaN, c: 1 })).toBe(false);
    expect(isMoveOf(spec, { t: 'toString' })).toBe(false);
    expect(isMoveOf(spec, null)).toBe(false);
    expect(isMoveOf(spec, 'cell')).toBe(false);
  });
});
