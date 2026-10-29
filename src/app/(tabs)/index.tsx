import { isPuzzleType } from '@noodle/core';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { TodayScreen } from '@/features/today';
import { appRecorder } from '@/shared/track';

/**
 * Today: the app's puzzles front page, recorded as a visit to puzzles.html, as on the website.
 * `?open=<type>` (a shared dailynoodle.co.uk/<type> link, via +native-intent) opens today's
 * puzzle of that type, once.
 */
export default function Today() {
  useFocusEffect(useCallback(() => appRecorder.screen('puzzles.html'), []));
  const { open } = useLocalSearchParams<{ open?: string }>();
  return (
    <TodayScreen
      open={open && isPuzzleType(open) ? open : undefined}
      onOpened={() => router.setParams({ open: undefined })}
    />
  );
}
