import { isPuzzleType } from '@noodle/core';
import { useLocalSearchParams } from 'expo-router';

import { SitePageWebView } from '@/shared/webview';

/** The site's how-to-play guide, at the tapped card's type, inside the app. */
export default function HowToPlayRoute() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  // Cryptic's "Learn the clue types" section opens only at #cryptic (site how-to-play.html, Lab).
  const hash = type && (isPuzzleType(type) || type === 'cryptic') ? `#${type}` : '';
  return <SitePageWebView path={`/how-to-play.html${hash}`} testID="how-to-play-webview" />;
}
