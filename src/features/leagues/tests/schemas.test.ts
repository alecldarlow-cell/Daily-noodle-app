import {
  claimSchema,
  codeFrom,
  firstError,
  joinSchema,
  leagueNameSchema,
  nicknameSchema,
  pinSchema,
  startSchema,
  tidy,
} from '../schemas';

describe('GIVEN the league forms’ checks (the server’s limits)', () => {
  describe('WHEN a nickname is checked', () => {
    it('THEN 2–16 letters or numbers pass, tidied as the server tidies them', () => {
      expect(firstError(nicknameSchema, '  Alec  ')).toBeNull();
      expect(nicknameSchema.cast('  Jo   2 ')).toBe('Jo 2');
      expect(firstError(nicknameSchema, 'Zoë')).toBeNull();
      expect(firstError(nicknameSchema, 'O’Neil-2')).toBeNull();
    });
    it('THEN too short, too long, or odd characters get the site’s message', () => {
      for (const bad of ['A', '', 'A'.repeat(17), '-dash', 'hi!']) {
        expect(firstError(nicknameSchema, bad)).toBe('Nicknames are 2–16 letters or numbers.');
      }
    });
  });

  describe('WHEN a league name is checked', () => {
    it('THEN up to 30 characters pass and longer is refused', () => {
      expect(firstError(leagueNameSchema, 'Noodle family')).toBeNull();
      expect(firstError(leagueNameSchema, 'x'.repeat(31))).toBe(
        'League names are 2–30 letters or numbers.',
      );
    });
  });

  describe('WHEN a code or invite link is entered', () => {
    it('THEN the code is read from either, upper case, as board.html reads ?join=', () => {
      expect(codeFrom('abcd 2345')).toBe('ABCD2345');
      expect(codeFrom('https://dailynoodle.co.uk/board.html?join=abcd2345&v=2')).toBe('ABCD2345');
      expect(codeFrom('Join Family: https://dailynoodle.co.uk/board.html?join=WXYZ2345&v=2')).toBe(
        'WXYZ2345',
      );
      expect(codeFrom('https://dailynoodle.co.uk/join.html?c=abcd2345')).toBe('ABCD2345');
      expect(codeFrom('Join Family: https://dailynoodle.co.uk/join.html?x=1&c=WXYZ2345')).toBe(
        'WXYZ2345',
      );
      expect(codeFrom('?join=%41BCD')).toBe('ABCD');
      expect(codeFrom('?join=%E0')).toBe('E0');
      expect(firstError(joinSchema, { code: 'AB', nick: 'Alec', pin: '' })).toBe(
        'Enter the league’s code, or paste its invite link.',
      );
    });
  });

  describe('WHEN a PIN is entered', () => {
    it('THEN exactly four numbers pass; on the start and join forms it may be blank', () => {
      expect(firstError(pinSchema, '0123')).toBeNull();
      expect(firstError(pinSchema, '123')).toBe('PINs are 4 numbers.');
      expect(firstError(pinSchema, '12a4')).toBe('PINs are 4 numbers.');
      expect(firstError(startSchema, { name: 'Family', nick: 'Alec', pin: '' })).toBeNull();
      expect(firstError(startSchema, { name: 'Family', nick: 'Alec', pin: '12' })).toBe(
        'PINs are 4 numbers.',
      );
      expect(firstError(claimSchema, { code: 'ABCD2345', nick: '', pin: '' })).toBe(
        'Nobody in that league has that nickname.',
      );
    });
  });

  it('THEN tidy collapses spaces and copes with nothing', () => {
    expect(tidy(undefined)).toBe('');
    expect(tidy(' a \n b ')).toBe('a b');
  });
});
