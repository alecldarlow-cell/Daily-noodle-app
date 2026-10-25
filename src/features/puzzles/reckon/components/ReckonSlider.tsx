import { useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { scaleMarks, type PlayView } from '../model';
import type { ReckonColors } from './colors';

const PAD = 26;

interface Props {
  view: PlayView;
  c: ReckonColors;
  /** Where the marker sits (0–100): the guess, or the preview while dragging. */
  thumbAt: number;
  /** A touch on the scale moved to fraction `fr` (0–1); `done` when it lets go. */
  onDrag: (fr: number, done: boolean) => void;
  onStep: (d: -1 | 1) => void;
}

/**
 * Ballpark's two-decade scale (engines/reckon.css .slz): ticks every unit, labels at
 * 1 and 3 of each decade, the marker, and once answered the zone bands and the pin on
 * the answer. A touch anywhere on it picks the nearest step, as the page's pointer
 * handler does; screen readers adjust it a step at a time.
 */
export function ReckonSlider({ view, c, thumbAt, onDrag, onStep }: Props) {
  const [box, setBox] = useState({ x: PAD, w: 1 });
  const marks = scaleMarks(view.lo);
  const frOf = (e: GestureResponderEvent) => (e.nativeEvent.locationX - box.x) / box.w;
  const revealed = view.answerAt != null;
  return (
    <View
      testID="reckon-slider"
      style={styles.slz}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Your guess"
      accessibilityValue={{
        min: 0,
        max: view.ladderSize - 1,
        now: view.index,
        text: view.guessText,
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        view.guessing && onStep(e.nativeEvent.actionName === 'increment' ? 1 : -1)
      }
      onStartShouldSetResponder={() => view.guessing}
      onMoveShouldSetResponder={() => view.guessing}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => onDrag(frOf(e), false)}
      onResponderMove={(e) => onDrag(frOf(e), false)}
      onResponderRelease={(e) => onDrag(frOf(e), true)}
      onResponderTerminate={(e) => onDrag(frOf(e), true)}>
      <View
        pointerEvents="none"
        style={[styles.trk, { backgroundColor: c.line }]}
        onLayout={(e) =>
          setBox({ x: e.nativeEvent.layout.x, w: Math.max(1, e.nativeEvent.layout.width) })
        }>
        {view.bands.map((b) => (
          <View
            key={b.zone}
            style={[
              styles.band,
              { left: `${b.l}%`, width: `${b.w}%`, backgroundColor: c.zones[b.zone] },
            ]}
          />
        ))}
        {marks.ticks.map((t) => (
          <View
            key={t.x}
            style={[
              styles.tick,
              t.kind === 'mj' ? styles.major : t.kind === 'md' ? styles.mid : null,
              { left: `${t.x}%`, backgroundColor: c.rule },
            ]}
          />
        ))}
        {revealed ? (
          <View style={[styles.pin, { left: `${view.answerAt}%`, backgroundColor: c.ink }]} />
        ) : null}
        <View
          testID="reckon-thumb"
          style={[
            styles.thumb,
            { left: `${thumbAt}%`, backgroundColor: c.tom, borderColor: c.knob },
            !view.guessing && styles.thumbDone,
          ]}
        />
      </View>
      <View pointerEvents="none" style={styles.labs}>
        {marks.labels.map((l) => (
          <Text key={l.x} style={[styles.lab, { left: `${l.x}%`, color: c.ink2 }]}>
            {l.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slz: { paddingTop: 38, paddingHorizontal: PAD, paddingBottom: 6 },
  trk: { height: 12, borderRadius: 6, position: 'relative' },
  band: { position: 'absolute', top: 0, bottom: 0, borderRadius: 6, opacity: 0.9 },
  tick: { position: 'absolute', top: 16, width: 1, height: 5, marginLeft: -0.5 },
  major: { height: 12, width: 2, marginLeft: -1 },
  mid: { height: 8 },
  pin: { position: 'absolute', top: -14, width: 3, height: 26, marginLeft: -1.5, borderRadius: 2 },
  thumb: {
    position: 'absolute',
    top: -10,
    width: 32,
    height: 32,
    marginLeft: -16,
    borderRadius: 16,
    borderWidth: 3,
  },
  thumbDone: { opacity: 0.85 },
  labs: { height: 30, marginTop: 14, position: 'relative' },
  lab: { position: 'absolute', width: 60, marginLeft: -30, textAlign: 'center', fontSize: 13 },
});
