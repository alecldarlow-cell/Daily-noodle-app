import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { useFeatures } from '@/shared/features';
import { tabBarProps } from '@/shared/shell';
import { tokensFor } from '@/shared/theme';

/**
 * The noodle-line tab icons (#199, Alec, 27 Nov 2026), drawn by scripts/make-tab-icons.js:
 * one rounded line plus a dot each, tinted grey or the accent by the tab bar.
 */
const TAB_ICONS = {
  today: require('../../../assets/images/tabs/today.png') as number,
  leagues: require('../../../assets/images/tabs/leagues.png') as number,
  archive: require('../../../assets/images/tabs/archive.png') as number,
  account: require('../../../assets/images/tabs/account.png') as number,
};

export default function TabsLayout() {
  const scheme = useColorScheme();
  const t = tokensFor(scheme);
  // Tab order by use (Alec, 7 Nov 2026): Today, Leagues, Archive, Account; Stats, when on,
  // sits by the Archive.
  // features.json's stats switch (Alec, 6 Nov 2026): off hides the tab, with no app update.
  const features = useFeatures();
  return (
    <NativeTabs {...tabBarProps(t)}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={TAB_ICONS.today} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="leagues">
        <NativeTabs.Trigger.Label>Leagues</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={TAB_ICONS.leagues} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="archive">
        <NativeTabs.Trigger.Label>Archive</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={TAB_ICONS.archive} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats" hidden={!features.stats}>
        <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={TAB_ICONS.account} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
