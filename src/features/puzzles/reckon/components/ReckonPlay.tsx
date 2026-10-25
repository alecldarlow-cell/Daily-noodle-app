import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fmt,
  fromFraction,
  ladderOf,
  playView,
  posOf,
  type Move,
  type ReckonState,
} from '../model';
import type { ReckonColors } from './colors';
import { ReckonSlider } from './ReckonSlider';

/** − and +: a tap steps once; held, they repeat every 75 ms after 380 ms (the page's). */
function useHold(d: -1 | 1, dispatch: (m: Move) => void) {
  const t = useRef<{
    wait?: ReturnType<typeof setTimeout>;
    rep?: ReturnType<typeof setInterval>;
    held: boolean;
  }>({
    held: false,
  });
  const stop = () => {
    clearTimeout(t.current.wait);
    clearInterval(t.current.rep);
  };
  return {
    onPressIn: () => {
      t.current.held = false;
      stop();
      t.current.wait = setTimeout(() => {
        t.current.held = true;
        t.current.rep = setInterval(() => dispatch({ t: 'repeat', d }), 75);
      }, 380);
    },
    onPressOut: () => {
      stop();
      if (t.current.held) dispatch({ t: 'release' });
    },
    onPress: () => {
      if (t.current.held) t.current.held = false;
      else dispatch({ t: 'nudge', d });
    },
  };
}

interface Props {
  state: ReckonState;
  c: ReckonColors;
  dispatch: (m: Move) => void;
}

/** A question: its pack, the scale, the reading, Lock in / Next, and the pause sheet. */
export function ReckonPlay({ state, c, dispatch }: Props) {
  const v = playView(state);
  const [drag, setDrag] = useState<number | null>(null);
  const minus = useHold(-1, dispatch);
  const plus = useHold(1, dispatch);
  // While a finger is on the scale, the marker and reading follow it; letting go saves it.
  const preview = drag == null ? null : ladderOf(state)[fromFraction(state, drag)]!;
  const onDrag = (fr: number, done: boolean) => {
    if (done) {
      setDrag(null);
      dispatch({ t: 'drag', fr });
    } else setDrag(fr);
  };
  const fb = v.feedback;
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]} testID="reckon-play">
      <View style={styles.pw}>
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause"
            testID="reckon-pause"
            disabled={v.pauseHidden}
            onPress={() => dispatch({ t: 'pause' })}
            style={[styles.ib, { borderColor: c.ink, opacity: v.pauseHidden ? 0 : 1 }]}>
            <View style={styles.bars}>
              <View style={[styles.bar, { backgroundColor: c.ink }]} />
              <View style={[styles.bar, { backgroundColor: c.ink }]} />
            </View>
          </Pressable>
          <View style={[styles.chip, { backgroundColor: v.chip.colour }]}>
            <Text style={styles.chipText} numberOfLines={1}>
              {v.chip.name}
            </Text>
          </View>
          <View style={styles.qnav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous question"
              testID="reckon-prev"
              disabled={v.prevDisabled}
              onPress={() => dispatch({ t: 'nav', d: -1 })}
              style={[styles.navb, v.prevDisabled && styles.off]}>
              <Text style={[styles.navt, { color: c.ink }]}>‹</Text>
            </Pressable>
            <Text style={[styles.qn, { color: c.ink }]} testID="reckon-qn">
              {v.qn}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next question"
              testID="reckon-fwd"
              disabled={v.fwdDisabled}
              onPress={() => dispatch({ t: 'nav', d: 1 })}
              style={[styles.navb, v.fwdDisabled && styles.off]}>
              <Text style={[styles.navt, { color: c.ink }]}>›</Text>
            </Pressable>
          </View>
          <Text
            style={[styles.sc, { color: c.ink }]}
            accessibilityLabel="Points so far"
            testID="reckon-score">
            {v.score}
          </Text>
        </View>
        <View style={styles.pips}>
          {v.pips.map((p) => (
            <Pressable
              key={p.k}
              accessibilityRole="button"
              accessibilityLabel={`Question ${p.k + 1}`}
              testID={`reckon-pip-${p.k}`}
              disabled={p.disabled}
              onPress={() => dispatch({ t: 'pip', k: p.k })}
              style={[
                styles.pip,
                { backgroundColor: p.zone == null ? c.line : c.zones[p.zone] },
                p.live && { borderColor: c.tom, borderWidth: 2 },
                p.view && { borderColor: c.ink, borderWidth: 2 },
              ]}
            />
          ))}
        </View>
        <ScrollView style={styles.fill} contentContainerStyle={styles.mid}>
          <View style={[styles.qcard, { backgroundColor: c.paper, borderColor: c.line }]}>
            {v.reviewing ? <Text style={[styles.rvt, { color: c.tom }]}>{v.reviewing}</Text> : null}
            <Text style={[styles.q, { color: c.ink }]} testID="reckon-question">
              {v.question}
            </Text>
          </View>
          {fb ? (
            <View style={styles.fb} accessibilityLiveRegion="polite" testID="reckon-feedback">
              <View style={styles.fbv}>
                <Text style={[styles.verdict, { color: c.ink }]}>{fb.verdict}</Text>
                <Text style={[styles.badge, { backgroundColor: c.zones[fb.zone], color: c.onZ }]}>
                  {fb.pts}
                </Text>
              </View>
              <Text style={[styles.fbl, { color: c.ink }]}>{fb.line}</Text>
              {!fb.noteHidden ? (
                <Text style={[styles.fbn, { color: c.ink2 }]}>{fb.note}</Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.read}>
            <View style={styles.rc}>
              <Text style={[styles.rl, { color: c.ink2 }]}>Your guess</Text>
              <Text style={[styles.rv, { color: c.ink }]} testID="reckon-guess">
                {preview != null ? fmt(preview) : v.guess}
                <Text style={[styles.ru, { color: c.ink2 }]}>{v.unit ? ` ${v.unit}` : ''}</Text>
              </Text>
            </View>
            {fb ? (
              <View style={styles.rc}>
                <Text style={[styles.rl, { color: c.ink2 }]}>Answer</Text>
                <Text style={[styles.rv, { color: c.ink }]} testID="reckon-answer">
                  {fb.answer}
                  <Text style={[styles.ru, { color: c.ink2 }]}>{fb.unit ? ` ${fb.unit}` : ''}</Text>
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
        {!v.tipHidden ? (
          <Text
            style={[styles.tip, { backgroundColor: c.tipBg, color: c.tipInk }]}
            testID="reckon-tip">
            Drag along the scale to guess. Fine-tune with − and +, then lock it in.
          </Text>
        ) : null}
        <ReckonSlider
          view={v}
          c={c}
          thumbAt={preview != null ? posOf(v.lo, preview) : v.thumbAt}
          onDrag={onDrag}
          onStep={(d) => dispatch({ t: 'nudge', d })}
        />
        <View style={styles.ctl}>
          {v.guessing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Smaller"
              testID="reckon-minus"
              {...minus}
              style={[styles.nb, { borderColor: c.ink }]}>
              <Text style={[styles.nbt, { color: c.ink }]}>−</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            testID="reckon-act"
            onPress={() => dispatch({ t: 'act' })}
            style={[styles.act, { backgroundColor: v.guessing ? c.tom : c.ink }]}>
            <Text style={[styles.actt, { color: v.guessing ? c.onTom : c.bg }]}>{v.action}</Text>
          </Pressable>
          {v.guessing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bigger"
              testID="reckon-plus"
              {...plus}
              style={[styles.nb, { borderColor: c.ink }]}>
              <Text style={[styles.nbt, { color: c.ink }]}>+</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {state.paused ? (
        <View
          style={[styles.ov, { backgroundColor: c.veil }]}
          accessibilityViewIsModal
          testID="reckon-paused">
          <View style={[styles.sheet, { backgroundColor: c.paper }]}>
            <Text accessibilityRole="header" style={[styles.h2, { color: c.ink }]}>
              Paused
            </Text>
            <Pressable
              accessibilityRole="button"
              testID="reckon-resume"
              onPress={() => dispatch({ t: 'resume' })}
              style={[styles.act, { backgroundColor: c.tom }]}>
              <Text style={[styles.actt, { color: c.onTom }]}>Resume</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID="reckon-quit"
              onPress={() => dispatch({ t: 'quit' })}
              style={[styles.wide, { borderColor: c.ink }]}>
              <Text style={[styles.nbtSmall, { color: c.ink }]}>Back to start</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pw: { flex: 1, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 12 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  ib: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { width: 4, height: 14, borderRadius: 1 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, flexShrink: 1 },
  chipText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  qnav: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  navb: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navt: { fontSize: 26 },
  off: { opacity: 0.25 },
  qn: { minWidth: 38, textAlign: 'center', fontVariant: ['tabular-nums'] },
  sc: { minWidth: 56, textAlign: 'right', fontFamily: 'Georgia', fontSize: 32 },
  pips: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginTop: 4 },
  pip: { flex: 1, height: 10, borderRadius: 5 },
  mid: { padding: 16, gap: 14 },
  qcard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 6 },
  rvt: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  q: { fontSize: 22, lineHeight: 29, fontFamily: 'Georgia' },
  fb: { gap: 4 },
  fbv: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verdict: { fontSize: 24, fontWeight: '800' },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    fontWeight: '800',
    overflow: 'hidden',
  },
  fbl: { fontSize: 16 },
  fbn: { fontSize: 15, lineHeight: 21 },
  read: { flexDirection: 'row', gap: 12 },
  rc: { flex: 1, gap: 2 },
  rl: { fontSize: 13 },
  rv: { fontSize: 30, fontFamily: 'Georgia', fontVariant: ['tabular-nums'] },
  ru: { fontSize: 16 },
  tip: { marginHorizontal: 16, borderRadius: 12, padding: 12, fontSize: 15 },
  ctl: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, alignItems: 'center' },
  nb: {
    width: 56,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nbt: { fontSize: 28, fontWeight: '600' },
  nbtSmall: { fontSize: 16, fontWeight: '600' },
  act: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actt: { fontSize: 17, fontWeight: '800' },
  ov: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: { width: '100%', maxWidth: 360, borderRadius: 18, padding: 22, gap: 12 },
  h2: { fontSize: 32, fontFamily: 'Georgia', marginBottom: 4 },
  wide: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
