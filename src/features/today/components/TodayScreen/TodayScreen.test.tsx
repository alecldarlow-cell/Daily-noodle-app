import { render, screen } from '@testing-library/react-native';

import { TodayScreen } from './TodayScreen';

describe('GIVEN the Today tab', () => {
  describe('WHEN it opens', () => {
    it('THEN it shows its title', async () => {
      await render(<TodayScreen />);
      expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
      expect(screen.getByTestId('today-screen')).toBeOnTheScreen();
    });
  });
});
