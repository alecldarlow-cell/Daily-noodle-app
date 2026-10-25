import { fitBoard } from '../fitBoard';

describe('GIVEN a square board to size', () => {
  describe('WHEN the phone is roomy', () => {
    it('THEN the board is as big as its maximum or the width allows', () => {
      expect(fitBoard({ width: 390, height: 844 }, 400, 420)).toBe(358);
      expect(fitBoard({ width: 1024, height: 1366 }, 400, 420)).toBe(420);
    });
  });
  describe('WHEN the phone is short (320 × 568)', () => {
    it('THEN the board keeps its readable minimum, still inside the width', () => {
      expect(fitBoard({ width: 320, height: 568 }, 400, 420)).toBe(200);
      expect(fitBoard({ width: 320, height: 568 }, 300, 460)).toBe(268);
    });
  });
  describe('WHEN the window is narrower than the minimum', () => {
    it('THEN the width wins, so nothing scrolls sideways', () => {
      expect(fitBoard({ width: 220, height: 568 }, 400, 420)).toBe(188);
      expect(fitBoard({ width: 10, height: 10 }, 400, 420)).toBe(0);
    });
  });
});
