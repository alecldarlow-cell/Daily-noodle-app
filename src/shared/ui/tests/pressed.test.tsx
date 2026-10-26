import { render, screen } from '@testing-library/react-native';
import { Pressable, StyleSheet } from 'react-native';

import { PRESSED, pressable } from '../pressed';

describe('GIVEN a button’s style from pressable()', () => {
  const base = { borderWidth: 1.5, backgroundColor: '#fff' };
  describe('WHEN it is not held', () => {
    it('THEN it is just its own style', () => {
      expect(pressable(base)({ pressed: false })).toBe(base);
    });
  });
  describe('WHEN a finger is on it', () => {
    it('THEN it dims to the shared pressed look, or to the look the caller asks for', () => {
      expect(StyleSheet.flatten(pressable(base)({ pressed: true }))).toEqual({
        ...base,
        ...PRESSED,
      });
      expect(PRESSED.opacity).toBeLessThan(1);
      const own = pressable(base, { backgroundColor: '#eee' })({ pressed: true });
      expect(StyleSheet.flatten(own)).toEqual({ borderWidth: 1.5, backgroundColor: '#eee' });
    });
  });
  describe('WHEN it is on a real Pressable', () => {
    it('THEN the unpressed button renders its own style', async () => {
      await render(<Pressable testID="b" style={pressable(base)} />);
      expect(StyleSheet.flatten(screen.getByTestId('b').props.style)).toEqual(base);
    });
  });
});
