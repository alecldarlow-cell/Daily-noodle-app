import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { useReduceMotion } from '@/shared/motion';
import { FONT, usePuzzleTokens } from '@/shared/theme';
import { Chevron, pressable } from '@/shared/ui';

import {
  clue,
  letter,
  lineLabel,
  READ,
  wheelMarks,
  type Clue,
  type Mark,
  type TumblerState,
} from '../model';
import { tumblerColors } from './colors';

/**
 * What sits under and around the seven tiles when the screen is `height` tall: the tile gaps,
 * the down arrows, Submit, the message and the latest submit (Alec, 16 Nov 2026: a tester's
 * submits sat below the screen, so they stay in view).
 */
export const BOARD_CHROME = 6 * 5 + 7 + 44 + 8 + 12 + 50 + 12 + 20 + 12 + 34 + 12;

/**
 * The tile's size for a board `width` wide (tumbler.css .board --t), at most 64; given the
 * `height` the screen body has, small enough that Submit and the latest submit fit under it.
 */
export const tileFor = (width: number, height?: number) =>
  Math.max(
    30,
    Math.min(
      64,
      Math.floor((width - 60) / 4),
      height ? Math.floor((height - BOARD_CHROME) / 7) : 64,
    ),
  );

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
  /** The height the screen body has, so the latest submit stays in view. */
  height?: number;
  /** The line's letters turn green (the win beat, or a reopened board). */
  won?: boolean;
  onTurn: (k: number) => void;
  /** Tap to pick: bring the letter at row i of wheel k to the line. */
  onPick?: (k: number, i: number) => void;
}

/** The gap between a wheel's tiles. */
const GAP = 5;
/** Tap to pick's glide (engines/tumbler.js pick): 150 ms plus 75 ms a tile, eased. */
export const glideMs = (d: number) => 150 + 75 * Math.abs(d);
const GLIDE_EASE = Easing.bezier(0.22, 0.8, 0.3, 1);
/** The pulse once the letter lands (tumbler.css dn-tumbler-land): up to 1.12 and back. */
export const PULSE_MS = 420;

/**
 * How a tile looks: the line outlined in ink (so green, amber and grey only ever mean clues), and
 * the submits' marks (model.ts wheelMarks; engines/tumbler.css k-g, k-x, k-n, k-a).
 */
function tileLook(
  mark: Mark,
  read: boolean,
  won: boolean,
  c: { card: string; ink: string; lineSoft: string; good: string; amber: string; miss: string },
) {
  if (read && won)
    return {
      bg: c.good,
      border: c.good,
      width: 2.5,
      dashed: false,
      opacity: 1,
      fg: '#FFFFFF',
      dot: false,
    };
  const edge = read ? c.ink : c.lineSoft;
  const width = read ? 2.5 : 1.5;
  switch (mark) {
    case 'g':
      return {
        bg: c.good,
        border: read ? c.ink : c.good,
        width,
        dashed: false,
        opacity: 1,
        fg: '#FFFFFF',
        dot: false,
      };
    case 'x':
      return read
        ? { bg: c.miss, border: c.ink, width, dashed: false, opacity: 1, fg: c.ink, dot: false }
        : {
            bg: 'transparent',
            border: edge,
            width,
            dashed: true,
            opacity: 0.28,
            fg: c.ink,
            dot: false,
          };
    case 'n':
      return read
        ? {
            bg: c.amber,
            border: c.ink,
            width,
            dashed: false,
            opacity: 1,
            fg: '#141726',
            dot: false,
          }
        : {
            bg: 'transparent',
            border: edge,
            width,
            dashed: true,
            opacity: 0.28,
            fg: c.ink,
            dot: true,
          };
    default:
      return {
        bg: c.card,
        border: edge,
        width,
        dashed: false,
        opacity: read ? 1 : 0.55,
        fg: c.ink,
        dot: mark === 'a',
      };
  }
}

/**
 * One wheel: its tiles, the outlined line, a drag down turning it a step a tile, and a tap on a
 * letter bringing it to the line (Alec, 26 Nov 2026): the wheel is drawn at its new position
 * at once, slid back to where it was, then glides home and the line's letter pulses.
 */
function Wheel({
  state,
  k,
  t,
  won,
  marks,
  onTurn,
  onPick,
}: {
  state: TumblerState;
  k: number;
  t: number;
  won: boolean;
  marks: (k: number, L: string) => Mark;
  onTurn: (k: number) => void;
  onPick?: (k: number, i: number) => void;
}) {
  const pt = usePuzzleTokens();
  const tc = tumblerColors(useColorScheme() === 'dark');
  const reduce = useReduceMotion();
  const [slide] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const seen = useRef(state.glide?.seq ?? 0);
  const glide = state.glide;
  // Set before the frame is drawn, so the new letters never flash in place before gliding.
  useLayoutEffect(() => {
    const seq = glide?.seq ?? 0;
    if (!glide || seq === seen.current) return;
    seen.current = seq;
    if (glide.k !== k || reduce !== false) return;
    slide.setValue(-glide.d * (t + GAP));
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(slide, {
        toValue: 0,
        duration: glideMs(glide.d),
        easing: GLIDE_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 1,
        duration: PULSE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [glide, k, t, reduce, slide, pulse]);
  const lift = pulse.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1.12, 1] });
  const ring = pulse.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 0] });
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
      style={styles.wheelClip}
      testID={`tumbler-wheel-${k}`}>
      <Animated.View style={[styles.wheel, { gap: GAP, transform: [{ translateY: slide }] }]}>
        {Array.from({ length: state.size }, (_, i) => {
          const read = i === READ;
          const L = letter(state, k, i);
          const mark = marks(k, L);
          const look = tileLook(mark, read, won, { ...pt, ...tc });
          return (
            <Animated.View
              key={i}
              style={read ? { transform: [{ scale: lift }] } : undefined}
              testID={read ? `tumbler-line-${k}` : undefined}>
              {read ? (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.ring, { borderRadius: 14, borderColor: pt.brand, opacity: ring }]}
                />
              ) : null}
              <Pressable
                accessible
                accessibilityRole={read ? undefined : 'button'}
                accessibilityLabel={read ? lineLabel(state, k) : `Bring ${L} to the line`}
                disabled={read || state.solved || !onPick}
                onPress={() => onPick?.(k, i)}
                style={[
                  styles.tile,
                  {
                    width: t * 1.25,
                    height: t,
                    backgroundColor: look.bg,
                    borderColor: look.border,
                    borderWidth: look.width,
                    borderStyle: look.dashed ? 'dashed' : 'solid',
                    opacity: look.opacity,
                  },
                ]}
                testID={`tumbler-tile-${k}-${i}`}>
                <Text style={[styles.tileText, { fontSize: t * 0.48, color: look.fg }]}>{L}</Text>
                {look.dot ? (
                  <View
                    style={[
                      styles.dot,
                      {
                        top: t * 0.1,
                        right: t * 0.12,
                        width: t * 0.16,
                        height: t * 0.16,
                        borderRadius: t * 0.08,
                        backgroundColor: tc.amber,
                      },
                    ]}
                    testID={`tumbler-dot-${k}-${i}`}
                  />
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

/** The four wheels and, under each, its down arrow (the page's #down1…#down4). */
export function TumblerBoard({ state, width, height, won = false, onTurn, onPick }: BoardProps) {
  const pt = usePuzzleTokens();
  const t = tileFor(width, height);
  const marks = useMemo(() => wheelMarks(state), [state]);
  const ks = Array.from({ length: state.p.n }, (_, k) => k);
  return (
    <View style={styles.board} testID="tumbler-board">
      <View style={styles.row}>
        {ks.map((k) => (
          <Wheel
            key={k}
            state={state}
            k={k}
            t={t}
            won={won}
            marks={marks}
            onTurn={onTurn}
            onPick={onPick}
          />
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
  // Letters gliding past the top or bottom are hidden; the side room keeps the pulse's ring.
  wheelClip: {
    overflow: 'hidden',
    paddingHorizontal: 6,
    marginHorizontal: -6,
    paddingVertical: 4,
    marginVertical: -4,
  },
  wheel: { alignItems: 'center' },
  ring: { position: 'absolute', top: -4, bottom: -4, left: -4, right: -4, borderWidth: 3 },
  tile: { borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute' },
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
