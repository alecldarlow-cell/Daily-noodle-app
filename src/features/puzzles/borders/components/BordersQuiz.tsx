import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { quizView, type BordersState, type Move } from '../model';
import type { BordersColors } from './colors';
import { mapHtml } from './drawing';
import { Picture } from './Picture';

interface Props {
  state: BordersState;
  c: BordersColors;
  dispatch: (m: Move) => void;
}

/** A question: the outline, the four names, Show on map, Next; and the pause sheet. */
export function BordersQuiz({ state, c, dispatch }: Props) {
  const v = quizView(state);
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]} testID="borders-quiz">
      <View style={styles.wrap}>
        <View style={styles.qtop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause"
            testID="borders-pause"
            onPress={() => dispatch({ t: 'pause' })}
            style={[styles.iconbtn, { borderColor: c.edge }]}>
            <View style={styles.bars}>
              <View style={[styles.bar, { backgroundColor: c.ink }]} />
              <View style={[styles.bar, { backgroundColor: c.ink }]} />
            </View>
          </Pressable>
          <View style={styles.ticks} accessibilityElementsHidden>
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
            style={[styles.pts, { color: c.ink }]}
            testID="borders-points"
            accessibilityLiveRegion="polite">
            {v.pts}
            <Text style={styles.ptsSmall}> pts</Text>
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
              <Text style={[styles.plateName, { color: c.ink }]}>{v.plate.name}</Text>
              <Text style={[styles.plateLine, { color: c.ink2 }]}>{v.plate.line}</Text>
            </View>
          ) : null}
          {!v.coachOff ? (
            <Text style={[styles.coach, { backgroundColor: c.paper, color: c.ink }]}>
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
              style={[
                styles.opt,
                { borderColor: c.edge, backgroundColor: c.paper },
                o.mark === 'right' && { backgroundColor: c.okT, borderColor: c.ok },
                o.mark === 'wrong' && { backgroundColor: c.pinT, borderColor: c.pin },
                o.mark === 'dim' && styles.dim,
              ]}>
              <Text
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
              style={[styles.btn, { borderColor: c.ink2 }, v.hintDisabled && styles.dim]}>
              <Text style={[styles.btnText, { color: c.ink }]}>Show on map (half points)</Text>
            </Pressable>
          ) : null}
          {!v.nextHidden ? (
            <Pressable
              accessibilityRole="button"
              testID="borders-next"
              onPress={() => dispatch({ t: 'next' })}
              style={[styles.btn, { backgroundColor: c.ink, borderColor: c.ink }]}>
              <Text style={[styles.btnText, { color: c.paper }]}>{v.nextLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {state.paused ? (
        <View
          style={[styles.ov, { backgroundColor: 'rgba(31,58,74,0.45)' }]}
          accessibilityViewIsModal
          testID="borders-paused">
          <View style={[styles.dialog, { backgroundColor: c.paper, borderColor: c.edge }]}>
            <Text accessibilityRole="header" style={[styles.h2, { color: c.ink }]}>
              Paused
            </Text>
            <Pressable
              accessibilityRole="button"
              testID="borders-resume"
              onPress={() => dispatch({ t: 'resume' })}
              style={[styles.btn, { backgroundColor: c.ink, borderColor: c.ink }]}>
              <Text style={[styles.btnText, { color: c.paper }]}>Resume</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID="borders-quit"
              onPress={() => dispatch({ t: 'quit' })}
              style={[styles.btn, { borderColor: c.ink2 }]}>
              <Text style={[styles.btnText, { color: c.ink }]}>Back to start</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { flex: 1, maxWidth: 560, width: '100%', alignSelf: 'center', padding: 14, gap: 12 },
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
  pts: { fontFamily: 'Georgia', fontSize: 28, minWidth: 70, textAlign: 'right' },
  ptsSmall: { fontSize: 13 },
  sheet: { flex: 1, borderWidth: 1.5, borderRadius: 3, overflow: 'hidden', minHeight: 180 },
  map: { ...StyleSheet.absoluteFill },
  nameplate: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12 },
  plateName: { fontFamily: 'Georgia', fontSize: 28 },
  plateLine: { fontSize: 14 },
  coach: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    right: 10,
    padding: 10,
    borderRadius: 8,
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
  optText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
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
  btnText: { fontSize: 16, fontWeight: '600' },
  ov: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 360, borderRadius: 6, borderWidth: 1.5, padding: 22, gap: 12 },
  h2: { fontSize: 32, fontFamily: 'Georgia' },
});
