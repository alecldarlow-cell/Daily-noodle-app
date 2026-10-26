import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useBoardFit } from '../useBoardFit';

const layout = (width: number, height: number) =>
  ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } }) as LayoutChangeEvent;

function Slot({ guess, max }: { guess: number; max: number }) {
  const fit = useBoardFit(guess, max);
  return (
    <View testID="slot" onLayout={fit.onLayout}>
      <View testID="board" style={{ width: fit.side }} />
    </View>
  );
}
const lay = (w: number, h: number) => fireEvent(screen.getByTestId('slot'), 'layout', layout(w, h));
const side = () => StyleSheet.flatten(screen.getByTestId('board').props.style).width as number;

describe('GIVEN a board sized by useBoardFit', () => {
  describe('WHEN its slot has not been laid out yet', () => {
    it('THEN the first frame uses the window guess', async () => {
      await render(<Slot guess={358} max={420} />);
      expect(side()).toBe(358);
    });
  });
  describe('WHEN the slot is wider than it is tall (big text, a short phone)', () => {
    it('THEN the board takes the height it really has, less its frame', async () => {
      await render(<Slot guess={358} max={420} />);
      await lay(366, 240);
      expect(side()).toBe(234);
    });
  });
  describe('WHEN the slot is tall (a long phone)', () => {
    it('THEN the width decides, never over the maximum, never below zero', async () => {
      const r = await render(<Slot guess={358} max={420} />);
      await lay(387.5, 640);
      expect(side()).toBe(381);
      await r.rerender(<Slot guess={358} max={300} />);
      expect(side()).toBe(300);
      await lay(4, 4);
      expect(side()).toBe(0);
    });
  });
});
