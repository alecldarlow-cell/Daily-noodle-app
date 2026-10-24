import { render, screen } from '@testing-library/react-native';

import { ArchiveScreen } from './ArchiveScreen';

describe('GIVEN the Archive tab', () => {
  describe('WHEN it opens', () => {
    it('THEN it shows its title', async () => {
      await render(<ArchiveScreen />);
      expect(screen.getByRole('header', { name: 'Archive' })).toBeOnTheScreen();
      expect(screen.getByTestId('archive-screen')).toBeOnTheScreen();
    });
  });
});
