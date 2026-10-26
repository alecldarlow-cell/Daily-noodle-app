import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/shared/testing';

import { LeaguesScreen } from './LeaguesScreen';

// WP5: the screen now reads its route parameters and asks the server (mocked) for leagues.
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({}),
  useNavigation: () => ({ setParams: jest.fn() }),
}));
jest.mock('../../api/board');

describe('GIVEN the Leagues tab', () => {
  describe('WHEN it opens', () => {
    it('THEN it shows its title', async () => {
      await renderWithProviders(<LeaguesScreen />);
      expect(screen.getByRole('header', { name: 'Leagues' })).toBeOnTheScreen();
      expect(screen.getByTestId('leagues-screen')).toBeOnTheScreen();
    });
  });
});
