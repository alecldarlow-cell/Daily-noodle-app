import { puzzleTokensFor } from '../puzzle';
import { tokensFor } from '../tokens';

/** WCAG relative luminance of a #RRGGBB colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

describe('GIVEN the players’ paper (Alec’s call, 26 Oct 2026)', () => {
  describe('WHEN the phone is in light mode', () => {
    const pt = puzzleTokensFor('light');

    it('THEN a puzzle sits on the same warm off-white as Today and Archive', () => {
      expect(pt.paper).toBe(tokensFor('light').canvas);
      expect(pt.paper).not.toBe('#EDEEF2');
    });

    it('THEN the start card and share card still stand apart from the paper', () => {
      expect(pt.sheet).not.toBe(pt.paper);
      // a visible step: the card is darker than the paper, not a white that vanishes on it
      expect(luminance(pt.paper) - luminance(pt.sheet)).toBeGreaterThan(0.04);
      // and the board's white cells are still white
      expect(pt.card).toBe('#FFFFFF');
    });
  });

  describe('WHEN the phone is in dark mode', () => {
    it('THEN nothing changes', () => {
      const pt = puzzleTokensFor('dark');
      expect(pt.paper).toBe('#11131A');
      expect(pt.sheet).toBe('#1B1E29');
      expect(pt.card).toBe('#2E3344');
    });
  });
});
