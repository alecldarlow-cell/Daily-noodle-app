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

import { usePuzzleTokens } from '@/shared/theme';

import { boardTop, current, foundList, N, type Rect, type TangleEngine } from '../model';

const GAP = 8;
const GOLD = '#E0A800';

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
  engine: TangleEngine;
  setRects: (r: Rect[]) => void;
  onHome: () => void;
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
            top: (y1 + y2) / 2 - 3,
            transform: [{ rotate: `${deg}deg` }],
          },
        ]}
      />,
    );
  }
  return <>{bars}</>;
}

/**
 * The round on screen (the page's #play): back (pause), score and words, the clock and
 * its bar, the star pill, the words found, the traced word with its toast, and the
 * board. Tracing uses the touch responder on the board, handing the engine the same
 * press, moves and release the page's pointer events give it; the engine hit-tests
 * them against the tiles' rectangles exactly as the page does.
 */
export function TangleBoard({ engine, setRects, onHome }: TangleBoardProps) {
  const pt = usePuzzleTokens();
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
    const w = Math.min(ev.nativeEvent.layout.width, 420);
    setSide(w);
    setRects(tileRects(w));
  };
  const at = (ev: GestureResponderEvent): [number, number] => [
    ev.nativeEvent.locationX,
    ev.nativeEvent.locationY,
  ];
  const toastOn = s.toast.cls.startsWith('on');
  const toastColor = s.toast.cls.includes('gold')
    ? GOLD
    : s.toast.cls.includes('good')
      ? pt.good
      : pt.bad;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="tangle-board">
      <View style={styles.in}>
        <View style={styles.ptop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause and go back"
            onPress={onHome}
            style={[styles.iconBtn, { borderColor: pt.lineSoft, backgroundColor: pt.card }]}>
            <Text style={[styles.chev, { color: pt.ink }]}>‹</Text>
          </Pressable>
          <View style={styles.scorebox}>
            <Text style={[styles.score, { color: pt.ink }]} testID="tangle-score">
              {top.score}
            </Text>
            <Text style={[styles.small, { color: pt.inkSoft }]}>{`pts · ${top.words}`}</Text>
          </View>
          <Text
            style={[styles.clock, { color: top.low ? pt.bad : pt.ink }]}
            accessibilityRole="timer"
            testID="tangle-clock">
            {top.clock}
          </Text>
        </View>
        <View style={[styles.timebar, { backgroundColor: pt.lineSoft }]}>
          <View
            style={[
              styles.timefill,
              { backgroundColor: top.low ? pt.bad : pt.brand, width: `${top.fill * 100}%` },
            ]}
          />
        </View>
        <View style={[styles.pill, { backgroundColor: top.starGot ? GOLD : pt.card }]}>
          <Text style={[styles.pillText, { color: top.starGot ? '#141726' : pt.inkSoft }]}>
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
                    style={[
                      styles.w,
                      { color: pt.ink, backgroundColor: w.star ? GOLD : pt.card },
                      w.bonus && styles.bon,
                    ]}>
                    {w.w}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.cur}>
          <Text
            style={[
              styles.curWord,
              { color: cur.idle ? pt.inkSoft : pt.ink },
              cur.idle && styles.idle,
            ]}
            testID="tangle-current">
            {cur.idle ? cur.text : cur.text.toUpperCase()}
          </Text>
          {toastOn ? (
            <Text style={[styles.toast, { color: toastColor }]} testID="tangle-toast">
              {s.toast.text}
            </Text>
          ) : null}
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
                  return (
                    <View
                      key={i}
                      pointerEvents="none"
                      testID={`tangle-tile-${i}`}
                      style={[
                        styles.tile,
                        {
                          left: r.left,
                          top: r.top,
                          width: r.width,
                          height: r.height,
                          backgroundColor: on ? pt.activeWord : pt.card,
                          borderColor: last ? pt.active : on ? pt.active : pt.lineSoft,
                          borderWidth: last ? 3 : on ? 2 : 1,
                        },
                      ]}>
                      {hide ? null : (
                        <Text style={[styles.letter, { color: pt.ink }]}>
                          {t === 'QU' ? 'Qu' : t}
                        </Text>
                      )}
                    </View>
                  );
                })
              : null}
            <Thread path={s.path} rects={rects} color={pt.active} />
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
                  style={[styles.resume, { backgroundColor: pt.brand }]}>
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
  ptop: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chev: { fontSize: 26, lineHeight: 28, fontWeight: '600' },
  scorebox: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  score: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  small: { fontSize: 13 },
  clock: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 60,
    textAlign: 'right',
  },
  timebar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  timefill: { height: 4 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  pillText: { fontSize: 13, fontWeight: '600' },
  list: { flexGrow: 0, maxHeight: 150 },
  listIn: { gap: 6 },
  grp: { gap: 4 },
  grpHead: { flexDirection: 'row', justifyContent: 'space-between' },
  ws: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  w: {
    fontSize: 14,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  bon: { fontStyle: 'italic' },
  cur: { minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  curWord: { fontSize: 22, fontWeight: '700', letterSpacing: 1 },
  idle: { fontSize: 14, fontWeight: '400', letterSpacing: 0 },
  toast: { fontSize: 14, fontWeight: '700' },
  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  board: { position: 'relative' },
  tile: { position: 'absolute', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 32, fontWeight: '700' },
  bar: { position: 'absolute', height: 6, borderRadius: 3, opacity: 0.8 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 88, fontWeight: '800' },
  resume: { borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12 },
  resumeText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
