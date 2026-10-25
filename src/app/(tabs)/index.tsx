import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { TodayScreen } from '@/features/today';
import { appRecorder } from '@/shared/track';

/** Today: the app's puzzles front page, recorded as a visit to puzzles.html, as on the website. */
export default function Today() {
  useFocusEffect(useCallback(() => appRecorder.screen('puzzles.html'), []));
  return <TodayScreen />;
}
