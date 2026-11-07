import { StyleSheet, Switch, Text, View } from 'react-native';

import { saveSettings, useAppSettings, type AppSettings } from '@/shared/settings';
import type { CachedStorage } from '@/shared/storage';
import { appStorage } from '@/shared/storage';
import { FONT, useTokens } from '@/shared/theme';
import { TAP } from '@/shared/ui';

import { Card } from '../AccountParts/AccountParts';

/**
 * The app-wide switches (tracker AF-012), for every puzzle: Vibration, Sound (AF-013) and
 * Animations, each plainly on or off with no description (Alec, 7 Nov 2026). Animations on
 * follows the phone's setting; off is always reduced. The stored settings are unchanged.
 */
export function SettingsCard({ store = appStorage }: { store?: CachedStorage }) {
  const t = useTokens();
  const s = useAppSettings(store);
  const rows: {
    key: string;
    label: string;
    on: boolean;
    set: (on: boolean) => Partial<AppSettings>;
  }[] = [
    { key: 'vibration', label: 'Vibration', on: s.vibration, set: (on) => ({ vibration: on }) },
    { key: 'sound', label: 'Sound', on: s.sound, set: (on) => ({ sound: on }) },
    {
      key: 'motion',
      label: 'Animations',
      on: s.motion !== 'reduced',
      set: (on) => ({ motion: on ? 'phone' : 'reduced' }),
    },
  ];
  return (
    <Card testID="settings-card">
      {rows.map((r, i) => (
        <View
          key={r.key}
          style={[styles.row, i > 0 ? [styles.rule, { borderTopColor: t.hair }] : null]}>
          <Text style={[styles.label, { color: t.ink }]} nativeID={`set-${r.key}`}>
            {r.label}
          </Text>
          <Switch
            accessibilityLabel={r.label}
            testID={`set-${r.key}`}
            value={r.on}
            onValueChange={(on) => void saveSettings(r.set(on), store)}
            // Alec, 7 Nov 2026: a white thumb, and an off track that stands out from the card.
            trackColor={{ true: t.accent, false: t.switchOff }}
            thumbColor={SWITCH_THUMB}
            ios_backgroundColor={t.switchOff}
          />
        </View>
      ))}
    </Card>
  );
}

/** The switches' thumb: white in both schemes, so on and off both read clearly. */
export const SWITCH_THUMB = '#FFFFFF';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TAP, paddingVertical: 8 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth },
  label: { flex: 1, fontFamily: FONT.bodySemi, fontSize: 15.5, lineHeight: 21 },
});
