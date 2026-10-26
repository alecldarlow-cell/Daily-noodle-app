import { dayBefore } from '@noodle/core';
import { StyleSheet, Text, View } from 'react-native';

import { StartLayout } from '@/shared/start-card';
import { FONT } from '@/shared/theme';
import { dayHead, longDate } from '@/shared/time';

import { homeView, serial, type ReckonState } from '../model';
import type { ReckonColors } from './colors';

const HOW = [
  'Drag the marker along the scale to guess, nudge it with − and +, then Lock in. Each big mark on the scale is ten times the last.',
  'Within 15% of the answer scores 100; within 30%, 75; within 60%, 50; within three times either way, 25. Gaps are measured from the smaller number, so half the answer scores the same as double it.',
  'Ten questions, the same for everyone, one go a day. Figures are rounded; dated ones say when they’re from.',
];

/** The page's picture on the card: the zones, the scale, the pin and the marker. */
function Art({ c }: { c: ReckonColors }) {
  return (
    <View
      style={styles.art}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {[118, 74, 46, 22].map((w, k) => (
        <View
          key={w}
          style={[styles.zone, { width: w, left: 145 - w / 2, backgroundColor: c.zones[3 - k] }]}
        />
      ))}
      <View style={[styles.track, { backgroundColor: c.ink }]} />
      <View style={[styles.pinLine, { backgroundColor: c.ink }]} />
      <View style={[styles.pinHead, { backgroundColor: c.ink }]} />
      <View style={[styles.marker, { backgroundColor: c.tom }]} />
      {[
        ['100', 30],
        ['1k', 140],
        ['10k', 250],
      ].map(([t, x]) => (
        <Text key={t} style={[styles.artLab, { left: Number(x) - 20, color: c.ink2 }]}>
          {t}
        </Text>
      ))}
    </View>
  );
}

interface Props {
  state: ReckonState;
  today: string;
  c: ReckonColors;
  onPlay: () => void;
  onBack: () => void;
}

/** Reckon's start screen (the page's #home, filled by renderHome). */
export function ReckonHome({ state, today, c, onPlay, onBack }: Props) {
  const h = homeView(state, today, dayBefore);
  return (
    <StartLayout
      testID="reckon-home"
      title="Reckon"
      dateLine={`No. ${serial(state.P.id)}, ${longDate(state.P.date)}`}
      streak={h.streak || undefined}
      art={<Art c={c} />}
      head={dayHead('ten', state.P.date, today)}
      status={h.status}
      statusTestID="reckon-status"
      button={{ label: h.button, onPress: onPlay, testID: 'reckon-play-button' }}
      stats={[
        [h.stats[0]!, 'day streak'],
        [h.stats[1]!, 'best score'],
        [h.stats[2]!, 'Reckons played'],
      ]}
      how={HOW}
      colors={{
        bg: c.bg,
        card: c.paper,
        ink: c.ink,
        inkSoft: c.ink2,
        line: c.line,
        pill: c.tom,
        onPill: c.onTom,
      }}
      onBack={onBack}
    />
  );
}

const styles = StyleSheet.create({
  art: { width: 280, height: 96, alignSelf: 'center' },
  zone: { position: 'absolute', top: 22, height: 36, borderRadius: 7 },
  track: { position: 'absolute', left: 6, top: 34, width: 268, height: 12, borderRadius: 6 },
  pinLine: { position: 'absolute', left: 144, top: 10, width: 2, height: 24 },
  pinHead: { position: 'absolute', left: 136, top: 1, width: 18, height: 18, borderRadius: 9 },
  marker: { position: 'absolute', left: 156, top: 26, width: 28, height: 28, borderRadius: 14 },
  artLab: {
    position: 'absolute',
    top: 76,
    width: 40,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: FONT.sans,
  },
});
