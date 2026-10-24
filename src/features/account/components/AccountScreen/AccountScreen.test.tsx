import { render, screen } from '@testing-library/react-native';

import { AccountScreen } from './AccountScreen';

describe('GIVEN the Account tab', () => {
  describe('WHEN it opens', () => {
    it('THEN it shows its title', async () => {
      await render(<AccountScreen />);
      expect(screen.getByRole('header', { name: 'Account' })).toBeOnTheScreen();
      expect(screen.getByTestId('account-screen')).toBeOnTheScreen();
    });
  });
});
