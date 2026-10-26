import { dayBefore } from '@noodle/core';
import { StyleSheet, View } from 'react-native';

import { dayHead } from '@/shared/time';

import { StartLayout } from '@/shared/start-card';

import { homeView, serial, type BordersState } from '../model';
import { homeDate } from '../simulate';
import type { BordersColors } from './colors';
import { worldHtml } from './drawing';
import { Picture } from './Picture';

const HOW = [
  'Ten country outlines, easiest first. Pick the country from four names: 100 points for each right answer, up to 1,000.',
  'Stuck? Show on map puts the outline on a world map, for half points. Every country you name goes into your atlas in Borderline.',
];

interface Props {
  state: BordersState;
  today: string;
  c: BordersColors;
  onPlay: () => void;
  onBack: () => void;
}

/** Borders' start screen (the page's #home, renderHome and homeExtras). */
export function BordersHome({ state, today, c, onPlay, onBack }: Props) {
  const h = homeView(state, today, dayBefore);
  const streak = Number(h.stats[0]);
  return (
    <StartLayout
      testID="borders-home"
      title="Borders"
      titleAccent={<ScaleBar ink={c.ink} />}
      dateLine={`No. ${serial(state.P.id)}, ${homeDate(state.P.date)}`}
      streak={streak >= 1 ? `${streak}-day streak` : undefined}
      art={<Picture html={worldHtml(c)} style={styles.world} />}
      head={dayHead('ten', state.P.date, today)}
      status={h.status}
      statusTestID="borders-status"
      button={{ label: h.button, onPress: onPlay, testID: 'borders-play-button' }}
      stats={[
        [h.stats[0]!, 'day streak'],
        [h.stats[1]!, 'best score'],
        [h.stats[2]!, 'Borders played'],
      ]}
      how={HOW}
      colors={{
        bg: c.bg,
        card: c.paper,
        ink: c.ink,
        inkSoft: c.ink2,
        line: c.line,
        pill: c.ink,
        onPill: c.paper,
      }}
      onBack={onBack}
    />
  );
}

/** borders.css .bar: a map's scale bar under the name, four segments, alternately inked. */
function ScaleBar({ ink }: { ink: string }) {
  return (
    <View style={styles.bar} accessible={false} importantForAccessibility="no-hide-descendants">
      {[0, 1, 2, 3].map((k) => (
        <View
          key={k}
          style={[styles.seg, { borderColor: ink, backgroundColor: k % 2 ? 'transparent' : ink }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', marginTop: 4, marginBottom: 4, paddingLeft: 1.25 },
  seg: { width: 34, height: 7, borderWidth: 1.25, marginLeft: -1.25 },
  world: { width: '100%', aspectRatio: 600 / 270 },
});
