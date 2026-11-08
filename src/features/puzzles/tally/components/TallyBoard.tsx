import { memo } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useRecapWidth } from '@/shared/finish-sheet';
import { FONT, usePuzzleTokens } from '@/shared/theme';

import { cellLabel, label, opSign, view, type CellView, type TallyState } from '../model';
import { ON_YELLOW, tallyColors, type TallyColors } from './colors';

const EDGE = 2.5;
/** The lines inside a cage: a full point, so they read on a phone (a hairline all but vanished). */
const INNER = 1;

/**
 * The board's lines, drawn over the squares on one shared grid (Alec, 8 Nov 2026): every
 * line between squares in the soft colour, then each cage wall in ink, run EDGE/2 past
 * both ends so walls meet cleanly at corners. Drawn per square, as borders, the walls
 * doubled where two cages met and kinked where a thick side met a thin one.
 */
export function cageLines(cells: readonly CellView[], n: number, size: number) {
  const inner: { key: string; left: number; top: number; width: number; height: number }[] = [];
  for (let k = 1; k < n; k++) {
    inner.push({
      key: `v${k}`,
      left: k * size - INNER / 2,
      top: 0,
      width: INNER,
      height: n * size,
    });
    inner.push({
      key: `h${k}`,
      left: 0,
      top: k * size - INNER / 2,
      width: n * size,
      height: INNER,
    });
  }
  const walls: typeof inner = [];
  cells.forEach((cell, i) => {
    const r = Math.floor(i / n);
    const c = i % n;
    if (cell.br && c < n - 1)
      walls.push({
        key: `r${i}`,
        left: (c + 1) * size - EDGE / 2,
        top: r * size - EDGE / 2,
        width: EDGE,
        height: size + EDGE,
      });
    if (cell.bb && r < n - 1)
      walls.push({
        key: `b${i}`,
        left: c * size - EDGE / 2,
        top: (r + 1) * size - EDGE / 2,
        width: size + EDGE,
        height: EDGE,
      });
  });
  return { inner, walls };
}

function CageLines({
  cells,
  n,
  size,
  ink,
  soft,
}: {
  cells: readonly CellView[];
  n: number;
  size: number;
  ink: string;
  soft: string;
}) {
  const { inner, walls } = cageLines(cells, n, size);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="tally-lines">
      {inner.map(({ key, ...box }) => (
        <View key={key} style={[styles.line, box, { backgroundColor: soft }]} />
      ))}
      {walls.map(({ key, ...box }) => (
        <View
          key={key}
          testID={`tally-wall-${key}`}
          style={[styles.line, box, { backgroundColor: ink }]}
        />
      ))}
    </View>
  );
}

interface SquareProps {
  i: number;
  state: TallyState;
  cell: CellView;
  size: number;
  tc: TallyColors;
  onCell: (i: number) => void;
}

function Square({ i, state, cell, size, tc, onCell }: SquareProps) {
  const pt = usePuzzleTokens();
  const won = state.solved;
  const bg = cell.sel ? pt.active : cell.cage ? tc.cage : cell.peer ? tc.peer : tc.cell;
  const ink = cell.sel ? ON_YELLOW.ink : pt.ink;
  const bad = cell.sel ? ON_YELLOW.bad : pt.bad;
  const good = cell.sel ? ON_YELLOW.good : pt.good;
  const value = won ? pt.good : cell.bad ? bad : cell.same ? tc.same : ink;
  const clueBase = cell.clueState === 'ok' ? good : cell.clueState === 'bad' ? bad : null;
  const notes = state.notes[i]!;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cellLabel(state, i, cell)}
      onPress={() => onCell(i)}
      testID={`tally-cell-${i}`}
      style={[styles.cell, { width: size, height: size, backgroundColor: bg }]}>
      {cell.clue ? (
        <View style={styles.clue} testID={`tally-clue-${i}`}>
          <Text
            maxFontSizeMultiplier={1.2}
            style={[styles.clueNum, { color: clueBase ?? (cell.sel ? ink : pt.inkSoft) }]}>
            {cell.clue.t}
          </Text>
          {cell.clue.op !== '=' ? (
            <Text
              maxFontSizeMultiplier={1.2}
              style={[styles.clueOp, { color: clueBase ?? (cell.sel ? ON_YELLOW.sign : tc.sign) }]}>
              {opSign(cell.clue.op)}
            </Text>
          ) : null}
        </View>
      ) : null}
      {cell.v ? (
        <Text
          maxFontSizeMultiplier={1.2}
          style={[
            styles.val,
            {
              color: value,
              fontSize: Math.min(40, Math.max(26, size * 0.42)),
              fontFamily: cell.same ? FONT.display : FONT.sansMedium,
            },
          ]}>
          {cell.v}
        </Text>
      ) : notes ? (
        <View style={styles.notes} testID={`tally-notes-${i}`}>
          {[1, 2, 3, 4].map((d) => (
            <Text
              key={d}
              maxFontSizeMultiplier={1.2}
              style={[styles.note, { color: ink, opacity: notes & (1 << d) ? 0.7 : 0 }]}>
              {d}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

/** The 4×4 board: cage lines, clues, the house yellow on the selected square. */
export const TallyBoard = memo(function TallyBoard({
  state,
  side,
  onCell,
}: {
  state: TallyState;
  side: number;
  onCell: (i: number) => void;
}) {
  const pt = usePuzzleTokens();
  const tc = tallyColors(useColorScheme() === 'dark');
  const cells = view(state);
  const size = (side - 6) / state.n;
  return (
    <View
      style={[styles.grid, { width: side, borderColor: pt.line, backgroundColor: pt.line }]}
      testID="tally-board">
      {Array.from({ length: state.n }, (_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: state.n }, (_c, c) => {
            const i = r * state.n + c;
            return (
              <Square
                key={i}
                i={i}
                state={state}
                cell={cells[i]!}
                size={size}
                tc={tc}
                onCell={onCell}
              />
            );
          })}
        </View>
      ))}
      <CageLines cells={cells} n={state.n} size={size} ink={pt.line} soft={tc.lineSoft} />
    </View>
  );
});

/** The answer on the finish sheet: the solved board with its cage lines. */
export function TallyRecap({ state }: { state: TallyState }) {
  const pt = usePuzzleTokens();
  const tc = tallyColors(useColorScheme() === 'dark');
  const w = Math.min(240, useRecapWidth());
  const size = (w - 6) / state.n;
  const cells = view(state);
  return (
    <View
      style={[
        styles.grid,
        { alignSelf: 'center', width: w, borderColor: pt.line, backgroundColor: pt.line },
      ]}
      testID="tally-recap">
      {Array.from({ length: state.n }, (_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: state.n }, (_c, c) => {
            const i = r * state.n + c;
            const cell = cells[i]!;
            return (
              <View
                key={i}
                style={[styles.cell, { width: size, height: size, backgroundColor: pt.card }]}>
                {cell.clue ? (
                  <Text
                    maxFontSizeMultiplier={1.2}
                    style={[styles.recapClue, { color: pt.inkSoft }]}>
                    {label(cell.clue)}
                  </Text>
                ) : null}
                <Text maxFontSizeMultiplier={1.2} style={[styles.recapVal, { color: pt.ink }]}>
                  {state.p.sol[i]}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
      <CageLines cells={cells} n={state.n} size={size} ink={pt.line} soft={tc.lineSoft} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { borderWidth: 3, borderRadius: 8, overflow: 'hidden', alignSelf: 'center' },
  row: { flexDirection: 'row' },
  line: { position: 'absolute' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  clue: {
    position: 'absolute',
    top: 3,
    left: 5,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
  },
  clueNum: { fontFamily: FONT.display, fontSize: 15 },
  clueOp: { fontFamily: FONT.display, fontSize: 19, lineHeight: 19 },
  val: { includeFontPadding: false },
  notes: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  note: { fontSize: 12, fontFamily: FONT.sans, flex: 1, textAlign: 'center' },
  recapClue: {
    position: 'absolute',
    top: 2,
    left: 4,
    fontSize: 11,
    fontFamily: FONT.display,
  },
  recapVal: { fontSize: 20, fontFamily: FONT.sansMedium },
  art: { width: 112, height: 112, borderRadius: 8, padding: 4, gap: 2 },
  artRow: { flex: 1, flexDirection: 'row', gap: 2 },
  artSq: { flex: 1, borderRadius: 2 },
});
