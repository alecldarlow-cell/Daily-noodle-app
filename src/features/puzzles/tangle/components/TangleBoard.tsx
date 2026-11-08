'use no memo';
// React Compiler (app.json experiments.reactCompiler) caches a component while its props are
// unchanged. Tangle hands its screens the engine, one object mutated in place, so a compiled
// screen never redrew: the 3-2-1 count-in froze on 3 on a phone (25 Oct 2026). Jest runs
// without the compiler, so only a device showed it.

import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PuzzleBar } from '@/shared/start-card';
import { FONT, usePuzzleTokens } from '@/shared/theme';
import { pressable } from '@/shared/ui';

import { useAnnounce } from '../../link/hooks/announce';
import { boardTop, current, foundList, N, type Rect, type TangleEngine } from '../model';
import { useTangleColors } from './colors';

const GAP = 8;
/** The largest the board grows (the page's `min(100%, 400px, …)`, kept at the app's 420). */
const MAX_SIDE = 420;
/**
 * Everything above the letters keeps one height for the whole round, so the board never
 * moves under a finger: the found words get their full room from the start (scrolling
 * inside it), and the traced word and its toast each have a line of their own.
 */
export const LIST_H = 150;
export const WORD_H = 32;
export const TOAST_H = 20;
/** The traced word's outlined slot: the word, its toast, the dashed edge's 1.5 pt a side and a breath. */
export const CUR_H = WORD_H + TOAST_H + 4;

/** The tiles' rectangles for a square board `side` wide, in the board's own coordinates. */
export function tileRects(side: number): Rect[] {
  const w = (side - GAP * (N - 1)) / N;
  return Array.from({ length: N * N }, (_, i) => ({
    left: (i % N) * (w + GAP),
    top: Math.floor(i / N) * (w + GAP),
    width: w,
    height: w,
  }));
}

interface TangleBoardProps {
  /** Tangle's streak, for the bar. */
  streak: number;
  engine: TangleEngine;
  setRects: (r: Rect[]) => void;
  onHome: () => void;
}

/**
 * The board's side: the room it is given, both ways, so a short phone keeps the bottom row
 * on screen (the page caps it by the viewport's height too), and never over MAX_SIDE.
 */
export function boardSide(width: number, height: number): number {
  return Math.max(0, Math.min(width, height, MAX_SIDE));
}

const centre = (r: Rect): [number, number] => [r.left + r.width / 2, r.top + r.height / 2];

/** The thread between the traced tiles' centres, as straight bars (the page's polyline). */
function Thread({ path, rects, color }: { path: number[]; rects: Rect[]; color: string }) {
  const bars = [];
  for (let k = 1; k < path.length; k++) {
    const [x1, y1] = centre(rects[path[k - 1]!]!);
    const [x2, y2] = centre(rects[path[k]!]!);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    bars.push(
      <View
        key={k}
        pointerEvents="none"
        style={[
          styles.bar,
          {
            backgroundColor: color,
            width: len,
            left: (x1 + x2) / 2 - len / 2,
            top: (y1 + y2) / 2 - 5,
            transform: [{ rotate: `${deg}deg` }],
          },
        ]}
      />,
    );
  }
  return <>{bars}</>;
}

/**
 * The round on screen (the page's #play): the puzzles' bar (back pauses, name, streak, the
 * clock), the time bar with the score and words, the star pill, the words found, the traced word with its toast, and the
 * board. Tracing uses the touch responder on the board, handing the engine the same
 * press, moves and release the page's pointer events give it; the engine hit-tests
 * them against the tiles' rectangles exactly as the page does.
 */
export function TangleBoard({ engine, setRects, onHome, streak }: TangleBoardProps) {
  const pt = usePuzzleTokens();
  const tc = useTangleColors();
  const s = engine.s;
  const top = boardTop(engine);
  const cur = current(engine);
  const list = foundList(engine);
  const [side, setSide] = useState(0);
  const rects = useMemo(() => tileRects(side), [side]);
  const playing = !!s.R && s.R.state === 'playing';
  const hide = s.counting || (s.paused && playing);
  const veil = s.paused && playing;

  const onLayout = (ev: LayoutChangeEvent) => {
    const { width, height } = ev.nativeEvent.layout;
    const w = boardSide(width, height);
    setSide(w);
    setRects(tileRects(w));
  };
  const at = (ev: GestureResponderEvent): [number, number] => [
    ev.nativeEvent.locationX,
    ev.nativeEvent.locationY,
  ];
  const toastOn = s.toast.cls.startsWith('on');
  const toastColor = s.toast.cls.includes('gold')
    ? pt.goldInk
    : s.toast.cls.includes('good')
      ? pt.good
      : pt.bad;
  // AF-027: a word not accepted is named ("FOAM isn't in today's list"); the model keeps
  // the page's own toast, which the replay compares.
  const toastText =
    s.toast.text === "Not in today's list" && s.missed
      ? `${s.missed.toUpperCase()} isn’t in today’s list`
      : s.toast.text;
  useAnnounce(toastOn ? toastText : '', `${toastOn}|${toastText}|${top.score}|${top.words}`);
  /** A screen reader's double-tap on a tile: a tap there, as the page's tap-to-build has it. */
  const tapTile = (i: number) => {
    const [x, y] = centre(rects[i]!);
    engine.down(x, y);
    engine.up();
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="tangle-board">
      <View style={styles.in}>
        <PuzzleBar
          name={`Tangle ${engine.P.n}`}
          sub={engine.P.band}
          streak={streak}
          clock={top.clock}
          urgent={top.low}
          onBack={onHome}
        />
        <View style={styles.ptop}>
          <View style={[styles.timebar, { backgroundColor: pt.lineSoft }]}>
            <View
              style={[
                styles.timefill,
                { backgroundColor: top.low ? pt.bad : pt.brand, width: `${top.fill * 100}%` },
              ]}
            />
          </View>
          <Text
            style={[styles.small, { color: pt.inkSoft }]}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel={`${top.score} points, ${top.words}`}>
            <Text style={[styles.score, { color: pt.ink }]} testID="tangle-score">
              {top.score}
            </Text>
            {` pts · ${top.words}`}
          </Text>
        </View>
        <View
          testID="tangle-pill"
          style={[
            styles.pill,
            top.starGot
              ? { backgroundColor: pt.goldTint, borderColor: pt.gold }
              : { backgroundColor: pt.card, borderColor: pt.card },
          ]}>
          <Text
            numberOfLines={1}
            style={[styles.pillText, { color: top.starGot ? pt.goldInk : pt.inkSoft }]}>
            {top.star}
          </Text>
        </View>
        <ScrollView style={styles.list} contentContainerStyle={styles.listIn} testID="tangle-list">
          {list.map((g) => (
            <View key={g.len} style={styles.grp}>
              <View style={styles.grpHead}>
                <Text style={[styles.small, { color: pt.inkSoft }]}>{g.label}</Text>
                <Text style={[styles.small, { color: pt.inkSoft }]}>{g.count}</Text>
              </View>
              <View style={styles.ws}>
                {g.words.map((w) => (
                  <Text
                    key={w.w}
                    testID={`tangle-word-${w.w}`}
                    style={[
                      styles.w,
                      w.star
                        ? { color: pt.goldInk, backgroundColor: pt.goldTint, borderColor: pt.gold }
                        : { color: pt.ink, backgroundColor: pt.card, borderColor: pt.card },
                      w.bonus && styles.bon,
                    ]}>
                    {w.w}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={[styles.cur, { borderColor: pt.lineSoft }]} testID="tangle-cur">
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[
              styles.curWord,
              { color: cur.idle ? pt.inkSoft : pt.ink },
              cur.idle && styles.idle,
            ]}
            testID="tangle-current">
            {cur.idle ? cur.text : cur.text.toUpperCase()}
          </Text>
          <View style={styles.toastSlot}>
            {toastOn ? (
              <Text
                numberOfLines={1}
                accessibilityLiveRegion="polite"
                style={[styles.toast, { color: toastColor }]}
                testID="tangle-toast">
                {toastText}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.boardWrap} onLayout={onLayout} testID="tangle-board-wrap">
          <View
            testID="tangle-grid"
            style={[styles.board, { width: side, height: side }]}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(ev) => {
              const [x, y] = at(ev);
              engine.down(x, y);
            }}
            onResponderMove={(ev) => engine.move([at(ev)])}
            onResponderRelease={() => engine.up()}
            onResponderTerminate={() => engine.cancel()}>
            {side > 0
              ? engine.P.tiles.map((t, i) => {
                  const r = rects[i]!;
                  const on = s.path.includes(i);
                  const last = on && s.path[s.path.length - 1] === i;
                  // The word just entered: its tiles flash (AF-027), under any new trace.
                  const fl =
                    !on && s.flash && s.flash.tiles.includes(i) ? tc.flash[s.flash.cls] : null;
                  return (
                    <View
                      key={i}
                      pointerEvents="none"
                      testID={`tangle-tile-${i}`}
                      // Each tile is a button to a screen reader (the grid, one element,
                      // could not be played): its letter, whether it is in the word, and a
                      // double-tap that taps it, so a word is built and entered tile by tile.
                      accessible={!hide}
                      accessibilityElementsHidden={hide}
                      importantForAccessibility={hide ? 'no-hide-descendants' : 'yes'}
                      accessibilityRole="button"
                      accessibilityLabel={t === 'QU' ? 'Qu' : t}
                      accessibilityHint={
                        last
                          ? 'Double-tap again to enter the word'
                          : 'Double-tap to add to the word'
                      }
                      accessibilityState={{ selected: on }}
                      accessibilityActions={[{ name: 'activate' }]}
                      onAccessibilityAction={(e) => {
                        if (e.nativeEvent.actionName === 'activate') tapTile(i);
                      }}
                      style={[
                        styles.tile,
                        {
                          left: r.left,
                          top: r.top,
                          width: r.width,
                          height: r.height,
                          backgroundColor: last
                            ? tc.thread
                            : on
                              ? tc.threadT
                              : fl
                                ? fl.bg
                                : pt.card,
                          borderColor: on ? tc.thread : fl ? fl.edge : pt.lineSoft,
                          borderWidth: last ? 3 : on || fl ? 2 : 1,
                        },
                      ]}>
                      {hide ? null : (
                        <Text
                          maxFontSizeMultiplier={1.2}
                          style={[styles.letter, { color: last ? tc.onThread : pt.ink }]}>
                          {t === 'QU' ? 'Qu' : t}
                        </Text>
                      )}
                    </View>
                  );
                })
              : null}
            <Thread path={s.path} rects={rects} color={tc.thread} />
            {s.counting && s.count ? (
              <View style={styles.overlay} pointerEvents="none">
                <Text style={[styles.count, { color: pt.ink }]} testID="tangle-count">
                  {s.count}
                </Text>
              </View>
            ) : null}
            {veil ? (
              <View style={styles.overlay}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => engine.resume()}
                  testID="tangle-resume"
                  style={pressable([styles.resume, { backgroundColor: pt.brand }])}>
                  <Text style={styles.resumeText}>Resume</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  in: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  ptop: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
  chev: { fontSize: 26, lineHeight: 28, fontFamily: FONT.sansSemi },
  score: { fontSize: 20, fontFamily: FONT.display, fontVariant: ['tabular-nums'] },
  small: { fontFamily: FONT.sans, fontSize: 13 },
  timebar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  timefill: { height: 6 },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pillText: { fontSize: 13, fontFamily: FONT.sansSemi },
  list: { flexGrow: 0, flexShrink: 0, height: LIST_H },
  listIn: { gap: 6 },
  grp: { gap: 4 },
  grpHead: { flexDirection: 'row', justifyContent: 'space-between' },
  ws: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  w: {
    fontFamily: FONT.sans,
    fontSize: 14,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  bon: { fontStyle: 'italic' },
  // A fixed, outlined slot: the traced word always has its place, so nothing jumps.
  cur: {
    height: CUR_H,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  curWord: {
    height: WORD_H,
    lineHeight: WORD_H,
    fontSize: 22,
    fontFamily: FONT.display,
    letterSpacing: 1,
  },
  idle: { fontSize: 14, fontFamily: FONT.sans, letterSpacing: 0 },
  toastSlot: { height: TOAST_H, justifyContent: 'center' },
  toast: { fontSize: 14, fontFamily: FONT.display },
  // The board sits at the bottom of the spare height, in thumb reach (AF-032).
  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  board: { position: 'relative' },
  tile: { position: 'absolute', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 32, fontFamily: FONT.display },
  // The page's polyline: 10 px wide, at half strength over the tiles.
  bar: { position: 'absolute', height: 10, borderRadius: 5, opacity: 0.5 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 88, fontFamily: FONT.displayHeavy },
  resume: { borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12 },
  resumeText: { color: '#FFFFFF', fontSize: 17, fontFamily: FONT.displayHeavy },
});
