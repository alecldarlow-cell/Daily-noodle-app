import { fireEvent, render, screen } from '@testing-library/react-native';
import { RefreshControl, StyleSheet, Text, type RefreshControlProps } from 'react-native';

import { tokensFor } from '@/shared/theme';

import { Button, TextField } from '../Button/Button';
import { Screen } from '../Screen/Screen';

const light = tokensFor('light');
const flat = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

/** WCAG relative luminance contrast of two #RRGGBB colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('GIVEN the house button', () => {
  describe('WHEN it is drawn in each kind', () => {
    it('THEN it is a 44 pt touch target in the app’s typeface, and it presses', async () => {
      const onPress = jest.fn();
      await render(
        <>
          <Button label="Go" kind="go" onPress={onPress} />
          <Button label="Alt" kind="alt" onPress={onPress} />
          <Button label="Plain" onPress={onPress} grow />
          <Button label="Warn" kind="warn" onPress={onPress} />
        </>,
      );
      for (const name of ['Go', 'Alt', 'Plain', 'Warn']) {
        const b = screen.getByRole('button', { name });
        expect(flat(b).minHeight).toBeGreaterThanOrEqual(44);
        const label = flat(screen.getByText(name));
        expect(label.fontFamily).toBe('Archivo-Bold');
        expect(label.fontWeight).toBeUndefined();
      }
      expect(flat(screen.getByRole('button', { name: 'Go' }))).toMatchObject({
        backgroundColor: light.accent,
      });
      expect(flat(screen.getByText('Go')).color).toBe(light.onAccent);
      expect(flat(screen.getByRole('button', { name: 'Plain' })).flexGrow).toBe(1);
      await fireEvent.press(screen.getByRole('button', { name: 'Warn' }));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('THEN a disabled one says so and does nothing', async () => {
      const onPress = jest.fn();
      await render(<Button label="Wait" disabled onPress={onPress} />);
      expect(screen.getByRole('button', { name: 'Wait' })).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Wait' }));
      expect(onPress).not.toHaveBeenCalled();
    });
  });
});

describe('GIVEN the house text field', () => {
  it('THEN it is labelled, 44 pt tall, and its edge is at least 3:1 against the card in both schemes', async () => {
    await render(<TextField label="Your email" hint="We send a link." testID="f" />);
    const box = screen.getByLabelText('Your email');
    expect(box).toBe(screen.getByTestId('f'));
    expect(screen.getByText('We send a link.')).toBeOnTheScreen();
    const s = flat(box);
    expect(s.minHeight).toBeGreaterThanOrEqual(44);
    expect(s.borderWidth).toBeGreaterThanOrEqual(1.5);
    expect(s.borderColor).toBe(light.muted);
    for (const scheme of ['light', 'dark'] as const) {
      const t = tokensFor(scheme);
      expect(contrast(t.muted, t.paper)).toBeGreaterThanOrEqual(3);
      expect(contrast(t.muted, t.canvas)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('GIVEN a page with pull to refresh', () => {
  it('THEN its spinner takes the house colours, and a tap with the keyboard up isn’t swallowed', async () => {
    const onRefresh = jest.fn();
    await render(
      <Screen title="Leagues" onRefresh={onRefresh} refreshing>
        <Text>Body</Text>
      </Screen>,
    );
    const rc = (RefreshControl as unknown as { latestRef: { props: RefreshControlProps } })
      .latestRef.props;
    expect(rc).toMatchObject({
      refreshing: true,
      tintColor: light.muted,
      colors: [light.accent],
      progressBackgroundColor: light.paper,
    });
    rc.onRefresh!();
    expect(onRefresh).toHaveBeenCalled();
    // The page's scroll view holds the masthead: it keeps a tap for the button pressed.
    let el = screen.getByRole('header', { name: 'Leagues' }).parent;
    while (el && el.props.keyboardShouldPersistTaps === undefined) el = el.parent;
    expect(el?.props.keyboardShouldPersistTaps).toBe('handled');
  });
});
