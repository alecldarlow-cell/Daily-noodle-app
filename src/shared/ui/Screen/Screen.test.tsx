import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Screen } from './Screen';

describe('GIVEN a Screen', () => {
  describe('WHEN it renders with a title and content', () => {
    it('THEN the title is a header and the content is shown', async () => {
      await render(
        <Screen title="Today">
          <Text>Body</Text>
        </Screen>,
      );
      expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
      expect(screen.getByText('Body')).toBeOnTheScreen();
    });
  });
});
