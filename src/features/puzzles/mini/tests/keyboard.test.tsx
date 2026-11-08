import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/shared/testing';

import {
  DEL_MAX,
  estimateWidth,
  KB_ROWS,
  KEY_GAP,
  KEY_MAX,
  KEY_SHORT,
  KEY_TALL,
  keyHeight,
  keyWidths,
  MiniKeyboard,
} from '../components/MiniKeyboard';

/** A row's width with these key sizes: its keys plus the gaps between them (the last row: Help, Z–M, ⌫). */
const rowWidth = (i: number, key: number, del: number) => {
  const n = KB_ROWS[i]!.length;
  return i === 2 ? n * key + 2 * del + (n + 1) * KEY_GAP : n * key + (n - 1) * KEY_GAP;
};

const styleOf = (id: string) => {
  const style = (screen.getByTestId(id).props as { style?: unknown }).style;
  return StyleSheet.flatten(style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};
};
const widthOf = (id: string): unknown => styleOf(id).width;

const layout = (width: number) =>
  fireEvent(screen.getByTestId('mini-keyboard'), 'layout', {
    nativeEvent: { layout: { width, height: 150, x: 0, y: 0 } },
  });

describe('GIVEN the Mini keyboard', () => {
  describe('WHEN it is sized for any width a phone gives it (250–560 pt)', () => {
    it('THEN every row fits, every key is usable, and Help and ⌫ are at least a key wide', () => {
      for (let w = 250; w <= 560; w += 0.25) {
        const { key, del } = keyWidths(w);
        expect(key).toBeGreaterThanOrEqual(20);
        expect(key).toBeLessThanOrEqual(KEY_MAX);
        expect(del).toBeGreaterThanOrEqual(key);
        expect(del).toBeLessThanOrEqual(DEL_MAX);
        for (const i of [0, 1, 2]) expect(rowWidth(i, key, del)).toBeLessThanOrEqual(w);
      }
    });
  });

  describe('WHEN the slot is 384.7 pt (a 393 pt phone such as a Pixel 4a or 5, edge to edge)', () => {
    it('THEN the bottom row keeps full-size keys, where flex sizing collapsed them', () => {
      expect(keyWidths(384.7)).toEqual({ key: 33, del: 56 });
    });
  });

  describe('WHEN there is room to spare', () => {
    it('THEN keys stop at their maximum', () => {
      expect(keyWidths(552)).toEqual({ key: KEY_MAX, del: DEL_MAX });
    });
  });

  describe('WHEN it first draws, before it is measured', () => {
    it('THEN it estimates from the window less the screen padding plus the bleed, up to the content cap', () => {
      expect(estimateWidth(393)).toBe(385);
      expect(estimateWidth(1024)).toBe(552);
    });
  });

  describe('WHEN it is drawn and then measured', () => {
    it('THEN every letter key, Help and ⌫ take the measured widths, and keys still type', async () => {
      const onKey = jest.fn();
      const onDelete = jest.fn();
      const onHelp = jest.fn();
      await renderWithProviders(<MiniKeyboard onKey={onKey} onDelete={onDelete} onHelp={onHelp} />);
      await layout(384.7);
      for (const row of KB_ROWS) for (const ch of row) expect(widthOf(`key-${ch}`)).toBe(33);
      expect(widthOf('key-del')).toBe(56);
      expect(widthOf('key-help')).toBe(56);
      await fireEvent.press(screen.getByTestId('key-Z'));
      await fireEvent.press(screen.getByTestId('key-del'));
      await fireEvent.press(screen.getByTestId('key-help'));
      expect(onKey).toHaveBeenCalledWith('Z');
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onHelp).toHaveBeenCalledTimes(1);

      await layout(300);
      expect(widthOf('key-M')).toBe(keyWidths(300).key);
    });
  });

  describe('WHEN it is laid out', () => {
    it('THEN Help is the first key of the bottom row and ⌫ the last, in the QWERTY stagger', async () => {
      await renderWithProviders(
        <MiniKeyboard onKey={jest.fn()} onDelete={jest.fn()} onHelp={jest.fn()} />,
      );
      const names = screen
        .getAllByRole('button')
        .map((b) => (b.props as { accessibilityLabel?: string }).accessibilityLabel);
      expect(names.slice(-9)).toEqual(['Help', ...KB_ROWS[2], 'Delete']);
      expect(names.slice(0, 10)).toEqual([...KB_ROWS[0]]);
    });
  });

  describe('WHEN the phone is tall or short', () => {
    it('THEN keys are tall from 700 pt of window, and keep the old height below it', () => {
      expect(keyHeight(844)).toBe(KEY_TALL);
      expect(keyHeight(700)).toBe(KEY_TALL);
      expect(keyHeight(640)).toBe(KEY_SHORT);
      expect(KEY_TALL).toBeGreaterThanOrEqual(56);
    });
  });
});
