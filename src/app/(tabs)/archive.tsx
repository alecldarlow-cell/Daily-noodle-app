import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { ArchiveScreen } from '@/features/archive';
import { appRecorder } from '@/shared/track';

/** The Archive tab; each visit records archive_open, as the website's archive.html does. */
export default function Archive() {
  useFocusEffect(
    useCallback(() => appRecorder.event('archive_open', { from: 'tab' }, 'archive.html'), []),
  );
  return <ArchiveScreen />;
}
