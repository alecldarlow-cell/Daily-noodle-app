import { HttpError, isConnectionError } from '../http';

describe('GIVEN a load that failed', () => {
  describe('WHEN fetch itself could not reach the network', () => {
    it('THEN it counts as no connection', () => {
      expect(isConnectionError(new TypeError('Network request failed'))).toBe(true);
      expect(isConnectionError(new TypeError('Failed to fetch'))).toBe(true);
    });
  });

  describe('WHEN the time limit ran out', () => {
    it('THEN it counts as no connection', () => {
      const abort = new Error('Aborted');
      abort.name = 'AbortError';
      expect(isConnectionError(abort)).toBe(true);
    });
  });

  describe('WHEN the site answered, but badly', () => {
    it('THEN it is not “No connection”', () => {
      expect(isConnectionError(new HttpError(503, 'https://dailynoodle.co.uk/x.json'))).toBe(false);
      expect(isConnectionError(new SyntaxError('Unexpected token <'))).toBe(false);
      expect(isConnectionError(new TypeError('Cannot read properties of undefined'))).toBe(false);
      expect(isConnectionError(new Error('Today’s list is still dated 2026-10-25'))).toBe(false);
      expect(isConnectionError(null)).toBe(false);
    });
  });
});
