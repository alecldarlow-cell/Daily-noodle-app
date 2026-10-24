import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { AccountScreen } from './AccountScreen';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

describe('GIVEN the Account tab', () => {
  describe('WHEN it opens', () => {
    it('THEN it shows its title', async () => {
      await render(<AccountScreen />);
      expect(screen.getByRole('header', { name: 'Account' })).toBeOnTheScreen();
      expect(screen.getByTestId('account-screen')).toBeOnTheScreen();
    });
  });

  describe('WHEN someone who already plays elsewhere taps “Bring my leagues here”', () => {
    it('THEN Leagues opens on “Already in a league?”', async () => {
      await render(<AccountScreen />);
      expect(screen.getByRole('header', { name: 'Already a player?' })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Bring my leagues here' }));
      expect(router.navigate).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { go: 'claim' },
      });
    });
  });
});
