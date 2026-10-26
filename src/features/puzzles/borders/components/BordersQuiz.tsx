import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONT } from '@/shared/theme';
import { PRESSED, pressable } from '@/shared/ui';

import { useAnnounce } from '../../link/hooks/announce';
import { quizView, type BordersState, type Move } from '../model';
import type { BordersColors } from './colors';
import { mapHtml } from './drawing';
import { Picture } from './Picture';

interface Props {
  state: BordersState;
  c: BordersColors;
  dispatch: (m: Move) => void;
}

/** Text grows with the phone's text size up to these multiples, so Next always fits. */
const CAP = 1.3;
const CAP_BIG = 1.15;

/** What a screen reader hears once a question is answered: right or wrong, and the plate. */
export function verdictOf(state: BordersState): string {
  const a = state.cur?.ans[state.cur.ans.length - 1];
  if (!state.locked || !state.plate || !a) return '';
  return `${a.ok ? 'Right' : 'Wrong'}: ${state.plate.name}. ${state.plate.line}`;
}

/**
 * A question: the outline, the four names, Show on map, Next; and the pause sheet. The
 * column scrolls when it can't fit (a short phone at a large text size), the map giving
 * way first, so Next is always reachable.
 */
export function BordersQuiz({ state, c, dispatch }: Props) {
  const v = quizView(state);
  const verdict = verdictOf(state);
  useAnnounce(verdict, `${state.cur?.i ?? 0}|${verdict}`);
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]} testID="borders-quiz">
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.wrap}
        bounces={false}
        testID="borders-scroll">
        <View style={styles.qtop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause"
            testID="borders-pause"
            onPress={() => dispatch({ t: 'pause' })}
            style={pressable([styles.iconbtn, { borderColor: c.edge }])}>
            <View style={styles.bars}>
              <View style={[styles.bar, { backgroundColor: c.ink }]} />
              <View style={[styles.bar, { backgroundColor: c.ink }]} />
            </View>
          </Pressable>
          <View
            style={styles.ticks}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            {v.ticks.map((t, i) => (
              <View
                key={i}
                style={[
                  styles.tick,
                  { borderColor: c.ink },
                  t === 'ok' && { backgroundColor: c.ok, borderColor: c.ok },
                  t === 'bad' && { backgroundColor: c.pin, borderColor: c.pin },
                  t === 'cur' && { backgroundColor: c.ink },
                ]}
              />
            ))}
          </View>
          <Text
            maxFontSizeMultiplier={CAP_BIG}
            style={[styles.pts, { color: c.ink }]}
            testID="borders-points"
            accessibilityLiveRegion="polite">
            {v.pts}
            <Text maxFontSizeMultiplier={CAP_BIG} style={styles.ptsSmall}>
              {' pts'}
            </Text>
          </Text>
        </View>
        <View style={[styles.sheet, { backgroundColor: c.sea, borderColor: c.edge }]}>
          <Picture
            key={`${v.q.n}-${v.inset ? 1 : 0}-${c.bg}`}
            html={mapHtml(v.q, v.inset, c)}
            style={styles.map}
            label="Country outline"
            testID="borders-map"
          />
          {v.plate ? (
            <View
              style={[styles.nameplate, { backgroundColor: c.veil }]}
              testID="borders-plate"
              accessibilityLiveRegion="polite">
              <Text maxFontSizeMultiplier={CAP_BIG} style={[styles.plateName, { color: c.ink }]}>
                {v.plate.name}
              </Text>
              <Text maxFontSizeMultiplier={CAP} style={[styles.plateLine, { color: c.ink2 }]}>
                {v.plate.line}
              </Text>
            </View>
          ) : null}
          {!v.coachOff ? (
            <Text
              maxFontSizeMultiplier={CAP}
              style={[styles.coach, { backgroundColor: c.paper, color: c.ink }]}>
              Which country is this? “Show on map” helps, for half points.
            </Text>
          ) : null}
        </View>
        <View style={styles.opts}>
          {v.options.map((o, k) => (
            <Pressable
              key={o.name}
              accessibilityRole="button"
              accessibilityState={{
                disabled: state.locked,
                selected: o.mark === 'wrong' || o.mark === 'right',
              }}
              testID={`borders-opt-${k}`}
              onPress={() => dispatch({ t: 'answer', k })}
              style={pressable(
                [
                  styles.opt,
                  { borderColor: c.edge, backgroundColor: c.paper },
                  o.mark === 'right' && { backgroundColor: c.okT, borderColor: c.ok },
                  o.mark === 'wrong' && { backgroundColor: c.pinT, borderColor: c.pin },
                  o.mark === 'dim' && styles.dim,
                ],
                state.locked ? null : PRESSED,
              )}>
              <Text
                maxFontSizeMultiplier={CAP}
                style={[
                  styles.optText,
                  {
                    color: o.mark === 'right' ? c.onRight : o.mark === 'wrong' ? c.onWrong : c.ink,
                  },
                ]}>
                {o.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.qfoot}>
          {!v.hintHidden ? (
            <Pressable
              accessibilityRole="button"
              testID="borders-hint"
              disabled={v.hintDisabled}
              onPress={() => dispatch({ t: 'hint' })}
              style={pressable([
                styles.btn,
                { borderColor: c.ink2 },
                v.hintDisabled && styles.dim,
              ])}>
              <Text maxFontSizeMultiplier={CAP} style={[styles.btnText, { color: c.ink }]}>
                Show on map (half points)
              </Text>
            </Pressable>
          ) : null}
          {!v.nextHidden ? (
            <Pressable
              accessibilityRole="button"
              testID="borders-next"
              onPress={() => dispatch({ t: 'next' })}
              style={pressable([styles.btn, { backgroundColor: c.ink, borderColor: c.ink }])}>
              <Text maxFontSizeMultiplier={CAP} style={[styles.btnText, { color: c.paper }]}>
                {v.nextLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      {state.paused ? (
        <View
          style={[styles.ov, { backgroundColor: 'rgba(31,58,74,0.45)' }]}
          accessibilityViewIsModal
          testID="borders-paused">
          <View style={[styles.dialog, { backgroundColor: c.paper, borderColor: c.edge }]}>
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={CAP_BIG}
              style={[styles.h2, { color: c.ink }]}>
              Paused
            </Text>
            <Pressable
              accessibilityRole="button"
              testID="borders-resume"
              onPress={() => dispatch({ t: 'resume' })}
              style={pressable([styles.btn, { backgroundColor: c.ink, borderColor: c.ink }])}>
              <Text maxFontSizeMultiplier={CAP} style={[styles.btnText, { color: c.paper }]}>
                Resume
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID="borders-quit"
              onPress={() => dispatch({ t: 'quit' })}
              style={pressable([styles.btn, { borderColor: c.ink2 }])}>
              <Text maxFontSizeMultiplier={CAP} style={[styles.btnText, { color: c.ink }]}>
                Back to start
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: {
    flexGrow: 1,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    padding: 14,
    gap: 12,
  },
  qtop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconbtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: { flexDirection: 'row', gap: 3 },
  bar: { width: 3.5, height: 12 },
  ticks: { flex: 1, flexDirection: 'row', gap: 4 },
  tick: { flex: 1, height: 8, borderWidth: 1.25, borderRadius: 2 },
  pts: { fontFamily: FONT.serif, fontSize: 28, minWidth: 70, textAlign: 'right' },
  ptsSmall: { fontFamily: FONT.sans, fontSize: 13 },
  // The map fills what the column leaves; past its floor the column scrolls instead.
  sheet: { flex: 1, borderWidth: 1.5, borderRadius: 3, overflow: 'hidden', minHeight: 150 },
  map: { ...StyleSheet.absoluteFill },
  nameplate: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12 },
  plateName: { fontFamily: FONT.serif, fontSize: 28 },
  plateLine: { fontFamily: FONT.sans, fontSize: 14 },
  coach: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    right: 10,
    padding: 10,
    borderRadius: 8,
    fontFamily: FONT.sans,
    fontSize: 14,
  },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: {
    width: '48.5%',
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  optText: { fontSize: 16, fontFamily: FONT.sansSemi, textAlign: 'center' },
  dim: { opacity: 0.45 },
  qfoot: { gap: 8 },
  btn: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnText: { fontSize: 16, fontFamily: FONT.sansSemi },
  ov: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 360, borderRadius: 6, borderWidth: 1.5, padding: 22, gap: 12 },
  h2: { fontSize: 32, fontFamily: FONT.serif },
});
