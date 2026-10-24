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
