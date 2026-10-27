import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/shared/testing';

import {
  DEL_MAX,
  estimateWidth,
  KB_ROWS,
  KEY_GAP,
  KEY_MAX,
  keyWidths,
  MiniKeyboard,
} from '../components/MiniKeyboard';

/** A row's width with these key sizes: its keys plus the gaps between them. */
const rowWidth = (i: number, key: number, del: number) => {
  const n = KB_ROWS[i]!.length;
  return i === 2 ? n * key + del + n * KEY_GAP : n * key + (n - 1) * KEY_GAP;
};

const widthOf = (id: string): unknown => {
  const style = (screen.getByTestId(id).props as { style?: unknown }).style;
  return (StyleSheet.flatten(style as Parameters<typeof StyleSheet.flatten>[0]) ?? {}).width;
};

const layout = (width: number) =>
  fireEvent(screen.getByTestId('mini-keyboard'), 'layout', {
    nativeEvent: { layout: { width, height: 150, x: 0, y: 0 } },
  });

describe('GIVEN the Mini keyboard', () => {
  describe('WHEN it is sized for any width a phone gives it (250–560 pt)', () => {
    it('THEN every row fits, every key is usable, and ⌫ is at least a key wide', () => {
      for (let w = 250; w <= 560; w += 0.25) {
        const { key, del } = keyWidths(w);
        expect(key).toBeGreaterThanOrEqual(21);
        expect(key).toBeLessThanOrEqual(KEY_MAX);
        expect(del).toBeGreaterThanOrEqual(key);
        expect(del).toBeLessThanOrEqual(DEL_MAX);
        for (const i of [0, 1, 2]) expect(rowWidth(i, key, del)).toBeLessThanOrEqual(w);
      }
    });
  });

  describe('WHEN the slot is 368.7 pt (a 393 pt phone such as a Pixel 4a or 5)', () => {
    it('THEN the bottom row keeps full-size keys, where flex sizing collapsed them', () => {
      expect(keyWidths(368.7)).toEqual({ key: 33, del: 50 });
    });
  });

  describe('WHEN there is room to spare', () => {
    it('THEN keys stop at their maximum', () => {
      expect(keyWidths(536)).toEqual({ key: KEY_MAX, del: 60 });
    });
  });

  describe('WHEN it first draws, before it is measured', () => {
    it('THEN it estimates from the window less the screen padding, up to the content cap', () => {
      expect(estimateWidth(393)).toBe(369);
      expect(estimateWidth(1024)).toBe(536);
    });
  });

  describe('WHEN it is drawn and then measured', () => {
    it('THEN every letter key and ⌫ take the measured widths, and keys still type', async () => {
      const onKey = jest.fn();
      const onDelete = jest.fn();
      await renderWithProviders(<MiniKeyboard onKey={onKey} onDelete={onDelete} />);
      await layout(368.7);
      for (const row of KB_ROWS) for (const ch of row) expect(widthOf(`key-${ch}`)).toBe(33);
      expect(widthOf('key-del')).toBe(50);
      await fireEvent.press(screen.getByTestId('key-Z'));
      await fireEvent.press(screen.getByTestId('key-del'));
      expect(onKey).toHaveBeenCalledWith('Z');
      expect(onDelete).toHaveBeenCalledTimes(1);

      await layout(300);
      expect(widthOf('key-M')).toBe(keyWidths(300).key);
    });
  });
});
