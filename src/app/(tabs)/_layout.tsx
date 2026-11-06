import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { useFeatures } from '@/shared/features';
import { tabBarProps } from '@/shared/shell';
import { tokensFor } from '@/shared/theme';

export default function TabsLayout() {
  const scheme = useColorScheme();
  const t = tokensFor(scheme);
  // features.json's stats switch (Alec, 6 Nov 2026): off hides the tab, with no app update.
  const features = useFeatures();
  return (
    <NativeTabs {...tabBarProps(t)}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" md="grid_view" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="archive">
        <NativeTabs.Trigger.Label>Archive</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats" hidden={!features.stats}>
        <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="leagues">
        <NativeTabs.Trigger.Label>Leagues</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="trophy" md="trophy" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
