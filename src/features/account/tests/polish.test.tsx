/* Polish C: house wording for sign-in failures, a choice left by sync, and a way out of /auth. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { AccountScreen } from '../components/AccountScreen/AccountScreen';
import { AuthLinkScreen, TOO_LONG } from '../components/AuthLinkScreen/AuthLinkScreen';
import { SyncCard } from '../components/SyncCard/SyncCard';
import { AccountError, AUTH_WORDS, authMessage, sayAccountError } from '../hooks/authErrors';
import { fakeClient, memoryStorage } from './fakeClient';

let mockUrl: string | null = null;
jest.mock('expo-linking', () => ({ useLinkingURL: () => mockUrl }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), replace: jest.fn() } }));

const flush = () => act(async () => {});
const PID_A = '00000000-0000-4000-8000-00000000000a';
const PID_B = '00000000-0000-4000-8000-00000000000b';

beforeEach(() => {
  jest.clearAllMocks();
  mockUrl = null;
});

describe('GIVEN a message from Supabase or a failed request', () => {
  it.each([
    ['Email rate limit exceeded', AUTH_WORDS.rateLimit],
    ['For security purposes, you can only request this after 60 seconds.', AUTH_WORDS.rateLimit],
    ['TypeError: Network request failed', AUTH_WORDS.offline],
    ['FetchError: The user aborted a request.', AUTH_WORDS.offline],
    ['Email link is invalid or has expired', AUTH_WORDS.expired],
    ['Invalid token', AUTH_WORDS.expired],
    ['Unable to validate email address: invalid format', AUTH_WORDS.badEmail],
    ['relation "sync_docs" does not exist', AUTH_WORDS.wrong],
    ['', AUTH_WORDS.wrong],
  ])('THEN “%s” is shown as the house’s line', (raw, said) => {
    expect(authMessage(raw)).toBe(said);
  });

  it('THEN our own words pass through, and anything else is read for its kind', () => {
    expect(sayAccountError(new AccountError('Enter your email address.'))).toBe(
      'Enter your email address.',
    );
    expect(sayAccountError(new Error('Email rate limit exceeded'))).toBe(AUTH_WORDS.rateLimit);
    expect(sayAccountError('nope')).toBe(AUTH_WORDS.wrong);
  });
});

describe('GIVEN a signed-in player', () => {
  describe('WHEN Sync now brings an account that plays as someone else in leagues', () => {
    it('THEN the sync line points to the choice on Leagues', async () => {
      const store = memoryStorage({
        'noodle-board-v1': {
          pid: PID_A,
          cur: 'ABCD',
          leagues: [{ code: 'ABCD', name: 'Noodlers', nick: 'Alec', owner: true }],
        },
      });
      const { client } = fakeClient({
        email: 'a@b.co',
        remote: {
          'noodle-board-v1': {
            pid: PID_B,
            cur: 'WXYZ',
            leagues: [{ code: 'WXYZ', name: 'Work', nick: 'A', owner: false }],
          },
        },
      });
      await render(<SyncCard client={client} store={store} />);
      await flush();
      expect(screen.queryByTestId('sync-waiting')).toBeNull();
      await act(async () => fireEvent.press(screen.getByTestId('sync-now')));
      expect(await screen.findByTestId('sync-waiting')).toHaveTextContent(
        'Your account plays in other leagues than this phone.',
      );
      expect(screen.queryByTestId('sync-last')).toBeNull();
      expect(screen.queryByText('Up to date.')).toBeNull();
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Choose on Leagues' })),
      );
      expect(router.navigate).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { go: 'home', n: expect.any(String) },
      });
    });
  });

  describe('WHEN Sync now can’t reach the server', () => {
    it('THEN it says to check the connection, not the request’s raw error', async () => {
      const { client } = fakeClient({ email: 'a@b.co', fail: 'TypeError: Network request failed' });
      await render(<SyncCard client={client} store={memoryStorage()} />);
      await flush();
      await act(async () => fireEvent.press(screen.getByTestId('sync-now')));
      expect(await screen.findByTestId('sync-msg')).toHaveTextContent(AUTH_WORDS.offline);
      expect(screen.queryByText(/TypeError/)).toBeNull();
      // The error takes the sync line, with a way to try again.
      expect(screen.getByTestId('sync-line')).toHaveTextContent(/Try again/);
      expect(screen.queryByTestId('sync-last')).toBeNull();
    });
  });
});

describe('GIVEN the sign-in screen is waiting', () => {
  describe('WHEN no link arrives, or Supabase never answers', () => {
    it('THEN it says it is signing in, offers Cancel back to Account', async () => {
      await render(<AuthLinkScreen client={fakeClient().client} />);
      expect(screen.getByTestId('auth-waiting')).toHaveTextContent('Signing you in…');
      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Cancel' })));
      expect(router.replace).toHaveBeenCalledWith('/account');
    });

    it('THEN after a while it stops spinning and says so, with the way back', async () => {
      jest.useFakeTimers();
      try {
        const { client, raw } = fakeClient();
        raw.auth.setSession.mockImplementation(() => new Promise(() => {}));
        mockUrl = 'dailynoodle://auth#access_token=A&refresh_token=R';
        await render(<AuthLinkScreen client={client} waitMs={15_000} />);
        await act(async () => jest.advanceTimersByTime(14_000));
        expect(screen.queryByTestId('auth-error')).toBeNull();
        await act(async () => jest.advanceTimersByTime(1_500));
        expect(screen.getByTestId('auth-error')).toHaveTextContent(TOO_LONG, { exact: false });
        expect(screen.queryByTestId('auth-waiting')).toBeNull();
        expect(router.replace).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});

describe('GIVEN the Account tab', () => {
  describe('WHEN “Join with a code” is tapped twice (Back on Leagues in between)', () => {
    it('THEN each tap is a new ask for Leagues', async () => {
      await render(<AccountScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Join with a code' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Join with a code' }));
      const asks = jest
        .mocked(router.navigate)
        .mock.calls.map(
          (c) => c[0] as unknown as { pathname: string; params: { go: string; n: string } },
        );
      expect(asks.map((a) => [a.pathname, a.params.go])).toEqual([
        ['/leagues', 'claim'],
        ['/leagues', 'claim'],
      ]);
      expect(asks[0]!.params.n).not.toBe(asks[1]!.params.n);
    });
  });
});
