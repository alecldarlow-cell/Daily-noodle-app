import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { StatsScreen } from '@/features/stats';
import { appRecorder } from '@/shared/track';

/** The Stats tab (6 Nov 2026); each visit records stats_open, as the website's stats.html does. */
export default function Stats() {
  useFocusEffect(
    useCallback(() => appRecorder.event('stats_open', { from: 'tab' }, 'stats.html'), []),
  );
  return <StatsScreen />;
}
