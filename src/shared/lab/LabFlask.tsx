import { Image, StyleSheet, View } from 'react-native';

import { useTokens } from '@/shared/theme';

const FLASK = require('../../../assets/images/icons/flask.png') as number;

/**
 * The Lab's mark (Alec, 15 Nov 2026): a line-drawn flask, tinted. A drawn image, not an
 * emoji (house rule), and the app has no SVG library, so it is a 96 px white PNG like the
 * vote's thumb, coloured with `tintColor`.
 */
export function LabFlask({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <Image
      source={FLASK}
      accessible={false}
      importantForAccessibility="no"
      style={{ width: size, height: size, tintColor: color }}
      testID="lab-flask"
    />
  );
}

/** The flask on a Lab-pink tile, before the "From the Lab" heading. */
export function LabMark() {
  const t = useTokens();
  return (
    <View
      style={[styles.tile, { backgroundColor: t.labInk }]}
      accessible={false}
      importantForAccessibility="no"
      testID="lab-mark">
      <LabFlask color={t.labSoft} size={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
});
