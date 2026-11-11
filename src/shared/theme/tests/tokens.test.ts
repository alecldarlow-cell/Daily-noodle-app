import { puzzleTokensFor } from '../puzzle';
import { tokensFor } from '../tokens';

describe('GIVEN the house colour tokens', () => {
  describe('WHEN the phone is in dark mode', () => {
    it('THEN the canvas is the players’ own dark', () => {
      expect(tokensFor('dark').canvas).toBe('#11131A');
    });
  });

  describe('WHEN the phone is in light mode', () => {
    it('THEN the canvas is the site’s light canvas', () => {
      expect(tokensFor('light').canvas).toBe('#FCFCFB');
    });
  });

  describe('WHEN the scheme is unknown', () => {
    it.each([null, undefined, 'unspecified'])('THEN %p falls back to light', (scheme) => {
      expect(tokensFor(scheme)).toBe(tokensFor('light'));
    });
  });

  describe('WHEN comparing the two sets', () => {
    it('THEN both define every token', () => {
      expect(Object.keys(tokensFor('dark')).sort()).toEqual(Object.keys(tokensFor('light')).sort());
    });
  });
});

describe('GIVEN the players’ palette', () => {
  it('THEN the cursor is marigold in both schemes and dark falls back to light otherwise', () => {
    expect(puzzleTokensFor('light').active).toBe('#FFD54A');
    expect(puzzleTokensFor('dark').active).toBe('#FFD54A');
    expect(puzzleTokensFor('dark').activeWord).toBe('#4A4220');
    expect(puzzleTokensFor(null)).toBe(puzzleTokensFor('light'));
    expect(Object.keys(puzzleTokensFor('dark')).sort()).toEqual(
      Object.keys(puzzleTokensFor('light')).sort(),
    );
  });
});

describe('GIVEN the Lab’s colours (11 Nov 2026)', () => {
  /** WCAG contrast of two #RRGGBB colours. */
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x! + 0.05) / (y! + 0.05);
  };
  it.each(['light', 'dark'] as const)('THEN in %s the panel’s small text reads at 4.5:1', (s) => {
    const t = tokensFor(s);
    expect(ratio(t.labInk, t.labSoft)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.ink, t.labSoft)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.accent, t.labSoft)).toBeGreaterThanOrEqual(4.5);
  });
});
