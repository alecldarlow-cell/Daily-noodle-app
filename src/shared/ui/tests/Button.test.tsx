import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { RefreshControl, StyleSheet, Text, type RefreshControlProps } from 'react-native';

import { tokensFor } from '@/shared/theme';

import {
  Button,
  buttonColors,
  buttonStyle,
  pressedLook,
  TAP,
  TAP_GAP,
  TextField,
} from '../Button/Button';
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
  describe('WHEN it is drawn in each variant', () => {
    it('THEN every one is at least 48 × 48 in the app’s typeface, and it presses', async () => {
      const onPress = jest.fn();
      await render(
        <>
          <Button label="Go" variant="filled" onPress={onPress} />
          <Button label="Alt" variant="tonal" onPress={onPress} />
          <Button label="Plain" onPress={onPress} grow />
          <Button label="Minor" variant="text" onPress={onPress} />
          <Button label="Warn" variant="tonal" destructive onPress={onPress} />
        </>,
      );
      for (const name of ['Go', 'Alt', 'Plain', 'Minor', 'Warn']) {
        const b = screen.getByRole('button', { name });
        expect(flat(b).minHeight).toBeGreaterThanOrEqual(48);
        expect(flat(b).minWidth).toBeGreaterThanOrEqual(48);
        const label = flat(screen.getByText(name));
        expect(label.fontFamily).toBe('Archivo-Bold');
        expect(label.fontWeight).toBeUndefined();
      }
      expect(TAP).toBe(48);
      expect(TAP_GAP).toBe(8);
      expect(flat(screen.getByRole('button', { name: 'Plain' })).flexGrow).toBe(1);
      await fireEvent.press(screen.getByRole('button', { name: 'Warn' }));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('THEN filled is the accent, tonal the soft tint, text has no fill, all the same height', async () => {
      await render(
        <>
          <Button label="Filled" variant="filled" onPress={jest.fn()} />
          <Button label="Tonal" variant="tonal" onPress={jest.fn()} />
          <Button label="Text" variant="text" onPress={jest.fn()} />
        </>,
      );
      const f = flat(screen.getByRole('button', { name: 'Filled' }));
      const to = flat(screen.getByRole('button', { name: 'Tonal' }));
      const tx = flat(screen.getByRole('button', { name: 'Text' }));
      expect(f.backgroundColor).toBe(light.accent);
      expect(flat(screen.getByText('Filled')).color).toBe(light.onAccent);
      expect(to.backgroundColor).toBe(light.accentSoft);
      expect(flat(screen.getByText('Tonal')).color).toBe(light.accent);
      expect(tx.backgroundColor).toBe('transparent');
      expect(flat(screen.getByText('Text')).color).toBe(light.accent);
      expect(f.minHeight).toBe(to.minHeight);
      expect(to.minHeight).toBe(tx.minHeight);
    });

    it('THEN a destructive button is never filled, and is red, readable in both schemes', () => {
      for (const scheme of ['light', 'dark'] as const) {
        const t = tokensFor(scheme);
        const c = buttonColors(t, 'filled', true);
        expect(c.variant).toBe('tonal');
        expect(c.bg).toBe(t.badSoft);
        expect(c.fg).toBe(t.bad);
        expect(contrast(c.fg, c.bg)).toBeGreaterThanOrEqual(4.5);
        expect(buttonColors(t, 'text', true).fg).toBe(t.bad);
        expect(contrast(t.accent, t.accentSoft)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('THEN the old kinds still map: go filled, alt and plain tonal, warn red tonal', async () => {
      await render(
        <>
          <Button label="Go" kind="go" onPress={jest.fn()} />
          <Button label="Alt" kind="alt" onPress={jest.fn()} />
          <Button label="Plain" kind="plain" onPress={jest.fn()} />
          <Button label="Warn" kind="warn" onPress={jest.fn()} />
        </>,
      );
      const bg = (name: string) => flat(screen.getByRole('button', { name })).backgroundColor;
      expect(bg('Go')).toBe(light.accent);
      expect(bg('Alt')).toBe(light.accentSoft);
      expect(bg('Plain')).toBe(light.accentSoft);
      expect(bg('Warn')).toBe(light.badSoft);
    });
  });

  describe('WHEN a finger is on it', () => {
    it('THEN every variant has a pressed look', () => {
      expect(pressedLook(light, 'filled')).toEqual({ opacity: 0.75 });
      expect(pressedLook(light, 'tonal')).toEqual({ opacity: 0.75 });
      expect(pressedLook(light, 'text')).toEqual({ backgroundColor: light.accentSoft });
      expect(pressedLook(light, 'text', true)).toEqual({ backgroundColor: light.badSoft });
    });

    it('THEN the drawn button takes that look while held, and not when disabled', () => {
      const text = buttonColors(light, 'text');
      expect(flat({ props: { style: buttonStyle(light, text, { pressed: true }) } })).toMatchObject(
        {
          backgroundColor: light.accentSoft,
        },
      );
      expect(flat({ props: { style: buttonStyle(light, text, {}) } }).backgroundColor).toBe(
        'transparent',
      );
      const filled = buttonColors(light, 'filled');
      expect(
        flat({ props: { style: buttonStyle(light, filled, { pressed: true }) } }),
      ).toMatchObject({ backgroundColor: light.accent, opacity: 0.75 });
      expect(flat({ props: { style: buttonStyle(light, filled, { dim: true }) } }).opacity).toBe(
        0.5,
      );
    });
  });

  describe('WHEN it is disabled', () => {
    it('THEN it says so, looks dimmed and does nothing', async () => {
      const onPress = jest.fn();
      await render(<Button label="Wait" disabled onPress={onPress} />);
      const b = screen.getByRole('button', { name: 'Wait' });
      expect(b).toBeDisabled();
      expect(flat(b).opacity).toBe(0.5);
      await fireEvent.press(b);
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('WHEN it is loading', () => {
    it('THEN a spinner replaces the label, it says busy, keeps its name and ignores taps', async () => {
      const onPress = jest.fn();
      await render(
        <Button label="Share result" variant="filled" loading onPress={onPress} testID="sh" />,
      );
      const b = screen.getByRole('button', { name: 'Share result' });
      expect(screen.getByTestId('sh-spinner')).toBeOnTheScreen();
      expect(screen.queryByText('Share result')).toBeNull();
      expect(b.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
      await fireEvent.press(b);
      expect(onPress).not.toHaveBeenCalled();
    });

    it('THEN a press that returns a promise shows the spinner until it settles', async () => {
      let finish: () => void = () => undefined;
      const onPress = jest.fn(
        () =>
          new Promise<void>((r) => {
            finish = r;
          }),
      );
      await render(<Button label="Share leaderboard" onPress={onPress} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Share leaderboard' }));
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('button-spinner')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Share leaderboard' }));
      expect(onPress).toHaveBeenCalledTimes(1);
      await act(async () => finish());
      expect(screen.queryByTestId('button-spinner')).toBeNull();
      expect(screen.getByText('Share leaderboard')).toBeOnTheScreen();
    });

    it('THEN a press whose promise fails also clears the spinner', async () => {
      await render(<Button label="Share" onPress={() => Promise.reject(new Error('x'))} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
      await act(async () => undefined);
      expect(screen.queryByTestId('button-spinner')).toBeNull();
    });

    it('THEN unmounting while it waits is harmless', async () => {
      let finish: () => void = () => undefined;
      await render(
        <Button
          label="Share"
          onPress={() =>
            new Promise<void>((r) => {
              finish = r;
            })
          }
        />,
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
      await screen.unmount();
      await act(async () => finish());
    });
  });

  describe('WHEN it has its own accessibility label and hint', () => {
    it('THEN the reader hears those', async () => {
      await render(
        <Button
          label="Go"
          accessibilityLabel="Play Borders 24"
          accessibilityHint="Opens the puzzle"
          onPress={jest.fn()}
        />,
      );
      const b = screen.getByRole('button', { name: 'Play Borders 24' });
      expect(b.props.accessibilityHint).toBe('Opens the puzzle');
    });
  });
});

describe('GIVEN the house text field', () => {
  it('THEN it is labelled, 48 pt tall like a button, and its edge is at least 3:1 against the card in both schemes', async () => {
    await render(<TextField label="Your email" hint="We send a link." testID="f" />);
    const box = screen.getByLabelText('Your email');
    expect(box).toBe(screen.getByTestId('f'));
    expect(screen.getByText('We send a link.')).toBeOnTheScreen();
    const s = flat(box);
    expect(s.minHeight).toBeGreaterThanOrEqual(48);
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
