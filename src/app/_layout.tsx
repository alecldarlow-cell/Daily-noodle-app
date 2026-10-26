import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SyncRunner } from '@/features/account';
import { BoardLink, LeagueResults } from '@/features/leagues';
import { BoardSlotProvider } from '@/shared/finish-sheet';
import { ConfettiHost } from '@/shared/motion';
import { QueryProvider } from '@/shared/query';
import { appStorage } from '@/shared/storage';
import { FONT_FILES, tokensFor } from '@/shared/theme';
import { VisitRecorder } from '@/shared/track';

void SplashScreen.preventAutoHideAsync();

/**
 * Root: providers, and saves and the site's fonts loaded before the first screen, so results
 * never flash empty and type never jumps. A font that fails to load falls back to the system's.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  const [saves, setSaves] = useState(appStorage.hydrated);
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const ready = saves && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (saves) return;
    appStorage
      .hydrate()
      .catch((e: unknown) => console.warn('Saved progress could not be read', e))
      .finally(() => setSaves(true));
  }, [saves]);
  useEffect(() => {
    if (fontError) console.warn('Fonts could not be loaded', fontError);
  }, [fontError]);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  const t = tokensFor(scheme);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.canvas }}>
      <QueryProvider>
        <LeagueResults />
        <SyncRunner />
        <VisitRecorder />
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <BoardSlotProvider slot={BoardLink}>
            <Stack
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.canvas } }}>
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
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
