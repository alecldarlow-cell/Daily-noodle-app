import { act, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { AuthLinkScreen } from '../components/AuthLinkScreen/AuthLinkScreen';
import { fakeClient } from './fakeClient';

let mockUrl: string | null = null;
jest.mock('expo-linking', () => ({ useLinkingURL: () => mockUrl }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

describe('GIVEN the email’s sign-in link opens the app', () => {
  beforeEach(() => jest.clearAllMocks());

  it('THEN the player is signed in and taken to Account', async () => {
    mockUrl = 'dailynoodle://auth#access_token=A&refresh_token=R';
    const { client, raw } = fakeClient();
    await render(<AuthLinkScreen client={client} />);
    await act(async () => {});
    expect(raw.auth.setSession).toHaveBeenCalledWith({ access_token: 'A', refresh_token: 'R' });
    expect(router.replace).toHaveBeenCalledWith('/account');
  });

  it.each([
    [
      'dailynoodle://auth#error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
      'That sign-in link has expired or was already used.',
    ],
    [
      'dailynoodle://auth#access_token=bad&refresh_token=R',
      'That sign-in link has expired or was already used.',
    ],
    ['dailynoodle://somewhere', 'isn’t a sign-in link'],
  ])('THEN a bad link (%s) says why, in the house’s words', async (url, why) => {
    mockUrl = url;
    const { client } = fakeClient();
    await render(<AuthLinkScreen client={client} />);
    await act(async () => {});
    expect(await screen.findByTestId('auth-error')).toHaveTextContent(why, { exact: false });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('THEN a build without sync says so', async () => {
    mockUrl = 'dailynoodle://auth#access_token=A&refresh_token=R';
    await render(<AuthLinkScreen client={null} />);
    await act(async () => {});
    expect(await screen.findByTestId('auth-error')).toHaveTextContent('isn’t available', {
      exact: false,
    });
  });
});
