import { router, Stack } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';

import { tokensFor } from '@/shared/theme';

import { NotFound, RouteError, stackScreenOptions, tabBarProps, usePlayerExit } from '..';

/*
 * The app's route tree in miniature, laid out with the same settings as src/app's layouts
 * (a test can't live in src/app: every file there becomes a route).
 */
const t = tokensFor('light');

function Root() {
  return (
    <Stack screenOptions={stackScreenOptions(t)} unstable_screenErrorBoundary={RouteError}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="play/[type]/[file]" options={{ headerShown: true }} />
    </Stack>
  );
}

function Tabs() {
  return (
    <NativeTabs {...tabBarProps(t)}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="archive">
        <NativeTabs.Trigger.Label>Archive</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

let crash = false;
/** A player in miniature: its bar's Back is the players' own (usePlayerExit). */
let lastBack: () => void = () => undefined;
function Play() {
  const { back } = usePlayerExit();
  useEffect(() => {
    lastBack = back;
  }, [back]);
  if (crash) throw new Error('boom');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back}>
      <Text>play</Text>
    </Pressable>
  );
}

const routes = {
  _layout: { default: Root, unstable_settings: { anchor: '(tabs)' } },
  '(tabs)/_layout': Tabs,
  '(tabs)/index': () => <Text>today</Text>,
  '(tabs)/archive': () => <Text>archive</Text>,
  'play/[type]/[file]': Play,
  '+not-found': NotFound,
};

const pressBack = () => fireEvent.press(screen.getByRole('button', { name: 'Back' }));

const openPuzzle = () =>
  act(() => router.push({ pathname: '/play/[type]/[file]', params: { type: 'mini', file: 'a' } }));

beforeEach(() => {
  crash = false;
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('GIVEN an old puzzle opened from the Archive tab', () => {
  describe('WHEN Back is pressed', () => {
    it('THEN it returns to the Archive', async () => {
      const r = await renderRouter(routes);
      await act(() => router.navigate('/archive'));
      await openPuzzle();
      expect(r.getPathname()).toBe('/play/mini/a');
      await pressBack();
      expect(r.getPathname()).toBe('/archive');
    });
  });

  describe('WHEN Back arrives twice (a second tap as the puzzle slides away)', () => {
    it('THEN the second does nothing: it never falls through to the Today tab', async () => {
      const r = await renderRouter(routes);
      await act(() => router.navigate('/archive'));
      await openPuzzle();
      // Both taps reach the screen before it has gone (as while it slides away).
      const back = lastBack;
      await act(() => {
        back();
        back();
      });
      expect(r.getPathname()).toBe('/archive');
      expect(screen.getByText('archive')).toBeOnTheScreen();
    });
  });

  describe('WHEN the puzzle has closed and Back is pressed again on the Archive tab', () => {
    it('THEN the tabs do their usual Back: Archive goes to Today first', async () => {
      const r = await renderRouter(routes);
      await act(() => router.navigate('/archive'));
      await openPuzzle();
      await pressBack();
      expect(r.getPathname()).toBe('/archive');
      await act(() => router.back());
      expect(r.getPathname()).toBe('/');
      expect(screen.getByText('today')).toBeOnTheScreen();
    });
  });

  describe('WHEN the puzzle swaps itself for the next one, then Back is pressed', () => {
    it('THEN it still returns to the Archive', async () => {
      const r = await renderRouter(routes);
      await act(() => router.navigate('/archive'));
      await openPuzzle();
      await act(() =>
        router.replace({ pathname: '/play/[type]/[file]', params: { type: 'mini', file: 'b' } }),
      );
      await pressBack();
      expect(r.getPathname()).toBe('/archive');
    });
  });
});

describe('GIVEN a puzzle opened cold from a link', () => {
  describe('WHEN Back is pressed', () => {
    it('THEN the tabs are underneath, so it lands on Today rather than leaving the app', async () => {
      const r = await renderRouter(routes, { initialUrl: '/play/mini/a' });
      expect(r.getPathname()).toBe('/play/mini/a');
      expect(router.canGoBack()).toBe(true);
      await pressBack();
      expect(r.getPathname()).toBe('/');
    });
  });
});

describe('GIVEN a link to a page the app doesn’t have', () => {
  describe('WHEN it opens', () => {
    it('THEN the house not-found page shows, and Go to Today goes there', async () => {
      const r = await renderRouter(routes, { initialUrl: '/no/such/page' });
      expect(screen.getByTestId('not-found')).toBeOnTheScreen();
      expect(screen.getByText('This page isn’t here')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Go to Today' }));
      expect(r.getPathname()).toBe('/');
      expect(screen.getByText('today')).toBeOnTheScreen();
    });
  });
});

describe('GIVEN a screen that crashes', () => {
  describe('WHEN it renders', () => {
    it('THEN the house error page shows in its place, and Go to Today leaves it', async () => {
      crash = true;
      const r = await renderRouter(routes);
      await openPuzzle();
      expect(screen.getByTestId('route-error')).toBeOnTheScreen();
      expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Go to Today' }));
      expect(r.getPathname()).toBe('/');
    });
  });

  describe('WHEN the fault has passed and Try again is pressed', () => {
    it('THEN the screen renders again', async () => {
      crash = true;
      await renderRouter(routes);
      await openPuzzle();
      expect(screen.getByTestId('route-error')).toBeOnTheScreen();
      crash = false;
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('play')).toBeOnTheScreen();
    });
  });
});

describe('GIVEN the Leagues-style case: a non-first tab with nothing open', () => {
  describe('WHEN Back is pressed', () => {
    it('THEN it goes to Today rather than leaving the app', async () => {
      const r = await renderRouter(routes);
      await act(() => router.navigate('/archive'));
      expect(router.canGoBack()).toBe(true);
      await act(() => router.back());
      expect(r.getPathname()).toBe('/');
    });
  });
});
