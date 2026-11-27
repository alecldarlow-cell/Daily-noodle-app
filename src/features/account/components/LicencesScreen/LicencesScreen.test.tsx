import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { CREDITS, LicencesScreen, NOTICES_URL, PACKAGES } from './LicencesScreen';

describe('GIVEN the Open-source licences screen (#192, review of 27 Nov 2026)', () => {
  describe('WHEN it opens', () => {
    it('THEN it names the fonts, word lists and maps, and counts every package the app is built from', async () => {
      await render(<LicencesScreen />);
      for (const c of CREDITS)
        expect(screen.getByRole('header', { name: c.title })).toBeOnTheScreen();
      expect(screen.getByText(/Kevin Atkinson/)).toBeOnTheScreen();
      expect(
        screen.getByRole('header', { name: `Open-source packages (${PACKAGES.length})` }),
      ).toBeOnTheScreen();
    });

    it('THEN the first packages show with their licence', async () => {
      await render(<LicencesScreen />);
      const first = PACKAGES[0]!;
      expect(screen.getByText(first.name, { exact: false })).toBeOnTheScreen();
      expect(screen.getAllByText(first.license).length).toBeGreaterThan(0);
    });
  });

  describe('WHEN the player taps Full licence texts', () => {
    it('THEN the full notices open on GitHub', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await render(<LicencesScreen />);
      fireEvent.press(screen.getByRole('link', { name: 'Full licence texts' }));
      expect(open).toHaveBeenCalledWith(NOTICES_URL);
      open.mockRestore();
    });

    it('THEN a failure to open is swallowed, never thrown', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no browser'));
      await render(<LicencesScreen />);
      expect(() =>
        fireEvent.press(screen.getByRole('link', { name: 'Full licence texts' })),
      ).not.toThrow();
      open.mockRestore();
    });
  });
});
