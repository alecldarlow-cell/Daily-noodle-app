import { render, screen } from '@testing-library/react-native';

import { LeaguesScreen } from './LeaguesScreen';

describe('GIVEN the Leagues tab', () => {
  describe('WHEN it opens', () => {
    it('THEN it shows its title', async () => {
      await render(<LeaguesScreen />);
      expect(screen.getByRole('header', { name: 'Leagues' })).toBeOnTheScreen();
      expect(screen.getByTestId('leagues-screen')).toBeOnTheScreen();
    });
  });
});
