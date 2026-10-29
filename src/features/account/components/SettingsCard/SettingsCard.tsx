import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { saveSettings, useAppSettings, type MotionChoice } from '@/shared/settings';
import type { CachedStorage } from '@/shared/storage';
import { appStorage } from '@/shared/storage';
import { FONT, useTokens } from '@/shared/theme';
import { TAP } from '@/shared/ui';

import { Card } from '../AccountParts/AccountParts';

const MOTION: { value: MotionChoice; label: string }[] = [
  { value: 'phone', label: 'Follow phone' },
  { value: 'reduced', label: 'Reduced' },
];

/**
 * The app-wide switches (tracker AF-012), for every puzzle: Vibration on or off, and
 * Animations following the phone's setting or always reduced. No per-puzzle choices.
 */
export function SettingsCard({ store = appStorage }: { store?: CachedStorage }) {
  const t = useTokens();
  const s = useAppSettings(store);
  return (
    <Card testID="settings-card">
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={[styles.label, { color: t.ink }]} nativeID="set-vibration">
            Vibration
          </Text>
          <Text style={[styles.sub, { color: t.faint }]}>
            A short buzz on taps, wrong answers and wins
          </Text>
        </View>
        <Switch
          accessibilityLabel="Vibration"
          testID="set-vibration"
          value={s.vibration}
          onValueChange={(on) => void saveSettings({ vibration: on }, store)}
          trackColor={{ true: t.accent, false: t.hair }}
          thumbColor={t.paper}
          ios_backgroundColor={t.hair}
        />
      </View>
      <View style={[styles.row, styles.rule, { borderTopColor: t.hair }]}>
        <View style={styles.text}>
          <Text style={[styles.label, { color: t.ink }]}>Animations</Text>
          <Text style={[styles.sub, { color: t.faint }]}>Wins, confetti and moving tiles</Text>
        </View>
      </View>
      <View style={styles.seg} accessibilityRole="radiogroup" accessibilityLabel="Animations">
        {MOTION.map((m) => {
          const on = s.motion === m.value;
          return (
            <Pressable
              key={m.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={m.label}
              testID={`set-motion-${m.value}`}
              onPress={() => saveSettings({ motion: m.value }, store)}
              style={({ pressed }) => [
                styles.opt,
                {
                  borderColor: on ? t.accent : t.hair,
                  backgroundColor: on ? t.accentSoft : t.paper,
                },
                pressed ? { opacity: 0.75 } : null,
              ]}>
              <Text style={[styles.optText, { color: on ? t.accent : t.ink }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TAP, paddingVertical: 10 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 4 },
  text: { flex: 1, gap: 2 },
  label: { fontFamily: FONT.bodySemi, fontSize: 15.5, lineHeight: 21 },
  sub: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18 },
  seg: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  opt: {
    flex: 1,
    minHeight: TAP,
    borderWidth: 1.5,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  optText: { fontFamily: FONT.display, fontSize: 14.5, textAlign: 'center' },
});
