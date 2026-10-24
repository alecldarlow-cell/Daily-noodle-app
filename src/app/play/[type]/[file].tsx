import { useLocalSearchParams } from 'expo-router';

import { PlayScreen } from '@/features/play';
import { hasNativePlayer, NativePlay } from '@/features/puzzles';

/** A puzzle: its native player where one is enabled, else its page through the bridge. */
export default function Play() {
  const { type, file } = useLocalSearchParams<{ type: string; file: string }>();
  if (hasNativePlayer(type))
    return <NativePlay type={String(type)} file={String(file ?? '')} fallback={<PlayScreen />} />;
  return <PlayScreen />;
}
