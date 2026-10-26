import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { FONT } from '@/shared/theme';
import { Chevron, pressable } from '@/shared/ui';

import { useAnnounce } from '../../link/hooks/announce';
import type { ReckonColors } from './colors';
import { ReckonSlider } from './ReckonSlider';

/** Under this width the pack chip keeps only its colour; its name stays for screen readers. */
export const NARROW = 360;
/** The top row's text grows with the phone's text size no further than this. */
const TOP_CAP = 1.2;
/** The pips are 10 pt bars: their touch reaches 17 pt above and below (44 pt in all). */
export const PIP_SLOP = { top: 17, bottom: 17, left: 3, right: 3 };

/** What a screen reader hears when a guess is scored (or a scored question is shown). */
export function verdictLine(fb: { verdict: string; pts: string | number; line: string }): string {
  return `${fb.verdict} ${fb.pts}. ${fb.line}`;
}

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
  const narrow = useWindowDimensions().width < NARROW;
  const said = fb ? verdictLine(fb) : '';
  useAnnounce(said, `${v.qn}|${said}`);
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]} testID="reckon-play">
      <View style={styles.pw}>
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause"
            testID="reckon-pause"
            disabled={v.pauseHidden}
            accessibilityElementsHidden={v.pauseHidden}
            importantForAccessibility={v.pauseHidden ? 'no-hide-descendants' : 'auto'}
            onPress={() => dispatch({ t: 'pause' })}
            style={pressable([styles.ib, { borderColor: c.ink, opacity: v.pauseHidden ? 0 : 1 }])}>
            <View style={styles.bars}>
              <View style={[styles.bar, { backgroundColor: c.ink }]} />
              <View style={[styles.bar, { backgroundColor: c.ink }]} />
            </View>
          </Pressable>
          {narrow ? (
            <View
              style={[styles.chipDot, { backgroundColor: v.chip.colour }]}
              accessible
              accessibilityLabel={v.chip.name}
              testID="reckon-chip"
            />
          ) : (
            <View style={[styles.chip, { backgroundColor: v.chip.colour }]} testID="reckon-chip">
              <Text
                style={styles.chipText}
                numberOfLines={1}
                maxFontSizeMultiplier={TOP_CAP}
                testID="reckon-chip-name">
                {v.chip.name}
              </Text>
            </View>
          )}
          <View style={styles.qnav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous question"
              testID="reckon-prev"
              disabled={v.prevDisabled}
              onPress={() => dispatch({ t: 'nav', d: -1 })}
              style={pressable([styles.navb, v.prevDisabled && styles.off])}>
              <Chevron color={c.ink} dir="left" />
            </Pressable>
            <Text
              style={[styles.qn, { color: c.ink }]}
              maxFontSizeMultiplier={TOP_CAP}
              testID="reckon-qn">
              {v.qn}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next question"
              testID="reckon-fwd"
              disabled={v.fwdDisabled}
              onPress={() => dispatch({ t: 'nav', d: 1 })}
              style={pressable([styles.navb, v.fwdDisabled && styles.off])}>
              <Chevron color={c.ink} />
            </Pressable>
          </View>
          <Text
            style={[styles.sc, narrow && styles.scNarrow, { color: c.ink }]}
            maxFontSizeMultiplier={TOP_CAP}
            accessibilityLabel={`${v.score} points so far`}
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
              hitSlop={PIP_SLOP}
              onPress={() => dispatch({ t: 'pip', k: p.k })}
              style={pressable([
                styles.pip,
                { backgroundColor: p.zone == null ? c.line : c.zones[p.zone] },
                p.live && { borderColor: c.tom, borderWidth: 2 },
                p.view && { borderColor: c.ink, borderWidth: 2 },
              ])}
            />
          ))}
        </View>
        <ScrollView style={styles.fill} contentContainerStyle={styles.mid}>
          <View
            style={[
              styles.qcard,
              { backgroundColor: c.paper, borderColor: c.edge, borderBottomColor: c.ledge },
            ]}>
            {v.reviewing ? (
              <Text style={[styles.rvt, { backgroundColor: c.ink, color: c.bg }]}>
                {v.reviewing}
              </Text>
            ) : null}
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
          {/* reckon.css .read: one big reading in the middle while guessing; guess and answer side by side after */}
          <View style={[styles.read, fb && styles.readTwo]}>
            <View
              style={[
                styles.rc,
                fb && [styles.rcTwo, { backgroundColor: c.paper, borderColor: c.line }],
              ]}>
              <View style={styles.rl}>
                <View style={[styles.dot, { backgroundColor: c.tom, borderColor: c.ink }]} />
                <Text style={[styles.rlText, { color: c.ink2 }]}>Your guess</Text>
              </View>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                style={[styles.rv, fb && styles.rvTwo, { color: fb ? c.tomInk : c.ink }]}
                testID="reckon-guess">
                {preview != null ? fmt(preview) : v.guess}
                <Text style={[styles.ru, { color: c.ink2 }]}>{v.unit ? ` ${v.unit}` : ''}</Text>
              </Text>
            </View>
            {fb ? (
              <View
                style={[
                  styles.rc,
                  styles.rcTwo,
                  { backgroundColor: c.paper, borderColor: c.line },
                ]}>
                <View style={styles.rl}>
                  <View style={[styles.dot, { backgroundColor: c.ink, borderColor: c.ink }]} />
                  <Text style={[styles.rlText, { color: c.ink2 }]}>Answer</Text>
                </View>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                  style={[styles.rv, styles.rvTwo, { color: c.ink }]}
                  testID="reckon-answer">
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
              style={pressable([styles.nb, { borderColor: c.ink }])}>
              <Text style={[styles.nbt, { color: c.ink }]}>−</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            testID="reckon-act"
            onPress={() => dispatch({ t: 'act' })}
            style={pressable([styles.act, { backgroundColor: v.guessing ? c.tom : c.ink }])}>
            <Text style={[styles.actt, { color: v.guessing ? c.onTom : c.bg }]}>{v.action}</Text>
          </Pressable>
          {v.guessing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bigger"
              testID="reckon-plus"
              {...plus}
              style={pressable([styles.nb, { borderColor: c.ink }])}>
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
              style={pressable([styles.act, { backgroundColor: c.tom }])}>
              <Text style={[styles.actt, { color: c.onTom }]}>Resume</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID="reckon-quit"
              onPress={() => dispatch({ t: 'quit' })}
              style={pressable([styles.wide, { borderColor: c.ink }])}>
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
    gap: 8,
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
  chipDot: { width: 22, height: 22, borderRadius: 11, flexShrink: 0 },
  chipText: { color: '#FFFFFF', fontFamily: FONT.sansSemi, fontSize: 14 },
  qnav: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  // reckon.css .navb: 44 pt to touch, overlapping the number by 6 pt a side to save room.
  navb: {
    width: 44,
    height: 44,
    marginHorizontal: -6,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navt: { fontFamily: FONT.sans, fontSize: 26 },
  off: { opacity: 0.25 },
  qn: { minWidth: 38, textAlign: 'center', fontVariant: ['tabular-nums'] },
  sc: { minWidth: 56, textAlign: 'right', fontFamily: FONT.serif, fontSize: 32 },
  scNarrow: { minWidth: 44, fontSize: 28 },
  pips: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginTop: 4 },
  pip: { flex: 1, height: 10, borderRadius: 5 },
  mid: { padding: 16, gap: 14, flexGrow: 1 },
  // reckon.css .qcard: a 1.5 px edge and a 3 px ledge underneath.
  qcard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 4.5,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 6,
  },
  rvt: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    letterSpacing: 0.9,
    fontFamily: FONT.display,
    textTransform: 'uppercase',
  },
  q: { fontSize: 21, lineHeight: 27, fontFamily: FONT.sansSemi },
  fb: { gap: 4 },
  fbv: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verdict: { fontSize: 24, fontFamily: FONT.displayHeavy },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    fontFamily: FONT.displayHeavy,
    overflow: 'hidden',
  },
  fbl: { fontFamily: FONT.sans, fontSize: 16 },
  fbn: { fontFamily: FONT.sans, fontSize: 15, lineHeight: 21 },
  read: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  readTwo: { flexGrow: 0, flexDirection: 'row', alignItems: 'stretch' },
  rc: { alignItems: 'center', gap: 4, maxWidth: '100%' },
  rcTwo: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  rl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  rlText: { fontSize: 12, fontFamily: FONT.display, letterSpacing: 1, textTransform: 'uppercase' },
  rv: {
    fontSize: 84,
    lineHeight: 90,
    fontFamily: FONT.serif,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  rvTwo: { fontSize: 44, lineHeight: 50, letterSpacing: -0.5 },
  ru: { fontFamily: FONT.sansSemi, fontSize: 20, letterSpacing: 0 },
  tip: { marginHorizontal: 16, borderRadius: 12, padding: 12, fontFamily: FONT.sans, fontSize: 15 },
  ctl: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, alignItems: 'center' },
  nb: {
    width: 56,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nbt: { fontSize: 28, fontFamily: FONT.sansSemi },
  nbtSmall: { fontSize: 16, fontFamily: FONT.sansSemi },
  act: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actt: { fontSize: 17, fontFamily: FONT.displayHeavy },
  ov: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: { width: '100%', maxWidth: 360, borderRadius: 18, padding: 22, gap: 12 },
  h2: { fontSize: 32, fontFamily: FONT.serif, marginBottom: 4 },
  wide: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
