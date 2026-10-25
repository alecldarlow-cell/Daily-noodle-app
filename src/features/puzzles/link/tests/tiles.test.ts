import { tileLines } from '../components/LinkBoard';

describe('GIVEN a Link tile’s word', () => {
  describe('WHEN it is a single long word (SPINNAKER)', () => {
    it('THEN it keeps to one line and shrinks, rather than breaking mid-word', () => {
      expect(tileLines('SPINNAKER')).toBe(1);
      expect(tileLines('JIB')).toBe(1);
    });
  });
  describe('WHEN it has a space', () => {
    it('THEN it may take two lines, breaking at the space', () => {
      expect(tileLines('ICE CREAM')).toBe(2);
      expect(tileLines(' PALM ')).toBe(1);
    });
  });
});
