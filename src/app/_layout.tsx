import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SyncRunner } from '@/features/account';
import { LeagueResults } from '@/features/leagues';
import { QueryProvider } from '@/shared/query';
import { appStorage } from '@/shared/storage';
import { tokensFor } from '@/shared/theme';
import { VisitRecorder } from '@/shared/track';

void SplashScreen.preventAutoHideAsync();

/** Root: providers, and saves loaded before the first screen so results never flash empty. */
export default function RootLayout() {
  const scheme = useColorScheme();
  const [ready, setReady] = useState(appStorage.hydrated);
  useEffect(() => {
    if (ready) return;
    appStorage
      .hydrate()
      .catch((e: unknown) => console.warn('Saved progress could not be read', e))
      .finally(() => setReady(true));
  }, [ready]);
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
          </Stack>
        </ThemeProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
