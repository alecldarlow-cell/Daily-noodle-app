import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { LeaguesScreen } from '@/features/leagues';

/**
 * The Leagues tab. Alec, 7 Nov 2026: no pull-to-refresh (it fired when he swiped the pager);
 * the boards refresh themselves while the tab is in view, so the screen is told when it is.
 */
export default function LeaguesRoute() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return <LeaguesScreen focused={focused} />;
}
