/**
 * The app's chrome drawn from the house tokens: the status bar, the stack headers and the
 * native tab bar, so nothing falls back to React Navigation's or Material's stock colours.
 */
import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import type { StatusBarStyle } from 'expo-status-bar';

import { FONT, tokensFor, type Tokens } from '@/shared/theme';

/**
 * Dark icons on the light canvas, light icons on the dark one. Set explicitly: on the phone
 * in light mode the icons stayed white on the light background (26 Oct 2026).
 */
export function statusBarStyleFor(scheme: string | null | undefined): StatusBarStyle {
  return scheme === 'dark' ? 'light' : 'dark';
}

// One family per weight and no extra weight on top: Android picks a custom font by its
// family name, and a weight can make it fall back to the system font (fonts.ts).
const fonts: Theme['fonts'] = {
  regular: { fontFamily: FONT.sans, fontWeight: 'normal' },
  medium: { fontFamily: FONT.sansMedium, fontWeight: 'normal' },
  bold: { fontFamily: FONT.display, fontWeight: 'normal' },
  heavy: { fontFamily: FONT.displayHeavy, fontWeight: 'normal' },
};

/** React Navigation's theme in the house colours and Archivo, for the stack headers. */
export function navigationTheme(scheme: string | null | undefined): Theme {
  const t = tokensFor(scheme);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: t.accent,
      background: t.canvas,
      card: t.canvas,
      text: t.ink,
      border: t.hair,
      notification: t.bad,
    },
    fonts,
  };
}

/** The root stack's header: canvas bar, ink title in Archivo Bold, no shadow line. */
export function stackScreenOptions(t: Tokens) {
  return {
    headerShown: false,
    contentStyle: { backgroundColor: t.canvas },
    headerStyle: { backgroundColor: t.canvas },
    headerTintColor: t.ink,
    headerTitleStyle: { fontFamily: FONT.display, color: t.ink },
    headerBackTitleStyle: { fontFamily: FONT.sans },
    headerShadowVisible: false,
  } as const;
}

/**
 * The native tab bar in the house colours: muted until chosen, then ink, with the brand's
 * soft green for Android's active pill (Material's default is lavender) and a hairline ripple.
 *
 * `backBehavior: 'none'`: a Back that arrives after a puzzle has already closed (a second tap
 * on its Back while the screen slides away) used to fall through to the tab bar, whose
 * default is to return to the first tab, so a puzzle opened from Archive could land on Today.
 * With 'none' the tabs never act on Back, so it can only close the screen on top.
 */
export function tabBarProps(t: Tokens) {
  const label = { fontFamily: FONT.sansSemi };
  return {
    backBehavior: 'none',
    backgroundColor: t.canvas,
    iconColor: { default: t.muted, selected: t.accent },
    labelStyle: {
      default: { ...label, color: t.muted },
      selected: { ...label, color: t.ink },
    },
    indicatorColor: t.accentSoft,
    rippleColor: t.hair,
    badgeBackgroundColor: t.accent,
    badgeTextColor: t.onAccent,
  } as const;
}
