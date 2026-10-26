import { Note, Screen } from '@/shared/ui';

import { goToToday } from './RouteError';

/** A link to a page the app doesn't have (an old or mistyped dailynoodle:// link). */
export function NotFound() {
  return (
    <Screen title="Not found" testID="not-found">
      <Note
        title="This page isn’t here"
        body="The link may be old or mistyped. Today’s puzzles are a tap away."
        action={{ label: 'Go to Today', onPress: goToToday }}
      />
    </Screen>
  );
}
