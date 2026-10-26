import { DarkTheme, DefaultTheme } from 'expo-router';

import { FONT, tokensFor } from '@/shared/theme';

import { navigationTheme, stackScreenOptions, statusBarStyleFor, tabBarProps } from '../chrome';

const families = new Set<string>(Object.values(FONT));

describe('GIVEN the phone’s colour scheme', () => {
  describe('WHEN the status bar style is chosen', () => {
    it('THEN light mode gets dark icons and dark mode light ones', () => {
      expect(statusBarStyleFor('light')).toBe('dark');
      expect(statusBarStyleFor(null)).toBe('dark');
      expect(statusBarStyleFor(undefined)).toBe('dark');
      expect(statusBarStyleFor('dark')).toBe('light');
    });
  });

  describe.each(['light', 'dark'] as const)('WHEN the stack header theme is built for %s', (s) => {
    const t = tokensFor(s);
    const theme = navigationTheme(s);

    it('THEN its colours are the house tokens, not React Navigation’s stock ones', () => {
      expect(theme.dark).toBe(s === 'dark');
      expect(theme.colors).toMatchObject({
        primary: t.accent,
        background: t.canvas,
        card: t.canvas,
        text: t.ink,
        border: t.hair,
        notification: t.bad,
      });
      const stock = s === 'dark' ? DarkTheme : DefaultTheme;
      expect(theme.colors.card).not.toBe(stock.colors.card);
      expect(theme.colors.primary).not.toBe(stock.colors.primary);
    });

    it('THEN every font is one of the app’s bundled families, with no extra weight', () => {
      for (const f of Object.values(theme.fonts)) {
        expect(families.has(f.fontFamily)).toBe(true);
        expect(f.fontWeight).toBe('normal');
      }
    });

    it('THEN the header bar is the canvas with an ink Archivo title and no shadow', () => {
      const o = stackScreenOptions(t);
      expect(o.headerShown).toBe(false);
      expect(o.headerStyle.backgroundColor).toBe(t.canvas);
      expect(o.contentStyle.backgroundColor).toBe(t.canvas);
      expect(o.headerTintColor).toBe(t.ink);
      expect(o.headerTitleStyle).toEqual({ fontFamily: FONT.display, color: t.ink });
      expect(o.headerShadowVisible).toBe(false);
    });
  });

  describe.each(['light', 'dark'] as const)('WHEN the tab bar is themed for %s', (s) => {
    const t = tokensFor(s);
    const p = tabBarProps(t);

    it('THEN icons, labels, the Android pill and the ripple all come from the tokens', () => {
      expect(p.backgroundColor).toBe(t.canvas);
      expect(p.iconColor).toEqual({ default: t.muted, selected: t.accent });
      expect(p.labelStyle.default.color).toBe(t.muted);
      expect(p.labelStyle.selected.color).toBe(t.ink);
      expect(p.indicatorColor).toBe(t.accentSoft);
      expect(p.rippleColor).toBe(t.hair);
      const tokenValues = new Set<string>(Object.values(t));
      for (const c of [p.indicatorColor, p.rippleColor, p.badgeBackgroundColor, p.badgeTextColor])
        expect(tokenValues.has(c)).toBe(true);
    });

    it('THEN the labels are in Archivo, chosen or not', () => {
      expect(p.labelStyle.default.fontFamily).toBe(FONT.sansSemi);
      expect(p.labelStyle.selected.fontFamily).toBe(FONT.sansSemi);
      expect(FONT.sansSemi).toMatch(/^Archivo-/);
    });

    it('THEN Back keeps the tabs’ default (a non-first tab goes to Today first)', () => {
      expect('backBehavior' in p).toBe(false);
    });
  });
});
