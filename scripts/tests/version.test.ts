import app from '../../app.json';
import pkg from '../../package.json';

describe('GIVEN the app’s version', () => {
  describe('WHEN a build reads it from app.json', () => {
    it('THEN it is 0.3.0, the same as package.json, so the Play listing and the Account screen agree', () => {
      expect(app.expo.version).toBe('0.3.0');
      expect(pkg.version).toBe(app.expo.version);
    });
  });
});
