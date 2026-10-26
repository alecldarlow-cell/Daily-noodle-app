import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { BUILD_ENV } from '@/shared/env';

import { AccountScreen } from './AccountScreen';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

const env = BUILD_ENV as Record<string, string | undefined>;
const SAVED = { ...env };
afterEach(() => {
  Object.assign(env, SAVED);
});

describe('GIVEN the Account tab', () => {
  describe('WHEN it opens', () => {
    it('THEN it shows its title', async () => {
      await render(<AccountScreen />);
      expect(screen.getByRole('header', { name: 'Account' })).toBeOnTheScreen();
      expect(screen.getByTestId('account-screen')).toBeOnTheScreen();
    });
  });

  describe('WHEN someone who already plays elsewhere taps “I have a league PIN”', () => {
    it('THEN Leagues opens on “Already in a league?”', async () => {
      await render(<AccountScreen />);
      expect(screen.getByRole('header', { name: 'Already a player?' })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'I have a league PIN' }));
      expect(router.navigate).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { go: 'claim', n: expect.any(String) },
      });
    });
  });

  describe('WHEN sign-in is in the build', () => {
    it('THEN signing in is the way to bring leagues across, and the PIN the other', async () => {
      env.EXPO_PUBLIC_SYNC = '1';
      env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.invalid';
      env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
      await render(<AccountScreen />);
      expect(
        screen.getByText(/Sign in above with the same email there and here/),
      ).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'I have a league PIN' })).toBeOnTheScreen();
    });
  });

  describe('WHEN sign-in isn’t in the build', () => {
    it('THEN only the league code and PIN are offered', async () => {
      env.EXPO_PUBLIC_SYNC = undefined;
      await render(<AccountScreen />);
      expect(screen.queryByText(/Sign in above/)).toBeNull();
      expect(screen.getByText(/with your league’s code and PIN/)).toBeOnTheScreen();
    });
  });

  describe('WHEN the player taps the privacy link', () => {
    it('THEN the privacy page opens inside the app', async () => {
      await render(<AccountScreen />);
      await fireEvent.press(
        screen.getByRole('link', { name: 'Privacy: what’s recorded, and how to stop it' }),
      );
      expect(router.navigate).toHaveBeenCalledWith('/privacy');
    });
  });
});
