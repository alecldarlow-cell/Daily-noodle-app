import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking, StyleSheet } from 'react-native';

import { buildLine } from '@/shared/build';
import { APP_SETTINGS_KEY, DEFAULT_SETTINGS, readSettings, saveSettings } from '@/shared/settings';
import { appStorage } from '@/shared/storage';
import { tokensFor } from '@/shared/theme';

import { fakeClient, memoryStorage } from '../../tests/fakeClient';
import { AccountScreen, CONTACT_EMAIL, deletionRequestUrl } from './AccountScreen';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

const flush = () => act(async () => {});
const light = tokensFor('light');
const flat = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  saveSettings(DEFAULT_SETTINGS);
});

describe('GIVEN the Account tab in a build without sign-in', () => {
  describe('WHEN it opens', () => {
    it('THEN it shows Settings, Leagues and Privacy & data, then the version, and no sign-in', async () => {
      await render(<AccountScreen client={null} />);
      expect(screen.getByRole('header', { name: 'Account' })).toBeOnTheScreen();
      expect(screen.queryByTestId('sync-card')).toBeNull();
      for (const name of ['Settings', 'Leagues', 'Privacy & data'])
        expect(screen.getByRole('header', { name })).toBeOnTheScreen();
      expect(screen.getByText(/In a league already\? Join with your league’s code and PIN\./));
      expect(screen.queryByText(/Sign in above/)).toBeNull();
      // Nothing synced, no account: neither data row.
      expect(screen.queryByTestId('account-delete')).toBeNull();
      expect(screen.queryByTestId('account-request-deletion')).toBeNull();
      expect(screen.getByTestId('account-build')).toHaveTextContent(buildLine());
    });
  });

  describe('WHEN someone already in a league taps “Join with a code”', () => {
    it('THEN Leagues opens on its join form', async () => {
      await render(<AccountScreen client={null} />);
      expect(screen.getByRole('header', { name: 'Join a league' })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Join with a code' }));
      expect(router.navigate).toHaveBeenCalledWith({
        pathname: '/leagues',
        params: { go: 'claim', n: expect.any(String) },
      });
    });
  });

  describe('WHEN the player taps the privacy row (AF-001)', () => {
    it('THEN it reads “how to change it”, and the privacy page opens inside the app', async () => {
      await render(<AccountScreen client={null} />);
      await fireEvent.press(
        screen.getByRole('link', { name: 'Privacy: what’s recorded and how to change it' }),
      );
      expect(router.navigate).toHaveBeenCalledWith('/privacy');
      expect(screen.queryByText(/how to stop it/)).toBeNull();
    });
  });
});

describe('GIVEN the app-wide settings on Account (AF-012)', () => {
  describe('WHEN the player switches Vibration off, then on', () => {
    it('THEN it is on by default, and each change is saved under the app’s new key', async () => {
      await render(<AccountScreen client={null} />);
      const sw = screen.getByLabelText('Vibration');
      expect(sw.props.value).toBe(true);
      await act(async () => fireEvent(sw, 'valueChange', false));
      expect(readSettings().vibration).toBe(false);
      expect(JSON.parse(appStorage.getItem(APP_SETTINGS_KEY)!)).toMatchObject({
        vibration: false,
      });
      expect(screen.getByLabelText('Vibration').props.value).toBe(false);
      await act(async () => fireEvent(screen.getByLabelText('Vibration'), 'valueChange', true));
      expect(readSettings().vibration).toBe(true);
    });
  });

  describe('WHEN the player picks Reduced animations, then Follow phone', () => {
    it('THEN the choice is a radio pair, saved, and shown as chosen', async () => {
      await render(<AccountScreen client={null} />);
      const phone = screen.getByRole('radio', { name: 'Follow phone' });
      const reduced = screen.getByRole('radio', { name: 'Reduced' });
      expect(phone.props.accessibilityState).toMatchObject({ checked: true });
      expect(reduced.props.accessibilityState).toMatchObject({ checked: false });
      await act(async () => fireEvent.press(reduced));
      expect(readSettings().motion).toBe('reduced');
      expect(screen.getByRole('radio', { name: 'Reduced' }).props.accessibilityState).toMatchObject(
        { checked: true },
      );
      await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Follow phone' })));
      expect(readSettings().motion).toBe('phone');
    });
  });

  it('THEN there is no Sound switch yet', async () => {
    await render(<AccountScreen client={null} />);
    expect(screen.queryByText(/Sound/)).toBeNull();
  });
});

describe('GIVEN a signed-out player in a build with sign-in', () => {
  it('THEN the Leagues card points to signing in above, or the code and PIN', async () => {
    const { client } = fakeClient();
    await render(<AccountScreen client={client} store={memoryStorage()} />);
    await flush();
    expect(
      screen.getByText(
        'In a league already? Sign in above with the same email, or join with your league’s code and PIN.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Join with a code' })).toBeOnTheScreen();
    // Nothing to delete while signed out; an account can still be asked to be deleted.
    expect(screen.queryByTestId('account-delete')).toBeNull();
    expect(screen.getByTestId('account-request-deletion')).toBeOnTheScreen();
  });
});

describe('GIVEN a signed-in player', () => {
  const signedIn = async (opts: { fail?: string } = {}) => {
    const r = fakeClient({ email: 'alec@example.com', remote: { 'digi-mini-v1': { v: 1 } } });
    const fail = opts.fail;
    if (fail) {
      const ok = r.raw.rpc.getMockImplementation()!;
      r.raw.rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) =>
        fn === 'sync_forget' ? { data: null, error: { message: fail } } : ok(fn, args),
      );
    }
    await render(<AccountScreen client={r.client} store={memoryStorage()} />);
    await flush();
    return r;
  };

  it('THEN the Leagues card is “Join a league” with its short line', async () => {
    await signedIn();
    expect(screen.getByText('Got an invite code and PIN? Join here.')).toBeOnTheScreen();
    expect(screen.queryByText(/Already a player/)).toBeNull();
  });

  describe('WHEN they open “Delete my saved data”', () => {
    it('THEN it is a plain row, and the confirm screen says what goes and what stays', async () => {
      await signedIn();
      const row = screen.getByRole('button', { name: 'Delete my saved data' });
      // A plain row in ink, not a red control.
      expect(flat(within(row).getByText('Delete my saved data')).color).toBe(light.ink);
      await act(async () => fireEvent.press(row));
      expect(screen.getByRole('header', { name: 'Delete your saved data?' })).toBeOnTheScreen();
      expect(screen.getByTestId('delete-goes')).toHaveTextContent(/kept for alec@example\.com/);
      expect(screen.getByTestId('delete-goes')).toHaveTextContent(/signed out/);
      expect(screen.getByTestId('delete-stays')).toHaveTextContent(/Everything on this phone/);
      const del = screen.getByRole('button', { name: 'Delete' });
      // Red, and never the filled accent.
      expect(flat(del).backgroundColor).toBe(light.badSoft);
      expect(flat(del).backgroundColor).not.toBe(light.accent);
      expect(flat(within(del).getByText('Delete')).color).toBe(light.bad);
    });

    it('THEN Cancel goes back and deletes nothing', async () => {
      const { remote } = await signedIn();
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Delete my saved data' })),
      );
      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Cancel' })));
      expect(screen.getByRole('header', { name: 'Settings' })).toBeOnTheScreen();
      expect(remote).toEqual({ 'digi-mini-v1': { v: 1 } });
    });

    it('THEN Delete removes the synced copy, signs out, and says what happened', async () => {
      const { remote, raw } = await signedIn();
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Delete my saved data' })),
      );
      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Delete' })));
      await flush();
      expect(remote).toEqual({});
      expect(raw.auth.signOut).toHaveBeenCalled();
      expect(screen.getByTestId('account-notice')).toHaveTextContent(
        'Your saved copy was deleted. This phone keeps its results.',
      );
      expect(screen.getByTestId('sync-email')).toBeOnTheScreen();
    });

    it('THEN a failure stays on the confirm screen and says why in the house’s words', async () => {
      const { raw } = await signedIn({ fail: 'TypeError: Network request failed' });
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Delete my saved data' })),
      );
      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Delete' })));
      await flush();
      expect(screen.getByTestId('delete-error')).toBeOnTheScreen();
      expect(screen.queryByText(/TypeError/)).toBeNull();
      expect(raw.auth.signOut).not.toHaveBeenCalled();
    });
  });

  describe('WHEN they tap “Request account deletion” (G2)', () => {
    it('THEN an email to the privacy page’s contact opens, asking for the account to go, with their email', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await signedIn();
      await act(async () =>
        fireEvent.press(screen.getByRole('link', { name: 'Request account deletion' })),
      );
      const url = open.mock.calls[0]![0];
      expect(url).toBe(deletionRequestUrl('alec@example.com'));
      expect(url.startsWith(`mailto:${CONTACT_EMAIL}?subject=`)).toBe(true);
      expect(CONTACT_EMAIL).toBe('contact@dailynoodle.co.uk');
      expect(decodeURIComponent(url)).toMatch(/Delete my Daily Noodle account/);
      expect(decodeURIComponent(url)).toMatch(/Sign-in email: alec@example\.com/);
      expect(screen.queryByTestId('account-mail-failed')).toBeNull();
    });

    it('THEN with no email app, it says where to write instead', async () => {
      jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
      await signedIn();
      await act(async () =>
        fireEvent.press(screen.getByRole('link', { name: 'Request account deletion' })),
      );
      await flush();
      expect(screen.getByTestId('account-mail-failed')).toHaveTextContent(CONTACT_EMAIL, {
        exact: false,
      });
    });
  });

  it('THEN signed out, the request email asks them to give their address', () => {
    expect(decodeURIComponent(deletionRequestUrl(null))).toMatch(
      /Sign-in email: \(the address I sign in with\)/,
    );
  });
});
