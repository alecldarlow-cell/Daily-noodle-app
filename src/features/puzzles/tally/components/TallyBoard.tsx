import { memo } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useRecapWidth } from '@/shared/finish-sheet';
import { FONT, usePuzzleTokens } from '@/shared/theme';

import { cellLabel, label, opSign, view, type CellView, type TallyState } from '../model';
import { ON_YELLOW, tallyColors, type TallyColors } from './colors';

const EDGE = 2.5;

/** The square's four sides: a thick dark line on a cage's edge, a hairline inside it. */
function edges(c: CellView, ink: string, soft: string) {
  const side = (on: boolean) => ({ w: on ? EDGE : StyleSheet.hairlineWidth, c: on ? ink : soft });
  const [t, b, l, r] = [side(c.bt), side(c.bb), side(c.bl), side(c.br)];
  return {
    borderTopWidth: t.w,
    borderTopColor: t.c,
    borderBottomWidth: b.w,
    borderBottomColor: b.c,
    borderLeftWidth: l.w,
    borderLeftColor: l.c,
    borderRightWidth: r.w,
    borderRightColor: r.c,
  };
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
      style={[
        styles.cell,
        { width: size, height: size, backgroundColor: bg },
        edges(cell, pt.line, tc.lineSoft),
      ]}>
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
                style={[
                  styles.cell,
                  { width: size, height: size, backgroundColor: pt.card },
                  edges(cell, pt.line, tc.lineSoft),
                ]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { borderWidth: 3, borderRadius: 8, overflow: 'hidden', alignSelf: 'center' },
  row: { flexDirection: 'row' },
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
