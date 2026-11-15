import { useMemo } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';
import { Chevron, pressable } from '@/shared/ui';

import { clue, letter, lineLabel, READ, type Clue, type TumblerState } from '../model';
import { tumblerColors } from './colors';

/** The tile's size for a board `width` wide (tumbler.css .board --t), at most 64. */
export const tileFor = (width: number) => Math.max(30, Math.min(64, Math.floor((width - 60) / 4)));

/**
 * A drag down `dy` from where the last step was taken (`from`): whether it is far enough for
 * one more step (60% of a tile, engines/tumbler.js swipe), and where the next one counts from.
 */
export function dragStep(dy: number, from: number, t: number): { turn: boolean; from: number } {
  return dy - from >= t * 0.6 ? { turn: true, from: dy } : { turn: false, from };
}

interface BoardProps {
  state: TumblerState;
  width: number;
  /** The line's letters turn green (the win beat, or a reopened board). */
  won?: boolean;
  onTurn: (k: number) => void;
}

/** One wheel: its tiles, the yellow line, a drag down turning it a step a tile. */
function Wheel({
  state,
  k,
  t,
  won,
  onTurn,
}: {
  state: TumblerState;
  k: number;
  t: number;
  won: boolean;
  onTurn: (k: number) => void;
}) {
  const pt = usePuzzleTokens();
  const tc = tumblerColors(useColorScheme() === 'dark');
  // A drag down turns the wheel a step for each 60% of a tile (engines/tumbler.js swipe).
  const pan = useMemo(() => {
    const drag = { y0: 0 };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        drag.y0 = 0;
      },
      onPanResponderMove: (_e, g) => {
        const step = dragStep(g.dy, drag.y0, t);
        drag.y0 = step.from;
        if (step.turn) onTurn(k);
      },
    });
  }, [k, t, onTurn]);
  return (
    <View
      {...pan.panHandlers}
      accessibilityLabel={`Wheel ${k + 1}`}
      style={[styles.wheel, { gap: 5 }]}
      testID={`tumbler-wheel-${k}`}>
      {Array.from({ length: state.size }, (_, i) => {
        const read = i === READ;
        return (
          <View
            key={i}
            accessible={read}
            accessibilityLabel={read ? lineLabel(state, k) : undefined}
            style={[
              styles.tile,
              {
                width: t * 1.25,
                height: t,
                backgroundColor: read ? (won ? tc.good : pt.activeWord) : pt.card,
                borderColor: read ? (won ? tc.good : pt.active) : pt.lineSoft,
                opacity: read ? 1 : 0.55,
              },
            ]}>
            <Text
              style={[
                styles.tileText,
                { fontSize: t * 0.48, color: read && won ? '#FFFFFF' : pt.ink },
              ]}>
              {letter(state, k, i)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** The four wheels and, under each, its down arrow (the page's #down1…#down4). */
export function TumblerBoard({ state, width, won = false, onTurn }: BoardProps) {
  const pt = usePuzzleTokens();
  const t = tileFor(width);
  const ks = Array.from({ length: state.p.n }, (_, k) => k);
  return (
    <View style={styles.board} testID="tumbler-board">
      <View style={styles.row}>
        {ks.map((k) => (
          <Wheel key={k} state={state} k={k} t={t} won={won} onTurn={onTurn} />
        ))}
      </View>
      <View style={styles.row}>
        {ks.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={`Turn wheel ${k + 1} down`}
            disabled={state.solved}
            onPress={() => onTurn(k)}
            style={pressable([
              styles.down,
              { width: t * 1.25, borderColor: pt.lineSoft, backgroundColor: pt.card },
            ])}
            testID={`tumbler-down-${k}`}>
            <Chevron color={pt.ink} dir="down" size={9} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** A submitted word with its clues (the page's #tries .r): green, amber, grey. */
export function TryRow({ word, secret, label }: { word: string; secret: string; label?: string }) {
  const tc = tumblerColors(useColorScheme() === 'dark');
  const pt = usePuzzleTokens();
  const bg = (c: Clue) => (c === 'g' ? tc.good : c === 'a' ? tc.amber : tc.miss);
  const fg = (c: Clue) => (c === 'a' ? tc.onAmber : c === 'g' ? tc.onClue : pt.ink);
  const said = (c: Clue) => (c === 'g' ? 'right wheel' : c === 'a' ? 'another wheel' : 'not in it');
  const cs = clue(word, secret);
  return (
    <View
      accessible
      accessibilityLabel={`${word.toUpperCase()}: ${cs.map((c, i) => `${word[i]!.toUpperCase()} ${said(c)}`).join(', ')}`}
      style={styles.tryRow}
      testID={`tumbler-try-${word}`}>
      {cs.map((c, i) => (
        <View key={i} style={[styles.clue, { backgroundColor: bg(c) }]}>
          <Text style={[styles.clueText, { color: fg(c) }]}>{word[i]!.toUpperCase()}</Text>
        </View>
      ))}
      {label ? <Text style={[styles.tryLabel, { color: pt.inkSoft }]}>{label}</Text> : null}
    </View>
  );
}

/** The finish sheet's recap: the hidden word, then the submits that found it. */
export function TumblerRecap({ secret, tries }: { secret: string; tries: readonly string[] }) {
  const tc = tumblerColors(useColorScheme() === 'dark');
  return (
    <View style={styles.recap} testID="tumbler-recap">
      <View style={styles.tryRow}>
        {[...secret].map((ch, i) => (
          <View key={i} style={[styles.clue, styles.big, { backgroundColor: tc.good }]}>
            <Text style={[styles.clueText, styles.bigText, { color: tc.onClue }]}>
              {ch.toUpperCase()}
            </Text>
          </View>
        ))}
      </View>
      {tries.map((w) => (
        <TryRow key={w} word={w} secret={secret} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { alignItems: 'center', gap: 7 },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  wheel: { alignItems: 'center' },
  tile: { borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: FONT.sansSemi },
  down: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryRow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center' },
  clue: { width: 34, height: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  clueText: { fontFamily: FONT.sansSemi, fontSize: 17 },
  big: { width: 44, height: 44 },
  bigText: { fontSize: 22 },
  tryLabel: { fontFamily: FONT.sans, fontSize: 12, marginLeft: 8 },
  recap: { gap: 6, alignItems: 'flex-start' },
});
