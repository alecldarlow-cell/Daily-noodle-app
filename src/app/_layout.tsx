import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SyncRunner } from '@/features/account';
import { BoardLink, LeagueResults } from '@/features/leagues';
import { BoardSlotProvider } from '@/shared/finish-sheet';
import { ConfettiHost } from '@/shared/motion';
import { QueryProvider } from '@/shared/query';
import { navigationTheme, RouteError, stackScreenOptions, statusBarStyleFor } from '@/shared/shell';
import { SaveNotice, SavesLoadFailed, useStoreLoad } from '@/shared/storage';
import { FONT_FILES, tokensFor } from '@/shared/theme';
import { VisitRecorder } from '@/shared/track';

void SplashScreen.preventAutoHideAsync();

/**
 * The tabs sit under every other screen, even one opened cold from a link
 * (dailynoodle://play/...), so a puzzle always has somewhere to go back to.
 */
export const unstable_settings = { anchor: '(tabs)' };

/** If the root itself fails to render: the house error page, with Try again. */
export { RouteError as ErrorBoundary };

/**
 * Root: providers, and saves and the site's fonts loaded before the first screen, so results
 * never flash empty and type never jumps. A font that fails to load falls back to the system's.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  // A failed read is its own state ("Couldn't load your saves", Try again), never ready:
  // running on an empty store would let the next save write over the history (R2).
  const saves = useStoreLoad();
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const ready = saves.state !== 'loading' && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (fontError) console.warn('Fonts could not be loaded', fontError);
  }, [fontError]);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  const t = tokensFor(scheme);
  if (saves.state !== 'ready') {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.canvas }}>
        <StatusBar style={statusBarStyleFor(scheme)} />
        <SavesLoadFailed retrying={saves.state === 'retrying'} onRetry={saves.retry} />
      </GestureHandlerRootView>
    );
  }
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.canvas }}>
      <QueryProvider>
        <LeagueResults />
        <SyncRunner />
        <VisitRecorder />
        {/* Dark icons in light mode, light in dark, over every screen and puzzle. */}
        <StatusBar style={statusBarStyleFor(scheme)} />
        <ThemeProvider value={navigationTheme(scheme)}>
          <BoardSlotProvider slot={BoardLink}>
            <Stack screenOptions={stackScreenOptions(t)} unstable_screenErrorBoundary={RouteError}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="play/[type]/[file]"
                options={{ headerShown: true, title: '', headerBackTitle: 'Back' }}
              />
              <Stack.Screen
                name="privacy"
                options={{ headerShown: true, title: 'Privacy', headerBackTitle: 'Back' }}
              />
              <Stack.Screen
                name="how-to-play"
                options={{ headerShown: true, title: 'How to play', headerBackTitle: 'Back' }}
              />
            </Stack>
          </BoardSlotProvider>
        </ThemeProvider>
        {/* the win's confetti, over every screen so it carries on as the sheet rises */}
        <ConfettiHost />
        {/* "Couldn't save, retrying" while a result or streak hasn't reached the disk (R1) */}
        <SaveNotice />
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
